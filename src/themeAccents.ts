import { BusinessTypeId } from './types';

export type AccentPaletteKey = 
  | 'crimson'
  | 'mahogany'
  | 'emerald'
  | 'slate'
  | 'purple'
  | 'rose'
  | 'ocean'
  | 'obsidian';

export interface ThemeAccentConfig {
  key: AccentPaletteKey;
  name: string;
  categoryHint: string;
  primaryHex: string;
  secondaryHex: string;
  badgeBg: string;
  badgeText: string;
  buttonBg: string;
  buttonHoverBg: string;
  buttonText: string;
  textAccent: string;
  borderAccent: string;
  lightBg: string;
  ringColor: string;
}

export const ACCENT_PALETTES: Record<AccentPaletteKey, ThemeAccentConfig> = {
  crimson: {
    key: 'crimson',
    name: 'Royal Crimson',
    categoryHint: 'Bridal & Makeover',
    primaryHex: '#9f1239',
    secondaryHex: '#e11d48',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-900',
    buttonBg: 'bg-rose-800',
    buttonHoverBg: 'hover:bg-rose-900',
    buttonText: 'text-white',
    textAccent: 'text-rose-800',
    borderAccent: 'border-rose-300',
    lightBg: 'bg-rose-50',
    ringColor: 'focus:ring-rose-800'
  },
  mahogany: {
    key: 'mahogany',
    name: 'Vintage Mahogany',
    categoryHint: "Barber & Men's Grooming",
    primaryHex: '#78350f',
    secondaryHex: '#b45309',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-950',
    buttonBg: 'bg-amber-900',
    buttonHoverBg: 'hover:bg-amber-950',
    buttonText: 'text-amber-50',
    textAccent: 'text-amber-900',
    borderAccent: 'border-amber-300',
    lightBg: 'bg-amber-50',
    ringColor: 'focus:ring-amber-900'
  },
  emerald: {
    key: 'emerald',
    name: 'Botanical Emerald',
    categoryHint: 'Spa, Wellness & Ayurvedic',
    primaryHex: '#065f46',
    secondaryHex: '#059669',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-950',
    buttonBg: 'bg-emerald-800',
    buttonHoverBg: 'hover:bg-emerald-900',
    buttonText: 'text-white',
    textAccent: 'text-emerald-800',
    borderAccent: 'border-emerald-300',
    lightBg: 'bg-emerald-50',
    ringColor: 'focus:ring-emerald-800'
  },
  slate: {
    key: 'slate',
    name: 'Minimalist Slate',
    categoryHint: 'Hair Studio & Modern Unisex',
    primaryHex: '#0f172a',
    secondaryHex: '#334155',
    badgeBg: 'bg-slate-200',
    badgeText: 'text-slate-900',
    buttonBg: 'bg-slate-900',
    buttonHoverBg: 'hover:bg-slate-800',
    buttonText: 'text-white',
    textAccent: 'text-slate-900',
    borderAccent: 'border-slate-300',
    lightBg: 'bg-slate-100',
    ringColor: 'focus:ring-slate-900'
  },
  purple: {
    key: 'purple',
    name: 'Glamour Orchid',
    categoryHint: 'Nail Studio & Lash Bar',
    primaryHex: '#7e22ce',
    secondaryHex: '#a855f7',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-950 font-bold',
    buttonBg: 'bg-purple-700',
    buttonHoverBg: 'hover:bg-purple-800',
    buttonText: 'text-white font-bold',
    textAccent: 'text-purple-900 font-extrabold',
    borderAccent: 'border-purple-300',
    lightBg: 'bg-purple-50',
    ringColor: 'focus:ring-purple-700'
  },
  rose: {
    key: 'rose',
    name: 'Rose Gold & Blush',
    categoryHint: 'Beauty Parlour & Glow',
    primaryHex: '#be185d',
    secondaryHex: '#f43f5e',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-950 font-bold',
    buttonBg: 'bg-rose-800',
    buttonHoverBg: 'hover:bg-rose-900',
    buttonText: 'text-white font-bold',
    textAccent: 'text-rose-900 font-extrabold',
    borderAccent: 'border-rose-300',
    lightBg: 'bg-rose-50',
    ringColor: 'focus:ring-rose-800'
  },
  ocean: {
    key: 'ocean',
    name: 'Clinical Ocean',
    categoryHint: 'Skincare & Dermatology',
    primaryHex: '#0369a1',
    secondaryHex: '#0284c7',
    badgeBg: 'bg-sky-100',
    badgeText: 'text-sky-950',
    buttonBg: 'bg-sky-700',
    buttonHoverBg: 'hover:bg-sky-800',
    buttonText: 'text-white',
    textAccent: 'text-sky-700',
    borderAccent: 'border-sky-300',
    lightBg: 'bg-sky-50',
    ringColor: 'focus:ring-sky-700'
  },
  obsidian: {
    key: 'obsidian',
    name: 'Obsidian & Gold',
    categoryHint: 'Tattoo Studio & Dark Luxury',
    primaryHex: '#18181b',
    secondaryHex: '#f59e0b',
    badgeBg: 'bg-amber-400/20',
    badgeText: 'text-amber-300',
    buttonBg: 'bg-amber-400',
    buttonHoverBg: 'hover:bg-amber-300',
    buttonText: 'text-zinc-950',
    textAccent: 'text-amber-400',
    borderAccent: 'border-amber-400/40',
    lightBg: 'bg-zinc-900',
    ringColor: 'focus:ring-amber-400'
  }
};

export const DEFAULT_CATEGORY_ACCENTS: Record<BusinessTypeId, AccentPaletteKey> = {
  hair_salon: 'slate',
  barber: 'mahogany',
  unisex_salon: 'slate',
  beauty_parlour: 'rose',
  nail_studio: 'purple',
  hair_spa: 'emerald',
  skincare_clinic: 'ocean',
  makeup_studio: 'crimson',
  massage_wellness: 'emerald',
  hair_coloring: 'purple',
  bridal_lounge: 'crimson',
  tattoo_studio: 'obsidian',
  lash_brow: 'purple',
  ayurvedic_spa: 'emerald',
  ayurvedic_wellness_spa: 'emerald',
  luxury_hair_salon: 'obsidian',
  bridal_makeover_studio: 'rose',
  family_salon: 'ocean',
  barber_grooming_club: 'mahogany',
  nails_lash_brow_bar: 'crimson',
  medispa_aesthetics: 'ocean',
  organic_bio_salon: 'emerald',
  express_beauty_bar: 'crimson',
  thai_massage_center: 'mahogany',
  kids_teens_studio: 'rose',
  resort_spa: 'ocean',
  vedic_ayurveda_studio: 'mahogany'
};

/**
 * Calculates relative luminance of a HEX color string (WCAG 2.x standard)
 */
export function getLuminance(hex: string): number {
  if (!hex) return 0;
  let cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map((c) => c + c).join('');
  }
  if (cleanHex.length !== 6) return 0;

  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const calR = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  const calG = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  const calB = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

  return 0.2126 * calR + 0.7152 * calG + 0.0722 * calB;
}

/**
 * Dynamically adjusts text color between white (#ffffff) or charcoal (#1e293b)
 * based on the relative luminance of the given accent HEX color.
 */
export function getContrastTextColor(hex: string): '#ffffff' | '#1e293b' {
  const lum = getLuminance(hex);
  // WCAG contrast threshold: if luminance > 0.45, charcoal (#1e293b) provides high contrast, else white (#ffffff)
  return lum > 0.45 ? '#1e293b' : '#ffffff';
}

/**
 * Updates the primary accent CSS variable across the document root
 * and all templates using var(--primary-accent) or var(--theme-primary).
 * Automatically calculates relative luminance and updates dynamic text contrast variables.
 */
export function applyPrimaryAccentCssVar(primaryHex: string, secondaryHex?: string) {
  if (typeof document !== 'undefined' && document.documentElement) {
    const luminance = getLuminance(primaryHex);
    const contrastColor = getContrastTextColor(primaryHex);

    document.documentElement.style.setProperty('--primary-accent', primaryHex);
    document.documentElement.style.setProperty('--theme-primary', primaryHex);
    document.documentElement.style.setProperty('--color-primary', primaryHex);

    // Dynamic contrast & luminance CSS variables
    document.documentElement.style.setProperty('--accent-luminance', luminance.toFixed(4));
    document.documentElement.style.setProperty('--accent-text-color', contrastColor);
    document.documentElement.style.setProperty('--accent-contrast-text', contrastColor);
    document.documentElement.style.setProperty('--color-on-primary', contrastColor);
    document.documentElement.style.setProperty('--theme-on-accent', contrastColor);

    if (secondaryHex) {
      document.documentElement.style.setProperty('--theme-secondary', secondaryHex);
      const secContrast = getContrastTextColor(secondaryHex);
      document.documentElement.style.setProperty('--theme-on-secondary', secContrast);
    }
  }
}

