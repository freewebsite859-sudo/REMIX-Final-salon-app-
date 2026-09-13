import React, { useCallback, useMemo, useState } from 'react';
import type { Salon, SalonService } from '../types';

/** Indian-rupee formatting with thousands separators (e.g. ₹3,150). */
export function formatServiceINR(amount: number): string {
  return `₹${(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

/** A service row plus the salon that offers it — the unit this screen lists. */
export interface CatalogServiceEntry {
  /** Unique key: services are only unique within a salon. */
  key: string;
  salon: Salon;
  service: SalonService;
  category: string;
  /** Effective price after any salon-level discount. */
  price: number;
  /** Original price when a discount applies, otherwise null. */
  listPrice: number | null;
  durationMinutes: number;
  popular: boolean;
}

export interface ServicesScreenProps {
  salons: Salon[];
  /** Prefill from `/customer/services?q=`. */
  initialQuery?: string;
  /** Prefill from `/customer/services?category=`. */
  initialCategory?: string;
  onOpenService: (entry: CatalogServiceEntry) => void;
  onBookService: (salon: Salon, service: SalonService) => void;
  onBack?: () => void;
  savedServiceIds?: string[];
  onToggleSaveService?: (salonId: string, service: SalonService) => void;
}

/** Services are grouped by `category`; this keeps a stable, readable order. */
function normalizeCategory(service: SalonService): string {
  const raw = (service.category || '').trim();
  return raw || 'Other Treatments';
}

function serviceDuration(service: SalonService): number {
  const minutes = service.duration ?? service.durationMinutes;
  return typeof minutes === 'number' && minutes > 0 ? Math.round(minutes) : 0;
}

function servicePrice(service: SalonService): number {
  return service.discountPrice && service.discountPrice < service.price
    ? service.discountPrice
    : service.price;
}

/**
 * Flatten every salon's services into one browsable list.
 *
 * Extracted (and exported) so the ordering/dedupe rules are testable without
 * mounting React.
 */
export function buildCatalogServiceEntries(salons: Salon[]): CatalogServiceEntry[] {
  const entries: CatalogServiceEntry[] = [];
  const seen = new Set<string>();

  for (const salon of salons || []) {
    for (const service of salon.services || []) {
      if (!service?.id) continue;
      const key = `${salon.id}:${service.id}`;
      // A duplicated (salon, service) pair in the catalog must not render twice.
      if (seen.has(key)) continue;
      seen.add(key);

      const price = servicePrice(service);
      entries.push({
        key,
        salon,
        service,
        category: normalizeCategory(service),
        price,
        listPrice: service.discountPrice && service.discountPrice < service.price ? service.price : null,
        durationMinutes: serviceDuration(service),
        popular: Boolean(service.popular),
      });
    }
  }

  return entries;
}

/** Distinct categories present in the catalog, most-populated first. */
export function listServiceCategories(entries: CatalogServiceEntry[]): string[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    counts.set(entry.category, (counts.get(entry.category) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([category]) => category);
}

/**
 * Services Screen (B7).
 *
 * The catalog browser: every treatment across every salon, grouped by
 * category, searchable and filterable. Tapping a row opens the Service Detail
 * Screen; "Book" enters the booking flow at that service.
 */
export const ServicesScreen: React.FC<ServicesScreenProps> = ({
  salons,
  initialQuery = '',
  initialCategory = '',
  onOpenService,
  onBookService,
  onBack,
  savedServiceIds = [],
  onToggleSaveService,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [popularOnly, setPopularOnly] = useState(false);

  const allEntries = useMemo(() => buildCatalogServiceEntries(salons), [salons]);
  const categories = useMemo(() => listServiceCategories(allEntries), [allEntries]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = allEntries.filter((entry) => {
      if (category && entry.category !== category) return false;
      if (maxPrice !== null && entry.price > maxPrice) return false;
      if (popularOnly && !entry.popular) return false;
      if (!q) return true;
      return (
        entry.service.name.toLowerCase().includes(q) ||
        entry.category.toLowerCase().includes(q) ||
        (entry.service.description || '').toLowerCase().includes(q) ||
        entry.salon.name.toLowerCase().includes(q)
      );
    });

    // Cheapest first within a category: the comparison shoppers actually make.
    return rows.sort(
      (a, b) => a.price - b.price || a.durationMinutes - b.durationMinutes || a.salon.name.localeCompare(b.salon.name)
    );
  }, [allEntries, query, category, maxPrice, popularOnly]);

  const grouped = useMemo(() => {
    const map = new Map<string, CatalogServiceEntry[]>();
    for (const entry of filtered) {
      const bucket = map.get(entry.category);
      if (bucket) bucket.push(entry);
      else map.set(entry.category, [entry]);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const clearFilters = useCallback(() => {
    setQuery('');
    setCategory('');
    setMaxPrice(null);
    setPopularOnly(false);
  }, []);

  const hasActiveFilters = Boolean(query.trim() || category || maxPrice !== null || popularOnly);

  return (
    <div data-testid="services-screen" className="flex flex-col gap-4 px-4 pt-4 pb-28 max-w-3xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-start gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="mt-0.5 w-9 h-9 shrink-0 rounded-full flex items-center justify-center bg-surface-container hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
        )}
        <div className="min-w-0">
          <h1 className="font-card-title text-[20px] text-on-surface">All Services</h1>
          <p className="text-[12px] text-on-surface-variant">
            {allEntries.length} treatments across {salons.length}{' '}
            {salons.length === 1 ? 'salon' : 'salons'}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant">
          search
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search hair, skin, nails, bridal…"
          aria-label="Search services"
          className="w-full pl-10 pr-3 py-2.5 text-[13px] rounded-xl bg-surface-container border-0 focus:ring-1 focus:ring-nexora-pink text-on-surface"
        />
      </div>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="tablist" aria-label="Service categories">
        <button
          type="button"
          role="tab"
          aria-selected={category === ''}
          onClick={() => setCategory('')}
          className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${
            category === ''
              ? 'bg-nexora-pink text-white'
              : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            role="tab"
            aria-selected={category === cat}
            onClick={() => setCategory(category === cat ? '' : cat)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${
              category === cat
                ? 'bg-nexora-pink text-white'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Price + popularity filters */}
      <div className="flex flex-wrap items-center gap-2">
        {[null, 1000, 2500, 5000].map((cap) => (
          <button
            key={cap ?? 'any'}
            type="button"
            onClick={() => setMaxPrice(cap)}
            aria-pressed={maxPrice === cap}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
              maxPrice === cap
                ? 'bg-secondary text-white'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {cap === null ? 'Any price' : `Under ${formatServiceINR(cap)}`}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPopularOnly((v) => !v)}
          aria-pressed={popularOnly}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1 ${
            popularOnly
              ? 'bg-warning-amber text-white'
              : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">local_fire_department</span>
          Popular
        </button>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-nexora-pink underline underline-offset-2"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Results */}
      {grouped.length === 0 ? (
        <div
          data-testid="services-empty"
          className="rounded-2xl border border-dashed border-outline-variant/60 bg-surface-container-low p-6 text-center"
        >
          <span className="material-symbols-outlined text-[32px] text-on-surface-variant">search_off</span>
          <p className="mt-2 text-[13px] font-semibold text-on-surface">No services match those filters</p>
          <p className="mt-1 text-[12px] text-on-surface-variant">
            Try a different category, raise the price cap, or clear the filters.
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-3 px-4 py-2 rounded-lg bg-nexora-pink text-white text-[12px] font-bold"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        grouped.map(([cat, rows]) => (
          <section key={cat} className="flex flex-col gap-2">
            <h2 className="font-section-heading text-[14px] text-on-surface flex items-center justify-between">
              <span>{cat}</span>
              <span className="text-[11px] font-normal text-on-surface-variant">
                {rows.length} {rows.length === 1 ? 'option' : 'options'}
              </span>
            </h2>

            {rows.map((entry) => {
              const isSaved = savedServiceIds.includes(entry.service.id);
              return (
                <article
                  key={entry.key}
                  data-testid="service-card"
                  data-service-id={entry.service.id}
                  className="rounded-2xl border border-outline-variant/50 bg-surface p-3.5 flex items-start gap-3 hover:border-nexora-pink/60 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => onOpenService(entry)}
                      className="text-left block w-full"
                    >
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-card-title text-[14px] text-on-surface">{entry.service.name}</h3>
                        {entry.popular && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-warning-amber/15 text-warning-amber">
                            Popular
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-on-surface-variant mt-0.5 truncate">
                        {entry.salon.name} · {entry.salon.location?.area || entry.salon.location?.city}
                      </p>
                      {entry.service.description ? (
                        <p className="text-[11px] text-on-surface-variant mt-1 line-clamp-2">
                          {entry.service.description}
                        </p>
                      ) : null}
                    </button>

                    <div className="mt-2 flex items-center gap-3 flex-wrap">
                      <span className="text-[14px] font-extrabold text-primary">
                        {formatServiceINR(entry.price)}
                      </span>
                      {entry.listPrice !== null && (
                        <span className="text-[11px] text-on-surface-variant line-through">
                          {formatServiceINR(entry.listPrice)}
                        </span>
                      )}
                      {entry.durationMinutes > 0 && (
                        <span className="text-[11px] text-on-surface-variant flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-[13px]">schedule</span>
                          {entry.durationMinutes} mins
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {onToggleSaveService && (
                      <button
                        type="button"
                        onClick={() => onToggleSaveService(entry.salon.id, entry.service)}
                        aria-label={isSaved ? `Remove ${entry.service.name} from favourites` : `Save ${entry.service.name}`}
                        aria-pressed={isSaved}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                          isSaved
                            ? 'text-nexora-pink bg-nexora-pink/10'
                            : 'text-on-surface-variant hover:bg-surface-container'
                        }`}
                      >
                        <span
                          className="material-symbols-outlined text-[18px]"
                          style={isSaved ? { fontVariationSettings: "'FILL' 1" } : undefined}
                        >
                          favorite
                        </span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onBookService(entry.salon, entry.service)}
                      className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-[11px] font-bold hover:bg-nexora-pink transition-colors"
                    >
                      Book
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        ))
      )}
    </div>
  );
};

export default ServicesScreen;
