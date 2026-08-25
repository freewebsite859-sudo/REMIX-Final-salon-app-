import React, { useEffect, useMemo, useState } from 'react';
import { Salon, SalonService, Stylist, UserProfile, ActiveTab } from '../types';
import { BottomNav } from './BottomNav';

interface ServiceCategoryScreenProps {
  user: UserProfile;
  categoryTitle?: string;
  currentLocation: string;
  salons: Salon[];
  savedSalonIds: string[];
  activeAppointmentsCount?: number;
  onBack: () => void;
  onOpenLocation: () => void;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
  onSelectTab?: (tab: ActiveTab) => void;
  onToggleSaveSalon: (salonId: string) => void;
  onOpenSalonDetails: (salon: Salon) => void;
  onBookService: (salon: Salon, service?: SalonService, stylist?: Stylist) => void;
  onChooseProfessional?: (salon: Salon, service?: SalonService, services?: SalonService[]) => void;
}

interface ServiceOption {
  id: string;
  name: string;
  category: 'Hair' | 'Grooming' | 'Skin' | 'Nails' | 'Makeup' | 'Spa';
  description: string;
  duration: number; // minutes
  price: number;
  discountPrice?: number;
  popular?: boolean;
  selected?: boolean;
}

interface CategoryStylistOption extends Stylist {
  isAny?: boolean;
  statusBadge?: string;
  statusColor?: string;
  isTopRated?: boolean;
  isExperienced?: boolean;
}

function displayServiceCategory(category: SalonService['category']): ServiceOption['category'] {
  if (category === 'grooming') return 'Grooming';
  if (category === 'skin') return 'Skin';
  if (category === 'nails') return 'Nails';
  if (category === 'spa') return 'Spa';
  if (category === 'bridal') return 'Makeup';
  return 'Hair';
}

function canonicalServiceCategory(category: ServiceOption['category']): SalonService['category'] {
  if (category === 'Grooming') return 'grooming';
  if (category === 'Skin') return 'skin';
  if (category === 'Nails') return 'nails';
  if (category === 'Spa') return 'spa';
  if (category === 'Makeup') return 'bridal';
  return 'hair';
}

function toSalonService(service: ServiceOption): SalonService {
  return {
    id: service.id,
    name: service.name,
    category: canonicalServiceCategory(service.category),
    duration: service.duration,
    price: service.price,
    discountPrice: service.discountPrice,
    description: service.description,
    popular: service.popular,
  };
}

export const ServiceCategoryScreen: React.FC<ServiceCategoryScreenProps> = ({
  user,
  categoryTitle = 'Hair Cut',
  currentLocation,
  salons,
  savedSalonIds,
  activeAppointmentsCount = 1,
  onBack,
  onOpenLocation,
  onOpenNotifications,
  onOpenProfile,
  onSelectTab,
  onToggleSaveSalon,
  onOpenSalonDetails,
  onBookService,
  onChooseProfessional,
}) => {
  // Service Category Tabs
  const [activeServiceCategory, setActiveServiceCategory] = useState<string>('Hair');
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedStylistId, setSelectedStylistId] = useState<string>('any');

  // The category screen is an aggregate view, but every selectable service and
  // stylist must still originate from a real salon record supplied by the
  // catalog layer. It must not append a second hardcoded catalog.
  const serviceCatalog = useMemo<ServiceOption[]>(() => {
    const servicesById = new Map<string, ServiceOption>();
    for (const salon of salons) {
      for (const service of salon.services) {
        if (!servicesById.has(service.id)) {
          servicesById.set(service.id, {
            ...service,
            category: displayServiceCategory(service.category),
          });
        }
      }
    }
    return Array.from(servicesById.values());
  }, [salons]);

  const categoryStylists = useMemo<CategoryStylistOption[]>(() => {
    const stylistsById = new Map<string, CategoryStylistOption>();
    for (const salon of salons) {
      for (const stylist of salon.stylists) {
        if (!stylistsById.has(stylist.id)) {
          stylistsById.set(stylist.id, { ...stylist });
        }
      }
    }
    return [
      {
        id: 'any',
        name: 'Any Professional',
        role: 'Earliest verified availability',
        avatar: '',
        rating: 0,
        experience: '',
        specialty: [],
        isAny: true,
      },
      ...Array.from(stylistsById.values()),
    ];
  }, [salons]);

  useEffect(() => {
    setSelectedServiceIds((previous) => {
      const valid = previous.filter((id) => serviceCatalog.some((service) => service.id === id));
      if (valid.length > 0) return valid;
      const firstForCategory = serviceCatalog.find(
        (service) => service.category === activeServiceCategory
      );
      return firstForCategory ? [firstForCategory.id] : serviceCatalog[0] ? [serviceCatalog[0].id] : [];
    });
  }, [activeServiceCategory, serviceCatalog]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFilter, setSelectedFilter] = useState<string>('Open Now');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [sortBy, setSortBy] = useState<'recommended' | 'rating' | 'distance' | 'price'>('recommended');
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);

  // Professional search & filters
  const [stylistSearch, setStylistSearch] = useState<string>('');
  const [stylistFilterBadge, setStylistFilterBadge] = useState<string | null>(null);
  const [stylistSortAsc, setStylistSortAsc] = useState<boolean>(false);

  // Accordion FAQ states
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [showFullWeekHours, setShowFullWeekHours] = useState(false);

  // Toggle selection of service
  const handleToggleService = (serviceId: string) => {
    if (selectedServiceIds.includes(serviceId)) {
      if (selectedServiceIds.length > 1) {
        setSelectedServiceIds(selectedServiceIds.filter((id) => id !== serviceId));
      }
    } else {
      setSelectedServiceIds([...selectedServiceIds, serviceId]);
    }
  };

  // Selected services calculation
  const selectedServices = serviceCatalog.filter((s) => selectedServiceIds.includes(s.id));
  const totalDuration = selectedServices.reduce((acc, s) => acc + s.duration, 0);
  const totalPrice = selectedServices.reduce((acc, s) => acc + (s.discountPrice || s.price), 0);

  // Filter stylists
  const filteredStylists = categoryStylists.filter((st) => {
    if (st.isAny) return true;
    if (stylistSearch.trim()) {
      const q = stylistSearch.toLowerCase();
      const matchName = st.name.toLowerCase().includes(q);
      const matchRole = st.role.toLowerCase().includes(q);
      const matchSpec = st.specialty.some((sp) => sp.toLowerCase().includes(q));
      if (!matchName && !matchRole && !matchSpec) return false;
    }
    // Availability, rating, and experience are backend facts. If the catalog
    // does not supply them, do not fabricate a value or hide every stylist.
    if (stylistFilterBadge === 'Available Today' && st.statusBadge && st.statusBadge !== 'Available Today') return false;
    if (stylistFilterBadge === 'Top Rated' && st.isTopRated === false) return false;
    if (stylistFilterBadge === 'Most Experienced' && st.isExperienced === false) return false;
    if (stylistFilterBadge === 'Hair Specialist' && !st.specialty.some((specialty) => specialty.toLowerCase().includes('hair')) && !st.role.toLowerCase().includes('hair')) return false;
    return true;
  }).sort((a, b) => {
    if (a.isAny) return -1;
    if (b.isAny) return 1;
    if (stylistSortAsc) {
      return a.rating - b.rating;
    }
    return b.rating - a.rating;
  });

  // Filter and sort salons
  const filteredSalons = salons
    .filter((salon) => {
      // Match query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = salon.name.toLowerCase().includes(q);
        const matchesCategory = salon.categories.some((c) => c.toLowerCase().includes(q));
        const matchesArea = salon.location.area.toLowerCase().includes(q);
        if (!matchesName && !matchesCategory && !matchesArea) return false;
      }

      // Quick filter pill
      if (selectedFilter === 'Open Now' && !salon.isOpen) return false;
      if (selectedFilter === 'Top Rated' && salon.rating < 4.8) return false;
      if (selectedFilter === 'Offers' && !salon.discountOffer) return false;
      if (selectedFilter === 'Nearest') {
        const distNum = parseFloat(salon.distance);
        if (!isNaN(distNum) && distNum > 2.0) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'distance') return parseFloat(a.distance) - parseFloat(b.distance);
      if (sortBy === 'price') return a.priceRange.length - b.priceRange.length;
      return 0; // recommended
    });

  const handleContinueBooking = () => {
    const targetSalon = salons.find((candidate) =>
      selectedServices.length > 0 &&
      selectedServices.every((selected) => candidate.services.some((service) => service.id === selected.id))
    );
    if (!targetSalon) {
      window.alert('Please select services offered by the same salon before continuing.');
      return;
    }

    const primaryService = selectedServices[0]
      ? toSalonService(selectedServices[0])
      : undefined;

    const allFormattedServices: SalonService[] = selectedServices.map(toSalonService);

    if (onChooseProfessional) {
      onChooseProfessional(targetSalon, primaryService, allFormattedServices);
      return;
    }

    const chosenStylist =
      selectedStylistId !== 'any'
        ? categoryStylists.find((st) => st.id === selectedStylistId)
        : undefined;

    const stylistObj = chosenStylist && !chosenStylist.isAny
      ? {
          id: chosenStylist.id,
          name: chosenStylist.name,
          role: chosenStylist.role,
          avatar: chosenStylist.avatar,
          rating: chosenStylist.rating,
          experience: chosenStylist.experience,
          specialty: chosenStylist.specialty,
        }
      : undefined;

    onBookService(targetSalon, primaryService, stylistObj);
  };

  const handleBookSingleSalon = (salon: Salon) => {
    const selectedForSalon = selectedServices.find((item) =>
      salon.services.some((salonService) => salonService.id === item.id)
    );
    const serviceForSalon = selectedForSalon
      ? toSalonService(selectedForSalon)
      : salon.services[0];

    onBookService(salon, serviceForSalon);
  };

  if (salons.length === 0) {
    return (
      <main className="min-h-screen bg-surface-off-white px-page-margin py-20 text-center text-on-surface">
        <button onClick={onBack} className="text-primary font-semibold">Back</button>
        <h1 className="mt-8 text-2xl font-bold">Salon catalog unavailable</h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          No category results were returned by the canonical catalog service.
        </p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-surface-off-white font-body-md text-on-surface flex flex-col selection:bg-nexora-pink/20 selection:text-nexora-pink">
      {/* Fixed Sticky Header */}
      <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-xl pt-safe shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-b border-outline-variant/30">
        <div className="h-16 px-page-margin flex items-center justify-between gap-gutter max-w-4xl mx-auto">
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="w-8 h-8 flex items-center justify-center -ml-2 text-on-surface hover:text-nexora-pink transition-colors rounded-full hover:bg-surface-container active:scale-95"
              aria-label="Go back"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div className="flex flex-col">
              <span className="font-card-title text-[16px] font-bold text-on-surface leading-tight">
                {categoryTitle}
              </span>
              <button
                onClick={onOpenLocation}
                className="flex items-center gap-0.5 mt-0.5 text-left group"
              >
                <span className="material-symbols-outlined text-nexora-pink text-[14px]">location_on</span>
                <span className="font-metadata text-metadata text-on-surface-variant group-hover:text-on-surface transition-colors">
                  {currentLocation}
                </span>
                <span className="material-symbols-outlined text-on-surface-variant text-[14px]">expand_more</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenNotifications}
              className="w-touch-target-min h-touch-target-min flex items-center justify-center text-on-surface-variant hover:text-nexora-pink transition-colors rounded-full hover:bg-surface-container"
              aria-label="Notifications"
            >
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button
              onClick={onOpenProfile}
              className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-sm overflow-hidden border border-outline-variant hover:ring-2 hover:ring-nexora-pink transition-all"
              aria-label="User profile"
            >
              <img
                alt={user.name}
                className="w-full h-full object-cover"
                src={user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80'}
              />
            </button>
          </div>
        </div>
      </header>

      {/* Main Scrollable Content */}
      <main className="pt-16 min-h-screen bg-surface pb-36 max-w-4xl mx-auto w-full">
        <div className="flex flex-col w-full pb-8">
          {/* Header Title Section */}
          <section className="px-page-margin pt-6 pb-4">
            <h1 className="font-page-heading text-[24px] sm:text-[28px] font-bold text-on-surface mb-1 leading-tight">
              {filteredSalons.length} {filteredSalons.length === 1 ? 'place' : 'places'} near you
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Find nearby salons and barbers offering {categoryTitle}
            </p>
          </section>

          {/* Services Section */}
          <section className="px-page-margin mb-6">
            <div className="mb-4">
              <h2 className="font-section-heading text-[18px] font-bold text-on-surface">Services</h2>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Choose the service you want to book
              </p>
            </div>

            {/* Horizontal Service Category Scroll */}
            <div className="-mx-page-margin overflow-x-auto no-scrollbar flex gap-2 px-page-margin mb-6 snap-x">
              {['Hair', 'Grooming', 'Skin', 'Nails', 'Makeup', 'Spa'].map((cat) => {
                const isActive = activeServiceCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveServiceCategory(cat)}
                    className={`px-6 py-2 rounded-full font-button-text text-[14px] whitespace-nowrap transition-all snap-start ${
                      isActive
                        ? 'bg-nexora-pink text-white shadow-sm font-semibold'
                        : 'bg-surface-container text-on-surface-variant border border-outline-variant hover:border-nexora-pink hover:text-nexora-pink'
                    }`}
                    aria-label={`Filter by ${cat} services`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {selectedServices.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {selectedServices.map((srv) => (
                  <span
                    key={srv.id}
                    className="inline-flex items-center gap-1.5 bg-nexora-pink/10 text-nexora-pink border border-nexora-pink/30 rounded-lg px-2.5 py-1 text-[12px] font-semibold"
                  >
                    {srv.name}
                    <button
                      type="button"
                      onClick={() => handleToggleService(srv.id)}
                      className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-nexora-pink/20"
                      title={`Remove ${srv.name}`}
                    >
                      <span className="material-symbols-outlined text-[12px]">close</span>
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Service Cards List */}
            <div className="flex flex-col gap-3">
              {serviceCatalog.filter(
                (s) => s.category === activeServiceCategory || activeServiceCategory === 'All'
              ).map((service) => {
                const isSelected = selectedServiceIds.includes(service.id);
                return (
                  <div
                    key={service.id}
                    className={`p-4 rounded-xl shadow-sm flex justify-between items-center transition-all ${
                      isSelected
                        ? 'bg-surface-container-low border-2 border-nexora-pink ring-1 ring-nexora-pink/20'
                        : 'bg-surface-off-white border border-outline-variant hover:border-outline'
                    }`}
                  >
                    <div className="flex flex-col gap-1 pr-3">
                      <div className="flex items-center gap-2">
                        <h4 className="font-card-title text-[15px] font-bold text-on-surface">
                          {service.name}
                        </h4>
                        <span className="text-[12px] font-bold text-primary">₹{service.price}</span>
                      </div>
                      <p className="text-metadata text-[13px] text-on-surface-variant">
                        {service.description}
                      </p>
                      <div className="flex items-center gap-1 text-metadata text-on-surface-variant mt-0.5">
                        <span className="material-symbols-outlined text-[14px]">schedule</span>
                        <span>{service.duration} min</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggleService(service.id)}
                      className={`px-4 py-2 rounded-lg font-button-text text-[14px] font-semibold transition-all shrink-0 ${
                        isSelected
                          ? 'bg-nexora-pink text-white shadow-sm'
                          : 'bg-surface-container text-nexora-pink border border-nexora-pink hover:bg-nexora-pink hover:text-white'
                      }`}
                    >
                      {isSelected ? 'Selected' : 'Select'}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Professionals Section */}
          <section className="px-page-margin mb-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="relative flex-1 group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-on-surface-variant group-focus-within:text-nexora-pink transition-colors text-[20px]">
                    search
                  </span>
                </div>
                <input
                  type="text"
                  value={stylistSearch}
                  onChange={(e) => setStylistSearch(e.target.value)}
                  placeholder="Search professional"
                  className="w-full h-10 pl-10 pr-4 bg-surface-container-highest text-on-surface font-body-md text-body-md rounded-lg focus:outline-none focus:ring-1 focus:ring-nexora-pink transition-all text-[13px]"
                />
                {stylistSearch && (
                  <button
                    onClick={() => setStylistSearch('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-on-surface-variant hover:text-on-surface"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                )}
              </div>
              <button
                onClick={() => setStylistSortAsc(!stylistSortAsc)}
                className="w-10 h-10 flex items-center justify-center bg-surface-container rounded-lg text-on-surface-variant hover:text-nexora-pink transition-colors border border-outline-variant active:scale-95"
                title="Sort professionals by rating"
              >
                <span className="material-symbols-outlined">sort</span>
              </button>
            </div>

            <h2 className="font-section-heading text-section-heading text-on-surface mb-4">
              Professionals
            </h2>

            <div className="-mx-page-margin overflow-x-auto no-scrollbar flex gap-3 px-page-margin pb-2 snap-x items-start">
              {/* Any Professional */}
              <div
                onClick={() => setSelectedStylistId('any')}
                className={`flex-shrink-0 w-32 flex flex-col items-center gap-2 cursor-pointer p-1 rounded-2xl transition-all ${
                  selectedStylistId === 'any' ? 'bg-surface-container-low/60' : ''
                }`}
              >
                <div
                  className={`w-20 h-20 rounded-full bg-surface-container-highest flex items-center justify-center transition-all ${
                    selectedStylistId === 'any'
                      ? 'border-2 border-nexora-pink shadow-xs text-nexora-pink'
                      : 'border border-outline-variant/60 text-nexora-pink hover:border-nexora-pink'
                  }`}
                >
                  <span className="material-symbols-outlined text-nexora-pink text-[32px]">person_add</span>
                </div>
                <div className="text-center">
                  <p className="font-card-title text-[14px] text-on-surface font-semibold">Any Professional</p>
                  <p className="text-metadata text-nexora-pink font-semibold">Fastest</p>
                </div>
              </div>

              {/* Filter Pills Column */}
              <div className="flex-shrink-0 flex flex-col gap-2 px-2 border-l border-outline-variant ml-1 justify-center py-1">
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setStylistFilterBadge(stylistFilterBadge === 'Available Today' ? null : 'Available Today')
                    }
                    className={`px-3 py-1 rounded-full font-metadata text-metadata whitespace-nowrap border transition-colors ${
                      stylistFilterBadge === 'Available Today'
                        ? 'bg-nexora-pink text-white border-nexora-pink'
                        : 'bg-surface-container text-on-surface-variant border-outline-variant hover:border-nexora-pink'
                    }`}
                  >
                    Available Today
                  </button>
                  <button
                    onClick={() =>
                      setStylistFilterBadge(stylistFilterBadge === 'Top Rated' ? null : 'Top Rated')
                    }
                    className={`px-3 py-1 rounded-full font-metadata text-metadata whitespace-nowrap border transition-colors ${
                      stylistFilterBadge === 'Top Rated'
                        ? 'bg-nexora-pink text-white border-nexora-pink'
                        : 'bg-surface-container text-on-surface-variant border-outline-variant hover:border-nexora-pink'
                    }`}
                  >
                    Top Rated
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setStylistFilterBadge(
                        stylistFilterBadge === 'Most Experienced' ? null : 'Most Experienced'
                      )
                    }
                    className={`px-3 py-1 rounded-full font-metadata text-metadata whitespace-nowrap border transition-colors ${
                      stylistFilterBadge === 'Most Experienced'
                        ? 'bg-nexora-pink text-white border-nexora-pink'
                        : 'bg-surface-container text-on-surface-variant border-outline-variant hover:border-nexora-pink'
                    }`}
                  >
                    Most Experienced
                  </button>
                  <button
                    onClick={() =>
                      setStylistFilterBadge(
                        stylistFilterBadge === 'Hair Specialist' ? null : 'Hair Specialist'
                      )
                    }
                    className={`px-3 py-1 rounded-full font-metadata text-metadata whitespace-nowrap border transition-colors ${
                      stylistFilterBadge === 'Hair Specialist'
                        ? 'bg-nexora-pink text-white border-nexora-pink'
                        : 'bg-surface-container text-on-surface-variant border-outline-variant hover:border-nexora-pink'
                    }`}
                  >
                    Hair Specialist
                  </button>
                </div>
              </div>

              {/* Stylists List */}
              {filteredStylists
                .filter((st) => !st.isAny)
                .map((stylist) => {
                  const isSelected = selectedStylistId === stylist.id;

                  return (
                    <div
                      key={stylist.id}
                      onClick={() => setSelectedStylistId(stylist.id)}
                      className={`flex-shrink-0 w-32 flex flex-col items-center gap-2 cursor-pointer p-1 rounded-2xl transition-all ${
                        isSelected ? 'bg-surface-container-low/60' : ''
                      }`}
                    >
                      <div
                        className={`w-20 h-20 rounded-full overflow-hidden transition-all ${
                          isSelected
                            ? 'border-2 border-nexora-pink shadow-md ring-2 ring-nexora-pink/30'
                            : 'border border-outline-variant hover:border-nexora-pink'
                        }`}
                      >
                        <img
                          alt={stylist.name}
                          className="w-full h-full object-cover"
                          src={stylist.avatar}
                        />
                      </div>
                      <div className="text-center">
                        <p className="font-card-title text-[14px] font-semibold text-on-surface">{stylist.name}</p>
                        <p className="text-metadata text-on-surface-variant truncate max-w-[110px]">{stylist.role}</p>
                        {stylist.statusBadge && (
                          <p className={`text-metadata ${stylist.statusColor || 'text-nexora-pink'} font-bold`}>
                            {stylist.statusBadge}
                          </p>
                        )}
                        <div className="flex items-center justify-center gap-0.5 text-warning-amber mt-0.5">
                          <span className="material-symbols-outlined text-[12px] fill-1">star</span>
                          <span className="text-metadata font-bold">{stylist.rating}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>

          {/* About Section */}
          <section className="px-page-margin mb-6">
            <h2 className="font-section-heading text-[18px] font-bold text-on-surface mb-2">About</h2>
            <p className="font-body-md text-on-surface-variant mb-4 leading-relaxed">
              Luxe Beauty Lounge offers premium grooming services with a focus on modern techniques and customer comfort. Our experts ensure a personalized experience for every client.
            </p>
            <div className="-mx-page-margin overflow-x-auto no-scrollbar flex gap-2 px-page-margin">
              <span className="px-3 py-1 bg-surface-container rounded-full text-metadata text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-primary">verified</span>
                Verified
              </span>
              <span className="px-3 py-1 bg-surface-container rounded-full text-metadata text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">ac_unit</span>
                AC
              </span>
              <span className="px-3 py-1 bg-surface-container rounded-full text-metadata text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">wifi</span>
                Wi-Fi
              </span>
              <span className="px-3 py-1 bg-surface-container rounded-full text-metadata text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">local_parking</span>
                Parking
              </span>
              <span className="px-3 py-1 bg-surface-container rounded-full text-metadata text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">credit_card</span>
                Cards Accepted
              </span>
            </div>
          </section>

          {/* Reviews & Ratings Section */}
          <section className="px-page-margin mb-6">
            <h2 className="font-section-heading text-[18px] font-bold text-on-surface mb-4">
              Reviews &amp; Ratings
            </h2>
            <div className="flex items-center gap-6 mb-6 bg-surface-container-low p-4 rounded-xl border border-outline-variant/50">
              <div className="flex flex-col items-center justify-center shrink-0">
                <span className="text-[32px] font-extrabold text-on-surface leading-none">4.8</span>
                <div className="flex text-warning-amber my-1">
                  <span className="material-symbols-outlined text-[18px] fill-1">star</span>
                  <span className="material-symbols-outlined text-[18px] fill-1">star</span>
                  <span className="material-symbols-outlined text-[18px] fill-1">star</span>
                  <span className="material-symbols-outlined text-[18px] fill-1">star</span>
                  <span className="material-symbols-outlined text-[18px] fill-1">star_half</span>
                </div>
                <span className="text-metadata text-on-surface-variant text-[11px]">1.2k reviews</span>
              </div>

              <div className="flex-1 flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-metadata text-[12px] w-2 font-medium">5</span>
                  <div className="flex-1 h-2 bg-surface-container rounded-full overflow-hidden">
                    <div className="bg-warning-amber h-full w-[85%] rounded-full" />
                  </div>
                  <span className="text-[11px] text-on-surface-variant w-7 text-right">85%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-metadata text-[12px] w-2 font-medium">4</span>
                  <div className="flex-1 h-2 bg-surface-container rounded-full overflow-hidden">
                    <div className="bg-warning-amber h-full w-[10%] rounded-full" />
                  </div>
                  <span className="text-[11px] text-on-surface-variant w-7 text-right">10%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-metadata text-[12px] w-2 font-medium">3</span>
                  <div className="flex-1 h-2 bg-surface-container rounded-full overflow-hidden">
                    <div className="bg-warning-amber h-full w-[3%] rounded-full" />
                  </div>
                  <span className="text-[11px] text-on-surface-variant w-7 text-right">3%</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant">
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-nexora-pink/15 text-nexora-pink font-bold flex items-center justify-center text-[12px]">
                      P
                    </div>
                    <span className="font-card-title text-[14px] font-bold">Priya S.</span>
                  </div>
                  <span className="text-metadata text-[11px] text-on-surface-variant">2 days ago</span>
                </div>
                <div className="flex text-warning-amber mb-2">
                  <span className="material-symbols-outlined text-[14px] fill-1">star</span>
                  <span className="material-symbols-outlined text-[14px] fill-1">star</span>
                  <span className="material-symbols-outlined text-[14px] fill-1">star</span>
                  <span className="material-symbols-outlined text-[14px] fill-1">star</span>
                  <span className="material-symbols-outlined text-[14px] fill-1">star</span>
                </div>
                <p className="text-body-md text-[13px] text-on-surface-variant">
                  Amazing service! Aarav did a great job with my haircut and styling. The ambiance is top-notch.
                </p>
              </div>

              <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant">
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/15 text-primary font-bold flex items-center justify-center text-[12px]">
                      V
                    </div>
                    <span className="font-card-title text-[14px] font-bold">Vikram M.</span>
                  </div>
                  <span className="text-metadata text-[11px] text-on-surface-variant">1 week ago</span>
                </div>
                <div className="flex text-warning-amber mb-2">
                  <span className="material-symbols-outlined text-[14px] fill-1">star</span>
                  <span className="material-symbols-outlined text-[14px] fill-1">star</span>
                  <span className="material-symbols-outlined text-[14px] fill-1">star</span>
                  <span className="material-symbols-outlined text-[14px] fill-1">star</span>
                  <span className="material-symbols-outlined text-[14px] fill-1">star_half</span>
                </div>
                <p className="text-body-md text-[13px] text-on-surface-variant">
                  Quick, clean and very courteous staff. Loved the beard grooming and facial massage.
                </p>
              </div>
            </div>
          </section>

          {/* Opening Hours Section */}
          <section className="px-page-margin mb-6">
            <h2 className="font-section-heading text-[18px] font-bold text-on-surface mb-3">
              Opening Hours
            </h2>
            <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="font-body-md text-[14px] text-on-surface font-medium">
                    Today: 10:00 AM – 8:00 PM
                  </span>
                  <span className="text-metadata text-success-emerald font-bold flex items-center gap-1 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-success-emerald animate-pulse" />
                    Open Now
                  </span>
                </div>
                <button
                  onClick={() => setShowFullWeekHours(!showFullWeekHours)}
                  className="text-nexora-pink font-button-text text-[13px] font-semibold hover:underline"
                >
                  {showFullWeekHours ? 'Hide Week' : 'View Full Week'}
                </button>
              </div>

              {showFullWeekHours && (
                <div className="mt-3 pt-3 border-t border-outline-variant/40 flex flex-col gap-1.5 text-[12px] animate-in fade-in duration-200">
                  <div className="flex justify-between text-on-surface font-semibold">
                    <span>Monday – Friday</span>
                    <span>9:30 AM – 9:00 PM</span>
                  </div>
                  <div className="flex justify-between text-on-surface font-semibold">
                    <span>Saturday</span>
                    <span>9:00 AM – 9:30 PM</span>
                  </div>
                  <div className="flex justify-between text-on-surface font-semibold">
                    <span>Sunday</span>
                    <span>10:00 AM – 8:00 PM</span>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Location Section */}
          <section className="px-page-margin mb-6">
            <h2 className="font-section-heading text-[18px] font-bold text-on-surface mb-3">Location</h2>
            <div className="flex flex-col gap-3 p-3.5 bg-surface-container-low rounded-xl border border-outline-variant">
              <div className="flex items-start gap-2.5">
                <span className="material-symbols-outlined text-nexora-pink text-[22px] mt-0.5">
                  location_on
                </span>
                <div>
                  <p className="font-body-md text-[14px] font-semibold text-on-surface">
                    123, Main Road, Sector 5, Mansarovar, Jaipur
                  </p>
                  <p className="text-metadata text-on-surface-variant text-[12px] mt-0.5">
                    1.2 km away · Near City Metro Station
                  </p>
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <a
                  href="https://www.google.com/maps/search/?api=1&query=Mansarovar+Jaipur+Salon"
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 h-10 border border-nexora-pink text-nexora-pink rounded-xl font-button-text text-[13px] font-semibold flex items-center justify-center gap-1.5 hover:bg-nexora-pink hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">directions</span>
                  Directions
                </a>
                <a
                  href="tel:+919829012345"
                  className="flex-1 h-10 border border-nexora-pink text-nexora-pink rounded-xl font-button-text text-[13px] font-semibold flex items-center justify-center gap-1.5 hover:bg-nexora-pink hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">call</span>
                  Call
                </a>
              </div>
            </div>
          </section>

          {/* Things to Know Section */}
          <section className="px-page-margin mb-6">
            <h2 className="font-section-heading text-[18px] font-bold text-on-surface mb-3">
              Things to Know
            </h2>
            <div className="flex flex-col gap-3 mb-4">
              <div className="flex items-center gap-3 p-3 bg-surface-container-low rounded-xl border border-outline-variant/40">
                <span className="material-symbols-outlined text-nexora-pink">event_busy</span>
                <span className="text-body-md text-[13px] text-on-surface font-medium">
                  Free cancellation up to 2 hours before
                </span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-surface-container-low rounded-xl border border-outline-variant/40">
                <span className="material-symbols-outlined text-primary">schedule</span>
                <span className="text-body-md text-[13px] text-on-surface font-medium">
                  Arrive 10 mins before your slot
                </span>
              </div>
            </div>

            {/* Expandable FAQs */}
            <div className="flex flex-col gap-2">
              <div className="border-b border-outline-variant">
                <button
                  onClick={() => setExpandedFaq(expandedFaq === 1 ? null : 1)}
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-surface-container/30 transition-colors rounded-lg"
                >
                  <span className="text-body-md text-[14px] font-semibold text-on-surface">
                    Can I select my professional?
                  </span>
                  <span
                    className={`material-symbols-outlined text-on-surface-variant transition-transform ${
                      expandedFaq === 1 ? 'rotate-180 text-nexora-pink' : ''
                    }`}
                  >
                    expand_more
                  </span>
                </button>
                {expandedFaq === 1 && (
                  <p className="px-3 pb-3 text-[13px] text-on-surface-variant leading-relaxed animate-in fade-in duration-150">
                    Yes! You can choose your preferred stylist or select "Any Professional" for the earliest available slot.
                  </p>
                )}
              </div>

              <div className="border-b border-outline-variant">
                <button
                  onClick={() => setExpandedFaq(expandedFaq === 2 ? null : 2)}
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-surface-container/30 transition-colors rounded-lg"
                >
                  <span className="text-body-md text-[14px] font-semibold text-on-surface">
                    Can I reschedule?
                  </span>
                  <span
                    className={`material-symbols-outlined text-on-surface-variant transition-transform ${
                      expandedFaq === 2 ? 'rotate-180 text-nexora-pink' : ''
                    }`}
                  >
                    expand_more
                  </span>
                </button>
                {expandedFaq === 2 && (
                  <p className="px-3 pb-3 text-[13px] text-on-surface-variant leading-relaxed animate-in fade-in duration-150">
                    Yes, you can easily reschedule anytime up to 2 hours before your appointment directly from your Bookings tab without any cancellation fees.
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Search in Category Input */}
          <section className="px-page-margin mb-4 relative z-10">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-on-surface-variant group-focus-within:text-nexora-pink transition-colors">
                  search
                </span>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search in ${categoryTitle}`}
                className="w-full h-[48px] pl-10 pr-4 bg-surface-container-highest text-on-surface font-body-md text-body-md rounded-xl shadow-sm focus:outline-none focus:ring-1 focus:ring-nexora-pink focus:bg-surface-lowest transition-all"
              />
            </div>
          </section>

          {/* Sort and View Mode Toggle Bar */}
          <section className="px-page-margin mb-4 flex items-center justify-between relative">
            <div className="relative">
              <button
                onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
                className="flex items-center gap-1 text-on-surface-variant hover:text-nexora-pink transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">sort</span>
                <span className="font-button-text text-[14px] capitalize">
                  Sort: {sortBy}
                </span>
                <span className="material-symbols-outlined text-[18px]">expand_more</span>
              </button>

              {isSortDropdownOpen && (
                <div className="absolute left-0 top-8 z-30 bg-surface border border-outline-variant rounded-xl shadow-lg p-1.5 min-w-[180px] flex flex-col gap-1">
                  {(['recommended', 'rating', 'distance', 'price'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setSortBy(s);
                        setIsSortDropdownOpen(false);
                      }}
                      className={`px-3 py-1.5 text-left text-[13px] rounded-lg capitalize transition-colors ${
                        sortBy === s ? 'bg-primary text-white font-bold' : 'hover:bg-surface-container text-on-surface'
                      }`}
                    >
                      {s === 'price' ? 'Price: Low to High' : s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex bg-surface-container rounded-lg p-1 border border-outline-variant/30">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 rounded-md shadow-sm font-button-text text-[12px] flex items-center gap-1 transition-all ${
                  viewMode === 'list'
                    ? 'bg-white text-nexora-pink font-bold shadow-xs'
                    : 'text-on-surface-variant hover:text-nexora-pink'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">list</span>
                List
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={`px-3 py-1 rounded-md shadow-sm font-button-text text-[12px] flex items-center gap-1 transition-all ${
                  viewMode === 'map'
                    ? 'bg-white text-nexora-pink font-bold shadow-xs'
                    : 'text-on-surface-variant hover:text-nexora-pink'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">map</span>
                Map
              </button>
            </div>
          </section>

          {/* Quick Filter Horizontal Scroll */}
          <section className="-mx-page-margin mb-4">
            <div className="flex overflow-x-auto no-scrollbar gap-2 px-page-margin snap-x">
              {[
                { name: 'Open Now', icon: 'schedule' },
                { name: 'Available Today', icon: 'event_available' },
                { name: 'Top Rated', icon: 'star' },
                { name: 'Nearest', icon: 'near_me' },
                { name: 'Offers', icon: 'sell' },
                { name: 'At Home', icon: 'home' },
              ].map((f) => {
                const isSelected = selectedFilter === f.name;
                return (
                  <button
                    key={f.name}
                    onClick={() => setSelectedFilter(isSelected ? '' : f.name)}
                    className={`px-4 py-2 rounded-full font-button-text text-[14px] whitespace-nowrap transition-all flex items-center gap-1 snap-start ${
                      isSelected
                        ? 'bg-nexora-pink text-white shadow-sm font-semibold'
                        : 'bg-surface-container text-on-surface-variant border border-outline-variant hover:border-nexora-pink hover:text-nexora-pink'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">{f.icon}</span>
                    <span>{f.name}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Salons List Cards */}
          <div className="flex flex-col gap-component-gap px-page-margin">
            {filteredSalons.map((salon) => {
              const isSaved = savedSalonIds.includes(salon.id);
              return (
                <div
                  key={salon.id}
                  className="bg-surface-container-low rounded-xl overflow-hidden shadow-sm border border-outline-variant hover:shadow-md transition-shadow"
                >
                  <div className="relative h-48">
                    <img
                      alt={salon.name}
                      className="w-full h-full object-cover"
                      src={salon.image}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSaveSalon(salon.id);
                      }}
                      className={`absolute top-3 right-3 w-8 h-8 rounded-full bg-surface/80 backdrop-blur-md flex items-center justify-center transition-colors ${
                        isSaved ? 'text-nexora-pink' : 'text-on-surface-variant hover:text-nexora-pink'
                      }`}
                      aria-label={`Save ${salon.name}`}
                    >
                      <span className={`material-symbols-outlined text-[20px] ${isSaved ? 'fill-1 text-nexora-pink' : ''}`}>
                        favorite
                      </span>
                    </button>
                    <div className="absolute bottom-3 left-3 px-2 py-1 bg-success-emerald text-white text-[10px] font-bold rounded uppercase tracking-wider">
                      {salon.isOpen ? 'Open' : 'Closed'}
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex justify-between items-start mb-1">
                      <h3
                        onClick={() => onOpenSalonDetails(salon)}
                        className="font-card-title text-card-title font-bold text-on-surface hover:text-nexora-pink cursor-pointer transition-colors"
                      >
                        {salon.name}
                      </h3>
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-warning-amber text-[16px] fill-1">star</span>
                        <span className="text-metadata font-bold">{salon.rating}</span>
                        <span className="text-metadata text-on-surface-variant">({salon.reviewCount})</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-on-surface-variant mb-2">
                      <span className="material-symbols-outlined text-[14px]">location_on</span>
                      <span className="text-metadata">{salon.location.area} · {salon.distance}</span>
                    </div>

                    <p className="text-metadata text-on-surface-variant mb-4">
                      {salon.categories.join(' · ')}
                    </p>

                    <div className="flex gap-2">
                      <button
                        onClick={() => onOpenSalonDetails(salon)}
                        className="px-3.5 h-touch-target-min bg-surface-container text-on-surface font-button-text text-[13px] font-semibold rounded-lg hover:bg-surface-container-high transition-colors"
                      >
                        Menu
                      </button>
                      <button
                        onClick={() => handleBookSingleSalon(salon)}
                        className="flex-1 h-touch-target-min bg-primary text-on-primary font-button-text text-[13px] font-bold rounded-lg hover:bg-nexora-pink transition-colors shadow-xs"
                      >
                        Book Appointment
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Floating Sticky Bottom Bar */}
      <div className={`fixed left-0 right-0 z-40 bg-surface/90 backdrop-blur-xl border-t border-outline-variant shadow-[0_-4px_12px_rgba(0,0,0,0.05)] ${
        onSelectTab ? 'bottom-16' : 'bottom-0 pb-safe'
      }`}>
        <div className="px-page-margin py-3.5 flex items-center justify-between gap-4 max-w-4xl mx-auto">
          <div className="flex flex-col">
            <span className="font-card-title text-[14px] font-bold text-on-surface">
              {selectedServices.length} service{selectedServices.length > 1 ? 's' : ''} selected
            </span>
            <span className="text-metadata text-[12px] text-on-surface-variant">
              {totalDuration} min total · ₹{totalPrice}
            </span>
          </div>

          <button
            onClick={handleContinueBooking}
            disabled={selectedServices.length === 0}
            className={`flex-1 max-w-[220px] h-12 rounded-xl font-button-text text-[15px] font-bold shadow-lg transition-all flex items-center justify-center gap-2 ${
              selectedServices.length === 0
                ? 'bg-nexora-pink/50 text-white cursor-not-allowed opacity-50'
                : 'bg-nexora-pink text-white hover:bg-primary active:scale-95'
            }`}
            aria-label="Continue to booking"
          >
            <span>Continue</span>
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>
      </div>

      {/* Bottom Navigation */}
      {onSelectTab && (
        <BottomNav
          activeTab="home"
          onSelectTab={onSelectTab}
          activeAppointmentsCount={activeAppointmentsCount}
        />
      )}
    </div>
  );
};
