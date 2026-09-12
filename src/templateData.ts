import { BusinessTypeId, SalonProfile } from './types';
import { SALON_IMAGES } from './assets/images';

export const INITIAL_SALON_PROFILE: SalonProfile = {
  businessType: 'hair_salon',
  businessName: 'Arts By Uma',
  ownerName: 'Uma Tiwari',
  ownerRole: 'Founder & Master Stylist',
  phone: '9782105055',
  whatsapp: '+917852877721',
  email: 'templateapp67@gmail.com',
  tagline: 'Precision Cuts, Creative Hair Artistry & Luxury Nail Lounge',
  about: 'Welcome to Arts By Uma. Founded by Uma Tiwari, our boutique studio brings together master precision haircuts, bespoke balayage, sculpted gel nail art, and restorative hair spa therapies in a luxury sanctuary in Jaipur.',
  ownerPhotoUrl: 'https://qwaehqsmodekbgvnaavz.supabase.co/storage/v1/object/public/partner-avatars/5a900556-605a-4501-9655-a332f7339a34/83869de5-e5df-4530-9840-55efb2c9262a.webp',
  coverImageUrl: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=80',
  themePreset: 'slate_silver',
  themeAccentKey: 'slate',
  currency: '₹',
  subdomain: 'arts-by-uma',
  address: 'Jaipur, Jaipur Municipal Corporation, Jaipur Tehsil, Jaipur, Rajasthan, 302001, India',
  city: 'Jhotwara , Jaipur',
  areaLocality: 'jhotwara jaipur',
  postalCode: '302001'
};

export interface GalleryPhoto {
  id: string;
  url: string;
  title: string;
  tag: string;
}

export interface Testimonial {
  id: string;
  name: string;
  location: string;
  rating: number;
  serviceName: string;
  comment: string;
  avatarUrl: string;
  date: string;
}

export interface CategoryStandardData {
  foundingYear: string;
  foundingNarrative: string;
  specialties: string[];
  certifications: Array<{
    icon: string;
    title: string;
    description: string;
  }>;
  gallery: GalleryPhoto[];
  reviews: Testimonial[];
  totalReviewCount: number;
  averageRating: number;
  landmark: string;
  parkingInfo: string;
  openHourText: string;
  closeHourText: string;
}

export const CATEGORY_STANDARDIZED_DATA: Record<BusinessTypeId, CategoryStandardData> = {
  hair_salon: {
    foundingYear: '2019',
    foundingNarrative: 'Founded in Indiranagar by master hair artisans, Miraki was built to introduce geometric precision cutting, custom hair textures, and restorative botanical treatments without toxic formaldehyde or harsh chemical fumes.',
    specialties: ['Structural Bob & Layering', 'Formaldehyde-Free Smoothing', 'Scalp Barrier Detox', 'Bridal Blowouts'],
    certifications: [
      { icon: 'verified', title: '100% Autoclaved Shears', description: 'All Japanese steel shears & combs sanitized at 134°C between clients.' },
      { icon: 'eco', title: 'Cruelty-Free Formulas', description: 'Certified organic shampoos and European bond-building treatments.' },
      { icon: 'dry_cleaning', title: 'Single-Use Sealed Linen', description: 'Fresh biodegradable disposable salon capes for every appointment.' },
      { icon: 'workspace_premium', title: 'Vidal Sassoon Certified', description: 'Senior artists trained in international structural cutting techniques.' }
    ],
    gallery: [
      { id: 'hs-g1', url: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=800&q=80', title: 'Balayage Dimension & Blowdry', tag: 'Color & Cut' },
      { id: 'hs-g2', url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80', title: 'Precision Texturized Layers', tag: 'Precision Cut' },
      { id: 'hs-g3', url: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80', title: 'Studio Styling Station & Chairs', tag: 'Studio Interior' },
      { id: 'hs-g4', url: 'https://images.unsplash.com/photo-1605497788044-5a32c7078486?auto=format&fit=crop&w=800&q=80', title: 'Mirror Shine Keratin Transformation', tag: 'Restoration' },
      { id: 'hs-g5', url: 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=800&q=80', title: 'Thermal Soft Waves Styling', tag: 'Occasion Hair' },
      { id: 'hs-g6', url: 'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?auto=format&fit=crop&w=800&q=80', title: 'Consultation & Hair Diagnostics', tag: 'Consultation' }
    ],
    reviews: [
      { id: 'hs-r1', name: 'Pooja Mehra', location: 'Indiranagar, Bengaluru', rating: 5, serviceName: 'Formaldehyde-Free Keratin Smoothing', comment: 'Hands down the best hair studio in Bengaluru! My frizzy monsoon hair is silky straight yet retains natural bounce. The hygiene standard is unmatched.', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80', date: '2 days ago' },
      { id: 'hs-r2', name: 'Aditya Sen', location: 'Koramangala, Bengaluru', rating: 5, serviceName: 'Master Stylist Precision Cut & Blowdry', comment: 'Ananya took 10 minutes just analyzing my face shape and crown geometry before picking up scissors. The precision is world-class.', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80', date: '1 week ago' },
      { id: 'hs-r3', name: 'Kavita Rao', location: 'HSR Layout, Bengaluru', rating: 5, serviceName: 'Classic Layered Cut & Argan Wash', comment: 'Spotless salon, calming interior, and zero product pushing. You get exactly what you ask for with transparent ₹ pricing upfront.', avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80', date: '2 weeks ago' }
    ],
    totalReviewCount: 524,
    averageRating: 4.96,
    landmark: 'Opposite Metro Pillar 128, Near 100 Feet Road Junction',
    parkingInfo: 'Valet parking available for all clients at studio entrance',
    openHourText: '10:00 AM',
    closeHourText: '8:30 PM'
  },

  barber: {
    foundingYear: '2018',
    foundingNarrative: 'The Royal Blade revives the gentleman’s sanctuary on Bandra’s 33rd Road. We pair time-honored straight razor hot towel shaves with modern skin fades, beard architecture, and imported organic pomades.',
    specialties: ['Straight Razor Hot Shave', 'Low & Mid Skin Fades', 'Charcoal Beard Sculpting', 'Maharaja Head Massage'],
    certifications: [
      { icon: 'verified', title: 'Single-Use Japanese Blades', description: 'Fresh Feather Hi-Stainless razor blade unwrapped for every customer.' },
      { icon: 'wash', title: 'Steam & Hot Towel Sanitation', description: 'Towels sterilized in high-pressure thermal chambers infused with eucalyptus.' },
      { icon: 'shield', title: 'Skin Barrier Protection', description: 'Pre-shave essential oils and alcohol-free calming alum treatments.' },
      { icon: 'workspace_premium', title: 'Master Guild Barbers', description: 'Specialists trained in traditional British & Italian barbering arts.' }
    ],
    gallery: [
      { id: 'bb-g1', url: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80', title: 'Vintage Barber Chair & Brass Mirrors', tag: 'Interior' },
      { id: 'bb-g2', url: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=800&q=80', title: 'Hot Towel Straight Razor Treatment', tag: 'Traditional Shave' },
      { id: 'bb-g3', url: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=800&q=80', title: 'Sculpted Beard Fade & Sharp Lines', tag: 'Beard Craft' },
      { id: 'bb-g4', url: 'https://images.unsplash.com/photo-1517832606589-7157be614532?auto=format&fit=crop&w=800&q=80', title: 'Classic Pompadour Precision Cut', tag: 'Haircut' },
      { id: 'bb-g5', url: 'https://images.unsplash.com/photo-1534778356534-d3d45b6df1da?auto=format&fit=crop&w=800&q=80', title: 'Authentic Grooming Stations', tag: 'Ambience' },
      { id: 'bb-g6', url: 'https://images.unsplash.com/photo-1593702295094-aea22597af65?auto=format&fit=crop&w=800&q=80', title: 'Eucalyptus Steamed Towel Ritual', tag: 'Relaxation' }
    ],
    reviews: [
      { id: 'bb-r1', name: 'Rohan Mehta', location: 'Bandra West, Mumbai', rating: 5, serviceName: 'Royal Maharaja Shave & Steam', comment: 'The eucalyptus hot towel followed by straight razor shave was pure heaven. Vikram is an absolute master of his craft. Unbelievable vibe!', avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80', date: 'Yesterday' },
      { id: 'bb-r2', name: 'Kabir Singhania', location: 'Juhu, Mumbai', rating: 5, serviceName: 'Signature Skin Fade & Beard Sculpt', comment: 'Found my permanent barber in Mumbai. Cleanest skin fade with razor-sharp beard edges. Super disciplined appointments with zero delays.', avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&q=80', date: '4 days ago' },
      { id: 'bb-r3', name: 'Farhan Merchant', location: 'Khar, Mumbai', rating: 5, serviceName: 'Executive Scissor Cut & Charcoal Hair Wash', comment: 'Old-world charm with top-tier hygiene. They sanitize every scissor and clippers right in front of you. Worth every single rupee.', avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=200&q=80', date: '1 week ago' }
    ],
    totalReviewCount: 680,
    averageRating: 4.98,
    landmark: 'Near Linking Road Junction, Opposite Olive Bistro',
    parkingInfo: 'Dedicated valet parking stall on 33rd Road',
    openHourText: '09:30 AM',
    closeHourText: '9:00 PM'
  },

  unisex_salon: {
    foundingYear: '2020',
    foundingNarrative: 'Aura Luxe was created to give contemporary families, professionals, and couples a unified sanctuary where hair design, clinical aesthetic rituals, and restorative pedicures meet under one roof.',
    specialties: ['Couple Spa & Hair Rituals', 'Cysteine Anti-Frizz', 'Korean Glass Skin Facials', 'Spa Pedicures'],
    certifications: [
      { icon: 'verified', title: 'Hospital-Grade Hygiene', description: 'Dual UV-C autoclaves ensuring pristine equipment for every station.' },
      { icon: 'spa', title: 'Clean Dermatology Formulations', description: 'Hypoallergenic European & Korean aesthetic care lines.' },
      { icon: 'group', title: 'Private & Shared Suites', description: 'Dedicated VIP consultation rooms and couple treatment chambers.' },
      { icon: 'military_tech', title: 'ISO 9001 Salon Certified', description: 'Standardized operational procedures for time, safety, and hygiene.' }
    ],
    gallery: [
      { id: 'us-g1', url: 'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=800&q=80', title: 'Modern Minimalist Styling Floor', tag: 'Interior' },
      { id: 'us-g2', url: 'https://images.unsplash.com/photo-1560750588-73207b1ef5b8?auto=format&fit=crop&w=800&q=80', title: 'Deep Conditioning Scalp Basin', tag: 'Wash Station' },
      { id: 'us-g3', url: 'https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&w=800&q=80', title: 'Cysteine Smoothing Transformation', tag: 'Hair Result' },
      { id: 'us-g4', url: 'https://images.unsplash.com/photo-1512290900672-1f55b9e07506?auto=format&fit=crop&w=800&q=80', title: 'Hydra-Facial Clinical Room', tag: 'Skin Care' },
      { id: 'us-g5', url: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=800&q=80', title: 'Private Couple Treatment Suite', tag: 'Private Lounge' },
      { id: 'us-g6', url: 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=800&q=80', title: 'Deluxe Manicure & Pedicure Bay', tag: 'Nail Spa' }
    ],
    reviews: [
      { id: 'us-r1', name: 'Simran & Kunal Bajaj', location: 'Cyber City, Gurugram', rating: 5, serviceName: 'Couple Weekend Makeover Package', comment: 'We booked the couple package for our anniversary. Outstanding care, private suite, and both our hair transformations turned out phenomenal!', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80', date: '3 days ago' },
      { id: 'us-r2', name: 'Deepak Sharma', location: 'Golf Course Road, Gurugram', rating: 5, serviceName: 'Signature Haircut & Beard Shaping', comment: 'Always prompt, hygienic, and extremely professional. The booking system with ₹ pricing makes scheduling effortless.', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80', date: '1 week ago' },
      { id: 'us-r3', name: 'Megha Taneja', location: 'DLF Phase 5, Gurugram', rating: 5, serviceName: 'Hydra-Dermabrasion Glow Facial', comment: 'My skin was glowing instantly without any redness. Certified products and lovely hospitality from the team.', avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80', date: '2 weeks ago' }
    ],
    totalReviewCount: 710,
    averageRating: 4.95,
    landmark: 'Near Cyber Hub Gateway Tower, Sector 24',
    parkingInfo: 'Reserved 2-hour underground parking slots available',
    openHourText: '10:00 AM',
    closeHourText: '8:30 PM'
  },

  beauty_parlour: {
    foundingYear: '2016',
    foundingNarrative: 'Gulabini is a curated women’s botanical beauty sanctuary in South Delhi, celebrating traditional Indian herbal recipes alongside modern pain-free waxing, organic facial therapies, and bridal skincare.',
    specialties: ['Kesar & Haldi Bridal Facials', 'Rica Brazilian Peel Waxing', 'Organic Hair Spa', 'Threading Artistry'],
    certifications: [
      { icon: 'verified', title: '100% Female Staff Sanctuary', description: 'Private, secure, and serene environment managed completely by women.' },
      { icon: 'eco', title: 'Cold-Pressed Herbal Ingredients', description: 'Kashmiri saffron, sandalwood, and virgin coconut botanical elixirs.' },
      { icon: 'medical_services', title: 'No Double-Dipping Waxing', description: 'Single-use wooden spatulas and hypoallergenic Italian waxes.' },
      { icon: 'grade', title: 'Awarded Best South Delhi Parlour', description: 'Voted top neighbourhood beauty parlour 3 consecutive years.' }
    ],
    gallery: [
      { id: 'bp-g1', url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=800&q=80', title: 'Bridal Herbal Face Treatment', tag: 'Facial Glow' },
      { id: 'bp-g2', url: 'https://images.unsplash.com/photo-1560750588-73207b1ef5b8?auto=format&fit=crop&w=800&q=80', title: 'Organic Steam Hair Spa Therapy', tag: 'Hair Spa' },
      { id: 'bp-g3', url: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=800&q=80', title: 'Herbal Rose Water & Clay Masking', tag: 'Ayurvedic Skin' },
      { id: 'bp-g4', url: 'https://images.unsplash.com/photo-1512290900672-1f55b9e07506?auto=format&fit=crop&w=800&q=80', title: 'Private Treatment Suite & Linens', tag: 'Interior' },
      { id: 'bp-g5', url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80', title: 'Pain-Free Threading & Brow Shaping', tag: 'Brows' },
      { id: 'bp-g6', url: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=800&q=80', title: 'Floral Foot Soak & Pedicure', tag: 'Body Care' }
    ],
    reviews: [
      { id: 'bp-r1', name: 'Neelam Oberoi', location: 'Greater Kailash 1, New Delhi', rating: 5, serviceName: 'Shahnaz Husain Gold Radiance Facial', comment: 'The most trustworthy beauty parlour in South Delhi. Sunita ji treats every client with maternal warmth and immaculate hygiene.', avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80', date: '3 days ago' },
      { id: 'bp-r2', name: 'Ritu Varma', location: 'Hauz Khas, New Delhi', rating: 5, serviceName: 'Rica White Chocolate Full Body Wax', comment: 'Pain-free waxing with strictly no double dipping. The private rooms are spotless and scented with pure jasmine.', avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80', date: '1 week ago' },
      { id: 'bp-r3', name: 'Tanya Grover', location: 'Defence Colony, New Delhi', rating: 5, serviceName: 'Bridal Pre-Glow Herbal Body Polish', comment: 'Booked my complete pre-bridal package here. My skin looked luminous on my wedding day. Highest recommendation!', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80', date: '2 weeks ago' }
    ],
    totalReviewCount: 840,
    averageRating: 4.97,
    landmark: 'M-Block Market, GK-1, Near Nik Bakers',
    parkingInfo: 'Valet and dedicated market parking lot nearby',
    openHourText: '10:00 AM',
    closeHourText: '8:00 PM'
  },

  nail_studio: {
    foundingYear: '2021',
    foundingNarrative: 'Polished Palette was established to turn nail aesthetics into bespoke micro-art. From mirror-chrome glazed donuts to Russian cuticle precision, our studio sets the benchmark for high-fashion nail extensions.',
    specialties: ['Russian Dry E-File Cuticle Care', 'Chrome & Cat-Eye Gel Art', 'Sculpted Gel Extensions', 'Spa Paraffin Pedicures'],
    certifications: [
      { icon: 'verified', title: 'Individual Sealed Drill Bits', description: 'Diamond and ceramic E-file bits sterilized in medical autoclave bags.' },
      { icon: 'eco', title: '9-Free Toxin-Safe Gel Polishes', description: 'Formulations free from formaldehyde, toluene, and DBP.' },
      { icon: 'airline_seat_recline_extra', title: 'Ergonomic Japanese Nail Desks', description: 'Built-in HEPA dust collectors for zero inhalation of fine nail powders.' },
      { icon: 'brush', title: 'Certified Russian Manicurists', description: 'Precision e-file cuticle techniques that last up to 4 weeks without peeling.' }
    ],
    gallery: [
      { id: 'ns-g1', url: SALON_IMAGES.nailArt, title: 'Glossy Chrome Gel Nail Art & Aura Design', tag: 'Nail Art' },
      { id: 'ns-g2', url: SALON_IMAGES.lashBrow, title: 'Lash Extensions & Laminated Brows', tag: 'Lash & Brow' },
      { id: 'ns-g3', url: SALON_IMAGES.hero, title: 'Modern Nail, Lash & Brow Studio Interior', tag: 'Studio Interior' },
      { id: 'ns-g4', url: SALON_IMAGES.toolsSetup, title: 'Sterilized Salon Tools & Gel Polish Flatlay', tag: 'Tools & Setup' },
      { id: 'ns-g5', url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=800&q=80', title: 'Russian Dry Manicure Cuticle Precision', tag: 'Cuticle Care' },
      { id: 'ns-g6', url: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=800&q=80', title: 'Luxury Jelly Pedicure Station', tag: 'Pedicure Lounge' }
    ],
    reviews: [
      { id: 'ns-r1', name: 'Ayesha Shroff', location: 'Jubilee Hills, Hyderabad', rating: 5, serviceName: 'Russian Dry E-File Gel Manicure', comment: 'My nails have never looked this clean. The Russian technique is unbelievable—zero hangnails and still perfect after 3 weeks!', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80', date: '3 days ago' },
      { id: 'ns-r2', name: 'Zoya Qureshi', location: 'Banjara Hills, Hyderabad', rating: 5, serviceName: 'Full Set Sculpted Hard Gel Extensions', comment: 'They created the exact Pinterest chrome design I requested. The studio has built-in dust collectors so no chemical smells whatsoever.', avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80', date: '1 week ago' },
      { id: 'ns-r3', name: 'Sneha Reddy', location: 'Gachibowli, Hyderabad', rating: 5, serviceName: 'Cat-Eye Magnetic Gel Overlay', comment: 'The lighting, velvet chairs, and iced green tea they serve makes this a 5-star experience every single time.', avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80', date: '2 weeks ago' }
    ],
    totalReviewCount: 460,
    averageRating: 4.96,
    landmark: 'Road No. 36, Jubilee Hills, Beside Starbucks',
    parkingInfo: 'Complimentary valet parking right outside the studio',
    openHourText: '10:30 AM',
    closeHourText: '8:30 PM'
  },

  hair_spa: {
    foundingYear: '2020',
    foundingNarrative: 'Trichology Sanctuary is an oasis engineered to heal scalp inflammation, revive thinning follicles, and restore biological hair health through micro-mist ozone chambers and deep Ayurvedic hair rituals.',
    specialties: ['Trichology Scalp Barrier Therapy', 'Ozone Steam Follicle Infusion', 'Dandruff Peeling Detox', 'Caviar Hair Hydration'],
    certifications: [
      { icon: 'verified', title: 'Trichological Scalp Camera Diagnostics', description: '500x digital magnification mapping pore density and sebum before treatment.' },
      { icon: 'spa', title: 'Cold-Pressed Botanical Elixirs', description: 'Handcrafted bhringraj, brahmi, and rosemary essential blends.' },
      { icon: 'air', title: 'Japanese Ultrasonic Micro-Mister', description: 'Splits water particles to microscopic size for 90% deeper moisture penetration.' },
      { icon: 'science', title: 'Clinical Trichology Protocol', description: 'Non-invasive therapies supervised by certified scalp wellness experts.' }
    ],
    gallery: [
      { id: 'sp-g1', url: 'https://images.unsplash.com/photo-1560750588-73207b1ef5b8?auto=format&fit=crop&w=800&q=80', title: 'Japanese Head Spa Ozone Mist Dome', tag: 'Micro-Mist' },
      { id: 'sp-g2', url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80', title: 'Digital 500x Scalp Diagnostic Camera', tag: 'Trichology' },
      { id: 'sp-g3', url: 'https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&w=800&q=80', title: 'Botanical Hair Mask Application', tag: 'Herbal Therapy' },
      { id: 'sp-g4', url: 'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=800&q=80', title: 'Serene Zen Head Wash Beds', tag: 'Interior' },
      { id: 'sp-g5', url: 'https://images.unsplash.com/photo-1605497788044-5a32c7078486?auto=format&fit=crop&w=800&q=80', title: 'Silky Gloss Follicle Restoration', tag: 'Results' },
      { id: 'sp-g6', url: 'https://images.unsplash.com/photo-1512290900672-1f55b9e07506?auto=format&fit=crop&w=800&q=80', title: 'Aromatherapy Scalp Pressure Points', tag: 'Acupressure' }
    ],
    reviews: [
      { id: 'sp-r1', name: 'Priya Nambiar', location: 'Kakkanad, Kochi', rating: 5, serviceName: 'Intense Anti-Hairfall Keratin Stem Cell Infusion', comment: 'I was losing hair severely postpartum. After 3 sessions of their ozone mist treatment, shedding dropped drastically. Pure clinical magic!', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80', date: '3 days ago' },
      { id: 'sp-r2', name: 'Gautam Menon', location: 'Panampilly Nagar, Kochi', rating: 5, serviceName: 'Deep Scalp Clarifying & Peeling Treatment', comment: 'The digital scalp diagnostic before and after was eye-opening. Cleared my chronic scalp buildup in one session.', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80', date: '1 week ago' },
      { id: 'sp-r3', name: 'Divya Kurup', location: 'Marine Drive, Kochi', rating: 5, serviceName: 'Ayurvedic Kesh Vardhana Head Massage', comment: 'The warm herbal oils and head acupressure melted away months of desk stress. Felt completely rejuvenated.', avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80', date: '2 weeks ago' }
    ],
    totalReviewCount: 390,
    averageRating: 4.97,
    landmark: 'Main Avenue, Panampilly Nagar, Near Central Park',
    parkingInfo: 'Dedicated customer car parking available in front of clinic',
    openHourText: '09:30 AM',
    closeHourText: '8:00 PM'
  },

  skincare_clinic: {
    foundingYear: '2019',
    foundingNarrative: 'Dermalux is a clinical medical-aesthetic clinic bridging certified dermatology science and luxurious restorative facial protocols. We specialize in non-invasive skin remodeling, pigmentation correction, and medical hydra-dermabrasion.',
    specialties: ['Medical Hydra-Dermabrasion', 'Glutathione Radiance Peel', 'LED Phototherapy', 'Acne Scar Rejuvenation'],
    certifications: [
      { icon: 'verified', title: 'US-FDA Approved Technology', description: 'All clinical medical devices certified for safety across Indian Fitzpatrick skin types.' },
      { icon: 'sanitizer', title: 'Sterile Clinical Environment', description: 'Hospital-standard laminar airflow and sterile disposables.' },
      { icon: 'dermatology', title: 'Board-Certified Cosmetologists', description: 'Skin assessments directed by licensed medical dermatologists.' },
      { icon: 'science', title: 'Targeted Active Ingredients', description: 'Medical grade serums with clinical actives including niacinamide & peptides.' }
    ],
    gallery: [
      { id: 'sc-g1', url: 'https://images.unsplash.com/photo-1512290900672-1f55b9e07506?auto=format&fit=crop&w=800&q=80', title: 'Clinical Medical Hydra-Facial Suite', tag: 'Treatment Room' },
      { id: 'sc-g2', url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=800&q=80', title: 'Blue & Red Light LED Phototherapy', tag: 'Technology' },
      { id: 'sc-g3', url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80', title: 'Clinical Skin Consultation & Mapping', tag: 'Diagnostics' },
      { id: 'sc-g4', url: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=800&q=80', title: 'Targeted Hyaluronic Acid Infusion', tag: 'Hydration' },
      { id: 'sc-g5', url: 'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=800&q=80', title: 'Sterile Reception & Consultation Bay', tag: 'Interior' },
      { id: 'sc-g6', url: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=800&q=80', title: 'Glass Skin Radiance Transformation', tag: 'Results' }
    ],
    reviews: [
      { id: 'sc-r1', name: 'Dr. Shalini Ghosh', location: 'Salt Lake Sector V, Kolkata', rating: 5, serviceName: 'Hydra-Facial MD with Peptides', comment: 'As a medical professional, I am extremely picky about clinics. Dermalux maintains flawless sterilization and top US-FDA machines. Skin looked radiant!', avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80', date: '2 days ago' },
      { id: 'sc-r2', name: 'Tanmoy Mukherjee', location: 'Park Street, Kolkata', rating: 5, serviceName: 'Clinical Carbon Laser Peel', comment: 'Removed stubborn open pores and hyperpigmentation after just 2 sessions. Transparent pricing and no false promises.', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80', date: '5 days ago' },
      { id: 'sc-r3', name: 'Sayantani Sen', location: 'New Town, Kolkata', rating: 5, serviceName: 'Glutathione Brightening Peel', comment: 'Zero downtime and glowing skin for my cousin’s wedding. The team explains every ingredient they apply to your face.', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80', date: '2 weeks ago' }
    ],
    totalReviewCount: 580,
    averageRating: 4.97,
    landmark: 'Block EP & GP, Sector V, Near Wipro Circle',
    parkingInfo: 'Free on-site basement visitor parking available',
    openHourText: '10:00 AM',
    closeHourText: '8:00 PM'
  },

  makeup_studio: {
    foundingYear: '2017',
    foundingNarrative: 'Glamour House is an editorial, bridal, and celebrity makeup atelier in South Mumbai. We engineer camera-ready, sweatproof makeup for high-profile weddings, red carpets, and digital film productions.',
    specialties: ['HD Airbrush Bridal Glam', 'Cocktail & Sangeet Makeovers', 'Monochrome Editorial Looks', 'Masterclasses'],
    certifications: [
      { icon: 'verified', title: '100% Original Global Cosmetics', description: 'Authenticated palettes from Charlotte Tilbury, Dior, NARS, and MAC.' },
      { icon: 'brush', title: 'Disinfected Brushes & Palettes', description: 'Cinema Secrets 99.9% antibacterial brush sanitation between every face.' },
      { icon: 'wb_incandescent', title: 'High-CRI 98+ Vanity Lighting', description: 'Daylight balanced 5500K mirror illumination to ensure 100% true tone match.' },
      { icon: 'workspace_premium', title: 'Bollywood Celebrity Credits', description: 'Artists trusted by leading models, actresses, and destination brides.' }
    ],
    gallery: [
      { id: 'ms-g1', url: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=800&q=80', title: 'Royal Indian Bridal HD Glow', tag: 'Bridal' },
      { id: 'ms-g2', url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80', title: 'Hollywood Vanity Mirror Lighting', tag: 'Vanity Station' },
      { id: 'ms-g3', url: 'https://images.unsplash.com/photo-1512290900672-1f55b9e07506?auto=format&fit=crop&w=800&q=80', title: 'Soft Glam Sangeet & Reception Look', tag: 'Evening Glam' },
      { id: 'ms-g4', url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=800&q=80', title: 'Precision Wing & Editorial Smokey Eye', tag: 'Eye Artistry' },
      { id: 'ms-g5', url: 'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=800&q=80', title: 'Bridal Suite & Dressing Mirrors', tag: 'Lounge' },
      { id: 'ms-g6', url: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=800&q=80', title: 'Flawless Airbrush Base Application', tag: 'Airbrush' }
    ],
    reviews: [
      { id: 'ms-r1', name: 'Natasha Poonawalla', location: 'Colaba, Mumbai', rating: 5, serviceName: 'Bridal HD Airbrush Makeover', comment: 'Rhea made me look like the best version of myself on my wedding day! My makeup stayed flawless through 14 hours of humid coastal weather.', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80', date: '3 days ago' },
      { id: 'ms-r2', name: 'Tara Sutaria', location: 'Altamount Road, Mumbai', rating: 5, serviceName: 'Red Carpet Cocktail Glow', comment: 'The skin prep was sublime. No caked foundation—just radiant, luminous skin that photographed like dream editorial magazine covers.', avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80', date: '1 week ago' },
      { id: 'ms-r3', name: 'Mira Rajput', location: 'Worli Sea Face, Mumbai', rating: 5, serviceName: 'Editorial Sangeet Smokey Eye', comment: 'Utterly professional. The sanitized brush hygiene was reassuring, and the studio vanity lighting was mesmerizing.', avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80', date: '3 weeks ago' }
    ],
    totalReviewCount: 620,
    averageRating: 4.98,
    landmark: 'Babulnath Road, Chowpatty, Near Wilson College',
    parkingInfo: 'Secure valet parking inside the studio premises',
    openHourText: '09:00 AM',
    closeHourText: '8:30 PM'
  },

  massage_wellness: {
    foundingYear: '2019',
    foundingNarrative: 'Serene Palm is a tranquil wellness oasis designed to detoxify the urban nervous system through Swedish deep tissue therapy, warm volcanic basalt stones, and custom cold-pressed botanical aromatherapy.',
    specialties: ['Deep Tissue Muscle Release', 'Volcanic Hot Stone Therapy', 'Balinese Aromatherapy', 'Foot Reflexology'],
    certifications: [
      { icon: 'verified', title: '100% Certified Therapists', description: 'Certified massage therapists trained in Thai, Swedish, and trigger-point anatomy.' },
      { icon: 'spa', title: 'Cold-Pressed Virgin Oils', description: 'Pure carrier oils infused with organic French lavender and Himalayan cedarwood.' },
      { icon: 'dry_cleaning', title: 'Linen Thermal Sterilization', description: '100% Egyptian cotton linens sanitized in high-temperature laundries.' },
      { icon: 'volume_off', title: 'Acoustic Soundproofing', description: 'Therapy chambers built with sound-dampening walls for total silence.' }
    ],
    gallery: [
      { id: 'mw-g1', url: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=800&q=80', title: 'Volcanic Basalt Hot Stone Therapy', tag: 'Hot Stone' },
      { id: 'mw-g2', url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80', title: 'Tranquil Couple Massage Suite', tag: 'Couple Suite' },
      { id: 'mw-g3', url: 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?auto=format&fit=crop&w=800&q=80', title: 'Aromatherapy Herbal Oil Selection', tag: 'Botanical Oils' },
      { id: 'mw-g4', url: 'https://images.unsplash.com/photo-1512290900672-1f55b9e07506?auto=format&fit=crop&w=800&q=80', title: 'Private Steam & Shower Chamber', tag: 'Facilities' },
      { id: 'mw-g5', url: 'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=800&q=80', title: 'Bamboo Lounge & Herbal Tea Bar', tag: 'Lounge' },
      { id: 'mw-g6', url: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=800&q=80', title: 'Thai Herbal Compress Healing', tag: 'Herbal Compress' }
    ],
    reviews: [
      { id: 'mw-r1', name: 'Vikram Joshi', location: 'Koregaon Park, Pune', rating: 5, serviceName: 'Deep Tissue Sports Therapy 90 mins', comment: 'Had severe lumbar knotting from marathon training. The therapist worked out every muscle knot with surgical precision. Best spa in Pune.', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80', date: 'Yesterday' },
      { id: 'mw-r2', name: 'Radhika Kirloskar', location: 'Kalyani Nagar, Pune', rating: 5, serviceName: 'Warm Volcanic Stone & Lavender Ritual', comment: 'Total serenity. From the lemongrass cold towel upon arrival to the warm stone glide, every detail was transcendent.', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80', date: '4 days ago' },
      { id: 'mw-r3', name: 'Ashok Deshmukh', location: 'Viman Nagar, Pune', rating: 5, serviceName: 'Balinese Aromatherapy Massage', comment: 'Incredible acoustic insulation—you cannot hear a whisper of city traffic. Came out feeling 10 years younger.', avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80', date: '1 week ago' }
    ],
    totalReviewCount: 750,
    averageRating: 4.98,
    landmark: 'Lane 7, Koregaon Park, Near Osho Ashram Gate',
    parkingInfo: 'Private gated courtyard with free valet parking',
    openHourText: '09:00 AM',
    closeHourText: '9:30 PM'
  },

  hair_coloring: {
    foundingYear: '2020',
    foundingNarrative: 'Chroma Hair Coloring Studio is North India’s dedicated color chemistry and balayage atelier. We specialize in seamless Asian dark-hair lightening, ash blonde transitions, and vibrant copper tones with bond-protecting Plex science.',
    specialties: ['French Freehand Balayage', 'Ash & Biscuit Blonde Lightening', 'Rich Auburn & Copper Waves', 'Bond-Builder Olaplex Reversal'],
    certifications: [
      { icon: 'verified', title: 'Bond Multiplier Technology', description: 'Every bleaching formulation fortified with Olaplex to protect 98% hair integrity.' },
      { icon: 'palette', title: 'Ammonia-Free European Pigments', description: 'Enriched with argan oil and silk proteins for mirror-like color shine.' },
      { icon: 'flare', title: 'CRI 98+ True-Spectrum Wash Stations', description: 'Color diagnostics under daylight lighting to guarantee zero brassiness.' },
      { icon: 'workspace_premium', title: 'L’Oréal Master Color Certified', description: 'Colorists undergo 300+ hours of advanced color chemistry training.' }
    ],
    gallery: [
      { id: 'hc-g1', url: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=800&q=80', title: 'Seamless Caramel Balayage on Dark Hair', tag: 'Balayage' },
      { id: 'hc-g2', url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80', title: 'Cool Ash Blonde Transition with Olaplex', tag: 'Lightening' },
      { id: 'hc-g3', url: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80', title: 'Color Mixing Bar & Custom Swatches', tag: 'Color Lab' },
      { id: 'hc-g4', url: 'https://images.unsplash.com/photo-1605497788044-5a32c7078486?auto=format&fit=crop&w=800&q=80', title: 'Rich Copper Cinnamon Dimensional Tone', tag: 'Copper Tones' },
      { id: 'hc-g5', url: 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=800&q=80', title: 'Pastel Rose Gold Money Piece', tag: 'Fashion Color' },
      { id: 'hc-g6', url: 'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?auto=format&fit=crop&w=800&q=80', title: 'Post-Color Glaze Wash & Conditioning', tag: 'Gloss Finish' }
    ],
    reviews: [
      { id: 'hc-r1', name: 'Kritika Khurana', location: 'Vasant Vihar, New Delhi', rating: 5, serviceName: 'Bespoke Balayage & Glaze Gloss', comment: 'Lightening dark Indian hair without brassiness is an art few understand. Chroma gave me the softest, most seamless hazelnut balayage ever!', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80', date: '2 days ago' },
      { id: 'hc-r2', name: 'Ishita Mangal', location: 'Chanakyapuri, New Delhi', rating: 5, serviceName: 'Ash Blonde Transformation + Olaplex', comment: 'Zero breakage thanks to their Olaplex protocol. The colorists here are real chemists who understand tone neutralization.', avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80', date: '1 week ago' },
      { id: 'hc-r3', name: 'Mallika Dua', location: 'Hauz Khas, New Delhi', rating: 5, serviceName: 'Global Gloss Tone & Anti-Brass Wash', comment: 'Refreshed my dull faded color in 40 minutes. Gorgeous mirror gloss and very chic studio atmosphere.', avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80', date: '2 weeks ago' }
    ],
    totalReviewCount: 490,
    averageRating: 4.96,
    landmark: 'Basant Lok Community Centre, Vasant Vihar, Near Priya Cinema',
    parkingInfo: 'Valet parking available at Basant Lok plaza',
    openHourText: '10:00 AM',
    closeHourText: '8:30 PM'
  },

  bridal_lounge: {
    foundingYear: '2015',
    foundingNarrative: 'Maharani Bridal Lounge is Rajasthan’s premier luxury bridal styling sanctum. We design heirloom bridal makeovers, dupatta draping, royal mehendi looks, and jewelry integration for destination and royal Indian palace weddings.',
    specialties: ['Royal Palace HD Bridal Makeover', 'Heritage Dupatta & Saree Draping', 'Airbrush 24H Waterproof Base', 'Pre-Bridal Saffron Polish'],
    certifications: [
      { icon: 'verified', title: 'Private Presidential Bridal Suites', description: 'Luxurious private dressing chambers accommodating bride and her bridal party.' },
      { icon: 'diamond', title: 'Jewelry & Fabric Integration Care', description: 'Specialist drape artists certified in heavy antique zardozi, silk, and kundan styling.' },
      { icon: 'water_drop', title: '24-Hour Tears & Humidity Proof', description: 'Custom waterproofing sealants certified for 18+ hours of varmala & pheras.' },
      { icon: 'stars', title: 'Featured in Vogue & WedMeGood', description: 'Ranked top luxury destination wedding salon in Rajasthan.' }
    ],
    gallery: [
      { id: 'bl-g1', url: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=800&q=80', title: 'Royal Rajasthani Heritage Bridal Glow', tag: 'Bridal Makeover' },
      { id: 'bl-g2', url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=800&q=80', title: 'Kundan Matha Patti & Dupatta Draping', tag: 'Draping Art' },
      { id: 'bl-g3', url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80', title: 'Private Palatial Bridal Suite', tag: 'Suite Interior' },
      { id: 'bl-g4', url: 'https://images.unsplash.com/photo-1512290900672-1f55b9e07506?auto=format&fit=crop&w=800&q=80', title: 'Floral Bun & Hair Jewelry Architecture', tag: 'Hair Architecture' },
      { id: 'bl-g5', url: 'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=800&q=80', title: 'Pre-Wedding Saffron Body Polish Room', tag: 'Pre-Bridal' },
      { id: 'bl-g6', url: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=800&q=80', title: 'Destination Bride Sunset Portrait', tag: 'Destination' }
    ],
    reviews: [
      { id: 'bl-r1', name: 'Princess Gayatri Rathore', location: 'C-Scheme, Jaipur', rating: 5, serviceName: 'Maharani Full Bridal HD Makeover & Draping', comment: 'Gayatri ji and her bridal team made me look like royalty for my palace wedding. The dupatta draping held 12kg of zardozi comfortably for 14 hours!', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80', date: '3 days ago' },
      { id: 'bl-r2', name: 'Ananya Singhal', location: 'Rambagh, Jaipur', rating: 5, serviceName: 'Destination Bride Sangeet Look', comment: 'Traveled from London for my Jaipur wedding. The team was punctual, reassuring, and the airbrush base stayed immaculate throughout the pheras.', avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80', date: '1 week ago' },
      { id: 'bl-r3', name: 'Pooja Shekhawat', location: 'Civil Lines, Jaipur', rating: 5, serviceName: 'Pre-Bridal Royal Kesar Ubtan Polish', comment: 'The pre-bridal skin therapy cleared all fatigue and gave my face an ethereal golden sheen. The private suite feels like a royal palace.', avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80', date: '2 weeks ago' }
    ],
    totalReviewCount: 890,
    averageRating: 4.99,
    landmark: 'Mirza Ismail Road (MI Road), Opposite Raj Mandir Cinema',
    parkingInfo: 'Private gated bridal courtyard with security and valet',
    openHourText: '09:00 AM',
    closeHourText: '9:00 PM'
  },

  tattoo_studio: {
    foundingYear: '2017',
    foundingNarrative: 'Iron & Ink is Bengaluru’s foremost sterile custom tattoo and body piercing studio on Church Street. We specialize in intricate fine-line micro-realism, sacred geometry, and custom Indian mythological sleeves.',
    specialties: ['Single-Needle Fine Line', 'Sacred Geometry & Mandalas', 'Micro-Realism Portraits', 'Titanium Body Piercings'],
    certifications: [
      { icon: 'verified', title: 'Hospital Class-B Autoclave Sterilization', description: 'Every grip, tube, and tool sanitized in medical vacuum chambers.' },
      { icon: 'colorize', title: 'Single-Use Sealed Needle Cartridges', description: 'Cheyenne and Kwadron sterile cartridges opened fresh in front of the client.' },
      { icon: 'eco', title: '100% Vegan Certified Inks', description: 'Kuro Sumi and Dynamic pure black pigments, non-toxic and hypoallergenic.' },
      { icon: 'healing', title: 'Medical Derm-Shield Aftercare', description: 'Second-skin sterile waterproof barrier application for 100% infection prevention.' }
    ],
    gallery: [
      { id: 'ts-g1', url: 'https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28?auto=format&fit=crop&w=800&q=80', title: 'Fine-Line Micro Realism Mandala', tag: 'Fine Line' },
      { id: 'ts-g2', url: 'https://images.unsplash.com/photo-1562962230-16e4623d36e6?auto=format&fit=crop&w=800&q=80', title: 'Sterile Black Metal Tattoo Station', tag: 'Studio Interior' },
      { id: 'ts-g3', url: 'https://images.unsplash.com/photo-1611501275019-9b5cda994e8d?auto=format&fit=crop&w=800&q=80', title: 'Intricate Sacred Geometry Sleeve', tag: 'Custom Sleeve' },
      { id: 'ts-g4', url: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80', title: 'Consultation & Digital Stencil Drafting', tag: 'Custom Design' },
      { id: 'ts-g5', url: 'https://images.unsplash.com/photo-1517832606589-7157be614532?auto=format&fit=crop&w=800&q=80', title: 'Minimalist Botanical Floral Ankle Tattoo', tag: 'Minimalist' },
      { id: 'ts-g6', url: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=800&q=80', title: 'Implant-Grade Titanium Ear Curation', tag: 'Piercing' }
    ],
    reviews: [
      { id: 'ts-r1', name: 'Devendra Gowda', location: 'Church Street, Bengaluru', rating: 5, serviceName: 'Custom Dark Realism', comment: 'Rudra is a genius. Cleanest needle work in India. The studio hygiene looks cleaner than a hospital operating theatre. 10/10.', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80', date: 'Yesterday' },
      { id: 'ts-r2', name: 'Natasha D’Souza', location: 'MG Road, Bengaluru', rating: 5, serviceName: 'High-Contrast Monochrome', comment: 'The fine line detail on my dog’s portrait blew my mind. Healed seamlessly with the Derm-Shield they provided.', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80', date: '3 days ago' },
      { id: 'ts-r3', name: 'Karthik Raman', location: 'Indiranagar, Bengaluru', rating: 5, serviceName: 'Surgical Body Piercings', comment: 'Pierced with surgical needle, not a gun! Virtually zero pain, and the titanium jewelry looks stunning.', avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80', date: '1 week ago' }
    ],
    totalReviewCount: 790,
    averageRating: 4.99,
    landmark: 'Church Street, Off Brigade Road, Above Blossoms Book House',
    parkingInfo: 'MG Road Metro station parking 2 mins walk away',
    openHourText: '11:00 AM',
    closeHourText: '9:00 PM'
  },

  lash_brow: {
    foundingYear: '2020',
    foundingNarrative: 'The Brow & Lash Loft is South Delhi’s premier boutique specializing in Russian volume lash extensions, semi-permanent nano-blading, and keratin lash lifts tailored to elevate natural facial architecture.',
    specialties: ['Russian Volume Mega Lashes', 'Keratin Lash Infusion Lift', 'HD Brow Lamination', 'Nano-Blading Hair Strokes'],
    certifications: [
      { icon: 'verified', title: 'Medical-Grade Fume-Free Adhesives', description: 'Latex-free and formaldehyde-free surgical adhesives safe for sensitive eyes.' },
      { icon: 'remove_red_eye', title: 'Natural Lash Weight Safety', description: 'Zero damage to natural follicles through custom 0.05mm ultra-lightweight silk fibers.' },
      { icon: 'sanitizer', title: 'Surgical Tweezers Sterilization', description: 'Precision tweezers autoclaved and UV-sterilized before every client.' },
      { icon: 'workspace_premium', title: 'PhiBrows Royal Artist Certified', description: 'Permanent makeup performed by internationally certified microblading masters.' }
    ],
    gallery: [
      { id: 'lb-g1', url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=800&q=80', title: 'Feathered Brow Lamination & Tint', tag: 'Brows' },
      { id: 'lb-g2', url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80', title: 'Fluffy Russian Volume Lash Set', tag: 'Lashes' },
      { id: 'lb-g3', url: 'https://images.unsplash.com/photo-1512290900672-1f55b9e07506?auto=format&fit=crop&w=800&q=80', title: 'Ergonomic Memory Foam Lash Beds', tag: 'Studio Interior' },
      { id: 'lb-g4', url: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=800&q=80', title: 'Keratin Lash Lift Before & After', tag: 'Natural Lift' },
      { id: 'lb-g5', url: 'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=800&q=80', title: 'Precision Nano-Blading Hair Strokes', tag: 'Microblading' },
      { id: 'lb-g6', url: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=800&q=80', title: 'Clean Consultation & Brow Mapping', tag: 'Consultation' }
    ],
    reviews: [
      { id: 'lb-r1', name: 'Sonam Kapoor Ahuja', location: 'Khan Market, New Delhi', rating: 5, serviceName: 'Russian Volume Lashes & Brow Lamination', comment: 'The memory foam beds are so comfy I fell asleep immediately! Woke up with the fluffiest, lightest lashes imaginable. Total game changer.', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80', date: '3 days ago' },
      { id: 'lb-r2', name: 'Mallika Sherawat', location: 'Golf Links, New Delhi', rating: 5, serviceName: 'Keratin Lash Lift & Botox Tint', comment: 'Zero burning or red eyes. My natural lashes look curly and dark without needing mascara for 8 weeks.', avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80', date: '1 week ago' },
      { id: 'lb-r3', name: 'Ananya Birla', location: 'Sundar Nagar, New Delhi', rating: 5, serviceName: 'PhiBrows Microblading Hair Strokes', comment: 'Restored my overplucked 90s brows to lush, natural perfection. The artist mapped my bone structure with precision calipers.', avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80', date: '2 weeks ago' }
    ],
    totalReviewCount: 440,
    averageRating: 4.96,
    landmark: 'Middle Lane, Khan Market, Near Cafe Turtle',
    parkingInfo: 'Market parking lot with attendant assistance',
    openHourText: '10:30 AM',
    closeHourText: '8:00 PM'
  },

  ayurvedic_spa: {
    foundingYear: '2016',
    foundingNarrative: 'Sanjivani Ayurvedic Rejuvenation Spa honors the centuries-old Kerala Vaidya tradition in Chennai. We practice authentic Panchakarma therapies, continuous warm herbal Shirodhara oil streams, Vedic herbal lepams, and authentic panchakarma rituals.',
    specialties: ['Shirodhara Medicated Oil Stream', 'Traditional Kerala Abhyanga', 'Navara Kizhi Rice Poultice', 'Mukha Lepam Herbal Facial'],
    certifications: [
      { icon: 'verified', title: 'Authentic Kerala Droni Wooden Beds', description: 'Handcrafted seasoned Neem and Vengai wood massage tables.' },
      { icon: 'spa', title: 'Kottakkal Arya Vaidya Sala Oils', description: 'Certified classical medicated thailams prepared per Ashtanga Hridaya texts.' },
      { icon: 'local_pharmacy', title: 'Consultations by BAMS Ayurvedic Doctors', description: 'Prakriti (Vata, Pitta, Kapha) dosha analysis before oil formulation.' },
      { icon: 'eco', title: '100% Chemical-Free Botanical Care', description: 'Organic sun-dried wild herbs, cow’s milk, and Navara medicinal rice.' }
    ],
    gallery: [
      { id: 'ay-g1', url: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=800&q=80', title: 'Bronze Vessel Shirodhara Oil Stream', tag: 'Shirodhara' },
      { id: 'ay-g2', url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80', title: 'Authentic Teakwood Droni Therapy Bed', tag: 'Traditional Bed' },
      { id: 'ay-g3', url: 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?auto=format&fit=crop&w=800&q=80', title: 'Warm Herbal Kizhi Poultice Preparation', tag: 'Herbal Kizhi' },
      { id: 'ay-g4', url: 'https://images.unsplash.com/photo-1512290900672-1f55b9e07506?auto=format&fit=crop&w=800&q=80', title: 'Brass Herb Steamer & Herbal Bath', tag: 'Herbal Steam' },
      { id: 'ay-g5', url: 'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=800&q=80', title: 'Ayurvedic Doctor Consultation Chamber', tag: 'Diagnostics' },
      { id: 'ay-g6', url: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=800&q=80', title: 'Classical Medicated Tailam Dispensary', tag: 'Herbal Oils' }
    ],
    reviews: [
      { id: 'ay-r1', name: 'Sundararajan Krishnan', location: 'Besant Nagar, Chennai', rating: 5, serviceName: 'Medicated Shirodhara', comment: 'The Shirodhara with warm medicated sesame oil cured my insomnia within 2 sessions. Genuine Kerala Vaidyas and pristine herbal aromas.', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80', date: '2 days ago' },
      { id: 'ay-r2', name: 'Lakshmi Narayanan', location: 'Adyar, Chennai', rating: 5, serviceName: 'Authentic Kerala Panchakarma', comment: 'Healed severe joint stiffness in my knees. Dr. Nair conducted an in-depth pulse reading and prescribed the exact herbal regimen.', avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80', date: '6 days ago' },
      { id: 'ay-r3', name: 'Madhavan Venkat', location: 'Thiruvanmiyur, Chennai', rating: 5, serviceName: 'Vedic Herbal Lepams', comment: 'Leaves you completely grounded and peaceful. The teakwood droni and copper vessels show their deep respect for classical tradition.', avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80', date: '2 weeks ago' }
    ],
    totalReviewCount: 810,
    averageRating: 4.98,
    landmark: 'Beach Road, Besant Nagar, Near Elliot’s Beach Promenade',
    parkingInfo: 'Private garden compound with ample car parking space',
    openHourText: '08:30 AM',
    closeHourText: '8:30 PM'
  },

  ayurvedic_wellness_spa: {
    foundingYear: '2018',
    foundingNarrative: 'Sattva Ayurvedic & Wellness Spa began as a family vaidya practice in Rishikesh and has grown into a holistic wellness destination where every therapy starts with Nadi Pariksha pulse diagnosis and authentic herbal oils prepared the classical way.',
    specialties: ['Nadi Pariksha Pulse Diagnosis', 'Dhanwantharam Abhyangam', 'Bringamadi Shirodhara', 'Dosha-Balancing Detox Protocols'],
    certifications: [
      { icon: 'verified', title: 'Classical Ashtanga Ayurveda Training', description: 'Therapists trained per Charaka Samhita protocols under registered BAMS physicians.' },
      { icon: 'eco', title: 'Authentic Medicated Herbal Oils', description: 'Sun-dried Dhanwantharam and Bringamadi herbs slow-cooked in cold-pressed sesame oil.' },
      { icon: 'monitoring', title: 'Personalized Dosha Mapping', description: 'Vata, Pitta, and Kapha constitution charted through pulse diagnosis before every regimen.' },
      { icon: 'spa', title: 'Ganges-Adjacent Panchakarma Suites', description: 'Private therapy rooms with traditional wooden dronis and copper steam systems.' }
    ],
    gallery: [
      { id: 'aws-g1', url: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=800&q=80', title: 'Bronze Vessel Shirodhara Oil Stream', tag: 'Shirodhara' },
      { id: 'aws-g2', url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80', title: 'Teakwood Droni Therapy Bed', tag: 'Traditional Bed' },
      { id: 'aws-g3', url: 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?auto=format&fit=crop&w=800&q=80', title: 'Elakizhi Herbal Poultice Preparation', tag: 'Herbal Kizhi' },
      { id: 'aws-g4', url: 'https://images.unsplash.com/photo-1512290900672-1f55b9e07506?auto=format&fit=crop&w=800&q=80', title: 'Swedana Copper Herbal Steam Bath', tag: 'Herbal Steam' },
      { id: 'aws-g5', url: 'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=800&q=80', title: 'Nadi Pariksha Pulse Diagnosis Chamber', tag: 'Diagnostics' },
      { id: 'aws-g6', url: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=800&q=80', title: 'Medicated Tailam Oil Dispensary', tag: 'Herbal Oils' }
    ],
    reviews: [
      { id: 'aws-r1', name: 'Kavita Bhattacharya', location: 'Dehradun', rating: 5, serviceName: 'Abhyangam Full Body Therapy', comment: 'After the Nadi Pariksha consult, my Vata-imbalance insomnia simply melted away. The Dhanwantharam oil massage left my whole body sinking into deep, restful physical relaxation.', avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80', date: '3 days ago' },
      { id: 'aws-r2', name: 'Arjun Malhotra', location: 'New Delhi', rating: 5, serviceName: 'Medicated Shirodhara Stream', comment: 'The warm Bringamadi oil stream over my third eye is the closest thing to true silence I have ever felt. My Pitta headaches vanished within a week of sessions.', avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80', date: '1 week ago' },
      { id: 'aws-r3', name: 'Divya Menon', location: 'Kochi', rating: 5, serviceName: 'Swedana Steam & Detox', comment: 'The herbal steam detox drew out years of sluggish Kapha. I have never left a spa feeling this light, clean, and deeply relaxed.', avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80', date: '2 weeks ago' }
    ],
    totalReviewCount: 640,
    averageRating: 4.97,
    landmark: 'Lakshman Jhula, Tapovan, Near Parvati Ashram',
    parkingInfo: 'Covered ashram-side parking 100 m from the spa courtyard',
    openHourText: '08:00 AM',
    closeHourText: '8:00 PM'
  },

  luxury_hair_salon: {
    foundingYear: '2015',
    foundingNarrative: 'Maison Éclat began as a private hair atelier in Delhi’s South Extension, serving a select clientele with haute-couture cuts, hand-painted color, and Kérastase- and Olaplex-driven repair rituals that treat every head of hair as a couture canvas.',
    specialties: ['Haute-Couture Precision Cutting', 'French Balayage & Tonal Glossing', 'Olaplex Molecular Bond Repair', 'Long-Lasting Keratin Glossing'],
    certifications: [
      { icon: 'verified', title: 'Kérastase Institute Certified Artists', description: 'Every stylist trained on the Kérastase Studio Paris cutting, color, and care curriculum.' },
      { icon: 'auto_awesome', title: 'Olaplex Bond Builder Protocol', description: 'Bond repair performed to the clinical Olaplex in-salon treatment protocol.' },
      { icon: 'face_retouching_natural', title: 'Bespoke Hair-Mapping Consultation', description: 'Face geometry, density, and fiber diagnostics mapped before every cut or color.' },
      { icon: 'workspace_premium', title: 'Private Atelier Appointments', description: 'One client at a time in a private suite, with champagne service on request.' }
    ],
    gallery: [
      { id: 'lhx-g1', url: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80', title: 'Precision Sculpt at the Styling Station', tag: 'Precision Cut' },
      { id: 'lhx-g2', url: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=800&q=80', title: 'Hand-Painted Balayage & Tonal Gloss', tag: 'Balayage' },
      { id: 'lhx-g3', url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80', title: 'Champagne Private Hair Atelier', tag: 'Atelier Interior' },
      { id: 'lhx-g4', url: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=800&q=80', title: 'Olaplex Bond Repair Immersion', tag: 'Bond Repair' },
      { id: 'lhx-g5', url: 'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=800&q=80', title: 'Keratin Smoothing Steam Suite', tag: 'Keratin' },
      { id: 'lhx-g6', url: 'https://images.unsplash.com/photo-1512290900672-1f55b9e07506?auto=format&fit=crop&w=800&q=80', title: 'Luxe Treatment Bed & Gloss Ritual', tag: 'Glossing' }
    ],
    reviews: [
      { id: 'lhx-r1', name: 'Rhea Bedi', location: 'New Delhi', rating: 5, serviceName: 'Balayage & French Glossing', comment: 'The hair-mapping consultation felt like a couture fitting. Three months on, my balayage still carries that glassy, liquid gloss.', avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80', date: '2 days ago' },
      { id: 'lhx-r2', name: 'Ansh Verma', location: 'Gurugram', rating: 5, serviceName: 'Olaplex Bond Repair Spa', comment: 'My bleached hair was practically thread. After the hair-mapping bond audit and the Olaplex ritual, it feels stronger than it has in years.', avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80', date: '5 days ago' },
      { id: 'lhx-r3', name: 'Nidhi Saxena', location: 'Mumbai', rating: 5, serviceName: 'Precision Sculpt & Hair Design', comment: 'The dry cut was surgical — every strand mapped to my face geometry. I have never worn my hair with this much confidence.', avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80', date: '1 week ago' }
    ],
    totalReviewCount: 980,
    averageRating: 4.98,
    landmark: 'Lavelle Road, South Extension II, Near ITC Maurya',
    parkingInfo: 'Concierge valet parking on Lavelle Road, 2 minutes walk',
    openHourText: '11:00 AM',
    closeHourText: '9:00 PM'
  },

  bridal_makeover_studio: {
    foundingYear: '2017',
    foundingNarrative: 'Rose & Ivory was founded by a film makeup artist who wanted bridal styling that survives real weddings—long ceremonies, humid evenings, and hundreds of candid photos—without ever losing that first-moment camera-ready glow.',
    specialties: ['HD Airbrush Bridal Glam', 'Moodboard-Driven Styling', 'Pre-Bridal Skin Prep Rituals', 'Royal Saree Draping & Hair Sculpting'],
    certifications: [
      { icon: 'verified', title: 'Long-Lasting Sweatproof Formulas', description: 'Premium 18-hour-wear airbrush and setting systems built for humid Indian summers.' },
      { icon: 'spa', title: 'Skin Prep Hydration Protocol', description: 'Hyaluronic-infused pre-bridal rituals that build a dewy, even canvas before the big day.' },
      { icon: 'palette', title: 'Personalized Bridal Moodboards', description: 'Bride-curated moodboards with fabric, jewelry, and floral swatches before every appointment.' },
      { icon: 'camera', title: 'Candid-Proof Camera-Ready Finish', description: 'Looks color-corrected under natural, candlelight, and studio flash for flawless portraits.' }
    ],
    gallery: [
      { id: 'bms-g1', url: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=800&q=80', title: 'HD Airbrush Bridal Portrait', tag: 'Bridal Glam' },
      { id: 'bms-g2', url: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=800&q=80', title: 'Pre-Bridal Radiance Session', tag: 'Skin Prep' },
      { id: 'bms-g3', url: 'https://images.unsplash.com/photo-1583001931096-959e9a1a6223?auto=format&fit=crop&w=800&q=80', title: 'Moodboard & Swatch Wall', tag: 'Moodboard' },
      { id: 'bms-g4', url: 'https://images.unsplash.com/photo-1512290900672-1f55b9e07506?auto=format&fit=crop&w=800&q=80', title: 'Prep Suite & Hydration Ritual', tag: 'Prep Ritual' },
      { id: 'bms-g5', url: 'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=800&q=80', title: 'Draping Studio & Mirror Wall', tag: 'Draping' },
      { id: 'bms-g6', url: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=800&q=80', title: 'Engagement Makeover Detail', tag: 'Engagement' }
    ],
    reviews: [
      { id: 'bms-r1', name: 'Priyanka Deshmukh', location: 'Bandra, Mumbai', rating: 5, serviceName: 'HD Airbrush Bridal Makeup', comment: 'Six-hour wedding under December sun—zero transfer by the time the baraat reached. The moodboard session made me feel like a co-director of my own look.', avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80', date: '1 day ago' },
      { id: 'bms-r2', name: 'Zara Khan', location: 'Andheri, Mumbai', rating: 5, serviceName: 'Pre-Bridal Radiance Ritual', comment: 'Three sessions before the wedding and my skin looked lit from within. The hydration protocol is real—my makeup artist kept praising how smooth the base was.', avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80', date: '4 days ago' },
      { id: 'bms-r3', name: 'Aisha Farooqui', location: 'Powai, Mumbai', rating: 5, serviceName: 'Royal Engagement Makeover', comment: 'The engagement candid looked like a magazine page. The sweatproof finish stayed dewy through dinner and dancing, and the drape held all evening.', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80', date: '1 week ago' }
    ],
    totalReviewCount: 720,
    averageRating: 4.97,
    landmark: 'Linking Road, Bandra West, Near Gazebo Shopping',
    parkingInfo: 'Verified parking on Bandra West lanes, 3 minutes walk',
    openHourText: '10:00 AM',
    closeHourText: '9:00 PM'
  },

  family_salon: {
    foundingYear: '2019',
    foundingNarrative: 'Cedar & Bloom was founded on a simple idea: a modern, unisex family salon where grandparents, parents, and kids can be seated together, and quality hair and skin care fits neatly into even the busiest weekday.',
    specialties: ['Quick Family Cuts & Styling', 'Express Glow Facials', 'Hydra-Infusion Hair Spas', 'Anti-Dandruff Scalp Therapy'],
    certifications: [
      { icon: 'verified', title: 'Quick-Service Promise', description: 'Most services completed in 30–45 minutes, with dedicated express slots for working families.' },
      { icon: 'eco', title: 'Gentle Nourishing Ingredients', description: 'Argan, coconut, neem, and tea tree formulations safe for every age and hair type.' },
      { icon: 'diversity_2', title: 'All-Age Styling Expertise', description: 'Stylists trained in family grooming, from a child’s first cut to silver-hair styling.' },
      { icon: 'self_improvement', title: 'Everyday Hair Health Program', description: 'Repeatable monthly hair and scalp care routines that keep the whole family looking and feeling their best.' }
    ],
    gallery: [
      { id: 'fam-g1', url: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80', title: 'Signature Wash & Style Station', tag: 'Cuts & Styling' },
      { id: 'fam-g2', url: 'https://images.unsplash.com/photo-1512290900672-1f55b9e07506?auto=format&fit=crop&w=800&q=80', title: 'Hydra-Infusion Hair Spa Suite', tag: 'Hair Spa' },
      { id: 'fam-g3', url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=800&q=80', title: 'Express Glow Facial Chair', tag: 'Facials' },
      { id: 'fam-g4', url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80', title: 'Bright Family Salon Interior', tag: 'Interior' },
      { id: 'fam-g5', url: 'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=800&q=80', title: 'Scalp Treatment Room', tag: 'Scalp Care' },
      { id: 'fam-g6', url: 'https://images.unsplash.com/photo-1583001931096-959e9a1a6223?auto=format&fit=crop&w=800&q=80', title: 'Family Waiting Lounge', tag: 'Family Lounge' }
    ],
    reviews: [
      { id: 'fam-r1', name: 'Meera Kulkarni', location: 'Viman Nagar, Pune', rating: 5, serviceName: 'Signature Wash & Style Cut', comment: 'Took my 8-year-old and my mom in the same visit—both were seated and done within 35 minutes. The style held perfectly all week.', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80', date: '1 day ago' },
      { id: 'fam-r2', name: 'Aditya Patil', location: 'Koregaon Park, Pune', rating: 5, serviceName: 'Hydra-Infusion Hair Spa', comment: 'Quick, affordable, and my hair genuinely feels nourished. The keratin and coconut blend fixed my frizz once and for all.', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80', date: '3 days ago' },
      { id: 'fam-r3', name: 'Shalini Ramesh', location: 'Baner, Pune', rating: 5, serviceName: 'Anti-Dandruff Scalp Treatment', comment: 'The neem and tea tree treatment cleared my flakes in two sessions. Gentle, quick, and they happily treat the whole family.', avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80', date: '1 week ago' }
    ],
    totalReviewCount: 560,
    averageRating: 4.93,
    landmark: 'Viman Nagar, Near Phoenix Marketcity',
    parkingInfo: 'Marketcity public parking, 4 minutes walk',
    openHourText: '10:00 AM',
    closeHourText: '9:00 PM'
  },

  barber_grooming_club: {
    foundingYear: '2016',
    foundingNarrative: 'The Iron Standard began as a two-chair barbershop with one simple rule—no rush, no noise, just precision work, hot towels, and a clean sharp look for every man who walks in.',
    specialties: ['Royal Straight-Razor Beard Sculpt', 'Executive Cuts & Scalp Rub', 'Charcoal Detox Facials', 'Natural Grey Blending'],
    certifications: [
      { icon: 'verified', title: 'German Steel Straight Razors', description: 'Single-edge blades hand-stropped before every shave and sterilized between clients.' },
      { icon: 'local_fire_department', title: 'Hot Towel Therapy Protocol', description: 'Triple hot towel rituals that soften whiskers, open pores, and calm post-shave skin.' },
      { icon: 'face', title: 'Post-Shave Skin Hydration', description: 'Cooling aloe and charcoal balms that hydrate and protect sensitive post-razor skin.' },
      { icon: 'local_bar', title: 'Members-Grade Lounge', description: 'Whiskey barbers, leather chairs, and a quiet club atmosphere—no waiting rooms.' }
    ],
    gallery: [
      { id: 'club-g1', url: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80', title: 'Classic Barber Chair Setup', tag: 'Club Interior' },
      { id: 'club-g2', url: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=800&q=80', title: 'Hot Towel Shave Ritual', tag: 'Hot Towel' },
      { id: 'club-g3', url: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=800&q=80', title: 'Precision Beard Line Work', tag: 'Beard Sculpt' },
      { id: 'club-g4', url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=800&q=80', title: 'Executive Cut in Progress', tag: 'Executive Cut' },
      { id: 'club-g5', url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80', title: 'Grey Blending Color Mix', tag: 'Grey Blend' },
      { id: 'club-g6', url: 'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=800&q=80', title: 'Charcoal Detox Facial Station', tag: 'Facials' }
    ],
    reviews: [
      { id: 'club-r1', name: 'Rohan Bahl', location: 'Cyber City, Gurugram', rating: 5, serviceName: 'Royal Straight-Razor Beard Sculpt', comment: 'Triple hot towel, one razor, a beard with geometry. Cleanest neckline in Gurugram—and it still looks sharp five days later.', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80', date: '1 day ago' },
      { id: 'club-r2', name: 'Nikhil Anand', location: 'Dwarka, New Delhi', rating: 5, serviceName: 'Executive Hair Cut & Scalp Rub', comment: 'The scalp rub alone is worth the trip. Precision cut, comfortable chair, and I walked out with a clean sharp look ready for the boardroom.', avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80', date: '4 days ago' },
      { id: 'club-r3', name: 'Jasmeet Singh', location: 'Saket, New Delhi', rating: 5, serviceName: 'Grey Blending & Beard Color', comment: 'Nobody can tell I color my hair—it looks like natural depth. Skin felt hydrated, not tight, after the shave.', avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&q=80', date: '1 week ago' }
    ],
    totalReviewCount: 610,
    averageRating: 4.95,
    landmark: 'Cyber City Phase II, Near DLF Corporate Park',
    parkingInfo: 'DLF Phase II basement parking, 5 minutes walk',
    openHourText: '11:00 AM',
    closeHourText: '10:00 PM'
  },

  nails_lash_brow_bar: {
    foundingYear: '2021',
    foundingNarrative: 'Peony & Lacquer began as a one-chair setup in a Frazer Town flat. When clients kept booking all three services in the same visit, the bar grew into a dedicated nails, lash & brow micro-studio built around organic formulas and long retention.',
    specialties: ['Gel Extensions & Nail Art', 'Russian Volume Lashes', 'Brow Lamination & Henna', 'Paraffin Pedicure Rituals'],
    certifications: [
      { icon: 'verified', title: '10-Free Organic Formulas', description: 'Formaldehyde- and toluene-free gels with organic adhesives safe for sensitive skin.' },
      { icon: 'visibility', title: 'Long-Lasting Retention Standard', description: 'Every lash and nail service includes a retention check and a free touch-up window.' },
      { icon: 'auto_awesome', title: 'Precision Detailing Tools', description: 'Single-use sterilized kits, e-file precision, and magnified lash lamps for every artist.' },
      { icon: 'palette', title: 'Monthly Trend Board', description: 'A curated monthly board of nail art, lash styles, and brow shapes refreshed every season.' }
    ],
    gallery: [
      { id: 'nlb-g1', url: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=800&q=80', title: 'Nail Art & Chrome Detailing', tag: 'Nail Couture' },
      { id: 'nlb-g2', url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80', title: 'Lash Station & Laminated Brows', tag: 'Lash Bar' },
      { id: 'nlb-g3', url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=800&q=80', title: 'Brow Lamination Mirror Wall', tag: 'Brows' },
      { id: 'nlb-g4', url: 'https://images.unsplash.com/photo-1512290900672-1f55b9e07506?auto=format&fit=crop&w=800&q=80', title: 'Paraffin Pedicure Suite', tag: 'Pedicure' },
      { id: 'nlb-g5', url: 'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=800&q=80', title: 'Micro-Bar Interior', tag: 'Interior' },
      { id: 'nlb-g6', url: 'https://images.unsplash.com/photo-1583001931096-959e9a1a6223?auto=format&fit=crop&w=800&q=80', title: 'Trend Board & Gel Library', tag: 'Trends' }
    ],
    reviews: [
      { id: 'nlb-r1', name: 'Aishwarya Rao', location: 'Frazer Town, Bengaluru', rating: 5, serviceName: 'Gel Extension & Custom Nail Art', comment: 'Three weeks in, zero chips. The micro-art detailing is worth every rupee—my almond chrome set has been the talk of the month.', avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80', date: '1 day ago' },
      { id: 'nlb-r2', name: 'Ritu Chawla', location: 'Koramangala, Bengaluru', rating: 5, serviceName: 'Russian Volume Lash Extensions', comment: 'Fluffy but weightless—my natural lashes were not damaged at all. Retention stayed perfect for over three weeks.', avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80', date: '3 days ago' },
      { id: 'nlb-r3', name: 'Devika Nair', location: 'Indiranagar, Bengaluru', rating: 5, serviceName: 'Brow Lamination & Henna Tint', comment: 'Woke up to the exact fluffy arch I wanted, no daily gel. The organic henna tint stayed rich even in Bengaluru humidity.', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80', date: '1 week ago' }
    ],
    totalReviewCount: 480,
    averageRating: 4.94,
    landmark: 'Frazer Town, Near Halasuru Circle',
    parkingInfo: 'Two-wheeler parking in the lane; car parking at Halasuru complex, 200 m',
    openHourText: '10:30 AM',
    closeHourText: '8:30 PM'
  },

  medispa_aesthetics: {
    foundingYear: '2019',
    foundingNarrative: 'Porcelain Skin Lab was founded by a dermatologist who believed medical skin science should never feel cold or clinical. Every protocol here is dermatologist-tested, and every treatment ends like a spa visit—with zero downtime.',
    specialties: ['Advanced HydraFacial MD', 'LED Light Anti-Aging', 'Chemical Peel & Pigmentation Care', 'Micro-needling Collagen Boost'],
    certifications: [
      { icon: 'verified', title: 'Dermatologist-Tested Protocols', description: 'Every treatment sequence designed and supervised by practising consultant dermatologists.' },
      { icon: 'science', title: 'Certified Medical-Grade Devices', description: 'HydraFacial MD vial sets, calibrated LED matrices, and single-use micro-needling cartridges.' },
      { icon: 'water_drop', title: 'Deep Cellular Renewal Formulas', description: 'Hyaluronic, vitamin-C, and peptide serums engineered to rejuvenate at the cellular level.' },
      { icon: 'schedule', title: 'Zero-Downtime Promise', description: 'Every treatment is designed so you can return to work the same day—no redness, no peeling, no social pause.' }
    ],
    gallery: [
      { id: 'mds-g1', url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=800&q=80', title: 'HydraFacial MD Station', tag: 'Signature Facial' },
      { id: 'mds-g2', url: 'https://images.unsplash.com/photo-1512290900672-1f55b9e07506?auto=format&fit=crop&w=800&q=80', title: 'LED Light Therapy Pod', tag: 'Light Therapy' },
      { id: 'mds-g3', url: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=800&q=80', title: 'Peel & Pigmentation Consult', tag: 'Peels' },
      { id: 'mds-g4', url: 'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=800&q=80', title: 'Micro-needling Suite', tag: 'Collagen' },
      { id: 'mds-g5', url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80', title: 'Porcelain Waiting Lounge', tag: 'Interior' },
      { id: 'mds-g6', url: 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?auto=format&fit=crop&w=800&q=80', title: 'Serum & Vial Library', tag: 'Formulas' }
    ],
    reviews: [
      { id: 'mds-r1', name: 'Ankita Bose', location: 'Alipore, Kolkata', rating: 5, serviceName: 'Advanced HydraFacial MD', comment: 'Did my HydraFacial MD at 10 AM and presented to a client at 1 PM. Zero redness, and my skin texture looked smoother after a single session.', avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80', date: '1 day ago' },
      { id: 'mds-r2', name: 'Sourav Ghosh', location: 'Salt Lake, Kolkata', rating: 5, serviceName: 'LED Light Anti-Aging Therapy', comment: 'Six weeks of LED sessions and my colleagues keep asking what changed. No downtime, no irritation—just smoother, brighter skin.', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80', date: '3 days ago' },
      { id: 'mds-r3', name: 'Rituparna Das', location: 'Gariahat, Kolkata', rating: 5, serviceName: 'Chemical Peel & Pigmentation Correction', comment: 'Dr. Chatterjee’s lactic peel protocol cleared years of melasma in four sessions. My skin texture is even, and the post-peel glow is addictive.', avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80', date: '1 week ago' }
    ],
    totalReviewCount: 430,
    averageRating: 4.96,
    landmark: 'Alipore Road, Near M.G. Road Bridge',
    parkingInfo: 'Kolkata Medical Park basement parking, 3 minutes walk',
    openHourText: '10:00 AM',
    closeHourText: '8:00 PM'
  },

  organic_bio_salon: {
    foundingYear: '2020',
    foundingNarrative: 'Terra Botanica was born from a simple frustration—nowhere in Coimbatore offered salon services without a chemistry lecture on the receipt. The founders opened a zero-waste, 100% vegan bio-salon where every bowl, bottle, and blend is ethically sourced.',
    specialties: ['Botanical Herbal Hair Color', 'Plant-Based Vegan Facials', 'Organic Clay Scalp Detox', 'Cold-Pressed Eco-Gloss Spas'],
    certifications: [
      { icon: 'verified', title: '100% Vegan, Ammonia-Free Formulas', description: 'Every color, facial, and spa blend is 100% vegan, ammonia-free, paraben-free, and cruelty-free.' },
      { icon: 'local_florist', title: 'Ethically Sourced Botanicals', description: 'Henna, indigo, amla, and clays purchased directly from certified organic farms in Tamil Nadu.' },
      { icon: 'recycling', title: 'Zero-Waste Salon Practices', description: 'Compostable bowls, refillable glass vials, and plastic-free packaging in every treatment room.' },
      { icon: 'water_drop', title: 'Gentle Natural Radiance Promise', description: 'No synthetic dyes, no harsh sulfates—only plant-based care that brings out your skin and hair’s own glow.' }
    ],
    gallery: [
      { id: 'bio-g1', url: 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?auto=format&fit=crop&w=800&q=80', title: 'Botanical Hair Color Mixing', tag: 'Herbal Color' },
      { id: 'bio-g2', url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=800&q=80', title: 'Plant-Based Facial Station', tag: 'Vegan Facial' },
      { id: 'bio-g3', url: 'https://images.unsplash.com/photo-1512290900672-1f55b9e07506?auto=format&fit=crop&w=800&q=80', title: 'Clay Scalp Detox Bowl', tag: 'Scalp Detox' },
      { id: 'bio-g4', url: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=800&q=80', title: 'Cold-Pressed Oil Spa Suite', tag: 'Eco Gloss' },
      { id: 'bio-g5', url: 'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=800&q=80', title: 'Zero-Waste Treatment Room', tag: 'Interior' },
      { id: 'bio-g6', url: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=800&q=80', title: 'Refillable Glass Vial Library', tag: 'Formulas' }
    ],
    reviews: [
      { id: 'bio-r1', name: 'Kavitha Subramanian', location: 'Gandhipuram, Coimbatore', rating: 5, serviceName: 'Botanical Herbal Hair Color', comment: 'My henna-amla color has more softness than any chemical dye I have ever tried. Zero ammonia, zero regret—and it smells like a garden.', avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80', date: '1 day ago' },
      { id: 'bio-r2', name: 'Aravind Kumar', location: 'RS Puram, Coimbatore', rating: 5, serviceName: 'Organic Clay Scalp Detox', comment: 'The green clay and amla rinse fixed my oily scalp in a week. You can smell the difference—clean, herbal, chemical-free.', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80', date: '3 days ago' },
      { id: 'bio-r3', name: 'Lakshmi Priya', location: 'Saibaba Colony, Coimbatore', rating: 5, serviceName: 'Plant-Based Vegan Facial', comment: 'Sensitive skin, and I trust their 100% vegan formulas completely. My skin has a gentle natural radiance, not a filtered one.', avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80', date: '1 week ago' }
    ],
    totalReviewCount: 350,
    averageRating: 4.92,
    landmark: 'Gandhipuram, Near Bakers Road',
    parkingInfo: 'Shared parking at Coimbatore Bio Park, 2 minutes walk',
    openHourText: '9:30 AM',
    closeHourText: '8:00 PM'
  },

  express_beauty_bar: {
    foundingYear: '2022',
    foundingNarrative: 'Blink started because a stylist kept losing 40 minutes of every morning to a 15-minute blowdry wait. The bar she opened answers one question: how fast can we make you look perfect? The answer—15 minutes, zero wait.',
    specialties: ['15-Min Express Blowdry', 'Instant Flash Glow Cleanups', 'Quick Shape & Polish', 'Rapid Threading Touchups'],
    certifications: [
      { icon: 'bolt', title: 'Zero-Wait Walk-In Guarantee', description: 'Slot-based scheduling with a dedicated express lane—average wait under 5 minutes.' },
      { icon: 'timer', title: '15-Minute Precision Protocols', description: 'Every service follows a timed protocol so speed never costs quality.' },
      { icon: 'spa', title: 'Fast-Application Products', description: 'Professional-strength, quick-setting formulas built for rapid salon work.' },
      { icon: 'self_improvement', title: 'Instant Visible Freshness Promise', description: 'If you do not see the difference before you leave, your next service is on us.' }
    ],
    gallery: [
      { id: 'exp-g1', url: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80', title: '15-Min Blowdry Station', tag: 'Express Styling' },
      { id: 'exp-g2', url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=800&q=80', title: 'Flash Glow Cleanup Chair', tag: 'Flash Facial' },
      { id: 'exp-g3', url: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=800&q=80', title: 'Gel Polish Wall', tag: 'Polish' },
      { id: 'exp-g4', url: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=800&q=80', title: 'Threading & Touchup Counter', tag: 'Threading' },
      { id: 'exp-g5', url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80', title: 'Express Bar Interior', tag: 'Interior' },
      { id: 'exp-g6', url: 'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=800&q=80', title: 'Quick Scheduling Wall', tag: 'Scheduling' }
    ],
    reviews: [
      { id: 'exp-r1', name: 'Pooja Hegde', location: 'Jayanagar, Bengaluru', rating: 5, serviceName: '15-Min Express Blowdry', comment: 'Booked at 9:45, left at 10:00 with a red-carpet blowout for my board meeting. Zero wait, perfect volume all day.', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80', date: '1 day ago' },
      { id: 'exp-r2', name: 'Aakash Nair', location: 'Frazer Town, Bengaluru', rating: 5, serviceName: 'Quick Shape & Polish', comment: 'Shape-up plus polish in 20 minutes on my lunch break. Fast, clean, and the polish is still glossy three weeks later.', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80', date: '2 days ago' },
      { id: 'exp-r3', name: 'Divya Shetty', location: 'Banashankari, Bengaluru', rating: 5, serviceName: 'Threading & Upper Lip Touchup', comment: 'Walked in, walked out in 10 minutes with an instant fresh face. Perfect for exam days and early meetings.', avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80', date: '5 days ago' }
    ],
    totalReviewCount: 310,
    averageRating: 4.90,
    landmark: 'Jayanagar 4th Block, Near Metro Station',
    parkingInfo: 'Metro station parking 1 minute walk; two-wheeler stand in front',
    openHourText: '8:00 AM',
    closeHourText: '10:00 PM'
  },

  thai_massage_center: {
    foundingYear: '2017',
    foundingNarrative: 'Baan Sen opened when a Thai healer and a Keralan spa owner realised their traditions shared one soul—energy, touch, and stillness. Today the centre trains therapists in both Thai Sen line work and oriental herbal therapy.',
    specialties: ['Traditional Thai Dry Stretch', 'Sen Energy Line Therapy', 'Herbal Oil & Aromatherapy', 'Reflexology Foot Pressure'],
    certifications: [
      { icon: 'verified', title: 'Certified Thai Massage Lineage', description: 'Therapists trained by certified Thai healing-lineage masters with 200+ hours of supervised practice.' },
      { icon: 'spa', title: 'Authentic Oriental Herbal Blends', description: 'Turmeric, lemongrass, and ylang-ylang infused oils prepared in small traditional batches.' },
      { icon: 'self_improvement', title: 'Sen Energy Line Mapping', description: 'Every session begins with an assessment of the body’s seven Sen lines before treatment starts.' },
      { icon: 'bedtime', title: 'Deep Mental Rejuvenation Spaces', description: 'Silent treatment rooms, low lighting, and soft gamelan sound for complete mental reset.' }
    ],
    gallery: [
      { id: 'thai-g1', url: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=800&q=80', title: 'Thai Stretch Treatment Room', tag: 'Thai Stretch' },
      { id: 'thai-g2', url: 'https://images.unsplash.com/photo-1512290900672-1f55b9e07506?auto=format&fit=crop&w=800&q=80', title: 'Herbal Oil Therapy Suite', tag: 'Herbal Oil' },
      { id: 'thai-g3', url: 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?auto=format&fit=crop&w=800&q=80', title: 'Herbal Infusion Preparation', tag: 'Herbal Blends' },
      { id: 'thai-g4', url: 'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=800&q=80', title: 'Reflexology Foot Chair', tag: 'Reflexology' },
      { id: 'thai-g5', url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80', title: 'Deep Tissue Workstation', tag: 'Deep Tissue' },
      { id: 'thai-g6', url: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=800&q=80', title: 'Oriental Waiting Lounge', tag: 'Interior' }
    ],
    reviews: [
      { id: 'thai-r1', name: 'Suresh Menon', location: 'Kovalam, Kerala', rating: 5, serviceName: 'Traditional Thai Dry Stretch Massage', comment: 'Ninety minutes of Thai stretch and my back felt ten years younger. I walked out taller—the Sen line work is real.', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80', date: '1 day ago' },
      { id: 'thai-r2', name: 'Emily Watson', location: 'Dubai', rating: 5, serviceName: 'Aroma Herbal Oil Therapy', comment: 'The herbal oil therapy melted every knot in my shoulders. I slept like the dead for two nights—deep mental rejuvenation is an understatement.', avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80', date: '3 days ago' },
      { id: 'thai-r3', name: 'Karthik Raghavan', location: 'Trivandrum, Kerala', rating: 5, serviceName: 'Reflexology Foot Pressure Therapy', comment: 'Forty-five minutes of foot pressure and my whole body felt lighter. The Sen line pressure points are surprisingly precise.', avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80', date: '1 week ago' }
    ],
    totalReviewCount: 520,
    averageRating: 4.95,
    landmark: 'Kovalam Beach Road, Near Lighthouse',
    parkingInfo: 'Shared beach-road parking, 3 minutes walk',
    openHourText: '9:00 AM',
    closeHourText: '9:00 PM'
  },

  kids_teens_studio: {
    foundingYear: '2021',
    foundingNarrative: 'Scissors & Sprinkles was born when the founder watched her own nephew cry through a ten-minute haircut. So she built a studio where the waiting room is a playroom, the products are tear-free gentle, and no child has left in tears since.',
    specialties: ['First Haircut Memory Package', 'Cool Kid Sculpt Cuts', 'Non-Toxic Feather Extensions', 'Teen Acne Fresh Cleanups'],
    certifications: [
      { icon: 'verified', title: 'Tear-Free Gentle Product Line', description: '100% fragrance-light, alcohol-free, tear-free gentle products in every chair, for every age.' },
      { icon: 'emoji_emotions', title: 'Interactive Fun Environment Design', description: 'Playroom waiting area, music curation, sticker rewards, and haircut certificates at every visit.' },
      { icon: 'auto_awesome', title: 'Trendy Safe Styling Standards', description: 'Kid-safe gels, non-toxic extension bonds, and teen-safe skin formulas reviewed by dermatologists.' },
      { icon: 'child_care', title: 'Certified Child Grooming Care', description: 'Stylists trained in paediatric grooming, patience-first technique, and first-haircut rituals.' }
    ],
    gallery: [
      { id: 'kid-g1', url: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80', title: 'First Haircut Celebration Chair', tag: 'First Haircut' },
      { id: 'kid-g2', url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80', title: 'Candy Playroom Interior', tag: 'Interior' },
      { id: 'kid-g3', url: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=800&q=80', title: 'Feather Extensions Styling', tag: 'Extensions' },
      { id: 'kid-g4', url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=800&q=80', title: 'Teen Fresh Cleanup Station', tag: 'Teen Skin' },
      { id: 'kid-g5', url: 'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=800&q=80', title: 'Cool Kid Gel Styling', tag: 'Gel Style' },
      { id: 'kid-g6', url: 'https://images.unsplash.com/photo-1583001931096-959e9a1a6223?auto=format&fit=crop&w=800&q=80', title: 'Sticker & Trophy Wall', tag: 'Rewards' }
    ],
    reviews: [
      { id: 'kid-r1', name: 'Vidhya Krishnan', location: 'Adyar, Chennai', rating: 5, serviceName: 'First Haircut Memory Package', comment: 'My daughter was nervous, but she left grinning with a sticker crown and her trophy. The interactive fun environment made it the best 45 minutes of our week.', avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80', date: '1 day ago' },
      { id: 'kid-r2', name: 'Rahul Prasad', location: 'Nungambakkam, Chennai', rating: 5, serviceName: 'Cool Kid Sculpt Cut & Gel Style', comment: 'My son picked his own cut from the trend board, and the gel held through a full football practice. Trendy, safe, zero tears.', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80', date: '2 days ago' },
      { id: 'kid-r3', name: 'Meera Sundaram', location: 'Mylapore, Chennai', rating: 5, serviceName: 'Teen Acne Skin Fresh Cleanup', comment: 'My 13-year-old actually looks forward to her cleanups. Gentle tear-free products and a playlist she chose—her skin has never been fresher.', avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80', date: '4 days ago' }
    ],
    totalReviewCount: 290,
    averageRating: 4.93,
    landmark: 'Adyar, Near College Street Metro',
    parkingInfo: 'College Street metro parking, 2 minutes walk',
    openHourText: '10:00 AM',
    closeHourText: '8:00 PM'
  },

  resort_spa: {
    foundingYear: '2015',
    foundingNarrative: 'Azure Palms began as the spa wing of a 1930s lake villa, and the founding team’s brief was simple: make guests feel as pampered as the palace royalty of old. Every ritual, from turndown to towel temperature, is designed to that standard.',
    specialties: ['Destination Sunset Body Polish', 'Hot Stone Muscle Melting Rituals', 'Rose & Wine Couple Journeys', 'Lavender Aromatherapy Detox'],
    certifications: [
      { icon: 'verified', title: '5-Star Resort Service Standards', description: 'Every suite, scent, and service calibrated to international 5-star resort hospitality standards.' },
      { icon: 'local_florist', title: 'Signature Essential Oil Blends', description: 'In-house blended orange blossom, cedarwood, rose, and lavender oils used in every ritual.' },
      { icon: 'workspace_premium', title: 'Private Lake-View Suites', description: 'Each treatment takes place in a private, candle-lit suite overlooking Lake Pichola.' },
      { icon: 'restaurant', title: 'Spa Dine & Wine Cellar', description: 'Post-ritual recovery platters and a curated wine cellar for couple journeys.' }
    ],
    gallery: [
      { id: 'res-g1', url: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=800&q=80', title: 'Sunset Body Polish Suite', tag: 'Body Ritual' },
      { id: 'res-g2', url: 'https://images.unsplash.com/photo-1512290900672-1f55b9e07506?auto=format&fit=crop&w=800&q=80', title: 'Hot Stone Treatment Room', tag: 'Stone Therapy' },
      { id: 'res-g3', url: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=800&q=80', title: 'Rose Petal Couple Suite', tag: 'Couples' },
      { id: 'res-g4', url: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=800&q=80', title: 'Lavender Aromatherapy Lounge', tag: 'Aromatherapy' },
      { id: 'res-g5', url: 'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=800&q=80', title: 'Lake-View Private Suite', tag: 'Suite' },
      { id: 'res-g6', url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80', title: 'Resort Spa Atrium', tag: 'Interior' }
    ],
    reviews: [
      { id: 'res-r1', name: 'Rohan Malhotra', location: 'Udaipur, Rajasthan', rating: 5, serviceName: 'Destination Sunset Body Polish', comment: 'The suite faces a lake sunset, and the sugar-coconut polish left my skin glowing like silk. The finest 5-star resort experience I have had in India.', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80', date: '1 day ago' },
      { id: 'res-r2', name: 'Sophie Tan', location: 'Singapore', rating: 5, serviceName: 'Rose & Wine Couple Spa Journey', comment: 'The couple journey was pure indulgence—rose-scented massages, private toasts, candlelight everywhere. My wife is still talking about it a month later.', avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80', date: '3 days ago' },
      { id: 'res-r3', name: 'Aditya Bansal', location: 'Jaipur, Rajasthan', rating: 5, serviceName: 'Hot Stone Muscle Melting Ritual', comment: 'After weeks of travel, the hot stone ritual melted every knot in my back. The cedarwood essential oil scent is still in my memory.', avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80', date: '1 week ago' }
    ],
    totalReviewCount: 680,
    averageRating: 4.97,
    landmark: 'Lake Pichola, Fateh Sagar Marg',
    parkingInfo: 'Private resort valet parking at the main gate',
    openHourText: '10:00 AM',
    closeHourText: '10:00 PM'
  },

  vedic_ayurveda_studio: {
    foundingYear: '2018',
    foundingNarrative: 'Vedvriksha began when Acharya Saxena left his hospital practice to open a small therapy room with two treatment beds. Word of the authentic Vedic treatments spread across Jaipur, and the studio now runs six therapy suites.',
    specialties: ['Abhyanga Warm Oil Massage', 'Shirodhara Oil Stream Therapy', 'Kashaya Sekam Herbal Detox', 'Vedic Mukh Lepam Facial', 'Kadi/Janu Vashti Pain Relief'],
    certifications: [
      { icon: 'verified', title: 'Registered BAMS Ayurvedic Practitioner', description: 'All treatment protocols designed and supervised by a registered BAMS Ayurvedic physician.' },
      { icon: 'eco', title: 'Classical Herbal Formulations', description: 'Medicated oils, kashaya decoctions, and facial lepams prepared per classical Ayurvedic texts.' },
      { icon: 'monitoring', title: 'Personalized Dosha Consultation', description: 'Every first visit includes a pulse and dosha assessment to customise each therapy.' },
      { icon: 'healing', title: 'Pain Relief Therapy Certification', description: 'Vashti and kizhi pain-relief techniques trained under traditional Kerala Ayurveda lineage.' }
    ],
    gallery: [
      { id: 'ved-g1', url: 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?auto=format&fit=crop&w=800&q=80', title: 'Herbal Oil & Decoction Prep', tag: 'Herbal Prep' },
      { id: 'ved-g2', url: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=800&q=80', title: 'Shirodhara Treatment Room', tag: 'Shirodhara' },
      { id: 'ved-g3', url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80', title: 'Abhyanga Therapy Bed', tag: 'Abhyanga' },
      { id: 'ved-g4', url: 'https://images.unsplash.com/photo-1512290900672-1f55b9e07506?auto=format&fit=crop&w=800&q=80', title: 'Kashaya Sekam Steam Bath', tag: 'Detox' },
      { id: 'ved-g5', url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=800&q=80', title: 'Vedic Facial Station', tag: 'Mukh Lepam' },
      { id: 'ved-g6', url: 'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=800&q=80', title: 'Vashti Pain Relief Suite', tag: 'Pain Relief' }
    ],
    reviews: [
      { id: 'ved-r1', name: 'Rajesh Choudhary', location: 'Ajmeri Gate, Jaipur', rating: 5, serviceName: 'Kadi Vashti / Janu Vashti (Localized Pain Relief)', comment: 'The warm oil held on my knee for 45 minutes did what months of painkillers could not. I climb stairs without thinking about the pain again.', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80', date: '1 day ago' },
      { id: 'ved-r2', name: 'Pooja Ahuja', location: 'Malviya Nagar, Jaipur', rating: 5, serviceName: 'Shirodhara Therapy', comment: 'I walked in with chronic insomnia and walked out in a calm daze. I have slept through the night every single day for three weeks now.', avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80', date: '3 days ago' },
      { id: 'ved-r3', name: 'Vikram Singh', location: 'Bapu Nagar, Jaipur', rating: 5, serviceName: 'Kashaya Sekam & Body Detox', comment: 'The herbal steam bath left my skin glowing. My pigmentation has visibly lightened after a month of sessions.', avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80', date: '1 week ago' }
    ],
    totalReviewCount: 380,
    averageRating: 4.94,
    landmark: 'Gopalpura, Near Ajmeri Gate',
    parkingInfo: 'Open street parking in front, 1 minute walk',
    openHourText: '9:00 AM',
    closeHourText: '8:30 PM'
  }
};
