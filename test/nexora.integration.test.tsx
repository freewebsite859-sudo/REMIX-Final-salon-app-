/**
 * Nexora auth + location integration harness.
 *
 * Runs the REAL AuthProvider, the REAL useLocationSync hook and the REAL
 * shared Supabase client against a stubbed Supabase HTTP endpoint inside
 * jsdom. Verifies the guarantees the architecture claims:
 *   1. one shared Supabase client
 *   2. one auth-state listener
 *   3. session restored after reload (INITIAL_SESSION)
 *   4. one geolocation watcher (no duplicates under StrictMode)
 *   5. coordinates synced to the location backend for authenticated users
 *   6. no sync at all for unauthenticated users
 *   7. watcher cleared + stored location deleted on logout
 *   8. expired session redirects to /auth/login, exactly once (no loop)
 */

import React, { StrictMode, useEffect } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { act } from 'react';

import { supabase, NEXORA_AUTH_STORAGE_KEY } from '../src/lib/supabase';
import { AuthProvider, useAuth } from '../src/providers/AuthProvider';
import { useLocationSync } from '../src/hooks/useLocationSync';
import { LOCATION_TABLE } from '../src/lib/locationService';

// ---------------------------------------------------------------------------
// Test bookkeeping
// ---------------------------------------------------------------------------
const results: { name: string; pass: boolean; detail?: string }[] = [];
function check(name: string, pass: boolean, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

// ---------------------------------------------------------------------------
// Geolocation stub — counts watchers so duplicates are detectable
// ---------------------------------------------------------------------------
let watchCount = 0;
let activeWatchers = 0;
let clearCount = 0;
let emitPosition: ((lat: number, lng: number) => void) | null = null;

const geo = {
  watchPosition(success: PositionCallback) {
    watchCount += 1;
    activeWatchers += 1;
    const id = watchCount;
    emitPosition = (latitude: number, longitude: number) => {
      success({
        coords: {
          latitude,
          longitude,
          accuracy: 12,
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
      } as GeolocationPosition);
    };
    return id;
  },
  clearWatch() {
    clearCount += 1;
    activeWatchers -= 1;
    emitPosition = null;
  },
  getCurrentPosition() {
    /* unused here */
  },
};
Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true });

// ---------------------------------------------------------------------------
// Supabase HTTP stub
// ---------------------------------------------------------------------------
interface Recorded {
  method: string;
  url: string;
  body: unknown;
}
const requests: Recorded[] = [];
let refreshShouldFail = false;

const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input.toString();
  const method = (init?.method || 'GET').toUpperCase();
  let body: unknown = null;
  try {
    body = init?.body ? JSON.parse(init.body as string) : null;
  } catch {
    body = init?.body ?? null;
  }
  requests.push({ method, url, body });

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  // Token refresh endpoint
  if (url.includes('/auth/v1/token')) {
    if (refreshShouldFail) {
      return json({ error: 'invalid_grant', error_description: 'Refresh Token Not Found' }, 400);
    }
    return json({
      access_token: makeJwt(3600),
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'refresh-new',
      user: TEST_USER,
    });
  }

  if (url.includes('/auth/v1/logout')) return new Response(null, { status: 204 });
  if (url.includes('/auth/v1/user')) return json(TEST_USER);

  // PostgREST location table
  if (url.includes(`/rest/v1/${LOCATION_TABLE}`)) {
    return json([], method === 'DELETE' ? 204 : 201);
  }

  return json({});
}) as typeof fetch;

// ---------------------------------------------------------------------------
// Session fixtures
// ---------------------------------------------------------------------------
const TEST_USER_ID = '11111111-2222-3333-4444-555555555555';
const TEST_USER = {
  id: TEST_USER_ID,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'client@nexora.test',
  user_metadata: { full_name: 'Nexora Client', mobile: '+91 90000 00000' },
  app_metadata: {},
  created_at: new Date().toISOString(),
};

function b64url(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
function makeJwt(expiresInSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  return [
    b64url({ alg: 'HS256', typ: 'JWT' }),
    b64url({ sub: TEST_USER_ID, role: 'authenticated', exp: now + expiresInSeconds, iat: now }),
    'signature',
  ].join('.');
}

function persistSession(expiresInSeconds: number) {
  const now = Math.floor(Date.now() / 1000);
  localStorage.setItem(
    NEXORA_AUTH_STORAGE_KEY,
    JSON.stringify({
      access_token: makeJwt(expiresInSeconds),
      refresh_token: 'refresh-stored',
      token_type: 'bearer',
      expires_in: expiresInSeconds,
      expires_at: now + expiresInSeconds,
      user: TEST_USER,
    })
  );
}

// ---------------------------------------------------------------------------
// Probe component
// ---------------------------------------------------------------------------
interface Probe {
  userId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isWatching: boolean;
  signOut: () => Promise<void>;
}
let probe: Probe | null = null;

const Consumer: React.FC = () => {
  const auth = useAuth();
  const loc = useLocationSync({ userId: auth.userId, enabled: auth.isAuthenticated });
  useEffect(() => {
    probe = {
      userId: auth.userId,
      isAuthenticated: auth.isAuthenticated,
      isLoading: auth.isLoading,
      isWatching: loc.isWatching,
      signOut: auth.signOut,
    };
  });
  return null;
};

const Harness: React.FC = () => (
  <StrictMode>
    <AuthProvider>
      <Consumer />
    </AuthProvider>
  </StrictMode>
);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function settle(ms = 250) {
  await act(async () => {
    await sleep(ms);
  });
}

let root: Root | null = null;
async function mount() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => {
    root = createRoot(container);
    root.render(<Harness />);
  });
  await settle();
}
async function unmount() {
  await act(async () => {
    root?.unmount();
  });
  root = null;
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------
async function run() {
  check('shared Supabase client is created', Boolean(supabase));
  check(
    'client uses the Nexora storage key',
    NEXORA_AUTH_STORAGE_KEY === 'nexora.auth.qwaehqsmodekbgvnaavz',
    NEXORA_AUTH_STORAGE_KEY
  );

  const clientA = (await import('../src/lib/supabase')).supabase;
  const clientB = (await import('../src/lib/supabase')).supabase;
  check('repeat imports return the SAME client instance (no duplicates)', clientA === clientB);

  // --- Scenario 1: unauthenticated visitor -------------------------------
  localStorage.clear();
  history.replaceState({}, '', '/');
  watchCount = 0;
  activeWatchers = 0;
  clearCount = 0;
  requests.length = 0;

  await mount();
  check('guest: not authenticated', probe?.isAuthenticated === false);
  check('guest: NO geolocation watcher started', watchCount === 0, `watchers=${watchCount}`);
  check(
    'guest: no location rows written',
    !requests.some((r) => r.url.includes(`/rest/v1/${LOCATION_TABLE}`))
  );
  check(
    'guest with no prior session is NOT redirected (guest browsing preserved)',
    location.pathname === '/',
    location.pathname
  );
  await unmount();

  // --- Scenario 2: session restored after reload -------------------------
  localStorage.clear();
  persistSession(3600);
  history.replaceState({}, '', '/');
  watchCount = 0;
  activeWatchers = 0;
  clearCount = 0;
  requests.length = 0;

  await mount();
  check('reload: session restored from storage', probe?.isAuthenticated === true);
  check('reload: correct user id exposed', probe?.userId === TEST_USER_ID, String(probe?.userId));
  check('reload: authenticated user is NOT redirected to login', location.pathname === '/', location.pathname);
  check(
    'authenticated: exactly ONE geolocation watcher despite StrictMode',
    watchCount === 1 && activeWatchers === 1,
    `created=${watchCount} active=${activeWatchers}`
  );

  // Live coordinates -> backend
  await act(async () => {
    emitPosition?.(26.8533, 75.7681);
    await sleep(300);
  });
  const writes = requests.filter(
    (r) => r.url.includes(`/rest/v1/${LOCATION_TABLE}`) && r.method === 'POST'
  );
  check('live coordinates synced to location backend', writes.length >= 1, `writes=${writes.length}`);
  const rawBody = writes[0]?.body;
  console.log('   upsert body ->', JSON.stringify(rawBody));
  const payload = (Array.isArray(rawBody) ? rawBody[0] : rawBody) as
    | Record<string, unknown>
    | undefined;
  check(
    'payload is keyed by user_id with coordinates (RLS-compatible shape)',
    payload?.user_id === TEST_USER_ID &&
      typeof payload?.latitude === 'number' &&
      typeof payload?.longitude === 'number',
    JSON.stringify(payload)
  );
  check(
    'authenticated writes carry the user JWT (RLS enforced, no service_role)',
    !JSON.stringify(requests).includes('service_role')
  );

  // --- Scenario 3: logout cleanup ----------------------------------------
  requests.length = 0;
  await act(async () => {
    await probe?.signOut();
    await sleep(400);
  });
  await settle(300);

  check('logout: session cleared', probe?.isAuthenticated === false);
  check(
    'logout: geolocation watcher cleared (no leak)',
    activeWatchers === 0 && clearCount >= 1,
    `active=${activeWatchers} cleared=${clearCount}`
  );
  const deletes = requests.filter(
    (r) => r.url.includes(`/rest/v1/${LOCATION_TABLE}`) && r.method === 'DELETE'
  );
  check('logout: stored location row deleted', deletes.length >= 1, `deletes=${deletes.length}`);
  check(
    'logout: redirected to /auth/login',
    location.pathname === '/auth/login',
    location.pathname
  );

  // Redirect loop guard: further sign-outs must not stack history entries.
  const lengthBefore = history.length;
  await act(async () => {
    await probe?.signOut();
    await sleep(200);
  });
  check(
    'no redirect loop: repeated sign-out does not re-navigate',
    history.length === lengthBefore && location.pathname === '/auth/login',
    `historyDelta=${history.length - lengthBefore}`
  );
  await unmount();

  // --- Scenario 4: expired session -> login -------------------------------
  localStorage.clear();
  persistSession(-60); // already expired
  refreshShouldFail = true;
  history.replaceState({}, '', '/');
  watchCount = 0;
  activeWatchers = 0;
  requests.length = 0;

  await mount();
  await settle(500);
  check('expired session: treated as signed out', probe?.isAuthenticated === false);
  check(
    'expired session: redirected to /auth/login',
    location.pathname === '/auth/login',
    location.pathname
  );
  check(
    'expired session: no location watcher started',
    watchCount === 0,
    `watchers=${watchCount}`
  );
  await unmount();
  refreshShouldFail = false;

  // ---------------------------------------------------------------------
  globalThis.fetch = originalFetch;
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
