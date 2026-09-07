/**
 * Canonical Jaipur area chips for first-login and manual location pickers.
 * Each entry carries the coordinates we persist when the customer picks a
 * chip (so salon distance sorting still works without a live GPS fix).
 */

export interface JaipurArea {
  /** Short display name shown on the chip (e.g. "Mansarovar"). */
  name: string;
  /** City — always Jaipur for this catalog. */
  city: string;
  /** Area / locality label stored on the profile. */
  area: string;
  latitude: number;
  longitude: number;
  /** Optional Indian PIN when known for the locality centre. */
  pincode?: string;
}

/** Full label used in the header (e.g. "Mansarovar, Jaipur"). */
export function formatAreaLabel(area: Pick<JaipurArea, 'area' | 'city'>): string {
  return `${area.area}, ${area.city}`;
}

/**
 * Popular Jaipur localities used on first login when GPS is denied or the
 * customer prefers a manual pick. Order matches the product brief.
 */
export const JAIPUR_AREA_CHIPS: readonly JaipurArea[] = [
  {
    name: 'Mansarovar',
    area: 'Mansarovar',
    city: 'Jaipur',
    latitude: 26.8533,
    longitude: 75.7681,
    pincode: '302020',
  },
  {
    name: 'Vaishali Nagar',
    area: 'Vaishali Nagar',
    city: 'Jaipur',
    latitude: 26.9075,
    longitude: 75.7423,
    pincode: '302021',
  },
  {
    name: 'Malviya Nagar',
    area: 'Malviya Nagar',
    city: 'Jaipur',
    latitude: 26.8529,
    longitude: 75.8055,
    pincode: '302017',
  },
  {
    name: 'Raja Park',
    area: 'Raja Park',
    city: 'Jaipur',
    latitude: 26.8967,
    longitude: 75.8304,
    pincode: '302004',
  },
  {
    name: 'C-Scheme',
    area: 'C-Scheme',
    city: 'Jaipur',
    latitude: 26.9124,
    longitude: 75.8035,
    pincode: '302001',
  },
  {
    name: 'Jagatpura',
    area: 'Jagatpura',
    city: 'Jaipur',
    latitude: 26.8202,
    longitude: 75.8576,
    pincode: '302017',
  },
  {
    name: 'Tonk Road',
    area: 'Tonk Road',
    city: 'Jaipur',
    latitude: 26.8628,
    longitude: 75.8,
    pincode: '302015',
  },
  {
    name: 'Jhotwara',
    area: 'Jhotwara',
    city: 'Jaipur',
    latitude: 26.9482,
    longitude: 75.7415,
    pincode: '302012',
  },
  {
    name: 'Sanganer',
    area: 'Sanganer',
    city: 'Jaipur',
    latitude: 26.8246,
    longitude: 75.7727,
    pincode: '302029',
  },
  {
    name: 'Pratap Nagar',
    area: 'Pratap Nagar',
    city: 'Jaipur',
    latitude: 26.7965,
    longitude: 75.8234,
    pincode: '302033',
  },
] as const;

/** Rough bounding box used to decide whether a GPS fix is "in Jaipur". */
export const JAIPUR_BOUNDS = {
  minLat: 26.7,
  maxLat: 27.05,
  minLng: 75.6,
  maxLng: 76.05,
} as const;

export function isInsideJaipur(latitude: number, longitude: number): boolean {
  return (
    latitude >= JAIPUR_BOUNDS.minLat &&
    latitude <= JAIPUR_BOUNDS.maxLat &&
    longitude >= JAIPUR_BOUNDS.minLng &&
    longitude <= JAIPUR_BOUNDS.maxLng
  );
}

/** Haversine distance in metres. */
function distanceMeters(
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
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Snap a GPS fix to the nearest Jaipur chip when it is within `maxMeters`
 * (default 4 km). Returns null when nothing is close enough — the caller
 * should still save the raw coordinates with a generic city/area label.
 */
export function nearestJaipurArea(
  latitude: number,
  longitude: number,
  maxMeters = 4000
): (JaipurArea & { distanceMeters: number }) | null {
  let best: (JaipurArea & { distanceMeters: number }) | null = null;
  for (const area of JAIPUR_AREA_CHIPS) {
    const d = distanceMeters(
      { latitude, longitude },
      { latitude: area.latitude, longitude: area.longitude }
    );
    if (d > maxMeters) continue;
    if (!best || d < best.distanceMeters) {
      best = { ...area, distanceMeters: d };
    }
  }
  return best;
}
