/**
 * Nexora Customer Referral Service
 *
 * Referral Rules:
 * 1. Customer gets referral points only when referred user makes minimum ₹100 QR payment at Nexora partner shop.
 * 2. Referral rewards are not cash (no cash withdrawal).
 * 3. Rewards can be redeemed only at partner shops.
 */

export interface ReferralRecord {
  id: string;
  friendName: string;
  friendMobile?: string;
  friendAvatar?: string;
  invitedDate: string;
  completedDate?: string;
  status: 'completed' | 'pending';
  rewardPoints: number;
  qualifyingPaymentAmount?: number;
  salonName?: string;
}

export interface ReferralSummary {
  referralCode: string;
  referralLink: string;
  totalInvited: number;
  successfulReferrals: number;
  pendingReferrals: number;
  rewardEarned: number;
  friends: ReferralRecord[];
}

export const MIN_QUALIFYING_QR_PAYMENT = 100;
export const REFERRAL_POINTS_PER_INVITE = 150;

export const DEFAULT_REFERRAL_RECORDS: ReferralRecord[] = [
  {
    id: 'ref-01',
    friendName: 'Rahul Verma',
    friendMobile: '+91 98291 •••••',
    friendAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80',
    invitedDate: '15 Aug 2026',
    completedDate: '20 Aug 2026',
    status: 'completed',
    rewardPoints: 150,
    qualifyingPaymentAmount: 450,
    salonName: 'Nexora Signature C-Scheme',
  },
  {
    id: 'ref-02',
    friendName: 'Priya Sen',
    friendMobile: '+91 98292 •••••',
    friendAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80',
    invitedDate: '22 Aug 2026',
    completedDate: '28 Aug 2026',
    status: 'completed',
    rewardPoints: 150,
    qualifyingPaymentAmount: 1200,
    salonName: 'Scissors & Shears Salon',
  },
  {
    id: 'ref-03',
    friendName: 'Vikram Rathore',
    friendMobile: '+91 98293 •••••',
    friendAvatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=120&q=80',
    invitedDate: '01 Sep 2026',
    completedDate: '04 Sep 2026',
    status: 'completed',
    rewardPoints: 150,
    qualifyingPaymentAmount: 350,
    salonName: 'Luxe Beauty Lounge',
  },
  {
    id: 'ref-04',
    friendName: 'Neha Meena',
    friendMobile: '+91 98294 •••••',
    friendAvatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=120&q=80',
    invitedDate: '05 Sep 2026',
    status: 'pending',
    rewardPoints: 150,
    salonName: 'Awaiting first ₹100+ QR payment',
  },
  {
    id: 'ref-05',
    friendName: 'Amit Joshi',
    friendMobile: '+91 98295 •••••',
    friendAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80',
    invitedDate: '06 Sep 2026',
    status: 'pending',
    rewardPoints: 150,
    salonName: 'Awaiting first ₹100+ QR payment',
  },
];

const STORAGE_PREFIX = 'nexora_customer_referrals';

export function getReferralStorageKey(userId?: string): string {
  return userId ? `${STORAGE_PREFIX}_${userId}` : STORAGE_PREFIX;
}

export function loadReferralRecords(userId?: string): ReferralRecord[] {
  if (typeof window === 'undefined') return DEFAULT_REFERRAL_RECORDS;
  try {
    const raw = localStorage.getItem(getReferralStorageKey(userId));
    if (!raw) return DEFAULT_REFERRAL_RECORDS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_REFERRAL_RECORDS;
  } catch {
    return DEFAULT_REFERRAL_RECORDS;
  }
}

export function saveReferralRecords(records: ReferralRecord[], userId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getReferralStorageKey(userId), JSON.stringify(records));
  } catch (err) {
    console.warn('[Nexora] Could not save referral records to localStorage', err);
  }
}

export function computeReferralSummary(
  code: string,
  records: ReferralRecord[]
): ReferralSummary {
  const completed = records.filter((r) => r.status === 'completed');
  const pending = records.filter((r) => r.status === 'pending');
  const rewardEarned = completed.reduce((sum, r) => sum + (r.rewardPoints || 0), 0);

  return {
    referralCode: code,
    referralLink: `https://nexora.app/invite?code=${encodeURIComponent(code)}`,
    totalInvited: records.length,
    successfulReferrals: completed.length,
    pendingReferrals: pending.length,
    rewardEarned,
    friends: records,
  };
}
