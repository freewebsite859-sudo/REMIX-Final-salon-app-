/**
 * Server-side deposit checkout: order → HMAC verify → booking.
 *
 * The booking summary promises:
 *   "No merchant QR code or client-side payment shortcut is used.
 *    The booking is created only after a server-side gateway order
 *    and signature verification succeed."
 *
 * These checks drive the real Express routers (payments + bookings) with an
 * in-memory store. Run: npm run test:payment
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

import { createPaymentsRouter, createMemoryPaymentOrderStore } from '../server/payments';
import { createBookingsRouter } from '../server/bookings';
import { attachNexoraApi } from '../server/attachApi';
import {
  createBooking,
  validateBookingRequest,
  type BookingStore,
  type BookingDbRow,
  type BookingServiceDbRow,
} from '../src/lib/bookingCore';
import { razorpaySignature, rupeesToPaise, slotHoldConflicts, makeSlotKey } from '../src/lib/paymentCore';

const FUTURE_DATE = '2030-01-15';
const SECRET = 'test_razorpay_secret_value';
const KEY_ID = 'rzp_test_nexora';

function validRequest(overrides: Record<string, unknown> = {}) {
  return {
    salon: { id: 'salon-1', name: 'Scissors & Shears Salon', address: 'Mansarovar, Jaipur' },
    services: [
      {
        id: 'svc-cut',
        name: 'Precision Cut & Blowdry',
        durationMinutes: 45,
        price: 1200,
        discountPrice: 1000,
        unitPrice: 1000,
        category: 'hair',
      },
      { id: 'svc-nails', name: 'Gel-X Nails', durationMinutes: 60, price: 999, unitPrice: 999, category: 'nails' },
    ],
    stylist: { id: 'st-1', name: 'Aarav Sharma', role: 'Senior Stylist' },
    date: FUTURE_DATE,
    time: '5:30 PM',
    amount: 500,
    ...overrides,
  };
}

function memoryBookingStore(): BookingStore & { bookings: BookingDbRow[] } {
  const bookings: BookingDbRow[] = [];
  const services: BookingServiceDbRow[] = [];
  const store: BookingStore & { bookings: BookingDbRow[] } = {
    bookings,
    async insertBooking(row) {
      bookings.push(row);
      return { ok: true };
    },
    async insertBookingServices(rows) {
      services.push(...rows);
      return { ok: true };
    },
    async deleteBooking(id) {
      const idx = bookings.findIndex((b) => b.id === id);
      if (idx >= 0) bookings.splice(idx, 1);
      return { ok: true };
    },
    async findActiveSlot(salonId, slotDate, slotTime, stylistId) {
      const want = stylistId && stylistId.trim() ? stylistId.trim() : null;
      return bookings.some((row) => {
        if (row.salon_id !== salonId || row.slot_date !== slotDate || row.slot_time !== slotTime) return false;
        if ((row.status as string) === 'cancelled' || (row.status as string) === 'no_show') return false;
        const held = row.stylist_snapshot?.id ?? null;
        if (!want) return true;
        return !held || held === want;
      });
    },
  };
  return store;
}

function listen(app: express.Express): Promise<{ server: Server; baseUrl: string }> {
  const server = app.listen(0, '127.0.0.1');
  return new Promise((resolve) => {
    server.once('listening', () => {
      const addr = server.address() as AddressInfo;
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

async function startPayments(opts: {
  bookingStore?: BookingStore | null;
  env?: NodeJS.ProcessEnv;
  gatewayIds?: string[];
}) {
  const env: NodeJS.ProcessEnv = {
    RAZORPAY_KEY_ID: KEY_ID,
    RAZORPAY_KEY_SECRET: SECRET,
    ...(opts.env || {}),
  };
  const bookingStore = opts.bookingStore === undefined ? memoryBookingStore() : opts.bookingStore;
  const ids = opts.gatewayIds ?? [];
  let n = 0;
  const app = express();
  app.use(express.json());
  app.use(
    '/api/payments',
    createPaymentsRouter(env, {
      bookingStore,
      orderStore: createMemoryPaymentOrderStore(),
      createGatewayOrder: async ({ amountPaise, receipt }) => {
        const id = ids[n] || `order_test_${n + 1}`;
        n += 1;
        return { ok: true, order: { id, amount: amountPaise, currency: 'INR', receipt } };
      },
    })
  );
  app.use('/api/bookings', createBookingsRouter(env, bookingStore));
  const { server, baseUrl } = await listen(app);
  return { server, baseUrl, bookingStore, env };
}

async function stop(server: Server) {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

describe('API is mounted for health + payment config', () => {
  it('exposes GET /api/health and GET /api/payments/config', async () => {
    const app = express();
    app.use(express.json());
    attachNexoraApi(app, { RAZORPAY_KEY_ID: '', RAZORPAY_KEY_SECRET: '' });
    const { server, baseUrl } = await listen(app);
    try {
      const health = await fetch(`${baseUrl}/api/health`);
      assert.equal(health.status, 200);
      const healthBody = (await health.json()) as { status: string };
      assert.equal(healthBody.status, 'ok');

      const config = await fetch(`${baseUrl}/api/payments/config`);
      assert.equal(config.status, 200);
      const configBody = (await config.json()) as { configured: boolean; provider: string };
      assert.equal(configBody.configured, false);
      assert.equal(configBody.provider, 'razorpay');
    } finally {
      await stop(server);
    }
  });
});

describe('paymentCore HMAC + slot keys', () => {
  it('signs and verifies order_id|payment_id', () => {
    const sig = razorpaySignature('order_1', 'pay_1', SECRET);
    assert.equal(typeof sig, 'string');
    assert.equal(sig.length, 64);
    const other = razorpaySignature('order_1', 'pay_2', SECRET);
    assert.notEqual(sig, other);
  });

  it('converts rupees to integer paise', () => {
    assert.equal(rupeesToPaise(500), 50000);
    assert.equal(rupeesToPaise(0), 0);
  });

  it('same-stylist holds conflict; different stylists do not', () => {
    const holds = [{ slotKey: makeSlotKey('s1', FUTURE_DATE, '5:30 PM', 'st-1'), expiresAt: Date.now() + 60_000 }];
    assert.equal(slotHoldConflicts(holds, 's1', FUTURE_DATE, '5:30 PM', 'st-1'), true);
    assert.equal(slotHoldConflicts(holds, 's1', FUTURE_DATE, '5:30 PM', 'st-2'), false);
    assert.equal(slotHoldConflicts(holds, 's1', FUTURE_DATE, '5:30 PM', null), true);
  });
});

describe('POST /api/bookings is not a payment shortcut', () => {
  it('answers 402 even when a booking store is configured', async () => {
    const { server, baseUrl } = await startPayments({});
    try {
      const res = await fetch(`${baseUrl}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequest()),
      });
      assert.equal(res.status, 402);
      const body = (await res.json()) as { error: string };
      assert.match(body.error, /Secure deposit required/i);
    } finally {
      await stop(server);
    }
  });
});

describe('POST /api/payments/orders', () => {
  it('answers 503 when Razorpay is not configured', async () => {
    const { server, baseUrl } = await startPayments({
      env: { RAZORPAY_KEY_ID: '', RAZORPAY_KEY_SECRET: '' },
    });
    try {
      const res = await fetch(`${baseUrl}/api/payments/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequest()),
      });
      assert.equal(res.status, 503);
      const body = (await res.json()) as { error: string };
      assert.match(body.error, /not configured/i);
    } finally {
      await stop(server);
    }
  });

  it('creates a gateway order for the recomputed 25% advance and holds the slot', async () => {
    const { server, baseUrl } = await startPayments({ gatewayIds: ['order_abc'] });
    try {
      const res = await fetch(`${baseUrl}/api/payments/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequest()),
      });
      assert.equal(res.status, 201);
      const body = (await res.json()) as { orderId: string; amount: number; amountPaise: number; keyId: string };
      assert.equal(body.orderId, 'order_abc');
      assert.equal(body.amount, 500);
      assert.equal(body.amountPaise, 50000);
      assert.equal(body.keyId, KEY_ID);
    } finally {
      await stop(server);
    }
  });

  it('rejects a second concurrent hold on the same stylist slot', async () => {
    const { server, baseUrl } = await startPayments({ gatewayIds: ['order_a', 'order_b'] });
    try {
      const first = await fetch(`${baseUrl}/api/payments/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequest()),
      });
      assert.equal(first.status, 201);
      const second = await fetch(`${baseUrl}/api/payments/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequest()),
      });
      assert.equal(second.status, 409);
      const body = (await second.json()) as { error: string };
      assert.match(body.error, /already held/i);
    } finally {
      await stop(server);
    }
  });
});

describe('POST /api/payments/verify', () => {
  it('refuses a missing/forged signature and does not create a booking', async () => {
    const store = memoryBookingStore();
    const { server, baseUrl } = await startPayments({ bookingStore: store, gatewayIds: ['order_sig'] });
    try {
      const orderRes = await fetch(`${baseUrl}/api/payments/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequest()),
      });
      assert.equal(orderRes.status, 201);

      const missing = await fetch(`${baseUrl}/api/payments/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment: { razorpay_order_id: 'order_sig', razorpay_payment_id: 'pay_1' },
        }),
      });
      assert.equal(missing.status, 402);

      const forged = await fetch(`${baseUrl}/api/payments/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment: {
            razorpay_order_id: 'order_sig',
            razorpay_payment_id: 'pay_1',
            razorpay_signature: 'deadbeef',
          },
        }),
      });
      assert.equal(forged.status, 402);
      assert.equal(store.bookings.length, 0);
    } finally {
      await stop(server);
    }
  });

  it('creates the booking only after a valid HMAC and marks the deposit paid', async () => {
    const store = memoryBookingStore();
    const { server, baseUrl } = await startPayments({ bookingStore: store, gatewayIds: ['order_ok'] });
    try {
      const orderRes = await fetch(`${baseUrl}/api/payments/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequest()),
      });
      assert.equal(orderRes.status, 201);

      const paymentId = 'pay_verified_1';
      const signature = razorpaySignature('order_ok', paymentId, SECRET);
      const verifyRes = await fetch(`${baseUrl}/api/payments/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment: {
            razorpay_order_id: 'order_ok',
            razorpay_payment_id: paymentId,
            razorpay_signature: signature,
          },
        }),
      });
      assert.equal(verifyRes.status, 201);
      const payload = (await verifyRes.json()) as {
        appointment: { id: string; paymentStatus: string; razorpayPaymentId: string; services: unknown[] };
      };
      assert.ok(payload.appointment.id);
      assert.equal(payload.appointment.paymentStatus, 'paid');
      assert.equal(payload.appointment.razorpayPaymentId, paymentId);
      assert.equal(payload.appointment.services.length, 2);
      assert.equal(store.bookings.length, 1);
      assert.equal(store.bookings[0].payment_status, 'paid');
      assert.equal(store.bookings[0].metadata.payment?.paymentId, paymentId);
    } finally {
      await stop(server);
    }
  });

  it('rejects a client-invented order id that was never created server-side', async () => {
    const { server, baseUrl } = await startPayments({});
    try {
      const signature = razorpaySignature('order_invented', 'pay_x', SECRET);
      const res = await fetch(`${baseUrl}/api/payments/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment: {
            razorpay_order_id: 'order_invented',
            razorpay_payment_id: 'pay_x',
            razorpay_signature: signature,
          },
        }),
      });
      assert.equal(res.status, 404);
    } finally {
      await stop(server);
    }
  });
});

describe('createBooking attaches a verified receipt', () => {
  it('unverified inserts stay pending; receipts mark paid', async () => {
    const parsed = validateBookingRequest(validRequest());
    assert.equal(parsed.ok, true);
    const unpaidStore = memoryBookingStore();
    const unpaid = await createBooking(unpaidStore, parsed.value!);
    assert.equal(unpaid.appointment?.paymentStatus, 'pending');

    const paidStore = memoryBookingStore();
    const paid = await createBooking(paidStore, parsed.value!, {
      orderId: 'order_x',
      paymentId: 'pay_x',
      signature: 'sig',
      verifiedAt: new Date().toISOString(),
    });
    assert.equal(paid.appointment?.paymentStatus, 'paid');
    assert.equal(paid.appointment?.razorpayPaymentId, 'pay_x');
  });
});
