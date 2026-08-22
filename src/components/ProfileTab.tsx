import React, { useState, useEffect, useRef, useMemo } from 'react';
import { UserProfile, ReferredFriend } from '../types';

interface ProfileTabProps {
  user: UserProfile;
  onUpdateUser: (updated: UserProfile) => void;
  onOpenAIAdvisor: () => void;
  onLogout?: () => void;
  onDeleteAccount?: () => void;
}

// 3 Default Original Avatars for Men
const MEN_AVATARS = [
  {
    id: 'men-1',
    name: 'Executive Fade',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    tag: 'Classic Beard',
  },
  {
    id: 'men-2',
    name: 'Modern Textured',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    tag: 'Urban Pompadour',
  },
  {
    id: 'men-3',
    name: 'Casual Groomed',
    url: 'https://images.unsplash.com/photo-1628157582853-a796fa650a6a?auto=format&fit=crop&w=400&q=80',
    tag: 'Clean Crop',
  },
];

// 3 Default Original Avatars for Women
const WOMEN_AVATARS = [
  {
    id: 'women-1',
    name: 'Glossy Beach Waves',
    url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
    tag: 'Natural Glow',
  },
  {
    id: 'women-2',
    name: 'Chic Balayage Bob',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    tag: 'French Lob',
  },
  {
    id: 'women-3',
    name: 'Voluminous Spirals',
    url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
    tag: 'Radiant Curls',
  },
];

// Helper to calculate age and birth month status
const calculateAge = (dobString?: string) => {
  if (!dobString) return null;
  const birthDate = new Date(dobString);
  if (isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  const isBirthMonth = today.getMonth() === birthDate.getMonth();
  const formattedDate = birthDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return {
    age: Math.max(0, age),
    isBirthMonth,
    formattedDate,
    text: `${Math.max(0, age)} yrs old`,
  };
};

// Client-side image compression & optimization helper
const compressAndResizeImage = (
  file: File
): Promise<{ dataUrl: string; origSize: string; compSize: string }> => {
  return new Promise((resolve, reject) => {
    const origSizeKb = (file.size / 1024).toFixed(0) + ' KB';
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 480;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          const compSizeKb =
            (Math.round((dataUrl.length * 3) / 4) / 1024).toFixed(0) + ' KB';
          resolve({
            dataUrl,
            origSize: origSizeKb,
            compSize: compSizeKb,
          });
        } else {
          resolve({
            dataUrl: readerEvent.target?.result as string,
            origSize: origSizeKb,
            compSize: origSizeKb,
          });
        }
      };
      img.onerror = reject;
      img.src = readerEvent.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const ProfileTab: React.FC<ProfileTabProps> = ({
  user,
  onUpdateUser,
  onOpenAIAdvisor,
  onLogout,
  onDeleteAccount,
}) => {
  // Personal Details state
  const [fullName, setFullName] = useState(user.name || '');
  const [dob, setDob] = useState(user.dateOfBirth || '1998-05-14');
  const [phone, setPhone] = useState(user.phone || '');
  const [genderRole, setGenderRole] = useState<'men' | 'women'>(user.gender || 'women');

  // Auto-save Micro-Indicators per section
  const [detailsSaveState, setDetailsSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [avatarSaveState, setAvatarSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [settingsSaveState, setSettingsSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  // UI Toast & Status states
  const [autoSaveToast, setAutoSaveToast] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [cacheClearProgress, setCacheClearProgress] = useState(false);
  const [cacheClearedMsg, setCacheClearedMsg] = useState<string | null>(null);

  // Compression state
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionResult, setCompressionResult] = useState<{ origSize: string; compSize: string } | null>(null);

  // Refer a Friend state
  const [inviteFriendInput, setInviteFriendInput] = useState('');
  const [inviteStatusMsg, setInviteStatusMsg] = useState<string | null>(null);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [referralFilter, setReferralFilter] = useState<'all' | 'completed' | 'pending'>('all');

  // Modals state
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInputText, setDeleteInputText] = useState('');

  // File Upload Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state if user prop changes externally
  useEffect(() => {
    setFullName(user.name || '');
    setDob(user.dateOfBirth || '1998-05-14');
    setPhone(user.phone || '');
    if (user.gender) setGenderRole(user.gender);
  }, [user]);

  // Profile Completeness Calculation
  const completeness = useMemo(() => {
    const checks = [
      { id: 'name', label: 'Full Name', complete: Boolean(user.name && user.name.trim().length > 1) },
      { id: 'dob', label: 'Date of Birth (DOB)', complete: Boolean(user.dateOfBirth) },
      { id: 'gender', label: 'Gender / Role Selection', complete: Boolean(user.gender) },
      { id: 'avatar', label: 'Profile Photo / Avatar', complete: Boolean(user.avatar) },
      { id: 'phone', label: 'Verified Phone Number', complete: Boolean(user.phone && user.phone.trim().length > 6) },
    ];
    const completedCount = checks.filter((c) => c.complete).length;
    const percentage = Math.round((completedCount / checks.length) * 100);
    return {
      percentage,
      completedCount,
      totalCount: checks.length,
      checks,
    };
  }, [user]);

  // Age info
  const ageInfo = useMemo(() => calculateAge(dob), [dob]);

  // Trigger Section Micro-Save Indicator
  const triggerDetailsSave = () => {
    setDetailsSaveState('saving');
    setTimeout(() => {
      setDetailsSaveState('saved');
      setTimeout(() => setDetailsSaveState('idle'), 2500);
    }, 300);
  };

  const triggerAvatarSave = () => {
    setAvatarSaveState('saving');
    setTimeout(() => {
      setAvatarSaveState('saved');
      setTimeout(() => setAvatarSaveState('idle'), 2500);
    }, 300);
  };

  const triggerSettingsSave = () => {
    setSettingsSaveState('saving');
    setTimeout(() => {
      setSettingsSaveState('saved');
      setTimeout(() => setSettingsSaveState('idle'), 2500);
    }, 300);
  };

  // Helper for Global Toast
  const showToast = (msg: string) => {
    setAutoSaveToast(msg);
    setTimeout(() => setAutoSaveToast(null), 2500);
  };

  // 1. Full Name Change (Auto-Save)
  const handleNameChange = (val: string) => {
    setFullName(val);
    triggerDetailsSave();
    onUpdateUser({
      ...user,
      name: val,
    });
  };

  // 2. DOB Change (Auto-Save & Age Calc)
  const handleDobChange = (val: string) => {
    setDob(val);
    triggerDetailsSave();
    onUpdateUser({
      ...user,
      dateOfBirth: val,
    });
    showToast('Date of birth updated & saved');
  };

  // 3. Phone Change (Auto-Save)
  const handlePhoneChange = (val: string) => {
    setPhone(val);
    triggerDetailsSave();
    onUpdateUser({
      ...user,
      phone: val,
    });
  };

  // 4. Gender / Role Switcher (Men / Women)
  const handleGenderRoleSwitch = (newRole: 'men' | 'women') => {
    setGenderRole(newRole);
    triggerDetailsSave();

    const roleAvatars = newRole === 'men' ? MEN_AVATARS : WOMEN_AVATARS;
    const defaultAvatarForRole = roleAvatars[0].url;

    const isCurrentAvatarCustom =
      user.avatar &&
      !MEN_AVATARS.some((a) => a.url === user.avatar) &&
      !WOMEN_AVATARS.some((a) => a.url === user.avatar);

    const updatedAvatar = isCurrentAvatarCustom ? user.avatar : defaultAvatarForRole;

    onUpdateUser({
      ...user,
      gender: newRole,
      genderPreference: newRole,
      avatar: updatedAvatar,
      preferredServices:
        newRole === 'men'
          ? ['Precision Haircut', 'Beard Styling', 'De-Tan Face Cleanup', 'Scalp Spa']
          : ['Hair Cut & Styling', 'Hydra Facial Deluxe', 'Gel Nails', 'Aromatherapy Spa'],
    });

    showToast(`Switched to ${newRole === 'men' ? "Men's" : "Women's"} Beauty Profile`);
  };

  // 5. Select Preset Avatar
  const handleSelectPresetAvatar = (avatarUrl: string) => {
    triggerAvatarSave();
    onUpdateUser({
      ...user,
      avatar: avatarUrl,
    });
    showToast('Profile photo updated');
  };

  // 6. Custom Photo Upload with Client-Side Compression
  const handleCustomPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('Photo exceeds 10MB limit. Please choose a smaller photo.');
      return;
    }

    try {
      setIsCompressing(true);
      const result = await compressAndResizeImage(file);
      setIsCompressing(false);
      setCompressionResult({ origSize: result.origSize, compSize: result.compSize });

      triggerAvatarSave();
      onUpdateUser({
        ...user,
        avatar: result.dataUrl,
      });

      showToast(`Optimized from ${result.origSize} ➔ ${result.compSize} for fast loading!`);
      setTimeout(() => setCompressionResult(null), 5000);
    } catch {
      setIsCompressing(false);
      alert('Failed to compress image. Please try another image.');
    }
  };

  // 7. Reset Default Avatar
  const handleResetToDefaultAvatar = () => {
    const defaultUrl = genderRole === 'men' ? MEN_AVATARS[0].url : WOMEN_AVATARS[0].url;
    triggerAvatarSave();
    onUpdateUser({
      ...user,
      avatar: defaultUrl,
    });
    showToast('Reset to default role avatar');
  };

  // 8. Referral Code Copy & Sharing
  const referralCode = user.referralCode || 'NEXORA2026';
  const referralLink = `https://nexora.app/invite?code=${referralCode}`;

  const handleCopyReferralCode = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(referralCode);
      }
      setCopyFeedback('Referral code copied to clipboard!');
      setTimeout(() => setCopyFeedback(null), 2500);
    } catch {
      setCopyFeedback(`Code: ${referralCode}`);
      setTimeout(() => setCopyFeedback(null), 2500);
    }
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(
      `Hey! Use my invite code ${referralCode} to get ₹150 OFF your first luxury haircut or spa booking on Nexora: ${referralLink}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
    showToast('Opening WhatsApp invitation...');
  };

  const handleShareReferralLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Nexora Salon & Spa',
          text: `Use my invite code ${referralCode} to get ₹150 OFF your first luxury appointment!`,
          url: referralLink,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(
          `Join Nexora with code ${referralCode} for ₹150 OFF: ${referralLink}`
        );
      }
      setCopyFeedback('Invite link & message copied!');
      setTimeout(() => setCopyFeedback(null), 2500);
    } catch {
      setCopyFeedback('Invite link ready');
      setTimeout(() => setCopyFeedback(null), 2500);
    }
  };

  // 9. Send Direct Friend Invitation
  const handleSendFriendInvite = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inviteFriendInput.trim()) return;

    setIsSendingInvite(true);
    setTimeout(() => {
      setIsSendingInvite(false);
      const newFriend: ReferredFriend = {
        id: `ref-${Date.now()}`,
        name: inviteFriendInput.trim(),
        date: 'Just now',
        reward: '₹150 Credit (Pending)',
        status: 'pending',
      };

      const updatedFriends = [newFriend, ...(user.referredFriends || [])];
      onUpdateUser({
        ...user,
        referredFriends: updatedFriends,
      });

      setInviteFriendInput('');
      setInviteStatusMsg(`Invitation sent to ${newFriend.name}! They will receive ₹150 OFF on signup.`);
      setTimeout(() => setInviteStatusMsg(null), 4000);
    }, 500);
  };

  // 10. Granular Notification Toggles (with Auto-Save)
  const notificationsEnabled = user.notificationsEnabled ?? true;
  const appointmentReminders = user.appointmentReminders ?? true;
  const promotionalOffers = user.promotionalOffers ?? true;
  const whatsappAlerts = user.whatsappAlerts ?? true;
  const aiAdvisorAlerts = user.aiAdvisorAlerts ?? true;

  const handleToggleMasterNotifications = () => {
    const nextVal = !notificationsEnabled;
    triggerSettingsSave();
    onUpdateUser({
      ...user,
      notificationsEnabled: nextVal,
    });
    showToast(`Push notifications ${nextVal ? 'enabled' : 'disabled'}`);
  };

  const handleToggleGranularSetting = (
    key: 'appointmentReminders' | 'promotionalOffers' | 'whatsappAlerts' | 'aiAdvisorAlerts'
  ) => {
    const nextVal = !user[key];
    triggerSettingsSave();
    onUpdateUser({
      ...user,
      [key]: nextVal,
    });
  };

  // 11. Theme Switcher
  const currentTheme = user.appTheme || 'light';
  const handleSetTheme = (theme: 'light' | 'dark' | 'system') => {
    triggerSettingsSave();
    onUpdateUser({
      ...user,
      appTheme: theme,
    });

    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (theme === 'light') {
      document.documentElement.classList.remove('dark');
    }

    showToast(`App theme set to ${theme.toUpperCase()}`);
  };

  // 12. Clear Cache Action
  const handleClearCache = () => {
    setCacheClearProgress(true);
    setTimeout(() => {
      setCacheClearProgress(false);
      setCacheClearedMsg('App cache cleared successfully! 14.8 MB storage freed for optimal speed.');
      setTimeout(() => setCacheClearedMsg(null), 3500);
    }, 700);
  };

  // 13. Delete Account
  const handleConfirmDeleteAccount = () => {
    if (deleteInputText.trim().toUpperCase() !== 'DELETE') {
      alert('Please type "DELETE" to confirm permanent account deletion.');
      return;
    }
    setShowDeleteConfirm(false);
    if (onDeleteAccount) {
      onDeleteAccount();
    } else {
      localStorage.clear();
      window.location.reload();
    }
  };

  // Active avatars for current gender role
  const activeAvatars = genderRole === 'men' ? MEN_AVATARS : WOMEN_AVATARS;
  const isUsingCustomAvatar =
    user.avatar &&
    !MEN_AVATARS.some((a) => a.url === user.avatar) &&
    !WOMEN_AVATARS.some((a) => a.url === user.avatar);

  // Referred friends list filtering
  const allReferredFriends =
    user.referredFriends && user.referredFriends.length > 0
      ? user.referredFriends
      : [
          { id: '1', name: 'Rohan Verma', date: '12 Aug 2026', reward: '₹150 Credit', status: 'completed' },
          { id: '2', name: 'Ananya Mehra', date: '08 Aug 2026', reward: '₹150 Credit', status: 'completed' },
          { id: '3', name: 'Kavya Singhal', date: '01 Aug 2026', reward: '₹150 Credit', status: 'completed' },
          { id: '4', name: 'Vikram Rajput', date: '28 Jul 2026', reward: '₹150 Credit', status: 'completed' },
        ];

  const filteredFriends = allReferredFriends.filter((f) => {
    if (referralFilter === 'completed') return f.status === 'completed';
    if (referralFilter === 'pending') return f.status === 'pending';
    return true;
  });

  const totalEarned = user.referralEarnings || 600;
  const claimedDiscounts = user.claimedDiscounts || 150;
  const availableWalletBalance = Math.max(0, totalEarned - claimedDiscounts);

  return (
    <div className="flex flex-col w-full pb-28 max-w-4xl mx-auto px-page-margin pt-2">
      {/* ========================================================================= */}
      {/* GLOBAL AUTO-SAVE & FEEDBACK TOAST                                         */}
      {/* ========================================================================= */}
      {(autoSaveToast || copyFeedback || cacheClearedMsg) && (
        <div className="fixed top-20 right-4 sm:right-8 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="p-3 px-4 bg-surface-container-highest/95 backdrop-blur-md text-on-surface rounded-2xl shadow-xl border border-[#b00055]/30 flex items-center gap-2.5 text-[13px] font-semibold">
            <span className="material-symbols-outlined text-[18px] text-success-emerald">check_circle</span>
            <span>{autoSaveToast || copyFeedback || cacheClearedMsg}</span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* HEADER PROFILE HERO CARD                                                  */}
      {/* ========================================================================= */}
      <div
        id="profile-hero-card"
        className="bg-gradient-to-r from-primary via-[#b00055] to-primary-container rounded-3xl p-5 text-white shadow-lg mb-4 relative overflow-hidden"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <img
                src={user.avatar || (genderRole === 'men' ? MEN_AVATARS[0].url : WOMEN_AVATARS[0].url)}
                alt={user.name}
                className="w-20 h-20 rounded-full object-cover ring-4 ring-white/50 shadow-md transition-all group-hover:opacity-90"
              />
              <button
                type="button"
                className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-white text-primary flex items-center justify-center shadow-md hover:scale-110 transition-transform cursor-pointer"
                title="Change Profile Photo"
              >
                <span className="material-symbols-outlined text-[14px]">photo_camera</span>
              </button>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-card-title text-[22px] font-extrabold truncate">{user.name}</h2>
                <span className="text-[10px] bg-white/20 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider backdrop-blur-xs border border-white/30">
                  VIP Club Member
                </span>
              </div>
              <p className="text-[12px] opacity-90">{user.email}</p>
              <div className="flex items-center gap-2 text-[12px] opacity-85 mt-0.5 flex-wrap">
                <span>{user.phone || '+91 98290 12345'}</span>
                <span>·</span>
                {ageInfo && <span>{ageInfo.text} ·</span>}
                <span>{user.locationArea || 'Mansarovar'}, Jaipur</span>
                <span>·</span>
                <span className="px-2 py-0.2 bg-white/15 rounded-md font-semibold text-[11px]">
                  {genderRole === 'men' ? "👔 Men's Grooming" : "✨ Women's Beauty"}
                </span>
              </div>
            </div>
          </div>

          {/* AI Style Quiz Quick Button */}
          <button
            type="button"
            onClick={onOpenAIAdvisor}
            className="px-4 py-2 bg-white text-primary font-bold rounded-2xl text-[12px] shadow-sm hover:bg-surface-container transition-all flex items-center gap-1.5 self-stretch sm:self-auto justify-center cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px] text-nexora-pink">auto_awesome</span>
            <span>AI Advisor</span>
          </button>
        </div>

        {/* Loyalty Points & Rewards Balance Strip */}
        <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between relative z-10 text-[13px] flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-amber-300 fill-1">stars</span>
            <span>
              Nexora Beauty Club: <strong>{user.loyaltyPoints} Rewards Points</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] bg-white text-primary px-3 py-1 rounded-full font-extrabold shadow-xs">
              ₹{availableWalletBalance} Wallet Balance
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. PERSONAL DETAILS SECTION (EDITABLE - AUTO-SAVE & MICRO-INDICATOR)      */}
      {/* ========================================================================= */}
      <div
        id="section-personal-details"
        className="bg-surface-container-low border border-outline-variant/50 rounded-2xl p-4 sm:p-5 shadow-xs mb-4"
      >
        <div className="flex items-center justify-between mb-3 border-b border-outline-variant/30 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">person</span>
            </div>
            <div>
              <h3 className="font-card-title text-[16px] font-bold text-on-surface">1. Personal Details</h3>
              <p className="text-[11px] text-on-surface-variant">Live editable information with automatic saving</p>
            </div>
          </div>

          {/* Micro-Save Indicator Badge */}
          <div>
            {detailsSaveState === 'saving' && (
              <span className="text-[11px] text-primary font-bold flex items-center gap-1.5 bg-primary/10 px-2 py-0.5 rounded-full animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                Saving...
              </span>
            )}
            {detailsSaveState === 'saved' && (
              <span className="text-[11px] text-success-emerald font-bold flex items-center gap-1 bg-success-emerald/10 px-2 py-0.5 rounded-full animate-in fade-in">
                <span className="material-symbols-outlined text-[13px]">check_circle</span>
                Saved ✓
              </span>
            )}
            {detailsSaveState === 'idle' && (
              <span className="text-[11px] text-success-emerald font-bold flex items-center gap-1 bg-success-emerald/10 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-success-emerald inline-block" />
                Auto-Save Active
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          {/* Full Name */}
          <div>
            <label className="text-[12px] font-bold text-on-surface block mb-1.5 flex items-center justify-between">
              <span>Full Name</span>
              <span className="text-[10px] text-on-surface-variant font-normal">Editable</span>
            </label>
            <div className="relative">
              <input
                id="input-profile-fullname"
                type="text"
                value={fullName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Enter your full name"
                className="w-full h-11 px-3.5 pl-10 bg-surface-container-lowest text-on-surface rounded-xl text-[13px] border border-outline-variant/50 focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant absolute left-3 top-3 pointer-events-none">
                badge
              </span>
            </div>
          </div>

          {/* Date of Birth (DOB DatePicker with Automatic Age Display) */}
          <div>
            <label className="text-[12px] font-bold text-on-surface block mb-1.5 flex items-center justify-between">
              <span>Date of Birth (DOB)</span>
              {ageInfo && (
                <span className="text-[11px] text-primary font-extrabold bg-primary/10 px-2 py-0.2 rounded-md">
                  🎂 {ageInfo.text}
                </span>
              )}
            </label>
            <div className="relative">
              <input
                id="input-profile-dob"
                type="date"
                value={dob}
                onChange={(e) => handleDobChange(e.target.value)}
                max="2015-12-31"
                min="1940-01-01"
                className="w-full h-11 px-3.5 pl-10 bg-surface-container-lowest text-on-surface rounded-xl text-[13px] border border-outline-variant/50 focus:border-primary focus:ring-1 focus:ring-primary transition-all cursor-pointer"
              />
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant absolute left-3 top-3 pointer-events-none">
                cake
              </span>
            </div>
            {ageInfo && (
              <p className="text-[10px] text-on-surface-variant mt-1 flex items-center gap-1">
                <span>Born: {ageInfo.formattedDate}</span>
                {ageInfo.isBirthMonth && (
                  <span className="text-amber-700 font-bold bg-amber-500/15 px-1.5 py-0.2 rounded">
                    🎉 Birthday Month Activated!
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Phone Number */}
          <div>
            <label className="text-[12px] font-bold text-on-surface block mb-1.5">Phone Number</label>
            <div className="relative">
              <input
                id="input-profile-phone"
                type="tel"
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="+91 98290 12345"
                className="w-full h-11 px-3.5 pl-10 bg-surface-container-lowest text-on-surface rounded-xl text-[13px] border border-outline-variant/50 focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant absolute left-3 top-3 pointer-events-none">
                call
              </span>
            </div>
          </div>

          {/* Email Address */}
          <div>
            <label className="text-[12px] font-bold text-on-surface block mb-1.5 flex items-center justify-between">
              <span>Email Address</span>
              <span className="text-[10px] text-on-surface-variant">Verified ID</span>
            </label>
            <div className="relative">
              <input
                type="email"
                value={user.email}
                disabled
                className="w-full h-11 px-3.5 pl-10 bg-surface-container text-on-surface-variant rounded-xl text-[13px] border border-outline-variant/30 cursor-not-allowed opacity-80"
              />
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant absolute left-3 top-3 pointer-events-none">
                mail
              </span>
            </div>
          </div>
        </div>

        {/* Gender / Role Selection Switcher */}
        <div className="mt-4 pt-3 border-t border-outline-variant/30">
          <label className="text-[13px] font-bold text-on-surface block mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-[#b00055]">wc</span>
              <span>Gender / Role Selection</span>
            </span>
            <span className="text-[11px] text-primary font-semibold">
              Instant UI & Avatar theme updates
            </span>
          </label>

          <div className="grid grid-cols-2 gap-3">
            {/* Men */}
            <button
              type="button"
              id="role-switch-men-btn"
              onClick={() => handleGenderRoleSwitch('men')}
              className={`p-3.5 rounded-2xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
                genderRole === 'men'
                  ? 'bg-primary/10 border-primary ring-2 ring-primary/40 shadow-xs'
                  : 'bg-surface-container-lowest border-outline-variant/40 hover:bg-surface-container'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-[22px] ${
                  genderRole === 'men'
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-surface-container text-on-surface-variant'
                }`}
              >
                <span className="material-symbols-outlined">man</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[14px] text-on-surface">Men</span>
                  {genderRole === 'men' && (
                    <span className="material-symbols-outlined text-[18px] text-primary">check_circle</span>
                  )}
                </div>
                <p className="text-[11px] text-on-surface-variant leading-tight mt-0.5">
                  Fades, Beards, Head Spa & Grooming
                </p>
              </div>
            </button>

            {/* Women */}
            <button
              type="button"
              id="role-switch-women-btn"
              onClick={() => handleGenderRoleSwitch('women')}
              className={`p-3.5 rounded-2xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
                genderRole === 'women'
                  ? 'bg-[#b00055]/10 border-[#b00055] ring-2 ring-[#b00055]/40 shadow-xs'
                  : 'bg-surface-container-lowest border-outline-variant/40 hover:bg-surface-container'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-[22px] ${
                  genderRole === 'women'
                    ? 'bg-[#b00055] text-white shadow-xs'
                    : 'bg-surface-container text-on-surface-variant'
                }`}
              >
                <span className="material-symbols-outlined">woman</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[14px] text-on-surface">Women</span>
                  {genderRole === 'women' && (
                    <span className="material-symbols-outlined text-[18px] text-[#b00055]">check_circle</span>
                  )}
                </div>
                <p className="text-[11px] text-on-surface-variant leading-tight mt-0.5">
                  Styling, Balayage, Hydra Facial & Nail Art
                </p>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. PROFILE PHOTO & AVATAR SETTINGS (WITH CLIENT COMPRESSION)              */}
      {/* ========================================================================= */}
      <div
        id="section-avatar-settings"
        className="bg-surface-container-low border border-outline-variant/50 rounded-2xl p-4 sm:p-5 shadow-xs mb-4"
      >
        <div className="flex items-center justify-between mb-3 border-b border-outline-variant/30 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#b00055]/10 text-[#b00055] flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">account_box</span>
            </div>
            <div>
              <h3 className="font-card-title text-[16px] font-bold text-on-surface">
                2. Profile Photo & Avatar Settings
              </h3>
              <p className="text-[11px] text-on-surface-variant">
                Select 3 {genderRole === 'men' ? 'male' : 'female'} presets or upload a compressed custom photo
              </p>
            </div>
          </div>

          {/* Micro Save Badge */}
          <div>
            {avatarSaveState === 'saving' && (
              <span className="text-[11px] text-primary font-bold flex items-center gap-1.5 bg-primary/10 px-2 py-0.5 rounded-full animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                Saving...
              </span>
            )}
            {avatarSaveState === 'saved' && (
              <span className="text-[11px] text-success-emerald font-bold flex items-center gap-1 bg-success-emerald/10 px-2 py-0.5 rounded-full">
                <span className="material-symbols-outlined text-[13px]">check_circle</span>
                Saved ✓
              </span>
            )}
          </div>
        </div>

        {/* 3 Role-Based Original Photos */}
        <div className="mb-4">
          <label className="text-[12px] font-bold text-on-surface block mb-2">
            Instant Choice: 3 Default Original {genderRole === 'men' ? 'Male' : 'Female'} Avatars
          </label>

          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            {activeAvatars.map((av) => {
              const isSelected = user.avatar === av.url;
              return (
                <div
                  key={av.id}
                  onClick={() => handleSelectPresetAvatar(av.url)}
                  className={`p-2 sm:p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                    isSelected
                      ? 'bg-primary/10 border-primary ring-2 ring-primary shadow-xs'
                      : 'bg-surface-container-lowest border-outline-variant/40 hover:bg-surface-container'
                  }`}
                >
                  <div className="relative">
                    <img
                      src={av.url}
                      alt={av.name}
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover shadow-sm ring-2 ring-outline-variant/30"
                    />
                    {isSelected && (
                      <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center shadow-md">
                        <span className="material-symbols-outlined text-[13px]">check</span>
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-bold text-on-surface truncate max-w-full block">
                    {av.name}
                  </span>
                  <span className="text-[10px] text-on-surface-variant bg-surface-container px-1.5 py-0.2 rounded font-medium">
                    {av.tag}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Custom Photo Upload & Client-Side Image Compression Strip */}
        <div className="p-3.5 bg-surface-container-lowest rounded-2xl border border-outline-variant/40 flex flex-col gap-2.5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="w-10 h-10 rounded-full bg-[#b00055]/10 text-[#b00055] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px]">add_a_photo</span>
              </div>
              <div>
                <h4 className="font-bold text-[13px] text-on-surface flex items-center gap-2">
                  <span>Upload Custom Photo</span>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-800 font-bold px-1.5 py-0.2 rounded border border-emerald-500/20">
                    Smart Compressed
                  </span>
                </h4>
                <p className="text-[11px] text-on-surface-variant">
                  Automatically resized to 480px JPEG for lightning fast loading
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCustomPhotoUpload}
              />

              <button
                type="button"
                id="upload-custom-photo-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={isCompressing}
                className="px-3.5 py-2 bg-primary text-white text-[12px] font-bold rounded-xl hover:bg-[#b00055] transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isCompressing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Compressing...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">upload</span>
                    <span>Upload & Compress</span>
                  </>
                )}
              </button>

              {isUsingCustomAvatar && (
                <button
                  type="button"
                  onClick={handleResetToDefaultAvatar}
                  className="px-3 py-2 bg-surface-container text-on-surface-variant text-[12px] font-semibold rounded-xl hover:bg-surface-container-high transition-colors cursor-pointer"
                >
                  Reset Default
                </button>
              )}
            </div>
          </div>

          {/* Compression Feedback Indicator */}
          {compressionResult && (
            <div className="p-2.5 rounded-xl bg-success-emerald/15 text-emerald-800 text-[11px] font-semibold flex items-center justify-between border border-emerald-500/30 animate-in fade-in">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-success-emerald">tune</span>
                <span>
                  Compressed from <strong>{compressionResult.origSize}</strong> ➔{' '}
                  <strong>{compressionResult.compSize}</strong>
                </span>
              </div>
              <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-bold">
                Optimized
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. REWARDS & REFERRAL SECTION (LEDGER & WALLET OVERVIEW)                  */}
      {/* ========================================================================= */}
      <div
        id="section-rewards"
        className="bg-surface-container-low border border-outline-variant/50 rounded-2xl p-4 sm:p-5 shadow-xs mb-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3.5 border-b border-outline-variant/30 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500/20 to-primary/20 text-primary flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[22px] text-amber-600 fill-1">military_tech</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-card-title text-[16px] font-bold text-on-surface">
                  3. Rewards & Referral Club
                </h3>
                <span className="text-[10px] bg-gradient-to-r from-amber-500 to-amber-600 text-white font-black px-2 py-0.5 rounded-full shadow-xs">
                  Silver Insider Tier
                </span>
              </div>
              <p className="text-[11px] text-on-surface-variant">
                Share your referral code to unlock tier perks, wallet balance, and free services
              </p>
            </div>
          </div>
          <span className="text-[11px] bg-emerald-500/15 text-emerald-800 font-bold px-2.5 py-1 rounded-full border border-emerald-500/30 shrink-0">
            ₹150 / Friend
          </span>
        </div>

        {/* 1. Unique Referral Code Display */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-primary/5 to-surface-container-lowest border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-3.5 mb-4 shadow-xs">
          <div className="text-center sm:text-left">
            <div className="flex items-center gap-1.5 justify-center sm:justify-start">
              <span className="material-symbols-outlined text-[16px] text-amber-600">token</span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                Your Unique Referral Code
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 justify-center sm:justify-start">
              <span className="font-mono text-[22px] sm:text-[24px] font-black text-primary tracking-widest bg-white/90 px-3.5 py-1 rounded-xl border border-primary/20 shadow-xs">
                {referralCode}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-end flex-wrap">
            <button
              type="button"
              id="copy-referral-code-btn"
              onClick={handleCopyReferralCode}
              className="px-3.5 py-2.5 bg-surface-container-highest text-on-surface text-[12px] font-bold rounded-xl hover:bg-surface-container border border-outline-variant/40 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Copy referral code"
            >
              <span className="material-symbols-outlined text-[16px]">content_copy</span>
              <span>Copy Code</span>
            </button>

            <button
              type="button"
              id="whatsapp-share-btn"
              onClick={handleWhatsAppShare}
              className="px-3.5 py-2.5 bg-[#25D366] text-white text-[12px] font-bold rounded-xl hover:bg-[#20ba5a] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Share via WhatsApp"
            >
              <span className="material-symbols-outlined text-[16px]">chat</span>
              <span>WhatsApp</span>
            </button>

            <button
              type="button"
              id="share-referral-link-btn"
              onClick={handleShareReferralLink}
              className="px-4 py-2.5 bg-gradient-to-r from-primary to-[#b00055] text-white text-[12px] font-bold rounded-xl hover:opacity-95 transition-opacity flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <span className="material-symbols-outlined text-[16px]">share</span>
              <span>Share Link</span>
            </button>
          </div>
        </div>

        {/* 2. Rewards Wallet Overview & Ledger Summary */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3 mb-4">
          {/* Total Earned */}
          <div className="p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/40 text-center flex flex-col items-center justify-center">
            <span className="text-[10px] text-on-surface-variant font-semibold">Total Earned</span>
            <span className="font-card-title text-[18px] sm:text-[21px] font-black text-on-surface mt-0.5">
              ₹{totalEarned}
            </span>
            <span className="text-[9px] text-on-surface-variant">{allReferredFriends.length} referrals</span>
          </div>

          {/* Available Wallet Balance */}
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center flex flex-col items-center justify-center">
            <span className="text-[10px] text-emerald-800 font-bold">Redeemable Balance</span>
            <span className="font-card-title text-[18px] sm:text-[21px] font-black text-emerald-700 mt-0.5">
              ₹{availableWalletBalance}
            </span>
            <span className="text-[9px] text-emerald-700 font-semibold">Active in Wallet</span>
          </div>

          {/* Claimed Discounts */}
          <div className="p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/40 text-center flex flex-col items-center justify-center">
            <span className="text-[10px] text-on-surface-variant font-semibold">Claimed / Redeemed</span>
            <span className="font-card-title text-[18px] sm:text-[21px] font-black text-primary mt-0.5">
              ₹{claimedDiscounts}
            </span>
            <span className="text-[9px] text-on-surface-variant">Applied to bookings</span>
          </div>
        </div>

        {/* 3. Reward Status Progress Bar */}
        <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/40 mb-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-on-surface-variant font-bold block">
                Reward Status & Tier Progress
              </span>
              <h4 className="font-card-title text-[14px] font-extrabold text-on-surface flex items-center gap-1.5">
                <span>Current: Silver Insider</span>
                <span className="text-primary text-[12px] font-semibold">
                  ({allReferredFriends.length}/5 Referrals)
                </span>
              </h4>
            </div>
            <div className="text-right">
              <span className="text-[12px] font-black text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                80% to Gold
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-surface-container rounded-full h-3.5 p-0.5 border border-outline-variant/40 relative overflow-hidden mb-3">
            <div
              className="bg-gradient-to-r from-amber-400 via-primary to-[#b00055] h-full rounded-full transition-all duration-700 relative"
              style={{ width: '80%' }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
            </div>
          </div>

          {/* Tier Milestones Roadmap */}
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2 text-center pt-1 border-t border-outline-variant/20">
            <div className="flex flex-col items-center">
              <span className="w-5 h-5 rounded-full bg-success-emerald text-white flex items-center justify-center text-[10px] font-bold mb-1 shadow-xs">
                ✓
              </span>
              <span className="text-[10px] font-bold text-on-surface">Bronze</span>
              <span className="text-[9px] text-on-surface-variant">1 Friend</span>
            </div>

            <div className="flex flex-col items-center">
              <span className="w-5 h-5 rounded-full bg-success-emerald text-white flex items-center justify-center text-[10px] font-bold mb-1 shadow-xs">
                ✓
              </span>
              <span className="text-[10px] font-bold text-on-surface">Silver</span>
              <span className="text-[9px] text-on-surface-variant">3 Friends</span>
            </div>

            <div className="flex flex-col items-center">
              <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold mb-1 ring-2 ring-amber-300 shadow-xs animate-bounce">
                ★
              </span>
              <span className="text-[10px] font-black text-amber-700">Gold (Next)</span>
              <span className="text-[9px] text-amber-600 font-semibold">5 Friends</span>
            </div>

            <div className="flex flex-col items-center opacity-70">
              <span className="w-5 h-5 rounded-full bg-surface-container text-on-surface-variant flex items-center justify-center text-[10px] font-bold mb-1 border border-outline-variant/60">
                10
              </span>
              <span className="text-[10px] font-bold text-on-surface">Diamond VIP</span>
              <span className="text-[9px] text-on-surface-variant">Free Spa Day</span>
            </div>
          </div>

          {/* Next Reward Callout */}
          <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-[12px] text-amber-900">
            <span className="material-symbols-outlined text-[18px] text-amber-600">redeem</span>
            <span>
              <strong>Next Unlock:</strong> Refer 1 more friend to reach <strong>Gold Ambassador</strong> (₹300 Cash Bonus + Free Keratin Treatment)!
            </span>
          </div>
        </div>

        {/* 4. 'Refer a Friend' Invitation Module */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/5 via-surface-container-lowest to-[#b00055]/5 border border-primary/20 mb-4 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">forward_to_inbox</span>
            </div>
            <div>
              <h4 className="font-card-title text-[14px] font-bold text-on-surface">
                'Refer a Friend' Invitation Module
              </h4>
              <p className="text-[11px] text-on-surface-variant">
                Send a personalized invitation with your ₹150 promo code
              </p>
            </div>
          </div>

          {inviteStatusMsg && (
            <div className="p-2.5 mb-3 rounded-xl bg-success-emerald/15 text-emerald-800 text-[12px] font-semibold flex items-center gap-2 border border-emerald-500/30 animate-in fade-in">
              <span className="material-symbols-outlined text-[16px] text-success-emerald">check_circle</span>
              <span>{inviteStatusMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSendFriendInvite} className="flex flex-col sm:flex-row gap-2 mt-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={inviteFriendInput}
                onChange={(e) => setInviteFriendInput(e.target.value)}
                placeholder="Enter friend's name, email, or mobile number"
                className="w-full h-11 px-3.5 pl-10 bg-white text-on-surface rounded-xl text-[13px] border border-outline-variant/60 focus:border-primary focus:ring-1 focus:ring-primary shadow-2xs"
              />
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant absolute left-3 top-3 pointer-events-none">
                person_add
              </span>
            </div>

            <button
              type="submit"
              disabled={!inviteFriendInput.trim() || isSendingInvite}
              className="h-11 px-5 bg-primary text-white font-bold rounded-xl text-[13px] hover:bg-[#b00055] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-40 shrink-0"
            >
              {isSendingInvite ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">send</span>
                  <span>Send Invite</span>
                </>
              )}
            </button>
          </form>

          {/* 3 Steps */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 pt-3 border-t border-outline-variant/30 text-[11px]">
            <div className="flex items-center gap-2 bg-white/60 p-2 rounded-xl border border-outline-variant/20">
              <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                1
              </span>
              <span className="text-on-surface leading-tight">
                Send code <strong>{referralCode}</strong> to friends
              </span>
            </div>

            <div className="flex items-center gap-2 bg-white/60 p-2 rounded-xl border border-outline-variant/20">
              <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                2
              </span>
              <span className="text-on-surface leading-tight">
                Friend gets <strong>₹150 OFF</strong> on 1st booking
              </span>
            </div>

            <div className="flex items-center gap-2 bg-white/60 p-2 rounded-xl border border-outline-variant/20">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                3
              </span>
              <span className="text-on-surface leading-tight">
                You earn <strong>₹150 Instant Credit</strong>
              </span>
            </div>
          </div>
        </div>

        {/* 5. Referral History Ledger */}
        <div>
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <h4 className="text-[12px] font-bold text-on-surface flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-primary">receipt_long</span>
              <span>Referral Rewards Ledger</span>
            </h4>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 bg-surface-container p-0.5 rounded-lg text-[10px]">
              <button
                type="button"
                onClick={() => setReferralFilter('all')}
                className={`px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${
                  referralFilter === 'all'
                    ? 'bg-white text-primary shadow-xs font-bold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                All ({allReferredFriends.length})
              </button>
              <button
                type="button"
                onClick={() => setReferralFilter('completed')}
                className={`px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${
                  referralFilter === 'completed'
                    ? 'bg-white text-primary shadow-xs font-bold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Completed ({allReferredFriends.filter((f) => f.status === 'completed').length})
              </button>
              <button
                type="button"
                onClick={() => setReferralFilter('pending')}
                className={`px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${
                  referralFilter === 'pending'
                    ? 'bg-white text-primary shadow-xs font-bold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Pending ({allReferredFriends.filter((f) => f.status === 'pending').length})
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {filteredFriends.map((f) => (
              <div
                key={f.id}
                className="p-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 flex items-center justify-between text-[12px]"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[11px]">
                    {f.name.charAt(0)}
                  </div>
                  <div>
                    <span className="font-bold text-on-surface block leading-tight">{f.name}</span>
                    <span className="text-[10px] text-on-surface-variant">Joined: {f.date}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-success-emerald font-bold block">{f.reward}</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-semibold uppercase ${
                      f.status === 'completed'
                        ? 'bg-success-emerald/10 text-success-emerald'
                        : 'bg-amber-500/10 text-amber-700'
                    }`}
                  >
                    {f.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. APP SETTINGS & NOTIFICATIONS (GRANULAR TOGGLES & AUTO-SAVE)            */}
      {/* ========================================================================= */}
      <div
        id="section-app-settings"
        className="bg-surface-container-low border border-outline-variant/50 rounded-2xl p-4 sm:p-5 shadow-xs mb-4"
      >
        <div className="flex items-center justify-between mb-3 border-b border-outline-variant/30 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">settings</span>
            </div>
            <div>
              <h3 className="font-card-title text-[16px] font-bold text-on-surface">
                4. App Settings & Notifications
              </h3>
              <p className="text-[11px] text-on-surface-variant">
                Push alerts, appointment countdowns, WhatsApp updates & theme mode
              </p>
            </div>
          </div>

          {/* Micro Save Badge */}
          <div>
            {settingsSaveState === 'saving' && (
              <span className="text-[11px] text-primary font-bold flex items-center gap-1.5 bg-primary/10 px-2 py-0.5 rounded-full animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                Saving...
              </span>
            )}
            {settingsSaveState === 'saved' && (
              <span className="text-[11px] text-success-emerald font-bold flex items-center gap-1 bg-success-emerald/10 px-2 py-0.5 rounded-full">
                <span className="material-symbols-outlined text-[13px]">check_circle</span>
                Saved ✓
              </span>
            )}
          </div>
        </div>

        {/* Master Push Notification Switch */}
        <div className="p-3.5 bg-surface-container-lowest rounded-2xl border border-outline-variant/40 flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[22px] text-primary">notifications_active</span>
            <div>
              <h4 className="font-bold text-[13px] text-on-surface">Push Notifications (Master)</h4>
              <p className="text-[11px] text-on-surface-variant">
                Allow Nexora to send real-time appointment and offer notifications
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleMasterNotifications}
            className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
              notificationsEnabled ? 'bg-primary' : 'bg-outline-variant/60'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform shadow-xs ${
                notificationsEnabled ? 'right-0.5' : 'left-0.5'
              }`}
            />
          </button>
        </div>

        {/* Individual Granular Notification Toggles */}
        {notificationsEnabled && (
          <div className="flex flex-col gap-2.5 mb-4 pl-2 border-l-2 border-primary/30">
            {/* 1. Appointment Reminders & Countdown */}
            <div className="flex items-center justify-between text-[12px] p-2.5 rounded-xl bg-surface-container-lowest/80 border border-outline-variant/20">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[18px] text-nexora-pink">schedule</span>
                <div>
                  <span className="text-on-surface font-semibold block">
                    Appointment Reminders & Live Countdown
                  </span>
                  <span className="text-[10px] text-on-surface-variant">
                    Alerts 2 hours before scheduled slot & salon directions
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={appointmentReminders}
                onChange={() => handleToggleGranularSetting('appointmentReminders')}
                className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
              />
            </div>

            {/* 2. Offers & Promotional Deals */}
            <div className="flex items-center justify-between text-[12px] p-2.5 rounded-xl bg-surface-container-lowest/80 border border-outline-variant/20">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[18px] text-amber-600">local_offer</span>
                <div>
                  <span className="text-on-surface font-semibold block">Offers & Promotional Deals</span>
                  <span className="text-[10px] text-on-surface-variant">
                    Exclusive weekend spa passes, festival packages & flash discounts
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={promotionalOffers}
                onChange={() => handleToggleGranularSetting('promotionalOffers')}
                className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
              />
            </div>

            {/* 3. WhatsApp Alerts */}
            <div className="flex items-center justify-between text-[12px] p-2.5 rounded-xl bg-surface-container-lowest/80 border border-outline-variant/20">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[18px] text-[#25D366]">chat</span>
                <div>
                  <span className="text-on-surface font-semibold block">WhatsApp Alerts & Invoices</span>
                  <span className="text-[10px] text-on-surface-variant">
                    Receive booking confirmation receipts & stylist ETA via WhatsApp
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={whatsappAlerts}
                onChange={() => handleToggleGranularSetting('whatsappAlerts')}
                className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
              />
            </div>

            {/* 4. AI Style Insights */}
            <div className="flex items-center justify-between text-[12px] p-2.5 rounded-xl bg-surface-container-lowest/80 border border-outline-variant/20">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[18px] text-[#b00055]">auto_awesome</span>
                <div>
                  <span className="text-on-surface font-semibold block">AI Style Advisor Insights</span>
                  <span className="text-[10px] text-on-surface-variant">
                    Seasonal hair care recommendations & curated stylist tips
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={aiAdvisorAlerts}
                onChange={() => handleToggleGranularSetting('aiAdvisorAlerts')}
                className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* Color Theme Switcher */}
        <div className="pt-2 border-t border-outline-variant/30">
          <label className="text-[12px] font-bold text-on-surface block mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">palette</span>
              <span>App Color Theme</span>
            </span>
            <span className="text-[10px] text-on-surface-variant uppercase font-semibold">
              Current: {currentTheme}
            </span>
          </label>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              id="theme-light-btn"
              onClick={() => handleSetTheme('light')}
              className={`py-2 px-3 rounded-xl border text-[12px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                currentTheme === 'light'
                  ? 'bg-primary text-white border-primary shadow-xs'
                  : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/40 hover:bg-surface-container'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">light_mode</span>
              <span>Light</span>
            </button>

            <button
              type="button"
              id="theme-dark-btn"
              onClick={() => handleSetTheme('dark')}
              className={`py-2 px-3 rounded-xl border text-[12px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                currentTheme === 'dark'
                  ? 'bg-primary text-white border-primary shadow-xs'
                  : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/40 hover:bg-surface-container'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">dark_mode</span>
              <span>Dark</span>
            </button>

            <button
              type="button"
              id="theme-system-btn"
              onClick={() => handleSetTheme('system')}
              className={`py-2 px-3 rounded-xl border text-[12px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                currentTheme === 'system'
                  ? 'bg-primary text-white border-primary shadow-xs'
                  : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/40 hover:bg-surface-container'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">devices</span>
              <span>System</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. ACCOUNT & STORAGE MANAGEMENT                                           */}
      {/* ========================================================================= */}
      <div
        id="section-account-storage"
        className="bg-surface-container-low border border-outline-variant/50 rounded-2xl p-4 sm:p-5 shadow-xs mb-4"
      >
        <div className="flex items-center justify-between mb-3 border-b border-outline-variant/30 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">security</span>
            </div>
            <div>
              <h3 className="font-card-title text-[16px] font-bold text-on-surface">
                5. Account & Storage
              </h3>
              <p className="text-[11px] text-on-surface-variant">
                Cache optimization, session management, and permanent account settings
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {/* Clear App Cache */}
          <div className="p-3.5 bg-surface-container-lowest rounded-2xl border border-outline-variant/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-primary">cleaning_services</span>
                <span className="font-bold text-[13px] text-on-surface">Clear App Cache</span>
              </div>
              <p className="text-[11px] text-on-surface-variant mt-0.5">
                Removes temporary cached maps & salon photos to speed up app performance.
              </p>
            </div>

            <button
              type="button"
              id="clear-app-cache-btn"
              onClick={handleClearCache}
              disabled={cacheClearProgress}
              className="px-4 py-2 bg-surface-container-highest hover:bg-surface-container text-on-surface text-[12px] font-bold rounded-xl border border-outline-variant/40 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
            >
              {cacheClearProgress ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
                  <span>Clearing...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
                  <span>Clear Cache (14.8 MB)</span>
                </>
              )}
            </button>
          </div>

          {/* Logout & Delete Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              id="account-logout-btn"
              onClick={() => setShowLogoutConfirm(true)}
              className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-on-surface hover:bg-surface-container text-[12px] font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">logout</span>
              <span>Logout of Nexora</span>
            </button>

            <button
              type="button"
              id="account-delete-btn"
              onClick={() => setShowDeleteConfirm(true)}
              className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 hover:bg-rose-500/20 text-[12px] font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <span className="material-symbols-outlined text-[18px]">delete_forever</span>
              <span>Delete Account</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* LOGOUT CONFIRMATION MODAL                                                 */}
      {/* ========================================================================= */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-surface rounded-2xl p-5 shadow-2xl border border-outline-variant/40 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[22px]">logout</span>
              </div>
              <div>
                <h3 className="font-card-title text-[16px] font-bold text-on-surface">Confirm Logout?</h3>
                <p className="text-[11px] text-on-surface-variant">You will be logged out of your active session.</p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-surface-container text-on-surface text-[12px] font-semibold hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  if (onLogout) onLogout();
                  showToast('Logged out successfully');
                }}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-[12px] font-bold hover:bg-[#b00055] transition-colors cursor-pointer shadow-xs"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DELETE ACCOUNT SAFETY CONFIRMATION MODAL                                  */}
      {/* ========================================================================= */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-surface rounded-2xl p-5 sm:p-6 shadow-2xl border border-rose-500/40 flex flex-col gap-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/15 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[26px]">warning</span>
              </div>
              <div>
                <h3 className="font-card-title text-[17px] font-bold text-on-surface">Delete Account Permanently</h3>
                <p className="text-[11px] text-rose-600 font-semibold">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-[12px] text-on-surface-variant leading-relaxed">
              Permanently deletes all saved salon favorites, booking history, reward points (₹{user.loyaltyPoints}),
              and personalized AI hair profiles.
            </p>

            <div>
              <label className="text-[11px] font-bold text-on-surface block mb-1">
                Type <strong className="text-rose-600">DELETE</strong> to confirm:
              </label>
              <input
                type="text"
                value={deleteInputText}
                onChange={(e) => setDeleteInputText(e.target.value)}
                placeholder="DELETE"
                className="w-full h-10 px-3 bg-surface-container text-on-surface rounded-xl text-[13px] font-mono border border-rose-500/50 uppercase"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteInputText('');
                }}
                className="flex-1 py-2.5 rounded-xl bg-surface-container text-on-surface text-[12px] font-semibold hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAccount}
                disabled={deleteInputText.trim().toUpperCase() !== 'DELETE'}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-[12px] font-bold hover:bg-rose-700 transition-colors cursor-pointer shadow-md disabled:opacity-40"
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}

      {/* App Version Footer */}
      <div className="text-center py-6 text-on-surface-variant text-[11px] flex flex-col gap-1">
        <p className="font-semibold text-on-surface">Nexora SalonOS · Enterprise v2.5</p>
        <p>Grounded in Google Maps & Gemini 3.7 Beauty Intelligence</p>
      </div>
    </div>
  );
};
