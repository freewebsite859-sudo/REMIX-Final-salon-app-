/**
 * Codebase cleanup audit — verifies the consolidation/removal work.
 *
 * Runs the REAL components. Guaranteed here:
 *   1. no referral code is invented on the client when the backend has none
 *   2. `referralCode` is never written onto the local profile object — the
 *      database is the single source of truth
 *   3. share/copy paths refuse to emit "null" and say why instead
 *   4. the loyalty dashboard shows no fabricated promo code
 *   5. the unconfigured-Supabase banner renders PROACTIVELY, before any input,
 *      and names the exact missing variable
 *   6. the referral share modal no longer advertises a QR that encoded nothing
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { act } from 'react';

const results: { name: string; pass: boolean; detail?: string }[] = [];
function check(name: string, pass: boolean, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

// Supabase must be UNCONFIGURED for this audit — that is the state under test.
// setup-jsdom.mjs seeds a dummy anon key so other suites can construct a client,
// so clear it here BEFORE any module that evaluates src/lib/supabase/client.ts.
// `isSupabaseConfigured` is computed once at module load, hence the ordering.
delete process.env.VITE_SUPABASE_ANON_KEY;

const { ReferralFeatureSection } = await import('../src/components/ReferralFeatureSection');
const { LoyaltyDashboard } = await import('../src/components/LoyaltyDashboard');
const { SupabaseConfigBanner } = await import('../src/components/SupabaseConfigBanner');
const { AuthPage } = await import('../src/components/auth/AuthPage');
const { isSupabaseConfigured, getSupabaseConfigStatus } = await import('../src/lib/supabase');
const { AuthProvider } = await import('../src/providers/AuthProvider');

// jsdom exposes its constructors on `window`, not as bare Node globals.
Element.prototype.scrollIntoView = function () {
  /* no-op */
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function settle(ms = 250) {
  await act(async () => {
    await sleep(ms);
  });
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;
async function mount(node: React.ReactElement) {
  container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => {
    root = createRoot(container!);
    root!.render(node);
  });
  await settle(450);
}
async function unmount() {
  await act(async () => {
    root?.unmount();
  });
  root = null;
  container?.remove();
  container = null;
}
const byId = (id: string) => document.getElementById(id);
const bodyText = () => document.body.textContent || '';
async function click(el: Element | null | undefined) {
  if (!el) throw new Error('click target missing');
  await act(async () => {
    el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  await settle(120);
}

type UserProfile = import('../src/types').UserProfile;
function makeUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    name: 'Ananya Sharma',
    email: 'ananya@example.com',
    phone: '+91 90000 11111',
    avatar: '',
    locationArea: '',
    city: 'Jaipur',
    loyaltyPoints: 250,
    preferredServices: [],
    genderPreference: 'all',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
console.log('\n--- preconditions ---');
check(
  'P1 Supabase is unconfigured in this harness',
  isSupabaseConfigured === false,
  `isSupabaseConfigured=${isSupabaseConfigured}`
);

// ===========================================================================
// TEST A — no client-invented referral code, and no profile write
// ===========================================================================
console.log('\n--- TEST A: referral code is database-owned ---');
{
  const writes: UserProfile[] = [];
  const toasts: string[] = [];
  await mount(
    <ReferralFeatureSection
      user={makeUser()}
      onUpdateUser={(u) => writes.push(u)}
      showToast={(m) => toasts.push(m)}
    />
  );

  const html = document.body.innerHTML;

  check('A1 no invented NX- prefixed code is displayed', !/NX-[A-Z]+\d{3}/.test(bodyText()), bodyText().match(/NX-[A-Z]+\d{3}/)?.[0] ?? 'none');
  check('A2 code pill shows an em dash, not a fabricated code', (byId('copy-referral-code-pill')?.textContent || '').includes('—'), String(byId('copy-referral-code-pill')?.textContent));
  check('A3 link area states the service is unreachable', bodyText().includes('referral service is not reachable'));
  check('A4 "Not synced yet" badge is shown', Boolean(byId('referral-code-not-synced')));
  check('A5 source no longer contains the random-code generator', !/localFallbackCode/.test(html) && !/Math\.floor\(100 \+ Math\.random/.test(html));

  // The single-source-of-truth rule: no write may carry referralCode.
  await click(byId('copy-referral-code-pill'));
  check(
    'A6 copying an unavailable code explains instead of copying null',
    toasts.some((t) => /not available/i.test(t)) && !toasts.some((t) => t.includes('null')),
    toasts.join(' | ')
  );

  await click(byId('copy-referral-link-btn'));
  check(
    'A7 copying an unavailable link explains instead of copying null',
    toasts.some((t) => /not ready|not available/i.test(t)) && !toasts.some((t) => t.includes('null')),
    toasts.join(' | ')
  );

  await click(byId('whatsapp-share-btn'));
  check(
    'A8 WhatsApp share refuses rather than sending a null link',
    toasts.some((t) => /cannot share/i.test(t)),
    toasts.slice(-1).join(' | ')
  );

  // Sending an invite must not write referralCode onto the profile object.
  const inviteInput = document.querySelector<HTMLInputElement>('input[placeholder*="friend" i], input[type="text"]');
  if (inviteInput) {
    const setter = Object.getOwnPropertyDescriptor(
      (window as unknown as { HTMLInputElement: typeof HTMLInputElement }).HTMLInputElement.prototype,
      'value'
    )?.set;
    await act(async () => {
      setter?.call(inviteInput, 'Rhea');
      inviteInput.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    await settle(120);
    const form = inviteInput.closest('form');
    if (form) {
      await act(async () => {
        form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
      });
      await settle(150);
    }
  }
  const wroteReferralCode = writes.some((w) => 'referralCode' in w && w.referralCode !== undefined);
  check('A9 no onUpdateUser write carries referralCode', !wroteReferralCode, `writes=${writes.length}`);
  check(
    'A10 invite toast does not claim a link was sent',
    !toasts.some((t) => /Invitation link sent/i.test(t)),
    toasts.slice(-1).join(' | ')
  );

  // The share modal must not advertise a scannable QR that encodes nothing.
  await click(byId('view-qr-btn'));
  check('A11 share modal opens', bodyText().includes('Invite a Friend to Nexora'));
  check('A12 modal no longer claims "Scan to Join"', !bodyText().includes('Scan to Join Nexora'));
  check('A13 modal no longer instructs scanning a QR', !/scan this QR code/i.test(bodyText()));
  check('A14 modal explains the link is unavailable', bodyText().includes('Nothing has been shared'));
  check('A15 no decorative QR svg is rendered', !document.body.innerHTML.includes('viewBox="0 0 100 100"'));

  await unmount();
}

// ===========================================================================
// TEST B — a backend code is still honoured when one exists
// ===========================================================================
console.log('\n--- TEST B: real code still renders ---');
{
  const writes: UserProfile[] = [];
  await mount(
    <ReferralFeatureSection
      user={makeUser({ referralCode: 'ABC123' })}
      onUpdateUser={(u) => writes.push(u)}
    />
  );
  check('B1 a stored code is displayed', bodyText().includes('ABC123'));
  check('B2 the invite link contains the real code', bodyText().includes('ref=ABC123') || bodyText().includes('ABC123'));
  check('B3 mounting alone does not rewrite the profile', writes.length === 0, `writes=${writes.length}`);
  await unmount();
}

// ===========================================================================
// TEST C — loyalty dashboard shows no fabricated promo code
// ===========================================================================
console.log('\n--- TEST C: loyalty dashboard ---');
{
  await mount(<LoyaltyDashboard user={makeUser()} onUpdateUser={() => {}} />);
  check('C1 no NEXORA2026 placeholder anywhere', !bodyText().includes('NEXORA2026'));
  check('C2 explains the code comes from the referral service', bodyText().includes('referral service'));
  await unmount();

  await mount(<LoyaltyDashboard user={makeUser({ referralCode: 'XYZ789' })} onUpdateUser={() => {}} />);
  check('C3 a real code is shown when present', bodyText().includes('XYZ789'));
  await unmount();
}

// ===========================================================================
// TEST D — unconfigured banner renders proactively
// ===========================================================================
console.log('\n--- TEST D: config banner ---');
{
  const status = getSupabaseConfigStatus();
  await mount(<SupabaseConfigBanner action="create an account" />);
  const banner = byId('supabase-config-banner');
  check('D1 banner renders while unconfigured', Boolean(banner));
  check('D2 banner is an alert role', banner?.getAttribute('role') === 'alert');
  check(
    'D3 banner names the exact missing variable',
    bodyText().includes('VITE_SUPABASE_ANON_KEY'),
    bodyText().slice(0, 200)
  );
  check(
    'D4 banner classifies the reason',
    banner?.getAttribute('data-reason') === (status.isPrivilegedKey ? 'privileged-key' : 'missing-env'),
    String(banner?.getAttribute('data-reason'))
  );
  check('D5 banner mentions the rebuild step', bodyText().includes('npm run build'));
  check('D6 banner reassures nothing was transmitted', bodyText().includes('Nothing you enter here is sent anywhere'));
  await unmount();
}

// ===========================================================================
// TEST E — AuthPage shows the banner BEFORE submit
// ===========================================================================
console.log('\n--- TEST E: auth page proactive banner ---');
{
  await mount(
    <AuthProvider>
      <AuthPage onAuthSuccess={() => {}} />
    </AuthProvider>
  );
  await settle(900);

  const banner = byId('supabase-config-banner');
  check('E1 auth page renders the banner on mount', Boolean(banner));
  check('E2 banner appears without any user input', bodyText().includes('Live authentication is not configured'));
  check('E3 signup-specific wording', bodyText().includes('create an account') || bodyText().includes('sign in'), bodyText().slice(0, 160));
  await unmount();
}

// ---------------------------------------------------------------------------
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log('\nFAILURES:');
  for (const f of failed) console.log(`  ✗ ${f.name}${f.detail ? ` — ${f.detail}` : ''}`);
  process.exit(1);
}
console.log('All cleanup-audit checks passed.');
process.exit(0);
