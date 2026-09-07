/**
 * Advanced salon search — natural-language parse, filters, sort, and
 * recent-search persistence for the customer Search page.
 */
import type { Salon, SalonService } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SearchCategoryId =
  | 'salon'
  | 'barber'
  | 'beauty'
  | 'spa'
  | 'massage'
  | 'tattoo'
  | 'nail'
  | 'all';

export type SearchGenderFilter = 'all' | 'men' | 'women' | 'unisex';

export type SearchSortId =
  | 'nearest'
  | 'top_rated'
  | 'lowest_price'
  | 'most_popular'
  | 'available_today';

export type DistanceKmOption = 1 | 3 | 5 | 10 | null;

export interface SearchFilters {
  category: SearchCategoryId;
  /** Free-text service type (e.g. "Haircut", "Facial"). */
  serviceType: string;
  /** Inclusive max service price in INR; null = no cap. */
  maxPrice: number | null;
  /** Inclusive min service price in INR; null = no floor. */
  minPrice: number | null;
  /** Max distance in km; null = any. */
  maxDistanceKm: DistanceKmOption;
  /** Minimum star rating; 0 = any. */
  minRating: number;
  openNow: boolean;
  gender: SearchGenderFilter;
  homeService: boolean;
  verifiedOnly: boolean;
  offersOnly: boolean;
  /** Area name from NL or chip (e.g. "Mansarovar"). */
  area: string;
}

export type SearchSort = SearchSortId;

export interface ParsedSearchQuery {
  /** Cleaned free-text tokens used for name/tag matching (after NL extraction). */
  text: string;
  /** Original raw input. */
  raw: string;
  /** Filters inferred from the natural-language query. */
  inferred: Partial<SearchFilters>;
  /** Sort inferred from phrases like "best", "cheapest", "near me". */
  inferredSort: SearchSort | null;
  /** Human-readable chips explaining what the NL parser understood. */
  understanding: string[];
}

export interface SearchResult {
  salon: Salon;
  /** Best matching service when a service/price constraint applied. */
  matchedService: SalonService | null;
  /** Starting price used for display / sort. */
  fromPrice: number;
  score: number;
}

export const DEFAULT_SEARCH_FILTERS: SearchFilters = {
  category: 'all',
  serviceType: '',
  maxPrice: null,
  minPrice: null,
  maxDistanceKm: null,
  minRating: 0,
  openNow: false,
  gender: 'all',
  homeService: false,
  verifiedOnly: false,
  offersOnly: false,
  area: '',
};

export const SEARCH_CATEGORIES: Array<{
  id: SearchCategoryId;
  label: string;
  icon: string;
  match: string[];
}> = [
  { id: 'all', label: 'All', icon: 'apps', match: [] },
  { id: 'salon', label: 'Salon', icon: 'content_cut', match: ['salon', 'hair', 'unisex', 'styling'] },
  { id: 'barber', label: 'Barber', icon: 'face_6', match: ['barber', 'beard', 'men', 'fade', 'grooming'] },
  {
    id: 'beauty',
    label: 'Beauty Parlour',
    icon: 'spa',
    match: ['beauty', 'parlour', 'parlor', 'bridal', 'women', 'makeup'],
  },
  { id: 'spa', label: 'Spa', icon: 'hot_tub', match: ['spa', 'aromatherapy', 'wellness'] },
  { id: 'massage', label: 'Massage', icon: 'self_improvement', match: ['massage', 'body', 'relax'] },
  { id: 'tattoo', label: 'Tattoo', icon: 'brush', match: ['tattoo', 'ink', 'piercing'] },
  { id: 'nail', label: 'Nail Art', icon: 'back_hand', match: ['nail', 'manicure', 'pedicure', 'gel'] },
];

export const SERVICE_TYPE_OPTIONS = [
  'Haircut',
  'Beard',
  'Facial',
  'Hair Color',
  'Hair Spa',
  'Massage',
  'Bridal Makeup',
  'Manicure',
  'Pedicure',
  'Keratin',
  'Tattoo',
  'Hydra Facial',
] as const;

export const DISTANCE_OPTIONS: Array<{ value: DistanceKmOption; label: string }> = [
  { value: null, label: 'Any' },
  { value: 1, label: '1 km' },
  { value: 3, label: '3 km' },
  { value: 5, label: '5 km' },
  { value: 10, label: '10 km' },
];

export const RATING_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: 'Any' },
  { value: 3.5, label: '3.5+' },
  { value: 4.0, label: '4.0+' },
  { value: 4.5, label: '4.5+' },
  { value: 4.8, label: '4.8+' },
];

export const PRICE_PRESETS: Array<{ min: number | null; max: number | null; label: string }> = [
  { min: null, max: null, label: 'Any' },
  { min: null, max: 299, label: 'Under ₹300' },
  { min: null, max: 499, label: 'Under ₹500' },
  { min: null, max: 999, label: 'Under ₹1,000' },
  { min: 1000, max: null, label: '₹1,000+' },
];

export const SORT_OPTIONS: Array<{ id: SearchSort; label: string; icon: string }> = [
  { id: 'nearest', label: 'Nearest', icon: 'near_me' },
  { id: 'top_rated', label: 'Top rated', icon: 'star' },
  { id: 'lowest_price', label: 'Lowest price', icon: 'payments' },
  { id: 'most_popular', label: 'Most popular', icon: 'local_fire_department' },
  { id: 'available_today', label: 'Available today', icon: 'event_available' },
];

/** Example natural-language queries shown on the empty search state. */
export const TRENDING_SEARCHES = [
  'haircut under ₹300',
  'best salon near Mansarovar',
  'female beauty parlour near me',
  'tattoo studio in Jaipur',
  'spa open now',
  'beard trim Vaishali Nagar',
  'bridal makeup under 2000',
  'nail art near me',
] as const;

export const RECENT_SEARCHES_KEY = 'nexora-recent-searches';
export const MAX_RECENT_SEARCHES = 8;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function distanceKm(salon: Salon): number {
  const parsed = parseFloat((salon.distance || '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : 999;
}

export function servicePrice(s: SalonService): number {
  return s.discountPrice && s.discountPrice > 0 ? s.discountPrice : s.price;
}

export function minSalonPrice(salon: Salon): number {
  if (!salon.services || salon.services.length === 0) return 399;
  return Math.min(...salon.services.map(servicePrice));
}

export function isVerifiedSalon(salon: Salon): boolean {
  return (
    salon.featured === true ||
    salon.rating >= 4.5 ||
    (salon.reviewCount || 0) >= 100 ||
    (salon.amenities || []).some((a) => /verif/i.test(a))
  );
}

export function hasOffers(salon: Salon): boolean {
  if (salon.discountOffer && salon.discountOffer.trim()) return true;
  return (salon.services || []).some(
    (s) => typeof s.discountPrice === 'number' && s.discountPrice > 0 && s.discountPrice < s.price
  );
}

export function hasHomeService(salon: Salon): boolean {
  const blob = [
    ...(salon.amenities || []),
    ...(salon.tags || []),
    ...(salon.keywords || []),
    salon.tagline || '',
  ]
    .join(' ')
    .toLowerCase();
  return /home\s*service|at[\s-]?home|doorstep|home\s*visit|in[\s-]?home/.test(blob);
}

function salonBlob(salon: Salon): string {
  return [
    salon.name,
    salon.tagline,
    salon.location.area,
    salon.location.city,
    salon.location.address,
    salon.gender,
    ...(salon.categories || []),
    ...(salon.tags || []),
    ...(salon.keywords || []),
    ...(salon.amenities || []),
    ...(salon.services || []).map((s) => s.name),
    salon.discountOffer || '',
  ]
    .join(' ')
    .toLowerCase();
}

function categoryMatch(salon: Salon, catId: SearchCategoryId): boolean {
  if (catId === 'all') return true;
  const def = SEARCH_CATEGORIES.find((c) => c.id === catId);
  if (!def || def.match.length === 0) return true;
  const blob = salonBlob(salon);
  return def.match.some((token) => blob.includes(token.toLowerCase()));
}

/** Normalize for fuzzy service matching: "hair cut" ≈ "haircut". */
function normToken(s: string): string {
  return s
    .toLowerCase()
    .replace(/[₹$€,]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactToken(s: string): string {
  return normToken(s).replace(/\s+/g, '');
}

function textMatchesService(haystack: string, needle: string): boolean {
  const h = normToken(haystack);
  const n = normToken(needle);
  if (!n) return true;
  if (h.includes(n)) return true;
  const hc = compactToken(haystack);
  const nc = compactToken(needle);
  if (nc.length >= 3 && hc.includes(nc)) return true;
  // Token AND: every needle word appears in haystack
  const words = n.split(' ').filter((w) => w.length >= 2);
  if (words.length > 1 && words.every((w) => h.includes(w) || hc.includes(w))) return true;
  return false;
}

/** All services on a salon that match a service-type phrase, cheapest first. */
function matchingServices(salon: Salon, serviceType: string): SalonService[] {
  const q = serviceType.trim();
  if (!q) return [];
  const hits = (salon.services || []).filter(
    (s) =>
      textMatchesService(s.name, q) ||
      textMatchesService(s.category, q) ||
      textMatchesService(s.description || '', q)
  );
  return hits.sort((a, b) => servicePrice(a) - servicePrice(b));
}

function serviceTypeMatch(salon: Salon, serviceType: string): SalonService | null {
  const hits = matchingServices(salon, serviceType);
  if (hits.length > 0) return hits[0];
  // Soft match on categories/tags so "haircut" still finds hair salons
  const q = serviceType.trim();
  const blob = salonBlob(salon);
  if (textMatchesService(blob, q) || compactToken(blob).includes(compactToken(q))) {
    return (salon.services || []).slice().sort((a, b) => servicePrice(a) - servicePrice(b))[0] || null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Natural-language parser
// ---------------------------------------------------------------------------

const JAIPUR_AREAS = [
  'Mansarovar',
  'C-Scheme',
  'Vaishali Nagar',
  'Malviya Nagar',
  'Raja Park',
  'Tonk Road',
  'Bani Park',
  'Vidhyadhar Nagar',
  'Jagatpura',
  'Ajmer Road',
  'Pink City',
  'Civil Lines',
  'Jhotwara',
  'Sanganer',
  'Pratap Nagar',
];

const CATEGORY_PHRASES: Array<{ id: SearchCategoryId; patterns: RegExp[]; label: string }> = [
  {
    id: 'barber',
    label: 'Barber',
    patterns: [/\bbarbers?(?:\s+shop)?\b/i, /\bgents?\s+(?:salon|parlour|parlor)\b/i, /\bmens?\s+salon\b/i],
  },
  {
    id: 'beauty',
    label: 'Beauty Parlour',
    patterns: [
      /\bbeauty\s+parlou?rs?\b/i,
      /\bbeauty\s+salon\b/i,
      /\bwomen'?s?\s+(?:salon|parlour|parlor)\b/i,
      /\bfemale\s+(?:beauty|salon|parlour|parlor)\b/i,
      /\bladies\s+(?:salon|parlour|parlor)\b/i,
    ],
  },
  {
    id: 'tattoo',
    label: 'Tattoo',
    patterns: [/\btattoo(?:\s+studio|\s+shop|\s+parlour|\s+parlor)?\b/i, /\bpiercing\b/i],
  },
  {
    id: 'nail',
    label: 'Nail Art',
    patterns: [/\bnail\s+art\b/i, /\bnail\s+studio\b/i, /\bmanicure\b/i, /\bpedicure\b/i],
  },
  {
    id: 'massage',
    label: 'Massage',
    patterns: [/\bmassages?\b/i, /\bbody\s+massage\b/i],
  },
  {
    id: 'spa',
    label: 'Spa',
    patterns: [/\bspas?\b/i, /\bwellness\b/i, /\baromatherapy\b/i],
  },
  {
    id: 'salon',
    label: 'Salon',
    patterns: [/\bsalou?ns?\b/i, /\bhair\s+studio\b/i, /\bhair\s+salon\b/i],
  },
];

const SERVICE_PHRASES: Array<{ name: string; patterns: RegExp[] }> = [
  { name: 'Haircut', patterns: [/\bhair\s*cuts?\b/i, /\bhaircuts?\b/i, /\bhair\s+trimming\b/i] },
  { name: 'Beard', patterns: [/\bbeards?\b/i, /\bbeard\s+trim\b/i, /\bshave\b/i] },
  { name: 'Facial', patterns: [/\bfacials?\b/i, /\bhydra\s*facial\b/i] },
  { name: 'Hair Color', patterns: [/\bhair\s+colou?r\b/i, /\bbalayage\b/i, /\bhighlights?\b/i] },
  { name: 'Hair Spa', patterns: [/\bhair\s+spa\b/i, /\bkeratin\b/i] },
  { name: 'Massage', patterns: [/\bmassages?\b/i] },
  { name: 'Bridal Makeup', patterns: [/\bbridal\s+makeup\b/i, /\bbridal\b/i] },
  { name: 'Manicure', patterns: [/\bmanicures?\b/i] },
  { name: 'Pedicure', patterns: [/\bpedicures?\b/i] },
  { name: 'Tattoo', patterns: [/\btattoos?\b/i] },
  { name: 'Nail Art', patterns: [/\bnail\s+art\b/i, /\bgel\s+nails?\b/i] },
];

/**
 * Parse a free-text / natural-language query into structured filters + residual text.
 * Examples handled:
 *  - "haircut under ₹300"
 *  - "best salon near Mansarovar"
 *  - "female beauty parlour near me"
 *  - "tattoo studio in Jaipur"
 *  - "spa open now"
 */
export function parseSearchQuery(rawInput: string): ParsedSearchQuery {
  const raw = (rawInput || '').trim();
  let working = raw;
  const inferred: Partial<SearchFilters> = {};
  const understanding: string[] = [];
  let inferredSort: SearchSort | null = null;

  if (!raw) {
    return { text: '', raw: '', inferred, inferredSort: null, understanding: [] };
  }

  // Price: under/below/less than / max / up to ₹N
  const underRe =
    /\b(?:under|below|less\s+than|upto|up\s+to|max(?:imum)?|within)\s*₹?\s*(\d{2,5})\b/i;
  const underMatch = working.match(underRe);
  if (underMatch) {
    const n = parseInt(underMatch[1], 10);
    if (Number.isFinite(n)) {
      inferred.maxPrice = n;
      understanding.push(`Under ₹${n}`);
      working = working.replace(underMatch[0], ' ');
    }
  }
  // "from ₹X" / "above ₹X"
  const fromRe = /\b(?:from|above|over|starting\s+(?:at|from)|min(?:imum)?)\s*₹?\s*(\d{2,5})\b/i;
  const fromMatch = working.match(fromRe);
  if (fromMatch) {
    const n = parseInt(fromMatch[1], 10);
    if (Number.isFinite(n)) {
      inferred.minPrice = n;
      understanding.push(`From ₹${n}`);
      working = working.replace(fromMatch[0], ' ');
    }
  }
  // Bare "₹300" after removal still possible — treat as max if alone with service
  const barePrice = working.match(/₹\s*(\d{2,5})/);
  if (barePrice && inferred.maxPrice == null) {
    const n = parseInt(barePrice[1], 10);
    if (Number.isFinite(n)) {
      inferred.maxPrice = n;
      understanding.push(`Under ₹${n}`);
      working = working.replace(barePrice[0], ' ');
    }
  }

  // Open now
  if (/\bopen\s+now\b/i.test(working) || /\bcurrently\s+open\b/i.test(working)) {
    inferred.openNow = true;
    understanding.push('Open now');
    working = working.replace(/\b(?:open\s+now|currently\s+open)\b/gi, ' ');
  }

  // Verified
  if (/\bverified\b/i.test(working)) {
    inferred.verifiedOnly = true;
    understanding.push('Verified only');
    working = working.replace(/\bverified\b/gi, ' ');
  }

  // Offers / deals
  if (/\b(?:offers?|deals?|discounts?)\b/i.test(working)) {
    inferred.offersOnly = true;
    understanding.push('Offers available');
    working = working.replace(/\b(?:offers?|deals?|discounts?)\b/gi, ' ');
  }

  // Home service
  if (/\b(?:home\s*service|at[\s-]?home|doorstep|home\s*visit)\b/i.test(working)) {
    inferred.homeService = true;
    understanding.push('Home service');
    working = working.replace(/\b(?:home\s*service|at[\s-]?home|doorstep|home\s*visit)\b/gi, ' ');
  }

  // Gender
  if (
    /\b(?:female|women'?s?|ladies|for\s+her|girl)\b/i.test(working) ||
    /\bwomen\b/i.test(working)
  ) {
    inferred.gender = 'women';
    understanding.push('Women');
    working = working.replace(
      /\b(?:female|women'?s?|ladies|for\s+her|girls?|women)\b/gi,
      ' '
    );
  } else if (/\b(?:male|men'?s?|gents?|for\s+him|boys?)\b/i.test(working)) {
    inferred.gender = 'men';
    understanding.push('Men');
    working = working.replace(/\b(?:male|men'?s?|gents?|for\s+him|boys?|men)\b/gi, ' ');
  } else if (/\bunisex\b/i.test(working)) {
    inferred.gender = 'unisex';
    understanding.push('Unisex');
    working = working.replace(/\bunisex\b/gi, ' ');
  }

  // Rating: "4.5+", "rating above 4"
  const ratingRe = /\b(?:rating\s+)?(?:above|over|at\s+least)?\s*(\d(?:\.\d)?)\s*\+?\s*(?:stars?)?\b/i;
  // Only if accompanied by rating/star keywords to avoid eating prices
  if (/\b(?:rating|stars?)\b/i.test(working) || /\d\.\d\s*\+/.test(working)) {
    const rm = working.match(ratingRe);
    if (rm) {
      const r = parseFloat(rm[1]);
      if (r >= 1 && r <= 5) {
        inferred.minRating = r;
        understanding.push(`${r}+ rating`);
        working = working.replace(rm[0], ' ');
      }
    }
  }

  // Distance: "within 3 km", "5km"
  const distRe = /\b(?:within|under|inside)?\s*(\d{1,2})\s*k(?:m|ilometers?|ilometres?)\b/i;
  const dm = working.match(distRe);
  if (dm) {
    const d = parseInt(dm[1], 10);
    const snapped: DistanceKmOption =
      d <= 1 ? 1 : d <= 3 ? 3 : d <= 5 ? 5 : d <= 10 ? 10 : 10;
    inferred.maxDistanceKm = snapped;
    understanding.push(`Within ${snapped} km`);
    working = working.replace(dm[0], ' ');
  }

  // Near me → nearest sort, no specific area
  if (/\bnear\s+me\b/i.test(working) || /\bnearby\b/i.test(working) || /\bclose\s+by\b/i.test(working)) {
    if (!inferredSort) inferredSort = 'nearest';
    understanding.push('Near me');
    working = working.replace(/\b(?:near\s+me|nearby|close\s+by)\b/gi, ' ');
  }

  // Sort cues
  if (/\b(?:best|top\s*rated|highest\s*rated|finest)\b/i.test(working)) {
    inferredSort = 'top_rated';
    understanding.push('Top rated');
    working = working.replace(/\b(?:best|top\s*rated|highest\s*rated|finest)\b/gi, ' ');
  } else if (/\b(?:cheapest|lowest\s*price|budget|affordable|inexpensive)\b/i.test(working)) {
    inferredSort = 'lowest_price';
    understanding.push('Lowest price');
    working = working.replace(
      /\b(?:cheapest|lowest\s*price|budget|affordable|inexpensive)\b/gi,
      ' '
    );
  } else if (/\b(?:most\s+popular|trending|popular)\b/i.test(working)) {
    inferredSort = 'most_popular';
    understanding.push('Most popular');
    working = working.replace(/\b(?:most\s+popular|trending|popular)\b/gi, ' ');
  } else if (/\b(?:available\s+today|slots?\s+today|book\s+today)\b/i.test(working)) {
    inferredSort = 'available_today';
    understanding.push('Available today');
    working = working.replace(/\b(?:available\s+today|slots?\s+today|book\s+today)\b/gi, ' ');
  }

  // Area names (longest first)
  const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const areasSorted = [...JAIPUR_AREAS].sort((a, b) => b.length - a.length);
  for (const area of areasSorted) {
    const re = new RegExp(`\\b${escapeRe(area)}\\b`, 'i');
    if (re.test(working)) {
      inferred.area = area;
      understanding.push(area);
      working = working.replace(re, ' ');
      break;
    }
  }
  // "in Jaipur" / "near Jaipur" — city-wide, strip filler only
  if (/\b(?:in|near|around|at)\s+jaipur\b/i.test(working)) {
    understanding.push('Jaipur');
    working = working.replace(/\b(?:in|near|around|at)\s+jaipur\b/gi, ' ');
  }

  // "near X" leftover — try capture
  const nearArea = working.match(/\bnear\s+([a-z][a-z\s-]{2,30})/i);
  if (nearArea && !inferred.area) {
    const candidate = nearArea[1].trim().replace(/\s+/g, ' ');
    const known = areasSorted.find((a) => a.toLowerCase() === candidate.toLowerCase());
    if (known) {
      inferred.area = known;
      understanding.push(known);
      working = working.replace(nearArea[0], ' ');
    }
  }

  // Category phrases
  for (const cat of CATEGORY_PHRASES) {
    for (const p of cat.patterns) {
      if (p.test(working)) {
        inferred.category = cat.id;
        understanding.push(cat.label);
        working = working.replace(p, ' ');
        break;
      }
    }
    if (inferred.category) break;
  }

  // Service phrases
  for (const svc of SERVICE_PHRASES) {
    for (const p of svc.patterns) {
      if (p.test(working)) {
        inferred.serviceType = svc.name;
        understanding.push(svc.name);
        working = working.replace(p, ' ');
        break;
      }
    }
    if (inferred.serviceType) break;
  }

  // Strip filler words
  working = working
    .replace(
      /\b(?:a|an|the|for|with|and|or|in|at|to|of|my|me|please|find|show|get|looking|want|need|some|studio|shop|place|parlour|parlor)\b/gi,
      ' '
    )
    .replace(/[^\p{L}\p{N}\s+-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    text: working,
    raw,
    inferred,
    inferredSort,
    understanding: uniqueStrings(understanding),
  };
}

function uniqueStrings(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    const k = s.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(s);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Merge + apply
// ---------------------------------------------------------------------------

/** Merge UI filters with NL-inferred ones. Explicit UI values win when "active". */
export function mergeFilters(
  base: SearchFilters,
  inferred: Partial<SearchFilters>,
  opts: { preferInferred?: boolean } = {}
): SearchFilters {
  const prefer = opts.preferInferred === true;
  const pick = <K extends keyof SearchFilters>(
    key: K,
    isDefault: (v: SearchFilters[K]) => boolean
  ): SearchFilters[K] => {
    const b = base[key];
    const i = inferred[key];
    if (i === undefined) return b;
    if (prefer) return i as SearchFilters[K];
    if (isDefault(b)) return i as SearchFilters[K];
    return b;
  };

  return {
    category: pick('category', (v) => v === 'all'),
    serviceType: pick('serviceType', (v) => !v),
    maxPrice: pick('maxPrice', (v) => v == null),
    minPrice: pick('minPrice', (v) => v == null),
    maxDistanceKm: pick('maxDistanceKm', (v) => v == null),
    minRating: pick('minRating', (v) => !v || v === 0),
    openNow: base.openNow || Boolean(inferred.openNow),
    gender: pick('gender', (v) => v === 'all'),
    homeService: base.homeService || Boolean(inferred.homeService),
    verifiedOnly: base.verifiedOnly || Boolean(inferred.verifiedOnly),
    offersOnly: base.offersOnly || Boolean(inferred.offersOnly),
    area: pick('area', (v) => !v),
  };
}

export function countActiveFilters(f: SearchFilters): number {
  let n = 0;
  if (f.category !== 'all') n++;
  if (f.serviceType.trim()) n++;
  if (f.maxPrice != null) n++;
  if (f.minPrice != null) n++;
  if (f.maxDistanceKm != null) n++;
  if (f.minRating > 0) n++;
  if (f.openNow) n++;
  if (f.gender !== 'all') n++;
  if (f.homeService) n++;
  if (f.verifiedOnly) n++;
  if (f.offersOnly) n++;
  if (f.area.trim()) n++;
  return n;
}

function passesFilters(
  salon: Salon,
  filters: SearchFilters,
  textTokens: string[]
): { ok: boolean; matchedService: SalonService | null; fromPrice: number } {
  const fromPrice = minSalonPrice(salon);
  let matchedService: SalonService | null = null;

  if (!categoryMatch(salon, filters.category)) {
    return { ok: false, matchedService: null, fromPrice };
  }

  if (filters.serviceType.trim()) {
    const typed = matchingServices(salon, filters.serviceType);
    const q = filters.serviceType.trim();
    const blob = salonBlob(salon);
    const soft = textMatchesService(blob, q) || compactToken(blob).includes(compactToken(q));
    if (typed.length === 0 && !soft) {
      return { ok: false, matchedService: null, fromPrice };
    }

    // Prefer a matching service inside the price window when both are set.
    const priced = typed.filter((s) => {
      const p = servicePrice(s);
      if (filters.maxPrice != null && p > filters.maxPrice) return false;
      if (filters.minPrice != null && p < filters.minPrice) return false;
      return true;
    });
    if (typed.length > 0 && (filters.maxPrice != null || filters.minPrice != null)) {
      if (priced.length === 0) {
        return { ok: false, matchedService: typed[0], fromPrice: servicePrice(typed[0]) };
      }
      matchedService = priced[0];
    } else {
      matchedService = typed[0] || serviceTypeMatch(salon, filters.serviceType);
    }
  }

  // Price constraints — use cheapest matching service when service filter set
  let pricePoint = fromPrice;
  if (matchedService) {
    pricePoint = servicePrice(matchedService);
  } else if (filters.maxPrice != null || filters.minPrice != null) {
    // Any service in range?
    const inRange = (salon.services || []).filter((s) => {
      const p = servicePrice(s);
      if (filters.maxPrice != null && p > filters.maxPrice) return false;
      if (filters.minPrice != null && p < filters.minPrice) return false;
      return true;
    });
    if (inRange.length === 0 && (salon.services || []).length > 0) {
      return { ok: false, matchedService: null, fromPrice };
    }
    if (inRange.length > 0) {
      matchedService = inRange.sort((a, b) => servicePrice(a) - servicePrice(b))[0];
      pricePoint = servicePrice(matchedService);
    }
  }

  if (filters.maxPrice != null && pricePoint > filters.maxPrice) {
    return { ok: false, matchedService, fromPrice: pricePoint };
  }
  if (filters.minPrice != null && pricePoint < filters.minPrice) {
    return { ok: false, matchedService, fromPrice: pricePoint };
  }

  if (filters.maxDistanceKm != null && distanceKm(salon) > filters.maxDistanceKm) {
    return { ok: false, matchedService, fromPrice: pricePoint };
  }

  if (filters.minRating > 0 && salon.rating < filters.minRating) {
    return { ok: false, matchedService, fromPrice: pricePoint };
  }

  if (filters.openNow && !salon.isOpen) {
    return { ok: false, matchedService, fromPrice: pricePoint };
  }

  if (filters.gender !== 'all') {
    if (filters.gender === 'unisex') {
      if (salon.gender !== 'unisex') return { ok: false, matchedService, fromPrice: pricePoint };
    } else if (salon.gender !== filters.gender && salon.gender !== 'unisex') {
      // Men/women filters also accept unisex salons
      return { ok: false, matchedService, fromPrice: pricePoint };
    }
  }

  if (filters.homeService && !hasHomeService(salon)) {
    return { ok: false, matchedService, fromPrice: pricePoint };
  }

  if (filters.verifiedOnly && !isVerifiedSalon(salon)) {
    return { ok: false, matchedService, fromPrice: pricePoint };
  }

  if (filters.offersOnly && !hasOffers(salon)) {
    return { ok: false, matchedService, fromPrice: pricePoint };
  }

  if (filters.area.trim()) {
    const area = filters.area.trim().toLowerCase();
    const hit =
      salon.location.area.toLowerCase().includes(area) ||
      salon.location.address.toLowerCase().includes(area) ||
      (salon.keywords || []).some((k) => k.toLowerCase().includes(area));
    if (!hit) return { ok: false, matchedService, fromPrice: pricePoint };
  }

  // Residual free-text tokens — all must hit the blob (AND)
  if (textTokens.length > 0) {
    const blob = salonBlob(salon);
    for (const t of textTokens) {
      if (t.length < 2) continue;
      if (!blob.includes(t)) {
        return { ok: false, matchedService, fromPrice: pricePoint };
      }
    }
  }

  return { ok: true, matchedService, fromPrice: pricePoint };
}

function relevanceScore(
  salon: Salon,
  textTokens: string[],
  filters: SearchFilters,
  matchedService: SalonService | null
): number {
  let score = salon.rating * 10 + Math.min(30, Math.log10((salon.reviewCount || 0) + 1) * 12);
  if (salon.featured) score += 8;
  if (salon.trending) score += 6;
  if (salon.isOpen) score += 4;
  if (isVerifiedSalon(salon)) score += 5;

  const blob = salonBlob(salon);
  for (const t of textTokens) {
    if (salon.name.toLowerCase().includes(t)) score += 25;
    else if (blob.includes(t)) score += 8;
  }
  if (matchedService) score += 12;
  if (filters.serviceType && matchedService) score += 6;
  // Closer is better soft boost
  score += Math.max(0, 15 - distanceKm(salon) * 2);
  return score;
}

export function sortResults(results: SearchResult[], sort: SearchSort): SearchResult[] {
  const list = [...results];
  switch (sort) {
    case 'nearest':
      return list.sort(
        (a, b) => distanceKm(a.salon) - distanceKm(b.salon) || b.salon.rating - a.salon.rating
      );
    case 'top_rated':
      return list.sort(
        (a, b) =>
          b.salon.rating - a.salon.rating ||
          b.salon.reviewCount - a.salon.reviewCount ||
          distanceKm(a.salon) - distanceKm(b.salon)
      );
    case 'lowest_price':
      return list.sort(
        (a, b) => a.fromPrice - b.fromPrice || b.salon.rating - a.salon.rating
      );
    case 'most_popular':
      return list.sort(
        (a, b) =>
          b.salon.reviewCount - a.salon.reviewCount ||
          b.salon.rating - a.salon.rating ||
          (b.salon.trending ? 1 : 0) - (a.salon.trending ? 1 : 0)
      );
    case 'available_today':
      return list.sort((a, b) => {
        const ao = a.salon.isOpen ? 0 : 1;
        const bo = b.salon.isOpen ? 0 : 1;
        if (ao !== bo) return ao - bo;
        return distanceKm(a.salon) - distanceKm(b.salon) || b.salon.rating - a.salon.rating;
      });
    default:
      return list.sort((a, b) => b.score - a.score);
  }
}

/**
 * Run the full search pipeline: parse NL → merge filters → filter → score → sort.
 */
export function searchSalons(
  salons: Salon[],
  query: string,
  uiFilters: SearchFilters = DEFAULT_SEARCH_FILTERS,
  uiSort: SearchSort | null = null
): {
  results: SearchResult[];
  parsed: ParsedSearchQuery;
  filters: SearchFilters;
  sort: SearchSort;
} {
  const parsed = parseSearchQuery(query);
  const filters = mergeFilters(uiFilters, parsed.inferred);
  const sort: SearchSort = uiSort || parsed.inferredSort || 'nearest';

  const textTokens = parsed.text
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);

  const results: SearchResult[] = [];
  for (const salon of salons) {
    const { ok, matchedService, fromPrice } = passesFilters(salon, filters, textTokens);
    if (!ok) continue;
    results.push({
      salon,
      matchedService,
      fromPrice,
      score: relevanceScore(salon, textTokens, filters, matchedService),
    });
  }

  return {
    results: sortResults(results, sort),
    parsed,
    filters,
    sort,
  };
}

// ---------------------------------------------------------------------------
// Recent searches (localStorage)
// ---------------------------------------------------------------------------

export function loadRecentSearches(storage?: Storage | null): string[] {
  try {
    const s = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!s) return [];
    const raw = s.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      .map((x) => x.trim())
      .slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
}

export function pushRecentSearch(query: string, storage?: Storage | null): string[] {
  const q = (query || '').trim();
  if (!q) return loadRecentSearches(storage);
  try {
    const s = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!s) return [q];
    const prev = loadRecentSearches(s).filter((x) => x.toLowerCase() !== q.toLowerCase());
    const next = [q, ...prev].slice(0, MAX_RECENT_SEARCHES);
    s.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
    return next;
  } catch {
    return [q];
  }
}

export function clearRecentSearches(storage?: Storage | null): void {
  try {
    const s = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    s?.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    /* ignore */
  }
}

/** True when the user has typed something or set a non-default filter. */
export function isSearchActive(query: string, filters: SearchFilters): boolean {
  return query.trim().length > 0 || countActiveFilters(filters) > 0;
}
