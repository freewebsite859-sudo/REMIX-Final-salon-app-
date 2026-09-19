import React, { useMemo } from 'react';
import type { Salon } from '../../types';
import {
  SEARCH_CATEGORIES,
  SERVICE_TYPE_OPTIONS,
  DISTANCE_OPTIONS,
  RATING_OPTIONS,
  DEFAULT_SEARCH_FILTERS,
  countActiveFilters,
  minSalonPrice,
  type SearchFilters,
  type SearchGenderFilter,
} from '../../lib/salonSearch';
import { JAIPUR_AREA_CHIPS } from '../../lib/jaipurAreas';

export interface SalonFilterSidebarProps {
  filters: SearchFilters;
  onChange: (next: SearchFilters) => void;
  salons: Salon[];
  /** Total results after filtering, shown in the footer. */
  resultCount: number;
  onClose?: () => void;
  className?: string;
}

const PRICE_STEP = 100;

const Section: React.FC<{ title: string; icon: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, icon, children, defaultOpen = true }) => (
  <details open={defaultOpen} className="group border-b border-outline-variant/30 last:border-b-0">
    <summary className="list-none flex items-center justify-between py-3 cursor-pointer select-none">
      <span className="flex items-center gap-2 text-sm font-bold text-on-surface">
        <span className="material-symbols-outlined text-lg text-primary">{icon}</span>
        {title}
      </span>
      <span className="material-symbols-outlined text-lg text-secondary transition-transform group-open:rotate-180">expand_more</span>
    </summary>
    <div className="pb-4 flex flex-col gap-2">{children}</div>
  </details>
);

const Chip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode; icon?: string }> = ({ active, onClick, children, icon }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`inline-flex items-center gap-1 h-8 px-3 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
      active ? 'bg-primary text-on-primary border-primary shadow-sm shadow-primary/30' : 'bg-white text-on-surface border-outline-variant/50 hover:border-primary/50'
    }`}
  >
    {icon && <span className="material-symbols-outlined text-sm">{icon}</span>}
    {children}
  </button>
);

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; icon: string; testId?: string }> = ({ checked, onChange, label, icon, testId }) => (
  <label className="flex items-center justify-between py-1 cursor-pointer">
    <span className="flex items-center gap-2 text-sm text-on-surface">
      <span className="material-symbols-outlined text-lg text-secondary">{icon}</span>
      {label}
    </span>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-6 rounded-full transition-colors cursor-pointer ${checked ? 'bg-primary' : 'bg-outline-variant'}`}
      data-testid={testId}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
    </button>
  </label>
);

export const SalonFilterSidebar: React.FC<SalonFilterSidebarProps> = ({ filters, onChange, salons, resultCount, onClose, className = '' }) => {
  const set = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => onChange({ ...filters, [key]: value });
  const active = countActiveFilters(filters);

  const priceBounds = useMemo(() => {
    const prices = salons.flatMap((s) => s.services.map((x) => x.price)).filter((p) => Number.isFinite(p) && p > 0);
    const max = prices.length ? Math.ceil(Math.max(...prices) / 500) * 500 : 10000;
    return { min: 0, max: Math.max(max, 1000) };
  }, [salons]);

  const minVal = filters.minPrice ?? priceBounds.min;
  const maxVal = filters.maxPrice ?? priceBounds.max;
  const pct = (v: number) => ((v - priceBounds.min) / (priceBounds.max - priceBounds.min)) * 100;

  const areaCounts = useMemo(() => {
    const m = new Map<string, number>();
    salons.forEach((s) => m.set(s.location.area, (m.get(s.location.area) ?? 0) + 1));
    return m;
  }, [salons]);
  const areas = useMemo(() => {
    const known = JAIPUR_AREA_CHIPS.map((a) => a.area);
    const extra = Array.from(areaCounts.keys()).filter((a) => !known.includes(a));
    return [...known, ...extra].filter((a) => (areaCounts.get(a) ?? 0) > 0 || filters.area === a);
  }, [areaCounts, filters.area]);

  const cheapestOverall = useMemo(() => (salons.length ? Math.min(...salons.map(minSalonPrice)) : 0), [salons]);

  return (
    <aside className={`bg-white rounded-2xl border border-outline-variant/40 flex flex-col ${className}`} data-testid="salon-filter-sidebar" aria-label="Filter salons">
      <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/30">
        <h2 className="font-bold text-base text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">tune</span>
          Filters
          {active > 0 && <span className="text-[10px] font-bold bg-primary text-white rounded-full px-1.5 py-0.5" data-testid="active-filter-count">{active}</span>}
        </h2>
        <div className="flex items-center gap-2">
          {active > 0 && (
            <button type="button" onClick={() => onChange(DEFAULT_SEARCH_FILTERS)} className="text-xs font-bold text-primary hover:underline cursor-pointer" data-testid="clear-filters">
              Clear all
            </button>
          )}
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Close filters" className="lg:hidden w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center cursor-pointer">
              <span className="material-symbols-outlined">close</span>
            </button>
          )}
        </div>
      </div>

      <div className="px-4 overflow-y-auto no-scrollbar flex-1">
        <Section title="Location" icon="location_on">
          <div className="flex flex-wrap gap-1.5">
            <Chip active={!filters.area} onClick={() => set('area', '')}>Anywhere</Chip>
            {areas.map((a) => (
              <Chip key={a} active={filters.area === a} onClick={() => set('area', filters.area === a ? '' : a)}>
                {a} <span className="opacity-60">({areaCounts.get(a) ?? 0})</span>
              </Chip>
            ))}
          </div>
          <div className="mt-2">
            <div className="text-[11px] font-bold text-secondary uppercase tracking-wider mb-1.5">Within distance</div>
            <div className="flex flex-wrap gap-1.5">
              {DISTANCE_OPTIONS.map((d) => (
                <Chip key={String(d.value)} active={filters.maxDistanceKm === d.value} onClick={() => set('maxDistanceKm', d.value)} icon={d.value ? 'near_me' : undefined}>
                  {d.label}
                </Chip>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Category" icon="category">
          <div className="flex flex-wrap gap-1.5">
            {SEARCH_CATEGORIES.map((c) => (
              <Chip key={c.id} active={filters.category === c.id} onClick={() => set('category', c.id)} icon={c.icon}>
                {c.label}
              </Chip>
            ))}
          </div>
        </Section>

        <Section title="Service type" icon="content_cut">
          <div className="flex flex-wrap gap-1.5">
            {SERVICE_TYPE_OPTIONS.map((s) => (
              <Chip key={s} active={filters.serviceType === s} onClick={() => set('serviceType', filters.serviceType === s ? '' : s)}>
                {s}
              </Chip>
            ))}
          </div>
        </Section>

        <Section title="Price range" icon="payments">
          <div className="flex items-center justify-between text-xs font-mono font-bold text-on-surface">
            <span data-testid="price-min-label">₹{minVal.toLocaleString('en-IN')}</span>
            <span data-testid="price-max-label">{maxVal >= priceBounds.max ? `₹${priceBounds.max.toLocaleString('en-IN')}+` : `₹${maxVal.toLocaleString('en-IN')}`}</span>
          </div>
          <div className="relative h-8 mt-1" data-testid="price-range-slider">
            <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1.5 rounded-full bg-surface-container-highest" />
            <div className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-primary" style={{ left: `${pct(minVal)}%`, right: `${100 - pct(maxVal)}%` }} />
            <input
              type="range"
              min={priceBounds.min}
              max={priceBounds.max}
              step={PRICE_STEP}
              value={minVal}
              onChange={(e) => {
                const v = Math.min(Number(e.target.value), maxVal - PRICE_STEP);
                set('minPrice', v <= priceBounds.min ? null : v);
              }}
              aria-label="Minimum price"
              className="range-thumb absolute inset-0 w-full appearance-none bg-transparent pointer-events-none"
              data-testid="price-min-input"
            />
            <input
              type="range"
              min={priceBounds.min}
              max={priceBounds.max}
              step={PRICE_STEP}
              value={maxVal}
              onChange={(e) => {
                const v = Math.max(Number(e.target.value), minVal + PRICE_STEP);
                set('maxPrice', v >= priceBounds.max ? null : v);
              }}
              aria-label="Maximum price"
              className="range-thumb absolute inset-0 w-full appearance-none bg-transparent pointer-events-none"
              data-testid="price-max-input"
            />
          </div>
          <p className="text-[11px] text-secondary">Cheapest service in this list starts at ₹{cheapestOverall.toLocaleString('en-IN')}.</p>
        </Section>

        <Section title="Rating" icon="star">
          <div className="flex flex-wrap gap-1.5">
            {RATING_OPTIONS.map((r) => (
              <Chip key={r.value} active={filters.minRating === r.value} onClick={() => set('minRating', r.value)} icon={r.value ? 'star' : undefined}>
                {r.label}
              </Chip>
            ))}
          </div>
        </Section>

        <Section title="Availability & more" icon="event_available">
          <Toggle checked={filters.openNow} onChange={(v) => set('openNow', v)} label="Open now" icon="schedule" testId="filter-open-now" />
          <Toggle checked={filters.offersOnly} onChange={(v) => set('offersOnly', v)} label="Offers & discounts" icon="local_offer" testId="filter-offers" />
          <Toggle checked={filters.verifiedOnly} onChange={(v) => set('verifiedOnly', v)} label="Verified salons only" icon="verified" testId="filter-verified" />
          <Toggle checked={filters.homeService} onChange={(v) => set('homeService', v)} label="Home service" icon="home" testId="filter-home" />
          <div className="mt-2">
            <div className="text-[11px] font-bold text-secondary uppercase tracking-wider mb-1.5">For</div>
            <div className="flex flex-wrap gap-1.5">
              {(['all', 'women', 'men', 'unisex'] as SearchGenderFilter[]).map((g) => (
                <Chip key={g} active={filters.gender === g} onClick={() => set('gender', g)}>
                  {g === 'all' ? 'Everyone' : g[0].toUpperCase() + g.slice(1)}
                </Chip>
              ))}
            </div>
          </div>
        </Section>
      </div>

      <div className="px-4 py-3 border-t border-outline-variant/30 flex items-center justify-between gap-2 bg-surface-container-low rounded-b-2xl">
        <span className="text-xs text-on-surface-variant" data-testid="filter-result-count">
          <strong className="text-on-surface">{resultCount}</strong> salon{resultCount === 1 ? '' : 's'} match
        </span>
        {onClose && (
          <button type="button" onClick={onClose} className="lg:hidden h-9 px-4 rounded-xl bg-primary text-on-primary text-xs font-bold cursor-pointer">
            Show results
          </button>
        )}
      </div>
    </aside>
  );
};
