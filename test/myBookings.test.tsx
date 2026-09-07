/**
 * My Bookings page (`/customer/bookings`) — tabs, cards, empty state, CTAs.
 */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import type { Appointment, SalonService, Stylist } from '../src/types.ts';
import { AppointmentsTab } from '../src/components/AppointmentsTab.tsx';

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
  role: 'Senior',
  avatar: '',
  rating: 4.9,
  experience: '7y',
  specialty: ['Fade'],
};

function makeApt(overrides: Partial<Appointment> = {}): Appointment {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 2);
  const date = tomorrow.toISOString().split('T')[0];
  return {
    id: 'apt-1',
    salonId: 'salon-1',
    salonName: 'Scissors & Shears Salon',
    salonAddress: 'Mansarovar, Jaipur',
    salonImage: 'https://example.com/salon.jpg',
    services: [service],
    stylist,
    date,
    time: '5:30 PM',
    status: 'confirmed',
    totalPrice: 399,
    advancePaid: 100,
    remainingAmount: 299,
    bookingRef: 'NX-TEST-001',
    createdAt: new Date().toISOString(),
    mapsUrl: 'https://maps.google.com/?q=test',
    ...overrides,
  };
}

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

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
// Empty state
// ---------------------------------------------------------------------------

let exploreCalls = 0;

await render(
  <AppointmentsTab
    appointments={[]}
    onCancelAppointment={() => {}}
    onRescheduleAppointment={() => {}}
    onExploreSalons={() => {
      exploreCalls += 1;
    }}
  />
);

check('page root exists', Boolean(byId('my-bookings-page')));
check('route data attr', byId('my-bookings-page')?.getAttribute('data-route') === '/customer/bookings');
check(
  'empty headline',
  text().includes('No bookings yet. Find your next salon visit.')
);
check('empty CTA present', Boolean(byId('my-bookings-explore-salons-btn')));
check('empty CTA label', (byId('my-bookings-explore-salons-btn')?.textContent || '').includes('Explore Salons'));

await act(async () => {
  click(byId('my-bookings-explore-salons-btn'));
});
check('empty CTA fires explore', exploreCalls === 1, `calls=${exploreCalls}`);

// Tabs still render when empty
check('tab upcoming', Boolean(byId('my-bookings-tab-upcoming')));
check('tab completed', Boolean(byId('my-bookings-tab-completed')));
check('tab cancelled', Boolean(byId('my-bookings-tab-cancelled')));
check('title My Bookings', text().includes('My Bookings'));

// ---------------------------------------------------------------------------
// Populated list — upcoming card fields
// ---------------------------------------------------------------------------

const upcoming = makeApt({ id: 'u1', status: 'confirmed' });
const completed = makeApt({
  id: 'c1',
  status: 'completed',
  date: yesterday(),
  time: '11:00 AM',
  bookingRef: 'NX-DONE-1',
});
const cancelled = makeApt({
  id: 'x1',
  status: 'cancelled',
  date: yesterday(),
  time: '3:00 PM',
  bookingRef: 'NX-CXL-1',
});
const pending = makeApt({
  id: 'p1',
  status: 'pending',
  bookingRef: 'NX-PEND-1',
  salonName: 'Glow & Grace Spa',
});

let cancelIds: string[] = [];
let rebookIds: string[] = [];
let detailIds: string[] = [];

await render(
  <AppointmentsTab
    appointments={[upcoming, completed, cancelled, pending]}
    onCancelAppointment={(id) => {
      cancelIds.push(id);
    }}
    onRescheduleAppointment={() => {}}
    onBookAgain={(apt) => {
      rebookIds.push(apt.id);
    }}
    onOpenBookingDetail={(id) => {
      detailIds.push(id);
    }}
    onExploreSalons={() => {
      exploreCalls += 1;
    }}
  />
);

check('list rendered', Boolean(byId('my-bookings-list')));
check('upcoming card', Boolean(byId('booking-card-u1')));
check('pending card in upcoming', Boolean(byId('booking-card-p1')));

// Card content
const cardText = byId('booking-card-u1')?.textContent || '';
check('card: salon name', cardText.includes('Scissors & Shears Salon'));
check('card: service', cardText.includes('Signature Hair Cut'));
check('card: staff', cardText.includes('Aarav Sharma'));
check('card: time', cardText.includes('5:30 PM'));
check('card: status Confirmed', cardText.includes('Confirmed'));
check('card: price', cardText.includes('399') || cardText.includes('₹399'));
check('card: view details btn', Boolean(byId('booking-view-details-u1')));
check('card: cancel btn', Boolean(byId('booking-cancel-u1')));

// View details → parent navigates to `/customer/booking/:id`
await act(async () => {
  click(byId('booking-view-details-u1'));
});
check('view details callback', detailIds.includes('u1'), detailIds.join(','));
// List stays mounted here (route change is parent's job); card still present
check('list still available after detail request', Boolean(byId('my-bookings-list')));

// Cancel flow (confirm step)
await act(async () => {
  click(byId('booking-cancel-u1'));
});
check('cancel confirm shown', Boolean(byId('booking-confirm-cancel-u1')));
await act(async () => {
  click(byId('booking-confirm-cancel-u1'));
});
check('cancel fired', cancelIds.includes('u1'), cancelIds.join(','));

// ---------------------------------------------------------------------------
// Completed tab — review + rebook
// ---------------------------------------------------------------------------

await act(async () => {
  click(byId('my-bookings-tab-completed'));
});
check('completed tab selected', byId('my-bookings-tab-completed')?.getAttribute('aria-selected') === 'true');
check('completed card visible', Boolean(byId('booking-card-c1')));
check('review section', Boolean(byId('booking-review-c1')));
check('rebook on completed', Boolean(byId('booking-rebook-c1')));

await act(async () => {
  click(byId('booking-rebook-c1'));
});
check('rebook fired', rebookIds.includes('c1'), rebookIds.join(','));

// ---------------------------------------------------------------------------
// Cancelled tab
// ---------------------------------------------------------------------------

await act(async () => {
  click(byId('my-bookings-tab-cancelled'));
});
check('cancelled tab', byId('my-bookings-tab-cancelled')?.getAttribute('aria-selected') === 'true');
check('cancelled card', Boolean(byId('booking-card-x1')));
check('rebook on cancelled', Boolean(byId('booking-rebook-x1')));
check('no cancel on cancelled', !byId('booking-cancel-x1'));

// Segment-empty: fresh mount with only completed → default Upcoming tab is empty
await act(async () => {
  root.unmount();
  root = createRoot(host);
});
await render(
  <AppointmentsTab
    appointments={[completed]}
    onCancelAppointment={() => {}}
    onRescheduleAppointment={() => {}}
    onExploreSalons={() => {
      exploreCalls += 1;
    }}
  />
);
check('segment empty upcoming', Boolean(byId('my-bookings-empty-upcoming')));
check('segment empty explore CTA', Boolean(byId('my-bookings-explore-upcoming-btn')));

console.log(`\n${passed}/${passed + failed} passed`);
if (failed > 0) {
  console.log('DOM snippet:', host.innerHTML.slice(0, 800));
  process.exit(1);
}
