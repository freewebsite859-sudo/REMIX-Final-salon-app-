import { BusinessTypeId } from '../types';

export interface AILogoConcept {
  id: string;
  name: string;
  styleTag: 'Minimal Line Art' | 'Vintage Badge' | 'Modern Typography' | 'Botanical Emblem' | 'Elegant Monogram';
  description: string;
  svgDataUrl: string;
  svgRaw: string;
  primaryColor: string;
}

// Extract clean initials and word parts from salon name
function parseNameParts(salonName: string) {
  const cleanName = (salonName || 'LUXURY SALON').trim();
  const words = cleanName.split(/\s+/).filter(Boolean);
  
  let initials = 'LS';
  if (words.length === 1) {
    initials = words[0].substring(0, 2).toUpperCase();
  } else if (words.length >= 2) {
    initials = (words[0][0] + words[1][0]).toUpperCase();
  }

  const mainWord = words[0]?.toUpperCase() || 'LUXURY';
  const subWord = words.slice(1).join(' ').toUpperCase() || 'STUDIO & SPA';

  return { cleanName, mainWord, subWord, initials };
}

// Get category-specific vector icon path
function getCategoryIconSvg(categoryKey: BusinessTypeId, color: string): string {
  switch (categoryKey) {
    case 'nail_studio':
      return `<path d="M12 2C8.5 2 6 4.5 6 8v8c0 3.5 2.5 6 6 6s6-2.5 6-6V8c0-3.5-2.5-6-6-6zm0 2c2.2 0 4 1.8 4 4v3H8V8c0-2.2 1.8-4 4-4z" fill="${color}"/>
              <circle cx="12" cy="7" r="1.5" fill="#ffffff" opacity="0.8"/>
              <path d="M12 12l1 2h2l-1.5 1.5.5 2-2-1-2 1 .5-2L8.5 14H11z" fill="${color}" opacity="0.9"/>`;
    case 'nails_lash_brow_bar':
      return `<rect x="10" y="2" width="4" height="5" rx="1" fill="${color}"/>
              <path d="M9 9h6v10a3 3 0 01-3 3 3 3 0 01-3-3V9z" fill="${color}"/>
              <path d="M17 4l1.2-1.2M18.5 6.5H20.5M17 9l1.2 1.2" stroke="${color}" stroke-width="1.5" stroke-linecap="round" opacity="0.7"/>`;
    case 'barber':
    case 'barber_grooming_club':
      return `<path d="M6 3l12 12M18 3L6 15M12 9a2 2 0 100-4 2 2 0 000 4z" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
              <circle cx="6" cy="18" r="3" stroke="${color}" stroke-width="2" fill="none"/>
              <circle cx="18" cy="18" r="3" stroke="${color}" stroke-width="2" fill="none"/>`;
    case 'lash_brow':
      return `<path d="M3 14c4-6 14-6 18 0M6 11l-2-3M10 9L9 5M14 9l1-4M18 11l2-3" stroke="${color}" stroke-width="2" stroke-linecap="round"/>`;
    case 'medispa_aesthetics':
      return `<circle cx="12" cy="12" r="9" stroke="${color}" stroke-width="2" fill="none"/>
              <path d="M6.5 12h2.5l1.5-3.5 2 7 1.5-3.5h3.5" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
    case 'organic_bio_salon':
      return `<path d="M12 22V11" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
              <path d="M12 11C7 11 5 8 5 4c4.5 0 7 3 7 7z" fill="${color}"/>
              <path d="M12 13c0-4.5 3-7 7.5-7 0 4.5-3 7-7.5 7z" fill="${color}" opacity="0.75"/>`;
    case 'express_beauty_bar':
      return `<path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" fill="${color}"/>`;
    case 'thai_massage_center':
      return `<path d="M12 3c1.8 2.4 2.7 4.8 2.7 7.2 0 2.7-1.2 4.8-2.7 6-1.5-1.2-2.7-3.3-2.7-6C9.3 7.8 10.2 5.4 12 3z" fill="${color}"/>
              <path d="M4 9c2.5.4 4.4 1.6 5.6 3.4-1.3 1.8-2.4 3.2-4 3.8C4.4 14.6 3.8 12 4 9z" fill="${color}" opacity="0.8"/>
              <path d="M20 9c-2.5.4-4.4 1.6-5.6 3.4 1.3 1.8 2.4 3.2 4 3.8 1.2-1.6 1.8-4.2 1.6-8.2z" fill="${color}" opacity="0.8"/>
              <path d="M5 17c2 2 4.5 3 7 3s5-1 7-3" stroke="${color}" stroke-width="1.8" stroke-linecap="round" fill="none"/>`;
    case 'kids_teens_studio':
      return `<path d="M7 5a3 3 0 100 6 3 3 0 000-6zm0 2a1 1 0 110 2 1 1 0 010-2zM17 5a3 3 0 100 6 3 3 0 000-6zm0 2a1 1 0 110 2 1 1 0 010-2zM12 10l-4 8M12 10l4 8" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
              <path d="M20.5 15l.8 1.6 1.8.3-1.3 1.3.3 1.8-1.6-.8-1.6.8.3-1.8-1.3-1.3 1.8-.3z" fill="${color}" opacity="0.85"/>`;
    case 'resort_spa':
      return `<circle cx="12" cy="9" r="4" fill="${color}"/>
              <path d="M12 1.5v2M5.6 3.5l1.4 1.4M18.4 3.5L17 4.9M2 9h2M20 9h2" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>
              <path d="M3 16c2.2-1.6 4.8-1.6 7 0s4.8 1.6 7 0" stroke="${color}" stroke-width="2" stroke-linecap="round" fill="none"/>
              <path d="M4 20c2-1.4 4.3-1.4 6.3 0s4.4 1.4 6.4 0 2-1 2-1" stroke="${color}" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.7"/>`;
    case 'vedic_ayurveda_studio':
      return `<path d="M12 2c3.2 4.2 6 7.6 6 11a6 6 0 01-12 0c0-3.4 2.8-6.8 6-11z" fill="${color}"/>
              <path d="M9.5 13c0-1.8.8-3.4 2.5-5 1.7 1.6 2.5 3.2 2.5 5a2.5 2.5 0 01-5 0z" fill="#ffffff" opacity="0.85"/>
              <path d="M12 8v10" stroke="${color}" stroke-width="1.2" stroke-linecap="round"/>`;
    case 'bridal_makeover_studio':
      return `<path d="M9 4l3-3 3 3-3 3z" fill="${color}"/>
              <circle cx="12" cy="13" r="7" stroke="${color}" stroke-width="2" fill="none"/>
              <path d="M8.5 13a3.5 3.5 0 007 0" stroke="${color}" stroke-width="1.5" fill="none" opacity="0.6"/>`;
    case 'ayurvedic_spa':
    case 'ayurvedic_wellness_spa':
    case 'massage_wellness':
    case 'hair_spa':
      return `<path d="M12 2c0 5-4 9-9 9 5 0 9 4 9 9 0-5 4-9 9-9-5 0-9-4-9-9z" fill="${color}"/>`;
    default:
      // Hair / Beauty Scissors & Sparkle
      return `<path d="M7 5a3 3 0 100 6 3 3 0 000-6zm0 2a1 1 0 110 2 1 1 0 010-2zM17 5a3 3 0 100 6 3 3 0 000-6zm0 2a1 1 0 110 2 1 1 0 010-2zM12 10l-4 8M12 10l4 8" stroke="${color}" stroke-width="2" stroke-linecap="round"/>`;
  }
}

function svgToDataUrl(svgString: string): string {
  // Clean newlines and quotes safely
  const cleaned = svgString.replace(/\n/g, ' ').replace(/\s+/g, ' ');
  return `data:image/svg+xml;utf8,${encodeURIComponent(cleaned)}`;
}

export function generateAILogoSuite(
  salonName: string,
  categoryKey: BusinessTypeId = 'hair_salon',
  primaryColor: string = '#0f172a'
): AILogoConcept[] {
  const { cleanName, mainWord, subWord, initials } = parseNameParts(salonName);
  const color = primaryColor || '#0f172a';
  const categoryIcon = getCategoryIconSvg(categoryKey, color);

  // 1. Minimal Line Art
  const rawSvg1 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 100" width="320" height="100">
    <rect width="320" height="100" rx="16" fill="#ffffff"/>
    <g transform="translate(20, 20)">
      <rect x="0" y="0" width="60" height="60" rx="14" fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="2 2"/>
      <rect x="5" y="5" width="50" height="50" rx="10" fill="${color}" fill-opacity="0.08"/>
      <g transform="translate(18, 18) scale(1.1)">
        ${categoryIcon}
      </g>
    </g>
    <text x="96" y="45" font-family="'Playfair Display', 'Georgia', serif" font-size="20" font-weight="700" fill="${color}" letter-spacing="1">
      ${cleanName.length > 18 ? cleanName.substring(0, 18) + '...' : cleanName}
    </text>
    <text x="96" y="65" font-family="'Plus Jakarta Sans', sans-serif" font-size="10" font-weight="600" fill="${color}" opacity="0.65" letter-spacing="3">
      EST. SANCTUARY • ARTISAN STUDIO
    </text>
    <line x1="96" y1="74" x2="290" y2="74" stroke="${color}" stroke-width="1" opacity="0.2"/>
  </svg>`;

  // 2. Vintage Badge
  const rawSvg2 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 100" width="320" height="100">
    <rect width="320" height="100" rx="16" fill="#fdfbf7"/>
    <g transform="translate(15, 10)">
      <circle cx="40" cy="40" r="36" fill="none" stroke="${color}" stroke-width="2"/>
      <circle cx="40" cy="40" r="32" fill="none" stroke="${color}" stroke-width="0.8" stroke-dasharray="3 2"/>
      <circle cx="40" cy="40" r="28" fill="${color}" fill-opacity="0.05"/>
      <g transform="translate(28, 28) scale(0.9)">
        ${categoryIcon}
      </g>
      <text x="40" y="20" font-family="sans-serif" font-size="6" font-weight="800" fill="${color}" text-anchor="middle" letter-spacing="1">★ ★ ★</text>
      <text x="40" y="68" font-family="sans-serif" font-size="6" font-weight="700" fill="${color}" text-anchor="middle" letter-spacing="1.5">EST. 2026</text>
    </g>
    <text x="102" y="42" font-family="'Cinzel', 'Times New Roman', serif" font-size="18" font-weight="800" fill="${color}" letter-spacing="1.5">
      ${mainWord}
    </text>
    <path d="M102 48 h180" stroke="${color}" stroke-width="1.5" opacity="0.3"/>
    <text x="102" y="64" font-family="'Plus Jakarta Sans', sans-serif" font-size="9" font-weight="700" fill="${color}" opacity="0.8" letter-spacing="2.5">
      ${subWord || 'CRAFTSMANSHIP & CARE'}
    </text>
  </svg>`;

  // 3. Modern Typography
  const rawSvg3 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 100" width="320" height="100">
    <rect width="320" height="100" rx="16" fill="#0f172a"/>
    <g transform="translate(24, 25)">
      <path d="M0 0 L24 0 L32 25 L8 25 Z" fill="${color}"/>
      <circle cx="16" cy="12.5" r="4" fill="#ffffff"/>
    </g>
    <text x="68" y="44" font-family="'Montserrat', 'Helvetica', sans-serif" font-size="21" font-weight="900" fill="#ffffff" letter-spacing="2">
      ${mainWord}
    </text>
    <text x="68" y="64" font-family="'Plus Jakarta Sans', sans-serif" font-size="10" font-weight="600" fill="#38bdf8" letter-spacing="4">
      ${subWord || 'LUXURY EXPERIENCE'}
    </text>
    <circle cx="300" cy="50" r="3" fill="#38bdf8"/>
  </svg>`;

  // 4. Botanical / Floral Emblem
  const rawSvg4 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 100" width="320" height="100">
    <rect width="320" height="100" rx="16" fill="#fcf7f8"/>
    <g transform="translate(20, 15)">
      <!-- Wreath Leaves -->
      <path d="M35 10 C 20 20, 10 35, 10 50 C 10 65, 20 80, 35 90" fill="none" stroke="${color}" stroke-width="1.5"/>
      <path d="M35 10 C 50 20, 60 35, 60 50 C 60 65, 50 80, 35 90" fill="none" stroke="${color}" stroke-width="1.5"/>
      <circle cx="35" cy="50" r="18" fill="${color}" opacity="0.1"/>
      <text x="35" y="55" font-family="'Playfair Display', serif" font-size="14" font-weight="700" fill="${color}" text-anchor="middle">
        ${initials}
      </text>
    </g>
    <text x="96" y="44" font-family="'Cormorant Garamond', 'Georgia', serif" font-size="20" font-weight="700" fill="${color}">
      ${cleanName}
    </text>
    <text x="96" y="63" font-family="'Plus Jakarta Sans', sans-serif" font-size="9" font-weight="500" fill="${color}" opacity="0.7" letter-spacing="2">
      🌿 BOTANICAL & ORGANIC ESSENCE
    </text>
  </svg>`;

  // 5. Elegant Monogram
  const rawSvg5 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 100" width="320" height="100">
    <rect width="320" height="100" rx="16" fill="#181820"/>
    <g transform="translate(20, 18)">
      <polygon points="35,5 65,20 65,60 35,75 5,60 5,20" fill="none" stroke="#f59e0b" stroke-width="2"/>
      <polygon points="35,10 60,23 60,57 35,70 10,57 10,23" fill="#f59e0b" fill-opacity="0.1"/>
      <text x="35" y="47" font-family="'Cinzel', 'Times New Roman', serif" font-size="18" font-weight="900" fill="#f59e0b" text-anchor="middle" letter-spacing="1">
        ${initials}
      </text>
    </g>
    <text x="96" y="44" font-family="'Cinzel', 'Playfair Display', serif" font-size="20" font-weight="700" fill="#ffffff" letter-spacing="1">
      ${cleanName}
    </text>
    <text x="96" y="64" font-family="'Plus Jakarta Sans', sans-serif" font-size="10" font-weight="700" fill="#f59e0b" letter-spacing="3">
      ROYAL MONOGRAM COLLECTION
    </text>
  </svg>`;

  return [
    {
      id: 'logo-concept-1',
      name: 'Minimal Line Art Concept',
      styleTag: 'Minimal Line Art',
      description: 'Clean geometric vector contour with delicate category icon & modern tracking.',
      svgRaw: rawSvg1,
      svgDataUrl: svgToDataUrl(rawSvg1),
      primaryColor: color
    },
    {
      id: 'logo-concept-2',
      name: 'Vintage Circular Badge',
      styleTag: 'Vintage Badge',
      description: 'Classic double-ring emblem with established year & high-fashion serif typography.',
      svgRaw: rawSvg2,
      svgDataUrl: svgToDataUrl(rawSvg2),
      primaryColor: color
    },
    {
      id: 'logo-concept-3',
      name: 'Modern Luxury Typographic Mark',
      styleTag: 'Modern Typography',
      description: 'Bold ultra-sleek header typography with vibrant accent lines for contemporary salons.',
      svgRaw: rawSvg3,
      svgDataUrl: svgToDataUrl(rawSvg3),
      primaryColor: color
    },
    {
      id: 'logo-concept-4',
      name: 'Botanical Leaf & Wreath Emblem',
      styleTag: 'Botanical Emblem',
      description: 'Organic leaf wreath enclosing brand initials with soft, elegant serif details.',
      svgRaw: rawSvg4,
      svgDataUrl: svgToDataUrl(rawSvg4),
      primaryColor: color
    },
    {
      id: 'logo-concept-5',
      name: 'Royal Monogram Shield',
      styleTag: 'Elegant Monogram',
      description: 'Gold-accented geometric crest badge featuring interlocking salon initials.',
      svgRaw: rawSvg5,
      svgDataUrl: svgToDataUrl(rawSvg5),
      primaryColor: color
    }
  ];
}
