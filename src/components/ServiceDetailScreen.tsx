import React, { useMemo } from 'react';
import type { Salon, SalonService, Stylist } from '../types';
import { formatServiceINR } from './ServicesScreen';

export interface ServiceDetailScreenProps {
  /** The service being viewed. */
  service: SalonService;
  /** The salon this service belongs to. */
  salon: Salon;
  /** Other salons offering a same-named treatment, for comparison. */
  alternatives?: { salon: Salon; service: SalonService }[];
  savedServiceIds?: string[];
  onToggleSaveService?: (salonId: string, service: SalonService) => void;
  onBook: (salon: Salon, service: SalonService, stylist?: Stylist | null) => void;
  onOpenSalon?: (salon: Salon) => void;
  onOpenAlternative?: (salon: Salon, service: SalonService) => void;
  onBack?: () => void;
}

/** Advance deposit percentage surfaced on the booking summary. */
const ADVANCE_PERCENT = 25;

function durationOf(service: SalonService): number {
  const minutes = service.duration ?? service.durationMinutes;
  return typeof minutes === 'number' && minutes > 0 ? Math.round(minutes) : 0;
}

function priceOf(service: SalonService): number {
  return service.discountPrice && service.discountPrice < service.price
    ? service.discountPrice
    : service.price;
}

/** Stylist photos arrive under either `avatar` or `avatarUrl` depending on source. */
function stylistAvatar(stylist: Stylist): string {
  return stylist.avatarUrl || stylist.avatar || '';
}

/** Role, then the first listed specialty — whichever is present. */
function stylistSubtitle(stylist: Stylist): string {
  return (
    stylist.role ||
    stylist.specialties?.[0] ||
    stylist.specialty?.[0] ||
    ''
  );
}

/**
 * Service Detail Screen (B8).
 *
 * A single treatment's full page: what it includes, how long it takes, what it
 * costs, who can perform it, and where else it is offered — with the Book CTA
 * that enters the appointment flow on this exact service.
 */
export const ServiceDetailScreen: React.FC<ServiceDetailScreenProps> = ({
  service,
  salon,
  alternatives = [],
  savedServiceIds = [],
  onToggleSaveService,
  onBook,
  onOpenSalon,
  onOpenAlternative,
  onBack,
}) => {
  const price = priceOf(service);
  const listPrice = service.discountPrice && service.discountPrice < service.price ? service.price : null;
  const minutes = durationOf(service);
  const advance = Math.round((price * ADVANCE_PERCENT) / 100);
  const isSaved = savedServiceIds.includes(service.id);

  // Stylists whose listed skills cover this treatment; fall back to the full
  // roster so the section is never pointlessly empty.
  const capableStylists = useMemo(() => {
    const roster = salon.stylists || [];
    const q = service.name.toLowerCase();
    const matched = roster.filter((stylist) => {
      const skills = [
        ...(stylist.specialties || []),
        ...(stylist.specialty || []),
        ...(stylist.assignedServices || []),
      ]
        .map((s) => String(s).toLowerCase())
        .join(' ');
      return Boolean(skills) && (skills.includes(q) || q.includes(skills));
    });
    return matched.length > 0 ? matched : roster;
  }, [salon.stylists, service.name]);

  return (
    <div data-testid="service-detail-screen" className="flex flex-col gap-4 px-4 pt-4 pb-32 max-w-3xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-start gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="mt-0.5 w-9 h-9 shrink-0 rounded-full flex items-center justify-center bg-surface-container hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-nexora-pink">
            {service.category || 'Treatment'}
          </p>
          <h1 className="font-card-title text-[20px] text-on-surface leading-tight">{service.name}</h1>
        </div>
        {onToggleSaveService && (
          <button
            type="button"
            onClick={() => onToggleSaveService(salon.id, service)}
            aria-label={isSaved ? 'Remove from favourites' : 'Save to favourites'}
            aria-pressed={isSaved}
            className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center transition-colors ${
              isSaved ? 'text-nexora-pink bg-nexora-pink/10' : 'text-on-surface-variant bg-surface-container'
            }`}
          >
            <span
              className="material-symbols-outlined text-[20px]"
              style={isSaved ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              favorite
            </span>
          </button>
        )}
      </div>

      {/* Price / duration summary */}
      <div className="rounded-2xl border border-outline-variant/50 bg-surface-container-low p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-baseline gap-2">
          <span className="text-[24px] font-extrabold text-primary">{formatServiceINR(price)}</span>
          {listPrice !== null && (
            <span className="text-[13px] text-on-surface-variant line-through">
              {formatServiceINR(listPrice)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-[12px] text-on-surface-variant">
          {minutes > 0 && (
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px]">schedule</span>
              {minutes} mins
            </span>
          )}
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[15px]">payments</span>
            {formatServiceINR(advance)} advance
          </span>
        </div>
      </div>

      {/* Description */}
      {service.description ? (
        <section className="flex flex-col gap-1.5">
          <h2 className="font-section-heading text-[14px] text-on-surface">About this treatment</h2>
          <p className="text-[12px] leading-relaxed text-on-surface-variant">{service.description}</p>
        </section>
      ) : null}

      {/* Offering salon */}
      <section className="flex flex-col gap-2">
        <h2 className="font-section-heading text-[14px] text-on-surface">Offered at</h2>
        <button
          type="button"
          onClick={() => onOpenSalon?.(salon)}
          className="rounded-2xl border border-outline-variant/50 bg-surface p-3 flex items-center gap-3 text-left hover:border-nexora-pink/60 transition-colors"
        >
          {salon.image ? (
            <img
              src={salon.image}
              alt=""
              className="w-12 h-12 rounded-xl object-cover shrink-0"
              loading="lazy"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-surface-container shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-card-title text-[14px] text-on-surface truncate">{salon.name}</p>
            <p className="text-[11px] text-on-surface-variant truncate">
              {salon.location?.area || salon.location?.city}
              {salon.distance ? ` · ${salon.distance}` : ''}
            </p>
            <p className="text-[11px] text-on-surface-variant flex items-center gap-1 mt-0.5">
              <span className="material-symbols-outlined text-[13px] text-warning-amber">star</span>
              {salon.rating?.toFixed?.(1) ?? salon.rating} ({salon.reviewCount} reviews)
              {salon.isOpen ? (
                <span className="ml-1 text-success-emerald font-semibold">Open now</span>
              ) : (
                <span className="ml-1 font-semibold">Closed</span>
              )}
            </p>
          </div>
          <span className="material-symbols-outlined text-[18px] text-on-surface-variant shrink-0">
            chevron_right
          </span>
        </button>
      </section>

      {/* Stylists */}
      {capableStylists.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-section-heading text-[14px] text-on-surface">
            Available professionals
            <span className="ml-1 text-[11px] font-normal text-on-surface-variant">
              ({capableStylists.length})
            </span>
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {capableStylists.map((stylist) => (
              <button
                key={stylist.id}
                type="button"
                onClick={() => onBook(salon, service, stylist)}
                className="shrink-0 w-[124px] rounded-2xl border border-outline-variant/50 bg-surface p-2.5 text-left hover:border-nexora-pink/60 transition-colors"
              >
                {stylistAvatar(stylist) ? (
                  <img
                    src={stylistAvatar(stylist)}
                    alt=""
                    className="w-full h-16 rounded-lg object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-16 rounded-lg bg-surface-container flex items-center justify-center">
                    <span className="material-symbols-outlined text-[22px] text-on-surface-variant">
                      person
                    </span>
                  </div>
                )}
                <p className="mt-1.5 text-[12px] font-semibold text-on-surface truncate">{stylist.name}</p>
                {stylistSubtitle(stylist) ? (
                  <p className="text-[10px] text-on-surface-variant truncate">
                    {stylistSubtitle(stylist)}
                  </p>
                ) : null}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Alternatives at other salons */}
      {alternatives.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-section-heading text-[14px] text-on-surface">
            Compare at other salons
            <span className="ml-1 text-[11px] font-normal text-on-surface-variant">
              ({alternatives.length})
            </span>
          </h2>
          <div className="flex flex-col gap-2">
            {alternatives.map(({ salon: altSalon, service: altService }) => (
              <button
                key={`${altSalon.id}:${altService.id}`}
                type="button"
                onClick={() => onOpenAlternative?.(altSalon, altService)}
                className="rounded-xl border border-outline-variant/50 bg-surface p-3 flex items-center justify-between gap-3 text-left hover:border-nexora-pink/60 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-on-surface truncate">{altSalon.name}</p>
                  <p className="text-[11px] text-on-surface-variant truncate">
                    {altSalon.location?.area || altSalon.location?.city}
                    {durationOf(altService) > 0 ? ` · ${durationOf(altService)} mins` : ''}
                  </p>
                </div>
                <span className="text-[13px] font-extrabold text-primary shrink-0">
                  {formatServiceINR(priceOf(altService))}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Sticky Book CTA */}
      <div className="fixed bottom-0 inset-x-0 z-30 border-t border-outline-variant/40 bg-surface/95 backdrop-blur-md px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-on-surface-variant">Total</p>
            <p className="text-[17px] font-extrabold text-primary">{formatServiceINR(price)}</p>
          </div>
          <button
            type="button"
            onClick={() => onBook(salon, service, null)}
            className="px-6 py-3 rounded-xl bg-primary text-on-primary font-button-text font-bold hover:bg-nexora-pink transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">calendar_month</span>
            Book Appointment
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServiceDetailScreen;
