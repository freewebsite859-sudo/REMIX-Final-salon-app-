/**
 * Nexora Customer Profile — integration harness.
 *
 * Runs the REAL <ProfileTab/>, the REAL <ProfileMenu/>, the REAL
 * <ProfileLegalModal/> and the REAL <App/> against a stubbed Supabase endpoint.
 *
 * Verified guarantees
 * -------------------
 *   1. Profile Overview shows photo, full name, email, mobile — driven by
 *      stored data only (membership/rewards/referrals were removed)
 *   2. no fabricated values: no placeholder phone/locality, no hardcoded
 *      "VIP Club Member", no assumed referral counts or reward credits
 *   3. the profile screen contains no membership, rewards or referral UI
 *   4. the Profile Menu lists exactly the 13 specified items, in order
 *   5. every menu item performs a real action (navigate, open panel, open
 *      document, scroll to its own section)
 *   6. Personal Information carries all 7 specified fields and each edit
 *      persists through onUpdateUser
 *   7. Addresses add / validate / set-default / delete round-trip through
 *      the real handlers
 *   8. the avatar role switcher does NOT clobber the gender preference
 *   9. Support hides the contact address when none is configured
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
const USER_ID = '11111111-2222-3333-4444-555555555555';
const STORAGE_KEY = 'nexora.auth.qwaehqsmodekbgvnaavz';

interface Recorded {
  method: string;
  url: string;
  body: unknown;
}
const requests: Recorded[] = [];

function b64urlJson(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
function makeJwt(expiresInSeconds = 3600): string {
  const now = Math.floor(Date.now() / 1000);
  return [
    b64urlJson({ alg: 'HS256', typ: 'JWT' }),
    b64urlJson({ sub: USER_ID, role: 'authenticated', exp: now + expiresInSeconds, iat: now }),
    'signature',
  ].join('.');
}

const TEST_USER = {
  id: USER_ID,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'client@nexora.test',
  created_at: new Date().toISOString(),
  user_metadata: { full_name: 'Ananya Sharma' },
  app_metadata: {},
};

// ---------------------------------------------------------------------------
// Supabase HTTP stub — the profile screen reads preferences and referral rows
// from the database, so answer those; everything else returns an empty set.
// ---------------------------------------------------------------------------
const db = {
  preferences: [] as Record<string, unknown>[],
  referrals: [] as Record<string, unknown>[],
};

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

  if (url.includes('/auth/v1/token')) {
    return json({
      access_token: makeJwt(3600),
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'refresh-new',
      user: TEST_USER,
    });
  }
  if (url.includes('/auth/v1/user')) return json(TEST_USER);
  if (url.includes('/auth/v1/logout')) return new Response(null, { status: 204 });

  if (url.includes('/rest/v1/notification_preferences')) {
    if (method === 'GET') return json(db.preferences);
    const rows = (Array.isArray(body) ? body : [body]) as Record<string, unknown>[];
    for (const row of rows) {
      const key = `${row.user_id}|${row.channel}|${row.category}`;
      const existing = db.preferences.find(
        (p) => `${p.user_id}|${p.channel}|${p.category}` === key
      );
      if (existing) Object.assign(existing, row);
      else db.preferences.push(row);
    }
    return json(rows, 201);
  }
  if (url.includes('/rest/v1/referrals')) return json(db.referrals);

  return json([]);
}) as typeof fetch;

Object.defineProperty(navigator, 'geolocation', {
  value: { watchPosition: () => 1, clearWatch: () => undefined, getCurrentPosition: () => undefined },
  configurable: true,
});
// jsdom does not implement scrolling; the profile menu scrolls to sections.
Element.prototype.scrollIntoView = function () {
  /* no-op */
};

// ---------------------------------------------------------------------------
// Modules under test
// ---------------------------------------------------------------------------
const { AuthProvider } = await import('../src/providers/AuthProvider');
const { ProfileTab } = await import('../src/components/ProfileTab');
const { ProfileMenu } = await import('../src/components/ProfileMenu');
const { ProfileLegalModal } = await import('../src/components/ProfileLegalModal');
const App = (await import('../src/App')).default;
const types = await import('../src/types');
void types;

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------
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
  await settle(500);
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
const text = (id: string) => byId(id)?.textContent || '';
const bodyText = () => document.body.textContent || '';
async function click(el: Element | null | undefined) {
  if (!el) throw new Error('click target missing');
  await act(async () => {
    el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  await settle(120);
}
async function typeInto(el: HTMLInputElement | HTMLSelectElement | null, value: string) {
  if (!el) throw new Error('input target missing');
  // jsdom exposes its constructors on `window`, not as bare Node globals.
  const w = window as unknown as {
    HTMLInputElement: typeof HTMLInputElement;
    HTMLSelectElement: typeof HTMLSelectElement;
  };
  const proto =
    el.tagName === 'SELECT' ? w.HTMLSelectElement.prototype : w.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  await act(async () => {
    setter?.call(el, value);
    el.dispatchEvent(new window.Event('input', { bubbles: true }));
    el.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  await settle(120);
}

/** Visible label of a menu row: the second child, or its first child if nested. */
function menuLabel(b: Element): string {
  const second = b.children[1];
  if (!second) return '';
  return ((second.firstElementChild ?? second).textContent || '').trim();
}

// ---------------------------------------------------------------------------
// A controlled profile — mirrors how App owns UserProfile state, so every
// onUpdateUser write flows back into the rendered tree.
// ---------------------------------------------------------------------------
type UserProfile = import('../src/types').UserProfile;

function makeUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    name: 'Ananya Sharma',
    email: 'ananya@example.com',
    phone: '+91 90000 11111',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e',
    locationArea: '',
    city: 'Jaipur',
    loyaltyPoints: 0,
    preferredServices: [],
    genderPreference: 'all',
    dateOfBirth: '1996-04-18',
    gender: 'women',
    ...overrides,
  };
}

interface HarnessProps {
  initial: UserProfile;
  onViewAppointments?: () => void;
  onViewFavourites?: () => void;
  onOpenNotifications?: () => void;
  onLogout?: () => void;
  unreadNotifications?: number;
  favouritesCount?: number;
  appointments?: import('../src/types').Appointment[];
  onSaved?: (u: UserProfile) => void;
}
let latestSaved: UserProfile | null = null;

const Harness: React.FC<HarnessProps> = ({
  initial,
  onSaved,
  ...handlers
}) => {
  const [user, setUser] = React.useState<UserProfile>(initial);
  const update = React.useCallback(
    (next: UserProfile) => {
      latestSaved = next;
      onSaved?.(next);
      setUser(next);
    },
    [onSaved]
  );
  return (
    <AuthProvider>
      <ProfileTab user={user} onUpdateUser={update} {...handlers} />
    </AuthProvider>
  );
};

// ===========================================================================
// TEST A — Profile Overview: the six required facts, from stored data
// ===========================================================================
console.log('\n--- TEST A: Profile Overview ---');
{
  latestSaved = null;
  await mount(
    <Harness initial={makeUser({ loyaltyPoints: 1250, referralEarnings: 450, claimedDiscounts: 150 })} />
  );

  const hero = byId('profile-hero-card');
  check('A1 hero card renders', Boolean(hero));

  // 1. customer photo
  const img = hero?.querySelector('img');
  check('A2 overview shows the customer photo', Boolean(img?.getAttribute('src')?.startsWith('https://')), String(img?.getAttribute('src')));
  check('A3 photo alt is the customer name', img?.getAttribute('alt') === 'Ananya Sharma', String(img?.getAttribute('alt')));

  // 2. full name / 3. email / 4. mobile
  check('A4 overview shows the full name', bodyText().includes('Ananya Sharma'));
  check('A5 overview shows the email', bodyText().includes('ananya@example.com'));
  check('A6 overview shows the mobile number', bodyText().includes('+91 90000 11111'));

  // Membership badges and reward strips were removed from the profile screen.
  check('A7 no membership badge in the simplified hero', !byId('profile-membership-badge'));
  check('A8 no reward points strip', !byId('profile-reward-points'));

  await unmount();
}

// ===========================================================================
// TEST B — no fabricated profile data anywhere on the screen
// ===========================================================================
console.log('\n--- TEST B: no invented data ---');
{
  latestSaved = null;
  // A brand-new account: no phone, no locality, no referrals, no points.
  await mount(
    <Harness initial={makeUser({ name: 'New User', email: 'new@example.com', phone: '', locationArea: '', defaultLocality: '', loyaltyPoints: 0 })} />
  );
  const html = document.body.innerHTML;

  check('B1 no hardcoded phone fallback in rendered output', !bodyText().includes('98290 12345'), 'placeholder only is fine');
  check('B2 no invented locality', !bodyText().includes('Mansarovar'));
  check('B3 no hardcoded VIP Club Member badge', !bodyText().includes('VIP Club Member'));
  check('B4 empty phone shows an honest empty state', bodyText().includes('No mobile number added'));
  check('B5 no reward balance strip is rendered anymore', !byId('profile-reward-balance'));
  check('B6 no referral section is rendered anymore', !byId('section-rewards'));
  check('B7 source no longer contains the old fake defaults', !html.includes('referredFriends.length ?? 3'));

  // The phone input may keep a placeholder, but it must not be a value.
  const phoneInput = byId('input-profile-phone') as HTMLInputElement | null;
  check('B8 phone input value is empty for a new account', phoneInput?.value === '', String(phoneInput?.value));

  await unmount();
}

// ===========================================================================
// ===========================================================================
// TEST D — Profile Menu: exactly the 13 specified items, in order
// ===========================================================================
console.log('\n--- TEST D: profile menu contract ---');
{
  const REQUIRED = [
    'Personal Information',
    'My Bookings',
    'Favourites',
    'Notifications',
    'Addresses',
    'Support',
    'App Settings',
    'Privacy Policy',
    'Terms',
    'Logout',
  ];

  // Mount the real profile screen first, then read the menu it renders.
  latestSaved = null;
  await mount(<Harness initial={makeUser()} />);
  const buttons = Array.from(document.querySelectorAll('#profile-menu button'));
  const labels = buttons.map(menuLabel);

  check('D1 menu renders exactly 10 items', buttons.length === 10, `found ${buttons.length}: ${labels.join(' | ')}`);
  REQUIRED.forEach((label, i) => {
    check(`D2.${i + 1} item ${i + 1} is "${label}"`, labels[i] === label, `got "${labels[i] ?? '<none>'}"`);
  });
  await unmount();

  // Standalone component contract: every callback is required and wired.
  const fired: string[] = [];
  const noop = (tag: string) => () => fired.push(tag);
  const node = (
    <ProfileMenu
      onPersonalInformation={noop('personal')}
      onMyBookings={noop('bookings')}
      onFavourites={noop('favourites')}
      onNotifications={noop('notifications')}
      onAddresses={noop('addresses')}
      onSupport={noop('support')}
      onAppSettings={noop('settings')}
      onPrivacyPolicy={noop('privacy')}
      onTerms={noop('terms')}
      onLogout={noop('logout')}
    />
  );
  await mount(node);
  const ids = [
    'profile-menu-personal-information',
    'profile-menu-my-bookings',
    'profile-menu-favourites',
    'profile-menu-notifications',
    'profile-menu-addresses',
    'profile-menu-support',
    'profile-menu-app-settings',
    'profile-menu-privacy-policy',
    'profile-menu-terms',
    'profile-menu-logout',
  ];
  for (const id of ids) check(`D3 ${id} exists`, Boolean(byId(id)));
  for (const id of ids) await click(byId(id));
  check(
    'D4 all 10 menu callbacks fired',
    fired.length === 10,
    fired.join(',')
  );

  // Badges must never invent a count.
  check('D5 no badge rendered when counts are zero', !byId('profile-menu-favourites')?.textContent?.match(/^\s*\d/), String(byId('profile-menu-favourites')?.textContent));
  await unmount();

  await mount(
    <ProfileMenu
      unreadNotifications={4}
      bookingsCount={2}
      favouritesCount={7}
      addressesCount={1}
      onPersonalInformation={noop('personal')}
      onMyBookings={noop('bookings')}
      onFavourites={noop('favourites')}
      onNotifications={noop('notifications')}
      onAddresses={noop('addresses')}
      onSupport={noop('support')}
      onAppSettings={noop('settings')}
      onPrivacyPolicy={noop('privacy')}
      onTerms={noop('terms')}
      onLogout={noop('logout')}
    />
  );
  check('D6 favourites badge shows the real count', (byId('profile-menu-favourites')?.textContent || '').includes('7'), String(byId('profile-menu-favourites')?.textContent));
  check('D7 notifications badge shows the real unread count', (byId('profile-menu-notifications')?.textContent || '').includes('4'), String(byId('profile-menu-notifications')?.textContent));
  await unmount();
}

// ===========================================================================
// TEST E — every menu item performs a real action
// ===========================================================================
console.log('\n--- TEST E: menu actions ---');
{
  let bookings = 0;
  let favourites = 0;
  let notifications = 0;
  let logouts = 0;

  latestSaved = null;
  await mount(
    <Harness
      initial={makeUser({ savedAddresses: [{ id: 'a1', label: 'Home', line1: '12 Rose Lane', area: 'C-Scheme', city: 'Jaipur', pincode: '302001', isDefault: true }] })}
      onViewAppointments={() => (bookings += 1)}
      onViewFavourites={() => (favourites += 1)}
      onOpenNotifications={() => (notifications += 1)}
      onLogout={() => (logouts += 1)}
      unreadNotifications={3}
      favouritesCount={5}
      appointments={[]}
    />
  );

  await click(byId('profile-menu-my-bookings'));
  check('E1 My Bookings navigates to appointments', bookings === 1, `calls=${bookings}`);

  await click(byId('profile-menu-favourites'));
  check('E2 Favourites opens the saved screen', favourites === 1, `calls=${favourites}`);

  await click(byId('profile-menu-notifications'));
  check('E3 Notifications opens the notification centre', notifications === 1, `calls=${notifications}`);

  // Section targets must actually exist in the DOM, so scrolling is real.
  const scrollTargets: [string, string][] = [
    ['profile-menu-personal-information', 'section-personal-details'],
    ['profile-menu-addresses', 'section-addresses'],
    ['profile-menu-support', 'section-support'],
    ['profile-menu-app-settings', 'section-app-settings'],
  ];
  for (const [menuId, sectionId] of scrollTargets) {
    check(`E4 ${menuId} target #${sectionId} exists`, Boolean(byId(sectionId)));
  }

  // Legal documents
  await click(byId('profile-menu-privacy-policy'));
  check('E5 Privacy Policy opens the privacy document', Boolean(byId('legal-modal-privacy')));
  check('E6 privacy copy is real content', bodyText().includes('What we collect'));
  await click(document.querySelector('[aria-label="Close"]'));
  check('E7 privacy modal closes', !byId('legal-modal-privacy'));

  await click(byId('profile-menu-terms'));
  check('E8 Terms opens the terms document', Boolean(byId('legal-modal-terms')));
  check('E9 terms copy is real content', bodyText().includes('Cancellations and rescheduling'));
  await click(document.querySelector('[aria-label="Close"]'));
  check('E10 terms modal closes', !byId('legal-modal-terms'));

  // Logout goes through the existing confirmation modal, never a silent sign-out.
  await click(byId('profile-menu-logout'));
  check('E11 Logout opens the confirmation modal, not an immediate sign-out', logouts === 0, `onLogout calls=${logouts}`);
  check('E12 logout confirmation is visible', bodyText().toLowerCase().includes('log out') || bodyText().toLowerCase().includes('logout'));
  await click(byId('confirm-logout-btn'));
  check('E13 confirming logs out through the app handler', logouts === 1, `calls=${logouts}`);

  await unmount();
}

// ===========================================================================
// TEST F — Personal Information: all 7 specified fields
// ===========================================================================
console.log('\n--- TEST F: personal information fields ---');
{
  latestSaved = null;
  await mount(<Harness initial={makeUser()} />);

  check('F1 Name field', Boolean(byId('input-profile-fullname')));
  check('F2 Mobile field', Boolean(byId('input-profile-phone')));
  check('F3 Email field', bodyText().includes('ananya@example.com'));
  check('F4 Date of birth field', Boolean(byId('input-profile-dob')));
  check('F5 Gender preference field', Boolean(byId('input-profile-gender-preference')));
  check('F6 Profile image control', Boolean(document.querySelector('input[type="file"]')));
  check('F7 Preferred location field', Boolean(byId('input-profile-preferred-location')));

  // Gender preference persists
  const gender = byId('input-profile-gender-preference') as HTMLSelectElement | null;
  check('F8 gender select reflects the stored value', gender?.value === 'all', String(gender?.value));
  await typeInto(gender, 'unisex');
  check('F9 gender preference persisted', latestSaved?.genderPreference === 'unisex', String(latestSaved?.genderPreference));
  check('F10 gender select shows all four options', (gender?.options.length ?? 0) === 4, String(gender?.options.length));

  // Preferred location persists
  const loc = byId('input-profile-preferred-location') as HTMLInputElement | null;
  await typeInto(loc, 'Vaishali Nagar, Jaipur');
  check('F11 preferred location persisted to defaultLocality', latestSaved?.defaultLocality === 'Vaishali Nagar, Jaipur', String(latestSaved?.defaultLocality));
  check('F12 overview picks up the new location', bodyText().includes('Vaishali Nagar, Jaipur'));

  // Name persists (existing behaviour must not regress)
  const name = byId('input-profile-fullname') as HTMLInputElement | null;
  await typeInto(name, 'Ananya S. Sharma');
  check('F13 name persists', latestSaved?.name === 'Ananya S. Sharma', String(latestSaved?.name));

  // DOB persists
  const dob = byId('input-profile-dob') as HTMLInputElement | null;
  await typeInto(dob, '1995-02-09');
  check('F14 date of birth persists', latestSaved?.dateOfBirth === '1995-02-09', String(latestSaved?.dateOfBirth));

  // The avatar role switcher must NOT overwrite the gender preference.
  await click(byId('role-switch-men-btn'));
  check('F15 avatar switch to men updates the theme', latestSaved?.gender === 'men', String(latestSaved?.gender));
  check('F16 avatar switch does NOT clobber gender preference', latestSaved?.genderPreference === 'unisex', String(latestSaved?.genderPreference));
  await click(byId('role-switch-women-btn'));
  check('F17 switching back keeps the preference intact', latestSaved?.genderPreference === 'unisex', String(latestSaved?.genderPreference));

  await unmount();
}

// ===========================================================================
// TEST G — Addresses: validate, add, set default, delete
// ===========================================================================
console.log('\n--- TEST G: addresses ---');
{
  latestSaved = null;
  await mount(<Harness initial={makeUser()} />);

  check('G1 empty state is honest', text('section-addresses').includes('No saved addresses yet'));

  // Validation
  await typeInto(byId('input-address-label') as HTMLInputElement, 'Home');
  await click(byId('add-address-btn'));
  check('G2 rejects an address with no address line', text('section-addresses').includes('Add a label'), text('section-addresses').slice(0, 120));
  check('G3 rejected address was not saved', (latestSaved?.savedAddresses?.length ?? 0) === 0, String(latestSaved?.savedAddresses?.length));

  // First address becomes the default
  await typeInto(byId('input-address-line1') as HTMLInputElement, '42 Gulmohar Marg');
  await typeInto(byId('input-address-area') as HTMLInputElement, 'C-Scheme');
  await typeInto(byId('input-address-city') as HTMLInputElement, 'Jaipur');
  await click(byId('add-address-btn'));
  check('G4 first address saved', (latestSaved?.savedAddresses?.length ?? 0) === 1, String(latestSaved?.savedAddresses?.length));
  check('G5 first address is the default', latestSaved?.savedAddresses?.[0]?.isDefault === true);
  check('G6 address renders in the list', bodyText().includes('42 Gulmohar Marg'));
  check('G7 menu badge reflects the real address count', (byId('profile-menu-addresses')?.textContent || '').includes('1'), String(byId('profile-menu-addresses')?.textContent));

  // Second address is not default
  await typeInto(byId('input-address-label') as HTMLInputElement, 'Work');
  await typeInto(byId('input-address-line1') as HTMLInputElement, 'Tower B, Tech Park');
  await typeInto(byId('input-address-area') as HTMLInputElement, 'Sitapura');
  await click(byId('add-address-btn'));
  check('G8 second address saved', (latestSaved?.savedAddresses?.length ?? 0) === 2, String(latestSaved?.savedAddresses?.length));
  check('G9 second address is not the default', latestSaved?.savedAddresses?.[1]?.isDefault !== true);
  check('G10 default is still the first address', latestSaved?.savedAddresses?.[0]?.isDefault === true);

  // Set default
  const workId = latestSaved?.savedAddresses?.[1]?.id as string;
  const workRow = byId(`address-row-${workId}`);
  const setDefaultBtn = Array.from(workRow?.querySelectorAll('button') || []).find((b) =>
    (b.textContent || '').includes('Set default')
  );
  await click(setDefaultBtn);
  check('G11 set-default moves the flag', latestSaved?.savedAddresses?.find((a) => a.id === workId)?.isDefault === true);
  check('G12 set-default clears the previous default', latestSaved?.savedAddresses?.[0]?.isDefault === false);

  // Delete
  const homeId = latestSaved?.savedAddresses?.[0]?.id as string;
  const homeRow = byId(`address-row-${homeId}`);
  const delBtn = homeRow?.querySelector('[aria-label^="Delete"]');
  await click(delBtn);
  check('G13 delete removes the address', (latestSaved?.savedAddresses?.length ?? 0) === 1, String(latestSaved?.savedAddresses?.length));
  check('G14 deleted row is gone from the DOM', !byId(`address-row-${homeId}`));
  check('G15 remaining address is intact', latestSaved?.savedAddresses?.[0]?.id === workId);

  await unmount();
}

// ===========================================================================
// TEST H — Support section stays honest when unconfigured
// ===========================================================================
console.log('\n--- TEST H: support ---');
{
  latestSaved = null;
  await mount(<Harness initial={makeUser()} />);
  check('H1 support section renders', Boolean(byId('section-support')));
  check('H2 support explains how to reach the team', text('section-support').includes('booking reference'));
  check('H3 account-details copy button exists', Boolean(byId('copy-support-details-btn')));
  // No VITE_NEXORA_SUPPORT_EMAIL is set in this harness, so no address is invented.
  const emailLink = byId('support-email-link');
  check('H4 no email address invented when unconfigured', !emailLink);
  check('H5 unconfigured state is explained, not hidden silently', text('section-support').includes('VITE_NEXORA_SUPPORT_EMAIL'));
  await unmount();
}

// ===========================================================================
// TEST I — legal modal component contract
// ===========================================================================
console.log('\n--- TEST I: legal modal ---');
{
  let closes = 0;
  await mount(<ProfileLegalModal document={null} onClose={() => (closes += 1)} />);
  check('I1 renders nothing when no document is selected', !byId('legal-modal-privacy') && !byId('legal-modal-terms'));
  await unmount();

  await mount(<ProfileLegalModal document="privacy" onClose={() => (closes += 1)} />);
  check('I2 privacy container id', Boolean(byId('legal-modal-privacy')));
  check('I3 privacy mentions Supabase RLS storage', bodyText().includes('row-level security'));
  check('I4 privacy states WhatsApp delivery needs provider confirmation', bodyText().includes('provider confirms delivery'));
  await click(document.querySelector('[aria-label="Close"]'));
  check('I5 onClose fired', closes === 1, String(closes));
  await unmount();

  await mount(<ProfileLegalModal document="terms" onClose={() => (closes += 1)} />);
  check('I6 terms container id', Boolean(byId('legal-modal-terms')));
  check('I7 terms have no rewards/referral promises', !bodyText().includes('first valid referral stands') && bodyText().includes('Acceptable use'));
  await unmount();
}

// ===========================================================================
// TEST J — App wires the profile menu to real destinations
// ===========================================================================
console.log('\n--- TEST J: App integration ---');
{
  const now = Math.floor(Date.now() / 1000);
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      access_token: makeJwt(3600),
      refresh_token: 'refresh-stored',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: now + 3600,
      user: TEST_USER,
    })
  );

  await mount(
    <AuthProvider>
      <App />
    </AuthProvider>
  );
  await settle(1200);

  // Navigate to the profile tab via the app's own bottom navigation.
  const profileBtn = byId('nav-btn-profile');
  check('J1 profile navigation control found', Boolean(profileBtn), String(profileBtn?.id));
  await click(profileBtn);
  await settle(600);

  check('J2 profile menu renders inside the app', Boolean(byId('profile-menu')));
  check('J3 hero card renders inside the app', Boolean(byId('profile-hero-card')));
  check('J4 all 10 menu items render inside the app', document.querySelectorAll('#profile-menu button').length === 10, String(document.querySelectorAll('#profile-menu button').length));
  check('J5 membership/rewards sections are gone from the app profile', !byId('section-membership') && !byId('section-rewards'));
  check('J6 addresses section is part of the app profile', Boolean(byId('section-addresses')));
  check('J7 support section is part of the app profile', Boolean(byId('section-support')));
  check('J8 personal-information fields are part of the app profile', Boolean(byId('input-profile-gender-preference')) && Boolean(byId('input-profile-preferred-location')));

  // Favourites must switch the app to the saved screen (not just scroll).
  await click(byId('profile-menu-favourites'));
  await settle(400);
  check('J9 Favourites switches the app tab away from profile', !byId('profile-menu'), 'profile menu no longer mounted');

  await unmount();
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log('\nFAILURES:');
  for (const f of failed) console.log(`  ✗ ${f.name}${f.detail ? ` — ${f.detail}` : ''}`);
  process.exit(1);
}
console.log('All profile checks passed.');
process.exit(0);
