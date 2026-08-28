import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';

/**
 * Nexora secure location backend access layer.
 *
 * All writes go through the shared, authenticated Supabase client so Postgres
 * RLS sees `auth.uid()` and can enforce "a user may only write their own row".
 * No service_role key, no bypass, no anonymous writes.
 */

/** Table in the Nexora project holding live customer coordinates. */
function readEnv(name: string): string | undefined {
  // Literal `import.meta.env` access so Vite inlines the VITE_* values at
  // build time (see src/lib/supabase.ts readEnv for details).
  const viteEnv = import.meta.env as unknown as
    | Record<string, string | undefined>
    | undefined;
  const fromVite = viteEnv?.[name];
  if (fromVite) return fromVite;
  const nodeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env;
  return nodeEnv?.[name];
}

export const LOCATION_TABLE = readEnv('VITE_NEXORA_LOCATION_TABLE')?.trim() || 'user_locations';

export interface NexoraCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  altitude?: number | null;
}

export interface LocationSyncResult {
  ok: boolean;
  /** Backend unavailable (missing table / blocked by RLS) — sync is disabled, not retried forever. */
  disabled?: boolean;
  error?: string;
}

/**
 * Postgres / PostgREST codes that mean "this will never succeed" — the table
 * or column does not exist, or RLS forbids this role. Retrying is pointless
 * and would spam the network, so the caller latches sync off.
 */
const FATAL_CODES = new Set([
  '42P01', // undefined_table
  '42703', // undefined_column
  '42501', // insufficient_privilege (RLS denial)
  'PGRST205', // schema cache: table not found
  'PGRST204', // schema cache: column not found
  'PGRST301', // JWT / role not permitted
]);

export function isFatalLocationError(code?: string | null, message?: string | null): boolean {
  if (code && FATAL_CODES.has(code)) return true;
  const text = (message || '').toLowerCase();
  return (
    text.includes('does not exist') ||
    text.includes('not found in the schema cache') ||
    text.includes('violates row-level security')
  );
}

/** Round to ~1.1 m so we do not persist noisy GPS jitter as new positions. */
export function roundCoord(value: number): number {
  return Math.round(value * 1e5) / 1e5;
}

/** Metres between two coordinates (haversine) — used to throttle writes. */
export function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Upsert the signed-in user's live coordinates.
 *
 * The row is keyed by `user_id` so each customer keeps exactly one live
 * position row, which is the shape the Nexora RLS policy
 * (`auth.uid() = user_id`) is written against.
 */
export async function syncUserLocation(
  userId: string,
  coords: NexoraCoordinates,
  client: SupabaseClient | null = supabase
): Promise<LocationSyncResult> {
  if (!client) return { ok: false, disabled: true, error: 'Supabase not configured' };
  if (!userId) return { ok: false, error: 'Missing user id' };
  if (
    !Number.isFinite(coords.latitude) ||
    !Number.isFinite(coords.longitude) ||
    coords.latitude < -90 ||
    coords.latitude > 90 ||
    coords.longitude < -180 ||
    coords.longitude > 180
  ) {
    return { ok: false, error: 'Invalid coordinates' };
  }

  const payload = {
    user_id: userId,
    latitude: roundCoord(coords.latitude),
    longitude: roundCoord(coords.longitude),
    accuracy: coords.accuracy ?? null,
    heading: coords.heading ?? null,
    speed: coords.speed ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await client
    .from(LOCATION_TABLE)
    .upsert(payload, { onConflict: 'user_id' });

  if (error) {
    const fatal = isFatalLocationError(error.code, error.message);
    if (fatal) {
      console.warn(
        `[Nexora] Location sync disabled — backend table "${LOCATION_TABLE}" is unavailable ` +
          `or blocked by RLS (${error.code || 'no code'}: ${error.message}).`
      );
    }
    return { ok: false, disabled: fatal, error: error.message };
  }

  return { ok: true };
}

/**
 * Remove the user's stored live position. Called on sign-out so a logged-out
 * device stops being discoverable — the same RLS policy authorises the delete.
 */
export async function clearUserLocation(
  userId: string,
  client: SupabaseClient | null = supabase
): Promise<LocationSyncResult> {
  if (!client || !userId) return { ok: false, disabled: !client };

  const { error } = await client.from(LOCATION_TABLE).delete().eq('user_id', userId);

  if (error) {
    return { ok: false, disabled: isFatalLocationError(error.code, error.message), error: error.message };
  }
  return { ok: true };
}

/**
 * One-shot read of the browser position — reuses the same options the existing
 * LocationModal "Use Current Device Location" button relies on.
 */
export function getCurrentPositionOnce(
  options: PositionOptions = { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

/** Human-readable label matching the existing LocationModal formatting. */
export function formatCoordsLabel(latitude: number, longitude: number): string {
  return `Current Location (${latitude.toFixed(3)}, ${longitude.toFixed(3)})`;
}
