import React, { useState } from 'react';
import { SalonProfile, PromotionalBannerConfig, PromoBannerTheme } from '../types';

interface PromotionalBannerConfigSectionProps {
  profile: SalonProfile;
  setProfile: React.Dispatch<React.SetStateAction<SalonProfile>>;
  primaryAccentColor?: string;
  onNavigateToPreview?: () => void;
  isAuthenticated?: boolean;
  onRequireAuth?: (mode?: 'login' | 'signup') => void;
}

const BANNER_THEMES: Array<{
  id: PromoBannerTheme;
  name: string;
  gradientClass: string;
  bgHex: string;
  textHex: string;
  badgeBg: string;
  badgeText: string;
  btnBg: string;
  btnText: string;
  borderClass: string;
}> = [
  {
    id: 'royal_gold',
    name: 'Royal Gold & Crimson',
    gradientClass: 'bg-gradient-to-r from-rose-950 via-amber-950 to-red-950 text-amber-100',
    bgHex: '#3b1016',
    textHex: '#fef3c7',
    badgeBg: 'bg-amber-400 text-amber-950 border border-amber-300',
    badgeText: 'text-amber-950',
    btnBg: 'bg-gradient-to-r from-amber-400 to-yellow-400 text-amber-950 hover:brightness-105',
    btnText: '#451a03',
    borderClass: 'border-amber-500/30',
  },
  {
    id: 'gradient_purple',
    name: 'Twilight Purple & Indigo',
    gradientClass: 'bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-950 text-purple-100',
    bgHex: '#2e1065',
    textHex: '#f3e8ff',
    badgeBg: 'bg-purple-400 text-purple-950 border border-purple-300',
    badgeText: 'text-purple-950',
    btnBg: 'bg-gradient-to-r from-purple-400 to-pink-400 text-purple-950 hover:brightness-105',
    btnText: '#3b0764',
    borderClass: 'border-purple-500/30',
  },
  {
    id: 'rose_velvet',
    name: 'Rose Velvet & Blush',
    gradientClass: 'bg-gradient-to-r from-pink-950 via-rose-900 to-stone-900 text-pink-100',
    bgHex: '#500724',
    textHex: '#ffe4e6',
    badgeBg: 'bg-pink-300 text-pink-950 border border-pink-200',
    badgeText: 'text-pink-950',
    btnBg: 'bg-white text-pink-950 hover:bg-pink-50',
    btnText: '#500724',
    borderClass: 'border-pink-500/30',
  },
  {
    id: 'emerald_botanical',
    name: 'Emerald Sage & Botanical',
    gradientClass: 'bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-950 text-emerald-100',
    bgHex: '#022c22',
    textHex: '#d1fae5',
    badgeBg: 'bg-emerald-400 text-emerald-950 border border-emerald-300',
    badgeText: 'text-emerald-950',
    btnBg: 'bg-emerald-300 text-emerald-950 hover:bg-emerald-200',
    btnText: '#064e3b',
    borderClass: 'border-emerald-500/30',
  },
  {
    id: 'obsidian_glam',
    name: 'Obsidian Dark Glam',
    gradientClass: 'bg-gradient-to-r from-neutral-950 via-stone-900 to-black text-white',
    bgHex: '#0a0a0a',
    textHex: '#ffffff',
    badgeBg: 'bg-white text-neutral-950 border border-neutral-200',
    badgeText: 'text-neutral-950',
    btnBg: 'bg-amber-400 text-neutral-950 hover:bg-amber-300',
    btnText: '#0a0a0a',
    borderClass: 'border-neutral-800',
  },
  {
    id: 'sunset_coral',
    name: 'Sunset Coral & Amber',
    gradientClass: 'bg-gradient-to-r from-orange-950 via-rose-950 to-amber-950 text-orange-100',
    bgHex: '#431407',
    textHex: '#ffedd5',
    badgeBg: 'bg-orange-400 text-orange-950 border border-orange-300',
    badgeText: 'text-orange-950',
    btnBg: 'bg-white text-orange-950 hover:bg-orange-50',
    btnText: '#431407',
    borderClass: 'border-orange-500/30',
  },
];

const CAMPAIGN_TEMPLATES = [
  {
    title: 'First-Time Client Welcome',
    badge: 'NEW CLIENTS',
    code: 'FIRSTGLAM20',
    text: '🎉 Welcome Special: Enjoy Flat 20% OFF on your first visit with any Master Stylist!',
    btnText: 'Claim 20% OFF',
    theme: 'royal_gold' as PromoBannerTheme,
  },
  {
    title: 'Festive & Bridal Season',
    badge: 'FESTIVE OFFER',
    code: 'ROYALBRIDE',
    text: '✨ Grand Festive Glam: Get ₹1,000 OFF on all Pre-Bridal & Luxury Makeover Packages!',
    btnText: 'Book Bridal Package',
    theme: 'royal_gold' as PromoBannerTheme,
  },
  {
    title: 'Weekend Flash Blowout',
    badge: 'FLASH DEAL',
    code: 'FLASH400',
    text: '⚡ Weekend Special: Flat ₹400 OFF on Hair Spa, Balayage Toners & Blowouts this weekend!',
    btnText: 'Reserve Spot',
    theme: 'sunset_coral' as PromoBannerTheme,
  },
  {
    title: 'Organic Scalp Detox Ritual',
    badge: 'FREE COMPLIMENTARY',
    code: 'ARGANRITUAL',
    text: '🌿 Rejuvenate: Complimentary Moroccan Argan Scalp Ritual with any Haircut & Color service.',
    btnText: 'Claim Free Ritual',
    theme: 'emerald_botanical' as PromoBannerTheme,
  },
  {
    title: 'Sculpted Nails & Lash Glam',
    badge: 'LIMITED TIME',
    code: 'NAILLUXE15',
    text: '💅 Beauty Trio Deal: Get 15% OFF Gel-X Nail Extensions + Complimentary Chrome Finish!',
    btnText: 'Book Nail Art',
    theme: 'rose_velvet' as PromoBannerTheme,
  },
];

const QUICK_EMOJIS = ['✨', '🎉', '🔥', '✂️', '🌸', '💄', '👑', '🌿', '⚡', '💅', '💎', '💫'];

export const PromotionalBannerConfigSection: React.FC<PromotionalBannerConfigSectionProps> = ({
  profile,
  setProfile,
  primaryAccentColor = '#C20E5A',
  onNavigateToPreview,
  isAuthenticated = true,
  onRequireAuth,
}) => {
  const currentBanner: PromotionalBannerConfig = profile.promotionalBanner || {
    enabled: true,
    text: '✨ Festive Season Special: Get Flat 20% OFF on all Precision Styling & Balayage packages!',
    discountCode: 'FESTIVE20',
    badgeText: 'LIMITED OFFER',
    buttonText: 'Claim 20% OFF',
    buttonAction: 'book',
    themePreset: 'royal_gold',
  };

  const [previewCopied, setPreviewCopied] = useState<boolean>(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');

  const updateBanner = (partial: Partial<PromotionalBannerConfig>) => {
    const updated: PromotionalBannerConfig = {
      ...currentBanner,
      ...partial,
    };

    setProfile((prev) => ({
      ...prev,
      promotionalBanner: updated,
    }));

    setSaveToast('Promotional banner updated and synchronized to website header!');
    setTimeout(() => setSaveToast(null), 3000);
  };

  const selectedTheme = BANNER_THEMES.find((t) => t.id === currentBanner.themePreset) || BANNER_THEMES[0];

  const applyTemplate = (tmpl: typeof CAMPAIGN_TEMPLATES[0]) => {
    updateBanner({
      enabled: true,
      text: tmpl.text,
      discountCode: tmpl.code,
      badgeText: tmpl.badge,
      buttonText: tmpl.btnText,
      buttonAction: 'book',
      themePreset: tmpl.theme,
    });
  };

  const handleInsertEmoji = (emoji: string) => {
    updateBanner({
      text: `${currentBanner.text} ${emoji}`.trim(),
    });
  };

  const handleTestCopyCode = () => {
    if (currentBanner.discountCode) {
      navigator.clipboard?.writeText(currentBanner.discountCode);
      setPreviewCopied(true);
      setTimeout(() => setPreviewCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col gap-6" id="promo-banner-settings-section">
      {/* SECTION HEADER */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-900 shadow-2xs">
              <span className="material-symbols-outlined text-xl">campaign</span>
            </div>
            <div>
              <h2 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                <span>Promotional Header Banner</span>
                <span className={`text-[10px] font-mono-caps font-bold px-2 py-0.5 rounded-full border ${
                  currentBanner.enabled
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-gray-100 text-gray-600 border-gray-300'
                }`}>
                  {currentBanner.enabled ? 'ACTIVE ON WEBSITE' : 'DISABLED'}
                </span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Display eye-catching promotional discounts, seasonal sales, and coupon codes at the top of your salon website.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Main Toggle Switch */}
          <label className="flex items-center gap-2.5 cursor-pointer bg-gray-50 hover:bg-gray-100 border border-gray-200 px-3.5 py-2 rounded-xl transition-colors">
            <span className="text-xs font-bold text-gray-700">Show on Website</span>
            <div className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={currentBanner.enabled}
                onChange={(e) => updateBanner({ enabled: e.target.checked })}
                className="sr-only peer"
                id="toggle-promotional-banner-enabled"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </div>
          </label>

          {onNavigateToPreview && (
            <button
              type="button"
              onClick={onNavigateToPreview}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs flex items-center gap-1.5 transition-transform hover:scale-[1.02] cursor-pointer"
              style={{ backgroundColor: primaryAccentColor }}
              id="view-live-promo-header-btn"
            >
              <span className="material-symbols-outlined text-sm">visibility</span>
              <span>View On Live Website</span>
            </button>
          )}
        </div>
      </div>

      {/* TOAST FEEDBACK */}
      {saveToast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs animate-fade-in">
          <span className="material-symbols-outlined text-emerald-600 text-base">check_circle</span>
          <span>{saveToast}</span>
        </div>
      )}

      {/* ============================================================ */}
      {/* 1. LIVE INTERACTIVE HEADER PREVIEW SIMULATOR */}
      {/* ============================================================ */}
      <div className="bg-slate-900 rounded-2xl p-5 md:p-6 text-white border border-slate-800 shadow-md">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-mono font-bold tracking-wider text-slate-300 uppercase">
              Live Website Header Simulator
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setPreviewDevice('desktop')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                  previewDevice === 'desktop' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="material-symbols-outlined text-xs">monitor</span>
                <span>Desktop</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewDevice('mobile')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                  previewDevice === 'mobile' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="material-symbols-outlined text-xs">smartphone</span>
                <span>Mobile</span>
              </button>
            </div>
          </div>
        </div>

        {/* Live Simulator Viewport */}
        <div className="flex justify-center bg-slate-950 p-4 md:p-6 rounded-xl border border-slate-800 overflow-hidden">
          <div className={`transition-all duration-300 w-full ${previewDevice === 'mobile' ? 'max-w-[390px]' : 'max-w-4xl'}`}>
            
            {/* The Promotional Header Bar */}
            {currentBanner.enabled ? (
              <div 
                className={`w-full px-4 py-2.5 rounded-t-xl transition-all shadow-xs flex flex-wrap items-center justify-between gap-2.5 border-b ${selectedTheme.gradientClass} ${selectedTheme.borderClass}`}
                id="simulator-promotional-banner"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {currentBanner.badgeText && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono-caps font-extrabold tracking-wider shrink-0 shadow-2xs ${selectedTheme.badgeBg}`}>
                      {currentBanner.badgeText}
                    </span>
                  )}
                  <span className="text-xs font-semibold truncate leading-tight">
                    {currentBanner.text || 'Add your announcement text here...'}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {currentBanner.discountCode && (
                    <button
                      type="button"
                      onClick={handleTestCopyCode}
                      className="px-2.5 py-1 rounded-lg bg-black/30 hover:bg-black/40 border border-white/20 text-white font-mono text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Click to copy promo code"
                    >
                      <span>Code:</span>
                      <span className="text-amber-300 font-extrabold tracking-wide">{currentBanner.discountCode}</span>
                      <span className="material-symbols-outlined text-[12px] text-white/80">
                        {previewCopied ? 'check' : 'content_copy'}
                      </span>
                    </button>
                  )}

                  {currentBanner.buttonText && (
                    <button
                      type="button"
                      onClick={onNavigateToPreview}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer ${selectedTheme.btnBg}`}
                    >
                      <span>{currentBanner.buttonText}</span>
                      <span className="material-symbols-outlined text-xs">arrow_forward</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-slate-800/80 border border-dashed border-slate-700 px-4 py-3 rounded-t-xl text-center text-xs text-slate-400">
                <span className="material-symbols-outlined text-sm inline-block align-middle mr-1 text-slate-500">visibility_off</span>
                Promotional Banner is currently disabled. Toggle on to show on your live website.
              </div>
            )}

            {/* Simulated Salon Navigation Header Below the Banner */}
            <div className="bg-white text-slate-900 px-4 py-3 rounded-b-xl border-x border-b border-gray-200 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2.5">
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-xs"
                  style={{ backgroundColor: primaryAccentColor }}
                >
                  <span className="material-symbols-outlined text-base">spa</span>
                </div>
                <div>
                  <div className="font-bold text-sm leading-tight text-slate-900">{profile.businessName || 'Your Salon'}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{profile.city || 'Bengaluru'}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="hidden sm:inline text-[11px] font-mono font-bold text-slate-700">{profile.phone || '+91 98450 00000'}</span>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-xs"
                  style={{ backgroundColor: primaryAccentColor }}
                >
                  Book Appointment
                </button>
              </div>
            </div>

          </div>
        </div>

        <div className="text-[11px] text-slate-400 mt-2 text-center flex items-center justify-center gap-1.5">
          <span className="material-symbols-outlined text-xs text-amber-400">info</span>
          <span>Changes made below update in real time on your live customer website header.</span>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. CONFIGURATION FORM CONTROLS & CAMPAIGN PRESETS */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Main Inputs & Settings */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Content & Copy */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
              <span className="material-symbols-outlined text-amber-600">edit_note</span>
              <span>Banner Content & Announcement</span>
            </h3>

            {/* Announcement Text */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold text-gray-700">Announcement Headline & Text *</label>
                <span className="text-[11px] font-mono text-gray-400">
                  {currentBanner.text.length} characters
                </span>
              </div>
              <textarea
                value={currentBanner.text}
                onChange={(e) => updateBanner({ text: e.target.value })}
                rows={3}
                placeholder="e.g. 🎉 Summer Festive Sale: Flat 20% OFF all Hair Treatments & Balayage this month!"
                className="w-full text-xs font-medium px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-hidden bg-white text-gray-900 shadow-2xs"
                id="banner-announcement-text-input"
              />

              {/* Quick Emojis */}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className="text-[11px] text-gray-500 font-medium">Quick Emojis:</span>
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleInsertEmoji(emoji)}
                    className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-amber-100 border border-gray-200 hover:border-amber-300 text-sm flex items-center justify-center transition-colors cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Discount Code & Badge Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Discount / Promo Code (Optional)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 font-mono text-xs">
                    🏷️
                  </span>
                  <input
                    type="text"
                    value={currentBanner.discountCode || ''}
                    onChange={(e) => updateBanner({ discountCode: e.target.value.toUpperCase().replace(/\s+/g, '') })}
                    placeholder="e.g. FESTIVE20 or GLAM500"
                    className="w-full text-xs font-mono font-bold pl-9 pr-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-hidden bg-white text-gray-900 uppercase tracking-wider"
                    id="banner-discount-code-input"
                  />
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  Shown in a highlighted badge that customers can tap to copy.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Badge Label / Tag
                </label>
                <input
                  type="text"
                  value={currentBanner.badgeText || ''}
                  onChange={(e) => updateBanner({ badgeText: e.target.value })}
                  placeholder="e.g. LIMITED OFFER, 25% OFF, WEEKEND DEAL"
                  className="w-full text-xs font-medium px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-hidden bg-white text-gray-900"
                  id="banner-badge-text-input"
                />
                <p className="text-[10px] text-gray-500 mt-1">
                  Small prominent pill tag displayed before the announcement.
                </p>
              </div>
            </div>

            {/* Action Button Label & Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Action Button Label
                </label>
                <input
                  type="text"
                  value={currentBanner.buttonText || ''}
                  onChange={(e) => updateBanner({ buttonText: e.target.value })}
                  placeholder="e.g. Claim 20% OFF, Book Now, Reserve"
                  className="w-full text-xs font-medium px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-hidden bg-white text-gray-900"
                  id="banner-button-text-input"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Button Action
                </label>
                <select
                  value={currentBanner.buttonAction || 'book'}
                  onChange={(e) => updateBanner({ buttonAction: e.target.value as 'book' | 'copy' })}
                  className="w-full text-xs font-medium px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-hidden bg-white text-gray-900"
                >
                  <option value="book">Open Booking Modal (Direct Reservation)</option>
                  <option value="copy">Copy Discount Code to Clipboard</option>
                </select>
              </div>
            </div>
          </div>

          {/* Color & Visual Theme Selection */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
              <span className="material-symbols-outlined text-amber-600">palette</span>
              <span>Banner Visual Aesthetics & Color Schemes</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {BANNER_THEMES.map((thm) => {
                const isSelected = currentBanner.themePreset === thm.id;
                return (
                  <button
                    key={thm.id}
                    type="button"
                    onClick={() => updateBanner({ themePreset: thm.id })}
                    className={`p-3.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50/50 ring-2 ring-amber-500/20 shadow-xs'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className={`w-9 h-9 rounded-lg shadow-2xs border ${thm.borderClass} ${thm.gradientClass} flex items-center justify-center shrink-0`}
                      >
                        <span className="material-symbols-outlined text-sm">sparkles</span>
                      </div>
                      <div>
                        <div className="font-bold text-xs text-gray-900">{thm.name}</div>
                        <div className="text-[10px] text-gray-500">Curated high-contrast palette</div>
                      </div>
                    </div>

                    {isSelected && (
                      <span className="material-symbols-outlined text-amber-600 text-lg">check_circle</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right 1 Col: 1-Click Popular Campaign Presets */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-amber-50/70 via-rose-50/40 to-purple-50/50 border border-amber-200/80 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-amber-700 text-xl">magic_button</span>
              <h3 className="font-bold text-sm text-amber-950">1-Click Campaign Presets</h3>
            </div>
            <p className="text-xs text-amber-900/80 mb-4">
              Apply tested, high-converting promotional banners with matching discount codes and copy instantly:
            </p>

            <div className="space-y-2.5">
              {CAMPAIGN_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.title}
                  type="button"
                  onClick={() => applyTemplate(tmpl)}
                  className="w-full text-left p-3 rounded-xl bg-white/90 hover:bg-white border border-amber-200/80 hover:border-amber-400 shadow-2xs transition-all hover:scale-[1.01] cursor-pointer group"
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-bold text-xs text-gray-900 group-hover:text-amber-800 transition-colors">
                      {tmpl.title}
                    </span>
                    <span className="text-[9px] font-mono font-extrabold px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                      {tmpl.code}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-600 line-clamp-2 leading-relaxed">
                    {tmpl.text}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Stats & Impact Info */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
            <h4 className="font-bold text-xs text-gray-900 flex items-center gap-1.5 mb-2.5">
              <span className="material-symbols-outlined text-emerald-600 text-base">insights</span>
              <span>Conversion Impact</span>
            </h4>
            <ul className="text-xs text-gray-600 space-y-2">
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-xs text-emerald-600 shrink-0 mt-0.5">check</span>
                <span>Promotional header banners increase appointment bookings by up to <strong>34%</strong> on mobile devices.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-xs text-emerald-600 shrink-0 mt-0.5">check</span>
                <span>1-click promo code copying reduces checkout friction for clients on WhatsApp and Instagram.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-xs text-emerald-600 shrink-0 mt-0.5">check</span>
                <span>Supports inline editing directly when viewing the live website canvas in edit mode.</span>
              </li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
};
