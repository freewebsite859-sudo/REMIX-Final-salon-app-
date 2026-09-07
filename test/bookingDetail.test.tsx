/**
 * Booking Detail Page — `/customer/booking/:bookingId`
 */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import type { Appointment, SalonService, Stylist } from '../src/types.ts';
import {
  BookingDetailPage,
  estimateRewardPoints,
  paymentStatusMeta,
  rewardStatusMeta,
} from '../src/components/BookingDetailPage.tsx';

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

const service: SalonService = {
  id: 's1',
  name: 'Signature Hair Cut & Wash',
  category: 'hair',
  duration: 45,
  price: 499,
  discountPrice: 399,
  description: 'Cut',
};

const stylist: Stylist = {
  id: 'st-1',
  name: 'Aarav Sharma',
  role: 'Senior Hair Specialist',
  avatar: 'https://example.com/a.jpg',
  rating: 4.9,
  experience: '7y',
  specialty: ['Fade'],
};

function makeApt(overrides: Partial<Appointment> = {}): Appointment {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 2);
  const date = tomorrow.toISOString().split('T')[0];
  return {
    id: 'apt-detail-1',
    salonId: 'salon-1',
    salonName: 'Scissors & Shears Salon',
    salonAddress: 'Plot 42, Madhyam Marg, Mansarovar, Jaipur',
    salonImage: 'https://example.com/salon.jpg',
    salonPhone: '+91 141 278 9901',
    services: [service],
    stylist,
    date,
    time: '5:30 PM',
    status: 'confirmed',
    totalPrice: 399,
    advancePaid: 100,
    remainingAmount: 299,
    paymentStatus: 'paid',
    paymentMethodUsed: 'upi',
    razorpayPaymentId: 'pay_test_abc123',
    bookingRef: 'NX-DET-001',
    notes: 'Quiet chair please, sensitive scalp',
    createdAt: new Date().toISOString(),
    mapsUrl: 'https://maps.google.com/?q=Mansarovar',
    whatsappConfirmationStatus: 'sent',
    ...overrides,
  };
}

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

// Pure helpers
check('reward points estimate', estimateRewardPoints(399) === 39);
check('reward points zero', estimateRewardPoints(0) === 0);
check('payment paid label', /advance paid/i.test(paymentStatusMeta(makeApt()).label));
check(
  'reward pending for confirmed',
  /pending/i.test(rewardStatusMeta(makeApt({ status: 'confirmed' })).label)
);
check(
  'reward credited for completed',
  /credited/i.test(rewardStatusMeta(makeApt({ status: 'completed' })).label)
);

const host = document.createElement('div');
document.body.appendChild(host);
let root: Root = createRoot(host);

async function render(ui: React.ReactElement) {
  await act(async () => {
    root.render(ui);
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
}

function byId(id: string): HTMLElement | null {
  return document.getElementById(id) || host.querySelector(`[id="${id}"]`);
}

function text(): string {
  return host.textContent || '';
}

function click(el: Element | null) {
  if (!el) throw new Error('click target missing');
  const Ev = typeof MouseEvent !== 'undefined' ? MouseEvent : (Event as typeof Event);
  (el as HTMLElement).dispatchEvent(new Ev('click', { bubbles: true, cancelable: true }));
}

// ---------------------------------------------------------------------------
// Not found
// ---------------------------------------------------------------------------

let backCalls = 0;
await render(
  <BookingDetailPage
    appointment={null}
    bookingId="missing-id"
    onBack={() => {
      backCalls += 1;
    }}
  />
);
check('not-found root', Boolean(byId('booking-detail-page')));
check('not-found panel', Boolean(byId('booking-detail-not-found')));
check('not-found shows id', text().includes('missing-id'));
check('route pattern attr', byId('booking-detail-page')?.getAttribute('data-route-pattern') === '/customer/booking/:bookingId');

// ---------------------------------------------------------------------------
// Full upcoming confirmed detail
// ---------------------------------------------------------------------------

let cancelIds: string[] = [];
let rebookIds: string[] = [];
let salonIds: string[] = [];
let rewardOpens = 0;

const upcoming = makeApt();
await render(
  <BookingDetailPage
    appointment={upcoming}
    bookingId={upcoming.id}
    onBack={() => {
      backCalls += 1;
    }}
    onCancel={(id) => cancelIds.push(id)}
    onRebook={(a) => rebookIds.push(a.id)}
    onOpenSalon={(id) => salonIds.push(id)}
    onOpenRewards={() => {
      rewardOpens += 1;
    }}
  />
);

check('detail root', Boolean(byId('booking-detail-page')));
check('data booking id', byId('booking-detail-page')?.getAttribute('data-booking-id') === upcoming.id);
check('booking id shown', (byId('booking-detail-id')?.textContent || '').includes('NX-DET-001'));
check('status badge', (byId('booking-detail-status')?.textContent || '').includes('Confirmed'));
check('salon name', text().includes('Scissors & Shears Salon'));
check('services section', Boolean(byId('booking-detail-services')));
check('service name', text().includes('Signature Hair Cut'));
check('staff name', text().includes('Aarav Sharma'));
check('staff section', Boolean(byId('booking-detail-staff')));
check('datetime section', Boolean(byId('booking-detail-datetime')));
check('time shown', text().includes('5:30 PM'));
check('price section', Boolean(byId('booking-detail-price')));
check('price value', text().includes('399'));
check('customer note', Boolean(byId('booking-detail-note')));
check('note text', text().includes('Quiet chair please'));
check('payment status block', Boolean(byId('booking-detail-payment')));
check('payment label', (byId('booking-detail-payment')?.textContent || '').toLowerCase().includes('paid'));
check('reward status block', Boolean(byId('booking-detail-reward')));
check('reward pending copy', (byId('booking-detail-reward')?.textContent || '').toLowerCase().includes('pending'));
check('directions btn', Boolean(byId('booking-detail-directions-btn')));
check('directions href', byId('booking-detail-directions-btn')?.getAttribute('href')?.includes('maps'));
check('contact call', Boolean(byId('booking-detail-contact-btn')));
check('contact tel', byId('booking-detail-contact-btn')?.getAttribute('href')?.startsWith('tel:'));
check('cancel btn for upcoming', Boolean(byId('booking-detail-cancel-btn')));
check('no review btn on upcoming', !byId('booking-detail-review-btn'));

// Cancel flow
await act(async () => {
  click(byId('booking-detail-cancel-btn'));
});
check('cancel confirm shown', Boolean(byId('booking-detail-cancel-confirm')));
await act(async () => {
  click(byId('booking-detail-confirm-cancel-btn'));
});
check('cancel fired', cancelIds.includes(upcoming.id), cancelIds.join(','));

// Salon open
await act(async () => {
  click(byId('booking-detail-salon'));
});
check('open salon', salonIds.includes('salon-1'));

// Rewards link
await act(async () => {
  click(byId('booking-detail-rewards-link'));
});
check('open rewards', rewardOpens === 1);

// ---------------------------------------------------------------------------
// Completed — review button, no cancel, rebook
// ---------------------------------------------------------------------------

const completed = makeApt({
  id: 'apt-done',
  status: 'completed',
  date: yesterday(),
  time: '11:00 AM',
  bookingRef: 'NX-DONE-9',
  paymentStatus: 'paid',
});

let reviewPayload: { id: string; rating: number; note: string } | null = null;

await render(
  <BookingDetailPage
    appointment={completed}
    bookingId={completed.id}
    onBack={() => {}}
    onCancel={(id) => cancelIds.push(id)}
    onRebook={(a) => rebookIds.push(a.id)}
    onSubmitReview={(id, rating, note) => {
      reviewPayload = { id, rating, note };
    }}
  />
);

check('completed status', (byId('booking-detail-status')?.textContent || '').includes('Completed'));
check('no cancel on completed', !byId('booking-detail-cancel-btn'));
check('review btn on completed', Boolean(byId('booking-detail-review-btn')));
check('rebook on completed', Boolean(byId('booking-detail-rebook-btn')));
check(
  'reward credited',
  (byId('booking-detail-reward')?.textContent || '').toLowerCase().includes('credited')
);

await act(async () => {
  click(byId('booking-detail-review-btn'));
});
check('review panel open', Boolean(byId('booking-detail-review-panel')));
await act(async () => {
  click(byId('booking-detail-submit-review-btn'));
});
check('review submitted', reviewPayload?.id === 'apt-done', JSON.stringify(reviewPayload));

await act(async () => {
  click(byId('booking-detail-rebook-btn'));
});
check('rebook fired', rebookIds.includes('apt-done'));

// ---------------------------------------------------------------------------
// Cancelled — no cancel, rebook yes
// ---------------------------------------------------------------------------

const cancelled = makeApt({
  id: 'apt-x',
  status: 'cancelled',
  date: yesterday(),
  bookingRef: 'NX-X',
});
await render(
  <BookingDetailPage appointment={cancelled} bookingId={cancelled.id} onBack={() => {}} onRebook={(a) => rebookIds.push(a.id)} />
);
check('cancelled status', (byId('booking-detail-status')?.textContent || '').includes('Cancelled'));
check('no cancel on cancelled', !byId('booking-detail-cancel-btn'));
check('rebook on cancelled', Boolean(byId('booking-detail-rebook-btn')));
check('no review on cancelled', !byId('booking-detail-review-btn'));

console.log(`\n${passed}/${passed + failed} passed`);
if (failed > 0) {
  console.log('DOM snippet:', host.innerHTML.slice(0, 600));
  process.exit(1);
}
