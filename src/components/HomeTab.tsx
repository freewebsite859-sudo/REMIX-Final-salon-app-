import React, { useState, useMemo } from 'react';
import { Salon, Appointment, SalonService, Stylist, UserProfile } from '../types';
import { AppointmentCountdownBanner, parseAppointmentDateTime } from './AppointmentCountdownBanner';

interface HomeTabProps {
  user: UserProfile;
  salons: Salon[];
  currentLocation: string;
  upcomingAppointment: Appointment | null;
  savedSalonIds: string[];
  onOpenSalonDetails: (salon: Salon) => void;
  onBookSalon: (salon: Salon, service?: SalonService, stylist?: Stylist) => void;
  onOpenAppointmentDetails: (appointment: Appointment) => void;
  onToggleSaveSalon: (salonId: string) => void;
}

/** Parse "1.2 km"-style distance strings into numbers for sorting. */
const distanceKm = (salon: Salon): number => {
  const parsed = parseFloat((salon.distance || '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : 999;
};

const minPrice = (salon: Salon): number =>
  !salon.services || salon.services.length === 0
    ? 399
    : Math.min(...salon.services.map((s) => s.discountPrice || s.price));

/**
 * Plain, predictable search: salon name, category or service name simply
 * contains the typed word (case-insensitive).
 */
const matchesSearch = (salon: Salon, query: string): boolean => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    salon.name.toLowerCase().includes(q) ||
    salon.location.area.toLowerCase().includes(q) ||
    salon.categories.some((c) => c.toLowerCase().includes(q)) ||
    salon.services.some((s) => s.name.toLowerCase().includes(q))
  );
};

export const HomeTab: React.FC<HomeTabProps> = ({
  user,
  salons,
  currentLocation,
  upcomingAppointment,
  savedSalonIds,
  onOpenSalonDetails,
  onBookSalon,
  onOpenAppointmentDetails,
  onToggleSaveSalon,
}) => {
  const [searchInput, setSearchInput] = useState('');

  const nearbySalons = useMemo(
    () =>
      [...salons]
        .filter((s) => matchesSearch(s, searchInput))
        .sort((a, b) => distanceKm(a) - distanceKm(b) || b.rating - a.rating),
    [salons, searchInput]
  );

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

  const firstName = user.name ? user.name.trim().split(' ')[0] : '';
  const isSearching = searchInput.trim().length > 0;

  return (
    <div className="flex flex-col w-full pb-28 max-w-4xl mx-auto">
      {/* Greeting */}
      <section className="px-page-margin pt-5 pb-3">
        <h1 className="font-hero-heading-mobile text-[24px] sm:text-[28px] font-bold text-on-surface mb-0.5">
          {firstName ? `Hi, ${firstName}` : 'Book a salon near you'}
        </h1>
        <p className="font-body-md text-[14px] text-on-surface-variant">
          📍 {currentLocation} — search, then tap Book.
        </p>
      </section>

      {/* Active Upcoming Appointment (countdown if within 24h, else simple card) */}
      {upcomingAppointment && (() => {
        const appointmentDate = parseAppointmentDateTime(upcomingAppointment.date, upcomingAppointment.time);
        const diffMs = appointmentDate.getTime() - Date.now();
        const isWithin24Hours = diffMs > -2 * 60 * 60 * 1000 && diffMs <= 24 * 60 * 60 * 1000;
        const isToday = upcomingAppointment.date === new Date().toISOString().split('T')[0];
        const upcomingSalon = salons.find((s) => s.id === upcomingAppointment.salonId);

        if (isWithin24Hours || isToday) {
          return (
            <div className="mb-1">
              <AppointmentCountdownBanner
                appointment={upcomingAppointment}
                salon={upcomingSalon}
                onOpenDetails={onOpenAppointmentDetails}
              />
            </div>
          );
        }

        return (
          <section className="px-page-margin mb-5">
            <div className="bg-primary text-on-primary rounded-2xl p-4 shadow-md">
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1 mb-1 opacity-90">
                    <span className="material-symbols-outlined text-[14px]">schedule</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wider">
                      Your next visit · {upcomingAppointment.date} at {upcomingAppointment.time}
                    </span>
                  </div>
                  <h2 className="font-card-title text-[17px] font-bold mb-0.5 truncate">
                    {upcomingAppointment.salonName}
                  </h2>
                  <p className="font-metadata text-[13px] opacity-90">
                    {upcomingAppointment.services[0]?.name}
                    {upcomingAppointment.stylist ? ` · ${upcomingAppointment.stylist.name.split(' ')[0]}` : ''}
                  </p>
                </div>
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-white text-[20px]">calendar_month</span>
                </div>
              </div>
              <button
                onClick={() => onOpenAppointmentDetails(upcomingAppointment)}
                className="mt-3 w-full py-2.5 bg-white text-primary font-button-text text-[13px] font-bold rounded-xl hover:bg-white/90 transition-colors"
              >
                View appointment details
              </button>
            </div>
          </section>
        );
      })()}

      {/* Search — the one action on this screen */}
      <section className="px-page-margin mb-6">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3.5 top-3.5 text-[19px] text-[#b00055] z-10">
            search
          </span>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search a salon, area or service… e.g. haircut, spa"
            aria-label="Search salons and services"
            className="w-full h-[52px] pl-11 pr-11 bg-white text-on-surface font-body-md text-[14px] rounded-2xl border border-[rgba(180,0,80,0.18)] shadow-[0_8px_25px_rgba(0,0,0,0.06)] focus:outline-none focus:border-[rgba(176,0,85,0.45)] focus:ring-4 focus:ring-[rgba(176,0,85,0.08)] transition-all"
          />
          {isSearching && (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              aria-label="Clear search"
              className="absolute right-3 top-3.5 text-on-surface-variant hover:text-[#b00055] transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
        </div>
      </section>

      {/* Salon list */}
      <section className="px-page-margin flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-section-heading text-[17px] font-bold text-on-surface">
            {isSearching ? 'Search results' : 'Salons near you'}
          </h2>
          <span className="text-[12px] text-on-surface-variant">
            {nearbySalons.length} {nearbySalons.length === 1 ? 'salon' : 'salons'}
          </span>
        </div>

        {nearbySalons.length === 0 && (
          <div className="p-8 rounded-2xl bg-white border border-outline-variant/40 flex flex-col items-center justify-center text-center gap-2">
            <span className="material-symbols-outlined text-[32px] text-on-surface-variant">search_off</span>
            <h3 className="font-card-title text-[15px] font-bold text-on-surface">
              No salon matches "{searchInput.trim()}"
            </h3>
            <p className="text-[12px] text-on-surface-variant">
              Try a shorter word, like "hair", "spa" or your area name.
            </p>
            <button
              type="button"
              onClick={() => setSearchInput('')}
              className="mt-1 px-4 py-2 bg-primary text-white text-[12px] font-bold rounded-xl hover:bg-nexora-pink transition-colors"
            >
              Show all salons
            </button>
          </div>
        )}

        {nearbySalons.map((salon) => {
          const isSaved = savedSalonIds.includes(salon.id);
          return (
            <div
              key={salon.id}
              className="bg-white border border-outline-variant/50 rounded-2xl p-3 flex items-center gap-3 shadow-xs hover:shadow-md transition-shadow"
            >
              <img
                src={salon.image}
                alt={salon.name}
                loading="lazy"
                onClick={() => onOpenSalonDetails(salon)}
                className="w-[72px] h-[72px] rounded-xl object-cover shrink-0 cursor-pointer"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3
                    onClick={() => onOpenSalonDetails(salon)}
                    className="font-card-title text-[15px] font-bold text-on-surface hover:text-nexora-pink cursor-pointer transition-colors truncate"
                  >
                    {salon.name}
                  </h3>
                  <button
                    onClick={() => onToggleSaveSalon(salon.id)}
                    className="text-nexora-pink shrink-0 hover:scale-110 transition-transform"
                    aria-label={isSaved ? `Remove ${salon.name} from saved` : `Save ${salon.name}`}
                  >
                    <span className={`material-symbols-outlined text-[18px] ${isSaved ? 'fill-1' : ''}`}>
                      favorite
                    </span>
                  </button>
                </div>
                <div className="flex items-center gap-1.5 text-[12px] text-on-surface-variant flex-wrap">
                  <span className="flex items-center gap-0.5 font-bold text-warning-amber">
                    <span className="material-symbols-outlined text-[14px] fill-1">star</span>
                    {salon.rating}
                  </span>
                  <span>·</span>
                  <span className="truncate">{salon.location.area}</span>
                  <span>·</span>
                  <span className="font-semibold text-primary">{salon.distance}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[12px] font-bold text-on-surface">From ₹{minPrice(salon)}</span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      salon.isOpen ? 'bg-success-emerald text-white' : 'bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    {salon.isOpen ? 'Open now' : 'Closed'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => onBookSalon(salon)}
                className="px-3.5 py-2 bg-primary text-white text-[12px] font-bold rounded-xl hover:bg-nexora-pink transition-colors shadow-xs shrink-0"
              >
                Book
              </button>
            </div>
          );
        })}
      </section>
    </div>
  );
};
