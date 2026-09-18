/**
 * Smart Memory Engine — preferences, reminders and the reminder dispatcher.
 *
 *   GET  /api/smart/preferences                 caller's learned preferences (or empty)
 *   PUT  /api/smart/preferences                 client-side learning result (favourites, frequency, insights)
 *   GET  /api/smart/reminders                   caller's reminders (+ `due` subset)
 *   POST /api/smart/reminders/sync              upsert reminders derived from preferences
 *   POST /api/smart/reminders/:id/dismiss       snooze / dismiss
 *   POST /api/smart/reminders/:id/booked        mark converted
 *   POST /api/smart/push/subscribe              store a Web Push / FCM token for the caller
 *   DELETE /api/smart/push/subscribe            remove it
 *   POST /api/smart/reminders/run               cron-only dispatcher (x-cron-secret) — sends due
 *                                               reminders via WhatsApp → SMS → push, marks sent
 *
 * The DB trigger (`bookings_smart_memory_learn`) learns from completed bookings
 * on the server; the PUT endpoint lets the browser merge in local-only signals
 * (favourites, demo appointments). Reads/writes are always scoped to the
 * verified bearer identity. Dispatch uses the service client so it can read the
 * `smart_reminders_due` view (which joins phone numbers).
 */
import express, { Router, Request, Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient, sendWhatsApp, sendSms, sendPush, type SendInput } from './notifications';
import { jsonError } from './bookings';
import { createSupabaseAccountStore, type AccountStore as FullAccountStore } from './userAccount';
type AccountStore = Pick<FullAccountStore, 'verifyAccessToken'>;
import {
  type UserPreferences,
  type SmartReminder,
  buildReminders,
  clampCycle,
  dueReminders,
  emptyPreferences,
  templateReminderMessage,
  toIsoDate,
} from '../src/lib/smartMemory';

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export interface DueReminderRow extends SmartReminder {
  phone: string | null;
  full_name: string | null;
}

export interface PushSubscriptionRow {
  user_id: string;
  provider: 'webpush' | 'fcm';
  endpoint: string;
  token: unknown;
  user_agent?: string | null;
}

export interface SmartStore {
  getPreferences(userId: string): Promise<UserPreferences | null>;
  upsertPreferences(prefs: UserPreferences): Promise<{ ok: boolean; error?: string }>;
  listReminders(userId: string): Promise<SmartReminder[]>;
  upsertReminders(rows: SmartReminder[]): Promise<{ ok: boolean; error?: string }>;
  patchReminder(userId: string, id: string, patch: Partial<SmartReminder> & { sent_at?: string | null; channel?: string | null }): Promise<boolean>;
  listDue(limit: number): Promise<DueReminderRow[]>;
  markSent(id: string, channel: string, message: string): Promise<void>;
  upsertPush(row: PushSubscriptionRow): Promise<{ ok: boolean; error?: string }>;
  deletePush(userId: string, endpoint: string): Promise<void>;
  fcmTokensFor(userId: string): Promise<string[]>;
}

export function createMemorySmartStore(): SmartStore & { prefs: Map<string, UserPreferences>; reminders: SmartReminder[]; pushes: PushSubscriptionRow[]; names: Map<string, { phone: string | null; full_name: string | null }> } {
  const prefs = new Map<string, UserPreferences>();
  const reminders: SmartReminder[] = [];
  const pushes: PushSubscriptionRow[] = [];
  const names = new Map<string, { phone: string | null; full_name: string | null }>();
  return {
    prefs, reminders, pushes, names,
    async getPreferences(u) { return prefs.get(u) ?? null; },
    async upsertPreferences(p) { prefs.set(p.user_id, p); return { ok: true }; },
    async listReminders(u) { return reminders.filter((r) => r.user_id === u); },
    async upsertReminders(rows) {
      for (const row of rows) {
        const i = reminders.findIndex((r) => r.user_id === row.user_id && r.service_type === row.service_type);
        if (i >= 0) reminders[i] = { ...reminders[i], ...row, id: reminders[i].id }; else reminders.push(row);
      }
      return { ok: true };
    },
    async patchReminder(u, id, patch) { const r = reminders.find((x) => x.id === id && x.user_id === u); if (!r) return false; Object.assign(r, patch); return true; },
    async listDue(limit) {
      const today = toIsoDate(new Date());
      return reminders.filter((r) => !r.reminder_sent && !r.dismissed_at && !r.booked_at && r.next_reminder_date <= today).slice(0, limit).map((r) => ({ ...r, ...(names.get(r.user_id) ?? { phone: null, full_name: null }) }));
    },
    async markSent(id, channel, message) { const r = reminders.find((x) => x.id === id); if (r) { r.reminder_sent = true; r.message = message; (r as SmartReminder & { channel?: string }).channel = channel; } },
    async upsertPush(row) { const i = pushes.findIndex((p) => p.user_id === row.user_id && p.endpoint === row.endpoint); if (i >= 0) pushes[i] = row; else pushes.push(row); return { ok: true }; },
    async deletePush(u, endpoint) { const i = pushes.findIndex((p) => p.user_id === u && p.endpoint === endpoint); if (i >= 0) pushes.splice(i, 1); },
    async fcmTokensFor(u) { return pushes.filter((p) => p.user_id === u && p.provider === 'fcm').map((p) => (p.token as { fcmToken?: string })?.fcmToken || p.endpoint); },
  };
}

export function createSupabaseSmartStore(client: SupabaseClient): SmartStore {
  const rowToPrefs = (row: Record<string, unknown>): UserPreferences => ({
    user_id: row.user_id as string,
    favorite_salon_ids: (row.favorite_salon_ids as string[]) ?? [],
    favorite_staff_ids: (row.favorite_staff_ids as string[]) ?? [],
    preferred_services: (row.preferred_services as string[]) ?? [],
    service_frequency: (row.service_frequency as UserPreferences['service_frequency']) ?? {},
    insights: (row.insights as UserPreferences['insights']) ?? {},
    updated_at: (row.updated_at as string) ?? new Date().toISOString(),
  });
  return {
    async getPreferences(u) {
      const { data } = await client.from('user_preferences').select('*').eq('user_id', u).maybeSingle();
      return data ? rowToPrefs(data as Record<string, unknown>) : null;
    },
    async upsertPreferences(p) {
      const { error } = await client.from('user_preferences').upsert({
        user_id: p.user_id, favorite_salon_ids: p.favorite_salon_ids, favorite_staff_ids: p.favorite_staff_ids,
        preferred_services: p.preferred_services, service_frequency: p.service_frequency, insights: p.insights, updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      return error ? { ok: false, error: error.message } : { ok: true };
    },
    async listReminders(u) {
      const { data } = await client.from('smart_reminders').select('*').eq('user_id', u).order('next_reminder_date');
      return (data as SmartReminder[] | null) ?? [];
    },
    async upsertReminders(rows) {
      if (!rows.length) return { ok: true };
      const { error } = await client.from('smart_reminders').upsert(
        rows.map((r) => ({ user_id: r.user_id, service_type: r.service_type, salon_id: r.salon_id, stylist_id: r.stylist_id, last_service_date: r.last_service_date, next_reminder_date: r.next_reminder_date, cycle_days: r.cycle_days, updated_at: new Date().toISOString() })),
        { onConflict: 'user_id,service_type' }
      );
      return error ? { ok: false, error: error.message } : { ok: true };
    },
    async patchReminder(u, id, patch) {
      const { data, error } = await client.from('smart_reminders').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', u).select('id');
      return !error && Array.isArray(data) && data.length > 0;
    },
    async listDue(limit) {
      const { data } = await client.from('smart_reminders_due').select('*').limit(limit);
      return (data as DueReminderRow[] | null) ?? [];
    },
    async markSent(id, channel, message) {
      await client.from('smart_reminders').update({ reminder_sent: true, sent_at: new Date().toISOString(), channel, message, updated_at: new Date().toISOString() }).eq('id', id);
    },
    async upsertPush(row) {
      const { error } = await client.from('push_subscriptions').upsert({ ...row, last_seen_at: new Date().toISOString() }, { onConflict: 'user_id,endpoint' });
      return error ? { ok: false, error: error.message } : { ok: true };
    },
    async deletePush(u, endpoint) { await client.from('push_subscriptions').delete().eq('user_id', u).eq('endpoint', endpoint); },
    async fcmTokensFor(u) {
      const { data } = await client.from('push_subscriptions').select('endpoint,token').eq('user_id', u).eq('provider', 'fcm');
      return ((data as { endpoint: string; token: { fcmToken?: string } }[] | null) ?? []).map((p) => p.token?.fcmToken || p.endpoint);
    },
  };
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const strArr = (v: unknown, max = 50): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length < 120).slice(0, max) : []);

function sanitisePreferences(userId: string, body: unknown): UserPreferences {
  const b = (body && typeof body === 'object' ? body : {}) as Partial<UserPreferences>;
  const freq: UserPreferences['service_frequency'] = {};
  if (b.service_frequency && typeof b.service_frequency === 'object') {
    for (const [k, v] of Object.entries(b.service_frequency).slice(0, 40)) {
      if (!v || typeof v !== 'object') continue;
      freq[k.slice(0, 60)] = {
        count: Math.max(0, Math.floor(Number(v.count) || 0)),
        last_at: /^\d{4}-\d{2}-\d{2}$/.test(String(v.last_at)) ? String(v.last_at) : toIsoDate(new Date()),
        avg_gap_days: clampCycle(Number(v.avg_gap_days) || 45),
        avg_spend: Math.max(0, Number(v.avg_spend) || 0),
        salon_ids: strArr(v.salon_ids, 10),
        stylist_ids: strArr(v.stylist_ids, 10),
      };
    }
  }
  return {
    ...emptyPreferences(userId),
    favorite_salon_ids: strArr(b.favorite_salon_ids),
    favorite_staff_ids: strArr(b.favorite_staff_ids),
    preferred_services: strArr(b.preferred_services, 20),
    service_frequency: freq,
    insights: b.insights && typeof b.insights === 'object' ? b.insights : {},
    updated_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export type ReminderMessageFn = (r: DueReminderRow) => Promise<string>;

export interface DispatchDeps {
  store: SmartStore;
  env: NodeJS.ProcessEnv;
  composeMessage?: ReminderMessageFn;
  whatsapp?: typeof sendWhatsApp;
  sms?: typeof sendSms;
  push?: typeof sendPush;
  limit?: number;
}

/** Send every due reminder once: WhatsApp → SMS → push → in-app. Never double-sends. */
export async function dispatchDueReminders(deps: DispatchDeps) {
  const { store, env } = deps;
  const wa = deps.whatsapp ?? sendWhatsApp;
  const sms = deps.sms ?? sendSms;
  const push = deps.push ?? sendPush;
  const due = await store.listDue(deps.limit ?? 200);
  const results: { id: string; user_id: string; channel: string; accepted: boolean; error?: string }[] = [];

  for (const r of due) {
    const message = deps.composeMessage ? await deps.composeMessage(r).catch(() => templateReminderMessage(r, { customerName: r.full_name ?? undefined })) : templateReminderMessage(r, { customerName: r.full_name ?? undefined });
    const base: Omit<SendInput, 'to'> = { notificationId: r.id, type: 'smart_reminder', title: 'Time for a touch-up?', body: message, payload: { reminderId: r.id, serviceType: r.service_type, salonId: r.salon_id, link: r.salon_id ? `/salon/${r.salon_id}` : '/salons' } };

    let channel = 'in_app';
    let accepted = false;
    let error: string | undefined;

    if (r.phone) {
      const out = await wa({ ...base, to: r.phone }, env);
      if (out.accepted) { channel = 'whatsapp'; accepted = true; } else error = out.error;
      if (!accepted) { const s = await sms({ ...base, to: r.phone }, env); if (s.accepted) { channel = 'sms'; accepted = true; error = undefined; } else error = error || s.error; }
    }
    if (!accepted) {
      for (const token of await store.fcmTokensFor(r.user_id)) {
        const p = await push({ ...base, to: token }, env);
        if (p.accepted) { channel = 'push'; accepted = true; error = undefined; break; }
        error = error || p.error;
      }
    }
    // Always mark as sent so it surfaces in-app and is never re-sent; the channel records what actually went out.
    await store.markSent(r.id, accepted ? channel : 'in_app', message);
    results.push({ id: r.id, user_id: r.user_id, channel: accepted ? channel : 'in_app', accepted, error });
  }
  return { due: due.length, sent: results.filter((x) => x.accepted).length, inAppOnly: results.filter((x) => !x.accepted).length, results };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export function createSmartMemoryRouter(
  env: NodeJS.ProcessEnv = process.env,
  deps: { store?: SmartStore | null; accountStore?: AccountStore | null; composeMessage?: ReminderMessageFn; whatsapp?: typeof sendWhatsApp; sms?: typeof sendSms; push?: typeof sendPush } = {}
): Router {
  const router = Router();
  router.use(express.json({ limit: '256kb' }));
  const { client } = createServiceClient(env);
  const store: SmartStore | null = deps.store !== undefined ? deps.store : client ? createSupabaseSmartStore(client) : null;
  const accountStore: AccountStore | null = deps.accountStore !== undefined ? deps.accountStore : client ? createSupabaseAccountStore(client) : null;

  const authed = async (req: Request, res: Response): Promise<string | null> => {
    if (!store || !accountStore) { res.status(503).json({ error: 'Smart memory is unavailable (service client not configured)', configured: false }); return null; }
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
    if (!token) { jsonError(res, 401, 'Missing access token. Sign in again and retry.'); return null; }
    const v = await accountStore.verifyAccessToken(token);
    if (!v.ok || !v.userId) { jsonError(res, 401, v.error || 'Session expired. Sign in again and retry.'); return null; }
    return v.userId;
  };

  router.get('/preferences', async (req, res) => {
    const userId = await authed(req, res); if (!userId) return;
    res.json({ preferences: (await store!.getPreferences(userId)) ?? emptyPreferences(userId), learned: Boolean(await store!.getPreferences(userId)) });
  });

  router.put('/preferences', async (req, res) => {
    const userId = await authed(req, res); if (!userId) return;
    const prefs = sanitisePreferences(userId, req.body?.preferences ?? req.body);
    const out = await store!.upsertPreferences(prefs);
    if (!out.ok) return jsonError(res, 500, out.error || 'Could not save preferences');
    // Keep reminders in step with the freshest frequency data.
    const existing = await store!.listReminders(userId);
    const reminders = buildReminders(prefs, existing);
    await store!.upsertReminders(reminders);
    res.json({ preferences: prefs, reminders });
  });

  router.get('/reminders', async (req, res) => {
    const userId = await authed(req, res); if (!userId) return;
    const reminders = await store!.listReminders(userId);
    res.json({ reminders, due: dueReminders(reminders) });
  });

  router.post('/reminders/sync', async (req, res) => {
    const userId = await authed(req, res); if (!userId) return;
    const prefs = (await store!.getPreferences(userId)) ?? emptyPreferences(userId);
    const reminders = buildReminders(prefs, await store!.listReminders(userId));
    const out = await store!.upsertReminders(reminders);
    if (!out.ok) return jsonError(res, 500, out.error || 'Could not sync reminders');
    res.json({ reminders, due: dueReminders(reminders) });
  });

  router.post('/reminders/:id/dismiss', async (req, res) => {
    const userId = await authed(req, res); if (!userId) return;
    const snoozeDays = Math.min(60, Math.max(0, Math.floor(Number(req.body?.snoozeDays) || 0)));
    const patch = snoozeDays > 0
      ? { reminder_sent: false, next_reminder_date: toIsoDate(new Date(Date.now() + snoozeDays * 86_400_000)) }
      : { dismissed_at: new Date().toISOString() };
    const ok = await store!.patchReminder(userId, req.params.id, patch);
    if (!ok) return jsonError(res, 404, 'Reminder not found');
    res.json({ ok: true, ...patch });
  });

  router.post('/reminders/:id/booked', async (req, res) => {
    const userId = await authed(req, res); if (!userId) return;
    const ok = await store!.patchReminder(userId, req.params.id, { booked_at: new Date().toISOString() });
    if (!ok) return jsonError(res, 404, 'Reminder not found');
    res.json({ ok: true });
  });

  router.post('/push/subscribe', async (req, res) => {
    const userId = await authed(req, res); if (!userId) return;
    const provider = req.body?.provider === 'fcm' ? 'fcm' : 'webpush';
    const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint.slice(0, 1024) : typeof req.body?.fcmToken === 'string' ? req.body.fcmToken.slice(0, 1024) : '';
    if (!endpoint) return jsonError(res, 400, 'endpoint (Web Push) or fcmToken is required');
    const token = provider === 'fcm' ? { fcmToken: endpoint } : req.body?.subscription ?? { endpoint };
    const out = await store!.upsertPush({ user_id: userId, provider, endpoint, token, user_agent: (req.headers['user-agent'] || '').slice(0, 256) });
    if (!out.ok) return jsonError(res, 500, out.error || 'Could not save subscription');
    res.status(201).json({ ok: true, provider });
  });

  router.delete('/push/subscribe', async (req, res) => {
    const userId = await authed(req, res); if (!userId) return;
    const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint : typeof req.body?.fcmToken === 'string' ? req.body.fcmToken : '';
    if (!endpoint) return jsonError(res, 400, 'endpoint or fcmToken is required');
    await store!.deletePush(userId, endpoint);
    res.json({ ok: true });
  });

  /** Cron entry point. Protect with CRON_SECRET; Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. */
  router.post('/reminders/run', async (req, res) => {
    const secret = (env.CRON_SECRET || '').trim();
    const provided = (req.headers['x-cron-secret'] as string | undefined) || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!secret || provided !== secret) return jsonError(res, 401, 'Cron secret required');
    if (!store) return res.status(503).json({ error: 'Smart memory is unavailable (service client not configured)' });
    const out = await dispatchDueReminders({ store, env, composeMessage: deps.composeMessage, whatsapp: deps.whatsapp, sms: deps.sms, push: deps.push, limit: Math.min(500, Number(req.body?.limit) || 200) });
    res.json(out);
  });

  return router;
}
