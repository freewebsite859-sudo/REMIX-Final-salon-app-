import React, { useState, useMemo } from 'react';
import { UserProfile, Appointment, LoyaltyReward, LoyaltyActivityItem, SpendMilestoneReward } from '../types';

interface LoyaltyDashboardProps {
  user: UserProfile;
  appointments?: Appointment[];
  onUpdateUser: (updated: UserProfile) => void;
  onUpdateAppointments?: (appointments: Appointment[]) => void;
  onOpenAIAdvisor?: () => void;
  onNavigateToBooking?: () => void;
}

// Loyalty Tiers Definition
export interface LoyaltyTierInfo {
  id: 'bronze' | 'silver' | 'gold' | 'diamond';
  name: string;
  minPoints: number;
  maxPoints: number;
  badge: string;
  color: string;
  gradient: string;
  textColor: string;
  earnRatePer100: number; // e.g. 10, 12, 15, 20
  perks: string[];
  nextTierName?: string;
  nextTierPoints?: number;
}

export const LOYALTY_TIERS: LoyaltyTierInfo[] = [
  {
    id: 'bronze',
    name: 'Bronze Explorer',
    minPoints: 0,
    maxPoints: 299,
    badge: '🥉',
    color: '#cd7f32',
    gradient: 'from-amber-700/20 via-amber-600/10 to-transparent',
    textColor: 'text-amber-800',
    earnRatePer100: 10,
    perks: ['10 pts per ₹100 spent', 'Birthday Month 1.5x Multiplier', 'Standard Booking'],
    nextTierName: 'Silver Glow',
    nextTierPoints: 300,
  },
  {
    id: 'silver',
    name: 'Silver Glow',
    minPoints: 300,
    maxPoints: 599,
    badge: '🥈',
    color: '#94a3b8',
    gradient: 'from-slate-400/25 via-primary/10 to-transparent',
    textColor: 'text-slate-700',
    earnRatePer100: 12,
    perks: [
      '12 pts per ₹100 spent (20% bonus)',
      'Flat ₹100 Welcome Discount',
      'Free Scalp Consultation',
      'Birthday 2x Multiplier',
    ],
    nextTierName: 'Gold Glam',
    nextTierPoints: 600,
  },
  {
    id: 'gold',
    name: 'Gold Glam',
    minPoints: 600,
    maxPoints: 999,
    badge: '🥇',
    color: '#f59e0b',
    gradient: 'from-amber-500/25 via-amber-400/10 to-primary/5',
    textColor: 'text-amber-700',
    earnRatePer100: 15,
    perks: [
      '15 pts per ₹100 spent (50% bonus)',
      'Flat ₹200 OFF Discount Vouchers',
      'Free Hair Spa / Scalp Massage Add-on',
      'Priority Weekend Slots & Cancellation Waiver',
    ],
    nextTierName: 'Diamond VIP',
    nextTierPoints: 1000,
  },
  {
    id: 'diamond',
    name: 'Diamond VIP Elite',
    minPoints: 1000,
    maxPoints: 99999,
    badge: '💎',
    color: '#06b6d4',
    gradient: 'from-cyan-500/25 via-primary/20 to-purple-500/10',
    textColor: 'text-cyan-700',
    earnRatePer100: 20,
    perks: [
      '20 pts per ₹100 spent (2x points)',
      'Flat ₹500 Mega Voucher + Free Deluxe Facial',
      'Dedicated Stylist Concierge',
      'VIP Salon Lounge Access & Free Refreshments',
    ],
  },
];

export const LoyaltyDashboard: React.FC<LoyaltyDashboardProps> = ({
  user,
  appointments = [],
  onUpdateUser,
  onUpdateAppointments,
  onOpenAIAdvisor,
  onNavigateToBooking,
}) => {
  const [activeLedgerFilter, setActiveLedgerFilter] = useState<'all' | 'earned' | 'redeemed'>('all');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [claimedRewardSuccess, setClaimedRewardSuccess] = useState<string | null>(null);
  const [customSimulatorAmount, setCustomSimulatorAmount] = useState<string>('899');
  const [expandedAptId, setExpandedAptId] = useState<string | null>(null);

  // 1. Filter Completed & Confirmed Appointments
  const completedAppointments = useMemo(() => {
    return appointments.filter((a) => a.status === 'completed');
  }, [appointments]);

  const upcomingConfirmedAppointments = useMemo(() => {
    return appointments.filter((a) => a.status === 'confirmed' || a.status === 'in_progress');
  }, [appointments]);

  // 2. Math Calculations for Total Cost of Completed Appointments
  const totalCompletedCost = useMemo(() => {
    return completedAppointments.reduce((sum, a) => sum + (a.totalPrice || 0), 0);
  }, [completedAppointments]);

  const totalCompletedServicesCount = useMemo(() => {
    return completedAppointments.reduce((sum, a) => sum + (a.services?.length || 1), 0);
  }, [completedAppointments]);

  // Active Points: Fallback to dynamic computation if points not set
  const points = user.loyaltyPoints ?? 450;

  // Current Tier based on points
  const currentTier = useMemo(() => {
    if (points >= 1000) return LOYALTY_TIERS[3];
    if (points >= 600) return LOYALTY_TIERS[2];
    if (points >= 300) return LOYALTY_TIERS[1];
    return LOYALTY_TIERS[0];
  }, [points]);

  const earnRate = currentTier.earnRatePer100;

  // Points specifically earned from completed appointments based on their total cost
  const pointsEarnedFromCompleted = useMemo(() => {
    return completedAppointments.reduce((sum, apt) => {
      const cost = apt.totalPrice || 0;
      const pts = Math.round((cost * earnRate) / 100);
      return sum + pts;
    }, 0);
  }, [completedAppointments, earnRate]);

  // Cash discount value earned from completed appointments (2 pts = ₹1 discount = 5% - 10% direct cashback)
  const cashbackFromCompletedSpend = Math.round(pointsEarnedFromCompleted * 0.5);

  // Total cash equivalent of entire point balance
  const cashEquivalent = Math.round(points * 0.5);

  // Upcoming projected rewards once pending appointments complete
  const upcomingPotentialSpend = useMemo(() => {
    return upcomingConfirmedAppointments.reduce((sum, a) => sum + (a.totalPrice || 0), 0);
  }, [upcomingConfirmedAppointments]);

  const upcomingPotentialPoints = Math.round((upcomingPotentialSpend * earnRate) / 100);

  // 3. Next Tier Math
  const nextTier = useMemo(() => {
    const currentIndex = LOYALTY_TIERS.findIndex((t) => t.id === currentTier.id);
    return currentIndex < LOYALTY_TIERS.length - 1 ? LOYALTY_TIERS[currentIndex + 1] : null;
  }, [currentTier]);

  const progressToNext = useMemo(() => {
    if (!nextTier) {
      return {
        percent: 100,
        pointsNeeded: 0,
        currentInTier: points,
        tierRange: 1000,
      };
    }
    const tierMin = currentTier.minPoints;
    const tierTarget = nextTier.minPoints;
    const tierRange = tierTarget - tierMin;
    const currentInTier = points - tierMin;
    const percent = Math.min(100, Math.max(0, Math.round((currentInTier / tierRange) * 100)));
    const pointsNeeded = Math.max(0, tierTarget - points);

    return {
      percent,
      pointsNeeded,
      currentInTier,
      tierRange,
    };
  }, [points, currentTier, nextTier]);

  // 4. Spend-Based Milestone Rewards Ladder (Calculated based on totalCompletedCost)
  const spendMilestones: SpendMilestoneReward[] = useMemo(() => {
    return [
      {
        id: 'spend-500',
        title: 'Starter Glow Milestone',
        requiredSpend: 500,
        discountValue: 50,
        discountCode: 'SPEND50',
        description: 'Earned upon reaching ₹500 in completed salon visits. Flat ₹50 discount.',
        perkBadge: 'Free Scalp Check',
        isUnlocked: totalCompletedCost >= 500,
      },
      {
        id: 'spend-1500',
        title: 'Silver Elegance Milestone',
        requiredSpend: 1500,
        discountValue: 100,
        discountCode: 'SPEND100',
        description: 'Unlocked at ₹1,500 total completed spend. Flat ₹100 OFF coupon.',
        perkBadge: 'Free Beard/Blowdry Trim',
        isUnlocked: totalCompletedCost >= 1500,
      },
      {
        id: 'spend-3000',
        title: 'Gold Glamour Milestone',
        requiredSpend: 3000,
        discountValue: 200,
        discountCode: 'SPEND200',
        description: 'Unlocked at ₹3,000 total completed spend. Flat ₹200 OFF luxury voucher.',
        perkBadge: 'Free Hair Spa Upgrade',
        isUnlocked: totalCompletedCost >= 3000,
      },
      {
        id: 'spend-5000',
        title: 'Platinum Radiance Milestone',
        requiredSpend: 5000,
        discountValue: 350,
        discountCode: 'SPEND350',
        description: 'Unlocked at ₹5,000 total completed spend. Flat ₹350 OFF deluxe treatment.',
        perkBadge: 'Free Hydra Facial Add-on',
        isUnlocked: totalCompletedCost >= 5000,
      },
      {
        id: 'spend-10000',
        title: 'Diamond VIP Elite Milestone',
        requiredSpend: 10000,
        discountValue: 500,
        discountCode: 'SPEND500',
        description: 'Unlocked at ₹10,000 total completed spend. Flat ₹500 Mega Voucher & VIP Concierge.',
        perkBadge: 'VIP Lounge & Free Refreshments',
        isUnlocked: totalCompletedCost >= 10000,
      },
    ];
  }, [totalCompletedCost]);

  // Next Spend Milestone Calculation
  const nextSpendMilestone = useMemo(() => {
    return spendMilestones.find((m) => totalCompletedCost < m.requiredSpend) || null;
  }, [spendMilestones, totalCompletedCost]);

  const spendProgressToNext = useMemo(() => {
    if (!nextSpendMilestone) {
      return {
        percent: 100,
        spendNeeded: 0,
        target: 10000,
      };
    }
    const percent = Math.min(100, Math.max(0, Math.round((totalCompletedCost / nextSpendMilestone.requiredSpend) * 100)));
    const spendNeeded = Math.max(0, nextSpendMilestone.requiredSpend - totalCompletedCost);
    return {
      percent,
      spendNeeded,
      target: nextSpendMilestone.requiredSpend,
    };
  }, [totalCompletedCost, nextSpendMilestone]);

  // 5. Dynamic Upcoming & Points-Based Rewards
  const rewardsList: LoyaltyReward[] = useMemo(() => {
    return [
      {
        id: 'rew-100',
        title: 'Flat ₹100 OFF Next Service',
        category: 'discount',
        pointsRequired: 300,
        discountValue: 100,
        discountCode: 'GLOW100',
        description: 'Instant ₹100 discount on any salon service above ₹499.',
        isUnlocked: points >= 300,
        badgeLabel: 'Silver Perk',
        basedOnHistory: `Calculated from completed spend + points balance.`,
      },
      {
        id: 'rew-spa-addon',
        title: 'Complimentary Hair Spa Add-on',
        category: 'free_service',
        pointsRequired: 500,
        discountCode: 'FREESPA',
        description: 'Deep conditioning & soothing 15-min scalp massage with your haircut.',
        isUnlocked: points >= 500,
        badgeLabel: 'Popular Add-on',
        basedOnHistory: `Earned from verified appointment history.`,
      },
      {
        id: 'rew-200',
        title: 'Flat ₹200 OFF Gold Milestone Voucher',
        category: 'discount',
        pointsRequired: 600,
        discountValue: 200,
        discountCode: 'GOLD200',
        description: 'Exclusive Gold Tier discount on any hair styling, facial, or spa service.',
        isUnlocked: points >= 600,
        badgeLabel: 'Gold Milestone',
        basedOnHistory: `${Math.max(0, 600 - points)} more points needed to unlock.`,
      },
      {
        id: 'rew-facial-upgrade',
        title: '15% OFF Luxe Facial or Hydra Treatment',
        category: 'upgrade',
        pointsRequired: 750,
        discountValue: 250,
        discountCode: 'HYDRA15',
        description: '15% discount on deluxe skin hydration, anti-aging, or LED facial treatments.',
        isUnlocked: points >= 750,
        badgeLabel: 'Skin Glow',
        basedOnHistory: 'Unlocks at 750 points.',
      },
      {
        id: 'rew-500-diamond',
        title: 'Flat ₹500 Mega Voucher + VIP Lounge',
        category: 'discount',
        pointsRequired: 1000,
        discountValue: 500,
        discountCode: 'DIAMOND500',
        description: 'Ultimate VIP perk: ₹500 discount voucher plus free beverage in salon lounge.',
        isUnlocked: points >= 1000,
        badgeLabel: 'Diamond VIP Elite',
        basedOnHistory: 'Top tier achievement with maximum lifetime booking perks.',
      },
    ];
  }, [points]);

  // 6. Activity Ledger Data
  const activityLedger: LoyaltyActivityItem[] = useMemo(() => {
    const items: LoyaltyActivityItem[] = [];

    // Points earned from completed appointments
    completedAppointments.forEach((apt) => {
      const earned = Math.round(((apt.totalPrice || 500) * earnRate) / 100);
      items.push({
        id: `act-apt-${apt.id}`,
        title: `${apt.salonName} - ${apt.services[0]?.name || 'Salon Visit'} (Bill: ₹${apt.totalPrice})`,
        type: 'earned',
        points: earned,
        date: apt.date || 'Completed Visit',
        source: 'appointment',
        appointmentRef: apt.bookingRef,
        salonName: apt.salonName,
        serviceName: apt.services[0]?.name,
      });
    });

    // Referral bonus items
    if (user.referredFriends && user.referredFriends.length > 0) {
      user.referredFriends.forEach((f) => {
        if (f.status === 'completed') {
          items.push({
            id: `act-ref-${f.id}`,
            title: `Referral Reward: ${f.name} joined Nexora`,
            type: 'bonus',
            points: 150,
            date: f.date,
            source: 'referral',
          });
        }
      });
    }

    // Default historic activities if ledger is short
    if (items.length < 2) {
      items.push({
        id: 'act-init-1',
        title: 'Welcome Loyalty Gift: Nexora Beauty Club Enrollment',
        type: 'bonus',
        points: 100,
        date: '01 Aug 2026',
        source: 'quiz',
      });
      items.push({
        id: 'act-init-2',
        title: 'Verified 5-Star Review with Photo: Scissors & Shears',
        type: 'earned',
        points: 50,
        date: '05 Aug 2026',
        source: 'review',
        salonName: 'Scissors & Shears Salon',
      });
    }

    return items;
  }, [completedAppointments, user.referredFriends, earnRate]);

  const filteredActivities = useMemo(() => {
    if (activeLedgerFilter === 'earned') return activityLedger.filter((a) => a.type === 'earned' || a.type === 'bonus');
    if (activeLedgerFilter === 'redeemed') return activityLedger.filter((a) => a.type === 'redeemed');
    return activityLedger;
  }, [activityLedger, activeLedgerFilter]);

  // Copy Coupon Code Handler
  const handleCopyCode = (code: string, rewardTitle: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setClaimedRewardSuccess(`Promo code "${code}" copied! Apply at checkout for ${rewardTitle}.`);
    setTimeout(() => {
      setCopiedCode(null);
      setClaimedRewardSuccess(null);
    }, 3500);
  };

  // Simulate Instant Points Earn (e.g. Taking AI Quiz or Photo Review)
  const handleSimulateBonusPoints = (bonusPts: number, reason: string) => {
    const updatedPoints = points + bonusPts;
    onUpdateUser({
      ...user,
      loyaltyPoints: updatedPoints,
    });
    setClaimedRewardSuccess(`🎉 +${bonusPts} points earned for: ${reason}! New Balance: ${updatedPoints} pts.`);
    setTimeout(() => {
      setClaimedRewardSuccess(null);
    }, 4000);
  };

  // Action: Mark an upcoming confirmed appointment as completed to test live points & reward calculation
  const handleMarkAppointmentAsCompleted = (apt: Appointment) => {
    const earnedPoints = Math.round(((apt.totalPrice || 500) * earnRate) / 100);
    const updatedPoints = points + earnedPoints;

    const updatedApts = appointments.map((a) =>
      a.id === apt.id ? { ...a, status: 'completed' as const } : a
    );

    if (onUpdateAppointments) {
      onUpdateAppointments(updatedApts);
    }

    onUpdateUser({
      ...user,
      loyaltyPoints: updatedPoints,
    });

    setClaimedRewardSuccess(
      `🎉 Appointment "${apt.bookingRef}" marked Completed! Total Bill: ₹${apt.totalPrice}. +${earnedPoints} Loyalty Points credited to your profile!`
    );
    setTimeout(() => {
      setClaimedRewardSuccess(null);
    }, 5000);
  };

  // Simulator: Calculate prospective points for a custom appointment bill
  const simAmount = Math.max(0, parseInt(customSimulatorAmount) || 0);
  const simEarnedPoints = Math.round((simAmount * earnRate) / 100);
  const simCashback = Math.round(simEarnedPoints * 0.5);

  return (
    <div
      id="section-loyalty-dashboard"
      className="bg-surface-container-low border border-outline-variant/50 rounded-3xl p-4 sm:p-6 shadow-xs mb-5 relative overflow-hidden"
    >
      {/* Toast Notification */}
      {claimedRewardSuccess && (
        <div className="p-3 mb-4 rounded-2xl bg-success-emerald/15 text-emerald-900 dark:text-emerald-200 text-[12px] font-bold flex items-center justify-between border border-emerald-500/30 shadow-xs animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-success-emerald">check_circle</span>
            <span>{claimedRewardSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setClaimedRewardSuccess(null)}
            className="text-emerald-900 dark:text-emerald-200 hover:opacity-75 font-extrabold text-[14px] px-1.5 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. HEADER TITLE & TIER BADGE                                              */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-outline-variant/30 pb-3.5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-primary text-white flex items-center justify-center shadow-md">
            <span className="material-symbols-outlined text-[24px]">stars</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-card-title text-[18px] font-extrabold text-on-surface">
                Loyalty Points & Rewards Tracker
              </h3>
              <span className="text-[11px] bg-primary/10 text-primary font-bold px-2.5 py-0.5 rounded-full border border-primary/20 flex items-center gap-1">
                <span>{currentTier.badge}</span>
                <span>{currentTier.name}</span>
              </span>
            </div>
            <p className="text-[12px] text-on-surface-variant">
              Rewards calculated dynamically based on total cost of completed appointments
            </p>
          </div>
        </div>

        {/* Quick Earn Rate & Cash Value Pill */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
          <div className="px-3 py-1.5 rounded-2xl bg-primary/10 border border-primary/20 flex items-center gap-1.5 shadow-2xs">
            <span className="text-[10px] text-primary font-bold uppercase tracking-wider">Earn Rate:</span>
            <span className="text-[12px] font-extrabold text-primary">{earnRate} pts / ₹100</span>
          </div>
          <div className="px-3.5 py-1.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/40 flex items-center gap-2 shadow-2xs">
            <span className="text-[11px] text-on-surface-variant font-medium">Cash Value:</span>
            <span className="text-[13px] font-extrabold text-emerald-700">₹{cashEquivalent} OFF</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. COMPLETED APPOINTMENTS COST & REWARDS HERO CARD                         */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-4">
        {/* Left 7 Cols: Points & Completed Spend Summary */}
        <div className="lg:col-span-7 bg-gradient-to-br from-surface-container-lowest via-surface-container-lowest to-primary/5 rounded-3xl p-5 border border-primary/20 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-bl from-primary/10 to-transparent rounded-bl-full pointer-events-none" />

          <div>
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-primary">account_balance_wallet</span>
                <span>Active Loyalty Points Balance</span>
              </span>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-800 font-bold px-2 py-0.5 rounded-md border border-emerald-500/20">
                100% Usable at Checkout
              </span>
            </div>

            <div className="flex items-baseline gap-2.5 my-1">
              <span className="text-[34px] sm:text-[40px] font-black text-primary tracking-tight font-card-title">
                {points}
              </span>
              <span className="text-[14px] font-bold text-on-surface-variant">Nexora Points</span>
            </div>

            <p className="text-[12px] text-on-surface-variant leading-relaxed">
              Worth <strong>₹{cashEquivalent} in instant discounts</strong> (2 pts = ₹1.00 off). Calculated based on your total completed appointment spending of <strong>₹{totalCompletedCost}</strong>.
            </p>
          </div>

          {/* Completed Spend Calculation Breakdown Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-3 border-t border-outline-variant/25 text-center">
            <div className="p-2 rounded-xl bg-surface-container/60 border border-outline-variant/20">
              <span className="text-[10px] text-on-surface-variant block font-medium">Completed Visits</span>
              <span className="text-[14px] font-extrabold text-on-surface">
                {completedAppointments.length} {completedAppointments.length === 1 ? 'visit' : 'visits'}
              </span>
            </div>

            <div className="p-2 rounded-xl bg-surface-container/60 border border-outline-variant/20">
              <span className="text-[10px] text-on-surface-variant block font-medium">Completed Spend</span>
              <span className="text-[14px] font-extrabold text-primary">
                ₹{totalCompletedCost}
              </span>
            </div>

            <div className="p-2 rounded-xl bg-surface-container/60 border border-outline-variant/20">
              <span className="text-[10px] text-on-surface-variant block font-medium">From Visits</span>
              <span className="text-[14px] font-extrabold text-success-emerald">
                +{pointsEarnedFromCompleted} pts
              </span>
            </div>

            <div className="p-2 rounded-xl bg-surface-container/60 border border-outline-variant/20">
              <span className="text-[10px] text-on-surface-variant block font-medium">Cashback Value</span>
              <span className="text-[14px] font-extrabold text-emerald-700">
                ₹{cashbackFromCompletedSpend}
              </span>
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Current Tier & Active Perks */}
        <div className="lg:col-span-5 bg-surface-container-lowest rounded-3xl p-5 border border-outline-variant/40 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                Current Tier & Perks
              </span>
              <span className="text-[18px]">{currentTier.badge}</span>
            </div>
            <h4 className="text-[16px] font-extrabold text-on-surface mb-2">
              {currentTier.name} Member
            </h4>

            <ul className="space-y-1.5 text-[12px] text-on-surface-variant">
              {currentTier.perks.map((perk, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-success-emerald shrink-0 mt-0.5">
                    check_circle
                  </span>
                  <span>{perk}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-3 pt-2.5 border-t border-outline-variant/25 flex items-center justify-between text-[11px]">
            <span className="text-on-surface-variant">Reward Return Rate:</span>
            <span className="font-extrabold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
              ~{(earnRate * 0.5).toFixed(1)}% Direct Cashback
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. SPEND-BASED MILESTONE REWARDS LADDER (CALCULATED FROM COMPLETED SPEND)  */}
      {/* ========================================================================= */}
      <div
        id="loyalty-spend-milestones"
        className="p-4 sm:p-5 rounded-3xl bg-surface-container-lowest border border-outline-variant/40 mb-4 shadow-xs"
      >
        {/* Milestone Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-amber-500 fill-1">military_tech</span>
              <h4 className="font-card-title text-[15px] font-extrabold text-on-surface">
                Completed Appointments Spend Milestones
              </h4>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-0.5">
              Cumulative total of completed bills unlocks instant discount vouchers & exclusive salon upgrades
            </p>
          </div>

          {/* Progress Percent Callout */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {nextSpendMilestone ? (
              <span className="text-[11px] font-black text-amber-800 bg-amber-500/15 px-3 py-1 rounded-full border border-amber-500/30">
                ₹{totalCompletedCost} / ₹{nextSpendMilestone.requiredSpend} ({spendProgressToNext.percent}%)
              </span>
            ) : (
              <span className="text-[11px] font-black text-cyan-700 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20">
                🏆 All 5 Spend Milestones Unlocked!
              </span>
            )}
          </div>
        </div>

        {/* Spend Milestone Progress Bar */}
        <div className="w-full bg-surface-container rounded-full h-3.5 p-0.5 border border-outline-variant/40 relative overflow-hidden mb-3.5">
          <div
            className="bg-gradient-to-r from-amber-500 via-primary to-nexora-pink h-full rounded-full transition-all duration-700 relative shadow-xs"
            style={{ width: `${spendProgressToNext.percent}%` }}
          >
            <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
            <div className="absolute right-0 top-0 bottom-0 w-2 bg-white rounded-full shadow-md" />
          </div>
        </div>

        {/* 5-Milestone Stepper Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center pt-1">
          {spendMilestones.map((milestone) => {
            const isUnlocked = milestone.isUnlocked;
            const isNext = nextSpendMilestone?.id === milestone.id;

            return (
              <div
                key={milestone.id}
                className={`p-2.5 rounded-2xl border transition-all flex flex-col justify-between ${
                  isUnlocked
                    ? 'bg-emerald-500/10 border-emerald-500/30 ring-1 ring-emerald-500/20'
                    : isNext
                    ? 'bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/30'
                    : 'bg-surface-container/30 border-outline-variant/30 opacity-75'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span
                      className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                        isUnlocked
                          ? 'bg-success-emerald text-white'
                          : isNext
                          ? 'bg-amber-500 text-white'
                          : 'bg-surface-container-high text-on-surface-variant'
                      }`}
                    >
                      {isUnlocked ? '✓ UNLOCKED' : `₹${milestone.requiredSpend}`}
                    </span>
                    <span className="text-[10px] font-bold text-on-surface">
                      ₹{milestone.discountValue} OFF
                    </span>
                  </div>

                  <span className="font-bold text-[12px] text-on-surface block leading-tight text-left">
                    {milestone.title.split(' ')[0]} {milestone.title.split(' ')[1]}
                  </span>
                  <span className="text-[10px] text-on-surface-variant block mt-0.5 text-left truncate">
                    {milestone.perkBadge}
                  </span>
                </div>

                <div className="mt-2 pt-1.5 border-t border-outline-variant/20 flex items-center justify-between">
                  <span className="font-mono text-[10px] font-black text-on-surface bg-surface-container px-1 rounded">
                    {milestone.discountCode}
                  </span>
                  {isUnlocked ? (
                    <button
                      type="button"
                      onClick={() => handleCopyCode(milestone.discountCode, milestone.title)}
                      className="text-[10px] text-primary font-extrabold hover:underline cursor-pointer"
                    >
                      {copiedCode === milestone.discountCode ? 'Copied ✓' : 'Copy'}
                    </button>
                  ) : (
                    <span className="text-[9px] text-on-surface-variant">
                      ₹{Math.max(0, milestone.requiredSpend - totalCompletedCost)} to go
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Milestone Next Callout Banner */}
        {nextSpendMilestone && (
          <div className="mt-3.5 p-3 rounded-2xl bg-gradient-to-r from-amber-500/10 via-primary/5 to-surface-container-lowest border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[20px] text-amber-600 shrink-0">redeem</span>
              <p className="text-[12px] text-amber-950 dark:text-amber-200 leading-tight">
                <strong>Next Reward Milestone:</strong> Complete <strong>₹{spendProgressToNext.spendNeeded} more</strong> in appointments to unlock{' '}
                <strong className="text-primary">{nextSpendMilestone.title} ({nextSpendMilestone.discountCode})</strong> with <strong>{nextSpendMilestone.perkBadge}</strong>!
              </p>
            </div>

            {onNavigateToBooking && (
              <button
                type="button"
                onClick={onNavigateToBooking}
                className="px-3 py-1.5 bg-primary text-white text-[11px] font-bold rounded-xl hover:bg-nexora-pink transition-colors shadow-xs shrink-0 cursor-pointer"
              >
                Book Appointment
              </button>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. ITEMIZED COMPLETED APPOINTMENTS STATEMENT & POINTS EARNED               */}
      {/* ========================================================================= */}
      <div id="loyalty-completed-receipts" className="mb-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <h4 className="font-card-title text-[15px] font-extrabold text-on-surface flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-primary">receipt_long</span>
              <span>Completed Appointments Points & Rewards Statement</span>
            </h4>
            <p className="text-[11px] text-on-surface-variant">
              Itemized breakdown of points and cashback calculated from each completed salon bill
            </p>
          </div>

          <span className="text-[11px] bg-success-emerald/15 text-emerald-800 font-bold px-2.5 py-1 rounded-full border border-emerald-500/30">
            {completedAppointments.length} Verified {completedAppointments.length === 1 ? 'Receipt' : 'Receipts'} (₹{totalCompletedCost})
          </span>
        </div>

        {completedAppointments.length === 0 ? (
          <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/40 text-center text-[12px] text-on-surface-variant">
            <span className="material-symbols-outlined text-[28px] text-on-surface-variant mb-1 block">history</span>
            <span>No completed appointments yet. Book and complete your first salon visit to start earning reward points automatically!</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {completedAppointments.map((apt) => {
              const aptCost = apt.totalPrice || 0;
              const aptPtsEarned = Math.round((aptCost * earnRate) / 100);
              const aptCashback = Math.round(aptPtsEarned * 0.5);
              const isExpanded = expandedAptId === apt.id;

              return (
                <div
                  key={apt.id}
                  className="p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/40 shadow-xs hover:border-primary/40 transition-all"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={apt.salonImage}
                        alt={apt.salonName}
                        className="w-12 h-12 rounded-xl object-cover ring-1 ring-outline-variant/30"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="font-bold text-[14px] text-on-surface">{apt.salonName}</h5>
                          <span className="text-[9px] font-mono font-bold bg-surface-container px-1.5 py-0.2 rounded text-on-surface-variant">
                            {apt.bookingRef}
                          </span>
                        </div>
                        <p className="text-[11px] text-on-surface-variant mt-0.5">
                          {apt.date} at {apt.time} · {apt.services.map((s) => s.name).join(', ')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-outline-variant/20">
                      <div className="text-left sm:text-right">
                        <span className="text-[10px] text-on-surface-variant block font-medium">Bill Paid</span>
                        <span className="font-extrabold text-[14px] text-on-surface">₹{aptCost}</span>
                      </div>

                      <div className="text-right bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20">
                        <span className="text-[10px] text-emerald-800 font-bold block">Reward Earned</span>
                        <span className="font-black text-[13px] text-emerald-700">+{aptPtsEarned} pts (₹{aptCashback})</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setExpandedAptId(isExpanded ? null : apt.id)}
                        className="p-1.5 text-on-surface-variant hover:text-primary rounded-lg transition-colors cursor-pointer"
                        title="Toggle Calculation Breakdown"
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          {isExpanded ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Expanded Receipt Breakdown */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-outline-variant/20 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] bg-surface-container/30 p-2.5 rounded-xl animate-in fade-in">
                      <div>
                        <span className="text-on-surface-variant block">Earn Formula:</span>
                        <span className="font-mono text-on-surface font-semibold">
                          ₹{aptCost} × {earnRate}% earn rate = +{aptPtsEarned} pts
                        </span>
                      </div>
                      <div>
                        <span className="text-on-surface-variant block">Discount Value:</span>
                        <span className="font-semibold text-emerald-700">
                          ₹{aptCashback} discount unlocked (2 pts = ₹1)
                        </span>
                      </div>
                      <div>
                        <span className="text-on-surface-variant block">Contribution to Milestones:</span>
                        <span className="font-semibold text-primary">
                          +₹{aptCost} towards ₹{nextSpendMilestone?.requiredSpend || 10000} target
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 5. UPCOMING APPOINTMENTS PENDING REWARDS (COMPLETE TO EARN)               */}
      {/* ========================================================================= */}
      {upcomingConfirmedAppointments.length > 0 && (
        <div id="loyalty-pending-rewards" className="mb-4 p-4 rounded-3xl bg-primary/5 border border-primary/20 shadow-xs">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">pending_actions</span>
              <h4 className="font-card-title text-[14px] font-bold text-on-surface">
                Upcoming Visits: Estimated Rewards Upon Service Completion
              </h4>
            </div>
            <span className="text-[11px] font-black text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
              +{upcomingPotentialPoints} Points Pending (₹{upcomingPotentialSpend} Spend)
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {upcomingConfirmedAppointments.map((apt) => {
              const estPts = Math.round(((apt.totalPrice || 500) * earnRate) / 100);

              return (
                <div
                  key={apt.id}
                  className="p-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-[12px]"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[20px] text-amber-500">schedule</span>
                    <div>
                      <span className="font-bold text-on-surface">{apt.salonName}</span>
                      <span className="text-on-surface-variant text-[11px] ml-2">
                        {apt.date} at {apt.time} · Total: ₹{apt.totalPrice}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                    <span className="text-success-emerald font-bold text-[11px]">
                      +{estPts} pts upon completion
                    </span>
                    <button
                      type="button"
                      onClick={() => handleMarkAppointmentAsCompleted(apt)}
                      className="px-2.5 py-1 bg-success-emerald text-white rounded-lg text-[10px] font-bold hover:bg-emerald-600 transition-colors shadow-2xs cursor-pointer flex items-center gap-1"
                      title="Simulate service completion to credit points immediately"
                    >
                      <span className="material-symbols-outlined text-[12px]">done_all</span>
                      <span>Mark Completed (Credit +{estPts} pts)</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. LIVE LOYALTY REWARDS & APPOINTMENT SPEND SIMULATOR                      */}
      {/* ========================================================================= */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-surface-container-lowest via-surface-container-lowest to-amber-500/5 border border-primary/20 mb-4 shadow-xs">
        <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">calculate</span>
            </div>
            <div>
              <h4 className="font-card-title text-[14px] font-bold text-on-surface">
                Interactive Reward Points & Cashback Calculator
              </h4>
              <p className="text-[11px] text-on-surface-variant">
                Calculate points and cash discount value for any upcoming appointment bill
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center pt-1">
          <div className="sm:col-span-6">
            <label className="text-[11px] font-bold text-on-surface block mb-1">
              Test Appointment Bill Amount (₹)
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-2 text-[14px] font-bold text-on-surface-variant">₹</span>
                <input
                  type="number"
                  value={customSimulatorAmount}
                  onChange={(e) => setCustomSimulatorAmount(e.target.value)}
                  placeholder="899"
                  className="w-full h-9 pl-7 pr-3 bg-surface-container text-on-surface rounded-xl text-[13px] font-bold border border-outline-variant/40 focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Quick Bill Presets */}
              <div className="flex items-center gap-1">
                {[499, 999, 1799, 2999].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setCustomSimulatorAmount(amt.toString())}
                    className="px-2 py-1 bg-surface-container text-on-surface-variant hover:text-primary rounded-lg text-[10px] font-bold border border-outline-variant/30 transition-colors cursor-pointer"
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="sm:col-span-6 bg-surface-container p-2.5 rounded-xl border border-outline-variant/30 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-on-surface-variant block font-medium">Calculated Earnings</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[16px] font-black text-primary">+{simEarnedPoints} pts</span>
                <span className="text-[11px] font-bold text-emerald-700">(= ₹{simCashback} Cashback)</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleSimulateBonusPoints(simEarnedPoints, `Simulated ₹${simAmount} Appointment`)}
              className="px-3 py-1.5 bg-primary text-white rounded-xl text-[11px] font-bold hover:bg-nexora-pink transition-colors shadow-2xs cursor-pointer flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[13px]">add_circle</span>
              <span>Test Credit (+{simEarnedPoints} pts)</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 7. UPCOMING & UNLOCKED REWARDS VOUCHERS LIST                               */}
      {/* ========================================================================= */}
      <div id="loyalty-upcoming-rewards" className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="font-card-title text-[15px] font-extrabold text-on-surface flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-nexora-pink">loyalty</span>
              <span>Redeemable Rewards & Available Vouchers</span>
            </h4>
            <p className="text-[11px] text-on-surface-variant">
              Apply coupon codes at checkout for instant price deductions
            </p>
          </div>

          <span className="text-[11px] bg-primary/10 text-primary font-bold px-2.5 py-1 rounded-full">
            {rewardsList.filter((r) => r.isUnlocked).length} Unlocked
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rewardsList.map((reward) => {
            const isUnlocked = reward.isUnlocked;
            const isCopied = copiedCode === reward.discountCode;

            return (
              <div
                key={reward.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                  isUnlocked
                    ? 'bg-surface-container-lowest border-primary/30 shadow-xs ring-1 ring-primary/10'
                    : 'bg-surface-container/40 border-outline-variant/30 opacity-80'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                          isUnlocked
                            ? 'bg-emerald-500/15 text-emerald-800 border border-emerald-500/30'
                            : 'bg-surface-container-high text-on-surface-variant'
                        }`}
                      >
                        {isUnlocked ? '✓ UNLOCKED' : `LOCKED (${reward.pointsRequired} pts)`}
                      </span>
                      {reward.badgeLabel && (
                        <span className="text-[10px] bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded">
                          {reward.badgeLabel}
                        </span>
                      )}
                    </div>

                    <span className="text-[12px] font-extrabold text-on-surface">
                      {reward.pointsRequired} pts
                    </span>
                  </div>

                  <h5 className="font-card-title text-[14px] font-extrabold text-on-surface leading-snug">
                    {reward.title}
                  </h5>
                  <p className="text-[11px] text-on-surface-variant mt-1 leading-relaxed">
                    {reward.description}
                  </p>

                  {reward.basedOnHistory && (
                    <p className="text-[10px] text-primary/80 font-medium mt-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">history_edu</span>
                      <span>{reward.basedOnHistory}</span>
                    </p>
                  )}
                </div>

                {/* Bottom Action / Promo Code Strip */}
                <div className="pt-2 border-t border-outline-variant/20 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-on-surface-variant font-medium">Code:</span>
                    <span className="font-mono text-[12px] font-black text-on-surface bg-surface-container px-2 py-0.5 rounded border border-outline-variant/30">
                      {reward.discountCode}
                    </span>
                  </div>

                  {isUnlocked ? (
                    <button
                      type="button"
                      id={`copy-reward-${reward.id}`}
                      onClick={() => handleCopyCode(reward.discountCode, reward.title)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs ${
                        isCopied
                          ? 'bg-success-emerald text-white'
                          : 'bg-primary text-white hover:bg-nexora-pink'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[13px]">
                        {isCopied ? 'check' : 'content_copy'}
                      </span>
                      <span>{isCopied ? 'Copied ✓' : 'Copy Coupon'}</span>
                    </button>
                  ) : (
                    <span className="text-[10px] text-on-surface-variant font-semibold bg-surface-container px-2 py-1 rounded-lg">
                      Need {Math.max(0, reward.pointsRequired - points)} more pts
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 8. FAST-TRACK WAYS TO EARN POINTS                                         */}
      {/* ========================================================================= */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/5 via-surface-container-lowest to-amber-500/5 border border-primary/20 mb-4 shadow-xs">
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px]">bolt</span>
          </div>
          <div>
            <h4 className="font-card-title text-[14px] font-bold text-on-surface">
              4 Ways to Boost Your Loyalty Points
            </h4>
            <p className="text-[11px] text-on-surface-variant">
              Quick actions to earn rewards and speed up your discount progress
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1 text-[12px]">
          {/* Action 1 */}
          <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-800/80 border border-outline-variant/30 flex flex-col justify-between gap-2 shadow-2xs">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="material-symbols-outlined text-[18px] text-primary">calendar_month</span>
                <span className="text-[10px] font-black text-primary bg-primary/10 px-1.5 py-0.2 rounded">
                  +{earnRate} pts / ₹100
                </span>
              </div>
              <span className="font-bold text-on-surface block text-[12px]">Book Salon Visits</span>
              <p className="text-[10px] text-on-surface-variant mt-0.5">
                Earn points automatically on all completed haircuts, spa & skincare services.
              </p>
            </div>
            {onNavigateToBooking && (
              <button
                type="button"
                onClick={onNavigateToBooking}
                className="w-full py-1 bg-surface-container text-primary hover:bg-primary hover:text-white rounded-lg text-[10px] font-bold transition-colors cursor-pointer text-center"
              >
                Book Appointment
              </button>
            )}
          </div>

          {/* Action 2 */}
          <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-800/80 border border-outline-variant/30 flex flex-col justify-between gap-2 shadow-2xs">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="material-symbols-outlined text-[18px] text-amber-600">group_add</span>
                <span className="text-[10px] font-black text-amber-700 bg-amber-500/10 px-1.5 py-0.2 rounded">
                  +150 pts + ₹150
                </span>
              </div>
              <span className="font-bold text-on-surface block text-[12px]">Refer a Friend</span>
              <p className="text-[10px] text-on-surface-variant mt-0.5">
                Share your promo code <strong>{user.referralCode || 'NEXORA2026'}</strong> with friends.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('section-rewards');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="w-full py-1 bg-surface-container text-amber-800 hover:bg-amber-600 hover:text-white rounded-lg text-[10px] font-bold transition-colors cursor-pointer text-center"
            >
              View Referral Code
            </button>
          </div>

          {/* Action 3 */}
          <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-800/80 border border-outline-variant/30 flex flex-col justify-between gap-2 shadow-2xs">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="material-symbols-outlined text-[18px] text-nexora-pink">auto_awesome</span>
                <span className="text-[10px] font-black text-nexora-pink bg-pink-500/10 px-1.5 py-0.2 rounded">
                  +25 Bonus pts
                </span>
              </div>
              <span className="font-bold text-on-surface block text-[12px]">AI Style Quiz</span>
              <p className="text-[10px] text-on-surface-variant mt-0.5">
                Personalize your hair & face shape preferences with the AI advisor.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenAIAdvisor?.()}
              className="w-full py-1 bg-surface-container text-nexora-pink hover:bg-nexora-pink hover:text-white rounded-lg text-[10px] font-bold transition-colors cursor-pointer text-center"
            >
              Launch Style Quiz
            </button>
          </div>

          {/* Action 4: Verified Review */}
          <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-800/80 border border-outline-variant/30 flex flex-col justify-between gap-2 shadow-2xs">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="material-symbols-outlined text-[18px] text-emerald-600">rate_review</span>
                <span className="text-[10px] font-black text-emerald-800 bg-emerald-500/10 px-1.5 py-0.2 rounded">
                  +50 pts / Review
                </span>
              </div>
              <span className="font-bold text-on-surface block text-[12px]">Review Stylist</span>
              <p className="text-[10px] text-on-surface-variant mt-0.5">
                Leave photo reviews after your verified salon visits.
              </p>
            </div>
            <button
              type="button"
              id="simulate-review-bonus-btn"
              onClick={() => handleSimulateBonusPoints(50, 'Verified Salon Photo Review')}
              className="w-full py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-600 hover:text-white rounded-lg text-[10px] font-bold transition-colors cursor-pointer text-center"
            >
              +50 pts Demo Earn
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 9. POINTS ACTIVITY LEDGER                                                 */}
      {/* ========================================================================= */}
      <div id="loyalty-activity-ledger">
        <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-primary">receipt_long</span>
            <h4 className="text-[13px] font-bold text-on-surface">Points Activity & Ledger</h4>
          </div>

          {/* Ledger Filter Pills */}
          <div className="flex items-center gap-1 bg-surface-container p-0.5 rounded-lg text-[11px]">
            <button
              type="button"
              onClick={() => setActiveLedgerFilter('all')}
              className={`px-2.5 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${
                activeLedgerFilter === 'all'
                  ? 'bg-white dark:bg-zinc-800 text-primary shadow-xs font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              All ({activityLedger.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveLedgerFilter('earned')}
              className={`px-2.5 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${
                activeLedgerFilter === 'earned'
                  ? 'bg-white dark:bg-zinc-800 text-primary shadow-xs font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Earned (+)
            </button>
            <button
              type="button"
              onClick={() => setActiveLedgerFilter('redeemed')}
              className={`px-2.5 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${
                activeLedgerFilter === 'redeemed'
                  ? 'bg-white dark:bg-zinc-800 text-primary shadow-xs font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Redeemed (-)
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {filteredActivities.map((act) => (
            <div
              key={act.id}
              className="p-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 flex items-center justify-between text-[12px] shadow-2xs hover:border-primary/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center text-[16px] font-bold shrink-0 ${
                    act.type === 'earned' || act.type === 'bonus'
                      ? 'bg-emerald-500/15 text-emerald-700'
                      : 'bg-rose-500/15 text-rose-700'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {act.source === 'appointment'
                      ? 'content_cut'
                      : act.source === 'referral'
                      ? 'person_add'
                      : act.source === 'review'
                      ? 'star'
                      : 'card_giftcard'}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-on-surface block leading-tight">{act.title}</span>
                  <div className="flex items-center gap-2 text-[10px] text-on-surface-variant mt-0.5">
                    <span>{act.date}</span>
                    {act.appointmentRef && (
                      <>
                        <span>•</span>
                        <span className="font-mono bg-surface-container px-1 rounded">
                          Ref: {act.appointmentRef}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span
                  className={`font-black text-[13px] block ${
                    act.type === 'earned' || act.type === 'bonus' ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  +{act.points} pts
                </span>
                <span className="text-[9px] uppercase font-bold text-on-surface-variant">
                  {act.source}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
