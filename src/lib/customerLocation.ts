/**
 * Customer location preference — what the first-login flow and header picker
 * persist for "find salons near you".
 *
 * Coordinates are also pushed to the RLS-backed `user_locations` table via
 * `syncUserLocation` (live GPS). The structured preference below is the
 * human-readable city/area/pincode the UI shows and filters against.
 */

import { formatAreaLabel, type JaipurArea } from './jaipurAreas';
import { syncUserLocation } from './locationService';

export const CUSTOMER_LOCATION_STORAGE_PREFIX = 'nexora-customer-location';
export const CUSTOMER_LOCATION_SETUP_PREFIX = 'nexora-customer-location-setup';

export interface CustomerLocationPreference {
  latitude: number;
  longitude: number;
  city: string;
  area: string;
  /** Indian PIN when known (chip pick or reverse match). */
  pincode?: string;
  /** Header label, e.g. "Mansarovar, Jaipur". */
  label: string;
  /** How the customer chose this location. */
  source: 'gps' | 'manual' | 'chip';
  /** ISO timestamp of when the preference was saved. */
  updatedAt: string;
}

function storageKey(prefix: string, userId: string): string {
  return `${prefix}:${userId}`;
}

function isFiniteCoord(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidPreference(value: unknown): value is CustomerLocationPreference {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    isFiniteCoord(v.latitude) &&
    isFiniteCoord(v.longitude) &&
    v.latitude >= -90 &&
    v.latitude <= 90 &&
    v.longitude >= -180 &&
    v.longitude <= 180 &&
    typeof v.city === 'string' &&
    v.city.trim().length > 0 &&
    typeof v.area === 'string' &&
    v.area.trim().length > 0 &&
    typeof v.label === 'string' &&
    v.label.trim().length > 0
  );
}

export function loadCustomerLocation(
  userId: string | null | undefined
): CustomerLocationPreference | null {
  if (!userId || typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey(CUSTOMER_LOCATION_STORAGE_PREFIX, userId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidPreference(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveCustomerLocation(
  userId: string | null | undefined,
  preference: Omit<CustomerLocationPreference, 'updatedAt' | 'label'> & {
    label?: string;
    updatedAt?: string;
  }
): CustomerLocationPreference | null {
  if (!userId || typeof window === 'undefined') return null;
  if (
    !isFiniteCoord(preference.latitude) ||
    !isFiniteCoord(preference.longitude) ||
    preference.latitude < -90 ||
    preference.latitude > 90 ||
    preference.longitude < -180 ||
    preference.longitude > 180 ||
    !preference.city?.trim() ||
    !preference.area?.trim()
  ) {
    return null;
  }

  const saved: CustomerLocationPreference = {
    latitude: preference.latitude,
    longitude: preference.longitude,
    city: preference.city.trim(),
    area: preference.area.trim(),
    pincode: preference.pincode?.trim() || undefined,
    label:
      preference.label?.trim() ||
      formatAreaLabel({ area: preference.area.trim(), city: preference.city.trim() }),
    source: preference.source,
    updatedAt: preference.updatedAt || new Date().toISOString(),
  };

  try {
    localStorage.setItem(
      storageKey(CUSTOMER_LOCATION_STORAGE_PREFIX, userId),
      JSON.stringify(saved)
    );
    // Mark first-login setup complete for this account.
    localStorage.setItem(storageKey(CUSTOMER_LOCATION_SETUP_PREFIX, userId), 'done');
  } catch {
    /* storage full / denied — preference still returned for in-memory use */
  }

  return saved;
}

/** True once this account has completed (or skipped) the first-login flow. */
export function hasCompletedLocationSetup(userId: string | null | undefined): boolean {
  if (!userId || typeof window === 'undefined') return false;
  try {
    if (localStorage.getItem(storageKey(CUSTOMER_LOCATION_SETUP_PREFIX, userId)) === 'done') {
      return true;
    }
    // A previously saved preference also counts as completed setup.
    return loadCustomerLocation(userId) !== null;
  } catch {
    return false;
  }
}

export function markLocationSetupComplete(userId: string | null | undefined): void {
  if (!userId || typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey(CUSTOMER_LOCATION_SETUP_PREFIX, userId), 'done');
  } catch {
    /* ignore */
  }
}

export function clearCustomerLocation(userId: string | null | undefined): void {
  if (!userId || typeof window === 'undefined') return;
  try {
    localStorage.removeItem(storageKey(CUSTOMER_LOCATION_STORAGE_PREFIX, userId));
    localStorage.removeItem(storageKey(CUSTOMER_LOCATION_SETUP_PREFIX, userId));
  } catch {
    /* ignore */
  }
}

/** Build a preference from a Jaipur area chip selection. */
export function preferenceFromChip(
  chip: JaipurArea,
  source: 'manual' | 'chip' = 'chip'
): Omit<CustomerLocationPreference, 'updatedAt'> {
  return {
    latitude: chip.latitude,
    longitude: chip.longitude,
    city: chip.city,
    area: chip.area,
    pincode: chip.pincode,
    label: formatAreaLabel(chip),
    source,
  };
}

/**
 * Persist preference locally AND push coordinates to the secure location
 * backend (authenticated only). Backend failure is non-fatal — the UI still
 * gets a usable preference.
 */
export async function persistCustomerLocation(
  userId: string,
  preference: Omit<CustomerLocationPreference, 'updatedAt' | 'label'> & {
    label?: string;
  }
): Promise<CustomerLocationPreference | null> {
  const saved = saveCustomerLocation(userId, preference);
  if (!saved) return null;

  try {
    await syncUserLocation(userId, {
      latitude: saved.latitude,
      longitude: saved.longitude,
    });
  } catch (err) {
    console.warn('[Nexora] Location backend sync failed after first-login save:', err);
  }

  return saved;
}
