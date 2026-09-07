import React, { useMemo } from 'react';
import { UserProfile, Appointment } from '../types';

interface RewardsTabProps {
  user: UserProfile;
  appointments?: Appointment[];
  onOpenMembership?: () => void;
  onOpenReferral?: () => void;
  onNavigateToBooking?: () => void;
}

/**
 * Customer Rewards screen — loyalty points, membership tier and simple
 * unlock progress. Driven by real profile/appointment data only; never
 * invents balances the backend does not hold.
 */
export const RewardsTab: React.FC<RewardsTabProps> = ({
  user,
  appointments = [],
  onOpenMembership,
  onOpenReferral,
  onNavigateToBooking,
}) => {
  const points = Math.max(0, Number(user.loyaltyPoints) || 0);
  const tier = user.membershipTier || 'standard';

  const completedVisits = useMemo(
    () => appointments.filter((a) => a.status === 'completed').length,
    [appointments]
  );

  const lifetimeSpend = useMemo(
    () =>
      appointments
        .filter((a) => a.status === 'completed' || a.status === 'confirmed')
        .reduce((sum, a) => sum + (Number.isFinite(a.totalPrice) ? a.totalPrice : 0), 0),
    [appointments]
  );

  const nextTier =
    tier === 'standard'
      ? { name: 'Silver', pointsNeeded: Math.max(0, 500 - points) }
      : tier === 'silver'
        ? { name: 'Gold', pointsNeeded: Math.max(0, 1500 - points) }
        : tier === 'gold'
          ? { name: 'Platinum', pointsNeeded: Math.max(0, 4000 - points) }
          : null;

  const progressPct = nextTier
    ? Math.min(
        100,
        Math.round(
          (points /
            (tier === 'standard' ? 500 : tier === 'silver' ? 1500 : 4000)) *
            100
        )
      )
    : 100;

  const tierLabel =
    tier === 'platinum'
      ? 'Platinum'
      : tier === 'gold'
        ? 'Gold'
        : tier === 'silver'
          ? 'Silver'
          : 'Standard';

  const perks = [
    {
      id: 'points',
      icon: 'stars',
      title: 'Loyalty points',
      body: points > 0
        ? `You have ${points.toLocaleString('en-IN')} points ready to redeem.`
        : 'Earn points on every completed visit.',
    },
    {
      id: 'visits',
      icon: 'event_available',
      title: 'Completed visits',
      body:
        completedVisits > 0
          ? `${completedVisits} visit${completedVisits === 1 ? '' : 's'} on your account.`
          : 'Book your first salon visit to start earning.',
    },
    {
      id: 'spend',
      icon: 'payments',
      title: 'Lifetime spend',
      body:
        lifetimeSpend > 0
          ? `₹${lifetimeSpend.toLocaleString('en-IN')} across your bookings.`
          : 'Your spend history will appear here after visits.',
    },
  ];

  return (
    <div className="flex flex-col w-full pb-28 max-w-4xl mx-auto px-page-margin pt-3">
      <header className="mb-4">
        <h1 className="font-hero-heading-mobile text-[22px] font-bold text-on-surface">
          Rewards
        </h1>
        <p className="text-[13px] text-on-surface-variant">
          Loyalty points, membership and referral perks
        </p>
      </header>

      {/* Points hero */}
      <section className="bg-gradient-to-br from-primary via-[#b00055] to-primary-container rounded-3xl p-5 text-white shadow-lg mb-4 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wider font-bold opacity-85">
                Available balance
              </p>
              <p className="text-[36px] font-extrabold leading-none mt-1 tabular-nums">
                {points.toLocaleString('en-IN')}
              </p>
              <p className="text-[12px] opacity-90 mt-1">loyalty points</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center">
              <span className="material-symbols-outlined text-[32px] fill-1">stars</span>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-1 rounded-full bg-white/15 text-[11px] font-bold uppercase tracking-wide">
              {tierLabel} member
            </span>
            {user.membershipExpiresAt && (
              <span className="text-[11px] opacity-85">
                Renews {new Date(user.membershipExpiresAt).toLocaleDateString('en-IN', {
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            )}
          </div>

          {nextTier && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-[11px] mb-1.5 opacity-90">
                <span>
                  {nextTier.pointsNeeded > 0
                    ? `${nextTier.pointsNeeded.toLocaleString('en-IN')} pts to ${nextTier.name}`
                    : `Ready for ${nextTier.name}`}
                </span>
                <span>{progressPct}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/20 overflow-hidden">
                <div
                  className="h-full rounded-full bg-white transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Snapshot cards */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {perks.map((perk) => (
          <div
            key={perk.id}
            className="bg-surface-container-low border border-outline-variant/50 rounded-2xl p-4 shadow-xs"
          >
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-2">
              <span className="material-symbols-outlined text-[20px]">{perk.icon}</span>
            </div>
            <h3 className="font-card-title text-[14px] font-bold text-on-surface">{perk.title}</h3>
            <p className="text-[12px] text-on-surface-variant mt-0.5 leading-snug">{perk.body}</p>
          </div>
        ))}
      </section>

      {/* How to earn */}
      <section className="bg-surface-container-low border border-outline-variant/50 rounded-2xl p-4 sm:p-5 shadow-xs mb-4">
        <h2 className="font-section-heading text-[16px] font-bold text-on-surface mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-nexora-pink">redeem</span>
          How to earn
        </h2>
        <ul className="flex flex-col gap-2.5">
          <li className="flex items-start gap-3 p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/30">
            <span className="material-symbols-outlined text-[20px] text-primary mt-0.5">content_cut</span>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-on-surface">Complete a booking</p>
              <p className="text-[11px] text-on-surface-variant">
                Points credit after the salon marks your visit complete.
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3 p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/30">
            <span className="material-symbols-outlined text-[20px] text-primary mt-0.5">group_add</span>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-on-surface">Refer a friend</p>
              <p className="text-[11px] text-on-surface-variant">
                Share your code — both of you earn when they book.
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3 p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/30">
            <span className="material-symbols-outlined text-[20px] text-primary mt-0.5">rate_review</span>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-on-surface">Leave a review</p>
              <p className="text-[11px] text-on-surface-variant">
                Honest feedback after a visit unlocks bonus points.
              </p>
            </div>
          </li>
        </ul>
      </section>

      {/* Actions */}
      <section className="flex flex-col sm:flex-row gap-2.5">
        <button
          type="button"
          id="rewards-book-btn"
          onClick={() => onNavigateToBooking?.()}
          className="flex-1 py-3 px-4 bg-primary text-white text-[13px] font-bold rounded-xl hover:bg-nexora-pink transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">event</span>
          Book & earn points
        </button>
        <button
          type="button"
          id="rewards-referral-btn"
          onClick={() => onOpenReferral?.()}
          className="flex-1 py-3 px-4 bg-surface-container-lowest border border-outline-variant/50 text-on-surface text-[13px] font-bold rounded-xl hover:border-primary/40 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px] text-primary">share</span>
          Refer a friend
        </button>
        <button
          type="button"
          id="rewards-membership-btn"
          onClick={() => onOpenMembership?.()}
          className="flex-1 py-3 px-4 bg-surface-container-lowest border border-outline-variant/50 text-on-surface text-[13px] font-bold rounded-xl hover:border-primary/40 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px] text-primary">card_membership</span>
          Membership
        </button>
      </section>
    </div>
  );
};
