import React, { useEffect, useMemo, useState } from 'react';
import type { UserProfile } from '../types.ts';
import {
  computeReferralSummary,
  loadReferralRecords,
  saveReferralRecords,
  loadLiveReferrals,
  saveReferralRecordLive,
  REFERRAL_POINTS_PER_INVITE,
  MIN_QUALIFYING_QR_PAYMENT,
  type ReferralRecord,
} from '../lib/referralService.ts';
import { isLiveCustomerDataEnabled } from '../lib/supabase';

interface ReferralPageProps {
  user: UserProfile;
  userId?: string | null;
  onBack?: () => void;
  onOpenRewards?: () => void;
  onExploreSalons?: () => void;
}

export const ReferralPage: React.FC<ReferralPageProps> = ({
  user,
  userId,
  onBack,
  onOpenRewards,
  onExploreSalons,
}) => {
  // Referral code derivation
  const referralCode = useMemo(() => {
    if (user.referralCode) return user.referralCode;
    const clean = (user.name || 'USER').replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 6) || 'NXUSER';
    return `NEXORA-${clean}78`;
  }, [user.referralCode, user.name]);

  // Load referral records — live Supabase rows when configured, otherwise the
  // unconfigured local preview store.
  const [records, setRecords] = useState<ReferralRecord[]>(() =>
    isLiveCustomerDataEnabled && userId ? [] : loadReferralRecords(user.email || user.phone)
  );
  const [filterTab, setFilterTab] = useState<'all' | 'completed' | 'pending'>('all');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const refreshRecords = async () => {
    if (isLiveCustomerDataEnabled && userId) {
      const live = await loadLiveReferrals(userId);
      setRecords(live);
    } else {
      setRecords(loadReferralRecords(user.email || user.phone));
    }
  };

  useEffect(() => {
    void refreshRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, user.email]);

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteMobile, setInviteMobile] = useState('');

  const summary = useMemo(
    () => computeReferralSummary(referralCode, records),
    [referralCode, records]
  );

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((cur) => (cur === msg ? null : cur));
    }, 2500);
  };

  const handleCopyCode = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(summary.referralCode);
      showToast(`Referral code ${summary.referralCode} copied!`);
    } else {
      showToast(`Referral code: ${summary.referralCode}`);
    }
  };

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(summary.referralLink);
      showToast('Referral link copied to clipboard!');
    } else {
      showToast(`Referral link: ${summary.referralLink}`);
    }
  };

  const handleShareWhatsApp = () => {
    const message = `Hey! Join me on Nexora SalonOS. Use my referral code *${summary.referralCode}* or click ${summary.referralLink} to earn bonus reward points on your first ₹${MIN_QUALIFYING_QR_PAYMENT}+ QR payment at top Jaipur partner salons!`;
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    if (typeof window !== 'undefined' && typeof window.open === 'function' && !window.navigator?.userAgent?.includes('jsdom')) {
      try {
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      } catch {
        // Ignore navigation error in test environments
      }
    }
    showToast('Opening WhatsApp to share invite...');
  };

  const handleAddInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim()) return;

    const newRecord: ReferralRecord = {
      id: `ref-${Date.now()}`,
      friendName: inviteName.trim(),
      friendMobile: inviteMobile ? `+91 ${inviteMobile.replace(/[^0-9]/g, '').slice(0, 10)}` : undefined,
      invitedDate: 'Today',
      status: 'pending',
      rewardPoints: REFERRAL_POINTS_PER_INVITE,
      salonName: `Awaiting first ₹${MIN_QUALIFYING_QR_PAYMENT}+ QR payment`,
    };

    if (isLiveCustomerDataEnabled && userId) {
      const { error } = await saveReferralRecordLive(userId, newRecord);
      if (error) {
        showToast(error);
        return;
      }
      await refreshRecords();
    } else {
      const updated = [newRecord, ...records];
      setRecords(updated);
      saveReferralRecords(updated, user.email || user.phone);
    }
    setShowInviteModal(false);
    setInviteName('');
    setInviteMobile('');
    showToast(`Invite sent to ${newRecord.friendName}!`);
  };

  const filteredFriends = useMemo(() => {
    if (filterTab === 'completed') return records.filter((r) => r.status === 'completed');
    if (filterTab === 'pending') return records.filter((r) => r.status === 'pending');
    return records;
  }, [records, filterTab]);

  return (
    <div
      id="customer-referral-page"
      data-route="/customer/referral"
      className="flex flex-col w-full pb-28 max-w-4xl mx-auto px-page-margin pt-2"
    >
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-20 right-4 sm:right-8 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="p-3 px-4 bg-surface-container-highest/95 backdrop-blur-md text-on-surface rounded-2xl shadow-xl border border-[#b00055]/30 flex items-center gap-2.5 text-[13px] font-semibold">
            <span className="material-symbols-outlined text-[18px] text-success-emerald">check_circle</span>
            <span>{toastMsg}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              id="btn-referral-back"
              onClick={onBack}
              className="w-10 h-10 rounded-2xl bg-surface-container-low border border-outline-variant/50 hover:bg-surface-container flex items-center justify-center text-on-surface cursor-pointer shadow-xs transition-colors"
              title="Go Back"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
          )}
          <div>
            <h1 className="text-[24px] font-extrabold text-on-surface tracking-tight">Refer & Earn</h1>
            <p className="text-[12px] text-on-surface-variant">Invite friends and earn ₹150 salon points on qualifying visits</p>
          </div>
        </div>

        <button
          type="button"
          id="btn-referral-invite-friend"
          onClick={() => setShowInviteModal(true)}
          className="px-3.5 py-2 rounded-2xl bg-primary text-white text-[12px] font-bold hover:bg-primary/90 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
        >
          <span className="material-symbols-outlined text-[16px]">person_add</span>
          <span className="hidden sm:inline">Invite Friend</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* REFERRAL RULES BANNER (MANDATORY REQUIREMENT)                             */}
      {/* ========================================================================= */}
      <div
        id="section-referral-rules"
        className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-4 sm:p-5 mb-5"
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-2xl bg-amber-500/20 text-amber-900 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">policy</span>
          </div>
          <div className="flex-1">
            <h2 className="text-[14px] font-extrabold text-amber-900 mb-1.5 flex items-center gap-1.5">
              <span>Nexora Referral Program Rules</span>
            </h2>
            <ul className="space-y-1.5 text-[12px] text-amber-950 font-medium">
              <li className="flex items-start gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-amber-800 shrink-0 mt-0.5">check_circle</span>
                <span id="rule-min-payment">
                  Customer gets referral points only when referred user makes minimum <strong>₹100 QR payment</strong> at a Nexora partner shop.
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-amber-800 shrink-0 mt-0.5">check_circle</span>
                <span id="rule-not-cash">
                  Referral rewards are <strong>not cash</strong> (cannot be withdrawn to bank accounts).
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-amber-800 shrink-0 mt-0.5">check_circle</span>
                <span id="rule-partner-only">
                  Rewards can be redeemed <strong>only at partner shops</strong> via in-shop QR code.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* REFERRAL CODE & LINK HERO CARD                                            */}
      {/* ========================================================================= */}
      <div
        id="section-referral-hero"
        className="bg-gradient-to-r from-primary via-[#b00055] to-primary-container rounded-3xl p-5 sm:p-6 text-white shadow-lg mb-5 relative overflow-hidden"
      >
        <div className="relative z-10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="px-2.5 py-0.5 bg-white/20 rounded-full font-bold text-[11px] uppercase tracking-wide">
                Gift ₹150 · Get ₹150
              </span>
              <h2 className="text-[20px] sm:text-[22px] font-extrabold mt-1.5">
                Share your invite code with friends
              </h2>
              <p className="text-[12px] opacity-90">
                They get discount points, and you receive {REFERRAL_POINTS_PER_INVITE} pts (₹{REFERRAL_POINTS_PER_INVITE}) when they pay ₹{MIN_QUALIFYING_QR_PAYMENT}+ via QR at any partner salon.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {/* Referral Code Box */}
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-3.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-white/80 block">Your Referral Code</span>
                <span id="referral-code-display" className="font-mono text-[17px] font-extrabold text-amber-200 tracking-wider truncate block">
                  {summary.referralCode}
                </span>
              </div>
              <button
                type="button"
                id="btn-copy-referral-code"
                onClick={handleCopyCode}
                className="px-3.5 py-2 rounded-xl bg-white text-primary hover:bg-white/90 text-[12px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-xs"
              >
                <span className="material-symbols-outlined text-[16px]">content_copy</span>
                <span>Copy Code</span>
              </button>
            </div>

            {/* Referral Link Box */}
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-3.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-white/80 block">Your Referral Link</span>
                <span id="referral-link-display" className="text-[12px] font-mono text-white/90 truncate block">
                  {summary.referralLink}
                </span>
              </div>
              <button
                type="button"
                id="btn-copy-referral-link"
                onClick={handleCopyLink}
                className="px-3.5 py-2 rounded-xl bg-white text-primary hover:bg-white/90 text-[12px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-xs"
              >
                <span className="material-symbols-outlined text-[16px]">link</span>
                <span>Copy Link</span>
              </button>
            </div>
          </div>

          {/* Share on WhatsApp Button */}
          <div className="pt-1">
            <button
              type="button"
              id="btn-share-whatsapp"
              onClick={handleShareWhatsApp}
              className="w-full py-3 px-4 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[14px] flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-md"
            >
              <span className="material-symbols-outlined text-[20px]">chat</span>
              <span>Share on WhatsApp</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* METRICS STRIP (THE 4 REQUIRED METRICS)                                    */}
      {/* ========================================================================= */}
      <section
        id="section-referral-metrics"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5"
      >
        {/* Metric 1: Total Invited */}
        <div className="bg-surface-container-low border border-outline-variant/50 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="material-symbols-outlined text-[18px] text-primary">group</span>
            <span className="text-[11px] font-bold uppercase text-on-surface-variant">Total Invited</span>
          </div>
          <span id="metric-total-invited" className="text-[22px] font-extrabold text-on-surface tabular-nums">
            {summary.totalInvited}
          </span>
          <span className="text-[11px] text-on-surface-variant block mt-0.5">Friends joined</span>
        </div>

        {/* Metric 2: Successful Referrals */}
        <div className="bg-surface-container-low border border-outline-variant/50 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="material-symbols-outlined text-[18px] text-emerald-800">check_circle</span>
            <span className="text-[11px] font-bold uppercase text-on-surface-variant">Successful</span>
          </div>
          <span id="metric-successful-referrals" className="text-[22px] font-extrabold text-emerald-800 tabular-nums">
            {summary.successfulReferrals}
          </span>
          <span className="text-[11px] text-on-surface-variant block mt-0.5">Completed ₹100+ QR</span>
        </div>

        {/* Metric 3: Pending Referrals */}
        <div className="bg-surface-container-low border border-outline-variant/50 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="material-symbols-outlined text-[18px] text-amber-700">hourglass_top</span>
            <span className="text-[11px] font-bold uppercase text-on-surface-variant">Pending</span>
          </div>
          <span id="metric-pending-referrals" className="text-[22px] font-extrabold text-amber-700 tabular-nums">
            {summary.pendingReferrals}
          </span>
          <span className="text-[11px] text-on-surface-variant block mt-0.5">Awaiting 1st payment</span>
        </div>

        {/* Metric 4: Reward Earned */}
        <div className="bg-surface-container-low border border-outline-variant/50 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="material-symbols-outlined text-[18px] text-[#b00055]">stars</span>
            <span className="text-[11px] font-bold uppercase text-on-surface-variant">Reward Earned</span>
          </div>
          <span id="metric-reward-earned" className="text-[22px] font-extrabold text-[#b00055] tabular-nums">
            {summary.rewardEarned} pts
          </span>
          <span className="text-[11px] text-on-surface-variant block mt-0.5">₹{summary.rewardEarned} partner value</span>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3-STEP HOW IT WORKS GUIDE                                                 */}
      {/* ========================================================================= */}
      <section
        id="section-referral-steps"
        className="bg-surface-container-low border border-outline-variant/50 rounded-3xl p-5 shadow-xs mb-5"
      >
        <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-outline-variant/30">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">help_outline</span>
          </div>
          <div>
            <h2 className="text-[16px] font-bold text-on-surface">How Referral Rewards Work</h2>
            <p className="text-[11px] text-on-surface-variant">Three simple steps to unlock your bonus points</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 relative">
            <span className="w-6 h-6 rounded-full bg-primary text-white text-[12px] font-extrabold flex items-center justify-center mb-2">1</span>
            <h3 className="text-[13px] font-bold text-on-surface mb-1">Share Invite Code</h3>
            <p className="text-[11px] text-on-surface-variant">Send your unique referral code or link to friends on WhatsApp or social media.</p>
          </div>

          <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 relative">
            <span className="w-6 h-6 rounded-full bg-primary text-white text-[12px] font-extrabold flex items-center justify-center mb-2">2</span>
            <h3 className="text-[13px] font-bold text-on-surface mb-1">Friend Pays ₹100+ via QR</h3>
            <p className="text-[11px] text-on-surface-variant">Your friend visits any partner salon and pays their bill (min ₹100) using Nexora QR.</p>
          </div>

          <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 relative">
            <span className="w-6 h-6 rounded-full bg-primary text-white text-[12px] font-extrabold flex items-center justify-center mb-2">3</span>
            <h3 className="text-[13px] font-bold text-on-surface mb-1">Earn 150 Points (₹150)</h3>
            <p className="text-[11px] text-on-surface-variant">Points are automatically credited to your Rewards Wallet for your next salon booking.</p>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* REFERRED FRIENDS LIST                                                     */}
      {/* ========================================================================= */}
      <section
        id="section-referred-friends"
        className="bg-surface-container-low border border-outline-variant/50 rounded-3xl p-5 shadow-xs mb-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-outline-variant/30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">groups</span>
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-on-surface">Referred Friends</h2>
              <p className="text-[11px] text-on-surface-variant">Track status of friends who joined with your code</p>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex bg-surface-container-lowest p-1 rounded-xl border border-outline-variant/40 text-[12px] font-semibold">
            <button
              type="button"
              id="filter-tab-all"
              onClick={() => setFilterTab('all')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                filterTab === 'all'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              All ({records.length})
            </button>
            <button
              type="button"
              id="filter-tab-completed"
              onClick={() => setFilterTab('completed')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                filterTab === 'completed'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Completed ({summary.successfulReferrals})
            </button>
            <button
              type="button"
              id="filter-tab-pending"
              onClick={() => setFilterTab('pending')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                filterTab === 'pending'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Pending ({summary.pendingReferrals})
            </button>
          </div>
        </div>

        {/* Friend Cards */}
        <div className="space-y-2.5">
          {filteredFriends.map((friend) => (
            <div
              key={friend.id}
              className="p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={friend.friendAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80'}
                  alt={friend.friendName}
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-outline-variant/30 shrink-0"
                />
                <div className="min-w-0">
                  <h3 className="text-[13px] font-bold text-on-surface truncate">{friend.friendName}</h3>
                  <p className="text-[11px] text-on-surface-variant truncate">
                    {friend.salonName || `Invited on ${friend.invitedDate}`}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end shrink-0">
                {friend.status === 'completed' ? (
                  <>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-800 text-[11px] font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">check_circle</span>
                      <span>+150 pts</span>
                    </span>
                    <span className="text-[10px] text-on-surface-variant mt-0.5">Completed</span>
                  </>
                ) : (
                  <>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-800 text-[11px] font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">hourglass_top</span>
                      <span>Pending ₹100 QR</span>
                    </span>
                    <span className="text-[10px] text-on-surface-variant mt-0.5">Awaiting visit</span>
                  </>
                )}
              </div>
            </div>
          ))}

          {filteredFriends.length === 0 && (
            <div className="text-center py-8 text-on-surface-variant">
              <span className="material-symbols-outlined text-[32px] opacity-40 mb-1">group_off</span>
              <p className="text-[13px] font-semibold">No referrals in this category</p>
            </div>
          )}
        </div>
      </section>

      {/* Quick Links / Partner Salon Navigation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {onExploreSalons && (
          <button
            type="button"
            id="btn-referral-explore-salons"
            onClick={onExploreSalons}
            className="p-4 rounded-2xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/50 text-on-surface flex items-center justify-between cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[22px] text-primary">storefront</span>
              <div className="text-left">
                <span className="text-[13px] font-bold block">Find Partner Salons</span>
                <span className="text-[11px] text-on-surface-variant">Where friends can pay via QR</span>
              </div>
            </div>
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        )}

        {onOpenRewards && (
          <button
            type="button"
            id="btn-referral-open-rewards"
            onClick={onOpenRewards}
            className="p-4 rounded-2xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/50 text-on-surface flex items-center justify-between cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[22px] text-[#b00055]">stars</span>
              <div className="text-left">
                <span className="text-[13px] font-bold block">View Rewards Wallet</span>
                <span className="text-[11px] text-on-surface-variant">Check balance & redemption history</span>
              </div>
            </div>
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        )}
      </div>

      {/* Invite Friend Modal */}
      {showInviteModal && (
        <div
          id="modal-invite-friend"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-surface-container-highest border border-outline-variant/50 rounded-3xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[22px]">person_add</span>
                </div>
                <div>
                  <h3 className="text-[17px] font-extrabold text-on-surface">Invite a Friend</h3>
                  <p className="text-[11px] text-on-surface-variant">Earn 150 pts when they pay ₹100+ via QR</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="w-8 h-8 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface-variant flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleAddInvite} className="space-y-3.5">
              <div>
                <label htmlFor="input-invite-name" className="block text-[12px] font-semibold text-on-surface mb-1">
                  Friend's Name
                </label>
                <input
                  id="input-invite-name"
                  type="text"
                  required
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g. Priya Sharma"
                  className="w-full h-11 px-3.5 rounded-xl bg-surface-container border border-outline-variant/50 focus:border-primary text-on-surface text-[14px] outline-hidden"
                />
              </div>

              <div>
                <label htmlFor="input-invite-mobile" className="block text-[12px] font-semibold text-on-surface mb-1">
                  Mobile Number (Optional)
                </label>
                <input
                  id="input-invite-mobile"
                  type="tel"
                  value={inviteMobile}
                  onChange={(e) => setInviteMobile(e.target.value)}
                  placeholder="98290 00000"
                  className="w-full h-11 px-3.5 rounded-xl bg-surface-container border border-outline-variant/50 focus:border-primary text-on-surface text-[14px] outline-hidden"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 rounded-xl bg-surface-container text-on-surface text-[13px] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-confirm-send-invite"
                  onClick={(e) => {
                    if (inviteName.trim()) {
                      handleAddInvite(e);
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-[13px] font-bold shadow-xs cursor-pointer"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
