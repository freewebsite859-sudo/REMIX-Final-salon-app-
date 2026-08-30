import type { SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './supabase';

/**
 * Nexora notification service — database-backed notifications.
 *
 * The database is the ONLY source of truth. Nothing in this module fabricates
 * notifications: when the backend is unreachable the caller receives
 * `disabled: true` and the UI shows an honest empty state instead of sample
 * content.
 *
 * Security: every query runs through the shared client with the signed-in
 * user's JWT, so RLS confines a user to their own rows. No service_role key is
 * ever used in the browser (trusted producers and provider webhooks live on the
 * server — see server/notifications.ts).
 */

function readEnv(name: string): string | undefined {
  const viteEnv =
    (import.meta as unknown as { env?: Record<string, string | undefined> })?.env || {};
  const fromVite = viteEnv[name];
  if (fromVite) return fromVite;
  const nodeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env;
  return nodeEnv?.[name];
}

export const NOTIFICATIONS_TABLE =
  readEnv('VITE_NEXORA_NOTIFICATIONS_TABLE')?.trim() || 'notifications';
export const NOTIFICATION_PREFERENCES_TABLE =
  readEnv('VITE_NEXORA_NOTIFICATION_PREFERENCES_TABLE')?.trim() || 'notification_preferences';
export const NOTIFICATION_DELIVERIES_TABLE =
  readEnv('VITE_NEXORA_NOTIFICATION_DELIVERIES_TABLE')?.trim() || 'notification_deliveries';

/** Every notification type the product emits. */
export const NOTIFICATION_TYPES = [
  'booking_created',
  'booking_confirmed',
  'booking_rejected',
  'booking_rescheduled',
  'booking_reminder',
  'booking_cancelled',
  'reward_credited',
  'referral_qualified',
  'membership_expiry',
  'offer',
  'support_response',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Delivery channels. `in_app` is the notification row itself. */
export const NOTIFICATION_CHANNELS = ['in_app', 'email', 'whatsapp', 'push'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

/**
 * Delivery lifecycle.
 *
 * `delivered` is reserved for a CONFIRMED provider status (a WhatsApp/SMS
 * status webhook, an FCM receipt, an SES bounce-free notification). Acceptance
 * by a provider API is only ever `sent`; `delivered` is never set optimistically
 * — the database rejects such a row.
 */
export const DELIVERY_STATUSES = [
  'queued',
  'sent',
  'failed',
  'delivered',
  'undeliverable',
  'skipped',
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

/** Screens a notification can deep-link to. */
export const NOTIFICATION_ROUTES = [
  'appointments',
  'booking',
  'rewards',
  'referrals',
  'membership',
  'offers',
  'support',
  'profile',
  'home',
] as const;
export type NotificationRoute = (typeof NOTIFICATION_ROUTES)[number];

export interface NotificationPayload {
  route?: NotificationRoute;
  appointmentId?: string;
  salonId?: string;
  offerId?: string;
  referralCode?: string;
  ticketId?: string;
  /** Provider message ids recorded once a channel accepts the message. */
  [key: string]: unknown;
}

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  payload: NotificationPayload;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPreferences {
  /** channel → category(type|'all') → enabled. Missing entries default to true. */
  matrix: Record<string, Record<string, boolean>>;
  loaded: boolean;
  disabled?: boolean;
}

/**
 * Service result envelope.
 *
 * Deliberately a single flat interface rather than a discriminated union: this
 * project compiles without `strict`/`strictNullChecks`, and in that mode
 * TypeScript does not narrow `ok: true | ok: false` unions — every call site
 * would need a cast. Callers check `ok`, then read `data` / `error`.
 *
 * `disabled: true` means the notification backend is absent or unreachable, so
 * the UI must show an honest empty state instead of sample content.
 */
export interface NotificationResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  disabled?: boolean;
}

/** Presentation metadata: icon + default copy per type. */
export const NOTIFICATION_META: Record<
  NotificationType,
  { icon: string; route: NotificationRoute; label: string }
> = {
  booking_created: { icon: 'event_available', route: 'appointments', label: 'Booking created' },
  booking_confirmed: { icon: 'verified', route: 'appointments', label: 'Booking confirmed' },
  booking_rejected: { icon: 'event_busy', route: 'appointments', label: 'Booking rejected' },
  booking_rescheduled: { icon: 'event_repeat', route: 'appointments', label: 'Booking rescheduled' },
  booking_reminder: { icon: 'schedule', route: 'appointments', label: 'Appointment reminder' },
  booking_cancelled: { icon: 'cancel', route: 'appointments', label: 'Booking cancelled' },
  reward_credited: { icon: 'stars', route: 'rewards', label: 'Reward credited' },
  referral_qualified: { icon: 'redeem', route: 'referrals', label: 'Referral qualified' },
  membership_expiry: { icon: 'card_membership', route: 'membership', label: 'Membership expiry' },
  offer: { icon: 'local_offer', route: 'offers', label: 'Offer' },
  support_response: { icon: 'support_agent', route: 'support', label: 'Support response' },
};

export function isNotificationType(value: unknown): value is NotificationType {
  return typeof value === 'string' && (NOTIFICATION_TYPES as readonly string[]).includes(value);
}

export function isNotificationRoute(value: unknown): value is NotificationRoute {
  return typeof value === 'string' && (NOTIFICATION_ROUTES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Row mapping / sanitizing (never trust the shape coming back from the network)
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizePayload(value: unknown): NotificationPayload {
  if (!isRecord(value)) return {};
  const payload: NotificationPayload = {};
  if (isNotificationRoute(value.route)) payload.route = value.route;
  for (const key of ['appointmentId', 'salonId', 'offerId', 'referralCode', 'ticketId'] as const) {
    if (typeof value[key] === 'string') payload[key] = value[key] as string;
  }
  return payload;
}

export function mapNotificationRow(row: unknown): AppNotification | null {
  if (!isRecord(row) || typeof row.id !== 'string') return null;
  const type = isNotificationType(row.type) ? row.type : null;
  if (!type) return null;
  return {
    id: row.id,
    userId: typeof row.user_id === 'string' ? row.user_id : '',
    type,
    title: typeof row.title === 'string' && row.title ? row.title : NOTIFICATION_META[type].label,
    body: typeof row.body === 'string' ? row.body : '',
    payload: { route: NOTIFICATION_META[type].route, ...sanitizePayload(row.payload) },
    isRead: row.is_read === true,
    readAt: typeof row.read_at === 'string' ? row.read_at : null,
    createdAt: typeof row.created_at === 'string' ? row.created_at : new Date(0).toISOString(),
  };
}

/** Postgres/PostgREST codes meaning "this backend will never serve this call". */
const FATAL_CODES = new Set([
  '42P01', // undefined_table
  '42703', // undefined_column
  '42501', // insufficient_privilege (RLS denial)
  'PGRST204',
  'PGRST205',
  'PGRST301',
]);

function errorCode(error: unknown): string {
  return String((error as { code?: unknown } | null)?.code ?? '');
}

export function isBackendUnavailable(error: unknown): boolean {
  const message = String((error as { message?: unknown } | null)?.message ?? '').toLowerCase();
  return (
    FATAL_CODES.has(errorCode(error)) ||
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('row-level security')
  );
}

function clientOrFallback(client?: SupabaseClient | null): SupabaseClient | null {
  const resolved = client === undefined ? supabase : client;
  return resolved && isSupabaseConfigured ? resolved : null;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function listNotifications(
  userId: string,
  options: { limit?: number; unreadOnly?: boolean; client?: SupabaseClient | null } = {}
): Promise<NotificationResult<AppNotification[]>> {
  const client = clientOrFallback(options.client);
  if (!client) return { ok: false, error: 'Supabase not configured', disabled: true };
  if (!userId) return { ok: false, error: 'Missing user id' };

  const { limit = 50, unreadOnly = false } = options;
  try {
    let query = client
      .from(NOTIFICATIONS_TABLE)
      .select('id,user_id,type,title,body,payload,is_read,read_at,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 200));
    if (unreadOnly) query = query.eq('is_read', false);

    const { data, error } = await query;
    if (error) {
      return {
        ok: false,
        error: error.message,
        disabled: isBackendUnavailable(error),
      };
    }
    const rows = (data ?? []).map(mapNotificationRow).filter((n): n is AppNotification => n !== null);
    return { ok: true, data: rows };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message || 'Notification fetch failed' };
  }
}

/**
 * Unread count. Prefers an exact count query; falls back to counting rows so a
 * project without the helper RPC still works.
 */
export async function unreadNotificationCount(
  userId: string,
  options: { client?: SupabaseClient | null } = {}
): Promise<NotificationResult<number>> {
  const client = clientOrFallback(options.client);
  if (!client) return { ok: false, error: 'Supabase not configured', disabled: true };
  if (!userId) return { ok: false, error: 'Missing user id' };

  try {
    const { count, error } = await client
      .from(NOTIFICATIONS_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    if (error) return { ok: false, error: error.message, disabled: isBackendUnavailable(error) };
    return { ok: true, data: count ?? 0 };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message || 'Unread count failed' };
  }
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export async function markNotificationRead(
  notificationId: string,
  options: { userId?: string; client?: SupabaseClient | null } = {}
): Promise<NotificationResult<boolean>> {
  const client = clientOrFallback(options.client);
  if (!client) return { ok: false, error: 'Supabase not configured', disabled: true };
  if (!notificationId) return { ok: false, error: 'Missing notification id' };

  try {
    let query = client
      .from(NOTIFICATIONS_TABLE)
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId);
    if (options.userId) query = query.eq('user_id', options.userId);

    const { error } = await query;
    if (error) return { ok: false, error: error.message, disabled: isBackendUnavailable(error) };
    return { ok: true, data: true };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message || 'Mark-read failed' };
  }
}

export async function markNotificationUnread(
  notificationId: string,
  options: { userId?: string; client?: SupabaseClient | null } = {}
): Promise<NotificationResult<boolean>> {
  const client = clientOrFallback(options.client);
  if (!client) return { ok: false, error: 'Supabase not configured', disabled: true };
  if (!notificationId) return { ok: false, error: 'Missing notification id' };

  try {
    let query = client
      .from(NOTIFICATIONS_TABLE)
      .update({ is_read: false, read_at: null })
      .eq('id', notificationId);
    if (options.userId) query = query.eq('user_id', options.userId);

    const { error } = await query;
    if (error) return { ok: false, error: error.message, disabled: isBackendUnavailable(error) };
    return { ok: true, data: true };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message || 'Mark-unread failed' };
  }
}

/** Mark every unread notification read for this user (RPC first, PATCH fallback). */
export async function markAllNotificationsRead(
  userId: string,
  options: { client?: SupabaseClient | null } = {}
): Promise<NotificationResult<number>> {
  const client = clientOrFallback(options.client);
  if (!client) return { ok: false, error: 'Supabase not configured', disabled: true };
  if (!userId) return { ok: false, error: 'Missing user id' };

  try {
    const { data, error } = await client.rpc('mark_all_notifications_read');
    if (!error) {
      const updated = Array.isArray(data) ? Number(data[0] ?? 0) : Number(data ?? 0);
      return { ok: true, data: Number.isFinite(updated) ? updated : 0 };
    }
    if (!isMissingFunctionError(error)) {
      return { ok: false, error: error.message, disabled: isBackendUnavailable(error) };
    }
  } catch (err) {
    if (!isMissingFunctionError(err)) {
      return { ok: false, error: (err as Error)?.message || 'Mark-all-read failed' };
    }
  }

  try {
    const { data, error } = await client
      .from(NOTIFICATIONS_TABLE)
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_read', false)
      .select('id');
    if (error) return { ok: false, error: error.message, disabled: isBackendUnavailable(error) };
    return { ok: true, data: Array.isArray(data) ? data.length : 0 };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message || 'Mark-all-read failed' };
  }
}

function isMissingFunctionError(error: unknown): boolean {
  const code = errorCode(error);
  const message = String((error as { message?: unknown } | null)?.message ?? '').toLowerCase();
  return (
    code === '42883' ||
    code === 'PGRST202' ||
    message.includes('could not find the function') ||
    message.includes('does not exist')
  );
}

export async function deleteNotification(
  notificationId: string,
  options: { userId?: string; client?: SupabaseClient | null } = {}
): Promise<NotificationResult<boolean>> {
  const client = clientOrFallback(options.client);
  if (!client) return { ok: false, error: 'Supabase not configured', disabled: true };
  if (!notificationId) return { ok: false, error: 'Missing notification id' };

  try {
    let query = client.from(NOTIFICATIONS_TABLE).delete().eq('id', notificationId);
    if (options.userId) query = query.eq('user_id', options.userId);

    const { error } = await query;
    if (error) return { ok: false, error: error.message, disabled: isBackendUnavailable(error) };
    return { ok: true, data: true };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message || 'Delete failed' };
  }
}

/**
 * Record an in-app notification for the signed-in user.
 *
 * RLS allows a user to write only their OWN rows; system producers (booking
 * events, reward credits) are expected to write through a trusted server or
 * database trigger, which is why this returns the inserted row rather than a
 * fabricated one.
 */
export async function createNotification(
  input: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    payload?: NotificationPayload;
  },
  options: { client?: SupabaseClient | null } = {}
): Promise<NotificationResult<AppNotification | null>> {
  const client = clientOrFallback(options.client);
  if (!client) return { ok: false, error: 'Supabase not configured', disabled: true };
  if (!input.userId) return { ok: false, error: 'Missing user id' };
  if (!isNotificationType(input.type)) return { ok: false, error: `Unknown type: ${input.type}` };
  const title = input.title?.trim();
  if (!title) return { ok: false, error: 'Notification title is required' };

  try {
    const { data, error } = await client
      .from(NOTIFICATIONS_TABLE)
      .insert({
        user_id: input.userId,
        type: input.type,
        title: title.slice(0, 160),
        body: (input.body || '').slice(0, 1000),
        payload: { route: NOTIFICATION_META[input.type].route, ...(input.payload || {}) },
      })
      .select('id,user_id,type,title,body,payload,is_read,read_at,created_at')
      .maybeSingle();
    if (error) return { ok: false, error: error.message, disabled: isBackendUnavailable(error) };
    return { ok: true, data: mapNotificationRow(data) };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message || 'Notification insert failed' };
  }
}

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

const DEFAULT_PREFERENCES: NotificationPreferences = { matrix: {}, loaded: false };

/** Channel enabled for a category. Absent rows mean "enabled" (opt-out model). */
export function isChannelEnabled(
  prefs: NotificationPreferences,
  channel: NotificationChannel,
  category: NotificationType | 'all'
): boolean {
  const byCategory = prefs.matrix[channel];
  if (!byCategory) return true;
  if (byCategory.all === false) return false;
  return byCategory[category] !== false;
}

export async function fetchNotificationPreferences(
  userId: string,
  options: { client?: SupabaseClient | null } = {}
): Promise<NotificationResult<NotificationPreferences>> {
  const client = clientOrFallback(options.client);
  if (!client) return { ok: false, error: 'Supabase not configured', disabled: true };
  if (!userId) return { ok: false, error: 'Missing user id' };

  try {
    const { data, error } = await client
      .from(NOTIFICATION_PREFERENCES_TABLE)
      .select('channel,category,enabled')
      .eq('user_id', userId);
    if (error) return { ok: false, error: error.message, disabled: isBackendUnavailable(error) };

    const matrix: NotificationPreferences['matrix'] = {};
    for (const row of data ?? []) {
      if (!isRecord(row)) continue;
      const channel = typeof row.channel === 'string' ? row.channel : '';
      const category = typeof row.category === 'string' ? row.category : '';
      if (!channel || !category) continue;
      matrix[channel] = { ...(matrix[channel] || {}), [category]: row.enabled !== false };
    }
    return { ok: true, data: { matrix, loaded: true } };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message || 'Preference fetch failed' };
  }
}

export async function saveNotificationPreference(
  input: {
    userId: string;
    channel: NotificationChannel | 'all';
    category: NotificationType | 'all';
    enabled: boolean;
  },
  options: { client?: SupabaseClient | null } = {}
): Promise<NotificationResult<boolean>> {
  const client = clientOrFallback(options.client);
  if (!client) return { ok: false, error: 'Supabase not configured', disabled: true };
  if (!input.userId) return { ok: false, error: 'Missing user id' };

  const channels: NotificationChannel[] =
    input.channel === 'all' ? [...NOTIFICATION_CHANNELS] : [input.channel];

  try {
    const rows = channels.map((channel) => ({
      user_id: input.userId,
      channel,
      category: input.category,
      enabled: input.enabled,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await client
      .from(NOTIFICATION_PREFERENCES_TABLE)
      .upsert(rows, { onConflict: 'user_id,channel,category' });
    if (error) return { ok: false, error: error.message, disabled: isBackendUnavailable(error) };
    return { ok: true, data: true };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message || 'Preference save failed' };
  }
}

export { DEFAULT_PREFERENCES };

/**
 * Resolve where a notification should take the user. Returns null when the
 * notification carries no actionable destination.
 */
export function resolveNotificationTarget(
  notification: AppNotification
): { tab: 'appointments' | 'saved' | 'profile' | 'home' | 'explore'; section?: string; id?: string } | null {
  const route = notification.payload?.route ?? NOTIFICATION_META[notification.type].route;
  switch (route) {
    case 'appointments':
    case 'booking':
      return { tab: 'appointments', id: notification.payload?.appointmentId };
    case 'rewards':
    case 'referrals':
    case 'membership':
      return { tab: 'profile', section: 'section-rewards' };
    case 'offers':
      return { tab: 'explore', id: notification.payload?.offerId };
    case 'support':
      return { tab: 'profile', section: 'section-app-settings' };
    case 'profile':
      return { tab: 'profile' };
    case 'home':
      return { tab: 'home' };
    default:
      return null;
  }
}

/** Relative time label for the notification list. */
export function formatNotificationTime(iso: string, now = new Date()): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diffMs = now.getTime() - then;
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(then).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
