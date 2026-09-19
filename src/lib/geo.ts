/** Small, dependency-free geo helpers shared by the client and the maps proxy. */
export interface LatLng { lat: number; lng: number }

const R_KM = 6371;
const toRad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in km, rounded to 0.1. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R_KM * Math.asin(Math.min(1, Math.sqrt(s))) * 10) / 10;
}

/** Rough Indian-city travel time. Road distance ≈ 1.3× straight-line. */
export function estimateTravelMinutes(km: number, mode: string = 'driving'): number {
  const road = km * 1.3;
  const kmh = mode === 'walking' ? 4.5 : mode === 'two_wheeler' ? 22 : mode === 'transit' ? 14 : 18;
  return Math.max(1, Math.round((road / kmh) * 60));
}

export function isLatLng(v: unknown): v is LatLng {
  return !!v && typeof v === 'object' && Number.isFinite((v as LatLng).lat) && Number.isFinite((v as LatLng).lng);
}
