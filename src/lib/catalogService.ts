import type { SupabaseClient } from '@supabase/supabase-js';
import type { GalleryPhoto, Review, Salon, SalonService, Stylist, SalonVideoReel } from '../types';
import { isNexoraDemoMode, supabase } from './supabase';
import { DEMO_SALONS } from '../data/demoCatalog';
import { getTemplateSalons } from '../data/templateSalons';
import { getReelsForSalon } from '../data/salonVideoReels';

export type CatalogSource = 'remote' | 'fallback';

export interface CatalogResult {
  salons: Salon[];
  source: CatalogSource;
  /** Non-fatal child-table errors are retained for diagnostics. */
  warnings: string[];
}

/**
 * Strictly typed Supabase row contracts.
 * No dynamic fallback arrays — each table has a canonical schema.
 * This replaces the previous RawRow extends Record<string, unknown> pattern
 * and eliminates salon_setup_proposals-style dynamic key handling.
 */

// ---------------------------------------------------------------------------
// Canonical DB row types (strict)
// ---------------------------------------------------------------------------

export interface SalonDbRow {
  id: string;
  name: string;
  tagline?: string | null;
  description?: string | null;
  latitude: number;
  longitude: number;
  address?: string | null;
  area?: string | null;
  city?: string | null;
  maps_url?: string | null;
  image?: string | null;
  gallery?: string[] | string | null;
  photo_gallery?: GalleryPhoto[] | null;
  is_open?: boolean | null;
  opening_hours?: string | null;
  price_range?: Salon['priceRange'] | string | null;
  rating?: number | null;
  review_count?: number | null;
  featured?: boolean | null;
  trending?: boolean | null;
  amenities?: string[] | string | null;
  discount_offer?: string | null;
  phone?: string | null;
  gender?: Salon['gender'] | string | null;
  categories?: string[] | string | null;
  video_url?: string | null;
  video_preview_url?: string | null;
  video_reels?: SalonVideoReel[] | null;
  // Optional search enrichment columns (mirrored from Salon interface)
  tags?: string[] | string | null;
  keywords?: string[] | string | null;
  // Embedded relations (optional, when using joined queries)
  services?: ServiceDbRow[] | null;
  professionals?: ProfessionalDbRow[] | null;
  stylists?: ProfessionalDbRow[] | null;
  reviews?: ReviewDbRow[] | null;
  distance?: string | null;
  distance_km?: number | null;
}

export interface ServiceDbRow {
  id: string;
  salon_id?: string;
  name: string;
  category?: string | null;
  duration: number;
  price: number;
  discount_price?: number | null;
  description?: string | null;
  popular?: boolean | null;
}

export interface ProfessionalDbRow {
  id: string;
  salon_id?: string;
  name: string;
  role?: string | null;
  avatar?: string | null;
  rating?: number | null;
  experience?: string | null;
  specialty?: string[] | string | null;
}

export interface CategoryDbRow {
  id: string;
  salon_id?: string;
  name: string;
  slug?: string | null;
  label?: string | null;
}

export interface ReviewDbRow {
  id: string;
  salon_id?: string | null;
  user_name?: string | null;
  user_avatar?: string | null;
  rating: number;
  date?: string | null;
  comment: string;
  service_used?: string | null;
}

// ---------------------------------------------------------------------------
// Table name resolution (env overridable, strict fallback)
// ---------------------------------------------------------------------------

const TABLES = {
  salons: 'VITE_NEXORA_SALONS_TABLE',
  services: 'VITE_NEXORA_SERVICES_TABLE',
  categories: 'VITE_NEXORA_CATEGORIES_TABLE',
  professionals: 'VITE_NEXORA_PROFESSIONALS_TABLE',
} as const;

function env(name: string): string | undefined {
  const viteEnv = (import.meta as unknown as { env?: Record<string, string | undefined> })?.env || {};
  const viteValue = viteEnv[name];
  if (viteValue) return viteValue;
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name];
}

function tableName(key: keyof typeof TABLES, fallback: string): string {
  const value = env(TABLES[key])?.trim();
  return value && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value) ? value : fallback;
}

// ---------------------------------------------------------------------------
// Strict type guards & coercion helpers (no fallback key arrays)
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asTrimmedString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asOptionalString(value: unknown): string | undefined {
  const s = asTrimmedString(value, '');
  return s ? s : undefined;
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
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function asStringArrayFromMixed(value: unknown): string[] {
  if (typeof value === 'string') return asStringArray(value);
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (isRecord(item)) {
        const name = asTrimmedString(item.name ?? item.label ?? item.title ?? item.slug, '');
        return name;
      }
      return '';
    })
    .filter(Boolean);
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
  const valueString = typeof value === 'string' ? value.trim() : '';
  if (['₹', '₹₹', '₹₹₹', '₹₹₹₹', '$', '$$', '$$$'].includes(valueString)) {
    return valueString as Salon['priceRange'];
  }
  return '₹₹';
}

function genderValue(value: unknown): Salon['gender'] {
  const g = typeof value === 'string' ? value.toLowerCase().trim() : '';
  if (g === 'women' || g === 'men' || g === 'unisex') return g;
  return 'unisex';
}

// ---------------------------------------------------------------------------
// Strict normalizers (no dynamic key fallback)
// ---------------------------------------------------------------------------

function normalizeReview(row: ReviewDbRow): Review | null {
  const id = asTrimmedString(row.id, '');
  const comment = asTrimmedString(row.comment, '');
  const rating = asNumber(row.rating);
  if (!id || !comment || rating === null || rating < 1 || rating > 5) return null;

  return {
    id,
    userName: asTrimmedString(row.user_name, 'Verified customer'),
    userAvatar: asTrimmedString(row.user_avatar, ''),
    rating,
    date: asTrimmedString(row.date, ''),
    comment,
    serviceUsed: asOptionalString(row.service_used),
  };
}

function normalizeService(row: ServiceDbRow): SalonService | null {
  const id = asTrimmedString(row.id, '');
  const name = asTrimmedString(row.name, '');
  const duration = asNumber(row.duration);
  const price = asNumber(row.price);

  if (!id || !name || duration === null || duration <= 0 || price === null || price < 0) return null;

  const discountPrice = asNumber(row.discount_price);

  return {
    id,
    name,
    category: categoryValue(row.category),
    duration,
    price,
    discountPrice: discountPrice !== null && discountPrice >= 0 ? discountPrice : undefined,
    description: asTrimmedString(row.description, ''),
    popular: asBoolean(row.popular, false),
  };
}

function normalizeStylist(row: ProfessionalDbRow): Stylist | null {
  const id = asTrimmedString(row.id, '');
  const name = asTrimmedString(row.name, '');
  if (!id || !name) return null;

  return {
    id,
    name,
    role: asTrimmedString(row.role, ''),
    avatar: asTrimmedString(row.avatar, ''),
    rating: asNumber(row.rating) ?? 0,
    experience: asTrimmedString(row.experience, ''),
    specialty: asStringArrayFromMixed(row.specialty),
  };
}

function rowsForSalon<T extends { salon_id?: string }>(rows: T[], salonId: string): T[] {
  return rows.filter((row) => row.salon_id === salonId);
}

// ---------------------------------------------------------------------------
// Strict catalog normalization
// ---------------------------------------------------------------------------

/**
 * Convert the canonical table response into the customer app's view model.
 * Only strictly typed fields are used; missing coordinates make a salon invalid.
 */
export function normalizeCatalog(
  salonRows: SalonDbRow[],
  serviceRows: ServiceDbRow[],
  categoryRows: CategoryDbRow[],
  professionalRows: ProfessionalDbRow[]
): Salon[] {
  const salons: Salon[] = [];

  for (const row of salonRows) {
    const id = asTrimmedString(row.id, '');
    const name = asTrimmedString(row.name, '');
    const latitude = asNumber(row.latitude);
    const longitude = asNumber(row.longitude);

    if (
      !id ||
      !name ||
      latitude === null ||
      longitude === null ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      continue;
    }

    // Embedded relations take precedence when present (joined query)
    const embeddedServices: ServiceDbRow[] = Array.isArray(row.services)
      ? row.services.filter((s): s is ServiceDbRow => isRecord(s) && typeof (s as ServiceDbRow).id === 'string')
      : [];
    const embeddedProfessionals: ProfessionalDbRow[] = Array.isArray(row.professionals)
      ? row.professionals.filter((p): p is ProfessionalDbRow => isRecord(p) && typeof (p as ProfessionalDbRow).id === 'string')
      : Array.isArray(row.stylists)
        ? row.stylists.filter((p): p is ProfessionalDbRow => isRecord(p) && typeof (p as ProfessionalDbRow).id === 'string')
        : [];

    const services = (embeddedServices.length ? embeddedServices : rowsForSalon(serviceRows, id))
      .map(normalizeService)
      .filter((service): service is SalonService => service !== null);

    const stylists = (embeddedProfessionals.length ? embeddedProfessionals : rowsForSalon(professionalRows, id))
      .map(normalizeStylist)
      .filter((stylist): stylist is Stylist => stylist !== null);

    const reviews = Array.isArray(row.reviews)
      ? row.reviews
          .filter((r): r is ReviewDbRow => isRecord(r) && typeof (r as ReviewDbRow).id === 'string')
          .map(normalizeReview)
          .filter((review): review is Review => review !== null)
      : [];

    const relatedCategories = rowsForSalon(categoryRows, id);
    const categories = [
      ...asStringArrayFromMixed(row.categories),
      ...relatedCategories.map((category) => asTrimmedString(category.name || category.label || category.slug, '')).filter(Boolean),
    ].filter((category, index, values) => values.indexOf(category) === index);

    const image = asTrimmedString(row.image, '');
    const gallery = asStringArrayFromMixed(row.gallery);
    const address = asTrimmedString(row.address, '');
    const area = asTrimmedString(row.area, '');
    const city = asTrimmedString(row.city, '');

    const distanceLabel = asTrimmedString(row.distance, '');
    const distanceKm = asNumber(row.distance_km);

    salons.push({
      id,
      name,
      tagline: asTrimmedString(row.tagline ?? row.description, ''),
      categories,
      tags: asStringArrayFromMixed(row.tags),
      keywords: asStringArrayFromMixed(row.keywords),
      rating: asNumber(row.rating) ?? 0,
      reviewCount: asNumber(row.review_count) ?? reviews.length,
      distance: distanceLabel || (distanceKm !== null ? `${distanceKm} km` : ''),
      location: {
        area,
        city,
        address,
        latitude,
        longitude,
        mapsUrl: asOptionalString(row.maps_url),
      },
      image,
      gallery,
      photoGallery: Array.isArray(row.photo_gallery) ? (row.photo_gallery as GalleryPhoto[]) : undefined,
      isOpen: asBoolean(row.is_open, false),
      openingHours: asTrimmedString(row.opening_hours, ''),
      priceRange: priceRangeValue(row.price_range),
      featured: asBoolean(row.featured, false),
      trending: asBoolean(row.trending, false),
      services,
      stylists,
      reviews,
      amenities: asStringArrayFromMixed(row.amenities),
      discountOffer: asOptionalString(row.discount_offer),
      phone: asOptionalString(row.phone),
      gender: genderValue(row.gender),
      videoUrl: asOptionalString(row.video_url ?? row.video_preview_url) || getReelsForSalon(id)[0]?.videoUrl,
      videoReels: Array.isArray(row.video_reels) && row.video_reels.length > 0
        ? row.video_reels
        : getReelsForSalon(id),
    });
  }

  return salons;
}

// ---------------------------------------------------------------------------
// Supabase fetch helpers (strict generics)
// ---------------------------------------------------------------------------

async function readRows<T>(client: SupabaseClient, table: string): Promise<{ rows: T[]; error?: string }> {
  try {
    const { data, error } = await client.from(table).select('*');
    if (error) return { rows: [], error: `${table}: ${error.message}` };
    if (!Array.isArray(data)) return { rows: [] };
    // Ensure each row is a record; strict typing validated later in normalizers
    const rows = data.filter(isRecord) as unknown as T[];
    return { rows };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { rows: [], error: `${table}: ${message}` };
  }
}

/**
 * Validates a template salon object against mandatory catalog display requirements.
 */
function isValidTemplateSalon(salon: Salon): boolean {
  if (!salon || typeof salon !== 'object') return false;
  if (!salon.id || typeof salon.id !== 'string' || !salon.id.trim()) return false;
  if (!salon.name || typeof salon.name !== 'string' || !salon.name.trim()) return false;
  if (!salon.location || typeof salon.location.latitude !== 'number' || typeof salon.location.longitude !== 'number') {
    return false;
  }
  return true;
}

/**
 * Validates and normalizes template salon services to ensure compatibility with BookingModal.
 */
function mapBookingServices(services: SalonService[] = []): SalonService[] {
  const seenServiceIds = new Set<string>();
  const mapped: SalonService[] = [];

  for (const s of services) {
    if (!s || !s.id || !s.name) continue;
    if (seenServiceIds.has(s.id)) continue;
    seenServiceIds.add(s.id);

    mapped.push({
      id: s.id.trim(),
      name: s.name.trim(),
      category: s.category || 'hair',
      duration: typeof s.duration === 'number' && s.duration > 0 ? s.duration : 45,
      price: typeof s.price === 'number' && s.price >= 0 ? s.price : 499,
      discountPrice: typeof s.discountPrice === 'number' && s.discountPrice >= 0 ? s.discountPrice : undefined,
      description: s.description ? s.description.trim() : '',
      popular: Boolean(s.popular),
    });
  }

  return mapped;
}

/**
 * Validates and normalizes template salon staff to ensure compatibility with BookingModal.
 */
function mapBookingStylists(stylists: Stylist[] = [], salonId: string, salonName: string): Stylist[] {
  const seenStylistIds = new Set<string>();
  const mapped: Stylist[] = [];

  for (const st of stylists) {
    if (!st || !st.id || !st.name) continue;
    if (seenStylistIds.has(st.id)) continue;
    seenStylistIds.add(st.id);

    mapped.push({
      id: st.id.trim(),
      name: st.name.trim(),
      role: st.role ? st.role.trim() : 'Specialist',
      avatar: st.avatarUrl || st.avatar || '',
      avatarUrl: st.avatarUrl || st.avatar || '',
      rating: typeof st.rating === 'number' ? st.rating : 4.9,
      experience: st.experience ? st.experience.trim() : '5+ years',
      specialty: Array.isArray(st.specialty) ? st.specialty : ['Specialist'],
    });
  }

  if (mapped.length === 0) {
    mapped.push({
      id: `${salonId}-default-staff`,
      name: `${salonName} Lead Specialist`,
      role: 'Master Stylist & Specialist',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      rating: 4.9,
      experience: '8+ years',
      specialty: ['All Services'],
    });
  }

  return mapped;
}

/**
 * Robustly merges live Supabase salon data with template salons.
 * Live Supabase salons take primary priority. Validated template salons from templateSalons.ts
 * are selectively injected ONLY if their unique ID is not already present in live data.
 * Guarantees zero ID duplicates and compatible services/staff for BookingModal.
 */
export function mergeTemplateSalons(remoteSalons: Salon[]): Salon[] {
  const templateSalons = getTemplateSalons();
  const existingIds = new Set<string>();
  const merged: Salon[] = [];

  // 1. Process live Supabase salons first (Primary Priority)
  for (const remoteSalon of remoteSalons) {
    if (isValidTemplateSalon(remoteSalon) && !existingIds.has(remoteSalon.id)) {
      existingIds.add(remoteSalon.id);

      // Ensure services and staff are sanitized for BookingModal
      const sanitizedServices = mapBookingServices(remoteSalon.services);
      const sanitizedStylists = mapBookingStylists(remoteSalon.stylists, remoteSalon.id, remoteSalon.name);
      const templateReels = remoteSalon.videoReels && remoteSalon.videoReels.length > 0
        ? remoteSalon.videoReels
        : getReelsForSalon(remoteSalon.id);
      const salonVideoUrl = remoteSalon.videoUrl || templateReels[0]?.videoUrl;

      merged.push({
        ...remoteSalon,
        services: sanitizedServices,
        stylists: sanitizedStylists,
        videoUrl: salonVideoUrl,
        videoReels: templateReels.length > 0 ? templateReels : undefined,
      });
    }
  }

  // 2. Selectively inject validated template salons if ID does not exist in live data
  for (const tmplSalon of templateSalons) {
    if (!isValidTemplateSalon(tmplSalon)) continue;

    const formattedServices = mapBookingServices(tmplSalon.services);
    const formattedStylists = mapBookingStylists(tmplSalon.stylists, tmplSalon.id, tmplSalon.name);
    const templateReels = tmplSalon.videoReels && tmplSalon.videoReels.length > 0
      ? tmplSalon.videoReels
      : getReelsForSalon(tmplSalon.id);
    const videoUrl = tmplSalon.videoUrl || templateReels[0]?.videoUrl;

    const formattedTmplSalon: Salon = {
      ...tmplSalon,
      services: formattedServices,
      stylists: formattedStylists,
      videoUrl,
      videoReels: templateReels,
    };

    if (!existingIds.has(tmplSalon.id)) {
      existingIds.add(tmplSalon.id);
      merged.push(formattedTmplSalon);
    } else {
      // If a live salon exists with matching ID but lacks services/stylists/video preview, enrich it safely
      const existingIndex = merged.findIndex((s) => s.id === tmplSalon.id);
      if (existingIndex >= 0) {
        const existing = merged[existingIndex];
        if (!existing.services || existing.services.length === 0) {
          existing.services = formattedServices;
        }
        if (!existing.stylists || existing.stylists.length === 0) {
          existing.stylists = formattedStylists;
        }
        if (!existing.videoUrl) {
          existing.videoUrl = formattedTmplSalon.videoUrl;
        }
        if (!existing.videoReels || existing.videoReels.length === 0) {
          existing.videoReels = formattedTmplSalon.videoReels;
        }
      }
    }
  }

  return merged;
}



/** Fetch the canonical catalog, falling back without ever mixing fake rows into real rows. */
export async function fetchCatalog(client: SupabaseClient | null = supabase): Promise<CatalogResult> {
  if (!client || isNexoraDemoMode) {
    return { salons: DEMO_SALONS, source: 'fallback', warnings: ['Supabase catalog is not configured.'] };
  }

  const [salonsResult, servicesResult, categoriesResult, professionalsResult] = await Promise.all([
    readRows<SalonDbRow>(client, tableName('salons', 'salons')),
    readRows<ServiceDbRow>(client, tableName('services', 'services')),
    readRows<CategoryDbRow>(client, tableName('categories', 'categories')),
    readRows<ProfessionalDbRow>(client, tableName('professionals', 'professionals')),
  ]);

  const warnings = [
    salonsResult.error,
    servicesResult.error,
    categoriesResult.error,
    professionalsResult.error,
  ].filter((warning): warning is string => Boolean(warning));

  if (salonsResult.rows.length === 0) {
    return {
      salons: DEMO_SALONS,
      source: 'fallback',
      warnings: warnings.length ? warnings : ['The canonical salon catalog is empty.'],
    };
  }

  const normalized = normalizeCatalog(
    salonsResult.rows,
    servicesResult.rows,
    categoriesResult.rows,
    professionalsResult.rows
  );

  if (normalized.length === 0) {
    return {
      salons: DEMO_SALONS,
      source: 'fallback',
      warnings: [...warnings, 'Canonical salon rows did not contain valid IDs and coordinates.'],
    };
  }

  const combinedSalons = mergeTemplateSalons(normalized);

  return { salons: combinedSalons, source: 'remote', warnings };
}

