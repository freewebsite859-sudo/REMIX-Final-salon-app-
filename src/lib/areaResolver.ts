/**
 * Area resolution + location fallback.
 *
 * Two things repeatedly left customers with no usable area:
 *
 * 1. The picker's free-text box accepted ANY string and handed the app a
 *    location with no coordinates. `saveCustomerLocation` rejects coordinate-
 *    less preferences, so the choice silently vanished on the next reload and
 *    distance sorting kept using the old area.
 * 2. When GPS failed (or landed more than 4 km from a chip) there was no
 *    resolution ladder at all — the user saw "Unable to detect location" and
 *    the app fell back to nothing.
 *
 * This module gives both paths a deterministic, typo-tolerant answer that
 * always carries real coordinates, and always says WHERE the answer came from
 * so the UI can be honest about precision.
 */

import {
  JAIPUR_AREA_CHIPS,
  formatAreaLabel,
  isInsideJaipur,
  nearestJaipurArea,
  type JaipurArea,
} from './jaipurAreas';
import { normalizeForMatch, rankFuzzyCandidates } from './fuzzyMatch';

/** Jaipur city centre (Hawa Mahal). Used only as the very last resort. */
export const JAIPUR_CITY_CENTRE = {
  latitude: 26.9239,
  longitude: 75.8267,
  city: 'Jaipur',
  area: 'Jaipur City Centre',
  pincode: '302002',
} as const;

/**
 * Everyday spellings and nicknames customers actually type. Fuzzy matching
 * handles single-character slips; these cover the ones no edit distance can
 * ("pinkcity" for the walled city, "vdn" for Vidhyadhar Nagar).
 */
export const AREA_ALIASES: Readonly<Record<string, readonly string[]>> = {
  Mansarovar: ['mansarover', 'mansarovar jaipur', 'mansrovar', 'msr'],
  'Vaishali Nagar': ['vaishali', 'vaishali ngr', 'vaisali nagar', 'vaishalinagar'],
  'Malviya Nagar': ['malviya', 'malviyanagar', 'malvia nagar'],
  'Raja Park': ['rajapark', 'raja pk', 'adarsh nagar'],
  'C-Scheme': ['c scheme', 'cscheme', 'civil lines', 'ashok marg', 'panch batti', 'scheme'],
  Jagatpura: ['jagat pura', 'jagatpura jaipur'],
  'Tonk Road': ['tonkroad', 'tonk phatak', 'durgapura'],
  Jhotwara: ['jhotwada', 'jotwara', 'khatipura'],
  Sanganer: ['sanganeer', 'sanganer jaipur', 'pratap nagar sanganer'],
  'Pratap Nagar': ['pratapnagar', 'partap nagar', 'sector 3 pratap nagar'],
};

function aliasesFor(chip: JaipurArea): string[] {
  return [
    chip.name,
    chip.area,
    `${chip.area} ${chip.city}`,
    chip.pincode || '',
    ...(AREA_ALIASES[chip.name] || []),
  ].filter(Boolean);
}

export type AreaMatchConfidence = 'exact' | 'close' | 'none';

export interface AreaQueryResult {
  /** Best chip for the typed text, or null when nothing is close enough. */
  match: JaipurArea | null;
  /** How sure we are — drives whether the UI auto-applies or asks. */
  confidence: AreaMatchConfidence;
  /** Ranked alternatives (always includes `match` first when present). */
  suggestions: JaipurArea[];
  /** The normalised text that was searched. */
  query: string;
  /** True when the text matched a chip PIN code rather than a name. */
  matchedPincode: boolean;
}

/**
 * Resolve typed text ("mansrovar", "302020", "c scheme") to a Jaipur chip.
 * Never guesses from an empty string, and never returns a chip for text that
 * is not plausibly one of the localities we serve.
 */
export function resolveAreaQuery(input: string, limit = 4): AreaQueryResult {
  const query = normalizeForMatch(input);
  if (!query) {
    return { match: null, confidence: 'none', suggestions: [], query, matchedPincode: false };
  }

  // PIN codes are unambiguous — check them before any fuzzy work.
  const pinMatch = /^\d{6}$/.test(query)
    ? JAIPUR_AREA_CHIPS.find((chip) => chip.pincode === query) || null
    : null;
  if (pinMatch) {
    return {
      match: pinMatch,
      confidence: 'exact',
      suggestions: [pinMatch],
      query,
      matchedPincode: true,
    };
  }

  const ranked = rankFuzzyCandidates(query, JAIPUR_AREA_CHIPS, aliasesFor, {
    minScore: 0.55,
    limit,
  });
  if (ranked.length === 0) {
    return { match: null, confidence: 'none', suggestions: [], query, matchedPincode: false };
  }

  const top = ranked[0];
  const confidence: AreaMatchConfidence = top.exact || top.distance === 0 ? 'exact' : 'close';
  return {
    match: top.item,
    confidence,
    suggestions: ranked.map((r) => r.item),
    query,
    matchedPincode: false,
  };
}

/** Chips to show while the customer is typing (prefix + typo tolerant). */
export function suggestAreas(input: string, limit = 5): JaipurArea[] {
  const query = normalizeForMatch(input);
  if (!query) return JAIPUR_AREA_CHIPS.slice(0, limit);
  return resolveAreaQuery(input, limit).suggestions;
}

// ---------------------------------------------------------------------------
// Coordinate → area
// ---------------------------------------------------------------------------

/** Widened snap radius used once the strict 4 km pass finds nothing. */
export const APPROXIMATE_SNAP_METERS = 25_000;

export interface CoordinateArea {
  area: JaipurArea;
  distanceMeters: number;
  /** True when the fix was outside the strict 4 km radius. */
  approximate: boolean;
}

/**
 * Snap a GPS fix to a Jaipur locality. Falls back to a widened radius so a fix
 * on the ring road resolves to the closest locality we serve instead of the
 * useless label "Current location".
 */
export function areaForCoordinates(
  latitude: number,
  longitude: number
): CoordinateArea | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const exact = nearestJaipurArea(latitude, longitude);
  if (exact) {
    const { distanceMeters, ...area } = exact;
    return { area, distanceMeters, approximate: false };
  }
  const wide = nearestJaipurArea(latitude, longitude, APPROXIMATE_SNAP_METERS);
  if (!wide) return null;
  const { distanceMeters, ...area } = wide;
  return { area, distanceMeters, approximate: true };
}

// ---------------------------------------------------------------------------
// The fallback ladder
// ---------------------------------------------------------------------------

export type LocationFallbackSource =
  | 'gps'
  | 'gps-approximate'
  | 'typed'
  | 'saved'
  | 'profile'
  | 'city-default';

export interface ResolvedLocation {
  latitude: number;
  longitude: number;
  city: string;
  area: string;
  pincode?: string;
  label: string;
  /** Which rung of the ladder produced this answer. */
  source: LocationFallbackSource;
  /** Preference `source` value to persist ('gps' | 'manual' | 'chip'). */
  preferenceSource: 'gps' | 'manual' | 'chip';
  /** True when coordinates are a locality centre, not the customer's position. */
  approximate: boolean;
  /** One-line, user-facing explanation of what happened. */
  note: string;
}

export interface LocationFallbackInput {
  /** A successful device fix, when there was one. */
  coords?: { latitude: number; longitude: number } | null;
  /** Free text the customer typed into the picker. */
  typedText?: string | null;
  /** A previously saved preference for this account. */
  saved?: { latitude: number; longitude: number; city: string; area: string; label?: string; pincode?: string } | null;
  /** Area/city already on the profile (e.g. from sign-up). */
  profileArea?: string | null;
  profileCity?: string | null;
}

function fromChip(
  chip: JaipurArea,
  source: LocationFallbackSource,
  preferenceSource: 'gps' | 'manual' | 'chip',
  note: string,
  approximate = true
): ResolvedLocation {
  return {
    latitude: chip.latitude,
    longitude: chip.longitude,
    city: chip.city,
    area: chip.area,
    pincode: chip.pincode,
    label: formatAreaLabel(chip),
    source,
    preferenceSource,
    approximate,
    note,
  };
}

/**
 * Resolve the best available location, in priority order:
 *
 *   1. a live GPS fix snapped to a locality (exact, then widened radius)
 *   2. text the customer typed, fuzzy-matched to a locality
 *   3. the previously saved preference for this account
 *   4. the area already on their profile
 *   5. Jaipur city centre — labelled as such, never presented as "your location"
 *
 * The result ALWAYS carries usable coordinates, which is what makes the saved
 * preference survive a reload and keeps distance sorting meaningful.
 */
export function resolveLocationWithFallback(input: LocationFallbackInput): ResolvedLocation {
  // 1. Device fix
  if (
    input.coords &&
    Number.isFinite(input.coords.latitude) &&
    Number.isFinite(input.coords.longitude)
  ) {
    const { latitude, longitude } = input.coords;
    const snapped = areaForCoordinates(latitude, longitude);
    if (snapped && !snapped.approximate) {
      return {
        latitude,
        longitude,
        city: snapped.area.city,
        area: snapped.area.area,
        pincode: snapped.area.pincode,
        label: formatAreaLabel(snapped.area),
        source: 'gps',
        preferenceSource: 'gps',
        approximate: false,
        note: `Located you in ${snapped.area.area}.`,
      };
    }
    if (snapped) {
      const km = Math.round(snapped.distanceMeters / 100) / 10;
      return {
        latitude,
        longitude,
        city: snapped.area.city,
        area: snapped.area.area,
        pincode: snapped.area.pincode,
        label: formatAreaLabel(snapped.area),
        source: 'gps-approximate',
        preferenceSource: 'gps',
        approximate: true,
        note: `You are about ${km} km from ${snapped.area.area} — using it as your nearest area.`,
      };
    }
    // A real fix well outside the city: keep the coordinates, label honestly.
    return {
      latitude,
      longitude,
      city: isInsideJaipur(latitude, longitude) ? 'Jaipur' : 'Outside Jaipur',
      area: 'Current location',
      label: isInsideJaipur(latitude, longitude)
        ? 'Current location, Jaipur'
        : `Current location (${latitude.toFixed(3)}, ${longitude.toFixed(3)})`,
      source: 'gps',
      preferenceSource: 'gps',
      approximate: false,
      note: 'Using your exact position — we do not serve a listed locality here yet.',
    };
  }

  // 2. Typed text
  const typed = (input.typedText || '').trim();
  if (typed) {
    const resolved = resolveAreaQuery(typed);
    if (resolved.match) {
      const note =
        resolved.confidence === 'exact'
          ? `Set to ${resolved.match.area}.`
          : `Matched "${typed}" to ${resolved.match.area}.`;
      return fromChip(resolved.match, 'typed', 'manual', note);
    }
  }

  // 3. Saved preference
  const saved = input.saved;
  if (
    saved &&
    Number.isFinite(saved.latitude) &&
    Number.isFinite(saved.longitude) &&
    saved.area?.trim()
  ) {
    return {
      latitude: saved.latitude,
      longitude: saved.longitude,
      city: saved.city?.trim() || 'Jaipur',
      area: saved.area.trim(),
      pincode: saved.pincode,
      label: saved.label?.trim() || `${saved.area.trim()}, ${saved.city?.trim() || 'Jaipur'}`,
      source: 'saved',
      preferenceSource: 'manual',
      approximate: true,
      note: 'Using your last saved area.',
    };
  }

  // 4. Profile area
  const profileArea = (input.profileArea || '').trim();
  if (profileArea) {
    const resolved = resolveAreaQuery(profileArea);
    if (resolved.match) {
      return fromChip(
        resolved.match,
        'profile',
        'manual',
        `Using ${resolved.match.area} from your profile.`
      );
    }
  }

  // 5. City default — explicitly labelled, never dressed up as a GPS fix.
  return {
    latitude: JAIPUR_CITY_CENTRE.latitude,
    longitude: JAIPUR_CITY_CENTRE.longitude,
    city: JAIPUR_CITY_CENTRE.city,
    area: JAIPUR_CITY_CENTRE.area,
    pincode: JAIPUR_CITY_CENTRE.pincode,
    label: `${JAIPUR_CITY_CENTRE.area}, ${JAIPUR_CITY_CENTRE.city}`,
    source: 'city-default',
    preferenceSource: 'manual',
    approximate: true,
    note: 'Showing Jaipur city centre — pick your locality for accurate distances.',
  };
}

/** Nearest listed locality to a coordinate pair, ignoring the snap radius. */
export function closestChip(latitude: number, longitude: number): JaipurArea | null {
  return areaForCoordinates(latitude, longitude)?.area ?? null;
}
