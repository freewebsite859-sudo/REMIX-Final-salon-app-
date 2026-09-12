import { CATEGORY_TEMPLATES } from '../categoryTemplates';
import { getTemplateSalons } from '../data/templateSalons';
import { mergeTemplateSalons } from '../lib/catalogService';
import { Salon } from '../types';

console.log('====================================================');
console.log(' DIAGNOSTIC TEMPLATE LOADER & MERGE DEDUPLICATION ');
console.log('====================================================\n');

// 1. Iterate over CATEGORY_TEMPLATES & getTemplateSalons
const rawTemplates = Object.values(CATEGORY_TEMPLATES);
const parsedSalons = getTemplateSalons();

console.log(`[+] Total raw templates defined: ${rawTemplates.length}`);
console.log(`[+] Total parsed template salons: ${parsedSalons.length}\n`);

let passedCount = 0;
let failedCount = 0;

parsedSalons.forEach((salon, index) => {
  const missingFields: string[] = [];

  // Validate mandatory fields required by Supabase catalog schema & Home screen
  if (!salon.id) missingFields.push('id');
  if (!salon.name) missingFields.push('name');
  if (!salon.image) missingFields.push('image (cover url)');
  if (!salon.location) {
    missingFields.push('location object');
  } else {
    if (typeof salon.location.latitude !== 'number' || Number.isNaN(salon.location.latitude)) {
      missingFields.push('location.latitude');
    }
    if (typeof salon.location.longitude !== 'number' || Number.isNaN(salon.location.longitude)) {
      missingFields.push('location.longitude');
    }
    if (!salon.location.city) missingFields.push('location.city');
    if (!salon.location.address) missingFields.push('location.address');
  }

  if (!Array.isArray(salon.categories) || salon.categories.length === 0) {
    missingFields.push('categories');
  }

  if (!Array.isArray(salon.services) || salon.services.length === 0) {
    missingFields.push('services');
  } else {
    salon.services.forEach((service, sIdx) => {
      if (!service.id) missingFields.push(`services[${sIdx}].id`);
      if (!service.name) missingFields.push(`services[${sIdx}].name`);
      if (typeof service.price !== 'number') missingFields.push(`services[${sIdx}].price`);
    });
  }

  if (!Array.isArray(salon.stylists) || salon.stylists.length === 0) {
    missingFields.push('stylists');
  }

  if (missingFields.length > 0) {
    failedCount++;
    console.log(`❌ [FAIL] Salon #${index + 1} (${salon.id || 'NO-ID'}): Missing fields -> ${missingFields.join(', ')}`);
  } else {
    passedCount++;
    console.log(`✅ [PASS] Salon #${index + 1} (${salon.id}): "${salon.name}" - ${salon.services.length} services, ${salon.stylists.length} staff`);
  }
});

console.log('\n----------------------------------------------------');
console.log(`SCHEMA VALIDATION RESULT: ${passedCount}/${parsedSalons.length} Template Salons Validated`);
console.log('----------------------------------------------------\n');

// 2. Test Merge & Deduplication with simulated Supabase remote dataset
console.log('[+] Testing Supabase catalog merge & deduplication behavior...');

const mockRemoteSupabaseSalons: Salon[] = [
  {
    id: 'hair_salon', // Duplicate ID matching template #1 (Arts By Uma)
    name: 'Arts By Uma (Supabase Live Record)',
    tagline: 'Premium Hair & Styling',
    categories: ['Salon'],
    tags: ['salon', 'hair'],
    keywords: ['hair', 'styling'],
    rating: 4.9,
    reviewCount: 200,
    distance: '1.0 km',
    location: { area: 'Indiranagar', city: 'Bengaluru', address: '100 Feet Rd', latitude: 12.9716, longitude: 77.5946 },
    image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035',
    gallery: ['https://images.unsplash.com/photo-1560066984-138dadb4c035'],
    isOpen: true,
    openingHours: '9:00 AM - 9:00 PM',
    priceRange: '₹₹',
    featured: true,
    trending: true,
    services: [],
    stylists: [],
    reviews: [],
    amenities: ['AC', 'Free WiFi'],
    gender: 'unisex',
  },
  {
    id: 'custom-supabase-salon-999', // Unique salon existing only in Supabase DB
    name: 'Royal Heritage Spa (Supabase Only)',
    tagline: 'Authentic Spa Experience',
    categories: ['Spa'],
    tags: ['spa', 'wellness'],
    keywords: ['spa', 'massage'],
    rating: 4.8,
    reviewCount: 50,
    distance: '2.5 km',
    location: { area: 'C-Scheme', city: 'Jaipur', address: 'Ashok Marg', latitude: 26.9124, longitude: 75.7873 },
    image: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef',
    gallery: ['https://images.unsplash.com/photo-1540555700478-4be289fbecef'],
    isOpen: true,
    openingHours: '9:00 AM - 9:00 PM',
    priceRange: '₹₹₹',
    featured: false,
    trending: false,
    services: [
      { id: 'srv-999', name: 'Royal Swedish Massage', category: 'spa' as any, duration: 60, price: 1999, description: 'Relaxing massage therapy' }
    ],
    stylists: [
      { id: 'stf-999', name: 'Ananya Rao', role: 'Therapist', avatar: '', avatarUrl: '', rating: 4.9, experience: '7 yrs', specialty: ['Massage'] }
    ],
    reviews: [],
    amenities: ['AC', 'Beverages'],
    gender: 'unisex',
  }
];

const mergedSalons = mergeTemplateSalons(mockRemoteSupabaseSalons);

// Verify deduplication
const idCounts: Record<string, number> = {};
const duplicates: string[] = [];

for (const s of mergedSalons) {
  const count = (idCounts[s.id] || 0) + 1;
  idCounts[s.id] = count;
  if (count > 1) duplicates.push(s.id);
}

console.log(`[+] Input Remote Salons: ${mockRemoteSupabaseSalons.length}`);
console.log(`[+] Template Salons: ${parsedSalons.length}`);
console.log(`[+] Merged Output Catalog Size: ${mergedSalons.length}`);
console.log(`[+] Unique Salon IDs in Merged Output: ${Object.keys(idCounts).length}`);

if (duplicates.length === 0) {
  console.log('🎉 DEDUPLICATION SUCCESSFUL: Zero duplicate IDs found in merged catalog!');
} else {
  console.log(`❌ DEDUPLICATION FAILED: Found duplicate IDs -> ${duplicates.join(', ')}`);
}

// Check that the duplicate ID 'hair_salon' kept its primary Supabase record and got enriched services
const mergedHairSalon = mergedSalons.find((s) => s.id === 'hair_salon');
console.log(`[+] Duplicate ID ('hair_salon') check: Services count = ${mergedHairSalon?.services.length}`);

console.log('====================================================\n');
