/**
 * Nexora notifications — integration harness.
 *
 * Runs the REAL <App/>, the REAL <NotificationsModal/>, the REAL
 * notificationService / notificationChannels and the REAL Express notification
 * router against a stubbed Supabase endpoint and stubbed providers.
 *
 * Verified guarantees
 * -------------------
 *   1. notifications come from the database — never fabricated sample rows
 *   2. read / unread, mark-all-read and delete all write through to the backend
 *   3. opening a notification deep-links to the related screen
 *   4. the header badge is driven by the real unread count
 *   5. preferences persist to notification_preferences
 *   6. channel dispatch respects preferences and logs each attempt
 *   7. NOTHING is ever reported as delivered without a provider status —
 *      client-side and server-side both refuse, and the API says so
 *   8. unverified provider callbacks are rejected
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { act } from 'react';
import express from 'express';

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

const db = {
  notifications: [
    {
      id: 'n-1',
      user_id: USER_ID,
      type: 'booking_confirmed',
      title: 'Booking confirmed at Scissors & Shears',
      body: 'Your haircut with Aarav is confirmed for today at 5:30 PM.',
      payload: { route: 'appointments', appointmentId: 'apt-1' },
      is_read: false,
      read_at: null,
      created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    },
    {
      id: 'n-2',
      user_id: USER_ID,
      type: 'reward_credited',
      title: '450 reward points credited',
      body: 'Points added for your completed spa appointment.',
      payload: { route: 'rewards' },
      is_read: false,
      read_at: null,
      created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'n-3',
      user_id: USER_ID,
      type: 'offer',
      title: '20% off Hydra Facial this weekend',
      body: 'Use code NEXORA20 on your next booking.',
      payload: { route: 'offers' },
      is_read: true,
      read_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    },
  ] as Record<string, unknown>[],
  preferences: [] as Record<string, unknown>[],
  deliveries: [] as Record<string, unknown>[],
  /** Flip to simulate a project without the notification tables. */
  tablesAvailable: true,
};

interface Recorded {
  method: string;
  url: string;
  body: unknown;
}
const requests: Recorded[] = [];

function b64urlJson(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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
  user_metadata: { full_name: 'Nexora Client' },
  app_metadata: {},
};
function persistSession() {
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
}

// ---------------------------------------------------------------------------
// Supabase HTTP stub
// ---------------------------------------------------------------------------
const originalFetch = globalThis.fetch;
/** Kept so tests can call the real local Express server, bypassing the stub. */
const realFetch = originalFetch;
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

  if (!db.tablesAvailable && url.includes('/rest/v1/notification')) {
    return json({ code: '42P01', message: 'relation "public.notifications" does not exist' }, 404);
  }

  // ---- Auth ---------------------------------------------------------------
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

  // ---- RPCs ---------------------------------------------------------------
  if (url.includes('/rest/v1/rpc/mark_all_notifications_read')) {
    let updated = 0;
    for (const row of db.notifications) {
      if (row.is_read === false) {
        row.is_read = true;
        row.read_at = new Date().toISOString();
        updated += 1;
      }
    }
    return json(updated);
  }
  if (url.includes('/rest/v1/rpc/unread_notification_count')) {
    return json(db.notifications.filter((n) => n.is_read === false).length);
  }

  // ---- notifications table ------------------------------------------------
  if (url.includes('/rest/v1/notifications')) {
    if (method === 'GET') {
      const idMatch = url.match(/[?&]id=eq\.([^&]+)/);
      let rows = [...db.notifications];
      if (idMatch) rows = rows.filter((r) => r.id === decodeURIComponent(idMatch[1]));
      if (url.includes('is_read=eq.false')) rows = rows.filter((r) => r.is_read === false);
      return json(rows);
    }
    if (method === 'PATCH') {
      const idMatch = url.match(/[?&]id=eq\.([^&]+)/);
      const patch = (Array.isArray(body) ? body[0] : body) as Record<string, unknown>;
      const targets = db.notifications.filter((r) => !idMatch || r.id === decodeURIComponent(idMatch[1]));
      for (const row of targets) Object.assign(row, patch);
      return json([]);
    }
    if (method === 'DELETE') {
      const idMatch = url.match(/[?&]id=eq\.([^&]+)/);
      const before = db.notifications.length;
      db.notifications = db.notifications.filter(
        (r) => !idMatch || r.id !== decodeURIComponent(idMatch[1])
      );
      return json([], 200);
    }
    if (method === 'POST') {
      const payload = (Array.isArray(body) ? body[0] : body) as Record<string, unknown>;
      const row = {
        id: `n-${db.notifications.length + 1}`,
        is_read: false,
        read_at: null,
        created_at: new Date().toISOString(),
        ...payload,
      };
      db.notifications.unshift(row);
      return json([row], 201);
    }
  }

  // ---- preferences --------------------------------------------------------
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

  // ---- delivery log -------------------------------------------------------
  if (url.includes('/rest/v1/notification_deliveries')) {
    if (method === 'POST') {
      const rows = (Array.isArray(body) ? body : [body]) as Record<string, unknown>[];
      // Mirror the DB check: a client may never assert delivery.
      for (const row of rows) {
        if (row.status === 'delivered') {
          return json(
            { code: '23514', message: 'notification_deliveries_delivery_requires_proof' },
            400
          );
        }
      }
      db.deliveries.push(...rows);
      return json(rows, 201);
    }
    return json(db.deliveries);
  }

  return json([]);
}) as typeof fetch;

Object.defineProperty(navigator, 'geolocation', {
  value: { watchPosition: () => 1, clearWatch: () => undefined, getCurrentPosition: () => undefined },
  configurable: true,
});

// ---------------------------------------------------------------------------
// Modules under test
// ---------------------------------------------------------------------------
const { AuthProvider } = await import('../src/providers/AuthProvider');
const App = (await import('../src/App')).default;
const notificationService = await import('../src/lib/notificationService');
const channels = await import('../src/lib/notificationChannels');
const serverNotifications = await import('../server/notifications');

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
    root!.render(React.createElement(AuthProvider, null, React.createElement(App)));
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
const byId = (id: string) => document.getElementById(id);
const bodyText = () => document.body.textContent || '';
function click(el: Element | null) {
  if (!el) throw new Error('element missing for click');
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
}
function buttonByText(label: string): HTMLElement | null {
  return (
    (Array.from(document.querySelectorAll('button')).find((b) =>
      (b.textContent || '').includes(label)
    ) as HTMLElement | undefined) ?? null
  );
}
const callsTo = (fragment: string) => requests.filter((r) => r.url.includes(fragment));

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------
async function run() {
  // =========================================================================
  // 1. In-app inbox renders database rows (no fabricated content)
  // =========================================================================
  localStorage.clear();
  sessionStorage.clear();
  persistSession();
  history.replaceState({}, '', '/');
  requests.length = 0;
  await mount();

  check('signed-in session restored', Boolean(byId('header-notifications-btn')));
  check(
    'notifications fetched from the database',
    callsTo('/rest/v1/notifications').some((r) => r.method === 'GET')
  );

  await act(async () => {
    click(byId('header-notifications-btn'));
    await sleep(400);
  });

  check('notification centre opens', Boolean(byId('notifications-modal-container')));
  check('row 1 from database rendered', bodyText().includes('Booking confirmed at Scissors & Shears'));
  check('row 2 from database rendered', bodyText().includes('450 reward points credited'));
  check('row 3 from database rendered', bodyText().includes('20% off Hydra Facial this weekend'));
  check(
    'no fabricated sample rows (old demo copy gone)',
    !bodyText().includes('Appointment in 2 hours!')
  );
  check('unread badge shows real count', byId('notifications-unread-badge')?.textContent === '2 new', String(byId('notifications-unread-badge')?.textContent));

  // =========================================================================
  // 2. Mark single as read
  // =========================================================================
  requests.length = 0;
  await act(async () => {
    click(buttonByText('Mark read'));
    await sleep(400);
  });
  const readPatches = callsTo('/rest/v1/notifications').filter((r) => r.method === 'PATCH');
  check('mark-read writes to the database', readPatches.length >= 1, `patches=${readPatches.length}`);
  check(
    'mark-read payload sets is_read',
    JSON.stringify(readPatches[0]?.body ?? {}).includes('"is_read":true'),
    JSON.stringify(readPatches[0]?.body ?? {})
  );

  // =========================================================================
  // 3. Open related screen (deep link) — reward → Profile rewards section
  // =========================================================================
  await act(async () => {
    const rewardRow = Array.from(document.querySelectorAll('[role="button"]')).find((el) =>
      (el.textContent || '').includes('450 reward points credited')
    );
    click((rewardRow as HTMLElement) ?? null);
    await sleep(500);
  });
  check('notification click closes the centre', !byId('notifications-modal-container'));
  check(
    'reward notification deep-links to the profile rewards section',
    bodyText().includes('Refer a Friend & Rewards Club'),
    bodyText().slice(0, 80)
  );

  // =========================================================================
  // 4. Deep link — booking → Appointments screen
  // =========================================================================
  await act(async () => {
    click(byId('header-notifications-btn'));
    await sleep(400);
  });
  check('notification centre re-opens from another tab', Boolean(byId('notifications-modal-container')));
  await act(async () => {
    const bookingRow = Array.from(document.querySelectorAll('[role="button"]')).find((el) =>
      (el.textContent || '').includes('Booking confirmed at Scissors & Shears')
    );
    click((bookingRow as HTMLElement) ?? null);
    await sleep(500);
  });
  check('booking notification deep-links to Appointments', bodyText().includes('My Appointments'));

  // =========================================================================
  // 5. Mark all as read
  // =========================================================================
  // Earlier steps read individual rows, so put the inbox back into a genuine
  // unread state and reload the panel before exercising the bulk action.
  for (const row of db.notifications) {
    row.is_read = false;
    row.read_at = null;
  }
  // The previous deep-link already closed the panel; close it here only if a
  // prior step left it open, then reopen so the panel refetches from the DB.
  if (byId('notifications-modal-container')) {
    await act(async () => {
      click(document.querySelector('[aria-label="Close notifications"]'));
      await sleep(200);
    });
  }
  check('panel closed before reload', !byId('notifications-modal-container'));
  await act(async () => {
    click(byId('header-notifications-btn'));
    await sleep(600);
  });
  check(
    'unread rows reloaded from the database',
    Boolean(byId('notifications-unread-badge')),
    String(byId('notifications-unread-badge')?.textContent)
  );
  requests.length = 0;
  await act(async () => {
    click(byId('notifications-mark-all-read'));
    await sleep(500);
  });
  check(
    'mark-all-read calls the backend',
    callsTo('/rest/v1/rpc/mark_all_notifications_read').length >= 1 ||
      callsTo('/rest/v1/notifications').some((r) => r.method === 'PATCH')
  );
  check('unread badge cleared after mark-all-read', !byId('notifications-unread-badge'));

  // =========================================================================
  // 6. Delete
  // =========================================================================
  requests.length = 0;
  const rowsBefore = db.notifications.length;
  await act(async () => {
    click(buttonByText('Delete'));
    await sleep(400);
  });
  check('delete issues a DELETE to the database', callsTo('/rest/v1/notifications').some((r) => r.method === 'DELETE'));
  check('row removed from the store', db.notifications.length === rowsBefore - 1, `${rowsBefore} -> ${db.notifications.length}`);
  await unmount();

  // =========================================================================
  // 6. Empty + unavailable states show no placeholder content
  // =========================================================================
  db.notifications = [];
  localStorage.clear();
  persistSession();
  await mount();
  await act(async () => {
    click(byId('header-notifications-btn'));
    await sleep(400);
  });
  check('empty state when the database has no rows', bodyText().includes('No notifications yet'));

  await unmount();
  db.tablesAvailable = false;
  localStorage.clear();
  persistSession();
  await mount();
  await act(async () => {
    click(byId('header-notifications-btn'));
    await sleep(500);
  });
  check(
    'backend outage is reported honestly, not faked',
    bodyText().includes('Notifications are unavailable') || bodyText().includes('unavailable'),
    bodyText().slice(0, 120)
  );
  await unmount();
  db.tablesAvailable = true;

  // =========================================================================
  // 7. Preferences persist to the database
  // =========================================================================
  db.preferences = [];
  const prefResult = await notificationService.saveNotificationPreference({
    userId: USER_ID,
    channel: 'whatsapp',
    category: 'booking_confirmed',
    enabled: false,
  });
  check('preference write succeeds', prefResult.ok === true, String(prefResult.error));
  check(
    'preference row stored with channel+category',
    db.preferences.some(
      (p) => p.channel === 'whatsapp' && p.category === 'booking_confirmed' && p.enabled === false
    ),
    JSON.stringify(db.preferences)
  );

  const prefs = await notificationService.fetchNotificationPreferences(USER_ID);
  check(
    'preference read back disables only that channel/category',
    prefs.ok === true &&
      prefs.data !== undefined &&
      notificationService.isChannelEnabled(prefs.data!, 'whatsapp', 'booking_confirmed') === false &&
      notificationService.isChannelEnabled(prefs.data!, 'email', 'booking_confirmed') === true
  );
  check(
    'channel master switch overrides categories',
    notificationService.isChannelEnabled(
      { matrix: { whatsapp: { all: false } }, loaded: true },
      'whatsapp',
      'offer'
    ) === false
  );

  // =========================================================================
  // 8. Channel dispatch honours preferences + logs attempts
  // =========================================================================
  const notification = notificationService.mapNotificationRow(db.notifications[0] ?? {
    id: 'n-dispatch',
    user_id: USER_ID,
    type: 'booking_confirmed',
    title: 'Booking confirmed',
    body: 'Test body',
    payload: { route: 'appointments' },
    is_read: false,
    read_at: null,
    created_at: new Date().toISOString(),
  })!;
  db.deliveries = [];
  requests.length = 0;

  const outcome = await channels.dispatchNotification({
    notification,
    preferences: { matrix: { email: { booking_confirmed: false } }, loaded: true },
    contacts: { email: 'client@nexora.test', whatsapp: '+919000012345', push: null },
  });

  const byChannel = (c: string) => outcome.results.find((r) => r.channel === c);
  check('in_app channel recorded', byChannel('in_app')?.status === 'sent', JSON.stringify(byChannel('in_app')));
  check('email skipped because the user opted out', byChannel('email')?.status === 'skipped', JSON.stringify(byChannel('email')));
  check('push skipped with no device token', byChannel('push')?.status === 'skipped', JSON.stringify(byChannel('push')));
  check(
    'whatsapp attempt logged (provider not configured in this harness)',
    byChannel('whatsapp')?.status === 'failed' || byChannel('whatsapp')?.status === 'sent',
    JSON.stringify(byChannel('whatsapp'))
  );
  check(
    'every attempt written to the delivery log',
    db.deliveries.length >= 3,
    `deliveries=${db.deliveries.length}`
  );
  check(
    'no delivery is claimed without provider confirmation',
    outcome.confirmedChannels.length === 0 &&
      db.deliveries.every((d) => d.status !== 'delivered'),
    JSON.stringify(db.deliveries.map((d) => d.status))
  );

  // =========================================================================
  // 9. Delivery confirmation requires real provider proof
  // =========================================================================
  const refused = await channels.markDelivered({
    notificationId: notification.id,
    channel: 'whatsapp',
    providerMessageId: null,
    providerStatus: null,
  });
  check('client refuses to mark delivered without provider status', refused.ok === false, String(refused.error));

  const accepted = await channels.applyProviderDeliveryStatus({
    notificationId: notification.id,
    channel: 'whatsapp',
    providerMessageId: null,
    providerStatus: 'delivered',
  });
  check(
    'provider "delivered" callback without a message id is refused',
    accepted.ok === false && accepted.status === 'unchanged',
    `${accepted.ok}/${accepted.status}`
  );

  const unknownStatus = await channels.applyProviderDeliveryStatus({
    notificationId: notification.id,
    channel: 'whatsapp',
    providerMessageId: 'wamid.123',
    providerStatus: 'maybe-delivered',
  });
  check('unrecognised provider status is ignored', unknownStatus.ok === false, String(unknownStatus.error));

  // The stubbed database enforces the proof constraint too.
  const forged = await (async () => {
    const client = (await import('../src/lib/supabase')).supabase;
    return client!
      .from('notification_deliveries')
      .insert({
        notification_id: notification.id,
        channel: 'whatsapp',
        status: 'delivered',
      });
  })();
  check(
    'database rejects a delivered row with no proof',
    Boolean(forged.error),
    String(forged.error?.message)
  );

  // =========================================================================
  // 10. Server: provider endpoints + webhook security
  // =========================================================================
  const app = express();
  app.use('/api/notifications', serverNotifications.createNotificationsRouter({} as NodeJS.ProcessEnv));
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const port = (server.address() as { port: number }).port;
  const base = `http://127.0.0.1:${port}`;

  const waSend = await realFetch(`${base}/api/notifications/whatsapp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notificationId: 'n-1', title: 'Hi', body: 'There', to: '+919000012345' }),
  });
  const waSendBody = (await waSend.json()) as Record<string, unknown>;
  check(
    'WhatsApp send without credentials reports not configured (503)',
    waSend.status === 503 && waSendBody.configured === false && waSendBody.accepted === false,
    `${waSend.status} ${JSON.stringify(waSendBody)}`
  );
  check(
    'server never reports delivery for an unconfigured channel',
    waSendBody.status !== 'delivered' && waSendBody.deliveryConfirmed !== true
  );

  const waSendMissingId = await realFetch(`${base}/api/notifications/whatsapp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Hi' }),
  });
  check('send without notificationId is rejected (400)', waSendMissingId.status === 400);

  const config = (await (await realFetch(`${base}/api/notifications/config`)).json()) as {
    channels: Record<string, boolean>;
  };
  check(
    'config endpoint reports in_app available and providers unconfigured',
    config.channels.in_app === true &&
      config.channels.whatsapp === false &&
      config.channels.email === false &&
      config.channels.push === false,
    JSON.stringify(config.channels)
  );

  const unverified = await realFetch(`${base}/api/notifications/webhooks/whatsapp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.X', status: 'delivered' }] } }] }],
    }),
  });
  check(
    'unverified delivery callback is rejected (401)',
    unverified.status === 401,
    `status=${unverified.status}`
  );

  const verifyHandshake = await realFetch(
    `${base}/api/notifications/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=abc&hub.challenge=1234`
  );
  check(
    'provider verification handshake fails closed without a configured token',
    verifyHandshake.status === 503,
    `status=${verifyHandshake.status}`
  );

  server.close();

  // Server-side helpers: signature + status mapping + confirmation guard
  const secret = 'test-app-secret';
  const raw = '{"entry":[]}';
  const goodSig = `sha256=${(await import('crypto'))
    .createHmac('sha256', secret)
    .update(raw)
    .digest('hex')}`;
  check(
    'valid Meta signature is accepted',
    serverNotifications.verifyMetaSignature(raw, goodSig, secret).verified === true
  );
  check(
    'tampered signature is rejected',
    serverNotifications.verifyMetaSignature(raw, 'sha256=deadbeef', secret).verified === false
  );
  check(
    'provider status mapping: read/delivered → delivered, sent → sent, junk → null',
    serverNotifications.mapProviderStatus('read') === 'delivered' &&
      serverNotifications.mapProviderStatus('sent') === 'sent' &&
      serverNotifications.mapProviderStatus('nonsense') === null
  );
  const statuses = serverNotifications.extractWhatsAppStatuses({
    entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.1', status: 'delivered' }] } }] }],
  });
  check('status callback payload parsed', statuses.length === 1 && statuses[0].id === 'wamid.1');

  const confirmWithoutProof = await serverNotifications.confirmDelivery(null, {
    providerMessageId: '',
    channel: 'whatsapp',
    providerStatus: '',
  });
  check('server refuses confirmation without proof', confirmWithoutProof.ok === false, String(confirmWithoutProof.error));

  // =========================================================================
  // 11. Pure helpers
  // =========================================================================
  check(
    'all 11 notification types have presentation metadata',
    notificationService.NOTIFICATION_TYPES.length === 11 &&
      notificationService.NOTIFICATION_TYPES.every((t) => Boolean(notificationService.NOTIFICATION_META[t].icon))
  );
  check('unknown type rejected by the row mapper', notificationService.mapNotificationRow({ id: 'x', type: 'bogus' }) === null);
  check(
    'relative time formatting',
    notificationService.formatNotificationTime(new Date(Date.now() - 5 * 60 * 1000).toISOString()) === '5 min ago'
  );
  check(
    'deep-link target resolution',
    notificationService.resolveNotificationTarget({
      id: 'x',
      userId: USER_ID,
      type: 'booking_reminder',
      title: 't',
      body: 'b',
      payload: { route: 'appointments', appointmentId: 'apt-9' },
      isRead: false,
      readAt: null,
      createdAt: new Date().toISOString(),
    })?.tab === 'appointments'
  );

  // =========================================================================
  globalThis.fetch = originalFetch;
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} notification checks passed`);
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
