/**
 * Nexora referral signup flow — integration harness.
 *
 * Runs the REAL <App/>, the REAL <AuthPage/> and the REAL referralService
 * against a stubbed Supabase HTTP endpoint inside jsdom, and verifies the
 * acceptance criteria of the referral feature:
 *
 *   TEST A  referral link opens Signup with the code pre-filled
 *   TEST B  normal signup — referral optional, signup still works
 *   TEST C  customer referral signup persists the relationship
 *   TEST D  salon-owner referral signup persists the relationship
 *   TEST E  refresh keeps the referral code
 *   TEST F  Login → back to Signup keeps the referral code
 *   TEST G  invalid referral is rejected and blocks signup
 *   TEST H  duplicate referral never overwrites the first one
 *   TEST I  self-referral is rejected
 *   TEST J  logging in never creates a referral relationship
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { act } from 'react';

// ---------------------------------------------------------------------------
// Bookkeeping
// ---------------------------------------------------------------------------
const results: { name: string; pass: boolean; detail?: string }[] = [];
function check(name: string, pass: boolean, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const REFERRER_ID = 'aaaaaaaa-1111-2222-3333-444444444444';
const NEW_CUSTOMER_ID = 'bbbbbbbb-1111-2222-3333-444444444444';
const NEW_OWNER_ID = 'cccccccc-1111-2222-3333-444444444444';
const VALID_CODE = 'ABC123';
const INACTIVE_CODE = 'OLDCODE9';

/** In-memory stand-in for the Supabase referral backend. */
const db = {
  codes: new Map<string, { userId: string; active: boolean }>([
    [VALID_CODE, { userId: REFERRER_ID, active: true }],
    [INACTIVE_CODE, { userId: REFERRER_ID, active: false }],
  ]),
  referrals: new Map<string, { referrerUserId: string; code: string }>(),
  profiles: [] as Record<string, unknown>[],
  /** Flip to false to simulate a project without the referral RPCs. */
  rpcEnabled: true,
  /** Which user id the current JWT belongs to (drives apply_referral). */
  currentUserId: null as string | null,
};

interface Recorded {
  method: string;
  url: string;
  body: unknown;
}
const requests: Recorded[] = [];

function b64url(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
function makeJwt(userId: string, expiresInSeconds = 3600): string {
  const now = Math.floor(Date.now() / 1000);
  return [
    b64url({ alg: 'HS256', typ: 'JWT' }),
    b64url({ sub: userId, role: 'authenticated', exp: now + expiresInSeconds, iat: now }),
    'signature',
  ].join('.');
}

let nextSignupUserId = NEW_CUSTOMER_ID;

function sessionPayload(userId: string, email: string) {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: makeJwt(userId),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: 'refresh-token',
    user: {
      id: userId,
      aud: 'authenticated',
      role: 'authenticated',
      email,
      created_at: new Date().toISOString(),
      user_metadata: {},
      app_metadata: {},
    },
  };
}

// ---------------------------------------------------------------------------
// Supabase HTTP stub
// ---------------------------------------------------------------------------
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

  // ---- Auth ---------------------------------------------------------------
  if (url.includes('/auth/v1/signup')) {
    const payload = (body ?? {}) as { email?: string };
    db.currentUserId = nextSignupUserId;
    return json(sessionPayload(nextSignupUserId, payload.email || 'new@nexora.test'), 200);
  }
  if (url.includes('/auth/v1/token')) {
    return json(sessionPayload(REFERRER_ID, 'existing@nexora.test'));
  }
  if (url.includes('/auth/v1/logout')) return new Response(null, { status: 204 });
  if (url.includes('/auth/v1/user')) {
    return json(sessionPayload(db.currentUserId || REFERRER_ID, 'user@nexora.test').user);
  }

  // ---- RPCs ---------------------------------------------------------------
  if (url.includes('/rest/v1/rpc/validate_referral_code')) {
    if (!db.rpcEnabled) return json({ code: '42883', message: 'Could not find the function' }, 404);
    const code = String(((body ?? {}) as { p_code?: string }).p_code || '').toUpperCase();
    const row = db.codes.get(code);
    if (!row) return json([{ status: 'invalid', referrer_user_id: null }]);
    if (!row.active) return json([{ status: 'inactive', referrer_user_id: null }]);
    return json([{ status: 'valid', referrer_user_id: row.userId }]);
  }

  if (url.includes('/rest/v1/rpc/apply_referral')) {
    if (!db.rpcEnabled) return json({ code: '42883', message: 'Could not find the function' }, 404);
    const code = String(((body ?? {}) as { p_code?: string }).p_code || '').toUpperCase();
    const uid = db.currentUserId;
    if (!uid) return json({ code: '42501', message: 'not_authenticated' }, 401);
    if (db.referrals.has(uid)) return json([{ status: 'already_referred' }]);
    const row = db.codes.get(code);
    if (!row) return json([{ status: 'invalid' }]);
    if (!row.active) return json([{ status: 'inactive' }]);
    if (row.userId === uid) return json([{ status: 'self_referral' }]);
    db.referrals.set(uid, { referrerUserId: row.userId, code });
    return json([{ status: 'created' }]);
  }

  if (url.includes('/rest/v1/rpc/ensure_referral_code')) {
    if (!db.rpcEnabled) return json({ code: '42883', message: 'Could not find the function' }, 404);
    return json(`NX${(db.currentUserId || 'user').slice(0, 6).toUpperCase()}`);
  }

  // ---- PostgREST tables ---------------------------------------------------
  if (url.includes('/rest/v1/profiles')) {
    db.profiles.push((Array.isArray(body) ? body[0] : body) as Record<string, unknown>);
    return json([], 201);
  }

  if (url.includes('/rest/v1/referrals')) {
    if (method === 'GET') {
      const match = url.match(/referred_user_id=eq\.([0-9a-f-]+)/i);
      const uid = match?.[1];
      const row = uid ? db.referrals.get(uid) : undefined;
      return json(
        row ? [{ referrer_user_id: row.referrerUserId, referral_code: row.code }] : []
      );
    }
    const payload = (Array.isArray(body) ? body[0] : body) as Record<string, unknown>;
    const uid = String(payload?.referred_user_id || '');
    if (db.referrals.has(uid)) return json([]); // ignoreDuplicates → nothing written
    const code = String(payload?.referral_code || '').toUpperCase();
    const row = db.codes.get(code);
    if (!row) {
      return json({ code: 'P0002', message: 'invalid_referral_code' }, 400);
    }
    if (row.userId === uid) {
      return json({ code: 'P0002', message: 'self_referral_not_allowed' }, 400);
    }
    db.referrals.set(uid, { referrerUserId: row.userId, code });
    return json([{ id: 'referral-1' }], 201);
  }

  return json([]);
}) as typeof fetch;

// Geolocation stub so the location hook stays quiet.
Object.defineProperty(navigator, 'geolocation', {
  value: { watchPosition: () => 1, clearWatch: () => undefined, getCurrentPosition: () => undefined },
  configurable: true,
});

// ---------------------------------------------------------------------------
// Modules under test (imported AFTER the fetch stub is installed)
// ---------------------------------------------------------------------------
const { AuthProvider } = await import('../src/providers/AuthProvider');
const App = (await import('../src/App')).default;
const referral = await import('../src/lib/referralService');

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function settle(ms = 300) {
  await act(async () => {
    await sleep(ms);
  });
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function mount() {
  container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => {
    root = createRoot(container!);
    root!.render(
      React.createElement(AuthProvider, null, React.createElement(App))
    );
  });
  await settle(900);
}

async function unmount() {
  await act(async () => {
    root?.unmount();
  });
  root = null;
  container?.remove();
  container = null;
}

function byId(id: string): HTMLElement | null {
  return document.getElementById(id);
}
function inputById(id: string): HTMLInputElement | null {
  return document.getElementById(id) as HTMLInputElement | null;
}
function bodyText(): string {
  return document.body.textContent || '';
}
function setInput(el: HTMLInputElement | null, value: string) {
  if (!el) throw new Error(`input missing: ${el}`);
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
  setter.call(el, value);
  el.dispatchEvent(new window.Event('input', { bubbles: true }));
}
function click(el: Element | null) {
  if (!el) throw new Error('element missing for click');
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
}
function buttonByText(label: string): HTMLButtonElement | null {
  return (
    Array.from(document.querySelectorAll('button')).find((b) =>
      (b.textContent || '').includes(label)
    ) as HTMLButtonElement | undefined
  ) ?? null;
}

function resetStorage() {
  localStorage.clear();
  sessionStorage.clear();
}
function goto(path: string) {
  history.replaceState({}, '', path);
}
const callsTo = (fragment: string) => requests.filter((r) => r.url.includes(fragment));

async function fillSignupForm(options: { role?: 'customer' | 'salon_owner'; email?: string } = {}) {
  setInput(inputById('signup-fullname'), 'Test Invitee');
  setInput(inputById('signup-mobile'), '+91 90000 12345');
  setInput(inputById('auth-email'), options.email || 'invitee@nexora.test');
  setInput(inputById('auth-password'), 'StrongPass123!');
  setInput(inputById('signup-confirm-password'), 'StrongPass123!');
  if (options.role === 'salon_owner') {
    await act(async () => {
      click(buttonByText('Salon Owner'));
    });
  }
  await settle(120);
}

async function submitForm() {
  await act(async () => {
    click(byId('auth-submit-button'));
    await sleep(700);
  });
  await settle(300);
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------
async function run() {
  // =========================================================================
  // TEST A — referral link opens Signup with the code pre-filled
  // =========================================================================
  resetStorage();
  db.referrals.clear();
  db.profiles.length = 0;
  requests.length = 0;
  goto('/?ref=ABC123');
  await mount();

  check('A: /?ref=ABC123 opens the signup screen', location.pathname === '/auth/signup', location.pathname);
  check('A: signup tab is active (Full Name field rendered)', Boolean(byId('signup-fullname')));
  check('A: Referral Code field is rendered', Boolean(inputById('signup-referral-code')));
  check('A: referral code auto-filled from the link', inputById('signup-referral-code')?.value === VALID_CODE, String(inputById('signup-referral-code')?.value));
  await settle(700);
  check('A: database-verified code shows as applied', bodyText().includes('Referral code applied'));
  check('A: helper explains the code came from the invite link', bodyText().includes('invite link'));
  check('A: visible URL cleaned after capture', location.search === '', location.search);
  check('A: referral context stored for the session', referral.getStoredReferralCode() === VALID_CODE);
  check('A: link uses only the public code (no tokens/uuids)', !location.href.includes(REFERRER_ID));

  // =========================================================================
  // TEST F — Login → back to Signup keeps the referral code
  // =========================================================================
  await act(async () => {
    click(byId('toggle-login-mode'));
  });
  await settle(200);
  check('F: login mode hides the referral field', !byId('signup-referral-code'));
  await act(async () => {
    click(byId('toggle-signup-mode'));
  });
  await settle(200);
  check('F: referral code survives the login detour', inputById('signup-referral-code')?.value === VALID_CODE, String(inputById('signup-referral-code')?.value));

  // =========================================================================
  // TEST E — refresh keeps the referral code
  // =========================================================================
  await unmount();
  goto('/auth/signup'); // URL as left after cleanup — simulates a page refresh
  await mount();
  check('E: referral code still available after refresh', inputById('signup-referral-code')?.value === VALID_CODE, String(inputById('signup-referral-code')?.value));
  await unmount();

  // =========================================================================
  // TEST G — invalid referral is rejected and blocks signup
  // =========================================================================
  resetStorage();
  requests.length = 0;
  goto('/auth/signup?ref=INVALID99');
  await mount();
  await settle(700);
  check('G: invalid code reported to the user', bodyText().includes('Referral code is invalid.'));
  await fillSignupForm();
  await submitForm();
  check('G: signup blocked while the referral code is invalid', callsTo('/auth/v1/signup').length === 0, `signups=${callsTo('/auth/v1/signup').length}`);
  check('G: no referral relationship written', callsTo('/rest/v1/rpc/apply_referral').length === 0);

  await act(async () => {
    click(byId('continue-without-referral-btn'));
  });
  await settle(200);
  check('G: user can remove the code and continue', inputById('signup-referral-code')?.value === '');
  await submitForm();
  check('G: signup succeeds without a referral', callsTo('/auth/v1/signup').length === 1, `signups=${callsTo('/auth/v1/signup').length}`);
  check('G: still no referral relationship written', callsTo('/rest/v1/rpc/apply_referral').length === 0);
  await unmount();

  // =========================================================================
  // TEST B — normal signup (no referral) works normally
  // =========================================================================
  resetStorage();
  db.referrals.clear();
  db.profiles.length = 0;
  requests.length = 0;
  nextSignupUserId = NEW_OWNER_ID; // reused below; keep ids distinct per scenario
  nextSignupUserId = 'dddddddd-1111-2222-3333-444444444444';
  goto('/auth/signup');
  await mount();
  check('B: signup opens without a referral code', inputById('signup-referral-code')?.value === '');
  check('B: field is clearly optional', (inputById('signup-referral-code')?.placeholder || '').includes('optional'), String(inputById('signup-referral-code')?.placeholder));
  await fillSignupForm({ email: 'plain@nexora.test' });
  await submitForm();
  check('B: account created without any referral', callsTo('/auth/v1/signup').length === 1);
  check('B: profile written with role customer', db.profiles.some((p) => p.role === 'customer'), JSON.stringify(db.profiles));
  check('B: no referral relationship created', callsTo('/rest/v1/rpc/apply_referral').length === 0);
  check('B: new account still receives its own invite code', callsTo('/rest/v1/rpc/ensure_referral_code').length >= 1);
  await unmount();

  // =========================================================================
  // TEST C — customer referral signup persists the relationship
  // =========================================================================
  resetStorage();
  db.referrals.clear();
  db.profiles.length = 0;
  requests.length = 0;
  nextSignupUserId = NEW_CUSTOMER_ID;
  goto('/?ref=ABC123');
  await mount();
  await fillSignupForm({ email: 'customer@nexora.test' });
  await submitForm();

  check('C: Supabase auth account created', callsTo('/auth/v1/signup').length === 1);
  check('C: customer profile created', db.profiles.some((p) => p.role === 'customer' && p.id === NEW_CUSTOMER_ID), JSON.stringify(db.profiles));
  check('C: referral code validated against the database', callsTo('/rest/v1/rpc/validate_referral_code').length >= 1);
  check('C: own referral code issued to the new user', callsTo('/rest/v1/rpc/ensure_referral_code').length >= 1);
  const applyCalls = callsTo('/rest/v1/rpc/apply_referral');
  check('C: referral relationship persisted', applyCalls.length === 1, `calls=${applyCalls.length}`);
  check('C: relationship stored for the referred user', db.referrals.get(NEW_CUSTOMER_ID)?.code === VALID_CODE, JSON.stringify([...db.referrals]));
  check('C: referrer resolved server-side to the code owner', db.referrals.get(NEW_CUSTOMER_ID)?.referrerUserId === REFERRER_ID);
  check('C: customer landed in the app (not the auth screen)', !byId('auth-main-card') && location.pathname === '/', location.pathname);
  check('C: temporary referral context cleared once persisted', referral.getStoredReferralCode() === null);
  await unmount();

  // =========================================================================
  // TEST D — salon owner referral signup
  // =========================================================================
  resetStorage();
  db.referrals.clear();
  db.profiles.length = 0;
  requests.length = 0;
  nextSignupUserId = NEW_OWNER_ID;
  goto('/signup?ref=ABC123'); // short alias route
  await mount();
  check('D: /signup alias also opens the signup screen', location.pathname === '/signup' || location.pathname === '/auth/signup', location.pathname);
  check('D: referral code auto-filled via alias route', inputById('signup-referral-code')?.value === VALID_CODE);
  await fillSignupForm({ role: 'salon_owner', email: 'owner@nexora.test' });
  await submitForm();

  check('D: owner account created', callsTo('/auth/v1/signup').length === 1);
  check('D: role saved as salon_owner', db.profiles.some((p) => p.role === 'salon_owner' && p.id === NEW_OWNER_ID), JSON.stringify(db.profiles));
  check('D: owner referral relationship persisted', db.referrals.get(NEW_OWNER_ID)?.code === VALID_CODE, JSON.stringify([...db.referrals]));
  check('D: owner referred by the code owner', db.referrals.get(NEW_OWNER_ID)?.referrerUserId === REFERRER_ID);
  check('D: owner left the auth screen', !byId('auth-main-card'));
  await unmount();

  // =========================================================================
  // TEST H — duplicate referral keeps the first relationship
  // Scenario: user B already registered using ABC123, then opens another link.
  // =========================================================================
  requests.length = 0;
  db.currentUserId = NEW_CUSTOMER_ID;
  db.referrals.set(NEW_CUSTOMER_ID, { referrerUserId: REFERRER_ID, code: VALID_CODE });
  const duplicate = await referral.createReferralRelationship({
    referredUserId: NEW_CUSTOMER_ID,
    code: 'XYZ999',
  });
  check('H: second referral attempt reports already_referred', duplicate.status === 'already_referred', duplicate.status);
  check('H: original relationship unchanged', db.referrals.get(NEW_CUSTOMER_ID)?.code === VALID_CODE, JSON.stringify(db.referrals.get(NEW_CUSTOMER_ID)));

  // Fallback path (no RPCs): direct insert must not overwrite either.
  db.rpcEnabled = false;
  requests.length = 0;
  const duplicateFallback = await referral.createReferralRelationship({
    referredUserId: NEW_CUSTOMER_ID,
    code: VALID_CODE,
  });
  check(
    'H: fallback path also keeps the first relationship',
    duplicateFallback.status === 'already_referred' &&
      callsTo('/rest/v1/referrals').filter((r) => r.method === 'POST').length === 0,
    `${duplicateFallback.status} posts=${callsTo('/rest/v1/referrals').filter((r) => r.method === 'POST').length}`
  );

  // =========================================================================
  // TEST I — self-referral rejected
  // =========================================================================
  db.rpcEnabled = true;
  requests.length = 0;
  const selfReferralClient = await referral.createReferralRelationship({
    referredUserId: REFERRER_ID,
    code: VALID_CODE,
    referrerUserId: REFERRER_ID,
  });
  check('I: client refuses an obvious self-referral', selfReferralClient.status === 'self_referral', selfReferralClient.status);
  check('I: client-side refusal writes nothing', callsTo('/rest/v1/rpc/apply_referral').length === 0);

  db.currentUserId = REFERRER_ID;
  const selfReferralDb = await referral.createReferralRelationship({
    referredUserId: REFERRER_ID,
    code: VALID_CODE,
  });
  check('I: database refuses self-referral', selfReferralDb.status === 'self_referral', selfReferralDb.status);
  check('I: no self-referral row stored', !db.referrals.has(REFERRER_ID));

  // =========================================================================
  // TEST J — login never creates a referral
  // =========================================================================
  resetStorage();
  referral.storeReferralContext(VALID_CODE); // stale invite left in storage
  db.currentUserId = REFERRER_ID;
  requests.length = 0;
  goto('/auth/login');
  await mount();
  check('J: login screen stays on login (not hijacked by stored invite)', location.pathname === '/auth/login', location.pathname);
  check('J: login mode has no referral field', !byId('signup-referral-code'));
  setInput(inputById('auth-email'), 'existing@nexora.test');
  setInput(inputById('auth-password'), 'StrongPass123!');
  await submitForm();
  check('J: login performed', callsTo('/auth/v1/token').length >= 1);
  check('J: no referral relationship created at login', callsTo('/rest/v1/rpc/apply_referral').length === 0 && callsTo('/rest/v1/referrals').filter((r) => r.method !== 'GET').length === 0);
  check('J: stale invite context dropped on login', referral.getStoredReferralCode() === null);
  await unmount();

  // =========================================================================
  // TEST J2 — an invite captured AFTER an account existed is never attributed
  // (existing user clicks a friend's link, then signs in normally)
  // =========================================================================
  db.rpcEnabled = true;
  requests.length = 0;
  db.currentUserId = 'eeeeeeee-1111-2222-3333-444444444444';
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const lateInvite = await referral.finalizePendingReferral({
    userId: 'eeeeeeee-1111-2222-3333-444444444444',
    code: VALID_CODE,
    accountCreatedAt: oneHourAgo,
    capturedAt: Date.now(), // invite arrived after the account already existed
  });
  check('J2: invite captured after signup is ignored', lateInvite === null, String(lateInvite));
  check('J2: no relationship written for a late invite', callsTo('/rest/v1/rpc/apply_referral').length === 0);

  requests.length = 0;
  db.currentUserId = 'ffffffff-1111-2222-3333-444444444444';
  const signupInvite = await referral.finalizePendingReferral({
    userId: 'ffffffff-1111-2222-3333-444444444444',
    code: VALID_CODE,
    accountCreatedAt: new Date().toISOString(),
    capturedAt: Date.now() - 5_000, // invite predates the account: real referral
  });
  check('J2: invite captured during signup is applied', signupInvite?.status === 'created', String(signupInvite?.status));

  // =========================================================================
  // Pure-function guards
  // =========================================================================
  check('normalize: lower-case + separators collapsed', referral.normalizeReferralCode(' abc-123 ') === 'ABC123');
  check('normalize: pasted spaces tolerated', referral.normalizeReferralCode('abc 123') === 'ABC123');
  check('normalize: garbage rejected (not silently mangled)', referral.normalizeReferralCode('<script>') === null);
  check('normalize: non-string rejected', referral.normalizeReferralCode({ code: 'ABC123' }) === null);
  check('normalize: too short rejected', referral.normalizeReferralCode('AB') === null);
  check('link: points at the signup route with only the public code', referral.buildReferralSignupLink('ABC123', 'https://nexora.test') === 'https://nexora.test/auth/signup?ref=ABC123', String(referral.buildReferralSignupLink('ABC123', 'https://nexora.test')));
  check('link: refuses a malformed code', referral.buildReferralSignupLink('!!', 'https://nexora.test') === null);
  check('url: referral aliases are recognised', referral.readReferralCodeFromUrl('https://nexora.test/?invite_code=NX7K92') === 'NX7K92');
  check('url: supabase ?code= is NOT treated as a referral', referral.readReferralCodeFromUrl('https://nexora.test/?code=ABC123') === null);

  // =========================================================================
  globalThis.fetch = originalFetch;
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} referral checks passed`);
  if (failed.length) {
    console.log('FAILED:');
    for (const f of failed) console.log(`  - ${f.name} ${f.detail || ''}`);
    process.exit(1);
  }
  process.exit(0);
}

run().catch((err) => {
  console.error('Harness crashed:', err);
  process.exit(1);
});
