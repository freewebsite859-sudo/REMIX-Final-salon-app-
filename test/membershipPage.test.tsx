/**
 * Membership page (`/customer/membership`) — Silver, Gold, Platinum cards,
 * current level, progress, benefits, how to unlock, eligible shops, and
 * exclusive partner shop rule.
 */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import type { UserProfile, Appointment, Salon } from '../src/types.ts';
import { MembershipPage } from '../src/components/MembershipPage.tsx';

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

const mockUser: UserProfile = {
  name: 'Ananya Sharma',
  email: 'ananya@example.com',
  phone: '+91 98290 12345',
  avatar: '',
  locationArea: 'C-Scheme',
  city: 'Jaipur',
  loyaltyPoints: 750,
  preferredServices: ['Hair Spa'],
  genderPreference: 'women',
  membershipTier: 'silver',
};

const mockSalons: Salon[] = [
  {
    id: 'salon-1',
    name: 'Nexora Signature C-Scheme',
    tagline: 'Luxury Hair & Skin Care Lounge',
    categories: ['hair', 'skin', 'spa'],
    rating: 4.9,
    reviewCount: 312,
    distance: '1.2 km',
    location: {
      area: 'C-Scheme',
      city: 'Jaipur',
      address: 'Plot 14, Ashok Marg, C-Scheme, Jaipur',
      latitude: 26.9124,
      longitude: 75.8035,
    },
    image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=500',
    gallery: [],
    isOpen: true,
    openingHours: '9:00 AM - 9:00 PM',
    priceRange: '₹₹₹',
    services: [],
    stylists: [],
    reviews: [],
    amenities: [],
    gender: 'unisex',
  },
  {
    id: 'salon-2',
    name: 'Style Lounge Mansarovar',
    tagline: 'Modern Salon & Grooming Bar',
    categories: ['hair', 'grooming'],
    rating: 4.8,
    reviewCount: 184,
    distance: '3.4 km',
    location: {
      area: 'Mansarovar',
      city: 'Jaipur',
      address: 'Madhyam Marg, Mansarovar, Jaipur',
      latitude: 26.8533,
      longitude: 75.7681,
    },
    image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=500',
    gallery: [],
    isOpen: true,
    openingHours: '10:00 AM - 8:30 PM',
    priceRange: '₹₹',
    services: [],
    stylists: [],
    reviews: [],
    amenities: [],
    gender: 'unisex',
  },
];

const mockAppointments: Appointment[] = [
  {
    id: 'apt-1',
    salonId: 'salon-1',
    salonName: 'Nexora Signature C-Scheme',
    salonAddress: 'C-Scheme, Jaipur',
    salonImage: '',
    services: [],
    date: '2026-09-01',
    time: '2:30 PM',
    status: 'completed',
    totalPrice: 2400,
    bookingRef: 'NX-1001',
    createdAt: '2026-09-01T10:00:00Z',
  },
];

const host = document.createElement('div');
document.body.appendChild(host);
let root: Root = createRoot(host);

async function render(ui: React.ReactElement) {
  await act(async () => {
    root.render(ui);
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 40));
  });
}

function byId(id: string): HTMLElement | null {
  return document.getElementById(id) || host.querySelector(`[id="${id}"]`);
}

function text(): string {
  return host.textContent || '';
}

function click(el: Element | null) {
  if (!el) throw new Error('click target missing');
  const Ev = typeof MouseEvent !== 'undefined' ? MouseEvent : (Event as typeof Event);
  (el as HTMLElement).dispatchEvent(new Ev('click', { bubbles: true, cancelable: true }));
}

// ---------------------------------------------------------------------------
// Run Tests
// ---------------------------------------------------------------------------
async function run() {
  let navBookingCalled = false;
  let openRewardsCalled = false;
  let backCalled = false;

  await render(
    <MembershipPage
      user={mockUser}
      salons={mockSalons}
      appointments={mockAppointments}
      onBack={() => {
        backCalled = true;
      }}
      onNavigateToBooking={() => {
        navBookingCalled = true;
      }}
      onOpenRewards={() => {
        openRewardsCalled = true;
      }}
    />
  );

  // 1. Page Root & Route
  const rootEl = byId('membership-page');
  check('membership page root rendered', Boolean(rootEl));
  check(
    'data-route matches /customer/membership',
    rootEl?.getAttribute('data-route') === '/customer/membership'
  );
  check('page title Nexora Membership present', text().includes('Nexora Membership'));

  // 2. Important Membership Rule Banner
  const ruleEl = byId('section-membership-rule');
  check('membership rule banner rendered', Boolean(ruleEl));
  check(
    'rule: Membership benefits apply only at Nexora partner shops',
    text().includes('Membership benefits apply only at Nexora partner shops')
  );

  // 3. Current Membership Level
  const levelEl = byId('section-current-membership-level');
  check('current membership level section rendered', Boolean(levelEl));
  const currentTierNameEl = byId('current-membership-tier-name');
  check('current tier name displayed as Silver Member', currentTierNameEl?.textContent?.includes('Silver Member') === true);

  // 4. Progress to Next Level
  const progressEl = byId('section-progress-to-next-level');
  check('progress to next level section rendered', Boolean(progressEl));
  check('progress section mentions Gold', (progressEl?.textContent || '').includes('Gold'));
  check('progress percentage rendered', (progressEl?.textContent || '').includes('%'));

  // 5. Three Membership Cards
  const cardsSection = byId('section-membership-cards');
  check('membership cards section rendered', Boolean(cardsSection));

  // Silver Card
  const silverCard = byId('membership-card-silver');
  check('Silver card rendered', Boolean(silverCard));
  check('Silver card has 5% benefit', (silverCard?.textContent || '').includes('5% benefit'));
  check('Silver card has Basic rewards', (silverCard?.textContent || '').includes('Basic rewards'));
  check('Silver card has Booking history', (silverCard?.textContent || '').includes('Booking history'));
  check('Silver card has Partner shop benefits', (silverCard?.textContent || '').includes('Partner shop benefits'));

  // Gold Card
  const goldCard = byId('membership-card-gold');
  check('Gold card rendered', Boolean(goldCard));
  check('Gold card has 10% benefit', (goldCard?.textContent || '').includes('10% benefit'));
  check('Gold card has Priority booking', (goldCard?.textContent || '').includes('Priority booking'));
  check('Gold card has Extra reward points', (goldCard?.textContent || '').includes('Extra reward points'));
  check('Gold card has Referral bonus', (goldCard?.textContent || '').includes('Referral bonus'));

  // Platinum Card
  const platinumCard = byId('membership-card-platinum');
  check('Platinum card rendered', Boolean(platinumCard));
  check('Platinum card has 15% benefit', (platinumCard?.textContent || '').includes('15% benefit'));
  check('Platinum card has Highest benefits', (platinumCard?.textContent || '').includes('Highest benefits'));
  check('Platinum card has Priority support', (platinumCard?.textContent || '').includes('Priority support'));
  check('Platinum card has Premium offers', (platinumCard?.textContent || '').includes('Premium offers'));
  check('Platinum card has Best partner rewards', (platinumCard?.textContent || '').includes('Best partner rewards'));

  // 6. Benefits Comparison Table
  const comparisonEl = byId('section-benefits-comparison');
  check('benefits comparison section rendered', Boolean(comparisonEl));
  check('comparison table lists 5%, 10%, 15%', (comparisonEl?.textContent || '').includes('5%') && (comparisonEl?.textContent || '').includes('10%') && (comparisonEl?.textContent || '').includes('15%'));

  // 7. How to Unlock Section
  const unlockEl = byId('section-how-to-unlock');
  check('how to unlock section rendered', Boolean(unlockEl));
  check('how to unlock explains QR payment & visit milestones', (unlockEl?.textContent || '').includes('Pay via Nexora QR') && (unlockEl?.textContent || '').includes('Instant Upgrade'));

  // 8. Eligible Shops Section
  const eligibleShopsEl = byId('section-eligible-shops');
  check('eligible partner shops section rendered', Boolean(eligibleShopsEl));
  check('eligible shops lists C-Scheme salon', (eligibleShopsEl?.textContent || '').includes('Nexora Signature C-Scheme'));
  check('eligible shops lists Mansarovar salon', (eligibleShopsEl?.textContent || '').includes('Style Lounge Mansarovar'));

  // 9. Action CTAs
  const bookBtn = byId('membership-book-btn');
  check('membership book button exists', Boolean(bookBtn));
  await act(async () => {
    click(bookBtn);
  });
  check('onNavigateToBooking callback fired', navBookingCalled);

  const rewardsBtn = byId('membership-rewards-btn');
  check('view rewards button exists', Boolean(rewardsBtn));
  await act(async () => {
    click(rewardsBtn);
  });
  check('onOpenRewards callback fired', openRewardsCalled);

  const backBtn = byId('membership-back-btn');
  check('back button exists', Boolean(backBtn));
  await act(async () => {
    click(backBtn);
  });
  check('onBack callback fired', backCalled);

  // 10. Summary
  console.log(`\n${passed}/${passed + failed} membership page UI checks passed`);
  if (failed > 0) {
    process.exit(1);
  }
}

void run();
