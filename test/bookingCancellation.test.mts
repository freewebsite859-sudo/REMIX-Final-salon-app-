/**
 * Booking cancellation: server route (POST /api/bookings/:id/cancel) + browser
 * client + the memory store's owner scoping.
 *
 * Cancellation used to be client-only — App.tsx flipped the row's status in
 * React state and never called any API, so the salon still saw an active
 * booking, the slot stayed occupied, and a reload restored the appointment.
 * The contract that matters now is honesty and ownership: the server confirms
 * before the UI changes, and only the token's owner can cancel a booking.
 */
import assert from 'node:assert/strict';
import express from 'express';
import {
  createBookingsRouter,
  createCancelBookingHandler,
  createMemoryBookingStore,
} from '../server/bookings.ts';
import type { AccountStore } from '../server/userAccount.ts';
import { requestBookingCancellation } from '../src/lib/bookingCancellation.ts';
import type { BookingStore, BookingDbRow } from '../src/lib/bookingCore.ts';

const results: { name: string; pass: boolean; detail?: string }[] = [];
function check(name: string, pass: boolean, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------
function fakeAccountStore(options: { ok?: boolean; userId?: string; error?: string }): AccountStore {
  return {
    async verifyAccessToken() {
      return options.ok === false
        ? { ok: false, error: options.error || 'Token expired' }
        : { ok: true, userId: options.userId ?? 'owner-1' };
    },
    async deleteUser() {
      return { ok: true };
    },
  };
}

function recordingStore(
  result: { ok: boolean; found?: boolean; error?: string }
): { store: BookingStore; calls: { id: string; owner: string }[] } {
  const calls: { id: string; owner: string }[] = [];
  const store: BookingStore = {
    async insertBooking() {
      return { ok: true };
    },
    async insertBookingServices() {
      return { ok: true };
    },
    async deleteBooking() {
      return { ok: true };
    },
    async cancelBooking(bookingId, ownerUserId) {
      calls.push({ id: bookingId, owner: ownerUserId });
      return result;
    },
  };
  return { store, calls };
}

/** Minimal in-process request — no socket, no port. */
async function call(
  app: express.Express,
  path: string,
  token?: string | null
): Promise<{ status: number; body: any }> {
  return new Promise((resolve) => {
    const req: any = {
      method: 'POST',
      url: path,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    };
    const res: any = {
      statusCode: 200,
      headers: {},
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      setHeader() {},
      end(payload?: string) {
        let parsed: any = null;
        try {
          parsed = payload ? JSON.parse(payload) : null;
        } catch {
          parsed = payload;
        }
        resolve({ status: this.statusCode, body: parsed });
      },
      json(payload: unknown) {
        return this.end(JSON.stringify(payload));
      },
    };
    app(req, res, () => res.end());
  });
}

function mount(
  store: BookingStore | null,
  accountStore: AccountStore | null
): express.Express {
  const app = express();
  app.use(express.json());
  app.post(
    '/api/bookings/:id/cancel',
    createCancelBookingHandler(store, accountStore, 'test reason')
  );
  return app;
}

// ---------------------------------------------------------------------------
// 1. Router: unconfigured deployment must be an honest 503
// ---------------------------------------------------------------------------
{
  // No SUPABASE_URL / SERVICE_ROLE_KEY in this environment, so the real router
  // has no service client and must refuse rather than pretend.
  const app = express();
  app.use(express.json());
  app.use(
    '/api/bookings',
    createBookingsRouter({ NODE_ENV: 'test' }, null, null)
  );

  const noToken = await call(app, '/api/bookings/bk-1/cancel');
  check(
    'unconfigured deployment returns 503, not a fake success',
    noToken.status === 503,
    `status=${noToken.status}`
  );
  check(
    'the 503 body says configured:false',
    noToken.body?.configured === false,
    JSON.stringify(noToken.body)
  );

  const withToken = await call(app, '/api/bookings/bk-1/cancel', 'some-token');
  check(
    'a valid-looking token still gets 503 when unconfigured',
    withToken.status === 503,
    `status=${withToken.status}`
  );
}

// ---------------------------------------------------------------------------
// 2. Authentication
// ---------------------------------------------------------------------------
{
  const { store } = recordingStore({ ok: true, found: true });
  const app = mount(store, fakeAccountStore({ userId: 'owner-1' }));

  const missing = await call(app, '/api/bookings/bk-1/cancel');
  check('no token is rejected 401', missing.status === 401, `status=${missing.status}`);

  const badStore = mount(store, fakeAccountStore({ ok: false, error: 'Token expired' }));
  const bad = await call(badStore, '/api/bookings/bk-1/cancel', 'expired-token');
  check(
    'an unverifiable token is rejected 401',
    bad.status === 401 && /expired/i.test(String(bad.body?.error || '')),
    JSON.stringify(bad.body)
  );
}

// ---------------------------------------------------------------------------
// 3. Ownership — the store receives the TOKEN's id, never a client-supplied one
// ---------------------------------------------------------------------------
{
  const { store, calls } = recordingStore({ ok: true, found: true });
  const app = mount(store, fakeAccountStore({ userId: 'token-owner-42' }));

  // A client trying to name someone else's booking in the URL.
  const res = await call(app, '/api/bookings/someone-elses-booking/cancel', 'good-token');
  check(
    'a confirmed cancellation returns 200 success:true',
    res.status === 200 && res.body?.success === true,
    JSON.stringify(res.body)
  );
  check(
    'the store is scoped by the TOKEN owner, not a body/URL-supplied identity',
    calls.length === 1 && calls[0].owner === 'token-owner-42',
    JSON.stringify(calls)
  );
  check(
    'the booking id from the URL is passed through',
    calls[0]?.id === 'someone-elses-booking',
    JSON.stringify(calls)
  );
}

// ---------------------------------------------------------------------------
// 4. Failure modes must never read as success
// ---------------------------------------------------------------------------
{
  const notFound = mount(
    recordingStore({ ok: true, found: false }).store,
    fakeAccountStore({ userId: 'owner-1' })
  );
  const nf = await call(notFound, '/api/bookings/bk-1/cancel', 'good-token');
  check(
    'a booking that is not the caller\'s is 404',
    nf.status === 404,
    `status=${nf.status}`
  );
  check(
    '404 does not distinguish "not yours" from "does not exist"',
    /no active booking/i.test(String(nf.body?.error || '')),
    JSON.stringify(nf.body)
  );

  const failed = mount(
    recordingStore({ ok: false, error: 'db down' }).store,
    fakeAccountStore({ userId: 'owner-1' })
  );
  const f = await call(failed, '/api/bookings/bk-1/cancel', 'good-token');
  check('a store failure is 500', f.status === 500, `status=${f.status}`);
  check(
    'the 500 message says the booking is still active',
    /still active/i.test(String(f.body?.error || '')),
    JSON.stringify(f.body)
  );

  const noCancel = mount(
    {
      async insertBooking() {
        return { ok: true };
      },
      async insertBookingServices() {
        return { ok: true };
      },
      async deleteBooking() {
        return { ok: true };
      },
    },
    fakeAccountStore({ userId: 'owner-1' })
  );
  const nc = await call(noCancel, '/api/bookings/bk-1/cancel', 'good-token');
  check(
    'a store without cancelBooking is 501, not a silent success',
    nc.status === 501,
    `status=${nc.status}`
  );
}

// ---------------------------------------------------------------------------
// 5. Memory store: real ownership semantics + slot release
// ---------------------------------------------------------------------------
{
  const store = createMemoryBookingStore();
  const row = {
    id: 'bk-owned',
    booking_ref: 'NX-1',
    user_id: 'owner-1',
    customer: { id: 'owner-1', name: 'Owner' },
    salon_id: 'salon-1',
    salon_snapshot: { id: 'salon-1', name: 'S', address: 'a', image: '' },
    stylist_snapshot: null,
    slot_date: '2026-10-01',
    slot_time: '5:30 PM',
    status: 'pending',
    subtotal: 1000,
    discount_amount: 0,
    total_amount: 1000,
    advance_amount: 250,
    currency: 'INR',
    payment_mode: 'advance_25',
    payment_status: 'pending',
    coupon_code: null,
    notes: null,
    metadata: { services: [] },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as unknown as BookingDbRow;

  await store.insertBooking(row);

  check(
    'the slot is occupied before cancellation',
    (await store.findActiveSlot!('salon-1', '2026-10-01', '5:30 PM')) === true
  );

  const stranger = await store.cancelBooking!('bk-owned', 'someone-else');
  check(
    'a different user cannot cancel the booking',
    stranger.ok === false && stranger.found === false,
    JSON.stringify(stranger)
  );
  check(
    'the rejected attempt left the slot occupied',
    (await store.findActiveSlot!('salon-1', '2026-10-01', '5:30 PM')) === true
  );

  const owner = await store.cancelBooking!('bk-owned', 'owner-1');
  check(
    'the owner can cancel the booking',
    owner.ok === true && owner.found === true,
    JSON.stringify(owner)
  );
  check(
    'cancelling RELEASES the slot for other customers',
    (await store.findActiveSlot!('salon-1', '2026-10-01', '5:30 PM')) === false,
    'this is the bug client-only cancellation caused'
  );

  const missing = await store.cancelBooking!('does-not-exist', 'owner-1');
  check(
    'an unknown booking id reports found:false',
    missing.ok === false && missing.found === false,
    JSON.stringify(missing)
  );
}

// ---------------------------------------------------------------------------
// 6. Browser client — every failure resolves to success:false
// ---------------------------------------------------------------------------
const realFetch = globalThis.fetch;
function stubFetch(handler: (url: string, init?: any) => Promise<Response> | Response) {
  globalThis.fetch = handler as any;
}

try {
  const noToken = await requestBookingCancellation('bk-1', null);
  check(
    'client refuses the network with no token',
    noToken.success === false && noToken.reason === 'unauthenticated',
    noToken.reason
  );

  const blankId = await requestBookingCancellation('   ', 'tok');
  check(
    'client refuses a blank booking id',
    blankId.success === false && blankId.reason === 'not_found',
    blankId.reason
  );

  stubFetch(() => new Response(JSON.stringify({ success: true, status: 'cancelled' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  }));
  const ok = await requestBookingCancellation('bk-1', 'tok');
  check('client reports success on 200 success:true', ok.success === true, ok.reason);

  stubFetch(() => new Response(JSON.stringify({ error: 'x' }), { status: 401 }));
  const unauth = await requestBookingCancellation('bk-1', 'tok');
  check(
    'client maps 401 to unauthenticated',
    unauth.success === false && unauth.reason === 'unauthenticated',
    unauth.reason
  );

  stubFetch(() =>
    new Response(JSON.stringify({ error: 'No active booking found for your account.' }), {
      status: 404,
    })
  );
  const nf = await requestBookingCancellation('bk-1', 'tok');
  check(
    'client maps 404 to not_found',
    nf.success === false && nf.reason === 'not_found',
    nf.reason
  );

  stubFetch(() =>
    new Response(
      JSON.stringify({ error: 'Cancellation is not available', configured: false }),
      { status: 503 }
    )
  );
  const nc = await requestBookingCancellation('bk-1', 'tok');
  check(
    'client maps 503 to not_configured',
    nc.success === false && nc.reason === 'not_configured',
    nc.reason
  );

  // An HTML error page from a proxy must not parse as success.
  stubFetch(() => new Response('<html>502 Bad Gateway</html>', { status: 502 }));
  const html = await requestBookingCancellation('bk-1', 'tok');
  check(
    'a non-JSON 502 body is server_error, never success',
    html.success === false && html.reason === 'server_error',
    html.reason
  );

  stubFetch(() => {
    throw new Error('offline');
  });
  const net = await requestBookingCancellation('bk-1', 'tok');
  check(
    'a thrown fetch is network_error',
    net.success === false && net.reason === 'network_error',
    net.reason
  );

  // 200 without success:true is a server_error, not a cancellation.
  stubFetch(() => new Response(JSON.stringify({ ok: true }), { status: 200 }));
  const lying = await requestBookingCancellation('bk-1', 'tok');
  check(
    '200 without success:true is server_error',
    lying.success === false && lying.reason === 'server_error',
    lying.reason
  );
} finally {
  globalThis.fetch = realFetch;
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
console.log(failed.length === 0 ? 'PASS  booking cancellation' : 'FAIL  some checks failed');
process.exit(failed.length === 0 ? 0 : 1);
