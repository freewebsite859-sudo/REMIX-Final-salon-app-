/**
 * Nexora realtime subscription layer (Supabase Realtime).
 *
 * Supabase projects enable realtime per-table via the `supabase_realtime`
 * publication (see the engagement section of supabase/setup.sql, which adds
 * bookings, notifications, rewards, user_qr_codes, qr_check_ins and
 * staff_availability and switches them to replica identity FULL so UPDATE
 * payloads carry whole rows).
 *
 * Client contract
 * ---------------
 *  - Explicit opt-in: VITE_SUPABASE_REALTIME=true must be set. Realtime
 *    features stay OFF in demo builds and in the hermetic test harness so no
 *    websocket is ever opened there — the UI degrades to the existing
 *    60-second polling rather than pretending to be live.
 *  - This module must stay side-effect free at import time: the Supabase
 *    client is imported LAZILY (dynamic import) only when a subscription is
 *    actually requested with realtime enabled. Bundles/tests that merely
 *    import the API never construct a Supabase client or open a handle.
 *  - Every subscription is typed, cancellable and idempotent; a missing
 *    Supabase client or a dead channel reports `status: 'unavailable'` and
 *    the caller keeps its previous data. Nothing is fabricated.
 */

import type { RealtimeChannel } from '@supabase/supabase-js';

export const REALTIME_TABLES = [
  'notifications',
  'bookings',
  'rewards',
  'user_qr_codes',
  'qr_check_ins',
  'staff_availability',
] as const;

export type RealtimeTable = (typeof REALTIME_TABLES)[number];

export type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE';

export interface RealtimeRowEvent<T = Record<string, unknown>> {
  table: RealtimeTable;
  type: RealtimeEventType;
  row: T;
  oldRow?: T | null;
  commitTimestamp?: string;
}

export type RealtimeStatus = 'subscribed' | 'error' | 'unavailable' | 'timed_out' | 'closed';

export interface RealtimeSubscription {
  unsubscribe: () => Promise<void>;
}

interface RealtimeOptions {
  /** PostgREST-style equality filter, e.g. "user_id=eq.<uuid>" */
  filter?: string;
  onStatus?: (status: RealtimeStatus) => void;
}

function realtimeFlagEnabled(): boolean {
  try {
    const meta = (import.meta as { env?: Record<string, string | undefined> }).env;
    if (meta?.VITE_SUPABASE_REALTIME === 'true') return true;
  } catch {
    /* import.meta.env unavailable outside Vite */
  }
  try {
    return process.env?.VITE_SUPABASE_REALTIME === 'true';
  } catch {
    return false;
  }
}

function readEnvVar(name: string): string | undefined {
  try {
    const meta = (import.meta as { env?: Record<string, string | undefined> }).env;
    const viteValue = meta?.[name];
    if (viteValue) return viteValue;
  } catch {
    /* import.meta.env unavailable outside Vite */
  }
  try {
    return process.env?.[name];
  } catch {
    return undefined;
  }
}

/** True only when the project opted into realtime AND Supabase is present. */
export function isRealtimeEnabled(): boolean {
  if (!realtimeFlagEnabled()) return false;
  // Mirror src/lib/supabase/client.ts's configured check without importing
  // the client module (import side effects must stay out of this module).
  const url = readEnvVar('VITE_SUPABASE_URL')?.trim();
  const anonKey = readEnvVar('VITE_SUPABASE_ANON_KEY')?.trim();
  const demoMode = readEnvVar('VITE_NEXORA_DEMO_MODE') === 'true';
  if (demoMode) return false;
  return Boolean(url && anonKey && !anonKey.includes('service_role'));
}

/**
 * Subscribe to postgres changes on one published table.
 * Returns an object with unsubscribe(); safe to call when realtime is off —
 * it reports unavailable through onStatus and no channel is created.
 */
export function subscribeToTable<T = Record<string, unknown>>(
  table: RealtimeTable,
  onEvent: (event: RealtimeRowEvent<T>) => void,
  options: RealtimeOptions = {}
): RealtimeSubscription {
  if (!isRealtimeEnabled()) {
    options.onStatus?.('unavailable');
    return { unsubscribe: async () => undefined };
  }

  const channelName = `nexora:${table}:${Math.random().toString(36).slice(2, 10)}`;
  let channel: RealtimeChannel | null = null;
  let cancelled = false;

  // Lazy client import: constructing a SupabaseClient eagerly (or importing
  // the module eagerly) would open auth/realtime machinery even when this
  // subscription is never actually used.
  void import('./supabase').then(({ supabase }) => {
    if (cancelled) return;
    if (!supabase) {
      options.onStatus?.('unavailable');
      return;
    }
    try {
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table,
            ...(options.filter ? { filter: options.filter } : {}),
          },
          (payload) => {
            const type = (payload.eventType ?? '').toUpperCase() as RealtimeEventType;
            if (!['INSERT', 'UPDATE', 'DELETE'].includes(type)) return;
            onEvent({
              table,
              type,
              row: (payload.new ?? payload.old ?? {}) as T,
              oldRow: (payload.old ?? null) as T | null,
              commitTimestamp: payload.commit_timestamp,
            });
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') options.onStatus?.('subscribed');
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            options.onStatus?.(status === 'CHANNEL_ERROR' ? 'error' : 'timed_out');
          }
        });
    } catch {
      options.onStatus?.('error');
    }
  });

  return {
    unsubscribe: async () => {
      cancelled = true;
      if (channel) {
        const { supabase } = await import('./supabase');
        if (supabase) await supabase.removeChannel(channel);
        channel = null;
      }
    },
  };
}
