import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Salon, GalleryPhoto } from '../types';

interface SalonPhotoGalleryProps {
  salon: Salon;
  initialCategory?: string;
  onBookTreatment?: (treatmentName?: string) => void;
  className?: string;
}

type GalleryCategory = 'all' | 'interior' | 'hair' | 'skin' | 'nails' | 'spa' | 'bridal';

export const SalonPhotoGallery: React.FC<SalonPhotoGalleryProps> = ({
  salon,
  initialCategory = 'all',
  onBookTreatment,
  className = '',
}) => {
  const [activeCategory, setActiveCategory] = useState<GalleryCategory>(initialCategory as GalleryCategory);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);
  const [lightboxZoom, setLightboxZoom] = useState<number>(1);
  const thumbnailStripRef = useRef<HTMLDivElement>(null);

  // Prepare photos list: Use salon.photoGallery if present, otherwise construct from gallery & image
  const allPhotos: GalleryPhoto[] = useMemo(() => {
    if (salon.photoGallery && salon.photoGallery.length > 0) {
      return salon.photoGallery;
    }

    // Default fallback photos tailored to the salon's categories
    const fallbackList: GalleryPhoto[] = [];

    // Main cover
    fallbackList.push({
      id: `${salon.id}-cov`,
      url: salon.image,
      title: `${salon.name} - Front View & Ambience`,
      category: 'interior',
      tag: 'Main Ambience',
      description: 'Modern aesthetic entryway with welcoming concierge and sanitized styling stations.',
    });

    // Gallery array items
    (salon.gallery || []).forEach((imgUrl, idx) => {
      if (imgUrl === salon.image && idx === 0) return; // avoid exact duplicate
      const isHair = salon.categories.some(c => /hair|cut|barber|style/i.test(c));
      const isSkin = salon.categories.some(c => /skin|facial|glow/i.test(c));
      const isNails = salon.categories.some(c => /nail|art/i.test(c));
      const isSpa = salon.categories.some(c => /spa|massage|ayurveda/i.test(c));

      const cat: GalleryCategory = idx % 2 === 0
        ? 'interior'
        : isHair ? 'hair' : isSkin ? 'skin' : isNails ? 'nails' : isSpa ? 'spa' : 'hair';

      fallbackList.push({
        id: `${salon.id}-gal-${idx}`,
        url: imgUrl,
        title: idx % 2 === 0 ? 'Interior Styling Station' : 'Finished Treatment Transformation',
        category: cat,
        tag: idx % 2 === 0 ? 'Interior Ambience' : 'Finished Look',
        description: 'Premium equipment and professional grade care delivered by certified specialists.',
        stylistName: salon.stylists?.[0]?.name,
      });
    });

    // Add extra curated photos based on salon categories
    if (salon.categories.some(c => /hair|barber/i.test(c))) {
      fallbackList.push({
        id: `${salon.id}-hair-1`,
        url: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1000&q=80',
        title: 'Ergonomic Styling & Blowout Stations',
        category: 'interior',
        tag: 'Styling Floor',
        description: 'Spacious stations equipped with Dyson professional styling tools and LED mirrors.',
      });
      fallbackList.push({
        id: `${salon.id}-hair-2`,
        url: 'https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&w=1000&q=80',
        title: 'Honey Blonde Balayage & Gloss Finish',
        category: 'hair',
        tag: 'Finished Look',
        treatmentName: 'Signature Balayage & Blow Dry',
        description: 'Multi-tonal dimension created with ammonia-free conditioning pigments.',
        stylistName: salon.stylists?.[0]?.name || 'Senior Colorist',
      });
    }

    if (salon.categories.some(c => /skin|facial|beauty/i.test(c))) {
      fallbackList.push({
        id: `${salon.id}-skin-1`,
        url: 'https://images.unsplash.com/photo-1629732047847-50219e9c5aef?auto=format&fit=crop&w=1000&q=80',
        title: 'Private Clinical Aesthetic Suite',
        category: 'interior',
        tag: 'VIP Suite',
        description: 'Sterilized private room dedicated for hydra-facials, collagen lifts, and skin therapies.',
      });
      fallbackList.push({
        id: `${salon.id}-skin-2`,
        url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=1000&q=80',
        title: 'Hydra-Facial Deep Infusion & Glass Glow',
        category: 'skin',
        tag: 'Finished Look',
        treatmentName: '7-Step Hydra Facial Deluxe',
        description: 'Noticeably clearer pores, reduced pigmentation, and instantaneous luminous glow.',
        stylistName: salon.stylists?.[0]?.name,
      });
    }

    if (salon.categories.some(c => /spa|wellness|massage/i.test(c))) {
      fallbackList.push({
        id: `${salon.id}-spa-1`,
        url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1000&q=80',
        title: 'Ayurvedic Aromatherapy Sanctuary',
        category: 'interior',
        tag: 'Spa Suite',
        description: 'Calming ambient lighting, aromatic essential oil misting, and soothing herbal music.',
      });
    }

    if (salon.categories.some(c => /nail/i.test(c))) {
      fallbackList.push({
        id: `${salon.id}-nail-1`,
        url: 'https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=1000&q=80',
        title: '500+ Shade Gel Art & Chrome Display',
        category: 'interior',
        tag: 'Studio Interior',
        description: 'Curated premium gel polishes and sterile Russian manicure apparatus.',
      });
      fallbackList.push({
        id: `${salon.id}-nail-2`,
        url: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=1000&q=80',
        title: 'Glazed Chrome Almond Gel Extensions',
        category: 'nails',
        tag: 'Finished Look',
        treatmentName: 'Gel Extensions with Hand-Painted Art',
        description: 'Chip-resistant glossy finish with bespoke chrome reflection.',
        stylistName: salon.stylists?.[0]?.name,
      });
    }

    return fallbackList;
  }, [salon]);

  // Filter photos based on active category
  const filteredPhotos = useMemo(() => {
    if (activeCategory === 'all') return allPhotos;
    return allPhotos.filter((p) => p.category === activeCategory);
  }, [allPhotos, activeCategory]);

  // Ensure current index is within bounds when category changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [activeCategory]);

  const activePhoto = filteredPhotos[currentIndex] || filteredPhotos[0] || allPhotos[0];

  // Auto-play slideshow timer
  useEffect(() => {
    if (!isPlaying || filteredPhotos.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % filteredPhotos.length);
    }, 3800);
    return () => clearInterval(timer);
  }, [isPlaying, filteredPhotos.length]);

  // Scroll active thumbnail into view
  useEffect(() => {
    if (thumbnailStripRef.current) {
      const activeThumb = thumbnailStripRef.current.children[currentIndex] as HTMLElement;
      if (activeThumb) {
        activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [currentIndex]);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % filteredPhotos.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + filteredPhotos.length) % filteredPhotos.length);
  };

  const handleOpenLightbox = (index: number) => {
    setCurrentIndex(index);
    setLightboxZoom(1);
    setIsLightboxOpen(true);
  };

  const handleCloseLightbox = () => {
    setIsLightboxOpen(false);
    setLightboxZoom(1);
  };

  // Keyboard navigation for Lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isLightboxOpen) return;
      if (e.key === 'Escape') handleCloseLightbox();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLightboxOpen, filteredPhotos.length]);

  // Count photos per category for badges
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allPhotos.length };
    allPhotos.forEach((p) => {
      counts[p.category] = (counts[p.category] || 0) + 1;
    });
    return counts;
  }, [allPhotos]);

  // Category labels and icons
  const categoryOptions = [
    { key: 'all', label: 'All Photos', icon: 'photo_library' },
    { key: 'interior', label: 'Salon Interior', icon: 'storefront' },
    { key: 'hair', label: 'Hair & Styling', icon: 'content_cut' },
    { key: 'skin', label: 'Skin & Facials', icon: 'face' },
    { key: 'nails', label: 'Nails & Polish', icon: 'brush' },
    { key: 'spa', label: 'Spa & Wellness', icon: 'spa' },
  ].filter((opt) => opt.key === 'all' || (categoryCounts[opt.key] && categoryCounts[opt.key] > 0));

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'interior':
        return 'bg-blue-600/90 text-white';
      case 'hair':
        return 'bg-purple-600/90 text-white';
      case 'skin':
        return 'bg-pink-600/90 text-white';
      case 'nails':
        return 'bg-amber-600/90 text-white';
      case 'spa':
        return 'bg-emerald-600/90 text-white';
      default:
        return 'bg-primary text-white';
    }
  };

  if (!activePhoto) return null;

  return (
    <div 
      id="salon-photo-gallery-carousel" 
      className={`flex flex-col gap-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/40 p-3.5 sm:p-4 shadow-sm ${className}`}
    >
      {/* 1. Header with Title and Category Filter Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">collections</span>
            <h3 className="font-card-title text-[15px] font-bold text-on-surface">
              Interior & Treatment Gallery
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
              {allPhotos.length} Photos
            </span>
          </div>
          <p className="text-[11px] text-on-surface-variant mt-0.5">
            Real snapshots of styling stations, private treatment suites, and verified client finishes
          </p>
        </div>

        {/* Carousel Auto-play / Controls */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold flex items-center gap-1 transition-all ${
              isPlaying
                ? 'bg-primary text-white shadow-2xs'
                : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'
            }`}
            title={isPlaying ? 'Pause Slideshow' : 'Play Slideshow'}
          >
            <span className="material-symbols-outlined text-[14px]">
              {isPlaying ? 'pause' : 'play_arrow'}
            </span>
            <span>{isPlaying ? 'Playing' : 'Slideshow'}</span>
          </button>

          <button
            onClick={() => handleOpenLightbox(currentIndex)}
            className="p-1.5 rounded-xl bg-surface-container-low text-on-surface-variant hover:text-on-surface transition-colors"
            title="Expand Fullscreen"
            aria-label="Expand image"
          >
            <span className="material-symbols-outlined text-[16px]">fullscreen</span>
          </button>
        </div>
      </div>

      {/* 2. Category Filter Pills */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {categoryOptions.map((opt) => {
          const isSelected = activeCategory === opt.key;
          const count = categoryCounts[opt.key] || 0;
          return (
            <button
              key={opt.key}
              onClick={() => setActiveCategory(opt.key as GalleryCategory)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                isSelected
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">{opt.icon}</span>
              <span>{opt.label}</span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded-full ${
                isSelected ? 'bg-white/20 text-white' : 'bg-surface-container-highest text-on-surface-variant'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. Main Hero Carousel Stage */}
      <div className="relative w-full h-64 sm:h-80 rounded-2xl overflow-hidden bg-surface-container-highest group shadow-inner border border-outline-variant/30">
        {/* Main Image */}
        <img
          src={activePhoto.url}
          alt={activePhoto.title}
          onClick={() => handleOpenLightbox(currentIndex)}
          className="w-full h-full object-cover cursor-zoom-in transition-transform duration-500 ease-out group-hover:scale-102"
        />

        {/* Gradient Scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/30 pointer-events-none" />

        {/* Top Badges: Category, Tag & Slide Counter */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10 pointer-events-none">
          <div className="flex items-center gap-1.5">
            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold backdrop-blur-md shadow-xs uppercase tracking-wider flex items-center gap-1 ${getCategoryBadgeClass(activePhoto.category)}`}>
              <span className="material-symbols-outlined text-[12px]">
                {activePhoto.category === 'interior' ? 'storefront' : 'sparkles'}
              </span>
              {activePhoto.category === 'interior' ? 'Salon Interior' : `${activePhoto.category.toUpperCase()} Treatment`}
            </span>

            {activePhoto.tag && (
              <span className="px-2 py-0.5 rounded-lg bg-black/50 text-white/90 text-[10px] font-medium backdrop-blur-md border border-white/20">
                {activePhoto.tag}
              </span>
            )}
          </div>

          {/* Photo Index Counter */}
          <div className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[11px] font-semibold border border-white/20 shadow-xs flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px]">image</span>
            <span>{currentIndex + 1} / {filteredPhotos.length}</span>
          </div>
        </div>

        {/* Navigation Arrow Controls */}
        {filteredPhotos.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 text-white backdrop-blur-md flex items-center justify-center hover:bg-black/80 hover:scale-105 active:scale-95 transition-all shadow-md z-10"
              aria-label="Previous photo"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_left</span>
            </button>
            <button
              onClick={handleNext}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 text-white backdrop-blur-md flex items-center justify-center hover:bg-black/80 hover:scale-105 active:scale-95 transition-all shadow-md z-10"
              aria-label="Next photo"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
            </button>
          </>
        )}

        {/* Bottom Caption & Treatment Metadata Bar */}
        <div className="absolute bottom-0 left-0 right-0 p-3.5 sm:p-4 text-white z-10 flex flex-col gap-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-card-title text-[15px] font-bold leading-tight drop-shadow-sm truncate">
                {activePhoto.title}
              </h4>
              {activePhoto.description && (
                <p className="text-[11px] text-white/80 line-clamp-2 mt-0.5 drop-shadow-xs">
                  {activePhoto.description}
                </p>
              )}
            </div>

            {/* Book This Treatment CTA if available */}
            {activePhoto.treatmentName && onBookTreatment && (
              <button
                onClick={() => onBookTreatment(activePhoto.treatmentName)}
                className="shrink-0 px-3 py-1.5 rounded-xl bg-primary text-white text-[11px] font-bold hover:bg-nexora-pink transition-colors shadow-md flex items-center gap-1"
              >
                <span>Book This</span>
                <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
              </button>
            )}
          </div>

          {/* Stylist or Treatment Attribution Tags */}
          <div className="flex flex-wrap items-center gap-2 mt-1 pt-1 border-t border-white/15 text-[10px] text-white/90">
            {activePhoto.stylistName && (
              <span className="flex items-center gap-1 bg-white/15 px-2 py-0.5 rounded-md backdrop-blur-xs">
                <span className="material-symbols-outlined text-[11px] text-warning-amber">star</span>
                Stylist: <strong className="text-white font-semibold">{activePhoto.stylistName}</strong>
              </span>
            )}
            {activePhoto.treatmentName && (
              <span className="flex items-center gap-1 bg-white/15 px-2 py-0.5 rounded-md backdrop-blur-xs">
                <span className="material-symbols-outlined text-[11px] text-nexora-pink">spa</span>
                Service: <strong className="text-white font-semibold">{activePhoto.treatmentName}</strong>
              </span>
            )}
            <span className="ml-auto text-white/60 text-[9px] hidden sm:inline">
              Tap photo to zoom
            </span>
          </div>
        </div>
      </div>

      {/* 4. Interactive Horizontal Thumbnail Strip */}
      {filteredPhotos.length > 1 && (
        <div 
          ref={thumbnailStripRef}
          className="flex gap-2 overflow-x-auto no-scrollbar py-1 px-0.5 scroll-smooth"
        >
          {filteredPhotos.map((photo, idx) => {
            const isActive = idx === currentIndex;
            return (
              <button
                key={photo.id}
                onClick={() => setCurrentIndex(idx)}
                className={`relative w-18 sm:w-20 h-14 sm:h-16 rounded-xl overflow-hidden shrink-0 transition-all transform ${
                  isActive
                    ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface scale-102 shadow-sm'
                    : 'opacity-65 hover:opacity-100 hover:scale-98'
                }`}
                title={photo.title}
                aria-label={`View photo ${idx + 1}: ${photo.title}`}
              >
                <img
                  src={photo.url}
                  alt={photo.title}
                  className="w-full h-full object-cover"
                />
                {/* Category tiny badge dot */}
                <span className={`absolute top-1 right-1 w-2 h-2 rounded-full ${
                  photo.category === 'interior' ? 'bg-blue-500' : 'bg-nexora-pink'
                }`} />
                {isActive && (
                  <div className="absolute inset-0 bg-primary/10 border-2 border-primary rounded-xl" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* 5. Fullscreen Immersive Lightbox Modal */}
      {isLightboxOpen && (
        <div className="fixed inset-0 z-60 bg-black/95 backdrop-blur-md flex flex-col justify-between p-3 sm:p-6 animate-in fade-in duration-200">
          {/* Lightbox Top Header */}
          <div className="flex items-center justify-between text-white z-10">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getCategoryBadgeClass(activePhoto.category)}`}>
                {activePhoto.category}
              </span>
              <h4 className="font-card-title text-[14px] font-bold truncate max-w-[200px] sm:max-w-md">
                {activePhoto.title}
              </h4>
            </div>

            {/* Lightbox Actions */}
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-white/70">
                {currentIndex + 1} of {filteredPhotos.length}
              </span>

              {/* Zoom Controls */}
              <div className="hidden sm:flex items-center gap-1 bg-white/10 p-1 rounded-xl">
                <button
                  onClick={() => setLightboxZoom((prev) => Math.max(prev - 0.25, 0.75))}
                  className="w-7 h-7 rounded-lg text-white hover:bg-white/20 flex items-center justify-center text-[15px] font-bold"
                  title="Zoom Out"
                >
                  −
                </button>
                <span className="text-[11px] px-1 font-mono">{Math.round(lightboxZoom * 100)}%</span>
                <button
                  onClick={() => setLightboxZoom((prev) => Math.min(prev + 0.25, 2.5))}
                  className="w-7 h-7 rounded-lg text-white hover:bg-white/20 flex items-center justify-center text-[15px] font-bold"
                  title="Zoom In"
                >
                  +
                </button>
                <button
                  onClick={() => setLightboxZoom(1)}
                  className="px-2 py-0.5 rounded-lg text-white/80 hover:bg-white/20 text-[10px]"
                >
                  Reset
                </button>
              </div>

              <button
                onClick={handleCloseLightbox}
                className="w-9 h-9 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition-colors"
                aria-label="Close Lightbox"
              >
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>
          </div>

          {/* Lightbox Center Stage with Navigation Arrows */}
          <div className="relative flex-1 flex items-center justify-center my-2 overflow-hidden">
            {filteredPhotos.length > 1 && (
              <button
                onClick={handlePrev}
                className="absolute left-2 sm:left-6 w-11 h-11 rounded-full bg-black/60 text-white backdrop-blur-md flex items-center justify-center hover:bg-black/90 transition-all z-20"
                aria-label="Previous photo"
              >
                <span className="material-symbols-outlined text-[24px]">chevron_left</span>
              </button>
            )}

            <div 
              className="max-w-5xl max-h-[75vh] flex items-center justify-center transition-transform duration-200"
              style={{ transform: `scale(${lightboxZoom})` }}
            >
              <img
                src={activePhoto.url}
                alt={activePhoto.title}
                className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-2xl"
              />
            </div>

            {filteredPhotos.length > 1 && (
              <button
                onClick={handleNext}
                className="absolute right-2 sm:right-6 w-11 h-11 rounded-full bg-black/60 text-white backdrop-blur-md flex items-center justify-center hover:bg-black/90 transition-all z-20"
                aria-label="Next photo"
              >
                <span className="material-symbols-outlined text-[24px]">chevron_right</span>
              </button>
            )}
          </div>

          {/* Lightbox Bottom Footer with details and thumbnail jump */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-white z-10 pt-2 border-t border-white/10">
            <div className="flex-1 text-center sm:text-left">
              <p className="text-[12px] text-white/90 font-medium">
                {activePhoto.description || activePhoto.title}
              </p>
              {activePhoto.treatmentName && (
                <p className="text-[11px] text-nexora-pink font-semibold mt-0.5">
                  Treatment: {activePhoto.treatmentName} {activePhoto.stylistName ? `· Stylist: ${activePhoto.stylistName}` : ''}
                </p>
              )}
            </div>

            {/* Quick mini thumbnail strip */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar max-w-full sm:max-w-md py-1">
              {filteredPhotos.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => setCurrentIndex(i)}
                  className={`w-10 h-8 rounded-lg overflow-hidden shrink-0 border transition-all ${
                    i === currentIndex ? 'border-primary ring-2 ring-primary' : 'border-white/30 opacity-50 hover:opacity-100'
                  }`}
                >
                  <img src={p.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
