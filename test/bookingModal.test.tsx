/**
 * BookingModal multi-service selection harness.
 *
 * The service picker used to behave like a locked radio: the first catalog
 * service was pre-selected, every other card appeared un-interactive, and the
 * default could not be removed (toggle guard refused to drop the last item).
 *
 * These checks drive the real BookingModal in jsdom and assert that:
 *   1. exactly one default service is pre-selected when none is passed in
 *   2. clicking any card adds/removes it (checkbox semantics, not radio)
 *   3. the per-card "Add to Booking" / "Remove" toggle works and does not
 *      double-fire when the surrounding card is clickable
 *   4. the floating summary bar always mirrors the live combined Total (₹)
 *      and Total Duration (mins) of every selected service
 *   5. removing every service is allowed and shows a clear "select at least
 *      one" state instead of silently locking the first service
 *   6. an incoming multi-service selection (summary "change date/time"
 *      re-entry) is preserved across modal re-opens
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

import { BookingModal } from '../src/components/BookingModal';
import type { Salon, SalonService } from '../src/types';

const results: { name: string; pass: boolean; detail?: string }[] = [];
function check(name: string, pass: boolean, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const srvHaircut: SalonService = {
  id: 'svc-cut',
  name: 'Precision Cut & Blowdry',
  category: 'hair',
  duration: 45,
  price: 1200,
  discountPrice: 1000,
  description: 'Scissor precision cut with a salon blowdry finish.',
  popular: true,
};
const srvBalayage: SalonService = {
  id: 'svc-balayage',
  name: 'Balayage Highlights',
  category: 'hair',
  duration: 90,
  price: 2600,
  discountPrice: 2100,
  description: 'Hand-painted sun-kissed highlights.',
};
const srvNails: SalonService = {
  id: 'svc-nails',
  name: 'Gel-X Nails',
  category: 'nails',
  duration: 60,
  price: 999,
  description: 'Full set gel extension manicure.',
};

const services = [srvHaircut, srvBalayage, srvNails];

const salon: Salon = {
  id: 'salon-t',
  name: 'Test Glam Studio',
  tagline: 'Test salon',
  categories: ['hair'],
  rating: 4.8,
  reviewCount: 10,
  distance: '0.5 km',
  location: { area: 'Test', city: 'Jaipur', address: '1 Test St', latitude: 0, longitude: 0 },
  image: '',
  gallery: [],
  isOpen: true,
  openingHours: '9 AM - 9 PM',
  priceRange: '₹₹',
  services,
  stylists: [],
  reviews: [],
  amenities: [],
  gender: 'unisex',
};

const todayStr = new Date().toISOString().split('T')[0];

function serviceCards(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('[data-service-id]')) as HTMLElement[];
}

function summaryBar(container: HTMLElement): HTMLElement | null {
  return container.querySelector('#booking-selection-summary-bar');
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let onOpenSummaryCalls: Array<{ services: SalonService[] }>;

function renderModal(props: {
  initialService?: SalonService | null;
  initialServices?: SalonService[] | null;
}) {
  onOpenSummaryCalls = [];
  root.render(
    <BookingModal
      isOpen
      salon={salon}
      initialService={props.initialService ?? null}
      initialServices={props.initialServices ?? null}
      onClose={() => undefined}
      onConfirmBooking={() => undefined}
      onOpenSummary={(draft) => onOpenSummaryCalls.push({ services: draft.services })}
    />
  );
}

async function mount() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------
await mount();

await act(async () => {
  renderModal({});
  await new Promise((r) => setTimeout(r, 0)); // flush reset effect
});

{
  const cards = serviceCards(container);
  check('service cards render for every catalog service', cards.length === 3, `${cards.length} cards`);
  const checked = cards.filter((c) => c.getAttribute('aria-checked') === 'true');
  check(
    'exactly one service pre-selected when modal opens without a pick',
    checked.length === 1 && checked[0].dataset.serviceId === 'svc-cut',
    `selected=${checked.map((c) => c.dataset.serviceId).join(',')}`
  );
  const bar = summaryBar(container);
  const txt = bar?.textContent ?? '';
  check(
    'summary bar shows the default service total (₹1,000 • 45 mins)',
    Boolean(bar) && txt.includes('1 Service Selected') && txt.includes('₹1,000') && txt.includes('45 mins'),
    txt.trim()
  );
}

// Click the balayage card -> 2 selected, totals merge.
await act(async () => {
  const card = serviceCards(container).find((c) => c.dataset.serviceId === 'svc-balayage');
  card?.dispatchEvent(new Event('click', { bubbles: true }));
});

{
  const cards = serviceCards(container);
  const checked = cards.filter((c) => c.getAttribute('aria-checked') === 'true').length;
  const txt = summaryBar(container)?.textContent ?? '';
  check(
    'clicking a second service adds it (2 selected, ₹3,100 • 135 mins)',
    checked === 2 && txt.includes('2 Services Selected') && txt.includes('₹3,100') && txt.includes('135 mins'),
    `checked=${checked} bar="${txt.trim()}"`
  );
}

// "Remove" toggle on a card must remove it without the card click double-firing.
await act(async () => {
  const cards = serviceCards(container);
  const balayage = cards.find((c) => c.dataset.serviceId === 'svc-balayage');
  const removeBtn = balayage?.querySelector('button[aria-label^="Remove"]') as HTMLButtonElement;
  removeBtn?.click();
});

{
  const cards = serviceCards(container);
  const checked = cards.filter((c) => c.getAttribute('aria-checked') === 'true').length;
  const txt = summaryBar(container)?.textContent ?? '';
  check(
    'Remove button drops exactly that service (back to ₹1,000 • 45 mins)',
    checked === 1 && txt.includes('1 Service Selected') && txt.includes('₹1,000') && txt.includes('45 mins'),
    `checked=${checked} bar="${txt.trim()}"`
  );
}

// Unchecking the previously-selected card via its per-card "Remove" toggle.
await act(async () => {
  const cards = serviceCards(container);
  const cut = cards.find((c) => c.dataset.serviceId === 'svc-cut');
  const removeBtn = cut?.querySelector('button[aria-label^="Remove"]') as HTMLButtonElement;
  removeBtn?.click();
});

{
  const cards = serviceCards(container);
  const checked = cards.filter((c) => c.getAttribute('aria-checked') === 'true').length;
  const hint = container.querySelector('#booking-no-services-hint');
  const submit = Array.from(container.querySelectorAll('button[type="submit"]'))[0] as HTMLButtonElement;
  check(
    'last service can be deselected; empty state shows instead of locking the default',
    checked === 0 && Boolean(hint) && submit.disabled,
    `checked=${checked} hint=${Boolean(hint)} submitDisabled=${submit.disabled}`
  );
}

// Re-open with a preserved multi-service selection (summary → change date/time path).
await act(async () => {
  renderModal({ initialServices: [srvBalayage, srvNails] });
  await new Promise((r) => setTimeout(r, 0));
});

{
  const cards = serviceCards(container);
  const checkedIds = cards
    .filter((c) => c.getAttribute('aria-checked') === 'true')
    .map((c) => c.dataset.serviceId)
    .sort();
  const txt = summaryBar(container)?.textContent ?? '';
  check(
    'multi-service selection persists across re-open (balayage + nails = ₹3,099 • 150 mins)',
    checkedIds.join(',') === 'svc-balayage,svc-nails' &&
      txt.includes('2 Services Selected') &&
      txt.includes('₹3,099') &&
      txt.includes('150 mins'),
    `selected=${checkedIds.join(',')} bar="${txt.trim()}"`
  );

  // The "Review Full Appointment Summary" draft must carry every service.
  const reviewBtn = Array.from(container.querySelectorAll('button')).find((b) =>
    b.textContent?.includes('Review Full Appointment Summary')
  ) as HTMLButtonElement;
  await act(async () => {
    reviewBtn?.click();
  });
  check(
    'summary draft receives all selected services (2)',
    onOpenSummaryCalls.length === 1 && onOpenSummaryCalls[0].services.length === 2,
    `drafts=${onOpenSummaryCalls.length} services=${onOpenSummaryCalls[0]?.services.length}`
  );
}

// ---------------------------------------------------------------------------
// Regression: a parent re-render that passes a brand-new instance of IDENTICAL
// seed content must NOT wipe the user's in-progress multi-service selection or
// their step-4 notes (the old reset effect keyed on object identity).
// ---------------------------------------------------------------------------
await act(async () => {
  renderModal({ initialService: { ...srvHaircut } });
  await new Promise((r) => setTimeout(r, 0));
});

await act(async () => {
  serviceCards(container)
    .find((c) => c.dataset.serviceId === 'svc-balayage')
    ?.dispatchEvent(new Event('click', { bubbles: true }));
});

// Type a note, then force a same-content parent re-render (new object refs).
const ta = container.querySelector('textarea') as HTMLTextAreaElement;
{
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
  await act(async () => {
    setter?.call(ta, 'keep my note');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
await act(async () => {
  renderModal({ initialService: { ...srvHaircut } }); // same id, new instance
  await new Promise((r) => setTimeout(r, 0));
});

{
  const cards = serviceCards(container);
  const checkedIds = cards
    .filter((c) => c.getAttribute('aria-checked') === 'true')
    .map((c) => c.dataset.serviceId)
    .sort();
  const txt = summaryBar(container)?.textContent ?? '';
  const noteValue = (container.querySelector('textarea') as HTMLTextAreaElement).value;
  check(
    'same-content parent re-render does not clobber multi-selection or notes',
    checkedIds.join(',') === 'svc-balayage,svc-cut' &&
      txt.includes('₹3,100') &&
      txt.includes('135 mins') &&
      noteValue === 'keep my note',
    `selected=${checkedIds.join(',')} notes="${noteValue}"`
  );
}

// ---------------------------------------------------------------------------
// Regression: duplicate ids inside an incoming multi-service selection must be
// deduped — never double-counted in the totals or rendered twice.
// ---------------------------------------------------------------------------
await act(async () => {
  renderModal({ initialServices: [srvBalayage, { ...srvBalayage }, srvNails] });
  await new Promise((r) => setTimeout(r, 0));
});

{
  const cards = serviceCards(container);
  const checkedIds = cards
    .filter((c) => c.getAttribute('aria-checked') === 'true')
    .map((c) => c.dataset.serviceId)
    .sort();
  const txt = summaryBar(container)?.textContent ?? '';
  check(
    'duplicate service ids in incoming selection are deduped (balayage+nails = ₹3,099 • 150 mins)',
    checkedIds.length === 2 &&
      checkedIds.join(',') === 'svc-balayage,svc-nails' &&
      txt.includes('2 Services Selected') &&
      txt.includes('₹3,099') &&
      txt.includes('150 mins'),
    `selected=${checkedIds.join(',')} bar="${txt.trim()}"`
  );
}

// ---------------------------------------------------------------------------
// Regression: a non-empty incoming selection that belongs to no salon catalog
// service resolves to the explicit zero-selection state — never a silent
// reseed of the first default service.
// ---------------------------------------------------------------------------
await act(async () => {
  renderModal({
    initialServices: [{ ...srvHaircut, id: 'svc-ghost', name: 'Ghost Treatment' }],
  });
  await new Promise((r) => setTimeout(r, 0));
});

{
  const cards = serviceCards(container);
  const checked = cards.filter((c) => c.getAttribute('aria-checked') === 'true').length;
  const hint = container.querySelector('#booking-no-services-hint');
  check(
    'stale incoming selection resolves to explicit empty state (no silent default reseed)',
    checked === 0 && Boolean(hint),
    `checked=${checked} hint=${Boolean(hint)}`
  );
}

// Cleanup
await act(async () => {
  root.unmount();
});
container.remove();

const failed = results.filter((r) => !r.pass);
console.log(failed.length === 0 ? 'PASS  booking modal multi-service behavior' : 'FAIL  some checks failed');
process.exit(failed.length === 0 ? 0 : 1);
