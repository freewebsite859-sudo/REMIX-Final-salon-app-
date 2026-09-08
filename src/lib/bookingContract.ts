/**
 * Canonical booking payload contract shared by the customer app, the Node
 * booking service (`server/bookings.ts`) and the persisted booking schema.
 *
 * This module is intentionally PURE (no React, no DOM, no Supabase) so the
 * exact same functions run in the browser bundle, in the Node server bundle
 * and in unit tests. It is the single source of truth for how multi-service
 * line items are formatted — every booking, single- or multi-service, stores
 * the same JSON-safe shape inside `metadata.services[]`:
 *
 *   metadata: { services: BookingServiceLine[] }
 *
 * Null/undefined rules:
 *  - `buildBookingMetadataServices()` accepts `null`/`undefined`/empty input
 *    and always returns a plain array (length 0 when nothing valid is given).
 *  - Invalid catalog rows (missing id/name, non-finite price, non-positive
 *    duration) are DROPPED, never coerced to NaN/0 placeholders.
 *  - Duplicate service ids are de-duplicated, keeping first occurrence order.
 *  - `discountPrice` is optional: when absent the charged price is `price`.
 */

import type { Salon, SalonService, Stylist } from '../types';

// ---------------------------------------------------------------------------
// Canonical line-item shape (what metadata.services[] / DB rows are built from)
// ---------------------------------------------------------------------------

export interface BookingServiceLine {
  /** Catalog service id (stable across salons). */
  id: string;
  name: string;
  /** Minutes for this single service (SalonService.duration). */
  durationMinutes: number;
  /** List price before any per-service discount. */
  price: number;
  /**
   * Per-service discounted price when the catalog carries one. Absent (not
   * null) when no discount applies so JSON snapshots stay clean.
   */
  discountPrice?: number;
  /**
   * Price actually charged to the customer = discountPrice ?? price. Always
   * present and finite — this is what every totals panel sums.
   */
  unitPrice: number;
  /** Optional display category; may be absent on legacy snapshots. */
  category?: string;
  description?: string;
  popular?: boolean;
}

/** JSON-safe salon display snapshot echoed onto the booking record. */
export interface BookingSalonSnapshot {
  id: string;
  name: string;
  image?: string;
  address?: string;
  phone?: string;
  rating?: number;
  mapsUrl?: string;
  latitude?: number;
  longitude?: number;
}

/** Optional customer context attached by the authenticated caller. */
export interface BookingCustomerSnapshot {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
}

export interface BookingStylistSnapshot {
  id: string;
  name: string;
  role?: string;
  avatar?: string;
  rating?: number;
  experience?: string;
  specialty?: string[];
}

/** The complete server-side create-booking request (see BookingPaymentRequest). */
export interface BookingCreateRequest {
  salon: BookingSalonSnapshot;
  /** Explicit line items. `serviceIds` alone is never enough for the server. */
  services: BookingServiceLine[];
  stylist?: BookingStylistSnapshot | null;
  customer?: BookingCustomerSnapshot | null;
  date: string; // YYYY-MM-DD
  time: string; // e.g. "5:30 PM"
  /** 25% advance the caller is depositing (INR). */
  amount: number;
  couponCode?: string;
  /** Coupon discount already applied on top of per-service discounts (INR). */
  discountAmount?: number;
  notes?: string;
}

/** Metadata object persisted in `bookings.metadata` (jsonb). */
export interface BookingMetadata {
  services: BookingServiceLine[];
}

// ---------------------------------------------------------------------------
// Pure mapping helpers
// ---------------------------------------------------------------------------

/** Safe positive-number reader. Returns null for anything non-finite. */
function finiteNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Normalize one catalog service into a booking line item.
 * Returns null when the row is unusable (no id/name, invalid price/duration).
 */
export function toBookingServiceLine(
  service: SalonService | null | undefined | Partial<SalonService>
): BookingServiceLine | null {
  if (!service || typeof service !== 'object') return null;
  const id = typeof service.id === 'string' ? service.id.trim() : '';
  const name = typeof service.name === 'string' ? service.name.trim() : '';
  const price = finiteNumber(service.price);
  const duration = finiteNumber(service.duration);
  if (!id || !name || price === null || price < 0 || duration === null || duration <= 0) {
    return null;
  }

  // Per-service discount: charged price = discountPrice when it is a valid,
  // smaller number; otherwise the list price. Mirrors every UI subtotal.
  const discountPrice = finiteNumber(service.discountPrice);
  const useDiscount = discountPrice !== null && discountPrice >= 0 && discountPrice < price;
  const unitPrice = useDiscount ? discountPrice : price;

  const line: BookingServiceLine = {
    id,
    name,
    durationMinutes: Math.round(duration),
    price: Math.round(price * 100) / 100,
    unitPrice: Math.round(unitPrice * 100) / 100,
  };
  if (useDiscount) line.discountPrice = Math.round(discountPrice * 100) / 100;
  if (typeof service.category === 'string' && service.category.trim()) {
    line.category = service.category.trim();
  }
  if (typeof service.description === 'string' && service.description.trim()) {
    line.description = service.description.trim();
  }
  if (service.popular === true) line.popular = true;
  return line;
}

/**
 * Build the canonical `metadata.services[]` array from any incoming selection.
 * Null/undefined/empty input → []. Invalid rows are dropped; duplicates are
 * de-duplicated by id (first occurrence wins, order preserved).
 */
export function buildBookingMetadataServices(
  services: readonly SalonService[] | null | undefined
): BookingServiceLine[] {
  if (!Array.isArray(services) || services.length === 0) return [];
  const seen = new Set<string>();
  const lines: BookingServiceLine[] = [];
  for (const srv of services) {
    const line = toBookingServiceLine(srv);
    if (!line || seen.has(line.id)) continue;
    seen.add(line.id);
    lines.push(line);
  }
  return lines;
}

/** Total charged price of line items (Σ unitPrice) — same math as the UI. */
export function lineItemsSubtotal(lines: readonly BookingServiceLine[] | null | undefined): number {
  if (!Array.isArray(lines)) return 0;
  return lines.reduce((sum, line) => sum + (line.unitPrice || 0), 0);
}

/** Total duration in minutes of line items. */
export function lineItemsDurationMinutes(
  lines: readonly BookingServiceLine[] | null | undefined
): number {
  if (!Array.isArray(lines)) return 0;
  return lines.reduce((sum, line) => sum + (line.durationMinutes || 0), 0);
}

/** Build the JSON-safe salon snapshot (empty object when salon is missing). */
export function toBookingSalonSnapshot(
  salon: Salon | null | undefined
): BookingSalonSnapshot {
  if (!salon) return { id: '', name: '' };
  const snapshot: BookingSalonSnapshot = {
    id: typeof salon.id === 'string' ? salon.id : '',
    name: typeof salon.name === 'string' ? salon.name : '',
  };
  if (typeof salon.image === 'string') snapshot.image = salon.image;
  if (typeof salon.location?.address === 'string') snapshot.address = salon.location.address;
  if (typeof salon.phone === 'string') snapshot.phone = salon.phone;
  if (typeof salon.rating === 'number' && Number.isFinite(salon.rating)) snapshot.rating = salon.rating;
  if (typeof salon.location?.mapsUrl === 'string') snapshot.mapsUrl = salon.location.mapsUrl;
  if (typeof salon.location?.latitude === 'number' && Number.isFinite(salon.location.latitude)) {
    snapshot.latitude = salon.location.latitude;
  }
  if (typeof salon.location?.longitude === 'number' && Number.isFinite(salon.location.longitude)) {
    snapshot.longitude = salon.location.longitude;
  }
  return snapshot;
}

/** Build the JSON-safe stylist snapshot (null when none chosen). */
export function toBookingStylistSnapshot(
  stylist: Stylist | null | undefined
): BookingStylistSnapshot | null {
  if (!stylist) return null;
  const id = typeof stylist.id === 'string' ? stylist.id : '';
  const name = typeof stylist.name === 'string' ? stylist.name : '';
  if (!id || !name) return null;
  const snapshot: BookingStylistSnapshot = { id, name };
  if (typeof stylist.role === 'string' && stylist.role.trim()) snapshot.role = stylist.role.trim();
  if (typeof stylist.avatar === 'string' && stylist.avatar.trim()) snapshot.avatar = stylist.avatar.trim();
  if (typeof stylist.experience === 'string' && stylist.experience.trim()) {
    snapshot.experience = stylist.experience.trim();
  }
  if (Array.isArray(stylist.specialty)) {
    const specialty = stylist.specialty
      .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      .map((s) => s.trim())
      .slice(0, 20);
    if (specialty.length > 0) snapshot.specialty = specialty;
  }
  if (typeof stylist.rating === 'number' && Number.isFinite(stylist.rating)) {
    snapshot.rating = stylist.rating;
  }
  return snapshot;
}

// ---------------------------------------------------------------------------
// Server response → client Appointment reconstruction
// ---------------------------------------------------------------------------

const KNOWN_CATEGORIES = ['hair', 'skin', 'nails', 'spa', 'grooming', 'bridal'] as const;

/**
 * Rebuild display-ready `SalonService[]` from stored/returned line items.
 * Used when the server echoes the booking back so confirmation pages can
 * render names, durations and prices without extra lookups. Category is only
 * kept when it is one of the known catalog unions.
 */
export function toSalonServices(
  lines: readonly BookingServiceLine[] | null | undefined
): SalonService[] {
  if (!Array.isArray(lines)) return [];
  const services: SalonService[] = [];
  for (const line of lines) {
    if (!line || typeof line.id !== 'string' || !line.name || !Number.isFinite(line.unitPrice)) {
      continue;
    }
    const duration = Number.isFinite(line.durationMinutes)
      ? Math.max(1, Math.round(line.durationMinutes))
      : 30;
    const price = Number.isFinite(line.price) ? line.price : line.unitPrice;
    const hasDiscount =
      typeof line.discountPrice === 'number' &&
      Number.isFinite(line.discountPrice) &&
      line.discountPrice < price;
    const category =
      typeof line.category === 'string' &&
      (KNOWN_CATEGORIES as readonly string[]).includes(line.category)
        ? (line.category as SalonService['category'])
        : 'spa';
    services.push({
      id: line.id,
      name: line.name,
      category,
      duration,
      price,
      ...(hasDiscount ? { discountPrice: line.discountPrice as number } : {}),
      description:
        typeof line.description === 'string' && line.description.trim()
          ? line.description.trim()
          : '',
      ...(line.popular === true ? { popular: true } : {}),
    });
  }
  return services;
}
