/**
 * Nexora server-side payment gateway (slot-lock deposit).
 *
 * Public contract
 * ---------------
 *   POST /api/payments/orders   create a Razorpay (or signed) order + hold the slot
 *   POST /api/payments/verify   HMAC-verify the payment, THEN create the booking
 *   GET  /api/payments/config   whether a real gateway is configured (never the secret)
 *
 * A booking row is written only from `verify`. POST /api/bookings is not a
 * payment shortcut — the bookings router answers 402 for unverified creates.
 *
 * No merchant QR, no client-generated order ids, no "simulate payment" path.
 * If Razorpay keys are missing the order endpoint answers 503 instead of
 * minting a fake success.
 */

import { Router, Request, Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from './notifications';
import { jsonError, createSupabaseBookingStore } from './bookings';
import {
  createBooking,
  validateBookingRequest,
  type BookingStore,
} from '../src/lib/bookingCore';
import type { BookingCreateRequest, BookingPaymentProof } from '../src/lib/bookingContract';
import {
  SLOT_HOLD_TTL_MS,
  makeSlotKey,
  rupeesToPaise,
  slotHoldConflicts,
  verifyRazorpaySignature,
  type GatewayOrder,
  type SlotHoldLike,
} from '../src/lib/paymentCore';

export interface PaymentOrderRecord {
  id: string;
  amountPaise: number;
  currency: 'INR';
  slotKey: string;
  salonId: string;
  slotDate: string;
  slotTime: string;
  stylistId: string | null;
  booking: BookingCreateRequest;
  status: 'created' | 'consumed' | 'expired';
  paymentId?: string;
  signature?: string;
  appointmentId?: string;
  appointment?: unknown;
  expiresAt: number;
  createdAt: string;
}

export interface PaymentOrderStore {
  put(order: PaymentOrderRecord): Promise<void>;
  get(orderId: string): Promise<PaymentOrderRecord | null>;
  listHolds(): Promise<SlotHoldLike[]>;
  consume(orderId: string, patch: Partial<PaymentOrderRecord>): Promise<void>;
}

export function createMemoryPaymentOrderStore(): PaymentOrderStore {
  const orders = new Map<string, PaymentOrderRecord>();
  return {
    async put(order) {
      orders.set(order.id, order);
    },
    async get(orderId) {
      return orders.get(orderId) ?? null;
    },
    async listHolds() {
      return Array.from(orders.values()).filter((o) => o.status === 'created');
    },
    async consume(orderId, patch) {
      const current = orders.get(orderId);
      if (!current) return;
      orders.set(orderId, { ...current, ...patch, status: patch.status ?? current.status });
    },
  };
}

export function readRazorpayConfig(env: NodeJS.ProcessEnv = process.env): {
  keyId: string | null;
  keySecret: string | null;
  configured: boolean;
} {
  const keyId = (env.RAZORPAY_KEY_ID || '').trim() || null;
  const keySecret = (env.RAZORPAY_KEY_SECRET || env.PAYMENT_SIGNING_SECRET || '').trim() || null;
  return { keyId, keySecret, configured: Boolean(keyId && keySecret) };
}

export type CreateGatewayOrder = (input: {
  amountPaise: number;
  receipt: string;
  notes: Record<string, string>;
}) => Promise<{ ok: true; order: GatewayOrder } | { ok: false; error: string; status?: number }>;

export function createRazorpayOrderFactory(
  env: NodeJS.ProcessEnv,
  fetchImpl: typeof fetch = fetch
): CreateGatewayOrder {
  return async ({ amountPaise, receipt, notes }) => {
    const { keyId, keySecret, configured } = readRazorpayConfig(env);
    if (!configured || !keyId || !keySecret) {
      return { ok: false, status: 503, error: 'Payment gateway is not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).' };
    }

    // Test/dev stub: never call the network when explicitly opted in. The
    // resulting order id is still HMAC-verified with the real secret, so the
    // browser cannot mint a passing signature.
    if (env.NEXORA_PAYMENTS_STUB === '1') {
      const id = `order_nexora_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      return { ok: true, order: { id, amount: amountPaise, currency: 'INR', receipt } };
    }

    try {
      const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
      const response = await fetchImpl('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountPaise,
          currency: 'INR',
          receipt,
          payment_capture: 1,
          notes,
        }),
      });
      const json = (await response.json().catch(() => ({}))) as {
        id?: string;
        amount?: number;
        currency?: string;
        error?: { description?: string };
      };
      if (!response.ok || !json.id) {
        return {
          ok: false,
          status: 502,
          error: json.error?.description || `Razorpay order creation failed (HTTP ${response.status})`,
        };
      }
      return {
        ok: true,
        order: {
          id: json.id,
          amount: typeof json.amount === 'number' ? json.amount : amountPaise,
          currency: 'INR',
          receipt,
        },
      };
    } catch (err) {
      return {
        ok: false,
        status: 502,
        error: err instanceof Error ? err.message : 'Razorpay order request failed',
      };
    }
  };
}

async function slotTakenInStore(
  store: BookingStore,
  salonId: string,
  date: string,
  time: string,
  stylistId: string | null
): Promise<boolean> {
  if (typeof store.findActiveSlot !== 'function') return false;
  try {
    return await store.findActiveSlot(salonId, date, time, stylistId);
  } catch (err) {
    console.error('[Nexora] findActiveSlot failed:', err);
    return false;
  }
}

export function createPaymentsRouter(
  env: NodeJS.ProcessEnv = process.env,
  deps: {
    bookingStore?: BookingStore | null;
    orderStore?: PaymentOrderStore;
    createGatewayOrder?: CreateGatewayOrder;
    now?: () => number;
  } = {}
): Router {
  const router = Router();
  const { client, reason } = createServiceClient(env);
  const bookingStore: BookingStore | null =
    deps.bookingStore !== undefined
      ? deps.bookingStore
      : client
        ? createSupabaseBookingStore(client as SupabaseClient)
        : null;
  const orderStore = deps.orderStore ?? createMemoryPaymentOrderStore();
  const createGatewayOrder = deps.createGatewayOrder ?? createRazorpayOrderFactory(env);
  const now = deps.now ?? (() => Date.now());

  router.get('/config', (_req: Request, res: Response) => {
    const cfg = readRazorpayConfig(env);
    return res.json({
      configured: cfg.configured,
      provider: 'razorpay',
      keyId: cfg.configured ? cfg.keyId : null,
      holdTtlMs: SLOT_HOLD_TTL_MS,
    });
  });

  router.post('/orders', async (req: Request, res: Response) => {
    const cfg = readRazorpayConfig(env);
    if (!cfg.configured || !cfg.keyId) {
      return jsonError(res, 503, 'Secure deposit is unavailable: the payment gateway is not configured on the server (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET). No slot was reserved and no payment was taken.');
    }
    if (!bookingStore) {
      return jsonError(res, 503, 'Booking service is not configured (no service-role client).', [
        reason ?? 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured',
      ]);
    }

    const parsed = validateBookingRequest(req.body);
    if (!parsed.ok || !parsed.value) {
      return jsonError(res, 400, 'Invalid booking request.', parsed.fields?.slice(0, 15));
    }
    const booking = parsed.value;
    const amountPaise = rupeesToPaise(booking.amount);
    if (amountPaise <= 0) {
      return jsonError(res, 400, 'Advance amount must be greater than zero.');
    }

    const stylistId = booking.stylist?.id ?? null;
    const t = now();
    const holds = await orderStore.listHolds();
    if (slotHoldConflicts(holds, booking.salon.id, booking.date, booking.time, stylistId, t)) {
      return jsonError(res, 409, 'This slot is already held by another checkout. Choose another time.');
    }
    if (await slotTakenInStore(bookingStore, booking.salon.id, booking.date, booking.time, stylistId)) {
      return jsonError(res, 409, 'This slot is no longer available. Choose another time.');
    }

    // Reserve the slot BEFORE awaiting the gateway so two concurrent POSTs
    // cannot both pass the conflict check.
    const holdId = `hold_${t.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const placeholder: PaymentOrderRecord = {
      id: holdId,
      amountPaise,
      currency: 'INR',
      slotKey: makeSlotKey(booking.salon.id, booking.date, booking.time, stylistId),
      salonId: booking.salon.id,
      slotDate: booking.date,
      slotTime: booking.time,
      stylistId,
      booking,
      status: 'created',
      expiresAt: t + SLOT_HOLD_TTL_MS,
      createdAt: new Date(t).toISOString(),
    };
    await orderStore.put(placeholder);

    const receipt = `nx_${t.toString(36)}`.slice(0, 40);
    const gateway = await createGatewayOrder({
      amountPaise,
      receipt,
      notes: {
        salon_id: booking.salon.id,
        slot_date: booking.date,
        slot_time: booking.time,
        advance_inr: String(booking.amount),
      },
    });
    if (gateway.ok === false) {
      await orderStore.consume(holdId, { status: 'expired' });
      return jsonError(res, gateway.status ?? 502, gateway.error);
    }
    if (gateway.order.amount !== amountPaise) {
      await orderStore.consume(holdId, { status: 'expired' });
      return jsonError(res, 502, 'Gateway order amount did not match the verified 25% advance.');
    }

    await orderStore.consume(holdId, { status: 'expired' });
    const record: PaymentOrderRecord = {
      ...placeholder,
      id: gateway.order.id,
    };
    await orderStore.put(record);

    return res.status(201).json({
      orderId: record.id,
      amount: booking.amount,
      amountPaise,
      currency: 'INR',
      keyId: cfg.keyId,
      holdExpiresAt: new Date(record.expiresAt).toISOString(),
      slotKey: record.slotKey,
    });
  });

  router.post('/verify', async (req: Request, res: Response) => {
    const cfg = readRazorpayConfig(env);
    if (!cfg.configured || !cfg.keySecret) {
      return jsonError(res, 503, 'Secure deposit is unavailable: the payment gateway is not configured. No booking was created.');
    }
    if (!bookingStore) {
      return jsonError(res, 503, 'Booking service is not configured (no service-role client).');
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const payment = (body.payment ?? body) as Record<string, unknown>;
    const orderId =
      (typeof payment.razorpay_order_id === 'string' && payment.razorpay_order_id) ||
      (typeof payment.orderId === 'string' && payment.orderId) ||
      (typeof body.orderId === 'string' && body.orderId) ||
      '';
    const paymentId =
      (typeof payment.razorpay_payment_id === 'string' && payment.razorpay_payment_id) ||
      (typeof payment.paymentId === 'string' && payment.paymentId) ||
      '';
    const signature =
      (typeof payment.razorpay_signature === 'string' && payment.razorpay_signature) ||
      (typeof payment.signature === 'string' && payment.signature) ||
      '';

    const verified = verifyRazorpaySignature({
      orderId,
      paymentId,
      signature,
      secret: cfg.keySecret,
    });
    if (verified.ok === false) {
      return jsonError(res, 402, verified.reason);
    }

    const order = await orderStore.get(orderId);
    if (!order) {
      return jsonError(res, 404, 'Unknown or expired gateway order. No booking was created.');
    }
    const t = now();
    if (order.status === 'consumed' && order.appointmentId) {
      // Idempotent replay of the same verified payment returns the booking.
      if (order.paymentId === paymentId) {
        return res.status(200).json({
          appointment: order.appointment ?? { id: order.appointmentId },
          replayed: true,
        });
      }
      return jsonError(res, 409, 'This gateway order has already been used.');
    }
    if (order.expiresAt <= t && order.status !== 'consumed') {
      await orderStore.consume(order.id, { status: 'expired' });
      return jsonError(res, 410, 'The slot hold expired before payment was verified. No booking was created.');
    }

    const receipt: BookingPaymentProof = {
      orderId,
      paymentId,
      signature,
      verifiedAt: new Date(t).toISOString(),
    };

    try {
      const result = await createBooking(bookingStore, order.booking, receipt);
      if (!result.appointment) {
        return jsonError(res, 500, result.error ?? 'Booking creation failed after a verified payment. Contact support with your payment id.');
      }
      await orderStore.consume(order.id, {
        status: 'consumed',
        paymentId,
        signature,
        appointmentId: result.appointment.id,
        appointment: result.appointment,
      });
      return res.status(201).json({ appointment: result.appointment });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected payment verification failure';
      console.error('[Nexora] Payment verify threw:', err);
      return jsonError(res, 500, message);
    }
  });

  return router;
}
