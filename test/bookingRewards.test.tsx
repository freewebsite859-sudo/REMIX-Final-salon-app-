/**
 * Wallet & Loyalty — booking-driven earning and redemption.
 *
 * Business rules under test (mirrors src/lib/engagement.ts + the SQL trigger):
 *   - A COMPLETED booking of ≥ ₹100 credits floor(bill × 10%) points, once.
 *   - Crediting is idempotent: re-running the sync never double-pays.
 *   - Pending/cancelled bookings and sub-₹100 bills earn nothing.
 *   - Points redeem against a completed booking's bill, capped at the balance
 *     and at 50% of the bill, one redemption per booking, never as cash.
 *   - The `/customer/rewards` wallet surfaces all of it.
 *
 * Run: npm run test:booking-rewards
 */

import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';

import { RewardsTab } from '../src/components/RewardsTab.tsx';
import type { Appointment, Salon, SalonService, UserProfile } from '../src/types.ts';
import {
  MIN_BOOKING_AMOUNT_INR,
  MAX_REDEEM_PERCENT_OF_BILL,
  BOOKING_CASHBACK_PERCENT,
  calculateBookingPoints,
  isBookingRewardEligible,
  addBookingCompletionReward,
  syncBookingRewards,
  maxRedeemablePoints,
  redeemPointsForBooking,
  calculateWalletSummary,
  getStoredRewardTransactions,
  saveRewardTransactions,
  filterRewardTransactions,
  type RewardTransaction,
} from '../src/lib/rewardsService.ts';
import {
  CUSTOMER_REWARDS,
  CUSTOMER_ROUTE_CATALOG,
  customerRouteToTab,
  isProtectedCustomerRoute,
  parseCustomerRoute,
} from '../src/lib/customerRoutes.ts';

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
const USER_ID = 'user-loyalty-1';

const service = (id: string, price: number, duration = 45): SalonService => ({
  id,
  name: `Service ${id}`,
  category: 'hair',
  duration,
  price,
  description: 'Test service',
});

function booking(overrides: Partial<Appointment> & { id: string }): Appointment {
  return {
    salonId: 'salon-1',
    salonName: 'Nexora Signature C-Scheme',
    salonAddress: 'C-Scheme, Jaipur',
    salonImage: 'https://example.com/s.jpg',
    services: [service('svc-a', 1200)],
    date: '2026-09-01',
    time: '5:30 PM',
    status: 'completed',
    totalPrice: 2000,
    bookingRef: `NX-${overrides.id.toUpperCase()}`,
    createdAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  } as Appointment;
}

const completedA = booking({ id: 'apt-a', totalPrice: 2000, bookingRef: 'NX-AAA111' });
const completedB = booking({ id: 'apt-b', totalPrice: 1450, bookingRef: 'NX-BBB222' });
const pendingC = booking({ id: 'apt-c', totalPrice: 3000, status: 'pending', bookingRef: 'NX-CCC333' });
const tinyD = booking({ id: 'apt-d', totalPrice: 80, bookingRef: 'NX-DDD444' });
const cancelledE = booking({ id: 'apt-e', totalPrice: 5000, status: 'cancelled', bookingRef: 'NX-EEE555' });

const mockUser: UserProfile = {
  name: 'Ananya Sharma',
  email: 'ananya@example.com',
  phone: '+91 98290 12345',
  avatar: '',
  locationArea: 'C-Scheme',
  city: 'Jaipur',
  loyaltyPoints: 0,
  preferredServices: [],
  genderPreference: 'all',
} as UserProfile;

const mockSalons: Salon[] = [
  {
    id: 'salon-1',
    name: 'Nexora Signature C-Scheme',
    rating: 4.9,
    reviewCount: 312,
    distance: '1.2 km',
    image: 'https://example.com/s.jpg',
    location: { area: 'C-Scheme', city: 'Jaipur', address: 'Ashok Marg, Jaipur' },
    services: [service('svc-a', 1200)],
    stylists: [],
    categories: ['hair'],
    reviews: [],
  } as unknown as Salon,
];

/** Deterministic wallet baseline: one approved 1,000-point bonus. */
function resetWallet(points = 1000) {
  const baseline: RewardTransaction[] = [
    {
      id: 'rwd-baseline',
      type: 'bonus',
      typeLabel: 'Bonus Reward',
      points,
      date: '01 Sep 2026',
      createdAt: '2026-09-01T00:00:00.000Z',
      salonName: 'Nexora',
      status: 'Approved',
    },
  ];
  saveRewardTransactions(USER_ID, baseline);
  return baseline;
}

// ---------------------------------------------------------------------------
// 1. Earning rules
// ---------------------------------------------------------------------------
function testEarnRules() {
  check('booking cashback rate is 10%', BOOKING_CASHBACK_PERCENT === 10);
  check('₹2,000 completed booking earns 200 points', calculateBookingPoints(2000) === 200);
  check('points round DOWN (₹1,450 → 145)', calculateBookingPoints(1450) === 145);
  check(`bills under ₹${MIN_BOOKING_AMOUNT_INR} earn nothing`, calculateBookingPoints(80) === 0);
  check('negative/invalid bills earn nothing', calculateBookingPoints(-500) === 0);

  check('completed ₹2,000 booking is eligible', isBookingRewardEligible(completedA));
  check('pending booking is not eligible', !isBookingRewardEligible(pendingC));
  check('cancelled booking is not eligible', !isBookingRewardEligible(cancelledE));
  check('sub-₹100 completed booking is not eligible', !isBookingRewardEligible(tinyD));
}

// ---------------------------------------------------------------------------
// 2. Crediting is idempotent
// ---------------------------------------------------------------------------
function testAccrual() {
  resetWallet(1000);

  const first = syncBookingRewards(USER_ID, [completedA, completedB, pendingC, tinyD, cancelledE]);
  check('sync credits only the eligible completed bookings', first.awarded.length === 2, `awarded=${first.awarded.length}`);
  check('sync credits 200 + 145 = 345 points', first.pointsAwarded === 345, `${first.pointsAwarded} pts`);
  check('wallet balance grows by the credited points', first.summary.currentPoints === 1345, `${first.summary.currentPoints} pts`);
  check('summary tracks the booking bucket', first.summary.bookingRewards === 345, `${first.summary.bookingRewards} pts`);

  const second = syncBookingRewards(USER_ID, [completedA, completedB, pendingC, tinyD, cancelledE]);
  check('re-running the sync credits nothing (idempotent)', second.awarded.length === 0);
  check('balance is unchanged after a repeat sync', second.summary.currentPoints === 1345, `${second.summary.currentPoints} pts`);

  const manual = addBookingCompletionReward({ userId: USER_ID, appointment: completedA });
  check('manual credit for an already-paid booking is refused', !manual.success && manual.alreadyAwarded);

  const notComplete = addBookingCompletionReward({ userId: USER_ID, appointment: pendingC });
  check(
    'manual credit refuses a booking that is not completed',
    !notComplete.success && notComplete.message.toLowerCase().includes('completed')
  );

  // A booking that completes later is picked up on the next sync.
  const late = syncBookingRewards(USER_ID, [
    completedA,
    completedB,
    { ...pendingC, status: 'completed' } as Appointment,
  ]);
  check('a newly completed booking is credited on the next sync', late.awarded.length === 1, `+${late.pointsAwarded}`);
  check('late credit uses the 10% rule (₹3,000 → 300)', late.pointsAwarded === 300);

  const ledger = getStoredRewardTransactions(USER_ID);
  check(
    'ledger rows carry the booking reference',
    ledger.some((tx) => tx.type === 'booking' && tx.bookingRef === 'NX-AAA111')
  );
  check(
    'booking filter isolates booking rewards',
    filterRewardTransactions(ledger, 'booking').every((tx) => tx.type === 'booking' || Boolean(tx.bookingId))
  );
}

// ---------------------------------------------------------------------------
// 3. Redemption rules
// ---------------------------------------------------------------------------
function testRedemption() {
  resetWallet(1000);
  syncBookingRewards(USER_ID, [completedA]); // balance 1200, bill 2000

  check(
    `redeem cap is ${MAX_REDEEM_PERCENT_OF_BILL}% of the bill`,
    maxRedeemablePoints(5000, 2000) === 1000,
    String(maxRedeemablePoints(5000, 2000))
  );
  check('redeem cap never exceeds the balance', maxRedeemablePoints(300, 2000) === 300);
  check('sub-₹100 bills cannot be redeemed against', maxRedeemablePoints(1000, 50) === 0);

  const tooMuch = redeemPointsForBooking({ userId: USER_ID, appointment: completedA, pointsToRedeem: 1100 });
  check('redeeming above the 50% cap is rejected', !tooMuch.success, tooMuch.error);

  const notCompleted = redeemPointsForBooking({ userId: USER_ID, appointment: pendingC, pointsToRedeem: 100 });
  check('redeeming against a pending booking is rejected', !notCompleted.success, notCompleted.error);

  const zero = redeemPointsForBooking({ userId: USER_ID, appointment: completedA, pointsToRedeem: 0 });
  check('redeeming zero points is rejected', !zero.success, zero.error);

  const ok = redeemPointsForBooking({ userId: USER_ID, appointment: completedA, pointsToRedeem: 800 });
  check('valid redemption succeeds', ok.success, ok.error);
  check('₹1 per point discount applied', ok.discountInr === 800, `₹${ok.discountInr}`);
  check('net payable is bill − discount', ok.netPayableInr === 1200, `₹${ok.netPayableInr}`);
  check('balance drops by the redeemed points', ok.remainingPoints === 400, `${ok.remainingPoints} pts`);

  const twice = redeemPointsForBooking({ userId: USER_ID, appointment: completedA, pointsToRedeem: 100 });
  check('a booking can only be redeemed against once', !twice.success, twice.error);

  const summary = calculateWalletSummary(getStoredRewardTransactions(USER_ID));
  check('lifetime redeemed reflects the redemption', summary.lifetimeRedeemed === 800, `${summary.lifetimeRedeemed} pts`);

  const overBalance = redeemPointsForBooking({
    userId: USER_ID,
    appointment: completedB,
    pointsToRedeem: 700, // balance is 400
  });
  check('cannot redeem more than the balance', !overBalance.success, overBalance.error);
}

// ---------------------------------------------------------------------------
// 4. Wallet route + UI
// ---------------------------------------------------------------------------
const host = document.createElement('div');
document.body.appendChild(host);
const root: Root = createRoot(host);

async function render(ui: React.ReactElement) {
  await act(async () => {
    root.render(ui);
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 40));
  });
}

function byId(id: string) {
  return document.getElementById(id);
}

async function clickAct(el: Element | null | undefined) {
  if (!el) throw new Error('click target missing');
  const Ev = typeof window.MouseEvent !== 'undefined' ? window.MouseEvent : window.Event;
  await act(async () => {
    (el as HTMLElement).dispatchEvent(new Ev('click', { bubbles: true, cancelable: true }));
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
}

async function setInput(el: HTMLInputElement | null, value: string) {
  if (!el) throw new Error('input missing');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  await act(async () => {
    setter?.call(el, value);
    el.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
}

async function testWalletUi() {
  check('/customer/rewards parses to the rewards route', parseCustomerRoute(CUSTOMER_REWARDS).kind === 'rewards');
  check(
    '/customer/rewards maps to the rewards tab',
    customerRouteToTab(parseCustomerRoute(CUSTOMER_REWARDS)) === 'rewards'
  );
  check('/customer/rewards is auth-protected', isProtectedCustomerRoute(parseCustomerRoute(CUSTOMER_REWARDS)));
  check('/customer/rewards is in the route catalog', CUSTOMER_ROUTE_CATALOG.includes(CUSTOMER_REWARDS));

  resetWallet(1000);

  await render(
    <RewardsTab
      user={mockUser}
      userId={USER_ID}
      salons={mockSalons}
      appointments={[completedA, completedB, pendingC, tinyD]}
    />
  );

  const page = byId('rewards-wallet-page');
  check('wallet page renders at /customer/rewards', page?.getAttribute('data-route') === '/customer/rewards');

  const section = byId('section-booking-rewards');
  check('booking rewards section is present', Boolean(section));
  check(
    'booking rewards total shows the credited points (345)',
    (byId('wallet-booking-rewards-value')?.textContent || '').includes('345'),
    byId('wallet-booking-rewards-value')?.textContent || ''
  );
  check(
    'wallet balance includes booking points (1,345)',
    (byId('wallet-current-points-value')?.textContent || '').replace(/,/g, '').includes('1345'),
    byId('wallet-current-points-value')?.textContent || ''
  );

  const rowA = host.querySelector('[data-booking-reward="apt-a"]')?.textContent || '';
  check('completed booking row shows its earned points', rowA.includes('+200 pts'), rowA);
  const rowD = host.querySelector('[data-booking-reward="apt-d"]')?.textContent || '';
  check('sub-₹100 booking row is marked as non-earning', rowD.includes('no points'), rowD);
  check('pending booking is not listed as a completed earner', !host.querySelector('[data-booking-reward="apt-c"]'));
  check(
    'redeem button is disabled on a sub-₹100 bill',
    (host.querySelector('[data-testid="redeem-booking-apt-d"]') as HTMLButtonElement | null)?.disabled === true
  );

  check('history has a Bookings filter tab', Boolean(byId('filter-reward-booking')));
  await clickAct(byId('filter-reward-booking'));
  const historyText = byId('section-reward-history')?.textContent || '';
  check('Bookings filter shows booking rewards', historyText.includes('Booking Reward'));
  check('Bookings filter hides QR payment rows', !historyText.includes('QR Payment Reward'));

  // Redeem against the completed booking from the wallet.
  await clickAct(host.querySelector('[data-testid="redeem-booking-apt-a"]'));
  check('booking redemption modal opens', Boolean(byId('booking-redeem-modal')));

  const pointsInput = byId('booking-redeem-points-input') as HTMLInputElement | null;
  check('modal pre-fills the maximum redeemable points (1000)', pointsInput?.value === '1000', pointsInput?.value);

  await setInput(pointsInput, '1200');
  await clickAct(byId('confirm-booking-redemption-btn'));
  check('over-cap redemption is blocked in the UI', Boolean(byId('booking-redeem-error')));

  await setInput(byId('booking-redeem-points-input') as HTMLInputElement, '500');
  check(
    'net payable updates live (₹2,000 − ₹500)',
    (byId('booking-redeem-net-payable')?.textContent || '').includes('1,500'),
    byId('booking-redeem-net-payable')?.textContent || ''
  );

  await clickAct(byId('confirm-booking-redemption-btn'));
  check('redemption modal closes on success', byId('booking-redeem-modal') === null);
  check(
    'balance drops after redeeming (1,345 − 500 = 845)',
    (byId('wallet-current-points-value')?.textContent || '').replace(/,/g, '').includes('845'),
    byId('wallet-current-points-value')?.textContent || ''
  );

  const rowAfter = host.querySelector('[data-booking-reward="apt-a"]')?.textContent || '';
  check('booking row shows it was redeemed', rowAfter.includes('Redeemed'), rowAfter);
}

async function run() {
  testEarnRules();
  testAccrual();
  testRedemption();
  await testWalletUi();

  console.log(`\n${passed}/${passed + failed} wallet & loyalty checks passed`);
  await act(async () => {
    root.unmount();
  });
  process.exit(failed > 0 ? 1 : 0);
}

void run();
