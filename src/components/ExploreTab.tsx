import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Salon, SalonService, Stylist, GroundingChunk } from '../types';
import { searchSalons, suggestQueryCorrections } from '../lib/fuzzySearch';
import { ShareSalonModal } from './ShareSalonModal';

interface ExploreTabProps {
  salons: Salon[];
  currentLocation: string;
  savedSalonIds: string[];
  initialSearchQuery?: string;
  onOpenSalonDetails: (salon: Salon) => void;
  onBookSalon: (salon: Salon, service?: SalonService, stylist?: Stylist) => void;
  onToggleSaveSalon: (salonId: string) => void;
  onShareSalon?: (salon: Salon) => void;
  onOpenAIAdvisor: () => void;
}

export type PriceRangeFilter = 'all' | '1' | '2' | '3';
export type DistanceFilter = 'all' | '1' | '2' | '5' | '10';
export type SortOption = 'recommended' | 'price_asc' | 'price_desc' | 'rating' | 'distance' | 'distance_desc';

export const DISTANCE_TIERS: { id: DistanceFilter; label: string; maxKm: number | null; desc: string; icon: string }[] = [
  { id: 'all', label: 'Anywhere', maxKm: null, desc: 'All distances', icon: 'explore' },
  { id: '1', label: '< 1 km', maxKm: 1.0, desc: 'Walking distance (≤ 1km)', icon: 'directions_walk' },
  { id: '2', label: 'Within 2 km', maxKm: 2.0, desc: 'Quick commute (≤ 2km)', icon: 'near_me' },
  { id: '5', label: 'Within 5 km', maxKm: 5.0, desc: 'Local area (≤ 5km)', icon: 'location_on' },
  { id: '10', label: 'Within 10 km', maxKm: 10.0, desc: 'City-wide (≤ 10km)', icon: 'distance' },
];

const PRICE_TIERS = [
  { id: 'all' as PriceRangeFilter, label: 'All Budgets', symbol: 'All', desc: 'Any budget' },
  { id: '1' as PriceRangeFilter, label: '$ Budget', symbol: '$', rupeeSymbol: '₹', desc: '< ₹500' },
  { id: '2' as PriceRangeFilter, label: '$$ Moderate', symbol: '$$', rupeeSymbol: '₹₹', desc: '₹500 - ₹1.5k' },
  { id: '3' as PriceRangeFilter, label: '$$$ Luxury', symbol: '$$$', rupeeSymbol: '₹₹₹', desc: '₹1.5k+' },
];

export const ExploreTab: React.FC<ExploreTabProps> = ({
  salons,
  currentLocation,
  savedSalonIds,
  initialSearchQuery = '',
  onOpenSalonDetails,
  onBookSalon,
  onToggleSaveSalon,
  onShareSalon,
  onOpenAIAdvisor,
}) => {
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPriceRange, setSelectedPriceRange] = useState<PriceRangeFilter>('all');
  const [selectedDistance, setSelectedDistance] = useState<DistanceFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('recommended');
  const [viewMode, setViewMode] = useState<'list' | 'map' | 'ai_grounded'>('list');
  const [selectedMapSalon, setSelectedMapSalon] = useState<Salon | null>(null);
  const [selectedShareSalon, setSelectedShareSalon] = useState<Salon | null>(null);

  // References for smooth scrolling
  const salonListRef = useRef<HTMLDivElement>(null);
  const isFirstDistanceRender = useRef(true);

  // Smooth scroll helper for salon list
  const scrollToSalonList = (behavior: ScrollBehavior = 'smooth') => {
    if (salonListRef.current) {
      const headerOffset = 95; // Account for fixed top navigation header + breathing space
      const elementPosition = salonListRef.current.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: Math.max(0, offsetPosition),
        behavior,
      });
    }
  };

  // Smoothly scroll to the salon list when users switch between different distance filters
  useEffect(() => {
    if (isFirstDistanceRender.current) {
      isFirstDistanceRender.current = false;
      return;
    }

    scrollToSalonList('smooth');

    // Also center the active distance chip in horizontal view on mobile screens
    if (selectedDistance !== 'all') {
      const chipElement = document.getElementById(`distance-filter-${selectedDistance}`);
      if (chipElement) {
        chipElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [selectedDistance]);

  // Recent searches are ephemeral UI state. Do not persist them in a shared
  // origin where the next account could inherit another user's activity.
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const addRecentSearch = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter((item) => item.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...filtered].slice(0, 3);
      return updated;
    });
  };

  const handleSelectRecentQuery = (query: string) => {
    setSearchQuery(query);
    addRecentSearch(query);
    handlePerformGroundedSearch(query);
  };

  const handleClearRecentSearches = () => {
    setRecentSearches([]);
  };

  // Grounded search state
  const [isSearchingGrounded, setIsSearchingGrounded] = useState(false);
  const [groundedSummary, setGroundedSummary] = useState<string | null>(null);
  const [groundingChunks, setGroundingChunks] = useState<GroundingChunk[]>([]);
  const [groundedError, setGroundedError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const categories = [
    { id: 'all', label: 'All Services' },
    { id: 'hair', label: 'Hair Cut & Styling' },
    { id: 'skin', label: 'Hydra Facial & Skin' },
    { id: 'spa', label: 'Spa & Wellness' },
    { id: 'nails', label: 'Nails & Art' },
    { id: 'grooming', label: 'Beard & Men' },
  ];

  const getPriceTierForSalon = (priceRange: string): '1' | '2' | '3' => {
    if (priceRange === '$' || priceRange === '₹') return '1';
    if (priceRange === '$$' || priceRange === '₹₹') return '2';
    if (priceRange === '$$$' || priceRange === '₹₹₹' || priceRange === '₹₹₹₹') return '3';
    return '2';
  };

  const getPriceTierDisplay = (priceRange: string): { label: string; badge: string; color: string } => {
    const tier = getPriceTierForSalon(priceRange);
    switch (tier) {
      case '1':
        return { label: 'Budget-Friendly', badge: '$ · ₹', color: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' };
      case '2':
        return { label: 'Moderate Value', badge: '$$ · ₹₹', color: 'bg-primary/10 text-primary border-primary/20' };
      case '3':
        return { label: 'Luxury & Premium', badge: '$$$ · ₹₹₹', color: 'bg-amber-500/10 text-amber-700 border-amber-500/20' };
      default:
        return { label: 'Standard', badge: '$$', color: 'bg-primary/10 text-primary border-primary/20' };
    }
  };

  const getMinStartingPrice = (salon: Salon): number => {
    if (!salon.services || salon.services.length === 0) return 399;
    return Math.min(...salon.services.map((s) => s.discountPrice || s.price));
  };

  const handlePerformGroundedSearch = async (queryToUse?: string) => {
    const q = queryToUse !== undefined ? queryToUse : searchQuery;
    setIsSearchingGrounded(true);
    setHasSearched(true);
    setGroundedError(null);

    try {
      const res = await fetch('/api/salons/grounded-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          areaName: currentLocation,
          category: selectedCategory !== 'all' ? selectedCategory : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setGroundedSummary(null);
        setGroundingChunks([]);
        setGroundedError(data.error || 'Verified search is temporarily unavailable.');
      } else {
        setGroundedSummary(data.text || null);
        setGroundingChunks(data.groundingChunks || []);
        setGroundedError(null);
        if (data.groundingChunks?.length > 0 || data.text) {
          setViewMode('ai_grounded');
        }
      }
    } catch (err) {
      console.error('[Nexora] Failed to run grounded search:', err);
      setGroundedError('Network error while loading verified search results.');
    } finally {
      setIsSearchingGrounded(false);
    }
  };

  useEffect(() => {
    if (initialSearchQuery) {
      setSearchQuery(initialSearchQuery);
      addRecentSearch(initialSearchQuery);
      handlePerformGroundedSearch(initialSearchQuery);
    }
  }, [initialSearchQuery]);

  const getSalonDistanceKm = (salon: Salon): number => {
    if (!salon.distance) return 999;
    const parsed = parseFloat(salon.distance.replace(/[^0-9.]/g, ''));
    return isNaN(parsed) ? 999 : parsed;
  };

  // ---------------------------------------------------------------------
  // Fuzzy search: typo-tolerant ("barbar" -> "barber"), multi-word capable
  // ("beard trim" matches across categories AND service names), ranked by
  // relevancy. Unknown tokens like "shop" never zero out the results.
  // ---------------------------------------------------------------------
  const hasSearchQuery = searchQuery.trim().length > 0;

  const relevanceById = useMemo(() => {
    if (!hasSearchQuery) return new Map<string, number>();
    return new Map(searchSalons(salons, searchQuery).map((result) => [result.salon.id, result.score]));
  }, [salons, searchQuery, hasSearchQuery]);

  const matchesQuery = (salon: Salon): boolean => !hasSearchQuery || relevanceById.has(salon.id);

  // Compute salon match counts per price tier for the current category, distance & search filter
  const getCountForTier = (tierId: PriceRangeFilter) => {
    const maxDistKm = DISTANCE_TIERS.find((d) => d.id === selectedDistance)?.maxKm;
    return salons.filter((s) => {
      const matchesCategory =
        selectedCategory === 'all' ||
        s.services.some((srv) => srv.category === selectedCategory) ||
        s.categories.some((c) => c.toLowerCase().includes(selectedCategory.toLowerCase()));

      const distKm = getSalonDistanceKm(s);
      const matchesDistance = maxDistKm === null || distKm <= maxDistKm;

      if (tierId === 'all') return matchesCategory && matchesQuery(s) && matchesDistance;
      return matchesCategory && matchesQuery(s) && matchesDistance && getPriceTierForSalon(s.priceRange) === tierId;
    }).length;
  };

  // Compute salon match counts per distance tier for the current category, price & search filter
  const getCountForDistance = (distanceId: DistanceFilter) => {
    const maxDistKm = DISTANCE_TIERS.find((d) => d.id === distanceId)?.maxKm;
    return salons.filter((s) => {
      const matchesCategory =
        selectedCategory === 'all' ||
        s.services.some((srv) => srv.category === selectedCategory) ||
        s.categories.some((c) => c.toLowerCase().includes(selectedCategory.toLowerCase()));

      const salonTier = getPriceTierForSalon(s.priceRange);
      const matchesPrice = selectedPriceRange === 'all' || salonTier === selectedPriceRange;

      const distKm = getSalonDistanceKm(s);
      const matchesDist = maxDistKm === null || distKm <= maxDistKm;

      return matchesCategory && matchesQuery(s) && matchesPrice && matchesDist;
    }).length;
  };

  const filteredSalons = salons
    .filter((s) => {
      const matchesCategory =
        selectedCategory === 'all' ||
        s.services.some((srv) => srv.category === selectedCategory) ||
        s.categories.some((c) => c.toLowerCase().includes(selectedCategory.toLowerCase()));

      const salonTier = getPriceTierForSalon(s.priceRange);
      const matchesPrice = selectedPriceRange === 'all' || salonTier === selectedPriceRange;

      const distKm = getSalonDistanceKm(s);
      const maxDistKm = DISTANCE_TIERS.find((d) => d.id === selectedDistance)?.maxKm;
      const matchesDistance = maxDistKm === null || distKm <= maxDistKm;

      return matchesCategory && matchesQuery(s) && matchesPrice && matchesDistance;
    })
    .sort((a, b) => {
      // With an active search, "Recommended" orders by fuzzy relevancy first.
      if (hasSearchQuery && sortBy === 'recommended') {
        const relevanceDiff = (relevanceById.get(b.id) ?? 0) - (relevanceById.get(a.id) ?? 0);
        if (relevanceDiff !== 0) return relevanceDiff;
        return b.rating - a.rating;
      }
      if (sortBy === 'price_asc') {
        return getMinStartingPrice(a) - getMinStartingPrice(b);
      }
      if (sortBy === 'price_desc') {
        return getMinStartingPrice(b) - getMinStartingPrice(a);
      }
      if (sortBy === 'rating') {
        return b.rating - a.rating;
      }
      if (sortBy === 'distance') {
        const distA = getSalonDistanceKm(a);
        const distB = getSalonDistanceKm(b);
        return distA - distB;
      }
      if (sortBy === 'distance_desc') {
        const distA = getSalonDistanceKm(a);
        const distB = getSalonDistanceKm(b);
        return distB - distA;
      }
      return 0; // Default recommended
    });

  // "Did you mean" fallback for queries that matched nothing at all.
  const searchSuggestions = useMemo(() => {
    if (!hasSearchQuery || filteredSalons.length > 0) return [];
    return suggestQueryCorrections(salons, searchQuery);
  }, [salons, searchQuery, hasSearchQuery, filteredSalons.length]);

  const isFiltered =
    selectedCategory !== 'all' ||
    selectedPriceRange !== 'all' ||
    selectedDistance !== 'all' ||
    searchQuery.trim().length > 0;

  const handleResetFilters = () => {
    setSelectedCategory('all');
    setSelectedPriceRange('all');
    setSelectedDistance('all');
    setSearchQuery('');
    setSortBy('recommended');
  };

  return (
    <div className="flex flex-col w-full pb-28 max-w-4xl mx-auto px-page-margin pt-3">
      {/* Top Search & Filter Bar */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3.5 top-3 text-[#b00055] text-[19px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (searchQuery.trim()) addRecentSearch(searchQuery);
                  handlePerformGroundedSearch();
                }
              }}
              placeholder="Search salons, services or Google Maps place..."
              className="w-full h-11 pl-10 pr-9 bg-white/72 backdrop-blur-[20px] text-on-surface rounded-[18px] text-[13px] border border-[rgba(180,0,80,0.10)] shadow-[0_8px_25px_rgba(0,0,0,0.05)] focus:outline-none focus:border-[rgba(176,0,85,0.35)] focus:ring-4 focus:ring-[rgba(176,0,85,0.06)] transition-all duration-200"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setGroundedSummary(null);
                  setGroundingChunks([]);
                }}
                className="absolute right-3 top-3 text-on-surface-variant hover:text-[#b00055] transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </div>
        </div>

        {/* 3 Most Recent Search Queries Clickable Chips */}
        {recentSearches.length > 0 && (
          <div id="recent-searches-bar" className="flex items-center gap-1.5 flex-wrap pt-0.5">
            <div className="flex items-center gap-1 text-[11px] font-bold text-[#b00055] uppercase tracking-wider shrink-0 mr-1">
              <span className="material-symbols-outlined text-[14px]">history</span>
              <span>Recent:</span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {recentSearches.slice(0, 3).map((query, index) => {
                const isSelected = searchQuery.trim().toLowerCase() === query.trim().toLowerCase();
                return (
                  <button
                    key={`${query}-${index}`}
                    id={`recent-search-chip-${index}`}
                    type="button"
                    onClick={() => handleSelectRecentQuery(query)}
                    className={`group h-8 px-3.5 rounded-full text-[11px] font-medium flex items-center gap-1.5 transition-all cursor-pointer backdrop-blur-[12px] ${
                      isSelected
                        ? 'bg-[#b00055] text-white font-bold shadow-xs border border-[#b00055]'
                        : 'bg-white/68 border border-[rgba(176,0,85,0.10)] text-on-surface hover:-translate-y-0.5 hover:border-[rgba(176,0,85,0.25)] hover:shadow-xs'
                    }`}
                    title={`Click to search "${query}"`}
                  >
                    <span className={`material-symbols-outlined text-[14px] ${isSelected ? 'text-white' : 'text-[#b00055]/80 group-hover:text-[#b00055]'}`}>
                      history
                    </span>
                    <span className="truncate max-w-[130px] sm:max-w-[200px]">{query}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleClearRecentSearches}
              className="text-[11px] font-semibold text-[#b00055] hover:opacity-70 transition-opacity ml-auto cursor-pointer"
              title="Clear recent searches"
            >
              Clear
            </button>
          </div>
        )}

        {/* View Mode Toggle & Location */}
        <div className="flex items-center justify-between">
          <div className="flex bg-surface-container-low p-1 rounded-xl border border-outline-variant/40">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold flex items-center gap-1 transition-all ${
                viewMode === 'list'
                  ? 'bg-white text-primary shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">view_list</span>
              <span>List ({filteredSalons.length})</span>
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold flex items-center gap-1 transition-all ${
                viewMode === 'map'
                  ? 'bg-white text-primary shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">map</span>
              <span>Map View</span>
            </button>
            <button
              onClick={() => {
                if (!groundedSummary && !isSearchingGrounded) {
                  handlePerformGroundedSearch();
                }
                setViewMode('ai_grounded');
              }}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold flex items-center gap-1 transition-all ${
                viewMode === 'ai_grounded'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-nexora-pink hover:bg-surface-container'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
              <span>AI & Maps Grounding</span>
            </button>
          </div>

          <span className="text-[12px] text-on-surface-variant font-medium hidden sm:inline">
            📍 {currentLocation}
          </span>
        </div>

        {/* Category Horizontal Scroll */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-all border ${
                selectedCategory === cat.id
                  ? 'bg-primary text-white border-primary font-semibold shadow-xs'
                  : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/40 hover:bg-surface-container'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Filters & Sorting Panel */}
        <div className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/40 flex flex-col gap-2.5 shadow-2xs">
          {/* Top Filter Row: Distance Filter & Dropdown Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
            {/* Distance / Radius Filter */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex items-center gap-1 text-[11px] font-bold text-on-surface uppercase tracking-wider mr-1">
                <span className="material-symbols-outlined text-[16px] text-nexora-pink">near_me</span>
                <span>Distance:</span>
              </div>

              <div className="flex items-center gap-1 flex-wrap">
                {DISTANCE_TIERS.map((tier) => {
                  const count = getCountForDistance(tier.id);
                  const isSelected = selectedDistance === tier.id;

                  return (
                    <button
                      key={tier.id}
                      id={`distance-filter-${tier.id}`}
                      type="button"
                      onClick={() => setSelectedDistance(isSelected && tier.id !== 'all' ? 'all' : tier.id)}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 transition-all border ${
                        isSelected
                          ? 'bg-primary text-white border-primary shadow-xs'
                          : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/30 hover:bg-surface-container hover:text-on-surface'
                      }`}
                      title={tier.desc}
                    >
                      <span className="material-symbols-outlined text-[13px]">
                        {tier.icon}
                      </span>
                      <span>{tier.label}</span>
                      <span
                        className={`text-[9px] px-1 py-0.2 rounded-full font-bold ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-surface-container text-on-surface-variant'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Select Dropdowns & Reset */}
            <div className="flex items-center gap-2 self-start lg:self-auto shrink-0 flex-wrap">
              {/* Distance Quick Dropdown */}
              <div className="flex items-center gap-1 bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-2 py-1">
                <span className="material-symbols-outlined text-[15px] text-primary">distance</span>
                <select
                  id="salon-distance-select"
                  value={selectedDistance}
                  onChange={(e) => setSelectedDistance(e.target.value as DistanceFilter)}
                  aria-label="Filter salons by distance"
                  className="bg-transparent text-[11px] font-semibold text-on-surface focus:outline-none cursor-pointer"
                >
                  {DISTANCE_TIERS.map((tier) => (
                    <option key={tier.id} value={tier.id}>
                      {tier.label} ({getCountForDistance(tier.id)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort By Dropdown */}
              <div className="flex items-center gap-1 bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-2 py-1">
                <span className="material-symbols-outlined text-[15px] text-on-surface-variant">swap_vert</span>
                <select
                  id="salon-sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  aria-label="Sort salons by"
                  className="bg-transparent text-[11px] font-semibold text-on-surface focus:outline-none cursor-pointer"
                >
                  <option value="recommended">Recommended</option>
                  <option value="distance">Distance: Closest First 📍</option>
                  <option value="distance_desc">Distance: Farthest First</option>
                  <option value="rating">Top Rated (★)</option>
                  <option value="price_asc">Price: Low to High ($ → $$$)</option>
                  <option value="price_desc">Price: High to Low ($$$ → $)</option>
                </select>
              </div>

              {/* Distance Quick Toggle Button */}
              <button
                id="distance-sort-quick-toggle"
                type="button"
                onClick={() => setSortBy((prev) => (prev === 'distance' ? 'recommended' : 'distance'))}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-all border cursor-pointer ${
                  sortBy === 'distance' || sortBy === 'distance_desc'
                    ? 'bg-primary text-white border-primary shadow-xs'
                    : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/30 hover:bg-surface-container hover:text-on-surface'
                }`}
                title="Toggle distance sorting (Closest to Farthest)"
              >
                <span className="material-symbols-outlined text-[14px]">near_me</span>
                <span>{sortBy === 'distance' ? 'Closest First ✓' : sortBy === 'distance_desc' ? 'Farthest First' : 'Sort by Distance'}</span>
              </button>

              {isFiltered && (
                <button
                  id="clear-all-filters-btn"
                  onClick={handleResetFilters}
                  className="text-[11px] font-semibold text-nexora-pink hover:underline flex items-center gap-0.5 py-1 px-1.5"
                  title="Clear all active filters"
                >
                  <span className="material-symbols-outlined text-[13px]">filter_alt_off</span>
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* Budget / Price Range Filter Row */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1.5 border-t border-outline-variant/25">
            <div className="flex items-center gap-1 text-[11px] font-bold text-on-surface uppercase tracking-wider mr-1">
              <span className="material-symbols-outlined text-[16px] text-nexora-pink">payments</span>
              <span>Budget:</span>
            </div>

            <div className="flex items-center gap-1 flex-wrap">
              {PRICE_TIERS.map((tier) => {
                const count = getCountForTier(tier.id);
                const isSelected = selectedPriceRange === tier.id;

                return (
                  <button
                    key={tier.id}
                    id={`price-filter-${tier.id}`}
                    type="button"
                    onClick={() => setSelectedPriceRange(isSelected && tier.id !== 'all' ? 'all' : tier.id)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 transition-all border ${
                      isSelected
                        ? 'bg-primary text-white border-primary shadow-xs'
                        : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/30 hover:bg-surface-container hover:text-on-surface'
                    }`}
                    title={tier.desc}
                  >
                    <span>{tier.label}</span>
                    <span
                      className={`text-[9px] px-1 py-0.2 rounded-full font-bold ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-surface-container text-on-surface-variant'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Main View Area */}
      {viewMode === 'ai_grounded' && (
        <div className="flex flex-col gap-4 mb-6 animate-in fade-in duration-200">
          <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3 border-b border-outline-variant/40 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-nexora-pink text-[22px]">google_pin</span>
                <div>
                  <h3 className="font-card-title text-[15px] font-bold text-on-surface">
                    Live Google Maps Grounded Results
                  </h3>
                  <p className="text-[11px] text-on-surface-variant">
                    Verified real-time intelligence for {currentLocation}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handlePerformGroundedSearch()}
                disabled={isSearchingGrounded}
                className="text-[12px] text-nexora-pink font-semibold flex items-center gap-1 hover:underline"
              >
                <span className="material-symbols-outlined text-[14px]">refresh</span>
                <span>Re-query</span>
              </button>
            </div>

            {isSearchingGrounded ? (
              <div className="py-8 flex flex-col items-center justify-center text-center gap-2">
                <div className="w-8 h-8 border-3 border-nexora-pink/30 border-t-nexora-pink rounded-full animate-spin" />
                <p className="text-[12px] text-on-surface-variant">
                  Retrieving live Google Maps data and ratings in {currentLocation}...
                </p>
              </div>
            ) : (
              <div>
                {groundedError ? (
                  <p role="alert" className="text-[13px] leading-relaxed text-amber-900 bg-amber-50 p-3 rounded-xl border border-amber-300 mb-4">
                    {groundedError}
                  </p>
                ) : groundedSummary ? (
                  <div className="text-[13px] leading-relaxed text-on-surface whitespace-pre-line mb-4 bg-white/70 p-3 rounded-xl border border-outline-variant/30">
                    {groundedSummary}
                  </div>
                ) : (
                  <p className="text-[13px] text-on-surface-variant py-2">
                    Click "Ground with Maps" to fetch verified nearby salon details directly via Google Maps Grounding.
                  </p>
                )}

                {/* Grounding Place Links & Reviews */}
                {groundingChunks && groundingChunks.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <h4 className="text-[12px] font-bold uppercase tracking-wider text-on-surface-variant">
                      Grounded Maps Sources & Reviews
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {groundingChunks.map((chunk, i) => {
                        const title = chunk.maps?.title || chunk.web?.title || `Google Maps Place #${i + 1}`;
                        const url = chunk.maps?.uri || chunk.web?.uri;
                        const snippet = chunk.maps?.placeAnswerSources?.reviewSnippets?.[0]?.snippet;

                        return (
                          <div
                            key={i}
                            className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/40 flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-semibold text-[13px] text-on-surface truncate">{title}</span>
                                <span className="material-symbols-outlined text-nexora-pink text-[16px]">verified</span>
                              </div>
                              {snippet && (
                                <p className="text-[11px] text-on-surface-variant italic mb-2 line-clamp-2">
                                  "{snippet}"
                                </p>
                              )}
                            </div>
                            {url && (
                              <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-nexora-pink font-semibold flex items-center gap-1 hover:underline mt-1"
                              >
                                <span>Open in Google Maps</span>
                                <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {viewMode === 'map' && (
        <div className="flex flex-col gap-3 mb-6 animate-in fade-in duration-200">
          {/* Interactive Visual Map Stage */}
          <div className="relative w-full h-[380px] bg-[#e8ece9] rounded-2xl overflow-hidden border border-outline-variant/50 shadow-inner relative">
            {/* Map background grid */}
            <div 
              className="absolute inset-0 opacity-40"
              style={{
                backgroundImage: 'radial-gradient(#8c7074 1px, transparent 1px), radial-gradient(#8c7074 1px, #e8ece9 1px)',
                backgroundSize: '24px 24px',
                backgroundPosition: '0 0, 12px 12px',
              }}
            />

            {/* Map Roads / Geometry Decoration */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-50" xmlns="http://www.w3.org/2000/svg">
              <path d="M 0 100 Q 150 120 300 80 T 600 150 T 900 120" fill="none" stroke="#ffffff" strokeWidth="12" />
              <path d="M 120 0 Q 140 200 180 400" fill="none" stroke="#ffffff" strokeWidth="8" />
              <path d="M 320 0 Q 280 200 340 400" fill="none" stroke="#ffffff" strokeWidth="10" />
              <circle cx="200" cy="180" r="14" fill="#a30046" fillOpacity="0.15" />
            </svg>

            {/* Center User Location Pin */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none z-10">
              <div className="w-4 h-4 rounded-full bg-nexora-pink ring-4 ring-nexora-pink/30 animate-pulse" />
              <span className="text-[10px] font-bold bg-white/90 px-1.5 py-0.2 rounded shadow-xs text-on-surface mt-1">
                You ({currentLocation.split(',')[0]})
              </span>
            </div>

            {/* Salon Map Markers */}
            {filteredSalons.map((s, index) => {
              // Distribute pins pleasantly on the canvas
              const positions = [
                { top: '28%', left: '35%' },
                { top: '65%', left: '68%' },
                { top: '30%', left: '72%' },
                { top: '75%', left: '25%' },
                { top: '20%', left: '18%' },
              ];
              const pos = positions[index % positions.length];
              const isSelected = selectedMapSalon?.id === s.id;

              return (
                <div
                  key={s.id}
                  style={{ top: pos.top, left: pos.left }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 z-20 cursor-pointer group"
                  onClick={() => setSelectedMapSalon(s)}
                >
                  <div
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold shadow-md transition-all ${
                      isSelected
                        ? 'bg-primary text-white scale-110 ring-2 ring-white'
                        : 'bg-white text-on-surface hover:bg-surface-container-high'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px] text-nexora-pink">content_cut</span>
                    <span className="truncate max-w-[90px]">{s.name.split(' ')[0]}</span>
                    <span className="text-[10px] text-warning-amber">★{s.rating}</span>
                    <span className="text-[9px] text-on-surface-variant font-mono">{s.priceRange}</span>
                  </div>
                </div>
              );
            })}

            {/* Map Controls */}
            <div className="absolute bottom-3 right-3 flex flex-col gap-1.5 z-20">
              <button
                onClick={() => setSelectedMapSalon(filteredSalons[0])}
                className="w-8 h-8 rounded-lg bg-white/90 text-on-surface shadow-md flex items-center justify-center text-[14px] font-bold hover:bg-white"
              >
                +
              </button>
              <button
                onClick={() => setSelectedMapSalon(null)}
                className="w-8 h-8 rounded-lg bg-white/90 text-on-surface shadow-md flex items-center justify-center text-[14px] font-bold hover:bg-white"
              >
                −
              </button>
            </div>
          </div>

          {/* Selected Salon Preview Box */}
          {selectedMapSalon ? (
            <div className="p-3.5 bg-surface-container-low border border-outline-variant rounded-2xl flex items-center justify-between gap-3 shadow-sm animate-in slide-in-from-bottom-2 duration-150">
              <img
                src={selectedMapSalon.image}
                alt={selectedMapSalon.name}
                className="w-16 h-16 rounded-xl object-cover"
              />
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-[14px] text-on-surface truncate">{selectedMapSalon.name}</h4>
                <p className="text-[11px] text-on-surface-variant">{selectedMapSalon.location.area} · {selectedMapSalon.distance}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] font-bold text-warning-amber">★ {selectedMapSalon.rating}</span>
                  <span className="text-[10px] bg-primary/10 text-primary font-bold px-1.5 py-0.2 rounded border border-primary/20">
                    {selectedMapSalon.priceRange}
                  </span>
                  <span className="text-[10px] bg-success-emerald text-white px-1.5 py-0.2 rounded font-bold uppercase">
                    {selectedMapSalon.isOpen ? 'Open' : 'Closed'}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                <button
                  onClick={() => onBookSalon(selectedMapSalon)}
                  className="px-3 py-1.5 bg-primary text-white text-[12px] font-semibold rounded-lg hover:bg-nexora-pink transition-colors"
                >
                  Book
                </button>
                <button
                  onClick={() => onOpenSalonDetails(selectedMapSalon)}
                  className="px-3 py-1.5 bg-surface-container text-on-surface text-[11px] font-medium rounded-lg"
                >
                  Details
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onShareSalon) {
                      onShareSalon(selectedMapSalon);
                    } else {
                      setSelectedShareSalon(selectedMapSalon);
                    }
                  }}
                  className="px-3 py-1 bg-surface-container text-on-surface text-[11px] font-medium rounded-lg flex items-center justify-center gap-1 hover:bg-surface-container-high transition-colors cursor-pointer"
                  title="Share Salon"
                >
                  <span className="material-symbols-outlined text-[13px]">share</span>
                  <span>Share</span>
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-center text-on-surface-variant">
              Tap any pin above to view salon details, distance and instant booking slots.
            </p>
          )}
        </div>
      )}

      {/* Salons Grid / List with Smooth Scroll Reference */}
      <div
        ref={salonListRef}
        id="salon-results-section"
        className="scroll-mt-24 transition-all duration-300"
      >
        {/* Distance Sorting & Results Summary Toggle Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 mb-3 bg-surface-container-low border border-outline-variant/40 p-3 rounded-2xl shadow-2xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-card-title text-[14px] font-bold text-on-surface">
              {filteredSalons.length} {filteredSalons.length === 1 ? 'Salon' : 'Salons'} Found
            </span>
            {sortBy === 'distance' && (
              <span className="text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">near_me</span>
                Closest to Farthest
              </span>
            )}
            {sortBy === 'distance_desc' && (
              <span className="text-[10px] font-bold bg-surface-container-high text-on-surface border border-outline-variant/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">distance</span>
                Farthest First
              </span>
            )}
          </div>

          {/* Dedicated Distance Sorting Toggle Buttons */}
          <div className="flex items-center gap-1 bg-surface-container-lowest border border-outline-variant/30 p-1 rounded-xl shrink-0 w-full sm:w-auto justify-between sm:justify-start">
            <span className="text-[11px] text-on-surface-variant font-medium px-1.5 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-primary">navigation</span>
              <span>Distance Sort:</span>
            </span>

            <div className="flex items-center gap-1">
              <button
                id="distance-sort-closest-btn"
                type="button"
                onClick={() => setSortBy(sortBy === 'distance' ? 'recommended' : 'distance')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  sortBy === 'distance'
                    ? 'bg-primary text-white shadow-2xs'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}
                title="Order salon results from closest to farthest relative to your location"
              >
                <span className="material-symbols-outlined text-[13px]">south</span>
                <span>Closest First</span>
              </button>

              <button
                id="distance-sort-farthest-btn"
                type="button"
                onClick={() => setSortBy(sortBy === 'distance_desc' ? 'recommended' : 'distance_desc')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  sortBy === 'distance_desc'
                    ? 'bg-primary text-white shadow-2xs'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}
                title="Order salon results from farthest to closest"
              >
                <span className="material-symbols-outlined text-[13px]">north</span>
                <span>Farthest First</span>
              </button>
            </div>
          </div>
        </div>

        {/* Active Distance Filter Badge indicator */}
        {selectedDistance !== 'all' && (
          <div className="flex items-center justify-between bg-primary/8 border border-primary/20 rounded-2xl px-3.5 py-2.5 mb-3 text-[12px] text-primary shadow-2xs animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center gap-2 font-medium">
              <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[13px]">near_me</span>
              </div>
              <span>
                Showing salons {DISTANCE_TIERS.find((d) => d.id === selectedDistance)?.desc} ({filteredSalons.length} results)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDistance('all')}
              className="text-[11px] font-bold text-nexora-pink hover:underline cursor-pointer flex items-center gap-0.5"
              title="Clear distance filter"
            >
              <span>Show All Distances</span>
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          </div>
        )}

        {filteredSalons.length === 0 ? (
          <div className="p-8 rounded-2xl bg-surface-container-low border border-outline-variant/40 flex flex-col items-center justify-center text-center gap-3 my-2">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">
                {selectedDistance !== 'all' ? 'near_me_disabled' : 'filter_alt_off'}
              </span>
            </div>
            {/* Typo-tolerant fallback: closest catalog terms for the failed query */}
            {searchSuggestions.length > 0 && (
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-[12px] text-on-surface-variant">Did you mean:</span>
                <div className="flex items-center gap-1.5 flex-wrap justify-center">
                  {searchSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setSearchQuery(suggestion)}
                      className="px-3 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-primary text-[12px] font-semibold hover:bg-primary/20 transition-colors cursor-pointer"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <h3 className="font-card-title text-[16px] font-bold text-on-surface">
                {selectedDistance !== 'all' && selectedPriceRange !== 'all'
                  ? 'No Salons Found in this Distance & Budget Range'
                  : selectedDistance !== 'all'
                  ? `No Salons Found ${DISTANCE_TIERS.find((t) => t.id === selectedDistance)?.label}`
                  : selectedPriceRange !== 'all'
                  ? 'No Salons Found in this Budget Tier'
                  : 'No Salons Match Your Search'}
              </h3>
              <p className="text-[12px] text-on-surface-variant mt-1 max-w-md">
                {selectedDistance !== 'all'
                  ? `No salons currently match your distance constraint (${DISTANCE_TIERS.find((t) => t.id === selectedDistance)?.label}). Try expanding your distance filter to "Within 5 km" or "Anywhere" to discover more local options.`
                  : selectedPriceRange !== 'all'
                  ? `No salons currently match ${PRICE_TIERS.find((t) => t.id === selectedPriceRange)?.label} (${PRICE_TIERS.find((t) => t.id === selectedPriceRange)?.desc}). Try selecting a different budget tier or clearing your filters.`
                  : 'No salons match your search query or category filter. Try a different spelling, a broader term (e.g. "hair" or "beard"), or clear filters to see all available salons.'}
              </p>
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap justify-center">
              {selectedDistance !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSelectedDistance('all')}
                  className="px-4 py-2 bg-primary text-white text-[12px] font-bold rounded-xl hover:bg-nexora-pink transition-colors shadow-xs flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">explore</span>
                  <span>Search Anywhere (All Distances)</span>
                </button>
              )}
              {selectedPriceRange !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSelectedPriceRange('all')}
                  className="px-4 py-2 bg-primary/90 text-white text-[12px] font-bold rounded-xl hover:bg-nexora-pink transition-colors shadow-xs"
                >
                  View All Budgets
                </button>
              )}
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-4 py-2 bg-surface-container text-on-surface text-[12px] font-semibold rounded-xl hover:bg-surface-container-high transition-colors"
              >
                Reset All Filters
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5 transition-all duration-300">
            {filteredSalons.map((salon) => {
              const isSaved = savedSalonIds.includes(salon.id);
              const priceInfo = getPriceTierDisplay(salon.priceRange);
              const minPrice = getMinStartingPrice(salon);

              return (
                <div
                  key={salon.id}
                  className="bg-surface-container-low border border-outline-variant rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs hover:shadow-md transition-all duration-200"
                >
                <div className="flex items-center gap-3.5 w-full sm:w-auto">
                  <img
                    src={salon.image}
                    alt={salon.name}
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover shrink-0 cursor-pointer"
                    onClick={() => onOpenSalonDetails(salon)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3
                        onClick={() => onOpenSalonDetails(salon)}
                        className="font-card-title text-[16px] font-bold text-on-surface hover:text-nexora-pink cursor-pointer transition-colors truncate"
                      >
                        {salon.name}
                      </h3>
                      <button
                        onClick={() => onToggleSaveSalon(salon.id)}
                        className="text-nexora-pink hover:scale-110 transition-transform"
                        aria-label="Save salon"
                      >
                        <span className={`material-symbols-outlined text-[18px] ${isSaved ? 'fill-1' : ''}`}>
                          favorite
                        </span>
                      </button>
                      <button
                        id={`salon-share-header-btn-${salon.id}`}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onShareSalon) {
                            onShareSalon(salon);
                          } else {
                            setSelectedShareSalon(salon);
                          }
                        }}
                        className="text-on-surface-variant hover:text-nexora-pink hover:scale-110 transition-all cursor-pointer"
                        title="Share Salon"
                        aria-label={`Share ${salon.name}`}
                      >
                        <span className="material-symbols-outlined text-[18px]">share</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2 text-[12px] text-on-surface-variant mb-1 flex-wrap">
                      <span className="flex items-center gap-0.5 font-bold text-warning-amber">
                        <span className="material-symbols-outlined text-[14px] fill-1">star</span>
                        {salon.rating}
                      </span>
                      <span>·</span>
                      <span>{salon.location.area}</span>
                      <span>·</span>
                      <span className="font-semibold text-primary">{salon.distance}</span>
                      <span>·</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${priceInfo.color}`}
                        title={priceInfo.label}
                      >
                        {salon.priceRange} · {priceInfo.label.split(' ')[0]}
                      </span>
                    </div>

                    <p className="text-[11px] text-on-surface-variant line-clamp-1 mb-2">
                      {salon.categories.join(' · ')}
                    </p>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-on-surface">
                        From ₹{minPrice}
                      </span>
                      {salon.discountOffer && (
                        <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.2 rounded">
                          Offer
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-outline-variant/30">
                  <button
                    id={`salon-share-action-btn-${salon.id}`}
                    type="button"
                    onClick={() => {
                      if (onShareSalon) {
                        onShareSalon(salon);
                      } else {
                        setSelectedShareSalon(salon);
                      }
                    }}
                    className="p-2 bg-surface-container text-on-surface-variant hover:text-nexora-pink rounded-xl hover:bg-surface-container-high transition-colors cursor-pointer"
                    title="Share Salon"
                    aria-label="Share Salon"
                  >
                    <span className="material-symbols-outlined text-[18px]">share</span>
                  </button>
                  {salon.location.mapsUrl && (
                    <a
                      href={salon.location.mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 bg-surface-container text-nexora-pink rounded-xl hover:bg-surface-container-high transition-colors"
                      title="Google Maps"
                    >
                      <span className="material-symbols-outlined text-[18px]">directions</span>
                    </a>
                  )}
                  <button
                    onClick={() => onOpenSalonDetails(salon)}
                    className="px-3.5 py-2 bg-surface-container text-on-surface text-[12px] font-semibold rounded-xl hover:bg-surface-container-high transition-colors"
                  >
                    Menu
                  </button>
                  <button
                    onClick={() => onBookSalon(salon)}
                    className="px-4 py-2 bg-primary text-white text-[12px] font-bold rounded-xl hover:bg-nexora-pink transition-colors shadow-xs"
                  >
                    Book
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>

      {/* Share Salon Modal for Explore Tab */}
      <ShareSalonModal
        isOpen={!!selectedShareSalon}
        onClose={() => setSelectedShareSalon(null)}
        salon={selectedShareSalon}
      />
    </div>
  );
};
