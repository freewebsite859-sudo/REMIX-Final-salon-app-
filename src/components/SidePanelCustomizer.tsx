import React, { useState, useEffect } from 'react';
import { 
  Palette, 
  MapPin, 
  Sliders, 
  Sparkles, 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  X, 
  Eye, 
  EyeOff, 
  Building, 
  Phone, 
  MessageSquare, 
  Instagram, 
  Moon, 
  Sun, 
  RotateCcw,
  Wand2,
  Share2,
  CheckCircle2,
  Upload,
  Image as ImageIcon,
  ImagePlus,
  Trash2,
  Link as LinkIcon,
  AlertCircle,
  Scissors,
  Facebook,
  Youtube
} from 'lucide-react';
import { SalonProfile, BusinessTypeId, SalonService, SocialVideo } from '../types';
import { InteractiveMapSetup } from './InteractiveMapSetup';
import { ACCENT_PALETTES, AccentPaletteKey } from '../themeAccents';
import { CATEGORY_TEMPLATES } from '../categoryTemplates';
import { SALON_IMAGES } from '../assets/images';
import { validateAndReadImageFile, compressAndResizeImage } from '../utils/imageUploadHelper';
import { AILogoSuiteModal } from './AILogoSuiteModal';
import { ImageCompressorWidget } from './ImageCompressorWidget';
import {
  buildYouTubeShortsUrl,
  buildYouTubeThumbnailUrl,
  buildYouTubeWatchUrl,
  extractYouTubeId,
} from '../utils/youtube';

export interface SectionVisibilityState {
  header: boolean;
  hero: boolean;
  metrics: boolean;
  about: boolean;
  services: boolean;
  offers: boolean;
  promoPopup: boolean;
  stylists: boolean;
  testimonials: boolean;
  gallery: boolean;
  location: boolean;
  whatsappFloat: boolean;
}

export const DEFAULT_SECTION_VISIBILITY: SectionVisibilityState = {
  header: true,
  hero: true,
  metrics: true,
  about: true,
  services: true,
  offers: true,
  promoPopup: true,
  stylists: true,
  testimonials: true,
  gallery: true,
  location: true,
  whatsappFloat: true
};

const INDIAN_MAJOR_CITIES = [
  'Bengaluru, Karnataka',
  'Mumbai, Maharashtra',
  'New Delhi, Delhi NCR',
  'Hyderabad, Telangana',
  'Chennai, Tamil Nadu',
  'Kolkata, West Bengal',
  'Pune, Maharashtra',
  'Jaipur, Rajasthan',
  'Kochi, Kerala',
  'Ahmedabad, Gujarat',
  'Chandigarh, Punjab',
  'Goa (Panaji / Candolim)',
  'Indore, Madhya Pradesh',
  'Lucknow, Uttar Pradesh'
];

interface SidePanelCustomizerProps {
  isOpen: boolean;
  onToggle: () => void;
  profile: SalonProfile;
  setProfile: React.Dispatch<React.SetStateAction<SalonProfile>>;
  selectedCategoryKey: BusinessTypeId;
  selectedAccentKey: AccentPaletteKey;
  setSelectedAccentKey: (key: AccentPaletteKey) => void;
  primaryAccentColor: string;
  isDarkCanvas: boolean;
  setIsDarkCanvas: (dark: boolean) => void;
  sectionVisibility: SectionVisibilityState;
  setSectionVisibility: React.Dispatch<React.SetStateAction<SectionVisibilityState>>;
  onAIGeneratePrompt?: (promptType: string, customPrompt?: string) => void;
  onResetDefaults?: () => void;
  services?: SalonService[];
  setServices?: React.Dispatch<React.SetStateAction<SalonService[]>>;
  onSelectCategory?: (categoryId: BusinessTypeId) => void;
}

type CustomizerTab = 'theme' | 'branding' | 'services' | 'location' | 'social' | 'sections' | 'ai';

const CURATED_HERO_PRESETS = [
  { name: 'Pinky Nails Sanctuary', url: SALON_IMAGES.hero, tag: 'Nail & Lash Studio' },
  { name: 'Glossy Chrome Gel Art', url: SALON_IMAGES.nailArt, tag: 'Nail Art' },
  { name: 'Lifted Lash & Brow Result', url: SALON_IMAGES.lashBrow, tag: 'Lash & Brow' },
  { name: 'Sterilized Tools & Polish Tray', url: SALON_IMAGES.toolsSetup, tag: 'Tools & Setup' },
  { name: 'Luxury Miraki Hair Sanctuary', url: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=80', tag: 'Hair Studio' },
  { name: 'Gentlemen’s Grooming Barbershop', url: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1200&q=80', tag: 'Barber Lounge' }
];

export const SidePanelCustomizer: React.FC<SidePanelCustomizerProps> = ({
  isOpen,
  onToggle,
  profile,
  setProfile,
  selectedCategoryKey,
  selectedAccentKey,
  setSelectedAccentKey,
  primaryAccentColor,
  isDarkCanvas,
  setIsDarkCanvas,
  sectionVisibility,
  setSectionVisibility,
  onAIGeneratePrompt,
  onResetDefaults,
  services,
  setServices,
  onSelectCategory
}) => {
  const [activeTab, setActiveTab] = useState<CustomizerTab>('theme');
  const [customHex, setCustomHex] = useState<string>(primaryAccentColor || '#0f172a');
  const [aiCustomText, setAiCustomText] = useState<string>('');
  const [toastNotice, setToastNotice] = useState<string | null>(null);
  
  // Branding & Media Management State
  const [isLogoModalOpen, setIsLogoModalOpen] = useState<boolean>(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [customLogoUrlInput, setCustomLogoUrlInput] = useState<string>(profile.logoUrl || '');
  const [customHeroUrlInput, setCustomHeroUrlInput] = useState<string>(profile.coverImageUrl || '');

  useEffect(() => {
    if (primaryAccentColor) {
      setCustomHex(primaryAccentColor);
    }
  }, [primaryAccentColor]);

  useEffect(() => {
    setCustomLogoUrlInput(profile.logoUrl || '');
    setCustomHeroUrlInput(profile.coverImageUrl || '');
  }, [profile.logoUrl, profile.coverImageUrl]);

  const showToast = (msg: string) => {
    setToastNotice(msg);
    setTimeout(() => setToastNotice(null), 3000);
  };

  // Handle Logo Upload with automatic auto-resize & compression
  const handleLogoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError(null);
    showToast('Uploading & compressing logo...');
    const result = await compressAndResizeImage(file);
    if (!result.isValid) {
      setFileError(result.errorMessage || 'File compression failed.');
      showToast(result.errorMessage || 'Logo upload failed.');
      return;
    }

    if (result.dataUrl) {
      setProfile((prev) => ({ ...prev, logoUrl: result.dataUrl }));
      setCustomLogoUrlInput(result.dataUrl);
      showToast(`Logo optimized (${result.compressedSizeKb} KB, -${result.compressionRatio}%) & applied!`);
    }
  };

  // Handle Hero Banner Upload with automatic auto-resize & compression
  const handleHeroFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError(null);
    showToast('Uploading & compressing banner...');
    const result = await compressAndResizeImage(file);
    if (!result.isValid) {
      setFileError(result.errorMessage || 'File compression failed.');
      showToast(result.errorMessage || 'Hero upload failed.');
      return;
    }

    if (result.dataUrl) {
      setProfile((prev) => ({ ...prev, coverImageUrl: result.dataUrl }));
      setCustomHeroUrlInput(result.dataUrl);
      showToast(`Banner optimized (${result.compressedSizeKb} KB, -${result.compressionRatio}%) & applied!`);
    }
  };

  const handleCustomColorApply = (hex: string) => {
    setCustomHex(hex);
    setProfile((prev) => ({
      ...prev,
      customAccentColor: hex
    }));
    showToast(`Accent color updated to ${hex}`);
  };

  const handleSelectPalette = (key: AccentPaletteKey) => {
    setSelectedAccentKey(key);
    const pal = ACCENT_PALETTES[key];
    if (pal) {
      setCustomHex(pal.primaryHex);
      setProfile((prev) => ({
        ...prev,
        themeAccentKey: key,
        customAccentColor: undefined // Clear override to follow palette
      }));
      showToast(`Applied ${pal.name} theme palette`);
    }
  };

  const handleToggleSection = (sectionKey: keyof SectionVisibilityState) => {
    const isVisible = !!sectionVisibility[sectionKey];
    setSectionVisibility((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
    showToast(`Section "${sectionKey}" ${!isVisible ? 'visible' : 'hidden'}`);
  };

  const handleCitySelect = (cityString: string) => {
    const cityName = cityString.split(',')[0].trim();
    setProfile((prev) => ({
      ...prev,
      city: cityName
    }));
    showToast(`Location set to ${cityName}`);
  };

  // The preview toolbar owns the single Side Customizer launcher.
  if (!isOpen) {
    return null;
  }

  return (
    <aside 
      className="fixed right-0 top-20 bottom-0 z-40 w-80 sm:w-96 bg-white border-l border-slate-200 shadow-2xl flex flex-col transition-all duration-300 animate-in slide-in-from-right font-sans"
      id="side-panel-customizer"
    >
      {/* Toast Notification */}
      {toastNotice && (
        <div className="absolute top-14 left-4 right-4 z-50 bg-slate-900 text-white text-[11px] font-medium py-2 px-3 rounded-xl shadow-xl flex items-center gap-2 border border-slate-700">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="truncate">{toastNotice}</span>
        </div>
      )}

      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center shadow-xs">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900">Visual Customizer</h3>
            <p className="text-[11px] text-slate-500">100% Real-Time Live Reflection</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {onResetDefaults && (
            <button
              onClick={onResetDefaults}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors"
              title="Reset to Template Defaults"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onToggle}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
            title="Close Customizer Panel"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="grid grid-cols-7 p-1 bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-600">
        <button
          onClick={() => setActiveTab('theme')}
          className={`py-2 px-1 rounded-lg flex flex-col items-center gap-1 transition-all cursor-pointer ${
            activeTab === 'theme' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
          }`}
        >
          <Palette className="w-3.5 h-3.5" />
          <span className="text-[9px]">Theme</span>
        </button>

        <button
          onClick={() => setActiveTab('branding')}
          className={`py-2 px-1 rounded-lg flex flex-col items-center gap-1 transition-all cursor-pointer ${
            activeTab === 'branding' ? 'bg-white text-purple-700 font-extrabold shadow-xs' : 'hover:text-slate-900'
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5 text-purple-600" />
          <span className="text-[9px]">Branding</span>
        </button>

        <button
          onClick={() => setActiveTab('services')}
          className={`py-2 px-1 rounded-lg flex flex-col items-center gap-1 transition-all cursor-pointer ${
            activeTab === 'services' ? 'bg-white text-blue-700 font-extrabold shadow-xs' : 'hover:text-slate-900'
          }`}
        >
          <Scissors className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-[9px]">Services</span>
        </button>

        <button
          onClick={() => setActiveTab('location')}
          className={`py-2 px-1 rounded-lg flex flex-col items-center gap-1 transition-all cursor-pointer ${
            activeTab === 'location' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          <span className="text-[9px]">Location</span>
        </button>

        <button
          onClick={() => setActiveTab('social')}
          className={`py-2 px-1 rounded-lg flex flex-col items-center gap-1 transition-all cursor-pointer ${
            activeTab === 'social' ? 'bg-white text-teal-700 font-extrabold shadow-xs' : 'hover:text-slate-900'
          }`}
        >
          <Share2 className="w-3.5 h-3.5 text-teal-600" />
          <span className="text-[9px]">Sync</span>
        </button>

        <button
          onClick={() => setActiveTab('sections')}
          className={`py-2 px-1 rounded-lg flex flex-col items-center gap-1 transition-all cursor-pointer ${
            activeTab === 'sections' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span className="text-[9px]">Sections</span>
        </button>

        <button
          onClick={() => setActiveTab('ai')}
          className={`py-2 px-1 rounded-lg flex flex-col items-center gap-1 transition-all cursor-pointer ${
            activeTab === 'ai' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-[9px]">AI Studio</span>
        </button>
      </div>

      {/* Tab Content Body */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 text-xs text-slate-700 scrollbar-thin">
        
        {/* Error Alert Notice */}
        {fileError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl flex items-start gap-2 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <strong className="block font-bold">File Upload Error:</strong>
              <span>{fileError}</span>
            </div>
            <button onClick={() => setFileError(null)} className="text-rose-500 hover:text-rose-900">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB: BRANDING & MEDIA MANAGEMENT (LOGOS & HERO BANNERS) */}
        {/* ============================================================ */}
        {activeTab === 'branding' && (
          <div className="flex flex-col gap-5">
            {/* 1. Salon Header Logo Section */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-purple-600" />
                    <span>Salon Header Logo</span>
                  </h4>
                  <p className="text-[11px] text-slate-500">Reflected live on website navbar header</p>
                </div>
                {profile.logoUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setProfile((p) => ({ ...p, logoUrl: undefined }));
                      setCustomLogoUrlInput('');
                      showToast('Cleared custom header logo');
                    }}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
                    title="Remove Header Logo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Logo Preview Box */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-center min-h-[70px] relative">
                {profile.logoUrl ? (
                  <img
                    src={profile.logoUrl}
                    alt="Salon Logo Preview"
                    className="max-h-12 max-w-full object-contain"
                  />
                ) : (
                  <div className="text-center text-slate-400 text-[11px]">
                    <span>No Custom Logo set. Using template category mark.</span>
                  </div>
                )}
              </div>

              {/* Action Buttons: AI Logo Suite & File Upload */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setIsLogoModalOpen(true)}
                  className="w-full py-2.5 px-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Generate 5 AI Vector Logos</span>
                </button>

                <label className="w-full py-2 px-3 bg-white hover:bg-slate-100 text-slate-800 font-bold rounded-xl border border-slate-300 text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs">
                  <Upload className="w-3.5 h-3.5 text-slate-600" />
                  <span>Upload Custom Logo (Max 5MB)</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Direct Image URL Input */}
              <div className="pt-2 border-t border-slate-200 space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Or Paste Custom Image URL / Data URL:
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={customLogoUrlInput}
                    onChange={(e) => setCustomLogoUrlInput(e.target.value)}
                    placeholder="https://... or data:image/..."
                    className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] outline-none focus:border-purple-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customLogoUrlInput.trim()) {
                        setProfile((p) => ({ ...p, logoUrl: customLogoUrlInput.trim() }));
                        showToast('Custom logo URL applied!');
                      }
                    }}
                    className="px-2.5 py-1.5 bg-slate-900 text-white font-bold text-[11px] rounded-lg cursor-pointer hover:bg-slate-800 shrink-0"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Hero Banner Image Section */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <ImagePlus className="w-4 h-4 text-purple-600" />
                    <span>Hero Banner Cover Image</span>
                  </h4>
                  <p className="text-[11px] text-slate-500">Reflected on main website hero section</p>
                </div>
              </div>

              {/* Hero Banner Preview Box */}
              <div className="relative rounded-xl overflow-hidden border border-slate-200 h-28 bg-slate-900">
                <img
                  src={profile.coverImageUrl}
                  alt="Hero Banner Preview"
                  className="w-full h-full object-cover object-center opacity-95 filter brightness-105 contrast-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-2.5">
                  <span className="text-[10px] font-mono font-bold text-white/90 truncate">
                    Active Hero Image
                  </span>
                </div>
              </div>

              {/* Upload Custom Hero Button */}
              <label className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Custom Hero Banner (Max 5MB)</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleHeroFileUpload}
                  className="hidden"
                />
              </label>

              {/* Direct Hero URL Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Or Paste Custom Hero Image URL:
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={customHeroUrlInput}
                    onChange={(e) => setCustomHeroUrlInput(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] outline-none focus:border-purple-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customHeroUrlInput.trim()) {
                        setProfile((p) => ({ ...p, coverImageUrl: customHeroUrlInput.trim() }));
                        showToast('Custom Hero Image applied!');
                      }
                    }}
                    className="px-2.5 py-1.5 bg-slate-900 text-white font-bold text-[11px] rounded-lg cursor-pointer hover:bg-slate-800 shrink-0"
                  >
                    Apply
                  </button>
                </div>
              </div>

              {/* Curated Hero Banner Presets */}
              <div className="pt-2 border-t border-slate-200 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Curated Studio Banner Presets:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {CURATED_HERO_PRESETS.map((preset, idx) => {
                    const isSelected = profile.coverImageUrl === preset.url;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setProfile((p) => ({ ...p, coverImageUrl: preset.url }));
                          setCustomHeroUrlInput(preset.url);
                          showToast(`Applied "${preset.name}" banner`);
                        }}
                        className={`relative rounded-xl overflow-hidden border text-left transition-all cursor-pointer h-16 group ${
                          isSelected ? 'border-purple-600 ring-2 ring-purple-400/30' : 'border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        <img
                          src={preset.url}
                          alt={preset.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-1.5 flex flex-col justify-end">
                          <span className="text-[10px] font-bold text-white leading-tight truncate">
                            {preset.name}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 3. Image Optimization & Compression Studio */}
            <ImageCompressorWidget
              onApplyLogo={(url) => {
                setProfile((p) => ({ ...p, logoUrl: url }));
                setCustomLogoUrlInput(url);
                showToast('Applied optimized photo as Salon Logo!');
              }}
              onApplyCover={(url) => {
                setProfile((p) => ({ ...p, coverImageUrl: url }));
                setCustomHeroUrlInput(url);
                showToast('Applied optimized photo as Hero Banner!');
              }}
              themePrimaryColor={primaryAccentColor}
            />
          </div>
        )}
        
        {/* ============================================================ */}
        {/* TAB 1: THEME & ACCENT PALETTES */}
        {/* ============================================================ */}
        {activeTab === 'theme' && (
          <div className="flex flex-col gap-4">
            
            {/* Salon Category / Vertical Switcher */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Salon Category / Template
              </label>
              <select
                value={selectedCategoryKey}
                onChange={(e) => {
                  const catId = e.target.value as BusinessTypeId;
                  onSelectCategory?.(catId);
                  showToast(`Switched Category Template to ${CATEGORY_TEMPLATES[catId]?.title || catId}`);
                }}
                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:border-slate-900 focus:outline-none"
              >
                {Object.values(CATEGORY_TEMPLATES).map((tmpl) => (
                  <option key={tmpl.id} value={tmpl.id}>
                    {tmpl.title} ({tmpl.paletteLabel.split('(')[0]})
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500 leading-normal">
                Selecting a new category will auto-populate professional preset services, stylists, and banner photos for that category.
              </p>
            </div>

            {/* Canvas Lighting */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Canvas Atmosphere
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsDarkCanvas(false)}
                  className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold cursor-pointer transition-all ${
                    !isDarkCanvas ? 'bg-slate-900 text-white border-slate-900 shadow-xs' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span>Light Luxury</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsDarkCanvas(true)}
                  className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold cursor-pointer transition-all ${
                    isDarkCanvas ? 'bg-slate-900 text-white border-slate-900 shadow-xs' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Moon className="w-4 h-4 text-indigo-400" />
                  <span>Dark Obsidian</span>
                </button>
              </div>
            </div>

            {/* Curated Accent Palettes */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Primary Theme Accents
                </label>
                <span className="text-[10px] text-slate-500 font-mono">
                  {Object.keys(ACCENT_PALETTES).length} Curated Palettes
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {Object.values(ACCENT_PALETTES).map((pal) => {
                  const isSelected = pal.key === selectedAccentKey && !profile.customAccentColor;
                  return (
                    <button
                      key={pal.key}
                      onClick={() => handleSelectPalette(pal.key)}
                      className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-slate-900 bg-slate-50 ring-2 ring-slate-900/10 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <span
                        className="w-5 h-5 rounded-full border border-black/10 shrink-0 shadow-xs flex items-center justify-center text-white text-[10px]"
                        style={{ backgroundColor: pal.primaryHex }}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-[11px] text-slate-900 truncate">{pal.name}</div>
                        <div className="text-[10px] text-slate-400 truncate">{pal.categoryHint}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Hex Color Picker */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Custom Accent Color (Hex)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={customHex}
                  onChange={(e) => handleCustomColorApply(e.target.value)}
                  className="w-10 h-10 rounded-xl border border-slate-200 cursor-pointer p-0.5 bg-white"
                />
                <input
                  type="text"
                  value={customHex}
                  onChange={(e) => handleCustomColorApply(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 uppercase focus:border-slate-900 focus:outline-none"
                  placeholder="#0F172A"
                />
              </div>
            </div>

            {/* Hero Cover Image presets */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Hero Cover Photo
              </label>
              <input
                type="url"
                value={profile.coverImageUrl}
                onChange={(e) => setProfile((prev) => ({ ...prev, coverImageUrl: e.target.value }))}
                placeholder="Paste custom cover photo URL..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono text-slate-700 focus:border-slate-900 focus:outline-none"
              />
            </div>

          </div>
        )}

        {/* ============================================================ */}
        {/* TAB: SERVICES & PRICING MENU */}
        {/* ============================================================ */}
        {activeTab === 'services' && (
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center mb-1">
              <div>
                <h4 className="font-bold text-slate-900 text-xs">Manage Menu Services</h4>
                <p className="text-[10px] text-slate-500">Live prices in INR (₹) reflected on canvas</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const newSrv: SalonService = {
                    id: `srv-custom-${Date.now()}`,
                    name: 'New Custom Service',
                    category: 'General',
                    durationMinutes: 30,
                    price: 250,
                    description: 'Handcrafted premium salon treatment.',
                    icon: 'spa',
                    popular: false
                  };
                  setServices?.((prev) => [...prev, newSrv]);
                  showToast('Custom service added to menu!');
                }}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] px-2.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
              >
                <span>+ Add Service</span>
              </button>
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin">
              {services?.map((srv) => (
                <div key={srv.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={srv.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setServices?.((prev) => prev.map((s) => s.id === srv.id ? { ...s, name: val } : s));
                      }}
                      className="font-bold text-xs text-slate-900 bg-transparent border-b border-dashed border-slate-300 focus:border-slate-900 focus:outline-none w-3/4 py-0.5"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setServices?.((prev) => prev.filter((s) => s.id !== srv.id));
                        showToast(`Deleted service "${srv.name}"`);
                      }}
                      className="text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400">Price (₹):</span>
                      <input
                        type="number"
                        value={srv.price}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setServices?.((prev) => prev.map((s) => s.id === srv.id ? { ...s, price: val } : s));
                        }}
                        className="w-full p-1 bg-white border border-slate-200 rounded text-center font-bold text-slate-900 focus:border-slate-900 focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400">Min:</span>
                      <input
                        type="number"
                        value={srv.durationMinutes}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setServices?.((prev) => prev.map((s) => s.id === srv.id ? { ...s, durationMinutes: val } : s));
                        }}
                        className="w-full p-1 bg-white border border-slate-200 rounded text-center font-bold text-slate-900 focus:border-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
              {(!services || services.length === 0) && (
                <div className="text-center py-6 text-slate-400 text-xs">
                  No services configured. Click '+ Add Service' above to add your first salon service.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: LOCATION & SALON DETAILS */}
        {/* ============================================================ */}
        {activeTab === 'location' && (
          <div className="flex flex-col gap-4">
            
            {/* Business Name */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Salon Business Name
              </label>
              <input
                type="text"
                value={profile.businessName}
                onChange={(e) => setProfile((prev) => ({ ...prev, businessName: e.target.value }))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold text-slate-900 focus:border-slate-900 focus:outline-none"
                placeholder="e.g. Miraki Hair Studio"
              />
            </div>

            {/* Dynamic Map and Real-time Address Input Panel */}
            <div className="border border-slate-100 rounded-2xl p-1 bg-slate-50/50">
              <InteractiveMapSetup 
                profile={profile}
                setProfile={setProfile}
                themePrimaryColor={primaryAccentColor}
              />
            </div>
            
            {/* Home Service Settings */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  Home Service
                </label>
                <button
                  type="button"
                  onClick={() => setProfile((prev) => ({ 
                    ...prev, 
                    homeService: prev.homeService?.enabled ? { ...prev.homeService, enabled: false } : { enabled: true, baseCharge: 200, radiusLimitKm: 10 } 
                  }))}
                  className={`w-10 h-5 rounded-full p-1 transition-colors ${profile.homeService?.enabled ? 'bg-teal-600' : 'bg-slate-300'}`}
                >
                  <div className={`w-3 h-3 bg-white rounded-full transition-transform ${profile.homeService?.enabled ? 'translate-x-5' : ''}`} />
                </button>
              </div>

              {profile.homeService?.enabled && (
                <div className="space-y-2 animate-in fade-in pt-2 border-t border-slate-200">
                  <label className="block text-[11px] font-bold text-slate-500">Base Extra Charge (INR)</label>
                  <input
                    type="number"
                    value={profile.homeService.baseCharge}
                    onChange={(e) => setProfile(prev => ({...prev, homeService: {...prev.homeService!, baseCharge: Number(e.target.value)}}))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                  />
                  <label className="block text-[11px] font-bold text-slate-500">Service Radius Limit (km)</label>
                  <input
                    type="number"
                    value={profile.homeService.radiusLimitKm}
                    onChange={(e) => setProfile(prev => ({...prev, homeService: {...prev.homeService!, radiusLimitKm: Number(e.target.value)}}))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                  />
                </div>
              )}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Phone Number (+91)
              </label>
              <input
                type="text"
                value={profile.phone}
                onChange={(e) => setProfile((prev) => ({ ...prev, phone: e.target.value }))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono text-slate-900 focus:border-slate-900 focus:outline-none"
                placeholder="+91 98765 43210"
              />
            </div>

            {/* Lead Founder / Owner Info */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Owner / Lead
                </label>
                <input
                  type="text"
                  value={profile.ownerName}
                  onChange={(e) => setProfile((prev) => ({ ...prev, ownerName: e.target.value }))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Owner Role
                </label>
                <input
                  type="text"
                  value={profile.ownerRole}
                  onChange={(e) => setProfile((prev) => ({ ...prev, ownerRole: e.target.value }))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>
            </div>

          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2.5: SOCIAL MEDIA & CONNECTIONS */}
        {/* ============================================================ */}
        {activeTab === 'social' && (
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Share2 className="w-4 h-4 text-teal-600" />
                Social Media Setup
              </h3>
              <p className="text-[11px] text-slate-500">Configure your social links to display in the website's footer and contact section.</p>
            </div>

            {/* Instagram */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Instagram className="w-3.5 h-3.5 text-pink-600" />
                Instagram Profile / Handle
              </label>
              <div className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-300 bg-white focus-within:border-teal-600 transition-colors">
                <span className="text-slate-400 font-mono text-xs">@</span>
                <input
                  type="text"
                  value={profile.instagramHandle?.replace('@', '') || ''}
                  onChange={(e) => setProfile((prev) => ({ ...prev, instagramHandle: `@${e.target.value.replace('@', '')}` }))}
                  className="w-full text-xs font-mono text-slate-900 outline-none"
                  placeholder="pinkynails.studio"
                />
              </div>
            </div>

            {/* Facebook */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Facebook className="w-3.5 h-3.5 text-blue-600" />
                Facebook Page Link
              </label>
              <input
                type="text"
                value={profile.facebookPage || ''}
                onChange={(e) => setProfile((prev) => ({ ...prev, facebookPage: e.target.value }))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:border-teal-600 focus:outline-none"
                placeholder="https://facebook.com/pinkynails"
              />
            </div>

            {/* YouTube */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Youtube className="w-3.5 h-3.5 text-red-600" />
                YouTube Channel Link
              </label>
              <input
                type="text"
                value={profile.youtubeChannel || ''}
                onChange={(e) => setProfile((prev) => ({ ...prev, youtubeChannel: e.target.value }))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:border-teal-600 focus:outline-none"
                placeholder="https://youtube.com/@pinkynails"
              />
            </div>

            {/* WhatsApp */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-emerald-600">chat</span>
                WhatsApp Business Number
              </label>
              <input
                type="text"
                value={profile.whatsapp || ''}
                onChange={(e) => setProfile((prev) => ({ ...prev, whatsapp: e.target.value }))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono text-slate-900 focus:border-teal-600 focus:outline-none"
                placeholder="+91 98765 43210"
              />
            </div>

            {/* Google Business Page */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-blue-500">google</span>
                Google Business Page URL
              </label>
              <input
                type="text"
                value={profile.googleBusinessUrl || ''}
                onChange={(e) => setProfile((prev) => ({ ...prev, googleBusinessUrl: e.target.value }))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:border-teal-600 focus:outline-none"
                placeholder="https://g.page/r/pinkynails/review"
              />
            </div>

            {/* Reel Video Showcase */}
            <div className="pt-4 border-t border-slate-100 space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Youtube className="w-3.5 h-3.5 text-red-600" />
                Add YouTube Shorts URL
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Paste YouTube Shorts URL..."
                  className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] outline-none focus:border-teal-600 font-mono"
                  onKeyDown={async (e) => {
                    if (e.key !== 'Enter') return;
                    const pastedUrl = e.currentTarget.value.trim();
                    if (!pastedUrl) return;

                    // Extract the clean 11-char video id from ANY YouTube
                    // format (watch, youtu.be, shorts, embed …) even when the
                    // link carries ?si=… / &feature=shared query parameters.
                    const videoId = extractYouTubeId(pastedUrl);
                    if (!videoId) {
                      showToast('Invalid YouTube URL');
                      return;
                    }

                    const alreadyExists = (profile.socialVideos || []).some(
                      (v) =>
                        v.videoId === videoId ||
                        extractYouTubeId(v.youtubeUrl) === videoId
                    );
                    if (alreadyExists) {
                      showToast('That video is already in your feed.');
                      return;
                    }

                    let title = 'YouTube Shorts';
                    let thumbnailUrl = buildYouTubeThumbnailUrl(videoId, 'hqdefault');

                    try {
                      // oEmbed is more reliable against the canonical watch URL
                      // than a raw short link with tracking parameters.
                      const response = await fetch(
                        `https://www.youtube.com/oembed?url=${encodeURIComponent(buildYouTubeWatchUrl(videoId))}&format=json`
                      );
                      if (response.ok) {
                        const data = await response.json();
                        if (data.title) title = data.title;
                        if (data.thumbnail_url) thumbnailUrl = data.thumbnail_url;
                      }
                    } catch (err) {
                      console.error('Could not fetch video metadata', err);
                    }

                    const newVideo: SocialVideo = {
                      id: `video-${Date.now()}`,
                      // Store the CLEAN video id and a clean canonical URL so
                      // the live preview / public site can build embeds from
                      // the id without raw ?si=… query parameters.
                      youtubeUrl: buildYouTubeShortsUrl(videoId),
                      videoId: videoId,
                      title: title,
                      thumbnailUrl: thumbnailUrl,
                      categoryTag: 'SHORT',
                      isOwnerVideo: true,
                    };
                    setProfile((prev) => ({ ...prev, socialVideos: [...(prev.socialVideos || []), newVideo] }));
                    e.currentTarget.value = '';
                    showToast('Short added to your website feed!');
                  }}
                />
              </div>
              {(profile.socialVideos || []).map((video, index) => (
                <div key={video.id} className="flex gap-1.5 items-center bg-slate-50 p-2 rounded-lg">
                  <img src={video.thumbnailUrl} alt="thumb" className="w-10 h-10 object-cover rounded" />
                  <input
                    type="text"
                    value={video.title}
                    onChange={(e) => {
                      const newVideos = [...(profile.socialVideos || [])];
                      newVideos[index] = { ...video, title: e.target.value };
                      setProfile((prev) => ({ ...prev, socialVideos: newVideos }));
                    }}
                    className="flex-1 bg-transparent border-none text-[11px] outline-none font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => {
                        const newVideos = (profile.socialVideos || []).filter((_, i) => i !== index);
                        setProfile((prev) => ({ ...prev, socialVideos: newVideos }));
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: SECTION VISIBILITY TOGGLES */}
        {/* ============================================================ */}
        {activeTab === 'sections' && (
          <div className="flex flex-col gap-3">
            <div className="bg-amber-50 border border-amber-200/70 p-3 rounded-xl text-[11px] text-amber-900">
              <strong>100% Real-Time Reflection:</strong> Toggle sections on or off to preview and adjust your client-facing layout.
            </div>

            <div className="flex flex-col gap-2">
              
              {/* Promotional Top Announcement Banner */}
              <div className="p-2.5 rounded-xl border border-amber-200 bg-amber-50/50 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span>Promotional Header Banner</span>
                      <span className="text-[9px] font-mono-caps bg-amber-200 text-amber-950 font-bold px-1.5 py-0.2 rounded-md">Promo</span>
                    </div>
                    <div className="text-[10px] text-slate-500">Discount codes, festival sale bar</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const currentEnabled = profile.promotionalBanner?.enabled !== false;
                      setProfile((prev) => ({
                        ...prev,
                        promotionalBanner: {
                          ...(prev.promotionalBanner || { text: '✨ Special Festive Offer: Get Flat 20% OFF!' }),
                          enabled: !currentEnabled,
                        }
                      }));
                      showToast(!currentEnabled ? 'Promotional header banner enabled' : 'Promotional header banner hidden');
                    }}
                    className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                      profile.promotionalBanner?.enabled !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {profile.promotionalBanner?.enabled !== false ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="p-2.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">Sticky Top Header</div>
                  <div className="text-[10px] text-slate-400">Branding, location & booking CTA</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleSection('header')}
                  className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                    sectionVisibility.header ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {sectionVisibility.header ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>

              <div className="p-2.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">Hero & Direct Booking</div>
                  <div className="text-[10px] text-slate-400">Tagline, cover, headline & INR CTA</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleSection('hero')}
                  className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                    sectionVisibility.hero ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {sectionVisibility.hero ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>

              <div className="p-2.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">Quick Metrics Bar</div>
                  <div className="text-[10px] text-slate-400">Starting INR rates, rating & reviews</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleSection('metrics')}
                  className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                    sectionVisibility.metrics ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {sectionVisibility.metrics ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>

              <div className="p-2.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">Story & Hygiene Badges</div>
                  <div className="text-[10px] text-slate-400">Founder quote & medical sterilizations</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleSection('about')}
                  className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                    sectionVisibility.about ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {sectionVisibility.about ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>

              <div className="p-2.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">Services & INR (₹) Menu</div>
                  <div className="text-[10px] text-slate-400">Categorized treatments & prices</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleSection('services')}
                  className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                    sectionVisibility.services ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {sectionVisibility.services ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>

              <div className="p-2.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">Master Stylists Roster</div>
                  <div className="text-[10px] text-slate-400">Specialist cards, ratings & skills</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleSection('stylists')}
                  className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                    sectionVisibility.stylists ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {sectionVisibility.stylists ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>

              <div className="p-2.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">Offers & Discounts</div>
                  <div className="text-[10px] text-slate-400">Promotional deals & dynamic coupon cards</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleSection('offers')}
                  className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                    sectionVisibility.offers ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {sectionVisibility.offers ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>

              <div className="p-2.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">Promotional Popup Overlay</div>
                  <div className="text-[10px] text-slate-400">Display the featured offer modal immediately on site load</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleSection('promoPopup')}
                  className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                    sectionVisibility.promoPopup ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {sectionVisibility.promoPopup ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>

              <div className="p-2.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">Client Reviews & Testimonials</div>
                  <div className="text-[10px] text-slate-400">5-star reviews & verified feedback</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleSection('testimonials')}
                  className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                    sectionVisibility.testimonials ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {sectionVisibility.testimonials ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>

              <div className="p-2.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">Studio Lookbook Gallery</div>
                  <div className="text-[10px] text-slate-400">Makeovers & client transformation photos</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleSection('gallery')}
                  className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                    sectionVisibility.gallery ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {sectionVisibility.gallery ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>

              <div className="p-2.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">Location, Map & Timings</div>
                  <div className="text-[10px] text-slate-400">Map card, operating hours & directions</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleSection('location')}
                  className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                    sectionVisibility.location ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {sectionVisibility.location ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>

              <div className="p-2.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">Floating WhatsApp Chat</div>
                  <div className="text-[10px] text-slate-400">1-click WhatsApp booking bubble</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleSection('whatsappFloat')}
                  className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                    sectionVisibility.whatsappFloat ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {sectionVisibility.whatsappFloat ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 4: AI STUDIO ASSISTANT */}
        {/* ============================================================ */}
        {activeTab === 'ai' && (
          <div className="flex flex-col gap-4">
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200/60 p-3.5 rounded-xl flex flex-col gap-2">
              <div className="flex items-center gap-2 text-purple-900 font-bold">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span>AI Salon Copywriter</span>
              </div>
              <p className="text-[11px] text-purple-800 leading-relaxed">
                Generate high-converting headlines, seasonal offers, and story descriptions tailored for Indian clientele.
              </p>
            </div>

            {/* Custom AI Prompt Box */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Custom AI Prompt
              </label>
              <textarea
                rows={3}
                value={aiCustomText}
                onChange={(e) => setAiCustomText(e.target.value)}
                placeholder="e.g. Write luxury organic tagline for bridal studio in Indiranagar Bengaluru..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-900 focus:border-slate-900 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  if (onAIGeneratePrompt) {
                    onAIGeneratePrompt('custom', aiCustomText);
                    setAiCustomText('');
                    showToast('AI regenerated copy applied!');
                  }
                }}
                className="mt-2 w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Wand2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Generate & Apply to Canvas</span>
              </button>
            </div>

            {/* Quick AI Action Buttons */}
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                1-Click AI Presets
              </span>

              <button
                type="button"
                onClick={() => onAIGeneratePrompt && onAIGeneratePrompt('luxury')}
                className="p-2.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white text-left flex items-center justify-between group cursor-pointer"
              >
                <div>
                  <div className="font-bold text-slate-900">✨ Ultra-Luxury & Botanical</div>
                  <div className="text-[10px] text-slate-400">High-ticket premium salon wording</div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => onAIGeneratePrompt && onAIGeneratePrompt('bridal')}
                className="p-2.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white text-left flex items-center justify-between group cursor-pointer"
              >
                <div>
                  <div className="font-bold text-slate-900">👰 Festive & Bridal Packages</div>
                  <div className="text-[10px] text-slate-400">Diwali, Wedding & Makeover headlines</div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => onAIGeneratePrompt && onAIGeneratePrompt('genz')}
                className="p-2.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white text-left flex items-center justify-between group cursor-pointer"
              >
                <div>
                  <div className="font-bold text-slate-900">⚡ Modern Trendsetter Tone</div>
                  <div className="text-[10px] text-slate-400">Punchy, bold styling & color studio</div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => onAIGeneratePrompt && onAIGeneratePrompt('ayurvedic')}
                className="p-2.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white text-left flex items-center justify-between group cursor-pointer"
              >
                <div>
                  <div className="font-bold text-slate-900">🌿 Holistic Ayurvedic Glow</div>
                  <div className="text-[10px] text-slate-400">Herbal, wellness & scalp healing copy</div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

          </div>
        )}

      </div>

      {/* AI Logo Suite Modal */}
      <AILogoSuiteModal
        isOpen={isLogoModalOpen}
        onClose={() => setIsLogoModalOpen(false)}
        salonName={profile.businessName}
        categoryKey={selectedCategoryKey}
        primaryColor={primaryAccentColor}
        currentLogoUrl={profile.logoUrl}
        onSelectLogo={(logoDataUrl) => {
          setProfile((prev) => ({ ...prev, logoUrl: logoDataUrl }));
          setCustomLogoUrlInput(logoDataUrl);
          showToast('Selected AI Logo applied to header!');
        }}
      />
    </aside>
  );
};
