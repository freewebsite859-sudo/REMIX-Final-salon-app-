import { CategoryTemplateConfig, BusinessTypeOption } from './types';
import { SALON_IMAGES } from './assets/images';

export const CATEGORY_TEMPLATES: Record<string, CategoryTemplateConfig> = {
  // 1. Hair Cut & Styling Studio
  hair_salon: {
    id: 'hair_salon',
    title: 'Arts By Uma',
    shortName: 'Hair & Styling Studio',
    tagline: 'Precision Cuts, Creative Hair Artistry & Luxury Nail Lounge',
    about: 'Welcome to Arts By Uma. Founded by Uma, our boutique studio brings together master precision haircuts, bespoke balayage, sculpted gel nail art, and restorative hair spa therapies in a luxury sanctuary.',
    icon: 'content_cut',
    layoutStyle: 'modern_minimalist',
    paletteLabel: 'Slate & Silver Theme',
    themePreset: 'slate_silver',
    subCategories: ['Hair Artistry', 'Color Alchemy', 'Treatments', 'Nail Couture'],
    defaultCity: 'Bengaluru, Karnataka',
    defaultAddress: '100 Feet Road, 12th Main, Indiranagar',
    defaultPostalCode: '560038',
    phone: '+91 98450 77654',
    whatsapp: '+91 98450 77654',
    ownerName: 'Uma',
    ownerRole: 'Founder & Master Stylist',
    ownerPhotoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=500&q=80',
    coverImageUrl: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=80',
    instagramHandle: '@arts_by_uma',
    themeStyle: {
      heroBackground: 'bg-[#0f172a]',
      heroTextColor: 'text-slate-100',
      cardBorder: 'border-slate-300',
      cardBackground: 'bg-white',
      cardRadius: 'rounded-none',
      accentColor: 'text-slate-900',
      accentBg: 'bg-slate-900',
      badgeBg: 'bg-slate-100',
      badgeText: 'text-slate-800',
      buttonBg: 'bg-slate-900 hover:bg-slate-800',
      buttonText: 'text-white',
      priceColor: 'text-slate-900',
      isDark: false,
      headerBanner: 'border-b-2 border-slate-900 bg-slate-50'
    },
    services: [
      {
        id: 'hs-1',
        name: 'Master Stylist Precision Cut & Blowdry',
        category: 'Precision Cuts',
        durationMinutes: 45,
        price: 750,
        description: 'Sculpted haircut tailored to face geometry, invigorating scalp wash, and professional salon blowout.',
        icon: 'content_cut',
        popular: true
      },
      {
        id: 'hs-2',
        name: 'Classic Layered Cut & Argan Wash',
        category: 'Precision Cuts',
        durationMinutes: 35,
        price: 450,
        description: 'Texturizing layers, split-end removal, deep cleanse with Moroccan argan oil shampoo.',
        icon: 'styler'
      },
      {
        id: 'hs-3',
        name: 'Formaldehyde-Free Keratin Smoothing',
        category: 'Keratin & Botox',
        durationMinutes: 120,
        price: 4200,
        description: 'Infuses active keratin proteins, eliminating 95% frizz with mirror-like shine for up to 14 weeks.',
        icon: 'auto_fix_high',
        popular: true
      },
      {
        id: 'hs-4',
        name: 'Hair Botox Deep Fiber Reconstruction',
        category: 'Keratin & Botox',
        durationMinutes: 90,
        price: 3600,
        description: 'Intense peptide filler mask for chemically damaged or heat-stressed hair fibers.',
        icon: 'healing'
      },
      {
        id: 'hs-5',
        name: 'Red-Carpet Tong Curls & High-Volume Waves',
        category: 'Thermal Styling',
        durationMinutes: 40,
        price: 850,
        description: 'GHD ceramic iron styling with anti-humidity thermal protectant for party & cocktail evenings.',
        icon: 'waves'
      }
    ],
    stylists: [
      {
        id: 'hs-st-1',
        name: 'Ananya Sharma',
        role: 'Creative Director',
        avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
        specialties: ['Structural Bobs', 'Precision Fringes', 'Keratin Smoothing'],
        rating: 4.97
      },
      {
        id: 'hs-st-2',
        name: 'Rohan Kapoor',
        role: 'Senior Precision Stylist',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
        specialties: ['Dry Cutting', 'Men & Women Styling', 'Volume Blowouts'],
        rating: 4.92
      },
      {
        id: 'hs-st-3',
        name: 'Kavita Deshmukh',
        role: 'Hair Texture & Scalp Specialist',
        avatarUrl: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?auto=format&fit=crop&w=400&q=80',
        specialties: ['Hair Botox', 'Scalp Analysis', 'Thermal Tongs'],
        rating: 4.89
      }
    ]
  },

  // 2. Barber Shop / Men's Grooming
  barber: {
    id: 'barber',
    title: "The Royal Blade Barber & Men's Club",
    shortName: "Barber Shop / Men's Grooming",
    tagline: 'Vintage Heritage Shaves, Bespoke Fades & Handcrafted Beard Sculpting',
    about: 'Situated on Bandra’s iconic 33rd Road, The Royal Blade revives the timeless charm of Victorian barbershops infused with vintage mahogany, genuine brass fittings, and old-school hot towel straight razor mastery.',
    icon: 'content_cut',
    layoutStyle: 'vintage_industrial',
    paletteLabel: 'Dark Wood & Brass Theme',
    themePreset: 'vintage_brass',
    subCategories: ['Executive Cuts', 'Beard Sculpting', 'Hot Towel Shaves', 'Maharaja Packages'],
    defaultCity: 'Mumbai, Maharashtra',
    defaultAddress: '33rd Road, Off Linking Road, Bandra West',
    defaultPostalCode: '400050',
    phone: '+91 98200 45671',
    whatsapp: '+91 98200 45671',
    ownerName: 'Vikram Malhotra',
    ownerRole: 'Master Barber & Razor Craftsman',
    ownerPhotoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=500&q=80',
    coverImageUrl: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1200&q=80',
    instagramHandle: '@royalblade.bandra',
    themeStyle: {
      heroBackground: 'bg-[#18110b]',
      heroTextColor: 'text-[#f5e6d3]',
      cardBorder: 'border-[#c59b27]/40',
      cardBackground: 'bg-[#211711]',
      cardRadius: 'rounded-lg',
      accentColor: 'text-[#d4af37]',
      accentBg: 'bg-[#c59b27]',
      badgeBg: 'bg-[#3b2a1e]',
      badgeText: 'text-[#f3d99e]',
      buttonBg: 'bg-[#c59b27] hover:bg-[#b58b1d]',
      buttonText: 'text-[#18110b]',
      priceColor: 'text-[#e5c068]',
      isDark: true,
      headerBanner: 'bg-[#140d07] border-b border-[#c59b27]/30'
    },
    services: [
      {
        id: 'bb-1',
        name: 'Executive Scissor Cut & Charcoal Hair Wash',
        category: 'Executive Cuts',
        durationMinutes: 40,
        price: 450,
        description: 'Tailored fade or gentleman taper, tea-tree scalp rinse, and matte pomade finish.',
        icon: 'content_cut',
        popular: true
      },
      {
        id: 'bb-2',
        name: 'Signature Hot Towel Straight Razor Shave',
        category: 'Hot Towel Shaves',
        durationMinutes: 30,
        price: 350,
        description: 'Eucalyptus pre-shave oil, badger brush warm lather, feather-edge razor shave, and cold stone alum splash.',
        icon: 'face'
      },
      {
        id: 'bb-3',
        name: 'Precision Beard Sculpting & Ozone Steam',
        category: 'Beard Sculpting',
        durationMinutes: 35,
        price: 400,
        description: 'Sharp cheek line outlining, bulk graduation, steam softening, and organic cedarwood beard butter massage.',
        icon: 'cleaning_services',
        popular: true
      },
      {
        id: 'bb-4',
        name: 'The Royal Maharaja Grooming Ritual',
        category: 'Maharaja Packages',
        durationMinutes: 75,
        price: 1350,
        description: 'Full haircut, hot lather straight shave, charcoal blackhead face scrub, neck & shoulder acupressure.',
        icon: 'workspace_premium',
        popular: true
      },
      {
        id: 'bb-5',
        name: 'Grey Camo Beard Toning & Mustache Wax',
        category: 'Beard Sculpting',
        durationMinutes: 30,
        price: 550,
        description: 'Natural subtle grey blending for beards with premium Hungarian mustache wax shape.',
        icon: 'brush'
      }
    ],
    stylists: [
      {
        id: 'bb-st-1',
        name: 'Vikram Malhotra',
        role: 'Master Barber & Proprietor',
        avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
        specialties: ['Straight Razor Shaves', 'Skin Fades', 'Royal Grooming'],
        rating: 4.98
      },
      {
        id: 'bb-st-2',
        name: 'Rajesh Verma',
        role: 'Senior Beard Artisan',
        avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&q=80',
        specialties: ['Beard Geometry', 'Ozone Steam Facials', 'Tapers'],
        rating: 4.93
      },
      {
        id: 'bb-st-3',
        name: 'Kabir Khan',
        role: 'Modern Fade Specialist',
        avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80',
        specialties: ['Low/Mid Fades', 'Textured Crops', 'Scissor Work'],
        rating: 4.88
      }
    ]
  },

  // 3. Unisex Salon
  unisex_salon: {
    id: 'unisex_salon',
    title: 'Aura Unisex Salon & Wellness Lounge',
    shortName: 'Unisex Salon',
    tagline: 'Harmonious Beauty, Contemporary Hair & Inclusive Self-Care',
    about: 'Aura Unisex Salon offers a balanced, contemporary space in Koramangala. Designed for modern professionals and families seeking premium hair services, de-tan treatments, and express grooming under one roof.',
    icon: 'diversity_3',
    layoutStyle: 'contemporary_balanced',
    paletteLabel: 'Warm Neutral & Pastel Pink/Grey',
    themePreset: 'pastel_blush',
    subCategories: ['Unisex Haircuts', 'Botanical Color', 'Skin Cleanups', 'Hands & Feet Care'],
    defaultCity: 'Bengaluru, Karnataka',
    defaultAddress: 'Outer Ring Road, 4th Block, Koramangala',
    defaultPostalCode: '560095',
    phone: '+91 98455 33210',
    whatsapp: '+91 98455 33210',
    ownerName: 'Priya Nair',
    ownerRole: 'Executive Salon Director',
    ownerPhotoUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=500&q=80',
    coverImageUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=80',
    instagramHandle: '@aurasalon.blr',
    themeStyle: {
      heroBackground: 'bg-[#fff5f5]',
      heroTextColor: 'text-gray-900',
      cardBorder: 'border-pink-200',
      cardBackground: 'bg-white',
      cardRadius: 'rounded-xl',
      accentColor: 'text-[#be185d]',
      accentBg: 'bg-[#be185d]',
      badgeBg: 'bg-rose-100',
      badgeText: 'text-rose-950 font-bold',
      buttonBg: 'bg-[#be185d] hover:bg-[#9f1239]',
      buttonText: 'text-white font-bold',
      priceColor: 'text-[#9f1239] font-extrabold',
      isDark: false,
      headerBanner: 'bg-[#fff8f8] border-b border-pink-100'
    },
    services: [
      {
        id: 'us-1',
        name: 'Designer Unisex Haircut & Moroccan Conditioning',
        category: 'Unisex Haircuts',
        durationMinutes: 45,
        price: 650,
        description: 'Consultation, scalp revitalizer wash, tailored cut, and heat-protective styling.',
        icon: 'content_cut',
        popular: true
      },
      {
        id: 'us-2',
        name: 'Express Glow Organic Cleanup & De-Tan',
        category: 'Skin Cleanups',
        durationMinutes: 40,
        price: 850,
        description: 'Gentle fruit peel scrub, pore steam, blackhead removal, and saffron brightening mask.',
        icon: 'face',
        popular: true
      },
      {
        id: 'us-3',
        name: 'Global Ammonia-Free Inoa Hair Color',
        category: 'Botanical Color',
        durationMinutes: 90,
        price: 2800,
        description: 'L’Oréal Inoa oil-based color with 100% white hair coverage and zero scalp stinging.',
        icon: 'brush'
      },
      {
        id: 'us-4',
        name: 'Deluxe Paraffin Spa Pedicure',
        category: 'Hands & Feet Care',
        durationMinutes: 50,
        price: 850,
        description: 'Dead sea salt soak, heel filing, warm paraffin dip, and tension-relief foot massage.',
        icon: 'pan_tool'
      },
      {
        id: 'us-5',
        name: 'Olaplex No. 1 & 2 Molecular Bond Repair',
        category: 'Botanical Color',
        durationMinutes: 45,
        price: 1650,
        description: 'Rebuilds broken disulphide bonds caused by chemical processing and pollution.',
        icon: 'auto_awesome'
      }
    ],
    stylists: [
      {
        id: 'us-st-1',
        name: 'Priya Nair',
        role: 'Salon Director & Colorist',
        avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80',
        specialties: ['Inoa Color', 'De-Tan Cleanups', 'Unisex Cuts'],
        rating: 4.95
      },
      {
        id: 'us-st-2',
        name: 'Arjun Mehra',
        role: 'Senior Styling Director',
        avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80',
        specialties: ['Layered Blowouts', 'Beard & Hair Combos'],
        rating: 4.91
      },
      {
        id: 'us-st-3',
        name: 'Saniya Sheikh',
        role: 'Skin & Nail Aesthetician',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
        specialties: ['Paraffin Pedicures', 'Organic Facials'],
        rating: 4.89
      }
    ]
  },

  // 4. Beauty Parlour
  beauty_parlour: {
    id: 'beauty_parlour',
    title: 'Roop Mahal Beauty Parlour & Makeover Space',
    shortName: 'Beauty Parlour',
    tagline: 'Timeless Indian Beauty, Herbal Facials, Threading & Radiance Care',
    about: 'Serving patrons for over 18 years in Connaught Place, Roop Mahal blends classic Indian herbal beauty secrets like turmeric, saffron, and sandalwood with modern waxing and gold facials.',
    icon: 'brush',
    layoutStyle: 'curved_elegant',
    paletteLabel: 'Rose Gold & Ivory Theme',
    themePreset: 'rose_gold_ivory',
    subCategories: ['Threading & Waxing', 'Herbal Facials', 'D-Tan & Bleach', 'Festive Glow Combos'],
    defaultCity: 'New Delhi',
    defaultAddress: 'Inner Circle, Block E, Connaught Place',
    defaultPostalCode: '110001',
    phone: '+91 98110 99882',
    whatsapp: '+91 98110 99882',
    ownerName: 'Sunita Agarwal',
    ownerRole: 'Founder & Herbal Beauty Master',
    ownerPhotoUrl: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=500&q=80',
    coverImageUrl: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=1200&q=80',
    instagramHandle: '@roopmahal.delhi',
    themeStyle: {
      heroBackground: 'bg-[#fffaf6]',
      heroTextColor: 'text-gray-900',
      cardBorder: 'border-[#f2d5cf]',
      cardBackground: 'bg-[#ffffff]',
      cardRadius: 'rounded-3xl',
      accentColor: 'text-[#b76e79]',
      accentBg: 'bg-[#b76e79]',
      badgeBg: 'bg-[#faebe8]',
      badgeText: 'text-[#8a424d]',
      buttonBg: 'bg-[#b76e79] hover:bg-[#a65d68]',
      buttonText: 'text-white',
      priceColor: 'text-[#9c4c58]',
      isDark: false,
      headerBanner: 'bg-[#fff6f3] border-b border-[#f0cec6]'
    },
    services: [
      {
        id: 'bp-1',
        name: 'Full Face Organic Threading & Brow Shaping',
        category: 'Threading & Waxing',
        durationMinutes: 25,
        price: 250,
        description: 'Gentle cotton thread shaping for upper lip, chin, forehead with soothing rose water mist.',
        icon: 'content_cut',
        popular: true
      },
      {
        id: 'bp-2',
        name: 'Shahnaz Husain 24K Gold Glow Facial',
        category: 'Herbal Facials',
        durationMinutes: 60,
        price: 1450,
        description: 'Authentic 24k gold leaf serum, lymphatic face massage, and radiant brightening peel-off mask.',
        icon: 'spa',
        popular: true
      },
      {
        id: 'bp-3',
        name: 'Rica White Chocolate Full Body Waxing',
        category: 'Threading & Waxing',
        durationMinutes: 75,
        price: 1550,
        description: 'Colophony-free Italian wax, painless hair removal, and post-wax soothing chamomile lotion.',
        icon: 'clean_hands'
      },
      {
        id: 'bp-4',
        name: 'O3+ Ayurvedic D-Tan Brightening Pack',
        category: 'D-Tan & Bleach',
        durationMinutes: 30,
        price: 600,
        description: 'Instant tan removal formula with eucalyptus and mint extracts for sun-damaged skin.',
        icon: 'flare'
      },
      {
        id: 'bp-5',
        name: 'Karva Chauth & Diwali Shringaar Combo',
        category: 'Festive Glow Combos',
        durationMinutes: 90,
        price: 2100,
        description: 'Gold facial, full arms Rica waxing, threading, and express festive party blowout.',
        icon: 'celebration',
        popular: true
      }
    ],
    stylists: [
      {
        id: 'bp-st-1',
        name: 'Sunita Agarwal',
        role: 'Master Aesthetician',
        avatarUrl: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=400&q=80',
        specialties: ['Gold Facials', 'Threading', 'Herbal Recipes'],
        rating: 4.96
      },
      {
        id: 'bp-st-2',
        name: 'Meenakshi Joshi',
        role: 'Senior Skin Therapist',
        avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
        specialties: ['Rica Waxing', 'Anti-Tan Peels'],
        rating: 4.92
      },
      {
        id: 'bp-st-3',
        name: 'Pooja Sundaram',
        role: 'Threading & Henna Expert',
        avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
        specialties: ['Eyebrow Arching', 'Festive Combos'],
        rating: 4.87
      }
    ]
  },

  // 5. Nail Studio
  nail_studio: {
    id: 'nail_studio',
    title: 'Pinky Nails Studio',
    shortName: 'Nail & Lash Studio',
    tagline: 'Glossy Chrome Gel Nails, Sculpted Extensions, Lash Lifts & Laminated Brows',
    about: 'Located in posh Jubilee Hills, Pinky Nails Studio is a boutique sanctuary for high-definition nail art, lash extensions, and brow lamination. We combine sterilized medical-grade tools, 9-free toxin-safe gel polishes, and custom aesthetic designs in a serene luxury studio.',
    icon: 'pan_tool_alt',
    layoutStyle: 'bento_grid',
    paletteLabel: 'Chic Pink & Dark Rose Luxury Theme',
    themePreset: 'neon_gloss_bento',
    subCategories: ['Gel Extensions', 'Lash & Brow', 'Handpainted Art', 'Russian Manicure', 'Chrome & Glaze'],
    defaultCity: 'Hyderabad, Telangana',
    defaultAddress: 'Road No. 36, Near Peddamma Temple, Jubilee Hills',
    defaultPostalCode: '500033',
    phone: '+91 98490 77654',
    whatsapp: '+91 98490 77654',
    ownerName: 'Aanya Sen',
    ownerRole: 'Celebrity Nail Designer & Lash Artist',
    ownerPhotoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=500&q=80',
    coverImageUrl: SALON_IMAGES.hero,
    instagramHandle: '@pinkynails.studio',
    themeStyle: {
      heroBackground: 'bg-[#faf5ff]',
      heroTextColor: 'text-purple-950',
      cardBorder: 'border-purple-200',
      cardBackground: 'bg-white',
      cardRadius: 'rounded-2xl',
      accentColor: 'text-purple-800',
      accentBg: 'bg-gradient-to-r from-purple-700 to-pink-600',
      badgeBg: 'bg-purple-100',
      badgeText: 'text-purple-950 font-bold',
      buttonBg: 'bg-gradient-to-r from-purple-700 to-pink-600 hover:opacity-95',
      buttonText: 'text-white font-bold',
      priceColor: 'text-purple-900 font-extrabold',
      isDark: false,
      headerBanner: 'bg-gradient-to-r from-purple-50 via-pink-50 to-purple-50 border-b border-purple-100'
    },
    services: [
      {
        id: 'ns-1',
        name: 'Full Set Gel-X Sculpted Extensions',
        category: 'Gel Extensions',
        durationMinutes: 90,
        price: 2400,
        description: 'Damage-free soft gel tips custom fitted to your natural nail bed with glossy UV seal.',
        icon: 'pan_tool_alt',
        popular: true
      },
      {
        id: 'ns-2',
        name: 'Russian Dry Cuticle Precision Manicure',
        category: 'Russian Manicure',
        durationMinutes: 60,
        price: 1100,
        description: 'E-file precision diamond bit cuticle cleanup, keratin basecoat, and high-shine gel polish.',
        icon: 'auto_awesome',
        popular: true
      },
      {
        id: 'ns-3',
        name: '10-Finger 3D Handpainted & Chrome Art',
        category: 'Handpainted Art',
        durationMinutes: 60,
        price: 1500,
        description: 'Custom micro-art, metallic chrome powder, pearl drops, and encapsulated glitter flakes.',
        icon: 'palette'
      },
      {
        id: 'ns-4',
        name: 'Hailey Glazed Donut Pearlescent Finish',
        category: 'Chrome & Glaze',
        durationMinutes: 45,
        price: 1600,
        description: 'Milky sheer nude base topped with ultra-fine iridescent white chrome powder.',
        icon: 'flare',
        popular: true
      },
      {
        id: 'ns-5',
        name: 'Luxury Rose Petal & Champagne Spa Pedicure',
        category: 'Russian Manicure',
        durationMinutes: 50,
        price: 1350,
        description: 'Warm bubbling floral foot soak, volcanic pumice scrub, and cooling mint gel massage.',
        icon: 'spa'
      }
    ],
    stylists: [
      {
        id: 'ns-st-1',
        name: 'Aanya Sen',
        role: 'Master Nail Artist',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
        specialties: ['Gel-X Extensions', 'Hailey Chrome', '3D Jelly Art'],
        rating: 4.99
      },
      {
        id: 'ns-st-2',
        name: "Rhea D'Souza",
        role: 'Russian Manicurist',
        avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
        specialties: ['E-file Cuticles', 'Ombre Nails'],
        rating: 4.94
      },
      {
        id: 'ns-st-3',
        name: 'Kritika Bose',
        role: 'Creative Nail Stylist',
        avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
        specialties: ['French Tips', 'Glitter Encapsulation'],
        rating: 4.90
      }
    ]
  },

  // 6. Hair Spa & Treatment
  hair_spa: {
    id: 'hair_spa',
    title: 'Kesh Prakriti Hair Spa & Scalp Sanctuary',
    shortName: 'Hair Spa & Treatment',
    tagline: 'Deep Zen Head Spa, Micro-Mist Scalp Detox & Botanical Revitalization',
    about: 'Nestled in quiet Alwarpet, Chennai, Kesh Prakriti specializes in trichology-backed scalp rejuvenation. Using Japanese ultrasonic mist and traditional Indian medicinal herbs, we reverse scalp stress, hair thinning, and urban pollution.',
    icon: 'spa',
    layoutStyle: 'zen_emerald',
    paletteLabel: 'Deep Emerald Green & Sage Theme',
    themePreset: 'emerald_sage',
    subCategories: ['Scalp Detox', 'Ayurvedic Lepam', 'Intense Moisture Steam', 'Hair Fall Defense'],
    defaultCity: 'Chennai, Tamil Nadu',
    defaultAddress: 'Alwarpet High Road, Near TTK Road, Alwarpet',
    defaultPostalCode: '600018',
    phone: '+91 98400 11993',
    whatsapp: '+91 98400 11993',
    ownerName: 'Dr. Gayatri Raman',
    ownerRole: 'Trichologist & Scalp Wellness Director',
    ownerPhotoUrl: 'https://images.unsplash.com/photo-1594824813596-f9479e43b1a2?auto=format&fit=crop&w=500&q=80',
    coverImageUrl: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80',
    instagramHandle: '@keshprakriti.chennai',
    themeStyle: {
      heroBackground: 'bg-[#064e3b]',
      heroTextColor: 'text-emerald-50',
      cardBorder: 'border-emerald-200',
      cardBackground: 'bg-[#f7fcf9]',
      cardRadius: 'rounded-2xl',
      accentColor: 'text-[#065f46]',
      accentBg: 'bg-[#065f46]',
      badgeBg: 'bg-emerald-100',
      badgeText: 'text-emerald-800',
      buttonBg: 'bg-[#065f46] hover:bg-[#047857]',
      buttonText: 'text-white',
      priceColor: 'text-[#047857]',
      isDark: false,
      headerBanner: 'bg-[#ecfdf5] border-b border-emerald-200'
    },
    services: [
      {
        id: 'hsp-1',
        name: 'Japanese Ultrasonic Head Spa & Scalp Detox',
        category: 'Scalp Detox',
        durationMinutes: 70,
        price: 1950,
        description: 'Micro-camera follicle diagnosis, volcanic clay scrub, waterfall rinse, and herb-steamed scalp bath.',
        icon: 'water_drop',
        popular: true
      },
      {
        id: 'hsp-2',
        name: 'Ayurvedic Bhringraj & Brahmi Kesh Lepam',
        category: 'Ayurvedic Lepam',
        durationMinutes: 60,
        price: 1650,
        description: 'Fresh ground cold-pressed herbs, warm castor oil massage, and soothing banana leaf wrap.',
        icon: 'eco',
        popular: true
      },
      {
        id: 'hsp-3',
        name: 'Moroccan Argan Deep Nourishing Steam Ritual',
        category: 'Intense Moisture Steam',
        durationMinutes: 75,
        price: 2100,
        description: 'Cold-pressed bio-argan oil infusion under warm ozone steam for dry, frizzy, brittle hair strands.',
        icon: 'spa'
      },
      {
        id: 'hsp-4',
        name: 'Anti-Dandruff Tea Tree & Neem Ozone Therapy',
        category: 'Scalp Detox',
        durationMinutes: 50,
        price: 1450,
        description: 'Purifies flaky scalp, kills fungal colonies, and regulates natural sebum production.',
        icon: 'healing'
      },
      {
        id: 'hsp-5',
        name: 'Peptide Root Density & Hair Fall Defense Ritual',
        category: 'Hair Fall Defense',
        durationMinutes: 65,
        price: 2400,
        description: 'Redensyl and Biotinyl peptide infusion stimulated with galvanic high-frequency current.',
        icon: 'vital_signs'
      }
    ],
    stylists: [
      {
        id: 'hsp-st-1',
        name: 'Dr. Gayatri Raman',
        role: 'Chief Trichologist',
        avatarUrl: 'https://images.unsplash.com/photo-1594824813596-f9479e43b1a2?auto=format&fit=crop&w=400&q=80',
        specialties: ['Scalp Diagnostics', 'Follicle Rejuvenation', 'Japanese Head Spa'],
        rating: 4.97
      },
      {
        id: 'hsp-st-2',
        name: 'Karthik Sundaram',
        role: 'Senior Scalp Therapist',
        avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80',
        specialties: ['Acupressure Massage', 'Ozone Steam Therapies'],
        rating: 4.93
      },
      {
        id: 'hsp-st-3',
        name: 'Deepa Pillai',
        role: 'Botanical Mask Specialist',
        avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
        specialties: ['Kesh Lepam', 'Argan Moisture Infusion'],
        rating: 4.90
      }
    ]
  },

  // 7. Facial & Skincare Clinic
  skincare_clinic: {
    id: 'skincare_clinic',
    title: 'Dermacure Aesthetic Dermatology & Laser Clinic',
    shortName: 'Facial & Skincare Clinic',
    tagline: 'Evidence-Based Medi-Facials, Chemical Peels & Certified Dermatological Care',
    about: 'Dermacure in Gurugram brings US-FDA approved technologies, medical-grade HydraFacials, and customized peeling regimens under the direct guidance of certified dermatologists for radiant, healthy Indian skin.',
    icon: 'medical_services',
    layoutStyle: 'clinical_clean',
    paletteLabel: 'Fresh Blue & Crisp White Theme',
    themePreset: 'clinical_sky_blue',
    subCategories: ['Medi-Facials', 'Chemical Peels', 'Hydra-Infusion', 'Laser & Pigmentation'],
    defaultCity: 'Gurugram, Haryana',
    defaultAddress: 'Sector 29, Near IFFCO Chowk, Golf Course Road',
    defaultPostalCode: '122002',
    phone: '+91 98124 55432',
    whatsapp: '+91 98124 55432',
    ownerName: 'Dr. Tanvi Deshmukh',
    ownerRole: 'MD Dermatology & Aesthetic Consultant',
    ownerPhotoUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=500&q=80',
    coverImageUrl: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=1200&q=80',
    instagramHandle: '@dermacure.clinic',
    themeStyle: {
      heroBackground: 'bg-[#f0f9ff]',
      heroTextColor: 'text-sky-950',
      cardBorder: 'border-sky-200',
      cardBackground: 'bg-white',
      cardRadius: 'rounded-xl',
      accentColor: 'text-[#0284c7]',
      accentBg: 'bg-[#0284c7]',
      badgeBg: 'bg-sky-100',
      badgeText: 'text-sky-800',
      buttonBg: 'bg-[#0284c7] hover:bg-[#0369a1]',
      buttonText: 'text-white',
      priceColor: 'text-[#0284c7]',
      isDark: false,
      headerBanner: 'bg-sky-50 border-b border-sky-100'
    },
    services: [
      {
        id: 'sk-1',
        name: 'Medi-Grade Hydra Dermabrasion & Antioxidant Infusion',
        category: 'Hydra-Infusion',
        durationMinutes: 60,
        price: 3200,
        description: '3-in-1 patented vortex suction for deep pore extraction, lactic acid hydration, and peptide sealing.',
        icon: 'water_drop',
        popular: true
      },
      {
        id: 'sk-2',
        name: 'Glycolic Radiance Skin Renewal Peel',
        category: 'Chemical Peels',
        durationMinutes: 45,
        price: 2100,
        description: 'Dermatologist-applied AHA peel tackling melasma, sun spots, and uneven texture.',
        icon: 'science',
        popular: true
      },
      {
        id: 'sk-3',
        name: 'Carbon Hollywood Laser Doll Peel',
        category: 'Laser & Pigmentation',
        durationMinutes: 60,
        price: 3800,
        description: 'Q-switched Nd:YAG laser targeted on activated liquid carbon for porcelain pore tightening.',
        icon: 'flash_on'
      },
      {
        id: 'sk-4',
        name: 'LED Photo-Dynamic Acne Clear Therapy',
        category: 'Medi-Facials',
        durationMinutes: 40,
        price: 1800,
        description: 'Blue (415nm) and Red (633nm) medical LED light matrix that eliminates P. acnes bacteria.',
        icon: 'lightbulb'
      },
      {
        id: 'sk-5',
        name: 'Deep Hyaluronic Multi-Molecular Hydration Boost',
        category: 'Hydra-Infusion',
        durationMinutes: 50,
        price: 2600,
        description: 'Iontophoresis penetration of cross-linked hyaluronic acid for 72-hour dewy radiance.',
        icon: 'opacity'
      }
    ],
    stylists: [
      {
        id: 'sk-st-1',
        name: 'Dr. Tanvi Deshmukh',
        role: 'MD Dermatologist',
        avatarUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=400&q=80',
        specialties: ['HydraFacial', 'Laser Toning', 'Chemical Peels'],
        rating: 4.99
      },
      {
        id: 'sk-st-2',
        name: 'Dr. Sameer Gill',
        role: 'Clinical Cosmetologist',
        avatarUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=400&q=80',
        specialties: ['Carbon Laser', 'Acne Scar Revision'],
        rating: 4.95
      },
      {
        id: 'sk-st-3',
        name: 'Neha Saxena',
        role: 'Senior Aesthetic Therapist',
        avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
        specialties: ['LED Phototherapy', 'Hydra Infusion'],
        rating: 4.91
      }
    ]
  },

  // 8. Makeup Studio
  makeup_studio: {
    id: 'makeup_studio',
    title: 'Vogue Noir Makeup Studio & Academy',
    shortName: 'Makeup Studio',
    tagline: 'Glamorous Runway Looks, High-Definition Airbrush & Editorial Portfolios',
    about: 'Situated in the chic lanes of Koregaon Park, Pune, Vogue Noir is an elite editorial makeup studio. We craft camera-ready looks for red carpets, commercial shoots, and luxury receptions with luminous liquid gold highlights.',
    icon: 'face_retouching_natural',
    layoutStyle: 'dark_glam',
    paletteLabel: 'Sleek Dark Mode with Gold Accents',
    themePreset: 'obsidian_gold',
    subCategories: ['Red Carpet Glam', '4K Airbrush', 'Cocktail & Party', 'Masterclasses'],
    defaultCity: 'Pune, Maharashtra',
    defaultAddress: 'Lane 7, North Main Road, Koregaon Park',
    defaultPostalCode: '411001',
    phone: '+91 98230 88765',
    whatsapp: '+91 98230 88765',
    ownerName: 'Natasha Poonawalla',
    ownerRole: 'Celebrity Makeup Artist & Creative Director',
    ownerPhotoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=500&q=80',
    coverImageUrl: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1200&q=80',
    instagramHandle: '@vogue_noir.pune',
    themeStyle: {
      heroBackground: 'bg-[#09090b]',
      heroTextColor: 'text-neutral-100',
      cardBorder: 'border-[#d4af37]/40',
      cardBackground: 'bg-[#121216]',
      cardRadius: 'rounded-xl',
      accentColor: 'text-[#d4af37]',
      accentBg: 'bg-[#d4af37]',
      badgeBg: 'bg-[#262010]',
      badgeText: 'text-[#fae596]',
      buttonBg: 'bg-[#d4af37] hover:bg-[#c29e2f]',
      buttonText: 'text-[#09090b]',
      priceColor: 'text-[#e5c068]',
      isDark: true,
      headerBanner: 'bg-[#0e0e12] border-b border-[#d4af37]/30'
    },
    services: [
      {
        id: 'ms-1',
        name: 'Red Carpet HD Glass Skin Glam & Mink Lashes',
        category: 'Red Carpet Glam',
        durationMinutes: 75,
        price: 4500,
        description: 'Flawless non-cakey HD base, smoky wing or cut crease, feather brow sculpting, and magnetic lashes.',
        icon: 'face_retouching_natural',
        popular: true
      },
      {
        id: 'ms-2',
        name: 'Temptu 4K Silicone Airbrush Event Makeup',
        category: '4K Airbrush',
        durationMinutes: 90,
        price: 6500,
        description: 'Micro-fine airbrush application, 24-hour waterproof and sweat-resistant formulation for high-octane events.',
        icon: 'auto_awesome',
        popular: true
      },
      {
        id: 'ms-3',
        name: 'Cocktail & Sangeet Golden Hour Glow',
        category: 'Cocktail & Party',
        durationMinutes: 80,
        price: 5200,
        description: 'Champagne gold strobing, flushed rose cheeks, and smudge-proof velvet matte lips.',
        icon: 'celebration'
      },
      {
        id: 'ms-4',
        name: '1-on-1 Self-Makeup Pro Masterclass',
        category: 'Masterclasses',
        durationMinutes: 120,
        price: 7500,
        description: 'Personalized vanity audit, contouring tricks for your face shape, and mastering everyday glam.',
        icon: 'school'
      },
      {
        id: 'ms-5',
        name: 'Editorial Monochromatic Dewy Glow',
        category: 'Red Carpet Glam',
        durationMinutes: 60,
        price: 3800,
        description: 'Runway glossy lids, fresh skin tint, soap brows, and plumping lip oil finish.',
        icon: 'camera'
      }
    ],
    stylists: [
      {
        id: 'ms-st-1',
        name: 'Natasha Poonawalla',
        role: 'Celebrity Makeup Artist',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
        specialties: ['Glass Skin Base', 'Airbrush 4K', 'Red Carpet Glam'],
        rating: 4.98
      },
      {
        id: 'ms-st-2',
        name: 'Siddharth Roy',
        role: 'Editorial Artist & Masterclass Lead',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
        specialties: ['Graphic Liners', 'High-Fashion Contour'],
        rating: 4.94
      },
      {
        id: 'ms-st-3',
        name: 'Tara Merchant',
        role: 'Airbrush Specialist',
        avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
        specialties: ['Temptu Airbrush', 'Bridal Cocktail Looks'],
        rating: 4.92
      }
    ]
  },

  // 9. Massage & Wellness Center
  massage_wellness: {
    id: 'massage_wellness',
    title: 'Bodhi Tree Massage & Wellness Sanctuary',
    shortName: 'Massage & Wellness Center',
    tagline: 'Peaceful Sanctuary, Himalayan Hot Stone Therapy & Deep Stress Dissolution',
    about: 'Set amidst peaceful surroundings in Candolim, Goa, Bodhi Tree integrates warm Himalayan salt stones, bamboo wood rolls, and therapeutic essential oils to relieve chronic muscle knots and urban fatigue.',
    icon: 'self_improvement',
    layoutStyle: 'earth_bamboo',
    paletteLabel: 'Warm Earth Tones & Bamboo Texture',
    themePreset: 'earth_bamboo',
    subCategories: ['Deep Tissue', 'Himalayan Hot Stone', 'Aromatherapy', 'Reflexology'],
    defaultCity: 'Candolim, Goa',
    defaultAddress: 'Near Fort Aguada Road, Candolim Beach Area',
    defaultPostalCode: '403515',
    phone: '+91 98332 44102',
    whatsapp: '+91 98332 44102',
    ownerName: 'Anand Bodhi',
    ownerRole: 'Holistic Bodywork Master & Healer',
    ownerPhotoUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=500&q=80',
    coverImageUrl: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1200&q=80',
    instagramHandle: '@bodhitree.goa',
    themeStyle: {
      heroBackground: 'bg-[#3b2b1d]',
      heroTextColor: 'text-[#f7f1e6]',
      cardBorder: 'border-[#d4c5b3]',
      cardBackground: 'bg-[#faf6f0]',
      cardRadius: 'rounded-xl',
      accentColor: 'text-[#784d2b]',
      accentBg: 'bg-[#784d2b]',
      badgeBg: 'bg-[#ece2d3]',
      badgeText: 'text-[#57351c]',
      buttonBg: 'bg-[#784d2b] hover:bg-[#633e21]',
      buttonText: 'text-white',
      priceColor: 'text-[#784d2b]',
      isDark: false,
      headerBanner: 'bg-[#f4ece1] border-b border-[#ded2c3]'
    },
    services: [
      {
        id: 'mw-1',
        name: '90-Min Deep Tissue Muscle Knot Release',
        category: 'Deep Tissue',
        durationMinutes: 90,
        price: 2600,
        description: 'Firm pressure strokes, trigger point therapy, and warming eucalyptus balm for back & shoulder stiffness.',
        icon: 'self_improvement',
        popular: true
      },
      {
        id: 'mw-2',
        name: 'Himalayan Warm Salt Stone Therapy',
        category: 'Himalayan Hot Stone',
        durationMinutes: 75,
        price: 2900,
        description: 'Heated pink crystal stones infused with 84 essential minerals that melt away stress and muscle tension.',
        icon: 'filter_vintage',
        popular: true
      },
      {
        id: 'mw-3',
        name: 'Kerala Spiced Herbal Potli Massage',
        category: 'Deep Tissue',
        durationMinutes: 60,
        price: 2400,
        description: 'Warm muslin herbal poultices dipped in medicated oil, rhythmically tapped over tired joints.',
        icon: 'local_florist'
      },
      {
        id: 'mw-4',
        name: 'Lavender & Frankincense Aromatherapy Sleep Ritual',
        category: 'Aromatherapy',
        durationMinutes: 60,
        price: 2300,
        description: 'Calming rhythmic effleurage with pure botanical essences designed to restore natural circadian sleep.',
        icon: 'bedtime'
      },
      {
        id: 'mw-5',
        name: 'Tibetan Foot Acupressure & Reflexology',
        category: 'Reflexology',
        durationMinutes: 45,
        price: 1500,
        description: 'Targeted nerve pressure points on the feet connected to vital internal organs and energetic meridians.',
        icon: 'pan_tool'
      }
    ],
    stylists: [
      {
        id: 'mw-st-1',
        name: 'Anand Bodhi',
        role: 'Master Bodywork Therapist',
        avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80',
        specialties: ['Deep Tissue', 'Trigger Point', 'Tibetan Singing Bowls'],
        rating: 4.96
      },
      {
        id: 'mw-st-2',
        name: 'Maya Thapa',
        role: 'Aromatherapist',
        avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
        specialties: ['Himalayan Stone Therapy', 'Herbal Potli'],
        rating: 4.94
      },
      {
        id: 'mw-st-3',
        name: 'Sonam Norbu',
        role: 'Reflexology Specialist',
        avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
        specialties: ['Acupressure', 'Joint Decompression'],
        rating: 4.91
      }
    ]
  },

  // 10. Hair Coloring Studio
  hair_coloring: {
    id: 'hair_coloring',
    title: 'Prism & Chroma Hair Color Atelier',
    shortName: 'Hair Coloring Studio',
    tagline: 'Hand-Painted Balayage, Luminous Metallics & Custom Fantasy Swatches',
    about: 'Located on Wood Street in Ashok Nagar, Bengaluru, Prism & Chroma is an avant-garde hair coloring studio. From honey caramel dimensional balayage to bold fantasy pastels, our certified color masters formulate custom shades tailored to Indian skin tones.',
    icon: 'palette',
    layoutStyle: 'creative_gallery',
    paletteLabel: 'Bold Multi-Color Gradient Accents',
    themePreset: 'chroma_gradient',
    subCategories: ['Balayage & Ombre', 'Fashion Pastels', 'Global Bleach & Tone', 'Money Piece Foils'],
    defaultCity: 'Bengaluru, Karnataka',
    defaultAddress: 'Wood Street, Ashok Nagar, Off Brigade Road',
    defaultPostalCode: '560025',
    phone: '+91 98451 90812',
    whatsapp: '+91 98451 90812',
    ownerName: "Siddharth 'Sid' Sen",
    ownerRole: 'Master Color Alchemist & Wella Passionista',
    ownerPhotoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=500&q=80',
    coverImageUrl: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=1200&q=80',
    instagramHandle: '@prismchroma.color',
    themeStyle: {
      heroBackground: 'bg-gradient-to-r from-[#180924] via-[#240a34] to-[#12051f]',
      heroTextColor: 'text-white',
      cardBorder: 'border-fuchsia-300',
      cardBackground: 'bg-white',
      cardRadius: 'rounded-xl',
      accentColor: 'text-[#c026d3]',
      accentBg: 'bg-gradient-to-r from-[#db2777] via-[#7c3aed] to-[#0891b2]',
      badgeBg: 'bg-fuchsia-100',
      badgeText: 'text-fuchsia-950 font-bold',
      buttonBg: 'bg-gradient-to-r from-[#db2777] to-[#7c3aed] hover:opacity-95',
      buttonText: 'text-white font-bold',
      priceColor: 'text-fuchsia-950 font-extrabold',
      isDark: false,
      headerBanner: 'bg-gradient-to-r from-pink-50 via-purple-50 to-cyan-50 border-b border-fuchsia-200'
    },
    services: [
      {
        id: 'hc-1',
        name: 'Signature Caramel Balayage & Olaplex Glaze',
        category: 'Balayage & Ombre',
        durationMinutes: 180,
        price: 5200,
        description: 'Custom hand-painted multidimensional caramel, copper or hazelnut highlights suited for Indian undertones.',
        icon: 'brush',
        popular: true
      },
      {
        id: 'hc-2',
        name: 'Vivid Pastel / Neon Fantasy Color (Semi-Permanent)',
        category: 'Fashion Pastels',
        durationMinutes: 150,
        price: 4200,
        description: 'Electric magenta, lilac, or emerald mermaid tones applied over pre-lightened hair with bonded conditioning.',
        icon: 'palette',
        popular: true
      },
      {
        id: 'hc-3',
        name: 'Global Ash Platinum Blonde & Tonal Neutralizer',
        category: 'Global Bleach & Tone',
        durationMinutes: 210,
        price: 6200,
        description: 'Full-head gentle lift to level 9/10, brass-canceling cool toner, and deep conditioning seal.',
        icon: 'auto_awesome'
      },
      {
        id: 'hc-4',
        name: 'Face-Framing Money Piece & Crown Foiling',
        category: 'Money Piece Foils',
        durationMinutes: 75,
        price: 2400,
        description: 'Striking blonde or rose-gold ribbons along the hairline to brighten facial contours.',
        icon: 'flare'
      },
      {
        id: 'hc-5',
        name: 'Dimensional Lowlights & Seamless Grey Blending',
        category: 'Balayage & Ombre',
        durationMinutes: 120,
        price: 3600,
        description: 'Natural brunette and espresso lowlights that soften harsh regrowth without full global coloring.',
        icon: 'water_drop'
      }
    ],
    stylists: [
      {
        id: 'hc-st-1',
        name: "Siddharth 'Sid' Sen",
        role: 'Master Color Alchemist',
        avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
        specialties: ['Balayage', 'Global Bleach', 'Pastel Formulations'],
        rating: 4.98
      },
      {
        id: 'hc-st-2',
        name: 'Tanmayee Kulkarni',
        role: 'Creative Balayage Specialist',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
        specialties: ['Money Piece Highlights', 'Caramel Melts'],
        rating: 4.95
      },
      {
        id: 'hc-st-3',
        name: 'Zoe Fernandez',
        role: 'Tonal & Scalp Colorist',
        avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
        specialties: ['Grey Blending', 'Cool Ash Blondes'],
        rating: 4.91
      }
    ]
  },

  // 11. Bridal Makeup & Makeover Lounge
  bridal_lounge: {
    id: 'bridal_lounge',
    title: 'Shringaar Royal Indian Bridal Lounge',
    shortName: 'Bridal Makeup & Makeover Lounge',
    tagline: 'Royal Rajputana Trousseaus, Sabyasachi Aesthetic & Heirloom Makeover Packages',
    about: 'Perched on MI Road in Jaipur, Shringaar is Rajasthan’s most celebrated bridal makeover sanctuary. We specialize in grand wedding day makeup, royal zardozi dupatta settings, airbrush longevity, and customized 7-day pre-bridal ubtan rituals.',
    icon: 'diamond',
    layoutStyle: 'royal_crimson',
    paletteLabel: 'Deep Crimson & Gold Theme',
    themePreset: 'royal_crimson_gold',
    subCategories: ['Royal Bridal Trousseau', 'Mehendi & Sangeet', 'Pre-Bridal Ubtan Glow', 'Draping & Turbans'],
    defaultCity: 'Jaipur, Rajasthan',
    defaultAddress: 'MI Road, Near Panch Batti & Raj Mandir',
    defaultPostalCode: '302001',
    phone: '+91 98290 33411',
    whatsapp: '+91 98290 33411',
    ownerName: 'Smt. Anuradha Rathore',
    ownerRole: 'Celebrity Bridal Couturiere & Stylist',
    ownerPhotoUrl: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=500&q=80',
    coverImageUrl: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=1200&q=80',
    instagramHandle: '@shringaar.jaipur',
    themeStyle: {
      heroBackground: 'bg-[#58111a]',
      heroTextColor: 'text-amber-100',
      cardBorder: 'border-amber-300',
      cardBackground: 'bg-[#fffaf5]',
      cardRadius: 'rounded-2xl',
      accentColor: 'text-[#881337]',
      accentBg: 'bg-[#881337]',
      badgeBg: 'bg-amber-100',
      badgeText: 'text-amber-900',
      buttonBg: 'bg-[#881337] hover:bg-[#700f2d]',
      buttonText: 'text-white',
      priceColor: 'text-[#881337]',
      isDark: false,
      headerBanner: 'bg-[#fff5f5] border-b-2 border-amber-300'
    },
    services: [
      {
        id: 'bl-1',
        name: 'Royal Rajputana / Mughal Full Bridal Trousseau',
        category: 'Royal Bridal Trousseau',
        durationMinutes: 240,
        price: 35000,
        description: 'HD/Airbrush bridal makeup, royal mathapatti setting, heirloom jewelry placement, silk saree/lehenga draping.',
        icon: 'workspace_premium',
        popular: true
      },
      {
        id: 'bl-2',
        name: 'Sabyasachi-Style Classic Crimson Red Bridal Glam',
        category: 'Royal Bridal Trousseau',
        durationMinutes: 180,
        price: 24000,
        description: 'Timeless flushed bronze cheeks, winged liner, traditional kohl, and perfectly draped velvet dupatta.',
        icon: 'diamond',
        popular: true
      },
      {
        id: 'bl-3',
        name: 'Cocktail & Sangeet Ultra-Glow HD Look',
        category: 'Mehendi & Sangeet',
        durationMinutes: 120,
        price: 12000,
        description: 'Modern radiant evening glam with shimmer eyes, contouring, and international textured waves styling.',
        icon: 'celebration'
      },
      {
        id: 'bl-4',
        name: 'Pre-Bridal 7-Day Sandalwood & Rose Ubtan Ritual',
        category: 'Pre-Bridal Ubtan Glow',
        durationMinutes: 180,
        price: 16500,
        description: 'Complete pre-wedding body polishing, Ayurvedic kesh spa, full body waxing, and diamond radiance facial.',
        icon: 'spa'
      },
      {
        id: 'bl-5',
        name: 'Traditional Kanjeevaram / Banarasi Saree Draping',
        category: 'Draping & Turbans',
        durationMinutes: 45,
        price: 1800,
        description: 'Crisp ironed box pleats, secure waist pinning, and royal can-can volume structuring.',
        icon: 'styler'
      }
    ],
    stylists: [
      {
        id: 'bl-st-1',
        name: 'Smt. Anuradha Rathore',
        role: 'Bridal Couture Director',
        avatarUrl: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=400&q=80',
        specialties: ['Royal Bridal Trousseau', 'Jewelry Pinning', 'Lehenga Draping'],
        rating: 5.0
      },
      {
        id: 'bl-st-2',
        name: 'Janki Khandelwal',
        role: 'Senior Heritage Makeup Artist',
        avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
        specialties: ['Sangeet Glam', 'Airbrush Longevity'],
        rating: 4.97
      },
      {
        id: 'bl-st-3',
        name: 'Farzana Sheikh',
        role: 'Draping & Turban Specialist',
        avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
        specialties: ['Silk Saree Pleats', 'Rajasthani Safa'],
        rating: 4.93
      }
    ]
  },

  // 12. Tattoo & Body Art Studio (Newly Added)
  tattoo_studio: {
    id: 'tattoo_studio',
    title: 'Iron & Ink Urban Tattoo & Body Art Studio',
    shortName: 'Tattoo & Body Art Studio',
    tagline: 'High-Contrast Monochrome, Custom Dark Realism & Surgical Piercings',
    about: 'Located in bohemian Hauz Khas Village, New Delhi, Iron & Ink is a studio dedicated to custom blackwork, fine-line realism, and sterile body piercings using 100% single-use disposable needles.',
    icon: 'draw',
    layoutStyle: 'urban_monochrome',
    paletteLabel: 'Edgy Dark Urban Layout & Monochrome Design',
    themePreset: 'urban_monochrome',
    subCategories: ['Dark Realism', 'Monochrome', 'Body Piercing', 'Flash Art'],
    defaultCity: 'New Delhi',
    defaultAddress: 'Building 14, Hauz Khas Village, Near Deer Park',
    defaultPostalCode: '110016',
    phone: '+91 98118 77621',
    whatsapp: '+91 98118 77621',
    ownerName: "Varun 'Ink' Mathur",
    ownerRole: 'Founder & Realism Tattooist',
    ownerPhotoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=500&q=80',
    coverImageUrl: 'https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28?auto=format&fit=crop&w=1200&q=80',
    instagramHandle: '@ironandink.delhi',
    themeStyle: {
      heroBackground: 'bg-[#0a0a0a]',
      heroTextColor: 'text-white',
      cardBorder: 'border-white/20',
      cardBackground: 'bg-[#141414]',
      cardRadius: 'rounded-none',
      accentColor: 'text-white',
      accentBg: 'bg-white',
      badgeBg: 'bg-neutral-800',
      badgeText: 'text-neutral-200',
      buttonBg: 'bg-white hover:bg-neutral-200',
      buttonText: 'text-black',
      priceColor: 'text-white',
      isDark: true,
      headerBanner: 'bg-[#050505] border-b border-white/20'
    },
    services: [
      {
        id: 'ts-1',
        name: 'Custom Dark Realism',
        category: 'Dark Realism',
        durationMinutes: 180,
        price: 6000,
        description: 'In a sleek dark-mode urban studio, every custom dark realism piece is built as a bespoke work of art—deep blacks, razor-precise shading, zero compromise. Sterile surgical precision meets raw edge, and the finished tattoo becomes a bold act of self-expression.',
        icon: 'brush',
        popular: true
      },
      {
        id: 'ts-2',
        name: 'High-Contrast Monochrome',
        category: 'Monochrome',
        durationMinutes: 120,
        price: 4500,
        description: 'Jet-black saturation against bare skin, carved in high-contrast monochrome that reads sharp from across the room. Bespoke artistic craftsmanship and sterile surgical precision deliver a sleek, urban statement of pure self-expression.',
        icon: 'invert_colors'
      },
      {
        id: 'ts-3',
        name: 'Surgical Body Piercings',
        category: 'Body Piercing',
        durationMinutes: 45,
        price: 1500,
        description: 'Implant-grade titanium, single-use surgical needles, and spotless sterile technique—body piercing with surgical precision in a sleek dark-mode urban setting. Every piercing is a deliberate, bespoke act of self-expression, crafted with edge-driven care.',
        icon: 'adjust'
      },
      {
        id: 'ts-4',
        name: 'Flash Art Tattoos',
        category: 'Flash Art',
        durationMinutes: 60,
        price: 2500,
        description: 'Bold designs from the studio’s ever-evolving flash wall, laid down with a steady, edge-driven hand and sterile surgical precision. Each piece is finished with bespoke artistic craftsmanship—instant, unmistakable self-expression in sleek dark style.',
        icon: 'image',
        popular: true
      }
    ],
    stylists: [
      {
        id: 'ts-st-1',
        name: "Varun 'Ink' Mathur",
        role: 'Chief Tattoo Artist',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
        specialties: ['Dark Realism', 'Geometric Blackwork', 'Sleeves'],
        rating: 4.98
      },
      {
        id: 'ts-st-2',
        name: 'Tanya Roy',
        role: 'Fine-Line & Script Specialist',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
        specialties: ['Single-Needle Florals', 'Micro Tattoos'],
        rating: 4.95
      },
      {
        id: 'ts-st-3',
        name: 'Chetan Rawat',
        role: 'Senior Body Piercing Artist',
        avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
        specialties: ['Cartilage Piercing', 'Titanium Jewelry Styling'],
        rating: 4.92
      }
    ]
  },

  // 13. Lash & Brow Bar (Newly Added)
  lash_brow: {
    id: 'lash_brow',
    title: 'Arch & Flutter Lash & Brow Bar',
    shortName: 'Lash & Brow Bar',
    tagline: 'Feather Microblading, Russian Fluffy Volume & Brow Lamination',
    about: 'A chic, intimate micro-studio on Santa Cruz’s Linking Road in Mumbai. Arch & Flutter is devoted purely to eye aesthetics: ultra-light Russian volume lash extensions, semi-permanent feather microblading, and keratin lifts.',
    icon: 'visibility',
    layoutStyle: 'chic_nude',
    paletteLabel: 'Soft Beige & Nude Micro-Studio Theme',
    themePreset: 'chic_nude_beige',
    subCategories: ['Lash Extensions', 'Microblading', 'Brow Lamination', 'Lash Lifts & Tint'],
    defaultCity: 'Mumbai, Maharashtra',
    defaultAddress: 'Linking Road, Near Gazebo Shopping, Santa Cruz West',
    defaultPostalCode: '400054',
    phone: '+91 98205 11234',
    whatsapp: '+91 98205 11234',
    ownerName: 'Nikita Shroff',
    ownerRole: 'PhiBrows Certified Master & Lash Educator',
    ownerPhotoUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=500&q=80',
    coverImageUrl: 'https://images.unsplash.com/photo-1583001931096-959e9a1a6223?auto=format&fit=crop&w=1200&q=80',
    instagramHandle: '@archandflutter.mumbai',
    themeStyle: {
      heroBackground: 'bg-[#faf6f0]',
      heroTextColor: 'text-[#443934]',
      cardBorder: 'border-[#e8ded2]',
      cardBackground: 'bg-white',
      cardRadius: 'rounded-xl',
      accentColor: 'text-[#a17865]',
      accentBg: 'bg-[#a17865]',
      badgeBg: 'bg-[#f0e7dd]',
      badgeText: 'text-[#6b4e40]',
      buttonBg: 'bg-[#a17865] hover:bg-[#8f6856]',
      buttonText: 'text-white',
      priceColor: 'text-[#8f6856]',
      isDark: false,
      headerBanner: 'bg-[#f5ede3] border-b border-[#e2d6c7]'
    },
    services: [
      {
        id: 'lb-1',
        name: 'Russian Volume 4D-6D Fluffy Lash Extensions',
        category: 'Lash Extensions',
        durationMinutes: 120,
        price: 3200,
        description: 'Handmade cashmere fans creating intense darkness and fluttery volume without weighing natural lashes down.',
        icon: 'visibility',
        popular: true
      },
      {
        id: 'lb-2',
        name: 'Semi-Permanent Feather Microblading Eyebrows',
        category: 'Microblading',
        durationMinutes: 150,
        price: 9500,
        description: 'Golden ratio facial mapping, organic iron oxide pigments, and ultra-fine hair strokes lasting up to 18 months.',
        icon: 'edit',
        popular: true
      },
      {
        id: 'lb-3',
        name: 'Keratin Lash Lift & Deep Black Tint',
        category: 'Lash Lifts & Tint',
        durationMinutes: 60,
        price: 1800,
        description: 'Perms natural lashes straight from the root with protein-rich keratin for a mascara-free look for 8 weeks.',
        icon: 'auto_awesome'
      },
      {
        id: 'lb-4',
        name: 'Brow Lamination, Precise Thread & Henna Stain',
        category: 'Brow Lamination',
        durationMinutes: 50,
        price: 1600,
        description: 'Restructures brow hairs into uniform upward direction for full, fluffy model-off-duty arches.',
        icon: 'brush',
        popular: true
      },
      {
        id: 'lb-5',
        name: 'Classic 1:1 Natural Lash Extension Set',
        category: 'Lash Extensions',
        durationMinutes: 90,
        price: 2400,
        description: 'One extension attached per natural lash for elegant, everyday polished definition.',
        icon: 'remove_red_eye'
      }
    ],
    stylists: [
      {
        id: 'lb-st-1',
        name: 'Nikita Shroff',
        role: 'Certified PhiBrows Master',
        avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80',
        specialties: ['Microblading', 'Volume Lashes', 'Golden Ratio Brows'],
        rating: 4.97
      },
      {
        id: 'lb-st-2',
        name: 'Sneha Varma',
        role: 'Lash Extension Specialist',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
        specialties: ['Russian 6D Fans', 'Lash Infill & Care'],
        rating: 4.94
      },
      {
        id: 'lb-st-3',
        name: 'Isha Chawla',
        role: 'Brow Lamination Artist',
        avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
        specialties: ['Laminations', 'Keratin Lash Infusions'],
        rating: 4.91
      }
    ]
  },

  // 14. Ayurvedic Rejuvenation Spa (Newly Added)
  ayurvedic_spa: {
    id: 'ayurvedic_spa',
    title: 'Veda Sanjeevani Ayurvedic Wellness & Spa',
    shortName: 'Ayurvedic Rejuvenation Spa',
    tagline: 'Authentic Kerala Panchakarma, Medicated Shirodhara & Vedic Herbal Lepams',
    about: 'Housed in an authentic heritage courtyard in Fort Kochi, Kerala, Veda Sanjeevani practices pure Ashtanga Ayurveda under the stewardship of traditional Vaidyas. Experience centuries-old Abhyanga, warm oil Shirodhara, Vedic herbal lepams, and authentic panchakarma rituals.',
    icon: 'eco',
    layoutStyle: 'ayurvedic_terracotta',
    paletteLabel: 'Traditional Indian Heritage & Terracotta/Copper Accents',
    themePreset: 'ayurvedic_terracotta',
    subCategories: ['Panchakarma', 'Shirodhara Streams', 'Herbal Lepams', 'Abhyangam Therapies'],
    defaultCity: 'Fort Kochi, Kerala',
    defaultAddress: 'Princess Street Heritage Zone, Fort Kochi',
    defaultPostalCode: '682001',
    phone: '+91 98470 22319',
    whatsapp: '+91 98470 22319',
    ownerName: 'Vaidya Harish Nambiar',
    ownerRole: 'BAMS Chief Ayurvedic Physician & Acharya',
    ownerPhotoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=500&q=80',
    coverImageUrl: 'https://images.unsplash.com/photo-1600334129128-685c5582fd35?auto=format&fit=crop&w=1200&q=80',
    instagramHandle: '@vedasanjeevani.kerala',
    themeStyle: {
      heroBackground: 'bg-[#5c2409]',
      heroTextColor: 'text-amber-100',
      cardBorder: 'border-[#ea580c]/30',
      cardBackground: 'bg-[#fffaf2]',
      cardRadius: 'rounded-2xl',
      accentColor: 'text-[#c2410c]',
      accentBg: 'bg-[#c2410c]',
      badgeBg: 'bg-[#ffedd5]',
      badgeText: 'text-[#9a3412]',
      buttonBg: 'bg-[#c2410c] hover:bg-[#9a3412]',
      buttonText: 'text-white',
      priceColor: 'text-[#9a3412]',
      isDark: false,
      headerBanner: 'bg-[#fff7ed] border-b border-[#fed7aa]'
    },
    services: [
      {
        id: 'as-1',
        name: 'Authentic Kerala Panchakarma',
        category: 'Panchakarma',
        durationMinutes: 90,
        price: 4500,
        description: 'The five-fold purification ritual of traditional Kerala Ayurvedic heritage, performed with authentic herbal remedies prepared according to classical texts. This deeply healing journey restores holistic mind-body balance inside a tranquil sensory retreat by the backwaters.',
        icon: 'spa',
        popular: true
      },
      {
        id: 'as-2',
        name: 'Medicated Shirodhara',
        category: 'Shirodhara Streams',
        durationMinutes: 60,
        price: 3200,
        description: 'A continuous stream of warm medicated oil, drawn from traditional Kerala Ayurvedic heritage, is poured in perfect unbroken rhythm over the Ajna third-eye point. Authentic herbal remedies calm the mind deeply, restoring holistic mind-body balance within a tranquil sensory retreat.',
        icon: 'water_drop',
        popular: true
      },
      {
        id: 'as-3',
        name: 'Vedic Herbal Lepams',
        category: 'Herbal Lepams',
        durationMinutes: 50,
        price: 1800,
        description: 'Fresh-ground packs of sandalwood, turmeric, and seasonal Kerala botanicals are applied in the time-honoured tradition of Vedic lepams. Authentic herbal remedies work gently on skin and spirit alike—a deeply healing step toward holistic mind-body balance.',
        icon: 'face'
      },
      {
        id: 'as-4',
        name: 'Abhyanga Body Massage',
        category: 'Abhyangam Therapies',
        durationMinutes: 75,
        price: 2800,
        description: 'Warm, authentic herbal oils glide over the body in slow, synchronized strokes, honouring the traditional Kerala Ayurvedic heritage of Abhyanga. The deeply healing rhythm eases fatigue and restores holistic mind-body balance, grounding you in a tranquil sensory retreat.',
        icon: 'self_improvement'
      }
    ],
    stylists: [
      {
        id: 'as-st-1',
        name: 'Vaidya Harish Nambiar',
        role: 'BAMS Chief Physician',
        avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&q=80',
        specialties: ['Nadi Pariksha', 'Panchakarma Protocol', 'Dosha Balancing'],
        rating: 4.99
      },
      {
        id: 'as-st-2',
        name: 'Sreedhar Kurup',
        role: 'Senior Kalari & Marma Masseur',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
        specialties: ['4-Hand Abhyangam', 'Elakizhi Poultice'],
        rating: 4.96
      },
      {
        id: 'as-st-3',
        name: 'Sarala Devi',
        role: 'Herbal Shirodhara Therapist',
        avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
        specialties: ['Shirodhara Streams', 'Mukha Lepam'],
        rating: 4.92
      }
    ]
  },

  // 15. Ayurvedic & Wellness Spa (Newly Added)
  ayurvedic_wellness_spa: {
    id: 'ayurvedic_wellness_spa',
    title: 'Sattva Ayurvedic & Wellness Spa',
    shortName: 'Ayurvedic & Wellness Spa',
    tagline: 'Dosha-Balancing Herbal Therapies, Nadi Pariksha Consultations & Deep Restorative Wellness',
    about: 'Set beside the Ganges in Rishikesh, Sattva Ayurvedic & Wellness Spa unites classical Ashtanga Ayurveda with modern wellness care. Every journey begins with a Nadi Pariksha pulse diagnosis, followed by bespoke therapies in authentic Dhanwantharam and Bringamadi herbs that restore Vata, Pitta, and Kapha balance.',
    icon: 'spa',
    layoutStyle: 'botanical_wellness',
    paletteLabel: 'Sage Jade & Botanical Wellness Theme',
    themePreset: 'sage_jade_botanical',
    subCategories: ['Abhyangam Therapies', 'Shirodhara Streams', 'Herbal Kizhies', 'Panchakarma Detox'],
    defaultCity: 'Rishikesh, Uttarakhand',
    defaultAddress: 'Lakshman Jhula, Tapovan, Near Parvati Ashram',
    defaultPostalCode: '249201',
    phone: '+91 98970 66241',
    whatsapp: '+91 98970 66241',
    ownerName: 'Dr. Ananya Vaidya',
    ownerRole: 'BAMS Ayurvedic Physician & Wellness Director',
    ownerPhotoUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=500&q=80',
    coverImageUrl: 'https://images.unsplash.com/photo-1512290900672-1f55b9e07506?auto=format&fit=crop&w=1200&q=80',
    instagramHandle: '@sattvaayurveda.rishikesh',
    themeStyle: {
      heroBackground: 'bg-[#122b23]',
      heroTextColor: 'text-[#f2f7f0]',
      cardBorder: 'border-[#cfe3d4]',
      cardBackground: 'bg-[#f8fbf7]',
      cardRadius: 'rounded-2xl',
      accentColor: 'text-[#1f6f4a]',
      accentBg: 'bg-[#1f6f4a]',
      badgeBg: 'bg-[#e4f2e8]',
      badgeText: 'text-[#14532d]',
      buttonBg: 'bg-[#1f6f4a] hover:bg-[#175138]',
      buttonText: 'text-white',
      priceColor: 'text-[#175138]',
      isDark: false,
      headerBanner: 'bg-[#f0f7f1] border-b border-[#d7e9dc]'
    },
    services: [
      {
        id: 'aws-1',
        name: 'Abhyangam Full Body Therapy',
        category: 'Abhyangam Therapies',
        durationMinutes: 75,
        price: 2800,
        description: 'Following a Nadi Pariksha pulse diagnosis that tunes the oil and pressure to your constitution, two therapists perform synchronized strokes of warm medicated Dhanwantharam tailam over the entire body on a traditional wooden droni. The rhythmic herbal massage settles aggravated Vata, dissolves Kapha heaviness in the muscles, and carries you into deep, whole-body physical relaxation.',
        icon: 'self_improvement',
        popular: true
      },
      {
        id: 'aws-2',
        name: 'Medicated Shirodhara Stream',
        category: 'Shirodhara Streams',
        durationMinutes: 60,
        price: 3200,
        description: 'A continuous, unbroken stream of warm Bringamadi oil—slow-infused with bhringraj, brahmi, and ashwagandha—is poured rhythmically over the Ajna third-eye point for a full hour of meditative stillness. This classical therapy cools an overheated Pitta mind, calms a racing Vata, and soothes the nervous system into profound mental peace and deep physical relaxation.',
        icon: 'water_drop',
        popular: true
      },
      {
        id: 'aws-3',
        name: 'Elakizhi Warm Herbal Poultice',
        category: 'Herbal Kizhies',
        durationMinutes: 60,
        price: 2600,
        description: 'Fresh medicinal leaves fried in a Dhanwantharam oil base are bound in hand-woven cloth boluses and tapped with warm, percussive pressure over aching joints and stiff muscles. The penetrating herbal heat loosens Vata-trapped stiffness, unblocks stagnant Kapha, and melts chronic tension into a warm, deep physical relaxation.',
        icon: 'eco'
      },
      {
        id: 'aws-4',
        name: 'Swedana Steam & Detox',
        category: 'Panchakarma Detox',
        durationMinutes: 45,
        price: 2400,
        description: 'Guided by a Nadi Pariksha pulse reading that gauges the right heat and duration for your dosha, aromatic herbal steam (swedana) opens the pores and draws out accumulated ama toxins from deep in the tissues. This dosha-targeted detox bath softens hardened Pitta and Kapha deposits while the gentle, fragrant heat melts away fatigue for complete, deep physical relaxation.',
        icon: 'spa'
      }
    ],
    stylists: [
      {
        id: 'aws-st-1',
        name: 'Dr. Ananya Vaidya',
        role: 'BAMS Ayurvedic Physician',
        avatarUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=400&q=80',
        specialties: ['Nadi Pariksha', 'Dosha Balancing', 'Panchakarma Protocols'],
        rating: 4.98
      },
      {
        id: 'aws-st-2',
        name: 'Ramesh Thampuran',
        role: 'Senior Ayurvedic Masseur & Marma Specialist',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
        specialties: ['4-Hand Abhyangam', 'Elakizhi Kizhi', 'Swedana Steam'],
        rating: 4.94
      },
      {
        id: 'aws-st-3',
        name: 'Lakshmi Raghavan',
        role: 'Shirodhara & Herbal Therapy Expert',
        avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
        specialties: ['Bringamadi Shirodhara', 'Herbal Lepams', 'Wellness Nutrition'],
        rating: 4.91
      }
    ]
  },

  // 16. Premium Luxury Hair Salon (Newly Added)
  luxury_hair_salon: {
    id: 'luxury_hair_salon',
    title: 'Maison Éclat Hair Atelier',
    shortName: 'Premium Luxury Hair Salon',
    tagline: 'Haute Hair Couture, Kérastase Rituals & Red-Carpet Precision Gloss',
    about: 'Housed in a private atelier on Lavelle Road, New Delhi, Maison Éclat is a luxury hair house where every appointment opens with a bespoke hair-mapping consultation. Our Kérastase-certified master artists craft precision dry sculpting, hand-painted balayage, Olaplex molecular repair, and mirror-gloss keratin rituals with couture precision.',
    icon: 'workspace_premium',
    layoutStyle: 'haute_luxe',
    paletteLabel: 'Onyx & Champagne Gold Theme',
    themePreset: 'onyx_champagne_gold',
    subCategories: ['Precision Sculpting', 'Color & Glossing', 'Bond Repair & Care', 'Smoothing & Gloss'],
    defaultCity: 'New Delhi',
    defaultAddress: 'Lavelle Road, South Extension II, Near ITC Maurya',
    defaultPostalCode: '110049',
    phone: '+91 98108 55672',
    whatsapp: '+91 98108 55672',
    ownerName: 'Aarav Malhotra',
    ownerRole: 'Founder & Creative Hair Director',
    ownerPhotoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=500&q=80',
    coverImageUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=80',
    instagramHandle: '@maisoneclat.delhi',
    themeStyle: {
      heroBackground: 'bg-[#101014]',
      heroTextColor: 'text-[#f6f1e7]',
      cardBorder: 'border-[#e6d9bd]',
      cardBackground: 'bg-[#fdfbf7]',
      cardRadius: 'rounded-xl',
      accentColor: 'text-[#a0824a]',
      accentBg: 'bg-[#a0824a]',
      badgeBg: 'bg-[#f3ead6]',
      badgeText: 'text-[#6f5827]',
      buttonBg: 'bg-[#a0824a] hover:bg-[#8a6d3c]',
      buttonText: 'text-white',
      priceColor: 'text-[#8a6d3c]',
      isDark: false,
      headerBanner: 'bg-[#faf7f0] border-b border-[#e6d9bd]'
    },
    services: [
      {
        id: 'lhx-1',
        name: 'Precision Sculpt & Hair Design',
        category: 'Precision Sculpting',
        durationMinutes: 60,
        price: 4500,
        description: 'Every cut opens with a bespoke hair-mapping consultation where the master artist reads your face geometry, density, and growth patterns before sculpting begins. Haute-styling techniques—dry-cut architecture, razor-pointing, and thermal memory styling sealed with Kérastase Élixir Ultime—deliver a precision silhouette with long-lasting shape and mirror-finish gloss.',
        icon: 'content_cut',
        popular: true
      },
      {
        id: 'lhx-2',
        name: 'Balayage & French Glossing',
        category: 'Color & Glossing',
        durationMinutes: 180,
        price: 12000,
        description: 'Hand-painted balayage is artfully mapped to your face and skin undertones, then sealed with a Kérastase Gloss Absolu tonal gloss that wraps every strand in liquid-light shine. The couture finish keeps dimension luminous and the gloss long-lasting for up to eight weeks after your visit.',
        icon: 'brush',
        popular: true
      },
      {
        id: 'lhx-3',
        name: 'Olaplex Bond Repair Spa',
        category: 'Bond Repair & Care',
        durationMinutes: 90,
        price: 6500,
        description: 'A personalized hair-mapping diagnosis pinpoints broken disulfide bonds, then Olaplex No. 1, No. 2, and No. 3 rebuild strength from within the fiber in a haute-styling molecular repair ritual. The session closes with a Kérastase rescue mask and silk pressing, leaving every strand fortified, elastic, and resilient.',
        icon: 'auto_awesome'
      },
      {
        id: 'lhx-4',
        name: 'Keratin Smoothing Treatment',
        category: 'Smoothing & Gloss',
        durationMinutes: 150,
        price: 15000,
        description: 'Following a strand-by-strand hair-mapping assessment, a Kérastase-infused formaldehyde-light keratin complex is bonded into the fiber with couture-grade flat-iron sealing, erasing up to 95% of frizz from root to tip. The result is long-lasting strength and a liquid gloss that keeps hair smooth, bouncy, and mirror-shine for up to four months.',
        icon: 'auto_fix_high'
      }
    ],
    stylists: [
      {
        id: 'lhx-st-1',
        name: 'Aarav Malhotra',
        role: 'Creative Director & Master Stylist',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
        specialties: ['Precision Dry Cutting', 'Face-Geometry Mapping', 'Haute Styling'],
        rating: 4.99
      },
      {
        id: 'lhx-st-2',
        name: 'Ishita Kapoor',
        role: 'Director of Color & Gloss',
        avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80',
        specialties: ['French Balayage', 'Tonal Glossing', 'Kérastase Color'],
        rating: 4.96
      },
      {
        id: 'lhx-st-3',
        name: 'Zoya Fernandes',
        role: 'Senior Keratin & Texture Stylist',
        avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
        specialties: ['Keratin Smoothing', 'Thermal Sculpting', 'Olaplex Rituals'],
        rating: 4.92
      }
    ]
  },

  // 17. Bridal & Makeover Studio (Newly Added)
  bridal_makeover_studio: {
    id: 'bridal_makeover_studio',
    title: 'Rose & Ivory Bridal Atelier',
    shortName: 'Bridal & Makeover Studio',
    tagline: 'HD Airbrush Bridal Glam, Moodboard-Driven Styling & Flawless Camera-Ready Portraits',
    about: 'Tucked into a sunlit studio off Linking Road, Bandra, Rose & Ivory is a high-end bridal and makeover house where every bridal story begins with a personalized moodboard. From sweatproof HD airbrush glam to deep skin prep hydration rituals and sculptural saree draping, our artists craft camera-ready looks that hold their glow through the longest celebrations.',
    icon: 'engagement',
    layoutStyle: 'ivory_pearl_bridal',
    paletteLabel: 'Ivory Blush & Pearl Theme',
    themePreset: 'ivory_blush_pearl',
    subCategories: ['Bridal Glam', 'Pre-Bridal Glow', 'Engagement & Sangeet', 'Draping & Hair'],
    defaultCity: 'Mumbai, Maharashtra',
    defaultAddress: 'Linking Road, Near Gazebo Shopping, Bandra West',
    defaultPostalCode: '400050',
    phone: '+91 98211 74826',
    whatsapp: '+91 98211 74826',
    ownerName: 'Madhurima Bose',
    ownerRole: 'Founder & Lead Bridal Artist',
    ownerPhotoUrl: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=500&q=80',
    coverImageUrl: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1200&q=80',
    instagramHandle: '@roseandivory.mum',
    themeStyle: {
      heroBackground: 'bg-[#fdf8f5]',
      heroTextColor: 'text-[#5c2e3a]',
      cardBorder: 'border-[#f3dcd3]',
      cardBackground: 'bg-white',
      cardRadius: 'rounded-2xl',
      accentColor: 'text-[#a84a5e]',
      accentBg: 'bg-[#a84a5e]',
      badgeBg: 'bg-[#fbe9e7]',
      badgeText: 'text-[#7c2d3e]',
      buttonBg: 'bg-[#a84a5e] hover:bg-[#8f3b4e]',
      buttonText: 'text-white',
      priceColor: 'text-[#8f3b4e]',
      isDark: false,
      headerBanner: 'bg-[#fdf3f0] border-b border-[#f3dcd3]'
    },
    services: [
      {
        id: 'bms-1',
        name: 'HD Airbrush Bridal Makeup',
        category: 'Bridal Glam',
        durationMinutes: 150,
        price: 35000,
        description: 'Every bridal look begins with a personalized moodboard session, where the artist maps your dream aesthetic to your features before a deep skin prep hydration ritual primes the canvas. Micro-mist HD airbrushing in a long-lasting sweatproof formula delivers a weightless, camera-ready glow that stays flawless through teary vows, candlelight, and the celebration that follows.',
        icon: 'face_retouching_natural',
        popular: true
      },
      {
        id: 'bms-2',
        name: 'Pre-Bridal Radiance Ritual',
        category: 'Pre-Bridal Glow',
        durationMinutes: 120,
        price: 9500,
        description: 'A multi-stage skin prep ritual of botanical exfoliation, hyaluronic infusion, and gold-peptide facials is tailored to your personalized moodboard to build an even, deeply hydrated canvas weeks before the big day. The result is a long-lasting, camera-ready glow that lets your wedding-day makeup sit smoother and wear even more beautifully.',
        icon: 'spa',
        popular: true
      },
      {
        id: 'bms-3',
        name: 'Royal Engagement Makeover',
        category: 'Engagement & Sangeet',
        durationMinutes: 120,
        price: 15000,
        description: 'From a personalized moodboard of regal tones to a dewy, sweatproof base, this engagement ritual transforms you for ring vows and family portraits with a polished, camera-ready glow. A premium long-wear setting seal locks the look for 14-hour ceremonies, so every candid carries the same luminous finish as the first frame.',
        icon: 'celebration'
      },
      {
        id: 'bms-4',
        name: 'Saree Draping & Hair Sculpting',
        category: 'Draping & Hair',
        durationMinutes: 60,
        price: 4500,
        description: 'Your personalized moodboard guides every pleat and twist—from structured nivi drapes to royal can-can volume—while sculpted bridal hair is set with a long-lasting hold that survives baraat winds and endless photo sessions. The finished styling pairs seamlessly with your makeup for a cohesive, camera-ready silhouette from crown to hem.',
        icon: 'styler'
      }
    ],
    stylists: [
      {
        id: 'bms-st-1',
        name: 'Madhurima Bose',
        role: 'Founder & Lead Bridal Artist',
        avatarUrl: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=400&q=80',
        specialties: ['HD Airbrush', 'Moodboard Styling', 'Bridal Portraits'],
        rating: 4.99
      },
      {
        id: 'bms-st-2',
        name: 'Ananya Pillai',
        role: 'Senior Pre-Bridal Skin Therapist',
        avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80',
        specialties: ['Radiance Rituals', 'Skin Prep Hydration', 'Gold Peptide Facials'],
        rating: 4.95
      },
      {
        id: 'bms-st-3',
        name: 'Sneha Kulkarni',
        role: 'Draping & Hair Sculpt Specialist',
        avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
        specialties: ['Royal Saree Drapes', 'Bridal Hair Sculpting', 'Engagement Styling'],
        rating: 4.92
      }
    ]
  },

  // 18. Modern Unisex Family Salon (Newly Added)
  family_salon: {
    id: 'family_salon',
    title: 'Cedar & Bloom Family Salon',
    shortName: 'Modern Unisex Family Salon',
    tagline: 'Quick Family Cuts, Express Glow & Everyday Hair Health for Every Generation',
    about: 'Tucked into a bright corner of Viman Nagar, Cedar & Bloom is a modern unisex family salon built for busy households. From signature wash and style cuts to express glow facials and hydra-infusion hair spas, our quick, nourishing services suit all age groups—because healthy hair and skin should never require a whole day.',
    icon: 'diversity_2',
    layoutStyle: 'family_fresh',
    paletteLabel: 'Sky Blue & Warm Cream Theme',
    themePreset: 'sky_cream_family',
    subCategories: ['Everyday Cuts', 'Quick Glow', 'Hair Spa & Care', 'Scalp Care'],
    defaultCity: 'Pune, Maharashtra',
    defaultAddress: 'Viman Nagar, Near Phoenix Marketcity',
    defaultPostalCode: '411014',
    phone: '+91 98500 44719',
    whatsapp: '+91 98500 44719',
    ownerName: 'Rahul Nair',
    ownerRole: 'Founder & Styling Director',
    ownerPhotoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=500&q=80',
    coverImageUrl: 'https://images.unsplash.com/photo-1583001931096-959e9a1a6223?auto=format&fit=crop&w=1200&q=80',
    instagramHandle: '@cedarandbloom.pune',
    themeStyle: {
      heroBackground: 'bg-[#f4faff]',
      heroTextColor: 'text-[#123a5c]',
      cardBorder: 'border-[#d3e7f7]',
      cardBackground: 'bg-white',
      cardRadius: 'rounded-2xl',
      accentColor: 'text-[#1d74b5]',
      accentBg: 'bg-[#1d74b5]',
      badgeBg: 'bg-[#e3f2fd]',
      badgeText: 'text-[#0d4f80]',
      buttonBg: 'bg-[#1d74b5] hover:bg-[#155d92]',
      buttonText: 'text-white',
      priceColor: 'text-[#155d92]',
      isDark: false,
      headerBanner: 'bg-[#f0f9ff] border-b border-[#d3e7f7]'
    },
    services: [
      {
        id: 'fam-1',
        name: 'Signature Wash & Style Cut',
        category: 'Everyday Cuts',
        durationMinutes: 30,
        price: 400,
        description: 'A quick 30-minute wash, cut, and style finished with everyday hair health in mind. Nourishing argan-infused shampoo and a versatile, all-age-group finish keep you looking polished from school runs to office deadlines.',
        icon: 'content_cut',
        popular: true
      },
      {
        id: 'fam-2',
        name: 'Express Glow Facial',
        category: 'Quick Glow',
        durationMinutes: 20,
        price: 600,
        description: 'A refreshing 20-minute facial powered by gentle, nourishing aloe and honey cleansers that brighten without harshness. Fast enough for a lunch break and mild enough for every age group—an easy everyday pick-me-up glow.',
        icon: 'face'
      },
      {
        id: 'fam-3',
        name: 'Hydra-Infusion Hair Spa',
        category: 'Hair Spa & Care',
        durationMinutes: 45,
        price: 900,
        description: 'A 45-minute hydrating hair spa that infuses keratin and cold-pressed coconut oil to rebuild everyday hair health. This quick, nourishing treatment leaves hair soft, strong, and glossy for all hair types and every age group.',
        icon: 'spa',
        popular: true
      },
      {
        id: 'fam-4',
        name: 'Anti-Dandruff Scalp Treatment',
        category: 'Scalp Care',
        durationMinutes: 30,
        price: 800,
        description: 'A fast 30-minute scalp treatment with nourishing neem and tea tree that clears flakes and calms itchiness at the root. A gentle, effective everyday hair health habit that keeps the whole family’s scalps fresh and comfortable.',
        icon: 'healing'
      }
    ],
    stylists: [
      {
        id: 'fam-st-1',
        name: 'Rahul Nair',
        role: 'Founder & Styling Director',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
        specialties: ['Family Cuts & Styles', 'Express Services', 'Scalp Care'],
        rating: 4.95
      },
      {
        id: 'fam-st-2',
        name: 'Pooja Iyer',
        role: 'Senior Stylist & Skin Therapist',
        avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
        specialties: ['Express Facials', 'Hydra Hair Spas', 'Kid-Friendly Styling'],
        rating: 4.92
      },
      {
        id: 'fam-st-3',
        name: 'Farhan Shaikh',
        role: 'Scalp & Treatment Specialist',
        avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
        specialties: ['Anti-Dandruff Therapy', 'Nourishing Hair Spas', 'Men & Women Cuts'],
        rating: 4.89
      }
    ]
  },

  // 19. Gentlemen's Barber & Grooming Club (Newly Added)
  barber_grooming_club: {
    id: 'barber_grooming_club',
    title: 'The Iron Standard Barber & Grooming Club',
    shortName: "Gentlemen's Barber & Grooming Club",
    tagline: 'Straight-Razor Precision, Hot Towel Rituals & Members-Grade Grooming',
    about: 'A members-grade gentlemen’s club in Cyber City, Gurugram, where The Iron Standard treats grooming as a daily ritual. Royal straight-razor beard sculpts, executive cuts with scalp rubs, and charcoal detox facials—every visit closes with hot towel therapy and a clean, sharp look.',
    icon: 'local_bar',
    layoutStyle: 'gents_club',
    paletteLabel: 'Midnight Navy & Copper Brass Theme',
    themePreset: 'midnight_copper_club',
    subCategories: ['Beard Sculpting', 'Executive Cuts', 'Face & Skin', 'Color & Blend'],
    defaultCity: 'Gurugram, Haryana',
    defaultAddress: 'Cyber City Phase II, Near DLF Corporate Park',
    defaultPostalCode: '122002',
    phone: '+91 99998 23407',
    whatsapp: '+91 99998 23407',
    ownerName: "Vikrant 'The Blade' Joshi",
    ownerRole: 'Founder & Master Barber',
    ownerPhotoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=500&q=80',
    coverImageUrl: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=1200&q=80',
    instagramHandle: '@ironstandard.club',
    themeStyle: {
      heroBackground: 'bg-[#0d1526]',
      heroTextColor: 'text-[#f3ede2]',
      cardBorder: 'border-[#c98a5e]/40',
      cardBackground: 'bg-[#111c30]',
      cardRadius: 'rounded-lg',
      accentColor: 'text-[#d99a6c]',
      accentBg: 'bg-[#c98a5e]',
      badgeBg: 'bg-[#1d2c47]',
      badgeText: 'text-[#e8b98d]',
      buttonBg: 'bg-[#c98a5e] hover:bg-[#b57748]',
      buttonText: 'text-[#0d1526]',
      priceColor: 'text-[#e8b98d]',
      isDark: true,
      headerBanner: 'bg-[#0a111f] border-b border-[#c98a5e]/30'
    },
    services: [
      {
        id: 'club-1',
        name: 'Royal Straight-Razor Beard Sculpt',
        category: 'Beard Sculpting',
        durationMinutes: 45,
        price: 750,
        description: 'Hot towel therapy softens the whisker before the straight razor draws every line, with precision trimming along cheek, neck, and jaw for a clean sharp look. A cooling skin hydration balm finishes the ritual, leaving the beard sculpted and the face smooth.',
        icon: 'content_cut',
        popular: true
      },
      {
        id: 'club-2',
        name: 'Executive Hair Cut & Scalp Rub',
        category: 'Executive Cuts',
        durationMinutes: 40,
        price: 650,
        description: 'A precision-trimmed cut tailored to your head shape and hair density, closed with a deep scalp rub in a hydrating charcoal tea-tree wash. Hot towel therapy and a matte finish leave you with a clean sharp look that holds from morning standups to evening calls.',
        icon: 'styler',
        popular: true
      },
      {
        id: 'club-3',
        name: 'Charcoal Detox Facial',
        category: 'Face & Skin',
        durationMinutes: 30,
        price: 900,
        description: 'Hot towel therapy opens the pores while activated charcoal pulls impurities from oil-clogged zones, followed by precision trimming of stray brow and temple lines. A skin hydration balm seals the detox, leaving a matte complexion and a clean sharp look.',
        icon: 'face'
      },
      {
        id: 'club-4',
        name: 'Grey Blending & Beard Color',
        category: 'Color & Blend',
        durationMinutes: 45,
        price: 1200,
        description: 'Salon-grade botanical color melts grey strands into natural salt-and-pepper depth, finished with precision trimming for zero visible line. A hot towel pre-treatment shields the skin, and the final hydration seal delivers a clean sharp look that reads healthy, not dyed.',
        icon: 'brush'
      }
    ],
    stylists: [
      {
        id: 'club-st-1',
        name: "Vikrant 'The Blade' Joshi",
        role: 'Founder & Master Barber',
        avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
        specialties: ['Straight-Razor Shaves', 'Beard Architecture', 'Grey Blending'],
        rating: 4.97
      },
      {
        id: 'club-st-2',
        name: 'Arjun Deshmukh',
        role: 'Executive Cut Specialist',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
        specialties: ['Precision Cuts', 'Scalp Therapy', 'Executive Styling'],
        rating: 4.93
      },
      {
        id: 'club-st-3',
        name: 'Sameer Qureshi',
        role: 'Grooming & Skin Therapist',
        avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80',
        specialties: ['Charcoal Facials', 'Beard Color', 'Hot Towel Rituals'],
        rating: 4.90
      }
    ]
  },

  // 20. Nails, Lash & Brow Bar (Newly Added)
  nails_lash_brow_bar: {
    id: 'nails_lash_brow_bar',
    title: 'Peony & Lacquer Lash, Brow & Nail Bar',
    shortName: 'Nails, Lash & Brow Bar',
    tagline: 'Lacquer Couture, Feather Lashes & Laminated Brows—All in One Bar',
    about: 'A three-in-one micro-bar in Frazer Town, Bengaluru, where Peony & Lacquer unites nail couture, Russian volume lashes, and brow lamination under one roof. Every service runs on non-damaging organic formulas, precise detailing, and long-lasting retention—so your trendy aesthetic holds from day one to day twenty.',
    icon: 'auto_awesome',
    layoutStyle: 'berry_pearl_bar',
    paletteLabel: 'Berry Blush & Pearl Theme',
    themePreset: 'berry_blush_pearl',
    subCategories: ['Nail Couture', 'Lash Extensions', 'Brow Bar', 'Hand & Foot Spa'],
    defaultCity: 'Bengaluru, Karnataka',
    defaultAddress: 'Frazer Town, Near Halasuru Circle',
    defaultPostalCode: '560005',
    phone: '+91 99000 87214',
    whatsapp: '+91 99000 87214',
    ownerName: "Kritika 'Kiki' Menon",
    ownerRole: 'Founder & Nail Couture Artist',
    ownerPhotoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=500&q=80',
    coverImageUrl: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=1200&q=80',
    instagramHandle: '@peonyandlacquer.blr',
    themeStyle: {
      heroBackground: 'bg-[#fdf2f6]',
      heroTextColor: 'text-[#5a1029]',
      cardBorder: 'border-[#f5cfd9]',
      cardBackground: 'bg-white',
      cardRadius: 'rounded-2xl',
      accentColor: 'text-[#a3124b]',
      accentBg: 'bg-[#a3124b]',
      badgeBg: 'bg-[#fbe3ea]',
      badgeText: 'text-[#7a0c38]',
      buttonBg: 'bg-[#a3124b] hover:bg-[#86103d]',
      buttonText: 'text-white',
      priceColor: 'text-[#86103d]',
      isDark: false,
      headerBanner: 'bg-[#fdf0f4] border-b border-[#f5cfd9]'
    },
    services: [
      {
        id: 'nlb-1',
        name: 'Gel Extension & Custom Nail Art',
        category: 'Nail Couture',
        durationMinutes: 90,
        price: 1800,
        description: 'Hand-sculpted gel extensions finished with precise detailing—handpainted micro-art, chrome flakes, and pearl drops in the season’s trendiest aesthetics. A 10-free organic formula flexes with your natural nail for long-lasting retention that stays chip-free for weeks.',
        icon: 'pan_tool_alt',
        popular: true
      },
      {
        id: 'nlb-2',
        name: 'Russian Volume Lash Extensions',
        category: 'Lash Extensions',
        durationMinutes: 120,
        price: 3000,
        description: 'Handmade 4D-6D feather fans are placed one by one with precise detailing for that fluttery, wide-eye look trending everywhere right now. Non-damaging organic low-latex adhesive protects natural lashes while delivering long-lasting retention without weight or breakage.',
        icon: 'visibility',
        popular: true
      },
      {
        id: 'nlb-3',
        name: 'Brow Lamination & Henna Tint',
        category: 'Brow Bar',
        durationMinutes: 50,
        price: 1500,
        description: 'Keratin lamination re-sets every brow hair upward with precise detailing, then an organic plant-based henna tint deepens the shade for weeks. A trendy fluffy-arch aesthetic with long-lasting retention—no daily gel, no fading.',
        icon: 'brush'
      },
      {
        id: 'nlb-4',
        name: 'Luxury Paraffin Pedicure',
        category: 'Hand & Foot Spa',
        durationMinutes: 50,
        price: 1200,
        description: 'A bubbling eucalyptus soak, pumice pedicure, and warm paraffin dip infused with organic shea butter melts even the roughest heels. The precise detailing ritual leaves feet silky, glowing, and long-lasting soft—trendy aesthetics for your feet too.',
        icon: 'spa'
      }
    ],
    stylists: [
      {
        id: 'nlb-st-1',
        name: "Kritika 'Kiki' Menon",
        role: 'Founder & Nail Couture Artist',
        avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
        specialties: ['Gel Extensions', 'Micro Nail Art', 'Chrome & Glaze'],
        rating: 4.98
      },
      {
        id: 'nlb-st-2',
        name: "Meera D'Souza",
        role: 'Russian Lash Artist',
        avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
        specialties: ['Russian Volume Lashes', 'Lash Retention Care', 'Fluffy Fans'],
        rating: 4.95
      },
      {
        id: 'nlb-st-3',
        name: 'Tisha Fernandes',
        role: 'Brow & Foot Specialist',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
        specialties: ['Brow Lamination', 'Henna Tint', 'Paraffin Pedicures'],
        rating: 4.91
      }
    ]
  },

  // 21. Medi-Spa & Skin Aesthetics Clinic (Newly Added)
  medispa_aesthetics: {
    id: 'medispa_aesthetics',
    title: 'Porcelain Skin Lab Medi-Spa & Aesthetics Clinic',
    shortName: 'Medi-Spa & Skin Aesthetics Clinic',
    tagline: 'Dermatologist-Led Skin Science, Spa-Grade Comfort & Zero-Downtime Glow',
    about: 'A calm, porcelain-white clinic in Alipore, Kolkata, where Porcelain Skin Lab pairs dermatologist-tested protocols with the comfort of a spa. From Advanced HydraFacial MD to LED anti-aging and micro-needling collagen boosters, every treatment targets deep cellular renewal and skin texture smoothing—with zero downtime.',
    icon: 'monitor_heart',
    layoutStyle: 'medispa_porcelain',
    paletteLabel: 'Porcelain White & Sage Teal Theme',
    themePreset: 'porcelain_sage_teal',
    subCategories: ['Signature Facials', 'Light Therapy', 'Peels & Pigmentation', 'Collagen & Texture'],
    defaultCity: 'Kolkata, West Bengal',
    defaultAddress: 'Alipore Road, Near M.G. Road Bridge',
    defaultPostalCode: '700027',
    phone: '+91 98310 45627',
    whatsapp: '+91 98310 45627',
    ownerName: 'Dr. Sneha Chatterjee',
    ownerRole: 'Consultant Dermatologist & Founder',
    ownerPhotoUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=500&q=80',
    coverImageUrl: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=1200&q=80',
    instagramHandle: '@porcelainskinlab.kolkata',
    themeStyle: {
      heroBackground: 'bg-[#f7faf9]',
      heroTextColor: 'text-[#123c36]',
      cardBorder: 'border-[#cde4de]',
      cardBackground: 'bg-white',
      cardRadius: 'rounded-xl',
      accentColor: 'text-[#2a7a6d]',
      accentBg: 'bg-[#2a7a6d]',
      badgeBg: 'bg-[#e4f2ef]',
      badgeText: 'text-[#14534b]',
      buttonBg: 'bg-[#2a7a6d] hover:bg-[#1f5f55]',
      buttonText: 'text-white',
      priceColor: 'text-[#1f5f55]',
      isDark: false,
      headerBanner: 'bg-[#f2f9f7] border-b border-[#cde4de]'
    },
    services: [
      {
        id: 'mds-1',
        name: 'Advanced HydraFacial MD',
        category: 'Signature Facials',
        durationMinutes: 45,
        price: 4500,
        description: 'A dermatologist-tested vortex protocol cleanses, gently exfoliates, and infuses hyaluronic antioxidants in one seamless session. Expect deep cellular renewal and instant skin texture smoothing with zero downtime—walk straight into your next meeting, glowing.',
        icon: 'water_drop',
        popular: true
      },
      {
        id: 'mds-2',
        name: 'LED Light Anti-Aging Therapy',
        category: 'Light Therapy',
        durationMinutes: 30,
        price: 2800,
        description: 'Dermatologist-tested red (633nm) and near-infrared light protocols energize cells for deep cellular renewal—no heat, no irritation, no recovery. This 30-minute, zero-downtime session smooths fine lines and evens skin texture session after session.',
        icon: 'lightbulb'
      },
      {
        id: 'mds-3',
        name: 'Chemical Peel & Pigmentation Correction',
        category: 'Peels & Pigmentation',
        durationMinutes: 40,
        price: 3800,
        description: 'A dermatologist-selected blend of lactic and mandelic acids lifts pigmentation at a precise depth, driving deep cellular renewal while visibly smoothing skin texture and brightening melasma, tan, and dark spots. Every peel follows a dermatologist-tested protocol with zero downtime and a fresh, luminous finish.',
        icon: 'science',
        popular: true
      },
      {
        id: 'mds-4',
        name: 'Micro-needling Collagen Booster',
        category: 'Collagen & Texture',
        durationMinutes: 60,
        price: 5500,
        description: 'Fine sterile needles create micro-channels that let a vitamin-rich growth serum stimulate collagen production for genuine deep cellular renewal. The dermatologist-tested protocol offers zero downtime—you go home the same day with a progressively smoother, firmer complexion.',
        icon: 'vital_signs'
      }
    ],
    stylists: [
      {
        id: 'mds-st-1',
        name: 'Dr. Sneha Chatterjee',
        role: 'Consultant Dermatologist & Founder',
        avatarUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=400&q=80',
        specialties: ['Medical Facials', 'Pigmentation Protocols', 'Skin Diagnostics'],
        rating: 4.98
      },
      {
        id: 'mds-st-2',
        name: 'Riya Sen',
        role: 'Senior Derma-Trained Aesthetician',
        avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80',
        specialties: ['HydraFacial MD', 'LED Light Therapy', 'Chemical Peels'],
        rating: 4.95
      },
      {
        id: 'mds-st-3',
        name: 'Dr. Abhishek Roy',
        role: 'Anti-Aging & Texture Specialist',
        avatarUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=400&q=80',
        specialties: ['Micro-needling', 'Collagen Protocols', 'Anti-Aging Care'],
        rating: 4.92
      }
    ]
  },

  // 22. Organic & Eco-Friendly Bio-Salon (Newly Added)
  organic_bio_salon: {
    id: 'organic_bio_salon',
    title: 'Terra Botanica Organic & Bio-Salon',
    shortName: 'Organic & Eco-Friendly Bio-Salon',
    tagline: '100% Vegan Color, Plant-Based Facials & Zero-Waste Hair Rituals',
    about: 'A zero-waste bio-salon in Gandhipuram, Coimbatore, where Terra Botanica cares for hair and skin with 100% vegan, chemical-free formulations. From botanical herbal color to cold-pressed eco-gloss spas, every ingredient is ethically sourced to nurture—so the radiance you see is gentle, natural, and unmistakably you.',
    icon: 'sprout',
    layoutStyle: 'organic_meadow',
    paletteLabel: 'Fern Green & Natural Linen Theme',
    themePreset: 'fern_linen_organic',
    subCategories: ['Botanical Color', 'Vegan Facials', 'Scalp Detox', 'Cold-Pressed Spas'],
    defaultCity: 'Coimbatore, Tamil Nadu',
    defaultAddress: 'Gandhipuram, Near Bakers Road',
    defaultPostalCode: '641012',
    phone: '+91 95000 33861',
    whatsapp: '+91 95000 33861',
    ownerName: "Anirudh 'Root' Iyer",
    ownerRole: 'Founder & Botanical Colorist',
    ownerPhotoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=500&q=80',
    coverImageUrl: 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?auto=format&fit=crop&w=1200&q=80',
    instagramHandle: '@terrabotanica.cbe',
    themeStyle: {
      heroBackground: 'bg-[#f6f4ec]',
      heroTextColor: 'text-[#2c4a2e]',
      cardBorder: 'border-[#d6d3c0]',
      cardBackground: 'bg-white',
      cardRadius: 'rounded-xl',
      accentColor: 'text-[#3d7a45]',
      accentBg: 'bg-[#3d7a45]',
      badgeBg: 'bg-[#e9efdd]',
      badgeText: 'text-[#33552f]',
      buttonBg: 'bg-[#3d7a45] hover:bg-[#316137]',
      buttonText: 'text-white',
      priceColor: 'text-[#316137]',
      isDark: false,
      headerBanner: 'bg-[#f4f2e7] border-b border-[#d6d3c0]'
    },
    services: [
      {
        id: 'bio-1',
        name: 'Botanical Herbal Hair Color',
        category: 'Botanical Color',
        durationMinutes: 120,
        price: 2200,
        description: '100% vegan henna, indigo, and amla paint every strand in a completely ammonia-free, chemical-free formula, ethically sourced from certified organic farms. The gentle herbal color develops over 48 hours into a soft natural radiance that never strips your hair.',
        icon: 'eco',
        popular: true
      },
      {
        id: 'bio-2',
        name: 'Plant-Based Vegan Facial',
        category: 'Vegan Facials',
        durationMinutes: 45,
        price: 1400,
        description: 'A 45-minute, 100% vegan facial built from ethically sourced aloe, green clay, and cold-pressed rosehip—zero synthetic chemicals and cruelty-free throughout. Clean botanicals lift dullness and leave your skin with a gentle natural radiance that lasts the week.',
        icon: 'face'
      },
      {
        id: 'bio-3',
        name: 'Organic Clay Scalp Detox',
        category: 'Scalp Detox',
        durationMinutes: 40,
        price: 1100,
        description: 'Mineral-rich green and kaolin clays, ethically sourced and free of synthetic surfactants, draw out buildup, pollution, and excess sebum. This 100% vegan, chemical-free ritual rebalances the scalp and leaves hair with a gentle natural radiance.',
        icon: 'healing'
      },
      {
        id: 'bio-4',
        name: 'Eco-Gloss Cold Pressed Hair Spa',
        category: 'Cold-Pressed Spas',
        durationMinutes: 60,
        price: 1600,
        description: 'First-press, chemical-free oils—cold-pressed coconut, amla, and moringa—are warmed and massaged in under herbal steam to revive tired hair. The 100% vegan ritual is ethically sourced and deeply nourishing, leaving every strand with a soft, healthy, gentle natural radiance.',
        icon: 'spa',
        popular: true
      }
    ],
    stylists: [
      {
        id: 'bio-st-1',
        name: "Anirudh 'Root' Iyer",
        role: 'Founder & Botanical Colorist',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
        specialties: ['Herbal Color', 'Cold-Pressed Spas', 'Zero-Waste Styling'],
        rating: 4.96
      },
      {
        id: 'bio-st-2',
        name: 'Devika Shetty',
        role: 'Vegan Skin Aesthetics Therapist',
        avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
        specialties: ['Vegan Facials', 'Clay Detox', 'Plant Formulas'],
        rating: 4.93
      },
      {
        id: 'bio-st-3',
        name: 'Mohammed Salim',
        role: 'Organic Scalp & Hair Specialist',
        avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80',
        specialties: ['Scalp Detox', 'Herbal Rinses', 'Natural Radiance'],
        rating: 4.90
      }
    ]
  },

  // 23. Express & Quick Beauty Bar (Newly Added)
  express_beauty_bar: {
    id: 'express_beauty_bar',
    title: 'Blink Express Beauty Bar',
    shortName: 'Express & Quick Beauty Bar',
    tagline: 'Walk-In Express Beauty—Perfect Freshness in 15 Minutes, Zero Wait',
    about: 'A zero-wait express beauty bar in Jayanagar, Bengaluru, where Blink turns your busiest routine into a perfect 15-minute refresh. From 15-Min Express Blowdries to Instant Flash Glow Cleanups, every service delivers fast application, instant visible freshness, and perfect results for busy routines.',
    icon: 'bolt',
    layoutStyle: 'express_pop',
    paletteLabel: 'Coral Pop & Dark Slate Theme',
    themePreset: 'coral_slate_express',
    subCategories: ['Express Styling', 'Flash Facials', 'Express Grooming', 'Rapid Threading'],
    defaultCity: 'Bengaluru, Karnataka',
    defaultAddress: 'Jayanagar 4th Block, Near Metro Station',
    defaultPostalCode: '560011',
    phone: '+91 97400 21583',
    whatsapp: '+91 97400 21583',
    ownerName: "Nisha 'Zip' Kapoor",
    ownerRole: 'Founder & Express Styling Director',
    ownerPhotoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=500&q=80',
    coverImageUrl: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=80',
    instagramHandle: '@blinkbeautybar.blr',
    themeStyle: {
      heroBackground: 'bg-[#1c1c22]',
      heroTextColor: 'text-[#fff4ee]',
      cardBorder: 'border-[#f2b8a2]/40',
      cardBackground: 'bg-[#232329]',
      cardRadius: 'rounded-lg',
      accentColor: 'text-[#ff6b4a]',
      accentBg: 'bg-[#ff6b4a]',
      badgeBg: 'bg-[#3a2a26]',
      badgeText: 'text-[#ffb49e]',
      buttonBg: 'bg-[#ff6b4a] hover:bg-[#e5533a]',
      buttonText: 'text-white',
      priceColor: 'text-[#ffb49e]',
      isDark: true,
      headerBanner: 'bg-[#17171c] border-b border-[#f2b8a2]/30'
    },
    services: [
      {
        id: 'exp-1',
        name: '15-Min Express Blowdry',
        category: 'Express Styling',
        durationMinutes: 15,
        price: 450,
        description: 'Walk in, walk out with perfect volume—hot towel, scalp massage, and high-heat round-brush styling in exactly 15 minutes with zero wait time. Fast application, instant visible freshness, and perfect results for your busiest mornings.',
        icon: 'styler',
        popular: true
      },
      {
        id: 'exp-2',
        name: 'Instant Flash Glow Cleanup',
        category: 'Flash Facials',
        durationMinutes: 15,
        price: 700,
        description: 'A 15-minute flash cleanup with gentle enzyme wash, 5-minute mask, and instant brightening toner delivers visible freshness in under twenty minutes. Fast application, zero wait time, and perfect results for busy routines—camera-ready glow, guaranteed.',
        icon: 'face',
        popular: true
      },
      {
        id: 'exp-3',
        name: 'Quick Shape & Polish',
        category: 'Express Grooming',
        durationMinutes: 20,
        price: 500,
        description: 'Face shape-up and 10-finger gel polish in a single 20-minute slot—fast application, zero wait time, instant visible freshness. Perfect results for busy routines, no reshuffling your schedule required.',
        icon: 'pan_tool'
      },
      {
        id: 'exp-4',
        name: 'Threading & Upper Lip Touchup',
        category: 'Rapid Threading',
        durationMinutes: 10,
        price: 200,
        description: 'Brow, upper lip, and chin threading in exactly 10 minutes—fast application, zero wait time, and no appointment needed. Walk out with an instant visible fresh face and perfect results for your busiest day.',
        icon: 'content_cut'
      }
    ],
    stylists: [
      {
        id: 'exp-st-1',
        name: "Nisha 'Zip' Kapoor",
        role: 'Founder & Express Styling Director',
        avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
        specialties: ['15-Min Blowdry', 'Flash Cleanups', 'Zero-Wait Scheduling'],
        rating: 4.94
      },
      {
        id: 'exp-st-2',
        name: 'Rajesh Kumar',
        role: 'Express Grooming Specialist',
        avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
        specialties: ['Quick Shape-Up', 'Gel Polish', 'Edge Cleanups'],
        rating: 4.91
      },
      {
        id: 'exp-st-3',
        name: 'Sana Qureshi',
        role: 'Rapid Threading Expert',
        avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
        specialties: ['Threading', 'Lip & Chin Touchups', 'Brow Precision'],
        rating: 4.89
      }
    ]
  },

  // 24. Thai & Oriental Massage Center (Newly Added)
  thai_massage_center: {
    id: 'thai_massage_center',
    title: 'Baan Sen Thai & Oriental Massage Center',
    shortName: 'Thai & Oriental Massage Center',
    tagline: 'Ancient Thai Stretch, Sen Line Therapy & Oriental Calm',
    about: 'A candle-lit oriental sanctuary in Kovalam, Kerala, where Baan Sen practices traditional Thai and oriental massage exactly as generations of healers taught it. From dry Thai stretches to aroma herbal oils and reflexology foot pressure, every session unblocks the body’s Sen energy lines—delivering full muscle tension relief and deep mental rejuvenation.',
    icon: 'self_improvement',
    layoutStyle: 'oriental_silk',
    paletteLabel: 'Temple Saffron & Silk Theme',
    themePreset: 'temple_saffron_silk',
    subCategories: ['Thai Stretch', 'Herbal Oil Therapy', 'Deep Tissue', 'Reflexology'],
    defaultCity: 'Kovalam, Kerala',
    defaultAddress: 'Kovalam Beach Road, Near Lighthouse',
    defaultPostalCode: '691512',
    phone: '+91 98460 78235',
    whatsapp: '+91 98460 78235',
    ownerName: 'Kamla "Mae" Thongprachan',
    ownerRole: 'Head Thai Massage Therapist & Founder',
    ownerPhotoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=500&q=80',
    coverImageUrl: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1200&q=80',
    instagramHandle: '@baansen.kovalam',
    themeStyle: {
      heroBackground: 'bg-[#2a1220]',
      heroTextColor: 'text-[#f8ecd9]',
      cardBorder: 'border-[#e0b57a]/40',
      cardBackground: 'bg-[#231019]',
      cardRadius: 'rounded-xl',
      accentColor: 'text-[#e8a33d]',
      accentBg: 'bg-[#e8a33d]',
      badgeBg: 'bg-[#3a1f2b]',
      badgeText: 'text-[#f5c989]',
      buttonBg: 'bg-[#e8a33d] hover:bg-[#d48d2b]',
      buttonText: 'text-[#2a1220]',
      priceColor: 'text-[#f5c989]',
      isDark: true,
      headerBanner: 'bg-[#200d17] border-b border-[#e0b57a]/30'
    },
    services: [
      {
        id: 'thai-1',
        name: 'Traditional Thai Dry Stretch Massage',
        category: 'Thai Stretch',
        durationMinutes: 90,
        price: 2200,
        description: 'Ancient stretching techniques passed down through Thai healing lineages as your therapist rhythmically compresses, kneads, and stretches along the body’s seven Sen energy lines. Every knot of muscle tension releases, every blocked Sen opens, and deep mental rejuvenation follows—full-body re-balance from head to toe.',
        icon: 'self_improvement',
        popular: true
      },
      {
        id: 'thai-2',
        name: 'Aroma Herbal Oil Therapy',
        category: 'Herbal Oil Therapy',
        durationMinutes: 75,
        price: 2500,
        description: 'Warm aromatic essential oils glide in slow, unhurried strokes over aching muscles, easing deep muscle tension while gentle Sen line pressure restores the body’s natural energy flow. The relaxing rhythm of breath and touch settles the mind into genuine deep mental rejuvenation.',
        icon: 'local_florist',
        popular: true
      },
      {
        id: 'thai-3',
        name: 'Deep Tissue Trigger Point Therapy',
        category: 'Deep Tissue',
        durationMinutes: 60,
        price: 2000,
        description: 'Focused, anciently informed strokes locate and release stubborn trigger points, unwinding layers of muscle tension knot by knot. As pressure traces the body’s Sen energy lines, blocked energy flows freely again and the mind drifts into deep mental rejuvenation.',
        icon: 'healing'
      },
      {
        id: 'thai-4',
        name: 'Reflexology Foot Pressure Therapy',
        category: 'Reflexology',
        durationMinutes: 45,
        price: 1500,
        description: 'Rhythmic pressure on precise foot reflex zones sends calming signals through every organ system, dissolving the deep muscle tension of a tired body. Rooted in ancient stretching and pressure traditions, this quiet ritual unblocks the Sen energy lines and leaves you in deep mental rejuvenation from the ground up.',
        icon: 'pan_tool'
      }
    ],
    stylists: [
      {
        id: 'thai-st-1',
        name: 'Kamla "Mae" Thongprachan',
        role: 'Head Thai Massage Therapist & Founder',
        avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
        specialties: ['Sen Line Therapy', 'Thai Stretch', 'Oriental Healing'],
        rating: 4.98
      },
      {
        id: 'thai-st-2',
        name: 'Somchai Srinawin',
        role: 'Senior Deep Tissue Therapist',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
        specialties: ['Trigger Point Release', 'Deep Tissue', 'Herbal Oil Work'],
        rating: 4.94
      },
      {
        id: 'thai-st-3',
        name: 'Anjali Devi',
        role: 'Reflexology & Aroma Specialist',
        avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80',
        specialties: ['Foot Pressure Therapy', 'Aromatherapy', 'Mental Rejuvenation'],
        rating: 4.91
      }
    ]
  },

  // 25. Kids & Teens Fun Hair Studio (Newly Added)
  kids_teens_studio: {
    id: 'kids_teens_studio',
    title: 'Scissors & Sprinkles Kids & Teens Fun Hair Studio',
    shortName: 'Kids & Teens Fun Hair Studio',
    tagline: 'First Haircuts, Cool Cuts & Tween Fresh—Fun, Fear-Free & Trendy',
    about: 'A candy-coloured playroom salon in Adyar, Chennai, where Scissors & Sprinkles turns haircuts into celebrations. Every service runs on tear-free gentle products inside an interactive fun environment, so kids walk out grinning with trendy safe styling—and parents walk out relaxed.',
    icon: 'emoji_emotions',
    layoutStyle: 'candy_playroom',
    paletteLabel: 'Cotton Candy & Sky Pop Theme',
    themePreset: 'cotton_candy_sky',
    subCategories: ['First Haircut', 'Kid Cuts & Styles', 'Safe Extensions', 'Teen Skin'],
    defaultCity: 'Chennai, Tamil Nadu',
    defaultAddress: 'Adyar, Near College Street Metro',
    defaultPostalCode: '600020',
    phone: '+91 98405 67290',
    whatsapp: '+91 98405 67290',
    ownerName: 'Sneha "Scissors" Raman',
    ownerRole: 'Founder & Kids Styling Director',
    ownerPhotoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=500&q=80',
    coverImageUrl: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=1200&q=80',
    instagramHandle: '@scissorsandsprinkles.cbe',
    themeStyle: {
      heroBackground: 'bg-[#fff8f0]',
      heroTextColor: 'text-[#5b2b8a]',
      cardBorder: 'border-[#ffd9a8]',
      cardBackground: 'bg-white',
      cardRadius: 'rounded-3xl',
      accentColor: 'text-[#e84393]',
      accentBg: 'bg-[#e84393]',
      badgeBg: 'bg-[#fff0d4]',
      badgeText: 'text-[#b06a1f]',
      buttonBg: 'bg-[#e84393] hover:bg-[#d63384]',
      buttonText: 'text-white',
      priceColor: 'text-[#d63384]',
      isDark: false,
      headerBanner: 'bg-[#fff5ec] border-b border-[#ffd9a8]'
    },
    services: [
      {
        id: 'kid-1',
        name: 'First Haircut Memory Package',
        category: 'First Haircut',
        durationMinutes: 45,
        price: 999,
        description: 'Turn the very first haircut into a big happy memory with tear-free gentle scissors, a sticker crown, and a "Big Kid" certificate complete with a mini haircut trophy. An interactive fun environment, trendy safe styling, and a keepsake photo to frame—every single time.',
        icon: 'cake',
        popular: true
      },
      {
        id: 'kid-2',
        name: 'Cool Kid Sculpt Cut & Gel Style',
        category: 'Kid Cuts & Styles',
        durationMinutes: 30,
        price: 600,
        description: 'Your little stylist picks a look from our trend board, then we sculpt a cool cut with trendy safe styling built for active kids. Tear-free gentle gel keeps the shape through playgrounds, practice matches, and everything in between—in an interactive fun environment with comfy chairs and real snacks.',
        icon: 'styler',
        popular: true
      },
      {
        id: 'kid-3',
        name: 'Non-Toxic Feather Hair Extensions',
        category: 'Safe Extensions',
        durationMinutes: 60,
        price: 2500,
        description: 'Soft feather clips with 100% non-toxic, tear-free gentle bonds add playful length in minutes—no glue, no tugging, no tears. Trendy safe styling that kids and parents alike cannot stop admiring, set to a live music playlist in our interactive fun environment.',
        icon: 'eco'
      },
      {
        id: 'kid-4',
        name: 'Teen Acne Skin Fresh Cleanup',
        category: 'Teen Skin',
        durationMinutes: 30,
        price: 800,
        description: 'An ultra-gentle enzyme cleanup targets teen acne without harsh chemicals or tears—our products are 100% tear-free gentle, even for the most sensitive tweens. Teens love the interactive fun environment, the mini facial massage, and the trendy safe styling tips that keep skin fresh all week.',
        icon: 'face'
      }
    ],
    stylists: [
      {
        id: 'kid-st-1',
        name: 'Sneha "Scissors" Raman',
        role: 'Founder & Kids Styling Director',
        avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
        specialties: ['First Haircut Rituals', 'Trendy Safe Styling', 'Tear-Free Care'],
        rating: 4.97
      },
      {
        id: 'kid-st-2',
        name: 'Deepak Pillai',
        role: 'Cool Kid Cut Specialist',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
        specialties: ['Sculpt Cuts', 'Gel Styling', 'Active Kid Cuts'],
        rating: 4.93
      },
      {
        id: 'kid-st-3',
        name: 'Ritika Jain',
        role: 'Teen Skin & Extensions Artist',
        avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
        specialties: ['Acne Cleanups', 'Feather Extensions', 'Teen Trends'],
        rating: 4.91
      }
    ]
  },

  // 26. Luxury Hotel & Resort Spa (Newly Added)
  resort_spa: {
    id: 'resort_spa',
    title: 'Azure Palms Luxury Hotel & Resort Spa',
    shortName: 'Luxury Hotel & Resort Spa',
    tagline: 'Lake-View Suites, Sunset Rituals & 5-Star Sensory Pampering',
    about: 'Perched on the shores of Lake Pichola, Udaipur, Azure Palms is a 5-star resort spa where every ritual is an occasion. From Destination Sunset Body Polishes to Rose & Wine Couple Journeys, essential oil scents, deep stress relief, and pampering sensory experiences define every corner of the estate.',
    icon: 'hotel',
    layoutStyle: 'resort_luxe',
    paletteLabel: 'Azure & Champagne Gold Theme',
    themePreset: 'azure_champagne_luxe',
    subCategories: ['Body Rituals', 'Stone Therapy', 'Couples Journey', 'Aromatherapy & Detox'],
    defaultCity: 'Udaipur, Rajasthan',
    defaultAddress: 'Fateh Sagar Marg, Lake Pichola',
    defaultPostalCode: '313001',
    phone: '+91 94250 91873',
    whatsapp: '+91 94250 91873',
    ownerName: 'Amanda Fernandes',
    ownerRole: 'Spa Director & Head Aesthetician',
    ownerPhotoUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=500&q=80',
    coverImageUrl: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80',
    instagramHandle: '@azurepalms.udaipur',
    themeStyle: {
      heroBackground: 'bg-[#0b2540]',
      heroTextColor: 'text-[#f5f1e6]',
      cardBorder: 'border-[#7fb5c4]/40',
      cardBackground: 'bg-[#0e2d4d]',
      cardRadius: 'rounded-2xl',
      accentColor: 'text-[#e6c188]',
      accentBg: 'bg-[#e6c188]',
      badgeBg: 'bg-[#173d5e]',
      badgeText: 'text-[#f0d9ad]',
      buttonBg: 'bg-[#e6c188] hover:bg-[#d4ad6e]',
      buttonText: 'text-[#0b2540]',
      priceColor: 'text-[#f0d9ad]',
      isDark: true,
      headerBanner: 'bg-[#081d33] border-b border-[#7fb5c4]/30'
    },
    services: [
      {
        id: 'res-1',
        name: 'Destination Sunset Body Polish',
        category: 'Body Rituals',
        durationMinutes: 90,
        price: 6500,
        description: 'As the lake turns gold, a master aesthetician works sugar, sea salt, and warm coconut oil into your skin in a private suite facing the sunset. This 5-star resort ritual, scented with orange blossom and vanilla essential oils, melts deep stress away and leaves you with a silken, pampering sensory glow that lasts.',
        icon: 'beach_access',
        popular: true
      },
      {
        id: 'res-2',
        name: 'Hot Stone Muscle Melting Ritual',
        category: 'Stone Therapy',
        durationMinutes: 80,
        price: 7500,
        description: 'Volcanic hot stones, warmed in rose water, settle along your body in a private 5-star resort sanctuary while cedarwood and eucalyptus essential oil scents fill the air. Deep stress relief and a pampering sensory experience that melts every knot—leave feeling reborn.',
        icon: 'local_fire_department',
        popular: true
      },
      {
        id: 'res-3',
        name: 'Rose & Wine Couple Spa Journey',
        category: 'Couples Journey',
        durationMinutes: 120,
        price: 14000,
        description: 'Two private suites, one shared rose-petal ritual, and a curated wine cellar guide you and your partner through a 5-star resort couples journey designed for total deep stress relief. A pampering sensory experience of rose-essential-oil scented massages, warm towels, and private candlelit toasts.',
        icon: 'favorite'
      },
      {
        id: 'res-4',
        name: 'Lavender Aromatherapy Detox',
        category: 'Aromatherapy & Detox',
        durationMinutes: 60,
        price: 5800,
        description: 'In a serene 5-star resort suite, the essential oil scents of lavender, geranium, and sweet orange guide you through a full-body detox journey. Deep stress relief, slow rhythmic strokes, and a pampering sensory finale with warm herbal compresses and chilled rose-water tonics—sleep deeper, wake radiant.',
        icon: 'spa'
      }
    ],
    stylists: [
      {
        id: 'res-st-1',
        name: 'Amanda Fernandes',
        role: 'Spa Director & Head Aesthetician',
        avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80',
        specialties: ['Destination Rituals', 'Couples Journeys', '5-Star Service Design'],
        rating: 4.98
      },
      {
        id: 'res-st-2',
        name: 'Rajesh "Stone" Menon',
        role: 'Master Stone Therapist',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
        specialties: ['Hot Stone Rituals', 'Deep Tissue', 'Essential Oil Blending'],
        rating: 4.95
      },
      {
        id: 'res-st-3',
        name: "Elisa D'Costa",
        role: 'Aromatherapy & Detox Specialist',
        avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
        specialties: ['Aromatherapy Detox', 'Body Polishes', 'Sensory Design'],
        rating: 4.92
      }
    ]
  },

  // 27. Vedic Ayurveda Wellness Studio (Newly Added)
  vedic_ayurveda_studio: {
    id: 'vedic_ayurveda_studio',
    title: 'Vedvriksha Vedic Ayurveda Wellness Studio',
    shortName: 'Vedic Ayurveda Wellness Studio',
    tagline: 'Time-Honoured Ayurvedic Therapies—Abhyanga, Shirodhara & Vedic Herbal Care',
    about: 'A warm, marigold-scented wellness studio in Gopalpura, Jaipur, where Vedvriksha practices time-honoured Ayurvedic therapy with modern care. From Abhyanga body massage and Shirodhara to Kashaya Sekam detox and Kadi/Janu Vashti pain relief, every treatment is designed to restore your body’s natural balance.',
    icon: 'healing',
    layoutStyle: 'vedic_marigold',
    paletteLabel: 'Marigold & Warm Sand Theme',
    themePreset: 'marigold_warm_sand',
    subCategories: ['Abhyanga & Body Care', 'Shirodhara & Mind Calm', 'Herbal Detox', 'Vedic Facials', 'Joint & Pain Relief'],
    defaultCity: 'Jaipur, Rajasthan',
    defaultAddress: 'Gopalpura, Near Ajmeri Gate',
    defaultPostalCode: '302004',
    phone: '+91 97820 54617',
    whatsapp: '+91 97820 54617',
    ownerName: 'Acharya Rajiv Saxena',
    ownerRole: 'BAMS Ayurvedic Physician & Founder',
    ownerPhotoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=500&q=80',
    coverImageUrl: 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?auto=format&fit=crop&w=1200&q=80',
    instagramHandle: '@vedvriksha.jaipur',
    themeStyle: {
      heroBackground: 'bg-[#fffaf0]',
      heroTextColor: 'text-[#5c3a10]',
      cardBorder: 'border-[#f0d9a8]',
      cardBackground: 'bg-white',
      cardRadius: 'rounded-2xl',
      accentColor: 'text-[#c77b1e]',
      accentBg: 'bg-[#c77b1e]',
      badgeBg: 'bg-[#fdf2dc]',
      badgeText: 'text-[#8a5312]',
      buttonBg: 'bg-[#c77b1e] hover:bg-[#a86516]',
      buttonText: 'text-white',
      priceColor: 'text-[#a86516]',
      isDark: false,
      headerBanner: 'bg-[#fff8e8] border-b border-[#f0d9a8]'
    },
    services: [
      {
        id: 'ved-1',
        name: 'Abhyanga Body Massage',
        category: 'Abhyanga & Body Care',
        durationMinutes: 60,
        price: 2200,
        description: 'A traditional warm herbal oil massage designed to improve body circulation, melt away fatigue, and deeply relax tired muscles. Rhythmic Ayurvedic strokes restore balance, leaving the body warm, supple, and completely renewed.',
        icon: 'self_improvement',
        popular: true
      },
      {
        id: 'ved-2',
        name: 'Shirodhara Therapy',
        category: 'Shirodhara & Mind Calm',
        durationMinutes: 60,
        price: 2800,
        description: 'A continuous stream of warm medicated oil is poured over the scalp and forehead, gently dissolving mental stress, anxiety, and insomnia. The deep meditative calm it brings feels like the mind finally switching off—sleep follows naturally.',
        icon: 'water_drop',
        popular: true
      },
      {
        id: 'ved-3',
        name: 'Kashaya Sekam & Body Detox',
        category: 'Herbal Detox',
        durationMinutes: 45,
        price: 2000,
        description: 'A healing herbal decoction bath (Kashaya Sekam) steams the body with Ayurvedic herbs, drawing out skin toxins from within. The natural detox leaves the skin clean, clear, and glowing with healthy radiance.',
        icon: 'eco'
      },
      {
        id: 'ved-4',
        name: 'Vedic Herbal Facial (Mukh Lepam)',
        category: 'Vedic Facials',
        durationMinutes: 45,
        price: 1500,
        description: 'A fresh pack of herbs, turmeric, and sandalwood is ground to order and applied for a deep, natural cleanse. It lifts impurities gently and restores the skin’s own glow—pure Ayurvedic rejuvenation, zero chemicals.',
        icon: 'face'
      },
      {
        id: 'ved-5',
        name: 'Kadi Vashti / Janu Vashti (Localized Pain Relief)',
        category: 'Joint & Pain Relief',
        durationMinutes: 45,
        price: 1800,
        description: 'Warm medicated oil is held over the back, knees, or aching joints (Kadi/Janu Vashti), delivering deep, focused heat exactly where it is needed. Chronic joint pain and stiffness respond with instant, lasting relief.',
        icon: 'healing'
      }
    ],
    stylists: [
      {
        id: 'ved-st-1',
        name: 'Acharya Rajiv Saxena',
        role: 'BAMS Ayurvedic Physician & Founder',
        avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
        specialties: ['Nadi Pariksha', 'Pain Relief Protocols', 'Dosha Mapping'],
        rating: 4.97
      },
      {
        id: 'ved-st-2',
        name: 'Lakshmi Devi',
        role: 'Senior Ayurvedic Massage Therapist',
        avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
        specialties: ['Abhyanga', 'Kashaya Sekam', 'Kadi/Janu Vashti'],
        rating: 4.94
      },
      {
        id: 'ved-st-3',
        name: 'Sunita Bhandari',
        role: 'Shirodhara & Mukh Lepam Specialist',
        avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
        specialties: ['Shirodhara', 'Vedic Facials', 'Herbal Preparation'],
        rating: 4.90
      }
    ]
  }
};

export const ALL_CATEGORY_OPTIONS: BusinessTypeOption[] = [
  {
    id: 'hair_salon',
    title: 'Hair Cut & Styling Studio',
    categoryTag: 'Hair Artistry',
    icon: 'content_cut',
    aestheticDescription: 'Modern minimalist layout, sharp geometric cards, slate & silver theme.',
    paletteName: 'Slate & Silver',
    badge: 'Popular',
    defaultServices: CATEGORY_TEMPLATES.hair_salon.services.map((s) => ({
      name: s.name,
      price: s.price,
      duration: s.durationMinutes,
      category: s.category
    }))
  },
  {
    id: 'barber',
    title: "Barber Shop / Men's Grooming",
    categoryTag: "Men's Luxury",
    icon: 'content_cut',
    aestheticDescription: 'Vintage industrial barbershop aesthetic, dark wood & brass theme.',
    paletteName: 'Dark Wood & Brass',
    badge: 'Classic',
    defaultServices: CATEGORY_TEMPLATES.barber.services.map((s) => ({
      name: s.name,
      price: s.price,
      duration: s.durationMinutes,
      category: s.category
    }))
  },
  {
    id: 'unisex_salon',
    title: 'Unisex Salon',
    categoryTag: 'All-Gender Care',
    icon: 'diversity_3',
    aestheticDescription: 'Contemporary balanced layout, warm neutral & pastel pink/grey theme.',
    paletteName: 'Pastel Blush & Stone',
    badge: 'Trending',
    defaultServices: CATEGORY_TEMPLATES.unisex_salon.services.map((s) => ({
      name: s.name,
      price: s.price,
      duration: s.durationMinutes,
      category: s.category
    }))
  },
  {
    id: 'beauty_parlour',
    title: 'Beauty Parlour',
    categoryTag: 'Herbal & Skin',
    icon: 'brush',
    aestheticDescription: 'Soft, elegant aesthetic with curved cards, rose gold & ivory theme.',
    paletteName: 'Rose Gold & Ivory',
    badge: 'Traditional',
    defaultServices: CATEGORY_TEMPLATES.beauty_parlour.services.map((s) => ({
      name: s.name,
      price: s.price,
      duration: s.durationMinutes,
      category: s.category
    }))
  },
  {
    id: 'nail_studio',
    title: 'Nail Studio',
    categoryTag: 'Nail Couture',
    icon: 'pan_tool_alt',
    aestheticDescription: 'Trendy bento-grid layout, vibrant neon pastel & gloss theme.',
    paletteName: 'Neon Pastel & Gloss',
    badge: 'Bento Layout',
    defaultServices: CATEGORY_TEMPLATES.nail_studio.services.map((s) => ({
      name: s.name,
      price: s.price,
      duration: s.durationMinutes,
      category: s.category
    }))
  },
  {
    id: 'hair_spa',
    title: 'Hair Spa & Treatment',
    categoryTag: 'Trichology & Zen',
    icon: 'spa',
    aestheticDescription: 'Relaxing, zen-inspired layout, deep emerald green & sage theme.',
    paletteName: 'Deep Emerald & Sage',
    badge: 'Zen Sanctuary',
    defaultServices: CATEGORY_TEMPLATES.hair_spa.services.map((s) => ({
      name: s.name,
      price: s.price,
      duration: s.durationMinutes,
      category: s.category
    }))
  },
  {
    id: 'skincare_clinic',
    title: 'Facial & Skincare Clinic',
    categoryTag: 'Medi-Aesthetic',
    icon: 'medical_services',
    aestheticDescription: 'Clean clinical/dermatology feel, fresh blue & crisp white theme.',
    paletteName: 'Clinical Sky Blue & White',
    badge: 'Derm Approved',
    defaultServices: CATEGORY_TEMPLATES.skincare_clinic.services.map((s) => ({
      name: s.name,
      price: s.price,
      duration: s.durationMinutes,
      category: s.category
    }))
  },
  {
    id: 'makeup_studio',
    title: 'Makeup Studio',
    categoryTag: 'Editorial Glam',
    icon: 'face_retouching_natural',
    aestheticDescription: 'Glamorous portfolio layout, sleek dark mode with gold accents.',
    paletteName: 'Obsidian & Liquid Gold',
    badge: 'Editorial',
    defaultServices: CATEGORY_TEMPLATES.makeup_studio.services.map((s) => ({
      name: s.name,
      price: s.price,
      duration: s.durationMinutes,
      category: s.category
    }))
  },
  {
    id: 'massage_wellness',
    title: 'Massage & Wellness Center',
    categoryTag: 'Holistic Bodywork',
    icon: 'self_improvement',
    aestheticDescription: 'Peaceful spa layout, warm earth tones & bamboo texture.',
    paletteName: 'Warm Earth & Bamboo',
    badge: 'Holistic',
    defaultServices: CATEGORY_TEMPLATES.massage_wellness.services.map((s) => ({
      name: s.name,
      price: s.price,
      duration: s.durationMinutes,
      category: s.category
    }))
  },
  {
    id: 'hair_coloring',
    title: 'Hair Coloring Studio',
    categoryTag: 'Color Alchemy',
    icon: 'palette',
    aestheticDescription: 'Creative gallery-style layout, bold multi-color gradient accents.',
    paletteName: 'Chroma Gradient Gallery',
    badge: 'Creative Art',
    defaultServices: CATEGORY_TEMPLATES.hair_coloring.services.map((s) => ({
      name: s.name,
      price: s.price,
      duration: s.durationMinutes,
      category: s.category
    }))
  },
  {
    id: 'bridal_lounge',
    title: 'Bridal Makeup & Makeover Lounge',
    categoryTag: 'Royal Weddings',
    icon: 'diamond',
    aestheticDescription: 'Royal Indian wedding aesthetic, deep crimson & gold theme.',
    paletteName: 'Royal Crimson & Gold',
    badge: 'Heritage Luxury',
    defaultServices: CATEGORY_TEMPLATES.bridal_lounge.services.map((s) => ({
      name: s.name,
      price: s.price,
      duration: s.durationMinutes,
      category: s.category
    }))
  },
  {
    id: 'tattoo_studio',
    title: 'Tattoo & Body Art Studio',
    categoryTag: 'Urban Body Art',
    icon: 'draw',
    aestheticDescription: 'Edgy, dark urban layout with high-contrast monochrome design.',
    paletteName: 'Urban Monochrome Ink',
    badge: 'Newly Added',
    defaultServices: CATEGORY_TEMPLATES.tattoo_studio.services.map((s) => ({
      name: s.name,
      price: s.price,
      duration: s.durationMinutes,
      category: s.category
    }))
  },
  {
    id: 'lash_brow',
    title: 'Lash & Brow Bar',
    categoryTag: 'Micro-Studio',
    icon: 'visibility',
    aestheticDescription: 'Chic, minimal micro-studio layout with soft beige & nude theme.',
    paletteName: 'Soft Beige & Warm Nude',
    badge: 'Newly Added',
    defaultServices: CATEGORY_TEMPLATES.lash_brow.services.map((s) => ({
      name: s.name,
      price: s.price,
      duration: s.durationMinutes,
      category: s.category
    }))
  },
  {
    id: 'ayurvedic_spa',
    title: 'Ayurvedic Rejuvenation Spa',
    categoryTag: 'Vedic Healing',
    icon: 'eco',
    aestheticDescription: 'Traditional Indian heritage aesthetic with terracotta & copper accents.',
    paletteName: 'Terracotta & Copper',
    badge: 'Newly Added',
    defaultServices: CATEGORY_TEMPLATES.ayurvedic_spa.services.map((s) => ({
      name: s.name,
      price: s.price,
      duration: s.durationMinutes,
      category: s.category
    }))
  },
  {
    id: 'ayurvedic_wellness_spa',
    title: 'Ayurvedic & Wellness Spa',
    categoryTag: 'Ayurvedic Wellness',
    icon: 'spa',
    aestheticDescription: 'Serene botanical wellness layout, sage jade & soft cream theme.',
    paletteName: 'Sage Jade & Botanical',
    badge: 'Newly Added',
    defaultServices: CATEGORY_TEMPLATES.ayurvedic_wellness_spa.services.map((s) => ({
      name: s.name,
      price: s.price,
      duration: s.durationMinutes,
      category: s.category
    }))
  },
  {
    id: 'luxury_hair_salon',
    title: 'Premium Luxury Hair Salon',
    categoryTag: 'Haute Hair Couture',
    icon: 'workspace_premium',
    aestheticDescription: 'High-fashion editorial layout, onyx & champagne gold luxury theme.',
    paletteName: 'Onyx & Champagne Gold',
    badge: 'Newly Added',
    defaultServices: CATEGORY_TEMPLATES.luxury_hair_salon.services.map((s) => ({
      name: s.name,
      price: s.price,
      duration: s.durationMinutes,
      category: s.category
    }))
  },
  {
    id: 'bridal_makeover_studio',
    title: 'Bridal & Makeover Studio',
    categoryTag: 'Bridal Couture',
    icon: 'engagement',
    aestheticDescription: 'Soft ivory & blush pearl bridal layout, rose & pearl accents.',
    paletteName: 'Ivory Blush & Pearl',
    badge: 'Newly Added',
    defaultServices: CATEGORY_TEMPLATES.bridal_makeover_studio.services.map((s) => ({
      name: s.name,
      price: s.price,
      duration: s.durationMinutes,
      category: s.category
    }))
  },
  {
    id: 'family_salon',
    title: 'Modern Unisex Family Salon',
    categoryTag: 'Family Friendly',
    icon: 'diversity_2',
    aestheticDescription: 'Fresh, modern family layout, sky blue & warm cream theme.',
    paletteName: 'Sky Blue & Warm Cream',
    badge: 'Newly Added',
    defaultServices: CATEGORY_TEMPLATES.family_salon.services.map((s) => ({
      name: s.name,
      price: s.price,
      duration: s.durationMinutes,
      category: s.category
    }))
  },
  {
    id: 'barber_grooming_club',
    title: "Gentlemen's Barber & Grooming Club",
    categoryTag: "Gentleman's Club",
    icon: 'local_bar',
    aestheticDescription: "Dark gentleman's club layout, midnight navy & copper brass theme.",
    paletteName: 'Midnight Navy & Copper',
    badge: 'Newly Added',
    defaultServices: CATEGORY_TEMPLATES.barber_grooming_club.services.map((s) => ({
      name: s.name,
      price: s.price,
      duration: s.durationMinutes,
      category: s.category
    }))
  },
  {
    id: 'nails_lash_brow_bar',
    title: 'Nails, Lash & Brow Bar',
    categoryTag: 'Micro-Service Bar',
    icon: 'auto_awesome',
    aestheticDescription: 'Vibrant berry & pearl micro-bar layout, raspberry & cream accents.',
    paletteName: 'Berry Blush & Pearl',
    badge: 'Newly Added',
    defaultServices: CATEGORY_TEMPLATES.nails_lash_brow_bar.services.map((s) => ({
      name: s.name,
      price: s.price,
      duration: s.durationMinutes,
      category: s.category
    }))
  },
  {
    id: 'medispa_aesthetics',
    title: 'Medi-Spa & Skin Aesthetics Clinic',
    categoryTag: 'Medi-Aesthetic',
    icon: 'monitor_heart',
    aestheticDescription: 'Calm clinical medi-spa layout, porcelain white & sage teal theme.',
    paletteName: 'Porcelain & Sage Teal',
    badge: 'Newly Added',
    defaultServices: CATEGORY_TEMPLATES.medispa_aesthetics.services.map((s) => ({
      name: s.name,
      price: s.price,
      duration: s.durationMinutes,
      category: s.category
    }))
  },
  {
    id: 'organic_bio_salon',
    title: 'Organic & Eco-Friendly Bio-Salon',
    categoryTag: 'Zero-Waste Vegan',
    icon: 'sprout',
    aestheticDescription: 'Fresh organic meadow layout, fern green & natural linen theme.',
    paletteName: 'Fern Green & Natural Linen',
    badge: 'Newly Added',
    defaultServices: CATEGORY_TEMPLATES.organic_bio_salon.services.map((s) => ({
      name: s.name,
      price: s.price,
      duration: s.durationMinutes,
      category: s.category
    }))
  },
  {
    id: 'express_beauty_bar',
    title: 'Express & Quick Beauty Bar',
    categoryTag: 'Zero-Wait Express',
    icon: 'bolt',
    aestheticDescription: 'Punchy dark express-bar layout, coral pop & slate theme.',
    paletteName: 'Coral Pop & Slate',
    badge: 'Newly Added',
    defaultServices: CATEGORY_TEMPLATES.express_beauty_bar.services.map((s) => ({
      name: s.name,
      price: s.price,
      duration: s.durationMinutes,
      category: s.category
    }))
  },
  {
    id: 'thai_massage_center',
    title: 'Thai & Oriental Massage Center',
    categoryTag: 'Oriental Healing',
    icon: 'self_improvement',
    aestheticDescription: 'Serene oriental sanctuary layout, temple saffron & silk theme.',
    paletteName: 'Temple Saffron & Silk',
    badge: 'Newly Added',
    defaultServices: CATEGORY_TEMPLATES.thai_massage_center.services.map((s) => ({
      name: s.name,
      price: s.price,
      duration: s.durationMinutes,
      category: s.category
    }))
  },
  {
    id: 'kids_teens_studio',
    title: 'Kids & Teens Fun Hair Studio',
    categoryTag: 'Kids & Teens',
    icon: 'emoji_emotions',
    aestheticDescription: 'Playful candy playroom layout, cotton candy & sky pop theme.',
    paletteName: 'Cotton Candy & Sky Pop',
    badge: 'Newly Added',
    defaultServices: CATEGORY_TEMPLATES.kids_teens_studio.services.map((s) => ({
      name: s.name,
      price: s.price,
      duration: s.durationMinutes,
      category: s.category
    }))
  },
  {
    id: 'resort_spa',
    title: 'Luxury Hotel & Resort Spa',
    categoryTag: 'Resort Luxury',
    icon: 'hotel',
    aestheticDescription: 'Opulent lakeside resort layout, deep azure & champagne gold theme.',
    paletteName: 'Azure & Champagne Gold',
    badge: 'Newly Added',
    defaultServices: CATEGORY_TEMPLATES.resort_spa.services.map((s) => ({
      name: s.name,
      price: s.price,
      duration: s.durationMinutes,
      category: s.category
    }))
  },
  {
    id: 'vedic_ayurveda_studio',
    title: 'Vedic Ayurveda Wellness Studio',
    categoryTag: 'Vedic Therapy',
    icon: 'healing',
    aestheticDescription: 'Warm Vedic wellness layout, marigold & warm sand theme.',
    paletteName: 'Marigold & Warm Sand',
    badge: 'Newly Added',
    defaultServices: CATEGORY_TEMPLATES.vedic_ayurveda_studio.services.map((s) => ({
      name: s.name,
      price: s.price,
      duration: s.durationMinutes,
      category: s.category
    }))
  }
];
