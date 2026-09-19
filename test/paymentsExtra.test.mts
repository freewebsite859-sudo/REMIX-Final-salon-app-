/**
 * Refunds, invoices, payment history, Razorpay webhook, maps proxy, SMS/FCM senders.
 * Run: npm run test:payments-extra
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

import { createPaymentsExtraRouter, createMemoryRefundStore, buildInvoice, renderInvoiceHtml, verifyRazorpayWebhook, type RefundableBooking } from '../server/paymentsExtra';
import { refundPolicyFor } from '../src/lib/refundPolicy';
import { createMapsRouter } from '../server/maps';
import { sendSms, toE164India, readSmsConfig, getFcmAccessToken, sendPush } from '../server/notifications';
import { haversineKm } from '../src/lib/geo';
import { parseAppointmentDateTime } from '../src/lib/appointments';

const USER = 'user-1';
const accountStore = { verifyAccessToken: async (t: string) => (t === 'good' ? { ok: true, userId: USER } : { ok: false, error: 'bad token' }) };
const AUTH = { Authorization: 'Bearer good', 'Content-Type': 'application/json' };

function listen(app: express.Express): Promise<{ server: Server; baseUrl: string }> {
  const server = app.listen(0, '127.0.0.1');
  return new Promise((resolve) => server.once('listening', () => resolve({ server, baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}` })));
}

function booking(overrides: Partial<RefundableBooking> = {}): RefundableBooking {
  const slot = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  return {
    id: 'bkg-1', user_id: USER, booking_ref: 'NX-2026-ABC123', salon_id: 'hair_salon',
    salon_snapshot: { name: 'Scissors & Shears', address: 'Mansarovar, Jaipur', gstin: '08AAAAA0000A1Z5' },
    customer: { name: 'Priya Sharma', phone: '9876543210' },
    slot_date: slot, slot_time: '5:30 PM', status: 'confirmed',
    subtotal: 1200, discount_amount: 200, total_amount: 1000, advance_amount: 250,
    payment_mode: 'advance_25', payment_status: 'paid',
    metadata: { services: [{ name: 'Haircut', price: 500, quantity: 1, category: 'hair' }, { name: 'Beard trim', price: 700, quantity: 1 }], payment: { paymentId: 'pay_123', orderId: 'order_123' } },
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('refund policy', () => {
  it('is tiered by notice period', () => {
    // Anchor "now" through the same parser the policy uses so the test is timezone-independent.
    const now = parseAppointmentDateTime('2026-09-18', '10:00 AM')!.getTime();
    assert.equal(refundPolicyFor('2026-09-20', '10:00 AM', 250, now).percent, 100);
    assert.equal(refundPolicyFor('2026-09-18', '4:00 PM', 250, now).percent, 50);
    assert.equal(refundPolicyFor('2026-09-18', '4:00 PM', 250, now).amountRupees, 125);
    assert.equal(refundPolicyFor('2026-09-18', '11:00 AM', 250, now).percent, 0);
    assert.equal(refundPolicyFor('2026-09-01', '11:00 AM', 250, now).percent, 0);
  });
});

describe('invoice', () => {
  it('backs out 18% GST from tax-inclusive totals and renders escaped HTML', () => {
    const inv = buildInvoice(booking({ salon_snapshot: { name: 'A <b>Salon</b>', address: 'x' } }), [{ id: 'rfnd_1', payment_id: 'pay_123', booking_id: 'bkg-1', user_id: USER, amount_paise: 12500, currency: 'INR', status: 'processed', reason: null, speed: 'optimum', created_at: 'now' }]);
    assert.equal(inv.total, 1000);
    assert.equal(inv.taxableValue, 847.46);
    assert.equal(inv.cgst + inv.sgst, 152.54);
    assert.equal(inv.advancePaid, 250);
    assert.equal(inv.refunded, 125);
    assert.equal(inv.balanceDue, 750);
    assert.equal(inv.lines.length, 2);
    assert.match(inv.invoiceNumber, /^NX-INV-\d{6}-ABC123$/);
    const html = renderInvoiceHtml(inv);
    assert.ok(html.includes('A &lt;b&gt;Salon&lt;/b&gt;'));
    assert.ok(!html.includes('<b>Salon</b>'));
    assert.ok(html.includes('pay_123'));
  });
});

describe('payments extra router', () => {
  it('quotes, refunds via the gateway, ledgers, cancels, and blocks a second refund', async () => {
    const store = createMemoryRefundStore([booking()]);
    const calls: unknown[] = [];
    const refund = async (input: { paymentId: string; amountPaise: number }) => { calls.push(input); return { ok: true as const, refund: { id: 'rfnd_1', status: 'pending', amount: input.amountPaise, created_at: 1_700_000_000 } }; };
    const app = express();
    app.use('/api/payments', createPaymentsExtraRouter({}, { store, accountStore, refund }));
    const { server, baseUrl } = await listen(app);
    try {
      assert.equal((await fetch(`${baseUrl}/api/payments/refunds`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"bookingId":"bkg-1"}' })).status, 401);

      const quote = await (await fetch(`${baseUrl}/api/payments/refunds`, { method: 'POST', headers: AUTH, body: JSON.stringify({ bookingId: 'bkg-1', dryRun: true }) })).json();
      assert.equal(quote.quote.percent, 100);
      assert.equal(quote.quote.amountRupees, 250);
      assert.equal(calls.length, 0, 'dry run never hits the gateway');

      const res = await fetch(`${baseUrl}/api/payments/refunds`, { method: 'POST', headers: AUTH, body: JSON.stringify({ bookingId: 'bkg-1' }) });
      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.refund.id, 'rfnd_1');
      assert.equal(body.refund.amount_paise, 25000);
      assert.deepEqual(calls[0], { paymentId: 'pay_123', amountPaise: 25000, speed: 'optimum', notes: { bookingRef: 'NX-2026-ABC123', bookingId: 'bkg-1', reason: 'customer_cancellation', policy: '100' } });
      assert.equal(store.bookings[0].status, 'cancelled');
      assert.equal(store.refunds.length, 1);

      const dup = await fetch(`${baseUrl}/api/payments/refunds`, { method: 'POST', headers: AUTH, body: JSON.stringify({ bookingId: 'bkg-1' }) });
      assert.equal(dup.status, 409);

      const hist = await (await fetch(`${baseUrl}/api/payments/history`, { headers: AUTH })).json();
      assert.equal(hist.rows.length, 1);
      assert.equal(hist.totals.paid, 250);
      assert.equal(hist.rows[0].refunds.length, 1);

      const inv = await fetch(`${baseUrl}/api/payments/invoice/bkg-1?format=html`, { headers: AUTH });
      assert.equal(inv.status, 200);
      assert.match(inv.headers.get('content-type') || '', /text\/html/);
      assert.ok((await inv.text()).includes('Nexora Tax Invoice'));

      const other = await fetch(`${baseUrl}/api/payments/invoice/bkg-404`, { headers: AUTH });
      assert.equal(other.status, 404);
    } finally { server.close(); }
  });

  it('does not touch the gateway for pay-at-salon or non-refundable windows, but still cancels', async () => {
    const soon = new Date(Date.now() + 30 * 60_000);
    const hh = soon.getHours() % 12 || 12; const ap = soon.getHours() >= 12 ? 'PM' : 'AM';
    const store = createMemoryRefundStore([
      booking({ id: 'bkg-cash', payment_status: 'pending', payment_mode: 'pay_at_salon', advance_amount: 0 }),
      booking({ id: 'bkg-late', slot_date: soon.toISOString().slice(0, 10), slot_time: `${hh}:${String(soon.getMinutes()).padStart(2, '0')} ${ap}` }),
    ]);
    let hits = 0;
    const refund = async () => { hits += 1; return { ok: false as const, error: 'should not be called' }; };
    const app = express();
    app.use('/api/payments', createPaymentsExtraRouter({}, { store, accountStore, refund }));
    const { server, baseUrl } = await listen(app);
    try {
      for (const id of ['bkg-cash', 'bkg-late']) {
        const out = await (await fetch(`${baseUrl}/api/payments/refunds`, { method: 'POST', headers: AUTH, body: JSON.stringify({ bookingId: id }) })).json();
        assert.equal(out.cancelled, true);
        assert.equal(out.refund, null);
      }
      assert.equal(hits, 0);
      assert.ok(store.bookings.every((b) => b.status === 'cancelled'));
    } finally { server.close(); }
  });

  it('keeps the booking active when the gateway refuses', async () => {
    const store = createMemoryRefundStore([booking()]);
    const app = express();
    app.use('/api/payments', createPaymentsExtraRouter({}, { store, accountStore, refund: async () => ({ ok: false as const, error: 'insufficient balance', status: 400 }) }));
    const { server, baseUrl } = await listen(app);
    try {
      const res = await fetch(`${baseUrl}/api/payments/refunds`, { method: 'POST', headers: AUTH, body: JSON.stringify({ bookingId: 'bkg-1' }) });
      assert.equal(res.status, 502);
      assert.equal(store.bookings[0].status, 'confirmed');
      assert.equal(store.refunds.length, 0);
    } finally { server.close(); }
  });

  it('webhook verifies the signature and updates the refund ledger', async () => {
    const store = createMemoryRefundStore([booking()]);
    await store.insertRefund({ id: 'rfnd_1', payment_id: 'pay_123', booking_id: 'bkg-1', user_id: USER, amount_paise: 25000, currency: 'INR', status: 'pending', reason: null, speed: 'optimum', created_at: 'now' });
    const secret = 'whsec';
    const app = express();
    app.use(express.json({ verify: (req, _res, buf) => { (req as { rawBody?: Buffer }).rawBody = buf; } }));
    app.use('/api/payments', createPaymentsExtraRouter({ RAZORPAY_WEBHOOK_SECRET: secret }, { store, accountStore, refund: async () => ({ ok: false as const, error: 'n/a' }) }));
    const { server, baseUrl } = await listen(app);
    try {
      const payload = JSON.stringify({ event: 'refund.processed', payload: { refund: { entity: { id: 'rfnd_1', status: 'processed', payment_id: 'pay_123' } } } });
      const bad = await fetch(`${baseUrl}/api/payments/webhooks/razorpay`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': 'nope' }, body: payload });
      assert.equal(bad.status, 401);
      const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      assert.equal(verifyRazorpayWebhook(payload, sig, secret), true);
      const ok = await fetch(`${baseUrl}/api/payments/webhooks/razorpay`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': sig }, body: payload });
      assert.equal(ok.status, 200);
      assert.equal(store.refunds[0].status, 'processed');
      assert.ok(store.refunds[0].processed_at);
    } finally { server.close(); }
  });
});

describe('maps proxy', () => {
  it('falls back to haversine estimates without a key and never invents Google data', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/maps', createMapsRouter({}));
    const { server, baseUrl } = await listen(app);
    try {
      const cfg = await (await fetch(`${baseUrl}/api/maps/config`)).json();
      assert.equal(cfg.configured, false);
      const origin = { lat: 26.85, lng: 75.76 };
      const dest = { id: 'a', lat: 26.91, lng: 75.79 };
      const out = await (await fetch(`${baseUrl}/api/maps/distance`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ origin, destinations: [dest] }) })).json();
      assert.equal(out.configured, false);
      assert.equal(out.results[0].source, 'estimate');
      assert.equal(out.results[0].distanceKm, haversineKm(origin, dest));
      assert.ok(out.results[0].durationMin > 0);
      assert.equal((await fetch(`${baseUrl}/api/maps/geocode?address=Mansarovar`)).status, 503);
      assert.equal((await fetch(`${baseUrl}/api/maps/distance`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 400);
    } finally { server.close(); }
  });

  it('uses Distance Matrix results when configured', async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ status: 'OK', rows: [{ elements: [{ status: 'OK', distance: { value: 8400 }, duration: { value: 900 }, duration_in_traffic: { value: 1260 } }] }] }))) as unknown as typeof fetch;
    const app = express();
    app.use(express.json());
    app.use('/api/maps', createMapsRouter({ GOOGLE_MAPS_SERVER_KEY: 'k' }, fetchImpl));
    const { server, baseUrl } = await listen(app);
    try {
      const out = await (await fetch(`${baseUrl}/api/maps/distance`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ origin: { lat: 26.85, lng: 75.76 }, destinations: [{ id: 'a', lat: 26.91, lng: 75.79 }] }) })).json();
      assert.deepEqual(out.results[0], { id: 'a', distanceKm: 8.4, durationMin: 21, source: 'google' });
    } finally { server.close(); }
  });
});

describe('SMS + FCM senders', () => {
  it('normalises Indian numbers', () => {
    assert.equal(toE164India('98765 43210'), '+919876543210');
    assert.equal(toE164India('+91 98765-43210'), '+919876543210');
    assert.equal(toE164India('09876543210'), '+919876543210');
    assert.equal(toE164India('12345'), null);
  });

  it('reports unconfigured honestly and posts to Twilio when configured', async () => {
    const input = { to: '9876543210', title: 'Nexora', body: 'Your slot is confirmed', notificationId: 'n1', type: 'booking', payload: {} };
    assert.equal(readSmsConfig({}).configured, false);
    assert.equal((await sendSms(input, {})).accepted, false);
    let posted: { url: string; body: string } | null = null;
    const fetchImpl = (async (url: string, init: RequestInit) => { posted = { url, body: String(init.body) }; return new Response(JSON.stringify({ sid: 'SM123', status: 'queued' }), { status: 201 }); }) as unknown as typeof fetch;
    const out = await sendSms(input, { TWILIO_ACCOUNT_SID: 'AC1', TWILIO_AUTH_TOKEN: 't', TWILIO_FROM_NUMBER: '+15005550006' }, fetchImpl);
    assert.equal(out.accepted, true);
    assert.equal(out.providerMessageId, 'SM123');
    assert.match(posted!.url, /Accounts\/AC1\/Messages\.json$/);
    assert.match(posted!.body, /To=%2B919876543210/);
  });

  it('FCM: rejects bad service accounts, mints a JWT-bearer token, posts a v1 message', async () => {
    const bad = await getFcmAccessToken({ FCM_SERVICE_ACCOUNT_JSON: '{}' });
    assert.equal(bad.ok, false);
    const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const sa = JSON.stringify({ client_email: 'svc@proj.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), project_id: 'proj' });
    const seen: string[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen.push(url);
      if (url.includes('oauth2')) {
        const assertion = new URLSearchParams(String(init.body)).get('assertion')!;
        const [h, c] = assertion.split('.');
        assert.equal(JSON.parse(Buffer.from(h, 'base64url').toString()).alg, 'RS256');
        assert.equal(JSON.parse(Buffer.from(c, 'base64url').toString()).scope, 'https://www.googleapis.com/auth/firebase.messaging');
        return new Response(JSON.stringify({ access_token: 'ya29.x', expires_in: 3600 }));
      }
      const body = JSON.parse(String(init.body));
      assert.equal(body.message.token, 'device-1');
      assert.equal((init.headers as Record<string, string>).Authorization, 'Bearer ya29.x');
      return new Response(JSON.stringify({ name: 'projects/proj/messages/1' }));
    }) as unknown as typeof fetch;
    const out = await sendPush({ to: 'device-1', title: 'Hi', body: 'There', notificationId: 'n1', type: 'smart_reminder', payload: {} }, { FCM_SERVICE_ACCOUNT_JSON: sa }, fetchImpl);
    assert.equal(out.accepted, true);
    assert.equal(out.providerMessageId, 'projects/proj/messages/1');
    assert.ok(seen[0].includes('oauth2.googleapis.com'));
    assert.ok(seen[1].includes('/v1/projects/proj/messages:send'));
  });
});
