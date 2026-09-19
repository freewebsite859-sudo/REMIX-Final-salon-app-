/**
 * Salon discovery (/customer/salons) and salon detail (/customer/salon/:slug)
 * pages — filtering, sorting, grid/list toggle, favourites, pagination,
 * gallery lightbox, expandable services, staff availability, booking widget,
 * similar salons, and route parsing/aliases.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

const results: { name: string; pass: boolean; detail?: string }[] = [];
function check(name: string, pass: boolean, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}
(window as any).scrollTo = () => {};
if (typeof (globalThis as any).IntersectionObserver === 'undefined') {
  (globalThis as any).IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
}

const { SalonDiscoveryPage, SALONS_PAGE_SIZE } = await import('../src/components/salons/SalonDiscoveryPage.tsx');
const { SalonDetailPage } = await import('../src/components/salons/SalonDetailPage.tsx');
const { DEMO_SALONS } = await import('../src/data/demoCatalog.ts');
const routes = await import('../src/lib/customerRoutes.ts');

// ---------- routes
const r1 = routes.parseCustomerRoute('/customer/salons?q=facial&sort=top_rated&view=list');
check('parse /customer/salons with query/sort/view', r1.kind === 'salons' && r1.query === 'facial' && r1.sort === 'top_rated' && r1.view === 'list');
check('parse /salons alias', routes.parseCustomerRoute('/salons').kind === 'salons');
check('parse /salon/:slug alias', routes.parseCustomerRoute('/salon/glow-studio').salonSlug === 'glow-studio');
check('canonicalize /salons alias', routes.canonicalizeCustomerAlias('/salons?q=spa') === '/customer/salons?q=spa');
check('canonicalize /salon/:slug alias', routes.canonicalizeCustomerAlias('/salon/glow-studio') === '/customer/salon/glow-studio');
check('salons route maps to search tab', routes.customerRouteToTab(r1) === 'search');
check('salons route is public', !routes.isProtectedCustomerRoute(r1));
check('customerSalonsPath builds params', routes.customerSalonsPath({ query: 'nails', sort: 'lowest_price', view: 'list' }) === '/customer/salons?q=nails&sort=lowest_price&view=list');

// ---------- discovery page
const salons = DEMO_SALONS;
const container = document.createElement('div');
document.body.appendChild(container);
const root = createRoot(container);
const q = (sel: string) => container.querySelector(sel) as HTMLElement | null;
const qa = (sel: string) => Array.from(container.querySelectorAll(sel)) as HTMLElement[];
const click = async (el: HTMLElement | null) => { await act(async () => { el?.click(); }); };
const setInput = async (el: HTMLInputElement, value: string) => {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor((window as any).HTMLInputElement.prototype, 'value')!.set!;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const wait = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

let saved: string[] = [];
let opened: string | null = null;
let booked: string | null = null;
let lastState: any = null;
const renderDiscovery = async () => {
  await act(async () => {
    root.render(
      <SalonDiscoveryPage
        salons={salons}
        savedSalonIds={saved}
        onOpenSalon={(s) => { opened = s.id; }}
        onBookSalon={(s) => { booked = s.id; }}
        onToggleSaveSalon={(id) => { saved = saved.includes(id) ? saved.filter((x) => x !== id) : [...saved, id]; }}
        onStateChange={(st) => { lastState = st; }}
      />
    );
  });
};
await renderDiscovery();

check('discovery page renders', !!q('[data-testid="salon-discovery-page"]'));
const cards = () => qa('[data-testid^="salon-card-"]');
check(`first page shows ${SALONS_PAGE_SIZE} cards`, cards().length === Math.min(SALONS_PAGE_SIZE, salons.length), `got ${cards().length}`);
check('result count shows total', q('[data-testid="salons-result-count"]')?.textContent?.includes(String(salons.length)) === true);
check('grid view by default', q('[data-testid="salons-results"]')?.getAttribute('data-view') === 'grid');

await click(q('[data-testid="load-more"]'));
check('load more appends a page', cards().length === Math.min(SALONS_PAGE_SIZE * 2, salons.length), `got ${cards().length}`);

await click(q('[data-testid="view-list"]'));
check('list view toggle', q('[data-testid="salons-results"]')?.getAttribute('data-view') === 'list' && cards()[0].getAttribute('data-layout') === 'list');
check('view persisted to localStorage', window.localStorage.getItem('nexora-salons-view') === 'list');
await click(q('[data-testid="view-grid"]'));

// sort
await click(q('[data-testid="sort-button"]'));
check('sort menu opens', !!q('[data-testid="sort-menu"]'));
await click(q('[data-testid="sort-option-top_rated"]'));
await wait(400);
const ratings = cards().map((c) => parseFloat(c.getAttribute('data-rating') ?? '0'));
check('top rated sort is descending', ratings.every((r, i) => i === 0 || ratings[i - 1] >= r), ratings.slice(0, 5).join(','));
await wait(250);
check('state change reports sort', lastState?.sort === 'top_rated');

await click(q('[data-testid="sort-button"]'));
await click(q('[data-testid="sort-option-lowest_price"]'));
await wait(400);
const prices = cards().map((c) => parseInt(c.getAttribute('data-price') ?? '0', 10));
check('lowest price sort is ascending', prices.every((p, i) => i === 0 || prices[i - 1] <= p), prices.slice(0, 5).join(','));

// favourites
const firstId = cards()[0].getAttribute('data-testid')!.replace('salon-card-', '');
await click(q(`[data-testid="save-salon-${firstId}"]`));
await renderDiscovery();
await wait(400);
check('favourite toggles', saved.includes(firstId) && q(`[data-testid="save-salon-${firstId}"]`)?.getAttribute('aria-pressed') === 'true');
await click(q('[data-testid="favourites-only-toggle"]'));
await wait(400);
check('saved-only shows only favourites', cards().length === 1 && cards()[0].getAttribute('data-testid') === `salon-card-${firstId}`);
await click(q('[data-testid="favourites-only-toggle"]'));

// filters (sidebar is rendered but hidden on small viewports; jsdom still has it)
const all = salons.length;
await click(q('[data-testid="filter-open-now"]'));
const openCount = salons.filter((s) => s.isOpen).length;
check('open-now filter', q('[data-testid="filter-result-count"]')?.textContent?.startsWith(String(openCount)) === true, `${q('[data-testid="filter-result-count"]')?.textContent}`);
await click(q('[data-testid="filter-open-now"]'));

await click(q('[data-testid="category-chip-barber"]'));
const barberCount = parseInt(q('[data-testid="filter-result-count"]')?.textContent ?? '0', 10);
check('category chip narrows results', barberCount > 0 && barberCount < all, `${barberCount}/${all}`);
check('active filter badge counts 1', q('[data-testid="active-filter-count"]')?.textContent === '1');
await click(q('[data-testid="clear-filters"]'));
check('clear filters restores all', parseInt(q('[data-testid="filter-result-count"]')?.textContent ?? '0', 10) === all);

// price slider
const maxInput = q('[data-testid="price-max-input"]') as HTMLInputElement;
await setInput(maxInput, '500');
const under500 = salons.filter((s) => s.services.some((x) => x.price <= 500)).length;
check('price range max filters salons', q('[data-testid="price-max-label"]')?.textContent === '₹500' && parseInt(q('[data-testid="filter-result-count"]')?.textContent ?? '0', 10) === under500, `${q('[data-testid="filter-result-count"]')?.textContent} vs ${under500}`);
await click(q('[data-testid="clear-filters"]'));

// search
const search = q('[data-testid="salons-search-input"]') as HTMLInputElement;
await setInput(search, 'zzzzqqq');
await wait(250);
check('no-match query shows empty state', !!q('[data-testid="salons-empty"]'));
await setInput(search, 'barber');
await wait(250);
check('real-time search narrows', cards().length > 0 && cards().length < all && lastState?.query === 'barber', `${cards().length}`);
await setInput(search, '');
await wait(250);

// mobile drawer
await click(q('[data-testid="open-mobile-filters"]'));
check('mobile filter drawer opens', !!q('[data-testid="mobile-filter-drawer"]'));

// callbacks
await click(cards()[0]);
check('card click opens salon', opened === cards()[0].getAttribute('data-testid')!.replace('salon-card-', ''));
await click(q(`[data-testid="book-salon-${cards()[1].getAttribute('data-testid')!.replace('salon-card-', '')}"]`));
check('book button fires onBook', booked === cards()[1].getAttribute('data-testid')!.replace('salon-card-', ''));

await act(async () => { root.unmount(); });

// ---------- detail page
const detail = salons.find((s) => (s.photoGallery?.length ?? 0) > 0 && s.reviews.length > 3) ?? salons[0];
const c2 = document.createElement('div');
document.body.appendChild(c2);
const root2 = createRoot(c2);
const q2 = (sel: string) => c2.querySelector(sel) as HTMLElement | null;
const qa2 = (sel: string) => Array.from(c2.querySelectorAll(sel)) as HTMLElement[];
let bookArgs: any = null;
let detailSaved = false;
let similarOpened: string | null = null;
const renderDetail = async () => {
  await act(async () => {
    root2.render(
      <SalonDetailPage
        salon={detail}
        allSalons={salons}
        isSaved={detailSaved}
        savedSalonIds={[]}
        onBack={() => {}}
        onToggleSave={() => { detailSaved = !detailSaved; }}
        onBook={(s, srv, st, services) => { bookArgs = { s: s.id, srv: srv?.id, st: st?.id, services: services?.map((x) => x.id) }; }}
        onOpenSalon={(s) => { similarOpened = s.id; }}
      />
    );
  });
};
await renderDetail();

check('detail page renders', q2('[data-testid="salon-detail-page"]')?.getAttribute('data-salon-id') === detail.id);
check('hero + thumbnails render', !!q2('[data-testid="hero-image"]') && qa2('[data-testid="gallery-thumbs"] button').length > 1);
await click(q2('[data-testid="hero-next"]'));
check('hero next changes current thumb', qa2('[data-testid="gallery-thumbs"] button')[1].getAttribute('aria-current') === 'true');

await click(q2('[data-testid="open-gallery"]'));
check('lightbox opens', !!q2('[data-testid="lightbox"]') && q2('[data-testid="lightbox-counter"]')?.textContent?.startsWith('2 /') === true);
await click(q2('[data-testid="lightbox-next"]'));
check('lightbox next advances', q2('[data-testid="lightbox-counter"]')?.textContent?.startsWith('3 /') === true);
await act(async () => { window.dispatchEvent(new (window as any).KeyboardEvent('keydown', { key: 'Escape' })); });
await wait(400);
check('escape closes lightbox', !q2('[data-testid="lightbox"]'));

const svc = detail.services[0];
check('service menu lists all services', qa2('[data-testid^="service-row-"]').length === detail.services.length);
await click(q2(`[data-testid="expand-service-${svc.id}"]`));
check('service description expands', !!q2(`[data-testid="service-desc-${svc.id}"]`));
await click(q2(`[data-testid="add-service-${svc.id}"]`));
check('adding a service updates cart summary', q2('[data-testid="cart-summary"]')?.textContent?.includes('1 selected') === true);

check('staff cards carry availability', qa2('[data-testid^="staff-card-"]').length === detail.stylists.length && qa2('[data-testid^="staff-card-"]').every((c) => ['available', 'busy', 'off'].includes(c.getAttribute('data-availability') ?? '')));
const pickable = qa2('[data-testid^="staff-card-"]').find((c) => c.getAttribute('data-availability') !== 'off');
await click(pickable ?? null);
check('reviews section renders', qa2('[data-testid="reviews-list"] li').length === Math.min(3, detail.reviews.length));
await click(q2('[data-testid="toggle-reviews"]'));
check('show all reviews expands', qa2('[data-testid="reviews-list"] li').length === detail.reviews.length);
check('amenities render', qa2('[data-testid="amenities-list"] li').length === detail.amenities.length);
check('map/directions renders', !!q2('#salon-map-preview') && (q2('#open-google-maps-directions-btn') as HTMLAnchorElement)?.href.includes('google.com/maps'));
check('similar salons render (max 3, excluding self)', qa2('[data-testid="similar-salons"] [data-testid^="salon-card-"]').length === 3 && !q2(`[data-testid="similar-salons"] [data-testid="salon-card-${detail.id}"]`));
check('booking widget + mobile bar render', !!q2('[data-testid="booking-widget"]') && !!q2('[data-testid="mobile-book-bar"]') && qa2('[data-testid="slot-grid"] button').length === 6);

await click(q2('[data-testid="widget-book"]'));
check('widget book passes cart + stylist', bookArgs?.s === detail.id && bookArgs?.services?.[0] === svc.id && (!pickable || bookArgs?.st === pickable.getAttribute('data-testid')!.replace('staff-card-', '')), JSON.stringify(bookArgs));

await click(q2('[data-testid="detail-save"]'));
await renderDetail();
check('detail save toggles', detailSaved && q2('[data-testid="detail-save"]')?.getAttribute('aria-pressed') === 'true');

await click(qa2('[data-testid="similar-salons"] [data-testid^="salon-card-"]')[0]);
check('similar salon click opens it', !!similarOpened && similarOpened !== detail.id);

await act(async () => { root2.unmount(); });

const failed = results.filter((r) => !r.pass);
if (failed.length) { console.error(`\n${failed.length} check(s) failed`); process.exit(1); }
console.log(`\nAll ${results.length} checks passed`);
