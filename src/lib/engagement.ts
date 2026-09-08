/**
 * Nexora Engagement rules — pure, shared by the browser bundle, the Node
 * engagement service (`server/engagement.ts`) and unit tests. No React, no
 * DOM, no Supabase. Mirrors the SQL constants/comments in supabase/setup.sql
 * (engagement section) so code and schema cannot drift apart silently.
 *
 * Business rules
 * --------------
 *  - Booking rewards: 10% of the final bill, rounded DOWN, awarded when a
 *    booking transitions into confirmed/completed (DB trigger enforces
 *    once-per-booking).
 *  - QR salon check-in: a daily visit reward (10 points) per salon per day.
 *  - Referral: 150 points to the referrer when the referred friend's first
 *    booking is confirmed.
 *  - Birthday: 200 points once per calendar year when date_of_birth matches.
 *  - Tiers from LIFETIME points: standard 0 · silver 500 · gold 1,500 ·
 *    platinum 4,000 (discounts 0 / 5 / 10 / 15 %).
 *  - QR payload: `NXQR1.<userId>.<randomBase64Url>` — parse/validate helpers
 *    here so generation, scanning and tests share one format.
 */

import type { MembershipTier } from '../types';

// ---------------------------------------------------------------------------
// Points & tier constants
// ---------------------------------------------------------------------------

export const BOOKING_POINTS_PERCENT = 10;
export const QR_CHECK_IN_POINTS = 10;
export const REFERRAL_BONUS_POINTS = 150;
export const BIRTHDAY_BONUS_POINTS = 200;
export const POINTS_EXPIRY_DAYS = 90; // awarded points expire after 90 days

export const TIER_MIN_POINTS: Record<MembershipTier, number> = {
  standard: 0,
  silver: 500,
  gold: 1500,
  platinum: 4000,
};

export const TIER_DISCOUNT_PERCENT: Record<MembershipTier, number> = {
  standard: 0,
  silver: 5,
  gold: 10,
  platinum: 15,
};

export const TIER_ORDER: MembershipTier[] = ['standard', 'silver', 'gold', 'platinum'];

// ---------------------------------------------------------------------------
// Points math
// ---------------------------------------------------------------------------

/** Booking earn = floor(total × 10%). Matches the SQL trigger exactly. */
export function bookingRewardPoints(totalAmountInr: number): number {
  const total = Number(totalAmountInr);
  if (!Number.isFinite(total) || total < 0) return 0;
  return Math.floor(total * (BOOKING_POINTS_PERCENT / 100));
}

/** Daily salon check-in reward (fixed). */
export function checkInRewardPoints(): number {
  return QR_CHECK_IN_POINTS;
}

export function referralRewardPoints(): number {
  return REFERRAL_BONUS_POINTS;
}

export function birthdayRewardPoints(): number {
  return BIRTHDAY_BONUS_POINTS;
}

// ---------------------------------------------------------------------------
// Tier math
// ---------------------------------------------------------------------------

export interface TierState {
  tier: MembershipTier;
  tierName: string;
  discountPercent: number;
  lifetimePoints: number;
  pointsToNext: number; // 0 when at max tier
  nextTier: MembershipTier | null;
  nextTierMinPoints: number | null;
  progressPercent: number; // 0..100 toward the next tier
}

const TIER_LABEL: Record<MembershipTier, string> = {
  standard: 'Standard Guest',
  silver: 'Silver Member',
  gold: 'Gold Member',
  platinum: 'Platinum VIP',
};

/** Derive the tier for a lifetime-points total (mirrors SQL sync trigger). */
export function tierForLifetimePoints(lifetimePoints: number): MembershipTier {
  const points = Math.max(0, Math.floor(Number(lifetimePoints) || 0));
  let current: MembershipTier = 'standard';
  for (const tier of TIER_ORDER) {
    if (points >= TIER_MIN_POINTS[tier]) current = tier;
  }
  return current;
}

/** Full tier state incl. progress to the next tier. */
export function computeTierState(lifetimePoints: number): TierState {
  const points = Math.max(0, Math.floor(Number(lifetimePoints) || 0));
  const tier = tierForLifetimePoints(points);
  const tierIndex = TIER_ORDER.indexOf(tier);
  const nextTier: MembershipTier | null =
    tierIndex >= 0 && tierIndex < TIER_ORDER.length - 1 ? TIER_ORDER[tierIndex + 1] : null;

  if (!nextTier) {
    return {
      tier,
      tierName: TIER_LABEL[tier],
      discountPercent: TIER_DISCOUNT_PERCENT[tier],
      lifetimePoints: points,
      pointsToNext: 0,
      nextTier: null,
      nextTierMinPoints: null,
      progressPercent: 100,
    };
  }

  const base = TIER_MIN_POINTS[tier];
  const target = TIER_MIN_POINTS[nextTier];
  const progressPercent = Math.min(
    100,
    Math.max(0, Math.round(((points - base) / (target - base)) * 100))
  );
  return {
    tier,
    tierName: TIER_LABEL[tier],
    discountPercent: TIER_DISCOUNT_PERCENT[tier],
    lifetimePoints: points,
    pointsToNext: Math.max(0, target - points),
    nextTier,
    nextTierMinPoints: target,
    progressPercent,
  };
}

// ---------------------------------------------------------------------------
// QR payload format: NXQR1.<userId>.<base64url nonce>
// ---------------------------------------------------------------------------

export const QR_CODE_PREFIX = 'NXQR1';
export const QR_CODE_MAX_LENGTH = 220;

export interface ParsedQrCode {
  ok: boolean;
  userId?: string;
  nonce?: string;
  raw?: string;
  error?: string;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Cryptographically random 18-byte nonce in base64url. */
export function randomNonce(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export function buildQrCode(userId: string, nonce?: string): string {
  const cleanUserId = String(userId ?? '').trim();
  if (!cleanUserId) throw new Error('buildQrCode: userId is required');
  const cleanNonce = nonce && /^[A-Za-z0-9_-]+$/.test(nonce) ? nonce : randomNonce();
  return `${QR_CODE_PREFIX}.${cleanUserId}.${cleanNonce}`;
}

/** Strict parser used by the check-in endpoint and by tests. */
export function parseQrCode(code: unknown): ParsedQrCode {
  if (typeof code !== 'string') return { ok: false, error: 'QR code must be a string' };
  const raw = code.trim();
  if (!raw || raw.length > QR_CODE_MAX_LENGTH) {
    return { ok: false, error: 'QR code has an invalid length' };
  }
  const parts = raw.split('.');
  if (parts.length !== 3 || parts[0] !== QR_CODE_PREFIX) {
    return { ok: false, error: 'QR code is not a Nexora code' };
  }
  const userId = parts[1];
  const nonce = parts[2];
  const uuidLike = /^[0-9a-fA-F-]{8,64}$/.test(userId);
  if (!uuidLike || !/^[A-Za-z0-9_-]{8,64}$/.test(nonce)) {
    return { ok: false, error: 'QR code payload is malformed' };
  }
  return { ok: true, userId, nonce, raw };
}

// ---------------------------------------------------------------------------
// Birthday helpers
// ---------------------------------------------------------------------------

export interface BirthdayCheck {
  isBirthday: boolean;
  monthDay?: string; // "MM-DD"
}

/** True when the profile date (YYYY-MM-DD or Date) falls on the given day. */
export function isBirthdayOn(dob: string | Date | null | undefined, on: Date = new Date()): boolean {
  if (!dob) return false;
  const parsed = typeof dob === 'string' ? new Date(`${dob}T00:00:00`) : dob;
  if (Number.isNaN(parsed.getTime())) return false;
  return (
    parsed.getMonth() === on.getMonth() &&
    parsed.getDate() === on.getDate()
  );
}

/** Calendar-day key (YYYY-MM-DD) for a Date — used for daily check-in limits. */
export function dayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ---------------------------------------------------------------------------
// DB row shapes (engagement tables — mirrors supabase/setup.sql)
// ---------------------------------------------------------------------------

export type RewardTxType =
  | 'booking'
  | 'qr_check_in'
  | 'referral'
  | 'birthday'
  | 'bonus'
  | 'redemption'
  | 'expiry'
  | 'adjustment';

export interface RewardRow {
  id: string;
  user_id: string;
  points_earned: number;
  transaction_type: RewardTxType;
  description?: string | null;
  salon_id?: string | null;
  booking_id?: string | null;
  referral_id?: string | null;
  created_at: string;
}

export interface QrCodeRow {
  id: string;
  user_id: string;
  qr_code_data: string;
  generated_at: string;
  last_scanned_at?: string | null;
}

export interface CheckInRow {
  id: string;
  user_id: string;
  salon_id: string;
  salon_name: string;
  points_awarded: number;
  day_date: string;
  checked_in_at: string;
}

export interface UserMembershipRow {
  user_id: string;
  tier_name: MembershipTier;
  lifetime_points: number;
  current_points: number;
  updated_at: string;
}

export interface ReferralRow {
  id: string;
  referrer_user_id: string;
  referred_user_id: string;
  referred_name?: string | null;
  status: 'pending' | 'completed';
  reward_points: number;
  qualifying_booking_id?: string | null;
  created_at: string;
  completed_at?: string | null;
}

// ---------------------------------------------------------------------------
// Engagement summary (what GET /api/engagement/summary/:userId returns)
// ---------------------------------------------------------------------------

export interface EngagementSummary {
  userId: string;
  qr: { exists: boolean; generatedAt?: string; lastScannedAt?: string | null };
  tier: TierState;
  currentPoints: number;
  lifetimePoints: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  pendingBonusPoints: number;
  checkInsThisMonth: number;
  totalCheckIns: number;
  referralCount: {
    total: number;
    completed: number;
    pending: number;
    pendingBonusPoints: number;
  };
  recentTransactions: RewardRow[];
}

/** Aggregate raw reward rows into a summary (pure; used by the server). */
export function buildEngagementSummary(input: {
  userId: string;
  rewards: RewardRow[];
  checkIns: CheckInRow[];
  referrals: ReferralRow[];
  qr?: QrCodeRow | null;
  memberships?: UserMembershipRow | null;
}): EngagementSummary {
  const rewards = input.rewards || [];
  const checkIns = input.checkIns || [];
  const referrals = input.referrals || [];
  const memberships = input.memberships || null;

  const lifetimeEarned = rewards
    .filter((r) => r.points_earned > 0)
    .reduce((sum, r) => sum + r.points_earned, 0);
  const lifetimeRedeemed = rewards
    .filter((r) => r.points_earned < 0)
    .reduce((sum, r) => sum + Math.abs(r.points_earned), 0);

  const lifetimePoints = memberships
    ? memberships.lifetime_points
    : lifetimeEarned;
  const currentPoints = memberships ? memberships.current_points : lifetimeEarned - lifetimeRedeemed;

  const tier = computeTierState(lifetimePoints);

  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const checkInsThisMonth = checkIns.filter((c) =>
    (c.day_date || '').startsWith(monthPrefix)
  ).length;

  return {
    userId: input.userId,
    qr: input.qr
      ? { exists: true, generatedAt: input.qr.generated_at, lastScannedAt: input.qr.last_scanned_at ?? null }
      : { exists: false },
    tier,
    currentPoints: Math.max(0, currentPoints),
    lifetimePoints: Math.max(0, lifetimePoints),
    lifetimeEarned,
    lifetimeRedeemed,
    pendingBonusPoints: referrals
      .filter((r) => r.status === 'pending')
      .reduce((sum, r) => sum + r.reward_points, 0),
    checkInsThisMonth,
    totalCheckIns: checkIns.length,
    referralCount: {
      total: referrals.length,
      completed: referrals.filter((r) => r.status === 'completed').length,
      pending: referrals.filter((r) => r.status === 'pending').length,
      pendingBonusPoints: referrals
        .filter((r) => r.status === 'pending')
        .reduce((sum, r) => sum + r.reward_points, 0),
    },
    recentTransactions: [...rewards]
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, 10),
  };
}

// ---------------------------------------------------------------------------
// Transaction type labels (DB → display; mirrors rewardsService wallet copy)
// ---------------------------------------------------------------------------

export const REWARD_TYPE_LABELS: Record<RewardTxType, string> = {
  booking: 'Booking Reward',
  qr_check_in: 'Salon Check-in',
  referral: 'Referral Reward',
  birthday: 'Birthday Bonus',
  bonus: 'Bonus Points',
  redemption: 'In-Shop QR Redemption',
  expiry: 'Expired Points',
  adjustment: 'Adjustment',
};
