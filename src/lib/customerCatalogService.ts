/**
 * Live customer catalog — canonical Nexora SalonOS schema.
 *
 * Reads salons + salon_services + salon_staff + staff_slots + reviews +
 * offers from the live Supabase project. This is the source of truth for:
 *
 *   Home → Salon Discovery
 *   Salon Profile → Services
 *   Staff → Stylist selection
 *   Offers
 *
 * The service never mixes demo rows into a real catalog and never fabricates
 * data when the backend is empty/unavailable. When a live project is
 * configured the UI intentionally shows an empty/loading state instead of
 * fake salons.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { GalleryPhoto, Review, Salon, SalonService, Stylist } from '../types';
import { supabase, isLiveCustomerDataEnabled, isSupabaseConfigured } from './supabase';
import { SALONOS_TABLES } from './supabase/tables';

export interface CustomerCatalogResult {
  salons: Salon[];
  offers: OfferSummary[];
  source: 'remote' | 'empty';
  warnings: string[];
}

export interface OfferSummary {
  id: string;
  salonId?: string;
  title: string;
  description?: string;
  code?: string;
  discountPercent?: number;
  discountAmount?: number;
  startsAt?: string;
  endsAt?: string;
  isActive?: boolean;
}

// Generic record helpers -------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pick(row: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
  }
  return undefined;
}

function asTrimmedString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (typeof value === 'string') return value.split(',').map((s) => s.trim()).filter(Boolean);
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
  }
  return [];
}

function categoryValue(value: unknown): SalonService['category'] {
  const category = typeof value === 'string' ? value.toLowerCase().trim() : '';
  if (category === 'grooming' || category === 'barber' || category === 'men') return 'grooming';
  if (category === 'skin' || category === 'facial' || category === 'beauty') return 'skin';
  if (category === 'nails' || category === 'nail') return 'nails';
  if (category === 'spa' || category === 'wellness' || category === 'massage') return 'spa';
  if (category === 'bridal' || category === 'makeup') return 'bridal';
  return 'hair';
}

function priceRangeValue(value: unknown): Salon['priceRange'] {
  const v = asTrimmedString(value, '');
  if (['₹', '₹₹', '₹₹₹', '₹₹₹₹', '$', '$$', '$$$'].includes(v)) return v as Salon['priceRange'];
  return '₹₹';
}

function genderValue(value: unknown): Salon['gender'] {
  const g = typeof value === 'string' ? value.toLowerCase().trim() : '';
  return g === 'women' || g === 'men' || g === 'unisex' ? g : 'unisex';
}

function valueAsDateDisplay(value: unknown, fallback = ''): string {
  const raw = pick({ raw: value }, ['raw']);
  if (typeof raw === 'string' && raw.trim()) return raw;
  return fallback;
}

// Row contracts -----------------------------------------------------------------

interface RootCatalogRow {
  [key: string]: unknown;
}

interface ServiceRow {
  id: string;
  salon_id?: string;
  name: string;
  category?: string;
  duration?: number;
  duration_minutes?: number;
  price?: number;
  discount_price?: number;
  description?: string;
  popular?: boolean;
}

interface StaffRow {
  id: string;
  salon_id?: string;
  name: string;
  role?: string;
  avatar?: string;
  rating?: number;
  experience?: string;
  specialty?: string[] | string;
}

interface StaffSlotRow {
  id: string;
  salon_id?: string;
  staff_id?: string;
  date?: string;
  slot_date?: string;
  start_time?: string;
  end_time?: string;
  is_available?: boolean;
  status?: string;
}

interface ReviewRow {
  id: string;
  salon_id?: string;
  user_name?: string;
  full_name?: string;
  rating?: number;
  comment?: string;
  service_used?: string;
  created_at?: string;
  date?: string;
}

interface OfferRow {
  id: string;
  salon_id?: string;
  title?: string;
  name?: string;
  description?: string;
  code?: string;
  discount_percent?: number;
  discount_percentage?: number;
  discount_amount?: number;
  starts_at?: string;
  valid_from?: string;
  ends_at?: string;
  valid_until?: string;
  is_active?: boolean;
  isActive?: boolean;
}

// Normalizers --------------------------------------------------------------------

function normalizeService(row: Record<string, unknown>): SalonService | null {
  const id = asTrimmedString(row.id);
  const name = asTrimmedString(row.name);
  const duration = asNumber(pick(row, ['duration', 'duration_minutes']));
  const price = asNumber(pick(row, ['price', 'amount']));
  if (!id || !name || duration === null || duration <= 0 || price === null || price < 0) return null;
  const discount = asNumber(pick(row, ['discount_price', 'discountPrice', 'offer_price']));
  return {
    id,
    name,
    category: categoryValue(pick(row, ['category', 'service_category', 'type'])),
    duration,
    price,
    discountPrice: discount !== null && discount >= 0 ? discount : undefined,
    description: asTrimmedString(pick(row, ['description', 'details'])),
    popular: asBoolean(pick(row, ['popular', 'is_popular']), false),
  };
}

function normalizeStaff(row: Record<string, unknown>): Stylist | null {
  const id = asTrimmedString(row.id);
  const name = asTrimmedString(pick(row, ['name', 'full_name']));
  if (!id || !name) return null;
  const specialtyRaw = pick(row, ['specialty', 'specialties', 'skills']);
  return {
    id,
    name,
    role: asTrimmedString(pick(row, ['role', 'title', 'designation'])),
    avatar: asTrimmedString(pick(row, ['avatar', 'avatar_url', 'profile_image'])),
    rating: asNumber(pick(row, ['rating', 'avg_rating'])) ?? 0,
    experience: asTrimmedString(pick(row, ['experience', 'experience_years'])),
    specialty: Array.isArray(specialtyRaw) ? specialtyRaw.filter((s) => typeof s === 'string') : asStringArray(specialtyRaw),
  };
}

function normalizeReview(row: Record<string, unknown>): Review | null {
  const id = asTrimmedString(row.id);
  const comment = asTrimmedString(pick(row, ['comment', 'review', 'message']));
  const rating = asNumber(pick(row, ['rating', 'salon_rating']));
  if (!id || !comment || rating === null || rating < 1 || rating > 5) return null;
  const status = String(pick(row, ['status', 'review_status', 'approval_status']) || 'approved').toLowerCase();
  const isApproved = pick(row, ['is_approved', 'isApproved', 'approved']);
  if (status === 'pending' || status === 'rejected' || isApproved === false) return null;
  const created = asTrimmedString(pick(row, ['created_at', 'date', 'review_date']), '');
  return {
    id,
    userName: asTrimmedString(pick(row, ['user_name', 'full_name', 'customer_name']), 'Verified customer'),
    userAvatar: asTrimmedString(pick(row, ['user_avatar', 'avatar_url']), ''),
    rating,
    date: created,
    comment,
    serviceUsed: asTrimmedString(pick(row, ['service_used', 'service_name'])),
  };
}

function normalizeOffer(row: Record<string, unknown>): OfferSummary | null {
  const id = asTrimmedString(row.id);
  const title = asTrimmedString(pick(row, ['title', 'name']));
  if (!id || !title) return null;
  return {
    id,
    salonId: asTrimmedString(pick(row, ['salon_id', 'salonId'])),
    title,
    description: asTrimmedString(pick(row, ['description', 'details'])),
    code: asTrimmedString(pick(row, ['code', 'promo_code', 'coupon_code'])),
    discountPercent: asNumber(pick(row, ['discount_percent', 'discount_percentage', 'percent'])),
    discountAmount: asNumber(pick(row, ['discount_amount', 'amount'])),
    startsAt: asTrimmedString(pick(row, ['starts_at', 'valid_from', 'start_date'])),
    endsAt: asTrimmedString(pick(row, ['ends_at', 'valid_until', 'end_date'])),
    isActive: asBoolean(pick(row, ['is_active', 'isActive', 'active']), true),
  };
}

// Async reader -------------------------------------------------------------------

async function readRows<T>(
  client: SupabaseClient,
  table: string
): Promise<{ rows: T[]; error?: string }> {
  try {
    const { data, error } = await client.from(table).select('*');
    if (error) return { rows: [], error: `${table}: ${error.message}` };
    if (!Array.isArray(data)) return { rows: [] };
    return { rows: data.filter(isRecord) as unknown as T[] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { rows: [], error: `${table}: ${message}` };
  }
}

function rowsForSalon<T extends object>(rows: T[], salonId: string): T[] {
  return rows.filter((row) => {
    const sid = asTrimmedString(pick(row as Record<string, unknown>, ['salon_id', 'salonId']));
    return sid === salonId;
  });
}

function isActiveOfferRow(row: unknown): boolean {
  if (!isRecord(row)) return false;
  const active = row.is_active ?? row.isActive ?? row.active;
  if (active === false) return false;
  const now = Date.now();
  const starts = pick(row, ['starts_at', 'valid_from', 'start_date']);
  const ends = pick(row, ['ends_at', 'valid_until', 'end_date']);
  if (typeof ends === 'string' && ends.trim()) {
    const end = new Date(ends).getTime();
    if (Number.isFinite(end) && end < now) return false;
  }
  if (row.is_active === true && typeof starts === 'string' && typeof ends === 'string') {
    const start = new Date(starts).getTime();
    const end = new Date(ends).getTime();
    if (Number.isFinite(start) && Number.isFinite(end) && (start > now || end < now)) return false;
  }
  return true;
}

function normalizeSalon(
  row: Record<string, unknown>,
  services: ServiceRow[],
  staff: StaffRow[],
  slots: StaffSlotRow[],
  reviews: ReviewRow[],
  offers: OfferRow[]
): Salon | null {
  const id = asTrimmedString(row.id);
  const name = asTrimmedString(pick(row, ['name', 'salon_name']));
  const latitude = asNumber(pick(row, ['latitude', 'lat']));
  const longitude = asNumber(pick(row, ['longitude', 'lng', 'lon']));
  if (!id || !name || latitude === null || longitude === null) return null;

  const salonServices = rowsForSalon(services, id)
    .map((service) => normalizeService(service as unknown as Record<string, unknown>))
    .filter((s): s is SalonService => s !== null);
  const salonStaff = rowsForSalon(staff, id)
    .map((member) => normalizeStaff(member as unknown as Record<string, unknown>))
    .filter((s): s is Stylist => s !== null);
  const salonReviews = rowsForSalon(reviews, id)
    .map((review) => normalizeReview(review as unknown as Record<string, unknown>))
    .filter((r): r is Review => r !== null);
  const salonSlots = rowsForSalon(slots, id);
  const salonOffers = rowsForSalon(offers, id).filter(isActiveOfferRow);

  const image = asTrimmedString(pick(row, ['image', 'image_url', 'cover_image', 'logo']));
  const gallery: string[] = asStringArray(pick(row, ['gallery', 'images', 'photos']));
  const po = pick(row, ['photo_gallery']);
  const photoGallery = Array.isArray(po) ? (po as GalleryPhoto[]) : undefined;

  const firstOffer = salonOffers[0];
  const discountOffer = firstOffer
    ? (asTrimmedString(firstOffer.title) ||
        asTrimmedString(firstOffer.description) ||
        `Offer: ${asTrimmedString(firstOffer.code || '')}`)
    : asTrimmedString(pick(row, ['discount_offer', 'offer']));

  const categories = asStringArray(pick(row, ['categories', 'category_tags']));
  const tags = asStringArray(pick(row, ['tags']));
  const keywords = asStringArray(pick(row, ['keywords']));

  return {
    id,
    name,
    tagline: asTrimmedString(pick(row, ['tagline', 'description', 'about'])),
    categories: categories.length ? categories : Array.from(new Set(salonServices.map((s) => s.category))),
    tags,
    keywords,
    rating: asNumber(pick(row, ['rating', 'average_rating', 'avg_rating'])) ?? salonReviews.reduce((sum, r) => sum + r.rating, 0) / Math.max(salonReviews.length, 1),
    reviewCount: asNumber(pick(row, ['review_count', 'reviewCount', 'ratings_count', 'total_reviews'])) ?? salonReviews.length,
    distance: asTrimmedString(pick(row, ['distance'])),
    location: {
      area: asTrimmedString(pick(row, ['area', 'locality', 'neighborhood'])),
      city: asTrimmedString(pick(row, ['city', 'town']), ''),
      address: asTrimmedString(pick(row, ['address', 'address_line', 'address_line1']), ''),
      latitude,
      longitude,
      mapsUrl: asTrimmedString(pick(row, ['maps_url', 'google_maps_url', 'map_url'])),
    },
    image,
    gallery,
    photoGallery,
    isOpen: asBoolean(pick(row, ['is_open', 'isOpen', 'open_now']), false),
    isActive: asBoolean(pick(row, ['is_active', 'isActive', 'active']), true),
    isVerified: asBoolean(pick(row, ['is_verified', 'isVerified', 'verified']), false),
    openingHours: asTrimmedString(pick(row, ['opening_hours', 'hours', 'business_hours'])),
    priceRange: priceRangeValue(pick(row, ['price_range', 'priceRange', 'pricing'])),
    featured: asBoolean(pick(row, ['featured', 'is_featured']), false),
    trending: asBoolean(pick(row, ['trending', 'is_trending']), false),
    services: salonServices,
    stylists: salonStaff,
    reviews: salonReviews,
    amenities: asStringArray(pick(row, ['amenities'])),
    discountOffer: discountOffer || undefined,
    offerId: firstOffer?.id,
    offerCode: asTrimmedString(firstOffer?.code || ''),
    offerDiscountPercent: firstOffer ? asNumber(pick(firstOffer as unknown as Record<string, unknown>, ['discount_percent', 'discount_percentage'])) ?? undefined : undefined,
    offerDiscountAmount: firstOffer ? asNumber(pick(firstOffer as unknown as Record<string, unknown>, ['discount_amount'])) ?? undefined : undefined,
    phone: asTrimmedString(pick(row, ['phone', 'phone_number', 'mobile'])),
    gender: genderValue(pick(row, ['gender', 'salon_type'])),
  };
}

/**
 * Fetch the live customer catalog using the canonical table set.
 */
export async function fetchCustomerCatalog(
  client: SupabaseClient | null = supabase
): Promise<CustomerCatalogResult> {
  if (!client || !isSupabaseConfigured || !isLiveCustomerDataEnabled) {
    return { salons: [], offers: [], source: 'empty', warnings: ['Live Supabase catalog is not configured.'] };
  }

  const [salons, services, staff, slots, reviews, offers] = await Promise.all([
    readRows<RootCatalogRow>(client, SALONOS_TABLES.salons),
    readRows<ServiceRow>(client, SALONOS_TABLES.salonServices),
    readRows<StaffRow>(client, SALONOS_TABLES.salonStaff),
    readRows<StaffSlotRow>(client, SALONOS_TABLES.staffSlots),
    readRows<ReviewRow>(client, SALONOS_TABLES.reviews),
    readRows<OfferRow>(client, SALONOS_TABLES.offers),
  ]);

  const warnings = [
    salons.error,
    services.error,
    staff.error,
    slots.error,
    reviews.error,
    offers.error,
  ].filter((w): w is string => Boolean(w));

  const normalizedSalons = salons.rows
    .map((row) => normalizeSalon(row, services.rows, staff.rows, slots.rows, reviews.rows, offers.rows))
    .filter((salon): salon is Salon => salon !== null);

  const normalizedOffers = offers.rows
    .map((row) => normalizeOffer(row as unknown as Record<string, unknown>))
    .filter((offer): offer is OfferSummary => offer !== null);

  if (normalizedSalons.length === 0) {
    return {
      salons: [],
      offers: normalizedOffers,
      source: 'empty',
      warnings: warnings.length ? warnings : ['The canonical salon catalog is empty.'],
    };
  }

  return { salons: normalizedSalons, offers: normalizedOffers, source: 'remote', warnings };
}
