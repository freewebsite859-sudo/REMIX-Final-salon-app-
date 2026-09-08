/**
 * Nexora Rewards Wallet Service
 *
 * Business Rules:
 * 1. Rewards are earned ONLY when customer pays through Nexora QR at a partner shop.
 * 2. Referral or reward points count ONLY after minimum ₹100 QR payment.
 * 3. Cashback is reward points for salon services, NOT a cash withdrawal.
 * 4. Rewards can be redeemed ONLY at Nexora partner shops via QR.
 * 5. No direct bank withdrawal for customers.
 *
 * Statuses:
 * - Pending: Awaiting salon counter settlement or friend's qualifying ₹100+ QR payment.
 * - Approved: Active and available for in-shop QR redemption.
 * - Redeemed: Applied against a qualifying salon bill via QR.
 * - Expired: Not redeemed within the validity window.
 *
 * When a real Supabase project is configured this service reads and writes the
 * canonical `reward_wallets`, `reward_transactions`, `customer_qr_payments`,
 * `offers` and `offer_redemptions` tables. The legacy localStorage functions
 * remain only for the unconfigured local preview/builds.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase, isLiveCustomerDataEnabled, isSupabaseConfigured } from './supabase';
import { SALONOS_TABLES } from './supabase/tables';

export type RewardStatus = 'Pending' | 'Approved' | 'Redeemed' | 'Expired';

export type RewardType =
  | 'qr_payment'
  | 'referral'
  | 'redemption'
  | 'expired'
  | 'bonus';

export interface RewardTransaction {
  id: string;
  type: RewardType;
  typeLabel: string; // e.g. "QR Payment Reward", "Referral Reward", "In-Shop QR Redemption", "Expired Points"
  points: number; // Positive for earned, negative for redeemed/expired
  date: string; // Display date e.g. "05 Sep 2026"
  createdAt: string; // ISO date string
  salonName: string; // Partner salon name
  salonId?: string;
  status: RewardStatus;
  billAmount?: number; // In-shop bill amount in INR
  description?: string;
  expiresAt?: string; // Expiry date display string
  friendName?: string; // For referral rewards
  qrTransactionRef?: string; // QR reference code
  qualifyingPaymentMade?: boolean;
}

export interface RewardWalletSummary {
  currentPoints: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  qrPaymentRewards: number;
  referralRewards: number;
  expiringPoints: number;
  nextExpiryDate?: string;
  pendingPoints: number;
  expiredPoints: number;
  transactions: RewardTransaction[];
}

export const MIN_QR_PAYMENT_INR = 100;
export const QR_CASHBACK_PERCENT = 10; // 10% cashback on qualifying QR payments
export const REFERRAL_BONUS_POINTS = 150; // Points awarded for friend's qualifying ₹100+ QR payment
export const POINTS_TO_INR_RATIO = 1; // 1 Point = ₹1 discount at partner shop

const STORAGE_KEY_PREFIX = 'nexora-rewards-wallet';

function getStorageKey(userId?: string): string {
  return userId ? `${STORAGE_KEY_PREFIX}:${userId}` : STORAGE_KEY_PREFIX;
}

/**
 * Default realistic seed transactions for Jaipur partner salons
 */
export function getDefaultSeedTransactions(): RewardTransaction[] {
  return [
    {
      id: 'rwd-seed-01',
      type: 'qr_payment',
      typeLabel: 'QR Payment Reward',
      points: 80,
      date: '05 Sep 2026',
      createdAt: '2026-09-05T11:30:00.000Z',
      salonName: 'Nexora Signature C-Scheme',
      salonId: 'salon-1',
      status: 'Approved',
      billAmount: 800,
      description: '10% cashback on ₹800 QR payment for Hair Spa & Styling',
      expiresAt: '05 Dec 2026',
      qrTransactionRef: 'NX-QR-98214',
      qualifyingPaymentMade: true,
    },
    {
      id: 'rwd-seed-02',
      type: 'referral',
      typeLabel: 'Referral Reward',
      points: 150,
      date: '02 Sep 2026',
      createdAt: '2026-09-02T16:45:00.000Z',
      salonName: 'Style Lounge Mansarovar',
      salonId: 'salon-2',
      status: 'Approved',
      billAmount: 650,
      friendName: 'Pooja Verma',
      description: 'Friend completed qualifying ₹650 QR payment',
      expiresAt: '02 Dec 2026',
      qrTransactionRef: 'NX-QR-94103',
      qualifyingPaymentMade: true,
    },
    {
      id: 'rwd-seed-03',
      type: 'qr_payment',
      typeLabel: 'QR Payment Reward',
      points: 120,
      date: '28 Aug 2026',
      createdAt: '2026-08-28T14:15:00.000Z',
      salonName: 'Glow & Shine Studio Vaishali',
      salonId: 'salon-3',
      status: 'Approved',
      billAmount: 1200,
      description: '10% cashback on ₹1,200 Hydra Facial Deluxe via QR',
      expiresAt: '28 Nov 2026',
      qrTransactionRef: 'NX-QR-89512',
      qualifyingPaymentMade: true,
    },
    {
      id: 'rwd-seed-04',
      type: 'redemption',
      typeLabel: 'In-Shop QR Redemption',
      points: -150,
      date: '20 Aug 2026',
      createdAt: '2026-08-20T18:00:00.000Z',
      salonName: 'Mirrors Luxury Salon Malviya Nagar',
      salonId: 'salon-4',
      status: 'Redeemed',
      billAmount: 850,
      description: 'Redeemed 150 points (₹150 discount) on ₹850 QR bill',
      qrTransactionRef: 'NX-QR-86201',
    },
    {
      id: 'rwd-seed-05',
      type: 'expired',
      typeLabel: 'Expired Points',
      points: -50,
      date: '15 Aug 2026',
      createdAt: '2026-08-15T00:00:00.000Z',
      salonName: 'Urban Cut Raja Park',
      salonId: 'salon-5',
      status: 'Expired',
      description: 'Points expired after 90 days validity period',
    },
    {
      id: 'rwd-seed-06',
      type: 'qr_payment',
      typeLabel: 'QR Payment Reward',
      points: 65,
      date: '06 Sep 2026',
      createdAt: '2026-09-06T10:00:00.000Z',
      salonName: 'Style Lounge Mansarovar',
      salonId: 'salon-2',
      status: 'Pending',
      billAmount: 650,
      description: 'QR payment ₹650 awaiting partner shop counter verification',
      qrTransactionRef: 'NX-QR-99321',
      qualifyingPaymentMade: true,
    },
    {
      id: 'rwd-seed-07',
      type: 'referral',
      typeLabel: 'Referral Reward',
      points: 150,
      date: '06 Sep 2026',
      createdAt: '2026-09-06T12:30:00.000Z',
      salonName: 'Partner Salon QR',
      status: 'Pending',
      friendName: 'Rahul Sharma',
      description: 'Pending Rahul’s first minimum ₹100 QR payment at partner salon',
      qualifyingPaymentMade: false,
    },
    {
      id: 'rwd-seed-08',
      type: 'qr_payment',
      typeLabel: 'QR Payment Reward (Expiring Soon)',
      points: 50,
      date: '01 Jul 2026',
      createdAt: '2026-07-01T15:20:00.000Z',
      salonName: 'Nexora Signature C-Scheme',
      salonId: 'salon-1',
      status: 'Approved',
      billAmount: 500,
      description: '10% cashback on ₹500 QR payment — Expiring soon',
      expiresAt: '30 Sep 2026',
      qrTransactionRef: 'NX-QR-71204',
      qualifyingPaymentMade: true,
    },
  ];
}

/**
 * Format a Date object or ISO string to e.g. "05 Sep 2026"
 */
export function formatRewardDate(dateInput: string | Date = new Date()): string {
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return String(dateInput);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(dateInput);
  }
}

/**
 * Check if a QR payment amount qualifies for rewards (Minimum ₹100 rule)
 */
export function isQrPaymentEligible(amountInr: number): boolean {
  return Number.isFinite(amountInr) && amountInr >= MIN_QR_PAYMENT_INR;
}

/**
 * Calculate reward points earned on a QR payment (10% of bill, min ₹100 required)
 */
export function calculateQrPoints(amountInr: number): number {
  if (!isQrPaymentEligible(amountInr)) {
    return 0;
  }
  return Math.max(1, Math.round((amountInr * QR_CASHBACK_PERCENT) / 100));
}

/**
 * Load stored reward transactions from localStorage, or return seed defaults
 */
export function getStoredRewardTransactions(userId?: string): RewardTransaction[] {
  if (typeof window === 'undefined') {
    return getDefaultSeedTransactions();
  }
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) {
      const defaults = getDefaultSeedTransactions();
      saveRewardTransactions(userId, defaults);
      return defaults;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const defaults = getDefaultSeedTransactions();
      saveRewardTransactions(userId, defaults);
      return defaults;
    }
    return parsed as RewardTransaction[];
  } catch {
    return getDefaultSeedTransactions();
  }
}

/**
 * Save reward transactions to localStorage
 */
export function saveRewardTransactions(
  userId: string | undefined,
  transactions: RewardTransaction[]
): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(transactions));
  } catch {
    /* storage full or unavailable */
  }
}

/**
 * Reset to default initial demo transactions
 */
export function resetRewardsToDemo(userId?: string): RewardTransaction[] {
  const defaults = getDefaultSeedTransactions();
  saveRewardTransactions(userId, defaults);
  return defaults;
}

/**
 * Calculate summary metrics from list of transactions
 */
export function calculateWalletSummary(
  transactions: RewardTransaction[]
): RewardWalletSummary {
  let lifetimeEarned = 0;
  let lifetimeRedeemed = 0;
  let qrPaymentRewards = 0;
  let referralRewards = 0;
  let pendingPoints = 0;
  let expiredPoints = 0;
  let expiringPoints = 0;
  let nextExpiryDate: string | undefined = undefined;

  for (const tx of transactions) {
    if (tx.status === 'Approved') {
      if (tx.points > 0) {
        lifetimeEarned += tx.points;
        if (tx.type === 'qr_payment') {
          qrPaymentRewards += tx.points;
        } else if (tx.type === 'referral') {
          referralRewards += tx.points;
        } else if (tx.type === 'bonus') {
          qrPaymentRewards += tx.points;
        }
      }
      if (tx.expiresAt) {
        expiringPoints += tx.points;
        if (!nextExpiryDate) {
          nextExpiryDate = tx.expiresAt;
        }
      }
    } else if (tx.status === 'Redeemed' || tx.type === 'redemption') {
      lifetimeRedeemed += Math.abs(tx.points);
    } else if (tx.status === 'Expired' || tx.type === 'expired') {
      expiredPoints += Math.abs(tx.points);
    } else if (tx.status === 'Pending') {
      if (tx.points > 0) {
        pendingPoints += tx.points;
      }
    }
  }

  // Current balance is Approved earned minus redeemed and expired
  const currentPoints = Math.max(0, lifetimeEarned - lifetimeRedeemed - expiredPoints);

  return {
    currentPoints,
    lifetimeEarned,
    lifetimeRedeemed,
    qrPaymentRewards,
    referralRewards,
    expiringPoints,
    nextExpiryDate: nextExpiryDate || '30 Sep 2026',
    pendingPoints,
    expiredPoints,
    transactions,
  };
}

/**
 * Record a new QR Payment reward transaction
 */
export function addQrPaymentReward(params: {
  userId?: string;
  salonName: string;
  salonId?: string;
  amountInr: number;
  status?: RewardStatus;
  description?: string;
}): {
  success: boolean;
  transaction?: RewardTransaction;
  pointsEarned: number;
  eligible: boolean;
  message: string;
} {
  const {
    userId,
    salonName,
    salonId,
    amountInr,
    status = 'Approved',
    description,
  } = params;

  if (!isQrPaymentEligible(amountInr)) {
    return {
      success: false,
      pointsEarned: 0,
      eligible: false,
      message: `Minimum ₹${MIN_QR_PAYMENT_INR} QR payment required to earn rewards. Bill of ₹${amountInr} does not qualify.`,
    };
  }

  const pointsEarned = calculateQrPoints(amountInr);
  const now = new Date();
  const dateStr = formatRewardDate(now);

  const expiryDate = new Date(now);
  expiryDate.setDate(expiryDate.getDate() + 90);
  const expiresAtStr = formatRewardDate(expiryDate);

  const newTx: RewardTransaction = {
    id: `rwd-qr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    type: 'qr_payment',
    typeLabel: 'QR Payment Reward',
    points: pointsEarned,
    date: dateStr,
    createdAt: now.toISOString(),
    salonName: salonName || 'Nexora Partner Salon',
    salonId,
    status,
    billAmount: amountInr,
    description:
      description ||
      `10% cashback on ₹${amountInr.toLocaleString('en-IN')} QR payment at ${salonName}`,
    expiresAt: status === 'Approved' ? expiresAtStr : undefined,
    qrTransactionRef: `NX-QR-${Math.floor(10000 + Math.random() * 90000)}`,
    qualifyingPaymentMade: true,
  };

  const stored = getStoredRewardTransactions(userId);
  const updated = [newTx, ...stored];
  saveRewardTransactions(userId, updated);

  return {
    success: true,
    transaction: newTx,
    pointsEarned,
    eligible: true,
    message: `Earned ${pointsEarned} reward points on ₹${amountInr} QR payment at ${salonName}!`,
  };
}

/**
 * Record a referral reward
 */
export function addReferralReward(params: {
  userId?: string;
  friendName: string;
  salonName?: string;
  amountInr?: number;
  status?: RewardStatus;
}): {
  success: boolean;
  transaction?: RewardTransaction;
  pointsEarned: number;
  eligible: boolean;
  message: string;
} {
  const {
    userId,
    friendName,
    salonName = 'Nexora Partner Salon',
    amountInr = 250,
    status = 'Approved',
  } = params;

  if (amountInr < MIN_QR_PAYMENT_INR) {
    return {
      success: false,
      pointsEarned: 0,
      eligible: false,
      message: `Referral rewards count only after your friend's minimum ₹${MIN_QR_PAYMENT_INR} QR payment at a partner shop.`,
    };
  }

  const now = new Date();
  const dateStr = formatRewardDate(now);

  const expiryDate = new Date(now);
  expiryDate.setDate(expiryDate.getDate() + 90);
  const expiresAtStr = formatRewardDate(expiryDate);

  const newTx: RewardTransaction = {
    id: `rwd-ref-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    type: 'referral',
    typeLabel: 'Referral Reward',
    points: REFERRAL_BONUS_POINTS,
    date: dateStr,
    createdAt: now.toISOString(),
    salonName,
    status,
    billAmount: amountInr,
    friendName,
    description: `Referral bonus: ${friendName} completed ₹${amountInr} QR payment`,
    expiresAt: status === 'Approved' ? expiresAtStr : undefined,
    qrTransactionRef: `NX-QR-${Math.floor(10000 + Math.random() * 90000)}`,
    qualifyingPaymentMade: true,
  };

  const stored = getStoredRewardTransactions(userId);
  const updated = [newTx, ...stored];
  saveRewardTransactions(userId, updated);

  return {
    success: true,
    transaction: newTx,
    pointsEarned: REFERRAL_BONUS_POINTS,
    eligible: true,
    message: `Earned ${REFERRAL_BONUS_POINTS} referral points from ${friendName}’s qualifying QR payment!`,
  };
}

/**
 * Redeem rewards via QR at a partner salon
 *
 * Rules:
 * - Bill must be >= ₹100
 * - Points must be <= current balance
 * - Points must be <= bill amount
 * - No direct bank withdrawal (partner QR only)
 */
export function redeemRewardsViaQr(params: {
  userId?: string;
  salonName: string;
  salonId?: string;
  billAmount: number;
  pointsToRedeem: number;
}): {
  success: boolean;
  transaction?: RewardTransaction;
  error?: string;
  remainingPoints?: number;
  netPayableInr?: number;
} {
  const { userId, salonName, salonId, billAmount, pointsToRedeem } = params;

  if (!Number.isFinite(billAmount) || billAmount < MIN_QR_PAYMENT_INR) {
    return {
      success: false,
      error: `Redemption requires a minimum ₹${MIN_QR_PAYMENT_INR} QR bill at partner salons.`,
    };
  }

  if (!Number.isFinite(pointsToRedeem) || pointsToRedeem <= 0) {
    return {
      success: false,
      error: 'Please enter a valid amount of points to redeem (greater than 0).',
    };
  }

  const stored = getStoredRewardTransactions(userId);
  const summary = calculateWalletSummary(stored);

  if (pointsToRedeem > summary.currentPoints) {
    return {
      success: false,
      error: `Insufficient points balance. You have ${summary.currentPoints} points available.`,
    };
  }

  if (pointsToRedeem > billAmount) {
    return {
      success: false,
      error: `Cannot redeem more points than the total bill amount (₹${billAmount}).`,
    };
  }

  const now = new Date();
  const dateStr = formatRewardDate(now);
  const discountInr = pointsToRedeem * POINTS_TO_INR_RATIO;
  const netPayableInr = Math.max(0, billAmount - discountInr);

  const redemptionTx: RewardTransaction = {
    id: `rwd-red-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    type: 'redemption',
    typeLabel: 'In-Shop QR Redemption',
    points: -Math.abs(pointsToRedeem),
    date: dateStr,
    createdAt: now.toISOString(),
    salonName: salonName || 'Nexora Partner Salon',
    salonId,
    status: 'Redeemed',
    billAmount,
    description: `Redeemed ${pointsToRedeem} points (₹${discountInr} discount) on ₹${billAmount} QR bill`,
    qrTransactionRef: `NX-QR-${Math.floor(10000 + Math.random() * 90000)}`,
  };

  const updated = [redemptionTx, ...stored];
  saveRewardTransactions(userId, updated);

  const updatedSummary = calculateWalletSummary(updated);

  return {
    success: true,
    transaction: redemptionTx,
    remainingPoints: updatedSummary.currentPoints,
    netPayableInr,
  };
}

/**
 * Filter and search transactions
 */
export function filterRewardTransactions(
  transactions: RewardTransaction[],
  filter: 'all' | 'qr_payment' | 'referral' | 'redeemed' | 'expired' | 'pending',
  searchQuery: string = ''
): RewardTransaction[] {
  const query = searchQuery.trim().toLowerCase();

  return transactions.filter((tx) => {
    // Category / status filter
    if (filter === 'qr_payment' && tx.type !== 'qr_payment') return false;
    if (filter === 'referral' && tx.type !== 'referral') return false;
    if (filter === 'redeemed' && tx.status !== 'Redeemed' && tx.type !== 'redemption') {
      return false;
    }
    if (filter === 'expired' && tx.status !== 'Expired' && tx.type !== 'expired') {
      return false;
    }
    if (filter === 'pending' && tx.status !== 'Pending') return false;

    // Search query match
    if (query) {
      const matchSalon = (tx.salonName || '').toLowerCase().includes(query);
      const matchType = (tx.typeLabel || '').toLowerCase().includes(query);
      const matchDesc = (tx.description || '').toLowerCase().includes(query);
      const matchFriend = (tx.friendName || '').toLowerCase().includes(query);
      const matchStatus = (tx.status || '').toLowerCase().includes(query);
      const matchRef = (tx.qrTransactionRef || '').toLowerCase().includes(query);

      return (
        matchSalon ||
        matchType ||
        matchDesc ||
        matchFriend ||
        matchStatus ||
        matchRef
      );
    }

    return true;
  });
}

/**
 * Visual styling metadata for transaction statuses
 */
export function getStatusBadgeMeta(status: RewardStatus): {
  label: string;
  tone: 'emerald' | 'amber' | 'blue' | 'rose' | 'slate';
  icon: string;
  badgeClass: string;
} {
  switch (status) {
    case 'Approved':
      return {
        label: 'Approved',
        tone: 'emerald',
        icon: 'check_circle',
        badgeClass:
          'bg-emerald-500/15 text-emerald-800 border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-300',
      };
    case 'Pending':
      return {
        label: 'Pending',
        tone: 'amber',
        icon: 'hourglass_top',
        badgeClass:
          'bg-amber-500/15 text-amber-800 border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300',
      };
    case 'Redeemed':
      return {
        label: 'Redeemed',
        tone: 'blue',
        icon: 'shopping_bag',
        badgeClass:
          'bg-indigo-500/15 text-indigo-800 border-indigo-500/30 dark:bg-indigo-500/20 dark:text-indigo-300',
      };
    case 'Expired':
    default:
      return {
        label: 'Expired',
        tone: 'rose',
        icon: 'schedule',
        badgeClass:
          'bg-rose-500/15 text-rose-800 border-rose-500/30 dark:bg-rose-500/20 dark:text-rose-300',
      };
  }
}

/**
 * Visual styling metadata for transaction types
 */
export function getTypeBadgeMeta(type: RewardType): {
  label: string;
  icon: string;
  colorClass: string;
} {
  switch (type) {
    case 'qr_payment':
      return {
        label: 'QR Payment Reward',
        icon: 'qr_code_scanner',
        colorClass: 'text-primary bg-primary/10',
      };
    case 'referral':
      return {
        label: 'Referral Reward',
        icon: 'group_add',
        colorClass: 'text-[#b00055] bg-[#b00055]/10',
      };
    case 'redemption':
      return {
        label: 'In-Shop QR Redemption',
        icon: 'redeem',
        colorClass: 'text-indigo-700 bg-indigo-500/10',
      };
    case 'expired':
      return {
        label: 'Expired Points',
        icon: 'timer_off',
        colorClass: 'text-rose-700 bg-rose-500/10',
      };
    case 'bonus':
    default:
      return {
        label: 'Bonus Reward',
        icon: 'stars',
        colorClass: 'text-amber-700 bg-amber-500/10',
      };
  }
}

// =============================================================================
// LIVE SUPABASE REWARDS WALLET SUPPORT
// =============================================================================

function asRewardRecord(row: Record<string, unknown>): RewardTransaction {
  const typeRaw = String(row.type ?? row.transaction_type ?? 'qr_payment').replace(/[\s-]+/g, '_');
  let type: RewardType = 'qr_payment';
  const normalized = typeRaw.toLowerCase();
  if (normalized.includes('referral')) type = 'referral';
  else if (normalized.includes('redeem') || normalized.includes('redemption')) type = 'redemption';
  else if (normalized.includes('expire') || normalized.includes('expired')) type = 'expired';
  else if (normalized.includes('bonus')) type = 'bonus';
  const pointsRaw = row.points ?? row.point_value ?? 0;
  const points = typeof pointsRaw === 'number' ? pointsRaw : Number(pointsRaw) || 0;
  const statusRaw = String(row.status ?? 'Pending');
  const status: RewardStatus =
    statusRaw === 'Approved' || statusRaw === 'Pending' || statusRaw === 'Redeemed' || statusRaw === 'Expired'
      ? (statusRaw as RewardStatus)
      : 'Pending';
  return {
    id: String(row.id || ''),
    type,
    typeLabel: String(row.type_label ?? row.label ?? typeLabelFor(type)),
    points,
    date: formatRewardDate(String(row.created_at ?? row.date ?? Date.now())),
    createdAt: String(row.created_at ?? row.date ?? new Date().toISOString()),
    salonName: String(row.salon_name ?? row.salonName ?? 'Nexora Partner Salon'),
    salonId: typeof row.salon_id === 'string' ? row.salon_id : undefined,
    status,
    billAmount: typeof row.bill_amount === 'number' ? row.bill_amount : undefined,
    description: typeof row.description === 'string' ? row.description : undefined,
    expiresAt: typeof row.expires_at === 'string' ? row.expires_at : undefined,
    friendName: typeof row.friend_name === 'string' ? row.friend_name : undefined,
    qrTransactionRef: typeof row.qr_transaction_ref === 'string' ? row.qr_transaction_ref : undefined,
    qualifyingPaymentMade: Boolean(row.qualifying_payment_made ?? row.qualifying_payment),
  };
}

function typeLabelFor(type: RewardType): string {
  switch (type) {
    case 'referral': return 'Referral Reward';
    case 'redemption': return 'In-Shop QR Redemption';
    case 'expired': return 'Expired Points';
    case 'bonus': return 'Bonus Reward';
    default: return 'QR Payment Reward';
  }
}

async function readRows(client: SupabaseClient, table: string, filter: Record<string, string>): Promise<Record<string, unknown>[]> {
  try {
    let query = client.from(table).select('*');
    for (const [k, v] of Object.entries(filter)) query = query.eq(k, v);
    const { data, error } = await query;
    if (error) return [];
    return Array.isArray(data) ? data.filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null) : [];
  } catch {
    return [];
  }
}

/**
 * Load the customer's reward wallet from `reward_wallets` + `reward_transactions`.
 * When the backend has no wallet row yet, an empty wallet is returned (never a
 * fake seeded wallet).
 */
export async function loadRewardWallet(
  userId: string,
  client: SupabaseClient | null = supabase
): Promise<RewardWalletSummary> {
  if (!client || !isSupabaseConfigured || !isLiveCustomerDataEnabled || !userId) {
    return {
      currentPoints: 0,
      lifetimeEarned: 0,
      lifetimeRedeemed: 0,
      qrPaymentRewards: 0,
      referralRewards: 0,
      expiringPoints: 0,
      pendingPoints: 0,
      expiredPoints: 0,
      transactions: [],
    };
  }

  const [walletRows, txRows] = await Promise.all([
    readRows(client, SALONOS_TABLES.rewardWallets, { user_id: userId }),
    readRows(client, SALONOS_TABLES.rewardTransactions, { user_id: userId }),
  ]);

  const wallet = walletRows[0] || {};
  const transactions = txRows.map(asRewardRecord);

  if (transactions.length) return calculateWalletSummary(transactions);

  const currentPoints =
    typeof wallet.current_points === 'number'
      ? wallet.current_points
      : Number(wallet.current_points) || 0;
  return {
    currentPoints,
    lifetimeEarned: Number(wallet.lifetime_earned) || currentPoints,
    lifetimeRedeemed: Number(wallet.lifetime_redeemed) || 0,
    qrPaymentRewards: Number(wallet.qr_payment_rewards) || 0,
    referralRewards: Number(wallet.referral_rewards) || 0,
    expiringPoints: Number(wallet.expiring_points) || 0,
    pendingPoints: Number(wallet.pending_points) || 0,
    expiredPoints: Number(wallet.expired_points) || 0,
    transactions: [],
  };
}

async function upsertWallet(userId: string, patch: Record<string, unknown>, client: SupabaseClient): Promise<void> {
  try {
    await client.from(SALONOS_TABLES.rewardWallets).upsert(
      { user_id: userId, ...patch, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  } catch {
    // Non-fatal: the wallet may not exist on older deployments.
  }
}

export async function recordQrPaymentReward(
  userId: string,
  params: {
    salonName: string;
    salonId?: string;
    amountInr: number;
    status?: RewardStatus;
    description?: string;
    qrReference?: string;
  },
  client: SupabaseClient | null = supabase
): Promise<{ success: boolean; transaction?: RewardTransaction; pointsEarned: number; message: string; error?: string }> {
  const localResult = addQrPaymentReward({
    userId,
    salonName: params.salonName,
    salonId: params.salonId,
    amountInr: params.amountInr,
    status: params.status,
    description: params.description,
  });
  if (!client || !isSupabaseConfigured || !isLiveCustomerDataEnabled || !userId) {
    return { ...localResult, error: localResult.success ? undefined : 'Live Supabase rewards service is not configured.' };
  }
  if (!localResult.success) return localResult;

  const tx = localResult.transaction!;
  const now = new Date().toISOString();
  try {
    const { error: qrError } = await client.from(SALONOS_TABLES.customerQrPayments).insert({
      user_id: userId,
      salon_id: params.salonId || null,
      salon_name: params.salonName,
      bill_amount: params.amountInr,
      points_earned: tx.points,
      status: tx.status,
      qr_reference: params.qrReference || tx.qrTransactionRef || null,
      description: tx.description || null,
      created_at: now,
    });
    if (qrError) return { ...localResult, error: qrError.message };
    const { error: txError } = await client.from(SALONOS_TABLES.rewardTransactions).insert({
      user_id: userId,
      type: 'qr_payment',
      points: tx.points,
      status: tx.status,
      salon_id: params.salonId || null,
      salon_name: params.salonName,
      bill_amount: params.amountInr,
      description: tx.description || null,
      expires_at: tx.expiresAt || null,
      qr_transaction_ref: tx.qrTransactionRef || null,
      created_at: now,
    });
    if (txError) return { ...localResult, error: txError.message };
    await upsertWallet(
      userId,
      { current_points: tx.points, lifetime_earned: tx.points, qr_payment_rewards: tx.points },
      client
    );
  } catch (err) {
    return { ...localResult, error: err instanceof Error ? err.message : String(err) };
  }
  return localResult;
}

export async function recordReferralReward(
  userId: string,
  params: {
    friendName: string;
    salonName?: string;
    amountInr?: number;
    status?: RewardStatus;
    referralId?: string;
  },
  client: SupabaseClient | null = supabase
): Promise<{ success: boolean; transaction?: RewardTransaction; pointsEarned: number; message: string; error?: string }> {
  const localResult = addReferralReward({
    userId,
    friendName: params.friendName,
    salonName: params.salonName,
    amountInr: params.amountInr,
    status: params.status,
  });
  if (!client || !isSupabaseConfigured || !isLiveCustomerDataEnabled || !userId) {
    return { ...localResult, error: localResult.success ? undefined : 'Live Supabase rewards service is not configured.' };
  }
  if (!localResult.success) return localResult;
  const tx = localResult.transaction!;
  try {
    const { error } = await client.from(SALONOS_TABLES.rewardTransactions).insert({
      user_id: userId,
      type: 'referral',
      points: tx.points,
      status: tx.status,
      salon_id: tx.salonId || null,
      salon_name: tx.salonName || params.salonName || null,
      bill_amount: tx.billAmount || null,
      friend_name: tx.friendName || null,
      description: tx.description || null,
      referral_id: params.referralId || null,
      expires_at: tx.expiresAt || null,
      created_at: new Date().toISOString(),
    });
    if (error) return { ...localResult, error: error.message };
    await upsertWallet(
      userId,
      { current_points: tx.points, lifetime_earned: tx.points, referral_rewards: tx.points },
      client
    );
  } catch (err) {
    return { ...localResult, error: err instanceof Error ? err.message : String(err) };
  }
  return localResult;
}

export async function redeemRewardsLive(
  userId: string,
  params: {
    salonName: string;
    salonId?: string;
    billAmount: number;
    pointsToRedeem: number;
  },
  client: SupabaseClient | null = supabase
): Promise<{ success: boolean; error?: string; transaction?: RewardTransaction; remainingPoints?: number; netPayableInr?: number }> {
  const localResult = redeemRewardsViaQr({
    userId,
    salonName: params.salonName,
    salonId: params.salonId,
    billAmount: params.billAmount,
    pointsToRedeem: params.pointsToRedeem,
  });
  if (!client || !isSupabaseConfigured || !isLiveCustomerDataEnabled || !userId) {
    return { ...localResult, error: localResult.error || 'Live Supabase rewards service is not configured.' };
  }
  if (!localResult.success) return localResult;
  const tx = localResult.transaction!;
  try {
    const { error } = await client.from(SALONOS_TABLES.rewardTransactions).insert({
      user_id: userId,
      type: 'redemption',
      points: tx.points,
      status: 'Redeemed',
      salon_id: params.salonId || null,
      salon_name: params.salonName,
      bill_amount: params.billAmount,
      description: tx.description || null,
      qr_transaction_ref: tx.qrTransactionRef || null,
      created_at: new Date().toISOString(),
    });
    if (error) return { success: false, error: error.message };
    await upsertWallet(
      userId,
      { current_points: tx.points, lifetime_redeemed: Math.abs(tx.points) },
      client
    );
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
  return localResult;
}
