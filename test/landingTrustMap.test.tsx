/**
 * Landing page trust/social-proof and Jaipur map sections — QR demo, rewards
 * preview interactivity, transparency cards, testimonial carousel and map
 * filtering/marker/controls behaviour.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

const results: { name: string; pass: boolean; detail?: string }[] = [];
function check(name: string, pass: boolean, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

if (typeof (globalThis as any).IntersectionObserver === 'undefined') {
  (globalThis as any).IntersectionObserver = class {
    observe() {} unobserve() {} disconnect() {} takeRecords() { return []; }
  };
}
if (typeof (globalThis as any).requestAnimationFrame === 'undefined') {
  (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16) as unknown as number;
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
}

const { TrustSocialProofSection, LANDING_TESTIMONIALS } = await import('../src/components/landing/TrustSocialProofSection.tsx');
const { JaipurNetworkMap } = await import('../src/components/landing/JaipurNetworkMap.tsx');
const { getTemplateSalons } = await import('../src/data/templateSalons.ts');

const container = document.createElement('div');
document.body.appendChild(container);
const root = createRoot(container);

const salons = getTemplateSalons();
let opened: string | null = null;

await act(async () => {
  root.render(
    <>
      <TrustSocialProofSection />
      <JaipurNetworkMap salons={salons} onOpenSalon={(s) => { opened = s.id; }} />
    </>
  );
});

const q = (sel: string) => container.querySelector(sel) as HTMLElement | null;
const qa = (sel: string) => Array.from(container.querySelectorAll(sel)) as HTMLElement[];
const click = async (el: HTMLElement | null) => { await act(async () => { el?.click(); }); };

// --- Trust section
check('trust section renders', !!q('[data-testid="trust-social-proof-section"]'));
check('QR demo renders 4 steps', qa('[data-testid^="qr-step-"]').length === 4);
await click(q('[data-testid="qr-step-2"]'));
check('QR step is selectable', q('[data-testid="qr-step-2"]')?.getAttribute('aria-current') === 'step');

check('rewards preview renders', !!q('[data-testid="rewards-preview"]'));
const tierBefore = q('[data-testid="rewards-tier"]')?.textContent;
const slider = q('[data-testid="rewards-preview"] input[type="range"]') as HTMLInputElement;
await act(async () => {
  const setter = Object.getOwnPropertyDescriptor((window as any).HTMLInputElement.prototype, 'value')!.set!;
  setter.call(slider, '24');
  slider.dispatchEvent(new Event('input', { bubbles: true }));
});
const bridal = qa('[data-testid="rewards-preview"] button').find((b) => /Bridal Trial/.test(b.textContent ?? ''));
await click(bridal ?? null);
check('rewards slider updates visits', q('[data-testid="rewards-visits"]')?.textContent === '24');
check('rewards tier upgrades with spend', tierBefore !== q('[data-testid="rewards-tier"]')?.textContent, `${tierBefore} → ${q('[data-testid="rewards-tier"]')?.textContent}`);

check('transparency shows 4 proof cards', qa('[data-testid="proof-card"]').length === 4);

check('testimonial carousel renders', !!q('[data-testid="testimonial-carousel"]'));
const firstQuote = q('[data-testid="testimonial-slide"] blockquote')?.textContent;
await click(q('[data-testid="testimonial-next"]'));
await act(async () => { await new Promise((r) => setTimeout(r, 500)); });
const secondQuote = q('[data-testid="testimonial-slide"] blockquote')?.textContent;
check('testimonial next advances slide', !!secondQuote && secondQuote !== firstQuote && secondQuote.includes(LANDING_TESTIMONIALS[1].quote.slice(0, 20)));
check('testimonial has one dot per entry', qa('[data-testid="testimonial-carousel"] [role="tab"]').length === LANDING_TESTIMONIALS.length);

// --- Map section
check('map section renders', !!q('[data-testid="jaipur-network-map"]'));
check('map renders svg base layer', !!q('[data-testid="map-svg"]'));
const allMarkers = qa('[data-testid^="map-marker-"]').length;
check('map renders one marker per salon', allMarkers === salons.length, `${allMarkers}/${salons.length}`);
check('map has zoom controls', !!q('[data-testid="map-controls"]') && q('[data-testid="map-zoom"]')?.textContent === '1.0×');

await click(q('[aria-label="Zoom in"]'));
check('zoom in increases zoom', q('[data-testid="map-zoom"]')?.textContent === '1.4×', q('[data-testid="map-zoom"]')?.textContent ?? '');
await click(q('[aria-label="Reset map view"]'));
check('reset restores zoom', q('[data-testid="map-zoom"]')?.textContent === '1.0×');

await click(q('[data-testid="map-filter-men"]'));
const menMarkers = qa('[data-testid^="map-marker-"]').length;
check('category filter reduces markers', menMarkers > 0 && menMarkers < allMarkers, `${menMarkers}`);
check('visible count reflects filter', q('[data-testid="map-visible-count"]')?.textContent?.startsWith(`${menMarkers} of`) === true);
await click(q('[data-testid="map-filter-all"]'));

const firstListItem = qa('[data-testid^="map-list-"]')[0];
await click(firstListItem);
check('selecting a salon opens popover', !!q('[data-testid="map-popover"]'));
check('selecting a salon zooms in', q('[data-testid="map-zoom"]')?.textContent === '1.8×');
const details = qa('[data-testid="map-popover"] button').find((b) => b.textContent === 'Details');
await click(details ?? null);
check('popover Details fires onOpenSalon', opened === salons[0].id, `got ${opened}`);

await act(async () => { root.unmount(); });

const failed = results.filter((r) => !r.pass);
if (failed.length) { console.error(`\n${failed.length} check(s) failed`); process.exit(1); }
console.log(`\nAll ${results.length} checks passed`);
