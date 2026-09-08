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
 */

import type { Appointment } from '../types';
import { BOOKING_POINTS_PERCENT, POINTS_EXPIRY_DAYS, bookingRewardPoints } from './engagement';

export type RewardStatus = 'Pending' | 'Approved' | 'Redeemed' | 'Expired';

export type RewardType =
  | 'qr_payment'
  | 'booking'
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
  /** Booking this transaction was earned on / redeemed against. */
  bookingId?: string;
  /** Human booking reference (NX-XXXXXXXX) shown on the ledger row. */
  bookingRef?: string;
}

export interface RewardWalletSummary {
  currentPoints: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  qrPaymentRewards: number;
  /** Points earned from completed bookings (10% of the paid bill). */
  bookingRewards: number;
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

/**
 * Booking loyalty rules (mirrors `src/lib/engagement.ts` and the SQL trigger in
 * supabase/setup.sql so code, schema and UI cannot drift):
 *  - Earn: floor(final bill × 10%) once a booking reaches `completed`.
 *  - A booking under ₹100 earns nothing (same qualifying floor as QR).
 *  - Awarded points expire 90 days after they are credited.
 *  - Redeem: points can be spent against a completed booking's balance, never
 *    more than the bill and never more than 50% of it (no cash withdrawal).
 */
export const BOOKING_CASHBACK_PERCENT = BOOKING_POINTS_PERCENT;
export const MIN_BOOKING_AMOUNT_INR = 100;
export const MAX_REDEEM_PERCENT_OF_BILL = 50;
export const REWARD_EXPIRY_DAYS = POINTS_EXPIRY_DAYS;

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
  let bookingRewards = 0;
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
        } else if (tx.type === 'booking') {
          bookingRewards += tx.points;
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
    bookingRewards,
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

// ---------------------------------------------------------------------------
// Booking loyalty — earn on completion, redeem against a completed booking
// ---------------------------------------------------------------------------

/** Deterministic ids make every booking award/redemption idempotent. */
export function bookingRewardId(bookingId: string): string {
  return `rwd-booking-${bookingId}`;
}

export function bookingRedemptionId(bookingId: string): string {
  return `rwd-booking-redeem-${bookingId}`;
}

/** Bill actually used for loyalty math on a booking. */
export function bookingBillAmount(appointment: Pick<Appointment, 'totalPrice'>): number {
  const total = Number(appointment?.totalPrice);
  return Number.isFinite(total) && total > 0 ? Math.round(total) : 0;
}

/** A booking qualifies for points only when completed and ≥ ₹100. */
export function isBookingRewardEligible(
  appointment: Pick<Appointment, 'status' | 'totalPrice'> | null | undefined
): boolean {
  if (!appointment) return false;
  const status = String(appointment.status || '').toLowerCase();
  if (status !== 'completed') return false;
  return bookingBillAmount(appointment) >= MIN_BOOKING_AMOUNT_INR;
}

/** Points a completed booking earns = floor(bill × 10%), 0 below ₹100. */
export function calculateBookingPoints(totalInr: number): number {
  const bill = Number(totalInr);
  if (!Number.isFinite(bill) || bill < MIN_BOOKING_AMOUNT_INR) return 0;
  return bookingRewardPoints(bill);
}

/** Points already credited for a booking (0 when it has not been awarded). */
export function bookingRewardAlreadyAwarded(
  transactions: RewardTransaction[],
  bookingId: string
): RewardTransaction | undefined {
  const id = bookingRewardId(bookingId);
  return transactions.find((tx) => tx.id === id || (tx.type === 'booking' && tx.bookingId === bookingId));
}

function expiryStringFrom(now: Date): string {
  const expiry = new Date(now);
  expiry.setDate(expiry.getDate() + REWARD_EXPIRY_DAYS);
  return formatRewardDate(expiry);
}

/**
 * Build (but do not persist) the reward transaction for a completed booking.
 * Returns null when the booking is not eligible.
 */
export function buildBookingRewardTransaction(
  appointment: Appointment,
  now: Date = new Date()
): RewardTransaction | null {
  if (!isBookingRewardEligible(appointment)) return null;
  const bill = bookingBillAmount(appointment);
  const points = calculateBookingPoints(bill);
  if (points <= 0) return null;

  const serviceNames = (appointment.services || []).map((s) => s.name).filter(Boolean);
  const serviceLabel =
    serviceNames.length === 0
      ? 'salon services'
      : serviceNames.length <= 2
        ? serviceNames.join(' + ')
        : `${serviceNames.slice(0, 2).join(' + ')} +${serviceNames.length - 2} more`;

  return {
    id: bookingRewardId(appointment.id),
    type: 'booking',
    typeLabel: 'Booking Reward',
    points,
    date: formatRewardDate(now),
    createdAt: now.toISOString(),
    salonName: appointment.salonName || 'Nexora Partner Salon',
    salonId: appointment.salonId,
    status: 'Approved',
    billAmount: bill,
    description: `${BOOKING_CASHBACK_PERCENT}% loyalty points on ₹${bill} completed booking (${serviceLabel})`,
    expiresAt: expiryStringFrom(now),
    bookingId: appointment.id,
    bookingRef: appointment.bookingRef,
    qualifyingPaymentMade: true,
  };
}

export interface BookingRewardResult {
  success: boolean;
  transaction?: RewardTransaction;
  pointsEarned: number;
  eligible: boolean;
  alreadyAwarded: boolean;
  message: string;
}

/**
 * Credit the loyalty points for ONE completed booking.
 *
 * Idempotent: calling it twice for the same booking never double-credits
 * (the transaction id is derived from the booking id).
 */
export function addBookingCompletionReward(params: {
  userId?: string;
  appointment: Appointment;
  now?: Date;
}): BookingRewardResult {
  const { userId, appointment, now = new Date() } = params;

  if (!appointment?.id) {
    return {
      success: false,
      pointsEarned: 0,
      eligible: false,
      alreadyAwarded: false,
      message: 'A booking record is required to credit loyalty points.',
    };
  }

  const stored = getStoredRewardTransactions(userId);
  const existing = bookingRewardAlreadyAwarded(stored, appointment.id);
  if (existing) {
    return {
      success: false,
      transaction: existing,
      pointsEarned: 0,
      eligible: true,
      alreadyAwarded: true,
      message: `Loyalty points for booking ${appointment.bookingRef || appointment.id} were already credited.`,
    };
  }

  if (!isBookingRewardEligible(appointment)) {
    const bill = bookingBillAmount(appointment);
    return {
      success: false,
      pointsEarned: 0,
      eligible: false,
      alreadyAwarded: false,
      message:
        String(appointment.status || '').toLowerCase() !== 'completed'
          ? 'Loyalty points are credited only after the appointment is completed at the salon.'
          : `Bookings under ₹${MIN_BOOKING_AMOUNT_INR} (this one is ₹${bill}) do not earn loyalty points.`,
    };
  }

  const tx = buildBookingRewardTransaction(appointment, now);
  if (!tx) {
    return {
      success: false,
      pointsEarned: 0,
      eligible: false,
      alreadyAwarded: false,
      message: 'This booking does not qualify for loyalty points.',
    };
  }

  saveRewardTransactions(userId, [tx, ...stored]);

  return {
    success: true,
    transaction: tx,
    pointsEarned: tx.points,
    eligible: true,
    alreadyAwarded: false,
    message: `Earned ${tx.points} loyalty points for your completed booking at ${tx.salonName}.`,
  };
}

export interface BookingRewardSyncResult {
  transactions: RewardTransaction[];
  awarded: RewardTransaction[];
  pointsAwarded: number;
  summary: RewardWalletSummary;
}

/**
 * Reconcile the wallet against the booking history.
 *
 * Every completed booking that has not been credited yet gets exactly one
 * `booking` transaction. Safe to run on every appointments change — already
 * credited bookings are skipped, so the ledger never double-counts.
 */
export function syncBookingRewards(
  userId: string | undefined,
  appointments: readonly Appointment[] | null | undefined,
  now: Date = new Date()
): BookingRewardSyncResult {
  const stored = getStoredRewardTransactions(userId);
  const list = Array.isArray(appointments) ? appointments : [];
  const awarded: RewardTransaction[] = [];
  const seen = new Set<string>();

  for (const appointment of list) {
    if (!appointment?.id || seen.has(appointment.id)) continue;
    seen.add(appointment.id);
    if (bookingRewardAlreadyAwarded([...stored, ...awarded], appointment.id)) continue;
    const tx = buildBookingRewardTransaction(appointment, now);
    if (tx) awarded.push(tx);
  }

  const transactions = awarded.length > 0 ? [...awarded, ...stored] : stored;
  if (awarded.length > 0) {
    saveRewardTransactions(userId, transactions);
  }

  return {
    transactions,
    awarded,
    pointsAwarded: awarded.reduce((sum, tx) => sum + tx.points, 0),
    summary: calculateWalletSummary(transactions),
  };
}

/**
 * Maximum points that may be spent on a bill:
 * balance-capped and never more than 50% of the bill (house rule so a salon
 * always receives a real payment — points are a discount, not a withdrawal).
 */
export function maxRedeemablePoints(currentPoints: number, billAmount: number): number {
  const balance = Math.max(0, Math.floor(Number(currentPoints) || 0));
  const bill = Math.max(0, Math.floor(Number(billAmount) || 0));
  if (bill < MIN_BOOKING_AMOUNT_INR) return 0;
  const billCap = Math.floor((bill * MAX_REDEEM_PERCENT_OF_BILL) / 100);
  return Math.max(0, Math.min(balance, billCap));
}

export interface BookingRedemptionResult {
  success: boolean;
  transaction?: RewardTransaction;
  error?: string;
  pointsRedeemed?: number;
  discountInr?: number;
  remainingPoints?: number;
  netPayableInr?: number;
}

/**
 * Redeem points against a COMPLETED booking's bill.
 *
 * Rules enforced here (never in the UI alone):
 *  - the booking must be completed and at least ₹100
 *  - one redemption per booking (idempotent id)
 *  - points ≤ balance and ≤ 50% of the bill
 *  - points are a discount on the salon bill; no cash is ever paid out
 */
export function redeemPointsForBooking(params: {
  userId?: string;
  appointment: Appointment;
  pointsToRedeem: number;
  now?: Date;
}): BookingRedemptionResult {
  const { userId, appointment, pointsToRedeem, now = new Date() } = params;

  if (!appointment?.id) {
    return { success: false, error: 'A booking is required to redeem loyalty points.' };
  }

  const status = String(appointment.status || '').toLowerCase();
  if (status !== 'completed') {
    return {
      success: false,
      error: 'Points can be redeemed only against a completed appointment.',
    };
  }

  const bill = bookingBillAmount(appointment);
  if (bill < MIN_BOOKING_AMOUNT_INR) {
    return {
      success: false,
      error: `Redemption requires a minimum ₹${MIN_BOOKING_AMOUNT_INR} bill (this booking is ₹${bill}).`,
    };
  }

  const points = Math.floor(Number(pointsToRedeem));
  if (!Number.isFinite(points) || points <= 0) {
    return { success: false, error: 'Enter a valid number of points to redeem (greater than 0).' };
  }

  const stored = getStoredRewardTransactions(userId);
  const redemptionId = bookingRedemptionId(appointment.id);
  if (stored.some((tx) => tx.id === redemptionId)) {
    return {
      success: false,
      error: `Points were already redeemed against booking ${appointment.bookingRef || appointment.id}.`,
    };
  }

  const summary = calculateWalletSummary(stored);
  if (points > summary.currentPoints) {
    return {
      success: false,
      error: `Insufficient balance. You have ${summary.currentPoints} points available.`,
    };
  }

  const cap = maxRedeemablePoints(summary.currentPoints, bill);
  if (points > cap) {
    return {
      success: false,
      error: `You can redeem up to ${cap} points on this ₹${bill} bill (max ${MAX_REDEEM_PERCENT_OF_BILL}% of the bill).`,
    };
  }

  const discountInr = points * POINTS_TO_INR_RATIO;
  const tx: RewardTransaction = {
    id: redemptionId,
    type: 'redemption',
    typeLabel: 'Booking Redemption',
    points: -Math.abs(points),
    date: formatRewardDate(now),
    createdAt: now.toISOString(),
    salonName: appointment.salonName || 'Nexora Partner Salon',
    salonId: appointment.salonId,
    status: 'Redeemed',
    billAmount: bill,
    description: `Redeemed ${points} points (₹${discountInr} off) on booking ${appointment.bookingRef || appointment.id}`,
    bookingId: appointment.id,
    bookingRef: appointment.bookingRef,
    qrTransactionRef: `NX-QR-${Math.floor(10000 + Math.random() * 90000)}`,
  };

  const updated = [tx, ...stored];
  saveRewardTransactions(userId, updated);

  return {
    success: true,
    transaction: tx,
    pointsRedeemed: points,
    discountInr,
    remainingPoints: calculateWalletSummary(updated).currentPoints,
    netPayableInr: Math.max(0, bill - discountInr),
  };
}

/**
 * Filter and search transactions
 */
export function filterRewardTransactions(
  transactions: RewardTransaction[],
  filter: 'all' | 'qr_payment' | 'booking' | 'referral' | 'redeemed' | 'expired' | 'pending',
  searchQuery: string = ''
): RewardTransaction[] {
  const query = searchQuery.trim().toLowerCase();

  return transactions.filter((tx) => {
    // Category / status filter
    if (filter === 'qr_payment' && tx.type !== 'qr_payment') return false;
    if (filter === 'booking' && tx.type !== 'booking' && !tx.bookingId) return false;
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
      const matchBooking = (tx.bookingRef || '').toLowerCase().includes(query);

      return (
        matchSalon ||
        matchType ||
        matchDesc ||
        matchFriend ||
        matchStatus ||
        matchRef ||
        matchBooking
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
    case 'booking':
      return {
        label: 'Booking Reward',
        icon: 'event_available',
        colorClass: 'text-emerald-700 bg-emerald-500/10',
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
