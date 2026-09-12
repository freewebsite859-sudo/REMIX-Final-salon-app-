import React, { useState, useRef, useMemo } from 'react';
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
  Clock
} from 'lucide-react';
import { Salon, SalonVideoReel, SalonService } from '../types';
import { ALL_SALON_VIDEO_REELS } from '../data/salonVideoReels';
import { SalonVideoReelsModal } from './SalonVideoReelsModal';

interface SalonStoriesReelFeedProps {
  salons: Salon[];
  onBookSalon?: (salon: Salon, service?: SalonService) => void;
  onOpenSalonDetails?: (salon: Salon) => void;
  customTitle?: string;
  customSubtitle?: string;
  className?: string;
}

const REEL_CATEGORIES = [
  { id: 'all', label: 'All Stories', icon: '✨' },
  { id: 'hair', label: 'Hair & Styling', icon: '💇‍♀️' },
  { id: 'barber', label: 'Barber & Fade', icon: '💈' },
  { id: 'spa', label: 'Spa & Wellness', icon: '🧖‍♀️' },
  { id: 'nail', label: 'Nail Art', icon: '💅' },
  { id: 'skincare', label: 'Skincare & Medi-Spa', icon: '✨' },
  { id: 'bridal', label: 'Bridal & Glam', icon: '👰' },
  { id: 'tattoo', label: 'Tattoo Art', icon: '🎨' },
];

export const SalonStoriesReelFeed: React.FC<SalonStoriesReelFeedProps> = ({
  salons,
  onBookSalon,
  onOpenSalonDetails,
  customTitle = 'Watch Salon Stories & Video Previews',
  customSubtitle = 'Live craft previews, hair & nail art, barber fades, and client transformations',
  className = '',
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeModalIndex, setActiveModalIndex] = useState<number | null>(null);
  const [hoveredReelId, setHoveredReelId] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Combine video reels from salon props or the master catalogue
  const allReels = useMemo(() => {
    // If salons pass custom videoReels, merge them; otherwise use ALL_SALON_VIDEO_REELS
    const catalogReels: SalonVideoReel[] = [];
    salons.forEach((s) => {
      if (s.videoReels && s.videoReels.length > 0) {
        catalogReels.push(...s.videoReels);
      }
    });

    if (catalogReels.length > 0) {
      // De-duplicate by id
      const seen = new Set<string>();
      const combined = [...catalogReels, ...ALL_SALON_VIDEO_REELS].filter((r) => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      });
      return combined;
    }
    return ALL_SALON_VIDEO_REELS;
  }, [salons]);

  // Filter reels based on selected category
  const filteredReels = useMemo(() => {
    if (selectedCategory === 'all') return allReels;

    return allReels.filter((r) => {
      const cat = (r.category || '').toLowerCase();
      const tags = (r.tags || []).join(' ').toLowerCase();
      const title = (r.title || '').toLowerCase();
      const target = `${cat} ${tags} ${title}`;

      if (selectedCategory === 'hair') return target.includes('hair') || target.includes('cut') || target.includes('balayage');
      if (selectedCategory === 'barber') return target.includes('barber') || target.includes('fade') || target.includes('beard');
      if (selectedCategory === 'spa') return target.includes('spa') || target.includes('massage') || target.includes('ayurved');
      if (selectedCategory === 'nail') return target.includes('nail') || target.includes('manicure');
      if (selectedCategory === 'skincare') return target.includes('skin') || target.includes('facial') || target.includes('dermatology');
      if (selectedCategory === 'bridal') return target.includes('bridal') || target.includes('makeup') || target.includes('glam');
      if (selectedCategory === 'tattoo') return target.includes('tattoo') || target.includes('ink');
      return true;
    });
  }, [allReels, selectedCategory]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 360;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  const handleOpenReel = (reelIndex: number) => {
    setActiveModalIndex(reelIndex);
  };

  return (
    <section id="salon-stories-reels-section" className={`w-full ${className}`}>
      {/* Section Header */}
      <div className="px-page-margin mb-3 flex flex-col md:flex-row md:items-end justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-tr from-rose-500 to-amber-500 text-white shadow-sm">
              <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
            </span>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-800">
              Shorts & Stories
            </span>
            <span className="hidden sm:flex items-center gap-1 text-[11px] font-bold text-slate-500">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              Trending Previews
            </span>
          </div>
          <h2 className="font-section-heading text-[19px] md:text-xl font-bold text-on-surface">
            {customTitle}
          </h2>
          <p className="text-xs text-on-surface-variant line-clamp-1">
            {customSubtitle}
          </p>
        </div>

        {/* Scroll Arrows on Desktop */}
        <div className="hidden md:flex items-center gap-2 self-end">
          <button
            onClick={() => handleScroll('left')}
            className="w-8 h-8 rounded-full border border-outline-variant/60 bg-surface flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer shadow-sm"
            aria-label="Scroll reels left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleScroll('right')}
            className="w-8 h-8 rounded-full border border-outline-variant/60 bg-surface flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer shadow-sm"
            aria-label="Scroll reels right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Category Filter Chips */}
      <div className="px-page-margin mb-3.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth">
        {REEL_CATEGORIES.map((cat) => {
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                isActive
                  ? 'bg-slate-900 text-white shadow-sm ring-1 ring-slate-900'
                  : 'bg-surface-container border border-outline-variant/40 text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Horizontal Reels Container */}
      <div
        ref={scrollContainerRef}
        className="flex items-center gap-3.5 overflow-x-auto px-page-margin pb-4 pt-1 snap-x snap-mandatory scroll-smooth no-scrollbar"
      >
        {filteredReels.map((reel, idx) => {
          const isHovered = hoveredReelId === reel.id;
          const matchedSalon = salons.find((s) => s.id === reel.salonId);

          return (
            <div
              key={reel.id}
              onMouseEnter={() => setHoveredReelId(reel.id)}
              onMouseLeave={() => setHoveredReelId(null)}
              onClick={() => handleOpenReel(idx)}
              className="group relative flex-none w-[170px] sm:w-[190px] md:w-[210px] aspect-[9/15] rounded-2xl overflow-hidden bg-slate-900 border border-slate-200/40 dark:border-slate-800 shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 snap-start cursor-pointer select-none"
            >
              {/* Media: Video or Poster with hover playback preview */}
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
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/60 pointer-events-none" />

              {/* Top Bar on Card: Salon Story Avatar & View count */}
              <div className="absolute top-2.5 inset-x-2.5 z-10 flex items-center justify-between">
                {/* Story Gradient Ring Avatar */}
                <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md pl-1 pr-2.5 py-0.5 rounded-full border border-white/15">
                  <div className="w-6 h-6 rounded-full p-[1.5px] bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-500 shrink-0">
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

              {/* Play Badge Icon in Center */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div
                  className={`w-10 h-10 rounded-full bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center text-white shadow-lg transition-transform duration-300 ${
                    isHovered ? 'scale-110 bg-rose-500/80 border-rose-300' : 'group-hover:scale-105'
                  }`}
                >
                  <Play className="w-4 h-4 fill-white ml-0.5 text-white" />
                </div>
              </div>

              {/* Bottom Card Details */}
              <div className="absolute bottom-0 inset-x-0 p-3 z-10 flex flex-col gap-1.5">
                {/* Rating & Views Badge */}
                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1 bg-amber-400/90 text-slate-900 font-extrabold px-1.5 py-0.5 rounded-md text-[10px]">
                    <Star className="w-2.5 h-2.5 fill-slate-900" />
                    {reel.salonRating.toFixed(1)}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-white/80 font-medium">
                    <Eye className="w-3 h-3 text-white/70" />
                    {reel.views || '15K'}
                  </span>
                </div>

                {/* Title */}
                <h3 className="text-white text-xs font-bold leading-tight line-clamp-2 drop-shadow">
                  {reel.title}
                </h3>

                {/* Service Tag & Instant Action */}
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
                        const srv = matchedSalon.services.find(
                          (s) => s.id === reel.serviceId || s.name === reel.serviceName
                        );
                        onBookSalon(matchedSalon, srv);
                      } else {
                        handleOpenReel(idx);
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-300 text-slate-950 text-[11px] font-extrabold flex items-center gap-1 shadow-md transition-colors"
                  >
                    <CalendarCheck className="w-3 h-3" />
                    <span>Book</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Fullscreen Video Modal */}
      {activeModalIndex !== null && (
        <SalonVideoReelsModal
          isOpen={activeModalIndex !== null}
          onClose={() => setActiveModalIndex(null)}
          reels={filteredReels}
          initialIndex={activeModalIndex}
          salons={salons}
          onBookSalon={onBookSalon}
          onOpenSalonDetails={onOpenSalonDetails}
        />
      )}
    </section>
  );
};
