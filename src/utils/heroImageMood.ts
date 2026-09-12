export interface HeroAIStyling {
  moodName: string;
  isLightImage: boolean;
  
  // Background Image filters
  imageFilterClass: string;
  
  // Overlay Mask
  overlayGradientClass: string;
  overlayBlendMode: string;
  overlayAccentColor: string;
  
  // Text Card Container Backing
  cardBackingClass: string;
  
  // Typography Colors & Effects
  headingColor: string;
  headingGradient?: string;
  subtitleColor: string;
  badgeBg: string;
  badgeTextColor: string;
  verifiedBadgeClass: string;
  cityBadgeClass: string;
  primaryBtnBg: string;
  primaryBtnText: string;
  metricsBorderColor: string;
  metricsLabelColor: string;
  metricsValueColor: string;
  
  // Legibility Shadow
  textShadow: string;
  dropShadowClass: string;
}

interface ImageStats {
  r: number;
  g: number;
  b: number;
  brightness: number;
}

// Memory cache for analyzed images
const moodCache = new Map<string, HeroAIStyling>();

// Extract basic stats from canvas or URL string heuristics
function analyzeImageStatsSync(imageUrl: string): ImageStats {
  const lower = (imageUrl || '').toLowerCase();

  if (lower.includes('spa') || lower.includes('massage') || lower.includes('ayurveda') || lower.includes('540555700478')) {
    return { r: 40, g: 140, b: 120, brightness: 100 }; // Cool Spa
  }
  if (lower.includes('barber') || lower.includes('grooming') || lower.includes('1503951914875')) {
    return { r: 50, g: 50, b: 55, brightness: 52 }; // Sleek Dark
  }
  if (lower.includes('nail') || lower.includes('pink') || lower.includes('lash') || lower.includes('1522337360788')) {
    return { r: 210, g: 110, b: 150, brightness: 140 }; // Rose Pink
  }
  if (lower.includes('bridal') || lower.includes('gold') || lower.includes('1516975080664')) {
    return { r: 210, g: 170, b: 90, brightness: 160 }; // Warm Gold
  }
  if (lower.includes('light') || lower.includes('daylight') || lower.includes('white')) {
    return { r: 230, g: 230, b: 235, brightness: 220 }; // Bright Daylight
  }

  // Default balanced warm salon tone
  return { r: 160, g: 140, b: 120, brightness: 135 };
}

export function computeHeroAIStyling(imageUrl: string, fallbackAccentColor?: string): HeroAIStyling {
  const cacheKey = `${imageUrl}_${fallbackAccentColor || ''}`;
  if (moodCache.has(cacheKey)) {
    return moodCache.get(cacheKey)!;
  }

  const stats = analyzeImageStatsSync(imageUrl);
  const { r, g, b, brightness } = stats;

  let styling: HeroAIStyling;

  // 1. Light Daylight Image (>175 brightness)
  if (brightness > 175) {
    styling = {
      moodName: 'Bright Daylight Interior',
      isLightImage: true,
      imageFilterClass: 'brightness-105 contrast-105 saturate-105',
      overlayGradientClass: 'bg-gradient-to-t from-slate-950/20 via-transparent to-black/10',
      overlayBlendMode: 'normal',
      overlayAccentColor: 'transparent',
      cardBackingClass: 'backdrop-blur-md bg-white/90 border border-slate-200/90 shadow-2xl rounded-2xl p-6 md:p-8 text-slate-900',
      headingColor: '#0f172a',
      subtitleColor: '#334155',
      badgeBg: '#0f172a',
      badgeTextColor: '#ffffff',
      verifiedBadgeClass: 'bg-emerald-100 text-emerald-950 border border-emerald-300 font-bold shadow-xs',
      cityBadgeClass: 'bg-amber-100 text-amber-950 border border-amber-300 font-bold shadow-xs',
      primaryBtnBg: fallbackAccentColor || '#0f172a',
      primaryBtnText: '#ffffff',
      metricsBorderColor: 'border-slate-300/80',
      metricsLabelColor: 'text-slate-600 font-bold',
      metricsValueColor: 'text-emerald-800 font-extrabold',
      textShadow: 'none',
      dropShadowClass: 'drop-shadow-xs',
    };
  } 
  // 2. Cool Emerald / Botanical Spa (Green dominant)
  else if (g > r + 15 && g > b - 10) {
    styling = {
      moodName: 'Cool Botanical Spa',
      isLightImage: false,
      imageFilterClass: 'brightness-105 contrast-105 saturate-110',
      overlayGradientClass: 'bg-gradient-to-t from-slate-950/45 via-transparent to-slate-950/15',
      overlayBlendMode: 'normal',
      overlayAccentColor: 'transparent',
      cardBackingClass: 'backdrop-blur-md bg-slate-950/50 border border-emerald-500/40 shadow-2xl rounded-2xl p-6 md:p-8 text-white',
      headingColor: '#ffffff',
      headingGradient: 'from-emerald-200 via-teal-100 to-cyan-100',
      subtitleColor: '#ecfeff',
      badgeBg: 'linear-gradient(to right, #059669, #0d9488)',
      badgeTextColor: '#ffffff',
      verifiedBadgeClass: 'bg-slate-950/80 backdrop-blur-md text-emerald-300 border border-emerald-400/60 font-bold',
      cityBadgeClass: 'bg-slate-950/80 backdrop-blur-md text-teal-300 border border-teal-400/60 font-bold',
      primaryBtnBg: fallbackAccentColor || '#059669',
      primaryBtnText: '#ffffff',
      metricsBorderColor: 'border-emerald-500/40',
      metricsLabelColor: 'text-emerald-200 font-bold',
      metricsValueColor: 'text-emerald-300 font-extrabold',
      textShadow: '0 2px 4px rgba(0, 0, 0, 0.85)',
      dropShadowClass: 'drop-shadow-md',
    };
  }
  // 3. Vibrant Rose / Pink / Lash Studio
  else if (r > g + 25 && b > g - 15) {
    styling = {
      moodName: 'Vibrant Rose & Blossom',
      isLightImage: false,
      imageFilterClass: 'brightness-105 contrast-105 saturate-110',
      overlayGradientClass: 'bg-gradient-to-t from-slate-950/45 via-transparent to-slate-950/15',
      overlayBlendMode: 'normal',
      overlayAccentColor: 'transparent',
      cardBackingClass: 'backdrop-blur-md bg-slate-950/50 border border-rose-500/40 shadow-2xl rounded-2xl p-6 md:p-8 text-white',
      headingColor: '#ffffff',
      headingGradient: 'from-rose-200 via-pink-100 to-amber-100',
      subtitleColor: '#fff1f2',
      badgeBg: 'linear-gradient(to right, #e11d48, #db2777)',
      badgeTextColor: '#ffffff',
      verifiedBadgeClass: 'bg-slate-950/80 backdrop-blur-md text-rose-300 border border-rose-400/60 font-bold',
      cityBadgeClass: 'bg-slate-950/80 backdrop-blur-md text-pink-300 border border-pink-400/60 font-bold',
      primaryBtnBg: fallbackAccentColor || '#e11d48',
      primaryBtnText: '#ffffff',
      metricsBorderColor: 'border-rose-500/40',
      metricsLabelColor: 'text-rose-200 font-bold',
      metricsValueColor: 'text-rose-300 font-extrabold',
      textShadow: '0 2px 4px rgba(0, 0, 0, 0.85)',
      dropShadowClass: 'drop-shadow-md',
    };
  }
  // 4. Warm Gold / Amber Luxury
  else if (r > b + 30 && r > 120) {
    styling = {
      moodName: 'Warm Gold & Amber Sanctuary',
      isLightImage: false,
      imageFilterClass: 'brightness-105 contrast-105 saturate-110',
      overlayGradientClass: 'bg-gradient-to-t from-slate-950/45 via-transparent to-slate-950/15',
      overlayBlendMode: 'normal',
      overlayAccentColor: 'transparent',
      cardBackingClass: 'backdrop-blur-md bg-slate-950/50 border border-amber-500/40 shadow-2xl rounded-2xl p-6 md:p-8 text-white',
      headingColor: '#ffffff',
      headingGradient: 'from-amber-200 via-yellow-100 to-amber-300',
      subtitleColor: '#fef3c7',
      badgeBg: 'linear-gradient(to right, #d97706, #b45309)',
      badgeTextColor: '#ffffff',
      verifiedBadgeClass: 'bg-slate-950/80 backdrop-blur-md text-amber-300 border border-amber-400/60 font-bold',
      cityBadgeClass: 'bg-slate-950/80 backdrop-blur-md text-yellow-300 border border-yellow-400/60 font-bold',
      primaryBtnBg: fallbackAccentColor || '#d97706',
      primaryBtnText: '#ffffff',
      metricsBorderColor: 'border-amber-500/40',
      metricsLabelColor: 'text-amber-200 font-bold',
      metricsValueColor: 'text-amber-300 font-extrabold',
      textShadow: '0 2px 4px rgba(0, 0, 0, 0.85)',
      dropShadowClass: 'drop-shadow-md',
    };
  }
  // 5. Default / Sleek Dark Noir Barbershop / Modern Salon
  else {
    styling = {
      moodName: 'Sleek Modern Luxury',
      isLightImage: false,
      imageFilterClass: 'brightness-105 contrast-105 saturate-105',
      overlayGradientClass: 'bg-gradient-to-t from-slate-950/45 via-transparent to-slate-950/15',
      overlayBlendMode: 'normal',
      overlayAccentColor: 'transparent',
      cardBackingClass: 'backdrop-blur-md bg-slate-950/50 border border-slate-700/50 shadow-2xl rounded-2xl p-6 md:p-8 text-white',
      headingColor: '#ffffff',
      subtitleColor: '#f1f5f9',
      badgeBg: 'linear-gradient(to right, #1e293b, #0f172a)',
      badgeTextColor: '#ffffff',
      verifiedBadgeClass: 'bg-slate-950/80 backdrop-blur-md text-slate-100 border border-slate-600/60 font-bold',
      cityBadgeClass: 'bg-slate-950/80 backdrop-blur-md text-amber-300 border border-slate-600/60 font-bold',
      primaryBtnBg: fallbackAccentColor || '#38bdf8',
      primaryBtnText: '#ffffff',
      metricsBorderColor: 'border-slate-700/50',
      metricsLabelColor: 'text-slate-200 font-bold',
      metricsValueColor: 'text-emerald-300 font-extrabold',
      textShadow: '0 2px 4px rgba(0, 0, 0, 0.85)',
      dropShadowClass: 'drop-shadow-md',
    };
  }

  moodCache.set(cacheKey, styling);
  return styling;
}

// Async dynamic HTML5 Canvas Pixel Extractor for custom uploaded data URLs / images
export function extractImageMoodAsync(imageUrl: string, fallbackAccent?: string): Promise<HeroAIStyling> {
  return new Promise((resolve) => {
    if (!imageUrl) {
      resolve(computeHeroAIStyling('', fallbackAccent));
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    const timer = setTimeout(() => {
      // Fallback if loading times out
      resolve(computeHeroAIStyling(imageUrl, fallbackAccent));
    }, 600);

    img.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve(computeHeroAIStyling(imageUrl, fallbackAccent));
          return;
        }

        ctx.drawImage(img, 0, 0, 32, 32);
        const imgData = ctx.getImageData(0, 0, 32, 32).data;

        let r = 0, g = 0, b = 0;
        const count = imgData.length / 4;

        for (let i = 0; i < imgData.length; i += 4) {
          r += imgData[i];
          g += imgData[i + 1];
          b += imgData[i + 2];
        }

        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);
        const brightness = Math.round((r * 299 + g * 587 + b * 114) / 1000);

        // Compute tailored styling from sampled canvas pixels
        let styling: HeroAIStyling;

        if (brightness > 175) {
          styling = {
            moodName: 'Daylight Light Canvas',
            isLightImage: true,
            imageFilterClass: 'brightness-105 contrast-105 saturate-105',
            overlayGradientClass: 'bg-gradient-to-t from-slate-950/20 via-transparent to-black/10',
            overlayBlendMode: 'normal',
            overlayAccentColor: 'transparent',
            cardBackingClass: 'backdrop-blur-md bg-white/90 border border-slate-200 shadow-2xl rounded-2xl p-6 md:p-8 text-slate-900',
            headingColor: '#0f172a',
            subtitleColor: '#334155',
            badgeBg: '#0f172a',
            badgeTextColor: '#ffffff',
            verifiedBadgeClass: 'bg-emerald-100 text-emerald-950 border border-emerald-300 font-bold shadow-xs',
            cityBadgeClass: 'bg-amber-100 text-amber-950 border border-amber-300 font-bold shadow-xs',
            primaryBtnBg: fallbackAccent || '#0f172a',
            primaryBtnText: '#ffffff',
            metricsBorderColor: 'border-slate-300',
            metricsLabelColor: 'text-slate-600 font-bold',
            metricsValueColor: 'text-emerald-800 font-extrabold',
            textShadow: 'none',
            dropShadowClass: 'drop-shadow-xs',
          };
        } else if (g > r + 15 && g > b - 10) {
          styling = {
            moodName: 'Botanical Emerald Mood',
            isLightImage: false,
            imageFilterClass: 'brightness-105 contrast-105 saturate-110',
            overlayGradientClass: 'bg-gradient-to-t from-slate-950/45 via-transparent to-slate-950/15',
            overlayBlendMode: 'normal',
            overlayAccentColor: 'transparent',
            cardBackingClass: 'backdrop-blur-md bg-slate-950/50 border border-emerald-500/40 shadow-2xl rounded-2xl p-6 md:p-8 text-white',
            headingColor: '#ffffff',
            headingGradient: 'from-emerald-200 via-teal-100 to-cyan-100',
            subtitleColor: '#ecfeff',
            badgeBg: `rgb(${r}, ${g}, ${b})`,
            badgeTextColor: '#ffffff',
            verifiedBadgeClass: 'bg-slate-950/80 backdrop-blur-md text-emerald-300 border border-emerald-400/60 font-bold',
            cityBadgeClass: 'bg-slate-950/80 backdrop-blur-md text-teal-300 border border-teal-400/60 font-bold',
            primaryBtnBg: fallbackAccent || `rgb(${r}, ${g}, ${b})`,
            primaryBtnText: '#ffffff',
            metricsBorderColor: 'border-emerald-500/40',
            metricsLabelColor: 'text-emerald-200 font-bold',
            metricsValueColor: 'text-emerald-300 font-extrabold',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.85)',
            dropShadowClass: 'drop-shadow-md',
          };
        } else if (r > g + 20 && b > g - 15) {
          styling = {
            moodName: 'Rose Blossom Mood',
            isLightImage: false,
            imageFilterClass: 'brightness-105 contrast-105 saturate-110',
            overlayGradientClass: 'bg-gradient-to-t from-slate-950/45 via-transparent to-slate-950/15',
            overlayBlendMode: 'normal',
            overlayAccentColor: 'transparent',
            cardBackingClass: 'backdrop-blur-md bg-slate-950/50 border border-rose-500/40 shadow-2xl rounded-2xl p-6 md:p-8 text-white',
            headingColor: '#ffffff',
            headingGradient: 'from-rose-200 via-pink-100 to-amber-100',
            subtitleColor: '#fff1f2',
            badgeBg: `rgb(${r}, ${g}, ${b})`,
            badgeTextColor: '#ffffff',
            verifiedBadgeClass: 'bg-slate-950/80 backdrop-blur-md text-rose-300 border border-rose-400/60 font-bold',
            cityBadgeClass: 'bg-slate-950/80 backdrop-blur-md text-pink-300 border border-pink-400/60 font-bold',
            primaryBtnBg: fallbackAccent || `rgb(${r}, ${g}, ${b})`,
            primaryBtnText: '#ffffff',
            metricsBorderColor: 'border-rose-500/40',
            metricsLabelColor: 'text-rose-200 font-bold',
            metricsValueColor: 'text-rose-300 font-extrabold',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.85)',
            dropShadowClass: 'drop-shadow-md',
          };
        } else {
          styling = {
            moodName: 'Rich Warm Gold Mood',
            isLightImage: false,
            imageFilterClass: 'brightness-105 contrast-105 saturate-110',
            overlayGradientClass: 'bg-gradient-to-t from-slate-950/45 via-transparent to-slate-950/15',
            overlayBlendMode: 'normal',
            overlayAccentColor: 'transparent',
            cardBackingClass: 'backdrop-blur-md bg-slate-950/50 border border-amber-500/40 shadow-2xl rounded-2xl p-6 md:p-8 text-white',
            headingColor: '#ffffff',
            headingGradient: 'from-amber-200 via-yellow-100 to-amber-300',
            subtitleColor: '#fef3c7',
            badgeBg: `rgb(${r}, ${g}, ${b})`,
            badgeTextColor: '#ffffff',
            verifiedBadgeClass: 'bg-slate-950/80 backdrop-blur-md text-amber-300 border border-amber-400/60 font-bold',
            cityBadgeClass: 'bg-slate-950/80 backdrop-blur-md text-yellow-300 border border-yellow-400/60 font-bold',
            primaryBtnBg: fallbackAccent || `rgb(${r}, ${g}, ${b})`,
            primaryBtnText: '#ffffff',
            metricsBorderColor: 'border-amber-500/40',
            metricsLabelColor: 'text-amber-200 font-bold',
            metricsValueColor: 'text-amber-300 font-extrabold',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.85)',
            dropShadowClass: 'drop-shadow-md',
          };
        }

        resolve(styling);
      } catch {
        resolve(computeHeroAIStyling(imageUrl, fallbackAccent));
      }
    };

    img.onerror = () => {
      clearTimeout(timer);
      resolve(computeHeroAIStyling(imageUrl, fallbackAccent));
    };

    img.src = imageUrl;
  });
}
