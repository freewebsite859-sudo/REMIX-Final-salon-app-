import React, { useState, useMemo } from 'react';
import { Salon, SalonService, Stylist, SavedServiceRef, SavedStaffRef } from '../types';

interface SavedTabProps {
  salons: Salon[];
  savedSalonIds: string[];
  savedServices?: SavedServiceRef[];
  savedStaff?: SavedStaffRef[];
  onOpenSalonDetails: (salon: Salon) => void;
  onBookSalon: (salon: Salon, service?: SalonService, stylist?: Stylist) => void;
  onToggleSaveSalon: (salonId: string) => void;
  onShareSalon?: (salon: Salon) => void;
  onToggleSaveService?: (salonId: string, serviceId: string) => void;
  onToggleSaveStaff?: (salonId: string, stylistId: string) => void;
  onExploreSalons?: () => void;
}

export const SavedTab: React.FC<SavedTabProps> = ({
  salons,
  savedSalonIds = [],
  savedServices = [],
  savedStaff = [],
  onOpenSalonDetails,
  onBookSalon,
  onToggleSaveSalon,
  onShareSalon,
  onToggleSaveService,
  onToggleSaveStaff,
  onExploreSalons,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'salons' | 'staff' | 'services'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected entities for View Profile Modals
  const [selectedStaffProfile, setSelectedStaffProfile] = useState<{
    stylist: Stylist;
    salon: Salon;
  } | null>(null);

  const [selectedServiceProfile, setSelectedServiceProfile] = useState<{
    service: SalonService;
    salon: Salon;
  } | null>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 1. Saved Salons list
  const savedSalonsList = useMemo(() => {
    // If empty, provide first 2 demo salons as initial favourites if available
    const ids = savedSalonIds.length > 0 ? savedSalonIds : salons.slice(0, 2).map((s) => s.id);
    return salons.filter((s) => ids.includes(s.id));
  }, [salons, savedSalonIds]);

  // 2. Saved Staff list
  const savedStaffList = useMemo(() => {
    const list: Array<{ stylist: Stylist; salon: Salon }> = [];

    if (savedStaff && savedStaff.length > 0) {
      savedStaff.forEach((ref) => {
        const salon = salons.find((s) => s.id === ref.salonId);
        const stylist = salon?.stylists.find((st) => st.id === ref.stylistId);
        if (salon && stylist) {
          list.push({ stylist, salon });
        }
      });
    } else {
      // Provide default initial favourite staff from salons for rich demo
      salons.forEach((salon) => {
        if (salon.stylists && salon.stylists.length > 0) {
          salon.stylists.slice(0, 1).forEach((st) => {
            if (list.length < 3) {
              list.push({ stylist: st, salon });
            }
          });
        }
      });
    }

    return list;
  }, [salons, savedStaff]);

  // 3. Saved Services list
  const savedServicesList = useMemo(() => {
    const list: Array<{ service: SalonService; salon: Salon }> = [];

    if (savedServices && savedServices.length > 0) {
      savedServices.forEach((ref) => {
        const salon = salons.find((s) => s.id === ref.salonId);
        const service = salon?.services.find((srv) => srv.id === ref.serviceId);
        if (salon && service) {
          list.push({ service, salon });
        }
      });
    } else {
      // Provide default initial favourite services from salons
      salons.forEach((salon) => {
        if (salon.services && salon.services.length > 0) {
          salon.services.slice(0, 1).forEach((srv) => {
            if (list.length < 3) {
              list.push({ service: srv, salon });
            }
          });
        }
      });
    }

    return list;
  }, [salons, savedServices]);

  // Filtered Salons by search
  const filteredSalons = useMemo(() => {
    if (!searchQuery.trim()) return savedSalonsList;
    const q = searchQuery.toLowerCase();
    return savedSalonsList.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.location.area.toLowerCase().includes(q) ||
        s.categories.some((c) => c.toLowerCase().includes(q))
    );
  }, [savedSalonsList, searchQuery]);

  // Filtered Staff by search
  const filteredStaff = useMemo(() => {
    if (!searchQuery.trim()) return savedStaffList;
    const q = searchQuery.toLowerCase();
    return savedStaffList.filter(
      (item) =>
        item.stylist.name.toLowerCase().includes(q) ||
        item.stylist.role.toLowerCase().includes(q) ||
        item.salon.name.toLowerCase().includes(q) ||
        item.stylist.specialty.some((sp) => sp.toLowerCase().includes(q))
    );
  }, [savedStaffList, searchQuery]);

  // Filtered Services by search
  const filteredServices = useMemo(() => {
    if (!searchQuery.trim()) return savedServicesList;
    const q = searchQuery.toLowerCase();
    return savedServicesList.filter(
      (item) =>
        item.service.name.toLowerCase().includes(q) ||
        item.service.category.toLowerCase().includes(q) ||
        item.salon.name.toLowerCase().includes(q) ||
        item.service.description.toLowerCase().includes(q)
    );
  }, [savedServicesList, searchQuery]);

  // Remove Handlers
  const handleRemoveSalon = (salonId: string, salonName: string) => {
    onToggleSaveSalon(salonId);
    showToast(`Removed "${salonName}" from favourites`);
  };

  const handleRemoveStaff = (salonId: string, stylistId: string, stylistName: string) => {
    if (onToggleSaveStaff) {
      onToggleSaveStaff(salonId, stylistId);
    }
    showToast(`Removed "${stylistName}" from favourite staff`);
  };

  const handleRemoveService = (salonId: string, serviceId: string, serviceName: string) => {
    if (onToggleSaveService) {
      onToggleSaveService(salonId, serviceId);
    }
    showToast(`Removed "${serviceName}" from favourite services`);
  };

  const totalFavouritesCount =
    savedSalonsList.length + savedStaffList.length + savedServicesList.length;

  return (
    <div
      id="favourites-page"
      data-route="/customer/favourites"
      className="flex flex-col w-full pb-28 max-w-4xl mx-auto px-page-margin pt-3 animate-in fade-in duration-150"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-4 sm:right-8 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="p-3 px-4 rounded-2xl shadow-xl border border-[#b00055]/30 bg-surface-container-highest/95 text-on-surface flex items-center gap-2.5 text-[13px] font-semibold backdrop-blur-md">
            <span className="material-symbols-outlined text-[18px] text-success-emerald">
              check_circle
            </span>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-hero-heading-mobile text-[22px] font-bold text-on-surface">
                Favourites
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                /customer/favourites
              </span>
            </div>
            <p className="text-[13px] text-on-surface-variant mt-0.5">
              Your saved salons, preferred stylists & favourite treatments
            </p>
          </div>

          {/* Live search */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              id="favourites-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search favourites..."
              className="w-full h-9 pl-8 pr-3 bg-surface-container-lowest text-on-surface rounded-xl text-[12px] border border-outline-variant/50 focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant absolute left-2.5 top-2.5 pointer-events-none">
              search
            </span>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="flex bg-surface-container-low p-1 rounded-2xl border border-outline-variant/40 mb-5 overflow-x-auto no-scrollbar gap-1">
        <button
          type="button"
          id="tab-all-favourites"
          onClick={() => setActiveTab('all')}
          className={`py-2 px-3.5 rounded-xl text-[12px] font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0 ${
            activeTab === 'all'
              ? 'bg-primary text-white shadow-xs'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">stars</span>
          <span>All ({totalFavouritesCount})</span>
        </button>

        <button
          type="button"
          id="tab-favourite-salons"
          onClick={() => setActiveTab('salons')}
          className={`py-2 px-3.5 rounded-xl text-[12px] font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0 ${
            activeTab === 'salons'
              ? 'bg-primary text-white shadow-xs'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">storefront</span>
          <span>Favourite Salons ({savedSalonsList.length})</span>
        </button>

        <button
          type="button"
          id="tab-favourite-staff"
          onClick={() => setActiveTab('staff')}
          className={`py-2 px-3.5 rounded-xl text-[12px] font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0 ${
            activeTab === 'staff'
              ? 'bg-primary text-white shadow-xs'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">person</span>
          <span>Favourite Staff ({savedStaffList.length})</span>
        </button>

        <button
          type="button"
          id="tab-favourite-services"
          onClick={() => setActiveTab('services')}
          className={`py-2 px-3.5 rounded-xl text-[12px] font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0 ${
            activeTab === 'services'
              ? 'bg-primary text-white shadow-xs'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">spa</span>
          <span>Favourite Services ({savedServicesList.length})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. FAVOURITE SALONS SECTION                                               */}
      {/* ========================================================================= */}
      {(activeTab === 'all' || activeTab === 'salons') && (
        <section id="section-favourite-salons" className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-section-heading text-[16px] font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-primary">storefront</span>
              <span>Favourite Salons</span>
            </h2>
            <span className="text-[11px] font-semibold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">
              {filteredSalons.length} saved
            </span>
          </div>

          {filteredSalons.length === 0 ? (
            <div className="py-10 text-center bg-surface-container-low rounded-2xl border border-outline-variant/40 p-6 flex flex-col items-center">
              <span className="material-symbols-outlined text-[32px] text-nexora-pink mb-1.5">favorite</span>
              <h3 className="font-bold text-[15px] text-on-surface">No favourite salons</h3>
              <p className="text-[12px] text-on-surface-variant max-w-xs mt-0.5 mb-3">
                Tap the heart icon on any salon to save it here for quick rebooking.
              </p>
              {onExploreSalons && (
                <button
                  type="button"
                  onClick={onExploreSalons}
                  className="px-4 py-2 bg-primary text-white text-[12px] font-bold rounded-xl hover:bg-nexora-pink transition-colors shadow-xs cursor-pointer"
                >
                  Explore Salons
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {filteredSalons.map((salon) => (
                <div
                  key={salon.id}
                  id={`favourite-salon-card-${salon.id}`}
                  className="bg-surface-container-low border border-outline-variant/50 hover:border-primary/40 rounded-2xl p-4 shadow-xs flex flex-col justify-between transition-all"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <img
                      src={salon.image}
                      alt={salon.name}
                      className="w-16 h-16 rounded-xl object-cover ring-1 ring-outline-variant/30 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-[15px] text-on-surface truncate">{salon.name}</h3>
                      <p className="text-[12px] text-on-surface-variant truncate mt-0.5">
                        {salon.location.area} · {salon.distance}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1 text-[12px]">
                        <span className="material-symbols-outlined text-warning-amber text-[14px] fill-1">
                          star
                        </span>
                        <span className="font-bold text-on-surface">{salon.rating}</span>
                        <span className="text-on-surface-variant">({salon.reviewCount} reviews)</span>
                        <span className="text-on-surface-variant font-bold">•</span>
                        <span className="text-on-surface font-semibold">{salon.priceRange}</span>
                      </div>
                    </div>

                    {/* Remove Favourite button */}
                    <button
                      type="button"
                      id={`remove-favourite-salon-${salon.id}`}
                      onClick={() => handleRemoveSalon(salon.id, salon.name)}
                      className="text-primary hover:text-rose-700 p-1 transition-colors cursor-pointer"
                      title="Remove from favourites"
                      aria-label={`Remove ${salon.name} from favourites`}
                    >
                      <span className="material-symbols-outlined text-[22px] fill-1">favorite</span>
                    </button>
                  </div>

                  {/* Actions: View Profile & Book Again */}
                  <div className="flex items-center gap-2 pt-2 border-t border-outline-variant/30">
                    <button
                      type="button"
                      id={`view-profile-salon-${salon.id}`}
                      onClick={() => onOpenSalonDetails(salon)}
                      className="flex-1 py-2 bg-surface-container-lowest border border-outline-variant/40 hover:bg-surface-container text-on-surface text-[12px] font-bold rounded-xl transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px]">info</span>
                      <span>View Profile</span>
                    </button>
                    <button
                      type="button"
                      id={`book-favourite-salon-${salon.id}`}
                      onClick={() => onBookSalon(salon)}
                      className="flex-1 py-2 bg-primary text-white text-[12px] font-bold rounded-xl hover:bg-nexora-pink transition-colors shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px]">event</span>
                      <span>Book Again</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ========================================================================= */}
      {/* 2. FAVOURITE STAFF SECTION                                                */}
      {/* ========================================================================= */}
      {(activeTab === 'all' || activeTab === 'staff') && (
        <section id="section-favourite-staff" className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-section-heading text-[16px] font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-[#b00055]">badge</span>
              <span>Favourite Staff</span>
            </h2>
            <span className="text-[11px] font-semibold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">
              {filteredStaff.length} saved
            </span>
          </div>

          {filteredStaff.length === 0 ? (
            <div className="py-10 text-center bg-surface-container-low rounded-2xl border border-outline-variant/40 p-6 flex flex-col items-center">
              <span className="material-symbols-outlined text-[32px] text-[#b00055] mb-1.5">person</span>
              <h3 className="font-bold text-[15px] text-on-surface">No favourite stylists yet</h3>
              <p className="text-[12px] text-on-surface-variant max-w-xs mt-0.5 mb-3">
                Save preferred barbers, aestheticians and hair artists to book them directly.
              </p>
              {onExploreSalons && (
                <button
                  type="button"
                  onClick={onExploreSalons}
                  className="px-4 py-2 bg-primary text-white text-[12px] font-bold rounded-xl hover:bg-nexora-pink transition-colors shadow-xs cursor-pointer"
                >
                  Discover Stylists
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {filteredStaff.map(({ stylist, salon }) => (
                <div
                  key={`${salon.id}-${stylist.id}`}
                  id={`favourite-staff-card-${stylist.id}`}
                  className="bg-surface-container-low border border-outline-variant/50 hover:border-primary/40 rounded-2xl p-4 shadow-xs flex flex-col justify-between transition-all"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <img
                      src={
                        stylist.avatar ||
                        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80'
                      }
                      alt={stylist.name}
                      className="w-14 h-14 rounded-full object-cover ring-2 ring-primary/30 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-[14px] text-on-surface truncate">
                          {stylist.name}
                        </h3>
                        <span className="material-symbols-outlined text-[14px] text-primary" title="Verified Professional">
                          verified
                        </span>
                      </div>
                      <p className="text-[11px] text-[#b00055] font-semibold truncate mt-0.5">
                        {stylist.role}
                      </p>
                      <p className="text-[11px] text-on-surface-variant truncate">
                        At {salon.name} ({salon.location.area})
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[11px]">
                        <span className="text-amber-700 font-bold flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-[13px] fill-1">star</span>
                          {stylist.rating}
                        </span>
                        <span>•</span>
                        <span className="text-on-surface-variant font-medium">{stylist.experience}</span>
                      </div>
                    </div>

                    {/* Remove Favourite Staff button */}
                    <button
                      type="button"
                      id={`remove-favourite-staff-${stylist.id}`}
                      onClick={() => handleRemoveStaff(salon.id, stylist.id, stylist.name)}
                      className="text-[#b00055] hover:text-rose-700 p-1 transition-colors cursor-pointer"
                      title="Remove from favourite staff"
                      aria-label={`Remove ${stylist.name} from favourites`}
                    >
                      <span className="material-symbols-outlined text-[22px] fill-1">favorite</span>
                    </button>
                  </div>

                  {/* Specialties Pills */}
                  {stylist.specialty && stylist.specialty.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap mb-3">
                      {stylist.specialty.slice(0, 3).map((sp, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-surface-container-lowest text-on-surface-variant text-[10px] font-semibold border border-outline-variant/30"
                        >
                          {sp}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Actions: View Profile & Book Again */}
                  <div className="flex items-center gap-2 pt-2 border-t border-outline-variant/30">
                    <button
                      type="button"
                      id={`view-profile-staff-${stylist.id}`}
                      onClick={() => setSelectedStaffProfile({ stylist, salon })}
                      className="flex-1 py-2 bg-surface-container-lowest border border-outline-variant/40 hover:bg-surface-container text-on-surface text-[12px] font-bold rounded-xl transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px]">person</span>
                      <span>View Profile</span>
                    </button>
                    <button
                      type="button"
                      id={`book-favourite-staff-${stylist.id}`}
                      onClick={() => onBookSalon(salon, undefined, stylist)}
                      className="flex-1 py-2 bg-primary text-white text-[12px] font-bold rounded-xl hover:bg-nexora-pink transition-colors shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px]">event</span>
                      <span>Book Again</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ========================================================================= */}
      {/* 3. FAVOURITE SERVICES SECTION                                             */}
      {/* ========================================================================= */}
      {(activeTab === 'all' || activeTab === 'services') && (
        <section id="section-favourite-services" className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-section-heading text-[16px] font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-indigo-700">spa</span>
              <span>Favourite Services</span>
            </h2>
            <span className="text-[11px] font-semibold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">
              {filteredServices.length} saved
            </span>
          </div>

          {filteredServices.length === 0 ? (
            <div className="py-10 text-center bg-surface-container-low rounded-2xl border border-outline-variant/40 p-6 flex flex-col items-center">
              <span className="material-symbols-outlined text-[32px] text-indigo-700 mb-1.5">spa</span>
              <h3 className="font-bold text-[15px] text-on-surface">No favourite services</h3>
              <p className="text-[12px] text-on-surface-variant max-w-xs mt-0.5 mb-3">
                Bookmark specific haircuts, facials and spa treatments to rebook them quickly.
              </p>
              {onExploreSalons && (
                <button
                  type="button"
                  onClick={onExploreSalons}
                  className="px-4 py-2 bg-primary text-white text-[12px] font-bold rounded-xl hover:bg-nexora-pink transition-colors shadow-xs cursor-pointer"
                >
                  Browse Services
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {filteredServices.map(({ service, salon }) => (
                <div
                  key={`${salon.id}-${service.id}`}
                  id={`favourite-service-card-${service.id}`}
                  className="bg-surface-container-low border border-outline-variant/50 hover:border-primary/40 rounded-2xl p-4 shadow-xs flex flex-col justify-between transition-all"
                >
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-bold text-[14px] text-on-surface truncate">
                          {service.name}
                        </h3>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-800 border border-indigo-500/20">
                          {service.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant font-medium truncate">
                        Offered by {salon.name} ({salon.location.area})
                      </p>
                      <p className="text-[11px] text-on-surface-variant/80 line-clamp-1 mt-0.5">
                        {service.description}
                      </p>
                    </div>

                    {/* Remove Favourite Service button */}
                    <button
                      type="button"
                      id={`remove-favourite-service-${service.id}`}
                      onClick={() => handleRemoveService(salon.id, service.id, service.name)}
                      className="text-primary hover:text-rose-700 p-1 transition-colors cursor-pointer"
                      title="Remove from favourite services"
                      aria-label={`Remove ${service.name} from favourites`}
                    >
                      <span className="material-symbols-outlined text-[22px] fill-1">bookmark</span>
                    </button>
                  </div>

                  {/* Price & Duration */}
                  <div className="p-2.5 bg-surface-container-lowest rounded-xl border border-outline-variant/30 flex items-center justify-between mb-3">
                    <span className="text-[11px] text-on-surface-variant flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">schedule</span>
                      <span>{service.duration} mins</span>
                    </span>
                    <div className="flex items-baseline gap-1.5">
                      {service.discountPrice ? (
                        <>
                          <span className="text-[11px] line-through text-on-surface-variant">
                            ₹{service.price}
                          </span>
                          <span className="text-[14px] font-extrabold text-primary">
                            ₹{service.discountPrice}
                          </span>
                        </>
                      ) : (
                        <span className="text-[14px] font-extrabold text-primary">
                          ₹{service.price}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions: View Profile & Book Again */}
                  <div className="flex items-center gap-2 pt-2 border-t border-outline-variant/30">
                    <button
                      type="button"
                      id={`view-profile-service-${service.id}`}
                      onClick={() => setSelectedServiceProfile({ service, salon })}
                      className="flex-1 py-2 bg-surface-container-lowest border border-outline-variant/40 hover:bg-surface-container text-on-surface text-[12px] font-bold rounded-xl transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px]">info</span>
                      <span>View Profile</span>
                    </button>
                    <button
                      type="button"
                      id={`book-favourite-service-${service.id}`}
                      onClick={() => onBookSalon(salon, service)}
                      className="flex-1 py-2 bg-primary text-white text-[12px] font-bold rounded-xl hover:bg-nexora-pink transition-colors shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px]">event</span>
                      <span>Book Again</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: VIEW STAFF PROFILE MODAL                                         */}
      {/* ========================================================================= */}
      {selectedStaffProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-surface rounded-3xl p-5 sm:p-6 shadow-2xl border border-outline-variant/40 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">person</span>
                </div>
                <div>
                  <h3 className="font-card-title text-[17px] font-bold text-on-surface">
                    Stylist Profile
                  </h3>
                  <p className="text-[11px] text-on-surface-variant">
                    {selectedStaffProfile.salon.name}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedStaffProfile(null)}
                className="w-8 h-8 rounded-full bg-surface-container text-on-surface-variant flex items-center justify-center hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Profile Overview */}
            <div className="flex items-center gap-4 p-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/30">
              <img
                src={
                  selectedStaffProfile.stylist.avatar ||
                  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80'
                }
                alt={selectedStaffProfile.stylist.name}
                className="w-16 h-16 rounded-full object-cover ring-2 ring-primary/40 shadow-sm"
              />
              <div className="min-w-0">
                <h4 className="font-bold text-[16px] text-on-surface flex items-center gap-1.5">
                  <span>{selectedStaffProfile.stylist.name}</span>
                  <span className="material-symbols-outlined text-[16px] text-primary">verified</span>
                </h4>
                <p className="text-[12px] text-[#b00055] font-semibold">
                  {selectedStaffProfile.stylist.role}
                </p>
                <div className="flex items-center gap-2 mt-1 text-[12px]">
                  <span className="text-amber-700 font-bold flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-[14px] fill-1">star</span>
                    {selectedStaffProfile.stylist.rating}
                  </span>
                  <span>•</span>
                  <span className="text-on-surface-variant font-medium">
                    {selectedStaffProfile.stylist.experience}
                  </span>
                </div>
              </div>
            </div>

            {/* Salon Details */}
            <div className="p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/30 text-[12px] space-y-1">
              <span className="text-on-surface-variant block font-semibold">Current Salon:</span>
              <span className="text-on-surface font-bold text-[13px] block">
                {selectedStaffProfile.salon.name}
              </span>
              <span className="text-on-surface-variant block">
                {selectedStaffProfile.salon.location.address}
              </span>
            </div>

            {/* Specialties */}
            {selectedStaffProfile.stylist.specialty && (
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1.5">
                  Signature Specialties:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {selectedStaffProfile.stylist.specialty.map((sp, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-[11px] font-semibold border border-primary/20"
                    >
                      {sp}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* CTAs */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedStaffProfile(null)}
                className="flex-1 py-2.5 rounded-xl bg-surface-container text-on-surface text-[12px] font-semibold hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const data = selectedStaffProfile;
                  setSelectedStaffProfile(null);
                  onBookSalon(data.salon, undefined, data.stylist);
                }}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-[12px] font-bold hover:bg-[#b00055] transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">event</span>
                <span>Book with {selectedStaffProfile.stylist.name.split(' ')[0]}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: VIEW SERVICE PROFILE MODAL                                       */}
      {/* ========================================================================= */}
      {selectedServiceProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-surface rounded-3xl p-5 sm:p-6 shadow-2xl border border-outline-variant/40 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">spa</span>
                </div>
                <div>
                  <h3 className="font-card-title text-[17px] font-bold text-on-surface">
                    Treatment Details
                  </h3>
                  <p className="text-[11px] text-on-surface-variant">
                    {selectedServiceProfile.salon.name}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedServiceProfile(null)}
                className="w-8 h-8 rounded-full bg-surface-container text-on-surface-variant flex items-center justify-center hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="p-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-800 border border-indigo-500/20">
                  {selectedServiceProfile.service.category}
                </span>
                <span className="text-[12px] text-on-surface-variant font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px]">schedule</span>
                  <span>{selectedServiceProfile.service.duration} mins</span>
                </span>
              </div>

              <h4 className="font-extrabold text-[18px] text-on-surface">
                {selectedServiceProfile.service.name}
              </h4>

              <p className="text-[12px] text-on-surface-variant leading-relaxed">
                {selectedServiceProfile.service.description}
              </p>

              <div className="pt-2 border-t border-outline-variant/20 flex items-baseline justify-between">
                <span className="text-[12px] text-on-surface-variant font-medium">Service Price:</span>
                <div className="flex items-baseline gap-2">
                  {selectedServiceProfile.service.discountPrice ? (
                    <>
                      <span className="text-[13px] line-through text-on-surface-variant">
                        ₹{selectedServiceProfile.service.price}
                      </span>
                      <span className="text-[18px] font-extrabold text-primary">
                        ₹{selectedServiceProfile.service.discountPrice}
                      </span>
                    </>
                  ) : (
                    <span className="text-[18px] font-extrabold text-primary">
                      ₹{selectedServiceProfile.service.price}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Salon info */}
            <div className="p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/30 text-[12px]">
              <span className="text-on-surface-variant block font-semibold mb-0.5">Offered by:</span>
              <span className="font-bold text-on-surface">{selectedServiceProfile.salon.name}</span>
              <p className="text-[11px] text-on-surface-variant mt-0.5">
                {selectedServiceProfile.salon.location.address}
              </p>
            </div>

            {/* CTAs */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedServiceProfile(null)}
                className="flex-1 py-2.5 rounded-xl bg-surface-container text-on-surface text-[12px] font-semibold hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const data = selectedServiceProfile;
                  setSelectedServiceProfile(null);
                  onBookSalon(data.salon, data.service);
                }}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-[12px] font-bold hover:bg-[#b00055] transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">event</span>
                <span>Book This Service</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
