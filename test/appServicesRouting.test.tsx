/**
 * App-level routing for the Services (B7) and Service Detail (B8) screens.
 *
 * The component tests render those screens in isolation; this drives the REAL
 * App shell and asserts the /customer/services and /customer/service/:id routes
 * actually reach them — i.e. that the App.tsx wiring, not just the components,
 * is correct.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

const errors: string[] = [];
const origError = console.error;
console.error = (...args: unknown[]) => {
  errors.push(args.map(String).join(' '));
  origError(...args);
};

const { AuthProvider } = await import('../src/providers/AuthProvider.tsx');
const App = (await import('../src/App.tsx')).default;

const results: { name: string; pass: boolean; detail?: string }[] = [];
function check(name: string, pass: boolean, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const container = document.createElement('div');
document.body.appendChild(container);
const root = createRoot(container);

function go(path: string) {
  window.history.replaceState({ nexoraCustomer: true }, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

async function mount() {
  await act(async () => {
    root.render(React.createElement(AuthProvider, null, React.createElement(App)));
    await new Promise((r) => setTimeout(r, 600));
  });
}

await mount();

// 1. Services Screen is reachable through the real App shell.
await act(async () => {
  go('/customer/services');
  await new Promise((r) => setTimeout(r, 300));
});
check(
  'App renders the Services Screen at /customer/services',
  Boolean(container.querySelector('[data-testid="services-screen"]')),
  `found=${Boolean(container.querySelector('[data-testid="services-screen"]'))}`
);
check(
  'Services Screen lists real catalog treatments',
  (container.querySelectorAll('[data-testid="service-card"]') || []).length > 0,
  `cards=${container.querySelectorAll('[data-testid="service-card"]').length}`
);

// 2. Service Detail is reachable for a service that exists in the catalog.
const firstCard = container.querySelector('[data-testid="service-card"]') as HTMLElement | null;
const serviceId = firstCard?.dataset.serviceId;
check('a catalog service id was available to open', Boolean(serviceId), String(serviceId));

await act(async () => {
  go(`/customer/service/${encodeURIComponent(serviceId || '')}`);
  await new Promise((r) => setTimeout(r, 300));
});
check(
  'App renders the Service Detail Screen at /customer/service/:id',
  Boolean(container.querySelector('[data-testid="service-detail-screen"]')),
  `found=${Boolean(container.querySelector('[data-testid="service-detail-screen"]'))}`
);

// 3. An unknown service id shows the not-found state, never a crash.
await act(async () => {
  go('/customer/service/does-not-exist-xyz');
  await new Promise((r) => setTimeout(r, 300));
});
check(
  'an unknown service id shows a not-found state instead of crashing',
  (container.textContent || '').includes('no longer listed'),
  (container.textContent || '').slice(0, 90)
);

// 4. The Search tab exposes the entry point to the Services Screen.
await act(async () => {
  go('/customer/search');
  await new Promise((r) => setTimeout(r, 300));
});
check(
  'the Search tab exposes the "Browse all services" entry point',
  Boolean(container.querySelector('#browse-all-services'))
);

const realErrors = errors.filter((e) => !e.includes('not wrapped in act') && !e.includes('Warning:'));
check('no unexpected console errors during routing', realErrors.length === 0, realErrors[0] || '');

await act(async () => {
  root.unmount();
});
container.remove();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
console.log(failed.length === 0 ? 'PASS  app services routing' : 'FAIL  some checks failed');
process.exit(failed.length === 0 ? 0 : 1);
