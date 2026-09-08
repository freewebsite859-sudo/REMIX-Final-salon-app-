import { useCallback, useEffect, useRef, useState } from 'react';
import type { Salon } from '../types';
import { isLiveCustomerDataEnabled } from '../lib/supabase';
import { fetchCustomerCatalog, type CustomerCatalogResult } from '../lib/customerCatalogService';
import { fetchCatalog, type CatalogResult } from '../lib/catalogService';

interface UseCatalogState {
  salons: Salon[];
  source: 'remote' | 'empty' | 'fallback';
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Live customer catalog hook.
 *
 * When a real Supabase project is configured (and demo mode is not forced) the
 * hook uses ONLY the canonical customer tables. It never falls back to the
 * in-repo demo catalog in that mode — if the live catalog is unavailable or
 * empty the UI receives an empty catalog (and the warnings describe why)
 * rather than fabricated data.
 *
 * The in-repo demo catalog remains available for the unconfigured/local demo
 * preview environment and for the QA test harness.
 */
export function useCatalog(refreshIntervalMs = 60_000): UseCatalogState {
  const [salons, setSalons] = useState<Salon[]>([]);
  const [source, setSource] = useState<UseCatalogState['source']>(isLiveCustomerDataEnabled ? 'empty' : 'fallback');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const applyLiveResult = useCallback((result: CustomerCatalogResult) => {
    if (!mountedRef.current) return;
    setSalons(result.salons);
    setSource(result.source);
    setError(result.warnings.length ? result.warnings.join(' ') : null);
    setIsLoading(false);
  }, []);

  const applyOfflineResult = useCallback((result: CatalogResult) => {
    if (!mountedRef.current) return;
    setSalons(result.salons);
    setSource(result.source);
    setError(result.warnings.length ? result.warnings.join(' ') : null);
    setIsLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    try {
      if (isLiveCustomerDataEnabled) {
        applyLiveResult(await fetchCustomerCatalog());
      } else {
        applyOfflineResult(await fetchCatalog());
      }
    } catch (error) {
      if (!mountedRef.current) return;
      const message = error instanceof Error ? error.message : String(error);
      // A real database must never fall back to mock data. Keep whatever the
      // live query last returned, and expose the error.
      setSource('empty');
      setError(`Catalog refresh failed: ${message}`);
      setIsLoading(false);
    }
  }, [applyLiveResult, applyOfflineResult]);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();

    if (refreshIntervalMs <= 0) {
      return () => {
        mountedRef.current = false;
      };
    }

    const interval = window.setInterval(() => {
      void refresh();
    }, refreshIntervalMs);

    return () => {
      mountedRef.current = false;
      window.clearInterval(interval);
    };
  }, [refresh, refreshIntervalMs]);

  return { salons, source, isLoading, error, refresh };
}
