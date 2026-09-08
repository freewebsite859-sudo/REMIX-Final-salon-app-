/**
 * Nexora Customer App — payment client.
 *
 * The browser never creates or verifies a payment itself. It calls the secure
 * backend (Express `/api/payments/*` or a Supabase Edge Function base URL) with
 * the customer's Supabase access token. All secret keys stay server-side.
 */
import type { Appointment } from '../types';
import { supabase } from './supabase';
import { loadRazorpayScript, type RazorpayPaymentSuccessResponse } from './razorpay';

export type PaymentFlowStatus =
  | 'payment_ready'
  | 'payment_processing'
  | 'payment_successful'
  | 'payment_failed'
  | 'payment_service_unavailable';

export interface PaymentConfigResult {
  state: PaymentFlowStatus;
  configured: boolean;
  provider?: string;
  keyId?: string;
  currency?: string;
  message?: string;
}

export interface CreatePaymentOrderInput {
  salonId: string;
  serviceIds: string[];
  stylistId?: string;
  date: string;
  time: string;
  amount: number;
  couponCode?: string;
  notes?: string;
  draftBookingRef?: string;
}

export interface PaymentOrderResult {
  state: PaymentFlowStatus;
  orderId?: string;
  keyId?: string;
  amountPaise?: number;
  amount?: number;
  currency?: string;
  bookingId?: string;
  draftBookingRef?: string;
  totalAmount?: number;
  remainingAmount?: number;
  discountApplied?: number;
  message?: string;
}

export interface VerifyPaymentInput {
  razorpayPaymentId: string;
  razorpayOrderId: string;
  razorpaySignature: string;
  bookingId?: string;
  draftBookingRef?: string;
  method?: string;
}

export interface PaymentFlowResult {
  state: PaymentFlowStatus;
  appointment?: Appointment;
  message?: string;
  draftBookingRef?: string;
}

export class PaymentFlowError extends Error {
  readonly state: PaymentFlowStatus;
  readonly retryable: boolean;
  constructor(message: string, state: PaymentFlowStatus = 'payment_failed', retryable = true) {
    super(message);
    this.name = 'PaymentFlowError';
    this.state = state;
    this.retryable = retryable;
  }
}

function configBase(): string {
  const configured = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  const base = configured?.VITE_PAYMENTS_BASE_URL?.trim();
  return base || '/api/payments';
}

async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

async function backendFetch(path: string, init: RequestInit = {}, token?: string | null): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${configBase()}${path}`, { ...init, headers });
  let body: Record<string, unknown> = {};
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  if (!response.ok) {
    throw new PaymentFlowError(
      typeof body.message === 'string' ? body.message : `Payment backend returned ${response.status}.`,
      typeof body.state === 'string' && body.state === 'payment_service_unavailable'
        ? 'payment_service_unavailable'
        : 'payment_failed',
      response.status >= 500 ? false : true
    );
  }
  return body;
}

/**
 * Read-only readiness check. Never throws a 500; a missing/misconfigured
 * backend always resolves to `payment_service_unavailable`.
 */
export async function getPaymentConfig(): Promise<PaymentConfigResult> {
  try {
    const body = await backendFetch('/config');
    return {
      state: (body.state as PaymentFlowStatus) || (body.configured ? 'payment_ready' : 'payment_service_unavailable'),
      configured: Boolean(body.configured),
      provider: typeof body.provider === 'string' ? body.provider : undefined,
      keyId: typeof body.keyId === 'string' ? body.keyId : undefined,
      currency: typeof body.currency === 'string' ? body.currency : undefined,
      message: typeof body.message === 'string' ? body.message : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Secure payment service is unreachable.';
    return { state: 'payment_service_unavailable', configured: false, message };
  }
}

/**
 * Ask the secure backend to validate the booking draft and create a Razorpay
 * order. Throws PaymentFlowError on validation/provider failure.
 */
export async function createPaymentOrder(input: CreatePaymentOrderInput): Promise<PaymentOrderResult> {
  const token = await getAccessToken();
  if (!token) {
    throw new PaymentFlowError('Authentication required to start payment.', 'payment_failed');
  }
  const body = await backendFetch(
    '/order',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
    token
  );
  return {
    state: (body.state as PaymentFlowStatus) || 'payment_ready',
    orderId: typeof body.orderId === 'string' ? body.orderId : undefined,
    keyId: typeof body.keyId === 'string' ? body.keyId : undefined,
    amountPaise: typeof body.amountPaise === 'number' ? body.amountPaise : undefined,
    amount: typeof body.amount === 'number' ? body.amount : undefined,
    currency: typeof body.currency === 'string' ? body.currency : undefined,
    bookingId: typeof body.bookingId === 'string' ? body.bookingId : undefined,
    draftBookingRef: typeof body.draftBookingRef === 'string' ? body.draftBookingRef : undefined,
    totalAmount: typeof body.totalAmount === 'number' ? body.totalAmount : undefined,
    remainingAmount: typeof body.remainingAmount === 'number' ? body.remainingAmount : undefined,
    discountApplied: typeof body.discountApplied === 'number' ? body.discountApplied : undefined,
    message: typeof body.message === 'string' ? body.message : undefined,
  };
}

export interface RazorpayOpenResult {
  action: 'success' | 'failed' | 'cancelled';
  response?: RazorpayPaymentSuccessResponse;
  message?: string;
}

/**
 * Open Razorpay checkout with the server-created order id and the public key id.
 * No order id or signature is generated in the browser.
 */
export async function openRazorpayCheckout(params: {
  keyId: string;
  orderId: string;
  amountPaise: number;
  currency: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  bookingRef?: string;
}): Promise<RazorpayOpenResult> {
  const loaded = await loadRazorpayScript();
  if (!loaded || typeof window === 'undefined' || !window.Razorpay) {
    return { action: 'failed', message: 'Razorpay checkout could not be loaded.' };
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: RazorpayOpenResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    try {
      const rzp = new window.Razorpay({
        key: params.keyId,
        amount: params.amountPaise,
        currency: params.currency || 'INR',
        name: 'Nexora SalonOS',
        description: params.bookingRef ? `Booking ${params.bookingRef}` : 'Online booking deposit',
        order_id: params.orderId,
        prefill: {
          name: params.customerName,
          email: params.customerEmail,
          contact: params.customerPhone,
        },
        notes: { booking_ref: params.bookingRef || '' },
        theme: { color: '#b90064' },
        handler: (response) => {
          finish({ action: 'success', response });
        },
        modal: {
          ondismiss: () => finish({ action: 'cancelled', message: 'Payment was cancelled by the user.' }),
          escape: true,
          backdropclose: false,
        },
      });
      rzp.on('payment.failed', (failure: { error?: { description?: string } }) => {
        finish({
          action: 'failed',
          message: failure?.error?.description || 'Payment failed. No appointment was created.',
        });
      });
      rzp.open();
    } catch (err) {
      finish({ action: 'failed', message: err instanceof Error ? err.message : 'Razorpay checkout failed.' });
    }
  });
}

/**
 * Verify a completed Razorpay checkout response server-side. Only a
 * backend-verified capture returns a booking. This function never marks a
 * booking paid from the browser.
 */
export async function verifyPayment(input: VerifyPaymentInput): Promise<PaymentFlowResult> {
  const token = await getAccessToken();
  if (!token) {
    throw new PaymentFlowError('Authentication required to verify payment.', 'payment_failed');
  }
  const body = await backendFetch(
    '/verify',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
    token
  );
  const state = (body.state as PaymentFlowStatus) || 'payment_failed';
  return {
    state,
    appointment: (body.appointment as Appointment | undefined) || undefined,
    message: typeof body.message === 'string' ? body.message : undefined,
    draftBookingRef: typeof body.draftBookingRef === 'string' ? body.draftBookingRef : undefined,
  };
}
