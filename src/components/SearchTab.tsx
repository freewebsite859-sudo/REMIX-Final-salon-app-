import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Salon, SalonService, Stylist, UserProfile } from '../types';
import { fetchSearchHistory } from '../lib/searchHistoryService';
import { isLiveCustomerDataEnabled } from '../lib/supabase';
import {
  DEFAULT_SEARCH_FILTERS,
  DISTANCE_OPTIONS,
  PRICE_PRESETS,
  RATING_OPTIONS,
  SEARCH_CATEGORIES,
  SERVICE_TYPE_OPTIONS,
  SORT_OPTIONS,
  TRENDING_SEARCHES,
  type SearchFilters,
  type SearchSort,
  clearRecentSearches,
  countActiveFilters,
  distanceKm,
  hasHomeService,
  hasOffers,
  isSearchActive,
  isVerifiedSalon,
  loadRecentSearches,
  parseSearchQuery,
  pushRecentSearch,
  searchSalons,
} from '../lib/salonSearch';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SearchTabProps {
  user: UserProfile;
  userId?: string | null;
  salons: Salon[];
  currentLocation: string;
  savedSalonIds: string[];
  /** Prefill from `/customer/search?q=`. */
  initialSearchQuery?: string;
  /** Mirror query into the parent URL `?q=`. */
  onSearchQueryChange?: (query: string) => void;
  onOpenSalonDetails: (salon: Salon) => void;
  onBookSalon: (salon: Salon, service?: SalonService, stylist?: Stylist) => void;
  onToggleSaveSalon: (salonId: string) => void;
  onOpenLocation?: () => void;
}

// ---------------------------------------------------------------------------
// Speech recognition (optional)
// ---------------------------------------------------------------------------

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((ev: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognitionCtor(): (new () => SpeechRec) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

// ---------------------------------------------------------------------------
// Result card
// ---------------------------------------------------------------------------

const SearchResultCard: React.FC<{
  salon: Salon;
  fromPrice: number;
  matchedService: SalonService | null;
  isSaved: boolean;
  onOpen: () => void;
  onBook: () => void;
  onToggleSave: () => void;
}> = ({ salon, fromPrice, matchedService, isSaved, onOpen, onBook, onToggleSave }) => {
  const verified = isVerifiedSalon(salon);
  const category = salon.categories?.[0] || (salon.gender === 'men' ? 'Barber' : 'Salon');
  const offer = hasOffers(salon);

  return (
    <article
      id={`search-result-${salon.id}`}
      className="bg-white border border-outline-variant/50 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col sm:flex-row"
    >
      <div className="relative sm:w-[140px] h-[140px] sm:h-auto shrink-0 cursor-pointer" onClick={onOpen}>
        <img
          src={salon.image}
          alt={salon.name}
          loading="lazy"
          className="w-full h-full object-cover min-h-[140px]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent sm:bg-gradient-to-r" />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSave();
          }}
          aria-label={isSaved ? `Remove ${salon.name} from favourites` : `Save ${salon.name}`}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/95 text-nexora-pink flex items-center justify-center shadow-sm cursor-pointer"
        >
          <span className={`material-symbols-outlined text-[16px] ${isSaved ? 'fill-1' : ''}`}>
            favorite
          </span>
        </button>
        <span
          className={`absolute bottom-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold ${
            salon.isOpen ? 'bg-success-emerald text-white' : 'bg-black/70 text-white'
          }`}
        >
          {salon.isOpen ? 'Open now' : 'Closed'}
        </span>
      </div>

      <div className="p-3.5 flex flex-col gap-1.5 flex-1 min-w-0">
        <div className="flex items-start gap-1.5">
          <h3
            onClick={onOpen}
            className="font-card-title text-[15px] font-bold text-on-surface hover:text-nexora-pink cursor-pointer leading-snug line-clamp-2 flex-1"
          >
            {salon.name}
          </h3>
          {verified && (
            <span
              className="material-symbols-outlined text-[16px] text-emerald-600 fill-1 shrink-0 mt-0.5"
              title="Verified salon"
            >
              verified
            </span>
          )}
        </div>

        <p className="text-[11px] text-on-surface-variant truncate">
          {category}
          {salon.gender !== 'unisex' ? ` · ${salon.gender === 'men' ? 'Men' : 'Women'}` : ' · Unisex'}
          {offer ? ' · Offer' : ''}
          {hasHomeService(salon) ? ' · Home service' : ''}
        </p>

        <div className="flex items-center gap-1.5 text-[12px] flex-wrap">
          <span className="flex items-center gap-0.5 font-bold text-warning-amber">
            <span className="material-symbols-outlined text-[14px] fill-1">star</span>
            {salon.rating.toFixed(1)}
          </span>
          <span className="text-on-surface-variant">
            ({salon.reviewCount.toLocaleString('en-IN')})
          </span>
          <span className="text-on-surface-variant">·</span>
          <span className="text-on-surface-variant truncate">{salon.location.area}</span>
          <span className="text-on-surface-variant">·</span>
          <span className="font-semibold text-primary">{salon.distance}</span>
        </div>

        {matchedService && (
          <p className="text-[12px] text-on-surface-variant">
            Matches{' '}
            <span className="font-semibold text-on-surface">{matchedService.name}</span>
            {matchedService.discountPrice && matchedService.discountPrice < matchedService.price ? (
              <>
                {' '}
                · <span className="line-through text-on-surface-variant">₹{matchedService.price}</span>{' '}
                <span className="font-bold text-emerald-700">₹{matchedService.discountPrice}</span>
              </>
            ) : (
              <>
                {' '}
                · <span className="font-bold text-on-surface">₹{matchedService.price}</span>
              </>
            )}
          </p>
        )}

        {salon.discountOffer && (
          <p className="text-[11px] font-semibold text-nexora-pink truncate">
            {salon.discountOffer}
          </p>
        )}

        <div className="flex items-center justify-between mt-auto pt-1.5 gap-2">
          <div>
            <span className="text-[10px] text-on-surface-variant uppercase font-semibold">From</span>
            <p className="text-[16px] font-extrabold text-on-surface leading-none">₹{fromPrice}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onOpen}
              className="px-2.5 py-2 rounded-xl border border-outline-variant/60 text-[11px] font-bold text-on-surface hover:border-primary/40 transition-colors cursor-pointer"
            >
              View
            </button>
            <button
              type="button"
              onClick={onBook}
              className="px-3.5 py-2 rounded-xl bg-primary text-white text-[11px] font-bold hover:bg-nexora-pink transition-colors shadow-xs cursor-pointer"
            >
              Book Now
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};

// ---------------------------------------------------------------------------
// Filter chip helper
// ---------------------------------------------------------------------------

const Chip: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  id?: string;
  tone?: 'primary' | 'pink';
}> = ({ active, onClick, children, id, tone = 'primary' }) => (
  <button
    type="button"
    id={id}
    onClick={onClick}
    className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-all cursor-pointer ${
      active
        ? tone === 'pink'
          ? 'bg-nexora-pink text-white border-nexora-pink shadow-xs'
          : 'bg-primary text-white border-primary shadow-xs'
        : 'bg-white text-on-surface border-outline-variant/50 hover:border-primary/40'
    }`}
  >
    {children}
  </button>
);

// ---------------------------------------------------------------------------
// Main Search page
// ---------------------------------------------------------------------------

export const SearchTab: React.FC<SearchTabProps> = ({
  user: _user,
  userId,
  salons,
  currentLocation,
  savedSalonIds,
  initialSearchQuery,
  onSearchQueryChange,
  onOpenSalonDetails,
  onBookSalon,
  onToggleSaveSalon,
  onOpenLocation,
}) => {
  const [query, setQuery] = useState(initialSearchQuery || '');
  const [filters, setFilters] = useState<SearchFilters>({ ...DEFAULT_SEARCH_FILTERS });
  const [sort, setSort] = useState<SearchSort | null>(null);
  const [sortTouched, setSortTouched] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>(() =>
    isLiveCustomerDataEnabled && userId ? [] : loadRecentSearches()
  );
  const [isListening, setIsListening] = useState(false);
  const [voiceHint, setVoiceHint] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(Boolean((initialSearchQuery || '').trim()));
  const speechRef = useRef<SpeechRec | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const commitTimer = useRef<number | null>(null);

  // Sync from route deep-link
  useEffect(() => {
    if (typeof initialSearchQuery === 'string' && initialSearchQuery !== query) {
      setQuery(initialSearchQuery);
      if (initialSearchQuery.trim()) setSubmitted(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSearchQuery]);

  // Recent searches come from `search_history` for the signed-in customer in
  // live mode. Unconfigured previews still use the device cache only.
  useEffect(() => {
    if (!isLiveCustomerDataEnabled || !userId) return;
    let active = true;
    void fetchSearchHistory(userId).then((rows) => {
      if (active) setRecent(rows.map((r) => r.query).filter(Boolean));
    });
    return () => {
      active = false;
    };
  }, [userId]);

  const areaShort = useMemo(() => {
    const raw = (currentLocation || '').split(',')[0]?.trim() || 'Mansarovar';
    return raw.replace(/^Current Location.*/i, 'Mansarovar');
  }, [currentLocation]);

  const placeholder = `Try “haircut under ₹300 near ${areaShort}”`;

  const updateQuery = useCallback(
    (value: string, opts: { submit?: boolean; persist?: boolean } = {}) => {
      setQuery(value);
      onSearchQueryChange?.(value);
      if (opts.submit || value.trim()) setSubmitted(true);
      if (opts.persist && value.trim()) {
        setRecent(pushRecentSearch(value.trim()));
      }
    },
    [onSearchQueryChange]
  );

  const handleInputChange = (value: string) => {
    setQuery(value);
    onSearchQueryChange?.(value);
    if (commitTimer.current) window.clearTimeout(commitTimer.current);
    // Debounced "submitted" so results appear while typing after a short pause
    commitTimer.current = window.setTimeout(() => {
      if (value.trim()) setSubmitted(true);
    }, 280);
  };

  useEffect(
    () => () => {
      if (commitTimer.current) window.clearTimeout(commitTimer.current);
    },
    []
  );

  const patchFilters = (patch: Partial<SearchFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setSubmitted(true);
  };

  const clearAll = () => {
    setQuery('');
    onSearchQueryChange?.('');
    setFilters({ ...DEFAULT_SEARCH_FILTERS });
    setSort(null);
    setSortTouched(false);
    setSubmitted(false);
    inputRef.current?.focus();
  };

  const applyExample = (example: string) => {
    // Prefer inferred filters from the example so chips light up
    const parsed = parseSearchQuery(example);
    setFilters((prev) => ({
      ...prev,
      ...parsed.inferred,
      // Keep booleans OR'd
      openNow: Boolean(parsed.inferred.openNow),
      homeService: Boolean(parsed.inferred.homeService),
      verifiedOnly: Boolean(parsed.inferred.verifiedOnly),
      offersOnly: Boolean(parsed.inferred.offersOnly),
    }));
    if (parsed.inferredSort) {
      setSort(parsed.inferredSort);
      setSortTouched(true);
    }
    updateQuery(example, { submit: true, persist: true });
  };

  // ---- Search pipeline ----------------------------------------------------
  const pipeline = useMemo(() => {
    const uiSort = sortTouched ? sort : null;
    return searchSalons(salons, query, filters, uiSort);
  }, [salons, query, filters, sort, sortTouched]);

  const active = isSearchActive(query, filters);
  const activeFilterCount = countActiveFilters(pipeline.filters);
  const results = pipeline.results;

  // Live NL understanding chips (even before submit)
  const liveParsed = useMemo(() => parseSearchQuery(query), [query]);

  // ---- Voice --------------------------------------------------------------
  const stopVoice = useCallback(() => {
    try {
      speechRef.current?.stop();
    } catch {
      /* ignore */
    }
    speechRef.current = null;
    setIsListening(false);
  }, []);

  const handleVoiceSearch = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setVoiceHint('Voice search is not supported in this browser. Type your query instead.');
      window.setTimeout(() => setVoiceHint(null), 3500);
      inputRef.current?.focus();
      return;
    }
    if (isListening) {
      stopVoice();
      return;
    }
    try {
      const rec = new Ctor();
      rec.lang = 'en-IN';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.continuous = false;
      rec.onresult = (ev) => {
        const transcript = (ev.results?.[0]?.[0]?.transcript || '').trim();
        if (transcript) {
          const parsed = parseSearchQuery(transcript);
          setFilters((prev) => ({
            ...prev,
            ...parsed.inferred,
            openNow: prev.openNow || Boolean(parsed.inferred.openNow),
            homeService: prev.homeService || Boolean(parsed.inferred.homeService),
            verifiedOnly: prev.verifiedOnly || Boolean(parsed.inferred.verifiedOnly),
            offersOnly: prev.offersOnly || Boolean(parsed.inferred.offersOnly),
          }));
          if (parsed.inferredSort) {
            setSort(parsed.inferredSort);
            setSortTouched(true);
          }
          updateQuery(transcript, { submit: true, persist: true });
          setVoiceHint(`Heard: “${transcript}”`);
          window.setTimeout(() => setVoiceHint(null), 2500);
        }
      };
      rec.onerror = (ev) => {
        setVoiceHint(
          ev?.error === 'not-allowed'
            ? 'Microphone permission blocked. Allow mic access or type your search.'
            : 'Could not hear that. Try again or type your search.'
        );
        window.setTimeout(() => setVoiceHint(null), 3500);
        setIsListening(false);
      };
      rec.onend = () => setIsListening(false);
      speechRef.current = rec;
      setIsListening(true);
      setVoiceHint('Listening… say something like “spa open now”');
      rec.start();
    } catch {
      setVoiceHint('Voice search unavailable right now.');
      window.setTimeout(() => setVoiceHint(null), 3000);
      setIsListening(false);
    }
  }, [isListening, stopVoice, updateQuery]);

  useEffect(() => () => stopVoice(), [stopVoice]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = query.trim();
    setSubmitted(true);
    if (q) setRecent(pushRecentSearch(q));
    // Apply NL inferences into filter chips so the UI reflects understanding
    const parsed = parseSearchQuery(q);
    if (Object.keys(parsed.inferred).length > 0) {
      setFilters((prev) => ({
        ...prev,
        ...parsed.inferred,
        openNow: prev.openNow || Boolean(parsed.inferred.openNow),
        homeService: prev.homeService || Boolean(parsed.inferred.homeService),
        verifiedOnly: prev.verifiedOnly || Boolean(parsed.inferred.verifiedOnly),
        offersOnly: prev.offersOnly || Boolean(parsed.inferred.offersOnly),
      }));
    }
    if (parsed.inferredSort && !sortTouched) {
      setSort(parsed.inferredSort);
    }
  };

  const effectiveSort: SearchSort = pipeline.sort;

  // ---- Empty catalog ------------------------------------------------------
  if (salons.length === 0) {
    return (
      <section className="flex-1 px-page-margin py-16 max-w-2xl mx-auto text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
          <span className="material-symbols-outlined text-[32px]">search_off</span>
        </div>
        <h1 className="mt-5 font-page-heading text-2xl font-bold text-on-surface">
          No salons to search yet
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
          The salon catalogue is empty right now. Please try again shortly.
        </p>
      </section>
    );
  }

  return (
    <div id="customer-search-page" className="flex flex-col w-full pb-28 max-w-4xl mx-auto">
      {/* ================================================================= */}
      {/* Hero search bar                                                   */}
      {/* ================================================================= */}
      <section className="relative px-page-margin pt-4 pb-3">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/8 via-transparent to-nexora-pink/5" />

        <div className="flex items-center justify-between gap-2 mb-2">
          <div>
            <h1 className="font-page-heading text-[22px] sm:text-[24px] font-extrabold text-on-surface tracking-tight">
              Search
            </h1>
            <button
              type="button"
              onClick={() => onOpenLocation?.()}
              className="text-[11px] font-semibold text-nexora-pink flex items-center gap-0.5 hover:underline cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">location_on</span>
              {currentLocation || 'Set your area'}
            </button>
          </div>
          <button
            type="button"
            id="search-toggle-filters-btn"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            className={`relative h-10 px-3.5 rounded-xl border text-[12px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              filtersOpen || activeFilterCount > 0
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-on-surface border-outline-variant/60 hover:border-primary/40'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">tune</span>
            Filters
            {activeFilterCount > 0 && (
              <span
                className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-extrabold flex items-center justify-center ${
                  filtersOpen || activeFilterCount > 0
                    ? 'bg-white text-primary'
                    : 'bg-primary text-white'
                }`}
              >
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="relative" role="search">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[#b00055] z-10 pointer-events-none">
            search
          </span>
          <input
            ref={inputRef}
            id="search-page-input"
            type="search"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
            }}
            placeholder={placeholder}
            aria-label="Search salons, services, areas"
            autoComplete="off"
            className="w-full h-[54px] pl-11 pr-[96px] bg-white text-on-surface font-body-md text-[14px] rounded-2xl border border-[rgba(180,0,80,0.18)] shadow-[0_8px_25px_rgba(0,0,0,0.06)] focus:outline-none focus:border-[rgba(176,0,85,0.45)] focus:ring-4 focus:ring-[rgba(176,0,85,0.08)] transition-all"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  onSearchQueryChange?.('');
                  inputRef.current?.focus();
                }}
                aria-label="Clear search"
                className="w-9 h-9 rounded-full text-on-surface-variant hover:text-[#b00055] flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
            <button
              type="button"
              id="search-voice-btn"
              onClick={handleVoiceSearch}
              aria-label={isListening ? 'Stop voice search' : 'Voice search'}
              aria-pressed={isListening}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                isListening
                  ? 'bg-error text-white animate-pulse'
                  : 'text-nexora-pink hover:bg-primary/10'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">
                {isListening ? 'mic' : 'mic_none'}
              </span>
            </button>
            <button
              type="submit"
              id="search-submit-btn"
              aria-label="Run search"
              className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center hover:bg-nexora-pink transition-colors cursor-pointer shadow-xs"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>
        </form>

        {voiceHint && (
          <p
            role="status"
            className="mt-2 text-[12px] text-on-surface-variant bg-surface-container-low border border-outline-variant/40 rounded-xl px-3 py-2"
          >
            {voiceHint}
          </p>
        )}

        {/* Natural-language understanding strip */}
        {query.trim() && liveParsed.understanding.length > 0 && (
          <div
            id="search-nl-understanding"
            className="mt-2.5 flex flex-wrap items-center gap-1.5"
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mr-0.5">
              Understood
            </span>
            {liveParsed.understanding.map((chip) => (
              <span
                key={chip}
                className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold border border-primary/15"
              >
                {chip}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* ================================================================= */}
      {/* Filters panel                                                     */}
      {/* ================================================================= */}
      {filtersOpen && (
        <section
          id="search-filters-panel"
          className="mx-page-margin mb-3 p-4 rounded-2xl bg-white border border-outline-variant/50 shadow-xs space-y-4"
        >
          {/* Category */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
              Category
            </p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
              {SEARCH_CATEGORIES.map((cat) => (
                <Chip
                  key={cat.id}
                  id={`search-cat-${cat.id}`}
                  active={filters.category === cat.id}
                  onClick={() => patchFilters({ category: cat.id })}
                >
                  <span className="inline-flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">{cat.icon}</span>
                    {cat.label}
                  </span>
                </Chip>
              ))}
            </div>
          </div>

          {/* Service type */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
              Service type
            </p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
              <Chip
                active={!filters.serviceType}
                onClick={() => patchFilters({ serviceType: '' })}
              >
                Any
              </Chip>
              {SERVICE_TYPE_OPTIONS.map((svc) => (
                <Chip
                  key={svc}
                  active={filters.serviceType.toLowerCase() === svc.toLowerCase()}
                  onClick={() =>
                    patchFilters({
                      serviceType:
                        filters.serviceType.toLowerCase() === svc.toLowerCase() ? '' : svc,
                    })
                  }
                  tone="pink"
                >
                  {svc}
                </Chip>
              ))}
            </div>
          </div>

          {/* Price range */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
              Price range
            </p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
              {PRICE_PRESETS.map((p) => {
                const activePreset =
                  filters.minPrice === p.min && filters.maxPrice === p.max;
                return (
                  <Chip
                    key={p.label}
                    active={activePreset}
                    onClick={() =>
                      patchFilters(
                        activePreset
                          ? { minPrice: null, maxPrice: null }
                          : { minPrice: p.min, maxPrice: p.max }
                      )
                    }
                  >
                    {p.label}
                  </Chip>
                );
              })}
            </div>
          </div>

          {/* Distance */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
              Distance
            </p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
              {DISTANCE_OPTIONS.map((d) => (
                <Chip
                  key={String(d.value)}
                  active={filters.maxDistanceKm === d.value}
                  onClick={() => patchFilters({ maxDistanceKm: d.value })}
                >
                  {d.label}
                </Chip>
              ))}
            </div>
          </div>

          {/* Rating */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
              Rating
            </p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
              {RATING_OPTIONS.map((r) => (
                <Chip
                  key={r.value}
                  active={filters.minRating === r.value}
                  onClick={() => patchFilters({ minRating: r.value })}
                >
                  {r.label === 'Any' ? 'Any' : (
                    <span className="inline-flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-[12px] fill-1">star</span>
                      {r.label}
                    </span>
                  )}
                </Chip>
              ))}
            </div>
          </div>

          {/* Gender */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
              Gender
            </p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'men', label: 'Male' },
                  { id: 'women', label: 'Female' },
                  { id: 'unisex', label: 'Unisex' },
                ] as const
              ).map((g) => (
                <Chip
                  key={g.id}
                  active={filters.gender === g.id}
                  onClick={() => patchFilters({ gender: g.id })}
                >
                  {g.label}
                </Chip>
              ))}
            </div>
          </div>

          {/* Toggle filters */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
              More filters
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { key: 'openNow' as const, label: 'Open now', icon: 'schedule' },
                  { key: 'verifiedOnly' as const, label: 'Verified only', icon: 'verified' },
                  { key: 'offersOnly' as const, label: 'Offers available', icon: 'sell' },
                  { key: 'homeService' as const, label: 'Home service', icon: 'home' },
                ] as const
              ).map((t) => (
                <Chip
                  key={t.key}
                  active={Boolean(filters[t.key])}
                  onClick={() => patchFilters({ [t.key]: !filters[t.key] })}
                >
                  <span className="inline-flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">{t.icon}</span>
                    {t.label}
                  </span>
                </Chip>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-outline-variant/40">
            <button
              type="button"
              onClick={() => {
                setFilters({ ...DEFAULT_SEARCH_FILTERS });
              }}
              className="text-[12px] font-bold text-on-surface-variant hover:text-nexora-pink cursor-pointer"
            >
              Reset filters
            </button>
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="px-4 py-2 rounded-xl bg-primary text-white text-[12px] font-bold hover:bg-nexora-pink transition-colors cursor-pointer"
            >
              Show {active ? results.length : salons.length} results
            </button>
          </div>
        </section>
      )}

      {/* ================================================================= */}
      {/* Sort row (when searching)                                         */}
      {/* ================================================================= */}
      {(active || submitted) && (
        <section className="px-page-margin mb-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-[12px] text-on-surface-variant">
              <strong className="text-on-surface">{results.length}</strong> result
              {results.length === 1 ? '' : 's'}
              {query.trim() ? (
                <>
                  {' '}
                  for <span className="text-on-surface font-semibold">“{query.trim()}”</span>
                </>
              ) : null}
            </p>
            {active && (
              <button
                type="button"
                onClick={clearAll}
                className="text-[12px] font-bold text-nexora-pink hover:underline cursor-pointer shrink-0"
              >
                Clear all
              </button>
            )}
          </div>
          <div
            id="search-sort-row"
            className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5"
            role="listbox"
            aria-label="Sort results"
          >
            {SORT_OPTIONS.map((opt) => {
              const selected = effectiveSort === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  id={`search-sort-${opt.id}`}
                  onClick={() => {
                    setSort(opt.id);
                    setSortTouched(true);
                    setSubmitted(true);
                  }}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-all cursor-pointer inline-flex items-center gap-1 ${
                    selected
                      ? 'bg-on-surface text-white border-on-surface shadow-xs'
                      : 'bg-surface-container-low text-on-surface border-outline-variant/40 hover:border-primary/40'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">{opt.icon}</span>
                  {opt.label}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ================================================================= */}
      {/* Idle state: recent + trending + NL examples                       */}
      {/* ================================================================= */}
      {!active && !submitted && (
        <>
          {/* Recent searches */}
          {recent.length > 0 && (
            <section id="search-recent" className="px-page-margin mb-6">
              <div className="flex items-center justify-between mb-2.5">
                <h2 className="font-section-heading text-[15px] font-bold text-on-surface">
                  Recent searches
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    clearRecentSearches();
                    setRecent([]);
                  }}
                  className="text-[12px] font-semibold text-on-surface-variant hover:text-nexora-pink cursor-pointer"
                >
                  Clear
                </button>
              </div>
              <ul className="flex flex-col gap-1">
                {recent.map((r) => (
                  <li key={r}>
                    <button
                      type="button"
                      onClick={() => applyExample(r)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white border border-transparent hover:border-outline-variant/40 text-left transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                        history
                      </span>
                      <span className="flex-1 text-[13px] font-medium text-on-surface truncate">
                        {r}
                      </span>
                      <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
                        north_west
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Trending / example NL queries */}
          <section id="search-trending" className="px-page-margin mb-6">
            <h2 className="font-section-heading text-[15px] font-bold text-on-surface mb-1">
              Trending searches
            </h2>
            <p className="text-[12px] text-on-surface-variant mb-3">
              Natural language works — try these in plain English
            </p>
            <div className="flex flex-wrap gap-2">
              {TRENDING_SEARCHES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => applyExample(t)}
                  className="px-3 py-2 rounded-2xl bg-white border border-outline-variant/50 text-[12px] font-semibold text-on-surface hover:border-primary/40 hover:shadow-xs transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[14px] text-nexora-pink">
                    trending_up
                  </span>
                  {t}
                </button>
              ))}
            </div>
          </section>

          {/* NL tips card */}
          <section id="search-nl-tips" className="px-page-margin mb-6">
            <div className="rounded-2xl bg-gradient-to-br from-primary/8 via-white to-nexora-pink/8 border border-primary/15 p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[22px]">auto_awesome</span>
                </div>
                <div>
                  <h3 className="font-card-title text-[14px] font-bold text-on-surface">
                    Speak or type naturally
                  </h3>
                  <p className="text-[12px] text-on-surface-variant mt-1 leading-relaxed">
                    Examples: “haircut under ₹300”, “best salon near Mansarovar”, “female beauty
                    parlour near me”, “tattoo studio in Jaipur”, “spa open now”.
                  </p>
                  <button
                    type="button"
                    onClick={handleVoiceSearch}
                    className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-white text-[12px] font-bold hover:bg-nexora-pink transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">mic</span>
                    Try voice search
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Quick category launchers */}
          <section id="search-quick-categories" className="px-page-margin mb-4">
            <h2 className="font-section-heading text-[15px] font-bold text-on-surface mb-3">
              Browse categories
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {SEARCH_CATEGORIES.filter((c) => c.id !== 'all').map((cat) => {
                const count = salons.filter((s) => {
                  const blob = [
                    ...s.categories,
                    ...(s.tags || []),
                    ...(s.keywords || []),
                    ...s.services.map((x) => x.name),
                    s.gender,
                    s.name,
                  ]
                    .join(' ')
                    .toLowerCase();
                  return cat.match.some((t) => blob.includes(t));
                }).length;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      patchFilters({ category: cat.id });
                      setSubmitted(true);
                      setFiltersOpen(false);
                    }}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-2xl border bg-white border-outline-variant/50 hover:border-primary/30 hover:shadow-xs transition-all cursor-pointer"
                  >
                    <span className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <span className="material-symbols-outlined text-[24px]">{cat.icon}</span>
                    </span>
                    <span className="text-[12px] font-bold text-on-surface text-center leading-tight">
                      {cat.label}
                    </span>
                    {count > 0 && (
                      <span className="text-[10px] text-on-surface-variant font-medium">
                        {count} shop{count === 1 ? '' : 's'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        </>
      )}

      {/* ================================================================= */}
      {/* Results                                                           */}
      {/* ================================================================= */}
      {(active || submitted) && (
        <section id="search-results-list" className="px-page-margin mb-6">
          {results.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white border border-outline-variant/40 flex flex-col items-center text-center gap-2">
              <span className="material-symbols-outlined text-[36px] text-on-surface-variant">
                search_off
              </span>
              <h3 className="font-card-title text-[16px] font-bold text-on-surface">
                No salons match
              </h3>
              <p className="text-[13px] text-on-surface-variant max-w-sm">
                Try a shorter phrase, another area, or loosen filters like price and distance.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={clearAll}
                  className="px-4 py-2 bg-primary text-white text-[12px] font-bold rounded-xl hover:bg-nexora-pink transition-colors cursor-pointer"
                >
                  Clear search
                </button>
                <button
                  type="button"
                  onClick={() => setFiltersOpen(true)}
                  className="px-4 py-2 border border-outline-variant/60 text-on-surface text-[12px] font-bold rounded-xl hover:border-primary/40 transition-colors cursor-pointer"
                >
                  Adjust filters
                </button>
              </div>
              <div className="mt-4 w-full">
                <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                  Try instead
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {TRENDING_SEARCHES.slice(0, 4).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => applyExample(t)}
                      className="px-3 py-1.5 rounded-full bg-surface-container-low border border-outline-variant/40 text-[11px] font-semibold text-on-surface cursor-pointer hover:border-primary/40"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {results.map(({ salon, fromPrice, matchedService }) => (
                <SearchResultCard
                  key={salon.id}
                  salon={salon}
                  fromPrice={fromPrice}
                  matchedService={matchedService}
                  isSaved={savedSalonIds.includes(salon.id)}
                  onOpen={() => onOpenSalonDetails(salon)}
                  onBook={() => onBookSalon(salon, matchedService || undefined)}
                  onToggleSave={() => onToggleSaveSalon(salon.id)}
                />
              ))}
            </div>
          )}

          {/* Nearby fallback tip when few results */}
          {results.length > 0 && results.length < 3 && (
            <p className="mt-4 text-[12px] text-on-surface-variant text-center">
              Showing the closest matches within{' '}
              {pipeline.filters.maxDistanceKm
                ? `${pipeline.filters.maxDistanceKm} km`
                : `~${Math.ceil(Math.max(...results.map((r) => distanceKm(r.salon)), 1))} km`}
              . Expand distance or clear price filters for more options.
            </p>
          )}
        </section>
      )}

      {/* When idle we already show discover; also offer a quick "show nearby" */}
      {!active && !submitted && (
        <section className="px-page-margin mb-8">
          <button
            type="button"
            id="search-show-nearby-btn"
            onClick={() => {
              setSort('nearest');
              setSortTouched(true);
              setSubmitted(true);
            }}
            className="w-full py-3.5 rounded-2xl border border-dashed border-primary/30 text-primary text-[13px] font-bold hover:bg-primary/5 transition-colors cursor-pointer"
          >
            Show all nearby salons · sorted by distance
          </button>
        </section>
      )}
    </div>
  );
};

export default SearchTab;
