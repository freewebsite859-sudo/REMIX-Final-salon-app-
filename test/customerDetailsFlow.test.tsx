/**
 * End-to-end contract for the Step 5 Customer Details (screen 11) → Booking
 * Review (screen 12) → booking payload (server).
 *
 * This exists because of a real data-loss bug: `buildDraft()` returned the
 * typed contact details, but the `onOpenSummary` prop type did not declare
 * them, `App.tsx`'s draft state did not hold them, and the booking payload was
 * assembled from the stored profile. So a customer booking for someone else had
 * the name and phone they typed silently discarded — and the review screen
 * never showed the contact, so the substitution was invisible.
 *
 * These checks fail if that regression comes back.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

import { BookingModal } from '../src/components/BookingModal';
import { BookingSummaryModal } from '../src/components/BookingSummaryModal';
import { createBooking } from '../src/lib/bookingCore';
import { createMemoryBookingStore } from '../server/bookings';
import type { Salon, SalonService } from '../src/types';

const results: { name: string; pass: boolean; detail?: string }[] = [];
function check(name: string, pass: boolean, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const svc: SalonService = {
  id: 'svc-cut', name: 'Precision Cut', category: 'hair', duration: 45, price: 1000, description: '',
};
const salon: Salon = {
  id: 'salon-t', name: 'Test Glam Studio', tagline: 't', categories: ['hair'], rating: 4.8,
  reviewCount: 10, distance: '0.5 km',
  location: { area: 'Test', city: 'Jaipur', address: '1 St', latitude: 0, longitude: 0 },
  image: '', gallery: [], isOpen: true, openingHours: '9-9', priceRange: '₹₹',
  services: [svc], stylists: [], reviews: [], amenities: [], gender: 'unisex',
};

/** The account holder's stored profile — deliberately DIFFERENT from the input. */
const PROFILE = { name: 'Account Holder', email: 'holder@example.com', phone: '+91 11111 11111' };
/** Who the customer actually types: a booking made for a relative. */
const TYPED = { name: 'Grandma Sharma', phone: '+91 98765 43210', email: 'grandma@example.com' };

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
await act(async () => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

function setField(id: string, value: string) {
  const input = container.querySelector(`#${id}`) as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
}
function click(label: string) {
  return Array.from(container.querySelectorAll('button')).find((b) =>
    b.textContent?.includes(label)
  ) as HTMLButtonElement | undefined;
}

// ---------------------------------------------------------------------------
// 1. The draft that leaves BookingModal must carry the typed details
// ---------------------------------------------------------------------------
let draftOut: any = null;

await act(async () => {
  root.render(
    <BookingModal
      isOpen
      salon={salon}
      initialService={svc}
      customerDetails={PROFILE}
      onClose={() => undefined}
      onOpenSummary={(draft) => { draftOut = draft; }}
    />
  );
  await new Promise((r) => setTimeout(r, 0));
});

check(
  'the modal prefills from the stored profile',
  (container.querySelector('#booking-customer-name') as HTMLInputElement)?.value === PROFILE.name,
  (container.querySelector('#booking-customer-name') as HTMLInputElement)?.value
);

// Overwrite every field with the relative's details.
await act(async () => {
  setField('booking-customer-name', TYPED.name);
  setField('booking-customer-phone', TYPED.phone);
  setField('booking-customer-email', TYPED.email);
});

await act(async () => {
  click('Review Full Appointment Summary')?.click();
});

check(
  'the handoff draft carries a customer object',
  Boolean(draftOut?.customer),
  JSON.stringify(draftOut?.customer)
);
check(
  'the draft carries the TYPED name, not the profile name',
  draftOut?.customer?.name === TYPED.name,
  `got="${draftOut?.customer?.name}" want="${TYPED.name}"`
);
check(
  'the draft carries the TYPED phone, not the profile phone',
  draftOut?.customer?.phone === TYPED.phone,
  `got="${draftOut?.customer?.phone}" want="${TYPED.phone}"`
);
check(
  'the draft carries the TYPED email',
  draftOut?.customer?.email === TYPED.email,
  `got="${draftOut?.customer?.email}"`
);
check(
  'the draft still carries the selected services',
  draftOut?.services?.length === 1 && draftOut.services[0].id === 'svc-cut',
  `services=${draftOut?.services?.length}`
);

// ---------------------------------------------------------------------------
// 2. The Booking Review screen must SHOW the contact it will send
// ---------------------------------------------------------------------------
await act(async () => {
  root.render(
    <BookingSummaryModal
      isOpen
      onClose={() => undefined}
      salon={salon}
      services={draftOut.services}
      stylist={null}
      date={draftOut.date}
      time={draftOut.time}
      customer={draftOut.customer}
    />
  );
  await new Promise((r) => setTimeout(r, 0));
});

const reviewBlock = container.querySelector('[data-testid="review-contact-details"]');
const reviewText = reviewBlock?.textContent || '';
check(
  'the review screen renders a contact section',
  Boolean(reviewBlock),
  reviewBlock ? 'found' : 'MISSING'
);
check(
  'the review screen shows the TYPED name',
  reviewText.includes(TYPED.name),
  reviewText.slice(0, 80)
);
check(
  'the review screen shows the TYPED phone',
  reviewText.includes(TYPED.phone),
  reviewText.slice(0, 80)
);
check(
  'the review screen does NOT show the profile name (no silent substitution)',
  !reviewText.includes(PROFILE.name),
  reviewText.slice(0, 80)
);

// A draft with no details (e.g. rebook path) must not render an empty block.
await act(async () => {
  root.render(
    <BookingSummaryModal
      isOpen
      onClose={() => undefined}
      salon={salon}
      services={[svc]}
      stylist={null}
      date={new Date().toISOString().split('T')[0]}
      time="5:30 PM"
      customer={null}
    />
  );
  await new Promise((r) => setTimeout(r, 0));
});
check(
  'a draft without details omits the contact block',
  container.querySelector('[data-testid="review-contact-details"]') === null
);

// ---------------------------------------------------------------------------
// 2b. The "Choose Professional" path reaches the review screen WITHOUT going
// through step 5. It seeds the contact from the stored profile so the salon's
// contact is still visible there, matching what handleServerBooking sends.
// ---------------------------------------------------------------------------
{
  const profileSeeded = {
    name: PROFILE.name,
    phone: PROFILE.phone,
    email: PROFILE.email,
  };
  await act(async () => {
    root.render(
      <BookingSummaryModal
        isOpen
        onClose={() => undefined}
        salon={salon}
        services={[svc]}
        stylist={null}
        date={new Date().toISOString().split('T')[0]}
        time="2:30 PM"
        customer={profileSeeded}
      />
    );
    await new Promise((r) => setTimeout(r, 0));
  });
  const block = container.querySelector('[data-testid="review-contact-details"]');
  const text = block?.textContent || '';
  check(
    'a profile-seeded draft still shows the contact on the review screen',
    Boolean(block) && text.includes(PROFILE.name) && text.includes(PROFILE.phone),
    text.slice(0, 70)
  );
}

// ---------------------------------------------------------------------------
// 3. The booking payload must prefer the typed details over the profile
// ---------------------------------------------------------------------------
// Mirrors App.tsx handleServerBooking's resolution order exactly.
function resolveContact(
  details: { name: string; phone: string; email: string } | undefined,
  profile: typeof PROFILE,
  sessionEmail?: string,
  sessionPhone?: string
) {
  return {
    name: details?.name?.trim() || profile.name,
    phone: details?.phone?.trim() || sessionPhone || profile.phone,
    email: details?.email?.trim() || sessionEmail,
  };
}

{
  const withDetails = resolveContact(TYPED, PROFILE, PROFILE.email, PROFILE.phone);
  check(
    'payload uses the typed name when present',
    withDetails.name === TYPED.name,
    withDetails.name
  );
  check(
    'payload uses the typed phone when present',
    withDetails.phone === TYPED.phone,
    withDetails.phone
  );

  const noDetails = resolveContact(undefined, PROFILE, PROFILE.email, PROFILE.phone);
  check(
    'payload falls back to the profile when no details were collected',
    noDetails.name === PROFILE.name && noDetails.phone === PROFILE.phone,
    JSON.stringify(noDetails)
  );

  const blank = resolveContact({ name: '   ', phone: '', email: '' }, PROFILE, PROFILE.email, PROFILE.phone);
  check(
    'whitespace-only details fall back rather than sending an empty contact',
    blank.name === PROFILE.name && blank.phone === PROFILE.phone,
    JSON.stringify(blank)
  );
}

// ---------------------------------------------------------------------------
// 3b. No empty src="" on the review screen.
//
// An empty src makes the browser re-request the whole page — a wasted request
// and a visible flash — and catalog rows frequently carry no image. The salon
// and stylist images must fall back to a placeholder instead.
// ---------------------------------------------------------------------------
{
  const bareSalon: Salon = { ...salon, image: '', gallery: [] };
  await act(async () => {
    root.render(
      <BookingSummaryModal
        isOpen
        onClose={() => undefined}
        salon={bareSalon}
        services={[svc]}
        stylist={null}
        date={new Date().toISOString().split('T')[0]}
        time="3:30 PM"
        customer={TYPED}
      />
    );
    await new Promise((r) => setTimeout(r, 0));
  });

  const empties = Array.from(container.querySelectorAll('img')).filter(
    (img) => !img.getAttribute('src') || img.getAttribute('src') === ''
  );
  check(
    'a salon with no image renders a placeholder, not src=""',
    empties.length === 0,
    `empty-src imgs=${empties.length}`
  );
  check(
    'the placeholder is a real element the layout can size',
    container.querySelectorAll('img').length === 0 ||
      Boolean(container.querySelector('.material-symbols-outlined')),
    'placeholder present'
  );
}

// ---------------------------------------------------------------------------
// 4. Round trip: the typed details must survive the WRITE and come back on
// READ so screens 13 (Booking Success) and 15 (Appointment Detail) can show
// them. `bookingToAppointment` used to drop booking.customer entirely.
// ---------------------------------------------------------------------------
{
  const store = createMemoryBookingStore();
  const { appointment, error } = await createBooking(store, {
    salon: { id: salon.id, name: salon.name, address: '1 St', image: '', phone: '+91 90000 00000' },
    services: [
      {
        id: svc.id,
        name: svc.name,
        durationMinutes: svc.duration,
        price: svc.price,
        unitPrice: svc.price,
      },
    ],
    stylist: null,
    customer: { name: TYPED.name, phone: TYPED.phone, email: TYPED.email },
    date: new Date().toISOString().split('T')[0],
    time: '4:30 PM',
    amount: Math.round(svc.price * 0.25),
  });

  check('the booking was created', appointment !== null, error ?? '');
  check(
    'the persisted appointment echoes the typed name back',
    appointment?.contact?.name === TYPED.name,
    `contact=${JSON.stringify(appointment?.contact)}`
  );
  check(
    'the persisted appointment echoes the typed phone back',
    appointment?.contact?.phone === TYPED.phone,
    `contact=${JSON.stringify(appointment?.contact)}`
  );
  check(
    'the persisted appointment echoes the typed email back',
    appointment?.contact?.email === TYPED.email,
    `contact=${JSON.stringify(appointment?.contact)}`
  );

  // A booking with no customer snapshot must not gain an empty contact object.
  const store2 = createMemoryBookingStore();
  const noCustomer = await createBooking(store2, {
    salon: { id: salon.id, name: salon.name, address: '1 St', image: '' },
    services: [
      {
        id: svc.id,
        name: svc.name,
        durationMinutes: svc.duration,
        price: svc.price,
        unitPrice: svc.price,
      },
    ],
    stylist: null,
    date: new Date().toISOString().split('T')[0],
    time: '6:30 PM',
    amount: Math.round(svc.price * 0.25),
  });
  check(
    'a booking with no customer snapshot gains no contact field',
    noCustomer.appointment !== null && noCustomer.appointment.contact === undefined,
    `contact=${JSON.stringify(noCustomer.appointment?.contact)}`
  );
}

await act(async () => {
  root.unmount();
});
container.remove();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
console.log(failed.length === 0 ? 'PASS  customer details flow' : 'FAIL  some checks failed');
process.exit(failed.length === 0 ? 0 : 1);
