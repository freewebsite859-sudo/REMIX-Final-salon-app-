import React, { useState } from 'react';
import { Salon, SalonService, Stylist, SavedServiceRef } from '../types';

interface SavedTabProps {
  salons: Salon[];
  savedSalonIds: string[];
  savedServices?: SavedServiceRef[];
  onOpenSalonDetails: (salon: Salon) => void;
  onBookSalon: (salon: Salon, service?: SalonService, stylist?: Stylist) => void;
  onToggleSaveSalon: (salonId: string) => void;
  onToggleSaveService?: (salonId: string, serviceId: string) => void;
}

export const SavedTab: React.FC<SavedTabProps> = ({
  salons,
  savedSalonIds,
  savedServices = [],
  onOpenSalonDetails,
  onBookSalon,
  onToggleSaveSalon,
  onToggleSaveService,
}) => {
  const [activeTab, setActiveTab] = useState<'salons' | 'services'>('salons');

  const savedSalons = salons.filter((s) => savedSalonIds.includes(s.id));

  const savedServiceItems = savedServices
    .map((ref) => {
      const salon = salons.find((s) => s.id === ref.salonId);
      const service = salon?.services.find((srv) => srv.id === ref.serviceId);
      if (!salon || !service) return null;
      return { ...service, salon };
    })
    .filter((item): item is SalonService & { salon: Salon } => item !== null);

  return (
    <div className="flex flex-col w-full pb-28 max-w-4xl mx-auto px-page-margin pt-3">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-hero-heading-mobile text-[22px] font-bold text-on-surface">
            Saved & Favorites
          </h1>
          <p className="text-[13px] text-on-surface-variant">Quick access to your preferred salons & treatments</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-surface-container-low p-1 rounded-xl border border-outline-variant/40 mb-5">
        <button
          onClick={() => setActiveTab('salons')}
          className={`flex-1 py-2 rounded-lg text-[13px] font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'salons'
              ? 'bg-white text-primary shadow-xs'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">store</span>
          <span>Saved Salons ({savedSalons.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('services')}
          className={`flex-1 py-2 rounded-lg text-[13px] font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'services'
              ? 'bg-white text-primary shadow-xs'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">spa</span>
          <span>Saved Services ({savedServiceItems.length})</span>
        </button>
      </div>

      {activeTab === 'salons' ? (
        savedSalons.length === 0 ? (
          <div className="py-12 text-center bg-surface-container-low rounded-2xl border border-outline-variant/40 p-6">
            <span className="material-symbols-outlined text-[32px] text-nexora-pink mb-2">favorite</span>
            <h3 className="font-bold text-[16px] text-on-surface mb-1">No saved salons yet</h3>
            <p className="text-[13px] text-on-surface-variant max-w-xs mx-auto">
              Tap the heart icon on any salon to save it here for fast rebooking.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {savedSalons.map((salon) => (
              <div
                key={salon.id}
                className="bg-surface-container-low border border-outline-variant rounded-2xl p-4 shadow-xs flex flex-col justify-between"
              >
                <div className="flex items-start gap-3 mb-3">
                  <img
                    src={salon.image}
                    alt={salon.name}
                    className="w-16 h-16 rounded-xl object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-[15px] text-on-surface truncate">{salon.name}</h3>
                    <p className="text-[12px] text-on-surface-variant">{salon.location.area} · {salon.distance}</p>
                    <div className="flex items-center gap-1 mt-1 text-[12px]">
                      <span className="material-symbols-outlined text-warning-amber text-[14px] fill-1">star</span>
                      <span className="font-bold">{salon.rating}</span>
                      <span className="text-on-surface-variant">({salon.reviewCount})</span>
                    </div>
                  </div>
                  <button
                    onClick={() => onToggleSaveSalon(salon.id)}
                    className="text-nexora-pink"
                  >
                    <span className="material-symbols-outlined text-[20px] fill-1">favorite</span>
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => onOpenSalonDetails(salon)}
                    className="flex-1 py-2 bg-surface-container text-on-surface text-[12px] font-semibold rounded-xl"
                  >
                    Details
                  </button>
                  <button
                    onClick={() => onBookSalon(salon)}
                    className="flex-1 py-2 bg-primary text-white text-[12px] font-semibold rounded-xl hover:bg-nexora-pink transition-colors shadow-xs"
                  >
                    Book Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        savedServiceItems.length === 0 ? (
          <div className="py-12 text-center bg-surface-container-low rounded-2xl border border-outline-variant/40 p-6">
            <span className="material-symbols-outlined text-[32px] text-nexora-pink mb-2">bookmark</span>
            <h3 className="font-bold text-[16px] text-on-surface mb-1">No saved services yet</h3>
            <p className="text-[13px] text-on-surface-variant max-w-xs mx-auto">
              Bookmark a treatment from any salon menu to rebook it from here.
            </p>
          </div>
        ) : (
        <div className="flex flex-col gap-3">
          {savedServiceItems.map((srv) => (
            <div
              key={`${srv.salon.id}-${srv.id}`}
              className="bg-surface-container-low border border-outline-variant rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-xs"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <h4 className="font-bold text-[14px] text-on-surface">{srv.name}</h4>
                  <span className="text-[10px] text-on-surface-variant bg-surface-container px-1.5 py-0.2 rounded font-medium">
                    {srv.salon.name}
                  </span>
                </div>
                <p className="text-[11px] text-on-surface-variant line-clamp-1">{srv.description}</p>
                <span className="text-[11px] text-primary font-bold mt-1 inline-block">
                  ₹{srv.discountPrice || srv.price} · {srv.duration} mins
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {onToggleSaveService && (
                  <button
                    type="button"
                    onClick={() => onToggleSaveService(srv.salon.id, srv.id)}
                    className="w-9 h-9 rounded-xl bg-surface-container text-nexora-pink flex items-center justify-center hover:bg-surface-container-high transition-colors"
                    title="Remove saved service"
                  >
                    <span className="material-symbols-outlined text-[18px] fill-1">bookmark</span>
                  </button>
                )}
                <button
                  onClick={() => onBookSalon(srv.salon, srv)}
                  className="px-3.5 py-2 bg-primary text-white text-[12px] font-bold rounded-xl hover:bg-nexora-pink transition-colors shadow-xs"
                >
                  Book
                </button>
              </div>
            </div>
          ))}
        </div>
        )
      )}
    </div>
  );
};
