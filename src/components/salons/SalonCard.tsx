import React from 'react';
import { motion } from 'motion/react';
import type { Salon, SalonService } from '../../types';
import { minSalonPrice, isVerifiedSalon } from '../../lib/salonSearch';

export type SalonCardLayout = 'grid' | 'list';

export interface SalonCardProps {
  salon: Salon;
  layout?: SalonCardLayout;
  isSaved?: boolean;
  matchedService?: SalonService | null;
  index?: number;
  onOpen?: (salon: Salon) => void;
  onBook?: (salon: Salon) => void;
  onToggleSave?: (salonId: string) => void;
}

const formatInr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export const RatingPill: React.FC<{ rating: number; count?: number; compact?: boolean }> = ({ rating, count, compact }) => (
  <span className={`inline-flex items-center gap-1 font-bold rounded-lg ${compact ? 'text-[11px] px-1.5 py-0.5' : 'text-xs px-2 py-1'} bg-emerald-600 text-white`}>
    <span className="material-symbols-outlined text-xs fill-1">star</span>
    {rating.toFixed(1)}
    {count != null && <span className="font-medium opacity-80">({count})</span>}
  </span>
);

export const SalonCard: React.FC<SalonCardProps> = ({
  salon,
  layout = 'grid',
  isSaved = false,
  matchedService,
  index = 0,
  onOpen,
  onBook,
  onToggleSave,
}) => {
  const fromPrice = matchedService ? matchedService.price : minSalonPrice(salon);
  const verified = isVerifiedSalon(salon);
  const availableStaff = salon.stylists.filter((s) => (s.status || 'active') !== 'inactive').length;
  const isList = layout === 'list';

  const SaveButton = (
    <button
      type="button"
      aria-pressed={isSaved}
      aria-label={isSaved ? 'Remove from favourites' : 'Save to favourites'}
      onClick={(e) => { e.stopPropagation(); onToggleSave?.(salon.id); }}
      className={`w-9 h-9 rounded-full backdrop-blur-md border flex items-center justify-center transition-all cursor-pointer active:scale-90 ${
        isSaved ? 'bg-primary text-white border-primary shadow-lg shadow-primary/30' : 'bg-white/85 text-on-surface border-white/60 hover:bg-white'
      }`}
      data-testid={`save-salon-${salon.id}`}
    >
      <motion.span
        key={String(isSaved)}
        initial={{ scale: 0.6 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 14 }}
        className={`material-symbols-outlined text-xl ${isSaved ? 'fill-1' : ''}`}
      >
        favorite
      </motion.span>
    </button>
  );

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.04, ease: [0.22, 1, 0.36, 1] }}
      onClick={() => onOpen?.(salon)}
      className={`floating-card group relative bg-white border border-outline-variant/40 rounded-2xl overflow-hidden cursor-pointer ${
        isList ? 'flex flex-row' : 'flex flex-col'
      }`}
      data-testid={`salon-card-${salon.id}`}
      data-layout={layout}
      data-rating={salon.rating}
      data-price={fromPrice}
    >
      {/* Image */}
      <div className={`relative overflow-hidden bg-slate-200 shrink-0 ${isList ? 'w-32 sm:w-52 md:w-64 aspect-auto' : 'aspect-[4/3]'}`}>
        <img
          src={salon.image}
          alt={salon.name}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5">
          {salon.discountOffer && (
            <span className="text-[10px] font-bold bg-primary text-white px-2 py-0.5 rounded-full shadow">{salon.discountOffer}</span>
          )}
          {salon.trending && !isList && (
            <span className="text-[10px] font-bold bg-white/90 text-orange-600 px-2 py-0.5 rounded-full inline-flex items-center gap-0.5">
              <span className="material-symbols-outlined text-xs">local_fire_department</span> Trending
            </span>
          )}
        </div>
        <div className="absolute top-2.5 right-2.5">{SaveButton}</div>
        <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${salon.isOpen ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-200'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${salon.isOpen ? 'bg-white animate-pulse' : 'bg-slate-400'}`} />
            {salon.isOpen ? 'Open now' : 'Closed'}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className={`flex flex-col gap-2 flex-1 min-w-0 ${isList ? 'p-3 sm:p-4' : 'p-4'}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-bold text-[15px] text-on-surface leading-tight truncate group-hover:text-primary transition-colors flex items-center gap-1">
              <span className="truncate">{salon.name}</span>
              {verified && <span className="material-symbols-outlined text-primary text-base fill-1 shrink-0" title="Verified salon">verified</span>}
            </h3>
            <p className="text-[12px] text-on-surface-variant truncate mt-0.5">{salon.tagline}</p>
          </div>
          <RatingPill rating={salon.rating} count={isList ? salon.reviewCount : undefined} compact />
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-secondary">
          <span className="inline-flex items-center gap-0.5"><span className="material-symbols-outlined text-sm">location_on</span>{salon.location.area}</span>
          <span className="inline-flex items-center gap-0.5"><span className="material-symbols-outlined text-sm">near_me</span>{salon.distance}</span>
          <span className="font-mono">{salon.priceRange}</span>
          <span className="inline-flex items-center gap-0.5 capitalize"><span className="material-symbols-outlined text-sm">wc</span>{salon.gender}</span>
        </div>

        {isList && (
          <div className="hidden sm:flex flex-wrap gap-1.5">
            {salon.categories.slice(0, 4).map((c) => (
              <span key={c} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant">{c}</span>
            ))}
          </div>
        )}

        <div className={`mt-auto pt-2 border-t border-outline-variant/30 flex items-center justify-between gap-2 ${isList ? '' : ''}`}>
          <div className="min-w-0">
            <div className="text-[10px] text-secondary uppercase tracking-wider font-mono">{matchedService ? matchedService.name : 'Starts from'}</div>
            <div className="text-sm font-extrabold text-on-surface font-mono">{formatInr(fromPrice)}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-secondary">
              <span className="relative flex w-2 h-2">
                <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-500" />
              </span>
              {availableStaff} staff
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onBook?.(salon); }}
              className="h-9 px-3.5 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary-container transition-colors cursor-pointer shimmer-on-hover"
              data-testid={`book-salon-${salon.id}`}
            >
              Book
            </button>
          </div>
        </div>
      </div>
    </motion.article>
  );
};

export const SalonCardSkeleton: React.FC<{ layout?: SalonCardLayout }> = ({ layout = 'grid' }) => (
  <div className={`bg-white border border-outline-variant/30 rounded-2xl overflow-hidden animate-pulse ${layout === 'list' ? 'flex' : ''}`}>
    <div className={`bg-slate-200 ${layout === 'list' ? 'w-32 sm:w-52 md:w-64 h-36' : 'aspect-[4/3]'}`} />
    <div className="p-4 flex-1 flex flex-col gap-2">
      <div className="h-4 bg-slate-200 rounded w-2/3" />
      <div className="h-3 bg-slate-100 rounded w-1/2" />
      <div className="h-3 bg-slate-100 rounded w-3/4 mt-2" />
      <div className="h-9 bg-slate-100 rounded-xl w-full mt-auto" />
    </div>
  </div>
);
