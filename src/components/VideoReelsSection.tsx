import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
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
  Volume2,
  VolumeX,
  Radio,
  MapPin,
  ExternalLink
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
  /** Currently playing video ID managed at App level for single concurrent playback */
  playingVideoId?: string | null;
  /** Callback when active playing video changes */
  onPlayingVideoChange?: (videoId: string | null) => void;
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
 * Single Video Reel Card with synchronized autoplay management and high-conversion Book Now overlay
 */
interface ReelCardProps {
  reel: SalonVideoReel;
  index: number;
  isPlaying: boolean;
  isHovered: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  matchedSalon?: Salon;
  onHover: (id: string | null) => void;
  onCardClick: (index: number) => void;
  onBook: (matchedSalon?: Salon, reel?: SalonVideoReel) => void;
  onOpenSalonDetails?: (salon: Salon) => void;
  registerRef: (id: string, el: HTMLDivElement | null) => void;
}

const ReelCard: React.FC<ReelCardProps> = ({
  reel,
  index,
  isPlaying,
  isHovered,
  isMuted,
  onToggleMute,
  matchedSalon,
  onHover,
  onCardClick,
  onBook,
  onOpenSalonDetails,
  registerRef,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState<boolean>(false);

  // Synchronize HTML5 video playback strictly with isPlaying and isMuted states
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = isMuted;

    let isSubscribed = true;
    if (isPlaying) {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            if (isSubscribed) {
              setIsVideoLoaded(true);
            }
          })
          .catch((err: unknown) => {
            // Handle browser gesture policy or rapid switch aborts gracefully
            if (err instanceof Error && err.name === 'AbortError') {
              return;
            }
            if (!video.muted) {
              video.muted = true;
              video.play().catch(() => {});
            }
          });
      }
    } else {
      video.pause();
    }

    return () => {
      isSubscribed = false;
    };
  }, [isPlaying, isMuted]);

  const salonDisplayName = matchedSalon?.name || reel.salonName;
  const salonLocation =
    matchedSalon?.location?.area ||
    matchedSalon?.location?.city ||
    (matchedSalon?.location?.address ? matchedSalon.location.address.split(',')[0] : 'Verified Salon');

  return (
    <div
      ref={(el) => registerRef(reel.id, el)}
      data-reel-id={reel.id}
      onMouseEnter={() => onHover(reel.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onCardClick(index)}
      className={`group relative flex-none w-[185px] sm:w-[205px] md:w-[225px] aspect-[9/16] rounded-2xl overflow-hidden bg-slate-950 border transition-all duration-500 ease-out transform snap-start cursor-pointer select-none ${
        isPlaying
          ? 'border-rose-500 ring-2 ring-rose-500/50 shadow-2xl -translate-y-1'
          : 'border-slate-800 shadow-md hover:shadow-xl hover:-translate-y-1 hover:border-slate-700'
      }`}
    >
      {/* Media Thumbnail & Controlled Autoplay Video with Smooth Crossfade */}
      <div className="absolute inset-0 w-full h-full bg-slate-950">
        <img
          src={reel.thumbnailUrl}
          alt={reel.title}
          className={`w-full h-full object-cover transition-all duration-500 ease-out ${
            isPlaying && isVideoLoaded ? 'scale-105 opacity-0' : 'scale-100 opacity-100'
          }`}
          loading="lazy"
        />

        {/* Video Element rendered with smooth opacity transition */}
        <video
          ref={videoRef}
          src={reel.videoUrl}
          playsInline
          muted={isMuted}
          loop
          preload="metadata"
          onLoadedData={() => setIsVideoLoaded(true)}
          onCanPlay={() => setIsVideoLoaded(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ease-out ${
            isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        />
      </div>

      {/* Multi-step Gradient Scrim for Pristine Contrast & Text Readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 via-55% to-black/75 pointer-events-none" />

      {/* Top Header: Salon Identification Chip & Audio Controls */}
      <div className="absolute top-2.5 inset-x-2.5 z-10 flex items-start justify-between gap-1.5">
        {/* Clickable Salon Brand Chip */}
        <button
          type="button"
          onClick={(e) => {
            if (matchedSalon && onOpenSalonDetails) {
              e.stopPropagation();
              onOpenSalonDetails(matchedSalon);
            }
          }}
          className="flex items-center gap-1.5 bg-black/60 hover:bg-black/85 backdrop-blur-md pl-1 pr-2.5 py-1 rounded-full border border-white/20 max-w-[68%] transition-all text-left group/chip shadow-md"
          title={`View ${salonDisplayName} profile`}
        >
          <div className="w-5 h-5 rounded-full p-[1px] bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-500 shrink-0">
            <img
              src={matchedSalon?.image || reel.salonImage}
              alt={salonDisplayName}
              className="w-full h-full rounded-full object-cover"
            />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-0.5">
              <span className="text-[11px] font-bold text-white truncate group-hover/chip:text-amber-300 transition-colors">
                {salonDisplayName}
              </span>
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
            </div>
            <span className="text-[8.5px] text-white/70 truncate flex items-center gap-0.5">
              <MapPin className="w-2 h-2 text-rose-400 shrink-0" />
              {salonLocation}
            </span>
          </div>
        </button>

        {/* Live Status Badge & Sound Toggle */}
        <div className="flex items-center gap-1">
          {isPlaying && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleMute();
              }}
              title={isMuted ? 'Unmute video audio' : 'Mute video audio'}
              className="w-6 h-6 rounded-full bg-black/70 hover:bg-black backdrop-blur-md border border-white/25 flex items-center justify-center text-white transition-transform hover:scale-110 cursor-pointer shadow-xs"
            >
              {!isMuted ? (
                <Volume2 className="w-3 h-3 text-rose-400 animate-pulse" />
              ) : (
                <VolumeX className="w-3 h-3 text-white/80" />
              )}
            </button>
          )}

          {isPlaying ? (
            <span className="text-[9.5px] font-black text-white bg-rose-600/95 backdrop-blur-md px-1.5 py-0.5 rounded-md border border-rose-400/50 flex items-center gap-1 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
              PLAYING
            </span>
          ) : reel.duration ? (
            <span className="text-[9.5px] font-bold text-white/90 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded-md border border-white/15 flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5 text-amber-300" />
              {reel.duration}
            </span>
          ) : null}
        </div>
      </div>

      {/* Center Interactive Overlay: Watch Story / Expand Indicator */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 transition-all duration-300 px-3">
        {!isPlaying ? (
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={`w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-xl transition-transform duration-300 ${
                isHovered ? 'scale-110 bg-rose-600/90 border-rose-300 shadow-rose-600/40' : 'group-hover:scale-105'
              }`}
            >
              <Play className="w-4 h-4 fill-white ml-0.5 text-white" />
            </div>
            <span className="text-[10px] font-bold text-white/90 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10 opacity-90 group-hover:opacity-100 transition-opacity">
              Tap to Watch Story
            </span>
          </div>
        ) : (
          <div
            className={`transition-opacity duration-300 ${
              isHovered ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <span className="text-[10px] font-bold text-white bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/20 shadow-lg flex items-center gap-1">
              <ExternalLink className="w-3 h-3 text-amber-300" />
              Full Screen Reel
            </span>
          </div>
        )}
      </div>

      {/* Prominent High-Conversion Booking Overlay at Bottom */}
      <div className="absolute bottom-0 inset-x-0 p-2.5 z-10 flex flex-col gap-1.5 bg-gradient-to-t from-black via-black/90 to-transparent pt-6">
        {/* Salon Representation Tag & Metrics */}
        <div className="flex items-center justify-between text-[10.5px]">
          <div className="flex items-center gap-1">
            <span className="flex items-center gap-0.5 bg-amber-400 text-slate-950 font-black px-1.5 py-0.5 rounded text-[9.5px]">
              <Star className="w-2.5 h-2.5 fill-slate-950" />
              {reel.salonRating.toFixed(1)}
            </span>
            <span className="text-[9.5px] text-white/80 font-medium flex items-center gap-0.5">
              <Eye className="w-2.5 h-2.5 text-white/60" />
              {reel.views || '12K'}
            </span>
          </div>

          {reel.servicePrice ? (
            <div className="flex items-center gap-1 bg-white/15 backdrop-blur-md px-1.5 py-0.5 rounded border border-white/20">
              <span className="text-[8.5px] uppercase font-semibold text-white/80">From</span>
              <span className="text-[11px] font-black text-amber-300">₹{reel.servicePrice}</span>
            </div>
          ) : (
            <span className="text-[9.5px] font-semibold text-rose-300 truncate">{reel.category}</span>
          )}
        </div>

        {/* Video Service Title */}
        <h3 className="text-white text-[11.5px] font-bold leading-tight line-clamp-2 drop-shadow-sm">
          {reel.title}
        </h3>

        {/* Prominent 'Book Now' Call To Action Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onBook(matchedSalon, reel);
          }}
          className="w-full mt-0.5 py-1.5 px-3 rounded-xl bg-gradient-to-r from-rose-500 via-rose-600 to-amber-500 hover:from-rose-600 hover:to-amber-600 active:scale-[0.98] text-white text-[11.5px] font-black flex items-center justify-center gap-1.5 shadow-lg shadow-rose-950/50 transition-all cursor-pointer border border-rose-400/40 group/btn"
          title={`Book appointment at ${salonDisplayName}`}
        >
          <CalendarCheck className="w-3.5 h-3.5 text-white group-hover/btn:scale-110 transition-transform" />
          <span className="truncate">Book at {salonDisplayName.split(' ')[0]}</span>
        </button>
      </div>
    </div>
  );
};

/**
 * VideoReelsSection displays a scrollable, horizontal list of salon promotional videos.
 * Features synchronized autoplay observer ensuring ONLY ONE video plays at any given time.
 */
export const VideoReelsSection: React.FC<VideoReelsSectionProps> = ({
  salons: passedSalons,
  onBookSalon,
  onOpenSalonDetails,
  title = 'Watch Salon Promotional Videos',
  subtitle = 'Explore live salon transformations, stylist craft reels, and exclusive promotional offers',
  className = '',
  playingVideoId: controlledPlayingVideoId,
  onPlayingVideoChange,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [activeModalIndex, setActiveModalIndex] = useState<number | null>(null);
  const [hoveredReelId, setHoveredReelId] = useState<string | null>(null);
  const [internalPlayingId, setInternalPlayingId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(true);

  const activePlayingId = controlledPlayingVideoId !== undefined ? controlledPlayingVideoId : internalPlayingId;

  const handleUpdatePlayingId = useCallback((id: string | null) => {
    if (onPlayingVideoChange) {
      onPlayingVideoChange(id);
    } else {
      setInternalPlayingId(id);
    }
  }, [onPlayingVideoChange]);

  const sectionRef = useRef<HTMLElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const cardElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  const registerCardRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) {
      cardElementsRef.current.set(id, el);
    } else {
      cardElementsRef.current.delete(id);
    }
  }, []);

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

  // ---------------------------------------------------------------------------
  // AUTOPLAY INTERSECTION OBSERVER
  // Observes video reel elements as user scrolls vertically and horizontally.
  // Guarantees strictly ONE video autoplays and ONLY when at least 50% visible in the viewport.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;
    if (activeModalIndex !== null) return; // Modal owns playback

    const visibilityRatios = new Map<string, number>();
    let debounceTimer: number | undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const reelId = entry.target.getAttribute('data-reel-id');
          if (!reelId) return;

          // Strict 50% visibility check: video must be at least 50% in the viewport
          if (entry.isIntersecting && entry.intersectionRatio >= 0.50) {
            visibilityRatios.set(reelId, entry.intersectionRatio);
          } else {
            visibilityRatios.delete(reelId);
          }
        });

        // Debounce slightly to ensure butter-smooth transitions while scrolling
        if (debounceTimer) window.clearTimeout(debounceTimer);
        debounceTimer = window.setTimeout(() => {
          let bestId: string | null = null;
          let maxRatio = 0;

          visibilityRatios.forEach((ratio, id) => {
            if (ratio > maxRatio) {
              maxRatio = ratio;
              bestId = id;
            }
          });

          // Ensure videos only autoplay when they are at least 50% visible in the viewport
          if (bestId && maxRatio >= 0.50) {
            handleUpdatePlayingId(bestId);
          } else if (visibilityRatios.size === 0) {
            // Scrolled past or under 50% visibility
            handleUpdatePlayingId(null);
          }
        }, 80);
      },
      {
        root: null, // Viewport
        threshold: [0, 0.25, 0.50, 0.60, 0.75, 1.0],
      }
    );

    const cards = Array.from(cardElementsRef.current.values());
    cards.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => {
      if (debounceTimer) window.clearTimeout(debounceTimer);
      observer.disconnect();
    };
  }, [filteredReels, activeModalIndex, handleUpdatePlayingId]);

  // Handle horizontal scrolling to center-align the playing video card with 50% visibility threshold
  const handleScrollCalculateCenter = useCallback(() => {
    if (!scrollContainerRef.current || activeModalIndex !== null) return;
    const container = scrollContainerRef.current;
    const containerRect = container.getBoundingClientRect();
    const containerCenterX = containerRect.left + containerRect.width / 2;

    // Viewport vertical visibility check for the container
    const isContainerVisibleInViewport =
      containerRect.bottom > 0 &&
      containerRect.top < window.innerHeight &&
      (Math.min(containerRect.bottom, window.innerHeight) - Math.max(containerRect.top, 0)) /
        containerRect.height >=
        0.4;

    if (!isContainerVisibleInViewport) {
      handleUpdatePlayingId(null);
      return;
    }

    let closestReelId: string | null = null;
    let minDistance = Number.POSITIVE_INFINITY;
    let highestRatio = 0;

    cardElementsRef.current.forEach((el, id) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cardCenterX = rect.left + rect.width / 2;
      const dist = Math.abs(containerCenterX - cardCenterX);

      // Calculate horizontal visibility ratio inside container
      const visibleWidth = Math.max(0, Math.min(rect.right, containerRect.right) - Math.max(rect.left, containerRect.left));
      const horizontalRatio = rect.width > 0 ? visibleWidth / rect.width : 0;

      // Calculate vertical visibility in viewport
      const visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
      const verticalRatio = rect.height > 0 ? visibleHeight / rect.height : 0;

      // Strict requirement: video must be at least 50% visible both horizontally & vertically
      if (horizontalRatio >= 0.50 && verticalRatio >= 0.50) {
        if (dist < minDistance) {
          minDistance = dist;
          closestReelId = id;
          highestRatio = Math.min(horizontalRatio, verticalRatio);
        }
      }
    });

    if (closestReelId && highestRatio >= 0.50) {
      handleUpdatePlayingId(closestReelId);
    } else {
      handleUpdatePlayingId(null);
    }
  }, [activeModalIndex, handleUpdatePlayingId]);

  // Attach passive scroll listener for horizontal touch / mouse wheel scrolling
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let timeoutId: number | undefined;
    const onScroll = () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(handleScrollCalculateCenter, 120);
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      container.removeEventListener('scroll', onScroll);
    };
  }, [handleScrollCalculateCenter]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollDistance = 340;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollDistance : scrollDistance,
        behavior: 'smooth',
      });
      window.setTimeout(handleScrollCalculateCenter, 300);
    }
  };

  const handleOpenReel = (reelIndex: number) => {
    const reel = filteredReels[reelIndex];
    if (reel) {
      handleUpdatePlayingId(reel.id);
    }
    setActiveModalIndex(reelIndex);
  };

  const handleCardHover = (id: string | null) => {
    setHoveredReelId(id);
    if (id) {
      handleUpdatePlayingId(id);
    }
  };

  const handleBookFromReel = (matchedSalon?: Salon, reel?: SalonVideoReel) => {
    if (onBookSalon && matchedSalon) {
      const srv = matchedSalon.services?.find(
        (s) => s.id === reel?.serviceId || s.name === reel?.serviceName
      );
      onBookSalon(matchedSalon, srv);
    } else if (reel) {
      const idx = filteredReels.findIndex((r) => r.id === reel.id);
      if (idx >= 0) handleOpenReel(idx);
    }
  };

  return (
    <section
      ref={sectionRef}
      id="video-reels-section"
      className={`w-full ${className}`}
    >
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

        {/* Header Controls: Mute/Unmute Toggle & Desktop Carousel Arrows */}
        <div className="flex items-center gap-2 self-start md:self-end">
          {/* Mute / Unmute Toggle Button */}
          <button
            type="button"
            id="video-reels-mute-toggle"
            onClick={() => setIsMuted((m) => !m)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
              !isMuted
                ? 'bg-rose-600 text-white border-rose-500 shadow-rose-500/20'
                : 'bg-white dark:bg-slate-900 border-outline-variant/60 text-on-surface hover:bg-surface-container-high'
            }`}
            title={isMuted ? 'Unmute video audio' : 'Mute video audio'}
            aria-label={isMuted ? 'Unmute preview videos' : 'Mute preview videos'}
          >
            {!isMuted ? (
              <>
                <Volume2 className="w-3.5 h-3.5 text-white animate-pulse" />
                <span>Sound On</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                <span>Muted</span>
              </>
            )}
          </button>

          {/* Desktop Carousel Scroll Arrows */}
          <div className="hidden md:flex items-center gap-2">
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
          const isPlaying = (activePlayingId === reel.id || isHovered) && activeModalIndex === null;
          const matchedSalon = effectiveSalons.find((s) => s.id === reel.salonId);

          return (
            <ReelCard
              key={reel.id}
              reel={reel}
              index={idx}
              isPlaying={isPlaying}
              isHovered={isHovered}
              isMuted={isMuted}
              onToggleMute={() => setIsMuted((m) => !m)}
              matchedSalon={matchedSalon}
              onHover={handleCardHover}
              onCardClick={handleOpenReel}
              onBook={handleBookFromReel}
              onOpenSalonDetails={onOpenSalonDetails}
              registerRef={registerCardRef}
            />
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

