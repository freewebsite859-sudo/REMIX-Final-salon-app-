import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Salon } from '../../types';
import {
  DEFAULT_SEARCH_FILTERS,
  SORT_OPTIONS,
  SEARCH_CATEGORIES,
  countActiveFilters,
  searchSalons,
  type SearchFilters,
  type SearchSort,
  type SearchCategoryId,
} from '../../lib/salonSearch';
import { SalonCard, SalonCardSkeleton, type SalonCardLayout } from './SalonCard';
import { SalonFilterSidebar } from './SalonFilterSidebar';

export const SALONS_PAGE_SIZE = 9;
const VIEW_STORAGE_KEY = 'nexora-salons-view';

export interface SalonDiscoveryPageProps {
  salons: Salon[];
  savedSalonIds: string[];
  isLoading?: boolean;
  currentLocation?: string;
  initialQuery?: string;
  initialSort?: string;
  initialView?: SalonCardLayout;
  initialCategory?: string;
  /** Sync query / sort / view back to the URL. */
  onStateChange?: (state: { query: string; sort: SearchSort; view: SalonCardLayout }) => void;
  onOpenSalon: (salon: Salon) => void;
  onBookSalon: (salon: Salon) => void;
  onToggleSaveSalon: (salonId: string) => void;
  onOpenLocation?: () => void;
  onBack?: () => void;
}

const isSort = (v: unknown): v is SearchSort => SORT_OPTIONS.some((o) => o.id === v);
const isCategory = (v: unknown): v is SearchCategoryId => SEARCH_CATEGORIES.some((c) => c.id === v);

const useDebounced = <T,>(value: T, ms: number) => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return v;
};

export const SalonDiscoveryPage: React.FC<SalonDiscoveryPageProps> = ({
  salons,
  savedSalonIds,
  isLoading = false,
  currentLocation,
  initialQuery = '',
  initialSort,
  initialView,
  initialCategory,
  onStateChange,
  onOpenSalon,
  onBookSalon,
  onToggleSaveSalon,
  onOpenLocation,
  onBack,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const debouncedQuery = useDebounced(query, 180);
  const [sort, setSort] = useState<SearchSort>(isSort(initialSort) ? initialSort : 'nearest');
  const [view, setView] = useState<SalonCardLayout>(() => {
    if (initialView) return initialView;
    try {
      const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
      if (stored === 'list' || stored === 'grid') return stored;
    } catch { /* ignore */ }
    return 'grid';
  });
  const [filters, setFilters] = useState<SearchFilters>(() => ({
    ...DEFAULT_SEARCH_FILTERS,
    category: isCategory(initialCategory) ? initialCategory : 'all',
  }));
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try { window.localStorage.setItem(VIEW_STORAGE_KEY, view); } catch { /* ignore */ }
  }, [view]);

  useEffect(() => {
    onStateChange?.({ query: debouncedQuery, sort, view });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, sort, view]);

  const outcome = useMemo(() => searchSalons(salons, debouncedQuery, filters, sort), [salons, debouncedQuery, filters, sort]);
  const results = useMemo(
    () => (favouritesOnly ? outcome.results.filter((r) => savedSalonIds.includes(r.salon.id)) : outcome.results),
    [outcome.results, favouritesOnly, savedSalonIds]
  );

  // Reset pagination when the result set changes.
  useEffect(() => { setPage(1); }, [debouncedQuery, filters, sort, favouritesOnly]);

  const visible = results.slice(0, page * SALONS_PAGE_SIZE);
  const hasMore = visible.length < results.length;
  const loadMore = useCallback(() => { if (hasMore) setPage((p) => p + 1); }, [hasMore]);

  // Infinite scroll — falls back to the explicit "Load more" button when IO is unavailable.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) loadMore(); }, { rootMargin: '400px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadMore]);

  // Lock body scroll while the mobile filter drawer is open.
  useEffect(() => {
    if (!mobileFiltersOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [mobileFiltersOpen]);

  const activeFilters = countActiveFilters(filters);
  const currentSort = SORT_OPTIONS.find((o) => o.id === sort)!;

  const sidebar = (
    <SalonFilterSidebar
      filters={filters}
      onChange={setFilters}
      salons={salons}
      resultCount={results.length}
      onClose={() => setMobileFiltersOpen(false)}
      className="h-full lg:h-auto lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)]"
    />
  );

  return (
    <div id="salon-discovery-page" className="flex flex-col w-full pb-28 max-w-7xl mx-auto px-page-margin md:px-6" data-testid="salon-discovery-page">
      {/* Header */}
      <header className="pt-4 pb-3 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          {onBack && (
            <button type="button" onClick={onBack} aria-label="Back" className="w-9 h-9 rounded-full hover:bg-surface-container flex items-center justify-center cursor-pointer -ml-2">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="font-page-heading text-[24px] sm:text-[28px] font-extrabold tracking-tight text-on-surface leading-tight">Discover Salons</h1>
            <button type="button" onClick={onOpenLocation} className="inline-flex items-center gap-1 text-xs text-on-surface-variant hover:text-primary cursor-pointer">
              <span className="material-symbols-outlined text-sm text-primary">location_on</span>
              <span className="truncate">{currentLocation || 'Jaipur, Rajasthan'}</span>
              {onOpenLocation && <span className="material-symbols-outlined text-sm">expand_more</span>}
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary">search</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search salons, services, areas… e.g. “haircut under ₹300 in Mansarovar”"
            className="w-full h-12 pl-11 pr-11 rounded-2xl bg-white border border-outline-variant/50 text-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
            aria-label="Search salons"
            data-testid="salons-search-input"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full hover:bg-surface-container flex items-center justify-center cursor-pointer">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          )}
        </div>

        {/* Quick category chips */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-page-margin px-page-margin md:mx-0 md:px-0">
          {SEARCH_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setFilters((f) => ({ ...f, category: c.id }))}
              aria-pressed={filters.category === c.id}
              className={`shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                filters.category === c.id ? 'bg-on-surface text-white border-on-surface' : 'bg-white border-outline-variant/50 hover:border-on-surface/40'
              }`}
              data-testid={`category-chip-${c.id}`}
            >
              <span className="material-symbols-outlined text-base">{c.icon}</span>{c.label}
            </button>
          ))}
        </div>
      </header>

      {/* Toolbar */}
      <div className="sticky top-16 z-20 -mx-page-margin px-page-margin md:mx-0 md:px-0 py-2 bg-surface-off-white/90 backdrop-blur border-b border-outline-variant/30 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setMobileFiltersOpen(true)}
            className="lg:hidden inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-white border border-outline-variant/50 text-xs font-bold cursor-pointer"
            data-testid="open-mobile-filters"
          >
            <span className="material-symbols-outlined text-base">tune</span>
            Filters{activeFilters > 0 && <span className="bg-primary text-white rounded-full px-1.5 text-[10px]">{activeFilters}</span>}
          </button>
          <span className="text-xs text-on-surface-variant truncate" data-testid="salons-result-count" aria-live="polite">
            {isLoading && results.length === 0 ? 'Loading salons…' : <><strong className="text-on-surface">{results.length}</strong> salon{results.length === 1 ? '' : 's'}{outcome.didYouMean ? <> · showing results for <em>“{outcome.didYouMean}”</em></> : null}</>}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFavouritesOnly((v) => !v)}
            aria-pressed={favouritesOnly}
            className={`h-9 px-3 rounded-xl border text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition-colors ${favouritesOnly ? 'bg-primary text-white border-primary' : 'bg-white border-outline-variant/50'}`}
            data-testid="favourites-only-toggle"
          >
            <span className={`material-symbols-outlined text-base ${favouritesOnly ? 'fill-1' : ''}`}>favorite</span>
            <span className="hidden sm:inline">Saved</span>
            {savedSalonIds.length > 0 && <span className="opacity-70">({savedSalonIds.length})</span>}
          </button>

          {/* Sort */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setSortOpen((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={sortOpen}
              className="h-9 px-3 rounded-xl bg-white border border-outline-variant/50 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
              data-testid="sort-button"
            >
              <span className="material-symbols-outlined text-base">{currentSort.icon}</span>
              <span className="hidden sm:inline">{currentSort.label}</span>
              <span className="material-symbols-outlined text-base">expand_more</span>
            </button>
            <AnimatePresence>
              {sortOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
                  <motion.ul
                    role="listbox"
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-1 z-20 w-48 bg-white rounded-2xl border border-outline-variant/40 shadow-xl p-1.5"
                    data-testid="sort-menu"
                  >
                    {SORT_OPTIONS.map((o) => (
                      <li key={o.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={o.id === sort}
                          onClick={() => { setSort(o.id); setSortOpen(false); }}
                          className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer ${o.id === sort ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container'}`}
                          data-testid={`sort-option-${o.id}`}
                        >
                          <span className="material-symbols-outlined text-base">{o.icon}</span>{o.label}
                          {o.id === sort && <span className="material-symbols-outlined text-base ml-auto">check</span>}
                        </button>
                      </li>
                    ))}
                  </motion.ul>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* View toggle */}
          <div className="h-9 rounded-xl bg-white border border-outline-variant/50 p-0.5 flex" role="group" aria-label="Layout">
            {(['grid', 'list'] as SalonCardLayout[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                aria-label={`${v} view`}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${view === v ? 'bg-on-surface text-white' : 'text-secondary hover:bg-surface-container'}`}
                data-testid={`view-${v}`}
              >
                <span className="material-symbols-outlined text-lg">{v === 'grid' ? 'grid_view' : 'view_list'}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5 pt-4">
        <div className="hidden lg:block">{sidebar}</div>

        <main className="min-w-0">
          {isLoading && salons.length === 0 ? (
            <div className={view === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4' : 'flex flex-col gap-3'}>
              {Array.from({ length: 6 }).map((_, i) => <SalonCardSkeleton key={i} layout={view} />)}
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-20 px-6 bg-white rounded-2xl border border-dashed border-outline-variant/60" data-testid="salons-empty">
              <span className="material-symbols-outlined text-5xl text-outline-variant mb-3">search_off</span>
              <h3 className="font-bold text-on-surface">No salons match</h3>
              <p className="text-sm text-on-surface-variant mt-1 max-w-sm">
                {favouritesOnly ? 'You have no saved salons in this view yet.' : 'Try widening the distance, clearing the price range, or searching a different area.'}
              </p>
              <button
                type="button"
                onClick={() => { setFilters(DEFAULT_SEARCH_FILTERS); setQuery(''); setFavouritesOnly(false); }}
                className="mt-4 h-10 px-5 rounded-xl bg-primary text-on-primary text-xs font-bold cursor-pointer"
              >
                Reset everything
              </button>
            </div>
          ) : (
            <>
              <div className={view === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4' : 'flex flex-col gap-3'} data-testid="salons-results" data-view={view}>
                  {visible.map((r, i) => (
                    <SalonCard
                      key={r.salon.id}
                      salon={r.salon}
                      layout={view}
                      index={i % SALONS_PAGE_SIZE}
                      isSaved={savedSalonIds.includes(r.salon.id)}
                      matchedService={r.matchedService}
                      onOpen={onOpenSalon}
                      onBook={onBookSalon}
                      onToggleSave={onToggleSaveSalon}
                    />
                  ))}
              </div>

              <div ref={sentinelRef} className="h-px" aria-hidden />
              <div className="flex flex-col items-center gap-2 py-6">
                <span className="text-xs text-secondary">Showing {visible.length} of {results.length}</span>
                {hasMore && (
                  <button type="button" onClick={loadMore} className="h-10 px-6 rounded-xl bg-white border border-outline-variant/50 text-xs font-bold hover:border-primary hover:text-primary transition-colors cursor-pointer" data-testid="load-more">
                    Load more salons
                  </button>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {/* Mobile filter drawer */}
      <AnimatePresence>
        {mobileFiltersOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMobileFiltersOpen(false)} />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="fixed inset-y-0 left-0 z-50 w-[88vw] max-w-sm lg:hidden p-2"
              data-testid="mobile-filter-drawer"
            >
              {sidebar}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
