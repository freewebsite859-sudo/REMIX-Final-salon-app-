/**
 * Location picker failure-handling harness.
 *
 * The old LocationModal collapsed every geolocation failure — denied, blocked
 * by Permissions Policy, no GPS fix, timeout, unsupported browser — into the
 * single line "Unable to detect location. Please select an area below.", so
 * users had no idea what to do next.
 *
 * These checks drive the real LocationModal in jsdom against a scripted
 * geolocation stub and assert that:
 *   1. each failure mode produces its own actionable instruction
 *   2. a timeout/no-fix retries once with cheaper settings before giving up
 *   3. a permission denial is NOT retried (retrying cannot help)
 *   4. an embedded (iframe) block offers "Open in new tab"
 *   5. manual area selection still works, and no coordinates are ever invented
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { act } from 'react';

import { LocationModal } from '../src/components/LocationModal';

const results: { name: string; pass: boolean; detail?: string }[] = [];
function check(name: string, pass: boolean, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

// ---------------------------------------------------------------------------
// Scripted geolocation stub
// ---------------------------------------------------------------------------
type CallOptions = PositionOptions | undefined;
interface Attempt {
  options: CallOptions;
}

let calls: Attempt[] = [];
/** Queue of outcomes; each entry is consumed by one getCurrentPosition call. */
let script: Array<
  | { kind: 'success'; latitude: number; longitude: number; accuracy?: number }
  | { kind: 'error'; code: number; message: string }
> = [];

function makePosition(latitude: number, longitude: number, accuracy = 8): GeolocationPosition {
  return {
    coords: {
      latitude,
      longitude,
      accuracy,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      toJSON() {
        return {};
      },
    },
    timestamp: Date.now(),
    toJSON() {
      return {};
    },
  } as GeolocationPosition;
}

function makeError(code: number, message: string): GeolocationPositionError {
  const err = new Error(message) as Error & { code: number };
  err.code = code;
  return err as unknown as GeolocationPositionError;
}

const geolocation = {
  getCurrentPosition(
    success: PositionCallback,
    error?: PositionErrorCallback | null,
    options?: PositionOptions
  ) {
    calls.push({ options });
    const next = script.shift();
    if (!next) {
      error?.(makeError(2, 'No scripted outcome left'));
      return;
    }
    if (next.kind === 'success') {
      success(makePosition(next.latitude, next.longitude, next.accuracy));
    } else {
      error?.(makeError(next.code, next.message));
    }
  },
  watchPosition() {
    return 1;
  },
  clearWatch() {
    /* no-op */
  },
};

Object.defineProperty(navigator, 'geolocation', {
  value: geolocation,
  configurable: true,
  writable: true,
});
// jsdom has no Permissions API by default — the modal must cope without it.
Object.defineProperty(navigator, 'permissions', { value: undefined, configurable: true });

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------
let container: HTMLDivElement | null = null;
let root: Root | null = null;
let selections: { area: string; lat?: number; lng?: number }[] = [];
let closed = 0;

async function openModal() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  selections = [];
  closed = 0;
  await act(async () => {
    root!.render(
      <LocationModal
        isOpen
        onClose={() => {
          closed += 1;
        }}
        currentLocation="Mansarovar, Jaipur"
        onSelectLocation={(area, lat, lng) => selections.push({ area, lat, lng })}
      />
    );
  });
}

async function unmount() {
  if (!root) return;
  await act(async () => {
    root!.unmount();
  });
  container?.remove();
  root = null;
  container = null;
}

const byId = (id: string) => document.getElementById(id);
const errorText = () => byId('location-error-message')?.textContent ?? '';
const bodyText = () => document.body.textContent ?? '';

async function clickDetect() {
  const button = byId('detect-gps-button') as HTMLButtonElement | null;
  if (!button) return false;
  await act(async () => {
    button.click();
    await new Promise((r) => setTimeout(r, 0));
  });
  return true;
}

let realWindow: unknown = null;
/**
 * `window.top` is [LegacyUnforgeable] in jsdom, so it cannot be redefined.
 * Swapping the global `window` for a Proxy that reports a different `top` is
 * the only faithful way to simulate "this app is inside an iframe".
 */
function setEmbedded(isEmbedded: boolean) {
  realWindow ||= globalThis.window;
  if (!isEmbedded) {
    (globalThis as { window?: unknown }).window = realWindow;
    return;
  }
  const target = realWindow as Record<string | symbol, unknown>;
  const proxy = new Proxy(target, {
    get(obj, prop) {
      if (prop === 'top') return { fakeEmbeddedParent: true };
      const value = Reflect.get(obj, prop);
      return typeof value === 'function' ? value.bind(obj) : value;
    },
  });
  (globalThis as { window?: unknown }).window = proxy;
}

function setSecureContext(isSecure: boolean) {
  Object.defineProperty(window, 'isSecureContext', {
    value: isSecure,
    configurable: true,
    writable: true,
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function settle(ms = 30) {
  await act(async () => {
    await sleep(ms);
  });
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------
async function run() {
  setEmbedded(false);
  setSecureContext(true);

  // -------------------------------------------------------------------
  // 1. Successful fix → coordinates selected in the shared label format
  // -------------------------------------------------------------------
  calls = [];
  script = [{ kind: 'success', latitude: 26.91243, longitude: 75.80351 }];
  await openModal();
  await clickDetect();
  await settle();
  check('success: location selected', selections.length === 1, JSON.stringify(selections));
  check(
    'success: label uses the shared coordinate format',
    selections[0]?.area === 'Current Location (26.912, 75.804)',
    selections[0]?.area
  );
  check('success: modal closed', closed === 1, `closed=${closed}`);
  check('success: no error panel', byId('location-error') === null);
  await unmount();

  // -------------------------------------------------------------------
  // 2. Timeout → retries once with cheaper settings, then reports timeout
  // -------------------------------------------------------------------
  calls = [];
  script = [
    { kind: 'error', code: 3, message: 'Timeout expired' },
    { kind: 'error', code: 3, message: 'Timeout expired' },
  ];
  await openModal();
  await clickDetect();
  await settle();
  check('timeout: retried once', calls.length === 2, `calls=${calls.length}`);
  check(
    'timeout: first pass asks for high accuracy',
    calls[0]?.options?.enableHighAccuracy === true
  );
  check(
    'timeout: retry drops to low accuracy (Wi-Fi / cell)',
    calls[1]?.options?.enableHighAccuracy === false,
    JSON.stringify(calls[1]?.options)
  );
  check('timeout: message names the timeout', /No GPS fix in \d+s/.test(errorText()), errorText());
  check('timeout: offers a retry', byId('location-retry-button') !== null);
  check('timeout: no location was invented', selections.length === 0);
  await unmount();

  // -------------------------------------------------------------------
  // 3. Timeout then a coarse fix succeeds on the retry
  // -------------------------------------------------------------------
  calls = [];
  script = [
    { kind: 'error', code: 3, message: 'Timeout expired' },
    { kind: 'success', latitude: 26.8533, longitude: 75.7681 },
  ];
  await openModal();
  await clickDetect();
  await settle();
  check(
    'retry: coarse fix is accepted',
    selections[0]?.area === 'Current Location (26.853, 75.768)',
    selections[0]?.area
  );
  check('retry: no error shown after recovery', byId('location-error') === null);
  await unmount();

  // -------------------------------------------------------------------
  // 4. Permission denied → actionable guidance, and NO pointless retry
  // -------------------------------------------------------------------
  calls = [];
  script = [{ kind: 'error', code: 1, message: 'User denied Geolocation' }];
  await openModal();
  await clickDetect();
  await settle();
  check('denied: exactly one attempt (retry cannot help)', calls.length === 1, `calls=${calls.length}`);
  check(
    'denied: tells the user how to allow it',
    /Allow Location/i.test(errorText()),
    errorText()
  );
  check('denied: no "open in new tab" when not embedded', byId('location-open-new-tab-button') === null);
  check('denied: still explains the manual fallback', /select an area below/i.test(errorText()));
  await unmount();

  // -------------------------------------------------------------------
  // 5. Blocked by Permissions Policy inside an embedded preview frame
  // -------------------------------------------------------------------
  calls = [];
  script = [
    { kind: 'error', code: 1, message: 'Geolocation has been disabled in this document by Permissions Policy.' },
  ];
  setEmbedded(true);
  await openModal();
  await clickDetect();
  await settle();
  check('blocked: classified as a frame block', /embedded/i.test(errorText()), errorText());
  check('blocked: offers "Open in new tab"', byId('location-open-new-tab-button') !== null);
  await unmount();

  // -------------------------------------------------------------------
  // 6. Denied while embedded → both remedies are offered
  // -------------------------------------------------------------------
  calls = [];
  script = [{ kind: 'error', code: 1, message: 'User denied Geolocation' }];
  await openModal();
  await clickDetect();
  await settle();
  check(
    'embedded + denied: mentions the new-tab workaround',
    /new tab/i.test(errorText()),
    errorText()
  );
  check('embedded + denied: retry offered', byId('location-retry-button') !== null);
  await unmount();
  setEmbedded(false);

  // -------------------------------------------------------------------
  // 7. No fix available (POSITION_UNAVAILABLE)
  // -------------------------------------------------------------------
  calls = [];
  script = [
    { kind: 'error', code: 2, message: 'Network location provider unavailable' },
    { kind: 'error', code: 2, message: 'Network location provider unavailable' },
  ];
  await openModal();
  await clickDetect();
  await settle();
  check(
    'unavailable: explains the signal problem',
    /could not determine a position/i.test(errorText()),
    errorText()
  );
  check('unavailable: keeps the browser diagnostic', /Network location provider/.test(bodyText()));
  await unmount();

  // -------------------------------------------------------------------
  // 8. Unsupported browser / insecure origin → no dead-end button
  // -------------------------------------------------------------------
  Object.defineProperty(navigator, 'geolocation', {
    value: undefined,
    configurable: true,
    writable: true,
  });
  await openModal();
  await clickDetect();
  await settle();
  check(
    'unsupported: says the browser lacks support',
    /does not support location sharing/i.test(errorText()),
    errorText()
  );
  check(
    'unsupported: detect button disabled so it is not a dead end',
    (byId('detect-gps-button') as HTMLButtonElement | null)?.disabled === true
  );
  await unmount();
  Object.defineProperty(navigator, 'geolocation', {
    value: geolocation,
    configurable: true,
    writable: true,
  });

  // -------------------------------------------------------------------
  // 9. Manual selection still works and carries real coordinates
  // -------------------------------------------------------------------
  calls = [];
  script = [];
  await openModal();
  const areaButtons = Array.from(document.querySelectorAll('button')).filter((b) =>
    (b.textContent || '').includes('C-Scheme')
  );
  await act(async () => {
    (areaButtons[0] as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 0));
  });
  check('manual: area selected', selections[0]?.area === 'C-Scheme, Jaipur', selections[0]?.area);
  check('manual: real coordinates passed through', selections[0]?.lat === 26.9124);
  check('manual: modal closed', closed === 1, `closed=${closed}`);
  check('manual: no geolocation call was needed', calls.length === 0);
  await unmount();

  // -------------------------------------------------------------------
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log('FAILED:');
    for (const f of failed) console.log(`  - ${f.name} ${f.detail}`);
    process.exit(1);
  }
  process.exit(0);
}

run().catch((err) => {
  console.error('Harness crashed:', err);
  process.exit(1);
});
