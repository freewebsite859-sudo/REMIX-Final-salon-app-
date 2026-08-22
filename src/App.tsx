import React, { useEffect, useState } from 'react';
import { ActiveTab, Salon, SalonService, Stylist, Appointment, UserProfile, Review, SavedServiceRef } from './types';
import { INITIAL_SALONS, INITIAL_APPOINTMENTS, INITIAL_USER } from './data/mockSalons';
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
import { supabase, isSupabaseConfigured } from './lib/supabase';

const STORAGE_KEYS = {
  appointments: 'nexora-appointments',
  savedSalons: 'nexora-saved-salons',
  savedServices: 'nexora-saved-services',
  user: 'nexora-user',
};

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
  return value.filter(isRecord).map((a) => ({
    ...a,
    id: typeof a.id === 'string' ? a.id : `apt-${Math.random().toString(36).slice(2, 10)}`,
    salonId: typeof a.salonId === 'string' ? a.salonId : '',
    salonName: typeof a.salonName === 'string' ? a.salonName : 'Salon',
    services: Array.isArray(a.services) ? a.services : [],
    status: ['confirmed', 'in_progress', 'completed', 'cancelled'].includes(a.status as string)
      ? a.status
      : 'confirmed',
    date: typeof a.date === 'string' ? a.date : '',
    time: typeof a.time === 'string' ? a.time : '',
  })) as Appointment[];
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

function salonFromAppointment(appointment: Appointment): Salon {
  return {
    id: appointment.salonId,
    name: appointment.salonName,
    tagline: 'Premium salon and grooming studio in Jaipur.',
    rating: 4.8,
    reviewCount: 120,
    image: appointment.salonImage,
    gallery: [appointment.salonImage],
    categories: ['Hair', 'Grooming'],
    priceRange: '₹₹',
    distance: '1.5 km',
    isOpen: true,
    openingHours: '10:00 AM - 8:00 PM',
    gender: 'unisex',
    reviews: [],
    location: {
      address: appointment.salonAddress,
      area: appointment.salonAddress.split(',')[0] || 'Mansarovar',
      city: 'Jaipur',
      latitude: 26.85,
      longitude: 75.78,
      mapsUrl: appointment.mapsUrl,
    },
    phone: appointment.salonPhone || '+91 98290 12345',
    amenities: ['AC', 'Wi-Fi', 'Card Payment', 'Parking'],
    services: appointment.services,
    stylists: appointment.stylist ? [appointment.stylist] : [],
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [user, setUser] = useState<UserProfile>(() => {
    const stored = loadJson(STORAGE_KEYS.user, null as UserProfile | null, sanitizeUserProfile);
    // Merge with defaults so fields added in newer versions never come back undefined.
    return stored ? { ...INITIAL_USER, ...stored } : INITIAL_USER;
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const stored = loadJson(STORAGE_KEYS.user, null as UserProfile | null, sanitizeUserProfile);
    return Boolean(stored && stored.email);
  });
  const [currentLocation, setCurrentLocation] = useState<string>('Mansarovar, Jaipur');
  const [salons, setSalons] = useState<Salon[]>(INITIAL_SALONS);
  const [appointments, setAppointments] = useState<Appointment[]>(() =>
    loadJson(STORAGE_KEYS.appointments, INITIAL_APPOINTMENTS, sanitizeAppointments)
  );
  const [savedSalonIds, setSavedSalonIds] = useState<string[]>(() =>
    loadJson(STORAGE_KEYS.savedSalons, ['salon-1', 'salon-2', 'salon-5'], sanitizeSalonIds)
  );
  const [savedServices, setSavedServices] = useState<SavedServiceRef[]>(() =>
    loadJson(
      STORAGE_KEYS.savedServices,
      [
        { salonId: 'salon-1', serviceId: 'srv-101' },
        { salonId: 'salon-2', serviceId: 'srv-201' },
      ],
      sanitizeSavedServices
    )
  );
  
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
  const [showAuthScreen, setShowAuthScreen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isSalonDetailModalOpen, setIsSalonDetailModalOpen] = useState(false);
  const [isAIAdvisorModalOpen, setIsAIAdvisorModalOpen] = useState(false);
  const [aiAdvisorInitialTab, setAiAdvisorInitialTab] = useState<'quiz' | 'chat' | 'sentiment'>('quiz');
  const [aiAdvisorInitialSalonId, setAiAdvisorInitialSalonId] = useState<string | undefined>(undefined);
  const [isQuickNearestModalOpen, setIsQuickNearestModalOpen] = useState(false);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);

  // Selected entities for modals
  const [selectedSalonForDetail, setSelectedSalonForDetail] = useState<Salon | null>(null);
  const [selectedSalonForBooking, setSelectedSalonForBooking] = useState<Salon | null>(null);
  const [selectedServiceForBooking, setSelectedServiceForBooking] = useState<SalonService | null>(null);
  const [selectedServicesForBooking, setSelectedServicesForBooking] = useState<SalonService[] | null>(null);
  const [selectedStylistForBooking, setSelectedStylistForBooking] = useState<Stylist | null>(null);
  const [exploreQuery, setExploreQuery] = useState<string>('');

  // Active upcoming appointment for reminder banner
  const upcomingAppointment = appointments.find((a) => a.status === 'confirmed') || null;

  // Listen to Supabase Auth state changes & retrieve existing active session
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    // 1. Initial Session Check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const suUser = session.user;
        setIsAuthenticated(true);
        setUser((prev) => ({
          ...prev,
          email: suUser.email || prev.email,
          name: suUser.user_metadata?.full_name || prev.name,
          phone: suUser.user_metadata?.mobile || suUser.phone || prev.phone,
        }));
      }
    });

    // 2. Auth State Change Listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        const suUser = session.user;
        setIsAuthenticated(true);
        setUser((prev) => ({
          ...prev,
          email: suUser.email || prev.email,
          name: suUser.user_metadata?.full_name || prev.name,
          phone: suUser.user_metadata?.mobile || suUser.phone || prev.phone,
        }));
      } else if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
        localStorage.removeItem(STORAGE_KEYS.user);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    saveJson(STORAGE_KEYS.appointments, appointments);
  }, [appointments]);

  useEffect(() => {
    saveJson(STORAGE_KEYS.savedSalons, savedSalonIds);
  }, [savedSalonIds]);

  useEffect(() => {
    saveJson(STORAGE_KEYS.savedServices, savedServices);
  }, [savedServices]);

  useEffect(() => {
    if (isAuthenticated && user) {
      saveJson(STORAGE_KEYS.user, user);
    }
  }, [user, isAuthenticated]);

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
    setSelectedSalonForBooking(salon);
    setSelectedServiceForBooking(service || null);
    setSelectedServicesForBooking(services || (service ? [service] : null));
    setSelectedStylistForBooking(stylist || null);
    setIsBookingModalOpen(true);
  };

  const handleBookAgain = (appointment: Appointment) => {
    const salon = salons.find((s) => s.id === appointment.salonId) || salonFromAppointment(appointment);
    handleOpenBooking(
      salon,
      appointment.services[0],
      appointment.stylist,
      appointment.services
    );
  };

  const handleConfirmBooking = (newAppointment: Appointment) => {
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
      const salon = salons.find((s) => s.id === apt.salonId) || salons[0];
      handleOpenBooking(salon, apt.services[0], apt.stylist);
    }
  };

  const handleAddReview = (salonId: string, newReview: Review) => {
    setSalons((prevSalons) =>
      prevSalons.map((salon) => {
        if (salon.id === salonId) {
          const updatedReviews = [newReview, ...salon.reviews];
          const newReviewCount = salon.reviewCount + 1;
          const totalRating = updatedReviews.reduce((sum, r) => sum + r.rating, 0);
          const newRating = Number((totalRating / updatedReviews.length).toFixed(1));
          const updatedSalon = {
            ...salon,
            reviews: updatedReviews,
            reviewCount: newReviewCount,
            rating: newRating > 0 ? newRating : salon.rating,
          };
          if (selectedSalonForDetail && selectedSalonForDetail.id === salonId) {
            setSelectedSalonForDetail(updatedSalon);
          }
          return updatedSalon;
        }
        return salon;
      })
    );
  };

  const handleLogout = async () => {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore error
      }
    }
    setIsAuthenticated(false);
    localStorage.removeItem(STORAGE_KEYS.user);
    setUser(INITIAL_USER);
    setActiveTab('home');
    setShowAuthScreen(true);
  };

  const handleDeleteAccount = async () => {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore error
      }
    }
    setIsAuthenticated(false);
    localStorage.removeItem(STORAGE_KEYS.appointments);
    localStorage.removeItem(STORAGE_KEYS.savedSalons);
    localStorage.removeItem(STORAGE_KEYS.savedServices);
    localStorage.removeItem(STORAGE_KEYS.user);
    setUser(INITIAL_USER);
    setAppointments([]);
    setSavedSalonIds([]);
    setSavedServices([]);
    setActiveTab('home');
    setShowAuthScreen(true);
  };

  if (showAuthScreen) {
    return (
      <AuthPage
        onAuthSuccess={(authData) => {
          setUser((prev) => ({
            ...prev,
            name: authData.name || prev.name,
            email: authData.email || prev.email,
            phone: authData.phone || prev.phone,
          }));
          setIsAuthenticated(true);
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
                onUpdateUser={setUser}
                onOpenAIAdvisor={() => setIsAIAdvisorModalOpen(true)}
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
        onSelectLocation={(loc) => setCurrentLocation(loc)}
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
        onAddReview={handleAddReview}
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
        onConfirmBooking={handleConfirmBooking}
        onViewAppointments={handleViewAppointments}
      />

      <NotificationsModal
        isOpen={isNotificationsModalOpen}
        onClose={() => setIsNotificationsModalOpen(false)}
      />
    </div>
  );
}
