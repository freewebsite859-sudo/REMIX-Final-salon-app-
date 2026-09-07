/**
 * Rewards Wallet page (`/customer/rewards`) — sections, transaction cards,
 * QR rules, statuses, filter tabs, redemption modal, simulation modal.
 */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import type { UserProfile, Appointment, Salon } from '../src/types.ts';
import { RewardsTab } from '../src/components/RewardsTab.tsx';

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
  avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
  locationArea: 'C-Scheme',
  city: 'Jaipur',
  loyaltyPoints: 450,
  preferredServices: ['Hair Spa', 'Hydra Facial'],
  genderPreference: 'women',
  referralCode: 'NEXORA-ANANYA78',
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
    services: [
      {
        id: 'srv-1',
        name: 'Hydra Facial Deluxe',
        category: 'skin',
        duration: 60,
        price: 1500,
        description: 'Deep cleansing facial',
      },
    ],
    stylists: [],
    reviews: [],
    amenities: ['Wi-Fi', 'AC'],
    gender: 'women',
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
    amenities: ['AC'],
    gender: 'unisex',
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
  let openMembershipCalled = false;
  let openReferralCalled = false;

  localStorage.clear();

  await render(
    <RewardsTab
      user={mockUser}
      userId="user-test-123"
      salons={mockSalons}
      appointments={[]}
      onNavigateToBooking={() => {
        navBookingCalled = true;
      }}
      onOpenMembership={() => {
        openMembershipCalled = true;
      }}
      onOpenReferral={() => {
        openReferralCalled = true;
      }}
    />
  );

  // 1. Page Root & Route
  const rootEl = byId('rewards-wallet-page');
  check('rewards wallet page root rendered', Boolean(rootEl));
  check(
    'data-route matches /customer/rewards',
    rootEl?.getAttribute('data-route') === '/customer/rewards'
  );
  check('page title Rewards Wallet is present', text().includes('Rewards Wallet'));

  // 2. Important Business Rules Section
  const rulesEl = byId('section-business-rules');
  check('important business rules section rendered', Boolean(rulesEl));
  check('rule: QR Payment Mandatory present', text().includes('QR Payment Mandatory'));
  check('rule: Minimum ₹100 Rule present', text().includes('Minimum ₹100 Rule'));
  check('rule: Cashback Policy present', text().includes('Cashback Policy') || text().includes('not cash withdrawal'));
  check('rule: Redemption Rule present', text().includes('Redemption Rule') || text().includes('partner shops via QR'));
  check('rule: No Direct Bank Withdrawal present', text().includes('No Direct Bank Withdrawal') || text().includes('non-withdrawable'));

  // 3. Section 1: Current Points
  const currentPointsEl = byId('section-current-points');
  check('section: Current points rendered', Boolean(currentPointsEl));
  const currentPtsVal = byId('wallet-current-points-value');
  check('current points value rendered', Boolean(currentPtsVal) && Number(currentPtsVal?.textContent?.replace(/,/g, '')) >= 0);

  // 4. Section 2: Lifetime Earned
  const lifetimeEarnedEl = byId('section-lifetime-earned');
  check('section: Lifetime earned rendered', Boolean(lifetimeEarnedEl));
  const lifetimeEarnedVal = byId('wallet-lifetime-earned-value');
  check('lifetime earned value rendered', Boolean(lifetimeEarnedVal));

  // 5. Section 3: Lifetime Redeemed
  const lifetimeRedeemedEl = byId('section-lifetime-redeemed');
  check('section: Lifetime redeemed rendered', Boolean(lifetimeRedeemedEl));
  const lifetimeRedeemedVal = byId('wallet-lifetime-redeemed-value');
  check('lifetime redeemed value rendered', Boolean(lifetimeRedeemedVal));

  // 6. Section 4: QR Payment Rewards
  const qrRewardsEl = byId('section-qr-payment-rewards');
  check('section: QR payment rewards rendered', Boolean(qrRewardsEl));
  check('QR payment rewards mentions 10% Cashback', (qrRewardsEl?.textContent || '').includes('10% Cashback'));

  // 7. Section 5: Referral Rewards
  const refRewardsEl = byId('section-referral-rewards');
  check('section: Referral rewards rendered', Boolean(refRewardsEl));
  check('Referral code NEXORA-ANANYA78 is displayed', (refRewardsEl?.textContent || '').includes('NEXORA-ANANYA78'));

  // 8. Section 6: Expiring Rewards
  const expiringEl = byId('section-expiring-rewards');
  check('section: Expiring rewards rendered', Boolean(expiringEl));
  check('Expiring rewards shows expiry info or safe status', (expiringEl?.textContent || '').includes('Expiring') || (expiringEl?.textContent || '').includes('expiring'));

  // 9. Section 7: Reward History
  const historyEl = byId('section-reward-history');
  check('section: Reward history rendered', Boolean(historyEl));

  // 10. Reward Transaction Cards
  const cards = document.querySelectorAll('[data-reward-id]');
  check('reward transaction cards rendered', cards.length > 0, `found ${cards.length}`);

  // Check structure of first transaction card: Type, Points, Date, Salon, Status
  const firstCard = cards[0] as HTMLElement;
  check('card has type attribute', Boolean(firstCard.getAttribute('data-reward-type')));
  check('card has status attribute', Boolean(firstCard.getAttribute('data-reward-status')));
  check('card contains salon icon/name', (firstCard.textContent || '').includes('C-Scheme') || (firstCard.textContent || '').includes('Mansarovar') || (firstCard.textContent || '').includes('Jaipur') || (firstCard.textContent || '').includes('Studio') || (firstCard.textContent || '').includes('Salon'));
  check('card contains points value with pts', (firstCard.textContent || '').includes('pts'));
  check('card contains 2026 date', (firstCard.textContent || '').includes('2026'));

  // 11. All 4 Statuses Present in History: Pending, Approved, Redeemed, Expired
  const allCardStatuses = Array.from(cards).map((c) => c.getAttribute('data-reward-status'));
  check('history contains Approved status card', allCardStatuses.includes('Approved'));
  check('history contains Pending status card', allCardStatuses.includes('Pending'));
  check('history contains Redeemed status card', allCardStatuses.includes('Redeemed'));
  check('history contains Expired status card', allCardStatuses.includes('Expired'));

  // 12. Filter Tabs functionality
  const filterPendingBtn = byId('filter-reward-pending');
  check('filter pending tab exists', Boolean(filterPendingBtn));

  await act(async () => {
    click(filterPendingBtn);
  });

  const pendingCards = document.querySelectorAll('[data-reward-id]');
  const allArePending = Array.from(pendingCards).every((c) => c.getAttribute('data-reward-status') === 'Pending');
  check('pending filter displays only Pending cards', pendingCards.length > 0 && allArePending);

  // Switch back to All
  const filterAllBtn = byId('filter-reward-all');
  await act(async () => {
    click(filterAllBtn);
  });
  check('filter all restores full card list', document.querySelectorAll('[data-reward-id]').length >= cards.length);

  // 13. Pay & Redeem via QR Modal
  const openRedeemBtn = byId('wallet-redeem-qr-btn');
  check('redeem via QR button exists in hero', Boolean(openRedeemBtn));

  await act(async () => {
    click(openRedeemBtn);
  });

  const redeemBillInput = byId('redeem-bill-amount-input') as HTMLInputElement;
  const redeemPtsInput = byId('redeem-points-input') as HTMLInputElement;
  const confirmRedeemBtn = byId('confirm-qr-redemption-btn');
  check('redeem modal opened with bill & points input', Boolean(redeemBillInput) && Boolean(redeemPtsInput) && Boolean(confirmRedeemBtn));

  // Test successful redemption
  await act(async () => {
    if (redeemBillInput) {
      redeemBillInput.value = '500';
      redeemBillInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (redeemPtsInput) {
      redeemPtsInput.value = '50';
      redeemPtsInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  await act(async () => {
    click(confirmRedeemBtn);
  });

  check('redemption success state displayed', text().includes('Redemption Successful') || text().includes('Done'));

  // 14. Action buttons
  const bookBtn = byId('rewards-book-btn');
  check('book button #rewards-book-btn exists', Boolean(bookBtn));
  await act(async () => {
    click(bookBtn);
  });
  check('onNavigateToBooking callback fired', navBookingCalled);

  const membershipBtn = byId('rewards-membership-btn');
  check('membership button #rewards-membership-btn exists', Boolean(membershipBtn));
  await act(async () => {
    click(membershipBtn);
  });
  check('onOpenMembership callback fired', openMembershipCalled);

  // 15. Summary
  console.log(`\n${passed}/${passed + failed} rewards wallet UI checks passed`);
  if (failed > 0) {
    process.exit(1);
  }
}

void run();
