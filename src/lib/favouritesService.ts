/**
 * Nexora SalonOS Customer App — favourites service.
 *
 * Uses the canonical `favourites` table. A favourite row may reference a
 * salon, a salon_service, and/or a salon_staff member. The customer only ever
 * reads/toggles their own rows (RLS).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase, isLiveCustomerDataEnabled, isSupabaseConfigured } from './supabase';
import { SALONOS_TABLES } from './supabase/tables';

export interface FavouriteRow {
  id?: string;
  user_id: string;
  salon_id?: string | null;
  service_id?: string | null;
  staff_id?: string | null;
  created_at?: string;
}

export interface CustomerFavourites {
  salonIds: string[];
  serviceIds: string[];
  staffIds: string[];
  serviceRefs: { salonId: string; serviceId: string }[];
  staffRefs: { salonId: string; staffId: string }[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

async function readFavourites(userId: string, client: SupabaseClient): Promise<CustomerFavourites> {
  const result: CustomerFavourites = { salonIds: [], serviceIds: [], staffIds: [], serviceRefs: [], staffRefs: [] };
  const { data, error } = await client
    .from(SALONOS_TABLES.favourites)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error || !Array.isArray(data)) return result;
  const seenSalon = new Set<string>();
  const seenService = new Set<string>();
  const seenStaff = new Set<string>();
  for (const item of data) {
    const row = asRecord(item);
    if (!row) continue;
    const salonId = asString(row.salon_id ?? row.salonId);
    const serviceId = asString(row.service_id ?? row.serviceId);
    const staffId = asString(row.staff_id ?? row.staffId ?? row.stylist_id);
    if (salonId && !seenSalon.has(salonId)) {
      seenSalon.add(salonId);
      result.salonIds.push(salonId);
    }
    const seenServiceKey = `${salonId}|${serviceId}`;
    if (serviceId && !seenService.has(seenServiceKey)) {
      seenService.add(seenServiceKey);
      result.serviceIds.push(serviceId);
      result.serviceRefs.push({ salonId, serviceId });
    }
    const seenStaffKey = `${salonId}|${staffId}`;
    if (staffId && !seenStaff.has(seenStaffKey)) {
      seenStaff.add(seenStaffKey);
      result.staffIds.push(staffId);
      result.staffRefs.push({ salonId, staffId });
    }
  }
  return result;
}

export async function fetchCustomerFavourites(
  userId: string,
  client: SupabaseClient | null = supabase
): Promise<CustomerFavourites> {
  if (!client || !isSupabaseConfigured || !isLiveCustomerDataEnabled || !userId) {
    return { salonIds: [], serviceIds: [], staffIds: [], serviceRefs: [], staffRefs: [] };
  }
  return readFavourites(userId, client);
}

async function hasFavourite(
  client: SupabaseClient,
  userId: string,
  target: Omit<FavouriteRow, 'user_id'>
): Promise<boolean> {
  let query = client.from(SALONOS_TABLES.favourites).select('id').eq('user_id', userId);
  if (target.salon_id) query = query.eq('salon_id', target.salon_id);
  if (target.service_id) query = query.eq('service_id', target.service_id);
  if (target.staff_id) query = query.eq('staff_id', target.staff_id);
  const { data, error } = await query;
  if (error) return false;
  return Array.isArray(data) && data.length > 0;
}

export async function addCustomerFavourite(
  userId: string,
  target: { salonId?: string; serviceId?: string; staffId?: string },
  client: SupabaseClient | null = supabase
): Promise<{ error: string | null }> {
  if (!client || !isSupabaseConfigured || !isLiveCustomerDataEnabled || !userId) {
    return { error: 'Live Supabase favourites service is not configured.' };
  }
  const payload: FavouriteRow = {
    user_id: userId,
    salon_id: target.salonId || null,
    service_id: target.serviceId || null,
    staff_id: target.staffId || null,
  };
  if (!payload.salon_id && !payload.service_id && !payload.staff_id) {
    return { error: 'Missing favourite target.' };
  }
  const exists = await hasFavourite(client, userId, {
    salon_id: payload.salon_id,
    service_id: payload.service_id,
    staff_id: payload.staff_id,
  });
  if (exists) return { error: null };
  const { error } = await client.from(SALONOS_TABLES.favourites).insert(payload);
  return { error: error?.message || null };
}

export async function removeCustomerFavourite(
  userId: string,
  target: { salonId?: string; serviceId?: string; staffId?: string },
  client: SupabaseClient | null = supabase
): Promise<{ error: string | null }> {
  if (!client || !isSupabaseConfigured || !isLiveCustomerDataEnabled || !userId) {
    return { error: 'Live Supabase favourites service is not configured.' };
  }
  let query = client.from(SALONOS_TABLES.favourites).delete().eq('user_id', userId);
  if (target.salonId) query = query.eq('salon_id', target.salonId);
  if (target.serviceId) query = query.eq('service_id', target.serviceId);
  if (target.staffId) query = query.eq('staff_id', target.staffId);
  const { error } = await query;
  return { error: error?.message || null };
}

export async function toggleCustomerFavourite(
  userId: string,
  current: CustomerFavourites,
  target: { salonId?: string; serviceId?: string; staffId?: string }
): Promise<{ error: string | null; nowFavourite: boolean }> {
  const salonOn = target.salonId ? current.salonIds.includes(target.salonId) : false;
  const serviceOn = target.serviceId
    ? current.serviceRefs.some((r) => r.salonId === target.salonId && r.serviceId === target.serviceId) ||
      (!target.salonId && current.serviceIds.includes(target.serviceId))
    : false;
  const staffOn = target.staffId
    ? current.staffRefs.some((r) => r.salonId === target.salonId && r.staffId === target.staffId) ||
      (!target.salonId && current.staffIds.includes(target.staffId))
    : false;
  const nowFavourite = !(salonOn || serviceOn || staffOn);
  const result = nowFavourite
    ? await addCustomerFavourite(userId, target)
    : await removeCustomerFavourite(userId, target);
  return { error: result.error, nowFavourite };
}
