import React, { useState, useMemo } from 'react';
import { UserProfile, Salon, SalonService, Stylist, ActiveTab } from '../types';

interface ChooseProfessionalScreenProps {
  user: UserProfile;
  currentLocation: string;
  salon?: Salon | null;
  service?: SalonService | null;
  services?: SalonService[] | null;
  activeAppointmentsCount?: number;
  onBack: () => void;
  onOpenLocation: () => void;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
  onSelectTab: (tab: ActiveTab) => void;
  onContinueBooking: (
    stylist: Stylist | null,
    selectedSlot?: { day: string; time: string },
    selectedServices?: SalonService[]
  ) => void;
}

interface AvailableSlot {
  day: string;
  time: string;
  durationMinutes: number; // The maximum continuous duration available for this slot
  isDimmed?: boolean;
}

interface ProfessionalOption {
  id: string;
  name: string;
  role: string;
  avatar: string;
  rating: number;
  reviewCount: number;
  experience: string;
  specialty: string[];
  isVerified?: boolean;
  isTopRated?: boolean;
  statusColor: 'emerald' | 'amber' | 'gray';
  maxContinuousSlotMinutes: number;
  availableSlots: AvailableSlot[];
  portfolioImages?: string[];
  recentReview?: {
    text: string;
    timeAgo: string;
    author?: string;
  };
}

const PROFESSIONALS_DATA: ProfessionalOption[] = [
  {
    id: 'aarav',
    name: 'Aarav M.',
    role: 'Senior Stylist',
    avatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCpvbwV8DVAqOSqvUmMP6KSYzesISjq83k-KXepJ9p4GDaaqFQP_pdbHorc1fCdhGx-Fc7SxEMOQDNUDX3YTMLEdEihUnm_jkyxixm84MvoeuWZddE-BD-Z1DQ0vkpGjeqiGDxk-0zQK9KsAsfvC_s0nuVH77QxsVVtEIy3IbK2CKiKqPUGH6fRTXIGrvvQPy6SRj7PFIyz4uoO_9JudWYP1PUfl1DxN_ldC8vMC_Z8Gy-yPExM5pbjnw',
    rating: 4.9,
    reviewCount: 120,
    experience: '8+ Years Exp',
    specialty: ['Hair Specialist', 'Precision Fades'],
    isVerified: true,
    statusColor: 'emerald',
    maxContinuousSlotMinutes: 60,
    availableSlots: [
      { day: 'Today', time: '2:30 PM', durationMinutes: 45 },
      { day: 'Today', time: '4:00 PM', durationMinutes: 60 },
      { day: 'Tomorrow', time: '10:00 AM', durationMinutes: 45 },
    ],
    portfolioImages: [
      'https://lh3.googleusercontent.com/aida/AP1WRLvtAexqWMX4CSwndvzz5LADlTmgaj4sMR5A_w89yWdIx4oz6RFW7gA6OTgh-rmN2Fgq9mc2u1PiVjBtTMNpZJbiZLpFyAnHplJMhaITJ-a0xVqYD47ibt5iQF6zmaVKBzloa2VzKuF22VgAF5HQwKIQO6GhU4N7V10N22bUU8fsyc4FmiKuKcvd9OUtfkpdzHBA_rRV6rlEHoo80mRE4XFRlLd051uXuL8n8hmX6bPZ4SANDtwSX6s3wyT1',
      'https://lh3.googleusercontent.com/aida/AP1WRLtukkSGwwO2_q2VvROHAw1Fj8jvbmxx034UUvopSFaEB8w3Q_JjEZko4plC85iMwk9YWmNYDXNdmKQXwwX1W2gpEjo6vgAPKfK1g4BHtfXAuraRA_p1KnLmwIMnuhyXT3oJ4qj6yoxTDxjBM6BIlx-I1W9wZRV3rc7FSPKWraAHl-9ia_UH-X-2OLwMVK1pImyGKQHIO8YTkmgrTX8WrfqDGvZ3NPNH8HxbPYWjwmjMvtyHkNcOgnwsFGN7',
      'https://lh3.googleusercontent.com/aida/AP1WRLvtAexqWMX4CSwndvzz5LADlTmgaj4sMR5A_w89yWdIx4oz6RFW7gA6OTgh-rmN2Fgq9mc2u1PiVjBtTMNpZJbiZLpFyAnHplJMhaITJ-a0xVqYD47ibt5iQF6zmaVKBzloa2VzKuF22VgAF5HQwKIQO6GhU4N7V10N22bUU8fsyc4FmiKuKcvd9OUtfkpdzHBA_rRV6rlEHoo80mRE4XFRlLd051uXuL8n8hmX6bPZ4SANDtwSX6s3wyT1',
    ],
    recentReview: {
      text: "Aarav gave me the best haircut I've had in years. Very professional!",
      timeAgo: '2 days ago',
    },
  },
  {
    id: 'priya',
    name: 'Priya S.',
    role: 'Master Colorist',
    avatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAtSrifepqcTOFujIfnaav10v_FCKl7B4WE6PQ0g9ihLzC3rqUMhQR-io6o_VgSiNMvBYhZs7w5NvTLrAEs9DsGy85SSFp_w31eGaewTVWkbl0riGTCcSiXmr3K9Fc0saP7guQ8NiCX_jWPgWTDp6jxrpPwp75LIjE6XhuGd2VDuyZlInlaZg_K4oyxJqTpCW4QS6cjSez31aUT8e_Au7jz_D4myAWFiYbgKujbdZto32l7S-ZZoaYguw',
    rating: 4.7,
    reviewCount: 85,
    experience: '10 Years Exp',
    specialty: ['Color Expert', 'Balayage'],
    isTopRated: true,
    statusColor: 'amber',
    maxContinuousSlotMinutes: 60,
    availableSlots: [
      { day: 'Tomorrow', time: '11:00 AM', durationMinutes: 60 },
      { day: 'Tomorrow', time: '1:30 PM', durationMinutes: 60 },
      { day: 'Tomorrow', time: '4:00 PM', durationMinutes: 45, isDimmed: true },
    ],
    recentReview: {
      text: 'Priya is a true artist. My hair color looks natural and vibrant!',
      timeAgo: '1 week ago',
    },
  },
];

const DEFAULT_CATALOG_SERVICES: SalonService[] = [
  {
    id: 'cat-srv-1',
    name: 'Signature Hair Cut & Wash',
    category: 'hair',
    duration: 30,
    price: 499,
    discountPrice: 399,
    description: 'Precision haircut with clarifying wash and thermal blow-dry finish.',
    popular: true,
  },
  {
    id: 'cat-srv-2',
    name: 'L’Oréal Deep Hair Spa',
    category: 'hair',
    duration: 45,
    price: 899,
    discountPrice: 699,
    description: 'Nourishing cream bath massage, steam infusion & frizz control mask.',
    popular: true,
  },
  {
    id: 'cat-srv-3',
    name: 'Beard Sculpt & Hot Towel',
    category: 'grooming',
    duration: 20,
    price: 249,
    description: 'Razor sharp contour line-up, warm aromatic towel & beard oil.',
    popular: true,
  },
  {
    id: 'cat-srv-4',
    name: 'Relaxing Head & Neck Massage',
    category: 'spa',
    duration: 25,
    price: 349,
    description: 'Herbal oil pressure-point massage relieving tension and stress.',
  },
  {
    id: 'cat-srv-5',
    name: 'Instant Radiance Clean-Up',
    category: 'skin',
    duration: 30,
    price: 599,
    discountPrice: 499,
    description: 'Gentle fruit enzyme exfoliation, steam, blackhead removal & soothing pack.',
  },
  {
    id: 'cat-srv-6',
    name: 'Balayage / Global Hair Color',
    category: 'hair',
    duration: 90,
    price: 2499,
    discountPrice: 1999,
    description: 'Custom sun-kissed dimension using premium ammonia-free tones.',
  },
];

// Helper functions for duration calculation and formatting
function formatDurationDisplay(minutes: number): { formatted: string; short: string } {
  if (minutes < 60) {
    return { formatted: `${minutes} mins`, short: `${minutes}m` };
  }
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  if (remainingMins === 0) {
    return { formatted: `${hours} hr${hours > 1 ? 's' : ''}`, short: `${hours}h` };
  }
  return {
    formatted: `${hours}h ${remainingMins}m (${minutes} mins)`,
    short: `${hours}h ${remainingMins}m`,
  };
}

function calculateEstimatedEndTime(startTimeStr?: string, durationMins: number = 30): string {
  if (!startTimeStr) return '';
  // Try parsing time e.g. "2:30 PM" or "11:00 AM"
  const match = startTimeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return '';
  let hours = parseInt(match[1], 10);
  const mins = parseInt(match[2], 10);
  const meridiem = match[3].toUpperCase();

  if (meridiem === 'PM' && hours !== 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;

  const totalStartMinutes = hours * 60 + mins;
  const totalEndMinutes = totalStartMinutes + durationMins;

  let endHours = Math.floor(totalEndMinutes / 60) % 24;
  const endMins = totalEndMinutes % 60;
  const endMeridiem = endHours >= 12 ? 'PM' : 'AM';

  if (endHours > 12) endHours -= 12;
  if (endHours === 0) endHours = 12;

  const paddedMins = endMins < 10 ? `0${endMins}` : `${endMins}`;
  return `${endHours}:${paddedMins} ${endMeridiem}`;
}

const CATEGORY_COLOR_MAP: Record<string, { bg: string; text: string; ring: string; border: string }> = {
  hair: { bg: 'bg-rose-500', text: 'text-rose-600', ring: 'ring-rose-200', border: 'border-rose-300' },
  grooming: { bg: 'bg-amber-500', text: 'text-amber-600', ring: 'ring-amber-200', border: 'border-amber-300' },
  spa: { bg: 'bg-emerald-500', text: 'text-emerald-600', ring: 'ring-emerald-200', border: 'border-emerald-300' },
  skin: { bg: 'bg-sky-500', text: 'text-sky-600', ring: 'ring-sky-200', border: 'border-sky-300' },
};

export const ChooseProfessionalScreen: React.FC<ChooseProfessionalScreenProps> = ({
  user,
  currentLocation,
  salon,
  service,
  services,
  activeAppointmentsCount = 0,
  onBack,
  onOpenLocation,
  onOpenNotifications,
  onOpenProfile,
  onSelectTab,
  onContinueBooking,
}) => {
  // Available Services Pool for this Salon
  const availableServices = useMemo(() => {
    const map = new Map<string, SalonService>();

    // Add salon's own services
    if (salon?.services && salon.services.length > 0) {
      salon.services.forEach((s) => map.set(s.id, s));
    }

    // Add passed services
    if (services && services.length > 0) {
      services.forEach((s) => map.set(s.id, s));
    }
    if (service) {
      map.set(service.id, service);
    }

    // Add default catalog services if not already present
    DEFAULT_CATALOG_SERVICES.forEach((s) => {
      const exists = Array.from(map.values()).some(
        (existing) => existing.name.toLowerCase() === s.name.toLowerCase() || existing.id === s.id
      );
      if (!exists) {
        map.set(s.id, s);
      }
    });

    return Array.from(map.values());
  }, [salon, service, services]);

  // Selected Services state (multi-service toggle support)
  const [selectedServices, setSelectedServices] = useState<SalonService[]>(() => {
    if (services && services.length > 0) return services;
    if (service) return [service];
    if (salon?.services && salon.services.length > 0) return [salon.services[0]];
    return [availableServices[0] || DEFAULT_CATALOG_SERVICES[0]];
  });

  const [isServicesExpanded, setIsServicesExpanded] = useState<boolean>(false);
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState<string>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Professional selection state
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>('any');
  const [selectedSlot, setSelectedSlot] = useState<{ day: string; time: string } | null>({
    day: 'Today',
    time: '2:30 PM',
  });
  const [showSimulatedWarning, setShowSimulatedWarning] = useState<boolean>(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [viewState, setViewState] = useState<'normal' | 'empty' | 'error'>('normal');

  // Compute total service duration & total price
  const totalDuration = useMemo(() => {
    return selectedServices.reduce((sum, s) => sum + (s.duration || 30), 0);
  }, [selectedServices]);

  const totalPrice = useMemo(() => {
    return selectedServices.reduce((sum, s) => sum + (s.discountPrice || s.price || 0), 0);
  }, [selectedServices]);

  const salonName = salon?.name || 'Scissors & Shears';

  // Helper to show brief toast feedback
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Selected Professional Object (if specific stylist is chosen)
  const selectedProfessional = useMemo(() => {
    if (selectedProfessionalId === 'any') return null;
    return PROFESSIONALS_DATA.find((p) => p.id === selectedProfessionalId) || null;
  }, [selectedProfessionalId]);

  // Slot duration length calculation & overage detection
  const slotOverageData = useMemo(() => {
    if (!selectedProfessional) {
      // "Any Available" is flexible and can handle long multi-service combinations
      return {
        isExceeded: false,
        slotDuration: 180,
        exceededMinutes: 0,
        slotLabel: 'Flexible Window',
        activeSlot: null,
      };
    }

    // Find the currently selected slot object for the active professional
    const activeSlot = selectedProfessional.availableSlots.find(
      (s) => s.day === selectedSlot?.day && s.time === selectedSlot?.time
    );

    const slotDuration = activeSlot
      ? activeSlot.durationMinutes
      : selectedProfessional.maxContinuousSlotMinutes || 45;

    const isExceeded = totalDuration > slotDuration;
    const exceededMinutes = isExceeded ? totalDuration - slotDuration : 0;
    const slotLabel = activeSlot
      ? `${activeSlot.day} at ${activeSlot.time}`
      : `${selectedSlot?.day || 'Selected'} ${selectedSlot?.time || ''}`;

    return {
      isExceeded,
      slotDuration,
      exceededMinutes,
      slotLabel,
      activeSlot,
    };
  }, [selectedProfessional, selectedSlot, totalDuration]);

  // Toggle service inclusion
  const handleToggleService = (srv: SalonService) => {
    const isSelected = selectedServices.some((s) => s.id === srv.id);
    if (isSelected) {
      if (selectedServices.length <= 1) {
        showToast('At least one service must remain selected for the booking.');
        return;
      }
      setSelectedServices((prev) => prev.filter((s) => s.id !== srv.id));
    } else {
      setSelectedServices((prev) => [...prev, srv]);
    }
  };

  const handleRemoveService = (srvId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedServices.length <= 1) {
      showToast('At least one service must remain selected.');
      return;
    }
    setSelectedServices((prev) => prev.filter((s) => s.id !== srvId));
  };

  // Display name for selected professional
  let selectedDisplayName = 'Any Available Professional';
  if (selectedProfessionalId === 'aarav') selectedDisplayName = 'Aarav M.';
  if (selectedProfessionalId === 'priya') selectedDisplayName = 'Priya S.';

  const handleContinue = () => {
    const effectiveServices = selectedServices.length > 0 ? selectedServices : [availableServices[0]];

    // If slot duration is exceeded, inform user and allow smooth flow or prompt
    if (selectedProfessionalId !== 'any' && slotOverageData.isExceeded) {
      showToast(
        `Selected ${totalDuration}m services exceed ${selectedDisplayName}'s ${slotOverageData.slotDuration}m slot. Switched to Any Available for flexible scheduling.`
      );
      // Auto fallback to flexible team scheduling so booking succeeds seamlessly
      onContinueBooking(null, selectedSlot || undefined, effectiveServices);
      return;
    }

    if (selectedProfessionalId === 'any') {
      onContinueBooking(null, selectedSlot || undefined, effectiveServices);
    } else {
      const match = PROFESSIONALS_DATA.find((p) => p.id === selectedProfessionalId);
      if (match) {
        const stylistObj: Stylist = {
          id: match.id,
          name: match.name,
          role: match.role,
          avatar: match.avatar,
          rating: match.rating,
          experience: match.experience,
          specialty: match.specialty,
        };
        onContinueBooking(stylistObj, selectedSlot || undefined, effectiveServices);
      } else {
        onContinueBooking(null, selectedSlot || undefined, effectiveServices);
      }
    }
  };

  // Filtered services in the selector
  const filteredCatalogServices = useMemo(() => {
    if (serviceCategoryFilter === 'all') return availableServices;
    return availableServices.filter((s) => s.category.toLowerCase() === serviceCategoryFilter.toLowerCase());
  }, [availableServices, serviceCategoryFilter]);

  return (
    <div className="min-h-screen bg-surface-off-white font-body-md text-on-surface flex flex-col selection:bg-nexora-pink/20 selection:text-nexora-pink">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-on-surface/90 backdrop-blur-md text-surface px-4 py-2.5 rounded-full shadow-lg text-[13px] font-medium animate-in fade-in slide-in-from-top-3 flex items-center gap-2 border border-white/10 max-w-[90vw] text-center">
          <span className="material-symbols-outlined text-[18px] text-warning-amber">info</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-xl pt-safe shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-b border-outline-variant/30">
        <div className="h-16 px-page-margin flex items-center justify-between gap-gutter max-w-4xl mx-auto">
          <div className="flex items-center gap-2">
            <img
              alt="Nexora"
              className="h-8 w-auto object-contain"
              src="https://lh3.googleusercontent.com/aida/AP1WRLu5Mt-tx8SQgwFpWljkKN-YFIH_PwQb9_lO5UAIOe-1ZpwTm9eLs8sQp0VEZPuO_Qbm0lNYVsW-iD7SUSY3XMu_y-rzpTv1huqGsdzErLimk128KQmb2u9D-4h_LrcsG7hhRLQ0q78GHSLaTo4-bBlqXPUDeAoRfc_-CrI_stRb7dYlMugBd1PrzDELW-92v82qaV1YspJ-gl1b0QP4hFqx8TsR_-wTgGo1ao_h0L_eWvmlHnL3XHzGdEc8_1f2xYa0N8Oa6rY5yQ"
            />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-nexora-pink tracking-wider leading-none">
                SalonOS
              </span>
              <button
                onClick={onOpenLocation}
                className="flex items-center gap-0.5 mt-0.5 text-left group"
              >
                <span className="material-symbols-outlined text-nexora-pink text-[14px] group-hover:scale-110 transition-transform">
                  location_on
                </span>
                <span className="font-metadata text-metadata text-on-surface-variant group-hover:text-nexora-pink transition-colors">
                  {currentLocation}
                </span>
                <span className="material-symbols-outlined text-on-surface-variant text-[14px]">
                  expand_more
                </span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenNotifications}
              className="w-touch-target-min h-touch-target-min flex items-center justify-center text-on-surface-variant hover:text-nexora-pink hover:bg-surface-container rounded-full transition-colors relative"
              aria-label="Notifications"
            >
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-nexora-pink animate-ping"></span>
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-nexora-pink"></span>
            </button>

            <button
              onClick={onOpenProfile}
              className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-sm overflow-hidden ring-2 ring-primary/20 hover:ring-nexora-pink transition-all"
              aria-label="User profile"
            >
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="material-symbols-outlined text-on-primary text-[18px]">
                  person
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-16 min-h-screen bg-surface flex-1 flex flex-col">
        <div className="flex flex-col w-full bg-surface-off-white min-h-full pb-40 max-w-4xl mx-auto">
          {/* Sub-Header */}
          <div className="px-page-margin py-4 flex items-center justify-between sticky top-16 bg-surface-off-white/90 backdrop-blur-md z-10 shadow-sm border-b border-outline-variant/30">
            <button
              onClick={onBack}
              className="w-touch-target-min h-touch-target-min flex items-center justify-center text-on-surface hover:bg-surface-variant rounded-full transition-colors active:scale-95"
              aria-label="Go back"
            >
              <span className="material-symbols-outlined text-[24px]">arrow_back</span>
            </button>
            <h1 className="font-page-heading text-page-heading text-[18px] font-bold text-on-surface text-center flex-1 pr-11">
              Choose Professional & Services
            </h1>
          </div>

          {/* ========================================================================= */}
          {/* DYNAMIC 'TOTAL DURATION' SUMMARY BAR (Updates in Real-Time)              */}
          {/* ========================================================================= */}
          <div id="total-duration-summary-bar" className="px-page-margin mt-3 mb-3">
            <div className="bg-gradient-to-r from-surface-container-high via-surface-container to-surface-container-high border border-outline-variant/60 rounded-2xl p-4 shadow-sm relative overflow-hidden transition-all duration-300">
              {/* Subtle background glow accent */}
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none"></div>

              {/* Main Duration Metric Row */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 text-nexora-pink flex items-center justify-center flex-shrink-0 shadow-xs border border-primary/15">
                    <span className="material-symbols-outlined text-[24px] animate-pulse">timer</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                        Total Appointment Duration
                      </span>
                      <span className="inline-flex items-center gap-1 bg-primary/10 text-nexora-pink text-[10px] font-bold px-2 py-0.2 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-nexora-pink animate-ping"></span>
                        Live
                      </span>
                    </div>

                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-[22px] font-black text-on-surface tracking-tight font-page-heading">
                        {formatDurationDisplay(totalDuration).short}
                      </span>
                      <span className="text-[13px] text-on-surface-variant font-medium">
                        ({totalDuration} mins · {selectedServices.length} service{selectedServices.length > 1 ? 's' : ''})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Slot Compatibility / Warning Status */}
                <div className="flex flex-col items-end text-right">
                  {slotOverageData.isExceeded ? (
                    <div className="flex items-center gap-1 bg-warning-amber/15 text-warning-amber border border-warning-amber/30 px-2.5 py-1 rounded-xl text-[11px] font-bold shadow-xs animate-bounce">
                      <span className="material-symbols-outlined text-[14px]">warning</span>
                      <span>+{slotOverageData.exceededMinutes}m Over Slot</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 px-2.5 py-1 rounded-xl text-[11px] font-bold shadow-xs">
                      <span className="material-symbols-outlined text-[14px]">check_circle</span>
                      <span>Fits Slot Window</span>
                    </div>
                  )}

                  {selectedSlot?.time && (
                    <span className="text-[11px] text-on-surface-variant mt-1 font-medium flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">schedule</span>
                      {selectedSlot.time} →{' '}
                      <strong className="text-on-surface font-semibold">
                        {calculateEstimatedEndTime(selectedSlot.time, totalDuration) || 'End'}
                      </strong>
                    </span>
                  )}
                </div>
              </div>

              {/* Segmented Real-Time Duration Breakdown Progress Bar */}
              <div className="mb-3">
                <div className="flex justify-between items-center text-[11px] text-on-surface-variant font-medium mb-1.5">
                  <span>Timeline Breakdown by Service</span>
                  <span>100% of session ({totalDuration}m)</span>
                </div>

                {/* Progress bar container */}
                <div className="w-full h-3 bg-surface-variant/70 rounded-full overflow-hidden flex gap-0.5 p-0.5 border border-outline-variant/40 shadow-inner">
                  {selectedServices.map((srv, idx) => {
                    const percentage = Math.max(8, (srv.duration / totalDuration) * 100);
                    const catColor =
                      CATEGORY_COLOR_MAP[srv.category.toLowerCase()] || {
                        bg: 'bg-nexora-pink',
                        text: 'text-nexora-pink',
                      };

                    return (
                      <div
                        key={srv.id || idx}
                        style={{ width: `${percentage}%` }}
                        className={`h-full rounded-sm ${catColor.bg} transition-all duration-300 relative group cursor-pointer hover:brightness-110`}
                        title={`${srv.name} (${srv.duration} mins)`}
                      ></div>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Service Duration Pills & Legend */}
              <div className="flex items-center justify-between flex-wrap gap-2 pt-2.5 border-t border-outline-variant/40">
                <div className="flex items-center flex-wrap gap-1.5 flex-1">
                  {selectedServices.map((srv) => {
                    const catColor =
                      CATEGORY_COLOR_MAP[srv.category.toLowerCase()] || {
                        bg: 'bg-nexora-pink',
                        text: 'text-nexora-pink',
                        border: 'border-outline-variant',
                      };

                    return (
                      <div
                        key={srv.id}
                        className="inline-flex items-center gap-1.5 bg-surface text-on-surface px-2.5 py-1 rounded-lg text-[11px] font-medium border border-outline-variant/50 shadow-2xs hover:border-nexora-pink transition-colors"
                      >
                        <span className={`w-2 h-2 rounded-full ${catColor.bg} flex-shrink-0`}></span>
                        <span className="truncate max-w-[130px] font-semibold">{srv.name}</span>
                        <span className="text-on-surface-variant font-bold">
                          {srv.duration}m
                        </span>
                        {selectedServices.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => handleRemoveService(srv.id, e)}
                            className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error/10 ml-0.5"
                            title={`Remove ${srv.name}`}
                          >
                            <span className="material-symbols-outlined text-[12px]">close</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Quick Add / Manage CTA */}
                <button
                  type="button"
                  onClick={() => setIsServicesExpanded(!isServicesExpanded)}
                  className="px-2.5 py-1 rounded-lg bg-surface border border-outline-variant/60 hover:border-nexora-pink text-nexora-pink text-[11px] font-bold flex items-center gap-1 shadow-2xs transition-colors flex-shrink-0"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {isServicesExpanded ? 'expand_less' : 'add'}
                  </span>
                  <span>{isServicesExpanded ? 'Close Catalog' : 'Add Services'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Multi-Service Summary & Management Card */}
          <div className="px-page-margin mb-4">
            <div className="bg-surface-container rounded-2xl p-4 shadow-sm border border-outline-variant/50 flex flex-col gap-3">
              {/* Salon info & quick stats */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="font-metadata text-metadata text-on-surface-variant mb-0.5 font-medium">
                    {salonName}
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-card-title text-card-title text-nexora-pink font-bold text-[17px]">
                      {selectedServices.length === 1
                        ? selectedServices[0].name
                        : `${selectedServices.length} Services Selected`}
                    </span>
                    <span className="bg-primary/10 text-primary text-[11px] font-bold px-2 py-0.5 rounded-full">
                      {totalDuration} min · ₹{totalPrice}
                    </span>

                    {/* Inline badge if duration exceeds selected stylist slot */}
                    {slotOverageData.isExceeded && (
                      <span className="bg-warning-amber/15 text-warning-amber text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-warning-amber/30 animate-pulse">
                        <span className="material-symbols-outlined text-[12px]">schedule</span>
                        Exceeds {selectedDisplayName}'s slot by +{slotOverageData.exceededMinutes}m
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setIsServicesExpanded(!isServicesExpanded)}
                  className="px-3 py-1.5 rounded-xl bg-surface border border-outline-variant/60 hover:border-nexora-pink text-on-surface text-[12px] font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px] text-nexora-pink">
                    {isServicesExpanded ? 'expand_less' : 'add_task'}
                  </span>
                  <span>{isServicesExpanded ? 'Done' : 'Edit Services'}</span>
                </button>
              </div>

              {/* Selected Services Tags */}
              <div className="flex flex-wrap gap-1.5 pt-1 border-t border-outline-variant/30">
                {selectedServices.map((srv) => (
                  <span
                    key={srv.id}
                    className="inline-flex items-center gap-1.5 bg-surface text-on-surface border border-outline-variant/50 rounded-lg px-2.5 py-1 text-[12px] font-medium shadow-xs"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-nexora-pink"></span>
                    <span className="font-semibold">{srv.name}</span>
                    <span className="text-on-surface-variant text-[11px]">
                      ({srv.duration}m · ₹{srv.discountPrice || srv.price})
                    </span>
                    {selectedServices.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => handleRemoveService(srv.id, e)}
                        className="w-4 h-4 rounded-full flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error/10 ml-0.5"
                        title="Remove service"
                      >
                        <span className="material-symbols-outlined text-[13px]">close</span>
                      </button>
                    )}
                  </span>
                ))}
              </div>

              {/* Expandable Service Selection Drawer */}
              {isServicesExpanded && (
                <div className="mt-2 pt-3 border-t border-outline-variant/40 animate-in fade-in flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-bold text-on-surface uppercase tracking-wider">
                      Toggle Services For Single Booking
                    </span>
                    <span className="text-[11px] text-on-surface-variant">
                      Tap any service to add or remove
                    </span>
                  </div>

                  {/* Category Filter Pills */}
                  <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
                    {['all', 'hair', 'grooming', 'spa', 'skin'].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setServiceCategoryFilter(cat)}
                        className={`px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap capitalize transition-colors ${
                          serviceCategoryFilter === cat
                            ? 'bg-nexora-pink text-white shadow-xs'
                            : 'bg-surface text-on-surface-variant border border-outline-variant/40 hover:border-nexora-pink/50'
                        }`}
                      >
                        {cat === 'all' ? 'All Services' : cat}
                      </button>
                    ))}
                  </div>

                  {/* Available Services Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                    {filteredCatalogServices.map((srv) => {
                      const isSelected = selectedServices.some((s) => s.id === srv.id);
                      return (
                        <div
                          key={srv.id}
                          onClick={() => handleToggleService(srv)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-2.5 ${
                            isSelected
                              ? 'bg-primary-container/15 border-nexora-pink shadow-xs'
                              : 'bg-surface border-outline-variant/40 hover:border-outline-variant'
                          }`}
                        >
                          <div className="flex flex-col flex-1">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="font-semibold text-[13px] text-on-surface leading-tight">
                                {srv.name}
                              </span>
                              {srv.popular && (
                                <span className="bg-nexora-pink/10 text-nexora-pink text-[9px] font-bold px-1.5 py-0.2 rounded">
                                  POPULAR
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-on-surface-variant line-clamp-1 mb-1">
                              {srv.description}
                            </p>
                            <div className="flex items-center gap-2 text-[11px]">
                              <span className="text-on-surface-variant flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[13px]">schedule</span>
                                {srv.duration} min
                              </span>
                              <span className="font-bold text-on-surface">
                                ₹{srv.discountPrice || srv.price}
                              </span>
                              {srv.discountPrice && (
                                <span className="line-through text-on-surface-variant text-[10px]">
                                  ₹{srv.price}
                                </span>
                              )}
                            </div>
                          </div>

                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-colors mt-0.5 ${
                              isSelected
                                ? 'bg-nexora-pink text-white shadow-xs'
                                : 'border border-outline-variant bg-surface'
                            }`}
                          >
                            {isSelected && (
                              <span className="material-symbols-outlined text-[14px]">check</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Simulated unavailability warning (Toggleable/Dismissible) */}
          {showSimulatedWarning && (
            <div id="unavailability-warning" className="px-page-margin mb-4">
              <div className="bg-warning-amber/10 border border-warning-amber/20 rounded-xl p-3 flex items-start gap-3 shadow-xs">
                <span className="material-symbols-outlined text-warning-amber text-[20px]">warning</span>
                <div className="flex-1">
                  <p className="text-[12px] font-medium text-on-surface">Professional Unavailable</p>
                  <p className="text-[11px] text-on-surface-variant">
                    Your previously selected professional is no longer available for this slot. Please choose another.
                  </p>
                </div>
                <button
                  onClick={() => setShowSimulatedWarning(false)}
                  className="text-on-surface-variant hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            </div>
          )}

          {/* Professional Selection Header & Simulation Controls */}
          <div className="px-page-margin mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-[14px] font-bold text-on-surface">
                Select Stylist / Specialist
              </h2>
              <span className="text-[11px] text-on-surface-variant">
                Matching available professionals for {totalDuration} min session
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowSimulatedWarning(!showSimulatedWarning)}
                className="px-2.5 py-1 text-[11px] rounded-full border border-outline-variant text-on-surface-variant hover:border-nexora-pink hover:text-nexora-pink transition-colors"
                title="Toggle slot warning banner"
              >
                {showSimulatedWarning ? 'Hide Alert' : 'Simulate Alert'}
              </button>
              <button
                onClick={() => setViewState(viewState === 'normal' ? 'empty' : 'normal')}
                className="px-2.5 py-1 text-[11px] rounded-full border border-outline-variant text-on-surface-variant hover:border-nexora-pink hover:text-nexora-pink transition-colors"
              >
                {viewState === 'empty' ? 'Show All' : 'Simulate Empty'}
              </button>
            </div>
          </div>

          {/* Normal View: Professionals List */}
          {viewState === 'normal' && (
            <div className="px-page-margin flex flex-col gap-component-gap">
              {/* Option 1: Any Available Professional */}
              <label
                onClick={() => setSelectedProfessionalId('any')}
                className="relative cursor-pointer group block"
                aria-label="Select any available professional"
              >
                <input
                  checked={selectedProfessionalId === 'any'}
                  onChange={() => setSelectedProfessionalId('any')}
                  className="peer sr-only"
                  name="professional"
                  type="radio"
                  value="any"
                />
                <div
                  className={`bg-surface rounded-2xl p-4 shadow-sm ring-1 ring-inset ring-neutral-soft-gray transition-all duration-200 flex items-center gap-4 ${
                    selectedProfessionalId === 'any'
                      ? 'ring-2 ring-nexora-pink bg-surface-container-low'
                      : 'hover:ring-nexora-pink/40'
                  }`}
                >
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                      selectedProfessionalId === 'any'
                        ? 'bg-primary-container text-on-primary-container'
                        : 'bg-secondary-container text-on-secondary-container group-hover:bg-primary-container/70 group-hover:text-on-primary-container'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[28px]">group</span>
                  </div>
                  <div className="flex flex-col flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-card-title text-card-title text-on-surface font-bold">
                        Any Available Professional
                      </span>
                      <span className="bg-emerald-500/10 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        Up to 180 min capacity
                      </span>
                    </div>
                    <span className="font-body-md text-metadata text-on-surface-variant leading-tight text-[12px] mt-0.5">
                      Automatically allocates the best team member to accommodate all {selectedServices.length} selected services ({totalDuration} min) continuously without time slot conflicts.
                    </span>
                  </div>
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      selectedProfessionalId === 'any'
                        ? 'border-nexora-pink bg-nexora-pink'
                        : 'border-neutral-soft-gray'
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined text-[16px] text-white transition-opacity ${
                        selectedProfessionalId === 'any' ? 'opacity-100' : 'opacity-0'
                      }`}
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      check
                    </span>
                  </div>
                </div>
              </label>

              {/* Dynamic / Detailed Professionals List */}
              {PROFESSIONALS_DATA.map((prof) => {
                const isSelected = selectedProfessionalId === prof.id;

                // Check if this professional has an active slot selected and if that slot length is exceeded
                const activeSlotForThisProf = prof.availableSlots.find(
                  (s) => s.day === selectedSlot?.day && s.time === selectedSlot?.time
                ) || prof.availableSlots[0];

                const currentSlotLimit = activeSlotForThisProf?.durationMinutes || prof.maxContinuousSlotMinutes || 45;
                const isSlotDurationExceeded = isSelected && totalDuration > currentSlotLimit;
                const exceededByMin = totalDuration - currentSlotLimit;

                return (
                  <label
                    key={prof.id}
                    onClick={() => setSelectedProfessionalId(prof.id)}
                    className="relative cursor-pointer block"
                    aria-label={`Select ${prof.name}, ${prof.role}, ${prof.rating} stars`}
                  >
                    <input
                      checked={isSelected}
                      onChange={() => setSelectedProfessionalId(prof.id)}
                      className="peer sr-only"
                      name="professional"
                      type="radio"
                      value={prof.id}
                    />
                    <div
                      className={`bg-surface rounded-2xl p-4 shadow-sm ring-1 ring-inset ring-neutral-soft-gray transition-all duration-200 flex items-start gap-4 ${
                        isSelected
                          ? isSlotDurationExceeded
                            ? 'ring-2 ring-warning-amber bg-surface-container-low'
                            : 'ring-2 ring-nexora-pink bg-surface-container-low'
                          : 'hover:ring-nexora-pink/40'
                      }`}
                    >
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        <img
                          className="w-16 h-16 rounded-full object-cover shadow-sm ring-1 ring-outline-variant/40"
                          src={prof.avatar}
                          alt={prof.name}
                        />
                        <div
                          className={`absolute bottom-0 right-0 w-4 h-4 border-2 border-surface rounded-full shadow-xs ${
                            prof.statusColor === 'emerald'
                              ? 'bg-success-emerald'
                              : prof.statusColor === 'amber'
                              ? 'bg-warning-amber'
                              : 'bg-neutral-soft-gray'
                          }`}
                        ></div>
                      </div>

                      {/* Info & Slots */}
                      <div className="flex flex-col flex-1 pt-1 min-w-0">
                        <div className="flex justify-between items-start mb-1 gap-1">
                          <div className="flex items-center flex-wrap gap-1.5">
                            <span className="font-card-title text-card-title text-on-surface font-bold">
                              {prof.name}
                            </span>
                            {prof.isVerified && (
                              <span className="inline-flex items-center gap-0.5 bg-primary-container/10 text-nexora-pink text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-tighter">
                                <span className="material-symbols-outlined text-[12px]">verified</span>
                                Nexora Verified
                              </span>
                            )}
                            {prof.isTopRated && (
                              <span className="inline-flex items-center gap-0.5 bg-warning-amber/10 text-warning-amber text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-tighter">
                                <span className="material-symbols-outlined text-[12px]">workspace_premium</span>
                                Top Rated
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 bg-surface-variant px-2 py-0.5 rounded-full flex-shrink-0">
                            <span
                              className="material-symbols-outlined text-[14px] text-warning-amber"
                              style={{ fontVariationSettings: "'FILL' 1" }}
                            >
                              star
                            </span>
                            <span className="font-metadata text-metadata text-on-surface font-bold">
                              {prof.rating}{' '}
                              <span className="text-on-surface-variant font-normal text-[11px]">
                                ({prof.reviewCount})
                              </span>
                            </span>
                          </div>
                        </div>

                        <span className="font-body-md text-[13px] text-on-surface-variant mb-2 font-medium">
                          {prof.role} · {prof.specialty.join(' · ')}
                        </span>

                        <div className="flex flex-wrap gap-2 mb-3">
                          <div className="inline-flex items-center gap-1 bg-surface-variant text-on-surface-variant text-[11px] font-medium px-2 py-1 rounded-md">
                            <span className="material-symbols-outlined text-[14px]">work</span>
                            {prof.experience}
                          </div>
                          <div className="inline-flex items-center gap-1 bg-surface-variant text-on-surface-variant text-[11px] font-medium px-2 py-1 rounded-md">
                            <span className="material-symbols-outlined text-[14px]">schedule</span>
                            Max Slot: {prof.maxContinuousSlotMinutes} min
                          </div>
                        </div>

                        {/* ============================================================ */}
                        {/* INLINE WARNING: Time slot length exceeded by combined services */}
                        {/* ============================================================ */}
                        {isSlotDurationExceeded && (
                          <div
                            id={`slot-overage-warning-${prof.id}`}
                            className="mb-3.5 bg-warning-amber/10 border-2 border-warning-amber/40 rounded-xl p-3 flex flex-col gap-2 animate-in fade-in slide-in-from-top-1"
                          >
                            <div className="flex items-start gap-2.5">
                              <div className="w-6 h-6 rounded-lg bg-warning-amber/20 flex items-center justify-center flex-shrink-0 text-warning-amber mt-0.5">
                                <span className="material-symbols-outlined text-[16px]">warning</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[12px] font-bold text-on-surface">
                                    Duration Exceeds Available Slot Length
                                  </span>
                                  <span className="bg-warning-amber text-white text-[9px] font-extrabold px-1.5 py-0.2 rounded uppercase">
                                    +{exceededByMin} min over
                                  </span>
                                </div>
                                <p className="text-[11px] text-on-surface-variant mt-0.5 leading-relaxed">
                                  Your {selectedServices.length} selected services require{' '}
                                  <strong className="text-on-surface font-bold">{totalDuration} min</strong>, but {prof.name}'s{' '}
                                  {activeSlotForThisProf.day} {activeSlotForThisProf.time} slot is only{' '}
                                  <strong className="text-on-surface font-bold">{currentSlotLimit} min</strong>.
                                </p>
                              </div>
                            </div>

                            {/* Quick Inline Recovery Actions */}
                            <div className="flex items-center gap-2 pt-2 border-t border-warning-amber/20 flex-wrap">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedProfessionalId('any');
                                  showToast('Switched to Any Available Professional for extended slot capacity.');
                                }}
                                className="px-2.5 py-1 bg-warning-amber text-white rounded-lg text-[11px] font-bold shadow-xs hover:bg-warning-amber/90 transition-colors flex items-center gap-1 active:scale-95"
                              >
                                <span className="material-symbols-outlined text-[13px]">group</span>
                                Switch to Any Available
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsServicesExpanded(true);
                                }}
                                className="px-2.5 py-1 bg-surface border border-outline-variant/60 hover:border-warning-amber text-on-surface rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1 active:scale-95"
                              >
                                <span className="material-symbols-outlined text-[13px] text-nexora-pink">tune</span>
                                Adjust Services
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Available Slots Grid */}
                        <div className="mt-1 pt-3 border-t border-neutral-soft-gray flex flex-col">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold uppercase text-on-surface-variant tracking-wide block">
                              Available Time Slots
                            </span>
                            <span className="text-[10px] text-on-surface-variant">
                              Need: {totalDuration} min
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 mb-4">
                            {prof.availableSlots.map((slot, idx) => {
                              const isSlotSelected =
                                isSelected &&
                                selectedSlot?.day === slot.day &&
                                selectedSlot?.time === slot.time;
                              const isSlotTooShort = totalDuration > slot.durationMinutes;

                              if (slot.isDimmed) {
                                return (
                                  <button
                                    key={idx}
                                    type="button"
                                    disabled
                                    className="bg-surface-off-white text-on-surface border border-neutral-soft-gray rounded-lg py-1.5 text-center flex flex-col opacity-50 cursor-not-allowed"
                                  >
                                    <span className="text-[10px] font-medium">{slot.day}</span>
                                    <span className="text-[12px] font-bold">{slot.time}</span>
                                    <span className="text-[9px] text-on-surface-variant">Unavailable</span>
                                  </button>
                                );
                              }

                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedProfessionalId(prof.id);
                                    setSelectedSlot({ day: slot.day, time: slot.time });
                                  }}
                                  className={`rounded-lg py-1.5 px-1 text-center flex flex-col items-center justify-center transition-all relative ${
                                    isSlotSelected
                                      ? isSlotTooShort
                                        ? 'bg-warning-amber/15 text-on-surface border-2 border-warning-amber shadow-xs'
                                        : 'bg-primary-container/10 text-primary border-2 border-primary/40 shadow-xs'
                                      : isSlotTooShort
                                      ? 'bg-surface-off-white text-on-surface border border-warning-amber/50 hover:border-warning-amber'
                                      : 'bg-surface-off-white text-on-surface border border-neutral-soft-gray hover:border-primary/40'
                                  }`}
                                >
                                  <span className="text-[10px] font-medium">{slot.day}</span>
                                  <span className="text-[12px] font-bold">{slot.time}</span>
                                  <span
                                    className={`text-[9px] font-semibold mt-0.5 px-1 rounded ${
                                      isSlotTooShort
                                        ? 'bg-warning-amber/20 text-warning-amber'
                                        : 'text-on-surface-variant'
                                    }`}
                                  >
                                    {slot.durationMinutes}m slot {isSlotTooShort ? '⚠️' : ''}
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          {/* Portfolio Thumbnails */}
                          {prof.portfolioImages && prof.portfolioImages.length > 0 && (
                            <>
                              <span className="text-[11px] font-bold uppercase text-on-surface-variant tracking-wide mb-2 block">
                                Portfolio
                              </span>
                              <div className="grid grid-cols-3 gap-2 mb-4">
                                {prof.portfolioImages.map((imgUrl, imgIdx) => (
                                  <img
                                    key={imgIdx}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPreviewImage(imgUrl);
                                    }}
                                    alt={`${prof.name} Portfolio ${imgIdx + 1}`}
                                    className="w-full h-20 rounded-lg object-cover shadow-sm hover:opacity-90 transition-opacity cursor-pointer ring-1 ring-outline-variant/30"
                                    src={imgUrl}
                                  />
                                ))}
                              </div>
                            </>
                          )}

                          {/* Recent Review snippet */}
                          {prof.recentReview && (
                            <div className="bg-surface-off-white p-2.5 rounded-lg border border-outline-variant/30">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] font-bold text-on-surface">Recent Review</span>
                                <span className="text-[10px] text-on-surface-variant">
                                  {prof.recentReview.timeAgo}
                                </span>
                              </div>
                              <p className="text-[11px] italic text-on-surface-variant leading-relaxed">
                                "{prof.recentReview.text}"
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Selection Radio Circle */}
                      <div
                        className={`w-6 h-6 mt-1 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          isSelected
                            ? isSlotDurationExceeded
                              ? 'border-warning-amber bg-warning-amber'
                              : 'border-nexora-pink bg-nexora-pink'
                            : 'border-neutral-soft-gray'
                        }`}
                      >
                        <span
                          className={`material-symbols-outlined text-[16px] text-white transition-opacity ${
                            isSelected ? 'opacity-100' : 'opacity-0'
                          }`}
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          check
                        </span>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          {/* Empty State */}
          {viewState === 'empty' && (
            <div
              id="empty-state"
              className="mx-page-margin flex flex-col items-center justify-center py-12 px-4 text-center bg-surface rounded-2xl border border-dashed border-neutral-soft-gray"
            >
              <span className="material-symbols-outlined text-[48px] text-on-surface-variant mb-4">
                person_off
              </span>
              <h3 className="font-card-title text-[16px] font-bold text-on-surface mb-2">
                No professionals available
              </h3>
              <p className="text-metadata text-on-surface-variant mb-6 max-w-xs">
                We couldn't find any professionals for this service at your location.
              </p>
              <button
                onClick={() => {
                  setViewState('normal');
                  setSelectedProfessionalId('any');
                }}
                className="px-6 py-2.5 bg-primary text-on-primary rounded-full font-button-text text-button-text font-bold shadow-sm hover:bg-nexora-pink transition-colors"
              >
                Choose Any Available
              </button>
            </div>
          )}

          {/* Error State */}
          {viewState === 'error' && (
            <div
              id="error-state"
              className="mx-page-margin flex flex-col items-center justify-center py-12 px-4 text-center bg-surface rounded-2xl border border-error/20"
            >
              <span className="material-symbols-outlined text-[48px] text-error mb-4">error</span>
              <h3 className="font-card-title text-[16px] font-bold text-on-surface mb-2">Failed to load</h3>
              <p className="text-metadata text-on-surface-variant mb-6">
                Something went wrong while fetching professionals.
              </p>
              <button
                onClick={() => setViewState('normal')}
                className="px-6 py-2 border border-primary text-primary rounded-full font-button-text text-button-text flex items-center gap-2 hover:bg-primary/5 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">refresh</span>
                Retry
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Sticky Bottom CTA with Slot Warning Alert */}
      <div className="fixed bottom-0 left-0 w-full bg-surface/90 backdrop-blur-xl px-page-margin py-3.5 pb-safe border-t border-neutral-soft-gray shadow-[0_-4px_16px_rgba(0,0,0,0.06)] z-40 max-w-4xl mx-auto left-1/2 -translate-x-1/2">
        {/* Sticky warning notification banner if selected stylist slot is exceeded */}
        {slotOverageData.isExceeded && (
          <div className="mb-2.5 bg-warning-amber/15 border border-warning-amber/30 rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-[11px] text-on-surface animate-in fade-in slide-in-from-bottom-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="material-symbols-outlined text-warning-amber text-[16px] flex-shrink-0">
                schedule
              </span>
              <span className="truncate">
                Duration (<strong>{totalDuration}m</strong>) exceeds {selectedDisplayName}'s slot (<strong>{slotOverageData.slotDuration}m</strong>)
              </span>
            </div>
            <button
              onClick={() => {
                setSelectedProfessionalId('any');
                showToast('Switched to Any Available Professional.');
              }}
              className="text-nexora-pink font-bold hover:underline whitespace-nowrap text-[11px] flex-shrink-0"
            >
              Switch to Any Available
            </button>
          </div>
        )}

        <div className="flex items-center justify-between mb-2.5 px-1">
          <div className="flex flex-col">
            <span className="text-[11px] text-on-surface-variant uppercase tracking-wider font-semibold">
              Booking Overview
            </span>
            <span className="text-[13px] font-bold text-nexora-pink" id="selectedNameDisplay">
              {selectedDisplayName}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[11px] text-on-surface-variant font-medium">
              {selectedServices.length} Service{selectedServices.length > 1 ? 's' : ''} · {totalDuration} min
            </span>
            <span className="text-[14px] font-extrabold text-on-surface">
              ₹{totalPrice}
            </span>
          </div>
        </div>
        <button
          onClick={handleContinue}
          id="continueBtn"
          className="w-full h-12 bg-primary text-on-primary font-button-text text-button-text rounded-xl shadow-md hover:bg-primary/90 transition-all duration-150 flex items-center justify-center gap-2 active:scale-[0.98] font-bold"
        >
          <span>Continue with {selectedServices.length} Service{selectedServices.length > 1 ? 's' : ''}</span>
          <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
        </button>
      </div>

      {/* Portfolio Lightbox Modal */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-md w-full bg-surface rounded-2xl overflow-hidden shadow-2xl"
          >
            <div className="p-3 flex justify-between items-center border-b border-outline-variant/30">
              <span className="font-card-title text-[14px] font-bold">Stylist Portfolio</span>
              <button
                onClick={() => setPreviewImage(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-variant text-on-surface"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <img src={previewImage} alt="Portfolio preview" className="w-full h-80 object-cover" />
          </div>
        </div>
      )}
    </div>
  );
};
