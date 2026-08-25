import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  clearUserLocation,
  distanceMeters,
  formatCoordsLabel,
  syncUserLocation,
  type NexoraCoordinates,
} from '../lib/locationService';

/**
 * useLocationSync — Nexora universal live-location sync.
 *
 * Contract:
 *  - Runs for AUTHENTICATED users only. No user id ⇒ no watcher, no writes.
 *  - Streams live coordinates to the Nexora secure location backend through the
 *    shared, RLS-enforced Supabase client (never a privileged key).
 *  - Exactly ONE `navigator.geolocation.watchPosition` watcher per page, even
 *    under React StrictMode double-mounting or repeated re-renders.
 *  - On sign-out (or unmount) the watcher is cleared and the stored row is
 *    removed, so a logged-out device leaves no live position behind.
 */

export interface UseLocationSyncOptions {
  /** Authenticated Supabase user id. `null`/`undefined` keeps the hook idle. */
  userId?: string | null;
  /** Master switch — pass `isAuthenticated`. */
  enabled?: boolean;
  /** Minimum movement before another write is issued. Default 25 m. */
  minDistanceMeters?: number;
  /** Minimum time between writes. Default 30 s. */
  minIntervalMs?: number;
  /** Notified whenever a fresh fix arrives (e.g. to update the header label). */
  onPosition?: (coords: NexoraCoordinates, label: string) => void;
}

export interface UseLocationSyncState {
  coords: NexoraCoordinates | null;
  /** Formatted "Current Location (lat, lng)" label, or null before first fix. */
  label: string | null;
  isWatching: boolean;
  lastSyncedAt: string | null;
  error: string | null;
  permissionDenied: boolean;
  /** True once the backend reported the location table is unusable. */
  backendUnavailable: boolean;
  /** Force an immediate one-shot push of the latest known position. */
  syncNow: () => Promise<void>;
}

/** Module-level latch: guarantees a single active watcher across all mounts. */
const watcherRegistry = globalThis as typeof globalThis & {
  __nexoraLocationWatchId__?: number | null;
  __nexoraLocationOwner__?: symbol | null;
};

export function useLocationSync(options: UseLocationSyncOptions = {}): UseLocationSyncState {
  const {
    userId,
    enabled = true,
    minDistanceMeters = 25,
    minIntervalMs = 30_000,
    onPosition,
  } = options;

  const [coords, setCoords] = useState<NexoraCoordinates | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [backendUnavailable, setBackendUnavailable] = useState(false);

  // Refs hold values the geolocation callback reads without re-subscribing.
  const lastSentRef = useRef<{ coords: NexoraCoordinates; at: number } | null>(null);
  const latestCoordsRef = useRef<NexoraCoordinates | null>(null);
  const inFlightRef = useRef(false);
  const backendDisabledRef = useRef(false);
  const onPositionRef = useRef(onPosition);
  const userIdRef = useRef<string | null>(userId ?? null);

  useEffect(() => {
    onPositionRef.current = onPosition;
  }, [onPosition]);

  useEffect(() => {
    userIdRef.current = userId ?? null;
  }, [userId]);

  /** Push coordinates to the backend, honouring throttles and the kill-switch. */
  const push = useCallback(
    async (next: NexoraCoordinates, force = false) => {
      const uid = userIdRef.current;
      if (!uid || !isSupabaseConfigured || !supabase) return;
      if (backendDisabledRef.current) return;
      if (inFlightRef.current) return;

      const now = Date.now();
      const previous = lastSentRef.current;
      if (!force && previous) {
        const movedFarEnough = distanceMeters(previous.coords, next) >= minDistanceMeters;
        const waitedLongEnough = now - previous.at >= minIntervalMs;
        if (!movedFarEnough && !waitedLongEnough) return;
      }

      inFlightRef.current = true;
      try {
        const result = await syncUserLocation(uid, next);
        if (result.ok) {
          lastSentRef.current = { coords: next, at: now };
          setLastSyncedAt(new Date(now).toISOString());
          setError(null);
        } else if (result.disabled) {
          backendDisabledRef.current = true;
          setBackendUnavailable(true);
          setError(result.error ?? 'Location backend unavailable');
        } else {
          setError(result.error ?? 'Location sync failed');
        }
      } finally {
        inFlightRef.current = false;
      }
    },
    [minDistanceMeters, minIntervalMs]
  );

  const active = Boolean(enabled && userId && isSupabaseConfigured && supabase);

  useEffect(() => {
    if (!active) {
      setIsWatching(false);
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }

    // ---- Duplicate-watcher guard -------------------------------------------
    // If another mount already owns the watcher, this effect stays passive.
    if (watcherRegistry.__nexoraLocationWatchId__ != null) {
      return;
    }

    const ownerToken = Symbol('nexora-location-owner');
    watcherRegistry.__nexoraLocationOwner__ = ownerToken;
    let cancelled = false;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (cancelled) return;
        const next: NexoraCoordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy ?? null,
          heading: Number.isFinite(position.coords.heading) ? position.coords.heading : null,
          speed: Number.isFinite(position.coords.speed) ? position.coords.speed : null,
          altitude: Number.isFinite(position.coords.altitude) ? position.coords.altitude : null,
        };
        const nextLabel = formatCoordsLabel(next.latitude, next.longitude);

        latestCoordsRef.current = next;
        setCoords(next);
        setLabel(nextLabel);
        setPermissionDenied(false);
        onPositionRef.current?.(next, nextLabel);
        void push(next);
      },
      (geoError) => {
        if (cancelled) return;
        const denied =
          typeof GeolocationPositionError !== 'undefined'
            ? geoError.code === GeolocationPositionError.PERMISSION_DENIED
            : geoError.code === 1;
        setPermissionDenied(denied);
        setError(
          denied
            ? 'Location permission denied. Enable it to share live location.'
            : geoError.message || 'Unable to determine your location.'
        );
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 }
    );

    watcherRegistry.__nexoraLocationWatchId__ = watchId;
    setIsWatching(true);

    return () => {
      cancelled = true;
      // Only the owning mount may tear the shared watcher down.
      if (watcherRegistry.__nexoraLocationOwner__ === ownerToken) {
        if (watcherRegistry.__nexoraLocationWatchId__ != null) {
          navigator.geolocation.clearWatch(watcherRegistry.__nexoraLocationWatchId__);
        }
        watcherRegistry.__nexoraLocationWatchId__ = null;
        watcherRegistry.__nexoraLocationOwner__ = null;
      }
      setIsWatching(false);
    };
  }, [active, push]);

  // ---- Cleanup on logout ---------------------------------------------------
  // When the user id disappears (SIGNED_OUT), purge the row that was written
  // while they were authenticated and reset all local sync state.
  const previousUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    const current = userId ?? null;
    const previous = previousUserIdRef.current;
    previousUserIdRef.current = current;

    if (previous && previous !== current) {
      lastSentRef.current = null;
      latestCoordsRef.current = null;
      setCoords(null);
      setLabel(null);
      setLastSyncedAt(null);
      setError(null);
      if (!backendDisabledRef.current) {
        void clearUserLocation(previous);
      }
    }
  }, [userId]);

  const syncNow = useCallback(async () => {
    const latest = latestCoordsRef.current;
    if (latest) {
      await push(latest, true);
    }
  }, [push]);

  return {
    coords,
    label,
    isWatching,
    lastSyncedAt,
    error,
    permissionDenied,
    backendUnavailable,
    syncNow,
  };
}

export default useLocationSync;
