import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Salon } from '../types';
import { groundSalon } from '../lib/mapsGrounding';
import { StaticMapPreview } from './StaticMapPreview';
import { mapsApi, type DistanceResult } from '../lib/smartClient';
import { haversineKm, estimateTravelMinutes, type LatLng } from '../lib/geo';

/**
 * Google Maps JS embed with live distance/ETA, degrading to StaticMapPreview.
 *
 * Needs `VITE_GOOGLE_MAPS_API_KEY` (a browser key restricted by HTTP referrer;
 * Maps JavaScript API only). The Distance-Matrix call goes through
 * `/api/maps/distance`, which uses the *server* key and falls back to a
 * haversine estimate — the ETA badge always says which one it is.
 */

declare global {
  interface Window { google?: any; __nexoraMapsLoader?: Promise<any> }
}

const readEnv = (name: string): string =>
  ((import.meta as unknown as { env?: Record<string, string | undefined> })?.env?.[name] || '').trim();
const BROWSER_KEY = readEnv('VITE_GOOGLE_MAPS_API_KEY');

export function loadGoogleMaps(key: string = BROWSER_KEY): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (!key) return Promise.reject(new Error('VITE_GOOGLE_MAPS_API_KEY not set'));
  if (!window.__nexoraMapsLoader) {
    window.__nexoraMapsLoader = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&libraries=marker&loading=async&region=IN&language=en`;
      s.async = true;
      s.onload = () => (window.google?.maps ? resolve(window.google.maps) : reject(new Error('Maps failed to initialise')));
      s.onerror = () => reject(new Error('Maps script failed to load'));
      document.head.appendChild(s);
    });
  }
  return window.__nexoraMapsLoader;
}

export interface InteractiveSalonMapProps {
  salon: Salon;
  /** Nearby salons to plot as secondary pins (optional). */
  others?: Salon[];
  userLocation?: string;
  userCoords?: LatLng | null;
  className?: string;
  onSelectSalon?: (salon: Salon) => void;
}

export const InteractiveSalonMap: React.FC<InteractiveSalonMapProps> = ({ salon, others = [], userLocation = '', userCoords = null, className = '', onSelectSalon }) => {
  const grounding = groundSalon(salon);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'fallback'>(BROWSER_KEY && grounding.hasCoordinates ? 'loading' : 'fallback');
  const [eta, setEta] = useState<DistanceResult | null>(null);
  const [mode, setMode] = useState<'two_wheeler' | 'driving' | 'walking'>('two_wheeler');
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  const origin = userCoords;
  const dest = useMemo<LatLng>(() => ({ lat: salon.location.latitude, lng: salon.location.longitude }), [salon.location.latitude, salon.location.longitude]);

  // Distance / ETA (server proxy → falls back to local estimate)
  useEffect(() => {
    if (!origin || !grounding.hasCoordinates) { setEta(null); return; }
    let cancelled = false;
    const local: DistanceResult = { id: salon.id, distanceKm: haversineKm(origin, dest), durationMin: estimateTravelMinutes(haversineKm(origin, dest), mode), source: 'estimate' };
    setEta(local);
    mapsApi.distances(origin, [salon], mode).then((r) => {
      if (cancelled || !r.ok) return;
      const hit = r.data.results.find((x) => x.id === salon.id);
      if (hit) setEta(hit);
    });
    return () => { cancelled = true; };
  }, [origin?.lat, origin?.lng, dest.lat, dest.lng, mode, salon.id, grounding.hasCoordinates]);

  // Map init
  useEffect(() => {
    if (status !== 'loading' || !mapEl.current) return;
    let cancelled = false;
    loadGoogleMaps().then((maps) => {
      if (cancelled || !mapEl.current) return;
      const map = new maps.Map(mapEl.current, { center: dest, zoom: 14, mapId: readEnv('VITE_GOOGLE_MAPS_MAP_ID') || undefined, disableDefaultUI: true, zoomControl: true, gestureHandling: 'cooperative', clickableIcons: false });
      mapRef.current = map;
      const bounds = new maps.LatLngBounds();
      const pin = (pos: LatLng, title: string, primary: boolean, onClick?: () => void) => {
        const m = new maps.Marker({ position: pos, map, title, icon: { path: maps.SymbolPath.CIRCLE, scale: primary ? 11 : 7, fillColor: primary ? '#780032' : '#c1416c', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 } });
        if (onClick) m.addListener('click', onClick);
        bounds.extend(pos);
        return m;
      };
      pin(dest, salon.name, true);
      for (const o of others.slice(0, 12)) {
        if (o.id === salon.id || !groundSalon(o).hasCoordinates) continue;
        pin({ lat: o.location.latitude, lng: o.location.longitude }, o.name, false, onSelectSalon ? () => onSelectSalon(o) : undefined);
      }
      if (origin) { new maps.Marker({ position: origin, map, title: 'You', icon: { path: maps.SymbolPath.CIRCLE, scale: 7, fillColor: '#2563eb', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 } }); bounds.extend(origin); }
      if (others.length || origin) map.fitBounds(bounds, 48);
      setStatus('ready');
    }).catch((err) => {
      console.warn('[Nexora] Google Maps unavailable, using static preview:', err?.message || err);
      if (!cancelled) setStatus('fallback');
    });
    return () => { cancelled = true; };
  }, [status]);

  if (status === 'fallback') return <StaticMapPreview salon={salon} userLocation={userLocation} className={className} />;

  return (
    <div className={`rounded-2xl overflow-hidden border border-[#e0bec3] bg-white ${className}`} data-testid="interactive-salon-map">
      <div ref={mapEl} className="h-64 w-full bg-[#fff0f1]" aria-label={`Map showing ${salon.name}`} role="img">
        {status === 'loading' && <div className="h-full w-full animate-pulse" />}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
        <div className="min-w-0">
          <p className="font-semibold text-[#26181a] truncate">{salon.location.address}</p>
          {eta ? (
            <p className="text-xs text-[#594045]">
              {eta.distanceKm} km · ~{eta.durationMin} min {mode === 'two_wheeler' ? 'by bike' : mode === 'walking' ? 'on foot' : 'by car'}
              <span className="ml-1 text-[#8c6f74]">({eta.source === 'google' ? 'live traffic' : 'estimate'})</span>
            </p>
          ) : (
            <p className="text-xs text-[#594045]">Share your location for a live ETA.</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {(['two_wheeler', 'driving', 'walking'] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m} className={`px-2 py-1 rounded-lg text-xs font-medium ${mode === m ? 'bg-[#780032] text-white' : 'bg-[#fff0f1] text-[#780032]'}`}>
              {m === 'two_wheeler' ? 'Bike' : m === 'driving' ? 'Car' : 'Walk'}
            </button>
          ))}
          <a href={grounding.directionsUrl} target="_blank" rel="noopener noreferrer" className="ml-2 px-3 py-1.5 rounded-lg bg-[#780032] text-white text-xs font-bold">Directions</a>
        </div>
      </div>
    </div>
  );
};

export default InteractiveSalonMap;
