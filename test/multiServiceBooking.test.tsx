/**
 * Multi-service booking + checkout regression suite.
 *
 * Three bugs are covered end-to-end:
 *
 *  1. BULK SELECTION — the salon page only offered a per-service "Book"
 *     button, so a customer could never take two treatments in one visit.
 *     The catalog is now a checkbox list with a live cart; booking carries the
 *     whole selection into the booking flow.
 *
 *  2. CART CALCULATIONS — the cart, the summary modal and the server each did
 *     their own arithmetic. They now all call `computeBookingTotals` on the
 *     canonical line items.
 *
 *  3. "PAYMENT FAILURE / ADVANCE PAYMENT INCOMPLETE" — checkout failed because
 *     (a) the recomputed 25% advance did not match the amount sent, and
 *     (b) demo builds POSTed to a booking endpoint that answers 503 without a
 *     service-role key. Both paths are asserted here.
 *
 * Run: npm run test:multi-service
 */

import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';

import { SalonDetailModal } from '../src/components/SalonDetailModal.tsx';
import { BookingSummaryModal } from '../src/components/BookingSummaryModal.tsx';
import type { Appointment, Salon, SalonService, Stylist } from '../src/types.ts';
import {
  buildBookingMetadataServices,
  toBookingSalonSnapshot,
  toBookingStylistSnapshot,
} from '../src/lib/bookingContract.ts';
import {
  computeBookingTotals,
  validateBookingRequest,
  createBooking as persistBooking,
  type BookingStore,
} from '../src/lib/bookingCore.ts';
import { createDemoBooking, createDemoBookingStore } from '../src/lib/demoBookingStore.ts';

let passed = 0;
let failed = 0;
function check(label: string, cond: boolean, detail = '') {
  if (cond) {
    console.log(`PASS  ${label}${detail ? ` — ${detail}` : ''}`);
    passed++;
  } else {
    console.log(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const srvCut: SalonService = {
  id: 'svc-cut',
  name: 'Precision Cut & Blowdry',
  category: 'hair',
  duration: 45,
  price: 1200,
  discountPrice: 1000,
  description: 'Scissor precision cut.',
  popular: true,
};
const srvBalayage: SalonService = {
  id: 'svc-balayage',
  name: 'Balayage Highlights',
  category: 'hair',
  duration: 90,
  price: 2600,
  discountPrice: 2100,
  description: 'Hand-painted highlights.',
};
const srvNails: SalonService = {
  id: 'svc-nails',
  name: 'Gel-X Nails',
  category: 'nails',
  duration: 60,
  price: 999,
  description: 'Gel extension manicure.',
};

const stylist: Stylist = {
  id: 'sty-1',
  name: 'Meera Kapoor',
  role: 'Senior Stylist',
  avatar: 'https://example.com/a.jpg',
  rating: 4.9,
  experience: '8 yrs',
  specialty: ['Balayage'],
};

const salon: Salon = {
  id: 'salon-1',
  name: 'Nexora Luxe Studio',
  image: 'https://example.com/salon.jpg',
  gallery: [],
  rating: 4.8,
  reviewCount: 214,
  distance: '1.2 km',
  location: {
    address: 'C-Scheme, Jaipur',
    area: 'C-Scheme',
    city: 'Jaipur',
    latitude: 26.9,
    longitude: 75.8,
  },
  services: [srvCut, srvBalayage, srvNails],
  stylists: [stylist],
  amenities: ['AC', 'Parking'],
  openTime: '10:00 AM',
  closeTime: '9:00 PM',
  isOpen: true,
  priceRange: '₹₹',
  categories: ['hair', 'nails'],
  reviews: [],
} as unknown as Salon;

const host = document.createElement('div');
document.body.appendChild(host);
let root: Root = createRoot(host);

async function render(ui: React.ReactElement) {
  await act(async () => {
    root.render(ui);
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
}

function click(el: Element | null | undefined) {
  if (!el) throw new Error('click target missing');
  const Ev = typeof window.MouseEvent !== 'undefined' ? window.MouseEvent : window.Event;
  (el as HTMLElement).dispatchEvent(new Ev('click', { bubbles: true, cancelable: true }));
}

async function clickAct(el: Element | null | undefined) {
  await act(async () => {
    click(el);
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
}

function byId(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function serviceCard(serviceId: string): HTMLElement | null {
  return host.querySelector(`[data-service-id="${serviceId}"]`);
}

// ---------------------------------------------------------------------------
// 1. Pure money math
// ---------------------------------------------------------------------------
function testTotals() {
  const lines = buildBookingMetadataServices([srvCut, srvBalayage, srvNails]);
  const totals = computeBookingTotals(lines, 0);
  // 1000 + 2100 + 999
  check('subtotal sums discounted unit prices', totals.subtotal === 4099, `₹${totals.subtotal}`);
  check('duration sums every line item', totals.durationMinutes === 195, `${totals.durationMinutes} mins`);
  check('advance is 25% of the total', totals.advanceAmount === Math.round(4099 * 0.25), `₹${totals.advanceAmount}`);
  check(
    'balance is total minus advance',
    totals.remainingAmount === 4099 - Math.round(4099 * 0.25),
    `₹${totals.remainingAmount}`
  );

  const discounted = computeBookingTotals(lines, 820);
  check('coupon discount lowers the total', discounted.total === 4099 - 820, `₹${discounted.total}`);
  check(
    'advance follows the discounted total',
    discounted.advanceAmount === Math.round((4099 - 820) * 0.25),
    `₹${discounted.advanceAmount}`
  );
  check(
    'discount can never exceed the subtotal',
    computeBookingTotals(lines, 99999).discountAmount === 4099
  );
  check('empty cart is priced at zero', computeBookingTotals([], 0).advanceAmount === 0);

  // Duplicates must not double-count (a classic multi-select regression).
  const deduped = buildBookingMetadataServices([srvCut, srvCut, srvBalayage]);
  check(
    'duplicate service ids are de-duplicated before pricing',
    computeBookingTotals(deduped, 0).subtotal === 3100,
    `₹${computeBookingTotals(deduped, 0).subtotal}`
  );
}

// ---------------------------------------------------------------------------
// 2. Server contract accepts the UI's amount / rejects a stale one
// ---------------------------------------------------------------------------
function buildRequest(services: SalonService[], amountOverride?: number, discount = 0) {
  const lines = buildBookingMetadataServices(services);
  const totals = computeBookingTotals(lines, discount);
  return {
    salon: toBookingSalonSnapshot(salon),
    services: lines,
    stylist: toBookingStylistSnapshot(stylist),
    date: new Date().toISOString().split('T')[0],
    time: '5:30 PM',
    amount: amountOverride ?? totals.advanceAmount,
    ...(totals.discountAmount > 0 ? { discountAmount: totals.discountAmount } : {}),
  };
}

function testContract() {
  const ok = validateBookingRequest(buildRequest([srvCut, srvBalayage]));
  check('server accepts the advance computed by the shared core', ok.ok, ok.fields?.join('; '));

  const stale = validateBookingRequest(buildRequest([srvCut, srvBalayage], 500));
  check(
    'server still rejects a tampered/stale advance',
    !stale.ok && Boolean(stale.fields?.some((f) => f.includes('25% verified advance'))),
    stale.fields?.[0]
  );

  const withCoupon = validateBookingRequest(buildRequest([srvCut, srvBalayage, srvNails], undefined, 820));
  check('server accepts a coupon-discounted advance', withCoupon.ok, withCoupon.fields?.join('; '));
}

// ---------------------------------------------------------------------------
// 3. Demo booking store completes checkout without a server
// ---------------------------------------------------------------------------
async function testDemoStore() {
  localStorage.removeItem('nexora.demo.table.bookings');
  localStorage.removeItem('nexora.demo.table.booking_services');

  const request = buildRequest([srvCut, srvNails]);
  const result = await createDemoBooking(request as never, createDemoBookingStore());

  check('demo checkout returns a booking instead of 503', result.ok, result.error);
  check('demo booking has an id + reference', Boolean(result.appointment?.id && result.appointment?.bookingRef));
  check('demo booking keeps both services', result.appointment?.services.length === 2);
  check(
    'demo booking advance matches the cart',
    result.appointment?.advancePaid === computeBookingTotals(buildBookingMetadataServices([srvCut, srvNails]), 0).advanceAmount,
    `₹${result.appointment?.advancePaid}`
  );
  check('demo booking is pending, never "paid"', result.appointment?.paymentStatus === 'pending');
  check('demo booking is flagged as a demo record', result.appointment?.isDemoBooking === true);

  const storedBookings = JSON.parse(localStorage.getItem('nexora.demo.table.bookings') || '[]');
  const storedLines = JSON.parse(localStorage.getItem('nexora.demo.table.booking_services') || '[]');
  check('demo booking row persisted locally', storedBookings.length === 1);
  check('demo line items persisted locally (one row per service)', storedLines.length === 2);

  const invalid = await createDemoBooking({ ...request, services: [] } as never);
  check('demo store still refuses an empty service list', !invalid.ok, invalid.error);
}

// ---------------------------------------------------------------------------
// 4. Salon page: bulk selection + live cart
// ---------------------------------------------------------------------------
async function testSalonDetailCart() {
  const bookCalls: { service?: SalonService; services?: SalonService[] }[] = [];

  await render(
    <SalonDetailModal
      isOpen
      salon={salon}
      onClose={() => {}}
      onBookService={(_s, service, _st, services) => {
        bookCalls.push({ service, services });
      }}
    />
  );

  check('service cards expose checkbox semantics', serviceCard('svc-cut')?.getAttribute('role') === 'checkbox');
  check('nothing is pre-selected on the salon page', serviceCard('svc-cut')?.getAttribute('aria-checked') === 'false');
  check(
    'book CTA starts in single-appointment mode',
    (byId('salon-detail-book-now-btn')?.textContent || '').includes('Book Appointment')
  );

  await clickAct(serviceCard('svc-cut'));
  await clickAct(serviceCard('svc-nails'));

  check(
    'two services can be selected at once',
    serviceCard('svc-cut')?.getAttribute('aria-checked') === 'true' &&
      serviceCard('svc-nails')?.getAttribute('aria-checked') === 'true'
  );

  const cart = byId('salon-detail-cart-summary')?.textContent || '';
  check('cart shows the selected count', cart.includes('2 services selected'), cart);
  check('cart total sums both services (₹1,999)', cart.includes('1,999'), cart);
  check('cart shows combined duration (105 mins)', cart.includes('105 mins'), cart);
  check(
    'primary CTA reflects the bulk selection',
    (byId('salon-detail-book-now-btn')?.textContent || '').includes('Book 2 Services')
  );

  // Toggling off works (interaction bug: cards used to be non-interactive).
  await clickAct(host.querySelector('[data-testid="toggle-service-svc-nails"]'));
  check(
    'the per-row Add/Added button removes a service',
    serviceCard('svc-nails')?.getAttribute('aria-checked') === 'false'
  );
  await clickAct(serviceCard('svc-nails'));

  await clickAct(byId('salon-detail-book-now-btn'));
  check('booking receives the whole cart', bookCalls[0]?.services?.length === 2, JSON.stringify(bookCalls[0]?.services?.map((s) => s.id)));
  check('booking also receives a primary service for legacy call sites', bookCalls[0]?.service?.id === 'svc-cut');

  // Single-row "Book" still works and keeps the rest of the cart.
  await clickAct(host.querySelector('[data-service-id="svc-balayage"] button:nth-of-type(2)'));
  const last = bookCalls[bookCalls.length - 1];
  check(
    'row-level Book puts that service first and keeps the cart',
    last?.service?.id === 'svc-balayage' && last?.services?.length === 3,
    JSON.stringify(last?.services?.map((s) => s.id))
  );

  await clickAct(byId('salon-detail-clear-cart'));
  check('clear empties the cart', serviceCard('svc-cut')?.getAttribute('aria-checked') === 'false');
}

// ---------------------------------------------------------------------------
// 5. Summary modal checkout — success path and honest failure path
// ---------------------------------------------------------------------------
async function testSummaryCheckout() {
  const memoryStore = (): BookingStore => {
    const bookings: unknown[] = [];
    return {
      async insertBooking(row) {
        bookings.push(row);
        return { ok: true };
      },
      async insertBookingServices() {
        return { ok: true };
      },
      async deleteBooking() {
        return { ok: true };
      },
    };
  };

  let sentAmount = -1;
  let confirmed: Appointment | null = null;

  // Mirrors App.tsx handleServerBooking → server validation → persistence.
  const payDeposit = async (request: { amount: number; discountAmount?: number; date: string; time: string }) => {
    sentAmount = request.amount;
    const lines = buildBookingMetadataServices([srvCut, srvBalayage]);
    const totals = computeBookingTotals(lines, request.discountAmount ?? 0);
    const body = {
      salon: toBookingSalonSnapshot(salon),
      services: lines,
      stylist: toBookingStylistSnapshot(stylist),
      date: request.date,
      time: request.time,
      amount: totals.advanceAmount,
      ...(totals.discountAmount > 0 ? { discountAmount: totals.discountAmount } : {}),
    };
    const parsed = validateBookingRequest(body);
    if (!parsed.ok) throw new Error(`Invalid booking request: ${parsed.fields?.join('; ')}`);
    const created = await persistBooking(memoryStore(), parsed.value!);
    if (!created.appointment) throw new Error(created.error || 'no appointment');
    return created.appointment;
  };

  await render(
    <BookingSummaryModal
      isOpen
      onClose={() => {}}
      salon={salon}
      services={[srvCut, srvBalayage]}
      stylist={stylist}
      date={new Date().toISOString().split('T')[0]}
      time="5:30 PM"
      onPayDeposit={payDeposit as never}
      onConfirmBooking={(apt) => {
        confirmed = apt;
      }}
    />
  );

  const expectedAdvance = computeBookingTotals(buildBookingMetadataServices([srvCut, srvBalayage]), 0).advanceAmount;
  const payBtn = byId('confirm-booking-btn');
  check(
    'pay button quotes the shared-core advance',
    (payBtn?.textContent || '').includes(String(expectedAdvance)),
    payBtn?.textContent || ''
  );

  await clickAct(payBtn);
  await act(async () => {
    await new Promise((r) => setTimeout(r, 60));
  });

  check('checkout sent exactly the quoted advance', sentAmount === expectedAdvance, `₹${sentAmount}`);
  check('no payment-failure alert after a valid checkout', byId('payment-error-alert') === null);
  check('confirmation ticket is shown', byId('booking-summary-confirmation') !== null);
  check('parent received the confirmed multi-service booking', (confirmed as Appointment | null)?.services?.length === 2);

  // Failure path stays honest: a rejected deposit must surface, not succeed.
  // (A different slot resets the modal out of the confirmation screen.)
  let failCalls = 0;
  await render(
    <BookingSummaryModal
      isOpen
      onClose={() => {}}
      salon={salon}
      services={[srvCut]}
      stylist={stylist}
      date={new Date().toISOString().split('T')[0]}
      time="6:30 PM"
      onPayDeposit={(async () => {
        failCalls += 1;
        throw new Error('Gateway declined the advance payment.');
      }) as never}
    />
  );
  await clickAct(byId('confirm-booking-btn'));
  check('failed deposit shows the payment error panel', byId('payment-error-alert') !== null);
  check('failed deposit never shows a confirmation ticket', byId('booking-summary-confirmation') === null);

  await clickAct(byId('retry-payment-btn'));
  check('retry re-attempts the deposit', failCalls >= 2, `attempts=${failCalls}`);
}

async function run() {
  testTotals();
  testContract();
  await testDemoStore();
  await testSalonDetailCart();
  await testSummaryCheckout();

  console.log(`\n${passed}/${passed + failed} multi-service booking checks passed`);
  await act(async () => {
    root.unmount();
  });
  process.exit(failed > 0 ? 1 : 0);
}

void run();
