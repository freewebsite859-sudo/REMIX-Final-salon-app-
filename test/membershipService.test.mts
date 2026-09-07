/**
 * Membership service & tier configuration unit tests.
 */
import {
  MEMBERSHIP_TIERS,
  getMembershipCards,
  getTierConfig,
  calculateTierProgress,
  getEligiblePartnerSalons,
} from '../src/lib/membershipService.ts';
import type { Salon } from '../src/types.ts';

let passed = 0;
let failed = 0;

function check(label: string, cond: boolean, detail = '') {
  if (cond) {
    console.log(`PASS  ${label}${detail ? ` — ${detail}` : ''}`);
    passed++;
  } else {
    console.log(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// 1. Three Membership Cards Configuration
// ---------------------------------------------------------------------------
const cards = getMembershipCards();
check('exactly 3 membership tiers defined', cards.length === 3);

const silver = getTierConfig('silver');
check('silver tier exists', Boolean(silver));
check('silver has 5% benefit', silver?.benefitPercent === 5 && silver?.benefitHeadline === '5% benefit');
check('silver contains Basic rewards', Boolean(silver?.bullets.includes('Basic rewards')));
check('silver contains Booking history', Boolean(silver?.bullets.includes('Booking history')));
check('silver contains Partner shop benefits', Boolean(silver?.bullets.includes('Partner shop benefits')));
check('silver contains 5% benefit bullet', Boolean(silver?.bullets.includes('5% benefit')));

const gold = getTierConfig('gold');
check('gold tier exists', Boolean(gold));
check('gold has 10% benefit', gold?.benefitPercent === 10 && gold?.benefitHeadline === '10% benefit');
check('gold contains Priority booking', Boolean(gold?.bullets.includes('Priority booking')));
check('gold contains Extra reward points', Boolean(gold?.bullets.includes('Extra reward points')));
check('gold contains Referral bonus', Boolean(gold?.bullets.includes('Referral bonus')));
check('gold contains 10% benefit bullet', Boolean(gold?.bullets.includes('10% benefit')));

const platinum = getTierConfig('platinum');
check('platinum tier exists', Boolean(platinum));
check('platinum has 15% benefit', platinum?.benefitPercent === 15 && platinum?.benefitHeadline === '15% benefit');
check('platinum contains Highest benefits', Boolean(platinum?.bullets.includes('Highest benefits')));
check('platinum contains Priority support', Boolean(platinum?.bullets.includes('Priority support')));
check('platinum contains Premium offers', Boolean(platinum?.bullets.includes('Premium offers')));
check('platinum contains Best partner rewards', Boolean(platinum?.bullets.includes('Best partner rewards')));
check('platinum contains 15% benefit bullet', Boolean(platinum?.bullets.includes('15% benefit')));

// ---------------------------------------------------------------------------
// 2. Progress Calculation
// ---------------------------------------------------------------------------
const standardProgress = calculateTierProgress(100, 500, 'standard');
check('standard next tier is Silver', standardProgress.nextTier?.tier === 'silver');
check('standard points needed is 400 (500 - 100)', standardProgress.pointsNeeded === 400);
check('standard spend needed is 2500 (3000 - 500)', standardProgress.spendNeeded === 2500);
check('standard is not max tier', standardProgress.isMaxTier === false);

const silverProgress = calculateTierProgress(800, 4000, 'silver');
check('silver next tier is Gold', silverProgress.nextTier?.tier === 'gold');
check('silver points needed is 700 (1500 - 800)', silverProgress.pointsNeeded === 700);
check('silver current discount is 5%', silverProgress.currentDiscountPercent === 5);

const goldProgress = calculateTierProgress(2000, 10000, 'gold');
check('gold next tier is Platinum', goldProgress.nextTier?.tier === 'platinum');
check('gold points needed is 2000 (4000 - 2000)', goldProgress.pointsNeeded === 2000);
check('gold current discount is 10%', goldProgress.currentDiscountPercent === 10);

const platinumProgress = calculateTierProgress(5000, 25000, 'platinum');
check('platinum is max tier', platinumProgress.isMaxTier === true);
check('platinum next tier is null', platinumProgress.nextTier === null);
check('platinum current discount is 15%', platinumProgress.currentDiscountPercent === 15);
check('platinum progress is 100%', platinumProgress.progressPercent === 100);

// ---------------------------------------------------------------------------
// 3. Eligible Partner Shops
// ---------------------------------------------------------------------------
const mockSalons: Salon[] = [
  {
    id: 's1',
    name: 'Salon A',
    tagline: '',
    categories: [],
    rating: 4.8,
    reviewCount: 10,
    distance: '1km',
    location: { area: 'Mansarovar', city: 'Jaipur', address: '', latitude: 26.85, longitude: 75.76 },
    image: '',
    gallery: [],
    isOpen: true,
    openingHours: '',
    priceRange: '₹₹',
    services: [],
    stylists: [],
    reviews: [],
    amenities: [],
    gender: 'unisex',
  },
  {
    id: 's2',
    name: 'Salon B',
    tagline: '',
    categories: [],
    rating: 4.9,
    reviewCount: 20,
    distance: '2km',
    location: { area: 'C-Scheme', city: 'Jaipur', address: '', latitude: 26.91, longitude: 75.80 },
    image: '',
    gallery: [],
    isOpen: true,
    openingHours: '',
    priceRange: '₹₹₹',
    services: [],
    stylists: [],
    reviews: [],
    amenities: [],
    gender: 'women',
  },
];

const allEligible = getEligiblePartnerSalons(mockSalons, 'all');
check('all salons are eligible partner shops', allEligible.length === 2);

const cSchemeOnly = getEligiblePartnerSalons(mockSalons, 'C-Scheme');
check('area filter returns matched salon', cSchemeOnly.length === 1 && cSchemeOnly[0].name === 'Salon B');

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${passed}/${passed + failed} membership service checks passed`);
if (failed > 0) {
  process.exit(1);
}
