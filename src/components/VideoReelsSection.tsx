import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  Play,
  Sparkles,
  Star,
  ChevronLeft,
  ChevronRight,
  Eye,
  CalendarCheck,
  Scissors,
  CheckCircle2,
  Flame,
  Clock,
  Film,
  Tag,
  Volume2
} from 'lucide-react';
import { Salon, SalonVideoReel, SalonService, Stylist } from '../types';
import { ALL_SALON_VIDEO_REELS, getReelsForSalon } from '../data/salonVideoReels';
import { SalonVideoReelsModal } from './SalonVideoReelsModal';
import { getTemplateSalons } from '../data/templateSalons';

export interface VideoReelsSectionProps {
  /** Salon list retrieved from the catalog service */
  salons?: Salon[];
  /** Callback triggered when user clicks to book from a video reel */
  onBookSalon?: (salon: Salon, service?: SalonService, stylist?: Stylist) => void;
  /** Callback to view full salon details */
  onOpenSalonDetails?: (salon: Salon) => void;
  /** Custom section title */
  title?: string;
  /** Custom subtitle */
  subtitle?: string;
  /** Optional custom CSS class */
  className?: string;
}

const CATEGORY_FILTERS = [
  { id: 'all', label: 'All Videos', icon: '✨' },
  { id: 'hair', label: 'Hair & Styling', icon: '💇‍♀️' },
  { id: 'barber', label: 'Barber & Fade', icon: '💈' },
  { id: 'spa', label: 'Spa & Wellness', icon: '🧖‍♀️' },
  { id: 'nail', label: 'Nail Art', icon: '💅' },
  { id: 'skincare', label: 'Skincare', icon: '✨' },
  { id: 'bridal', label: 'Bridal & Glam', icon: '👰' },
  { id: 'tattoo', label: 'Tattoo Art', icon: '🎨' },
];

/**
 * VideoReelsSection displays a scrollable, horizontal list of salon promotional videos.
 * Maps salon promotional reels directly to salon data retrieved from the catalog service.
 */
export const VideoReelsSection: React.FC<VideoReelsSectionProps> = ({
  salons: passedSalons,
  onBookSalon,
  onOpenSalonDetails,
  title = 'Watch Salon Promotional Videos',
  subtitle = 'Explore live salon transformations, stylist craft reels, and exclusive promotional offers',
  className = '',
}) => {
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [activeModalIndex, setActiveModalIndex] = useState<number | null>(null);
  const [hoveredReelId, setHoveredReelId] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Fallback to catalog template salons if salons prop is empty
  const effectiveSalons = useMemo(() => {
    if (passedSalons && passedSalons.length > 0) {
      return passedSalons;
    }
    return getTemplateSalons();
  }, [passedSalons]);

  // Map promotional video reels from catalog salon data
  const promotionalReels: SalonVideoReel[] = useMemo(() => {
    const combinedReels: SalonVideoReel[] = [];
    const seenIds = new Set<string>();

    // 1. Gather all video reels explicitly attached to catalog salons
    effectiveSalons.forEach((salon) => {
      if (salon.videoReels && salon.videoReels.length > 0) {
        salon.videoReels.forEach((reel) => {
          if (!seenIds.has(reel.id)) {
            seenIds.add(reel.id);
            combinedReels.push({
              ...reel,
              salonName: salon.name || reel.salonName,
              salonImage: salon.image || reel.salonImage,
              salonRating: salon.rating || reel.salonRating,
              salonLocation: salon.location?.area || salon.location?.city || reel.salonLocation,
            });
          }
        });
      } else {
        // Look up predefined catalogue reels for this salon ID
        const matched = getReelsForSalon(salon.id);
        matched.forEach((reel) => {
          if (!seenIds.has(reel.id)) {
            seenIds.add(reel.id);
            combinedReels.push({
              ...reel,
              salonName: salon.name || reel.salonName,
              salonImage: salon.image || reel.salonImage,
              salonRating: salon.rating || reel.salonRating,
              salonLocation: salon.location?.area || salon.location?.city || reel.salonLocation,
            });
          }
        });
      }
    });

    // 2. Include all master catalog video reels if not already present
    ALL_SALON_VIDEO_REELS.forEach((masterReel) => {
      if (!seenIds.has(masterReel.id)) {
        seenIds.add(masterReel.id);
        const matchingSalon = effectiveSalons.find((s) => s.id === masterReel.salonId);
        combinedReels.push({
          ...masterReel,
          salonName: matchingSalon?.name || masterReel.salonName,
          salonImage: matchingSalon?.image || masterReel.salonImage,
          salonRating: matchingSalon?.rating || masterReel.salonRating,
          salonLocation: matchingSalon?.location?.area || masterReel.salonLocation,
        });
      }
    });

    return combinedReels;
  }, [effectiveSalons]);

  // Filter video reels based on category selection
  const filteredReels = useMemo(() => {
    if (selectedFilter === 'all') return promotionalReels;

    return promotionalReels.filter((reel) => {
      const cat = (reel.category || '').toLowerCase();
      const tags = (reel.tags || []).join(' ').toLowerCase();
      const titleText = (reel.title || '').toLowerCase();
      const target = `${cat} ${tags} ${titleText}`;

      if (selectedFilter === 'hair') return target.includes('hair') || target.includes('cut') || target.includes('balayage') || target.includes('color');
      if (selectedFilter === 'barber') return target.includes('barber') || target.includes('fade') || target.includes('beard') || target.includes('grooming');
      if (selectedFilter === 'spa') return target.includes('spa') || target.includes('massage') || target.includes('ayurved') || target.includes('wellness');
      if (selectedFilter === 'nail') return target.includes('nail') || target.includes('manicure') || target.includes('gel');
      if (selectedFilter === 'skincare') return target.includes('skin') || target.includes('facial') || target.includes('hydra') || target.includes('medi');
      if (selectedFilter === 'bridal') return target.includes('bridal') || target.includes('makeup') || target.includes('glam');
      if (selectedFilter === 'tattoo') return target.includes('tattoo') || target.includes('ink') || target.includes('piercing');
      return true;
    });
  }, [promotionalReels, selectedFilter]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollDistance = 340;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollDistance : scrollDistance,
        behavior: 'smooth',
      });
    }
  };

  const handleOpenReel = (reelIndex: number) => {
    setActiveModalIndex(reelIndex);
  };

  return (
    <section id="video-reels-section" className={`w-full ${className}`}>
      {/* Section Header */}
      <div className="px-page-margin mb-3 flex flex-col md:flex-row md:items-end justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-tr from-rose-500 to-amber-500 text-white shadow-sm">
              <Film className="w-3.5 h-3.5 text-white" />
            </span>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-0.5 rounded-full border border-rose-200 dark:border-rose-800 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              Promotional Reels
            </span>
            <span className="hidden sm:flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              Trending Now
            </span>
          </div>
          <h2 className="font-section-heading text-[19px] md:text-xl font-bold text-on-surface">
            {title}
          </h2>
          <p className="text-xs text-on-surface-variant line-clamp-1">
            {subtitle}
          </p>
        </div>

        {/* Desktop Carousel Scroll Arrows */}
        <div className="hidden md:flex items-center gap-2 self-end">
          <button
            onClick={() => handleScroll('left')}
            className="w-8 h-8 rounded-full border border-outline-variant/60 bg-surface flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer shadow-xs"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleScroll('right')}
            className="w-8 h-8 rounded-full border border-outline-variant/60 bg-surface flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer shadow-xs"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div className="px-page-margin mb-3.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth">
        {CATEGORY_FILTERS.map((filter) => {
          const isActive = selectedFilter === filter.id;
          return (
            <button
              key={filter.id}
              onClick={() => setSelectedFilter(filter.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                isActive
                  ? 'bg-slate-900 text-white shadow-sm ring-1 ring-slate-900 dark:bg-white dark:text-slate-950'
                  : 'bg-surface-container border border-outline-variant/40 text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              <span>{filter.icon}</span>
              <span>{filter.label}</span>
            </button>
          );
        })}
      </div>

      {/* Scrollable Horizontal Video Cards List */}
      <div
        ref={scrollContainerRef}
        className="flex items-center gap-3.5 overflow-x-auto px-page-margin pb-4 pt-1 snap-x snap-mandatory scroll-smooth no-scrollbar"
      >
        {filteredReels.map((reel, idx) => {
          const isHovered = hoveredReelId === reel.id;
          const matchedSalon = effectiveSalons.find((s) => s.id === reel.salonId);

          return (
            <div
              key={reel.id}
              onMouseEnter={() => setHoveredReelId(reel.id)}
              onMouseLeave={() => setHoveredReelId(null)}
              onClick={() => handleOpenReel(idx)}
              className="group relative flex-none w-[170px] sm:w-[190px] md:w-[210px] aspect-[9/15] rounded-2xl overflow-hidden bg-slate-900 border border-slate-200/40 dark:border-slate-800 shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 snap-start cursor-pointer select-none"
            >
              {/* Media Thumbnail & Hover Video Playback */}
              <div className="absolute inset-0 w-full h-full bg-slate-950">
                <img
                  src={reel.thumbnailUrl}
                  alt={reel.title}
                  className={`w-full h-full object-cover transition-transform duration-700 ease-out ${
                    isHovered ? 'scale-105' : 'scale-100'
                  }`}
                  loading="lazy"
                />

                {/* Subdued video preview on hover */}
                {isHovered && (
                  <video
                    src={reel.videoUrl}
                    playsInline
                    autoPlay
                    muted
                    loop
                    className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
                  />
                )}
              </div>

              {/* Gradient Scrims for Readable Overlays */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-black/60 pointer-events-none" />

              {/* Top Header on Card: Salon Avatar & Duration Badge */}
              <div className="absolute top-2.5 inset-x-2.5 z-10 flex items-center justify-between">
                {/* Salon Avatar Chip */}
                <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md pl-1 pr-2.5 py-0.5 rounded-full border border-white/15">
                  <div className="w-5 h-5 rounded-full p-[1px] bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-500 shrink-0">
                    <img
                      src={reel.salonImage}
                      alt={reel.salonName}
                      className="w-full h-full rounded-full object-cover"
                    />
                  </div>
                  <span className="text-[11px] font-bold text-white truncate max-w-[85px]">
                    {reel.salonName}
                  </span>
                </div>

                {/* Duration chip */}
                {reel.duration && (
                  <span className="text-[10px] font-bold text-white/90 bg-black/50 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/10 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5 text-amber-300" />
                    {reel.duration}
                  </span>
                )}
              </div>

              {/* Center Play Button Overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div
                  className={`w-10 h-10 rounded-full bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center text-white shadow-lg transition-transform duration-300 ${
                    isHovered ? 'scale-110 bg-rose-500/90 border-rose-300' : 'group-hover:scale-105'
                  }`}
                >
                  <Play className="w-4 h-4 fill-white ml-0.5 text-white" />
                </div>
              </div>

              {/* Bottom Card Details */}
              <div className="absolute bottom-0 inset-x-0 p-3 z-10 flex flex-col gap-1.5">
                {/* Rating & Views */}
                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1 bg-amber-400/95 text-slate-950 font-extrabold px-1.5 py-0.5 rounded-md text-[10px]">
                    <Star className="w-2.5 h-2.5 fill-slate-950" />
                    {reel.salonRating.toFixed(1)}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-white/80 font-medium">
                    <Eye className="w-3 h-3 text-white/70" />
                    {reel.views || '12K'}
                  </span>
                </div>

                {/* Title */}
                <h3 className="text-white text-xs font-bold leading-tight line-clamp-2 drop-shadow">
                  {reel.title}
                </h3>

                {/* Promotional Service Price & Book Action */}
                <div className="flex items-center justify-between gap-1 pt-1 border-t border-white/15">
                  {reel.servicePrice ? (
                    <div className="flex flex-col">
                      <span className="text-[9px] uppercase font-semibold text-white/70">From</span>
                      <span className="text-xs font-black text-amber-300">₹{reel.servicePrice}</span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-white/70 truncate">{reel.category}</span>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onBookSalon && matchedSalon) {
                        const srv = matchedSalon.services?.find(
                          (s) => s.id === reel.serviceId || s.name === reel.serviceName
                        );
                        onBookSalon(matchedSalon, srv);
                      } else {
                        handleOpenReel(idx);
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-300 text-slate-950 text-[11px] font-extrabold flex items-center gap-1 shadow-md transition-colors"
                  >
                    <CalendarCheck className="w-3 h-3 text-slate-900" />
                    <span>Book</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Fullscreen Video Reels Player Modal */}
      {activeModalIndex !== null && (
        <SalonVideoReelsModal
          isOpen={activeModalIndex !== null}
          onClose={() => setActiveModalIndex(null)}
          reels={filteredReels}
          initialIndex={activeModalIndex}
          salons={effectiveSalons}
          onBookSalon={(s, srv) => {
            setActiveModalIndex(null);
            if (onBookSalon) onBookSalon(s, srv);
          }}
          onOpenSalonDetails={(s) => {
            setActiveModalIndex(null);
            if (onOpenSalonDetails) onOpenSalonDetails(s);
          }}
        />
      )}
    </section>
  );
};
