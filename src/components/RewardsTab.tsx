import React, { useState, useMemo, useEffect } from 'react';
import { UserProfile, Appointment, Salon } from '../types';
import {
  RewardTransaction,
  RewardStatus,
  RewardType,
  MIN_QR_PAYMENT_INR,
  QR_CASHBACK_PERCENT,
  REFERRAL_BONUS_POINTS,
  POINTS_TO_INR_RATIO,
  getStoredRewardTransactions,
  saveRewardTransactions,
  calculateWalletSummary,
  addQrPaymentReward,
  addReferralReward,
  redeemRewardsViaQr,
  filterRewardTransactions,
  getStatusBadgeMeta,
  getTypeBadgeMeta,
  resetRewardsToDemo,
  formatRewardDate,
} from '../lib/rewardsService';

interface RewardsTabProps {
  user: UserProfile;
  userId?: string;
  salons?: Salon[];
  appointments?: Appointment[];
  onOpenMembership?: () => void;
  onOpenReferral?: () => void;
  onNavigateToBooking?: () => void;
  onOpenSalonDetails?: (salon: Salon) => void;
}

export const RewardsTab: React.FC<RewardsTabProps> = ({
  user,
  userId,
  salons = [],
  appointments = [],
  onOpenMembership,
  onOpenReferral,
  onNavigateToBooking,
  onOpenSalonDetails,
}) => {
  // Load stored transactions scoped to user or demo store
  const [transactions, setTransactions] = useState<RewardTransaction[]>(() =>
    getStoredRewardTransactions(userId)
  );

  // Sync if userId changes
  useEffect(() => {
    setTransactions(getStoredRewardTransactions(userId));
  }, [userId]);

  // Derived wallet summary
  const summary = useMemo(() => {
    return calculateWalletSummary(transactions);
  }, [transactions]);

  // History filtering and search state
  const [historyFilter, setHistoryFilter] = useState<
    'all' | 'qr_payment' | 'referral' | 'redeemed' | 'expired' | 'pending'
  >('all');
  const [historySearch, setHistorySearch] = useState<string>('');

  // Modals state
  const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false);
  const [isQrSimulateModalOpen, setIsQrSimulateModalOpen] = useState(false);
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);
  const [selectedTransactionDetail, setSelectedTransactionDetail] = useState<RewardTransaction | null>(null);

  // Toast / Feedback message
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Form states for QR Redemption
  const [redeemSalonId, setRedeemSalonId] = useState<string>(
    salons[0]?.id || 'salon-1'
  );
  const [redeemBillAmount, setRedeemBillAmount] = useState<string>('500');
  const [redeemPointsInput, setRedeemPointsInput] = useState<string>('100');
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeemSuccessTx, setRedeemSuccessTx] = useState<RewardTransaction | null>(null);

  // Form states for QR Payment Simulation
  const [simSalonId, setSimSalonId] = useState<string>(
    salons[0]?.id || 'salon-1'
  );
  const [simBillAmount, setSimBillAmount] = useState<string>('650');
  const [simDescription, setSimDescription] = useState<string>('Hair Spa & Beard Grooming');

  // Referral code for user
  const userReferralCode = useMemo(() => {
    if (user.referralCode) return user.referralCode;
    const cleanName = (user.name || 'GUEST').replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 6) || 'NXUSER';
    return `NEXORA-${cleanName}99`;
  }, [user.referralCode, user.name]);

  // Filtered transactions for display
  const filteredTransactions = useMemo(() => {
    return filterRewardTransactions(transactions, historyFilter, historySearch);
  }, [transactions, historyFilter, historySearch]);

  // Selected salon for redemption
  const selectedRedeemSalon = useMemo(() => {
    return salons.find((s) => s.id === redeemSalonId) || {
      id: 'salon-1',
      name: 'Nexora Signature C-Scheme',
      location: { address: 'C-Scheme, Jaipur' },
    };
  }, [salons, redeemSalonId]);

  // Handle QR Redemption submission
  const handleExecuteRedemption = () => {
    setRedeemError(null);
    const bill = Number(redeemBillAmount);
    const pts = Number(redeemPointsInput);

    if (isNaN(bill) || bill < MIN_QR_PAYMENT_INR) {
      setRedeemError(`Minimum bill amount of ₹${MIN_QR_PAYMENT_INR} is required to redeem rewards via QR.`);
      return;
    }

    if (isNaN(pts) || pts <= 0) {
      setRedeemError('Please enter a valid points amount to redeem.');
      return;
    }

    if (pts > summary.currentPoints) {
      setRedeemError(`Cannot redeem ${pts} points. Your available balance is ${summary.currentPoints} points.`);
      return;
    }

    if (pts > bill) {
      setRedeemError(`Cannot redeem more points (${pts}) than the total bill amount (₹${bill}).`);
      return;
    }

    const result = redeemRewardsViaQr({
      userId,
      salonName: selectedRedeemSalon.name,
      salonId: selectedRedeemSalon.id,
      billAmount: bill,
      pointsToRedeem: pts,
    });

    if (result.success && result.transaction) {
      const updated = getStoredRewardTransactions(userId);
      setTransactions(updated);
      setRedeemSuccessTx(result.transaction);
      showToast(`Successfully redeemed ${pts} points at ${selectedRedeemSalon.name}!`, 'success');
    } else {
      setRedeemError(result.error || 'Redemption failed. Please check the requirements.');
    }
  };

  // Handle QR Payment simulation submission
  const handleExecuteQrPayment = () => {
    const bill = Number(simBillAmount);
    const targetSalon = salons.find((s) => s.id === simSalonId) || {
      id: 'salon-1',
      name: 'Nexora Signature C-Scheme',
    };

    const result = addQrPaymentReward({
      userId,
      salonName: targetSalon.name,
      salonId: targetSalon.id,
      amountInr: bill,
      status: 'Approved',
      description: simDescription ? `10% cashback on ₹${bill} QR payment for ${simDescription}` : undefined,
    });

    if (result.success && result.transaction) {
      const updated = getStoredRewardTransactions(userId);
      setTransactions(updated);
      setIsQrSimulateModalOpen(false);
      showToast(result.message, 'success');
    } else {
      showToast(result.message, 'error');
    }
  };

  // Handle reset to demo transactions
  const handleResetDemo = () => {
    const resetList = resetRewardsToDemo(userId);
    setTransactions(resetList);
    showToast('Reward wallet reset to default demo transactions.', 'info');
  };

  // Handle Copy Referral Code
  const handleCopyReferralCode = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(userReferralCode);
      showToast(`Referral code ${userReferralCode} copied to clipboard!`, 'success');
    } else {
      showToast(`Referral code: ${userReferralCode}`, 'info');
    }
  };

  return (
    <div
      id="rewards-wallet-page"
      className="flex flex-col w-full pb-28 max-w-4xl mx-auto px-page-margin pt-3"
      data-route="/customer/rewards"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-4 sm:right-8 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
          <div
            className={`p-3 px-4 rounded-2xl shadow-xl border flex items-center gap-2.5 text-[13px] font-semibold backdrop-blur-md ${
              toastMessage.type === 'success'
                ? 'bg-surface-container-highest/95 text-emerald-900 border-emerald-500/40'
                : toastMessage.type === 'error'
                  ? 'bg-rose-50 text-rose-900 border-rose-300'
                  : 'bg-surface-container-highest/95 text-on-surface border-[#b00055]/30'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {toastMessage.type === 'success'
                ? 'check_circle'
                : toastMessage.type === 'error'
                  ? 'error'
                  : 'info'}
            </span>
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-hero-heading-mobile text-[22px] font-bold text-on-surface">
                Rewards Wallet
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                /customer/rewards
              </span>
            </div>
            <p className="text-[13px] text-on-surface-variant mt-0.5">
              Pay via Nexora QR at partner salons to earn cashback & redeem in-shop
            </p>
          </div>

          <button
            type="button"
            onClick={handleResetDemo}
            title="Reset wallet to default demo transactions"
            className="text-[11px] font-semibold text-on-surface-variant hover:text-primary px-2.5 py-1 rounded-lg border border-outline-variant/40 bg-surface-container-lowest hover:bg-surface-container-low transition-colors flex items-center gap-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[14px]">refresh</span>
            <span className="hidden sm:inline">Reset Demo</span>
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 1. IMPORTANT BUSINESS RULES BANNER                                        */}
      {/* ========================================================================= */}
      <section
        id="section-business-rules"
        className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 sm:p-4 mb-4 text-on-surface"
      >
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-900 flex items-center justify-center shrink-0 mt-0.5">
            <span className="material-symbols-outlined text-[20px]">verified_user</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
              <h2 className="font-card-title text-[14px] font-bold text-amber-950 flex items-center gap-1.5">
                <span>Important Rewards & QR Payment Rules</span>
              </h2>
              <span className="text-[10px] font-extrabold uppercase tracking-wide bg-amber-600 text-white px-2 py-0.5 rounded-full">
                Nexora Wallet Policy
              </span>
            </div>

            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] text-amber-900/90 pt-1">
              <li className="flex items-start gap-1.5">
                <span className="material-symbols-outlined text-[14px] text-amber-700 mt-0.5 shrink-0">
                  qr_code_2
                </span>
                <span>
                  <strong>QR Payment Mandatory:</strong> Rewards are earned{' '}
                  <em>only</em> when you pay through Nexora QR at partner shops.
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="material-symbols-outlined text-[14px] text-amber-700 mt-0.5 shrink-0">
                  payments
                </span>
                <span>
                  <strong>Minimum ₹100 Rule:</strong> Referral or reward points
                  count <em>only after</em> minimum ₹100 QR payment.
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="material-symbols-outlined text-[14px] text-amber-700 mt-0.5 shrink-0">
                  block
                </span>
                <span>
                  <strong>Cashback Policy:</strong> Cashback is not cash
                  withdrawal. Balance applies as salon service discount.
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="material-symbols-outlined text-[14px] text-amber-700 mt-0.5 shrink-0">
                  storefront
                </span>
                <span>
                  <strong>Redemption Rule:</strong> Rewards can be redeemed{' '}
                  <em>only</em> at Nexora partner shops via QR.
                </span>
              </li>
              <li className="flex items-start gap-1.5 sm:col-span-2 text-amber-950 font-semibold pt-0.5 border-t border-amber-500/20">
                <span className="material-symbols-outlined text-[14px] text-amber-800 mt-0.5 shrink-0">
                  account_balance
                </span>
                <span>
                  <strong>No Direct Bank Withdrawal:</strong> Points are
                  strictly non-withdrawable to bank accounts or third-party wallets.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. CURRENT POINTS HERO CARD                                               */}
      {/* ========================================================================= */}
      <section
        id="section-current-points"
        className="bg-gradient-to-br from-primary via-[#b00055] to-primary-container rounded-3xl p-5 text-white shadow-lg mb-4 relative overflow-hidden"
      >
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[11px] uppercase tracking-wider font-bold opacity-85">
                  Current Points (Available Balance)
                </p>
                <span className="px-2 py-0.5 bg-white/20 rounded-full text-[10px] font-extrabold uppercase">
                  Active Wallet
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-1.5">
                <p
                  id="wallet-current-points-value"
                  className="text-[40px] font-extrabold leading-none tabular-nums"
                >
                  {summary.currentPoints.toLocaleString('en-IN')}
                </p>
                <span className="text-[14px] opacity-90 font-semibold">
                  pts (≈ ₹{(summary.currentPoints * POINTS_TO_INR_RATIO).toLocaleString('en-IN')})
                </span>
              </div>
              <p className="text-[12px] opacity-90 mt-1 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px]">lock</span>
                <span>Valid for in-shop redemption via Nexora QR at all partner salons</span>
              </p>
            </div>

            <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[34px] fill-1">
                account_balance_wallet
              </span>
            </div>
          </div>

          {/* Quick Actions in Hero */}
          <div className="mt-5 pt-4 border-t border-white/20 flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              id="wallet-redeem-qr-btn"
              onClick={() => {
                setRedeemError(null);
                setRedeemSuccessTx(null);
                setIsRedeemModalOpen(true);
              }}
              className="flex-1 py-2.5 px-3.5 bg-white text-primary text-[13px] font-bold rounded-xl hover:bg-white/95 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
              <span>Redeem via Partner QR</span>
            </button>

            <button
              type="button"
              id="wallet-simulate-qr-btn"
              onClick={() => setIsQrSimulateModalOpen(true)}
              className="flex-1 py-2.5 px-3.5 bg-white/15 hover:bg-white/25 border border-white/30 text-white text-[13px] font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">add_card</span>
              <span>Pay via QR & Earn (Min ₹100)</span>
            </button>

            <button
              type="button"
              id="wallet-share-referral-btn"
              onClick={() => setIsReferralModalOpen(true)}
              className="py-2.5 px-3.5 bg-white/15 hover:bg-white/25 border border-white/30 text-white text-[13px] font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">share</span>
              <span>Refer Code</span>
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. LIFETIME EARNED & LIFETIME REDEEMED STATS ROW                          */}
      {/* ========================================================================= */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {/* Lifetime Earned Card */}
        <div
          id="section-lifetime-earned"
          className="bg-surface-container-low border border-outline-variant/50 rounded-2xl p-4 shadow-xs flex items-start justify-between gap-3"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
              <h3 className="font-card-title text-[12px] font-bold uppercase tracking-wide text-on-surface-variant">
                Lifetime Earned
              </h3>
            </div>
            <p
              id="wallet-lifetime-earned-value"
              className="text-[26px] font-extrabold text-on-surface tabular-nums mt-0.5"
            >
              +{summary.lifetimeEarned.toLocaleString('en-IN')}{' '}
              <span className="text-[13px] font-semibold text-emerald-700">pts</span>
            </p>
            <p className="text-[11px] text-on-surface-variant mt-1 leading-snug">
              Total points earned across all approved QR payments and referral bonuses
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-800 flex items-center justify-center shrink-0 mt-1">
            <span className="material-symbols-outlined text-[22px]">trending_up</span>
          </div>
        </div>

        {/* Lifetime Redeemed Card */}
        <div
          id="section-lifetime-redeemed"
          className="bg-surface-container-low border border-outline-variant/50 rounded-2xl p-4 shadow-xs flex items-start justify-between gap-3"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-indigo-600 inline-block" />
              <h3 className="font-card-title text-[12px] font-bold uppercase tracking-wide text-on-surface-variant">
                Lifetime Redeemed
              </h3>
            </div>
            <p
              id="wallet-lifetime-redeemed-value"
              className="text-[26px] font-extrabold text-on-surface tabular-nums mt-0.5"
            >
              {summary.lifetimeRedeemed.toLocaleString('en-IN')}{' '}
              <span className="text-[13px] font-semibold text-indigo-700">pts</span>
            </p>
            <p className="text-[11px] text-on-surface-variant mt-1 leading-snug">
              Total reward points redeemed for bill discounts at partner salons via QR
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-800 flex items-center justify-center shrink-0 mt-1">
            <span className="material-symbols-outlined text-[22px]">shopping_bag</span>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. QR PAYMENT REWARDS & REFERRAL REWARDS SECTIONS                        */}
      {/* ========================================================================= */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {/* QR Payment Rewards Section */}
        <div
          id="section-qr-payment-rewards"
          className="bg-surface-container-low border border-outline-variant/50 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">qr_code_scanner</span>
                </div>
                <h3 className="font-card-title text-[15px] font-bold text-on-surface">
                  QR Payment Rewards
                </h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                10% Cashback
              </span>
            </div>

            <p className="text-[12px] text-on-surface-variant leading-relaxed mb-3">
              Earn 10% instant reward points whenever you pay your salon bill using Nexora QR at any Jaipur partner shop.
            </p>

            <div className="p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/40 mb-3 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-on-surface-variant block">Total QR Rewards Earned</span>
                <span className="text-[18px] font-extrabold text-primary tabular-nums">
                  +{summary.qrPaymentRewards.toLocaleString('en-IN')} pts
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-on-surface-variant block">Rule</span>
                <span className="text-[11px] font-bold text-amber-800 bg-amber-500/15 px-2 py-0.5 rounded">
                  Min ₹100 Bill
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsQrSimulateModalOpen(true)}
            className="w-full py-2 px-3 bg-primary/10 hover:bg-primary/15 text-primary text-[12px] font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">qr_code</span>
            <span>Simulate Partner QR Payment</span>
          </button>
        </div>

        {/* Referral Rewards Section */}
        <div
          id="section-referral-rewards"
          className="bg-surface-container-low border border-outline-variant/50 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#b00055]/10 text-[#b00055] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">group_add</span>
                </div>
                <h3 className="font-card-title text-[15px] font-bold text-on-surface">
                  Referral Rewards
                </h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#b00055]/10 text-[#b00055] border border-[#b00055]/20">
                150 pts / Friend
              </span>
            </div>

            <p className="text-[12px] text-on-surface-variant leading-relaxed mb-3">
              Share your code. Referral points credit <em>only after</em> your friend makes their first minimum ₹100 QR payment.
            </p>

            {/* Referral Code Box */}
            <div className="p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/40 mb-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[10px] text-on-surface-variant block">Your Referral Code</span>
                <span className="text-[14px] font-mono font-extrabold text-[#b00055] truncate block">
                  {userReferralCode}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyReferralCode}
                className="px-2.5 py-1.5 bg-[#b00055] text-white text-[11px] font-bold rounded-lg hover:bg-primary transition-colors flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-[14px]">content_copy</span>
                <span>Copy</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-on-surface-variant pt-1 border-t border-outline-variant/30">
            <span>
              Total Referral Earnings:{' '}
              <strong className="text-on-surface">+{summary.referralRewards} pts</strong>
            </span>
            <button
              type="button"
              id="rewards-referral-btn"
              onClick={() => onOpenReferral ? onOpenReferral() : setIsReferralModalOpen(true)}
              className="text-[#b00055] font-bold hover:underline cursor-pointer"
            >
              View Referrals →
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. EXPIRING REWARDS SECTION                                               */}
      {/* ========================================================================= */}
      <section
        id="section-expiring-rewards"
        className="bg-surface-container-low border border-outline-variant/50 rounded-2xl p-4 sm:p-5 shadow-xs mb-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
              <span className="material-symbols-outlined text-[22px]">hourglass_bottom</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-card-title text-[15px] font-bold text-on-surface">
                  Expiring Rewards
                </h3>
                {summary.expiringPoints > 0 ? (
                  <span className="text-[10px] font-bold bg-amber-500/20 text-amber-900 px-2 py-0.5 rounded border border-amber-500/30">
                    Action Needed
                  </span>
                ) : (
                  <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-800 px-2 py-0.5 rounded">
                    Safe
                  </span>
                )}
              </div>

              {summary.expiringPoints > 0 ? (
                <div className="mt-1.5">
                  <p className="text-[13px] text-on-surface font-semibold">
                    <span className="text-amber-800 font-extrabold text-[15px]">
                      {summary.expiringPoints} points
                    </span>{' '}
                    expiring on{' '}
                    <span className="underline decoration-amber-500 font-bold">
                      {summary.nextExpiryDate}
                    </span>
                  </p>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    Points expire 90 days from credit date. Redeem them via QR on your next partner salon visit to avoid expiration.
                  </p>
                </div>
              ) : (
                <p className="text-[12px] text-on-surface-variant mt-1">
                  Great news! You have no points expiring within the next 30 days. All approved points are active.
                </p>
              )}
            </div>
          </div>

          {summary.expiringPoints > 0 && (
            <button
              type="button"
              onClick={() => setIsRedeemModalOpen(true)}
              className="px-3 py-1.5 bg-amber-600 text-white text-[11px] font-bold rounded-xl hover:bg-amber-700 transition-colors shrink-0 shadow-xs cursor-pointer"
            >
              Redeem Now
            </button>
          )}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. REWARD HISTORY SECTION & REWARD TRANSACTION CARDS                     */}
      {/* ========================================================================= */}
      <section
        id="section-reward-history"
        className="bg-surface-container-low border border-outline-variant/50 rounded-2xl p-4 sm:p-5 shadow-xs mb-4"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-outline-variant/30">
          <div>
            <h2 className="font-section-heading text-[17px] font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-primary">history</span>
              <span>Reward History</span>
            </h2>
            <p className="text-[11px] text-on-surface-variant">
              Full audit trail of QR payments, referrals, redemptions & expirations
            </p>
          </div>

          {/* Search box */}
          <div className="relative w-full sm:w-56">
            <input
              type="text"
              id="reward-history-search"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Search salon or type..."
              className="w-full h-9 pl-8 pr-3 bg-surface-container-lowest text-on-surface rounded-xl text-[12px] border border-outline-variant/50 focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant absolute left-2.5 top-2.5 pointer-events-none">
              search
            </span>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3 no-scrollbar">
          {[
            { id: 'all', label: 'All' },
            { id: 'qr_payment', label: 'QR Payments' },
            { id: 'referral', label: 'Referrals' },
            { id: 'redeemed', label: 'Redeemed' },
            { id: 'expired', label: 'Expired' },
            { id: 'pending', label: 'Pending' },
          ].map((tab) => {
            const isActive = historyFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                id={`filter-reward-${tab.id}`}
                onClick={() => setHistoryFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-surface-container-lowest text-on-surface-variant border border-outline-variant/40 hover:bg-surface-container'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Transactions List */}
        {filteredTransactions.length === 0 ? (
          <div className="p-8 text-center bg-surface-container-lowest rounded-2xl border border-outline-variant/30 flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-surface-container text-on-surface-variant flex items-center justify-center mb-2">
              <span className="material-symbols-outlined text-[24px]">receipt_long</span>
            </div>
            <p className="text-[13px] font-bold text-on-surface">No reward transactions found</p>
            <p className="text-[11px] text-on-surface-variant mt-0.5 max-w-xs">
              {historySearch
                ? `No results matching "${historySearch}". Try clearing your search.`
                : 'Transactions will appear here once you pay or redeem via Nexora QR at partner salons.'}
            </p>
            {historySearch && (
              <button
                type="button"
                onClick={() => setHistorySearch('')}
                className="mt-3 px-3 py-1.5 bg-primary/10 text-primary text-[11px] font-bold rounded-lg hover:bg-primary/20 transition-colors cursor-pointer"
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filteredTransactions.map((tx) => {
              const statusMeta = getStatusBadgeMeta(tx.status);
              const typeMeta = getTypeBadgeMeta(tx.type);
              const isPositive = tx.points > 0;
              const pointsDisplay = isPositive
                ? `+${tx.points} pts`
                : `${tx.points} pts`;

              return (
                <div
                  key={tx.id}
                  id={`reward-card-${tx.id}`}
                  data-reward-id={tx.id}
                  data-reward-type={tx.type}
                  data-reward-status={tx.status}
                  onClick={() => setSelectedTransactionDetail(tx)}
                  className="p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/40 hover:border-primary/40 transition-all shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer group"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {/* Icon */}
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${typeMeta.colorClass}`}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {typeMeta.icon}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Type */}
                        <span className="text-[13px] font-bold text-on-surface group-hover:text-primary transition-colors">
                          {tx.typeLabel || typeMeta.label}
                        </span>

                        {/* Status Badge: strictly Pending | Approved | Redeemed | Expired */}
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border flex items-center gap-1 ${statusMeta.badgeClass}`}
                        >
                          <span className="material-symbols-outlined text-[12px]">
                            {statusMeta.icon}
                          </span>
                          <span>{tx.status}</span>
                        </span>
                      </div>

                      {/* Salon & Date */}
                      <div className="flex items-center gap-2 text-[11px] text-on-surface-variant mt-1 flex-wrap">
                        <span className="font-semibold text-on-surface flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px] text-primary">
                            storefront
                          </span>
                          <span className="truncate max-w-[200px]">{tx.salonName}</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">
                            calendar_today
                          </span>
                          <span>{tx.date}</span>
                        </span>
                        {tx.billAmount && (
                          <>
                            <span>•</span>
                            <span>QR Bill: ₹{tx.billAmount.toLocaleString('en-IN')}</span>
                          </>
                        )}
                      </div>

                      {/* Description or friend name */}
                      {tx.description && (
                        <p className="text-[11px] text-on-surface-variant/80 mt-1 line-clamp-1">
                          {tx.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Points & CTA */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-1 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-outline-variant/20">
                    <span
                      className={`text-[16px] font-extrabold tabular-nums ${
                        tx.status === 'Pending'
                          ? 'text-amber-700'
                          : tx.status === 'Redeemed'
                            ? 'text-indigo-700'
                            : tx.status === 'Expired'
                              ? 'text-rose-700'
                              : 'text-emerald-700'
                      }`}
                    >
                      {pointsDisplay}
                    </span>
                    <span className="text-[10px] text-on-surface-variant uppercase font-medium">
                      {tx.status === 'Redeemed'
                        ? 'Redeemed'
                        : tx.status === 'Expired'
                          ? 'Expired'
                          : tx.status === 'Pending'
                            ? 'Pending'
                            : 'Approved'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* 7. REWARD ACTION CTAS FOOTER                                              */}
      {/* ========================================================================= */}
      <section className="flex flex-col sm:flex-row gap-2.5">
        <button
          type="button"
          id="rewards-book-btn"
          onClick={() => onNavigateToBooking?.()}
          className="flex-1 py-3 px-4 bg-primary text-white text-[13px] font-bold rounded-xl hover:bg-nexora-pink transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">event</span>
          <span>Book & Earn QR Points</span>
        </button>

        <button
          type="button"
          id="rewards-membership-btn"
          onClick={() => onOpenMembership?.()}
          className="flex-1 py-3 px-4 bg-surface-container-lowest border border-outline-variant/50 text-on-surface text-[13px] font-bold rounded-xl hover:border-primary/40 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px] text-primary">card_membership</span>
          <span>Membership Perks</span>
        </button>
      </section>

      {/* ========================================================================= */}
      {/* MODAL 1: PAY & REDEEM VIA PARTNER QR MODAL                               */}
      {/* ========================================================================= */}
      {isRedeemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-surface rounded-3xl p-5 sm:p-6 shadow-2xl border border-outline-variant/40 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">qr_code_scanner</span>
                </div>
                <div>
                  <h3 className="font-card-title text-[17px] font-bold text-on-surface">
                    Redeem Points via Nexora QR
                  </h3>
                  <p className="text-[11px] text-on-surface-variant">
                    Pay at partner salon counter with instant reward deduction
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsRedeemModalOpen(false)}
                className="w-8 h-8 rounded-full bg-surface-container text-on-surface-variant flex items-center justify-center hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {redeemSuccessTx ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                  <span className="material-symbols-outlined text-[28px]">check</span>
                </div>
                <div>
                  <h4 className="font-bold text-[16px] text-emerald-950">Redemption Successful!</h4>
                  <p className="text-[12px] text-emerald-900 mt-0.5">
                    {redeemSuccessTx.description}
                  </p>
                  <p className="text-[11px] text-emerald-800 font-mono mt-1">
                    Ref: {redeemSuccessTx.qrTransactionRef} • {redeemSuccessTx.date}
                  </p>
                </div>

                <div className="w-full p-3 bg-white rounded-xl border border-emerald-500/20 text-left text-[12px] space-y-1">
                  <div className="flex justify-between text-on-surface">
                    <span>Partner Salon:</span>
                    <span className="font-bold">{redeemSuccessTx.salonName}</span>
                  </div>
                  <div className="flex justify-between text-on-surface">
                    <span>Points Redeemed:</span>
                    <span className="font-bold text-indigo-700">{Math.abs(redeemSuccessTx.points)} pts</span>
                  </div>
                  <div className="flex justify-between text-on-surface">
                    <span>Remaining Wallet Balance:</span>
                    <span className="font-bold text-emerald-800">{summary.currentPoints} pts</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setRedeemSuccessTx(null);
                    setIsRedeemModalOpen(false);
                  }}
                  className="w-full py-2.5 bg-emerald-700 text-white text-[13px] font-bold rounded-xl hover:bg-emerald-800 transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                {/* Available Balance Pill */}
                <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-primary">
                      account_balance_wallet
                    </span>
                    <span className="text-[12px] font-bold text-on-surface">Available Points Balance</span>
                  </div>
                  <span className="text-[14px] font-extrabold text-primary tabular-nums">
                    {summary.currentPoints} pts (₹{summary.currentPoints * POINTS_TO_INR_RATIO})
                  </span>
                </div>

                {/* Salon Picker */}
                <div>
                  <label className="text-[12px] font-bold text-on-surface block mb-1">
                    Select Partner Salon
                  </label>
                  <select
                    id="redeem-salon-select"
                    value={redeemSalonId}
                    onChange={(e) => setRedeemSalonId(e.target.value)}
                    className="w-full h-11 px-3 bg-surface-container-lowest text-on-surface rounded-xl text-[13px] border border-outline-variant/50 focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    {salons.map((salon) => (
                      <option key={salon.id} value={salon.id}>
                        {salon.name} ({salon.location.area})
                      </option>
                    ))}
                  </select>
                </div>

                {/* In-Shop Bill Amount */}
                <div>
                  <label className="text-[12px] font-bold text-on-surface block mb-1 flex items-center justify-between">
                    <span>Salon Bill Amount (₹)</span>
                    <span className="text-[10px] text-amber-800 font-semibold bg-amber-500/15 px-1.5 py-0.2 rounded">
                      Min ₹100 Required
                    </span>
                  </label>
                  <input
                    type="number"
                    id="redeem-bill-amount-input"
                    value={redeemBillAmount}
                    onChange={(e) => setRedeemBillAmount(e.target.value)}
                    min="100"
                    step="50"
                    placeholder="e.g. 500"
                    className="w-full h-11 px-3.5 bg-surface-container-lowest text-on-surface rounded-xl text-[14px] font-bold border border-outline-variant/50 focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Points to Redeem */}
                <div>
                  <label className="text-[12px] font-bold text-on-surface block mb-1 flex items-center justify-between">
                    <span>Points to Redeem</span>
                    <span className="text-[10px] text-on-surface-variant">
                      1 Point = ₹1 Discount
                    </span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      id="redeem-points-input"
                      value={redeemPointsInput}
                      onChange={(e) => setRedeemPointsInput(e.target.value)}
                      min="1"
                      max={summary.currentPoints}
                      className="flex-1 h-11 px-3.5 bg-surface-container-lowest text-on-surface rounded-xl text-[14px] font-bold border border-outline-variant/50 focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const bill = Number(redeemBillAmount) || 0;
                        const maxRedeemable = Math.min(summary.currentPoints, bill);
                        setRedeemPointsInput(String(maxRedeemable));
                      }}
                      className="px-3 bg-surface-container text-on-surface text-[12px] font-bold rounded-xl hover:bg-surface-container-high transition-colors cursor-pointer"
                    >
                      Use Max
                    </button>
                  </div>
                </div>

                {/* Summary calculation box */}
                {Number(redeemBillAmount) > 0 && Number(redeemPointsInput) > 0 && (
                  <div className="p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/40 text-[12px] space-y-1.5">
                    <div className="flex justify-between text-on-surface-variant">
                      <span>Salon Bill:</span>
                      <span className="font-semibold text-on-surface">₹{Number(redeemBillAmount)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-800">
                      <span>Rewards Discount (Points):</span>
                      <span className="font-bold">-₹{Number(redeemPointsInput)}</span>
                    </div>
                    <div className="flex justify-between text-[14px] font-extrabold text-on-surface pt-1.5 border-t border-outline-variant/30">
                      <span>Net Payable via QR:</span>
                      <span className="text-primary">
                        ₹{Math.max(0, Number(redeemBillAmount) - Number(redeemPointsInput))}
                      </span>
                    </div>
                  </div>
                )}

                {redeemError && (
                  <p className="text-[12px] text-rose-700 font-semibold bg-rose-50 border border-rose-200 rounded-xl p-2.5">
                    {redeemError}
                  </p>
                )}

                {/* Important Non-withdrawal compliance callout */}
                <p className="text-[10px] text-on-surface-variant leading-relaxed">
                  ⚠️ <strong>Notice:</strong> Rewards can be redeemed only at Nexora partner shops via QR. No cash withdrawals or direct bank transfers.
                </p>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsRedeemModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl bg-surface-container text-on-surface text-[12px] font-semibold hover:bg-surface-container-high transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    id="confirm-qr-redemption-btn"
                    onClick={handleExecuteRedemption}
                    disabled={summary.currentPoints <= 0}
                    className="flex-1 py-2.5 rounded-xl bg-primary text-white text-[12px] font-bold hover:bg-[#b00055] transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    Confirm & Redeem via QR
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: SIMULATE QR PAYMENT AT PARTNER SALON                            */}
      {/* ========================================================================= */}
      {isQrSimulateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-surface rounded-3xl p-5 sm:p-6 shadow-2xl border border-outline-variant/40 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">add_card</span>
                </div>
                <div>
                  <h3 className="font-card-title text-[17px] font-bold text-on-surface">
                    Pay at Partner Salon via Nexora QR
                  </h3>
                  <p className="text-[11px] text-on-surface-variant">
                    Simulate QR payment to test the minimum ₹100 rule & earn 10% points
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsQrSimulateModalOpen(false)}
                className="w-8 h-8 rounded-full bg-surface-container text-on-surface-variant flex items-center justify-center hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Salon Selection */}
            <div>
              <label className="text-[12px] font-bold text-on-surface block mb-1">
                Partner Salon
              </label>
              <select
                id="sim-salon-select"
                value={simSalonId}
                onChange={(e) => setSimSalonId(e.target.value)}
                className="w-full h-11 px-3 bg-surface-container-lowest text-on-surface rounded-xl text-[13px] border border-outline-variant/50 focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer"
              >
                {salons.map((salon) => (
                  <option key={salon.id} value={salon.id}>
                    {salon.name} ({salon.location.area})
                  </option>
                ))}
              </select>
            </div>

            {/* Bill Amount */}
            <div>
              <label className="text-[12px] font-bold text-on-surface block mb-1 flex items-center justify-between">
                <span>QR Payment Bill Amount (₹)</span>
                <span className="text-[10px] text-amber-800 font-bold bg-amber-500/15 px-1.5 py-0.2 rounded">
                  Minimum ₹100 required to earn rewards
                </span>
              </label>
              <input
                type="number"
                id="sim-bill-amount-input"
                value={simBillAmount}
                onChange={(e) => setSimBillAmount(e.target.value)}
                min="10"
                step="50"
                className="w-full h-11 px-3.5 bg-surface-container-lowest text-on-surface rounded-xl text-[14px] font-bold border border-outline-variant/50 focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Service description */}
            <div>
              <label className="text-[12px] font-bold text-on-surface block mb-1">
                Services Used
              </label>
              <input
                type="text"
                id="sim-description-input"
                value={simDescription}
                onChange={(e) => setSimDescription(e.target.value)}
                placeholder="e.g. Haircut, Hydra Facial, Spa"
                className="w-full h-11 px-3.5 bg-surface-container-lowest text-on-surface rounded-xl text-[13px] border border-outline-variant/50 focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Live Rule Check Preview */}
            <div className="p-3.5 bg-surface-container-lowest rounded-xl border border-outline-variant/40">
              {Number(simBillAmount) >= MIN_QR_PAYMENT_INR ? (
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-emerald-800 font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px]">check_circle</span>
                      Eligible for 10% QR Cashback!
                    </span>
                    <span className="text-[11px] text-on-surface-variant block mt-0.5">
                      ₹{Number(simBillAmount)} QR bill qualifies for points
                    </span>
                  </div>
                  <span className="text-[18px] font-extrabold text-emerald-700">
                    +{Math.round(Number(simBillAmount) * (QR_CASHBACK_PERCENT / 100))} pts
                  </span>
                </div>
              ) : (
                <div className="flex items-start gap-2 text-rose-700">
                  <span className="material-symbols-outlined text-[18px] mt-0.5">warning</span>
                  <div>
                    <span className="text-[12px] font-bold block">Ineligible for Rewards</span>
                    <span className="text-[11px] text-rose-600 block mt-0.5">
                      Bill is below ₹{MIN_QR_PAYMENT_INR}. Business rule requires minimum ₹{MIN_QR_PAYMENT_INR} QR payment.
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsQrSimulateModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-surface-container text-on-surface text-[12px] font-semibold hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-sim-qr-payment-btn"
                onClick={handleExecuteQrPayment}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-[12px] font-bold hover:bg-[#b00055] transition-colors cursor-pointer shadow-xs"
              >
                Complete QR Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: REFERRAL CODE SHARING MODAL                                      */}
      {/* ========================================================================= */}
      {isReferralModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-surface rounded-3xl p-5 sm:p-6 shadow-2xl border border-outline-variant/40 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#b00055]/10 text-[#b00055] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">share</span>
                </div>
                <div>
                  <h3 className="font-card-title text-[17px] font-bold text-on-surface">
                    Refer Friends & Earn 150 pts
                  </h3>
                  <p className="text-[11px] text-on-surface-variant">
                    Both you and your friend earn when they pay via QR
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsReferralModalOpen(false)}
                className="w-8 h-8 rounded-full bg-surface-container text-on-surface-variant flex items-center justify-center hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="p-4 bg-gradient-to-br from-[#b00055]/10 to-primary/10 rounded-2xl border border-[#b00055]/20 text-center">
              <span className="text-[11px] uppercase tracking-wider font-bold text-on-surface-variant block">
                Your Unique Invite Code
              </span>
              <span className="text-[24px] font-mono font-extrabold text-[#b00055] tracking-wide block my-2 select-all">
                {userReferralCode}
              </span>
              <button
                type="button"
                onClick={handleCopyReferralCode}
                className="px-4 py-2 bg-primary text-white text-[12px] font-bold rounded-xl hover:bg-[#b00055] transition-colors inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">content_copy</span>
                <span>Copy Referral Code</span>
              </button>
            </div>

            <div className="p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/40 text-[11px] space-y-1.5 text-on-surface-variant">
              <div className="flex items-start gap-1.5 text-on-surface font-semibold">
                <span className="material-symbols-outlined text-[15px] text-amber-700 mt-0.5">info</span>
                <span>Referral Business Rule:</span>
              </div>
              <p className="pl-5">
                Referral reward points credit <strong>only after</strong> your referred friend completes a minimum ₹100 payment through Nexora QR at any partner salon.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsReferralModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-surface-container text-on-surface text-[12px] font-semibold hover:bg-surface-container-high transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: TRANSACTION DETAIL MODAL                                         */}
      {/* ========================================================================= */}
      {selectedTransactionDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-surface rounded-3xl p-5 sm:p-6 shadow-2xl border border-outline-variant/40 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                    getTypeBadgeMeta(selectedTransactionDetail.type).colorClass
                  }`}
                >
                  <span className="material-symbols-outlined text-[24px]">
                    {getTypeBadgeMeta(selectedTransactionDetail.type).icon}
                  </span>
                </div>
                <div>
                  <h3 className="font-card-title text-[16px] font-bold text-on-surface">
                    Transaction Details
                  </h3>
                  <p className="text-[11px] text-on-surface-variant">
                    Ref: {selectedTransactionDetail.qrTransactionRef || selectedTransactionDetail.id}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTransactionDetail(null)}
                className="w-8 h-8 rounded-full bg-surface-container text-on-surface-variant flex items-center justify-center hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="space-y-2.5 text-[12px]">
              <div className="flex justify-between p-2.5 bg-surface-container-lowest rounded-xl border border-outline-variant/30">
                <span className="text-on-surface-variant">Type:</span>
                <span className="font-bold text-on-surface">
                  {selectedTransactionDetail.typeLabel}
                </span>
              </div>

              <div className="flex justify-between p-2.5 bg-surface-container-lowest rounded-xl border border-outline-variant/30">
                <span className="text-on-surface-variant">Points:</span>
                <span
                  className={`font-extrabold text-[14px] ${
                    selectedTransactionDetail.points > 0
                      ? 'text-emerald-700'
                      : 'text-indigo-700'
                  }`}
                >
                  {selectedTransactionDetail.points > 0
                    ? `+${selectedTransactionDetail.points}`
                    : selectedTransactionDetail.points}{' '}
                  pts
                </span>
              </div>

              <div className="flex justify-between p-2.5 bg-surface-container-lowest rounded-xl border border-outline-variant/30">
                <span className="text-on-surface-variant">Status:</span>
                <span
                  className={`font-extrabold uppercase text-[10px] px-2 py-0.5 rounded-full border ${
                    getStatusBadgeMeta(selectedTransactionDetail.status).badgeClass
                  }`}
                >
                  {selectedTransactionDetail.status}
                </span>
              </div>

              <div className="flex justify-between p-2.5 bg-surface-container-lowest rounded-xl border border-outline-variant/30">
                <span className="text-on-surface-variant">Partner Salon:</span>
                <span className="font-bold text-on-surface">
                  {selectedTransactionDetail.salonName}
                </span>
              </div>

              <div className="flex justify-between p-2.5 bg-surface-container-lowest rounded-xl border border-outline-variant/30">
                <span className="text-on-surface-variant">Date:</span>
                <span className="font-medium text-on-surface">
                  {selectedTransactionDetail.date}
                </span>
              </div>

              {selectedTransactionDetail.billAmount && (
                <div className="flex justify-between p-2.5 bg-surface-container-lowest rounded-xl border border-outline-variant/30">
                  <span className="text-on-surface-variant">In-Shop QR Bill:</span>
                  <span className="font-bold text-on-surface">
                    ₹{selectedTransactionDetail.billAmount.toLocaleString('en-IN')}
                  </span>
                </div>
              )}

              {selectedTransactionDetail.friendName && (
                <div className="flex justify-between p-2.5 bg-surface-container-lowest rounded-xl border border-outline-variant/30">
                  <span className="text-on-surface-variant">Referred Friend:</span>
                  <span className="font-bold text-[#b00055]">
                    {selectedTransactionDetail.friendName}
                  </span>
                </div>
              )}

              {selectedTransactionDetail.expiresAt && (
                <div className="flex justify-between p-2.5 bg-surface-container-lowest rounded-xl border border-outline-variant/30">
                  <span className="text-on-surface-variant">Expiry Date:</span>
                  <span className="font-bold text-amber-800">
                    {selectedTransactionDetail.expiresAt}
                  </span>
                </div>
              )}

              {selectedTransactionDetail.description && (
                <div className="p-2.5 bg-surface-container-lowest rounded-xl border border-outline-variant/30">
                  <span className="text-on-surface-variant block mb-0.5">Notes:</span>
                  <span className="text-on-surface text-[11px]">
                    {selectedTransactionDetail.description}
                  </span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSelectedTransactionDetail(null)}
              className="w-full py-2.5 rounded-xl bg-primary text-white text-[12px] font-bold hover:bg-[#b00055] transition-colors cursor-pointer shadow-xs"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
