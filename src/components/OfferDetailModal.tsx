import React from 'react';
import { Salon } from '../types';

export interface OfferPackageDetail {
  id: string;
  badge: string;
  badgeColor: 'pink' | 'purple' | 'amber';
  title: string;
  subtitle: string;
  image: string;
  originalPrice: number;
  offerPrice: number;
  discountPercentage: number;
  duration: string;
  targetCategory?: string;
  targetSalonIndex?: number;
  rating: number;
  reviewCount: number;
  overview: string;
  includedServices: {
    title: string;
    description: string;
    icon: string;
  }[];
  perks: string[];
  terms: string[];
}

interface OfferDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  offer: OfferPackageDetail | null;
  salons: Salon[];
  onBookOffer: (offer: OfferPackageDetail) => void;
}

export const OfferDetailModal: React.FC<OfferDetailModalProps> = ({
  isOpen,
  onClose,
  offer,
  onBookOffer,
}) => {
  if (!isOpen || !offer) return null;

  const savings = offer.originalPrice - offer.offerPrice;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[90vh] bg-surface-white rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-black/10 animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Visual Banner */}
        <div className="relative h-44 sm:h-52 w-full shrink-0 overflow-hidden bg-black">
          <img
            src={offer.image}
            alt={offer.title}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20" />

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 text-white/90 hover:text-white hover:bg-black/75 border border-white/20 flex items-center justify-center backdrop-blur-md transition-all active:scale-90 cursor-pointer z-10"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>

          {/* Top Badge */}
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <span 
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md text-white shadow-xs ${
                offer.badgeColor === 'pink'
                  ? 'bg-nexora-pink/90'
                  : offer.badgeColor === 'amber'
                  ? 'bg-amber-500/90 text-slate-950 font-black'
                  : 'bg-indigo-600/90'
              }`}
            >
              {offer.badge}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-black/50 text-white/90 border border-white/20 backdrop-blur-md flex items-center gap-1">
              <span className="material-symbols-outlined text-[12px] text-amber-300">star</span>
              {offer.rating} ({offer.reviewCount})
            </span>
          </div>

          {/* Bottom Title & Duration inside Image */}
          <div className="absolute bottom-3 left-4 right-4 text-white">
            <div className="flex items-center gap-2 text-[11px] text-white/80 font-medium mb-1">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] text-nexora-pink">schedule</span>
                {offer.duration}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-emerald-300 font-semibold">
                <span className="material-symbols-outlined text-[14px]">verified</span>
                Verified Partner Suite
              </span>
            </div>
            <h2 className="font-title text-base sm:text-xl font-bold leading-snug drop-shadow-sm">
              {offer.title}
            </h2>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 sm:p-5 space-y-4">
          
          {/* Price & Savings Highlight Bar */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface-off-white border border-[rgba(176,0,85,0.12)]">
            <div>
              <p className="text-[11px] text-on-surface-variant font-medium">Special Package Price</p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-xl sm:text-2xl font-black text-[#b00055]">
                  ₹{offer.offerPrice.toLocaleString('en-IN')}
                </span>
                <span className="text-xs text-on-surface-variant/70 line-through">
                  ₹{offer.originalPrice.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="material-symbols-outlined text-[14px]">savings</span>
                Save ₹{savings.toLocaleString('en-IN')} ({offer.discountPercentage}% OFF)
              </span>
            </div>
          </div>

          {/* Overview text */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-nexora-pink">info</span>
              Package Overview
            </h3>
            <p className="text-xs sm:text-sm text-on-surface leading-relaxed">
              {offer.overview}
            </p>
          </div>

          {/* Included Services Checklist */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-nexora-pink">checklist</span>
              What's Included ({offer.includedServices.length} Steps & Services)
            </h3>
            <div className="space-y-2">
              {offer.includedServices.map((svc, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-2.5 rounded-xl bg-surface-off-white/80 border border-black/5 hover:border-nexora-pink/20 transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg bg-nexora-pink/10 text-nexora-pink flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-[16px]">{svc.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs sm:text-sm font-semibold text-on-surface">
                      {svc.title}
                    </h4>
                    <p className="text-[11px] text-on-surface-variant leading-tight mt-0.5">
                      {svc.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Luxury Perks */}
          {offer.perks && offer.perks.length > 0 && (
            <div className="p-3 rounded-xl bg-pink-50/50 border border-pink-100">
              <h4 className="text-xs font-bold text-[#b00055] mb-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">diamond</span>
                Exclusive Nexora Member Perks
              </h4>
              <ul className="space-y-1.5">
                {offer.perks.map((perk, pIdx) => (
                  <li key={pIdx} className="flex items-center gap-2 text-[11px] text-on-surface">
                    <span className="material-symbols-outlined text-[14px] text-emerald-600">check_circle</span>
                    <span>{perk}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Terms & Conditions */}
          {offer.terms && offer.terms.length > 0 && (
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">policy</span>
                Important Terms
              </h3>
              <ul className="list-disc list-inside space-y-0.5 text-[10px] text-on-surface-variant">
                {offer.terms.map((t, tIdx) => (
                  <li key={tIdx}>{t}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="p-3.5 sm:p-4 bg-surface-white border-t border-black/8 flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-3 rounded-xl border border-black/15 text-on-surface font-semibold text-xs hover:bg-black/5 active:scale-95 transition-all cursor-pointer text-center"
          >
            Close Details
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onBookOffer(offer);
            }}
            className="flex-[2] py-2.5 px-4 rounded-xl bg-[#b00055] text-white font-bold text-xs sm:text-sm hover:bg-[#960048] shadow-md hover:shadow-lg active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Claim & Book Now</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  );
};
