/**
 * Splash handoff (BUG 12) — driven through the REAL App shell.
 *
 * The original defect was in App.tsx, not in SplashScreen: the splash was
 * mounted via an early return, so the instant `isBooting` flipped false the
 * component unmounted and the splash vanished mid-frame. It faded in but never
 * faded out.
 *
 * `test:services-flow` renders `SplashScreen` in isolation and
 * `test:app-services-routing` only asserts the splash is eventually gone — both
 * pass with the App.tsx fix removed. This suite samples the splash over time
 * instead, so it observes the transition rather than just its endpoints.
 *
 * The discriminating assertion is `data-exiting="true"`: the fixed App keeps
 * the splash mounted through SPLASH_MINIMUM_MS, marks it exiting, crossfades
 * for SPLASH_EXIT_MS, and only then unmounts. A broken App unmounts before the
 * exiting state is ever rendered.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

import {
  SPLASH_EXIT_MS,
  SPLASH_MINIMUM_MS,
} from '../src/components/SplashScreen';

const results: { name: string; pass: boolean; detail?: string }[] = [];
function check(name: string, pass: boolean, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const { AuthProvider } = await import('../src/providers/AuthProvider.tsx');
const App = (await import('../src/App.tsx')).default;

const container = document.createElement('div');
document.body.appendChild(container);
const root = createRoot(container);

const SPLASH_SEL = '[data-testid="nexora-splash"]';

/*
  Error capture must be installed BEFORE the render below. Declared at the
  assertion site it was created after the render and the whole sampling loop had
  already run, nothing ever pushed to it, and `reactErrors.length === 0` was
  unconditionally true — a check that could not fail.
*/
const reactErrors: string[] = [];
const originalConsoleError = console.error;

/*
  The sampling loop below deliberately runs OUTSIDE act() -- React's async act()
  runs no timers until it returns, which would stop the clock and make the
  transition impossible to observe. That design necessarily produces
  "not wrapped in act(...)" warnings, so they are filtered here.

  The filter is narrow on purpose: only that one React harness warning is
  dropped. Anything else -- a real error, a key warning, a lifecycle failure --
  still fails the check.
*/
const ACT_WARNING = /not wrapped in act\(\.\.\.\)/;

console.error = (...args: unknown[]) => {
  const msg = args.map((a) => (typeof a === 'string' ? a : String(a))).join(' ');
  if (!ACT_WARNING.test(msg)) reactErrors.push(msg);
  originalConsoleError(...args);
};

// Mount, then sample the splash at a fine interval. React's async act() runs no
// timers until it returns, so the sampling loop must live OUTSIDE act() and be
// flushed with a final act() call.
await act(async () => {
  root.render(React.createElement(AuthProvider, null, React.createElement(App)));
});

const t0 = Date.now();
const samples: { at: number; present: boolean; exiting: boolean }[] = [];
let gone = false;

const SAMPLE_MS = 16;
const BUDGET_MS = 8000;

while (Date.now() - t0 < BUDGET_MS) {
  const el = container.querySelector(SPLASH_SEL);
  const present = el !== null;
  const exiting = el?.getAttribute('data-exiting') === 'true';
  samples.push({ at: Date.now() - t0, present, exiting });
  if (!present && samples.length > 1) {
    gone = true;
    break;
  }
  await new Promise((r) => setTimeout(r, SAMPLE_MS));
}

await act(async () => {
  await new Promise((r) => setTimeout(r, 50));
});

const firstSeen = samples.find((s) => s.present);
const lastPresent = [...samples].reverse().find((s) => s.present);
const exitedSamples = samples.filter((s) => s.present && s.exiting);

const presentSpan =
  firstSeen && lastPresent ? lastPresent.at - firstSeen.at : 0;

console.log(
  `\n  timeline: firstSeen=${firstSeen?.at ?? 'never'}ms  ` +
    `lastPresent=${lastPresent?.at ?? 'never'}ms  ` +
    `span=${presentSpan}ms  exitingSamples=${exitedSamples.length}  ` +
    `gone=${gone}  (min hold ${SPLASH_MINIMUM_MS}ms, exit ${SPLASH_EXIT_MS}ms)\n`
);

check('the splash mounts during boot', firstSeen !== undefined);

check(
  'the splash unmounts rather than hanging forever',
  gone,
  `gone=${gone}`
);

/*
  The hold. App.tsx stamps SPLASH_MINIMUM_MS from the moment the splash first
  appears, so a correct handoff keeps it on screen for at least that long.
  Allow a little slack for sampler granularity and a slow auth resolve, but a
  splash that vanished on the frame the session resolved is the bug.
*/
check(
  'the splash stays mounted through its minimum hold',
  presentSpan >= SPLASH_MINIMUM_MS - 120,
  `present for ${presentSpan}ms, expected ≥ ${SPLASH_MINIMUM_MS - 120}ms`
);

/*
  The crossfade — this is the check the other two suites are missing. Only an
  App that keeps the splash mounted while marking it `exiting` can ever render
  this state.
*/
check(
  'the splash renders its exiting state before unmounting',
  exitedSamples.length > 0,
  `${exitedSamples.length} sample(s) with data-exiting="true"`
);

check(
  'the exit crossfade lasts roughly SPLASH_EXIT_MS',
  exitedSamples.length === 0 ||
    (() => {
      const span = exitedSamples[exitedSamples.length - 1].at - exitedSamples[0].at;
      // Sampled at 16ms; allow generous slack either side.
      return span >= 0 && span <= SPLASH_EXIT_MS + 400;
    })(),
  exitedSamples.length
    ? `exiting spanned ${
        exitedSamples[exitedSamples.length - 1].at - exitedSamples[0].at
      }ms`
    : 'no exiting samples'
);

// The exiting state must precede unmount, not follow it.
check(
  'the exiting state is observed while the splash is still mounted',
  exitedSamples.every((s) => s.present) &&
    (lastPresent ? exitedSamples.some((s) => s.at <= lastPresent.at) : false),
  'exiting must come before the splash disappears'
);

// App content must be there once the splash is gone.
await act(async () => {
  await new Promise((r) => setTimeout(r, 200));
});
check(
  'app content is rendered after the splash unmounts',
  container.querySelector(SPLASH_SEL) === null &&
    (container.textContent || '').length > 0,
  `splashGone=${container.querySelector(SPLASH_SEL) === null}`
);

// No React error may have escaped during the handoff.
console.error = originalConsoleError;
check(
  'no uncaught error surfaced during the splash handoff',
  reactErrors.length === 0,
  reactErrors.length === 0
    ? 'none'
    : `${reactErrors.length} message(s): ${reactErrors.join(' | ').slice(0, 400)}`
);

await act(async () => {
  root.unmount();
});
container.remove();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error('Failures:', failed.map((f) => f.name).join(', '));
  process.exit(1);
}
process.exit(0);
