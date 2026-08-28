import type { SupabaseClient } from '@supabase/supabase-js';
import type { GalleryPhoto, Review, Salon, SalonService, Stylist } from '../types';
import { isNexoraDemoMode, supabase } from './supabase';
import { DEMO_SALONS } from '../data/demoCatalog';

export type CatalogSource = 'remote' | 'fallback';

export interface CatalogResult {
  salons: Salon[];
  source: CatalogSource;
  /** Non-fatal child-table errors are retained for diagnostics. */
  warnings: string[];
}

interface RawRow extends Record<string, unknown> {}

const TABLES = {
  salons: 'VITE_NEXORA_SALONS_TABLE',
  services: 'VITE_NEXORA_SERVICES_TABLE',
  categories: 'VITE_NEXORA_CATEGORIES_TABLE',
  professionals: 'VITE_NEXORA_PROFESSIONALS_TABLE',
} as const;

function env(name: string): string | undefined {
  // Literal `import.meta.env` access so Vite inlines the VITE_* values at
  // build time (see src/lib/supabase.ts readEnv for details).
  const viteEnv = import.meta.env as unknown as
    | Record<string, string | undefined>
    | undefined;
  const viteValue = viteEnv?.[name];
  if (viteValue) return viteValue;
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name];
}

function tableName(key: keyof typeof TABLES, fallback: string): string {
  const value = env(TABLES[key])?.trim();
  return value && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value) ? value : fallback;
}

function stringValue(row: RawRow, keys: string[], fallback = ''): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return fallback;
}

function numberValue(row: RawRow, keys: string[]): number | null {
  for (const key of keys) {
    const value = row[key];
    const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function booleanValue(row: RawRow, keys: string[], fallback = false): boolean {
  for (const key of keys) {
    if (typeof row[key] === 'boolean') return row[key] as boolean;
  }
  return fallback;
}

function stringArray(value: unknown): string[] {
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : isRow(item) ? stringValue(item, ['name', 'label', 'title', 'slug']) : ''))
    .filter(Boolean);
}

function isRow(value: unknown): value is RawRow {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function categoryValue(value: unknown): SalonService['category'] {
  const category = (typeof value === 'string'
    ? value
    : isRow(value)
    ? stringValue(value, ['slug', 'name', 'label'])
    : '').toLowerCase().trim();
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

function normalizeReview(row: RawRow): Review | null {
  const id = stringValue(row, ['id', 'review_id']);
  const comment = stringValue(row, ['comment', 'content', 'body']);
  const rating = numberValue(row, ['rating', 'stars']);
  if (!id || !comment || rating === null || rating < 1 || rating > 5) return null;
  return {
    id,
    userName: stringValue(row, ['user_name', 'userName', 'author_name'], 'Verified customer'),
    userAvatar: stringValue(row, ['user_avatar', 'userAvatar', 'author_avatar']),
    rating,
    date: stringValue(row, ['created_at', 'date'], ''),
    comment,
    serviceUsed: stringValue(row, ['service_used', 'serviceUsed']) || undefined,
  };
}

function normalizeService(row: RawRow): SalonService | null {
  const id = stringValue(row, ['id', 'service_id']);
  const name = stringValue(row, ['name', 'service_name', 'title']);
  const duration = numberValue(row, ['duration', 'duration_minutes', 'durationMinutes']);
  const price = numberValue(row, ['price', 'amount']);
  if (!id || !name || duration === null || duration <= 0 || price === null || price < 0) return null;
  const discountPrice = numberValue(row, ['discount_price', 'discountPrice', 'sale_price']);
  return {
    id,
    name,
    category: categoryValue(row.category ?? row.category_slug ?? row.category_name),
    duration,
    price,
    discountPrice: discountPrice !== null && discountPrice >= 0 ? discountPrice : undefined,
    description: stringValue(row, ['description', 'details']),
    popular: booleanValue(row, ['popular', 'is_popular']),
  };
}

function normalizeStylist(row: RawRow): Stylist | null {
  const id = stringValue(row, ['id', 'professional_id', 'stylist_id']);
  const name = stringValue(row, ['name', 'professional_name', 'stylist_name']);
  if (!id || !name) return null;
  return {
    id,
    name,
    role: stringValue(row, ['role', 'title', 'specialty_title']),
    avatar: stringValue(row, ['avatar', 'avatar_url', 'image_url']),
    rating: numberValue(row, ['rating', 'average_rating']) ?? 0,
    experience: stringValue(row, ['experience', 'experience_label']),
    specialty: stringArray(row.specialty ?? row.specialties),
  };
}

function rowsForSalon(rows: RawRow[], salonId: string): RawRow[] {
  return rows.filter((row) => stringValue(row, ['salon_id', 'salonId', 'business_id']) === salonId);
}

/**
 * Convert the canonical table response into the customer app's view model.
 * Only fields from Supabase are used; missing coordinates make a salon
 * invalid rather than causing a guessed pin to be rendered.
 */
export function normalizeCatalog(
  salonRows: RawRow[],
  serviceRows: RawRow[],
  categoryRows: RawRow[],
  professionalRows: RawRow[]
): Salon[] {
  const salons: Salon[] = [];

  for (const row of salonRows) {
    const id = stringValue(row, ['id', 'salon_id', 'business_id']);
    const name = stringValue(row, ['name', 'salon_name', 'business_name']);
    const locationRow: RawRow = isRow(row.location) ? { ...row, ...row.location } : row;
    const latitude = numberValue(locationRow, ['latitude', 'lat', 'location_latitude']);
    const longitude = numberValue(locationRow, ['longitude', 'lng', 'lon', 'location_longitude']);
    if (!id || !name || latitude === null || longitude === null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      continue;
    }

    const embeddedServices = Array.isArray(row.services) ? row.services.filter(isRow) : [];
    const embeddedProfessionals = Array.isArray(row.professionals)
      ? row.professionals.filter(isRow)
      : Array.isArray(row.stylists)
      ? row.stylists.filter(isRow)
      : [];
    const services = (embeddedServices.length ? embeddedServices : rowsForSalon(serviceRows, id))
      .map(normalizeService)
      .filter((service): service is SalonService => service !== null);
    const stylists = (embeddedProfessionals.length ? embeddedProfessionals : rowsForSalon(professionalRows, id))
      .map(normalizeStylist)
      .filter((stylist): stylist is Stylist => stylist !== null);
    const reviews = Array.isArray(row.reviews)
      ? row.reviews.filter(isRow).map(normalizeReview).filter((review): review is Review => review !== null)
      : [];

    const relatedCategories = rowsForSalon(categoryRows, id);
    const categories = [
      ...stringArray(row.categories),
      ...relatedCategories.map((category) => stringValue(category, ['name', 'label', 'slug'])).filter(Boolean),
    ].filter((category, index, values) => values.indexOf(category) === index);

    const image = stringValue(row, ['image', 'image_url', 'cover_image', 'cover_image_url']);
    const gallery = stringArray(row.gallery ?? row.gallery_urls ?? row.images);
    const address = stringValue(locationRow, ['address', 'full_address', 'location_address']);
    const area = stringValue(locationRow, ['area', 'locality', 'neighborhood']);
    const city = stringValue(locationRow, ['city', 'town']);

    salons.push({
      id,
      name,
      tagline: stringValue(row, ['tagline', 'description']),
      categories,
      rating: numberValue(row, ['rating', 'average_rating']) ?? 0,
      reviewCount: numberValue(row, ['review_count', 'reviewCount', 'reviews_count']) ?? reviews.length,
      distance: stringValue(row, ['distance', 'distance_label']) ||
        (numberValue(row, ['distance_km', 'distanceKm']) !== null
          ? `${numberValue(row, ['distance_km', 'distanceKm'])} km`
          : ''),
      location: {
        area,
        city,
        address,
        latitude,
        longitude,
        mapsUrl: stringValue(row, ['maps_url', 'mapsUrl', 'google_maps_url']) || undefined,
      },
      image,
      gallery,
      photoGallery: Array.isArray(row.photo_gallery)
        ? row.photo_gallery.filter(isRow).map((photo) => photo as unknown as GalleryPhoto)
        : undefined,
      isOpen: booleanValue(row, ['is_open', 'isOpen', 'open_now']),
      openingHours: stringValue(row, ['opening_hours', 'openingHours', 'hours']),
      priceRange: priceRangeValue(row.price_range ?? row.priceRange),
      featured: booleanValue(row, ['featured', 'is_featured']),
      trending: booleanValue(row, ['trending', 'is_trending']),
      services,
      stylists,
      reviews,
      amenities: stringArray(row.amenities),
      discountOffer: stringValue(row, ['discount_offer', 'discountOffer']) || undefined,
      phone: stringValue(row, ['phone', 'phone_number']) || undefined,
      gender: ['women', 'men', 'unisex'].includes(String(row.gender))
        ? (String(row.gender) as Salon['gender'])
        : 'unisex',
    });
  }

  return salons;
}

async function readRows(client: SupabaseClient, table: string): Promise<{ rows: RawRow[]; error?: string }> {
  try {
    const { data, error } = await client.from(table).select('*');
    if (error) return { rows: [], error: `${table}: ${error.message}` };
    return {
      rows: Array.isArray(data) ? data.filter(isRow) : [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { rows: [], error: `${table}: ${message}` };
  }
}

/** Fetch the canonical catalog, falling back without ever mixing fake rows into real rows. */
export async function fetchCatalog(client: SupabaseClient | null = supabase): Promise<CatalogResult> {
  // An injected client is also used by integration tests and server-side
  // adapters; runtime callers still receive null when public config is absent.
  if (!client || isNexoraDemoMode) {
    return { salons: DEMO_SALONS, source: 'fallback', warnings: ['Supabase catalog is not configured.'] };
  }

  const [salonsResult, servicesResult, categoriesResult, professionalsResult] = await Promise.all([
    readRows(client, tableName('salons', 'salons')),
    readRows(client, tableName('services', 'services')),
    readRows(client, tableName('categories', 'categories')),
    readRows(client, tableName('professionals', 'professionals')),
  ]);

  const warnings = [
    salonsResult.error,
    servicesResult.error,
    categoriesResult.error,
    professionalsResult.error,
  ].filter((warning): warning is string => Boolean(warning));

  // Salons are the catalog root. An empty/error root falls back as a unit;
  // child-table failures do not cause mock services to be mixed into real
  // salons, so newly onboarded records remain authoritative section by section.
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

  return { salons: normalized, source: 'remote', warnings };
}
