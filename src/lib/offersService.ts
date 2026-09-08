/**
 * Nexora SalonOS Customer App — offers service.
 *
 * Reads the read-only `offers` offer catalogue and the customer's own
 * `offer_redemptions` records. Active offers are surfaced to every
 * authenticated customer; redemptions remain private.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase, isLiveCustomerDataEnabled, isSupabaseConfigured } from './supabase';
import { SALONOS_TABLES } from './supabase/tables';
import type { OfferSummary } from './customerCatalogService';

export interface OfferRedemption {
  id: string;
  userId: string;
  offerId: string;
  salonId?: string;
  redeemedAt: string;
  code?: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export async function fetchActiveOffers(
  client: SupabaseClient | null = supabase
): Promise<OfferSummary[]> {
  if (!client || !isSupabaseConfigured || !isLiveCustomerDataEnabled) return [];
  try {
    const { data, error } = await client.from(SALONOS_TABLES.offers).select('*');
    if (error || !Array.isArray(data)) return [];
    const now = Date.now();
    return data
      .map((row) => {
        const r = asRecord(row);
        if (!r) return null;
        const id = typeof r.id === 'string' ? r.id : '';
        const title = String(r.title ?? r.name ?? '');
        if (!id || !title) return null;
        const active = r.is_active ?? r.isActive ?? r.active;
        const starts = String(r.starts_at ?? r.valid_from ?? r.start_date ?? '');
        const ends = String(r.ends_at ?? r.valid_until ?? r.end_date ?? '');
        if (active === false) return null;
        if (ends && new Date(ends).getTime() < Date.now()) return null;
        if (r.is_active === true && starts && ends) {
          const start = new Date(starts).getTime();
          const end = new Date(ends).getTime();
          if (start > now || end < now) return null;
        }
        return {
          id,
          salonId: typeof r.salon_id === 'string' ? r.salon_id : undefined,
          title,
          description: typeof r.description === 'string' ? r.description : undefined,
          code: typeof r.code === 'string' ? r.code : undefined,
          discountPercent: typeof r.discount_percent === 'number' ? r.discount_percent : undefined,
          discountAmount: typeof r.discount_amount === 'number' ? r.discount_amount : undefined,
          startsAt: starts || undefined,
          endsAt: ends || undefined,
          isActive: active !== false,
        } as OfferSummary;
      })
      .filter((offer): offer is OfferSummary => offer !== null);
  } catch {
    return [];
  }
}

/**
 * Record a customer redeeming an offer in-shop. The row is private to the
 * signed-in user and the write is guarded by RLS (`auth.uid() = user_id`).
 */
export async function redeemOfferLive(
  userId: string,
  params: { offerId: string; salonId?: string; code?: string },
  client: SupabaseClient | null = supabase
): Promise<{ success: boolean; error?: string; redemption?: OfferRedemption }> {
  // Offer redemptions are verified by the backend/point-of-sale. The customer
  // app may only read its own redeemed rows; it never writes a redemption.
  if (isLiveCustomerDataEnabled && userId) {
    return {
      success: false,
      error: 'Offer redemption is confirmed by the backend/QR terminal. The customer app cannot create its own redemption.',
    };
  }
  if (!client || !isSupabaseConfigured || !userId) {
    return { success: false, error: 'Live Supabase offers service is not configured.' };
  }
  if (!params.offerId) return { success: false, error: 'Missing offer id.' };
  const now = new Date().toISOString();
  try {
    const payload = {
      user_id: userId,
      offer_id: params.offerId,
      salon_id: params.salonId || null,
      code: params.code || null,
      status: 'redeemed',
      redeemed_at: now,
      created_at: now,
    };
    const { data, error } = await client
      .from(SALONOS_TABLES.offerRedemptions)
      .insert(payload)
      .select('*')
      .maybeSingle();
    if (error || !data) return { success: false, error: error?.message || 'Offer already redeemed or unavailable.' };
    const row = asRecord(data) || {};
    return {
      success: true,
      redemption: {
        id: String(row.id ?? ''),
        userId,
        offerId: String(row.offer_id ?? params.offerId),
        salonId: typeof row.salon_id === 'string' ? row.salon_id : params.salonId,
        redeemedAt: String(row.redeemed_at ?? now),
        code: typeof row.code === 'string' ? row.code : params.code,
      },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function fetchCustomerOfferRedemptions(
  userId: string,
  client: SupabaseClient | null = supabase
): Promise<OfferRedemption[]> {
  if (!client || !isSupabaseConfigured || !isLiveCustomerDataEnabled || !userId) return [];
  try {
    const { data, error } = await client
      .from(SALONOS_TABLES.offerRedemptions)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error || !Array.isArray(data)) return [];
    return data
      .map((row) => {
        const r = asRecord(row);
        if (!r) return null;
        return {
          id: String(r.id ?? ''),
          userId,
          offerId: String(r.offer_id ?? ''),
          salonId: typeof r.salon_id === 'string' ? r.salon_id : undefined,
          redeemedAt: String(r.created_at ?? new Date().toISOString()),
          code: typeof r.code === 'string' ? r.code : undefined,
        };
      })
      .filter((r) => r !== null) as OfferRedemption[];
  } catch {
    return [];
  }
}
