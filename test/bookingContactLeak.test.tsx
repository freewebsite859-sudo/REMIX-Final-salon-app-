/**
 * Regression: a booking's Step 5 contact must not leak into the NEXT booking.
 *
 * BUG 15. `bookingCustomerDetails` exists only to survive the review screen's
 * "Change date/time" re-entry, but nothing ever cleared it. So after entering a
 * contact for one appointment, every later booking prefilled that same contact
 * instead of the signed-in profile — and because the fields validate, it could
 * be submitted unnoticed, sending the salon the wrong person's phone number.
 *
 * This drives the REAL App shell with a real (demo) session, because the defect
 * is in App.tsx state management, not in any single component.
 */
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { act } from 'react';

import { supabase } from '../src/lib/supabase.ts';
import { AuthProvider } from '../src/providers/AuthProvider.tsx';
import App from '../src/App.tsx';

const results: { name: string; pass: boolean; detail?: string }[] = [];
function check(name: string, pass: boolean, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const PROFILE = { name: 'Probe User', phone: '+91 11111 11111', email: 'probe@example.com' };
const OTHER = { name: 'Grandma Sharma', phone: '+91 98765 43210', email: 'grandma@example.com' };
const SALON_ID = 'hair_salon';

let root: Root | null = null;
let container: HTMLDivElement;

function setField(id: string, value: string) {
  const input = container.querySelector(`#${id}`) as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
}
function clickText(label: string) {
  return Array.from(container.querySelectorAll('button')).find((b) =>
    b.textContent?.includes(label)
  ) as HTMLButtonElement | undefined;
}
async function settle(maxMs = 6000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 60));
    if (!container.querySelector('[data-testid="nexora-splash"]')) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Establish a real session before mounting, like a returning signed-in user.
// ---------------------------------------------------------------------------
await supabase.auth.signUp({
  email: PROFILE.email,
  password: 'password123',
  options: { data: { full_name: PROFILE.name, role: 'customer' } },
});

await act(async () => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  window.history.replaceState({}, '', '/customer/home');
  root.render(React.createElement(AuthProvider, null, React.createElement(App)));
});
const booted = await settle();
check('the app boots past the splash', booted, `booted=${booted}`);

// First-login location gate: skip it so the real app shell is reachable.
await act(async () => {
  container.querySelector<HTMLButtonElement>('#first-login-location-skip-btn')?.click();
  await new Promise((r) => setTimeout(r, 400));
});

check(
  'the session restored a signed-in customer',
  Boolean(container.querySelector('#header-notifications-btn')),
  `header=${Boolean(container.querySelector('#header-notifications-btn'))} text="${(
    container.textContent || ''
  ).slice(0, 50)}"`
);

// ---------------------------------------------------------------------------
// Booking #1 — enter a contact for someone else, reach the review screen.
// ---------------------------------------------------------------------------
await act(async () => {
  window.history.replaceState({}, '', `/customer/book/${SALON_ID}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
  await new Promise((r) => setTimeout(r, 400));
});
check(
  'booking #1 opened the modal with the Customer Details step',
  Boolean(container.querySelector('#booking-customer-name')),
  'modal open'
);

const firstPrefill = (container.querySelector('#booking-customer-name') as HTMLInputElement)?.value;
check(
  'booking #1 prefills the signed-in profile, not a stranger',
  firstPrefill === PROFILE.name,
  `name="${firstPrefill}" want="${PROFILE.name}"`
);

await act(async () => {
  setField('booking-customer-name', OTHER.name);
  setField('booking-customer-phone', OTHER.phone);
  setField('booking-customer-email', OTHER.email);
});
await act(async () => {
  clickText('Review Full Appointment Summary')?.click();
  await new Promise((r) => setTimeout(r, 200));
});

const reviewText = container.querySelector('[data-testid="review-contact-details"]')?.textContent || '';
check(
  'booking #1 reached the review screen with the typed contact',
  reviewText.includes(OTHER.name),
  reviewText.slice(0, 70)
);

// ---------------------------------------------------------------------------
// Take the "Change date/time" re-entry — the ONLY code path that sets the
// override — then abandon the booking and start booking #2 from scratch.
//
// This is the leak: without clearing the override, #2 prefills Grandma.
// Clicking "Back" instead would never set it, and the test would pass against
// the buggy code too (verified: it did).
// ---------------------------------------------------------------------------
await act(async () => {
  container.querySelector<HTMLButtonElement>('#change-datetime-btn')?.click();
  await new Promise((r) => setTimeout(r, 300));
});

const reentered = Boolean(container.querySelector('#booking-customer-name'));
check(
  '"Change date/time" re-entered the booking modal',
  reentered,
  `open=${reentered}`
);
const carriedName = (container.querySelector('#booking-customer-name') as HTMLInputElement)?.value;
check(
  'the re-entry carries the typed contact back (the feature that needs the override)',
  carriedName === OTHER.name,
  `name="${carriedName}" want="${OTHER.name}"`
);
await act(async () => {
  window.history.replaceState({}, '', '/customer/home');
  window.dispatchEvent(new PopStateEvent('popstate'));
  await new Promise((r) => setTimeout(r, 300));
});

await act(async () => {
  window.history.replaceState({}, '', `/customer/book/${SALON_ID}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
  await new Promise((r) => setTimeout(r, 400));
});

const secondModal = Boolean(container.querySelector('#booking-customer-name'));
check('booking #2 opened the modal', secondModal, `open=${secondModal}`);

const secondName = (container.querySelector('#booking-customer-name') as HTMLInputElement)?.value;
const secondPhone = (container.querySelector('#booking-customer-phone') as HTMLInputElement)?.value;

check(
  'booking #2 prefills the PROFILE, not the previous booking\'s contact',
  secondName === PROFILE.name,
  `name="${secondName}" want="${PROFILE.name}" (leaked="${OTHER.name}")`
);
check(
  'booking #2 does not inherit the previous booking\'s phone',
  secondPhone !== OTHER.phone,
  `phone="${secondPhone}" must not be "${OTHER.phone}"`
);

await act(async () => {
  root?.unmount();
});
container.remove();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
console.log(failed.length === 0 ? 'PASS  booking contact leak' : 'FAIL  some checks failed');
process.exit(failed.length === 0 ? 0 : 1);
