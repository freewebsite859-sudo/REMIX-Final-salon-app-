/**
 * Google Maps grounding for salon results.
 *
 * Two independent, user-controlled switches:
 *
 *   1. **Google Maps grounded results** — every result is checked against the
 *      coordinates in the catalog. Salons with valid, in-city coordinates get
 *      a verified Google Maps place/directions link; salons without them are
 *      flagged (and, when the toggle is on, demoted below verified ones).
 *      This runs entirely on catalog data, so it works with no API key and
 *      never fabricates a location.
 *
 *   2. **AI Maps grounding** — an optional call to a Gemini model with the
 *      Google Maps tool enabled, which returns place-grounded suggestions with
 *      citations. This needs credentials. Without them the toggle reports
 *      `unconfigured` and the UI says so instead of pretending to be live.
 *
 * Everything is persisted per-browser in localStorage and is safe to import in
 * Node (tests, SSR) — no `window` access at module scope.
 */

import type { Salon } from '../types';
import { isInsideJaipur } from './jaipurAreas';

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

export const MAPS_GROUNDING_STORAGE_KEY = 'nexora-maps-grounding';

export interface MapsGroundingPreferences {
  /** Verify results against catalog coordinates and attach Maps links. */
  groundedResults: boolean;
  /** Ask the AI Maps grounding backend to enrich the query. */
  aiGrounding: boolean;
}

export const DEFAULT_MAPS_GROUNDING_PREFERENCES: MapsGroundingPreferences = {
  groundedResults: true,
  aiGrounding: false,
};

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function loadMapsGroundingPreferences(store?: Storage | null): MapsGroundingPreferences {
  const s = store ?? storage();
  if (!s) return { ...DEFAULT_MAPS_GROUNDING_PREFERENCES };
  try {
    const raw = s.getItem(MAPS_GROUNDING_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_MAPS_GROUNDING_PREFERENCES };
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { ...DEFAULT_MAPS_GROUNDING_PREFERENCES };
    }
    const value = parsed as Partial<MapsGroundingPreferences>;
    return {
      groundedResults:
        typeof value.groundedResults === 'boolean'
          ? value.groundedResults
          : DEFAULT_MAPS_GROUNDING_PREFERENCES.groundedResults,
      aiGrounding:
        typeof value.aiGrounding === 'boolean'
          ? value.aiGrounding
          : DEFAULT_MAPS_GROUNDING_PREFERENCES.aiGrounding,
    };
  } catch {
    return { ...DEFAULT_MAPS_GROUNDING_PREFERENCES };
  }
}

export function saveMapsGroundingPreferences(
  preferences: MapsGroundingPreferences,
  store?: Storage | null
): MapsGroundingPreferences {
  const s = store ?? storage();
  try {
    s?.setItem(MAPS_GROUNDING_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    /* private mode / quota — the in-memory value still applies */
  }
  return preferences;
}

/** Flip one switch and persist the result. */
export function setMapsGroundingPreference<K extends keyof MapsGroundingPreferences>(
  key: K,
  value: MapsGroundingPreferences[K],
  store?: Storage | null
): MapsGroundingPreferences {
  const next = { ...loadMapsGroundingPreferences(store), [key]: value };
  return saveMapsGroundingPreferences(next, store);
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

type EnvRecord = Record<string, string | undefined>;

function env(): EnvRecord {
  try {
    return (import.meta as unknown as { env?: EnvRecord }).env || {};
  } catch {
    return {};
  }
}

function flagOn(value: string | undefined): boolean {
  return typeof value === 'string' && /^(1|true|yes|on)$/i.test(value.trim());
}

/**
 * AI grounding needs a backend. It is considered configured when an endpoint
 * (or the explicit feature flag) is present — never when only a browser-side
 * key exists, because a Gemini key must not ship in the bundle.
 */
export function isAiGroundingConfigured(overrides?: EnvRecord): boolean {
  const e = overrides || env();
  return Boolean(e.VITE_NEXORA_MAPS_GROUNDING_ENDPOINT) || flagOn(e.VITE_NEXORA_AI_MAPS_GROUNDING);
}

export function aiGroundingEndpoint(overrides?: EnvRecord): string {
  const e = overrides || env();
  return e.VITE_NEXORA_MAPS_GROUNDING_ENDPOINT || '/api/maps/ground';
}

export interface GroundingCapability {
  /** Catalog-based grounding — always available, needs no credentials. */
  groundedResults: { available: true; reason: string };
  /** AI grounding — available only when a backend is configured. */
  aiGrounding: { available: boolean; reason: string };
}

export function describeGroundingCapability(overrides?: EnvRecord): GroundingCapability {
  const aiReady = isAiGroundingConfigured(overrides);
  return {
    groundedResults: {
      available: true,
      reason:
        'Results are checked against the coordinates in the salon catalog and linked to Google Maps.',
    },
    aiGrounding: {
      available: aiReady,
      reason: aiReady
        ? 'AI Maps grounding is connected — queries are enriched with Google Maps place data.'
        : 'AI Maps grounding is not configured on this deployment, so it stays off.',
    },
  };
}

// ---------------------------------------------------------------------------
// Catalog-based grounding
// ---------------------------------------------------------------------------

export type GroundingStatus =
  /** Valid coordinates that sit inside the city we serve. */
  | 'verified'
  /** Valid coordinates, but outside the Jaipur bounding box. */
  | 'out_of_area'
  /** No usable coordinates — only a text address to hand off to Maps. */
  | 'unverified';

export interface GroundedSalon {
  salon: Salon;
  status: GroundingStatus;
  hasCoordinates: boolean;
  latitude: number | null;
  longitude: number | null;
  /** Google Maps place link (never a fabricated one). */
  mapsUrl: string;
  /** Google Maps directions link. */
  directionsUrl: string;
  /** Short badge label for the UI. */
  label: string;
}

function validCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function hasValidCoordinates(salon: Salon): boolean {
  const { latitude, longitude } = salon.location;
  return (
    validCoordinate(latitude) &&
    validCoordinate(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180 &&
    !(latitude === 0 && longitude === 0)
  );
}

export function mapsPlaceUrl(salon: Salon): string {
  if (salon.location.mapsUrl) return salon.location.mapsUrl;
  if (hasValidCoordinates(salon)) {
    const { latitude, longitude } = salon.location;
    return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}&query_place_id=`
      .replace(/&query_place_id=$/, '');
  }
  const q = `${salon.name} ${salon.location.address || salon.location.area} ${salon.location.city}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q.trim())}`;
}

export function mapsDirectionsUrl(
  salon: Salon,
  origin?: { latitude: number; longitude: number } | null
): string {
  const destination = hasValidCoordinates(salon)
    ? `${salon.location.latitude},${salon.location.longitude}`
    : `${salon.name} ${salon.location.address || ''} ${salon.location.city || ''}`.trim();
  const params = new URLSearchParams({ api: '1', destination });
  if (origin && validCoordinate(origin.latitude) && validCoordinate(origin.longitude)) {
    params.set('origin', `${origin.latitude},${origin.longitude}`);
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Annotate one salon with its verified map hand-off. */
export function groundSalon(
  salon: Salon,
  origin?: { latitude: number; longitude: number } | null
): GroundedSalon {
  const hasCoordinates = hasValidCoordinates(salon);
  const latitude = hasCoordinates ? salon.location.latitude ?? null : null;
  const longitude = hasCoordinates ? salon.location.longitude ?? null : null;
  const inArea =
    hasCoordinates && latitude != null && longitude != null
      ? isInsideJaipur(latitude, longitude)
      : false;
  const status: GroundingStatus = !hasCoordinates
    ? 'unverified'
    : inArea
      ? 'verified'
      : 'out_of_area';

  return {
    salon,
    status,
    hasCoordinates,
    latitude,
    longitude,
    mapsUrl: mapsPlaceUrl(salon),
    directionsUrl: mapsDirectionsUrl(salon, origin),
    label:
      status === 'verified'
        ? 'Maps verified'
        : status === 'out_of_area'
          ? 'Outside Jaipur'
          : 'Location unverified',
  };
}

export interface GroundedResultSet<T> {
  /** Items in their (possibly re-ordered) presentation order. */
  items: Array<T & { grounding: GroundedSalon }>;
  verifiedCount: number;
  unverifiedCount: number;
  /** True when grounding actually changed anything about the ordering. */
  reordered: boolean;
}

/**
 * Ground a list of search results. When `enabled` is false the list is
 * annotated but never re-ordered, so turning the toggle off is a true no-op
 * for ranking.
 */
export function groundResults<T extends { salon: Salon }>(
  results: readonly T[],
  options: {
    enabled?: boolean;
    origin?: { latitude: number; longitude: number } | null;
  } = {}
): GroundedResultSet<T> {
  const enabled = options.enabled !== false;
  const annotated = results.map((result) => ({
    ...result,
    grounding: groundSalon(result.salon, options.origin),
  }));

  const verifiedCount = annotated.filter((r) => r.grounding.status === 'verified').length;
  const unverifiedCount = annotated.length - verifiedCount;

  if (!enabled) {
    return { items: annotated, verifiedCount, unverifiedCount, reordered: false };
  }

  const rank = (status: GroundingStatus): number =>
    status === 'verified' ? 0 : status === 'out_of_area' ? 1 : 2;
  const ordered = annotated
    .map((item, index) => ({ item, index }))
    .sort((a, b) => rank(a.item.grounding.status) - rank(b.item.grounding.status) || a.index - b.index)
    .map((entry) => entry.item);

  const reordered = ordered.some((item, index) => item !== annotated[index]);
  return { items: ordered, verifiedCount, unverifiedCount, reordered };
}

// ---------------------------------------------------------------------------
// AI Maps grounding (optional backend)
// ---------------------------------------------------------------------------

export interface AiGroundedPlace {
  name: string;
  address?: string;
  mapsUrl?: string;
  latitude?: number;
  longitude?: number;
  /** Why the model surfaced this place. */
  reason?: string;
}

export type AiGroundingResult =
  | { status: 'ok'; places: AiGroundedPlace[]; summary: string; citations: string[] }
  | { status: 'disabled'; message: string }
  | { status: 'unconfigured'; message: string }
  | { status: 'error'; message: string };

export interface AiGroundingRequest {
  query: string;
  area?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Ask the configured backend for Google Maps grounded suggestions.
 *
 * Contract with the caller: this function NEVER throws and NEVER invents
 * places. Every non-`ok` state carries a message the UI can show verbatim.
 */
export async function requestAiMapsGrounding(
  request: AiGroundingRequest,
  options: {
    enabled?: boolean;
    fetchImpl?: typeof fetch;
    env?: EnvRecord;
    signal?: AbortSignal;
  } = {}
): Promise<AiGroundingResult> {
  if (options.enabled === false) {
    return { status: 'disabled', message: 'AI Maps grounding is switched off.' };
  }
  if (!isAiGroundingConfigured(options.env)) {
    return {
      status: 'unconfigured',
      message:
        'AI Maps grounding is not configured on this deployment. Results still use verified catalog coordinates.',
    };
  }
  const doFetch = options.fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!doFetch) {
    return { status: 'error', message: 'Network access is unavailable in this environment.' };
  }

  try {
    const response = await doFetch(aiGroundingEndpoint(options.env), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: options.signal,
    });
    if (!response.ok) {
      return {
        status: 'error',
        message: `Maps grounding backend responded ${response.status}.`,
      };
    }
    const data: unknown = await response.json();
    const payload = (data || {}) as {
      places?: unknown;
      summary?: unknown;
      citations?: unknown;
    };
    const places = Array.isArray(payload.places)
      ? payload.places
          .filter((p): p is Record<string, unknown> => Boolean(p) && typeof p === 'object')
          .map((p) => ({
            name: typeof p.name === 'string' ? p.name : '',
            address: typeof p.address === 'string' ? p.address : undefined,
            mapsUrl: typeof p.mapsUrl === 'string' ? p.mapsUrl : undefined,
            latitude: typeof p.latitude === 'number' ? p.latitude : undefined,
            longitude: typeof p.longitude === 'number' ? p.longitude : undefined,
            reason: typeof p.reason === 'string' ? p.reason : undefined,
          }))
          .filter((p) => p.name.trim().length > 0)
      : [];
    return {
      status: 'ok',
      places,
      summary: typeof payload.summary === 'string' ? payload.summary : '',
      citations: Array.isArray(payload.citations)
        ? payload.citations.filter((c): c is string => typeof c === 'string')
        : [],
    };
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') {
      return { status: 'disabled', message: 'Maps grounding request cancelled.' };
    }
    return {
      status: 'error',
      message: 'Could not reach the Maps grounding backend. Showing catalog results only.',
    };
  }
}
