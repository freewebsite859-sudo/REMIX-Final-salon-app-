/**
 * Services Screen (B7), Service Detail Screen (B8) and Splash Screen (A1).
 *
 * These three screens were absent from the customer app entirely: there was no
 * catalog browser, no per-treatment page, and the boot state was a bare line of
 * text on a white viewport. The checks below drive the real components in
 * jsdom and assert the contracts the rest of the app relies on.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

import {
  ServicesScreen,
  buildCatalogServiceEntries,
  formatServiceINR,
  listServiceCategories,
  type CatalogServiceEntry,
} from '../src/components/ServicesScreen';
import { ServiceDetailScreen } from '../src/components/ServiceDetailScreen';
import { SplashScreen } from '../src/components/SplashScreen';
import type { Salon, SalonService, Stylist } from '../src/types';

const results: { name: string; pass: boolean; detail?: string }[] = [];
function check(name: string, pass: boolean, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const cut: SalonService = {
  id: 'svc-cut',
  name: 'Precision Cut & Blowdry',
  category: 'Hair',
  duration: 45,
  price: 1000,
  description: 'Sculpted cut with a salon blowout.',
  popular: true,
};
const balayage: SalonService = {
  id: 'svc-balayage',
  name: 'Balayage Colour',
  category: 'Hair',
  duration: 90,
  price: 2100,
  discountPrice: 1899,
  description: 'Hand-painted highlights.',
};
const facial: SalonService = {
  id: 'svc-facial',
  name: 'Hydra Facial',
  category: 'Skin',
  durationMinutes: 60,
  price: 3200,
  description: 'Deep-cleanse facial.',
};
const cheapCut: SalonService = {
  id: 'svc-cheap-cut',
  name: 'Precision Cut & Blowdry',
  category: 'Hair',
  duration: 30,
  price: 500,
  description: 'Quick cut.',
};

const stylist: Stylist = {
  id: 'sty-1',
  name: 'Riya Kapoor',
  role: 'Senior Stylist',
  avatarUrl: 'https://example.com/riya.jpg',
  assignedServices: ['Precision Cut & Blowdry'],
};

function makeSalon(id: string, name: string, services: SalonService[], stylists: Stylist[] = []): Salon {
  return {
    id,
    name,
    tagline: 'Test',
    categories: ['hair'],
    rating: 4.7,
    reviewCount: 120,
    distance: '1.1 km',
    location: { area: 'Malviya Nagar', city: 'Jaipur', address: '1 St', latitude: 0, longitude: 0 },
    image: '',
    gallery: [],
    isOpen: true,
    openingHours: '9 AM - 9 PM',
    priceRange: '₹₹',
    services,
    stylists,
    reviews: [],
    amenities: [],
    gender: 'unisex',
  };
}

const salonA = makeSalon('salon-a', 'Glam Studio', [cut, balayage, facial], [stylist]);
const salonB = makeSalon('salon-b', 'Budget Barbers', [cheapCut]);
const salons = [salonA, salonB];

// ---------------------------------------------------------------------------
// 1. Catalog flattening (pure logic)
// ---------------------------------------------------------------------------
{
  const entries = buildCatalogServiceEntries(salons);
  check(
    'catalog flattens every salon service into one list',
    entries.length === 4,
    `entries=${entries.length}`
  );
  check(
    'each entry carries its owning salon',
    entries.every((e) => Boolean(e.salon?.id)) &&
      entries.some((e) => e.salon.id === 'salon-a' && e.service.id === 'svc-facial')
  );
  check(
    'a discount price becomes the effective price and the list price',
    (() => {
      const b = entries.find((e) => e.service.id === 'svc-balayage');
      return b?.price === 1899 && b?.listPrice === 2100;
    })(),
    `price=${entries.find((e) => e.service.id === 'svc-balayage')?.price}`
  );
  check(
    'durationMinutes is accepted as an alias for duration',
    entries.find((e) => e.service.id === 'svc-facial')?.durationMinutes === 60,
    `mins=${entries.find((e) => e.service.id === 'svc-facial')?.durationMinutes}`
  );
  check(
    'a duplicated (salon, service) pair renders once',
    buildCatalogServiceEntries([salonA, { ...salonA }]).length === 3,
    `entries=${buildCatalogServiceEntries([salonA, { ...salonA }]).length}`
  );
  check(
    'a service with no id is skipped instead of crashing',
    buildCatalogServiceEntries([
      makeSalon('salon-c', 'Broken', [{ ...cut, id: '' }]),
    ]).length === 0
  );
  check(
    'categories are listed most-populated first',
    listServiceCategories(entries).join(',') === 'Hair,Skin',
    listServiceCategories(entries).join(',')
  );
  check('prices format in Indian style', formatServiceINR(3200) === '₹3,200', formatServiceINR(3200));
}

// ---------------------------------------------------------------------------
// 2. Services Screen
// ---------------------------------------------------------------------------
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

await act(async () => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

function cards(): HTMLElement[] {
  return Array.from(container.querySelectorAll('[data-testid="service-card"]')) as HTMLElement[];
}

let openedService: CatalogServiceEntry | null = null;
let bookedFrom: { salonId: string; serviceId: string } | null = null;

await act(async () => {
  root.render(
    <ServicesScreen
      salons={salons}
      onOpenService={(entry) => {
        openedService = entry;
      }}
      onBookService={(salon, service) => {
        bookedFrom = { salonId: salon.id, serviceId: service.id };
      }}
    />
  );
  await new Promise((r) => setTimeout(r, 0));
});

check(
  'services screen renders every catalog treatment',
  cards().length === 4,
  `cards=${cards().length}`
);
check(
  'services screen reports the catalog size',
  container.textContent?.includes('4 treatments across 2 salons'),
  container.textContent?.slice(0, 120)
);
check(
  'the cheapest same-named cut sorts first',
  cards()[0].dataset.serviceId === 'svc-cheap-cut',
  `first=${cards()[0].dataset.serviceId}`
);

// Category filter
await act(async () => {
  const skinTab = Array.from(container.querySelectorAll('[role="tab"]')).find((b) =>
    b.textContent?.includes('Skin')
  ) as HTMLButtonElement;
  skinTab?.click();
});
check(
  'a category chip narrows the list',
  cards().length === 1 && cards()[0].dataset.serviceId === 'svc-facial',
  `cards=${cards().length}`
);

// Reset and search
await act(async () => {
  const allTab = Array.from(container.querySelectorAll('[role="tab"]')).find(
    (b) => b.textContent === 'All'
  ) as HTMLButtonElement;
  allTab?.click();
  const input = container.querySelector('input[type="search"]') as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
  setter?.call(input, 'balayage');
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
});
check(
  'search narrows to the matching treatment',
  cards().length === 1 && cards()[0].dataset.serviceId === 'svc-balayage',
  `cards=${cards().length}`
);

// Empty state
await act(async () => {
  const input = container.querySelector('input[type="search"]') as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
  setter?.call(input, 'zzzznotarealservice');
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
});
check(
  'an unmatched search shows an empty state, not a blank screen',
  Boolean(container.querySelector('[data-testid="services-empty"]')) && cards().length === 0
);

// Clear filters restores everything
await act(async () => {
  const clearBtn = Array.from(container.querySelectorAll('button')).find((b) =>
    b.textContent?.includes('Clear filters')
  ) as HTMLButtonElement;
  clearBtn?.click();
});
check(
  'clearing filters restores the full catalog',
  cards().length === 4,
  `cards=${cards().length}`
);

// Tapping a card opens the service detail
await act(async () => {
  const titleBtn = cards()
    .find((c) => c.dataset.serviceId === 'svc-facial')
    ?.querySelector('button') as HTMLButtonElement;
  titleBtn?.click();
});
check(
  'tapping a treatment opens its detail screen',
  openedService?.service.id === 'svc-facial' && openedService?.salon.id === 'salon-a',
  `opened=${openedService?.service.id}@${openedService?.salon.id}`
);

// Booking straight from the list
await act(async () => {
  const bookBtn = Array.from(
    cards().find((c) => c.dataset.serviceId === 'svc-facial')?.querySelectorAll('button') || []
  ).find((b) => b.textContent === 'Book') as HTMLButtonElement;
  bookBtn?.click();
});
check(
  'the Book button enters the flow on that salon + service',
  bookedFrom?.salonId === 'salon-a' && bookedFrom?.serviceId === 'svc-facial',
  JSON.stringify(bookedFrom)
);

// ---------------------------------------------------------------------------
// 3. Service Detail Screen
// ---------------------------------------------------------------------------
let bookedDetail: { salonId: string; serviceId: string; stylistId?: string | null } | null = null;
let openedAlternative: string | null = null;

await act(async () => {
  root.render(
    <ServiceDetailScreen
      service={cut}
      salon={salonA}
      alternatives={[{ salon: salonB, service: cheapCut }]}
      onBook={(salon, service, s) => {
        bookedDetail = { salonId: salon.id, serviceId: service.id, stylistId: s?.id ?? null };
      }}
      onOpenAlternative={(salon, service) => {
        openedAlternative = `${salon.id}:${service.id}`;
      }}
    />
  );
  await new Promise((r) => setTimeout(r, 0));
});

const detailText = container.textContent || '';
check('service detail shows the treatment name', detailText.includes('Precision Cut & Blowdry'));
check('service detail shows the category', detailText.includes('Hair'));
check('service detail shows the description', detailText.includes('Sculpted cut with a salon blowout.'));
check('service detail shows the price', detailText.includes('₹1,000'));
check('service detail shows the duration', detailText.includes('45 mins'));
check(
  'service detail shows the 25% advance',
  detailText.includes('₹250 advance'),
  detailText.match(/₹\d[\d,]* advance/)?.[0] ?? 'not found'
);
check('service detail names the offering salon', detailText.includes('Glam Studio'));
check('service detail lists the professionals', detailText.includes('Riya Kapoor'));
check(
  'service detail surfaces comparison alternatives',
  detailText.includes('Compare at other salons') && detailText.includes('Budget Barbers')
);

await act(async () => {
  const cta = Array.from(container.querySelectorAll('button')).find((b) =>
    b.textContent?.includes('Book Appointment')
  ) as HTMLButtonElement;
  cta?.click();
});
check(
  'the Book CTA enters the flow on this exact service',
  bookedDetail?.salonId === 'salon-a' && bookedDetail?.serviceId === 'svc-cut',
  JSON.stringify(bookedDetail)
);

await act(async () => {
  const alt = Array.from(container.querySelectorAll('button')).find((b) =>
    b.textContent?.includes('Budget Barbers')
  ) as HTMLButtonElement;
  alt?.click();
});
check(
  'an alternative row opens that salon’s version of the service',
  openedAlternative === 'salon-b:svc-cheap-cut',
  String(openedAlternative)
);

// A discounted service shows both prices.
await act(async () => {
  root.render(<ServiceDetailScreen service={balayage} salon={salonA} onBook={() => undefined} />);
  await new Promise((r) => setTimeout(r, 0));
});
{
  const t = container.textContent || '';
  check(
    'a discounted service shows the sale and the struck-through list price',
    t.includes('₹1,899') && t.includes('₹2,100'),
    `has1899=${t.includes('₹1,899')} has2100=${t.includes('₹2,100')}`
  );
}

// A service with no description must not render an empty "About" heading.
await act(async () => {
  root.render(
    <ServiceDetailScreen
      service={{ ...cut, description: '' }}
      salon={salonA}
      onBook={() => undefined}
    />
  );
  await new Promise((r) => setTimeout(r, 0));
});
check(
  'a service with no description omits the About section',
  !(container.textContent || '').includes('About this treatment')
);

// ---------------------------------------------------------------------------
// 4. Splash Screen
// ---------------------------------------------------------------------------
await act(async () => {
  root.render(<SplashScreen status="Restoring your secure session…" minimumMs={0} />);
  await new Promise((r) => setTimeout(r, 0));
});
{
  const splash = container.querySelector('[data-testid="nexora-splash"]');
  const t = container.textContent || '';
  check('splash screen renders the branded container', Boolean(splash));
  check('splash screen shows the wordmark', t.includes('NEXORA'));
  check('splash screen shows the status text', t.includes('Restoring your secure session…'));
  check(
    'splash screen exposes a live region for screen readers',
    splash?.getAttribute('role') === 'status' && splash?.getAttribute('aria-live') === 'polite'
  );
  check(
    'splash screen reports a determinate progressbar',
    Boolean(container.querySelector('[role="progressbar"]'))
  );
}

let elapsed = false;
await act(async () => {
  root.render(
    <SplashScreen status="Loading salons near you…" minimumMs={240} onMinimumElapsed={() => { elapsed = true; }} />
  );
});
// The hold is driven by window.setInterval, and React's async `act()` does not
// run timer callbacks while it is open — they are queued until it returns. So
// the wait has to happen OUTSIDE act(), then act() again to flush the state
// update the callback triggers.
await new Promise((r) => setTimeout(r, 500));
await act(async () => {});
check(
  'the splash hold elapses and hands off to the caller',
  elapsed,
  `elapsed=${elapsed}`
);

// ---------------------------------------------------------------------------
// 5. Favourites are scoped per salon.
//
// Regression: ServicesScreen matched favourites on the bare service id, but
// service ids are only unique WITHIN a salon in this catalog. Two salons that
// both offer a service with the same id would show both as saved.
// ---------------------------------------------------------------------------
{
  // salonB deliberately reuses salonA's service id.
  const clashing: SalonService = { ...cut, id: 'svc-cut', name: 'Budget Cut', price: 400 };
  const salonClash = makeSalon('salon-clash', 'Clash Barbers', [clashing]);

  await act(async () => {
    root.render(
      <ServicesScreen
        salons={[salonA, salonClash]}
        savedServiceRefs={[{ salonId: 'salon-a', serviceId: 'svc-cut' }]}
        onOpenService={() => undefined}
        onBookService={() => undefined}
        onToggleSaveService={() => undefined}
      />
    );
    await new Promise((r) => setTimeout(r, 0));
  });

  const rows = cards();
  const fromA = rows.find((c) => c.dataset.serviceId === 'svc-cut' && c.textContent?.includes('Glam Studio'));
  const fromClash = rows.find((c) => c.dataset.serviceId === 'svc-cut' && c.textContent?.includes('Clash Barbers'));

  check(
    'both same-id services from different salons are listed',
    Boolean(fromA) && Boolean(fromClash),
    `a=${Boolean(fromA)} clash=${Boolean(fromClash)}`
  );

  const savedA = fromA?.querySelector('[aria-pressed="true"]');
  const savedClash = fromClash?.querySelector('[aria-pressed="true"]');
  check(
    'only the saved salon shows the service as a favourite',
    Boolean(savedA) && !savedClash,
    `savedAtA=${Boolean(savedA)} savedAtClash=${Boolean(savedClash)}`
  );
}

// Cleanup
await act(async () => {
  root.unmount();
});
container.remove();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
console.log(
  failed.length === 0 ? 'PASS  services + service detail + splash screens' : 'FAIL  some checks failed'
);
process.exit(failed.length === 0 ? 0 : 1);
