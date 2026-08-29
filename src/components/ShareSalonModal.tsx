import React, { useState, useEffect } from 'react';
import { Salon } from '../types';

interface ShareSalonModalProps {
  salon: Salon | null;
  isOpen: boolean;
  onClose: () => void;
  onToastMessage?: (msg: string) => void;
}

export const ShareSalonModal: React.FC<ShareSalonModalProps> = ({
  salon,
  isOpen,
  onClose,
  onToastMessage,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showQrCode, setShowQrCode] = useState<boolean>(false);
  const [customNote, setCustomNote] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setCopied(false);
      setToastMessage(null);
      setShowQrCode(false);
      setCustomNote('');
    }
  }, [isOpen, salon]);

  if (!isOpen || !salon) return null;

  // Construct absolute shareable URL
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://nexora.salon';
  const shareUrl = `${baseUrl}?salon=${encodeURIComponent(salon.id)}`;

  // Default sharing message
  const shareTitle = `${salon.name} - ${salon.tagline || 'Book on Nexora SalonOS'}`;
  const defaultText = `Check out ${salon.name} in ${salon.location.area}, Jaipur! Rated ${salon.rating}★ on Nexora SalonOS. Book hair, skin & beauty services with instant confirmation.`;
  const fullShareText = customNote.trim() ? `${customNote.trim()}\n\n${defaultText}` : defaultText;

  // Trigger Toast Notification
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    if (onToastMessage) {
      onToastMessage(msg);
    }
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Copy Link to Clipboard
  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        // Fallback for older browsers / iframe restrictions
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      setCopied(true);
      triggerToast('Salon link copied to clipboard!');
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      setCopied(true);
      triggerToast('Salon link copied to clipboard!');
      setTimeout(() => setCopied(false), 3000);
    }
  };

  // Copy Full Message with Link
  const handleCopyMessage = async () => {
    const messageWithLink = `${fullShareText}\n🔗 ${shareUrl}`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(messageWithLink);
      }
      triggerToast('Salon details & link copied!');
    } catch (err) {
      triggerToast('Salon details & link copied!');
    }
  };

  // Native Web Share API
  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: fullShareText,
          url: shareUrl,
        });
        triggerToast('Shared successfully!');
      } catch (err) {
        // User cancelled or share failed, fallback to copy
        if ((err as Error).name !== 'AbortError') {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  // Social Share Handlers
  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(`${fullShareText}\n\n👉 Book your appointment here: ${shareUrl}`);
    const whatsappUrl = `https://api.whatsapp.com/send?text=${text}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  const handleTwitterShare = () => {
    const text = encodeURIComponent(`Booking my next salon session at ${salon.name} (${salon.location.area}) via Nexora SalonOS! Rated ${salon.rating}★ ✨`);
    const twitterUrl = `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(shareUrl)}`;
    window.open(twitterUrl, '_blank', 'noopener,noreferrer');
  };

  const handleTelegramShare = () => {
    const text = encodeURIComponent(fullShareText);
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${text}`;
    window.open(telegramUrl, '_blank', 'noopener,noreferrer');
  };

  const handleFacebookShare = () => {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    window.open(facebookUrl, '_blank', 'noopener,noreferrer');
  };

  const handleEmailShare = () => {
    const subject = encodeURIComponent(`Salon Recommendation: ${salon.name} on Nexora`);
    const body = encodeURIComponent(`Hi!\n\nI wanted to share ${salon.name} located at ${salon.location.address}, ${salon.location.area}, Jaipur.\n\nRating: ${salon.rating} ★ (${salon.reviewCount || 100}+ reviews)\nPrice Range: ${salon.priceRange}\n\nExplore services and book directly:\n${shareUrl}\n\nBest,\nShared via Nexora SalonOS`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleSmsShare = () => {
    const body = encodeURIComponent(`Check out ${salon.name} on Nexora: ${shareUrl}`);
    window.location.href = `sms:?body=${body}`;
  };

  const isWebShareSupported = typeof navigator !== 'undefined' && Boolean(navigator.share);

  return (
    <div
      id="share-salon-modal-backdrop"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="share-salon-modal-card"
        className="w-full max-w-lg bg-surface rounded-t-3xl sm:rounded-3xl shadow-2xl border border-outline-variant/40 max-h-[92vh] overflow-y-auto relative flex flex-col animate-in slide-in-from-bottom-4 duration-200"
      >
        {/* Top Header Strip */}
        <div className="p-4 sm:p-5 border-b border-outline-variant/30 flex items-center justify-between sticky top-0 bg-surface/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-2xs">
              <span className="material-symbols-outlined text-[22px]">share</span>
            </div>
            <div>
              <h3 className="font-card-title text-[17px] font-extrabold text-on-surface leading-tight">
                Share Salon
              </h3>
              <p className="text-[11px] text-on-surface-variant">
                Invite friends or share with someone to plan a visit together
              </p>
            </div>
          </div>

          <button
            id="close-share-salon-modal-btn"
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close share dialog"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4">
          {/* Toast Notification Alert inside Modal */}
          {toastMessage && (
            <div className="p-3 rounded-2xl bg-success-emerald/15 text-emerald-800 text-[12px] font-bold flex items-center justify-between border border-emerald-500/30 shadow-xs animate-in fade-in slide-in-from-top-1">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-success-emerald">check_circle</span>
                <span>{toastMessage}</span>
              </div>
              <span className="text-[10px] uppercase font-bold text-emerald-700 bg-white/50 px-2 py-0.5 rounded-full">
                Copied
              </span>
            </div>
          )}

          {/* 1. Salon Preview Summary Card */}
          <div className="p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/40 shadow-xs flex items-center gap-3.5">
            <img
              src={salon.image}
              alt={salon.name}
              className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl object-cover shrink-0 border border-outline-variant/20 shadow-2xs"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h4 className="font-card-title text-[15px] font-extrabold text-on-surface truncate">
                  {salon.name}
                </h4>
                <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-success-emerald/10 text-success-emerald border border-success-emerald/20 shrink-0">
                  {salon.isOpen ? 'Open Now' : 'Verified'}
                </span>
              </div>

              {/* Address Preview */}
              <p className="text-[11px] text-on-surface-variant flex items-center gap-1 line-clamp-1 mb-1">
                <span className="material-symbols-outlined text-[14px] text-primary shrink-0">location_on</span>
                <span>{salon.location.address || salon.location.area}, Jaipur</span>
              </p>

              {/* Rating, Price & Distance */}
              <div className="flex items-center gap-2 text-[11px] flex-wrap">
                <span className="flex items-center gap-0.5 font-bold text-warning-amber bg-amber-500/10 px-1.5 py-0.2 rounded">
                  <span className="material-symbols-outlined text-[13px] fill-1">star</span>
                  <span>{salon.rating}</span>
                  <span className="text-[9px] text-on-surface-variant font-normal">
                    ({salon.reviewCount || 100}+)
                  </span>
                </span>

                <span className="text-on-surface-variant font-semibold">·</span>
                <span className="text-[10px] font-mono font-bold bg-primary/10 text-primary px-1.5 py-0.2 rounded">
                  {salon.priceRange}
                </span>

                {salon.distance && (
                  <>
                    <span className="text-on-surface-variant font-semibold">·</span>
                    <span className="text-[10px] text-on-surface-variant font-medium">
                      {salon.distance}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 2. Direct Shareable URL & One-Tap Copy Link Button */}
          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
              Direct Shareable Link
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  id="share-salon-url-input"
                  type="text"
                  readOnly
                  value={shareUrl}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="w-full pl-9 pr-3 py-2.5 bg-surface-container text-on-surface font-mono text-[12px] rounded-2xl border border-outline-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all select-all truncate"
                />
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  link
                </span>
              </div>

              <button
                id="copy-salon-link-btn"
                type="button"
                onClick={handleCopyLink}
                className={`px-4 py-2.5 rounded-2xl text-[12px] font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  copied
                    ? 'bg-success-emerald text-white ring-2 ring-emerald-500/30'
                    : 'bg-primary text-white hover:bg-nexora-pink active:scale-95'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {copied ? 'check' : 'content_copy'}
                </span>
                <span>{copied ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>
          </div>

          {/* 3. Quick Social Sharing Shortcuts */}
          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">
              Quick Social Share
            </label>

            <div className="grid grid-cols-4 sm:grid-cols-4 gap-2 text-center">
              {/* WhatsApp */}
              <button
                id="share-whatsapp-btn"
                type="button"
                onClick={handleWhatsAppShare}
                className="p-3 rounded-2xl bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/30 flex flex-col items-center justify-center gap-1.5 transition-all group cursor-pointer shadow-2xs hover:scale-102"
                title="Share on WhatsApp"
              >
                <div className="w-9 h-9 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-xs group-hover:scale-110 transition-transform">
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.04 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 15 3.8 13.47 3.8 11.91C3.81 7.37 7.5 3.67 12.05 3.67M9.53 7.32C9.33 7.32 9 7.4 8.78 7.64C8.56 7.88 7.95 8.45 7.95 9.61C7.95 10.77 8.8 11.89 8.92 12.05C9.04 12.21 10.55 14.53 12.87 15.53C13.43 15.77 13.85 15.91 14.19 16.02C14.75 16.2 15.26 16.17 15.66 16.11C16.11 16.04 17.04 15.54 17.23 15C17.42 14.46 17.42 14 17.36 13.9C17.3 13.8 17.16 13.74 16.95 13.64C16.74 13.54 15.72 13.03 15.53 12.96C15.34 12.89 15.2 12.85 15.06 13.06C14.92 13.27 14.53 13.74 14.41 13.88C14.29 14.02 14.17 14.04 13.96 13.94C13.75 13.84 13.07 13.61 12.27 12.9C11.64 12.34 11.22 11.65 11.1 11.44C10.98 11.23 11.09 11.12 11.2 11.01C11.3 10.91 11.42 10.75 11.53 10.63C11.64 10.51 11.68 10.43 11.75 10.29C11.82 10.15 11.78 10.03 11.73 9.93C11.68 9.83 11.27 8.82 11.1 8.41C10.93 8.01 10.76 8.06 10.63 8.05C10.51 8.05 10.37 8.04 10.23 8.04C10.09 8.04 9.87 8.09 9.68 8.3C9.49 8.51 8.95 9.02 8.95 10.08C8.95 11.14 9.73 12.16 9.84 12.31L9.53 7.32Z" />
                  </svg>
                </div>
                <span className="text-[11px] font-bold text-on-surface">WhatsApp</span>
              </button>

              {/* Twitter / X */}
              <button
                id="share-twitter-btn"
                type="button"
                onClick={handleTwitterShare}
                className="p-3 rounded-2xl bg-black/5 hover:bg-black/10 border border-outline-variant/40 flex flex-col items-center justify-center gap-1.5 transition-all group cursor-pointer shadow-2xs hover:scale-102"
                title="Share on X / Twitter"
              >
                <div className="w-9 h-9 rounded-full bg-black text-white flex items-center justify-center shadow-xs group-hover:scale-110 transition-transform">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </div>
                <span className="text-[11px] font-bold text-on-surface">X / Twitter</span>
              </button>

              {/* Telegram */}
              <button
                id="share-telegram-btn"
                type="button"
                onClick={handleTelegramShare}
                className="p-3 rounded-2xl bg-[#0088cc]/10 hover:bg-[#0088cc]/20 border border-[#0088cc]/30 flex flex-col items-center justify-center gap-1.5 transition-all group cursor-pointer shadow-2xs hover:scale-102"
                title="Share on Telegram"
              >
                <div className="w-9 h-9 rounded-full bg-[#0088cc] text-white flex items-center justify-center shadow-xs group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-[20px]">send</span>
                </div>
                <span className="text-[11px] font-bold text-on-surface">Telegram</span>
              </button>

              {/* Email / SMS / More */}
              <button
                id="share-email-btn"
                type="button"
                onClick={handleEmailShare}
                className="p-3 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 flex flex-col items-center justify-center gap-1.5 transition-all group cursor-pointer shadow-2xs hover:scale-102"
                title="Share via Email"
              >
                <div className="w-9 h-9 rounded-full bg-amber-600 text-white flex items-center justify-center shadow-xs group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-[19px]">mail</span>
                </div>
                <span className="text-[11px] font-bold text-on-surface">Email</span>
              </button>
            </div>

            {/* Native Web Share API Button & Additional Shortcuts */}
            <div className="mt-2.5 flex items-center gap-2 flex-wrap">
              {isWebShareSupported && (
                <button
                  id="native-web-share-btn"
                  type="button"
                  onClick={handleNativeShare}
                  className="flex-1 py-2.5 px-3 bg-gradient-to-r from-primary to-nexora-pink text-white rounded-2xl text-[12px] font-bold shadow-xs hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">share</span>
                  <span>Share via Device Apps</span>
                </button>
              )}

              <button
                id="toggle-qr-code-btn"
                type="button"
                onClick={() => setShowQrCode(!showQrCode)}
                className="py-2.5 px-3.5 bg-surface-container text-on-surface hover:bg-surface-container-high rounded-2xl text-[12px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer border border-outline-variant/30"
                title="Scan QR Code in Person"
              >
                <span className="material-symbols-outlined text-[18px] text-primary">qr_code_2</span>
                <span>{showQrCode ? 'Hide QR' : 'Show QR Code'}</span>
              </button>

              <button
                type="button"
                onClick={handleSmsShare}
                className="py-2.5 px-3 bg-surface-container text-on-surface hover:bg-surface-container-high rounded-2xl text-[12px] font-semibold transition-all flex items-center gap-1 cursor-pointer border border-outline-variant/30"
                title="Send via SMS text"
              >
                <span className="material-symbols-outlined text-[16px]">sms</span>
                <span>SMS</span>
              </button>
            </div>
          </div>

          {/* QR Code In-Person Scan Drawer */}
          {showQrCode && (
            <div className="p-4 rounded-2xl bg-surface-container-lowest border border-primary/20 flex flex-col items-center text-center gap-2 animate-in fade-in zoom-in-95 duration-150">
              <span className="text-[11px] font-bold text-on-surface uppercase tracking-wider">
                Scan to Open on Mobile
              </span>
              <div className="p-3 bg-white rounded-2xl shadow-xs border border-outline-variant/30">
                {/* Clean SVG QR Code Representation */}
                <svg className="w-36 h-36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Position detection patterns */}
                  <rect x="5" y="5" width="26" height="26" rx="4" fill="#1a1113" />
                  <rect x="9" y="9" width="18" height="18" rx="2" fill="#ffffff" />
                  <rect x="13" y="13" width="10" height="10" rx="1" fill="#a30046" />

                  <rect x="69" y="5" width="26" height="26" rx="4" fill="#1a1113" />
                  <rect x="73" y="9" width="18" height="18" rx="2" fill="#ffffff" />
                  <rect x="77" y="13" width="10" height="10" rx="1" fill="#a30046" />

                  <rect x="5" y="69" width="26" height="26" rx="4" fill="#1a1113" />
                  <rect x="9" y="73" width="18" height="18" rx="2" fill="#ffffff" />
                  <rect x="13" y="77" width="10" height="10" rx="1" fill="#a30046" />

                  {/* QR Matrix Grid Dots */}
                  <rect x="36" y="8" width="5" height="5" fill="#1a1113" />
                  <rect x="44" y="8" width="5" height="5" fill="#1a1113" />
                  <rect x="52" y="8" width="5" height="5" fill="#1a1113" />
                  <rect x="60" y="8" width="5" height="5" fill="#1a1113" />

                  <rect x="36" y="16" width="5" height="5" fill="#1a1113" />
                  <rect x="48" y="16" width="5" height="5" fill="#1a1113" />
                  <rect x="56" y="16" width="5" height="5" fill="#1a1113" />

                  <rect x="8" y="36" width="5" height="5" fill="#1a1113" />
                  <rect x="16" y="36" width="5" height="5" fill="#1a1113" />
                  <rect x="24" y="36" width="5" height="5" fill="#1a1113" />
                  <rect x="36" y="36" width="5" height="5" fill="#a30046" />
                  <rect x="44" y="36" width="5" height="5" fill="#1a1113" />
                  <rect x="52" y="36" width="5" height="5" fill="#1a1113" />
                  <rect x="68" y="36" width="5" height="5" fill="#1a1113" />
                  <rect x="76" y="36" width="5" height="5" fill="#1a1113" />
                  <rect x="84" y="36" width="5" height="5" fill="#1a1113" />

                  <rect x="8" y="44" width="5" height="5" fill="#1a1113" />
                  <rect x="20" y="44" width="5" height="5" fill="#1a1113" />
                  <rect x="36" y="44" width="5" height="5" fill="#1a1113" />
                  <rect x="48" y="44" width="5" height="5" fill="#a30046" />
                  <rect x="60" y="44" width="5" height="5" fill="#1a1113" />
                  <rect x="72" y="44" width="5" height="5" fill="#1a1113" />
                  <rect x="84" y="44" width="5" height="5" fill="#1a1113" />

                  <rect x="8" y="52" width="5" height="5" fill="#1a1113" />
                  <rect x="16" y="52" width="5" height="5" fill="#1a1113" />
                  <rect x="24" y="52" width="5" height="5" fill="#1a1113" />
                  <rect x="36" y="52" width="5" height="5" fill="#1a1113" />
                  <rect x="44" y="52" width="5" height="5" fill="#1a1113" />
                  <rect x="56" y="52" width="5" height="5" fill="#a30046" />
                  <rect x="68" y="52" width="5" height="5" fill="#1a1113" />
                  <rect x="80" y="52" width="5" height="5" fill="#1a1113" />

                  <rect x="36" y="68" width="5" height="5" fill="#1a1113" />
                  <rect x="48" y="68" width="5" height="5" fill="#1a1113" />
                  <rect x="56" y="68" width="5" height="5" fill="#1a1113" />
                  <rect x="68" y="68" width="5" height="5" fill="#1a1113" />
                  <rect x="80" y="68" width="5" height="5" fill="#1a1113" />

                  <rect x="36" y="76" width="5" height="5" fill="#1a1113" />
                  <rect x="44" y="76" width="5" height="5" fill="#a30046" />
                  <rect x="60" y="76" width="5" height="5" fill="#1a1113" />
                  <rect x="72" y="76" width="5" height="5" fill="#1a1113" />
                  <rect x="84" y="76" width="5" height="5" fill="#1a1113" />

                  <rect x="36" y="84" width="5" height="5" fill="#1a1113" />
                  <rect x="52" y="84" width="5" height="5" fill="#1a1113" />
                  <rect x="68" y="84" width="5" height="5" fill="#1a1113" />
                  <rect x="80" y="84" width="5" height="5" fill="#1a1113" />
                </svg>
              </div>
              <p className="text-[10px] text-on-surface-variant max-w-xs">
                Point any phone camera to scan and immediately open {salon.name}'s menu and booking slots.
              </p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-outline-variant/30 bg-surface-container-low flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleCopyMessage}
            className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[14px]">content_copy</span>
            <span>Copy Full Description & Details</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-surface-container-high text-on-surface text-[12px] font-bold rounded-xl hover:bg-surface-container-highest transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
