/**
 * SmartRecommendations (Home rail) + InteractiveSalonMap fallback.
 * Works with no backend: learning runs locally and the AI call is stubbed.
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

const fetchCalls: string[] = [];
(globalThis as any).fetch = async (url: string, init?: RequestInit) => {
  fetchCalls.push(url);
  if (url === '/api/smart/preferences') return new Response(JSON.stringify({ preferences: JSON.parse(String(init?.body)).preferences, reminders: [] }), { status: 200 });
  if (url === '/api/ai/recommendations') return new Response(JSON.stringify({ source: 'template', headline: 'Picked for you', recommendations: [] }), { status: 200 });
  if (url === '/api/maps/distance') return new Response(JSON.stringify({ configured: false, results: [] }), { status: 200 });
  return new Response('{}', { status: 404 });
};

const { SmartRecommendations } = await import('../src/components/SmartRecommendations.tsx');
const { InteractiveSalonMap } = await import('../src/components/InteractiveSalonMap.tsx');
const { DEMO_SALONS } = await import('../src/data/demoCatalog.ts');
const { addDays, toIsoDate } = await import('../src/lib/smartMemory.ts');

const salon = DEMO_SALONS[0];
const svc = salon.services[0];
const today = toIsoDate(new Date());
const appointments = [addDays(today, -100), addDays(today, -55)].map((date) => ({
  id: `a-${date}`, salonId: salon.id, salonName: salon.name, salonAddress: 'x', salonImage: 'x', services: [svc], date, time: '6:00 PM', status: 'completed' as const, totalPrice: svc.price, bookingRef: `NX-${date}`,
}));

const host = document.createElement('div');
document.body.appendChild(host);
const root = createRoot(host);
let booked: { salon: string; service?: string } | null = null;
let opened: string | null = null;

async function render(props: Partial<React.ComponentProps<typeof SmartRecommendations>> = {}) {
  await act(async () => {
    root.render(
      <SmartRecommendations
        userId="u1" customerName="Priya Sharma" accessToken="tok" salons={DEMO_SALONS} appointments={appointments as any}
        savedSalonIds={[DEMO_SALONS[1].id]} onOpenSalon={(s) => { opened = s.id; }} onBook={(s, sv) => { booked = { salon: s.id, service: sv?.id }; }} {...props}
      />
    );
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
}
const q = (sel: string) => host.querySelector<HTMLElement>(sel);
const qa = (sel: string) => Array.from(host.querySelectorAll<HTMLElement>(sel));

await render();
check('renders a due reminder (45-day cycle, last visit 55d ago)', !!q('[data-testid="smart-reminders"]'));
check('reminder copy is personalised', (q('[data-testid="smart-reminders"]')?.textContent || '').includes('Hi Priya!'));
check('renders recommendation cards', qa('[data-testid="smart-rec-card"]').length >= 2, String(qa('[data-testid="smart-rec-card"]').length));
check('visited salon ranks first', qa('[data-testid="smart-rec-card"]')[0]?.textContent?.includes(salon.name) === true);
check('syncs preferences and asks AI when signed in', fetchCalls.includes('/api/smart/preferences') && fetchCalls.includes('/api/ai/recommendations'));

await act(async () => { qa('[data-testid="smart-reminders"] button').find((b) => b.textContent === 'Book again')?.click(); });
check('"Book again" books the reminder salon/service', booked?.salon === salon.id && booked?.service === svc.id, JSON.stringify(booked));

await act(async () => { qa('[data-testid="smart-rec-card"] button')[0]?.click(); });
check('card opens the salon', opened === salon.id);

await act(async () => { qa('[data-testid="smart-reminders"] button').find((b) => b.textContent === 'Remind me in a week')?.click(); });
await render();
check('snooze hides the reminder and persists locally', !q('[data-testid="smart-reminders"]') && !!localStorage.getItem('nexora-smart-dismissed'));

await act(async () => { root.unmount(); });

// Guest with no history → nothing rendered (no empty section)
const host2 = document.createElement('div'); document.body.appendChild(host2); const root2 = createRoot(host2);
await act(async () => { root2.render(<SmartRecommendations userId="guest" salons={DEMO_SALONS} appointments={[]} savedSalonIds={[]} onOpenSalon={() => {}} onBook={() => {}} />); });
check('no history and no favourites → renders nothing', host2.innerHTML === '');
await act(async () => { root2.unmount(); });

// Map: no browser key → static preview fallback, never a blank map
const host3 = document.createElement('div'); document.body.appendChild(host3); const root3 = createRoot(host3);
await act(async () => { root3.render(<InteractiveSalonMap salon={salon} others={DEMO_SALONS.slice(1, 3)} />); });
check('map falls back to StaticMapPreview without a browser key', !host3.querySelector('[data-testid="interactive-salon-map"]') && host3.textContent!.length > 0);
await act(async () => { root3.unmount(); });

const failed = results.filter((r) => !r.pass);
if (failed.length) { console.error(`\n${failed.length} check(s) failed`); process.exit(1); }
console.log(`\nAll ${results.length} checks passed`);
