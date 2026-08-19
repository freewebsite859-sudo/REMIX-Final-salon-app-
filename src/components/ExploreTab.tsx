import React, { useState, useEffect } from 'react';
import { Salon, SalonService, Stylist, GroundingChunk } from '../types';

interface ExploreTabProps {
  salons: Salon[];
  currentLocation: string;
  savedSalonIds: string[];
  initialSearchQuery?: string;
  onOpenSalonDetails: (salon: Salon) => void;
  onBookSalon: (salon: Salon, service?: SalonService, stylist?: Stylist) => void;
  onToggleSaveSalon: (salonId: string) => void;
  onOpenAIAdvisor: () => void;
}

export type PriceRangeFilter = 'all' | '1' | '2' | '3';
export type SortOption = 'recommended' | 'price_asc' | 'price_desc' | 'rating' | 'distance';

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
  onOpenAIAdvisor,
}) => {
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPriceRange, setSelectedPriceRange] = useState<PriceRangeFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('recommended');
  const [viewMode, setViewMode] = useState<'list' | 'map' | 'ai_grounded'>('list');
  const [selectedMapSalon, setSelectedMapSalon] = useState<Salon | null>(null);

  // Recent Searches state (Stores top recent searches, displays up to 3)
  const DEFAULT_RECENT_QUERIES = ['Hydra Facial', 'Hair Cut & Styling', 'Mansarovar'];
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('nexora_recent_searches');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter((q): q is string => typeof q === 'string' && q.trim() !== '');
          if (valid.length > 0) return valid.slice(0, 3);
        }
      }
    } catch (e) {
      console.error('Error reading recent searches from localStorage:', e);
    }
    return DEFAULT_RECENT_QUERIES;
  });

  const addRecentSearch = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter((item) => item.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...filtered].slice(0, 3);
      try {
        localStorage.setItem('nexora_recent_searches', JSON.stringify(updated));
      } catch (e) {
        console.error('Error saving recent searches:', e);
      }
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
    try {
      localStorage.removeItem('nexora_recent_searches');
    } catch (e) {
      console.error('Error clearing recent searches:', e);
    }
  };

  // Grounded search state
  const [isSearchingGrounded, setIsSearchingGrounded] = useState(false);
  const [groundedSummary, setGroundedSummary] = useState<string | null>(null);
  const [groundingChunks, setGroundingChunks] = useState<GroundingChunk[]>([]);
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

    try {
      const res = await fetch('/api/salons/grounded-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          areaName: currentLocation,
          latitude: 26.8533,
          longitude: 75.7681,
          category: selectedCategory !== 'all' ? selectedCategory : undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setGroundedSummary(data.text);
        setGroundingChunks(data.groundingChunks || []);
        if (data.groundingChunks?.length > 0 || data.text) {
          setViewMode('ai_grounded');
        }
      }
    } catch (err) {
      console.error('Failed to run grounded search:', err);
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

  // Compute salon match counts per price tier for the current category & search filter
  const getCountForTier = (tierId: PriceRangeFilter) => {
    return salons.filter((s) => {
      const matchesCategory =
        selectedCategory === 'all' ||
        s.services.some((srv) => srv.category === selectedCategory) ||
        s.categories.some((c) => c.toLowerCase().includes(selectedCategory.toLowerCase()));

      const matchesQuery =
        !searchQuery.trim() ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.location.area.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.services.some((srv) => srv.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        s.categories.some((c) => c.toLowerCase().includes(searchQuery.toLowerCase()));

      if (tierId === 'all') return matchesCategory && matchesQuery;
      return matchesCategory && matchesQuery && getPriceTierForSalon(s.priceRange) === tierId;
    }).length;
  };

  const filteredSalons = salons
    .filter((s) => {
      const matchesCategory =
        selectedCategory === 'all' ||
        s.services.some((srv) => srv.category === selectedCategory) ||
        s.categories.some((c) => c.toLowerCase().includes(selectedCategory.toLowerCase()));

      const matchesQuery =
        !searchQuery.trim() ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.location.area.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.services.some((srv) => srv.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        s.categories.some((c) => c.toLowerCase().includes(searchQuery.toLowerCase()));

      const salonTier = getPriceTierForSalon(s.priceRange);
      const matchesPrice = selectedPriceRange === 'all' || salonTier === selectedPriceRange;

      return matchesCategory && matchesQuery && matchesPrice;
    })
    .sort((a, b) => {
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
        const distA = parseFloat(a.distance) || 0;
        const distB = parseFloat(b.distance) || 0;
        return distA - distB;
      }
      return 0; // Default recommended
    });

  const isFiltered = selectedCategory !== 'all' || selectedPriceRange !== 'all' || searchQuery.trim().length > 0;

  const handleResetFilters = () => {
    setSelectedCategory('all');
    setSelectedPriceRange('all');
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

          <button
            type="button"
            onClick={() => {
              if (searchQuery.trim()) addRecentSearch(searchQuery);
              handlePerformGroundedSearch();
            }}
            disabled={isSearchingGrounded}
            className="px-4 bg-[#b00055] text-white text-[12px] font-semibold rounded-[14px] flex items-center gap-1.5 hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(176,0,85,0.20)] active:scale-95 transition-all duration-180 disabled:opacity-50 shrink-0 cursor-pointer"
          >
            {isSearchingGrounded ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="material-symbols-outlined text-[18px]">google_pin</span>
            )}
            <span className="hidden sm:inline">Ground with Maps</span>
          </button>
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

        {/* Price Range Filter & Sort Bar */}
        <div className="p-2.5 rounded-2xl bg-surface-container-low border border-outline-variant/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Price Range Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
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

          {/* Sort & Reset Actions */}
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
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
                <option value="price_asc">Price: Low to High ($ → $$$)</option>
                <option value="price_desc">Price: High to Low ($$$ → $)</option>
                <option value="rating">Top Rated (★)</option>
                <option value="distance">Nearest Distance</option>
              </select>
            </div>

            {isFiltered && (
              <button
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
                {groundedSummary ? (
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
            {/* Map Background Grid Simulation */}
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
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-center text-on-surface-variant">
              Tap any pin above to view salon details, distance and instant booking slots.
            </p>
          )}
        </div>
      )}

      {/* Salons Grid / List */}
      {filteredSalons.length === 0 ? (
        <div className="p-8 rounded-2xl bg-surface-container-low border border-outline-variant/40 flex flex-col items-center justify-center text-center gap-3 my-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px]">filter_alt_off</span>
          </div>
          <div>
            <h3 className="font-card-title text-[16px] font-bold text-on-surface">
              No Salons Found in this Budget Range
            </h3>
            <p className="text-[12px] text-on-surface-variant mt-1 max-w-md">
              {selectedPriceRange !== 'all'
                ? `No salons currently match ${PRICE_TIERS.find((t) => t.id === selectedPriceRange)?.label} (${PRICE_TIERS.find((t) => t.id === selectedPriceRange)?.desc}). Try selecting a different budget tier or clearing your filters.`
                : 'No salons match your search query or category filter. Try clearing filters to see all available salons.'}
            </p>
          </div>
          <div className="flex items-center gap-2 mt-2">
            {selectedPriceRange !== 'all' && (
              <button
                onClick={() => setSelectedPriceRange('all')}
                className="px-4 py-2 bg-primary text-white text-[12px] font-bold rounded-xl hover:bg-nexora-pink transition-colors shadow-xs"
              >
                View All Price Ranges
              </button>
            )}
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 bg-surface-container text-on-surface text-[12px] font-semibold rounded-xl hover:bg-surface-container-high transition-colors"
            >
              Reset All Filters
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {filteredSalons.map((salon) => {
            const isSaved = savedSalonIds.includes(salon.id);
            const priceInfo = getPriceTierDisplay(salon.priceRange);
            const minPrice = getMinStartingPrice(salon);

            return (
              <div
                key={salon.id}
                className="bg-surface-container-low border border-outline-variant rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs hover:shadow-md transition-all"
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
  );
};
