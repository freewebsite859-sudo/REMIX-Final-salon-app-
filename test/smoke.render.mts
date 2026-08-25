/**
 * Mounts the REAL production-built App inside jsdom against the dev server
 * bundle to confirm the Nexora providers do not crash at runtime.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

const errors: string[] = [];
const origError = console.error;
console.error = (...args: unknown[]) => { errors.push(args.map(String).join(' ')); origError(...args); };

const { AuthProvider } = await import('../src/providers/AuthProvider.tsx');
const App = (await import('../src/App.tsx')).default;

const container = document.createElement('div');
document.body.appendChild(container);

await act(async () => {
  createRoot(container).render(
    React.createElement(AuthProvider, null, React.createElement(App))
  );
  await new Promise(r => setTimeout(r, 800));
});

const html = container.innerHTML;
const rendered = html.length > 500;
console.log(`rendered DOM length: ${html.length}`);

const realErrors = errors.filter(e =>
  !e.includes('not wrapped in act') && !e.includes('Warning:')
);
console.log(realErrors.length ? `console errors:\n${realErrors.join('\n')}` : 'no console errors');

const ok = rendered && realErrors.length === 0;
console.log(ok ? 'PASS  App mounts cleanly with Nexora providers' : 'FAIL  App failed to mount cleanly');
process.exit(ok ? 0 : 1);
