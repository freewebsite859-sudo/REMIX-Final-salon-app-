/**
 * Invite link → signup form → referral counting (end to end).
 *
 * Covers the three things the invite flow promises:
 *   1. OPENING THE LINK shows the SIGNUP form (never the guest home screen)
 *   2. THE CODE IS ADDED to the form (prefilled, visible in the URL, stashed)
 *   3. IT IS COUNTED — the referrer's Total Invited / Pending / Reward Earned
 *      counters move, and the 150 points release on the friend's ₹100+ QR pay.
 *
 * Runs the REAL AuthPage submit handler against the on-device demo auth client
 * (see test/force-demo-auth.mjs) with HTTP stubbed, so the assertions below are
 * about shipped code paths, not re-implementations.
 */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';

import {
  PENDING_REFERRAL_CODE_KEY,
  cameFromInviteLink,
  captureInviteCode,
  clearPendingReferralCode,
  PUBLIC_INVITE_PARAM,
  SIGNUP_REFERRAL_PARAM,
  buildInviteLink,
  extractReferralCode,
  inviteSignupPath,
  isInvitePath,
  isReferralCodeValue,
  normalizeReferralCode,
  peekPendingReferralCode,
  redirectInviteToSignup,
  resolveInviteOrigin,
  resolveInviteRoute,
  resolveReferralCodeForSignup,
} from '../src/lib/inviteLink.ts';
import {
  computeReferralSummary,
  completeReferralByQrPayment,
  ensureReferralCode,
  findReferralCodeOwner,
  loadStoredReferralRecords,
  readReferredBy,
  REFERRAL_POINTS_PER_INVITE,
} from '../src/lib/referralService.ts';
import { getStoredRewardTransactions } from '../src/lib/rewardsService.ts';
import { cleanAuthParamsFromUrl, isAuthRoute } from '../src/lib/authRoutes.ts';
import { AuthPage } from '../src/components/auth/AuthPage.tsx';
import { ReferralPage } from '../src/components/ReferralPage.tsx';
import type { UserProfile } from '../src/types.ts';

// ---------------------------------------------------------------------------
// Bookkeeping
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;
function check(label: string, cond: boolean, detail = '') {
  if (cond) {
    console.log(`PASS  ${label}${detail ? ` — ${detail}` : ''}`);
    passed += 1;
  } else {
    console.log(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
    failed += 1;
  }
}

const INVITE_CODE = 'NX-VIJAY634';
const REFERRER: UserProfile = {
  name: 'Vijay Kumar',
  email: 'vijay@example.com',
  phone: '+91 98290 11111',
  avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
  locationArea: 'Mansarovar',
  city: 'Jaipur',
  loyaltyPoints: 0,
  preferredServices: [],
  genderPreference: 'all',
};
const NEW_EMAIL = 'newfriend@example.com';

const host = document.createElement('div');
document.body.appendChild(host);
let root: Root = createRoot(host);

async function render(ui: React.ReactElement) {
  await act(async () => {
    root.render(ui);
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 40));
  });
}

async function unmount() {
  await act(async () => {
    root.unmount();
  });
  root = createRoot(host);
  host.innerHTML = '';
}

function byId(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function inputById(id: string): HTMLInputElement | null {
  return byId(id) as HTMLInputElement | null;
}

async function typeInto(el: HTMLInputElement | null, value: string) {
  if (!el) throw new Error(`input #${el} missing`);
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  )?.set;
  await act(async () => {
    setter?.call(el, value);
    el.dispatchEvent(new window.Event('input', { bubbles: true }));
    el.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
}

async function click(el: Element | null) {
  if (!el) throw new Error('click target missing');
  await act(async () => {
    el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

function setUrl(url: string) {
  window.history.replaceState({}, '', url);
}

// ---------------------------------------------------------------------------
// HTTP stub — records the attribution call the signup makes
// ---------------------------------------------------------------------------
const httpCalls: { url: string; method: string; body: any }[] = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input.toString();
  let body: any = null;
  try {
    body = init?.body ? JSON.parse(init.body as string) : null;
  } catch {
    body = init?.body ?? null;
  }
  httpCalls.push({ url, method: (init?.method || 'GET').toUpperCase(), body });
  return new Response(
    JSON.stringify({
      referralId: 'referral-cloud-1',
      referrerName: REFERRER.name,
      rewardPoints: REFERRAL_POINTS_PER_INVITE,
      status: 'pending',
    }),
    { status: 201, headers: { 'Content-Type': 'application/json' } }
  );
}) as typeof fetch;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
async function run() {
  // =========================================================================
  // 1. Link parsing
  // =========================================================================
  check('normalize keeps NX-VIJAY634', normalizeReferralCode(' nx-vijay634 ') === INVITE_CODE);
  check('normalize rejects junk shorter than 4 chars', normalizeReferralCode('ab') === '');
  check('/invite is an invite path', isInvitePath('/invite'));
  check('/r/NX-ABC is an invite path', isInvitePath('/r/NX-ABC'));
  check('/customer/home is not an invite path', !isInvitePath('/customer/home'));
  check('code parsed from ?code=', extractReferralCode(`?code=${INVITE_CODE}`) === INVITE_CODE);
  check('code parsed from path segment', extractReferralCode('', '/invite/nx-vijay634') === INVITE_CODE);
  // The shared link must point at a host that actually serves THIS app, so the
  // origin comes from the deployment (window.location.origin here), never from a
  // hardcoded marketing domain. `?code=` stays in the public link because that is
  // the format already circulating in WhatsApp threads.
  check(
    'share link shape uses the live origin',
    buildInviteLink(INVITE_CODE) === `${resolveInviteOrigin()}/invite?${PUBLIC_INVITE_PARAM}=${INVITE_CODE}`,
    buildInviteLink(INVITE_CODE)
  );
  check(
    'share link ignores a bogus APP_URL placeholder',
    buildInviteLink(INVITE_CODE, 'MY_APP_URL').startsWith(`${resolveInviteOrigin()}/invite?`),
    buildInviteLink(INVITE_CODE, 'MY_APP_URL')
  );
  check(
    'explicit origin wins',
    buildInviteLink(INVITE_CODE, 'https://nexora.app') === `https://nexora.app/invite?code=${INVITE_CODE}`
  );
  // The INTERNAL signup URL must not use `?code=`: Supabase's detectSessionInUrl
  // reads that param as a PKCE authorization code.
  check(
    'signup path keeps the code',
    inviteSignupPath(INVITE_CODE) === `/customer/signup?${SIGNUP_REFERRAL_PARAM}=${INVITE_CODE}`,
    inviteSignupPath(INVITE_CODE)
  );
  check(
    'a referral code is never confused with a Supabase auth code',
    isReferralCodeValue(INVITE_CODE) &&
      !isReferralCodeValue('2f9c1a4b7e3d4c5a9b1f0d2e3f4a5b6c7d8e9f0a') &&
      !isReferralCodeValue('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.short.long')
  );

  // =========================================================================
  // 2. Opening the invite link rewrites to the signup form and keeps the code
  // =========================================================================
  setUrl(`/invite?code=${INVITE_CODE}`);
  const resolved = resolveInviteRoute('/invite', `?code=${INVITE_CODE}`);
  check('invite route detected', resolved.isInvite);
  check(
    'invite route targets signup',
    resolved.target === `/customer/signup?${SIGNUP_REFERRAL_PARAM}=${INVITE_CODE}`,
    resolved.target
  );

  const redirectedCode = redirectInviteToSignup({ replace: true });
  check('redirect returns the code', redirectedCode === INVITE_CODE, redirectedCode);
  check('url is now the signup screen', window.location.pathname === '/customer/signup', window.location.pathname);
  check(
    'url still carries the code',
    window.location.search === `?${SIGNUP_REFERRAL_PARAM}=${INVITE_CODE}`,
    window.location.search
  );
  check(
    'the GoTrue-colliding ?code= param is gone from the signup URL',
    !new URLSearchParams(window.location.search).has('code')
  );
  check('code stashed for later', peekPendingReferralCode() === INVITE_CODE);

  // =========================================================================
  // 2b. Every documented invite path lands on the same signup screen
  // =========================================================================
  for (const path of ['/join', '/ref', '/invited', '/refer', '/referral-link']) {
    setUrl(`${path}?code=${INVITE_CODE}`);
    const code = redirectInviteToSignup({ replace: true });
    check(
      `${path}?code=… opens signup with the code`,
      code === INVITE_CODE && window.location.pathname === '/customer/signup',
      `${code} → ${window.location.pathname}${window.location.search}`
    );
  }
  // Short path form: /r/:code (no query string at all)
  setUrl(`/r/${INVITE_CODE.toLowerCase()}`);
  const pathCode = redirectInviteToSignup({ replace: true });
  check(
    '/r/:code segment form works',
    pathCode === INVITE_CODE &&
      window.location.search === `?${SIGNUP_REFERRAL_PARAM}=${INVITE_CODE}`,
    `${pathCode} → ${window.location.search}`
  );

  // =========================================================================
  // 2c. Reload / back-button must not lose the code
  // =========================================================================
  // A reload lands on a bare signup URL (no ?code=) — the stash must refill it.
  setUrl('/customer/signup');
  check(
    'code survives a reload with an empty query string',
    resolveReferralCodeForSignup() === INVITE_CODE,
    resolveReferralCodeForSignup() || '(empty)'
  );

  // =========================================================================
  // 2d. The boot guard runs BEFORE the auth client exists
  // =========================================================================
  const AUTH_CODE_BLOB = '2f9c1a4b7e3d4c5a9b1f0d2e3f4a5b6c7d8e9f0a';

  clearPendingReferralCode();
  setUrl(`/invite?code=${INVITE_CODE}`);
  const boot = captureInviteCode();
  check('boot guard finds the invite code', boot.code === INVITE_CODE, boot.code);
  check(
    'boot guard lands on signup carrying ?ref=',
    window.location.pathname === '/customer/signup' &&
      window.location.search === `?${SIGNUP_REFERRAL_PARAM}=${INVITE_CODE}`,
    `${window.location.pathname}${window.location.search}`
  );
  check('boot guard records that this visit came from an invite', cameFromInviteLink());
  check(
    'boot guard writes the shared stash key',
    (window.localStorage.getItem(PENDING_REFERRAL_CODE_KEY) || '').includes(INVITE_CODE)
  );

  // A Supabase authorization code must be left exactly where it is.
  clearPendingReferralCode();
  setUrl(`/auth/callback?code=${AUTH_CODE_BLOB}`);
  captureInviteCode();
  check(
    'boot guard never hijacks a Supabase auth code',
    window.location.pathname === '/auth/callback' &&
      window.location.search === `?code=${AUTH_CODE_BLOB}` &&
      peekPendingReferralCode() === '',
    `${window.location.pathname}${window.location.search}`
  );

  // Route protection must not bounce an invited visitor to login.
  setUrl(`/invite?code=${INVITE_CODE}`);
  check('invite path counts as an auth screen (no forced login)', isAuthRoute('/invite'));
  check('segment invite path counts as an auth screen too', isAuthRoute('/r/NX-VIJAY634'));

  // `cleanAuthParamsFromUrl` runs on every boot and used to delete the invite
  // code along with Supabase's debris — the silent way a referral was lost.
  clearPendingReferralCode();
  window.localStorage.setItem(
    PENDING_REFERRAL_CODE_KEY,
    JSON.stringify({ code: INVITE_CODE, at: new Date().toISOString() })
  );
  setUrl(`/customer/signup?code=${INVITE_CODE}`);
  cleanAuthParamsFromUrl();
  const afterClean = new URLSearchParams(window.location.search);
  check(
    'auth-param cleanup keeps the referral code',
    afterClean.get(SIGNUP_REFERRAL_PARAM) === INVITE_CODE && !afterClean.has('code'),
    window.location.search || '(empty)'
  );
  setUrl(`/auth/callback?code=${AUTH_CODE_BLOB}&error=bad`);
  cleanAuthParamsFromUrl();
  check(
    'cleanup still strips a spent auth code',
    window.location.search === '',
    window.location.search || '(empty)'
  );
  window.localStorage.removeItem(PENDING_REFERRAL_CODE_KEY);
  clearPendingReferralCode();
  setUrl('/customer/home');

  // =========================================================================
  // 3. The referrer owns a stable, registered code
  // =========================================================================
  const referrerCode = ensureReferralCode({
    name: REFERRER.name,
    email: REFERRER.email,
    phone: REFERRER.phone,
  });
  check('generated code matches NX-<NAME><ddd>', /^NX-VIJAY\d{3}$/.test(referrerCode), referrerCode);
  check(
    'code resolves back to the referrer',
    findReferralCodeOwner(referrerCode)?.ownerKey === REFERRER.email
  );
  check(
    'code is stable across screens',
    ensureReferralCode({ name: REFERRER.name, email: REFERRER.email }) === referrerCode
  );

  // =========================================================================
  // 4. The invite code is added to the signup form
  // =========================================================================
  setUrl(`/invite?code=${referrerCode}`);
  redirectInviteToSignup({ replace: true });

  let authSucceeded = false;
  await render(
    <AuthPage
      initialMode="signup"
      onAuthSuccess={() => {
        authSucceeded = true;
      }}
    />
  );

  const referralInput = inputById('signup-referral-code');
  check('signup form shows a referral code field', Boolean(referralInput));
  check(
    'referral field is prefilled from the invite link',
    referralInput?.value === referrerCode,
    referralInput?.value || '(empty)'
  );
  check(
    'invite hint tells the visitor the code was added',
    (byId('signup-referral-hint')?.textContent || '').includes(referrerCode),
    byId('signup-referral-hint')?.textContent || ''
  );
  check('invite banner rendered', Boolean(byId('signup-referral-banner')));
  check(
    'banner reads "Joined via referral: <code>"',
    (byId('signup-referral-banner')?.textContent || '').includes('Joined via referral:') &&
      byId('signup-referral-banner-code')?.textContent?.trim() === referrerCode,
    byId('signup-referral-banner')?.textContent || ''
  );

  // =========================================================================
  // 5. Signing up through the invite link counts the referral
  // =========================================================================
  await typeInto(inputById('signup-fullname'), 'Asha Meena');
  await typeInto(inputById('signup-mobile'), '9829012345');
  await typeInto(inputById('signup-dob'), '1996-05-10');
  await typeInto(inputById('auth-email'), NEW_EMAIL);
  await typeInto(inputById('auth-password'), 'password123');
  await typeInto(inputById('signup-confirm-password'), 'password123');

  const form = document.querySelector('form');
  await act(async () => {
    form?.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 120));
  });

  check('signup completed', authSucceeded);
  check(
    'no blocking error shown after signup',
    !document.querySelector('[id="auth-error-alert"]')?.textContent,
    document.querySelector('[id="auth-error-alert"]')?.textContent || ''
  );

  const acceptCall = httpCalls.find((c) => c.url.includes('/api/referrals/accept'));
  check('backend attribution called', Boolean(acceptCall), acceptCall?.url || '(no call)');
  check(
    'backend received the invite code',
    acceptCall?.body?.code === referrerCode,
    String(acceptCall?.body?.code)
  );

  const referrerRecords = loadStoredReferralRecords(REFERRER.email);
  check('referral row written for the referrer', referrerRecords.length === 1, String(referrerRecords.length));
  check(
    'referral row is pending until the ₹100 QR payment',
    referrerRecords[0]?.status === 'pending',
    referrerRecords[0]?.status || ''
  );
  check(
    'referral row names the new customer',
    referrerRecords[0]?.friendName === 'Asha Meena',
    referrerRecords[0]?.friendName || ''
  );

  const summary = computeReferralSummary(referrerCode, referrerRecords);
  check('total invited counted', summary.totalInvited === 1, String(summary.totalInvited));
  check('pending counted', summary.pendingReferrals === 1, String(summary.pendingReferrals));
  check('no points before a qualifying payment', summary.rewardEarned === 0, String(summary.rewardEarned));
  check(
    'new customer knows who invited them',
    readReferredBy(NEW_EMAIL)?.code === referrerCode,
    readReferredBy(NEW_EMAIL)?.code || '(none)'
  );

  // =========================================================================
  // 6. The referrer's screen shows the new count
  // =========================================================================
  await unmount();
  await render(<ReferralPage user={REFERRER} />);
  check(
    'referral page shows 1 invite',
    byId('metric-total-invited')?.textContent?.trim() === '1',
    byId('metric-total-invited')?.textContent || ''
  );
  check(
    'referral page shows 1 pending',
    byId('metric-pending-referrals')?.textContent?.trim() === '1',
    byId('metric-pending-referrals')?.textContent || ''
  );
  check(
    'referral page shows 0 pts earned so far',
    (byId('metric-reward-earned')?.textContent || '').includes('0 pts'),
    byId('metric-reward-earned')?.textContent || ''
  );
  check(
    'referral page shows the code that was shared',
    byId('referral-code-display')?.textContent?.trim() === referrerCode,
    byId('referral-code-display')?.textContent || ''
  );

  // =========================================================================
  // 7. A qualifying ₹100+ QR payment releases the 150 points
  // =========================================================================
  // Baseline first: an empty wallet is seeded with demo rows, so only a NEW
  // referral transaction naming this friend proves the credit happened.
  const baselineReferralTxs = getStoredRewardTransactions(REFERRER.email).filter(
    (tx) => tx.type === 'referral'
  ).length;

  let qrOutcome: ReturnType<typeof completeReferralByQrPayment>;
  await act(async () => {
    qrOutcome = completeReferralByQrPayment({
      referredEmail: NEW_EMAIL,
      amountInr: 450,
      salonName: 'Nexora Signature C-Scheme',
    });
  });
  check('referral completed by QR payment', qrOutcome!.success, qrOutcome!.message);
  check(
    'referrer credited 150 points',
    qrOutcome!.pointsCredited === REFERRAL_POINTS_PER_INVITE,
    String(qrOutcome!.pointsCredited)
  );

  const wallet = getStoredRewardTransactions(REFERRER.email);
  const referralTxs = wallet.filter((tx) => tx.type === 'referral');
  check(
    'a NEW referral reward landed in the wallet',
    referralTxs.length === baselineReferralTxs + 1,
    `${baselineReferralTxs} → ${referralTxs.length}`
  );
  const referralTx = referralTxs.find((tx) => tx.friendName === 'Asha Meena');
  check(
    'referral reward names the friend who paid',
    Boolean(referralTx),
    referralTx?.description || '(not found)'
  );
  check(
    'referral reward is 150 pts',
    referralTx?.points === REFERRAL_POINTS_PER_INVITE,
    String(referralTx?.points)
  );
  check(
    'referral row flipped to completed',
    loadStoredReferralRecords(REFERRER.email)[0]?.status === 'completed',
    loadStoredReferralRecords(REFERRER.email)[0]?.status || ''
  );

  await unmount();
  await render(<ReferralPage user={REFERRER} />);
  check(
    'referral page now shows 1 successful',
    byId('metric-successful-referrals')?.textContent?.trim() === '1',
    byId('metric-successful-referrals')?.textContent || ''
  );
  check(
    'referral page now shows 150 pts earned',
    (byId('metric-reward-earned')?.textContent || '').includes('150 pts'),
    byId('metric-reward-earned')?.textContent || ''
  );

  await unmount();
}

run()
  .catch((err) => {
    console.error('Invite referral test crashed:', err);
    failed += 1;
  })
  .finally(() => {
    globalThis.fetch = originalFetch;
    console.log(`\n${passed}/${passed + failed} invite referral checks passed`);
    process.exit(failed > 0 ? 1 : 0);
  });
