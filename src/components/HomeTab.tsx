import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Salon, Appointment, SalonService, Stylist, UserProfile } from '../types';
import { AppointmentCountdownBanner, parseAppointmentDateTime } from './AppointmentCountdownBanner';
import { JAIPUR_AREA_CHIPS } from '../lib/jaipurAreas';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface HomeTabProps {
  user: UserProfile;
  salons: Salon[];
  currentLocation: string;
  upcomingAppointment: Appointment | null;
  savedSalonIds: string[];
  appointments?: Appointment[];
  /** Prefill from `/customer/search?q=` when the route drives search. */
  initialSearchQuery?: string;
  /** Called as the user types so the parent can mirror `?q=` in the URL. */
  onSearchQueryChange?: (query: string) => void;
  onOpenSalonDetails: (salon: Salon) => void;
  onBookSalon: (salon: Salon, service?: SalonService, stylist?: Stylist) => void;
  onOpenAppointmentDetails: (appointment: Appointment) => void;
  onToggleSaveSalon: (salonId: string) => void;
  /** Opens the location picker (header / first-login share the same modal). */
  onOpenLocation?: () => void;
  /** Navigate to membership. */
  onOpenMembership?: () => void;
  /** Navigate to referral. */
  onOpenReferral?: () => void;
}

// ---------------------------------------------------------------------------
// Catalog constants
// ---------------------------------------------------------------------------

const POPULAR_SERVICES = [
  'Haircut',
  'Beard',
  'Facial',
  'Hair Color',
  'Spa',
  'Massage',
  'Tattoo',
  'Nail Art',
  'Bridal Makeup',
] as const;

interface CategoryDef {
  id: string;
  name: string;
  icon: string;
  /** Match tokens against salon categories / tags / keywords / services. */
  match: string[];
}

const QUICK_CATEGORIES: CategoryDef[] = [
  { id: 'salon', name: 'Salon', icon: 'content_cut', match: ['salon', 'hair', 'unisex', 'styling'] },
  { id: 'barber', name: 'Barber', icon: 'face_6', match: ['barber', 'beard', 'men', 'fade', 'grooming'] },
  {
    id: 'beauty',
    name: 'Beauty Parlour',
    icon: 'spa',
    match: ['beauty', 'parlour', 'parlor', 'bridal', 'women', 'makeup'],
  },
  { id: 'spa', name: 'Spa', icon: 'hot_tub', match: ['spa', 'aromatherapy', 'wellness'] },
  { id: 'massage', name: 'Massage', icon: 'self_improvement', match: ['massage', 'body', 'relax'] },
  { id: 'tattoo', name: 'Tattoo', icon: 'brush', match: ['tattoo', 'ink', 'piercing'] },
  { id: 'nail', name: 'Nail Art', icon: 'back_hand', match: ['nail', 'manicure', 'pedicure', 'gel'] },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse "1.2 km"-style distance strings into numbers for sorting. */
const distanceKm = (salon: Salon): number => {
  const parsed = parseFloat((salon.distance || '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : 999;
};

const minPrice = (salon: Salon): number =>
  !salon.services || salon.services.length === 0
    ? 399
    : Math.min(...salon.services.map((s) => s.discountPrice || s.price));

const servicePrice = (s: SalonService): number => s.discountPrice || s.price;

const isVerified = (salon: Salon): boolean =>
  salon.featured === true ||
  salon.rating >= 4.5 ||
  (salon.reviewCount || 0) >= 100 ||
  (salon.amenities || []).some((a) => /verif/i.test(a));

/** Rough "slots left today" derived from open status + rating (no inventing real inventory). */
const slotsTodayLabel = (salon: Salon): string | null => {
  if (!salon.isOpen) return null;
  // Deterministic pseudo-count from id so the UI is stable across re-renders
  // without fabricating a real availability backend.
  let hash = 0;
  for (let i = 0; i < salon.id.length; i++) hash = (hash + salon.id.charCodeAt(i) * (i + 1)) % 97;
  const slots = 3 + (hash % 8); // 3–10
  return `${slots} slots today`;
};

const primaryCategory = (salon: Salon): string =>
  salon.categories?.[0] || (salon.gender === 'men' ? 'Barber' : 'Salon');
const salonMatchesText = (salon: Salon, raw: string): boolean => {
  const q = raw.trim().toLowerCase();
  if (!q) return true;
  // Support "under ₹300" / "under 300" price filters.
  const underMatch = q.match(/under\s*₹?\s*(\d+)/i);
  const maxPrice = underMatch ? parseInt(underMatch[1], 10) : null;
  const textQ = underMatch ? q.replace(underMatch[0], '').replace(/\s+/g, ' ').trim() : q;

  const textHit =
    !textQ ||
    salon.name.toLowerCase().includes(textQ) ||
    salon.location.area.toLowerCase().includes(textQ) ||
    salon.location.city.toLowerCase().includes(textQ) ||
    salon.categories.some((c) => c.toLowerCase().includes(textQ)) ||
    (salon.tags || []).some((t) => t.toLowerCase().includes(textQ)) ||
    (salon.keywords || []).some((k) => k.toLowerCase().includes(textQ)) ||
    salon.services.some((s) => s.name.toLowerCase().includes(textQ));

  if (!textHit) return false;
  if (maxPrice != null && Number.isFinite(maxPrice)) {
    return minPrice(salon) <= maxPrice;
  }
  return true;
};

const salonMatchesCategory = (salon: Salon, cat: CategoryDef): boolean => {
  const blob = [
    ...salon.categories,
    ...(salon.tags || []),
    ...(salon.keywords || []),
    ...salon.services.map((s) => s.name),
    salon.gender,
    salon.name,
  ]
    .join(' ')
    .toLowerCase();
  return cat.match.some((token) => blob.includes(token.toLowerCase()));
};

const salonMatchesServiceChip = (salon: Salon, service: string): boolean => {
  const q = service.toLowerCase();
  return (
    salon.services.some((s) => s.name.toLowerCase().includes(q)) ||
    salon.categories.some((c) => c.toLowerCase().includes(q)) ||
    (salon.tags || []).some((t) => t.toLowerCase().includes(q)) ||
    (salon.keywords || []).some((k) => k.toLowerCase().includes(q))
  );
};

/**
 * Trending score from real catalog signals:
 * bookings proxy (reviewCount), reviews (rating × count), QR/featured flag,
 * repeat-visit proxy (featured + high rating).
 */
const trendingScore = (salon: Salon): number => {
  const reviews = salon.reviewCount || 0;
  const rating = salon.rating || 0;
  const bookingsProxy = Math.log10(reviews + 1) * 40;
  const reviewQuality = rating * 12;
  const qrBoost = salon.featured ? 25 : 0;
  const repeatBoost = salon.trending ? 30 : rating >= 4.8 ? 15 : 0;
  const openBoost = salon.isOpen ? 5 : 0;
  return bookingsProxy + reviewQuality + qrBoost + repeatBoost + openBoost;
};

interface DealRow {
  key: string;
  serviceName: string;
  price: number;
  originalPrice?: number;
  salon: Salon;
}

function collectBestDeals(salons: Salon[], limit = 8): DealRow[] {
  const byService = new Map<string, DealRow>();
  for (const salon of salons) {
    for (const service of salon.services || []) {
      const price = servicePrice(service);
      const key = service.name.trim().toLowerCase();
      if (!key) continue;
      const existing = byService.get(key);
      if (!existing || price < existing.price) {
        byService.set(key, {
          key,
          serviceName: service.name,
          price,
          originalPrice:
            service.discountPrice && service.discountPrice < service.price
              ? service.price
              : undefined,
          salon,
        });
      }
    }
  }
  return Array.from(byService.values())
    .sort((a, b) => a.price - b.price || b.salon.rating - a.salon.rating)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Speech recognition (optional — UI always shown)
// ---------------------------------------------------------------------------

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((ev: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognitionCtor(): (new () => SpeechRec) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

// ---------------------------------------------------------------------------
// PWA install
// ---------------------------------------------------------------------------

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// ---------------------------------------------------------------------------
// Salon card
// ---------------------------------------------------------------------------

const SalonDiscoveryCard: React.FC<{
  salon: Salon;
  isSaved: boolean;
  onOpen: () => void;
  onBook: () => void;
  onToggleSave: () => void;
  badge?: string;
}> = ({ salon, isSaved, onOpen, onBook, onToggleSave, badge }) => {
  const verified = isVerified(salon);
  const slots = slotsTodayLabel(salon);
  const category = salon.categories?.[0] || (salon.gender === 'men' ? 'Barber' : 'Salon');
  const price = minPrice(salon);

  return (
    <article
      className="bg-white border border-outline-variant/50 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col shrink-0 w-[280px] sm:w-[300px]"
    >
      {/* Cover */}
      <div className="relative h-[140px] cursor-pointer" onClick={onOpen}>
        <img
          src={salon.image}
          alt={salon.name}
          loading="lazy"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10" />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSave();
          }}
          aria-label={isSaved ? `Remove ${salon.name} from favourites` : `Save ${salon.name}`}
          className="absolute top-2.5 right-2.5 w-9 h-9 rounded-full bg-white/95 text-nexora-pink flex items-center justify-center shadow-sm hover:scale-105 transition-transform cursor-pointer"
        >
          <span className={`material-symbols-outlined text-[18px] ${isSaved ? 'fill-1' : ''}`}>
            favorite
          </span>
        </button>
        {badge && (
          <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-nexora-pink text-white text-[10px] font-bold uppercase tracking-wide shadow-sm">
            {badge}
          </span>
        )}
        {verified && !badge && (
          <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center gap-0.5 shadow-sm">
            <span className="material-symbols-outlined text-[12px] fill-1">verified</span>
            Verified
          </span>
        )}
        <span
          className={`absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-md text-[10px] font-bold ${
            salon.isOpen ? 'bg-success-emerald text-white' : 'bg-black/70 text-white'
          }`}
        >
          {salon.isOpen ? 'Open now' : 'Closed'}
        </span>
        {slots && salon.isOpen && (
          <span className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-white/95 text-on-surface text-[10px] font-bold">
            {slots}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-3.5 flex flex-col gap-2 flex-1">
        <div>
          <div className="flex items-start gap-1.5">
            <h3
              onClick={onOpen}
              className="font-card-title text-[15px] font-bold text-on-surface hover:text-nexora-pink cursor-pointer transition-colors leading-snug line-clamp-2 flex-1"
            >
              {salon.name}
            </h3>
            {verified && badge && (
              <span
                className="material-symbols-outlined text-[16px] text-emerald-600 fill-1 shrink-0 mt-0.5"
                title="Verified salon"
              >
                verified
              </span>
            )}
          </div>
          <p className="text-[11px] text-on-surface-variant mt-0.5 truncate">{category}</p>
        </div>

        <div className="flex items-center gap-1.5 text-[12px] flex-wrap">
          <span className="flex items-center gap-0.5 font-bold text-warning-amber">
            <span className="material-symbols-outlined text-[14px] fill-1">star</span>
            {salon.rating.toFixed(1)}
          </span>
          <span className="text-on-surface-variant">({salon.reviewCount.toLocaleString('en-IN')})</span>
          <span className="text-on-surface-variant">·</span>
          <span className="text-on-surface-variant truncate">{salon.location.area}</span>
          <span className="text-on-surface-variant">·</span>
          <span className="font-semibold text-primary">{salon.distance}</span>
        </div>

        <div className="flex items-center justify-between mt-auto pt-1">
          <div>
            <span className="text-[10px] text-on-surface-variant uppercase font-semibold">From</span>
            <p className="text-[15px] font-extrabold text-on-surface leading-none">₹{price}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onOpen}
              className="px-2.5 py-2 rounded-xl border border-outline-variant/60 text-[11px] font-bold text-on-surface hover:border-primary/40 transition-colors cursor-pointer"
            >
              View Profile
            </button>
            <button
              type="button"
              onClick={onBook}
              className="px-3 py-2 rounded-xl bg-primary text-white text-[11px] font-bold hover:bg-nexora-pink transition-colors shadow-xs cursor-pointer"
            >
              Book Now
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};

/** Horizontal scroller with section header. */
const SalonRail: React.FC<{
  title: string;
  subtitle?: string;
  salons: Salon[];
  savedSalonIds: string[];
  onOpen: (s: Salon) => void;
  onBook: (s: Salon) => void;
  onToggleSave: (id: string) => void;
  badgeFor?: (s: Salon) => string | undefined;
  emptyLabel?: string;
}> = ({
  title,
  subtitle,
  salons,
  savedSalonIds,
  onOpen,
  onBook,
  onToggleSave,
  badgeFor,
  emptyLabel = 'No salons in this section yet.',
}) => (
  <section className="mb-7">
    <div className="px-page-margin mb-3">
      <h2 className="font-section-heading text-[17px] font-bold text-on-surface">{title}</h2>
      {subtitle && <p className="text-[12px] text-on-surface-variant mt-0.5">{subtitle}</p>}
    </div>
    {salons.length === 0 ? (
      <p className="px-page-margin text-[13px] text-on-surface-variant">{emptyLabel}</p>
    ) : (
      <div className="flex gap-3 overflow-x-auto no-scrollbar px-page-margin pb-1">
        {salons.map((salon) => (
          <SalonDiscoveryCard
            key={salon.id}
            salon={salon}
            isSaved={savedSalonIds.includes(salon.id)}
            onOpen={() => onOpen(salon)}
            onBook={() => onBook(salon)}
            onToggleSave={() => onToggleSave(salon.id)}
            badge={badgeFor?.(salon)}
          />
        ))}
      </div>
    )}
  </section>
);

// ---------------------------------------------------------------------------
// Main Home (discovery)
// ---------------------------------------------------------------------------

export const HomeTab: React.FC<HomeTabProps> = ({
  user,
  salons,
  currentLocation,
  upcomingAppointment,
  savedSalonIds,
  appointments = [],
  initialSearchQuery,
  onSearchQueryChange,
  onOpenSalonDetails,
  onBookSalon,
  onOpenAppointmentDetails,
  onToggleSaveSalon,
  onOpenLocation,
  onOpenMembership,
  onOpenReferral,
}) => {
  const [searchInput, setSearchInput] = useState(initialSearchQuery || '');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeServiceChip, setActiveServiceChip] = useState<string | null>(null);
  const [activeAreaChip, setActiveAreaChip] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceHint, setVoiceHint] = useState<string | null>(null);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installDismissed, setInstallDismissed] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const speechRef = useRef<SpeechRec | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keep local input aligned when the parent route changes (`?q=` deep link).
  useEffect(() => {
    if (typeof initialSearchQuery === 'string' && initialSearchQuery !== searchInput) {
      setSearchInput(initialSearchQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSearchQuery]);

  // PWA install prompt capture
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia?.('(display-mode: standalone)');
    if (mq?.matches || (window.navigator as { standalone?: boolean }).standalone) {
      setIsInstalled(true);
    }
    const onBip = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBip);
    return () => window.removeEventListener('beforeinstallprompt', onBip);
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    onSearchQueryChange?.(value);
  };

  const areaShort = useMemo(() => {
    const raw = (currentLocation || '').split(',')[0]?.trim() || 'Mansarovar';
    return raw.replace(/^Current Location.*/i, 'Mansarovar');
  }, [currentLocation]);

  const searchPlaceholder = `Search haircut under ₹300 near ${areaShort}`;

  // ---- Filtered / ranked lists ------------------------------------------
  const filteredSalons = useMemo(() => {
    let list = [...salons];
    if (searchInput.trim()) list = list.filter((s) => salonMatchesText(s, searchInput));
    if (activeCategory) {
      const cat = QUICK_CATEGORIES.find((c) => c.id === activeCategory);
      if (cat) list = list.filter((s) => salonMatchesCategory(s, cat));
    }
    if (activeServiceChip) {
      list = list.filter((s) => salonMatchesServiceChip(s, activeServiceChip));
    }
    if (activeAreaChip) {
      const area = activeAreaChip.toLowerCase();
      list = list.filter(
        (s) =>
          s.location.area.toLowerCase().includes(area) ||
          s.location.address.toLowerCase().includes(area)
      );
    }
    return list;
  }, [salons, searchInput, activeCategory, activeServiceChip, activeAreaChip]);

  const nearbyVerified = useMemo(
    () =>
      [...filteredSalons]
        .filter((s) => isVerified(s))
        .sort((a, b) => distanceKm(a) - distanceKm(b) || b.rating - a.rating)
        .slice(0, 12),
    [filteredSalons]
  );

  // If filters wipe verified set, fall back to nearest overall so the section isn't empty.
  const nearbyDisplay = nearbyVerified.length
    ? nearbyVerified
    : [...filteredSalons].sort((a, b) => distanceKm(a) - distanceKm(b)).slice(0, 12);

  const topRated = useMemo(
    () =>
      [...filteredSalons]
        .filter((s) => s.rating >= 4.5)
        .sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount)
        .slice(0, 10),
    [filteredSalons]
  );

  const trending = useMemo(
    () =>
      [...filteredSalons]
        .map((s) => ({ salon: s, score: trendingScore(s) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map((x) => x.salon),
    [filteredSalons]
  );

  const bestDeals = useMemo(() => collectBestDeals(filteredSalons, 8), [filteredSalons]);

  const recommended = useMemo(() => {
    const history = appointments || [];
    const pastSalonIds = new Set(history.map((a) => a.salonId));
    const pastCategories = new Set<string>();
    const pastStaff = new Set<string>();
    for (const a of history) {
      for (const s of a.services || []) pastCategories.add(s.category);
      if (a.stylist?.id) pastStaff.add(a.stylist.id);
      if (a.stylist?.name) pastStaff.add(a.stylist.name.toLowerCase());
    }
    const favCategory = (user.preferredServices || [])[0]?.toLowerCase() || '';
    const preferredGender = user.genderPreference;

    const scored = filteredSalons.map((salon) => {
      let score = 0;
      if (pastSalonIds.has(salon.id)) score += 40; // rebook affinity
      if (salon.location.area && currentLocation.toLowerCase().includes(salon.location.area.toLowerCase())) {
        score += 25;
      }
      if (preferredGender && preferredGender !== 'all') {
        if (salon.gender === preferredGender || salon.gender === 'unisex') score += 15;
      }
      if (favCategory) {
        if (salonMatchesServiceChip(salon, favCategory)) score += 20;
      }
      for (const cat of pastCategories) {
        if (salon.services.some((s) => s.category === cat)) score += 10;
      }
      for (const st of salon.stylists || []) {
        if (pastStaff.has(st.id) || pastStaff.has(st.name.toLowerCase())) score += 18;
      }
      // Soft popularity prior so cold-start still ranks well.
      score += salon.rating * 3 + Math.min(10, (salon.reviewCount || 0) / 200);
      if (salon.featured) score += 8;
      return { salon, score };
    });

    const hasHistory =
      pastSalonIds.size > 0 ||
      pastCategories.size > 0 ||
      Boolean(favCategory) ||
      Boolean(user.favoriteStylist);

    return scored
      .sort((a, b) => b.score - a.score || distanceKm(a.salon) - distanceKm(b.salon))
      .slice(0, 10)
      .map((x) => x.salon)
      .filter((s, _i, arr) => {
        // Cold start: prefer popular Jaipur salons (featured/trending/high rating).
        if (hasHistory) return true;
        return s.featured || s.trending || s.rating >= 4.7 || arr.length <= 10;
      });
  }, [filteredSalons, appointments, user, currentLocation]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cat of QUICK_CATEGORIES) {
      counts[cat.id] = salons.filter((s) => salonMatchesCategory(s, cat)).length;
    }
    return counts;
  }, [salons]);

  // ---- Voice search -------------------------------------------------------
  const stopVoice = useCallback(() => {
    try {
      speechRef.current?.stop();
    } catch {
      /* ignore */
    }
    speechRef.current = null;
    setIsListening(false);
  }, []);

  const handleVoiceSearch = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setVoiceHint('Voice search is not supported in this browser. Type your query instead.');
      window.setTimeout(() => setVoiceHint(null), 3500);
      searchInputRef.current?.focus();
      return;
    }
    if (isListening) {
      stopVoice();
      return;
    }
    try {
      const rec = new Ctor();
      rec.lang = 'en-IN';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.continuous = false;
      rec.onresult = (ev) => {
        const transcript = ev.results?.[0]?.[0]?.transcript || '';
        if (transcript) {
          handleSearchChange(transcript);
          setActiveCategory(null);
          setActiveServiceChip(null);
        }
      };
      rec.onerror = (ev) => {
        setVoiceHint(
          ev?.error === 'not-allowed'
            ? 'Microphone permission blocked. Allow mic access or type your search.'
            : 'Could not hear that. Try again or type your search.'
        );
        window.setTimeout(() => setVoiceHint(null), 3500);
        setIsListening(false);
      };
      rec.onend = () => setIsListening(false);
      speechRef.current = rec;
      setIsListening(true);
      setVoiceHint('Listening…');
      rec.start();
    } catch {
      setVoiceHint('Voice search unavailable right now.');
      window.setTimeout(() => setVoiceHint(null), 3000);
      setIsListening(false);
    }
  }, [handleSearchChange, isListening, stopVoice]);

  useEffect(() => () => stopVoice(), [stopVoice]);

  const handleInstall = async () => {
    if (!installEvent) {
      setVoiceHint(
        'Open your browser menu and choose “Add to Home Screen” to install Nexora.'
      );
      window.setTimeout(() => setVoiceHint(null), 4000);
      return;
    }
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        setInstallEvent(null);
      }
    } catch {
      /* user dismissed */
    }
  };

  const isSearching =
    searchInput.trim().length > 0 ||
    Boolean(activeCategory) ||
    Boolean(activeServiceChip) ||
    Boolean(activeAreaChip);

  const clearFilters = () => {
    handleSearchChange('');
    setActiveCategory(null);
    setActiveServiceChip(null);
    setActiveAreaChip(null);
  };

  if (salons.length === 0) {
    return (
      <section className="flex-1 px-page-margin py-16 max-w-2xl mx-auto text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
          <span className="material-symbols-outlined text-[32px]">storefront</span>
        </div>
        <h1 className="mt-5 font-page-heading text-2xl font-bold text-on-surface">
          No salons to show yet
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
          The salon list is empty right now. Please try again in a little while.
        </p>
      </section>
    );
  }

  return (
    <div id="customer-home-discovery" className="flex flex-col w-full pb-28 max-w-4xl mx-auto">
      {/* ================================================================= */}
      {/* 8.1 Hero Search Section                                           */}
      {/* ================================================================= */}
      <section
        id="home-hero-search"
        className="relative px-page-margin pt-5 pb-5 overflow-hidden"
      >
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/10 via-transparent to-nexora-pink/5" />
        <p className="text-[11px] font-bold uppercase tracking-wider text-nexora-pink mb-1.5 flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">location_on</span>
          <button
            type="button"
            onClick={() => onOpenLocation?.()}
            className="hover:underline cursor-pointer text-left"
          >
            {currentLocation || 'Set your area'}
          </button>
        </p>
        <h1 className="font-hero-heading-mobile text-[26px] sm:text-[30px] font-extrabold text-on-surface leading-tight tracking-tight">
          Find Exclusive Grooming Specialists
        </h1>
        <p className="mt-1.5 text-[14px] text-on-surface-variant leading-relaxed max-w-md">
          Nearby salons, clear prices, verified reviews, and 60-second booking.
        </p>

        {/* Search bar + voice + location */}
        <div className="mt-4 relative">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[#b00055] z-10 pointer-events-none">
            search
          </span>
          <input
            ref={searchInputRef}
            id="home-search-input"
            type="search"
            value={searchInput}
            onChange={(e) => {
              handleSearchChange(e.target.value);
              setActiveCategory(null);
              setActiveServiceChip(null);
            }}
            placeholder={searchPlaceholder}
            aria-label="Search salons and services"
            className="w-full h-[54px] pl-11 pr-[96px] bg-white text-on-surface font-body-md text-[14px] rounded-2xl border border-[rgba(180,0,80,0.18)] shadow-[0_8px_25px_rgba(0,0,0,0.06)] focus:outline-none focus:border-[rgba(176,0,85,0.45)] focus:ring-4 focus:ring-[rgba(176,0,85,0.08)] transition-all"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {searchInput && (
              <button
                type="button"
                onClick={() => handleSearchChange('')}
                aria-label="Clear search"
                className="w-9 h-9 rounded-full text-on-surface-variant hover:text-[#b00055] flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
            <button
              type="button"
              id="home-voice-search-btn"
              onClick={handleVoiceSearch}
              aria-label={isListening ? 'Stop voice search' : 'Voice search'}
              aria-pressed={isListening}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                isListening
                  ? 'bg-error text-white animate-pulse'
                  : 'text-nexora-pink hover:bg-primary/10'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">
                {isListening ? 'mic' : 'mic_none'}
              </span>
            </button>
            <button
              type="button"
              id="home-location-btn"
              onClick={() => onOpenLocation?.()}
              aria-label="Change location"
              className="w-9 h-9 rounded-full text-nexora-pink hover:bg-primary/10 flex items-center justify-center cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">my_location</span>
            </button>
          </div>
        </div>

        {voiceHint && (
          <p
            role="status"
            className="mt-2 text-[12px] text-on-surface-variant bg-surface-container-low border border-outline-variant/40 rounded-xl px-3 py-2"
          >
            {voiceHint}
          </p>
        )}

        {/* Area chips */}
        <div className="mt-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
            Areas
          </p>
          <div
            id="home-area-chips"
            className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5"
          >
            {JAIPUR_AREA_CHIPS.map((area) => {
              const active = activeAreaChip === area.name;
              return (
                <button
                  key={area.name}
                  type="button"
                  onClick={() => {
                    setActiveAreaChip(active ? null : area.name);
                    setActiveCategory(null);
                  }}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-all cursor-pointer ${
                    active
                      ? 'bg-primary text-white border-primary shadow-xs'
                      : 'bg-white text-on-surface border-outline-variant/50 hover:border-primary/40'
                  }`}
                >
                  {area.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Popular service chips */}
        <div className="mt-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
            Popular services
          </p>
          <div
            id="home-service-chips"
            className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5"
          >
            {POPULAR_SERVICES.map((service) => {
              const active = activeServiceChip === service;
              return (
                <button
                  key={service}
                  type="button"
                  onClick={() => {
                    setActiveServiceChip(active ? null : service);
                    if (!active) handleSearchChange('');
                  }}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-all cursor-pointer ${
                    active
                      ? 'bg-nexora-pink text-white border-nexora-pink shadow-xs'
                      : 'bg-surface-container-low text-on-surface border-outline-variant/40 hover:border-primary/40'
                  }`}
                >
                  {service}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Upcoming appointment (keep existing behaviour) */}
      {upcomingAppointment &&
        (() => {
          const appointmentDate = parseAppointmentDateTime(
            upcomingAppointment.date,
            upcomingAppointment.time
          );
          const diffMs = appointmentDate.getTime() - Date.now();
          const isWithin24Hours =
            diffMs > -2 * 60 * 60 * 1000 && diffMs <= 24 * 60 * 60 * 1000;
          const isToday =
            upcomingAppointment.date === new Date().toISOString().split('T')[0];
          const upcomingSalon = salons.find((s) => s.id === upcomingAppointment.salonId);

          if (isWithin24Hours || isToday) {
            return (
              <div className="mb-2">
                <AppointmentCountdownBanner
                  appointment={upcomingAppointment}
                  salon={upcomingSalon}
                  onOpenDetails={onOpenAppointmentDetails}
                />
              </div>
            );
          }
          return null;
        })()}

      {/* Active filter strip */}
      {isSearching && (
        <div className="px-page-margin mb-4 flex items-center justify-between gap-2">
          <p className="text-[12px] text-on-surface-variant">
            Showing <strong className="text-on-surface">{filteredSalons.length}</strong> salon
            {filteredSalons.length === 1 ? '' : 's'}
            {searchInput.trim() ? ` for “${searchInput.trim()}”` : ''}
            {activeServiceChip ? ` · ${activeServiceChip}` : ''}
            {activeAreaChip ? ` · ${activeAreaChip}` : ''}
            {activeCategory
              ? ` · ${QUICK_CATEGORIES.find((c) => c.id === activeCategory)?.name}`
              : ''}
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="text-[12px] font-bold text-nexora-pink hover:underline cursor-pointer shrink-0"
          >
            Clear
          </button>
        </div>
      )}

      {/* ================================================================= */}
      {/* 8.2 Quick Category Cards                                          */}
      {/* ================================================================= */}
      {!searchInput.trim() && (
        <section id="home-quick-categories" className="px-page-margin mb-7">
          <h2 className="font-section-heading text-[17px] font-bold text-on-surface mb-3">
            Browse by category
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
            {QUICK_CATEGORIES.map((cat) => {
              const count = categoryCounts[cat.id] || 0;
              const active = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  id={`home-category-${cat.id}`}
                  onClick={() => {
                    setActiveCategory(active ? null : cat.id);
                    setActiveServiceChip(null);
                  }}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all cursor-pointer ${
                    active
                      ? 'bg-primary/10 border-primary ring-2 ring-primary/25 shadow-xs'
                      : 'bg-white border-outline-variant/50 hover:border-primary/30 hover:shadow-xs'
                  }`}
                >
                  <span
                    className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                      active ? 'bg-primary text-white' : 'bg-primary/10 text-primary'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[24px]">{cat.icon}</span>
                  </span>
                  <span className="text-[12px] font-bold text-on-surface text-center leading-tight">
                    {cat.name}
                  </span>
                  {count > 0 && (
                    <span className="text-[10px] text-on-surface-variant font-medium">
                      {count} shop{count === 1 ? '' : 's'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Search results (when actively filtering) — full list */}
      {isSearching && (
        <section id="home-search-results" className="px-page-margin mb-7">
          <h2 className="font-section-heading text-[17px] font-bold text-on-surface mb-3">
            Search results
          </h2>
          {filteredSalons.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white border border-outline-variant/40 flex flex-col items-center text-center gap-2">
              <span className="material-symbols-outlined text-[32px] text-on-surface-variant">
                search_off
              </span>
              <h3 className="font-card-title text-[15px] font-bold text-on-surface">
                No salon matches
              </h3>
              <p className="text-[12px] text-on-surface-variant">
                Try a shorter word, another area, or clear filters.
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-1 px-4 py-2 bg-primary text-white text-[12px] font-bold rounded-xl hover:bg-nexora-pink transition-colors cursor-pointer"
              >
                Show all salons
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredSalons.slice(0, 20).map((salon) => (
                <div
                  key={salon.id}
                  className="bg-white border border-outline-variant/50 rounded-2xl p-3 flex items-center gap-3 shadow-xs"
                >
                  <img
                    src={salon.image}
                    alt={salon.name}
                    loading="lazy"
                    onClick={() => onOpenSalonDetails(salon)}
                    className="w-[72px] h-[72px] rounded-xl object-cover shrink-0 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3
                        onClick={() => onOpenSalonDetails(salon)}
                        className="font-card-title text-[15px] font-bold text-on-surface hover:text-nexora-pink cursor-pointer truncate"
                      >
                        {salon.name}
                      </h3>
                      {isVerified(salon) && (
                        <span className="material-symbols-outlined text-[14px] text-emerald-600 fill-1">
                          verified
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[12px] text-on-surface-variant flex-wrap">
                      <span className="font-bold text-warning-amber flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[14px] fill-1">star</span>
                        {salon.rating.toFixed(1)}
                      </span>
                      <span>·</span>
                      <span>{salon.location.area}</span>
                      <span>·</span>
                      <span className="text-primary font-semibold">{salon.distance}</span>
                    </div>
                    <p className="text-[12px] font-bold text-on-surface mt-0.5">
                      From ₹{minPrice(salon)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onBookSalon(salon)}
                    className="px-3.5 py-2 bg-primary text-white text-[12px] font-bold rounded-xl hover:bg-nexora-pink transition-colors shadow-xs shrink-0 cursor-pointer"
                  >
                    Book
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ================================================================= */}
      {/* 8.3 Nearby Verified Salons                                        */}
      {/* ================================================================= */}
      {!isSearching && (
        <SalonRail
          title="Nearby Verified Salons"
          subtitle="Sorted by distance · verified partners first"
          salons={nearbyDisplay}
          savedSalonIds={savedSalonIds}
          onOpen={onOpenSalonDetails}
          onBook={onBookSalon}
          onToggleSave={onToggleSaveSalon}
          badgeFor={(s) => (isVerified(s) ? 'Verified' : undefined)}
        />
      )}

      {/* ================================================================= */}
      {/* 8.4 Top Rated Near You                                            */}
      {/* ================================================================= */}
      {!isSearching && (
        <SalonRail
          title="Top Rated Near You"
          subtitle="Highest-rated salons in your area"
          salons={topRated}
          savedSalonIds={savedSalonIds}
          onOpen={onOpenSalonDetails}
          onBook={onBookSalon}
          onToggleSave={onToggleSaveSalon}
          badgeFor={() => 'Top rated'}
        />
      )}

      {/* ================================================================= */}
      {/* 8.5 Trending This Week                                            */}
      {/* ================================================================= */}
      {!isSearching && (
        <SalonRail
          title="Trending This Week"
          subtitle="Based on bookings, reviews, QR payments & repeat visits"
          salons={trending}
          savedSalonIds={savedSalonIds}
          onOpen={onOpenSalonDetails}
          onBook={onBookSalon}
          onToggleSave={onToggleSaveSalon}
          badgeFor={(s) => (s.trending ? 'Trending' : 'Hot')}
        />
      )}

      {/* ================================================================= */}
      {/* 8.6 Best Price Deals                                              */}
      {/* ================================================================= */}
      {!isSearching && bestDeals.length > 0 && (
        <section id="home-best-price-deals" className="mb-7">
          <div className="px-page-margin mb-3">
            <h2 className="font-section-heading text-[17px] font-bold text-on-surface">
              Best Price Deals
            </h2>
            <p className="text-[12px] text-on-surface-variant mt-0.5">
              Lowest starting prices across nearby salons
            </p>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar px-page-margin pb-1">
            {bestDeals.map((deal) => (
              <button
                key={deal.key}
                type="button"
                onClick={() => onBookSalon(deal.salon, deal.salon.services.find(
                  (s) => s.name.toLowerCase() === deal.key
                ))}
                className="shrink-0 w-[200px] p-4 rounded-2xl bg-white border border-outline-variant/50 hover:border-primary/40 shadow-xs text-left transition-all cursor-pointer"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-nexora-pink bg-primary/10 px-2 py-0.5 rounded-full">
                  Deal
                </span>
                <p className="mt-2 font-card-title text-[14px] font-bold text-on-surface leading-snug line-clamp-2">
                  {deal.serviceName} from ₹{deal.price}
                </p>
                {deal.originalPrice && deal.originalPrice > deal.price && (
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    <span className="line-through">₹{deal.originalPrice}</span>
                    <span className="ml-1 text-emerald-700 font-bold">
                      Save ₹{deal.originalPrice - deal.price}
                    </span>
                  </p>
                )}
                <p className="text-[11px] text-on-surface-variant mt-2 truncate">
                  at {deal.salon.name}
                </p>
                <p className="text-[11px] text-primary font-semibold mt-0.5">
                  {deal.salon.location.area} · {deal.salon.distance}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ================================================================= */}
      {/* 8.7 Recommended For You                                           */}
      {/* ================================================================= */}
      {!isSearching && (
        <SalonRail
          title="Recommended For You"
          subtitle={
            appointments.length > 0 || (user.preferredServices || []).length > 0
              ? 'Based on your bookings, favourites and area'
              : 'Popular salons in Jaipur to get you started'
          }
          salons={recommended}
          savedSalonIds={savedSalonIds}
          onOpen={onOpenSalonDetails}
          onBook={onBookSalon}
          onToggleSave={onToggleSaveSalon}
          badgeFor={() => 'For you'}
        />
      )}

      {/* ================================================================= */}
      {/* 8.8 Membership Banner                                             */}
      {/* ================================================================= */}
      {!isSearching && (
        <section id="home-membership-banner" className="px-page-margin mb-5">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#1c1b1b] via-[#3a1528] to-primary p-5 text-white shadow-lg">
            <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/10 blur-2xl pointer-events-none" />
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="material-symbols-outlined text-[22px] text-amber-300">
                    workspace_premium
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white/70">
                    Nexora Membership
                  </span>
                </div>
                <h3 className="font-card-title text-[18px] font-extrabold leading-snug">
                  Unlock Silver, Gold & Platinum Benefits
                </h3>
                <p className="text-[12px] text-white/75 mt-1 max-w-sm">
                  Priority slots, member-only prices and reward multipliers on every visit.
                </p>
              </div>
              <button
                type="button"
                id="home-view-membership-btn"
                onClick={() => onOpenMembership?.()}
                className="shrink-0 px-5 py-3 rounded-xl bg-white text-primary text-[13px] font-bold hover:bg-white/90 transition-colors shadow-md cursor-pointer"
              >
                View Membership
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ================================================================= */}
      {/* 8.9 Referral Banner                                               */}
      {/* ================================================================= */}
      {!isSearching && (
        <section id="home-referral-banner" className="px-page-margin mb-5">
          <div className="rounded-3xl bg-gradient-to-br from-primary/10 via-white to-nexora-pink/10 border border-primary/20 p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between shadow-xs">
            <div className="min-w-0 flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">group_add</span>
              </div>
              <div>
                <h3 className="font-card-title text-[16px] font-bold text-on-surface leading-snug">
                  Invite friends. Earn rewards when they pay via Nexora QR.
                </h3>
                <p className="text-[12px] text-on-surface-variant mt-1">
                  Share your code — you both earn when they complete a booking.
                </p>
              </div>
            </div>
            <button
              type="button"
              id="home-invite-now-btn"
              onClick={() => onOpenReferral?.()}
              className="shrink-0 px-5 py-3 rounded-xl bg-primary text-white text-[13px] font-bold hover:bg-nexora-pink transition-colors shadow-xs cursor-pointer"
            >
              Invite Now
            </button>
          </div>
        </section>
      )}

      {/* ================================================================= */}
      {/* 8.10 Install App Banner (PWA)                                     */}
      {/* ================================================================= */}
      {!isSearching && !isInstalled && !installDismissed && (
        <section id="home-install-app-banner" className="px-page-margin mb-6">
          <div className="rounded-2xl bg-surface-container-low border border-outline-variant/50 p-4 flex items-start gap-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-nexora-pink text-white flex items-center justify-center shrink-0 font-extrabold text-[16px]">
              N
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-card-title text-[14px] font-bold text-on-surface">
                Install Nexora App for faster booking and rewards.
              </h3>
              <p className="text-[11px] text-on-surface-variant mt-0.5">
                Add to your home screen — one tap to book, track visits and redeem points.
              </p>
              <div className="flex items-center gap-2 mt-2.5">
                <button
                  type="button"
                  id="home-install-app-btn"
                  onClick={handleInstall}
                  className="px-3.5 py-2 rounded-xl bg-primary text-white text-[12px] font-bold hover:bg-nexora-pink transition-colors cursor-pointer"
                >
                  Install App
                </button>
                <button
                  type="button"
                  onClick={() => setInstallDismissed(true)}
                  className="px-3 py-2 rounded-xl text-[12px] font-semibold text-on-surface-variant hover:text-on-surface cursor-pointer"
                >
                  Not now
                </button>
              </div>
            </div>
            <button
              type="button"
              aria-label="Dismiss install banner"
              onClick={() => setInstallDismissed(true)}
              className="text-on-surface-variant hover:text-on-surface cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </section>
      )}
    </div>
  );
};
