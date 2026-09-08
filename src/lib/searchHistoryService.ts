/**
 * Nexora SalonOS Customer App — search history service.
 *
 * Stores/reads the customer's own `search_history` rows. Each row is private
 * to the signed-in user; the service never writes another user's history.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase, isLiveCustomerDataEnabled, isSupabaseConfigured } from './supabase';
import { SALONOS_TABLES } from './supabase/tables';

export interface SearchHistoryRow {
  id?: string;
  userId: string;
  query: string;
  filters?: Record<string, unknown>;
  createdAt: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export async function fetchSearchHistory(
  userId: string,
  client: SupabaseClient | null = supabase
): Promise<SearchHistoryRow[]> {
  if (!client || !isSupabaseConfigured || !isLiveCustomerDataEnabled || !userId) return [];
  try {
    const { data, error } = await client
      .from(SALONOS_TABLES.searchHistory)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error || !Array.isArray(data)) return [];
    return data
      .map((row) => {
        const r = asRecord(row);
        if (!r) return null;
        return {
          id: typeof r.id === 'string' ? r.id : undefined,
          userId,
          query: String(r.query ?? r.search_query ?? ''),
          filters: typeof r.filters === 'object' && r.filters !== null ? (r.filters as Record<string, unknown>) : undefined,
          createdAt: String(r.created_at ?? new Date().toISOString()),
        };
      })
      .filter((r) => r !== null && r.query.length > 0) as SearchHistoryRow[];
  } catch {
    return [];
  }
}

export async function recordSearch(
  userId: string,
  query: string,
  filters?: Record<string, unknown>,
  client: SupabaseClient | null = supabase
): Promise<{ error: string | null }> {
  if (!client || !isSupabaseConfigured || !isLiveCustomerDataEnabled || !userId || !query.trim()) {
    return { error: null };
  }
  const { error } = await client.from(SALONOS_TABLES.searchHistory).insert({
    user_id: userId,
    query: query.trim().slice(0, 200),
    search_query: query.trim().slice(0, 200),
    filters: filters || null,
    created_at: new Date().toISOString(),
  });
  return { error: error?.message || null };
}
