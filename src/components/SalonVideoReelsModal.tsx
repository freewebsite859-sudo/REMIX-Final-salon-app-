import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Volume2,
  VolumeX,
  Heart,
  Share2,
  ChevronUp,
  ChevronDown,
  Play,
  Pause,
  Star,
  Sparkles,
  MapPin,
  CalendarCheck,
  CheckCircle2,
  Scissors,
  ExternalLink,
  RotateCcw
} from 'lucide-react';
import { Salon, SalonVideoReel, SalonService } from '../types';

interface SalonVideoReelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  reels: SalonVideoReel[];
  initialIndex?: number;
  salons: Salon[];
  onBookSalon?: (salon: Salon, service?: SalonService) => void;
  onOpenSalonDetails?: (salon: Salon) => void;
}

export const SalonVideoReelsModal: React.FC<SalonVideoReelsModalProps> = ({
  isOpen,
  onClose,
  reels,
  initialIndex = 0,
  salons,
  onBookSalon,
  onOpenSalonDetails,
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(initialIndex);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [likedReels, setLikedReels] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [copiedToast, setCopiedToast] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [videoError, setVideoError] = useState<boolean>(false);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(Math.max(0, Math.min(initialIndex, reels.length - 1)));
      setIsPlaying(true);
      setVideoError(false);
      setProgress(0);
    }
  }, [isOpen, initialIndex, reels.length]);

  const activeReel = reels[currentIndex] || reels[0];

  const activeSalon = activeReel
    ? salons.find((s) => s.id === activeReel.salonId) || {
        id: activeReel.salonId,
        name: activeReel.salonName,
        image: activeReel.salonImage,
        rating: activeReel.salonRating,
        location: {
          area: activeReel.salonLocation || 'City Center',
          city: 'Jaipur',
          address: activeReel.salonLocation || 'Main Road',
          latitude: 26.85,
          longitude: 75.76,
        },
        services: activeReel.serviceName
          ? [
              {
                id: activeReel.serviceId || 'srv-reel-1',
                name: activeReel.serviceName,
                price: activeReel.servicePrice || 999,
                category: activeReel.category,
                description: activeReel.description || '',
              },
            ]
          : [],
      } as unknown as Salon
    : null;

  const matchedService: SalonService | undefined = activeSalon?.services.find(
    (s) => s.id === activeReel?.serviceId || s.name === activeReel?.serviceName
  ) || (activeReel?.serviceName ? {
    id: activeReel.serviceId || 'srv-reel',
    name: activeReel.serviceName,
    price: activeReel.servicePrice || 999,
    category: activeReel.category,
    description: activeReel.description || '',
  } : undefined);

  // Parse initial likes into numerical state
  useEffect(() => {
    if (activeReel && likeCounts[activeReel.id] === undefined) {
      const parsed = parseFloat(activeReel.likes?.replace(/[^0-9.]/g, '') || '1.8');
      const multiplier = activeReel.likes?.includes('K') ? 1000 : 1;
      setLikeCounts((prev) => ({
        ...prev,
        [activeReel.id]: Math.round(parsed * multiplier),
      }));
    }
  }, [activeReel, likeCounts]);

  const handleNext = useCallback(() => {
    if (currentIndex < reels.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setProgress(0);
      setVideoError(false);
      setIsPlaying(true);
    }
  }, [currentIndex, reels.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setProgress(0);
      setVideoError(false);
      setIsPlaying(true);
    }
  }, [currentIndex]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const toggleLike = () => {
    if (!activeReel) return;
    const isLiked = !likedReels[activeReel.id];
    setLikedReels((prev) => ({ ...prev, [activeReel.id]: isLiked }));
    setLikeCounts((prev) => ({
      ...prev,
      [activeReel.id]: (prev[activeReel.id] || 1500) + (isLiked ? 1 : -1),
    }));
  };

  const handleShare = async () => {
    if (!activeReel) return;
    const shareData = {
      title: `${activeReel.salonName} - ${activeReel.title}`,
      text: `Watch this salon transformation at ${activeReel.salonName} on Nexora!`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // Fallback to clipboard
        await navigator.clipboard.writeText(window.location.href);
        setCopiedToast(true);
        setTimeout(() => setCopiedToast(false), 2500);
      }
    } else {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown' || e.key === 'j') {
        handleNext();
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        handlePrev();
      } else if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'm' || e.key === 'M') {
        toggleMute();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleNext, handlePrev, isPlaying, isMuted, onClose]);

  // Touch Swipe navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY === null) return;
    const touchEndY = e.changedTouches[0].clientY;
    const diff = touchStartY - touchEndY;

    if (diff > 50) {
      // Swiped Up -> Next
      handleNext();
    } else if (diff < -50) {
      // Swiped Down -> Prev
      handlePrev();
    }
    setTouchStartY(null);
  };

  // Update video element on reel switch
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.muted = isMuted;
      videoRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {
          // If browser prevents autoplay with sound, fall back to muted autoplay
          if (videoRef.current) {
            videoRef.current.muted = true;
            setIsMuted(true);
            videoRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
          }
        });
    }
  }, [currentIndex, isMuted]);

  if (!isOpen || !activeReel) return null;

  const currentLikes = likeCounts[activeReel.id] || 1800;
  const isCurrentLiked = !!likedReels[activeReel.id];

  return (
    <div
      id="salon-video-reels-modal"
      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center select-none overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Toast Notification */}
      <AnimatePresence>
        {copiedToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-6 left-1/2 -translate-x-1/2 z-[110] bg-white text-slate-900 px-4 py-2 rounded-full font-bold text-xs shadow-xl flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Link copied to clipboard!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Container */}
      <div className="relative w-full h-full max-w-md md:max-h-[92vh] md:aspect-[9/16] bg-slate-950 md:rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-white/10">
        {/* Top Header Bar */}
        <div className="absolute top-0 inset-x-0 z-30 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 bg-red-600/90 text-white text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full tracking-wider shadow-sm animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />
              Reels
            </span>
            <span className="text-white/80 text-xs font-semibold">
              {currentIndex + 1} / {reels.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Sound Toggle */}
            <button
              onClick={toggleMute}
              className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/60 transition-colors border border-white/10"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-white" />}
            </button>

            {/* Close Modal */}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/60 transition-colors border border-white/10"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Video Canvas Layer */}
        <div
          onClick={togglePlay}
          className="relative flex-1 w-full h-full flex items-center justify-center bg-black cursor-pointer overflow-hidden"
        >
          {!videoError ? (
            <video
              ref={videoRef}
              key={activeReel.videoUrl}
              src={activeReel.videoUrl}
              poster={activeReel.thumbnailUrl}
              playsInline
              loop
              autoPlay
              muted={isMuted}
              onTimeUpdate={() => {
                if (videoRef.current) {
                  const curr = videoRef.current.currentTime;
                  const dur = videoRef.current.duration || 1;
                  setProgress((curr / dur) * 100);
                }
              }}
              onError={() => setVideoError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="relative w-full h-full flex flex-col items-center justify-center bg-slate-900">
              <img
                src={activeReel.thumbnailUrl}
                alt={activeReel.title}
                className="w-full h-full object-cover opacity-60"
              />
              <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center p-6 text-center">
                <Sparkles className="w-12 h-12 text-amber-400 mb-3 animate-bounce" />
                <h4 className="text-white font-bold text-lg mb-1">{activeReel.title}</h4>
                <p className="text-white/70 text-xs max-w-xs mb-4">High-definition salon transformation preview</p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setVideoError(false);
                  }}
                  className="px-4 py-2 rounded-full bg-white/20 text-white text-xs font-semibold flex items-center gap-2 hover:bg-white/30"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reload Preview</span>
                </button>
              </div>
            </div>
          )}

          {/* Pause / Play central indicator overlay */}
          <AnimatePresence>
            {!isPlaying && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
              >
                <div className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white border border-white/20 shadow-2xl">
                  <Play className="w-8 h-8 ml-1 text-white fill-white" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Right Action Sidebar (Likes, Share, Navigation) */}
          <div className="absolute right-3 bottom-28 z-30 flex flex-col items-center gap-4">
            {/* Like Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleLike();
              }}
              className="flex flex-col items-center group cursor-pointer"
            >
              <div
                className={`w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md transition-transform active:scale-90 border ${
                  isCurrentLiked
                    ? 'bg-rose-500/90 text-white border-rose-400 shadow-lg shadow-rose-500/30'
                    : 'bg-black/40 text-white border-white/15 hover:bg-black/60'
                }`}
              >
                <Heart
                  className={`w-5 h-5 ${isCurrentLiked ? 'fill-white text-white scale-110' : 'text-white'}`}
                />
              </div>
              <span className="text-[11px] font-bold text-white mt-1 drop-shadow">
                {currentLikes > 999 ? `${(currentLikes / 1000).toFixed(1)}k` : currentLikes}
              </span>
            </button>

            {/* Share Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleShare();
              }}
              className="flex flex-col items-center group cursor-pointer"
            >
              <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md text-white border border-white/15 flex items-center justify-center hover:bg-black/60 transition-transform active:scale-90">
                <Share2 className="w-5 h-5 text-white" />
              </div>
              <span className="text-[11px] font-bold text-white mt-1 drop-shadow">Share</span>
            </button>

            {/* Up Button (Previous Reel) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              disabled={currentIndex === 0}
              className={`w-9 h-9 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10 transition-colors ${
                currentIndex === 0 ? 'opacity-30 cursor-not-allowed text-white/40' : 'text-white hover:bg-black/70'
              }`}
              title="Previous Reel (Arrow Up)"
            >
              <ChevronUp className="w-5 h-5" />
            </button>

            {/* Down Button (Next Reel) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              disabled={currentIndex === reels.length - 1}
              className={`w-9 h-9 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10 transition-colors ${
                currentIndex === reels.length - 1
                  ? 'opacity-30 cursor-not-allowed text-white/40'
                  : 'text-white hover:bg-black/70'
              }`}
              title="Next Reel (Arrow Down)"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>

          {/* Bottom Video Information & Service Card Overlay */}
          <div className="absolute bottom-0 inset-x-0 z-30 p-4 pb-6 bg-gradient-to-t from-black via-black/70 to-transparent flex flex-col gap-3">
            {/* Salon Profile Tag */}
            <div className="flex items-center justify-between">
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  if (activeSalon && onOpenSalonDetails) {
                    onClose();
                    onOpenSalonDetails(activeSalon);
                  }
                }}
                className="flex items-center gap-2.5 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/15 cursor-pointer hover:bg-black/60 transition-colors group"
              >
                <img
                  src={activeReel.salonImage}
                  alt={activeReel.salonName}
                  className="w-7 h-7 rounded-full object-cover ring-1 ring-amber-400"
                />
                <div className="flex flex-col">
                  <div className="flex items-center gap-1">
                    <span className="text-white font-bold text-xs truncate max-w-[140px] group-hover:text-amber-300">
                      {activeReel.salonName}
                    </span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0 fill-blue-400/20" />
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-white/70">
                    <span className="flex items-center text-amber-300 font-semibold">
                      <Star className="w-2.5 h-2.5 fill-amber-300 mr-0.5" />
                      {activeReel.salonRating.toFixed(1)}
                    </span>
                    <span>•</span>
                    <span className="truncate max-w-[90px]">{activeReel.salonLocation || 'Jaipur'}</span>
                  </div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-white/60 ml-0.5 group-hover:text-white" />
              </div>

              {activeReel.stylistName && (
                <span className="text-[11px] text-white/80 bg-white/10 px-2.5 py-1 rounded-full backdrop-blur-sm border border-white/10 font-medium">
                  By {activeReel.stylistName}
                </span>
              )}
            </div>

            {/* Title & Description */}
            <div className="flex flex-col gap-1 pr-14">
              <h3 className="text-white font-extrabold text-sm md:text-base leading-snug drop-shadow line-clamp-2">
                {activeReel.title}
              </h3>
              {activeReel.description && (
                <p className="text-white/80 text-xs line-clamp-2 leading-relaxed font-normal">
                  {activeReel.description}
                </p>
              )}
              {activeReel.tags && activeReel.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {activeReel.tags.map((tag) => (
                    <span key={tag} className="text-[11px] text-amber-300/90 font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Featured Live Service Booking Card */}
            {activeReel.serviceName && activeSalon && (
              <div className="mt-1 bg-white/95 backdrop-blur-md rounded-2xl p-2.5 flex items-center justify-between border border-white shadow-xl">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                    <Scissors className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                      Featured Transformation
                    </span>
                    <span className="text-xs font-extrabold text-slate-900 truncate">
                      {activeReel.serviceName}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-slate-900">
                        ₹{activeReel.servicePrice || 750}
                      </span>
                      {activeReel.duration && (
                        <span className="text-[10px] text-slate-500">({activeReel.duration})</span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onBookSalon) {
                      onClose();
                      onBookSalon(activeSalon, matchedService);
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shrink-0 shadow-md flex items-center gap-1.5 transition-transform active:scale-95"
                >
                  <CalendarCheck className="w-3.5 h-3.5 text-amber-300" />
                  <span>Book Now</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Video Progress Bar */}
        <div className="absolute bottom-0 inset-x-0 h-1 bg-white/20 z-40">
          <div
            className="h-full bg-amber-400 transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};
