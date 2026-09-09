/**
 * Booking transport for the customer app.
 *
 * Two modes, one contract:
 *
 *  1. LIVE (a real Supabase project is configured) — POST /api/bookings, the
 *     service-role endpoint in `server/bookings.ts`. The browser never invents
 *     an appointment: a booking exists only when the server returns 201.
 *  2. DEMO (no live project configured) — the request is fulfilled on-device by
 *     `createDemoBooking`, which runs the SAME validation, pricing and row
 *     builder as the server. Without this branch every demo checkout ended in
 *     "Payment Failure / Advance Payment Incomplete", because the server
 *     answers 503 when no service-role key is present.
 *
 * Failures are always surfaced verbatim — no silent fallback from LIVE to DEMO.
 */

import type { Appointment } from '../types';
import type { BookingCreateRequest } from './bookingContract';
import { createDemoBooking } from './demoBookingStore';
import { isLocalDemoMode } from './supabase';

export interface CreateBookingResult {
  ok: boolean;
  appointment?: Appointment;
  error?: string;
}

function bookingEndpoint(): string {
  return `${window.location.origin}/api/bookings`;
}

/** Turn a raw server failure into something a customer can act on. */
function friendlyError(status: number, serverMessage?: string, fields?: unknown): string {
  const detail =
    Array.isArray(fields) && fields.length > 0
      ? ` (${fields.filter((f) => typeof f === 'string').slice(0, 2).join('; ')})`
      : '';

  if (status === 503) {
    return (
      'Bookings are temporarily unavailable: the secure booking service is not configured on the server ' +
      '(SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY). Your card was not charged and no slot was reserved.'
    );
  }
  if (status === 400) {
    return `This booking could not be validated${detail}. Please review the services, date and time, then try again. No payment was taken.`;
  }
  if (status === 404) {
    return 'Bookings are temporarily unavailable: the booking service endpoint was not found on this deployment. No payment was taken.';
  }
  if (status >= 500) {
    return `The booking service could not complete your request${detail || '.'} No payment was taken — please retry in a moment.`;
  }
  return serverMessage || `Booking request failed with status ${status}.`;
}

export async function createBooking(
  request: BookingCreateRequest,
  options: { signal?: AbortSignal } = {}
): Promise<CreateBookingResult> {
  // On-device demo mode: no network, same contract, honest "pending" booking.
  if (isLocalDemoMode) {
    return createDemoBooking(request);
  }

  let response: Response;
  try {
    response = await fetch(bookingEndpoint(), {
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
        'Could not reach the booking service (network error). No payment was taken and no slot was reserved — please check your connection and retry.',
    };
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Non-JSON failure body — fall through to the status-based error below.
  }

  if (!response.ok) {
    const body = (payload ?? {}) as { error?: unknown; fields?: unknown };
    const serverMessage = typeof body.error === 'string' ? body.error : undefined;
    return { ok: false, error: friendlyError(response.status, serverMessage, body.fields) };
  }

  const appointment =
    payload && typeof payload === 'object'
      ? (payload as { appointment?: Appointment }).appointment
      : undefined;

  if (!appointment || !appointment.id) {
    return { ok: false, error: 'Booking service returned an invalid confirmation. No appointment was created.' };
  }

  return { ok: true, appointment };
}
