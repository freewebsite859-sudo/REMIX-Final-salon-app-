/**
 * Landing page marketing sections — old vs smart comparison, service category
 * showcase grid, and customer benefit cards render with their expected content.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

const results: { name: string; pass: boolean; detail?: string }[] = [];
function check(name: string, pass: boolean, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

// jsdom has no IntersectionObserver; motion's whileInView needs it.
if (typeof (globalThis as any).IntersectionObserver === 'undefined') {
  (globalThis as any).IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  };
}

const { LandingPage } = await import('../src/components/LandingPage.tsx');
const { CATEGORY_TEMPLATES } = await import('../src/categoryTemplates.ts');

const container = document.createElement('div');
document.body.appendChild(container);
const root = createRoot(container);

let lastView: string | null = null;
let lastCategory: string | null = null;

await act(async () => {
  root.render(
    <LandingPage
      setCurrentView={(v) => { lastView = v; }}
      onSelectCategory={(c) => { lastCategory = c; }}
    />
  );
});

const q = (sel: string) => container.querySelector(sel);
const qa = (sel: string) => Array.from(container.querySelectorAll(sel));

check('comparison section renders', !!q('[data-testid="salon-comparison-section"]'));
check('comparison has old + smart halves', !!q('[data-testid="comparison-old"]') && !!q('[data-testid="comparison-smart"]'));
check('comparison lists 6 rows per side',
  q('[data-testid="comparison-old"]')!.querySelectorAll('li').length === 6 &&
  q('[data-testid="comparison-smart"]')!.querySelectorAll('li').length === 6);

check('service showcase renders', !!q('[data-testid="service-category-showcase"]'));
const catCards = qa('[data-testid^="service-category-"]').filter((c) => c.tagName === 'BUTTON');
check('service showcase shows 8 category cards', catCards.length === 8, `got ${catCards.length}`);
check('service cards show INR from-price', catCards.every((c) => /From ₹/.test(c.textContent ?? '')));

check('benefits section renders', !!q('[data-testid="customer-benefits-section"]'));
const benefitCards = qa('[data-testid="benefit-card"]');
check('benefits shows 6 cards', benefitCards.length === 6, `got ${benefitCards.length}`);
check('benefit cards use floating-card effect', benefitCards.every((c) => c.classList.contains('floating-card')));

// Interactions
const firstCatId = Object.keys(CATEGORY_TEMPLATES)[0];
await act(async () => {
  (q(`[data-testid="service-category-${firstCatId}"]`) as HTMLElement).click();
});
check('clicking a service category selects it', lastCategory === firstCatId, `got ${lastCategory}`);

const cta = Array.from(container.querySelectorAll('button')).find((b) => /Make My Salon Smart/.test(b.textContent ?? ''));
await act(async () => { cta?.click(); });
check('comparison CTA navigates to preview', lastView === 'preview', `got ${lastView}`);

await act(async () => { root.unmount(); });

const failed = results.filter((r) => !r.pass);
if (failed.length) {
  console.error(`\n${failed.length} check(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${results.length} checks passed`);
