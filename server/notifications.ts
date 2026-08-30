import crypto from 'crypto';
import express, { Request, Response, Router } from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Nexora notification dispatch endpoints (server-side).
 *
 * Why this lives on the server
 * ---------------------------
 * Provider credentials (WhatsApp Cloud API token, email API key, FCM service
 * account) must never reach the browser bundle, and a delivery confirmation may
 * only be written by something that actually heard back from the provider. So:
 *
 *   POST /api/notifications/email      accept → provider → 'sent' (never delivered)
 *   POST /api/notifications/whatsapp   accept → provider → 'sent' (never delivered)
 *   POST /api/notifications/push       accept → provider → 'sent' (never delivered)
 *   GET  /api/notifications/config     which channels are really configured
 *   GET  /api/notifications/webhooks/whatsapp   provider URL verification
 *   POST /api/notifications/webhooks/whatsapp   provider STATUS callbacks
 *
 * Delivery honesty
 * ----------------
 * A send endpoint reports `sent` at best: the provider accepted the message.
 * `delivered` is written ONLY by the status webhook, from the provider's own
 * status payload, and only for `delivered`/`read`. If a provider is not
 * configured the endpoint answers 503 `configured: false` instead of pretending.
 */

export const NOTIFICATIONS_TABLE = 'notifications';
export const NOTIFICATION_DELIVERIES_TABLE = 'notification_deliveries';

type Channel = 'email' | 'whatsapp' | 'push';

const VALID_CHANNELS: Channel[] = ['email', 'whatsapp', 'push'];

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface ChannelConfig {
  whatsapp: {
    configured: boolean;
    provider: string;
    apiVersion: string;
    hasPhoneNumberId: boolean;
  };
  email: { configured: boolean; provider: string };
  push: { configured: boolean; provider: string };
  webhook: { verificationConfigured: boolean; signatureVerification: boolean };
}

export function readChannelConfig(env: NodeJS.ProcessEnv = process.env): ChannelConfig {
  return {
    whatsapp: {
      configured: Boolean(env.WHATSAPP_API_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID),
      provider: 'whatsapp_cloud_api',
      apiVersion: env.WHATSAPP_API_VERSION || 'v21.0',
      hasPhoneNumberId: Boolean(env.WHATSAPP_PHONE_NUMBER_ID),
    },
    email: {
      // Any HTTP email API (Resend/Postmark/SendGrid) with a base URL + key.
      configured: Boolean(env.EMAIL_API_KEY && env.EMAIL_API_URL),
      provider: env.EMAIL_PROVIDER || 'http_email_api',
    },
    push: {
      // FCM HTTP v1 needs a service-account JSON plus a device token store.
      configured: Boolean(env.FCM_SERVICE_ACCOUNT_JSON),
      provider: 'fcm_http_v1',
    },
    webhook: {
      verificationConfigured: Boolean(env.WHATSAPP_WEBHOOK_VERIFY_TOKEN),
      signatureVerification: Boolean(env.META_APP_SECRET),
    },
  };
}

/**
 * Service-role client, created ONLY when the key is present. This key bypasses
 * RLS, so it is read from the process environment on the server and is never
 * exported to the client bundle.
 */
export function createServiceClient(
  env: NodeJS.ProcessEnv = process.env
): { client: SupabaseClient | null; reason?: string } {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return { client: null, reason: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured' };
  }
  // Defence in depth: an anon key here would silently fail RLS-guarded writes.
  if (serviceKey.split('.')[1]) {
    try {
      const payload = JSON.parse(
        Buffer.from(serviceKey.split('.')[1], 'base64').toString('utf8')
      ) as { role?: string };
      if (payload.role && payload.role !== 'service_role') {
        return { client: null, reason: 'Provided key is not a service_role key' };
      }
    } catch {
      /* not a JWT — allow (legacy keys) */
    }
  }
  return {
    client: createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}

// ---------------------------------------------------------------------------
// Delivery log helpers
// ---------------------------------------------------------------------------

export interface DeliveryRecord {
  notificationId: string;
  channel: Channel;
  status: 'queued' | 'sent' | 'failed';
  provider?: string | null;
  providerMessageId?: string | null;
  providerStatus?: string | null;
  error?: string | null;
}

export async function recordDelivery(
  client: SupabaseClient | null,
  record: DeliveryRecord
): Promise<{ ok: boolean; error?: string }> {
  if (!client) return { ok: false, error: 'Delivery log unavailable (no service client)' };
  const { error } = await client.from(NOTIFICATION_DELIVERIES_TABLE).insert({
    notification_id: record.notificationId,
    channel: record.channel,
    status: record.status,
    provider: record.provider ?? null,
    provider_message_id: record.providerMessageId ?? null,
    provider_status: record.providerStatus ?? null,
    error: record.error ?? null,
    attempted_at: new Date().toISOString(),
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/**
 * Promote a delivery to `delivered`.
 *
 * Refuses without the provider's own status text AND message id — the database
 * constraint `notification_deliveries_delivery_requires_proof` enforces the same
 * rule, so this cannot be bypassed even by a buggy caller.
 */
export async function confirmDelivery(
  client: SupabaseClient | null,
  input: {
    providerMessageId: string;
    channel: Channel;
    providerStatus: string;
  }
): Promise<{ ok: boolean; updated: number; error?: string }> {
  if (!client) return { ok: false, updated: 0, error: 'Delivery log unavailable' };
  if (!input.providerMessageId || !input.providerStatus) {
    return {
      ok: false,
      updated: 0,
      error: 'Refusing to confirm delivery: provider status or message id missing',
    };
  }

  const { data, error } = await client
    .from(NOTIFICATION_DELIVERIES_TABLE)
    .update({
      status: 'delivered',
      provider_status: input.providerStatus,
      confirmed_at: new Date().toISOString(),
    })
    .eq('provider_message_id', input.providerMessageId)
    .eq('channel', input.channel)
    .neq('status', 'delivered')
    .select('id');

  if (error) return { ok: false, updated: 0, error: error.message };
  return { ok: true, updated: Array.isArray(data) ? data.length : 0 };
}

// ---------------------------------------------------------------------------
// Provider senders (structure — each is a thin binding to a real HTTP API)
// ---------------------------------------------------------------------------

interface SendInput {
  to: string | null;
  title: string;
  body: string;
  notificationId: string;
  type: string;
  payload: Record<string, unknown>;
}

interface ProviderOutcome {
  accepted: boolean;
  provider: string;
  providerMessageId?: string | null;
  providerStatus?: string | null;
  error?: string;
}

/**
 * WhatsApp Cloud API. Acceptance (`messages[0].id`) means Meta QUEUED the
 * message; arrival is reported later through the status webhook.
 */
export async function sendWhatsApp(
  input: SendInput,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch
): Promise<ProviderOutcome> {
  const token = env.WHATSAPP_API_TOKEN;
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;
  const version = env.WHATSAPP_API_VERSION || 'v21.0';
  if (!token || !phoneNumberId) {
    return { accepted: false, provider: 'whatsapp_cloud_api', error: 'WhatsApp provider not configured' };
  }
  if (!input.to) {
    return { accepted: false, provider: 'whatsapp_cloud_api', error: 'No destination phone number' };
  }

  try {
    const response = await fetchImpl(
      `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: input.to,
          type: 'text',
          text: { preview_url: false, body: `${input.title}\n${input.body}`.slice(0, 4096) },
        }),
      }
    );

    const json = (await response.json().catch(() => ({}))) as {
      messages?: { id?: string }[];
      error?: { message?: string };
    };

    if (!response.ok) {
      return {
        accepted: false,
        provider: 'whatsapp_cloud_api',
        error: json.error?.message || `WhatsApp API error (HTTP ${response.status})`,
      };
    }

    const messageId = json.messages?.[0]?.id ?? null;
    return {
      accepted: true,
      provider: 'whatsapp_cloud_api',
      providerMessageId: messageId,
      // Meta's acceptance state. NOT "delivered" — that arrives via webhook.
      providerStatus: 'accepted',
    };
  } catch (err) {
    return {
      accepted: false,
      provider: 'whatsapp_cloud_api',
      error: (err as Error)?.message || 'WhatsApp request failed',
    };
  }
}

/** Generic HTTP email API (Resend/Postmark/SendGrid-shaped). */
export async function sendEmail(
  input: SendInput,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch
): Promise<ProviderOutcome> {
  const apiKey = env.EMAIL_API_KEY;
  const apiUrl = env.EMAIL_API_URL;
  const from = env.EMAIL_FROM_ADDRESS || 'Nexora <no-reply@nexora.app>';
  if (!apiKey || !apiUrl) {
    return { accepted: false, provider: 'http_email_api', error: 'Email provider not configured' };
  }
  if (!input.to) {
    return { accepted: false, provider: 'http_email_api', error: 'No destination email address' };
  }

  try {
    const response = await fetchImpl(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.title.slice(0, 200),
        text: input.body,
        metadata: { notificationId: input.notificationId, type: input.type },
      }),
    });
    const json = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!response.ok) {
      return {
        accepted: false,
        provider: 'http_email_api',
        error: json.message || `Email API error (HTTP ${response.status})`,
      };
    }
    return {
      accepted: true,
      provider: 'http_email_api',
      providerMessageId: json.id ?? null,
      providerStatus: 'accepted',
    };
  } catch (err) {
    return {
      accepted: false,
      provider: 'http_email_api',
      error: (err as Error)?.message || 'Email request failed',
    };
  }
}

/**
 * FCM HTTP v1. Sending needs an OAuth token minted from the service account;
 * the token store (device tokens per user) is out of scope here, so this reports
 * not-configured unless both the credentials and a recipient token are present.
 */
export async function sendPush(
  input: SendInput,
  env: NodeJS.ProcessEnv = process.env
): Promise<ProviderOutcome> {
  if (!env.FCM_SERVICE_ACCOUNT_JSON) {
    return { accepted: false, provider: 'fcm_http_v1', error: 'Push provider not configured' };
  }
  if (!input.to) {
    return { accepted: false, provider: 'fcm_http_v1', error: 'No device token for this user' };
  }
  return {
    accepted: false,
    provider: 'fcm_http_v1',
    error: 'Push transport not wired: mint an OAuth token and POST to FCM v1 here',
  };
}

const SENDERS: Record<Channel, (input: SendInput, env?: NodeJS.ProcessEnv) => Promise<ProviderOutcome>> = {
  whatsapp: sendWhatsApp,
  email: sendEmail,
  push: sendPush,
};

// ---------------------------------------------------------------------------
// Webhook verification
// ---------------------------------------------------------------------------

/** Constant-time compare so a timing attack cannot recover the secret. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Verify Meta's `X-Hub-Signature-256` when an app secret is configured. */
export function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  appSecret: string | undefined
): { verified: boolean; reason?: string } {
  if (!appSecret) return { verified: false, reason: 'META_APP_SECRET not configured' };
  if (!signatureHeader?.startsWith('sha256=')) {
    return { verified: false, reason: 'Missing or malformed X-Hub-Signature-256' };
  }
  const expected = `sha256=${crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex')}`;
  return safeEqual(expected, signatureHeader)
    ? { verified: true }
    : { verified: false, reason: 'Signature mismatch' };
}

/** Map a provider status onto the delivery lifecycle. */
export function mapProviderStatus(status: string): 'sent' | 'delivered' | 'failed' | null {
  switch ((status || '').toLowerCase()) {
    case 'sent':
      return 'sent';
    case 'delivered':
    case 'read':
      return 'delivered';
    case 'failed':
    case 'deleted':
      return 'failed';
    default:
      return null;
  }
}

interface WhatsAppStatus {
  id?: string;
  status?: string;
  recipient_id?: string;
  errors?: { title?: string; message?: string }[];
}

/** Parse Meta Cloud API status callbacks into a flat, verifiable list. */
export function extractWhatsAppStatuses(body: unknown): WhatsAppStatus[] {
  const payload = body as {
    entry?: { changes?: { value?: { statuses?: WhatsAppStatus[] } }[] }[];
  };
  const statuses: WhatsAppStatus[] = [];
  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      for (const status of change?.value?.statuses ?? []) {
        if (status && typeof status === 'object') statuses.push(status);
      }
    }
  }
  return statuses;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export function createNotificationsRouter(env: NodeJS.ProcessEnv = process.env): Router {
  const router = Router();
  // Raw body is needed for webhook signature verification.
  router.use(
    express.json({
      limit: '32kb',
      verify: (req: Request & { rawBody?: string }, _res, buf) => {
        req.rawBody = buf.toString('utf8');
      },
    })
  );

  /** Which channels are genuinely configured — the UI shows this honestly. */
  router.get('/config', (_req: Request, res: Response) => {
    const config = readChannelConfig(env);
    res.json({
      channels: {
        in_app: true,
        email: config.email.configured,
        whatsapp: config.whatsapp.configured,
        push: config.push.configured,
      },
      providers: {
        email: config.email.provider,
        whatsapp: config.whatsapp.provider,
        push: config.push.provider,
      },
      deliveryConfirmation: {
        whatsappStatusWebhook: config.webhook.verificationConfigured,
        signatureVerification: config.webhook.signatureVerification,
      },
    });
  });

  /** Provider URL verification handshake (Meta requires an echo of hub.challenge). */
  router.get('/webhooks/whatsapp', (req: Request, res: Response) => {
    const mode = String(req.query['hub.mode'] || '');
    const token = String(req.query['hub.verify_token'] || '');
    const challenge = String(req.query['hub.challenge'] || '');
    const expected = env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

    if (!expected) {
      return res.status(503).json({ configured: false, error: 'Webhook not configured' });
    }
    if (mode === 'subscribe' && safeEqual(token, expected)) {
      return res.status(200).send(challenge);
    }
    return res.status(403).json({ error: 'Verification failed' });
  });

  /**
   * Provider STATUS callbacks — the ONLY place `delivered` is ever written.
   * Unauthenticated callbacks are rejected: without verification anyone could
   * forge a delivery confirmation.
   */
  router.post('/webhooks/whatsapp', async (req: Request, res: Response) => {
    const rawBody = (req as Request & { rawBody?: string }).rawBody || '';

    if (env.META_APP_SECRET) {
      const signature = verifyMetaSignature(
        rawBody,
        req.header('X-Hub-Signature-256'),
        env.META_APP_SECRET
      );
      if (!signature.verified) {
        return res.status(401).json({ error: signature.reason });
      }
    } else if (env.WHATSAPP_WEBHOOK_SHARED_SECRET) {
      const provided = req.header('X-Nexora-Webhook-Secret') || '';
      if (!safeEqual(provided, env.WHATSAPP_WEBHOOK_SHARED_SECRET)) {
        return res.status(401).json({ error: 'Webhook secret mismatch' });
      }
    } else {
      return res
        .status(401)
        .json({ error: 'Refusing unverified delivery callbacks: configure META_APP_SECRET' });
    }

    const { client, reason } = createServiceClient(env);
    if (!client) {
      return res.status(503).json({ error: reason || 'Delivery log unavailable' });
    }

    const statuses = extractWhatsAppStatuses(req.body);
    const summary = { received: statuses.length, delivered: 0, sent: 0, failed: 0, ignored: 0 };

    for (const status of statuses) {
      const messageId = status.id;
      const mapped = mapProviderStatus(String(status.status || ''));
      if (!messageId || !mapped) {
        summary.ignored += 1;
        continue;
      }

      if (mapped === 'delivered') {
        const result = await confirmDelivery(client, {
          providerMessageId: messageId,
          channel: 'whatsapp',
          providerStatus: String(status.status),
        });
        if (result.ok) summary.delivered += result.updated;
        else summary.ignored += 1;
        continue;
      }

      const { error } = await client
        .from(NOTIFICATION_DELIVERIES_TABLE)
        .update({
          status: mapped,
          provider_status: String(status.status),
          error: status.errors?.[0]?.message ?? null,
        })
        .eq('provider_message_id', messageId)
        .eq('channel', 'whatsapp');
      if (error) summary.ignored += 1;
      else if (mapped === 'sent') summary.sent += 1;
      else summary.failed += 1;
    }

    // 200 must be returned quickly so the provider does not retry the batch.
    return res.json({ received: summary.received, processed: summary });
  });

  /** Channel send endpoints. Acceptance only — never a delivery claim. */
  for (const channel of VALID_CHANNELS) {
    router.post(`/${channel}`, async (req: Request, res: Response) => {
      const { notificationId, title, body, type, payload, to } = (req.body ?? {}) as {
        notificationId?: string;
        title?: string;
        body?: string;
        type?: string;
        payload?: Record<string, unknown>;
        to?: string | null;
      };

      if (!notificationId || typeof notificationId !== 'string') {
        return res.status(400).json({ accepted: false, error: 'notificationId is required' });
      }

      const config = readChannelConfig(env);
      const isConfigured =
        channel === 'whatsapp'
          ? config.whatsapp.configured
          : channel === 'email'
          ? config.email.configured
          : config.push.configured;

      if (!isConfigured) {
        return res.status(503).json({
          configured: false,
          accepted: false,
          error: `${channel} provider is not configured`,
        });
      }

      const sender = SENDERS[channel];
      const outcome = await sender(
        {
          to: typeof to === 'string' && to.trim() ? to.trim() : null,
          title: typeof title === 'string' ? title : 'Nexora update',
          body: typeof body === 'string' ? body : '',
          notificationId,
          type: typeof type === 'string' ? type : 'offer',
          payload: payload && typeof payload === 'object' ? payload : {},
        },
        env
      );

      const { client } = createServiceClient(env);
      await recordDelivery(client, {
        notificationId,
        channel,
        status: outcome.accepted ? 'sent' : 'failed',
        provider: outcome.provider,
        providerMessageId: outcome.providerMessageId ?? null,
        providerStatus: outcome.providerStatus ?? null,
        error: outcome.error ?? null,
      });

      if (!outcome.accepted) {
        return res.status(502).json({
          configured: true,
          accepted: false,
          provider: outcome.provider,
          error: outcome.error || 'Provider rejected the message',
        });
      }

      return res.json({
        configured: true,
        accepted: true,
        // Provider acceptance. Delivery is confirmed later by the webhook.
        status: 'sent',
        provider: outcome.provider,
        providerMessageId: outcome.providerMessageId ?? null,
        providerStatus: outcome.providerStatus ?? null,
        deliveryConfirmed: false,
      });
    });
  }

  return router;
}
