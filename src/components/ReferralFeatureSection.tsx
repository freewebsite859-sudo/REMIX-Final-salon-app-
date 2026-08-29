import React, { useState, useMemo, useEffect } from 'react';
import { UserProfile, ReferredFriend } from '../types';

interface ReferralFeatureSectionProps {
  user: UserProfile;
  onUpdateUser: (updated: UserProfile) => void;
  showToast?: (msg: string) => void;
}

const DEFAULT_SAMPLE_FRIENDS: ReferredFriend[] = [
  {
    id: 'ref-1',
    name: 'Rhea Kapoor',
    date: '2026-08-15',
    reward: '+150 Loyalty Pts (₹150 Credit)',
    status: 'completed',
  },
  {
    id: 'ref-2',
    name: 'Arjun Mehra',
    date: '2026-08-20',
    reward: '+150 Loyalty Pts (₹150 Credit)',
    status: 'completed',
  },
  {
    id: 'ref-3',
    name: 'Pooja Sharma',
    date: '2026-08-26',
    reward: '+150 Loyalty Pts (₹150 Credit)',
    status: 'completed',
  },
  {
    id: 'ref-4',
    name: 'Vikram Rathore',
    date: '2026-08-28',
    reward: 'Pending (+150 Pts on Sign-Up)',
    status: 'pending',
  },
];

const RANDOM_FRIEND_NAMES = [
  'Sneha Patel',
  'Ananya Verma',
  'Kabir Khanna',
  'Rohan Singhania',
  'Divya Deshmukh',
  'Aditya Roy',
  'Meera Joshi',
  'Kunal Malhotra',
];

export const ReferralFeatureSection: React.FC<ReferralFeatureSectionProps> = ({
  user,
  onUpdateUser,
  showToast,
}) => {
  // 1. Generate or load unique referral code
  const referralCode = useMemo(() => {
    if (user.referralCode && user.referralCode.trim().length > 0) {
      return user.referralCode;
    }
    const cleanName = (user.name || 'NEXORA')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 5) || 'USER';
    return `NX-${cleanName}${Math.floor(100 + Math.random() * 900)}`;
  }, [user.referralCode, user.name]);

  // Sync back to user profile if missing
  useEffect(() => {
    if (!user.referralCode && referralCode) {
      onUpdateUser({
        ...user,
        referralCode,
      });
    }
  }, [user.referralCode, referralCode]);

  // 2. Unique Referral Link
  const referralLink = useMemo(() => {
    const origin =
      typeof window !== 'undefined' && window.location.origin
        ? window.location.origin
        : 'https://nexora.app';
    return `${origin}/?ref=${encodeURIComponent(referralCode)}`;
  }, [referralCode]);

  // Local state
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [inviteInput, setInviteInput] = useState('');
  const [filter, setFilter] = useState<'all' | 'completed' | 'pending'>('all');
  const [showQRModal, setShowQRModal] = useState(false);
  const [celebrationModal, setCelebrationModal] = useState<{
    friendName: string;
    pointsAwarded: number;
    walletAwarded: number;
  } | null>(null);

  // Friends list
  const friends: ReferredFriend[] = useMemo(() => {
    if (user.referredFriends && user.referredFriends.length > 0) {
      return user.referredFriends;
    }
    return DEFAULT_SAMPLE_FRIENDS;
  }, [user.referredFriends]);

  const completedFriends = useMemo(
    () => friends.filter((f) => f.status === 'completed'),
    [friends]
  );
  const pendingFriends = useMemo(
    () => friends.filter((f) => f.status === 'pending'),
    [friends]
  );

  const filteredFriends = useMemo(() => {
    if (filter === 'completed') return completedFriends;
    if (filter === 'pending') return pendingFriends;
    return friends;
  }, [filter, completedFriends, pendingFriends, friends]);

  // Points earned through referrals (150 per completed friend)
  const referralPointsEarned = completedFriends.length * 150;
  const totalWalletEarned = completedFriends.length * 150;
  const claimedDiscounts = user.claimedDiscounts || 150;
  const availableWalletBalance = Math.max(0, totalWalletEarned - claimedDiscounts);

  // Copy unique link
  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(referralLink);
      }
      setCopiedLink(true);
      showToast?.('Referral link copied to clipboard!');
      setTimeout(() => setCopiedLink(false), 3000);
    } catch {
      setCopiedLink(true);
      showToast?.('Referral link ready to share');
      setTimeout(() => setCopiedLink(false), 3000);
    }
  };

  // Copy code
  const handleCopyCode = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(referralCode);
      }
      setCopiedCode(true);
      showToast?.('Referral code copied!');
      setTimeout(() => setCopiedCode(false), 3000);
    } catch {
      setCopiedCode(true);
      showToast?.(`Code: ${referralCode}`);
      setTimeout(() => setCopiedCode(false), 3000);
    }
  };

  // WhatsApp share
  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(
      `Hey! Use my Nexora referral link to get ₹150 OFF your first luxury haircut, facial, or spa treatment:\n\n${referralLink}\n\nPromo Code: *${referralCode}*`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
    showToast?.('Opening WhatsApp invitation...');
  };

  // Native share
  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Nexora Salon & Spa',
          text: `Use my invite code ${referralCode} to get ₹150 OFF your first appointment!`,
          url: referralLink,
        });
        showToast?.('Invitation shared successfully');
        return;
      } catch {
        // User cancelled or fallback
      }
    }
    handleCopyLink();
  };

  // 3. Send Invitation to a friend
  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = inviteInput.trim();
    if (!cleanInput) return;

    const newFriend: ReferredFriend = {
      id: `ref-${Date.now()}`,
      name: cleanInput,
      date: new Date().toISOString().split('T')[0],
      reward: 'Pending (+150 Pts on Sign-Up)',
      status: 'pending',
    };

    const updatedFriends = [newFriend, ...friends];
    onUpdateUser({
      ...user,
      referralCode,
      referredFriends: updatedFriends,
      referralCount: completedFriends.length,
    });

    setInviteInput('');
    showToast?.(`Invitation link sent to ${cleanInput}! You'll receive +150 Loyalty Points upon sign-up.`);
  };

  // 4. Simulate a Friend Sign-Up & Award Bonus Loyalty Points
  const handleSimulateSignUp = (targetFriendName?: string) => {
    const todayStr = new Date().toISOString().split('T')[0];
    let friendName = targetFriendName;
    let updatedFriends: ReferredFriend[] = [];

    // Check if there is an existing pending friend to complete
    const pendingIndex = targetFriendName
      ? friends.findIndex((f) => f.name === targetFriendName && f.status === 'pending')
      : friends.findIndex((f) => f.status === 'pending');

    if (pendingIndex >= 0) {
      friendName = friends[pendingIndex].name;
      updatedFriends = friends.map((f, i) =>
        i === pendingIndex
          ? {
              ...f,
              status: 'completed' as const,
              reward: '+150 Loyalty Pts (₹150 Credit)',
              date: todayStr,
            }
          : f
      );
    } else {
      // Pick a random realistic friend name
      const randomIdx = Math.floor(Math.random() * RANDOM_FRIEND_NAMES.length);
      friendName = RANDOM_FRIEND_NAMES[randomIdx];
      const newFriend: ReferredFriend = {
        id: `ref-${Date.now()}`,
        name: friendName,
        date: todayStr,
        reward: '+150 Loyalty Pts (₹150 Credit)',
        status: 'completed',
      };
      updatedFriends = [newFriend, ...friends];
    }

    const bonusPoints = 150;
    const currentPoints = user.loyaltyPoints ?? 450;
    const newTotalPoints = currentPoints + bonusPoints;
    const newTotalEarnings = (user.referralEarnings || totalWalletEarned) + 150;
    const newCount = (user.referralCount || completedFriends.length) + 1;

    onUpdateUser({
      ...user,
      referralCode,
      loyaltyPoints: newTotalPoints,
      referralEarnings: newTotalEarnings,
      referralCount: newCount,
      referredFriends: updatedFriends,
    });

    setCelebrationModal({
      friendName: friendName || 'Your Friend',
      pointsAwarded: bonusPoints,
      walletAwarded: 150,
    });

    showToast?.(`🎉 +150 Bonus Loyalty Points awarded for ${friendName}'s sign-up!`);
  };

  // Milestone rewards claims
  const claimedMilestones = user.claimedRewardIds || [];
  const milestones = [
    { id: 'milestone-1', count: 1, label: 'Bronze Referrer', rewardPts: 100, desc: '+100 Bonus Pts' },
    { id: 'milestone-3', count: 3, label: 'Silver Insider', rewardPts: 250, desc: '+250 Bonus Pts + Free Scalp Spa' },
    { id: 'milestone-5', count: 5, label: 'Gold Ambassador', rewardPts: 500, desc: '+500 Bonus Pts + VIP Pass' },
    { id: 'milestone-10', count: 10, label: 'Diamond VIP', rewardPts: 1000, desc: '+1000 Bonus Pts + Annual Pass' },
  ];

  const handleClaimMilestone = (milestoneId: string, pts: number, label: string) => {
    if (claimedMilestones.includes(milestoneId)) return;

    const currentPoints = user.loyaltyPoints ?? 450;
    const newTotalPoints = currentPoints + pts;
    const updatedClaimed = [...claimedMilestones, milestoneId];

    onUpdateUser({
      ...user,
      loyaltyPoints: newTotalPoints,
      claimedRewardIds: updatedClaimed,
    });

    showToast?.(`🌟 Claimed ${label} reward: +${pts} Bonus Loyalty Points!`);
  };

  return (
    <div
      id="section-rewards"
      className="bg-surface-container-low border border-outline-variant/50 rounded-2xl p-4 sm:p-5 shadow-xs mb-4"
    >
      {/* 1. Header Banner */}
      <div className="flex items-center justify-between mb-4 border-b border-outline-variant/30 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500/20 via-primary/15 to-primary/20 text-primary flex items-center justify-center shadow-xs">
            <span className="material-symbols-outlined text-[24px] text-amber-600 fill-1">military_tech</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-card-title text-[16px] font-bold text-on-surface">
                Refer a Friend & Rewards Club
              </h3>
              <span className="text-[10px] bg-gradient-to-r from-amber-500 to-amber-600 text-white font-black px-2 py-0.5 rounded-full shadow-xs">
                +150 Pts / Friend
              </span>
            </div>
            <p className="text-[11px] text-on-surface-variant">
              Share your unique referral link to give friends ₹150 OFF and earn bonus loyalty points
            </p>
          </div>
        </div>

        <div className="hidden sm:flex flex-col items-end">
          <span className="text-[11px] font-bold text-emerald-800 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
            Active Club
          </span>
          <span className="text-[10px] text-on-surface-variant mt-0.5 font-medium">
            {completedFriends.length} Friends Joined
          </span>
        </div>
      </div>

      {/* 2. Unique Referral Link Generator Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-primary/5 to-surface-container-lowest border border-amber-500/30 mb-4 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[16px] text-amber-600">link</span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                Your Unique Referral Link
              </span>
            </div>

            {/* Link Container with Copy Button */}
            <div className="flex items-center gap-2 mt-1.5 max-w-xl">
              <div className="flex-1 bg-white/90 border border-primary/25 rounded-xl px-3 py-2 text-[12px] font-mono text-primary font-semibold truncate shadow-2xs">
                {referralLink}
              </div>
              <button
                type="button"
                id="copy-referral-link-btn"
                onClick={handleCopyLink}
                className="px-3.5 py-2 bg-primary text-white text-[12px] font-bold rounded-xl hover:bg-[#b00055] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                title="Copy unique referral link"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {copiedLink ? 'check' : 'content_copy'}
                </span>
                <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>

            {/* Code pill */}
            <div className="flex items-center gap-2 mt-2 text-[11px] text-on-surface-variant">
              <span>Referral Code:</span>
              <button
                type="button"
                id="copy-referral-code-pill"
                onClick={handleCopyCode}
                className="font-mono font-black text-on-surface bg-white/80 border border-outline-variant/60 px-2.5 py-0.5 rounded-lg hover:border-primary transition-colors flex items-center gap-1 cursor-pointer"
                title="Click to copy code"
              >
                <span>{referralCode}</span>
                <span className="material-symbols-outlined text-[13px] text-primary">
                  {copiedCode ? 'check' : 'copy_all'}
                </span>
              </button>
            </div>
          </div>

          {/* Action Sharing Buttons */}
          <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
            <button
              type="button"
              id="whatsapp-share-btn"
              onClick={handleWhatsAppShare}
              className="flex-1 sm:flex-none px-3.5 py-2.5 bg-[#25D366] text-white text-[12px] font-bold rounded-xl hover:bg-[#20ba5a] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              title="Share via WhatsApp"
            >
              <span className="material-symbols-outlined text-[16px]">chat</span>
              <span>WhatsApp</span>
            </button>

            <button
              type="button"
              id="native-share-btn"
              onClick={handleNativeShare}
              className="flex-1 sm:flex-none px-3.5 py-2.5 bg-gradient-to-r from-primary to-[#b00055] text-white text-[12px] font-bold rounded-xl hover:opacity-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
              title="Share Link on Device"
            >
              <span className="material-symbols-outlined text-[16px]">share</span>
              <span>Share</span>
            </button>

            <button
              type="button"
              id="view-qr-btn"
              onClick={() => setShowQRModal(true)}
              className="px-3 py-2.5 bg-surface-container-highest text-on-surface text-[12px] font-bold rounded-xl hover:bg-surface-container border border-outline-variant/40 transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-xs"
              title="Show QR Code for scanning"
            >
              <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Loyalty Points & Referral Earnings KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
        {/* Referral Loyalty Points */}
        <div className="p-3 rounded-2xl bg-surface-container-lowest border border-amber-500/30 text-center flex flex-col items-center justify-center shadow-2xs">
          <div className="flex items-center gap-1 text-[10px] text-amber-700 font-bold">
            <span className="material-symbols-outlined text-[14px]">stars</span>
            <span>Referral Points</span>
          </div>
          <span className="font-card-title text-[18px] sm:text-[20px] font-black text-amber-600 mt-0.5">
            +{referralPointsEarned} Pts
          </span>
          <span className="text-[9px] text-on-surface-variant font-medium">
            150 pts per verified friend
          </span>
        </div>

        {/* Current Total Loyalty Points */}
        <div className="p-3 rounded-2xl bg-surface-container-lowest border border-primary/20 text-center flex flex-col items-center justify-center shadow-2xs">
          <div className="flex items-center gap-1 text-[10px] text-primary font-bold">
            <span className="material-symbols-outlined text-[14px]">loyalty</span>
            <span>Total Points</span>
          </div>
          <span className="font-card-title text-[18px] sm:text-[20px] font-black text-primary mt-0.5">
            {user.loyaltyPoints ?? 450} Pts
          </span>
          <span className="text-[9px] text-on-surface-variant font-medium">
            ₹{Math.round((user.loyaltyPoints ?? 450) * 0.5)} booking discount
          </span>
        </div>

        {/* Total Wallet Cashback */}
        <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center flex flex-col items-center justify-center shadow-2xs">
          <span className="text-[10px] text-emerald-800 font-bold">Redeemable Balance</span>
          <span className="font-card-title text-[18px] sm:text-[20px] font-black text-emerald-700 mt-0.5">
            ₹{availableWalletBalance}
          </span>
          <span className="text-[9px] text-emerald-700 font-semibold">Active in wallet</span>
        </div>

        {/* Successful Sign-ups */}
        <div className="p-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/40 text-center flex flex-col items-center justify-center shadow-2xs">
          <span className="text-[10px] text-on-surface-variant font-semibold">Friends Joined</span>
          <span className="font-card-title text-[18px] sm:text-[20px] font-black text-on-surface mt-0.5">
            {completedFriends.length}
          </span>
          <span className="text-[9px] text-on-surface-variant">{pendingFriends.length} pending invites</span>
        </div>
      </div>

      {/* 4. 'Refer a Friend' Direct Invite & Live Simulator */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/5 via-surface-container-lowest to-[#b00055]/5 border border-primary/20 mb-4 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">forward_to_inbox</span>
            </div>
            <div>
              <h4 className="font-card-title text-[14px] font-bold text-on-surface">
                Send Direct Friend Invitation
              </h4>
              <p className="text-[11px] text-on-surface-variant">
                Enter your friend's details to send their ₹150 discount code
              </p>
            </div>
          </div>

          {/* Simulator Trigger */}
          <button
            type="button"
            id="simulate-friend-signup-btn"
            onClick={() => handleSimulateSignUp()}
            className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-[11px] font-black rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            title="Simulate a friend signing up to test +150 bonus loyalty points"
          >
            <span className="material-symbols-outlined text-[15px] animate-pulse">celebration</span>
            <span>Simulate Sign-Up (+150 Pts)</span>
          </button>
        </div>

        {/* Invite Form */}
        <form onSubmit={handleSendInvite} className="flex flex-col sm:flex-row gap-2 mt-2">
          <div className="relative flex-1">
            <input
              type="text"
              id="invite-friend-input"
              value={inviteInput}
              onChange={(e) => setInviteInput(e.target.value)}
              placeholder="Enter friend's name, email, or mobile number"
              className="w-full h-11 px-3.5 pl-10 bg-white text-on-surface rounded-xl text-[13px] border border-outline-variant/60 focus:border-primary focus:ring-1 focus:ring-primary shadow-2xs"
            />
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant absolute left-3 top-3 pointer-events-none">
              person_add
            </span>
          </div>

          <button
            type="submit"
            id="send-invite-btn"
            disabled={!inviteInput.trim()}
            className="h-11 px-5 bg-primary text-white font-bold rounded-xl text-[13px] hover:bg-[#b00055] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-40 shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">send</span>
            <span>Send Invite</span>
          </button>
        </form>

        {/* 3 Steps Guide */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 pt-3 border-t border-outline-variant/30 text-[11px]">
          <div className="flex items-center gap-2 bg-white/70 p-2.5 rounded-xl border border-outline-variant/20 shadow-2xs">
            <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center font-bold text-[10px] shrink-0">
              1
            </span>
            <span className="text-on-surface leading-tight">
              Share link with code <strong>{referralCode}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2 bg-white/70 p-2.5 rounded-xl border border-outline-variant/20 shadow-2xs">
            <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center font-bold text-[10px] shrink-0">
              2
            </span>
            <span className="text-on-surface leading-tight">
              Friend gets <strong>₹150 OFF</strong> on 1st booking
            </span>
          </div>

          <div className="flex items-center gap-2 bg-white/70 p-2.5 rounded-xl border border-outline-variant/20 shadow-2xs">
            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
              3
            </span>
            <span className="text-on-surface leading-tight">
              You earn <strong>+150 Bonus Loyalty Points</strong>
            </span>
          </div>
        </div>
      </div>

      {/* 5. Referral Milestones Roadmap */}
      <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/40 mb-4 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-on-surface-variant font-bold block">
              Tier Milestones & Bonus Loyalty Rewards
            </span>
            <h4 className="font-card-title text-[14px] font-extrabold text-on-surface flex items-center gap-1.5">
              <span>Referral Progress</span>
              <span className="text-primary text-[12px] font-semibold">
                ({completedFriends.length} Verified Friends)
              </span>
            </h4>
          </div>
          <span className="text-[11px] font-bold text-amber-700 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/30">
            {completedFriends.length >= 5 ? 'Gold Ambassador' : `${5 - completedFriends.length} more to Gold`}
          </span>
        </div>

        {/* Milestone Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2">
          {milestones.map((m) => {
            const isUnlocked = completedFriends.length >= m.count;
            const isClaimed = claimedMilestones.includes(m.id);

            return (
              <div
                key={m.id}
                className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                  isClaimed
                    ? 'bg-emerald-50/50 border-emerald-500/30 opacity-90'
                    : isUnlocked
                    ? 'bg-amber-50/80 border-amber-500/50 shadow-xs ring-1 ring-amber-400'
                    : 'bg-surface-container/50 border-outline-variant/30 opacity-70'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-on-surface-variant">
                      {m.count} {m.count === 1 ? 'Friend' : 'Friends'}
                    </span>
                    {isClaimed ? (
                      <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[13px]">check</span> Claimed
                      </span>
                    ) : isUnlocked ? (
                      <span className="text-[10px] text-amber-700 font-extrabold animate-pulse">
                        Ready!
                      </span>
                    ) : (
                      <span className="text-[10px] text-on-surface-variant font-medium">Locked</span>
                    )}
                  </div>
                  <h5 className="font-bold text-[12px] text-on-surface">{m.label}</h5>
                  <p className="text-[10px] text-primary font-semibold mt-0.5">{m.desc}</p>
                </div>

                <div className="mt-2.5 pt-2 border-t border-outline-variant/20">
                  {isClaimed ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-1 text-[10px] font-bold text-emerald-800 bg-emerald-100/80 rounded-lg cursor-default"
                    >
                      Bonus Points Claimed
                    </button>
                  ) : isUnlocked ? (
                    <button
                      type="button"
                      onClick={() => handleClaimMilestone(m.id, m.rewardPts, m.label)}
                      className="w-full py-1 text-[10px] font-black text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs cursor-pointer transition-colors"
                    >
                      Claim +{m.rewardPts} Pts
                    </button>
                  ) : (
                    <span className="text-[9px] text-on-surface-variant block text-center">
                      Need {m.count - completedFriends.length} more referral
                      {m.count - completedFriends.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. Referral Rewards Ledger */}
      <div>
        <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
          <h4 className="text-[12px] font-bold text-on-surface flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-primary">receipt_long</span>
            <span>Referral Friends Ledger</span>
          </h4>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-surface-container p-0.5 rounded-lg text-[10px]">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                filter === 'all'
                  ? 'bg-white text-primary shadow-xs font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              All ({friends.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('completed')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                filter === 'completed'
                  ? 'bg-white text-primary shadow-xs font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Signed Up ({completedFriends.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('pending')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                filter === 'pending'
                  ? 'bg-white text-primary shadow-xs font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Pending ({pendingFriends.length})
            </button>
          </div>
        </div>

        {/* Friends Cards */}
        <div className="flex flex-col gap-2">
          {filteredFriends.length === 0 ? (
            <div className="p-6 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-center text-[12px] text-on-surface-variant">
              <span className="material-symbols-outlined text-[32px] text-on-surface-variant/50 mb-1">
                group
              </span>
              <p>No referrals found in this tab.</p>
              <button
                type="button"
                onClick={handleCopyLink}
                className="mt-2 text-primary font-bold hover:underline inline-block cursor-pointer"
              >
                Share your referral link now
              </button>
            </div>
          ) : (
            filteredFriends.map((f) => (
              <div
                key={f.id}
                className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/30 flex items-center justify-between text-[12px] shadow-2xs hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-[#b00055]/20 text-primary font-black flex items-center justify-center text-[12px] shadow-2xs shrink-0">
                    {f.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <span className="font-bold text-on-surface block leading-tight">{f.name}</span>
                    <span className="text-[10px] text-on-surface-variant">
                      {f.status === 'completed' ? `Joined on ${f.date}` : `Invite sent on ${f.date}`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span
                      className={`font-bold text-[12px] block ${
                        f.status === 'completed' ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {f.reward}
                    </span>
                    <span
                      className={`text-[9px] px-2 py-0.5 rounded-md font-bold uppercase inline-block mt-0.5 ${
                        f.status === 'completed'
                          ? 'bg-emerald-500/15 text-emerald-800 border border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-800 border border-amber-500/30'
                      }`}
                    >
                      {f.status === 'completed' ? '✓ Signed Up' : '⏳ Pending'}
                    </span>
                  </div>

                  {f.status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => handleSimulateSignUp(f.name)}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold rounded-lg transition-colors cursor-pointer shadow-2xs"
                      title="Simulate this friend signing up to receive +150 loyalty points"
                    >
                      Simulate Join
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* QR Code Modal */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
              <span className="material-symbols-outlined text-[28px]">qr_code_2</span>
            </div>
            <h3 className="font-card-title text-[18px] font-bold text-on-surface">
              Scan to Join Nexora
            </h3>
            <p className="text-[12px] text-on-surface-variant mt-1">
              Have your friend scan this QR code on their camera to get ₹150 OFF their first salon booking!
            </p>

            {/* Visual QR Code Mockup */}
            <div className="my-5 p-4 bg-white rounded-2xl border-2 border-primary/20 inline-block shadow-md">
              <div className="w-44 h-44 bg-surface-container-highest rounded-xl flex flex-col items-center justify-center relative overflow-hidden p-2">
                <svg
                  className="w-full h-full text-on-surface"
                  viewBox="0 0 100 100"
                  fill="currentColor"
                >
                  <path d="M0 0h30v30H0zm4 4h22v22H4z" />
                  <path d="M8 8h14v14H8z" />
                  <path d="M70 0h30v30H70zm4 4h22v22H74z" />
                  <path d="M78 8h14v14H78z" />
                  <path d="M0 70h30v30H0zm4 4h22v22H4z" />
                  <path d="M8 78h14v14H8z" />
                  <path d="M40 10h10v10H40zm15 0h5v15h-5zm-15 20h20v10H40zm0 20h10v20H40zm20-10h10v10H60zm10 20h10v20H70zm-20 20h30v10H50zm35-30h15v10H85zm0 20h15v10H85z" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white font-black text-[12px] shadow-lg border-2 border-white">
                    NX
                  </div>
                </div>
              </div>
              <span className="font-mono text-[13px] font-black text-primary block mt-2 tracking-wider">
                {referralCode}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex-1 py-2.5 bg-primary text-white font-bold rounded-xl text-[13px] hover:bg-[#b00055] transition-colors cursor-pointer shadow-xs"
              >
                Copy Link
              </button>
              <button
                type="button"
                onClick={() => setShowQRModal(false)}
                className="px-4 py-2.5 bg-surface-container-highest text-on-surface font-bold rounded-xl text-[13px] hover:bg-surface-container transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bonus Loyalty Points Celebration Modal */}
      {celebrationModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest border border-amber-500/40 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center animate-in fade-in zoom-in-95 duration-200 relative overflow-hidden">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-400 to-amber-600 text-white flex items-center justify-center mx-auto mb-3 shadow-lg ring-4 ring-amber-200">
              <span className="material-symbols-outlined text-[36px] animate-bounce">loyalty</span>
            </div>

            <span className="text-[11px] font-black tracking-wider uppercase text-amber-700 bg-amber-100 px-3 py-0.5 rounded-full border border-amber-300">
              Referral Reward Unlocked
            </span>

            <h3 className="font-card-title text-[20px] font-black text-on-surface mt-2">
              +{celebrationModal.pointsAwarded} Bonus Loyalty Points!
            </h3>

            <p className="text-[13px] text-on-surface-variant mt-1.5 leading-relaxed">
              <strong>{celebrationModal.friendName}</strong> successfully signed up using your link!
              Your Nexora balance has been credited with{' '}
              <strong>+{celebrationModal.pointsAwarded} Loyalty Points</strong> and{' '}
              <strong>₹{celebrationModal.walletAwarded}</strong> wallet credit.
            </p>

            <div className="my-4 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-around text-center">
              <div>
                <span className="text-[10px] text-amber-800 font-bold block">New Points Balance</span>
                <span className="text-[18px] font-black text-amber-700">
                  {user.loyaltyPoints ?? 450} Pts
                </span>
              </div>
              <div className="w-px h-8 bg-amber-500/30" />
              <div>
                <span className="text-[10px] text-emerald-800 font-bold block">Wallet Cash</span>
                <span className="text-[18px] font-black text-emerald-700">
                  ₹{availableWalletBalance}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCelebrationModal(null)}
              className="w-full py-3 bg-gradient-to-r from-primary to-[#b00055] text-white font-bold rounded-xl text-[13px] hover:opacity-95 transition-opacity cursor-pointer shadow-md"
            >
              Awesome, Got It!
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
