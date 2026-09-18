/**
 * Google Maps Platform proxy — keeps GOOGLE_MAPS_SERVER_KEY off the browser.
 *
 *   GET  /api/maps/config                        { configured, hasBrowserKey }
 *   POST /api/maps/distance                      Distance Matrix for many salons from one origin
 *   GET  /api/maps/geocode?address=              forward geocode
 *   GET  /api/maps/reverse?lat=&lng=             reverse geocode → area / city
 *   GET  /api/maps/places?q=&lat=&lng=           nearby salon-type places (Places Text Search)
 *
 * Every endpoint degrades honestly: without a key it answers 503
 * `{ configured: false }` and the client falls back to the in-repo haversine
 * maths in src/lib/geo.ts. Nothing here fabricates a distance or a place.
 */
import { Router, Request, Response } from 'express';
import { haversineKm, estimateTravelMinutes } from '../src/lib/geo';

export function readMapsConfig(env: NodeJS.ProcessEnv = process.env) {
  const key = (env.GOOGLE_MAPS_SERVER_KEY || env.GOOGLE_MAPS_API_KEY || '').trim() || null;
  return { configured: Boolean(key), key, hasBrowserKey: Boolean((env.VITE_GOOGLE_MAPS_API_KEY || '').trim()), region: env.GOOGLE_MAPS_REGION || 'in', language: env.GOOGLE_MAPS_LANGUAGE || 'en-IN' };
}

type LatLng = { lat: number; lng: number };
const isLatLng = (v: unknown): v is LatLng => !!v && typeof v === 'object' && Number.isFinite((v as LatLng).lat) && Number.isFinite((v as LatLng).lng);

export function createMapsRouter(env: NodeJS.ProcessEnv = process.env, fetchImpl: typeof fetch = fetch): Router {
  const router = Router();
  const cfg = readMapsConfig(env);
  const cache = new Map<string, { at: number; value: unknown }>();
  const TTL = 5 * 60_000;
  const cached = async <T,>(key: string, fn: () => Promise<T>): Promise<T> => {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL) return hit.value as T;
    const value = await fn();
    cache.set(key, { at: Date.now(), value });
    return value;
  };

  router.get('/config', (_req, res) => res.json({ configured: cfg.configured, hasBrowserKey: cfg.hasBrowserKey, provider: 'google_maps_platform' }));

  /**
   * Body: { origin: {lat,lng}, destinations: [{ id, lat, lng }], mode?: 'driving'|'two_wheeler'|'walking' }
   * Returns per-destination { id, distanceKm, durationMin, source }.
   * Falls back to haversine per destination (source: 'estimate') when Google is unavailable.
   */
  router.post('/distance', async (req: Request, res: Response) => {
    const origin = req.body?.origin;
    const dests: { id: string; lat: number; lng: number }[] = Array.isArray(req.body?.destinations) ? req.body.destinations.filter((d: unknown) => isLatLng(d) && typeof (d as { id?: unknown }).id === 'string').slice(0, 25) : [];
    if (!isLatLng(origin) || dests.length === 0) return res.status(400).json({ error: 'origin {lat,lng} and destinations[{id,lat,lng}] are required' });
    const mode = ['driving', 'two_wheeler', 'walking', 'transit'].includes(req.body?.mode) ? req.body.mode : 'driving';

    const estimate = () => dests.map((d) => { const km = haversineKm(origin, d); return { id: d.id, distanceKm: km, durationMin: estimateTravelMinutes(km, mode), source: 'estimate' as const }; });

    if (!cfg.configured) return res.json({ configured: false, mode, results: estimate() });

    try {
      const key = `dm:${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}:${mode}:${dests.map((d) => `${d.lat.toFixed(4)},${d.lng.toFixed(4)}`).join('|')}`;
      const results = await cached(key, async () => {
        const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
        url.searchParams.set('origins', `${origin.lat},${origin.lng}`);
        url.searchParams.set('destinations', dests.map((d) => `${d.lat},${d.lng}`).join('|'));
        url.searchParams.set('mode', mode === 'two_wheeler' ? 'driving' : mode);
        url.searchParams.set('departure_time', 'now');
        url.searchParams.set('region', cfg.region);
        url.searchParams.set('language', cfg.language);
        url.searchParams.set('key', cfg.key as string);
        const r = await fetchImpl(url.toString());
        const json = (await r.json()) as { status?: string; error_message?: string; rows?: { elements?: { status?: string; distance?: { value: number }; duration_in_traffic?: { value: number }; duration?: { value: number } }[] }[] };
        if (json.status !== 'OK') throw new Error(json.error_message || `Distance Matrix ${json.status}`);
        const els = json.rows?.[0]?.elements ?? [];
        return dests.map((d, i) => {
          const e = els[i];
          if (!e || e.status !== 'OK' || !e.distance) { const km = haversineKm(origin, d); return { id: d.id, distanceKm: km, durationMin: estimateTravelMinutes(km, mode), source: 'estimate' as const }; }
          return { id: d.id, distanceKm: Math.round((e.distance.value / 1000) * 10) / 10, durationMin: Math.round(((e.duration_in_traffic ?? e.duration)?.value ?? 0) / 60), source: 'google' as const };
        });
      });
      return res.json({ configured: true, mode, results });
    } catch (err) {
      return res.json({ configured: true, mode, results: estimate(), warning: err instanceof Error ? err.message : 'Distance Matrix failed' });
    }
  });

  router.get('/geocode', async (req: Request, res: Response) => {
    const address = typeof req.query.address === 'string' ? req.query.address.trim().slice(0, 200) : '';
    if (!address) return res.status(400).json({ error: 'address is required' });
    if (!cfg.configured) return res.status(503).json({ configured: false, error: 'Google Maps is not configured' });
    try {
      const out = await cached(`gc:${address.toLowerCase()}`, async () => {
        const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
        url.searchParams.set('address', address);
        url.searchParams.set('region', cfg.region);
        url.searchParams.set('components', 'country:IN');
        url.searchParams.set('key', cfg.key as string);
        const json = (await (await fetchImpl(url.toString())).json()) as { status: string; results?: { formatted_address: string; geometry: { location: LatLng }; address_components: { long_name: string; types: string[] }[]; place_id: string }[] };
        if (json.status !== 'OK' || !json.results?.length) return null;
        const r = json.results[0];
        return { formattedAddress: r.formatted_address, location: r.geometry.location, placeId: r.place_id, area: pick(r.address_components, ['sublocality_level_1', 'sublocality', 'neighborhood']), city: pick(r.address_components, ['locality', 'administrative_area_level_2']), pincode: pick(r.address_components, ['postal_code']) };
      });
      if (!out) return res.status(404).json({ configured: true, error: 'No match' });
      return res.json({ configured: true, result: out });
    } catch (err) {
      return res.status(502).json({ configured: true, error: err instanceof Error ? err.message : 'Geocode failed' });
    }
  });

  router.get('/reverse', async (req: Request, res: Response) => {
    const lat = Number(req.query.lat); const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ error: 'lat and lng are required' });
    if (!cfg.configured) return res.status(503).json({ configured: false, error: 'Google Maps is not configured' });
    try {
      const out = await cached(`rg:${lat.toFixed(4)},${lng.toFixed(4)}`, async () => {
        const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
        url.searchParams.set('latlng', `${lat},${lng}`);
        url.searchParams.set('result_type', 'sublocality|locality|neighborhood');
        url.searchParams.set('key', cfg.key as string);
        const json = (await (await fetchImpl(url.toString())).json()) as { status: string; results?: { formatted_address: string; address_components: { long_name: string; types: string[] }[] }[] };
        if (json.status !== 'OK' || !json.results?.length) return null;
        const r = json.results[0];
        return { formattedAddress: r.formatted_address, area: pick(r.address_components, ['sublocality_level_1', 'sublocality', 'neighborhood']), city: pick(r.address_components, ['locality', 'administrative_area_level_2']), pincode: pick(r.address_components, ['postal_code']) };
      });
      if (!out) return res.status(404).json({ configured: true, error: 'No match' });
      return res.json({ configured: true, result: out });
    } catch (err) {
      return res.status(502).json({ configured: true, error: err instanceof Error ? err.message : 'Reverse geocode failed' });
    }
  });

  router.get('/places', async (req: Request, res: Response) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 120) : 'salon';
    const lat = Number(req.query.lat); const lng = Number(req.query.lng);
    if (!cfg.configured) return res.status(503).json({ configured: false, error: 'Google Maps is not configured' });
    try {
      const out = await cached(`pl:${q}:${Number.isFinite(lat) ? lat.toFixed(3) : ''},${Number.isFinite(lng) ? lng.toFixed(3) : ''}`, async () => {
        const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
        url.searchParams.set('query', q);
        url.searchParams.set('type', 'beauty_salon');
        url.searchParams.set('region', cfg.region);
        if (Number.isFinite(lat) && Number.isFinite(lng)) { url.searchParams.set('location', `${lat},${lng}`); url.searchParams.set('radius', '8000'); }
        url.searchParams.set('key', cfg.key as string);
        const json = (await (await fetchImpl(url.toString())).json()) as { status: string; results?: { place_id: string; name: string; formatted_address: string; rating?: number; user_ratings_total?: number; geometry: { location: LatLng }; opening_hours?: { open_now?: boolean } }[] };
        if (json.status !== 'OK') return [];
        return (json.results ?? []).slice(0, 15).map((p) => ({ placeId: p.place_id, name: p.name, address: p.formatted_address, rating: p.rating ?? null, reviews: p.user_ratings_total ?? 0, location: p.geometry.location, openNow: p.opening_hours?.open_now ?? null, mapsUrl: `https://www.google.com/maps/place/?q=place_id:${p.place_id}` }));
      });
      return res.json({ configured: true, places: out });
    } catch (err) {
      return res.status(502).json({ configured: true, error: err instanceof Error ? err.message : 'Places search failed' });
    }
  });

  return router;
}

function pick(components: { long_name: string; types: string[] }[], types: string[]): string | null {
  for (const t of types) { const c = components.find((x) => x.types.includes(t)); if (c) return c.long_name; }
  return null;
}
