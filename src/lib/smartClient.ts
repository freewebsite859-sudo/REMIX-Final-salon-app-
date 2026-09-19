/**
 * Browser client for the Phase-4 APIs: smart memory, AI, payments extras, maps.
 * Every call is relative (`/api/...`) so the dev proxy / same-origin server
 * handles it; nothing here touches localhost or holds a secret.
 */
import type { Salon } from '../types';
import type { UserPreferences, SmartReminder } from './smartMemory';

type Fetch = typeof fetch;

async function call<T>(path: string, init: RequestInit & { token?: string | null } = {}, fetchImpl: Fetch = fetch): Promise<{ ok: true; data: T; status: number } | { ok: false; error: string; status: number }> {
  const { token, headers, ...rest } = init;
  try {
    const res = await fetchImpl(path, {
      ...rest,
      headers: { ...(rest.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(headers as Record<string, string> | undefined) },
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) return { ok: false, error: (json.error as string) || `HTTP ${res.status}`, status: res.status };
    return { ok: true, data: json as T, status: res.status };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error', status: 0 };
  }
}

// ---- Smart memory --------------------------------------------------------

export const smartApi = {
  getPreferences: (token: string) => call<{ preferences: UserPreferences; learned: boolean }>('/api/smart/preferences', { token }),
  savePreferences: (token: string, preferences: UserPreferences) => call<{ preferences: UserPreferences; reminders: SmartReminder[] }>('/api/smart/preferences', { method: 'PUT', token, body: JSON.stringify({ preferences }) }),
  getReminders: (token: string) => call<{ reminders: SmartReminder[]; due: SmartReminder[] }>('/api/smart/reminders', { token }),
  dismissReminder: (token: string, id: string, snoozeDays = 0) => call<{ ok: true }>(`/api/smart/reminders/${encodeURIComponent(id)}/dismiss`, { method: 'POST', token, body: JSON.stringify({ snoozeDays }) }),
  markBooked: (token: string, id: string) => call<{ ok: true }>(`/api/smart/reminders/${encodeURIComponent(id)}/booked`, { method: 'POST', token, body: '{}' }),
  subscribePush: (token: string, sub: { fcmToken?: string; subscription?: PushSubscriptionJSON }) =>
    call<{ ok: true }>('/api/smart/push/subscribe', { method: 'POST', token, body: JSON.stringify(sub.fcmToken ? { provider: 'fcm', fcmToken: sub.fcmToken } : { provider: 'webpush', endpoint: sub.subscription?.endpoint, subscription: sub.subscription }) }),
};

// ---- AI ------------------------------------------------------------------

export interface AiRecommendationResponse {
  source: 'openai' | 'template';
  model?: string;
  headline: string;
  recommendations: Array<{ salonId: string; score: number; reasons: string[]; serviceId: string | null; reminderId: string | null }>;
  aiError?: string;
}

export const aiApi = {
  config: () => call<{ configured: boolean; model: string }>('/api/ai/config'),
  recommendations: (input: { preferences: UserPreferences; reminders: SmartReminder[]; salons: Salon[]; customerName?: string; limit?: number; excludeSalonIds?: string[] }) =>
    call<AiRecommendationResponse>('/api/ai/recommendations', {
      method: 'POST',
      body: JSON.stringify({ preferences: input.preferences, reminders: input.reminders, salons: input.salons.slice(0, 40), customerName: input.customerName, limit: input.limit ?? 4, excludeSalonIds: input.excludeSalonIds }),
    }),
  reminderMessage: (reminder: SmartReminder, ctx: { customerName?: string; salonName?: string; channel?: 'whatsapp' | 'sms' | 'push' | 'in_app' } = {}) =>
    call<{ source: string; message: string }>('/api/ai/reminder-message', { method: 'POST', body: JSON.stringify({ reminder, ...ctx }) }),
};

// ---- Payments extras -----------------------------------------------------

export interface RefundQuote { percent: 100 | 50 | 0; amountRupees: number; hoursBefore: number; label: string }
export interface PaymentHistoryRow {
  bookingId: string; bookingRef: string; salonName: string; date: string; time: string; status: string; services: string[];
  total: number; advancePaid: number; paymentStatus: string; paymentMode: string; paymentId: string | null; refunded: number; createdAt: string;
}

export const paymentsApi = {
  quoteRefund: (token: string, bookingId: string) => call<{ quote: RefundQuote; alreadyRefunded: boolean }>('/api/payments/refunds', { method: 'POST', token, body: JSON.stringify({ bookingId, dryRun: true }) }),
  refund: (token: string, bookingId: string, reason?: string) => call<{ cancelled: boolean; refund: { id: string; amount_paise: number; status: string } | null; quote: RefundQuote; message: string }>('/api/payments/refunds', { method: 'POST', token, body: JSON.stringify({ bookingId, reason }) }),
  history: (token: string) => call<{ rows: PaymentHistoryRow[]; totals: { paid: number; refunded: number; bookings: number } }>('/api/payments/history', { token }),
  invoiceUrl: (bookingId: string) => `/api/payments/invoice/${encodeURIComponent(bookingId)}?format=html`,
  /** Opens the printable invoice in a new tab with the bearer token (fetch → blob URL, so the token never lands in a URL). */
  async openInvoice(token: string, bookingId: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch(paymentsApi.invoiceUrl(bookingId), { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { const j = (await res.json().catch(() => ({}))) as { error?: string }; return { ok: false, error: j.error || `HTTP ${res.status}` }; }
      const url = URL.createObjectURL(await res.blob());
      window.open(url, '_blank', 'noopener');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Could not open invoice' };
    }
  },
};

// ---- Maps ----------------------------------------------------------------

export interface DistanceResult { id: string; distanceKm: number; durationMin: number; source: 'google' | 'estimate' }

export const mapsApi = {
  config: () => call<{ configured: boolean; hasBrowserKey: boolean }>('/api/maps/config'),
  distances: (origin: { lat: number; lng: number }, salons: Salon[], mode: 'driving' | 'two_wheeler' | 'walking' = 'two_wheeler') =>
    call<{ configured: boolean; results: DistanceResult[] }>('/api/maps/distance', {
      method: 'POST',
      body: JSON.stringify({ origin, mode, destinations: salons.filter((s) => Number.isFinite(s.location.latitude) && Number.isFinite(s.location.longitude)).map((s) => ({ id: s.id, lat: s.location.latitude, lng: s.location.longitude })) }),
    }),
  reverse: (lat: number, lng: number) => call<{ result: { area: string | null; city: string | null; formattedAddress: string } }>(`/api/maps/reverse?lat=${lat}&lng=${lng}`),
};
