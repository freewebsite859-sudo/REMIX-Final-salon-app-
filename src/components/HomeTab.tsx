import React, { useState, useEffect, useRef } from 'react';
import { Salon, Appointment, SalonService, Stylist, UserProfile } from '../types';
import { AppointmentCountdownBanner, parseAppointmentDateTime } from './AppointmentCountdownBanner';

interface HomeTabProps {
  user: UserProfile;
  salons: Salon[];
  upcomingAppointment: Appointment | null;
  savedSalonIds: string[];
  savedServicesCount: number;
  onOpenSalonDetails: (salon: Salon) => void;
  onBookSalon: (salon: Salon, service?: SalonService, stylist?: Stylist) => void;
  onOpenAppointmentDetails: (appointment: Appointment) => void;
  onToggleSaveSalon: (salonId: string) => void;
  onOpenQuickNearest: () => void;
  onOpenAIAdvisor: () => void;
  onSelectCategory: (category: string) => void;
  onSearchSubmit: (query: string) => void;
  onSelectSavedTab: () => void;
}

export const HomeTab: React.FC<HomeTabProps> = ({
  user,
  salons,
  upcomingAppointment,
  savedSalonIds,
  savedServicesCount,
  onOpenSalonDetails,
  onBookSalon,
  onOpenAppointmentDetails,
  onToggleSaveSalon,
  onOpenQuickNearest,
  onOpenAIAdvisor,
  onSelectCategory,
  onSearchSubmit,
  onSelectSavedTab,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [activeSlide, setActiveSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isBannerDismissed, setIsBannerDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('hideBookNearestBanner') === 'true';
    } catch {
      return false;
    }
  });
  const [recentSearches, setRecentSearches] = useState(['Hair Cut', 'Nail Art']);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);

  const handleDismissNearestBanner = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsBannerDismissed(true);
    try {
      localStorage.setItem('hideBookNearestBanner', 'true');
    } catch (err) {
      console.error('Failed to persist banner dismissal:', err);
    }
  };

  const heroSlides = [
    {
      id: 1,
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDhQqjvDEbBv_U3H-mGUIYG4xUDz5bBYqoXi2Yw8UX2YQDin8eW8gCaTmPJt-W5cV9wufCk1ZdofLsNtHHPRuxYgYz-AngmKarA71l_qKZFR15trfV5bYdFqUCRi7HBzN7MJ-ahsWUcs-HBtmmVZYwyVAG3VWy06BfUsXM1JA-_-OgaWxB3sapcJLRGV8MlcDN1RdAv_nswBV80yHn_jleKhRricZZ3lQo9lQWakuzSV9gHDcpJeLhLRQ',
      badge: 'Featured',
      badgeBg: 'bg-primary/90',
      title: 'Premium Styling',
      subtitle: 'Experience the best in class hair artists',
      category: 'Hair Cut',
    },
    {
      id: 2,
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBBZoBwG9VC_WH7e7g0fS6xdG95exWop0NGv607Wh3K_YUE7JoNvbN2H0HPQ-c1ncvY7Ky-PXEyF7R1Z2P_8067B_j8E2OfRPJPpgJmiKXXFqGAYUODZiIWpLuRK3AWiEkbP9jKqCTUbXWAKwCyKmeEEeHY8cSHq2T5beh7pR8hjNXKxf_jDyCfQd57luNOUbSBLb1JynqvIzCmhjdOPKff6D6x_IsPh2DGkgGooqyngd0MtFkyz2rL8g',
      badge: 'Relax',
      badgeBg: 'bg-emerald-600/90',
      title: 'Spa Retreat',
      subtitle: 'Unwind and rejuvenate with herbal therapy',
      category: 'Spa',
    },
    {
      id: 3,
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBW02ALTzDIp-qF-qF1JJVRKpBuauiOaixkhgn2svrDgUAUItBCdEpwJIp7WyPz5WAidOYLazzTluF0-1hKVjtxvyVbsxmCZq9KqoUHMvcFGeDe6t3HkRHbbUxHvATbVCvXJDqPJCAzxpqDJ89bdPcImhU7l7xlrmBzbhJwndjxfp7B4ZY8WqxOYsdDVS-lmyJFEALJ0UWW_p_lQWsCDgLQU0yE-JLXEwJwsh1eFqJi6h6lToF-RnDqEQ',
      badge: 'Trending',
      badgeBg: 'bg-amber-600/90',
      title: 'Nail Artistry',
      subtitle: 'Express yourself with chrome & gel extensions',
      category: 'Nails',
    },
    {
      id: 4,
      image: '/src/assets/images/skin_glow_care_hero_1787077833623.jpg',
      badge: 'Glow Care',
      badgeBg: 'bg-nexora-pink/90',
      title: 'Skin & Glow Care',
      subtitle: 'Rejuvenating facials & hydra therapies',
      category: 'Beauty',
    },
    {
      id: 5,
      image: '/src/assets/images/nail_bridal_art_hero_1787077848463.jpg',
      badge: 'Bridal Art',
      badgeBg: 'bg-purple-600/90',
      title: 'Nail & Bridal Art',
      subtitle: 'Trending nail extensions & luxury makeup',
      category: 'Nail Studio',
    },
  ];

  // Auto-scrolling carousel logic (loops continuously every 4.5 seconds, pauses on hover/touch)
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % heroSlides.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [isPaused, heroSlides.length]);

  const handlePrevSlide = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActiveSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length);
  };

  const handleNextSlide = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActiveSlide((prev) => (prev + 1) % heroSlides.length);
  };

  const exploreCategories = [
    {
      name: 'Hair Cut',
      desc: 'Precision styling & trim',
      icon: 'content_cut',
      query: 'Hair Cut',
      image: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&q=80&w=400',
    },
    {
      name: 'Barber',
      desc: 'Beard trim & grooming',
      icon: 'face',
      query: 'Barber',
      image: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&q=80&w=400',
    },
    {
      name: 'Unisex',
      desc: 'Trendsetting styling',
      icon: 'wc',
      query: 'Unisex',
      image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=400',
    },
    {
      name: 'Salon',
      desc: 'Luxury complete makeover',
      icon: 'storefront',
      query: 'Salon',
      image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=80&w=400',
    },
    {
      name: 'Beauty',
      desc: 'Skincare & aesthetic care',
      icon: 'auto_awesome',
      query: 'Beauty',
      image: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&q=80&w=400',
    },
    {
      name: 'Nail Studio',
      desc: 'Gel manicures & nail art',
      icon: 'dry',
      query: 'Nail Studio',
      image: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&q=80&w=400',
    },
    {
      name: 'Hair Spa',
      desc: 'Deep conditioning & repair',
      icon: 'water_drop',
      query: 'Hair Spa',
      image: 'https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&q=80&w=400',
    },
    {
      name: 'Facial',
      desc: 'Hydra glow & rejuvenation',
      icon: 'spa',
      query: 'Facial & Skin',
      image: 'https://images.unsplash.com/photo-1600180325983-05b18420e980?auto=format&fit=crop&q=80&w=400',
    },
    {
      name: 'Makeup',
      desc: 'Glam & party makeover',
      icon: 'brush',
      query: 'Makeup',
      image: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&q=80&w=400',
    },
    {
      name: 'Massage',
      desc: 'Body therapy & relaxation',
      icon: 'self_improvement',
      query: 'Massage',
      image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&q=80&w=400',
    },
    {
      name: 'Hair Coloring',
      desc: 'Balayage & global tint',
      icon: 'palette',
      query: 'Hair Coloring',
      image: 'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&q=80&w=400',
    },
    {
      name: 'Bridal Makeup',
      desc: 'Royal bridal transformation',
      icon: 'diamond',
      query: 'Bridal Makeup',
      image: 'https://images.unsplash.com/photo-1595476108010-b4d1f10281b1?auto=format&fit=crop&q=80&w=400',
    },
  ];

  const quickFilters = ['Open Now', 'Top Rated', 'Offers', 'At Home', 'Luxury', 'Budget'];

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchInput.trim()) {
      if (!recentSearches.includes(searchInput.trim())) {
        setRecentSearches([searchInput.trim(), ...recentSearches.slice(0, 4)]);
      }
      onSearchSubmit(searchInput.trim());
    }
  };

  const handleRecentClick = (term: string) => {
    setSearchInput(term);
    onSearchSubmit(term);
  };

  const handleFilterToggle = (filter: string) => {
    setSelectedFilter(selectedFilter === filter ? null : filter);
  };

  const filteredSalons = salons.filter((s) => {
    if (selectedFilter === 'Open Now') return s.isOpen;
    if (selectedFilter === 'Top Rated') return s.rating >= 4.8;
    if (selectedFilter === 'Offers') return Boolean(s.discountOffer);
    if (selectedFilter === 'Luxury') return s.priceRange.length >= 3;
    if (selectedFilter === 'Budget') return s.priceRange === '₹' || s.priceRange === '₹₹';
    return true;
  });

  return (
    <div className="flex flex-col w-full pb-28 max-w-4xl mx-auto">
      {/* Greeting Section */}
      <section className="px-page-margin pt-4 pb-3 flex items-start justify-between">
        <div>
          <h1 className="font-hero-heading-mobile text-[24px] sm:text-[28px] font-bold text-on-surface mb-0.5">
            Hello, {user.name}
          </h1>
          <p className="font-body-md text-[14px] text-on-surface-variant">
            Find your perfect beauty experience
          </p>
        </div>
        <button
          onClick={onOpenAIAdvisor}
          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-nexora-pink to-primary text-white text-[12px] font-semibold flex items-center gap-1.5 shadow-sm hover:opacity-90 transition-opacity shrink-0"
        >
          <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
          <span>AI Advisor</span>
        </button>
      </section>

      {/* Featured Stories Carousel */}
      <section className="px-page-margin mb-6">
        <div
          className="relative w-full h-[210px] sm:h-[240px] rounded-2xl overflow-hidden shadow-lg border border-outline-variant/30 group bg-neutral-900"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onTouchStart={() => setIsPaused(true)}
          onTouchEnd={() => setIsPaused(false)}
        >
          {/* Carousel Track */}
          <div
            className="flex w-full h-full transition-transform duration-700 ease-out"
            style={{ transform: `translateX(-${activeSlide * 100}%)` }}
          >
            {heroSlides.map((slide) => (
              <div
                key={slide.id}
                onClick={() => onSelectCategory(slide.category)}
                className="min-w-full w-full h-full relative cursor-pointer shrink-0"
              >
                <img
                  alt={slide.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  src={slide.image}
                  referrerPolicy="no-referrer"
                />

                {/* Dual Gradients for Top Logo Watermark & Bottom Content Readability */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/10 to-black/85" />

                {/* Prominent NEXORA Brand / Logo Overlay */}
                <div className="absolute top-3.5 left-3.5 z-10 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/20 shadow-md">
                  <span className="w-2 h-2 rounded-full bg-nexora-pink animate-pulse" />
                  <span className="text-[11px] font-black tracking-widest text-white uppercase font-display">
                    NEXORA
                  </span>
                </div>

                {/* Top Right Slide Counter */}
                <div className="absolute top-3.5 right-3.5 z-10 text-[10px] font-bold text-white/90 bg-black/50 px-2.5 py-1 rounded-full backdrop-blur-md border border-white/10">
                  0{slide.id} / 0{heroSlides.length}
                </div>

                {/* Bottom Slide Content */}
                <div className="absolute bottom-4 left-4 right-16 text-white z-10 text-left">
                  <span className={`${slide.badgeBg} text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider mb-1.5 inline-block shadow-2xs`}>
                    {slide.badge}
                  </span>
                  <h3 className="font-card-title text-[20px] sm:text-[22px] font-extrabold leading-tight mb-0.5 drop-shadow-sm">
                    {slide.title}
                  </h3>
                  <p className="font-metadata text-[12px] sm:text-[13px] opacity-90 line-clamp-1 drop-shadow-xs">
                    {slide.subtitle}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Left Arrow Button */}
          <button
            type="button"
            onClick={handlePrevSlide}
            aria-label="Previous slide"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-md border border-white/20 transition-all opacity-80 sm:opacity-0 sm:group-hover:opacity-100 active:scale-95"
          >
            <span className="material-symbols-outlined text-[20px]">chevron_left</span>
          </button>

          {/* Right Arrow Button */}
          <button
            type="button"
            onClick={handleNextSlide}
            aria-label="Next slide"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-md border border-white/20 transition-all opacity-80 sm:opacity-0 sm:group-hover:opacity-100 active:scale-95"
          >
            <span className="material-symbols-outlined text-[20px]">chevron_right</span>
          </button>

          {/* Pagination Dots */}
          <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 bg-black/40 px-2.5 py-1 rounded-full backdrop-blur-md border border-white/10">
            {heroSlides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveSlide(i);
                }}
                aria-label={`Go to slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  activeSlide === i ? 'bg-nexora-pink w-5' : 'bg-white/50 hover:bg-white w-1.5'
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Active Upcoming Appointment (Live Countdown Banner if <= 24h, else Standard Card) */}
      {upcomingAppointment && (() => {
        const appointmentDate = parseAppointmentDateTime(upcomingAppointment.date, upcomingAppointment.time);
        const diffMs = appointmentDate.getTime() - Date.now();
        const isWithin24Hours = diffMs > -2 * 60 * 60 * 1000 && diffMs <= 24 * 60 * 60 * 1000;
        const isToday = upcomingAppointment.date === new Date().toISOString().split('T')[0];
        const upcomingSalon = salons.find((s) => s.id === upcomingAppointment.salonId);

        if (isWithin24Hours || isToday) {
          return (
            <AppointmentCountdownBanner
              appointment={upcomingAppointment}
              salon={upcomingSalon}
              onOpenDetails={onOpenAppointmentDetails}
            />
          );
        }

        return (
          <section className="px-page-margin mb-6">
            <div className="bg-primary text-on-primary rounded-2xl p-4 shadow-md relative overflow-hidden">
              <div className="absolute -right-4 -top-4 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none" />
              <div className="absolute -left-4 -bottom-4 w-20 h-20 bg-black/10 rounded-full blur-lg pointer-events-none" />
              <div className="relative z-10 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-1 mb-1 opacity-90">
                    <span className="material-symbols-outlined text-[14px]">schedule</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wider">
                      {upcomingAppointment.date} · {upcomingAppointment.time}
                    </span>
                  </div>
                  <h3 className="font-card-title text-[18px] font-bold mb-1">{upcomingAppointment.salonName}</h3>
                  <p className="font-metadata text-[13px] opacity-90 mb-3">
                    {upcomingAppointment.services[0]?.name} {upcomingAppointment.stylist ? `· ${upcomingAppointment.stylist.name.split(' ')[0]}` : ''}
                  </p>
                </div>
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm shadow-inner">
                  <span className="material-symbols-outlined text-white text-[20px]">calendar_month</span>
                </div>
              </div>
              <button
                onClick={() => onOpenAppointmentDetails(upcomingAppointment)}
                className="relative z-10 w-full py-2.5 bg-white text-primary font-button-text text-[13px] font-bold rounded-xl hover:bg-white/90 transition-colors shadow-sm"
              >
                View Appointment Details
              </button>
            </div>
          </section>
        );
      })()}

      {/* Search Input — 2026 Floating Glass Search */}
      <section className="px-page-margin mb-[22px] relative z-10">
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none z-10">
            <span className="material-symbols-outlined text-[19px] text-[#b00055] group-focus-within:text-[#b00055] transition-colors">
              search
            </span>
          </div>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search salons, services or stylists in Jaipur..."
            className="w-full h-[48px] pl-11 pr-24 bg-[rgba(255,255,255,0.72)] backdrop-blur-[20px] text-on-surface font-body-md text-[13px] rounded-[18px] border border-[rgba(180,0,80,0.15)] shadow-[0_8px_25px_rgba(0,0,0,0.05)] focus:outline-none focus:border-[rgba(176,0,85,0.40)] focus:ring-4 focus:ring-[rgba(176,0,85,0.08)] focus:shadow-[0_0_18px_rgba(176,0,85,0.15)] transition-all duration-200"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => onSearchSubmit(searchInput)}
              className="absolute right-2 top-2 px-3.5 py-1.5 bg-[#b00055] text-white text-[11px] font-semibold rounded-[10px] hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(176,0,85,0.20)] active:scale-95 transition-all duration-180 cursor-pointer"
            >
              Search
            </button>
          )}
        </div>
      </section>

      <div className="flex flex-col">
        {/* Book Again Section — Premium Glass Cards */}
        <section className="-mx-page-margin mb-[24px]">
          <div className="flex items-center justify-between mb-[12px] px-page-margin">
            <h2 className="font-section-heading text-[15px] font-bold text-on-surface">Book Again</h2>
          </div>
          <div className="flex overflow-x-auto no-scrollbar gap-3 px-page-margin pb-1 snap-x">
            {/* Card 1 */}
            <div 
              onClick={() => onSelectCategory('Hair Cut')}
              className="min-w-[280px] sm:min-w-[300px] snap-center bg-white/70 backdrop-blur-[18px] border border-[rgba(180,0,80,0.13)] rounded-[18px] p-3 flex items-center justify-between shadow-[0_8px_25px_rgba(0,0,0,0.045)] cursor-pointer hover:-translate-y-1 hover:scale-[1.01] hover:shadow-[0_14px_32px_rgba(0,0,0,0.08)] hover:border-[rgba(176,0,85,0.20)] active:scale-[0.98] transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[12px] bg-[rgba(255,225,235,0.65)] border border-[rgba(176,0,85,0.08)] flex items-center justify-center text-[#b00055] shrink-0">
                  <span className="material-symbols-outlined text-[20px]">content_cut</span>
                </div>
                <div>
                  <h3 className="font-card-title text-[12px] font-semibold text-on-surface mb-0.5 leading-tight">
                    Hair Cut at Scissors & Shears
                  </h3>
                  <p className="font-metadata text-[10px] text-on-surface-variant">Last booked recently</p>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectCategory('Hair Cut');
                }}
                className="px-3.5 py-2 bg-[#b00055] text-white font-button-text text-[11px] font-semibold rounded-[10px] hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(176,0,85,0.20)] active:scale-95 transition-all duration-180 shrink-0 ml-2 cursor-pointer"
              >
                Book
              </button>
            </div>

            {/* Card 2 */}
            <div 
              onClick={() => onSelectCategory('Facial & Skin')}
              className="min-w-[280px] sm:min-w-[300px] snap-center bg-white/70 backdrop-blur-[18px] border border-[rgba(180,0,80,0.13)] rounded-[18px] p-3 flex items-center justify-between shadow-[0_8px_25px_rgba(0,0,0,0.045)] cursor-pointer hover:-translate-y-1 hover:scale-[1.01] hover:shadow-[0_14px_32px_rgba(0,0,0,0.08)] hover:border-[rgba(176,0,85,0.20)] active:scale-[0.98] transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[12px] bg-[rgba(255,225,235,0.65)] border border-[rgba(176,0,85,0.08)] flex items-center justify-center text-[#b00055] shrink-0">
                  <span className="material-symbols-outlined text-[20px]">spa</span>
                </div>
                <div>
                  <h3 className="font-card-title text-[12px] font-semibold text-on-surface mb-0.5 leading-tight">
                    Hydra Facial Deluxe
                  </h3>
                  <p className="font-metadata text-[10px] text-on-surface-variant">Last booked 2 months ago</p>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectCategory('Facial & Skin');
                }}
                className="px-3.5 py-2 bg-[#b00055] text-white font-button-text text-[11px] font-semibold rounded-[10px] hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(176,0,85,0.20)] active:scale-95 transition-all duration-180 shrink-0 ml-2 cursor-pointer"
              >
                Book
              </button>
            </div>
          </div>
        </section>

        {/* Recent Searches — Compact Glass Chips */}
        {recentSearches.length > 0 && (
          <section className="px-page-margin mb-[24px]">
            <div className="flex items-center justify-between mb-[10px]">
              <h2 className="font-section-heading text-[15px] font-bold text-on-surface">Recent Searches</h2>
              <button
                type="button"
                onClick={() => setRecentSearches([])}
                className="font-button-text text-[11px] font-semibold text-[#b00055] hover:opacity-70 transition-opacity cursor-pointer"
              >
                Clear
              </button>
            </div>
            <div className="flex overflow-x-auto no-scrollbar sm:flex-wrap gap-2 pb-0.5">
              {recentSearches.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => handleRecentClick(term)}
                  className="h-8 px-3.5 bg-white/68 backdrop-blur-[12px] border border-[rgba(176,0,85,0.10)] rounded-full flex items-center gap-1.5 hover:-translate-y-0.5 hover:border-[rgba(176,0,85,0.25)] hover:shadow-xs active:scale-95 transition-all duration-180 text-on-surface text-[11px] font-medium shrink-0 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px] text-[#b00055]/80">history</span>
                  <span>{term}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Trending Section — Premium Trend Chips */}
        <section className="px-page-margin mb-[24px]">
          <h2 className="font-section-heading text-[15px] font-bold text-on-surface mb-[10px]">Trending</h2>
          <div className="flex overflow-x-auto no-scrollbar sm:flex-wrap gap-2 pb-0.5">
            {['Hair Spa', 'Hydra Facial', 'Bridal Makeup', 'Balayage', 'Beard Spa'].map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onSelectCategory(tag)}
                className="h-8 px-3.5 bg-white/70 backdrop-blur-[12px] border border-[rgba(176,0,85,0.15)] rounded-full flex items-center gap-1.5 hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(0,0,0,0.06)] hover:border-[rgba(176,0,85,0.30)] active:scale-[0.97] transition-all duration-180 text-on-surface text-[11px] font-medium shrink-0 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px] text-[#b00055]">trending_up</span>
                <span>{tag}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Exclusive for You - 3 Equal Cinematic Professional Ads in Single Row */}
        <section className="px-page-margin mb-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-section-heading text-on-surface font-bold text-base sm:text-lg">
              Exclusive for You
            </h2>
          </div>

          {/* Grid Container to fit all 3 ad cards simultaneously without overflow */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full pb-2">
            
            {/* Card 1: Deep Pink Cinematic Styling Ad */}
            <div className="rounded-xl p-2.5 sm:p-4 bg-[#780032] border border-nexora-pink/20 shadow-md transition-all duration-300 hover:scale-105 hover:shadow-xl flex flex-col justify-between h-[180px] sm:h-[210px] relative overflow-hidden group">
              {/* Cinematic Commercial Photography Background */}
              <img 
                src="/images/offers/nexora-premium.jpg" 
                alt="Nexora Premium Hair Salon & Styling"
                className="absolute inset-0 w-full h-full object-cover pointer-events-none group-hover:scale-105 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/30 pointer-events-none" />
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[8px] sm:text-[10px] uppercase font-bold tracking-wider bg-white/20 text-white px-1.5 py-0.5 rounded-full backdrop-blur-sm">
                    PROMO
                  </span>
                  <span className="material-symbols-outlined text-white text-[16px] sm:text-[20px] transition-transform duration-300 group-hover:scale-110">
                    local_offer
                  </span>
                </div>
                <h3 className="font-card-title text-xs sm:text-base font-bold text-white leading-tight mb-1 line-clamp-2 group-hover:text-amber-200 transition-colors">
                  20% Off Nexora Premium
                </h3>
                <p className="text-[10px] sm:text-xs text-white/80 line-clamp-2 leading-tight">
                  Hair & grooming packages upgrade.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onBookSalon(salons[0])}
                className="relative z-10 w-full bg-white text-[#780032] font-bold text-[10px] sm:text-xs py-1.5 rounded-lg shadow hover:bg-opacity-90 transition-all active:scale-[0.98] cursor-pointer"
              >
                Claim
              </button>
            </div>

            {/* Card 2: Center High-Contrast Glow Hydra Facial Ad */}
            <div className="rounded-xl p-2.5 sm:p-4 bg-[#0a0a0a] border-2 border-nexora-pink shadow-lg text-white transition-all duration-300 hover:scale-105 hover:shadow-2xl flex flex-col justify-between h-[180px] sm:h-[210px] relative overflow-hidden group">
              {/* Cinematic Commercial Photography Background */}
              <img 
                src="/images/offers/hydra-facial-deluxe.jpg" 
                alt="Hydra Facial Deluxe Clinical Spa Treatment"
                className="absolute inset-0 w-full h-full object-cover pointer-events-none group-hover:scale-105 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
              {/* Subtle dark gradient overlay for text readability & glow accent */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/30 pointer-events-none" />
              <div className="absolute -top-12 -left-12 w-28 h-28 bg-nexora-pink/30 rounded-full blur-3xl pointer-events-none" />
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[8px] sm:text-[10px] uppercase font-bold tracking-wider bg-nexora-pink text-white px-1.5 py-0.5 rounded-full shadow-md shadow-black/30">
                    FEATURED
                  </span>
                  <span className="material-symbols-outlined text-nexora-pink text-[16px] sm:text-[20px] transition-transform duration-300 group-hover:scale-110">
                    spa
                  </span>
                </div>
                <h3 className="font-card-title text-xs sm:text-base font-bold text-white leading-tight mb-1 line-clamp-1">
                  Hydra Facial Deluxe
                </h3>
                <p className="text-[10px] sm:text-xs text-gray-200 line-clamp-2 leading-tight">
                  7-step clinical glow facial package for fresh skin.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onBookSalon(salons[1] || salons[0])}
                className="relative z-10 w-full bg-nexora-pink text-white font-bold text-[10px] sm:text-xs py-1.5 rounded-lg shadow-md hover:bg-opacity-90 transition-all active:scale-[0.98] group-hover:scale-[1.02] cursor-pointer"
              >
                Explore Glow
              </button>
            </div>

            {/* Card 3: Dark Charcoal Cinematic Bridal Pass Ad */}
            <div className="rounded-xl p-2.5 sm:p-4 bg-[#111827] border border-amber-400/20 shadow-md transition-all duration-300 hover:scale-105 hover:shadow-xl flex flex-col justify-between h-[180px] sm:h-[210px] relative overflow-hidden group">
              {/* Cinematic Commercial Photography Background */}
              <img 
                src="/images/offers/bridal-styling-pass.jpg" 
                alt="Luxury Indian Bridal Beauty & Styling Session"
                className="absolute inset-0 w-full h-full object-cover pointer-events-none group-hover:scale-105 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/30 pointer-events-none" />
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[8px] sm:text-[10px] uppercase font-bold tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30 px-1.5 py-0.5 rounded-full backdrop-blur-sm">
                    LIMITED
                  </span>
                  <span className="material-symbols-outlined text-amber-300 text-[16px] sm:text-[20px] transition-transform duration-300 group-hover:scale-110">
                    auto_awesome
                  </span>
                </div>
                <h3 className="font-card-title text-xs sm:text-base font-bold text-white leading-tight mb-1 line-clamp-2 group-hover:text-amber-200 transition-colors">
                  Bridal & Styling Pass
                </h3>
                <p className="text-[10px] sm:text-xs text-slate-300 line-clamp-2 leading-tight">
                  Book top stylists for weddings & events.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSelectCategory('Bridal Makeup')}
                className="relative z-10 w-full bg-amber-400 text-slate-950 font-bold text-[10px] sm:text-xs py-1.5 rounded-lg shadow hover:bg-amber-300 transition-all active:scale-[0.98] cursor-pointer"
              >
                Book Package
              </button>
            </div>

          </div>
        </section>

        {/* Popular Near You Locality Chips */}
        <section className="px-page-margin">
          <h2 className="font-section-heading text-[16px] font-bold text-on-surface mb-2.5">Popular Near You</h2>
          <div className="flex flex-wrap gap-2">
            {['Mansarovar', 'Vaishali Nagar', 'Malviya Nagar', 'C-Scheme'].map((loc) => (
              <button
                key={loc}
                onClick={() => onSearchSubmit(loc)}
                className="h-8 px-3.5 bg-primary-container text-white rounded-full flex items-center gap-1 hover:bg-primary transition-colors text-[12px] font-medium"
              >
                <span className="material-symbols-outlined text-[15px]">location_on</span>
                <span>{loc}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Explore Services 12-Card Glassmorphism Grid */}
        <section className="px-page-margin bg-transparent">
          <div className="flex items-center justify-between mb-3.5">
            <h2 className="font-section-heading text-[16px] font-bold text-on-surface">
              Explore Services
            </h2>
            <span className="text-[11px] font-semibold text-[#b00055]">12 Services</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 sm:gap-4 w-full bg-transparent">
            {exploreCategories.map((cat) => (
              <div
                key={cat.name}
                onClick={() => onSelectCategory(cat.query)}
                className="bg-white/70 backdrop-blur-[18px] border border-white/80 sm:border-[rgba(180,0,80,0.13)] shadow-[0_8px_25px_rgba(0,0,0,0.045)] rounded-[22px] p-3.5 flex flex-col items-center text-center relative overflow-hidden group cursor-pointer hover:scale-[1.05] hover:-translate-y-1.5 hover:shadow-[0_16px_36px_rgba(176,0,85,0.15)] hover:border-[rgba(176,0,85,0.30)] active:scale-[0.98] transition-all duration-300 ease-out before:absolute before:inset-0 before:rounded-[22px] before:bg-gradient-to-b before:from-white/40 before:to-transparent before:pointer-events-none"
              >
                {/* Large Circular Cinematic Photography */}
                <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-full overflow-hidden relative mb-2.5 border-2 border-white/90 shadow-md group-hover:scale-[1.04] transition-transform duration-300 shrink-0">
                  <img
                    src={cat.image}
                    alt={cat.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />
                  {/* Small Elegant Icon Badge Overlay */}
                  <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-[#b00055] text-white flex items-center justify-center shadow-md border border-white/90">
                    <span className="material-symbols-outlined text-[13px]">{cat.icon}</span>
                  </div>
                </div>

                {/* Service Name */}
                <h3 className="font-bold text-[13px] sm:text-[14px] text-on-surface leading-tight mb-1 group-hover:text-[#b00055] transition-colors">
                  {cat.name}
                </h3>

                {/* Short Description */}
                <p className="text-[10px] sm:text-[11px] text-on-surface-variant line-clamp-1 leading-snug opacity-90">
                  {cat.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Filter Pills */}
        <section className="-mx-page-margin">
          <div className="flex overflow-x-auto no-scrollbar gap-2 px-page-margin">
            {quickFilters.map((f) => {
              const isSelected = selectedFilter === f;
              return (
                <button
                  key={f}
                  onClick={() => handleFilterToggle(f)}
                  className={`h-8 px-4 rounded-full flex items-center gap-1 text-[12px] whitespace-nowrap transition-all border ${
                    isSelected
                      ? 'bg-primary text-white border-primary font-semibold shadow-xs'
                      : 'border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container'
                  }`}
                >
                  <span>{f}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Saved for Later Counter Summary */}
        <section className="px-page-margin">
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="font-section-heading text-[16px] font-bold text-on-surface">Saved for Later</h2>
            <button
              onClick={onSelectSavedTab}
              className="font-button-text text-[13px] font-semibold text-nexora-pink hover:underline"
            >
              View Saved
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div
              onClick={onSelectSavedTab}
              className="bg-surface-container-low border border-outline-variant rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:bg-surface-container transition-colors shadow-xs"
            >
              <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-nexora-pink">
                <span className="material-symbols-outlined text-[20px]">store</span>
              </div>
              <div>
                <h3 className="font-card-title text-[14px] font-bold text-on-surface leading-tight">
                  {savedSalonIds.length} Saved
                </h3>
                <p className="text-[11px] text-on-surface-variant">Salons</p>
              </div>
            </div>

            <div
              onClick={onSelectSavedTab}
              className="bg-surface-container-low border border-outline-variant rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:bg-surface-container transition-colors shadow-xs"
            >
              <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-nexora-pink">
                <span className="material-symbols-outlined text-[20px]">spa</span>
              </div>
              <div>
                <h3 className="font-card-title text-[14px] font-bold text-on-surface leading-tight">
                  {savedServicesCount} Saved
                </h3>
                <p className="text-[11px] text-on-surface-variant">Services</p>
              </div>
            </div>
          </div>
        </section>

        {/* Nearby For You Salons Grid */}
        <section className="px-page-margin flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-section-heading text-[17px] font-bold text-on-surface">Nearby for You</h2>
            <span className="text-[12px] text-on-surface-variant">{filteredSalons.length} places</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSalons.map((salon) => {
              const isSaved = savedSalonIds.includes(salon.id);
              return (
                <div
                  key={salon.id}
                  className="bg-surface-container-low rounded-2xl overflow-hidden shadow-xs border border-outline-variant flex flex-col transition-all hover:shadow-md"
                >
                  <div
                    className="relative h-48 cursor-pointer overflow-hidden group"
                    onClick={() => onOpenSalonDetails(salon)}
                  >
                    <img
                      alt={salon.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      src={salon.image}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSaveSalon(salon.id);
                      }}
                      className="absolute top-3 right-3 w-8 h-8 rounded-full bg-surface/80 backdrop-blur-md flex items-center justify-center text-nexora-pink hover:bg-white transition-colors"
                    >
                      <span className={`material-symbols-outlined text-[20px] ${isSaved ? 'fill-1' : ''}`}>
                        favorite
                      </span>
                    </button>
                    <div className="absolute bottom-3 left-3 px-2 py-0.5 bg-success-emerald text-white text-[10px] font-bold rounded uppercase tracking-wider">
                      {salon.isOpen ? 'Open Now' : 'Closed'}
                    </div>
                  </div>

                  <div className="p-4 flex flex-col justify-between flex-1">
                    <div>
                      <div className="flex justify-between items-start mb-1">
                        <h3
                          onClick={() => onOpenSalonDetails(salon)}
                          className="font-card-title text-[16px] font-bold text-on-surface hover:text-nexora-pink cursor-pointer transition-colors"
                        >
                          {salon.name}
                        </h3>
                        <div className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-warning-amber text-[16px] fill-1">star</span>
                          <span className="font-bold text-[13px]">{salon.rating}</span>
                          <span className="text-[11px] text-on-surface-variant">({salon.reviewCount})</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-on-surface-variant mb-1.5 text-[12px]">
                        <span className="material-symbols-outlined text-[14px]">location_on</span>
                        <span>{salon.location.area} · {salon.distance}</span>
                      </div>

                      <p className="text-[12px] text-on-surface-variant mb-4">
                        {salon.categories.join(' · ')}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => onOpenSalonDetails(salon)}
                        className="flex-1 py-2.5 bg-surface-container text-on-surface font-button-text text-[13px] rounded-xl hover:bg-surface-container-high transition-colors"
                      >
                        Details
                      </button>
                      <button
                        onClick={() => onBookSalon(salon)}
                        className="flex-2 py-2.5 bg-primary text-white font-button-text text-[13px] rounded-xl hover:bg-nexora-pink transition-colors shadow-xs"
                      >
                        Book Appointment
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Floating Bottom Quick Action */}
      {!isBannerDismissed && (
        <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom)+12px)] left-0 w-full px-page-margin z-30 pointer-events-none transition-all duration-300 animate-in fade-in slide-in-from-bottom-3">
          <div className="max-w-md mx-auto bg-surface/95 backdrop-blur-md border border-outline-variant/60 p-3 rounded-2xl shadow-xl flex items-center justify-between gap-2.5 pointer-events-auto relative group">
            <div className="flex-1 pr-1">
              <p className="font-card-title text-[13px] font-semibold text-on-surface leading-snug">Need a quick haircut or facial?</p>
            </div>
            <button
              onClick={onOpenQuickNearest}
              className="bg-nexora-pink text-white font-button-text text-[13px] py-2 px-3.5 rounded-xl hover:bg-primary transition-colors flex items-center gap-1.5 shadow-md whitespace-nowrap shrink-0 active:scale-95"
            >
              <span>⚡</span>
              <span>Book Nearest</span>
            </button>
            <button
              onClick={handleDismissNearestBanner}
              aria-label="Dismiss banner"
              id="dismiss-nearest-banner-btn"
              className="w-7 h-7 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container flex items-center justify-center transition-colors shrink-0 active:scale-90"
              title="Dismiss this recommendation"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
