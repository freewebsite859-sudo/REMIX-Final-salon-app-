import type { SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './supabase';
import {
  NOTIFICATION_DELIVERIES_TABLE,
  isChannelEnabled,
  type AppNotification,
  type DeliveryStatus,
  type NotificationChannel,
  type NotificationPreferences,
} from './notificationService';

/**
 * Nexora multi-channel notification dispatch — integration structure.
 *
 * Channels
 * --------
 *   in_app   the notification row itself (always available)
 *   email    POST /api/notifications/email      (provider: SES/Resend/…)
 *   whatsapp POST /api/notifications/whatsapp   (provider: WhatsApp Cloud API)
 *   push     POST /api/notifications/push       (provider: FCM/APNs)
 *
 * Delivery honesty
 * ----------------
 * A provider accepting a message is NOT proof it reached a human. This module
 * can therefore only ever produce `queued`, `sent`, `failed` or `skipped`.
 * The `delivered` status exists exclusively for a confirmed provider callback
 * (`applyProviderDeliveryStatus`, invoked from the server-side status webhook),
 * and `markDelivered` refuses to run without a provider status + message id.
 * The database enforces the same rule with a trigger.
 */

export interface ChannelSendRequest {
  notification: AppNotification;
  to?: string | null;
}

export interface ChannelSendResult {
  channel: NotificationChannel;
  /** Never `delivered` — see the module note above. */
  status: Extract<DeliveryStatus, 'queued' | 'sent' | 'failed' | 'skipped'>;
  provider?: string | null;
  providerMessageId?: string | null;
  providerStatus?: string | null;
  error?: string | null;
}

export interface ChannelAdapter {
  channel: NotificationChannel;
  /** False when no provider credentials are configured for this channel. */
  isConfigured: () => boolean;
  send: (request: ChannelSendRequest) => Promise<ChannelSendResult>;
}

/** Endpoint paths are relative so the browser always talks to its own origin. */
export const NOTIFICATION_ENDPOINTS: Record<Exclude<NotificationChannel, 'in_app'>, string> = {
  email: '/api/notifications/email',
  whatsapp: '/api/notifications/whatsapp',
  push: '/api/notifications/push',
};

interface ProviderEnvelope {
  configured?: boolean;
  accepted?: boolean;
  status?: string;
  provider?: string;
  providerMessageId?: string;
  providerStatus?: string;
  error?: string;
}

async function postToProvider(
  channel: Exclude<NotificationChannel, 'in_app'>,
  notification: AppNotification,
  to?: string | null
): Promise<ChannelSendResult> {
  const endpoint = NOTIFICATION_ENDPOINTS[channel];
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel,
        notificationId: notification.id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        payload: notification.payload,
        to: to ?? null,
      }),
    });

    let envelope: ProviderEnvelope = {};
    try {
      envelope = (await response.json()) as ProviderEnvelope;
    } catch {
      envelope = {};
    }

    if (!response.ok || envelope.configured === false) {
      return {
        channel,
        status: 'failed',
        provider: envelope.provider ?? null,
        error: envelope.error || `Channel ${channel} unavailable (HTTP ${response.status})`,
      };
    }

    // Only an explicit `accepted: true` from our own endpoint counts as "the
    // provider took the message". A 2xx from anything else (a proxy, a dev
    // server, an unrelated handler) must NOT be logged as sent — otherwise the
    // delivery log would claim transmissions that never happened.
    if (envelope.accepted !== true) {
      return {
        channel,
        status: 'failed',
        provider: envelope.provider ?? null,
        error:
          envelope.error ||
          `Channel ${channel} did not confirm acceptance (HTTP ${response.status})`,
      };
    }

    // Acceptance means the provider QUEUED/ACCEPTED the message — that is
    // `sent`, never `delivered`. Delivery arrives via the status webhook.
    return {
      channel,
      status: 'sent',
      provider: envelope.provider ?? null,
      providerMessageId: envelope.providerMessageId ?? null,
      providerStatus: envelope.providerStatus ?? null,
      error: envelope.error ?? null,
    };
  } catch (err) {
    return {
      channel,
      status: 'failed',
      error: (err as Error)?.message || `Channel ${channel} request failed`,
    };
  }
}

/**
 * Channel adapters. Each one is a thin, replaceable binding to a provider
 * endpoint — swapping SES for Resend, or the WhatsApp Cloud API for a BSP,
 * means changing the server route, not this contract.
 */
export const inAppAdapter: ChannelAdapter = {
  channel: 'in_app',
  // The in-app channel is the notification row itself, which already exists.
  isConfigured: () => isSupabaseConfigured,
  send: async ({ notification }) => ({
    channel: 'in_app',
    status: 'sent',
    provider: 'internal',
    providerMessageId: notification.id,
    providerStatus: 'stored',
  }),
};

export const emailAdapter: ChannelAdapter = {
  channel: 'email',
  isConfigured: () => true, // the server reports the real configuration state
  send: ({ notification, to }) => postToProvider('email', notification, to),
};

export const whatsappAdapter: ChannelAdapter = {
  channel: 'whatsapp',
  isConfigured: () => true,
  send: ({ notification, to }) => postToProvider('whatsapp', notification, to),
};

export const pushAdapter: ChannelAdapter = {
  channel: 'push',
  isConfigured: () => true,
  send: ({ notification, to }) => postToProvider('push', notification, to),
};

export const CHANNEL_ADAPTERS: Record<NotificationChannel, ChannelAdapter> = {
  in_app: inAppAdapter,
  email: emailAdapter,
  whatsapp: whatsappAdapter,
  push: pushAdapter,
};

// ---------------------------------------------------------------------------
// Delivery log
// ---------------------------------------------------------------------------

export interface RecordDeliveryInput {
  notificationId: string;
  result: ChannelSendResult;
  client?: SupabaseClient | null;
}

/** Append one delivery attempt to the audit trail. Never throws. */
export async function recordDeliveryAttempt(
  input: RecordDeliveryInput
): Promise<{ ok: boolean; error?: string }> {
  const client = input.client === undefined ? supabase : input.client;
  if (!client || !isSupabaseConfigured) return { ok: false, error: 'Supabase not configured' };
  if (!input.notificationId) return { ok: false, error: 'Missing notification id' };

  try {
    const { error } = await client.from(NOTIFICATION_DELIVERIES_TABLE).insert({
      notification_id: input.notificationId,
      channel: input.result.channel,
      status: input.result.status,
      provider: input.result.provider ?? null,
      provider_message_id: input.result.providerMessageId ?? null,
      provider_status: input.result.providerStatus ?? null,
      error: input.result.error ?? null,
      attempted_at: new Date().toISOString(),
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message || 'Delivery log failed' };
  }
}

/**
 * Promote a delivery to `delivered` — ONLY from a confirmed provider status.
 *
 * Both `providerStatus` (the provider's own word, e.g. WhatsApp `delivered` /
 * `read`) and `providerMessageId` are required; without them the call refuses,
 * so the app can never report a WhatsApp message as delivered on hope.
 */
export async function markDelivered(input: {
  notificationId: string;
  channel: NotificationChannel;
  providerMessageId: string | null | undefined;
  providerStatus: string | null | undefined;
  client?: SupabaseClient | null;
}): Promise<{ ok: boolean; error?: string }> {
  if (!input.providerMessageId || !input.providerStatus) {
    return {
      ok: false,
      error: 'Refusing to mark delivered: no provider delivery status was received.',
    };
  }
  const client = input.client === undefined ? supabase : input.client;
  if (!client || !isSupabaseConfigured) return { ok: false, error: 'Supabase not configured' };

  try {
    const { error } = await client
      .from(NOTIFICATION_DELIVERIES_TABLE)
      .update({
        status: 'delivered',
        provider_status: input.providerStatus,
        confirmed_at: new Date().toISOString(),
      })
      .eq('notification_id', input.notificationId)
      .eq('channel', input.channel)
      .eq('provider_message_id', input.providerMessageId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message || 'Delivery confirmation failed' };
  }
}

/** True only when a provider has confirmed delivery for this notification+channel. */
export async function isDeliveryConfirmed(
  notificationId: string,
  channel: NotificationChannel,
  options: { client?: SupabaseClient | null } = {}
): Promise<boolean> {
  const client = options.client === undefined ? supabase : options.client;
  if (!client || !isSupabaseConfigured) return false;
  try {
    const { data, error } = await client
      .from(NOTIFICATION_DELIVERIES_TABLE)
      .select('id')
      .eq('notification_id', notificationId)
      .eq('channel', channel)
      .eq('status', 'delivered')
      .maybeSingle();
    return !error && Boolean(data);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

export interface DispatchOptions {
  notification: AppNotification;
  preferences: NotificationPreferences;
  /** Channels to attempt. `in_app` is always attempted first. */
  channels?: NotificationChannel[];
  contacts?: Partial<Record<NotificationChannel, string | null>>;
  client?: SupabaseClient | null;
}

export interface DispatchOutcome {
  notificationId: string;
  results: ChannelSendResult[];
  /** True when at least one channel reached the user's device inbox (in_app). */
  deliveredInApp: boolean;
  /**
   * Channels that a provider has CONFIRMED as delivered. Always empty until a
   * status webhook reports back — callers must not read this as "sent ok".
   */
  confirmedChannels: NotificationChannel[];
}

/**
 * Fan a notification out across channels, honouring the user's preferences.
 *
 * Returns exactly what each provider said. Nothing here upgrades `sent` to
 * `delivered`; `confirmedChannels` stays empty until a real status arrives.
 */
export async function dispatchNotification(
  options: DispatchOptions
): Promise<DispatchOutcome> {
  const {
    notification,
    preferences,
    channels = ['in_app', 'email', 'whatsapp', 'push'],
    contacts = {},
    client,
  } = options;

  const results: ChannelSendResult[] = [];

  for (const channel of channels) {
    const adapter = CHANNEL_ADAPTERS[channel];
    if (!adapter) continue;

    let result: ChannelSendResult;

    if (channel === 'in_app') {
      // in_app is the notification row itself — always on, and never
      // preference-gated (the row already exists; hiding it would rewrite history).
      result = await adapter.send({ notification, to: contacts[channel] ?? null });
    } else {
      const contact = contacts[channel] ?? null;
      if (!isChannelEnabled(preferences, channel, notification.type)) {
        result = { channel, status: 'skipped', error: 'Disabled in notification preferences' };
      } else if ((channel === 'email' || channel === 'whatsapp') && !contact) {
        result = { channel, status: 'skipped', error: `No ${channel} contact on file` };
      } else if (channel === 'push' && !contact) {
        // Push needs a registered device token; without one there is no target.
        result = { channel, status: 'skipped', error: 'No push device token registered' };
      } else if (!adapter.isConfigured()) {
        result = { channel, status: 'failed', error: `Channel ${channel} not configured` };
      } else {
        result = await adapter.send({ notification, to: contact });
      }
    }

    // Every outcome is part of the audit trail — including skips, so support can
    // answer "why didn't this user get a WhatsApp message?".
    results.push(result);
    await recordDeliveryAttempt({ notificationId: notification.id, result, client });
  }

  return {
    notificationId: notification.id,
    results,
    deliveredInApp: results.some((r) => r.channel === 'in_app' && r.status === 'sent'),
    confirmedChannels: [], // populated only by applyProviderDeliveryStatus
  };
}

/**
 * Apply a provider status callback (server-verified) to the delivery log.
 * `delivered`/`read` require the provider's own status string.
 */
export async function applyProviderDeliveryStatus(input: {
  notificationId: string;
  channel: NotificationChannel;
  providerMessageId: string | null | undefined;
  providerStatus: string | null | undefined;
  client?: SupabaseClient | null;
}): Promise<{ ok: boolean; status: DeliveryStatus | 'unchanged'; error?: string }> {
  const status = (input.providerStatus || '').toLowerCase();
  const client = input.client === undefined ? supabase : input.client;
  if (!client || !isSupabaseConfigured) return { ok: false, status: 'unchanged', error: 'Supabase not configured' };

  const map: Record<string, DeliveryStatus> = {
    sent: 'sent',
    delivered: 'delivered',
    read: 'delivered',
    failed: 'failed',
    undeliverable: 'undeliverable',
    deleted: 'failed',
  };
  const next = map[status];
  if (!next) return { ok: false, status: 'unchanged', error: `Unrecognised provider status: ${input.providerStatus}` };

  if (next === 'delivered') {
    const result = await markDelivered(input);
    return result.ok
      ? { ok: true, status: 'delivered' }
      : { ok: false, status: 'unchanged', error: result.error };
  }

  try {
    let query = client
      .from(NOTIFICATION_DELIVERIES_TABLE)
      .update({ status: next, provider_status: input.providerStatus ?? null })
      .eq('notification_id', input.notificationId)
      .eq('channel', input.channel);
    if (input.providerMessageId) query = query.eq('provider_message_id', input.providerMessageId);

    const { error } = await query;
    if (error) return { ok: false, status: 'unchanged', error: error.message };
    return { ok: true, status: next };
  } catch (err) {
    return { ok: false, status: 'unchanged', error: (err as Error)?.message || 'Status update failed' };
  }
}
