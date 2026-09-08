import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { MembershipPage } from './components/MembershipPage';
import { SettingsPage } from './components/SettingsPage';
import { ReferralPage } from './components/ReferralPage';
import { ReviewsPage } from './components/ReviewsPage';
import { NotificationsPage } from './components/NotificationsPage';
import { ProfileTab } from './components/ProfileTab';
import { LocationModal } from './components/LocationModal';
import { FirstLoginLocationScreen } from './components/FirstLoginLocationScreen';
import { BookingModal } from './components/BookingModal';
import { SalonDetailModal } from './components/SalonDetailModal';
import { NotificationsModal } from './components/NotificationsModal';
import { ChooseProfessionalScreen } from './components/ChooseProfessionalScreen';
import { BookingSummaryModal, type BookingPaymentRequest } from './components/BookingSummaryModal';
import { AuthPage } from './components/auth/AuthPage';
import { PasswordUpdatePage } from './components/auth/PasswordUpdatePage';
import { isSupabaseConfigured, getSupabaseConfigStatus } from './lib/supabase';
import { useAuth } from './providers/AuthProvider';
import { useLocationSync } from './hooks/useLocationSync';
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
  createCustomerBooking,
  fetchCustomerBookings,
  cancelCustomerBooking,
  subscribeToCustomerBookings,
} from './lib/bookingService';
import { fetchCustomerFavourites, toggleCustomerFavourite } from './lib/favouritesService';
import { loadRewardWallet } from './lib/rewardsService';
import { loadMembership } from './lib/membershipService';
import { recordSearch } from './lib/searchHistoryService';
import { isLiveCustomerDataEnabled } from './lib/supabase';
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
  CUSTOMER_SETTINGS,
  canonicalizeCustomerPath,
  customerBookPath,
  customerBookingPath,
  customerRouteToTab,
  customerSalonPath,
  customerSearchPath,
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
import { fetchUserProfile, profileRowToUser, saveUserProfile } from './lib/profileService';
import {
  listNotifications,
  resolveNotificationTarget,
  subscribeToNotifications,
  type AppNotification,
} from './lib/notificationService';

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
      const path = currentPath();

      // Password recovery stays on the dedicated /auth/reset screen.
      if (path === '/auth/reset') {
        setShowAuthScreen(true);
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

  /**
   * Update the in-memory profile and, when live Supabase is configured,
   * persist the signed-in customer's own row to `profiles`. The local store is
   * only a device cache used by the offline preview.
   */
  const handleUpdateUser = useCallback((updated: UserProfile) => {
    setUser(updated);
    if (!userId) return;
    saveJson(scopedStorageKey(STORAGE_KEYS.profile, userId), updated);
    if (isLiveCustomerDataEnabled) {
      void saveUserProfile(userId, updated);
    }
  }, [userId]);

  /**
   * Load the live customer records for this user from Supabase. In real
   * Supabase mode bookings and favourites come ONLY from the database — the
   * localStorage arrays are treated as an offline/local-demo cache only.
   */
  const refreshLiveCustomerData = useCallback(async (uid: string) => {
    if (!isLiveCustomerDataEnabled) return;

    const [bookingsResult, favourites, wallet, membership, notificationsResult] = await Promise.all([
      fetchCustomerBookings(uid),
      fetchCustomerFavourites(uid),
      loadRewardWallet(uid),
      loadMembership(uid),
      listNotifications(uid),
    ]);
    if (notificationsResult.ok) {
      setNotifications(notificationsResult.data);
    }
    setAppointments(bookingsResult.appointments);
    setSavedSalonIds(favourites.salonIds);
    setSavedServices(
      favourites.serviceRefs.map((ref) => ({ salonId: ref.salonId, serviceId: ref.serviceId }))
    );
    setSavedStaff(
      favourites.staffRefs.map((ref) => ({ salonId: ref.salonId, stylistId: ref.staffId }))
    );
    // Keep the profile's loyalty/membership summary in sync with the live DB.
    setUser((prev) => ({
      ...prev,
      loyaltyPoints: wallet.currentPoints > 0 ? wallet.currentPoints : prev.loyaltyPoints,
      membershipTier: membership?.tier || prev.membershipTier,
      membershipExpiresAt: membership?.expiresAt || prev.membershipExpiresAt,
      referralCode: prev.referralCode,
    }));
  }, []);

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
          if (profile) {
            const live = profileRowToUser(profile as unknown as Record<string, unknown>);
            setUser((prev) => ({
              ...prev,
              ...live,
              name: live.name || prev.name,
              email: live.email || prev.email,
              phone: live.phone || prev.phone,
              avatar: live.avatar || prev.avatar,
              city: live.city || prev.city,
              locationArea: live.locationArea || prev.locationArea,
              defaultLocality: live.defaultLocality || prev.defaultLocality,
            }));
          }
        }
      } catch (err) {
        console.warn('[Nexora] Failed to refresh profile from backend:', err);
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
    // Live Supabase data replaces local/draft copies whenever the real database
    // is configured. Reviews edited in memory are not authoritative and must
    // not bleed into a different account after switching sessions.
    void refreshLiveCustomerData(userId);
    // Reviews edited in memory are not authoritative and must not bleed into a
    // different account after switching sessions.
  }, [userId, session?.user, authRole, refreshLiveCustomerData]);

  // Live booking updates (e.g. salon confirms/cancels) are reflected while the
  // customer is signed in. RLS keeps the realtime feed scoped to the caller.
  useEffect(() => {
    if (!userId || !isLiveCustomerDataEnabled) return;
    const unsubscribe = subscribeToCustomerBookings(userId, () => {
      void refreshLiveCustomerData(userId);
    });
    return unsubscribe;
  }, [userId, refreshLiveCustomerData]);

  // Live notification inbox. Only the signed-in user's own rows are delivered
  // through the realtime filter (mirrors RLS).
  useEffect(() => {
    if (!userId || !isLiveCustomerDataEnabled) return;
    const unsubscribe = subscribeToNotifications(userId, () => {
      void (async () => {
        const result = await listNotifications(userId);
        if (result.ok) setNotifications(result.data);
      })();
    });
    return unsubscribe;
  }, [userId]);

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

  const handleConfirmBooking = (newAppointment: Appointment) => {
    // The UI may receive a booking only from a live booking adapter. Keep the
    // guard here as a second line of defence; appointment state must never be
    // created from an unauthenticated client event.
    if (!isSupabaseConfigured || !userId) return;
    setAppointments((prev) => [newAppointment, ...prev.filter((a) => a.id !== newAppointment.id)]);
    if (isLiveCustomerDataEnabled) {
      void refreshLiveCustomerData(userId);
    }
  };

  /**
   * Transactional booking creation used by the summary/payment screen.
   * Creates the `bookings` row plus every `booking_services` row, then returns
   * the refreshed booking so the confirmation ticket comes from the DB.
   */
  const handlePayDepositBooking = async (request: BookingPaymentRequest): Promise<Appointment> => {
    if (!userId || !isLiveCustomerDataEnabled) {
      throw new Error('Online booking is available only when the live Supabase database is configured.');
    }
    const draft = bookingSummaryDraft;
    const salon = draft?.salon || salons.find((item) => item.id === request.salonId) || null;
    if (!salon) throw new Error('Salon record not found for booking.');

    const selectedIds = new Set(request.serviceIds);
    const services = draft?.services?.length
      ? draft.services.filter((service) => selectedIds.has(service.id))
      : salon.services.filter((service) => selectedIds.has(service.id));
    if (!services.length) throw new Error('No services selected for booking.');

    const stylist =
      draft?.stylist ||
      salon.stylists.find((member) => member.id === request.stylistId) ||
      null;

    const totalPrice = services.reduce((sum, s) => sum + (s.discountPrice || s.price || 0), 0);
    const advancePaid = request.amount || Math.round(totalPrice * 0.25);
    const { appointment, error } = await createCustomerBooking({
      userId,
      salonId: salon.id,
      staffId: stylist?.id || null,
      date: request.date,
      time: request.time,
      services,
      totalPrice,
      advancePaid,
      remainingAmount: Math.max(0, totalPrice - advancePaid),
      paymentMode: 'advance_25',
      paymentStatus: 'paid',
      discountApplied: null,
      notes: request.notes,
      couponCode: request.couponCode,
      paymentMethodUsed: 'qr',
    });
    if (error || !appointment) {
      throw new Error(error || 'Booking could not be created.');
    }
    return appointment;
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

  const handleToggleSaveSalon = async (salonId: string) => {
    const nowFavourite = !savedSalonIds.includes(salonId);
    setSavedSalonIds((prev) =>
      prev.includes(salonId) ? prev.filter((id) => id !== salonId) : [...prev, salonId]
    );
    if (userId && isLiveCustomerDataEnabled) {
      await toggleCustomerFavourite(userId, { salonIds: savedSalonIds, serviceIds: [], staffIds: [], serviceRefs: [], staffRefs: [] }, { salonId });
      void refreshLiveCustomerData(userId);
    }
  };

  const handleToggleSaveService = async (salonId: string, serviceId: string) => {
    setSavedServices((prev) => {
      const exists = prev.some((item) => item.salonId === salonId && item.serviceId === serviceId);
      if (exists) {
        return prev.filter((item) => !(item.salonId === salonId && item.serviceId === serviceId));
      }
      return [...prev, { salonId, serviceId }];
    });
    if (userId && isLiveCustomerDataEnabled) {
      await toggleCustomerFavourite(userId, { salonIds: savedSalonIds, serviceIds: savedServices.map((s) => s.serviceId), staffIds: [], serviceRefs: savedServices, staffRefs: [] }, { salonId, serviceId });
      void refreshLiveCustomerData(userId);
    }
  };

  const handleToggleSaveStaff = async (salonId: string, stylistId: string) => {
    setSavedStaff((prev) => {
      const exists = prev.some((item) => item.salonId === salonId && item.stylistId === stylistId);
      if (exists) {
        return prev.filter((item) => !(item.salonId === salonId && item.stylistId === stylistId));
      }
      return [...prev, { salonId, stylistId }];
    });
    if (userId && isLiveCustomerDataEnabled) {
      await toggleCustomerFavourite(userId, { salonIds: savedSalonIds, serviceIds: [], staffIds: savedStaff.map((s) => s.stylistId), serviceRefs: [], staffRefs: savedStaff.map((s) => ({ salonId: s.salonId, staffId: s.stylistId })) }, { salonId, staffId: stylistId });
      void refreshLiveCustomerData(userId);
    }
  };

  const handleCancelAppointment = async (id: string) => {
    if (userId && isLiveCustomerDataEnabled) {
      await cancelCustomerBooking(userId, id);
    }
    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'cancelled' } : a))
    );
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
    // Supabase user deletion requires a trusted server/Edge Function. Signing
    // out and deleting browser keys is not account deletion, so refuse to make
    // a destructive promise until that canonical endpoint is wired in.
    console.warn('[Nexora] Account deletion requested but no secure deletion service is configured.');
    return false;
  };

  // Do not render protected controls or guest fallback data while Supabase is
  // still restoring the session. This closes the auth/session race on refresh.
  // Session must survive page refresh - we keep loading until initial session check completes
  if (isSupabaseConfigured && (isAuthLoading || isRoleLoading)) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-surface-off-white text-on-surface">
        <p className="text-sm text-on-surface-variant" role="status">Restoring your secure session…</p>
      </main>
    );
  }

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
            {(activeTab === 'home' ||
              customerRoute.kind === 'salon' ||
              customerRoute.kind === 'book') &&
              activeTab !== 'search' &&
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
                  // Live search history is recorded for the signed-in user.
                  if (userId && isLiveCustomerDataEnabled && q.trim()) {
                    void recordSearch(userId, q);
                  }
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
              />
            )}

            {activeTab === 'search' && customerRoute.kind !== 'membership' && (
              <SearchTab
                user={user}
                userId={userId || undefined}
                salons={salons}
                currentLocation={currentLocation}
                savedSalonIds={savedSalonIds}
                initialSearchQuery={routeSearchQuery}
                onSearchQueryChange={(q) => {
                  if (userId && isLiveCustomerDataEnabled && q.trim()) {
                    void recordSearch(userId, q);
                  }
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
              />
            )}

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
                  onCancel={(id) => {
                    handleCancelAppointment(id);
                    goToCustomer(CUSTOMER_BOOKINGS, { replace: true });
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
                userId={userId || undefined}
                salons={salons}
                appointments={appointments}
                onUpdateUser={handleUpdateUser}
                onBack={() => goToCustomer(CUSTOMER_HOME, { replace: true })}
                onNavigateToBooking={() => goToCustomer(CUSTOMER_HOME)}
                onOpenSalonDetails={handleOpenSalonDetails}
                onOpenRewards={() => goToCustomer(CUSTOMER_REWARDS)}
              />
            )}

            {customerRoute.kind === 'settings' && (
              <SettingsPage
                user={user}
                onUpdateUser={handleUpdateUser}
                onBack={() => goToCustomer(CUSTOMER_PROFILE, { replace: true })}
                onLogout={handleLogout}
                onDeleteAccount={handleDeleteAccount}
                onOpenLocationModal={() => setIsLocationModalOpen(true)}
              />
            )}

            {customerRoute.kind === 'referral' && (
              <ReferralPage
                user={user}
                userId={userId || undefined}
                onBack={() => goToCustomer(CUSTOMER_PROFILE, { replace: true })}
                onOpenRewards={() => goToCustomer(CUSTOMER_REWARDS)}
                onExploreSalons={() => goToCustomer(CUSTOMER_SEARCH)}
              />
            )}

            {customerRoute.kind === 'reviews' && (
              <ReviewsPage
                user={user}
                appointments={appointments}
                userId={userId || undefined}
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
                  onUpdateUser={handleUpdateUser}
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
          // Persist structured preference (lat/lng/city/area/pincode) when we
          // have enough detail — first-login and header picker share this path.
          if (userId && typeof lat === 'number' && typeof lng === 'number') {
            const area = meta?.area || loc.split(',')[0]?.trim() || loc;
            const city = meta?.city || loc.split(',').slice(-1)[0]?.trim() || 'Jaipur';
            void persistCustomerLocation(userId, {
              latitude: lat,
              longitude: lng,
              city,
              area,
              pincode: meta?.pincode,
              label: loc,
              source: meta?.source || (meta?.area ? 'chip' : 'gps'),
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
          } else if (typeof lat === 'number' && typeof lng === 'number') {
            // Guest: push is a no-op without a session, but keep the label.
            void handleManualLocationSync(lat, lng);
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
        onPayDeposit={handlePayDepositBooking}
        onConfirmBooking={handleConfirmBooking}
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
        onBookService={(salon, srv, st) => {
          setIsSalonDetailModalOpen(false);
          handleOpenBooking(salon, srv, st);
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
