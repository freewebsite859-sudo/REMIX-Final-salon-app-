import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { ActiveTab, Salon, SalonService, Stylist, Appointment, UserProfile, SavedServiceRef, SavedStaffRef, SavedAddress } from './types';
import { useCatalog } from './hooks/useCatalog';
import { Header } from './components/Header';
import { BottomNav, type BottomNavTab } from './components/BottomNav';
import { HomeTab } from './components/HomeTab';
import { SearchTab } from './components/SearchTab';
import { AppointmentsTab } from './components/AppointmentsTab';
import { BookingDetailPage } from './components/BookingDetailPage';
import { SavedTab } from './components/SavedTab';
import { RewardsTab } from './components/RewardsTab';
/**
 * Secondary, route-gated screens. None of these render on first paint — each
 * belongs to a single `/customer/*` route the user has to navigate to — so
 * loading them on demand keeps their weight (and their dependency tails) off
 * the critical path for Home/Search/Bookings.
 */
const MembershipPage = lazy(() =>
  import('./components/MembershipPage').then((m) => ({ default: m.MembershipPage }))
);
const SettingsPage = lazy(() =>
  import('./components/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);
const ReferralPage = lazy(() =>
  import('./components/ReferralPage').then((m) => ({ default: m.ReferralPage }))
);
const ReviewsPage = lazy(() =>
  import('./components/ReviewsPage').then((m) => ({ default: m.ReviewsPage }))
);
const NotificationsPage = lazy(() =>
  import('./components/NotificationsPage').then((m) => ({ default: m.NotificationsPage }))
);
import { ProfileTab } from './components/ProfileTab';
import { LocationModal } from './components/LocationModal';
import { FirstLoginLocationScreen } from './components/FirstLoginLocationScreen';
import { BookingModal } from './components/BookingModal';
import { SalonDetailModal } from './components/SalonDetailModal';
import { NotificationsModal } from './components/NotificationsModal';
import { ChooseProfessionalScreen } from './components/ChooseProfessionalScreen';
import { BookingSummaryModal, type BookingPaymentRequest } from './components/BookingSummaryModal';
import { AuthPage } from './components/auth/AuthPage';
import {
  SplashScreen,
  SPLASH_EXIT_MS,
  SPLASH_MINIMUM_MS,
} from './components/SplashScreen';
import { ServicesScreen } from './components/ServicesScreen';
import { ServiceDetailScreen } from './components/ServiceDetailScreen';
import { PasswordUpdatePage } from './components/auth/PasswordUpdatePage';
import { isSupabaseConfigured, getSupabaseConfigStatus } from './lib/supabase';
import { useAuth } from './providers/AuthProvider';
import { useLocationSync } from './hooks/useLocationSync';
import { resolveLocationWithFallback } from './lib/areaResolver';
import { clearUserLocation, syncUserLocation } from './lib/locationService';
import {
  hasCompletedLocationSetup,
  loadCustomerLocation,
  markLocationSetupComplete,
  persistCustomerLocation,
  type CustomerLocationPreference,
} from './lib/customerLocation';
import { isAppointmentUpcoming } from './lib/appointments';
import {
  buildBookingMetadataServices,
  toBookingSalonSnapshot,
  toBookingStylistSnapshot,
  type BookingCreateRequest,
} from './lib/bookingContract';
import { computeBookingTotals } from './lib/bookingCore';
import { syncBookingRewards } from './lib/rewardsService';
import { createBooking } from './lib/createBookingClient';
import { isRealtimeEnabled, subscribeToTable } from './lib/realtimeService';
import { currentPath, isAuthRoute, isSignupRoute, redirectToApp } from './lib/authRoutes';
import {
  CUSTOMER_BOOKINGS,
  CUSTOMER_FAVOURITES,
  CUSTOMER_HOME,
  CUSTOMER_LOGIN,
  CUSTOMER_MEMBERSHIP,
  CUSTOMER_NOTIFICATIONS,
  CUSTOMER_PROFILE,
  CUSTOMER_REFERRAL,
  CUSTOMER_REVIEWS,
  CUSTOMER_REWARDS,
  CUSTOMER_SEARCH,
  CUSTOMER_SERVICES,
  CUSTOMER_SETTINGS,
  CUSTOMER_SIGNUP,
  canonicalizeCustomerPath,
  customerBookPath,
  customerBookingPath,
  customerRouteToTab,
  customerSalonPath,
  customerSearchPath,
  customerServicePath,
  customerServicesPath,
  canonicalizeServicesAlias,
  isCustomerPath,
  isProtectedCustomerRoute,
  navigateCustomer,
  parseCustomerRoute,
  redirectToCustomerHome,
  redirectToCustomerLogin,
  rememberCustomerReturnPath,
  requireAuthForBooking,
  slugifySalon,
  tabToCustomerPath,
  type CustomerRoute,
} from './lib/customerRoutes';
import { fetchUserProfile } from './lib/profileService';
import { requestAccountDeletion } from './lib/accountDeletion';
import { requestBookingCancellation } from './lib/bookingCancellation';
import {
  listNotifications,
  resolveNotificationTarget,
  type AppNotification,
} from './lib/notificationService';
import { isInvitePath, redirectInviteToSignup } from './lib/inviteLink';
import { syncReferralCodeToProfile } from './lib/referralService';

const STORAGE_KEYS = {
  // These keys hold UI drafts/preferences only. They are never the source of
  // truth for authentication, ownership, bookings, or payment state.
  appointments: 'nexora-appointments',
  savedSalons: 'nexora-saved-salons',
  savedServices: 'nexora-saved-services',
  savedStaff: 'nexora-saved-staff',
  profile: 'nexora-profile',
};

/** A blank profile keeps guest browsing free of fabricated personal data. */
const EMPTY_USER: UserProfile = {
  name: '',
  email: '',
  phone: '',
  avatar: '',
  locationArea: '',
  city: '',
  loyaltyPoints: 0,
  preferredServices: [],
  genderPreference: 'all',
};

function scopedStorageKey(baseKey: string, userId: string): string {
  return `${baseKey}:${userId}`;
}

/**
 * Safely load JSON from localStorage.
 * - Returns `fallback` for missing keys, corrupt JSON, `null`, or shapes that
 *   the optional sanitizer rejects (returns `null` for) — e.g. stale data
 *   written by an older app version. Bad keys are removed so the app
 *   self-heals on next load instead of white-screening.
 */
function loadJson<T>(key: string, fallback: T, sanitize?: (value: unknown) => T | null): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || parsed === undefined) {
      localStorage.removeItem(key);
      return fallback;
    }
    if (sanitize) {
      const clean = sanitize(parsed);
      if (clean === null) {
        localStorage.removeItem(key);
        return fallback;
      }
      return clean;
    }
    return parsed as T;
  } catch {
    try {
      localStorage.removeItem(key);
    } catch {
      /* storage unavailable */
    }
    return fallback;
  }
}

/** Persist JSON to localStorage without ever throwing (quota / denied storage). */
function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable or full — app keeps running, just not persisted */
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeUserProfile(value: unknown): UserProfile | null {
  if (!isRecord(value) || typeof value.name !== 'string') return null;
  return value as unknown as UserProfile;
}

function sanitizeSalonIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((id): id is string => typeof id === 'string');
}

function sanitizeAppointments(value: unknown): Appointment[] | null {
  if (!Array.isArray(value)) return null;
  const clean = value
    .filter(isRecord)
    .filter(
      (a) =>
        typeof a.id === 'string' &&
        typeof a.salonId === 'string' &&
        typeof a.salonName === 'string' &&
        typeof a.salonAddress === 'string' &&
        typeof a.date === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(a.date) &&
        typeof a.time === 'string' &&
        Array.isArray(a.services) &&
        typeof a.totalPrice === 'number' &&
        Number.isFinite(a.totalPrice) &&
        typeof a.bookingRef === 'string' &&
        [
          'pending',
          'confirmed',
          'in_progress',
          'completed',
          'cancelled',
          'no_show',
          'no-show',
        ].includes(a.status as string)
    );
  return clean as unknown as Appointment[];
}

function sanitizeSavedServices(value: unknown): SavedServiceRef[] | null {
  if (!Array.isArray(value)) return null;
  // Drop legacy/stale entries (older builds stored plain service-id strings).
  return value.filter(
    (item): item is SavedServiceRef =>
      isRecord(item) && typeof item.salonId === 'string' && typeof item.serviceId === 'string'
  );
}

function sanitizeSavedStaff(value: unknown): SavedStaffRef[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter(
    (item): item is SavedStaffRef =>
      isRecord(item) && typeof item.salonId === 'string' && typeof item.stylistId === 'string'
  );
}

function slotToIsoDate(slot?: { day?: string; date?: string; time?: string } | null): string {
  if (slot?.date && /^\d{4}-\d{2}-\d{2}$/.test(slot.date)) {
    return slot.date;
  }
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const dayLabel = (slot?.day || '').toLowerCase();
  if (dayLabel === 'tomorrow') {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }
  return todayStr;
}

/**
 * Keep a single default "Home" saved address in sync with the location the
 * customer just chose (first-login GPS or Jaipur chip). Does not invent a
 * street line — only area / city / pin / coordinates the user actually picked.
 */
function mergeHomeAddress(
  existing: SavedAddress[] | undefined,
  preference: CustomerLocationPreference
): SavedAddress[] {
  const list = Array.isArray(existing) ? [...existing] : [];
  const homeIdx = list.findIndex(
    (a) => a.label.toLowerCase() === 'home' || a.isDefault
  );
  const next: SavedAddress = {
    id: homeIdx >= 0 ? list[homeIdx].id : `addr-home-${Date.now()}`,
    label: homeIdx >= 0 ? list[homeIdx].label : 'Home',
    line1: homeIdx >= 0 && list[homeIdx].line1 ? list[homeIdx].line1 : preference.area,
    area: preference.area,
    city: preference.city,
    pincode: preference.pincode || (homeIdx >= 0 ? list[homeIdx].pincode : undefined),
    isDefault: true,
    createdAt:
      homeIdx >= 0 && list[homeIdx].createdAt
        ? list[homeIdx].createdAt
        : new Date().toISOString(),
  };
  if (homeIdx >= 0) {
    list[homeIdx] = next;
    return list.map((a, i) => (i === homeIdx ? a : { ...a, isDefault: false }));
  }
  return [{ ...next }, ...list.map((a) => ({ ...a, isDefault: false }))];
}

function salonFromAppointment(appointment: Appointment): Salon | null {
  // A booking must carry the canonical salon coordinates. Never invent a
  // location for stale/partial records; callers should ask the API to refresh
  // the booking instead of showing a misleading map pin or distance.
  if (
    typeof appointment.salonLatitude !== 'number' ||
    typeof appointment.salonLongitude !== 'number' ||
    !Number.isFinite(appointment.salonLatitude) ||
    !Number.isFinite(appointment.salonLongitude)
  ) {
    return null;
  }

  return {
    id: appointment.salonId,
    name: appointment.salonName,
    tagline: 'Premium salon and grooming studio.',
    rating: 0,
    reviewCount: 0,
    image: appointment.salonImage,
    gallery: appointment.salonImage ? [appointment.salonImage] : [],
    categories: [],
    priceRange: '₹₹',
    distance: '',
    isOpen: false,
    openingHours: '',
    gender: 'unisex',
    reviews: [],
    location: {
      address: appointment.salonAddress,
      area: appointment.salonAddress.split(',')[0] || '',
      city: appointment.salonAddress.split(',').slice(-2, -1)[0]?.trim() || '',
      latitude: appointment.salonLatitude,
      longitude: appointment.salonLongitude,
      mapsUrl: appointment.mapsUrl,
    },
    phone: appointment.salonPhone,
    amenities: [],
    services: appointment.services,
    stylists: appointment.stylist ? [appointment.stylist] : [],
  };
}

export default function App() {
  // Nexora universal auth context (single provider, single listener).
  const {
    session,
    userId,
    isLoading: isAuthLoading,
    signOut: nexoraSignOut,
    role: authRole,
    isRoleLoading,
  } = useAuth();
  const catalog = useCatalog();

  // URL-driven customer route. Defaults from the current pathname so a deep
  // link like /customer/bookings lands on the right screen after a reload.
  const [customerRoute, setCustomerRoute] = useState<CustomerRoute>(() =>
    parseCustomerRoute()
  );
  const [activeTab, setActiveTab] = useState<ActiveTab>(() =>
    customerRouteToTab(parseCustomerRoute())
  );
  // Free-text search query mirrored from /customer/search?q=
  const [routeSearchQuery, setRouteSearchQuery] = useState<string>(
    () => parseCustomerRoute().query || ''
  );
  // Auth state is derived exclusively from Supabase. A profile/preferences
  // record may be cached per user for resilience, but it can never establish
  // an authenticated session or ownership.
  const [user, setUser] = useState<UserProfile>(EMPTY_USER);
  const isAuthenticated = Boolean(session?.user);
  const [currentLocation, setCurrentLocation] = useState<string>('Mansarovar, Jaipur');
  /**
   * First-login location permission flow. Shown once per account until the
   * customer shares GPS or picks a Jaipur area (or explicitly skips).
   */
  const [showFirstLoginLocation, setShowFirstLoginLocation] = useState(false);
  const salons = catalog.salons;
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  /** Set when a cancellation was refused server-side; the booking stays active. */
  const [cancellationError, setCancellationError] = useState<string | null>(null);
  /**
   * Splash handoff. The boot splash unmounts by early return, which made it
   * vanish on a single frame. Instead it stays mounted for SPLASH_EXIT_MS with
   * `exiting` set so the transition into login/home is a crossfade.
   */
  // Starts false: the splash only appears once a boot is actually in flight,
  // so an app whose session resolves instantly is never held behind a brand
  // screen it did not need.
  const [splashMounted, setSplashMounted] = useState<boolean>(false);
  const [splashExiting, setSplashExiting] = useState<boolean>(false);
  /** Frozen so the status line does not flip mid-fade. */
  const splashStatusRef = useRef<string>('Restoring your secure session…');
  /** When the splash first appeared, so the minimum hold can be honoured. */
  const splashMountedAtRef = useRef<number>(0);
  const [savedSalonIds, setSavedSalonIds] = useState<string[]>([]);
  const [savedServices, setSavedServices] = useState<SavedServiceRef[]>([]);
  const [savedStaff, setSavedStaff] = useState<SavedStaffRef[]>([]);
  const hydratedUserIdRef = useRef<string | null>(null);
  /** Prevents the URL→state effect from fighting a state→URL write in the same tick. */
  const applyingRouteRef = useRef(false);
  /** Tracks which userId we already evaluated for the first-login location prompt. */
  const locationSetupCheckedRef = useRef<string | null>(null);

  // Dedicated Choose Professional Screen
  const [chooseProfessionalData, setChooseProfessionalData] = useState<{
    salon?: Salon | null;
    service?: SalonService | null;
    services?: SalonService[] | null;
  } | null>(null);

  // Booking Summary Modal & persistent draft state
  const [isBookingSummaryModalOpen, setIsBookingSummaryModalOpen] = useState(false);
  /** True while BookingSummaryModal shows the post-payment confirmation ticket. */
  const [isBookingConfirmationScreen, setIsBookingConfirmationScreen] = useState(false);
  const [bookingSummaryDraft, setBookingSummaryDraft] = useState<{
    salon: Salon | null;
    services: SalonService[];
    stylist: Stylist | null;
    date: string;
    time: string;
    notes?: string;
    /**
     * Step 5 Customer Details captured in the booking modal. Optional because
     * other entry points (Choose Professional, rebook) reach the summary
     * without passing through that step — those fall back to the profile.
     */
    customer?: { name: string; phone: string; email: string };
  } | null>(null);

  /**
   * Step 5 details to re-seed the booking modal with after the customer backs
   * out of the review screen to change something. Null means "prefill from the
   * stored profile", which is the normal first-entry behaviour.
   */
  const [bookingCustomerDetails, setBookingCustomerDetails] = useState<{
    name: string;
    phone: string;
    email: string;
  } | null>(null);

  // Modals state
  const [showAuthScreen, setShowAuthScreen] = useState<boolean>(() => isAuthRoute());
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'signup'>(() =>
    isSignupRoute() ? 'signup' : 'login'
  );
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isSalonDetailModalOpen, setIsSalonDetailModalOpen] = useState(false);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);

  // Selected entities for modals (declared early so route handlers can open them)
  const [selectedSalonForDetail, setSelectedSalonForDetail] = useState<Salon | null>(null);
  const [selectedSalonForBooking, setSelectedSalonForBooking] = useState<Salon | null>(null);
  const [selectedServiceForBooking, setSelectedServiceForBooking] = useState<SalonService | null>(null);
  const [selectedServicesForBooking, setSelectedServicesForBooking] = useState<SalonService[] | null>(null);
  const [selectedStylistForBooking, setSelectedStylistForBooking] = useState<Stylist | null>(null);

  // Managed playing video ID for concurrent video playback & scroll autoplay observer on Home
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);

  // Reset video playback when navigating away from Home or opening blocking modals
  useEffect(() => {
    if (
      activeTab !== 'home' ||
      isSalonDetailModalOpen ||
      isBookingModalOpen ||
      isLocationModalOpen ||
      isNotificationsModalOpen ||
      isBookingSummaryModalOpen ||
      Boolean(chooseProfessionalData)
    ) {
      setPlayingVideoId(null);
    }
  }, [
    activeTab,
    isSalonDetailModalOpen,
    isBookingModalOpen,
    isLocationModalOpen,
    isNotificationsModalOpen,
    isBookingSummaryModalOpen,
    chooseProfessionalData,
  ]);

  // ---------------------------------------------------------------------------
  // NOTIFICATIONS (database-backed)
  // The list is a cache of what the backend returned. Nothing is fabricated
  // here: if the backend is unreachable the panel says so instead of showing
  // sample rows.
  // ---------------------------------------------------------------------------
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);
  const [notificationsDisabled, setNotificationsDisabled] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const unreadNotifications = notifications.filter((n) => !n.isRead).length;

  const refreshNotifications = useCallback(async () => {
    if (!userId || !isSupabaseConfigured) {
      setNotifications([]);
      return;
    }
    setIsNotificationsLoading(true);
    const result = await listNotifications(userId, { limit: 50 });
    setIsNotificationsLoading(false);
    if (result.ok) {
      setNotifications(result.data ?? []);
      setNotificationsError(null);
      // A successful read proves the backend is reachable.
      setNotificationsDisabled(false);
    } else {
      const unavailable = Boolean(result.disabled);
      setNotificationsDisabled(unavailable);
      setNotificationsError(
        unavailable ? 'Notifications are unavailable right now.' : 'Could not load notifications.'
      );
      console.warn('[Nexora] Notification fetch failed:', result.error);
    }
  }, [userId]);

  // Load once per signed-in user, then keep the list warm while the app is open.
  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setNotificationsError(null);
      setNotificationsDisabled(false);
      return;
    }
    void refreshNotifications();
    const timer = window.setInterval(() => {
      void refreshNotifications();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [userId, refreshNotifications]);

  // Live notifications: when Supabase Realtime is enabled, salon-side booking
  // confirmations (booking_confirmed etc.) arrive as notifications INSERTs and
  // refresh the badge/panel instantly instead of waiting for the poll above.
  useEffect(() => {
    if (!userId || !isRealtimeEnabled()) return undefined;
    const filter = `user_id=eq.${userId}`;
    const sub = subscribeToTable(
      'notifications',
      () => {
        void refreshNotifications();
      },
      { filter }
    );
    return () => {
      void sub.unsubscribe();
    };
  }, [userId, refreshNotifications]);

  /**
   * Apply a parsed customer route to local UI state (tab, modals, search).
   * Called on popstate / initial load / programmatic navigateCustomer.
   */
  const applyCustomerRoute = useCallback(
    (route: CustomerRoute, opts: { openOverlays?: boolean } = {}) => {
      const openOverlays = opts.openOverlays !== false;
      applyingRouteRef.current = true;
      setCustomerRoute(route);
      setActiveTab(customerRouteToTab(route));
      if (route.kind === 'search') {
        setRouteSearchQuery(route.query || '');
      }

      if (!openOverlays) {
        applyingRouteRef.current = false;
        return;
      }

      switch (route.kind) {
        case 'salon': {
          if (route.salonSlug) {
            const match =
              salons.find((s) => slugifySalon(s.name) === route.salonSlug) ||
              salons.find((s) => s.id === route.salonSlug) ||
              salons.find((s) => slugifySalon(s.id) === route.salonSlug) ||
              null;
            if (match) {
              setSelectedSalonForDetail(match);
              setIsSalonDetailModalOpen(true);
            }
          }
          break;
        }
        case 'book': {
          if (route.salonId) {
            const match =
              salons.find((s) => s.id === route.salonId) ||
              salons.find((s) => slugifySalon(s.name) === route.salonId) ||
              null;
            if (match) {
              setSelectedSalonForBooking(match);
              setSelectedServiceForBooking(null);
              setSelectedServicesForBooking(null);
              setSelectedStylistForBooking(null);
              // Same rule as handleOpenBooking: a deep link into a fresh
              // booking must not inherit the previous booking's contact.
              setBookingCustomerDetails(null);
              setIsBookingModalOpen(true);
            }
          }
          break;
        }
        case 'booking': {
          // Focus the appointments list; a future detail pane can use bookingId.
          setIsBookingModalOpen(false);
          setIsSalonDetailModalOpen(false);
          break;
        }
        case 'notifications': {
          setIsNotificationsModalOpen(true);
          break;
        }
        case 'home':
        case 'search':
        case 'bookings':
        case 'favourites':
        case 'profile':
        case 'settings':
        case 'rewards':
        case 'membership':
        case 'referral':
        case 'reviews':
        case 'root':
        default: {
          // Clear booking/salon overlays when moving to a primary screen so
          // back-navigation does not leave a stale modal on top.
          if (
            route.kind === 'home' ||
            route.kind === 'bookings' ||
            route.kind === 'favourites' ||
            route.kind === 'profile' ||
            route.kind === 'search'
          ) {
            setIsBookingModalOpen(false);
            setIsSalonDetailModalOpen(false);
          }
          break;
        }
      }
      applyingRouteRef.current = false;
    },
    [salons]
  );

  /**
   * Keep React state in lockstep with the browser URL for every `/customer/*`
   * path. Also canonicalises bare `/` and `/customer` → `/customer/home`.
   */
  useEffect(() => {
    const syncFromLocation = () => {
      const rawPath = currentPath();

      // `/services` and `/services/:id` are accepted aliases for the two service
      // screens. Rewrite them to their canonical `/customer` form first so the
      // route gate below — which is keyed on the `/customer` prefix — sees a
      // path it recognises, and so the address bar settles on one canonical URL
      // instead of two spellings of the same screen.
      const aliased = canonicalizeServicesAlias(rawPath);
      const path = aliased ?? rawPath;
      if (aliased && aliased !== rawPath) {
        navigateCustomer(aliased, { replace: true });
      }

      // Password recovery stays on the dedicated /auth/reset screen.
      if (path === '/auth/reset') {
        setShowAuthScreen(true);
        return;
      }

      // Invite deep links (`https://nexora.app/invite?code=NX-…`) must open the
      // SIGNUP form with the code attached. Without this branch the path fell
      // through to the guest home screen and the code was silently dropped, so
      // nobody was ever counted for the referral.
      if (isInvitePath(path)) {
        // Rewrites the URL to /customer/signup?code=… and stashes the code in
        // localStorage so a reload or a later navigation cannot lose it.
        const code = redirectInviteToSignup({ replace: true });
        if (isAuthenticated) {
          // Already signed in — nothing to sign up for. Show their own
          // Refer & Earn screen instead of a signup form.
          setShowAuthScreen(false);
          navigateCustomer(CUSTOMER_REFERRAL, { replace: true });
          applyCustomerRoute(parseCustomerRoute(CUSTOMER_REFERRAL));
          return;
        }
        setShowAuthScreen(true);
        setAuthInitialMode('signup');
        setCustomerRoute(parseCustomerRoute(CUSTOMER_SIGNUP));
        if (code) {
          console.info(`[Nexora] Invite link opened with referral code ${code}`);
        }
        return;
      }

      // Auth screens (legacy /auth/* and /customer/login|signup).
      if (isAuthRoute(path)) {
        setShowAuthScreen(true);
        setAuthInitialMode(isSignupRoute(path) ? 'signup' : 'login');
        setCustomerRoute(parseCustomerRoute(path));
        return;
      }

      // Guest browsing is allowed on public customer routes; protected ones
      // bounce to login. Booking is always protected (see requireAuthForBooking).
      const route = parseCustomerRoute(path);

      if (isCustomerPath(path) || path === '/' || path === '') {
        if (path === '/' || path === '' || route.kind === 'root' || route.kind === 'unknown') {
          canonicalizeCustomerPath(path, {
            replace: true,
            authenticated: isAuthenticated,
          });
          const homeRoute = parseCustomerRoute(CUSTOMER_HOME);
          setShowAuthScreen(false);
          applyCustomerRoute(homeRoute);
          return;
        }

        if (isProtectedCustomerRoute(route) && !isAuthenticated && !isAuthLoading) {
          // Book attempts remember the destination so login can return here.
          if (route.kind === 'book') {
            requireAuthForBooking(false, path);
          } else {
            rememberCustomerReturnPath(path);
            redirectToCustomerLogin({ replace: true, returnTo: path });
          }
          setShowAuthScreen(true);
          setAuthInitialMode('login');
          return;
        }

        setShowAuthScreen(false);
        applyCustomerRoute(route);
        return;
      }

      // Non-customer, non-auth path (e.g. leftover legacy '/'): send to home.
      if (!isAuthRoute(path)) {
        canonicalizeCustomerPath('/', { replace: true, authenticated: isAuthenticated });
      }
    };

    syncFromLocation();
    window.addEventListener('popstate', syncFromLocation);
    return () => window.removeEventListener('popstate', syncFromLocation);
  }, [applyCustomerRoute, isAuthenticated, isAuthLoading]);

  /** Navigate to a customer path and update local route state. */
  const goToCustomer = useCallback(
    (path: string, options: { replace?: boolean } = {}) => {
      navigateCustomer(path, options);
      // popstate listener applies the route; also apply eagerly for snappy UI.
      const route = parseCustomerRoute(path.split('?')[0], path.includes('?') ? path.slice(path.indexOf('?')) : '');
      applyCustomerRoute(route);
    },
    [applyCustomerRoute]
  );

  /** Open the screen a notification points at. */
  const handleOpenNotification = useCallback(
    (notification: AppNotification) => {
      const target = resolveNotificationTarget(notification);
      if (!target) return;
      setChooseProfessionalData(null);
      setIsNotificationsModalOpen(false);

      // Route to the destination the payload names (Bookings, Rewards, Profile…).
      // Booking-detail payloads deep-link to `/customer/booking/:id`.
      if (target.tab === 'bookings' && target.id) {
        goToCustomer(customerBookingPath(target.id));
      } else {
        goToCustomer(tabToCustomerPath(target.tab));
      }

      // Scroll to the section the notification refers to, once it is mounted.
      if (target.section) {
        window.setTimeout(() => {
          document.getElementById(target.section as string)?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        }, 120);
      }
    },
    [goToCustomer]
  );

  /** Bottom-nav / in-app tab change → customer URL. */
  const handleSelectTab = useCallback(
    (tab: ActiveTab | BottomNavTab) => {
      // Protected bottom-nav destinations require a session.
      const protectedTabs: Array<ActiveTab | BottomNavTab> = [
        'bookings',
        'rewards',
        'profile',
      ];
      if (protectedTabs.includes(tab) && !isAuthenticated) {
        const returnTo = tabToCustomerPath(tab as ActiveTab);
        rememberCustomerReturnPath(returnTo);
        setShowAuthScreen(true);
        setAuthInitialMode('login');
        redirectToCustomerLogin({ replace: true, returnTo });
        return;
      }
      setChooseProfessionalData(null);
      setIsBookingConfirmationScreen(false);
      goToCustomer(tabToCustomerPath(tab as ActiveTab));
    },
    [goToCustomer, isAuthenticated]
  );

  // Active upcoming appointment for reminder banner. A stale `confirmed` row
  // must not be presented as an upcoming visit after a reload.
  const upcomingAppointment = appointments.find((a) => isAppointmentUpcoming(a)) || null;

  // ---------------------------------------------------------------------------
  // NEXORA UNIVERSAL AUTH
  // The single auth-state listener lives in <AuthProvider> (src/providers).
  // App only mirrors the session into the local profile/UI state — it never
  // registers its own listener, so there is exactly one subscription app-wide.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isSupabaseConfigured) {
      // When not configured, allow guest browsing but log diagnostic
      const status = getSupabaseConfigStatus();
      if (!status.isConfigured) {
        console.warn('[Nexora] Supabase not configured - guest mode only');
      }
      return;
    }

    const sessionUser = session?.user;

    if (sessionUser) {
      // Keep the recovery session on /auth/reset until updateUser() completes.
      // Other authenticated routes can immediately return to the app shell.
      if (currentPath() !== '/auth/reset') {
        setShowAuthScreen(false);
        // After login/signup always land on /customer/home (or a stashed
        // return path such as /customer/book/:salonId).
        if (isAuthRoute(currentPath())) {
          redirectToApp();
        }
      }
    } else if (!isAuthLoading) {
      // SIGNED_OUT, or an invalid/expired session the provider could not renew.
      // The provider already redirected expired sessions to login;
      // render the auth screen when we are on that route.
      // Also enforce route protection for protected customer paths / tabs.
      if (isAuthRoute()) {
        setShowAuthScreen(true);
        setAuthInitialMode(isSignupRoute() ? 'signup' : 'login');
      } else {
        const route = parseCustomerRoute();
        if (
          isProtectedCustomerRoute(route) ||
          ['profile', 'bookings', 'rewards'].includes(activeTab)
        ) {
          setShowAuthScreen(true);
          setAuthInitialMode('login');
          if (route.kind === 'book') {
            requireAuthForBooking(false, currentPath());
          } else {
            redirectToCustomerLogin({
              replace: true,
              returnTo: isCustomerPath() ? currentPath() : undefined,
            });
          }
        }
      }
    }
  }, [session, isAuthLoading, activeTab]);

  // Load only this authenticated user's UI profile and local drafts. These
  // values are deliberately namespaced by the authoritative Supabase user id;
  // data from one account can never appear in another account's UI.
  // Also loads role from profile for route protection.
  useEffect(() => {
    if (!userId) {
      hydratedUserIdRef.current = null;
      locationSetupCheckedRef.current = null;
      setUser(EMPTY_USER);
      setAppointments([]);
      setSavedSalonIds([]);
      setSavedServices([]);
      setSavedStaff([]);
      setCurrentLocation('Mansarovar, Jaipur');
      setShowFirstLoginLocation(false);
      return;
    }

    if (hydratedUserIdRef.current === userId) return;
    hydratedUserIdRef.current = userId;

    const storedProfile = loadJson(
      scopedStorageKey(STORAGE_KEYS.profile, userId),
      null as UserProfile | null,
      sanitizeUserProfile
    );
    const sessionUser = session?.user;
    
    // Determine role: prefer authRole from provider (loaded via profileService), then metadata, then stored
    const effectiveRole = authRole || 
      (sessionUser?.user_metadata?.role as UserProfile['role']) || 
      storedProfile?.role || 
      'customer';

    // Restore a previously saved location preference for this account.
    const savedLocation = loadCustomerLocation(userId);

    setUser({
      ...EMPTY_USER,
      ...(storedProfile || {}),
      email: sessionUser?.email || storedProfile?.email || '',
      name:
        sessionUser?.user_metadata?.full_name ||
        storedProfile?.name ||
        sessionUser?.email?.split('@')[0] ||
        '',
      phone: sessionUser?.user_metadata?.mobile || sessionUser?.phone || storedProfile?.phone || '',
      dateOfBirth:
        (sessionUser?.user_metadata?.date_of_birth as string | undefined) ||
        storedProfile?.dateOfBirth ||
        undefined,
      role: effectiveRole,
      locationArea:
        savedLocation?.area ||
        storedProfile?.locationArea ||
        storedProfile?.defaultLocality ||
        '',
      city: savedLocation?.city || storedProfile?.city || '',
      defaultLocality:
        savedLocation?.area ||
        storedProfile?.defaultLocality ||
        storedProfile?.locationArea ||
        '',
    });

    if (savedLocation?.label) {
      setCurrentLocation(savedLocation.label);
    } else if (storedProfile?.defaultLocality || storedProfile?.locationArea) {
      const area = storedProfile.defaultLocality || storedProfile.locationArea;
      const city = storedProfile.city || 'Jaipur';
      setCurrentLocation(area.includes(city) ? area : `${area}, ${city}`);
    }

    // Try to fetch latest profile from Supabase for role accuracy (non-blocking)
    void (async () => {
      try {
        if (isSupabaseConfigured && userId) {
          const { profile } = await fetchUserProfile(userId);
          if (profile?.role) {
            setUser(prev => ({ ...prev, role: profile.role }));
          }
          if (profile?.date_of_birth) {
            setUser(prev => ({ ...prev, dateOfBirth: prev.dateOfBirth || profile.date_of_birth! }));
          }
          // A code already on the profile wins over a locally derived one.
          const profileCode = (profile as { referral_code?: string | null } | null)?.referral_code;
          if (profileCode) {
            setUser(prev => ({ ...prev, referralCode: profileCode }));
          }
        }
      } catch (err) {
        console.warn('[Nexora] Failed to refresh profile from backend:', err);
      }

      // Publish this customer's referral code so invite links they share can be
      // resolved by the backend from any device. Explicit + non-blocking: it is
      // never called from render, and a project without the migration column
      // simply keeps working on local attribution.
      try {
        const result = await syncReferralCodeToProfile({
          userId,
          name: sessionUser?.user_metadata?.full_name || storedProfile?.name,
          email: sessionUser?.email || storedProfile?.email,
          phone: sessionUser?.user_metadata?.mobile || storedProfile?.phone,
        });
        if (result.synced) {
          setUser(prev => ({ ...prev, referralCode: result.code }));
        } else if (result.error && result.error !== 'live supabase not configured') {
          console.info('[Nexora] Referral code kept on-device:', result.error);
        }
      } catch (err) {
        console.info('[Nexora] Referral code sync skipped:', err);
      }
    })();

    setAppointments(
      loadJson(scopedStorageKey(STORAGE_KEYS.appointments, userId), [], sanitizeAppointments)
    );
    setSavedSalonIds(loadJson(scopedStorageKey(STORAGE_KEYS.savedSalons, userId), [], sanitizeSalonIds));
    setSavedServices(
      loadJson(scopedStorageKey(STORAGE_KEYS.savedServices, userId), [], sanitizeSavedServices)
    );
    setSavedStaff(
      loadJson(scopedStorageKey(STORAGE_KEYS.savedStaff, userId), [], sanitizeSavedStaff)
    );
    // Reviews edited in memory are not authoritative and must not bleed into a
    // different account after switching sessions.
  }, [userId, session?.user, authRole]);

  // First-login location permission: once per account, after auth is ready and
  // the auth screen is no longer showing. Guests never see this prompt.
  useEffect(() => {
    if (!userId || !isAuthenticated || isAuthLoading || showAuthScreen) {
      if (!userId) setShowFirstLoginLocation(false);
      return;
    }
    if (locationSetupCheckedRef.current === userId) return;
    locationSetupCheckedRef.current = userId;

    if (hasCompletedLocationSetup(userId)) {
      setShowFirstLoginLocation(false);
      // Re-hydrate the header label if a preference exists.
      const saved = loadCustomerLocation(userId);
      if (saved?.label) setCurrentLocation(saved.label);
      return;
    }

    setShowFirstLoginLocation(true);
  }, [userId, isAuthenticated, isAuthLoading, showAuthScreen]);

  /** Apply a completed first-login / picker location to UI + profile. */
  const applyCustomerLocationPreference = useCallback(
    (preference: CustomerLocationPreference) => {
      setCurrentLocation(preference.label);
      setUser((prev) => ({
        ...prev,
        locationArea: preference.area,
        city: preference.city,
        defaultLocality: preference.area,
        // Keep a default "Home" address entry when we know the PIN.
        savedAddresses: mergeHomeAddress(prev.savedAddresses, preference),
      }));
      setShowFirstLoginLocation(false);
    },
    []
  );

  const handleFirstLoginLocationComplete = useCallback(
    (preference: CustomerLocationPreference) => {
      applyCustomerLocationPreference(preference);
    },
    [applyCustomerLocationPreference]
  );

  const handleFirstLoginLocationSkip = useCallback(() => {
    if (userId) markLocationSetupComplete(userId);
    setShowFirstLoginLocation(false);
  }, [userId]);

  // Rebind open views to the newest catalog snapshot. This lets a remote row
  // replace its fallback counterpart without leaving a stale modal behind.
  useEffect(() => {
    const rebindSalon = (current: Salon | null): Salon | null => {
      if (!current) return null;
      return salons.find((salon) => salon.id === current.id) || null;
    };
    setSelectedSalonForDetail((current) => rebindSalon(current));
    setSelectedSalonForBooking((current) => rebindSalon(current));
    setBookingSummaryDraft((current) => {
      if (!current) return null;
      const nextSalon = rebindSalon(current.salon);
      if (!nextSalon) return null;
      const nextServices = current.services.filter((service) =>
        nextSalon.services.some((catalogService) => catalogService.id === service.id)
      );
      return nextServices.length ? { ...current, salon: nextSalon, services: nextServices } : null;
    });
  }, [salons]);

  // ---------------------------------------------------------------------------
  // NEXORA LIVE LOCATION SYNC
  // Authenticated users only; one watcher; RLS-enforced writes; cleared on logout.
  // Reuses the existing header/location UI by feeding it the live label.
  // ---------------------------------------------------------------------------
  const handleLivePosition = useCallback((_coords: unknown, liveLabel: string) => {
    // A successful device fix is more authoritative than the last manually
    // selected label. Keep the UI aligned with the coordinate written to the
    // backend instead of displaying a stale area name.
    setCurrentLocation(liveLabel);
  }, []);

  const locationSync = useLocationSync({
    userId,
    enabled: isAuthenticated,
    onPosition: handleLivePosition,
  });

  /**
   * Explicit location teardown used by logout / delete-account.
   * The hook also cleans up automatically when `userId` clears, but doing it
   * *before* signOut() guarantees the DELETE is sent while the JWT is still
   * valid, so RLS authorises it.
   */
  /**
   * Push a manually detected GPS fix (from the existing LocationModal) to the
   * Nexora backend. No-op for guests — RLS would reject an anonymous write.
   */
  const handleManualLocationSync = useCallback(
    async (latitude: number, longitude: number) => {
      if (!userId || !isSupabaseConfigured) return;
      try {
        const result = await syncUserLocation(userId, { latitude, longitude });
        if (!result.ok && !result.disabled) {
          console.warn('[Nexora] Manual location sync failed:', result.error);
        }
      } catch (err) {
        // Non-fatal for the picker, but preserve the diagnostic for support.
        console.warn('[Nexora] Manual location sync failed:', err);
      }
    },
    [userId]
  );

  const handleTeardownLocation = useCallback(async () => {
    if (!userId) return;
    try {
      const result = await clearUserLocation(userId);
      if (!result.ok) {
        console.warn('[Nexora] Location cleanup failed:', result.error);
      }
    } catch (err) {
      // The hook retries cleanup on session loss; retain the root cause in logs.
      console.warn('[Nexora] Location cleanup failed:', err);
    }
  }, [userId]);

  useEffect(() => {
    if (userId && hydratedUserIdRef.current === userId) {
      saveJson(scopedStorageKey(STORAGE_KEYS.appointments, userId), appointments);
    }
  }, [appointments, userId]);

  useEffect(() => {
    if (userId && hydratedUserIdRef.current === userId) {
      saveJson(scopedStorageKey(STORAGE_KEYS.savedSalons, userId), savedSalonIds);
    }
  }, [savedSalonIds, userId]);

  useEffect(() => {
    if (userId && hydratedUserIdRef.current === userId) {
      saveJson(scopedStorageKey(STORAGE_KEYS.savedServices, userId), savedServices);
    }
  }, [savedServices, userId]);

  useEffect(() => {
    if (userId && hydratedUserIdRef.current === userId) {
      saveJson(scopedStorageKey(STORAGE_KEYS.savedStaff, userId), savedStaff);
    }
  }, [savedStaff, userId]);

  useEffect(() => {
    if (userId && hydratedUserIdRef.current === userId) {
      saveJson(scopedStorageKey(STORAGE_KEYS.profile, userId), user);
    }
  }, [user, userId]);

  /**
   * Loyalty accrual — the wallet is the ledger, the profile shows the balance.
   *
   * Every COMPLETED booking credits floor(bill × 10%) reward points exactly
   * once (`syncBookingRewards` is idempotent per booking id), and the profile's
   * `loyaltyPoints` always mirrors the wallet's current balance so the
   * membership tier, Profile header and Rewards page can never disagree.
   */
  useEffect(() => {
    if (!userId || hydratedUserIdRef.current !== userId) return;
    const { summary, awarded, pointsAwarded } = syncBookingRewards(userId, appointments);
    if (awarded.length > 0) {
      console.info(
        `[Nexora] Loyalty: credited ${pointsAwarded} points for ${awarded.length} completed booking(s).`
      );
    }
    setUser((prev) =>
      prev.loyaltyPoints === summary.currentPoints
        ? prev
        : { ...prev, loyaltyPoints: summary.currentPoints }
    );
  }, [appointments, userId]);

  // Handlers
  const handleOpenSalonDetails = (salon: Salon) => {
    setSelectedSalonForDetail(salon);
    setIsSalonDetailModalOpen(true);
    // Reflect salon detail in the URL: /customer/salon/:salonSlug
    const slug = slugifySalon(salon.name || salon.id);
    goToCustomer(customerSalonPath(slug));
  };

  const handleOpenBooking = (
    salon: Salon,
    service?: SalonService,
    stylist?: Stylist,
    services?: SalonService[]
  ) => {
    if (!salon) {
      console.warn('[Nexora] Cannot start booking without a canonical salon record.');
      return;
    }

    const bookPath = customerBookPath(salon.id);

    // Booking is a protected operation. Guests must authenticate first, and a
    // missing Supabase configuration must never fall through to a local/fake
    // booking path. Remember the book URL so login can return the user here.
    if (!isSupabaseConfigured || !userId) {
      rememberCustomerReturnPath(bookPath);
      setShowAuthScreen(true);
      setAuthInitialMode('login');
      requireAuthForBooking(false, bookPath);
      return;
    }

    setSelectedSalonForBooking(salon);
    setSelectedServiceForBooking(service || null);
    setSelectedServicesForBooking(services || (service ? [service] : null));
    setSelectedStylistForBooking(stylist || null);
    // A fresh booking always starts from the signed-in profile. This override
    // only exists to survive the review screen's "Change date/time" re-entry;
    // leaving it set let one booking's contact prefill the NEXT, unrelated
    // booking — and since the fields validate, it could be submitted unnoticed.
    setBookingCustomerDetails(null);
    setIsBookingModalOpen(true);
    goToCustomer(bookPath);
  };

  const handleBookAgain = (appointment: Appointment) => {
    const salon = salons.find((s) => s.id === appointment.salonId) || salonFromAppointment(appointment);
    if (!salon) {
      console.warn('[Nexora] Booking record has no canonical salon data; refresh is required before booking again.');
      return;
    }
    handleOpenBooking(salon, appointment.services[0], appointment.stylist, appointment.services);
  };

  /**
   * Server-side deposit checkout used as BookingSummaryModal.onPayDeposit.
   *
   * Live path: POST /api/payments/orders → official Razorpay Checkout →
   * POST /api/payments/verify. The booking row is written only after HMAC
   * verification. No merchant QR and no client-generated order/payment ids.
   */
  const handleServerBooking = useCallback(
    async (request: BookingPaymentRequest): Promise<Appointment> => {
      // Canonical line items are the ONLY pricing input. Rebuilding them here
      // (instead of trusting the amount the modal rendered) means a service
      // the contract had to drop, or a stale draft, can never produce the
      // "advance payment incomplete" mismatch the server rejects with 400.
      const services = buildBookingMetadataServices(bookingSummaryDraft?.services ?? []);
      if (services.length === 0) {
        throw new Error(
          'No valid services are selected for this booking. Add at least one service and try again.'
        );
      }
      const totals = computeBookingTotals(services, request.discountAmount ?? 0);

      // The contact details the customer confirmed in Step 5 win over the
      // stored profile. Someone booking for a family member types that
      // person's name and number, and that is what the salon must receive —
      // silently substituting the account holder's details sends the stylist
      // to call the wrong phone. The account `id` always stays the signed-in
      // user's: ownership and payment belong to the authenticated account.
      const details = bookingSummaryDraft?.customer;
      const contactName = details?.name?.trim() || user.name;
      const contactPhone = details?.phone?.trim() || session?.user?.phone || user.phone;
      const contactEmail = details?.email?.trim() || session?.user?.email;

      const body: BookingCreateRequest = {
        salon: toBookingSalonSnapshot(bookingSummaryDraft?.salon ?? null),
        services,
        stylist: toBookingStylistSnapshot(bookingSummaryDraft?.stylist ?? null),
        customer: {
          ...(userId ? { id: userId } : {}),
          ...(contactName ? { name: contactName } : {}),
          ...(contactEmail ? { email: contactEmail } : {}),
          ...(contactPhone ? { phone: contactPhone } : {}),
        },
        date: request.date,
        time: request.time,
        amount: totals.advanceAmount,
        ...(request.couponCode ? { couponCode: request.couponCode } : {}),
        ...(totals.discountAmount > 0 ? { discountAmount: totals.discountAmount } : {}),
        notes: request.notes,
      };

      const result = await createBooking(body);
      if (!result.ok || !result.appointment) {
        throw new Error(result.error || 'Booking service returned no appointment.');
      }
      return result.appointment;
    },
    [bookingSummaryDraft, userId, session, user.name, user.phone]
  );

  const handleConfirmBooking = (newAppointment: Appointment) => {
    // The UI may receive a booking only from a future server-side payment
    // adapter. Keep the guard here as a second line of defence; appointment
    // state must never be created from an unauthenticated client event.
    if (!isSupabaseConfigured || !userId) return;
    setAppointments((prev) => [newAppointment, ...prev.filter((a) => a.id !== newAppointment.id)]);
  };

  const handleViewAppointments = () => {
    setIsBookingModalOpen(false);
    setIsBookingSummaryModalOpen(false);
    setChooseProfessionalData(null);
    goToCustomer(CUSTOMER_BOOKINGS);
  };

  const handleViewBookingDetail = (bookingId: string) => {
    goToCustomer(customerBookingPath(bookingId));
  };

  const handleToggleSaveSalon = (salonId: string) => {
    setSavedSalonIds((prev) =>
      prev.includes(salonId) ? prev.filter((id) => id !== salonId) : [...prev, salonId]
    );
  };

  const handleToggleSaveService = (salonId: string, serviceId: string) => {
    setSavedServices((prev) => {
      const exists = prev.some((item) => item.salonId === salonId && item.serviceId === serviceId);
      if (exists) {
        return prev.filter((item) => !(item.salonId === salonId && item.serviceId === serviceId));
      }
      return [...prev, { salonId, serviceId }];
    });
  };

  const handleToggleSaveStaff = (salonId: string, stylistId: string) => {
    setSavedStaff((prev) => {
      const exists = prev.some((item) => item.salonId === salonId && item.stylistId === stylistId);
      if (exists) {
        return prev.filter((item) => !(item.salonId === salonId && item.stylistId === stylistId));
      }
      return [...prev, { salonId, stylistId }];
    });
  };

  const handleCancelAppointment = async (id: string): Promise<boolean> => {
    // Cancellation must be confirmed by the server before the UI changes.
    // It used to be client-only: this flipped the row in React state and never
    // called the API, so the salon still saw an active booking, the slot stayed
    // occupied, and a reload restored the appointment as if nothing happened.
    const outcome = await requestBookingCancellation(id, session?.access_token ?? null);

    if (!outcome.success) {
      console.warn(
        `[Nexora] Cancellation not completed (${outcome.reason}): ${outcome.message}`
      );
      setCancellationError(outcome.message);
      return false;
    }

    setCancellationError(null);
    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'cancelled' } : a))
    );
    return true;
  };

  const handleRescheduleAppointment = (id: string) => {
    const apt = appointments.find((a) => a.id === id);
    if (apt) {
      const salon = salons.find((s) => s.id === apt.salonId);
      if (!salon) {
        console.warn('[Nexora] Cannot reschedule without the canonical salon record.');
        return;
      }
      handleOpenBooking(salon, apt.services[0], apt.stylist);
    }
  };

  const handleLogout = async () => {
    // Stop live-location sync and purge the stored position before the session
    // is destroyed, so the delete still passes the RLS `auth.uid()` check.
    await handleTeardownLocation();

    // Sign out through the provider: it owns the single auth listener and the
    // loop-safe redirect to login.
    await nexoraSignOut();

    // Clear auth state and protected application state
    setUser(EMPTY_USER);
    setAppointments([]);
    setSavedSalonIds([]);
    setSavedServices([]);
    setSavedStaff([]);
    setActiveTab('home');
    setShowAuthScreen(true);
    setAuthInitialMode('login');

    // Clear any scoped storage for current user to prevent data leakage.
    // Location preference is intentionally kept so the next login on this
    // device can skip the first-login prompt for the same account — only the
    // live GPS row is cleared (via handleTeardownLocation above).
    if (userId) {
      try {
        localStorage.removeItem(scopedStorageKey(STORAGE_KEYS.profile, userId));
        localStorage.removeItem(scopedStorageKey(STORAGE_KEYS.appointments, userId));
        localStorage.removeItem(scopedStorageKey(STORAGE_KEYS.savedSalons, userId));
        localStorage.removeItem(scopedStorageKey(STORAGE_KEYS.savedServices, userId));
        localStorage.removeItem(scopedStorageKey(STORAGE_KEYS.savedStaff, userId));
      } catch {
        /* ignore storage errors */
      }
    }
    setShowFirstLoginLocation(false);
    locationSetupCheckedRef.current = null;

    // Redirect to customer login and prevent back navigation to protected pages
    redirectToCustomerLogin({ replace: true });

    // Additional back navigation prevention under the customer namespace
    try {
      if (typeof window !== 'undefined') {
        window.history.pushState(null, '', CUSTOMER_LOGIN);
        window.history.replaceState(null, '', CUSTOMER_LOGIN);
      }
    } catch {
      /* ignore history errors */
    }
  };

  const handleDeleteAccount = async (): Promise<boolean> => {
    // Deletion goes through POST /api/user/delete, which verifies this
    // browser's own access token and deletes exactly that account with the
    // service-role key held server-side. Signing out and clearing browser keys
    // is NOT account deletion, so a failure here must never be reported as a
    // success — the caller only signs out when this returns true.
    const outcome = await requestAccountDeletion(session?.access_token ?? null);

    if (!outcome.success) {
      console.warn(`[Nexora] Account deletion not completed (${outcome.reason}): ${outcome.message}`);
      return false;
    }

    // The auth row is gone; drop local caches and the session so the UI cannot
    // keep showing data for an account that no longer exists.
    try {
      if (userId) {
        localStorage.removeItem(scopedStorageKey(STORAGE_KEYS.appointments, userId));
        localStorage.removeItem(scopedStorageKey(STORAGE_KEYS.savedSalons, userId));
        localStorage.removeItem(scopedStorageKey(STORAGE_KEYS.savedServices, userId));
        localStorage.removeItem(scopedStorageKey(STORAGE_KEYS.savedStaff, userId));
        localStorage.removeItem(scopedStorageKey(STORAGE_KEYS.profile, userId));
      }
    } catch {
      /* storage may be unavailable; the server-side deletion already succeeded */
    }

    await nexoraSignOut();
    redirectToCustomerLogin({ replace: true });
    return true;
  };

  const isBooting = isSupabaseConfigured && (isAuthLoading || isRoleLoading);

  // Freeze the phase label so it cannot flip mid-fade, then run the crossfade.
  // The splash unmounts by early return, which made it disappear on a single
  // frame; keeping it mounted for SPLASH_EXIT_MS with `exiting` set turns that
  // into a real transition into login/home.
  useEffect(() => {
    if (isBooting) {
      splashStatusRef.current = isRoleLoading
        ? 'Checking your account type…'
        : 'Restoring your secure session…';
      // Stamp the hold from the moment the splash first appears, not from
      // component init, so a boot that starts late still gets its full hold.
      if (!splashMounted) splashMountedAtRef.current = Date.now();
      setSplashMounted(true);
      setSplashExiting(false);
      return;
    }
    if (!splashMounted) return;
    // Honour prefers-reduced-motion: skip the hold, the CSS animation is
    // suppressed for those users anyway.
    const reduce =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setSplashMounted(false);
      return;
    }
    // Wait out the remainder of the minimum hold before fading. The brand
    // mark's entrance runs 600 ms, so exiting the moment the session resolves
    // cuts it off mid-draw and the splash reads as a glitch rather than a boot.
    const holdRemaining = Math.max(
      0,
      SPLASH_MINIMUM_MS - (Date.now() - splashMountedAtRef.current)
    );
    let exitTimer: number | undefined;
    const holdTimer = window.setTimeout(() => {
      setSplashExiting(true);
      exitTimer = window.setTimeout(() => {
        setSplashMounted(false);
        setSplashExiting(false);
      }, SPLASH_EXIT_MS);
    }, holdRemaining);
    return () => {
      window.clearTimeout(holdTimer);
      if (exitTimer !== undefined) window.clearTimeout(exitTimer);
    };
  }, [isBooting, isRoleLoading, splashMounted]);

  // Do not render protected controls or guest fallback data while Supabase is
  // still restoring the session. This closes the auth/session race on refresh.
  // Session must survive page refresh - we keep loading until initial session check completes
  if (isBooting || splashMounted) {
    return <SplashScreen status={splashStatusRef.current} exiting={splashExiting} />;
  }

  // Splash Screen (A1): shown only while there is genuinely nothing to render —
  // the session restore. The catalog is deliberately NOT a blocker: `useCatalog`
  // seeds `DEMO_SALONS` synchronously and swaps in remote rows when they
  // arrive, so gating on `catalog.isLoading` would leave a customer staring at
  // the splash for the whole round-trip, or indefinitely if Supabase is slow or
  // unreachable.

  if (showAuthScreen) {
    if (currentPath() === '/auth/reset') {
      return (
        <PasswordUpdatePage
          onComplete={() => {
            setShowAuthScreen(false);
            redirectToApp();
          }}
        />
      );
    }

    return (
      <AuthPage
        initialMode={authInitialMode}
        onAuthSuccess={(authData) => {
          setUser((prev) => ({
            ...prev,
            name: authData.name || prev.name,
            email: authData.email || prev.email,
            phone: authData.phone || prev.phone,
            dateOfBirth: authData.dateOfBirth || prev.dateOfBirth,
            role: authData.role || prev.role || 'customer',
          }));
          setAuthInitialMode('login');
          // AuthPage calls this after Supabase accepts the credentials; the
          // provider's session remains the authority for authenticated UI.
          // After login/signup always route to /customer/home (or a stashed
          // return path such as /customer/book/:salonId).
          if (authData.role === 'salon_owner') {
            console.info('[Nexora] Salon owner authenticated - routing via customer home');
          }
          setActiveTab('home');
          setShowAuthScreen(false);
          // Reset so the first-login location effect re-evaluates for this session.
          locationSetupCheckedRef.current = null;
          redirectToCustomerHome({ replace: true });
        }}
        onExploreAsGuest={() => {
          setShowAuthScreen(false);
          setShowFirstLoginLocation(false);
          goToCustomer(CUSTOMER_HOME, { replace: true });
        }}
      />
    );
  }

  // First login after a successful sign-in: ask for location before the shell.
  if (showFirstLoginLocation && userId && isAuthenticated) {
    return (
      <FirstLoginLocationScreen
        userId={userId}
        userName={user.name}
        onComplete={handleFirstLoginLocationComplete}
        onSkip={handleFirstLoginLocationSkip}
      />
    );
  }

  return (
    <div className="min-h-screen bg-surface-off-white text-on-surface flex flex-col font-body-md selection:bg-nexora-pink/20 selection:text-nexora-pink">
      {chooseProfessionalData ? (
        <ChooseProfessionalScreen
          user={user}
          currentLocation={currentLocation}
          salon={chooseProfessionalData.salon}
          service={chooseProfessionalData.service}
          services={chooseProfessionalData.services}
          activeAppointmentsCount={appointments.filter((a) => {
            const s = (a.status || '').toLowerCase();
            return s === 'confirmed' || s === 'pending' || s === 'in_progress';
          }).length}
          onBack={() => setChooseProfessionalData(null)}
          onOpenLocation={() => setIsLocationModalOpen(true)}
          onOpenNotifications={() => setIsNotificationsModalOpen(true)}
          onOpenProfile={() => {
            setChooseProfessionalData(null);
            if (isAuthenticated) {
              goToCustomer(CUSTOMER_PROFILE);
            } else {
              rememberCustomerReturnPath(CUSTOMER_PROFILE);
              setShowAuthScreen(true);
              setAuthInitialMode('login');
              redirectToCustomerLogin({ replace: true, returnTo: CUSTOMER_PROFILE });
            }
          }}
          onSelectTab={(tab) => {
            setChooseProfessionalData(null);
            handleSelectTab(tab);
          }}
          onContinueBooking={(stylist, selectedSlot, updatedServices) => {
            const targetSalon = chooseProfessionalData.salon || salons[0];
            const finalServices =
              updatedServices && updatedServices.length > 0
                ? updatedServices
                : chooseProfessionalData.services && chooseProfessionalData.services.length > 0
                ? chooseProfessionalData.services
                : chooseProfessionalData.service
                ? [chooseProfessionalData.service]
                : targetSalon.services.length > 0
                ? [targetSalon.services[0]]
                : [];
            
            // Set up booking draft and open BookingSummaryModal
            setBookingSummaryDraft({
              salon: targetSalon,
              services: finalServices,
              stylist: stylist || null,
              date: slotToIsoDate(selectedSlot),
              time: selectedSlot?.time || '2:30 PM',
              notes: '',
              // This path reaches the review screen without passing through
              // BookingModal step 5, so seed the contact from the stored
              // profile. Without it the review screen rendered no contact
              // block at all and the salon's contact was invisible here,
              // unlike the modal path. Same resolution order as
              // handleServerBooking, so what is shown is what is sent.
              customer: {
                name: user.name,
                phone: session?.user?.phone || user.phone,
                email: session?.user?.email || user.email,
              },
            });
            setChooseProfessionalData(null);
            setIsBookingSummaryModalOpen(true);
          }}
        />
      ) : (
        <>
          {/* Fixed Header */}
          <Header
            user={isAuthenticated ? user : null}
            isAuthenticated={isAuthenticated}
            currentLocation={currentLocation}
            onOpenLocation={() => setIsLocationModalOpen(true)}
            onOpenProfile={() => {
              if (isAuthenticated) {
                goToCustomer(CUSTOMER_PROFILE);
              } else {
                rememberCustomerReturnPath(CUSTOMER_PROFILE);
                setShowAuthScreen(true);
                setAuthInitialMode('login');
                redirectToCustomerLogin({ replace: true, returnTo: CUSTOMER_PROFILE });
              }
            }}
            onOpenNotifications={() => {
              if (isAuthenticated) {
                goToCustomer(CUSTOMER_NOTIFICATIONS);
                setIsNotificationsModalOpen(true);
              } else {
                rememberCustomerReturnPath(CUSTOMER_NOTIFICATIONS);
                setShowAuthScreen(true);
                setAuthInitialMode('login');
                redirectToCustomerLogin({ replace: true, returnTo: CUSTOMER_NOTIFICATIONS });
              }
            }}
            onOpenAuth={() => {
              setShowAuthScreen(true);
              setAuthInitialMode('login');
              redirectToCustomerLogin({ replace: false });
            }}
            hasUnreadNotifications={unreadNotifications > 0}
          />

          {/* Main Content Area — driven by /customer/* routes via activeTab */}
          <main className="pt-16 min-h-screen flex-1 flex flex-col">
            {/*
              One boundary for the lazily-loaded secondary screens. The fallback
              is deliberately minimal: it only shows while a route chunk is in
              flight on first navigation, and it keeps the header and bottom nav
              (rendered outside this boundary) fully interactive meanwhile.
            */}
            <Suspense
              fallback={
                <div
                  id="route-chunk-loading"
                  role="status"
                  aria-live="polite"
                  className="flex-1 flex items-center justify-center py-16"
                >
                  <span className="text-[13px] text-on-surface-variant">Loading…</span>
                </div>
              }
            >
            {(activeTab === 'home' ||
              customerRoute.kind === 'salon' ||
              customerRoute.kind === 'book') &&
              activeTab !== 'search' &&
              customerRoute.kind !== 'services' &&
              customerRoute.kind !== 'service' &&
              customerRoute.kind !== 'membership' &&
              customerRoute.kind !== 'notifications' && (
              <HomeTab
                user={user}
                salons={salons}
                currentLocation={currentLocation}
                upcomingAppointment={upcomingAppointment}
                savedSalonIds={savedSalonIds}
                appointments={appointments}
                initialSearchQuery={undefined}
                onSearchQueryChange={(q) => {
                  // Typing on Home promotes the URL to /customer/search?q=
                  setRouteSearchQuery(q);
                  if (q.trim()) {
                    const next = customerSearchPath(q);
                    if (typeof window !== 'undefined') {
                      const current = `${window.location.pathname}${window.location.search}`;
                      if (current !== next) {
                        window.history.replaceState({ nexoraCustomer: 'search' }, '', next);
                      }
                    }
                    setCustomerRoute(
                      parseCustomerRoute(
                        CUSTOMER_SEARCH,
                        q ? `?q=${encodeURIComponent(q)}` : ''
                      )
                    );
                    setActiveTab('search');
                  }
                }}
                onOpenSalonDetails={handleOpenSalonDetails}
                onBookSalon={handleOpenBooking}
                onOpenAppointmentDetails={(apt) => {
                  if (apt?.id) {
                    handleViewBookingDetail(apt.id);
                  } else {
                    goToCustomer(CUSTOMER_BOOKINGS);
                  }
                }}
                onToggleSaveSalon={handleToggleSaveSalon}
                onOpenLocation={() => setIsLocationModalOpen(true)}
                onOpenMembership={() => goToCustomer(CUSTOMER_MEMBERSHIP)}
                onOpenReferral={() => goToCustomer(CUSTOMER_REFERRAL)}
                playingVideoId={playingVideoId}
                onPlayingVideoChange={setPlayingVideoId}
              />
            )}

            {activeTab === 'search' &&
              customerRoute.kind !== 'membership' &&
              customerRoute.kind !== 'services' &&
              customerRoute.kind !== 'service' && (
              <SearchTab
                user={user}
                salons={salons}
                currentLocation={currentLocation}
                savedSalonIds={savedSalonIds}
                initialSearchQuery={routeSearchQuery}
                onSearchQueryChange={(q) => {
                  setRouteSearchQuery(q);
                  const next = customerSearchPath(q);
                  if (typeof window !== 'undefined') {
                    const current = `${window.location.pathname}${window.location.search}`;
                    if (current !== next) {
                      window.history.replaceState({ nexoraCustomer: 'search' }, '', next);
                    }
                  }
                  setCustomerRoute(
                    parseCustomerRoute(
                      CUSTOMER_SEARCH,
                      q ? `?q=${encodeURIComponent(q)}` : ''
                    )
                  );
                }}
                onOpenSalonDetails={handleOpenSalonDetails}
                onBookSalon={handleOpenBooking}
                onToggleSaveSalon={handleToggleSaveSalon}
                onOpenLocation={() => setIsLocationModalOpen(true)}
                onOpenServices={() => goToCustomer(customerServicesPath())}
              />
            )}

            {/* Services Screen (B7) — /customer/services */}
            {customerRoute.kind === 'services' && (
              <ServicesScreen
                salons={salons}
                initialQuery={customerRoute.query}
                initialCategory={customerRoute.category}
                savedServiceRefs={savedServices}
                onToggleSaveService={(salonId, service) =>
                  handleToggleSaveService(salonId, service.id)
                }
                onOpenService={(entry) =>
                  goToCustomer(customerServicePath(entry.service.id, entry.salon.id))
                }
                onBookService={(salon, service) => handleOpenBooking(salon, service)}
                onBack={() => goToCustomer(CUSTOMER_SEARCH, { replace: true })}
              />
            )}

            {/* Service Detail Screen (B8) — /customer/service/:serviceId */}
            {customerRoute.kind === 'service' &&
              (() => {
                // The `?salon=` hint disambiguates ids that repeat across salons;
                // without it we fall back to the first salon offering the service.
                const scoped = customerRoute.salonId
                  ? salons.filter((s) => s.id === customerRoute.salonId)
                  : salons;
                const owner =
                  scoped.find((s) => s.services.some((sv) => sv.id === customerRoute.serviceId)) ||
                  salons.find((s) => s.services.some((sv) => sv.id === customerRoute.serviceId)) ||
                  null;
                const service =
                  owner?.services.find((sv) => sv.id === customerRoute.serviceId) || null;

                if (!owner || !service) {
                  return (
                    <div className="px-4 pt-10 pb-28 max-w-3xl mx-auto w-full text-center">
                      <span className="material-symbols-outlined text-[36px] text-on-surface-variant">
                        search_off
                      </span>
                      <p className="mt-2 text-[14px] font-semibold text-on-surface">
                        That service is no longer listed
                      </p>
                      <p className="mt-1 text-[12px] text-on-surface-variant">
                        It may have been renamed or removed by the salon.
                      </p>
                      <button
                        type="button"
                        onClick={() => goToCustomer(CUSTOMER_SERVICES)}
                        className="mt-4 px-4 py-2 rounded-lg bg-nexora-pink text-white text-[12px] font-bold"
                      >
                        Browse all services
                      </button>
                    </div>
                  );
                }

                // Same-named treatments at other salons, for price comparison.
                const alternatives = salons
                  .filter((s) => s.id !== owner.id)
                  .flatMap((s) =>
                    s.services
                      .filter(
                        (sv) => sv.name.trim().toLowerCase() === service.name.trim().toLowerCase()
                      )
                      .map((sv) => ({ salon: s, service: sv }))
                  )
                  .sort((a, b) => a.service.price - b.service.price)
                  .slice(0, 6);

                return (
                  <ServiceDetailScreen
                    service={service}
                    salon={owner}
                    alternatives={alternatives}
                    savedServiceIds={savedServices
                      .filter((s) => s.salonId === owner.id)
                      .map((s) => s.serviceId)}
                    onToggleSaveService={(salonId, svc) =>
                      handleToggleSaveService(salonId, svc.id)
                    }
                    onBook={(s, svc, stylist) => handleOpenBooking(s, svc, stylist ?? undefined)}
                    onOpenSalon={(s) => handleOpenSalonDetails(s)}
                    onOpenAlternative={(s, svc) =>
                      goToCustomer(customerServicePath(svc.id, s.id))
                    }
                    onBack={() => goToCustomer(CUSTOMER_SERVICES, { replace: true })}
                  />
                );
              })()}

            {activeTab === 'bookings' && customerRoute.kind !== 'membership' &&
              (customerRoute.kind === 'booking' ? (
                <BookingDetailPage
                  bookingId={customerRoute.bookingId}
                  appointment={
                    appointments.find(
                      (a) =>
                        a.id === customerRoute.bookingId ||
                        a.bookingRef === customerRoute.bookingId
                    ) || null
                  }
                  onBack={() => goToCustomer(CUSTOMER_BOOKINGS, { replace: true })}
                  onCancel={async (id) => {
                    // Only leave the detail screen once the server confirms.
                    // Navigating on a refused cancellation stranded the user on
                    // the list with a booking that was still active.
                    const cancelled = await handleCancelAppointment(id);
                    if (cancelled) goToCustomer(CUSTOMER_BOOKINGS, { replace: true });
                  }}
                  onRebook={(apt) => {
                    handleBookAgain(apt);
                  }}
                  onReschedule={(id) => {
                    handleRescheduleAppointment(id);
                  }}
                  onOpenSalon={(salonId) => {
                    const s = salons.find((item) => item.id === salonId);
                    if (s) handleOpenSalonDetails(s);
                  }}
                  onOpenRewards={() => goToCustomer(CUSTOMER_REWARDS)}
                />
              ) : (
                <AppointmentsTab
                  appointments={appointments}
                  highlightedBookingId={undefined}
                  cancellationError={cancellationError}
                  onCancelAppointment={handleCancelAppointment}
                  onRescheduleAppointment={handleRescheduleAppointment}
                  onBookAgain={handleBookAgain}
                  onOpenSalonDetailsById={(id) => {
                    const s = salons.find((item) => item.id === id);
                    if (s) handleOpenSalonDetails(s);
                  }}
                  onOpenBookingDetail={handleViewBookingDetail}
                  onExploreSalons={() => goToCustomer(CUSTOMER_HOME)}
                />
              ))}

            {activeTab === 'rewards' && customerRoute.kind !== 'membership' && (
              <RewardsTab
                user={user}
                userId={userId || undefined}
                salons={salons}
                appointments={appointments}
                onNavigateToBooking={() => goToCustomer(CUSTOMER_HOME)}
                onOpenMembership={() => goToCustomer(CUSTOMER_MEMBERSHIP)}
                onOpenReferral={() => goToCustomer(CUSTOMER_REFERRAL)}
                onOpenSalonDetails={handleOpenSalonDetails}
              />
            )}

            {activeTab === 'saved' && customerRoute.kind !== 'membership' && (
              <SavedTab
                salons={salons}
                savedSalonIds={savedSalonIds}
                savedServices={savedServices}
                savedStaff={savedStaff}
                onOpenSalonDetails={handleOpenSalonDetails}
                onBookSalon={handleOpenBooking}
                onToggleSaveSalon={handleToggleSaveSalon}
                onToggleSaveService={handleToggleSaveService}
                onToggleSaveStaff={handleToggleSaveStaff}
                onExploreSalons={() => goToCustomer(CUSTOMER_SEARCH)}
              />
            )}

            {customerRoute.kind === 'membership' && (
              <MembershipPage
                user={user}
                salons={salons}
                appointments={appointments}
                onUpdateUser={setUser}
                onBack={() => goToCustomer(CUSTOMER_HOME, { replace: true })}
                onNavigateToBooking={() => goToCustomer(CUSTOMER_HOME)}
                onOpenSalonDetails={handleOpenSalonDetails}
                onOpenRewards={() => goToCustomer(CUSTOMER_REWARDS)}
              />
            )}

            {customerRoute.kind === 'settings' && (
              <SettingsPage
                user={user}
                onUpdateUser={setUser}
                onBack={() => goToCustomer(CUSTOMER_PROFILE, { replace: true })}
                onLogout={handleLogout}
                onDeleteAccount={handleDeleteAccount}
                onOpenLocationModal={() => setIsLocationModalOpen(true)}
              />
            )}

            {customerRoute.kind === 'referral' && (
              <ReferralPage
                user={user}
                userId={userId}
                onBack={() => goToCustomer(CUSTOMER_PROFILE, { replace: true })}
                onOpenRewards={() => goToCustomer(CUSTOMER_REWARDS)}
                onExploreSalons={() => goToCustomer(CUSTOMER_SEARCH)}
              />
            )}

            {customerRoute.kind === 'reviews' && (
              <ReviewsPage
                user={user}
                appointments={appointments}
                onBack={() => goToCustomer(CUSTOMER_PROFILE, { replace: true })}
                onNavigateToBooking={() => goToCustomer(CUSTOMER_HOME)}
                onExploreSalons={() => goToCustomer(CUSTOMER_SEARCH)}
              />
            )}

            {customerRoute.kind === 'notifications' && (
              <NotificationsPage
                user={user}
                userId={userId || undefined}
                onBack={() => goToCustomer(CUSTOMER_HOME, { replace: true })}
                onOpenBookings={() => goToCustomer(CUSTOMER_BOOKINGS)}
                onOpenRewards={() => goToCustomer(CUSTOMER_REWARDS)}
                onOpenMembership={() => goToCustomer(CUSTOMER_MEMBERSHIP)}
                onOpenReferral={() => goToCustomer(CUSTOMER_REFERRAL)}
                onOpenReviews={() => goToCustomer(CUSTOMER_REVIEWS)}
                onExploreSalons={() => goToCustomer(CUSTOMER_SEARCH)}
                onNotificationsChanged={refreshNotifications}
              />
            )}

            {activeTab === 'profile' &&
              customerRoute.kind !== 'membership' &&
              customerRoute.kind !== 'settings' &&
              customerRoute.kind !== 'referral' &&
              customerRoute.kind !== 'reviews' && (
                <ProfileTab
                  user={user}
                  appointments={appointments}
                  onUpdateUser={setUser}
                  onNavigateToBooking={() => goToCustomer(CUSTOMER_HOME)}
                  onViewAppointments={handleViewAppointments}
                  onViewFavourites={() => goToCustomer(CUSTOMER_FAVOURITES)}
                  onOpenNotifications={() => {
                    goToCustomer(CUSTOMER_NOTIFICATIONS);
                    setIsNotificationsModalOpen(true);
                  }}
                  onOpenSettings={() => goToCustomer(CUSTOMER_SETTINGS)}
                  onOpenRewards={() => goToCustomer(CUSTOMER_REWARDS)}
                  onOpenMembership={() => goToCustomer(CUSTOMER_MEMBERSHIP)}
                  onOpenReferral={() => goToCustomer(CUSTOMER_REFERRAL)}
                  onOpenReviews={() => goToCustomer(CUSTOMER_REVIEWS)}
                  unreadNotifications={unreadNotifications}
                  favouritesCount={savedSalonIds.length}
                  onLogout={handleLogout}
                  onDeleteAccount={handleDeleteAccount}
                />
              )}
            </Suspense>
          </main>
        </>
      )}

      {/*
        Sticky bottom nav — always visible in the post-auth customer shell.
        Hidden only on the booking-confirmation success ticket so the pass is
        full-bleed on mobile. Also suppressed while the Choose Professional
        flow owns its own sticky CTA bar (avoids two stacked fixed footers).
      */}
      <BottomNav
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        activeAppointmentsCount={appointments.filter((a) => {
          const s = (a.status || '').toLowerCase();
          return s === 'confirmed' || s === 'pending' || s === 'in_progress';
        }).length}
        hidden={isBookingConfirmationScreen || Boolean(chooseProfessionalData)}
      />

      {/* Modals & Dialogs */}
      <LocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        currentLocation={currentLocation}
        isLiveSyncActive={locationSync.isWatching}
        isLiveSyncBlocked={locationSync.permissionDenied && !locationSync.isWatching}
        onSelectLocation={(loc, lat, lng, meta) => {
          setCurrentLocation(loc);
          // A selection without coordinates used to be dropped on the floor by
          // the preference store, so the header label reverted on reload.
          // Resolve one through the fallback ladder instead.
          let latitude = lat;
          let longitude = lng;
          let resolvedMeta = meta;
          if (typeof latitude !== 'number' || typeof longitude !== 'number') {
            const resolved = resolveLocationWithFallback({
              typedText: meta?.area || loc,
              saved: userId ? loadCustomerLocation(userId) : null,
              profileArea: user.locationArea || user.defaultLocality || null,
              profileCity: user.city || null,
            });
            latitude = resolved.latitude;
            longitude = resolved.longitude;
            resolvedMeta = {
              area: resolved.area,
              city: resolved.city,
              pincode: resolved.pincode,
              source: resolved.preferenceSource,
            };
            setCurrentLocation(resolved.label);
          }
          if (userId && typeof latitude === 'number' && typeof longitude === 'number') {
            const lat2 = latitude;
            const lng2 = longitude;
            const area = resolvedMeta?.area || loc.split(',')[0]?.trim() || loc;
            const city = resolvedMeta?.city || loc.split(',').slice(-1)[0]?.trim() || 'Jaipur';
            void persistCustomerLocation(userId, {
              latitude: lat2,
              longitude: lng2,
              city,
              area,
              pincode: resolvedMeta?.pincode,
              label: resolvedMeta === meta ? loc : `${area}, ${city}`,
              source: resolvedMeta?.source || (resolvedMeta?.area ? 'chip' : 'gps'),
            }).then((saved) => {
              if (saved) {
                setUser((prev) => ({
                  ...prev,
                  locationArea: saved.area,
                  city: saved.city,
                  defaultLocality: saved.area,
                  savedAddresses: mergeHomeAddress(prev.savedAddresses, saved),
                }));
              }
            });
          } else if (typeof latitude === 'number' && typeof longitude === 'number') {
            // Guest: push is a no-op without a session, but keep the label.
            void handleManualLocationSync(latitude, longitude);
          }
        }}
      />

      <BookingModal
        isOpen={isBookingModalOpen}
        onClose={() => {
          setIsBookingModalOpen(false);
          if (customerRoute.kind === 'book') {
            goToCustomer(CUSTOMER_HOME, { replace: true });
          }
        }}
        salon={selectedSalonForBooking}
        initialService={selectedServiceForBooking}
        initialServices={selectedServicesForBooking}
        initialStylist={selectedStylistForBooking}
        onConfirmBooking={handleConfirmBooking}
        onViewAppointments={handleViewAppointments}
        customerDetails={
          bookingCustomerDetails || {
            name: user.name,
            email: user.email,
            phone: user.phone,
          }
        }
        onOpenSummary={(draft) => {
          setIsBookingModalOpen(false);
          setBookingSummaryDraft(draft);
          setIsBookingSummaryModalOpen(true);
        }}
      />

      <BookingSummaryModal
        isOpen={isBookingSummaryModalOpen}
        onClose={() => {
          setIsBookingSummaryModalOpen(false);
          setIsBookingConfirmationScreen(false);
        }}
        salon={bookingSummaryDraft?.salon || null}
        services={bookingSummaryDraft?.services || []}
        stylist={bookingSummaryDraft?.stylist || null}
        date={bookingSummaryDraft?.date || new Date().toISOString().split('T')[0]}
        time={bookingSummaryDraft?.time || '2:30 PM'}
        specialNotes={bookingSummaryDraft?.notes || ''}
        customer={bookingSummaryDraft?.customer || null}
        onConfirmBooking={handleConfirmBooking}
        onPayDeposit={handleServerBooking}
        onViewAppointments={() => {
          setIsBookingConfirmationScreen(false);
          handleViewAppointments();
        }}
        onRebook={(apt) => {
          setIsBookingSummaryModalOpen(false);
          setIsBookingConfirmationScreen(false);
          handleBookAgain(apt);
        }}
        onOpenSalon={(salonId) => {
          const s = salons.find((item) => item.id === salonId);
          if (s) {
            setIsBookingSummaryModalOpen(false);
            setIsBookingConfirmationScreen(false);
            handleOpenSalonDetails(s);
          }
        }}
        onConfirmationStateChange={setIsBookingConfirmationScreen}
        onUpdateServices={(updatedServices) => {
          if (bookingSummaryDraft) {
            setBookingSummaryDraft({
              ...bookingSummaryDraft,
              services: updatedServices,
            });
          }
        }}
        onUpdateNotes={(newNotes) => {
          if (bookingSummaryDraft) {
            setBookingSummaryDraft({
              ...bookingSummaryDraft,
              notes: newNotes,
            });
          }
        }}
        onChangeSalon={() => {
          setIsBookingSummaryModalOpen(false);
          goToCustomer(CUSTOMER_HOME);
        }}
        onChangeServices={() => {
          if (!bookingSummaryDraft || !bookingSummaryDraft.salon) return;
          setIsBookingSummaryModalOpen(false);
          setChooseProfessionalData({
            salon: bookingSummaryDraft.salon,
            services: bookingSummaryDraft.services,
            service: bookingSummaryDraft.services[0] || null,
          });
        }}
        onChangeProfessional={() => {
          if (!bookingSummaryDraft || !bookingSummaryDraft.salon) return;
          setIsBookingSummaryModalOpen(false);
          setChooseProfessionalData({
            salon: bookingSummaryDraft.salon,
            services: bookingSummaryDraft.services,
            service: bookingSummaryDraft.services[0] || null,
          });
        }}
        onChangeDateTime={() => {
          if (!bookingSummaryDraft || !bookingSummaryDraft.salon) return;
          setIsBookingSummaryModalOpen(false);
          setSelectedSalonForBooking(bookingSummaryDraft.salon);
          setSelectedServicesForBooking(bookingSummaryDraft.services);
          setSelectedServiceForBooking(bookingSummaryDraft.services[0] || null);
          setSelectedStylistForBooking(bookingSummaryDraft.stylist);
          // Carry the confirmed Step 5 details back into the modal so editing
          // the date does not silently reset the contact to the profile values.
          setBookingCustomerDetails(bookingSummaryDraft.customer || null);
          setIsBookingModalOpen(true);
        }}
      />

      <SalonDetailModal
        isOpen={isSalonDetailModalOpen}
        onClose={() => {
          setIsSalonDetailModalOpen(false);
          // Leave the salon detail URL for a primary screen when dismissing.
          if (customerRoute.kind === 'salon') {
            goToCustomer(CUSTOMER_HOME, { replace: true });
          }
        }}
        salon={selectedSalonForDetail}
        userLocation={currentLocation}
        isSaved={selectedSalonForDetail ? savedSalonIds.includes(selectedSalonForDetail.id) : false}
        onToggleSave={handleToggleSaveSalon}
        savedServiceIds={
          selectedSalonForDetail
            ? savedServices.filter((s) => s.salonId === selectedSalonForDetail.id).map((s) => s.serviceId)
            : []
        }
        onToggleSaveService={handleToggleSaveService}
        onBookService={(salon, srv, st, services) => {
          setIsSalonDetailModalOpen(false);
          // `services` carries the salon page's multi-service cart so a bulk
          // selection survives into the booking modal instead of collapsing
          // to the single service that was tapped.
          handleOpenBooking(salon, srv, st, services);
        }}
      />

      <NotificationsModal
        isOpen={isNotificationsModalOpen}
        onClose={() => {
          setIsNotificationsModalOpen(false);
          // Only bounce off the notifications URL when the user dismisses the
          // panel without picking a row. A selected notification already
          // navigates to its target (Bookings / Rewards / …) via
          // handleOpenNotification — overwriting that here would race home.
          if (
            customerRoute.kind === 'notifications' &&
            parseCustomerRoute().kind === 'notifications'
          ) {
            goToCustomer(CUSTOMER_HOME, { replace: true });
          }
        }}
        userId={userId}
        notifications={notifications}
        isLoading={isNotificationsLoading}
        isDisabled={notificationsDisabled}
        errorMessage={notificationsError}
        onSelectNotification={handleOpenNotification}
        onRefresh={refreshNotifications}
        onNotificationsChanged={() => void refreshNotifications()}
      />
    </div>
  );
}
