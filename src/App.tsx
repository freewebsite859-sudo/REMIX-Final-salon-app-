import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActiveTab, Salon, SalonService, Stylist, Appointment, UserProfile, SavedServiceRef } from './types';
import { useCatalog } from './hooks/useCatalog';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { HomeTab } from './components/HomeTab';
import { ExploreTab } from './components/ExploreTab';
import { AppointmentsTab } from './components/AppointmentsTab';
import { SavedTab } from './components/SavedTab';
import { ProfileTab } from './components/ProfileTab';
import { LocationModal } from './components/LocationModal';
import { BookingModal } from './components/BookingModal';
import { SalonDetailModal } from './components/SalonDetailModal';
import { AIAdvisorModal } from './components/AIAdvisorModal';
import { QuickNearestModal } from './components/QuickNearestModal';
import { NotificationsModal } from './components/NotificationsModal';
import { ServiceCategoryScreen } from './components/ServiceCategoryScreen';
import { ChooseProfessionalScreen } from './components/ChooseProfessionalScreen';
import { BookingSummaryModal } from './components/BookingSummaryModal';
import { AuthPage } from './components/auth/AuthPage';
import { PasswordUpdatePage } from './components/auth/PasswordUpdatePage';
import { isSupabaseConfigured, getSupabaseConfigStatus } from './lib/supabase';
import { useAuth } from './providers/AuthProvider';
import { useLocationSync } from './hooks/useLocationSync';
import { clearUserLocation, syncUserLocation } from './lib/locationService';
import { isAppointmentUpcoming } from './lib/appointments';
import { currentPath, isAuthRoute, isSignupRoute, redirectToApp, redirectToLogin } from './lib/authRoutes';
import { fetchUserProfile } from './lib/profileService';
import {
  clearReferralContext,
  finalizePendingReferral,
  getStoredReferralCode,
  getStoredReferralContext,
  readReferralCodeFromUrl,
  redirectReferralEntryToSignup,
} from './lib/referralService';
import {
  listNotifications,
  resolveNotificationTarget,
  type AppNotification,
} from './lib/notificationService';

const STORAGE_KEYS = {
  // These keys hold UI drafts/preferences only. They are never the source of
  // truth for authentication, ownership, bookings, or payment state.
  appointments: 'nexora-appointments',
  savedSalons: 'nexora-saved-salons',
  savedServices: 'nexora-saved-services',
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
        ['confirmed', 'in_progress', 'completed', 'cancelled'].includes(a.status as string)
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

  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  // Auth state is derived exclusively from Supabase. A profile/preferences
  // record may be cached per user for resilience, but it can never establish
  // an authenticated session or ownership.
  const [user, setUser] = useState<UserProfile>(EMPTY_USER);
  const isAuthenticated = Boolean(session?.user);
  const [currentLocation, setCurrentLocation] = useState<string>('Mansarovar, Jaipur');
  const salons = catalog.salons;
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [savedSalonIds, setSavedSalonIds] = useState<string[]>([]);
  const [savedServices, setSavedServices] = useState<SavedServiceRef[]>([]);
  const hydratedUserIdRef = useRef<string | null>(null);
  
  // Dedicated Category & Service Screen
  const [selectedCategoryScreen, setSelectedCategoryScreen] = useState<string | null>(null);

  // Dedicated Choose Professional Screen
  const [chooseProfessionalData, setChooseProfessionalData] = useState<{
    salon?: Salon | null;
    service?: SalonService | null;
    services?: SalonService[] | null;
  } | null>(null);

  // Booking Summary Modal & persistent draft state
  const [isBookingSummaryModalOpen, setIsBookingSummaryModalOpen] = useState(false);
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
  // Referral entry state: an invite link opens Signup (not Home) with its code
  // pre-filled. The code itself lives in the temporary referral context and in
  // the database after signup — never only in this component state.
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'signup'>(() =>
    isSignupRoute() ? 'signup' : 'login'
  );
  const [referralEntryCode, setReferralEntryCode] = useState<string | null>(() =>
    readReferralCodeFromUrl() ?? (typeof window !== 'undefined' ? getStoredReferralCode() : null)
  );
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isSalonDetailModalOpen, setIsSalonDetailModalOpen] = useState(false);
  const [isAIAdvisorModalOpen, setIsAIAdvisorModalOpen] = useState(false);
  const [aiAdvisorInitialTab, setAiAdvisorInitialTab] = useState<'quiz' | 'chat' | 'sentiment'>('quiz');
  const [aiAdvisorInitialSalonId, setAiAdvisorInitialSalonId] = useState<string | undefined>(undefined);
  const [isQuickNearestModalOpen, setIsQuickNearestModalOpen] = useState(false);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);

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

  /** Open the screen a notification points at. */
  const handleOpenNotification = useCallback(
    (notification: AppNotification) => {
      const target = resolveNotificationTarget(notification);
      if (!target) return;
      setChooseProfessionalData(null);
      setSelectedCategoryScreen(null);
      setIsNotificationsModalOpen(false);
      setActiveTab(target.tab);
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
    []
  );

  // Selected entities for modals
  const [selectedSalonForDetail, setSelectedSalonForDetail] = useState<Salon | null>(null);
  const [selectedSalonForBooking, setSelectedSalonForBooking] = useState<Salon | null>(null);
  const [selectedServiceForBooking, setSelectedServiceForBooking] = useState<SalonService | null>(null);
  const [selectedServicesForBooking, setSelectedServicesForBooking] = useState<SalonService[] | null>(null);
  const [selectedStylistForBooking, setSelectedStylistForBooking] = useState<Stylist | null>(null);
  const [exploreQuery, setExploreQuery] = useState<string>('');

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
        redirectToApp();
      }
    } else if (!isAuthLoading) {
      // SIGNED_OUT, or an invalid/expired session the provider could not renew.
      // The provider already redirected expired sessions to /auth/login;
      // render the auth screen when we are on that route.
      // Also enforce route protection: unauthenticated users accessing protected tabs -> login
      if (isAuthRoute()) {
        setShowAuthScreen(true);
      } else if (['profile', 'appointments'].includes(activeTab)) {
        // Protected route while logged out -> redirect to login
        setShowAuthScreen(true);
        redirectToLogin({ replace: true });
      }
    }
  }, [session, isAuthLoading, activeTab]);

  // ---------------------------------------------------------------------------
  // REFERRAL ENTRY
  // An invite link (`?ref=CODE` on ANY route, including `/`) must open the
  // Signup screen with the code pre-filled — never the generic homepage. The
  // code is captured into the temporary referral context BEFORE the URL is
  // rewritten, so it survives the redirect, a page refresh, and a detour to
  // Login and back.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // Wait for session restore so a signed-in user is never pushed to signup.
    if (isSupabaseConfigured && isAuthLoading) return;
    if (session?.user) return;

    const codeInUrl = readReferralCodeFromUrl();
    const navigated = redirectReferralEntryToSignup();
    if (!codeInUrl && !navigated) return;

    const code = codeInUrl ?? getStoredReferralCode();
    if (code) setReferralEntryCode(code);
    setAuthInitialMode('signup');
    setShowAuthScreen(true);
  }, [isAuthLoading, session?.user]);

  // ---------------------------------------------------------------------------
  // REFERRAL CATCH-UP
  // If the Supabase project requires email confirmation, signup returns no
  // session, so the relationship is written as soon as the confirmed session
  // appears. Accounts older than the pending window are ignored, which keeps an
  // existing user signing in later from being silently re-attributed.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const sessionUser = session?.user;
    const uid = sessionUser?.id;
    if (!uid || !isSupabaseConfigured) return;
    const context = getStoredReferralContext();
    if (!context?.code) return;

    let cancelled = false;
    void (async () => {
      const result = await finalizePendingReferral({
        userId: uid,
        code: context.code,
        capturedAt: context.capturedAt,
        accountCreatedAt: sessionUser?.created_at ?? null,
      });
      if (cancelled || !result) return;
      // Keep the context only while the backend could not accept it yet.
      if (result.status !== 'unavailable') clearReferralContext();
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.user]);

  // Load only this authenticated user's UI profile and local drafts. These
  // values are deliberately namespaced by the authoritative Supabase user id;
  // data from one account can never appear in another account's UI.
  // Also loads role from profile for route protection.
  useEffect(() => {
    if (!userId) {
      hydratedUserIdRef.current = null;
      setUser(EMPTY_USER);
      setAppointments([]);
      setSavedSalonIds([]);
      setSavedServices([]);
      setCurrentLocation('Mansarovar, Jaipur');
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
    });

    // Try to fetch latest profile from Supabase for role accuracy (non-blocking)
    void (async () => {
      try {
        if (isSupabaseConfigured && userId) {
          const { profile } = await fetchUserProfile(userId);
          if (profile?.role) {
            setUser(prev => ({ ...prev, role: profile.role }));
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
    // Reviews edited in memory are not authoritative and must not bleed into a
    // different account after switching sessions.
  }, [userId, session?.user, authRole]);

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
      saveJson(scopedStorageKey(STORAGE_KEYS.profile, userId), user);
    }
  }, [user, userId]);

  // Handlers
  const handleOpenAIAdvisor = (
    tab: 'quiz' | 'chat' | 'sentiment' = 'quiz',
    salonId?: string
  ) => {
    setAiAdvisorInitialTab(tab);
    setAiAdvisorInitialSalonId(salonId);
    setIsAIAdvisorModalOpen(true);
  };

  const handleOpenSalonDetails = (salon: Salon) => {
    setSelectedSalonForDetail(salon);
    setIsSalonDetailModalOpen(true);
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
    // Booking is a protected operation. Guests must authenticate first, and a
    // missing Supabase configuration must never fall through to a local/fake
    // booking path.
    if (!isSupabaseConfigured || !userId) {
      setShowAuthScreen(true);
      return;
    }

    setSelectedSalonForBooking(salon);
    setSelectedServiceForBooking(service || null);
    setSelectedServicesForBooking(services || (service ? [service] : null));
    setSelectedStylistForBooking(stylist || null);
    setIsBookingModalOpen(true);
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
    // The UI may receive a booking only from a future server-side payment
    // adapter. Keep the guard here as a second line of defence; appointment
    // state must never be created from an unauthenticated client event.
    if (!isSupabaseConfigured || !userId) return;
    setAppointments((prev) => [newAppointment, ...prev.filter((a) => a.id !== newAppointment.id)]);
  };

  const handleViewAppointments = () => {
    setIsBookingModalOpen(false);
    setIsBookingSummaryModalOpen(false);
    setIsQuickNearestModalOpen(false);
    setChooseProfessionalData(null);
    setSelectedCategoryScreen(null);
    setActiveTab('appointments');
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

  const handleSearchSubmit = (query: string) => {
    setExploreQuery(query);
    setSelectedCategoryScreen(null);
    setActiveTab('explore');
  };

  const handleSelectCategory = (category: string) => {
    setSelectedCategoryScreen(category);
  };

  const handleCancelAppointment = (id: string) => {
    setAppointments(
      appointments.map((a) => (a.id === id ? { ...a, status: 'cancelled' } : a))
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
    // loop-safe redirect to /auth/login.
    await nexoraSignOut();

    // Clear auth state and protected application state
    setUser(EMPTY_USER);
    setAppointments([]);
    setSavedSalonIds([]);
    setSavedServices([]);
    setActiveTab('home');
    setShowAuthScreen(true);
    
    // Clear any scoped storage for current user to prevent data leakage
    if (userId) {
      try {
        localStorage.removeItem(scopedStorageKey(STORAGE_KEYS.profile, userId));
        localStorage.removeItem(scopedStorageKey(STORAGE_KEYS.appointments, userId));
        localStorage.removeItem(scopedStorageKey(STORAGE_KEYS.savedSalons, userId));
        localStorage.removeItem(scopedStorageKey(STORAGE_KEYS.savedServices, userId));
      } catch {
        /* ignore storage errors */
      }
    }
    
    // Redirect to login and prevent back navigation to protected pages
    redirectToLogin({ replace: true });
    
    // Additional back navigation prevention
    try {
      if (typeof window !== 'undefined') {
        // Replace current history entry and push login to prevent back to protected
        window.history.pushState(null, '', '/auth/login');
        window.history.replaceState(null, '', '/auth/login');
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
        initialReferralCode={referralEntryCode}
        onAuthSuccess={(authData) => {
          setUser((prev) => ({
            ...prev,
            name: authData.name || prev.name,
            email: authData.email || prev.email,
            phone: authData.phone || prev.phone,
            role: authData.role || prev.role || 'customer',
          }));
          // The invite has been consumed: the database now owns the referral.
          setReferralEntryCode(null);
          setAuthInitialMode('login');
          // AuthPage calls this after Supabase accepts the credentials; the
          // provider's session remains the authority for authenticated UI.
          // Route user correctly based on role:
          // - customer → Customer Home
          // - salon_owner → Salon Owner Dashboard (currently same app with role awareness)
          if (authData.role === 'salon_owner') {
            console.info('[Nexora] Salon owner authenticated - routing to owner dashboard');
            // In this customer app, salon owners still see home but with owner context
            // A separate owner app would handle full dashboard
            setActiveTab('home');
          } else {
            setActiveTab('home');
          }
          setShowAuthScreen(false);
        }}
        onExploreAsGuest={() => setShowAuthScreen(false)}
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
          activeAppointmentsCount={appointments.filter((a) => a.status === 'confirmed').length}
          onBack={() => setChooseProfessionalData(null)}
          onOpenLocation={() => setIsLocationModalOpen(true)}
          onOpenNotifications={() => setIsNotificationsModalOpen(true)}
          onOpenProfile={() => {
            setChooseProfessionalData(null);
            setSelectedCategoryScreen(null);
            if (isAuthenticated) {
              setActiveTab('profile');
            } else {
              setShowAuthScreen(true);
            }
          }}
          onSelectTab={(tab) => {
            setChooseProfessionalData(null);
            setSelectedCategoryScreen(null);
            if (tab === 'profile' && !isAuthenticated) {
              setShowAuthScreen(true);
            } else {
              setActiveTab(tab);
            }
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
      ) : selectedCategoryScreen ? (
        <ServiceCategoryScreen
          user={user}
          categoryTitle={selectedCategoryScreen}
          currentLocation={currentLocation}
          salons={salons}
          savedSalonIds={savedSalonIds}
          activeAppointmentsCount={appointments.filter((a) => a.status === 'confirmed').length}
          onBack={() => setSelectedCategoryScreen(null)}
          onOpenLocation={() => setIsLocationModalOpen(true)}
          onOpenNotifications={() => setIsNotificationsModalOpen(true)}
          onOpenProfile={() => {
            setSelectedCategoryScreen(null);
            if (isAuthenticated) {
              setActiveTab('profile');
            } else {
              setShowAuthScreen(true);
            }
          }}
          onSelectTab={(tab) => {
            setSelectedCategoryScreen(null);
            if (tab === 'profile' && !isAuthenticated) {
              setShowAuthScreen(true);
            } else {
              setActiveTab(tab);
            }
          }}
          onToggleSaveSalon={handleToggleSaveSalon}
          onOpenSalonDetails={handleOpenSalonDetails}
          onBookService={(salon, service, stylist) => {
            handleOpenBooking(salon, service, stylist);
          }}
          onChooseProfessional={(salon, service, services) => {
            setChooseProfessionalData({ salon, service, services });
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
                setActiveTab('profile');
              } else {
                setShowAuthScreen(true);
              }
            }}
            onOpenNotifications={() => setIsNotificationsModalOpen(true)}
            onOpenAuth={() => setShowAuthScreen(true)}
            hasUnreadNotifications={unreadNotifications > 0}
          />

          {/* Main Content Area */}
          <main className="pt-16 min-h-screen flex-1 flex flex-col">
            {activeTab === 'home' && (
              <HomeTab
                user={user}
                salons={salons}
                upcomingAppointment={upcomingAppointment}
                savedSalonIds={savedSalonIds}
                savedServicesCount={savedServices.length}
                onOpenSalonDetails={handleOpenSalonDetails}
                onBookSalon={handleOpenBooking}
                onOpenAppointmentDetails={(apt) => {
                  setActiveTab('appointments');
                }}
                onToggleSaveSalon={handleToggleSaveSalon}
                onOpenQuickNearest={() => setIsQuickNearestModalOpen(true)}
                onOpenAIAdvisor={() => setIsAIAdvisorModalOpen(true)}
                onSelectCategory={handleSelectCategory}
                onSearchSubmit={handleSearchSubmit}
                onSelectSavedTab={() => setActiveTab('saved')}
              />
            )}

            {activeTab === 'explore' && (
              <ExploreTab
                salons={salons}
                currentLocation={currentLocation}
                savedSalonIds={savedSalonIds}
                initialSearchQuery={exploreQuery}
                onOpenSalonDetails={handleOpenSalonDetails}
                onBookSalon={handleOpenBooking}
                onToggleSaveSalon={handleToggleSaveSalon}
                onOpenAIAdvisor={() => setIsAIAdvisorModalOpen(true)}
              />
            )}

            {activeTab === 'appointments' && (
              <AppointmentsTab
                appointments={appointments}
                onCancelAppointment={handleCancelAppointment}
                onRescheduleAppointment={handleRescheduleAppointment}
                onBookAgain={handleBookAgain}
                onOpenSalonDetailsById={(id) => {
                  const s = salons.find((item) => item.id === id);
                  if (s) handleOpenSalonDetails(s);
                }}
              />
            )}

            {activeTab === 'saved' && (
              <SavedTab
                salons={salons}
                savedSalonIds={savedSalonIds}
                savedServices={savedServices}
                onOpenSalonDetails={handleOpenSalonDetails}
                onBookSalon={handleOpenBooking}
                onToggleSaveSalon={handleToggleSaveSalon}
                onToggleSaveService={handleToggleSaveService}
              />
            )}

            {activeTab === 'profile' && (
              <ProfileTab
                user={user}
                appointments={appointments}
                onUpdateUser={setUser}
                onOpenAIAdvisor={() => setIsAIAdvisorModalOpen(true)}
                onNavigateToBooking={() => setActiveTab('explore')}
                onViewAppointments={handleViewAppointments}
                onViewFavourites={() => setActiveTab('saved')}
                onOpenNotifications={() => setIsNotificationsModalOpen(true)}
                unreadNotifications={unreadNotifications}
                favouritesCount={savedSalonIds.length}
                onLogout={handleLogout}
                onDeleteAccount={handleDeleteAccount}
              />
            )}
          </main>

          {/* Fixed Bottom Navigation */}
          <BottomNav
            activeTab={activeTab}
            onSelectTab={(tab) => {
              setSelectedCategoryScreen(null);
              if (tab === 'profile' && !isAuthenticated) {
                setShowAuthScreen(true);
              } else {
                setActiveTab(tab);
              }
            }}
            activeAppointmentsCount={appointments.filter((a) => a.status === 'confirmed').length}
          />
        </>
      )}

      {/* Modals & Dialogs */}
      <LocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        currentLocation={currentLocation}
        isLiveSyncActive={locationSync.isWatching}
        isLiveSyncBlocked={locationSync.permissionDenied && !locationSync.isWatching}
        onSelectLocation={(loc, lat, lng) => {
          setCurrentLocation(loc);
          // A device-GPS pick from the existing modal is pushed straight to the
          // Nexora secure location backend (authenticated users only).
          if (typeof lat === 'number' && typeof lng === 'number') {
            void handleManualLocationSync(lat, lng);
          }
        }}
      />

      <BookingModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
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
        onClose={() => setIsBookingSummaryModalOpen(false)}
        salon={bookingSummaryDraft?.salon || null}
        services={bookingSummaryDraft?.services || []}
        stylist={bookingSummaryDraft?.stylist || null}
        date={bookingSummaryDraft?.date || new Date().toISOString().split('T')[0]}
        time={bookingSummaryDraft?.time || '2:30 PM'}
        specialNotes={bookingSummaryDraft?.notes || ''}
        onConfirmBooking={handleConfirmBooking}
        onViewAppointments={handleViewAppointments}
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
          setSelectedCategoryScreen(null);
          setActiveTab('explore');
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
        onClose={() => setIsSalonDetailModalOpen(false)}
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
        onOpenAIAdvisorSentiment={(salon) => {
          handleOpenAIAdvisor('sentiment', salon.id);
        }}
        onBookService={(salon, srv, st) => {
          setIsSalonDetailModalOpen(false);
          handleOpenBooking(salon, srv, st);
        }}
      />

      <AIAdvisorModal
        isOpen={isAIAdvisorModalOpen}
        onClose={() => setIsAIAdvisorModalOpen(false)}
        user={user}
        onUpdateUser={setUser}
        currentLocation={currentLocation}
        salons={salons}
        initialTab={aiAdvisorInitialTab}
        initialSalonId={aiAdvisorInitialSalonId}
        onSelectSalon={(s) => {
          setIsAIAdvisorModalOpen(false);
          handleOpenSalonDetails(s);
        }}
        onSelectSalonByName={(name) => {
          const found = salons.find((s) => s.name.toLowerCase().includes(name.toLowerCase()));
          if (found) {
            setIsAIAdvisorModalOpen(false);
            handleOpenSalonDetails(found);
          }
        }}
        onBookService={(s, srv) => {
          setIsAIAdvisorModalOpen(false);
          handleOpenBooking(s, srv);
        }}
      />

      <QuickNearestModal
        isOpen={isQuickNearestModalOpen}
        onClose={() => setIsQuickNearestModalOpen(false)}
        salons={salons}
        currentLocation={currentLocation}
        onBookingUnavailable={() => {
          if (!isSupabaseConfigured || !userId) {
            setIsQuickNearestModalOpen(false);
            setShowAuthScreen(true);
          }
        }}
        onViewAppointments={handleViewAppointments}
      />

      <NotificationsModal
        isOpen={isNotificationsModalOpen}
        onClose={() => setIsNotificationsModalOpen(false)}
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
