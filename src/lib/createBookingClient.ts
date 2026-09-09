/**
 * Booking transport for the customer app.
 *
 * Live path (a real Supabase project is configured)
 * -------------------------------------------------
 *  1. POST /api/payments/orders   — server creates a Razorpay order and holds the slot
 *  2. Official Razorpay Checkout  — the only payment UI; no merchant QR, no simulated pay
 *  3. POST /api/payments/verify   — HMAC signature check, THEN the booking row is written
 *
 * A booking exists only when verify returns 201. The browser never invents an
 * appointment, never generates an order id, and never treats a client event as
 * payment success.
 *
 * Demo path (no live project configured)
 * --------------------------------------
 * `createDemoBooking` runs the SAME validation/pricing core on-device. The UI
 * labels it as a demo record; no gateway charge is claimed.
 *
 * Failures are always surfaced verbatim — no silent fallback from LIVE to DEMO.
 */

import type { Appointment } from '../types';
import type { BookingCreateRequest } from './bookingContract';
import { createDemoBooking } from './demoBookingStore';
import { checkoutWithRazorpay, type RazorpayPaymentSuccessResponse } from './razorpay';
import { isLocalDemoMode } from './supabase';

export interface CreateBookingResult {
  ok: boolean;
  appointment?: Appointment;
  error?: string;
}

export interface VerifiedPaymentPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

function origin(): string {
  return typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : '';
}

function ordersEndpoint(): string {
  return `${origin()}/api/payments/orders`;
}

function verifyEndpoint(): string {
  return `${origin()}/api/payments/verify`;
}

function friendlyError(status: number, serverMessage?: string, fields?: unknown): string {
  const detail =
    Array.isArray(fields) && fields.length > 0
      ? ` (${fields.filter((f) => typeof f === 'string').slice(0, 2).join('; ')})`
      : '';

  if (status === 503) {
    return (
      'Bookings are temporarily unavailable: the secure payment service is not configured on the server ' +
      '(RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET or SUPABASE_SERVICE_ROLE_KEY). No slot was reserved.'
    );
  }
  if (status === 402) {
    return (
      serverMessage ||
      'Payment signature could not be verified. No appointment was created and the slot was not locked.'
    );
  }
  if (status === 409) {
    return serverMessage || 'This slot is no longer available. Choose another time. No second booking was created.';
  }
  if (status === 410) {
    return 'The slot hold expired before payment was verified. No booking was created — please retry.';
  }
  if (status === 400) {
    return `This booking could not be validated${detail}. Please review the services, date and time, then try again.`;
  }
  if (status === 404) {
    return 'The payment order was not found. No booking was created.';
  }
  if (status >= 500) {
    return (
      serverMessage ||
      `The booking service could not complete your request${detail || '.'} If a payment was captured, contact support with your payment id.`
    );
  }
  return serverMessage || `Booking request failed with status ${status}.`;
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const payload = await response.json();
    return payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function createBooking(
  request: BookingCreateRequest,
  options: {
    signal?: AbortSignal;
    /** When the official checkout has already returned ids+signature. */
    payment?: VerifiedPaymentPayload;
  } = {}
): Promise<CreateBookingResult> {
  if (isLocalDemoMode) {
    return createDemoBooking(request);
  }

  return completeVerifiedCheckout(request, options);
}

export async function completeVerifiedCheckout(
  request: BookingCreateRequest,
  options: {
    signal?: AbortSignal;
    payment?: VerifiedPaymentPayload;
  } = {}
): Promise<CreateBookingResult> {
  let orderResponse: Response;
  try {
    orderResponse = await fetch(ordersEndpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: options.signal,
    });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') {
      return { ok: false, error: 'The booking request was cancelled. No payment was taken.' };
    }
    return {
      ok: false,
      error:
        'Could not reach the payment service (network error). No payment was taken and no slot was reserved — please check your connection and retry.',
    };
  }

  const orderBody = await readJson(orderResponse);
  if (!orderResponse.ok) {
    const serverMessage = typeof orderBody.error === 'string' ? orderBody.error : undefined;
    return { ok: false, error: friendlyError(orderResponse.status, serverMessage, orderBody.fields) };
  }

  const orderId = typeof orderBody.orderId === 'string' ? orderBody.orderId : '';
  const keyId = typeof orderBody.keyId === 'string' ? orderBody.keyId : '';
  const amountPaise = typeof orderBody.amountPaise === 'number' ? orderBody.amountPaise : 0;
  if (!orderId || !keyId) {
    return {
      ok: false,
      error: 'Payment service returned an invalid gateway order. No payment was taken and no slot was locked.',
    };
  }

  let payment: VerifiedPaymentPayload | undefined = options.payment;
  if (!payment) {
    const checkout = await checkoutWithRazorpay({
      keyId,
      orderId,
      amountPaise,
      name: request.salon.name,
      description: `25% advance deposit to lock ${request.salon.name} · ${request.date} ${request.time}`,
      prefill: {
        name: request.customer?.name,
        email: request.customer?.email,
        contact: request.customer?.phone,
      },
      notes: {
        salon_id: request.salon.id,
        slot_date: request.date,
        slot_time: request.time,
      },
    });
    if (checkout.ok === false) {
      return { ok: false, error: checkout.error };
    }
    payment = checkout.payment;
  }

  if (
    payment.razorpay_order_id !== orderId ||
    !payment.razorpay_payment_id ||
    !payment.razorpay_signature
  ) {
    return {
      ok: false,
      error:
        'Payment response did not match the server-side order. No booking was created. A client-side payment shortcut is not accepted.',
    };
  }

  let verifyResponse: Response;
  try {
    verifyResponse = await fetch(verifyEndpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payment: {
          razorpay_order_id: payment.razorpay_order_id,
          razorpay_payment_id: payment.razorpay_payment_id,
          razorpay_signature: payment.razorpay_signature,
        },
      }),
      signal: options.signal,
    });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') {
      return {
        ok: false,
        error:
          'Verification was cancelled after payment. If you were charged, contact support with your payment id — no booking has been created yet.',
      };
    }
    return {
      ok: false,
      error:
        'Could not reach the payment verification service after checkout. If you were charged, contact support with your payment id.',
    };
  }

  const verifyBody = await readJson(verifyResponse);
  if (!verifyResponse.ok) {
    const serverMessage = typeof verifyBody.error === 'string' ? verifyBody.error : undefined;
    return { ok: false, error: friendlyError(verifyResponse.status, serverMessage, verifyBody.fields) };
  }

  const appointment =
    verifyBody.appointment && typeof verifyBody.appointment === 'object'
      ? (verifyBody.appointment as Appointment)
      : undefined;

  if (!appointment || !appointment.id) {
    return {
      ok: false,
      error:
        'Payment was verified but the booking service returned an invalid confirmation. Contact support with your payment id.',
    };
  }

  return { ok: true, appointment };
}

export type { RazorpayPaymentSuccessResponse };
