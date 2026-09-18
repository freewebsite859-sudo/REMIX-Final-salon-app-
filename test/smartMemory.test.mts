/**
 * Smart Memory Engine — pure core + HTTP router + reminder dispatcher.
 * Run: npm run test:smart-memory
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

import {
  learnPreferences, buildReminders, dueReminders, recommendSalons, templateReminderMessage,
  DEFAULT_REMINDER_CYCLE_DAYS, REMINDER_LEAD_DAYS, addDays, clampCycle,
} from '../src/lib/smartMemory';
import { DEMO_SALONS } from '../src/data/demoCatalog';
import type { Appointment } from '../src/types';
import { createSmartMemoryRouter, createMemorySmartStore, dispatchDueReminders } from '../server/smartMemory';
import { createAiRouter } from '../server/ai';

const TODAY = '2026-09-18';
const USER = 'user-aaaa-bbbb';
const salon1 = DEMO_SALONS[0];
const svc = salon1.services[0];

function apt(date: string, overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: `apt-${date}`, salonId: salon1.id, salonName: salon1.name, salonAddress: 'x', salonImage: 'x',
    services: [svc], stylist: salon1.stylists[0], date, time: '6:30 PM', status: 'completed', totalPrice: svc.price, bookingRef: `NX-${date}`,
    ...overrides,
  } as Appointment;
}

const accountStore = { verifyAccessToken: async (t: string) => (t === 'good' ? { ok: true, userId: USER } : { ok: false, error: 'bad token' }) };

function listen(app: express.Express): Promise<{ server: Server; baseUrl: string }> {
  const server = app.listen(0, '127.0.0.1');
  return new Promise((resolve) => server.once('listening', () => resolve({ server, baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}` })));
}

describe('learnPreferences', () => {
  it('derives frequency, cycle and insights from completed visits', () => {
    const prefs = learnPreferences(USER, [apt('2026-05-01'), apt('2026-06-10'), apt('2026-07-20')], { today: TODAY, favoriteSalonIds: ['salon-2'] });
    const f = prefs.service_frequency[svc.category];
    assert.equal(f.count, 3);
    assert.equal(f.last_at, '2026-07-20');
    assert.equal(f.avg_gap_days, 40);
    assert.deepEqual(f.salon_ids, [salon1.id]);
    assert.deepEqual(prefs.favorite_salon_ids, ['salon-2']);
    assert.equal(prefs.insights.preferred_time_of_day, 'evening');
    assert.equal(prefs.insights.total_visits, 3);
  });

  it('ignores cancelled and future bookings', () => {
    const prefs = learnPreferences(USER, [apt('2026-05-01', { status: 'cancelled' }), apt('2030-01-01', { status: 'confirmed' })], { today: TODAY });
    assert.deepEqual(prefs.service_frequency, {});
  });
});

describe('buildReminders / dueReminders', () => {
  it('uses the default cycle for a single visit and fires with lead time', () => {
    const prefs = learnPreferences(USER, [apt('2026-08-01')], { today: TODAY });
    const [r] = buildReminders(prefs);
    assert.equal(r.cycle_days, DEFAULT_REMINDER_CYCLE_DAYS);
    assert.equal(r.next_reminder_date, addDays('2026-08-01', DEFAULT_REMINDER_CYCLE_DAYS - REMINDER_LEAD_DAYS));
    assert.equal(dueReminders([r], TODAY).length, 1);
    assert.equal(dueReminders([r], '2026-09-01').length, 0);
  });

  it('clamps learned cycles and preserves dismissals for unchanged reminders', () => {
    assert.equal(clampCycle(3), 14);
    assert.equal(clampCycle(400), 120);
    const prefs = learnPreferences(USER, [apt('2026-08-01')], { today: TODAY });
    const [first] = buildReminders(prefs);
    const [again] = buildReminders(prefs, [{ ...first, dismissed_at: '2026-09-10T00:00:00Z' }]);
    assert.equal(again.dismissed_at, '2026-09-10T00:00:00Z');
    assert.equal(dueReminders([again], TODAY).length, 0);
  });
});

describe('recommendSalons', () => {
  it('ranks the visited salon first with reasons and anchors a due reminder', () => {
    const prefs = learnPreferences(USER, [apt('2026-06-01'), apt('2026-07-15')], { today: TODAY });
    const reminders = buildReminders(prefs);
    const recs = recommendSalons(prefs, DEMO_SALONS, reminders, { limit: 3, today: TODAY });
    assert.equal(recs.length, 3);
    assert.equal(recs[0].salon.id, salon1.id);
    assert.ok(recs[0].reasons.length > 0);
    assert.ok(recs.some((r) => r.reminder));
    const msg = templateReminderMessage(reminders[0], { customerName: 'Priya Sharma', salonName: salon1.name });
    assert.match(msg, /Hi Priya!/);
    assert.match(msg, new RegExp(salon1.name));
  });

  it('excludes salons on request', () => {
    const prefs = learnPreferences(USER, [apt('2026-06-01')], { today: TODAY });
    const recs = recommendSalons(prefs, DEMO_SALONS, [], { limit: 5, today: TODAY, excludeSalonIds: [salon1.id] });
    assert.ok(recs.every((r) => r.salon.id !== salon1.id));
  });
});

describe('smart memory router', () => {
  it('requires a bearer token and round-trips preferences → reminders', async () => {
    const store = createMemorySmartStore();
    const app = express();
    app.use('/api/smart', createSmartMemoryRouter({}, { store, accountStore }));
    const { server, baseUrl } = await listen(app);
    try {
      assert.equal((await fetch(`${baseUrl}/api/smart/preferences`)).status, 401);
      assert.equal((await fetch(`${baseUrl}/api/smart/preferences`, { headers: { Authorization: 'Bearer nope' } })).status, 401);

      const prefs = learnPreferences(USER, [apt('2026-08-01')], { today: TODAY });
      const put = await fetch(`${baseUrl}/api/smart/preferences`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer good' }, body: JSON.stringify({ preferences: { ...prefs, user_id: 'someone-else' } }) });
      assert.equal(put.status, 200);
      const body = await put.json();
      assert.equal(body.preferences.user_id, USER, 'identity comes from the token, not the body');
      assert.equal(body.reminders.length, 1);
      assert.equal(store.reminders[0].user_id, USER);

      const list = await (await fetch(`${baseUrl}/api/smart/reminders`, { headers: { Authorization: 'Bearer good' } })).json();
      assert.equal(list.due.length, 1);

      const snooze = await fetch(`${baseUrl}/api/smart/reminders/${list.due[0].id}/dismiss`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer good' }, body: JSON.stringify({ snoozeDays: 7 }) });
      assert.equal(snooze.status, 200);
      const after = await (await fetch(`${baseUrl}/api/smart/reminders`, { headers: { Authorization: 'Bearer good' } })).json();
      assert.equal(after.due.length, 0);

      const notMine = await fetch(`${baseUrl}/api/smart/reminders/rem_nope/dismiss`, { method: 'POST', headers: { Authorization: 'Bearer good' } });
      assert.equal(notMine.status, 404);
    } finally { server.close(); }
  });

  it('stores push subscriptions per user', async () => {
    const store = createMemorySmartStore();
    const app = express();
    app.use('/api/smart', createSmartMemoryRouter({}, { store, accountStore }));
    const { server, baseUrl } = await listen(app);
    try {
      const r = await fetch(`${baseUrl}/api/smart/push/subscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer good' }, body: JSON.stringify({ provider: 'fcm', fcmToken: 'tok-123' }) });
      assert.equal(r.status, 201);
      assert.deepEqual(await store.fcmTokensFor(USER), ['tok-123']);
    } finally { server.close(); }
  });

  it('cron dispatcher needs the secret, sends once via WhatsApp → SMS → push, and never double-sends', async () => {
    const store = createMemorySmartStore();
    store.names.set(USER, { phone: '9876543210', full_name: 'Priya Sharma' });
    const prefs = learnPreferences(USER, [apt('2026-08-01')], { today: TODAY });
    await store.upsertReminders(buildReminders(prefs));
    const sent: string[] = [];
    const whatsapp = async () => { sent.push('whatsapp'); return { accepted: false, provider: 'whatsapp_cloud', error: 'not configured' }; };
    const sms = async (input: { to: string | null; body: string }) => { sent.push(`sms:${input.to}`); return { accepted: true, provider: 'twilio', providerMessageId: 'SM1' }; };
    const push = async () => { sent.push('push'); return { accepted: false, provider: 'fcm_http_v1', error: 'x' }; };

    const app = express();
    app.use('/api/smart', createSmartMemoryRouter({ CRON_SECRET: 's3cret' }, { store, accountStore, whatsapp: whatsapp as never, sms: sms as never, push: push as never, composeMessage: async (r) => `AI copy for ${r.service_type}` }));
    const { server, baseUrl } = await listen(app);
    try {
      assert.equal((await fetch(`${baseUrl}/api/smart/reminders/run`, { method: 'POST' })).status, 401);
      const run = await (await fetch(`${baseUrl}/api/smart/reminders/run`, { method: 'POST', headers: { 'x-cron-secret': 's3cret' } })).json();
      assert.equal(run.due, 1);
      assert.equal(run.sent, 1);
      assert.equal(run.results[0].channel, 'sms');
      assert.deepEqual(sent, ['whatsapp', 'sms:9876543210']);
      assert.equal(store.reminders[0].reminder_sent, true);
      assert.equal(store.reminders[0].message, `AI copy for ${svc.category}`);

      const again = await (await fetch(`${baseUrl}/api/smart/reminders/run`, { method: 'POST', headers: { Authorization: 'Bearer s3cret' } })).json();
      assert.equal(again.due, 0);
    } finally { server.close(); }
  });

  it('dispatcher marks in-app only when no channel accepts', async () => {
    const store = createMemorySmartStore();
    await store.upsertReminders(buildReminders(learnPreferences(USER, [apt('2026-08-01')], { today: TODAY })));
    const reject = async () => ({ accepted: false, provider: 'x', error: 'no' });
    const out = await dispatchDueReminders({ store, env: {}, whatsapp: reject as never, sms: reject as never, push: reject as never });
    assert.equal(out.inAppOnly, 1);
    assert.equal(store.reminders[0].reminder_sent, true);
  });
});

describe('AI router', () => {
  it('returns template recommendations when OpenAI is not configured, and validates input', async () => {
    const app = express();
    app.use(express.json({ limit: '512kb' }));
    app.use('/api/ai', createAiRouter({}));
    const { server, baseUrl } = await listen(app);
    try {
      const cfg = await (await fetch(`${baseUrl}/api/ai/config`)).json();
      assert.equal(cfg.configured, false);
      const bad = await fetch(`${baseUrl}/api/ai/recommendations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      assert.equal(bad.status, 400);
      const prefs = learnPreferences(USER, [apt('2026-07-01')], { today: TODAY });
      const ok = await (await fetch(`${baseUrl}/api/ai/recommendations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ preferences: prefs, reminders: buildReminders(prefs), salons: DEMO_SALONS, limit: 3 }) })).json();
      assert.equal(ok.source, 'template');
      assert.equal(ok.recommendations.length, 3);
      assert.equal(ok.recommendations[0].salonId, salon1.id);
      assert.ok(typeof ok.headline === 'string' && ok.headline.length > 0);
    } finally { server.close(); }
  });

  it('uses the injected chat model and falls back on malformed JSON', async () => {
    const prefs = learnPreferences(USER, [apt('2026-07-01')], { today: TODAY });
    const good = async () => ({ ok: true as const, model: 'fake', text: JSON.stringify({ headline: 'Your Friday glow-up', picks: [{ id: DEMO_SALONS[2].id, reason: 'Great skin studio near you' }] }) });
    const junk = async () => ({ ok: true as const, model: 'fake', text: 'not json' });
    for (const [chat, expectSource] of [[good, 'openai'], [junk, 'template']] as const) {
      const app = express();
      app.use(express.json({ limit: '512kb' }));
      app.use('/api/ai', createAiRouter({ OPENAI_API_KEY: 'sk-test' }, { chat }));
      const { server, baseUrl } = await listen(app);
      try {
        const out = await (await fetch(`${baseUrl}/api/ai/recommendations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ preferences: prefs, salons: DEMO_SALONS, limit: 3 }) })).json();
        assert.equal(out.source, expectSource);
        if (expectSource === 'openai') { assert.equal(out.headline, 'Your Friday glow-up'); assert.equal(out.recommendations[0].salonId, DEMO_SALONS[2].id); }
      } finally { server.close(); }
    }
  });
});
