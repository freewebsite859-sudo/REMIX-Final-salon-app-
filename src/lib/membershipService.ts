/**
 * Nexora Membership Service
 *
 * Tiers:
 * 1. Silver:
 *    - 5% benefit
 *    - Basic rewards
 *    - Booking history
 *    - Partner shop benefits
 *
 * 2. Gold:
 *    - 10% benefit
 *    - Priority booking
 *    - Extra reward points
 *    - Referral bonus
 *
 * 3. Platinum:
 *    - 15% benefit
 *    - Highest benefits
 *    - Priority support
 *    - Premium offers
 *    - Best partner rewards
 *
 * Rule:
 * Membership benefits apply ONLY at Nexora partner shops.
 */

import { MembershipTier, Salon, UserProfile } from '../types';

export interface MembershipCardConfig {
  tier: 'silver' | 'gold' | 'platinum';
  name: string;
  tagline: string;
  benefitPercent: number; // 5, 10, 15
  benefitHeadline: string; // "5% benefit", "10% benefit", "15% benefit"
  bullets: string[];
  pointsRequired: number;
  spendRequired: number;
  unlockDescription: string;
  badgeLabel: string;
  gradientClass: string;
  borderClass: string;
  accentClass: string;
  icon: string;
  rewardsMultiplier: string;
}

export const MEMBERSHIP_TIERS: MembershipCardConfig[] = [
  {
    tier: 'silver',
    name: 'Silver',
    tagline: 'Essential grooming perks for regular salon visitors',
    benefitPercent: 5,
    benefitHeadline: '5% benefit',
    bullets: [
      '5% benefit',
      'Basic rewards',
      'Booking history',
      'Partner shop benefits',
    ],
    pointsRequired: 500,
    spendRequired: 3000,
    unlockDescription: '500 loyalty points or ₹3,000 spend at partner shops',
    badgeLabel: 'Silver Tier',
    gradientClass: 'from-slate-700 via-slate-600 to-slate-800',
    borderClass: 'border-slate-300 dark:border-slate-700',
    accentClass: 'text-slate-700 dark:text-slate-200',
    icon: 'military_tech',
    rewardsMultiplier: '1x Points',
  },
  {
    tier: 'gold',
    name: 'Gold',
    tagline: 'Priority pampering and enhanced reward multipliers',
    benefitPercent: 10,
    benefitHeadline: '10% benefit',
    bullets: [
      '10% benefit',
      'Priority booking',
      'Extra reward points',
      'Referral bonus',
    ],
    pointsRequired: 1500,
    spendRequired: 8000,
    unlockDescription: '1,500 loyalty points or ₹8,000 spend at partner shops',
    badgeLabel: 'Gold Tier · Popular',
    gradientClass: 'from-amber-600 via-amber-500 to-yellow-600',
    borderClass: 'border-amber-400 dark:border-amber-600',
    accentClass: 'text-amber-800 dark:text-amber-300',
    icon: 'workspace_premium',
    rewardsMultiplier: '1.5x Points',
  },
  {
    tier: 'platinum',
    name: 'Platinum',
    tagline: 'The ultimate luxury salon VIP experience with max savings',
    benefitPercent: 15,
    benefitHeadline: '15% benefit',
    bullets: [
      '15% benefit',
      'Highest benefits',
      'Priority support',
      'Premium offers',
      'Best partner rewards',
    ],
    pointsRequired: 4000,
    spendRequired: 20000,
    unlockDescription: '4,000 loyalty points or ₹20,000 spend at partner shops',
    badgeLabel: 'Platinum VIP · Elite',
    gradientClass: 'from-purple-900 via-primary to-[#b00055]',
    borderClass: 'border-purple-400 dark:border-purple-600',
    accentClass: 'text-purple-800 dark:text-purple-300',
    icon: 'diamond',
    rewardsMultiplier: '2x Double Points',
  },
];

export function getMembershipCards(): MembershipCardConfig[] {
  return MEMBERSHIP_TIERS;
}

export function getTierConfig(tier: MembershipTier): MembershipCardConfig | null {
  return MEMBERSHIP_TIERS.find((t) => t.tier === tier) || null;
}

export interface TierProgressResult {
  currentTier: MembershipTier;
  currentTierName: string;
  currentDiscountPercent: number;
  nextTier: MembershipCardConfig | null;
  progressPercent: number;
  pointsNeeded: number;
  spendNeeded: number;
  isMaxTier: boolean;
}

export function calculateTierProgress(
  currentPoints: number,
  currentSpend: number = 0,
  currentTier: MembershipTier = 'standard'
): TierProgressResult {
  const points = Math.max(0, currentPoints);
  const spend = Math.max(0, currentSpend);

  let nextTierConfig: MembershipCardConfig | null = null;
  let targetPoints = 500;
  let targetSpend = 3000;
  let basePoints = 0;

  if (currentTier === 'standard') {
    nextTierConfig = MEMBERSHIP_TIERS[0]; // Silver
    targetPoints = 500;
    targetSpend = 3000;
    basePoints = 0;
  } else if (currentTier === 'silver') {
    nextTierConfig = MEMBERSHIP_TIERS[1]; // Gold
    targetPoints = 1500;
    targetSpend = 8000;
    basePoints = 500;
  } else if (currentTier === 'gold') {
    nextTierConfig = MEMBERSHIP_TIERS[2]; // Platinum
    targetPoints = 4000;
    targetSpend = 20000;
    basePoints = 1500;
  } else {
    // Platinum is max
    return {
      currentTier: 'platinum',
      currentTierName: 'Platinum VIP',
      currentDiscountPercent: 15,
      nextTier: null,
      progressPercent: 100,
      pointsNeeded: 0,
      spendNeeded: 0,
      isMaxTier: true,
    };
  }

  const pointsNeeded = Math.max(0, targetPoints - points);
  const spendNeeded = Math.max(0, targetSpend - spend);

  const pointsProgress = Math.min(
    100,
    Math.max(0, Math.round(((points - basePoints) / (targetPoints - basePoints)) * 100))
  );

  const currentDiscountPercent =
    currentTier === 'silver' ? 5 : currentTier === 'gold' ? 10 : 0;

  const currentTierName =
    currentTier === 'gold'
      ? 'Gold Member'
      : currentTier === 'silver'
        ? 'Silver Member'
        : 'Standard Guest';

  return {
    currentTier,
    currentTierName,
    currentDiscountPercent,
    nextTier: nextTierConfig,
    progressPercent: pointsProgress,
    pointsNeeded,
    spendNeeded,
    isMaxTier: false,
  };
}

/**
 * Filter salons eligible for Nexora partner membership benefits
 */
export function getEligiblePartnerSalons(salons: Salon[], areaFilter: string = 'all'): Salon[] {
  return salons.filter((s) => {
    if (areaFilter !== 'all') {
      const area = (s.location.area || '').toLowerCase();
      if (!area.includes(areaFilter.toLowerCase())) {
        return false;
      }
    }
    return true;
  });
}

// =============================================================================
// LIVE SUPABASE MEMBERSHIP
// =============================================================================
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase, isLiveCustomerDataEnabled, isSupabaseConfigured } from './supabase';
import { SALONOS_TABLES } from './supabase/tables';

export interface MembershipRecord {
  id?: string;
  userId: string;
  tier: MembershipTier;
  points: number;
  spend: number;
  expiresAt?: string;
  startedAt?: string;
  status?: string;
}

function membershipTierFromRaw(raw: unknown): MembershipTier {
  const value = String(raw || 'standard').toLowerCase();
  if (value === 'silver' || value === 'gold' || value === 'platinum') return value;
  return 'standard';
}

/**
 * Load the customer's active `memberships` row (only their own).
 */
export async function loadMembership(
  userId: string,
  client: SupabaseClient | null = supabase
): Promise<MembershipRecord | null> {
  if (!client || !isSupabaseConfigured || !isLiveCustomerDataEnabled || !userId) return null;
  try {
    const query = client.from(SALONOS_TABLES.memberships).select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1);
    const { data, error } = await query.maybeSingle();
    if (error || !data) return null;
    const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
    return {
      id: typeof row.id === 'string' ? row.id : undefined,
      userId,
      tier: membershipTierFromRaw(row.tier ?? row.membership_tier),
      points: Number(row.points ?? row.loyalty_points ?? 0) || 0,
      spend: Number(row.spend ?? row.total_spend ?? 0) || 0,
      expiresAt: typeof row.expires_at === 'string' ? row.expires_at : undefined,
      startedAt: typeof row.started_at === 'string' ? row.started_at : undefined,
      status: typeof row.status === 'string' ? row.status : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Activate/update the customer's membership row (own row only, RLS enforced).
 */
export async function saveMembership(
  userId: string,
  membership: Pick<MembershipRecord, 'tier' | 'points' | 'spend' | 'expiresAt'>,
  client: SupabaseClient | null = supabase
): Promise<{ error: string | null }> {
  if (!client || !isSupabaseConfigured || !isLiveCustomerDataEnabled || !userId) {
    return { error: 'Live Supabase membership service is not configured.' };
  }
  const payload = {
    user_id: userId,
    customer_id: userId,
    tier: membership.tier,
    memberships_tier: membership.tier,
    points: membership.points,
    loyalty_points: membership.points,
    spend: membership.spend,
    total_spend: membership.spend,
    expires_at: membership.expiresAt || null,
    status: 'active',
    updated_at: new Date().toISOString(),
  };
  const upsert = await client.from(SALONOS_TABLES.memberships).upsert(payload, { onConflict: 'user_id' });
  if (!upsert.error) return { error: null };

  // If the deployment lacks a unique `user_id` constraint, update the existing
  // row first, otherwise insert a new one. Never silently create a duplicate.
  const existing = await client
    .from(SALONOS_TABLES.memberships)
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (existing.error || !existing.data) {
    const insert = await client.from(SALONOS_TABLES.memberships).insert(payload);
    return { error: insert.error?.message || null };
  }
  const rowId = String((existing.data as Record<string, unknown>).id || '');
  const update = await client
    .from(SALONOS_TABLES.memberships)
    .update(payload)
    .eq('id', rowId);
  return { error: update.error?.message || null };
}
