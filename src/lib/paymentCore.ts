/**
 * Nexora payment CORE — isomorphic rules for the 25% slot-lock deposit.
 *
 * Why this module exists
 * ----------------------
 * The booking summary copy is a contract, not decoration:
 *
 *   "No merchant QR code or client-side payment shortcut is used.
 *    The booking is created only after a server-side gateway order
 *    and signature verification succeed."
 *
 * These helpers are the single source of truth for:
 *   - Razorpay HMAC signature (order_id + "|" + payment_id)
 *   - slot-hold keys so two clients cannot lock the same chair/time
 *   - paise conversion matching the 25% advance from bookingCore
 *
 * PURE of Express / DOM / Razorpay SDK. The Node payments router and the
 * unit tests both import this file so a forged client payload can never
 * disagree with what the server verifies.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

/** How long an unpaid gateway order may hold a slot (10 minutes). */
export const SLOT_HOLD_TTL_MS = 10 * 60 * 1000;

/** Razorpay (and our test double) signs `order_id|payment_id` with HMAC-SHA256. */
export function razorpaySignature(
  orderId: string,
  paymentId: string,
  secret: string
): string {
  return createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Constant-time verify. Rejects empty/missing inputs — a missing signature
 * is never treated as "unsigned success".
 */
export function verifyRazorpaySignature(input: {
  orderId: unknown;
  paymentId: unknown;
  signature: unknown;
  secret: string;
}): { ok: true } | { ok: false; reason: string } {
  const orderId = typeof input.orderId === 'string' ? input.orderId.trim() : '';
  const paymentId = typeof input.paymentId === 'string' ? input.paymentId.trim() : '';
  const signature = typeof input.signature === 'string' ? input.signature.trim() : '';
  if (!input.secret) return { ok: false, reason: 'Payment signing secret is not configured' };
  if (!orderId) return { ok: false, reason: 'razorpay_order_id is required' };
  if (!paymentId) return { ok: false, reason: 'razorpay_payment_id is required' };
  if (!signature) return { ok: false, reason: 'razorpay_signature is required' };
  const expected = razorpaySignature(orderId, paymentId, input.secret);
  if (!safeEqualHex(expected, signature)) {
    return { ok: false, reason: 'Payment signature mismatch' };
  }
  return { ok: true };
}

/** Convert a rupee advance (already rounded by bookingCore) into integer paise. */
export function rupeesToPaise(rupees: number): number {
  if (!Number.isFinite(rupees) || rupees < 0) return 0;
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: number): number {
  if (!Number.isFinite(paise) || paise < 0) return 0;
  return Math.round(paise) / 100;
}

/**
 * Canonical slot key. A named stylist only conflicts with the same stylist
 * (or an "any professional" hold). An any-professional hold conflicts with
 * every chair at that salon/date/time.
 */
export function makeSlotKey(
  salonId: string,
  date: string,
  time: string,
  stylistId?: string | null
): string {
  const chair = stylistId && stylistId.trim() ? stylistId.trim() : '*';
  return `${salonId}|${date}|${time}|${chair}`;
}

export function slotPrefix(salonId: string, date: string, time: string): string {
  return `${salonId}|${date}|${time}|`;
}

export interface SlotHoldLike {
  slotKey: string;
  expiresAt: number;
}

/** True when an existing hold blocks a new attempt on the same chair/time. */
export function slotHoldConflicts(
  holds: Iterable<SlotHoldLike>,
  salonId: string,
  date: string,
  time: string,
  stylistId: string | null | undefined,
  now: number = Date.now()
): boolean {
  const prefix = slotPrefix(salonId, date, time);
  const wantSpecific = Boolean(stylistId && stylistId.trim());
  const wantChair = wantSpecific ? stylistId!.trim() : '*';
  for (const hold of holds) {
    if (hold.expiresAt <= now) continue;
    if (!hold.slotKey.startsWith(prefix)) continue;
    const heldChair = hold.slotKey.slice(prefix.length) || '*';
    if (!wantSpecific) return true;
    if (heldChair === '*' || heldChair === wantChair) return true;
  }
  return false;
}

export interface GatewayOrder {
  id: string;
  amount: number; // paise
  currency: 'INR';
  receipt: string;
}
