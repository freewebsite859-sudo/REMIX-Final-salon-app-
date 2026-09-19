/**
 * Payments — refunds, invoices, history, and the Razorpay webhook.
 *
 *   POST /api/payments/refunds                 owner-scoped refund for a booking
 *   GET  /api/payments/refunds/:bookingId      refund status for one booking
 *   GET  /api/payments/history                 the caller's payment ledger
 *   GET  /api/payments/invoice/:bookingId      GST-style invoice (JSON or ?format=html)
 *   POST /api/payments/webhooks/razorpay       signed provider events (refund.processed, payment.captured…)
 *
 * Identity always comes from the verified bearer token (never the body), so a
 * customer can only refund / read their own bookings. Every Razorpay call uses
 * the server-side key pair; nothing here ever reaches the browser bundle.
 *
 * Refund policy (also enforced by the server, not just shown in the UI):
 *   ≥ 24 h before slot  → 100 % of the advance
 *   2 h – 24 h before   → 50 %
 *   < 2 h / after start → 0 %
 */
import crypto from 'crypto';
import express, { Router, Request, Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from './notifications';
import { jsonError } from './bookings';
import { createSupabaseAccountStore, type AccountStore as FullAccountStore } from './userAccount';
type AccountStore = Pick<FullAccountStore, 'verifyAccessToken'>;
import { readRazorpayConfig } from './payments';
import { refundPolicyFor } from '../src/lib/refundPolicy';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RefundableBooking {
  id: string;
  user_id: string | null;
  booking_ref: string;
  salon_id: string;
  salon_snapshot: { name?: string; address?: string; phone?: string; gstin?: string } | null;
  customer: { name?: string; phone?: string; email?: string } | null;
  slot_date: string;
  slot_time: string;
  status: string;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  advance_amount: number;
  payment_mode: string;
  payment_status: string;
  metadata: { services?: { name?: string; price?: number; quantity?: number; category?: string }[]; payment?: { paymentId?: string; orderId?: string } } | null;
  created_at: string;
}

export interface RefundRecord {
  id: string;
  payment_id: string;
  booking_id: string | null;
  user_id: string | null;
  amount_paise: number;
  currency: 'INR';
  status: 'pending' | 'processed' | 'failed';
  reason: string | null;
  speed: 'normal' | 'optimum';
  provider_payload?: unknown;
  created_at: string;
  processed_at?: string | null;
}

export interface RefundStore {
  getBookingForUser(bookingId: string, userId: string): Promise<RefundableBooking | null>;
  listBookingsForUser(userId: string): Promise<RefundableBooking[]>;
  listRefundsForBooking(bookingId: string): Promise<RefundRecord[]>;
  listRefundsForUser(userId: string): Promise<RefundRecord[]>;
  insertRefund(row: RefundRecord): Promise<{ ok: boolean; error?: string }>;
  updateRefundStatus(refundId: string, status: RefundRecord['status'], payload?: unknown): Promise<void>;
  markBookingCancelled(bookingId: string): Promise<void>;
}

export type RazorpayRefundFn = (input: { paymentId: string; amountPaise: number; notes: Record<string, string>; speed: 'normal' | 'optimum' }) =>
  Promise<{ ok: true; refund: { id: string; status: string; amount: number; created_at: number } } | { ok: false; error: string; status?: number }>;

// ---------------------------------------------------------------------------
// Policy
// ---------------------------------------------------------------------------

export { refundPolicyFor } from '../src/lib/refundPolicy';

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------

export function createMemoryRefundStore(seed: RefundableBooking[] = []): RefundStore & { refunds: RefundRecord[]; bookings: RefundableBooking[] } {
  const bookings = [...seed];
  const refunds: RefundRecord[] = [];
  return {
    bookings,
    refunds,
    async getBookingForUser(id, userId) { return bookings.find((b) => b.id === id && b.user_id === userId) ?? null; },
    async listBookingsForUser(userId) { return bookings.filter((b) => b.user_id === userId); },
    async listRefundsForBooking(id) { return refunds.filter((r) => r.booking_id === id); },
    async listRefundsForUser(userId) { return refunds.filter((r) => r.user_id === userId); },
    async insertRefund(row) { refunds.push(row); return { ok: true }; },
    async updateRefundStatus(id, status, payload) { const r = refunds.find((x) => x.id === id); if (r) { r.status = status; r.provider_payload = payload; if (status === 'processed') r.processed_at = new Date().toISOString(); } },
    async markBookingCancelled(id) { const b = bookings.find((x) => x.id === id); if (b) b.status = 'cancelled'; },
  };
}

export function createSupabaseRefundStore(client: SupabaseClient): RefundStore {
  const cols = 'id,user_id,booking_ref,salon_id,salon_snapshot,customer,slot_date,slot_time,status,subtotal,discount_amount,total_amount,advance_amount,payment_mode,payment_status,metadata,created_at';
  return {
    async getBookingForUser(id, userId) {
      const { data } = await client.from('bookings').select(cols).eq('id', id).eq('user_id', userId).maybeSingle();
      return (data as RefundableBooking | null) ?? null;
    },
    async listBookingsForUser(userId) {
      const { data } = await client.from('bookings').select(cols).eq('user_id', userId).order('created_at', { ascending: false }).limit(100);
      return (data as RefundableBooking[] | null) ?? [];
    },
    async listRefundsForBooking(id) {
      const { data } = await client.from('payment_refunds').select('*').eq('booking_id', id);
      return (data as RefundRecord[] | null) ?? [];
    },
    async listRefundsForUser(userId) {
      const { data } = await client.from('payment_refunds').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(100);
      return (data as RefundRecord[] | null) ?? [];
    },
    async insertRefund(row) {
      const { error } = await client.from('payment_refunds').insert(row);
      return error ? { ok: false, error: error.message } : { ok: true };
    },
    async updateRefundStatus(id, status, payload) {
      await client.from('payment_refunds').update({ status, provider_payload: payload ?? null, processed_at: status === 'processed' ? new Date().toISOString() : null }).eq('id', id);
    },
    async markBookingCancelled(id) {
      await client.from('bookings').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', id);
    },
  };
}

// ---------------------------------------------------------------------------
// Razorpay refund API
// ---------------------------------------------------------------------------

export function createRazorpayRefundFactory(env: NodeJS.ProcessEnv, fetchImpl: typeof fetch = fetch): RazorpayRefundFn {
  return async ({ paymentId, amountPaise, notes, speed }) => {
    const { keyId, keySecret, configured } = readRazorpayConfig(env);
    if (!configured) return { ok: false, error: 'Razorpay is not configured', status: 503 };
    try {
      const res = await fetchImpl(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refund`, {
        method: 'POST',
        headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amountPaise, speed, notes, receipt: `rf_${notes.bookingRef || paymentId}`.slice(0, 40) }),
      });
      const json = (await res.json().catch(() => ({}))) as { id?: string; status?: string; amount?: number; created_at?: number; error?: { description?: string } };
      if (!res.ok || !json.id) return { ok: false, error: json.error?.description || `Razorpay refund HTTP ${res.status}`, status: res.status };
      return { ok: true, refund: { id: json.id, status: json.status || 'pending', amount: json.amount ?? amountPaise, created_at: json.created_at ?? Math.floor(Date.now() / 1000) } };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Razorpay refund request failed' };
    }
  };
}

/** Razorpay webhook signature: HMAC-SHA256 of the raw body with the webhook secret. */
export function verifyRazorpayWebhook(rawBody: string | Buffer, signature: string | undefined, secret: string | undefined): boolean {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// Invoice
// ---------------------------------------------------------------------------

export const GST_RATE = 0.18;

export interface Invoice {
  invoiceNumber: string;
  issuedAt: string;
  bookingRef: string;
  bookingId: string;
  status: string;
  salon: { name: string; address: string; phone: string | null; gstin: string | null };
  customer: { name: string; phone: string | null; email: string | null };
  appointment: { date: string; time: string };
  lines: { description: string; category: string | null; quantity: number; unitPrice: number; amount: number }[];
  subtotal: number;
  discount: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  total: number;
  advancePaid: number;
  refunded: number;
  balanceDue: number;
  payment: { mode: string; status: string; paymentId: string | null; orderId: string | null };
}

export function buildInvoice(b: RefundableBooking, refunds: RefundRecord[] = []): Invoice {
  const lines = (b.metadata?.services ?? []).map((s) => {
    const qty = Number(s.quantity) > 0 ? Number(s.quantity) : 1;
    const unit = Number(s.price) || 0;
    return { description: s.name || 'Service', category: s.category ?? null, quantity: qty, unitPrice: unit, amount: Math.round(unit * qty) };
  });
  const subtotal = Number(b.subtotal) || lines.reduce((n, l) => n + l.amount, 0);
  const discount = Number(b.discount_amount) || 0;
  const total = Number(b.total_amount) || Math.max(0, subtotal - discount);
  // Prices in the catalog are tax-inclusive; back out GST for the invoice.
  const taxableValue = Math.round((total / (1 + GST_RATE)) * 100) / 100;
  const tax = Math.round((total - taxableValue) * 100) / 100;
  const advancePaid = b.payment_status === 'paid' ? Number(b.advance_amount) || 0 : 0;
  const refunded = refunds.filter((r) => r.status === 'processed').reduce((n, r) => n + r.amount_paise / 100, 0);
  const seq = b.booking_ref.replace(/[^A-Z0-9]/gi, '').slice(-6).toUpperCase();
  return {
    invoiceNumber: `NX-INV-${b.slot_date.replace(/-/g, '').slice(2)}-${seq}`,
    issuedAt: new Date().toISOString(),
    bookingRef: b.booking_ref,
    bookingId: b.id,
    status: b.status,
    salon: { name: b.salon_snapshot?.name || b.salon_id, address: b.salon_snapshot?.address || '', phone: b.salon_snapshot?.phone ?? null, gstin: b.salon_snapshot?.gstin ?? null },
    customer: { name: b.customer?.name || 'Customer', phone: b.customer?.phone ?? null, email: b.customer?.email ?? null },
    appointment: { date: b.slot_date, time: b.slot_time },
    lines,
    subtotal,
    discount,
    taxableValue,
    cgst: Math.round((tax / 2) * 100) / 100,
    sgst: Math.round((tax / 2) * 100) / 100,
    total,
    advancePaid,
    refunded,
    balanceDue: b.status === 'cancelled' ? 0 : Math.max(0, total - advancePaid),
    payment: { mode: b.payment_mode, status: b.payment_status, paymentId: b.metadata?.payment?.paymentId ?? null, orderId: b.metadata?.payment?.orderId ?? null },
  };
}

const inr = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const esc = (s: string | null | undefined) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export function renderInvoiceHtml(inv: Invoice): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Invoice ${esc(inv.invoiceNumber)}</title>
<style>body{font-family:Inter,system-ui,sans-serif;color:#26181a;max-width:720px;margin:32px auto;padding:0 20px}h1{color:#780032;font-size:22px;margin:0}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{padding:8px;border-bottom:1px solid #e0bec3;text-align:left;font-size:13px}th{background:#fff0f1;font-size:11px;text-transform:uppercase;letter-spacing:.05em}.r{text-align:right}.tot td{font-weight:700}.muted{color:#594045;font-size:12px}.badge{display:inline-block;padding:2px 8px;border-radius:999px;background:#ffd9df;color:#780032;font-size:11px;font-weight:700}@media print{button{display:none}}</style></head><body>
<div style="display:flex;justify-content:space-between;align-items:flex-start"><div><h1>Nexora Tax Invoice</h1><div class="muted">${esc(inv.invoiceNumber)} · ${new Date(inv.issuedAt).toLocaleDateString('en-IN')}</div></div><span class="badge">${esc(inv.status.toUpperCase())}</span></div>
<table><tr><td><strong>Billed by</strong><br>${esc(inv.salon.name)}<br><span class="muted">${esc(inv.salon.address)}${inv.salon.gstin ? `<br>GSTIN ${esc(inv.salon.gstin)}` : ''}</span></td><td><strong>Billed to</strong><br>${esc(inv.customer.name)}<br><span class="muted">${esc(inv.customer.phone || inv.customer.email || '')}</span></td><td><strong>Appointment</strong><br>${esc(inv.appointment.date)} · ${esc(inv.appointment.time)}<br><span class="muted">Ref ${esc(inv.bookingRef)}</span></td></tr></table>
<table><thead><tr><th>Service</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead><tbody>
${inv.lines.map((l) => `<tr><td>${esc(l.description)}${l.category ? ` <span class="muted">· ${esc(l.category)}</span>` : ''}</td><td class="r">${l.quantity}</td><td class="r">${inr(l.unitPrice)}</td><td class="r">${inr(l.amount)}</td></tr>`).join('')}
<tr><td colspan="3" class="r">Subtotal</td><td class="r">${inr(inv.subtotal)}</td></tr>
${inv.discount ? `<tr><td colspan="3" class="r">Discount</td><td class="r">− ${inr(inv.discount)}</td></tr>` : ''}
<tr><td colspan="3" class="r muted">Taxable value</td><td class="r muted">${inr(inv.taxableValue)}</td></tr>
<tr><td colspan="3" class="r muted">CGST 9%</td><td class="r muted">${inr(inv.cgst)}</td></tr>
<tr><td colspan="3" class="r muted">SGST 9%</td><td class="r muted">${inr(inv.sgst)}</td></tr>
<tr class="tot"><td colspan="3" class="r">Total (incl. GST)</td><td class="r">${inr(inv.total)}</td></tr>
<tr><td colspan="3" class="r">Advance paid online${inv.payment.paymentId ? ` <span class="muted">(${esc(inv.payment.paymentId)})</span>` : ''}</td><td class="r">${inr(inv.advancePaid)}</td></tr>
${inv.refunded ? `<tr><td colspan="3" class="r">Refunded</td><td class="r">− ${inr(inv.refunded)}</td></tr>` : ''}
<tr class="tot"><td colspan="3" class="r">Balance due at salon</td><td class="r">${inr(inv.balanceDue)}</td></tr>
</tbody></table>
<p class="muted">Prices are inclusive of GST. This is a computer-generated invoice issued by Nexora Technologies Pvt. Ltd. on behalf of the salon.</p>
<button onclick="window.print()" style="margin-top:12px;padding:10px 16px;border:0;border-radius:10px;background:#780032;color:#fff;font-weight:700;cursor:pointer">Print / Save as PDF</button>
</body></html>`;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

function extractBearer(req: Request): string | null {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() || null : null;
}

export function createPaymentsExtraRouter(
  env: NodeJS.ProcessEnv = process.env,
  deps: { store?: RefundStore | null; accountStore?: AccountStore | null; refund?: RazorpayRefundFn; now?: () => number } = {}
): Router {
  const router = Router();
  const { client } = createServiceClient(env);
  const store: RefundStore | null = deps.store !== undefined ? deps.store : client ? createSupabaseRefundStore(client) : null;
  const accountStore: AccountStore | null = deps.accountStore !== undefined ? deps.accountStore : client ? createSupabaseAccountStore(client) : null;
  const refund = deps.refund ?? createRazorpayRefundFactory(env);
  const now = deps.now ?? (() => Date.now());

  const authed = async (req: Request, res: Response): Promise<string | null> => {
    if (!accountStore || !store) { res.status(503).json({ error: 'Payment records are unavailable (service client not configured)', configured: false }); return null; }
    const token = extractBearer(req);
    if (!token) { jsonError(res, 401, 'Missing access token. Sign in again and retry.'); return null; }
    const v = await accountStore.verifyAccessToken(token);
    if (!v.ok || !v.userId) { jsonError(res, 401, v.error || 'Session expired. Sign in again and retry.'); return null; }
    return v.userId;
  };

  /** Quote + execute a refund for the caller's own booking. `dryRun: true` only quotes. */
  router.post('/refunds', express.json(), async (req: Request, res: Response) => {
    const userId = await authed(req, res);
    if (!userId) return;
    const bookingId = typeof req.body?.bookingId === 'string' ? req.body.bookingId.trim() : '';
    if (!bookingId) return jsonError(res, 400, 'bookingId is required');
    const booking = await store!.getBookingForUser(bookingId, userId);
    if (!booking) return jsonError(res, 404, 'No booking found for your account.');

    const policy = refundPolicyFor(booking.slot_date, booking.slot_time, Number(booking.advance_amount) || 0, now());
    const existing = await store!.listRefundsForBooking(bookingId);
    const already = existing.find((r) => r.status !== 'failed');
    if (req.body?.dryRun) return res.json({ quote: policy, alreadyRefunded: Boolean(already), refund: already ?? null });
    if (already) return res.status(409).json({ error: 'A refund already exists for this booking.', refund: already });

    const paymentId = booking.metadata?.payment?.paymentId ?? null;
    const paidOnline = booking.payment_status === 'paid' && Number(booking.advance_amount) > 0 && paymentId;

    if (!paidOnline || policy.amountRupees <= 0) {
      // Nothing to send back to the gateway — just cancel.
      await store!.markBookingCancelled(bookingId);
      return res.json({ cancelled: true, refund: null, quote: policy, message: paidOnline ? policy.label : 'No online payment to refund; booking cancelled.' });
    }

    const amountPaise = Math.round(policy.amountRupees * 100);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 200) : 'customer_cancellation';
    const out = await refund({ paymentId, amountPaise, speed: 'optimum', notes: { bookingRef: booking.booking_ref, bookingId, reason, policy: String(policy.percent) } });
    if (out.ok === false) return res.status(out.status && out.status >= 500 ? 502 : 502).json({ error: `Refund could not be initiated: ${out.error}. The booking is still active.`, quote: policy });

    const row: RefundRecord = {
      id: out.refund.id,
      payment_id: paymentId,
      booking_id: bookingId,
      user_id: userId,
      amount_paise: out.refund.amount,
      currency: 'INR',
      status: out.refund.status === 'processed' ? 'processed' : 'pending',
      reason,
      speed: 'optimum',
      provider_payload: out.refund,
      created_at: new Date(out.refund.created_at * 1000).toISOString(),
      processed_at: out.refund.status === 'processed' ? new Date().toISOString() : null,
    };
    const ins = await store!.insertRefund(row);
    if (!ins.ok) console.error('[Nexora] refund ledger write failed:', ins.error);
    await store!.markBookingCancelled(bookingId);
    return res.status(201).json({ cancelled: true, refund: row, quote: policy, message: `${policy.label}. ₹${policy.amountRupees} will reach your original payment method in 3–5 working days.` });
  });

  router.get('/refunds/:bookingId', async (req: Request, res: Response) => {
    const userId = await authed(req, res);
    if (!userId) return;
    const booking = await store!.getBookingForUser(req.params.bookingId, userId);
    if (!booking) return jsonError(res, 404, 'No booking found for your account.');
    const refunds = await store!.listRefundsForBooking(booking.id);
    return res.json({ bookingId: booking.id, quote: refundPolicyFor(booking.slot_date, booking.slot_time, Number(booking.advance_amount) || 0, now()), refunds });
  });

  /** Payment history: one row per booking with its refunds folded in. */
  router.get('/history', async (req: Request, res: Response) => {
    const userId = await authed(req, res);
    if (!userId) return;
    const [bookings, refunds] = await Promise.all([store!.listBookingsForUser(userId), store!.listRefundsForUser(userId)]);
    const rows = bookings.map((b) => {
      const mine = refunds.filter((r) => r.booking_id === b.id);
      const refunded = mine.filter((r) => r.status === 'processed').reduce((n, r) => n + r.amount_paise / 100, 0);
      return {
        bookingId: b.id,
        bookingRef: b.booking_ref,
        salonName: b.salon_snapshot?.name || b.salon_id,
        date: b.slot_date,
        time: b.slot_time,
        status: b.status,
        services: (b.metadata?.services ?? []).map((s) => s.name).filter(Boolean),
        total: Number(b.total_amount) || 0,
        advancePaid: b.payment_status === 'paid' ? Number(b.advance_amount) || 0 : 0,
        paymentStatus: b.payment_status,
        paymentMode: b.payment_mode,
        paymentId: b.metadata?.payment?.paymentId ?? null,
        refunded,
        refunds: mine,
        createdAt: b.created_at,
      };
    });
    const totals = rows.reduce((t, r) => ({ paid: t.paid + r.advancePaid, refunded: t.refunded + r.refunded, bookings: t.bookings + 1 }), { paid: 0, refunded: 0, bookings: 0 });
    return res.json({ rows, totals });
  });

  router.get('/invoice/:bookingId', async (req: Request, res: Response) => {
    const userId = await authed(req, res);
    if (!userId) return;
    const booking = await store!.getBookingForUser(req.params.bookingId, userId);
    if (!booking) return jsonError(res, 404, 'No booking found for your account.');
    const invoice = buildInvoice(booking, await store!.listRefundsForBooking(booking.id));
    if (req.query.format === 'html') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `inline; filename="${invoice.invoiceNumber}.html"`);
      return res.send(renderInvoiceHtml(invoice));
    }
    return res.json({ invoice });
  });

  /** Razorpay webhook — raw body required for signature verification. */
  router.post('/webhooks/razorpay', express.raw({ type: '*/*' }), async (req: Request, res: Response) => {
    // Prefer the raw bytes captured by the app-level json parser (`verify`), else our own raw parser.
    const captured = (req as Request & { rawBody?: Buffer }).rawBody;
    const raw = captured ?? (Buffer.isBuffer(req.body) ? req.body : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {})));
    if (!verifyRazorpayWebhook(raw, req.headers['x-razorpay-signature'] as string | undefined, env.RAZORPAY_WEBHOOK_SECRET)) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }
    let event: { event?: string; payload?: { refund?: { entity?: { id?: string; status?: string; payment_id?: string } }; payment?: { entity?: { id?: string; status?: string } } } };
    try { event = JSON.parse(raw.toString('utf8')); } catch { return res.status(400).json({ error: 'Malformed JSON' }); }

    const handled: string[] = [];
    if (store && event.event?.startsWith('refund.') && event.payload?.refund?.entity?.id) {
      const r = event.payload.refund.entity;
      const status: RefundRecord['status'] = event.event === 'refund.processed' ? 'processed' : event.event === 'refund.failed' ? 'failed' : 'pending';
      await store.updateRefundStatus(r.id as string, status, r);
      handled.push(`${event.event}:${r.id}`);
    }
    return res.json({ received: true, handled });
  });

  return router;
}
