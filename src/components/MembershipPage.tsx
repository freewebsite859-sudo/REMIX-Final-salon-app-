import React, { useEffect, useMemo, useState } from 'react';
import { UserProfile, Salon, Appointment, MembershipTier } from '../types';
import {
  MEMBERSHIP_TIERS,
  calculateTierProgress,
  getEligiblePartnerSalons,
  MembershipCardConfig,
  loadMembership,
  saveMembership,
  type MembershipRecord,
} from '../lib/membershipService';
import { isLiveCustomerDataEnabled } from '../lib/supabase';

interface MembershipPageProps {
  user: UserProfile;
  userId?: string | null;
  salons?: Salon[];
  appointments?: Appointment[];
  onUpdateUser?: (updated: UserProfile) => void;
  onBack?: () => void;
  onNavigateToBooking?: () => void;
  onOpenSalonDetails?: (salon: Salon) => void;
  onOpenRewards?: () => void;
}

export const MembershipPage: React.FC<MembershipPageProps> = ({
  user,
  userId,
  salons = [],
  appointments = [],
  onUpdateUser,
  onBack,
  onNavigateToBooking,
  onOpenSalonDetails,
  onOpenRewards,
}) => {
  const [liveMembership, setLiveMembership] = useState<MembershipRecord | null>(null);

  useEffect(() => {
    if (!isLiveCustomerDataEnabled || !userId) return;
    let active = true;
    void loadMembership(userId).then((record) => {
      if (active) setLiveMembership(record);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  const currentTier: MembershipTier = liveMembership?.tier || user.membershipTier || 'standard';
  const loyaltyPoints = Math.max(0, Number(liveMembership?.points ?? user.loyaltyPoints ?? 0));

  // Calculate lifetime spend from appointments — live memberships rows win
  // when they exist.
  const lifetimeSpend = useMemo(() => {
    if (liveMembership && Number.isFinite(liveMembership.spend)) {
      return liveMembership.spend;
    }
    return appointments
      .filter((a) => a.status === 'completed' || a.status === 'confirmed')
      .reduce((sum, a) => sum + (Number.isFinite(a.totalPrice) ? a.totalPrice : 0), 0);
  }, [appointments, liveMembership]);

  // Derived progress to next tier
  const tierProgress = useMemo(() => {
    return calculateTierProgress(loyaltyPoints, lifetimeSpend, currentTier);
  }, [loyaltyPoints, lifetimeSpend, currentTier]);

  // Area filter for eligible partner shops
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [selectedCardDetail, setSelectedCardDetail] = useState<MembershipCardConfig | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Switch tier (activation) — persisted to the live memberships table when a
  // real Supabase project is configured.
  const handleSelectTier = async (tier: MembershipTier) => {
    const expiresAt = '2027-09-07T00:00:00.000Z';
    if (isLiveCustomerDataEnabled && userId) {
      const { error } = await saveMembership(userId, {
        tier,
        points: loyaltyPoints,
        spend: lifetimeSpend,
        expiresAt,
      });
      if (error) {
        showToast(error);
        return;
      }
      const record = await loadMembership(userId);
      setLiveMembership(record);
    }
    if (onUpdateUser) {
      onUpdateUser({
        ...user,
        membershipTier: tier,
        membershipExpiresAt: expiresAt,
      });
    }
    showToast(`Switched membership level to ${tier.toUpperCase()}!`);
  };

  // Filtered partner shops
  const eligibleShops = useMemo(() => {
    return getEligiblePartnerSalons(salons, selectedArea);
  }, [salons, selectedArea]);

  // Unique areas for filter chips
  const areaChips = useMemo(() => {
    const areas = new Set<string>();
    salons.forEach((s) => {
      if (s.location.area) areas.add(s.location.area);
    });
    return ['all', ...Array.from(areas)];
  }, [salons]);

  return (
    <div
      id="membership-page"
      data-route="/customer/membership"
      className="flex flex-col w-full pb-28 max-w-4xl mx-auto px-page-margin pt-3 animate-in fade-in duration-200"
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                id="membership-back-btn"
                onClick={onBack}
                aria-label="Go back"
                className="w-9 h-9 rounded-full bg-surface-container text-on-surface flex items-center justify-center hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-hero-heading-mobile text-[22px] font-bold text-on-surface">
                  Nexora Membership
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                  /customer/membership
                </span>
              </div>
              <p className="text-[13px] text-on-surface-variant mt-0.5">
                Silver, Gold & Platinum tiers for exclusive partner discounts & perks
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 1. IMPORTANT MEMBERSHIP RULE BANNER                                       */}
      {/* ========================================================================= */}
      <section
        id="section-membership-rule"
        className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 sm:p-4 mb-4 text-on-surface"
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-900 flex items-center justify-center shrink-0 mt-0.5">
            <span className="material-symbols-outlined text-[22px]">verified</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
              <h2 className="font-card-title text-[14px] font-bold text-amber-950 flex items-center gap-1.5">
                <span>Exclusive Partner Shop Rule</span>
              </h2>
              <span className="text-[10px] font-extrabold uppercase tracking-wide bg-amber-600 text-white px-2 py-0.5 rounded-full">
                Important Rule
              </span>
            </div>
            <p className="text-[12px] text-amber-900/90 leading-relaxed font-medium">
              <strong>Membership benefits apply only at Nexora partner shops.</strong> Tier discounts (5%, 10%, 15%), priority reservations, reward multipliers, and VIP partner perks are exclusive to our network of verified partner salons.
            </p>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. CURRENT MEMBERSHIP LEVEL HERO                                          */}
      {/* ========================================================================= */}
      <section
        id="section-current-membership-level"
        className={`rounded-3xl p-5 text-white shadow-lg mb-4 relative overflow-hidden bg-gradient-to-br ${
          currentTier === 'platinum'
            ? 'from-purple-950 via-primary to-[#b00055]'
            : currentTier === 'gold'
              ? 'from-amber-800 via-amber-600 to-yellow-600'
              : currentTier === 'silver'
                ? 'from-slate-800 via-slate-700 to-slate-900'
                : 'from-primary via-[#b00055] to-primary-container'
        }`}
      >
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wider font-bold opacity-85">
                  Current Membership Level
                </span>
                <span className="px-2 py-0.5 bg-white/20 rounded-full text-[10px] font-extrabold uppercase">
                  Active Tier
                </span>
              </div>

              <h2
                id="current-membership-tier-name"
                className="text-[32px] font-extrabold leading-tight mt-1"
              >
                {tierProgress.currentTierName}
              </h2>

              <p className="text-[13px] opacity-90 mt-0.5 font-medium">
                {tierProgress.currentDiscountPercent > 0 ? (
                  <span className="font-bold underline decoration-white/50">
                    {tierProgress.currentDiscountPercent}% member discount
                  </span>
                ) : (
                  'Unlock Silver (5%), Gold (10%) or Platinum (15%)'
                )}{' '}
                applied at all Nexora partner salons
              </p>
            </div>

            <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[34px] fill-1">
                {currentTier === 'platinum'
                  ? 'diamond'
                  : currentTier === 'gold'
                    ? 'workspace_premium'
                    : currentTier === 'silver'
                      ? 'military_tech'
                      : 'card_membership'}
              </span>
            </div>
          </div>

          {/* Quick Stats Strip */}
          <div className="mt-4 pt-3 border-t border-white/20 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
            <div>
              <span className="opacity-75 block">Loyalty Points</span>
              <span className="font-extrabold text-[14px]">{loyaltyPoints.toLocaleString('en-IN')} pts</span>
            </div>
            <div>
              <span className="opacity-75 block">Partner Spend</span>
              <span className="font-extrabold text-[14px]">₹{lifetimeSpend.toLocaleString('en-IN')}</span>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <span className="opacity-75 block">Network Status</span>
              <span className="font-extrabold text-[14px] flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">verified</span>
                Partner Shop Active
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. PROGRESS TO NEXT LEVEL                                                 */}
      {/* ========================================================================= */}
      <section
        id="section-progress-to-next-level"
        className="bg-surface-container-low border border-outline-variant/50 rounded-2xl p-4 sm:p-5 shadow-xs mb-4"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">trending_up</span>
            </div>
            <div>
              <h3 className="font-card-title text-[15px] font-bold text-on-surface">
                Progress to Next Level
              </h3>
              <p className="text-[11px] text-on-surface-variant">
                {tierProgress.isMaxTier
                  ? 'You have unlocked the highest Platinum tier'
                  : `Earn points or spend at partner shops to reach ${tierProgress.nextTier?.name}`}
              </p>
            </div>
          </div>

          <span className="text-[13px] font-extrabold text-primary tabular-nums">
            {tierProgress.progressPercent}%
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-3 rounded-full bg-surface-container overflow-hidden my-3 border border-outline-variant/30">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-[#b00055] transition-all duration-500"
            style={{ width: `${tierProgress.progressPercent}%` }}
          />
        </div>

        {tierProgress.isMaxTier ? (
          <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-[12px] text-purple-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-purple-700">stars</span>
            <span className="font-semibold">
              Maximum Tier Achieved — You are enjoying the top 15% discount, 2x reward points, and VIP salon access!
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px] text-on-surface">
            <div className="p-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 flex items-center justify-between">
              <span className="text-on-surface-variant">Points Needed:</span>
              <span className="font-extrabold text-primary tabular-nums">
                {tierProgress.pointsNeeded.toLocaleString('en-IN')} pts to {tierProgress.nextTier?.name}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 flex items-center justify-between">
              <span className="text-on-surface-variant">Spend Needed:</span>
              <span className="font-extrabold text-on-surface tabular-nums">
                ₹{tierProgress.spendNeeded.toLocaleString('en-IN')} spend
              </span>
            </div>
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* 4. THREE MEMBERSHIP CARDS (SILVER, GOLD, PLATINUM)                        */}
      {/* ========================================================================= */}
      <section id="section-membership-cards" className="mb-6">
        <div className="mb-3">
          <h2 className="font-section-heading text-[17px] font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary">card_membership</span>
            <span>Membership Tiers</span>
          </h2>
          <p className="text-[12px] text-on-surface-variant">
            Choose your membership level or unlock automatically through partner salon visits
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {MEMBERSHIP_TIERS.map((tierCard) => {
            const isCurrent = currentTier === tierCard.tier;

            return (
              <div
                key={tierCard.tier}
                id={`membership-card-${tierCard.tier}`}
                data-membership-tier={tierCard.tier}
                className={`rounded-3xl border transition-all flex flex-col justify-between overflow-hidden shadow-xs relative ${
                  isCurrent
                    ? 'ring-2 ring-primary border-primary bg-surface-container-low'
                    : 'border-outline-variant/50 bg-surface-container-lowest hover:border-primary/40'
                }`}
              >
                {/* Card Header */}
                <div
                  className={`p-5 text-white bg-gradient-to-br ${tierCard.gradientClass} relative overflow-hidden`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20">
                        {tierCard.badgeLabel}
                      </span>
                      <h3 className="text-[22px] font-extrabold mt-1.5">{tierCard.name}</h3>
                      <p className="text-[11px] opacity-90 leading-tight mt-0.5">{tierCard.tagline}</p>
                    </div>

                    <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[24px]">
                        {tierCard.icon}
                      </span>
                    </div>
                  </div>

                  {/* Benefit Headline Badge */}
                  <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between">
                    <span className="text-[18px] font-extrabold tracking-tight">
                      {tierCard.benefitHeadline}
                    </span>
                    <span className="text-[11px] font-semibold opacity-90">
                      {tierCard.rewardsMultiplier}
                    </span>
                  </div>
                </div>

                {/* Bullets & Benefits */}
                <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                  <div>
                    <h4 className="text-[12px] font-bold uppercase tracking-wider text-on-surface-variant mb-2.5">
                      Included Benefits:
                    </h4>
                    <ul className="space-y-2">
                      {tierCard.bullets.map((bullet, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-[12px] text-on-surface">
                          <span className="material-symbols-outlined text-[16px] text-success-emerald shrink-0 mt-0.5">
                            check_circle
                          </span>
                          <span className="font-medium">{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Unlock criteria */}
                  <div className="p-3 bg-surface-container rounded-xl border border-outline-variant/30 text-[11px]">
                    <span className="text-on-surface-variant block font-semibold mb-0.5">
                      How to Unlock:
                    </span>
                    <span className="text-on-surface font-medium">
                      {tierCard.unlockDescription}
                    </span>
                  </div>

                  {/* Tier Action Button */}
                  <button
                    type="button"
                    id={`select-tier-btn-${tierCard.tier}`}
                    onClick={() => handleSelectTier(tierCard.tier)}
                    className={`w-full py-2.5 px-4 rounded-xl text-[12px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
                      isCurrent
                        ? 'bg-primary text-white hover:bg-nexora-pink'
                        : 'bg-surface-container-highest hover:bg-surface-container text-on-surface border border-outline-variant/50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {isCurrent ? 'verified' : 'arrow_forward'}
                    </span>
                    <span>{isCurrent ? 'Current Active Tier' : `Select ${tierCard.name}`}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. BENEFITS COMPARISON TABLE                                              */}
      {/* ========================================================================= */}
      <section
        id="section-benefits-comparison"
        className="bg-surface-container-low border border-outline-variant/50 rounded-2xl p-4 sm:p-5 shadow-xs mb-4"
      >
        <div className="mb-3">
          <h3 className="font-card-title text-[16px] font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary">compare</span>
            <span>Benefits Comparison</span>
          </h3>
          <p className="text-[11px] text-on-surface-variant">
            Full side-by-side tier comparison across partner shop privileges
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px] border-collapse min-w-[500px]">
            <thead>
              <tr className="border-b border-outline-variant/40 text-on-surface-variant">
                <th className="py-2.5 px-3 font-bold">Feature</th>
                <th className="py-2.5 px-2 font-bold text-center">Silver</th>
                <th className="py-2.5 px-2 font-bold text-center text-amber-800">Gold</th>
                <th className="py-2.5 px-2 font-bold text-center text-purple-800">Platinum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              <tr>
                <td className="py-2.5 px-3 font-semibold text-on-surface">Partner Service Discount</td>
                <td className="py-2.5 px-2 text-center font-bold text-slate-800">5%</td>
                <td className="py-2.5 px-2 text-center font-bold text-amber-800">10%</td>
                <td className="py-2.5 px-2 text-center font-bold text-purple-800">15%</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-on-surface">QR Reward Multiplier</td>
                <td className="py-2.5 px-2 text-center text-on-surface-variant">1x Basic</td>
                <td className="py-2.5 px-2 text-center font-semibold text-amber-800">1.5x Extra</td>
                <td className="py-2.5 px-2 text-center font-bold text-purple-800">2x Double</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-on-surface">Priority Booking Queue</td>
                <td className="py-2.5 px-2 text-center text-on-surface-variant">—</td>
                <td className="py-2.5 px-2 text-center font-bold text-emerald-700">✓ Included</td>
                <td className="py-2.5 px-2 text-center font-bold text-emerald-700">✓ VIP Express</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-on-surface">Referral Points Bonus</td>
                <td className="py-2.5 px-2 text-center text-on-surface-variant">150 pts</td>
                <td className="py-2.5 px-2 text-center font-semibold text-amber-800">200 pts</td>
                <td className="py-2.5 px-2 text-center font-bold text-purple-800">300 pts</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-on-surface">VIP Support</td>
                <td className="py-2.5 px-2 text-center text-on-surface-variant">Standard</td>
                <td className="py-2.5 px-2 text-center text-on-surface-variant">Priority Queue</td>
                <td className="py-2.5 px-2 text-center font-bold text-purple-800">24/7 Concierge</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-on-surface">Partner Shop Network</td>
                <td className="py-2.5 px-2 text-center font-bold text-emerald-700">✓ All Jaipur</td>
                <td className="py-2.5 px-2 text-center font-bold text-emerald-700">✓ All Jaipur</td>
                <td className="py-2.5 px-2 text-center font-bold text-emerald-700">✓ All Jaipur</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. HOW TO UNLOCK SECTION                                                  */}
      {/* ========================================================================= */}
      <section
        id="section-how-to-unlock"
        className="bg-surface-container-low border border-outline-variant/50 rounded-2xl p-4 sm:p-5 shadow-xs mb-4"
      >
        <div className="mb-3">
          <h3 className="font-card-title text-[16px] font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary">lock_open</span>
            <span>How to Unlock Higher Tiers</span>
          </h3>
          <p className="text-[11px] text-on-surface-variant">
            Tier progression is 100% automatic based on your partner salon visits
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 bg-surface-container-lowest rounded-xl border border-outline-variant/30 flex flex-col gap-1.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-extrabold text-[13px]">
              1
            </div>
            <h4 className="font-bold text-[13px] text-on-surface">Book & Visit</h4>
            <p className="text-[11px] text-on-surface-variant">
              Book hair, skin or spa treatments at any partner salon across Jaipur.
            </p>
          </div>

          <div className="p-3.5 bg-surface-container-lowest rounded-xl border border-outline-variant/30 flex flex-col gap-1.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-extrabold text-[13px]">
              2
            </div>
            <h4 className="font-bold text-[13px] text-on-surface">Pay via Nexora QR</h4>
            <p className="text-[11px] text-on-surface-variant">
              Complete payments of ₹100+ via partner salon QR to earn loyalty points and spend credit.
            </p>
          </div>

          <div className="p-3.5 bg-surface-container-lowest rounded-xl border border-outline-variant/30 flex flex-col gap-1.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-extrabold text-[13px]">
              3
            </div>
            <h4 className="font-bold text-[13px] text-on-surface">Instant Upgrade</h4>
            <p className="text-[11px] text-on-surface-variant">
              Your account unlocks Silver, Gold or Platinum benefits immediately upon hitting milestone targets.
            </p>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 7. ELIGIBLE PARTNER SHOPS                                                 */}
      {/* ========================================================================= */}
      <section
        id="section-eligible-shops"
        className="bg-surface-container-low border border-outline-variant/50 rounded-2xl p-4 sm:p-5 shadow-xs mb-4"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3 pb-3 border-b border-outline-variant/30">
          <div>
            <h3 className="font-card-title text-[16px] font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-primary">storefront</span>
              <span>Eligible Partner Shops</span>
            </h3>
            <p className="text-[11px] text-on-surface-variant">
              Your membership discount and perks apply at these verified Jaipur partner salons
            </p>
          </div>

          {/* Area Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto no-scrollbar pb-1 sm:pb-0">
            {areaChips.map((area) => (
              <button
                key={area}
                type="button"
                onClick={() => setSelectedArea(area)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                  selectedArea === area
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant/40 hover:bg-surface-container'
                }`}
              >
                {area === 'all' ? 'All Areas' : area}
              </button>
            ))}
          </div>
        </div>

        {/* Salons Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {eligibleShops.slice(0, 6).map((salon) => (
            <div
              key={salon.id}
              id={`eligible-shop-${salon.id}`}
              className="p-3 bg-surface-container-lowest rounded-2xl border border-outline-variant/40 flex items-center justify-between gap-3 hover:border-primary/40 transition-all shadow-2xs"
            >
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={salon.image}
                  alt={salon.name}
                  className="w-12 h-12 rounded-xl object-cover ring-1 ring-outline-variant/30 shrink-0"
                />
                <div className="min-w-0">
                  <h4 className="font-bold text-[13px] text-on-surface truncate">{salon.name}</h4>
                  <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant mt-0.5">
                    <span className="text-amber-700 font-bold flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-[13px] fill-1">star</span>
                      {salon.rating}
                    </span>
                    <span>•</span>
                    <span className="truncate">{salon.location.area}</span>
                  </div>
                  <span className="inline-block mt-1 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.2 rounded">
                    {tierProgress.currentDiscountPercent > 0
                      ? `${tierProgress.currentDiscountPercent}% Member Discount Active`
                      : '5% - 15% Member Discount Eligible'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onOpenSalonDetails ? onOpenSalonDetails(salon) : onNavigateToBooking?.()}
                className="px-3 py-1.5 bg-primary text-white text-[11px] font-bold rounded-xl hover:bg-nexora-pink transition-colors shrink-0 cursor-pointer shadow-xs"
              >
                Book
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 8. ACTIONS FOOTER                                                         */}
      {/* ========================================================================= */}
      <section className="flex flex-col sm:flex-row gap-2.5">
        <button
          type="button"
          id="membership-book-btn"
          onClick={() => onNavigateToBooking?.()}
          className="flex-1 py-3 px-4 bg-primary text-white text-[13px] font-bold rounded-xl hover:bg-nexora-pink transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">event</span>
          <span>Book at Partner Shop</span>
        </button>

        <button
          type="button"
          id="membership-rewards-btn"
          onClick={() => onOpenRewards?.()}
          className="flex-1 py-3 px-4 bg-surface-container-lowest border border-outline-variant/50 text-on-surface text-[13px] font-bold rounded-xl hover:border-primary/40 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px] text-primary">stars</span>
          <span>View Rewards Wallet</span>
        </button>
      </section>
    </div>
  );
};
