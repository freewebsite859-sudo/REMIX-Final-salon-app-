import { useCallback, useEffect, useRef, useState } from 'react';
import type { Salon } from '../types';
import { DEMO_SALONS } from '../data/demoCatalog';
import { fetchCatalog, type CatalogSource } from '../lib/catalogService';

interface UseCatalogState {
  salons: Salon[];
  source: CatalogSource;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Keeps the customer UI populated while the canonical catalog is loading.
 * Remote data replaces the fallback atomically only when it contains valid
 * salon rows; child-table failures never append fake children to real salons.
 */
export function useCatalog(refreshIntervalMs = 60_000): UseCatalogState {
  const [salons, setSalons] = useState<Salon[]>(DEMO_SALONS);
  const [source, setSource] = useState<CatalogSource>('fallback');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const result = await fetchCatalog();
      if (!mountedRef.current) return;

      setSalons(result.salons);
      setSource(result.source);
      setError(result.warnings.length ? result.warnings.join(' ') : null);
      setIsLoading(false);
    } catch (error) {
      if (!mountedRef.current) return;
      const message = error instanceof Error ? error.message : String(error);
      // Keep the current catalog visible on unexpected adapter failures.
      setSource('fallback');
      setError(`Catalog refresh failed: ${message}`);
      setIsLoading(false);
    }
  }, []);

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
