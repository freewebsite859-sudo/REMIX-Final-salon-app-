/**
 * Customer Profile Page (`/customer/profile`) — avatar, full name, email,
 * mobile, city, area, membership level, reward points, total bookings,
 * favourite salons, referral code, edit profile button, and all 9 quick links.
 */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import type { UserProfile, Appointment } from '../src/types.ts';
import { ProfileTab } from '../src/components/ProfileTab.tsx';

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
  avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
  locationArea: 'C-Scheme',
  city: 'Jaipur',
  loyaltyPoints: 750,
  preferredServices: ['Hair Spa'],
  genderPreference: 'women',
  membershipTier: 'gold',
  referralCode: 'NEXORA-ANANYA78',
};

const mockAppointments: Appointment[] = [
  {
    id: 'apt-1',
    salonId: 'salon-1',
    salonName: 'Scissors & Shears Salon',
    salonAddress: 'Mansarovar, Jaipur',
    salonImage: '',
    services: [],
    date: '2026-09-01',
    time: '2:30 PM',
    status: 'completed',
    totalPrice: 1200,
    bookingRef: 'NX-1001',
    createdAt: '2026-09-01T10:00:00Z',
  },
  {
    id: 'apt-2',
    salonId: 'salon-2',
    salonName: 'Luxe Beauty Lounge',
    salonAddress: 'C-Scheme, Jaipur',
    salonImage: '',
    services: [],
    date: '2026-09-05',
    time: '4:00 PM',
    status: 'confirmed',
    totalPrice: 1800,
    bookingRef: 'NX-1002',
    createdAt: '2026-09-05T10:00:00Z',
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
  let viewBookingsCalled = false;
  let openRewardsCalled = false;
  let openMembershipCalled = false;
  let viewFavouritesCalled = false;
  let openReviewsCalled = false;
  let openReferralCalled = false;
  let openSettingsCalled = false;
  let logoutCalled = false;

  await render(
    <ProfileTab
      user={mockUser}
      appointments={mockAppointments}
      favouritesCount={3}
      unreadNotifications={2}
      onUpdateUser={() => {}}
      onViewAppointments={() => {
        viewBookingsCalled = true;
      }}
      onOpenRewards={() => {
        openRewardsCalled = true;
      }}
      onOpenMembership={() => {
        openMembershipCalled = true;
      }}
      onViewFavourites={() => {
        viewFavouritesCalled = true;
      }}
      onOpenReviews={() => {
        openReviewsCalled = true;
      }}
      onOpenReferral={() => {
        openReferralCalled = true;
      }}
      onOpenSettings={() => {
        openSettingsCalled = true;
      }}
      onLogout={() => {
        logoutCalled = true;
      }}
    />
  );

  // 1. Page Root & Route
  const rootEl = byId('customer-profile-page');
  check('customer profile page root rendered', Boolean(rootEl));
  check(
    'data-route matches /customer/profile',
    rootEl?.getAttribute('data-route') === '/customer/profile'
  );

  // 2. Profile Sections (All 12 items)
  // Section 1: Avatar
  const avatarEl = byId('profile-avatar');
  check('1. Avatar element rendered', Boolean(avatarEl));
  const avatarImg = avatarEl?.querySelector('img');
  check('avatar img has customer alt and src', Boolean(avatarImg?.getAttribute('src')) && avatarImg?.getAttribute('alt') === 'Ananya Sharma');

  // Section 2: Full name
  const nameEl = byId('profile-fullname');
  check('2. Full name element rendered', Boolean(nameEl) && nameEl?.textContent?.includes('Ananya Sharma') === true);

  // Section 3: Email
  const emailEl = byId('profile-email');
  check('3. Email element rendered', Boolean(emailEl) && emailEl?.textContent?.includes('ananya@example.com') === true);

  // Section 4: Mobile
  const mobileEl = byId('profile-mobile');
  check('4. Mobile element rendered', Boolean(mobileEl) && mobileEl?.textContent?.includes('+91 98290 12345') === true);

  // Section 5 & 6: City and Area
  const cityEl = byId('profile-city');
  const areaEl = byId('profile-area');
  check('5. City element rendered', Boolean(cityEl) && cityEl?.textContent?.includes('Jaipur') === true);
  check('6. Area element rendered', Boolean(areaEl) && areaEl?.textContent?.includes('C-Scheme') === true);

  // Section 7: Membership level
  const membershipEl = byId('profile-membership-level');
  check('7. Membership level element rendered', Boolean(membershipEl) && membershipEl?.textContent?.includes('Gold Member') === true);

  // Section 8: Reward points
  const pointsEl = byId('profile-reward-points-value');
  check('8. Reward points element rendered', Boolean(pointsEl) && pointsEl?.textContent?.includes('750') === true);

  // Section 9: Total bookings
  const bookingsEl = byId('profile-total-bookings');
  check('9. Total bookings element rendered', Boolean(bookingsEl) && bookingsEl?.textContent?.includes('2 bookings') === true);

  // Section 10: Favourite salons
  const favSalonsEl = byId('profile-favourite-salons');
  check('10. Favourite salons element rendered', Boolean(favSalonsEl) && favSalonsEl?.textContent?.includes('3 saved') === true);

  // Section 11: Referral code
  const refCodeEl = byId('profile-referral-code');
  check('11. Referral code element rendered', Boolean(refCodeEl) && refCodeEl?.textContent?.includes('NEXORA-ANANYA78') === true);

  // Section 12: Edit profile button
  const editBtn = byId('edit-profile-btn');
  check('12. Edit profile button rendered', Boolean(editBtn));
  await act(async () => {
    click(editBtn);
  });
  check('edit profile button clicked and details section exists', Boolean(byId('section-personal-details')));

  // 3. Quick Links Section (All 9 items)
  const quickLinksSection = byId('section-quick-links');
  check('Quick links section rendered', Boolean(quickLinksSection));

  // Quick link 1: My Bookings
  const qlBookings = byId('quicklink-my-bookings');
  check('Quicklink: My Bookings exists', Boolean(qlBookings));
  await act(async () => {
    click(qlBookings);
  });
  check('My Bookings quicklink fired callback', viewBookingsCalled);

  // Quick link 2: Rewards
  const qlRewards = byId('quicklink-rewards');
  check('Quicklink: Rewards exists', Boolean(qlRewards));
  await act(async () => {
    click(qlRewards);
  });
  check('Rewards quicklink fired callback', openRewardsCalled);

  // Quick link 3: Membership
  const qlMembership = byId('quicklink-membership');
  check('Quicklink: Membership exists', Boolean(qlMembership));
  await act(async () => {
    click(qlMembership);
  });
  check('Membership quicklink fired callback', openMembershipCalled);

  // Quick link 4: Favourites
  const qlFavourites = byId('quicklink-favourites');
  check('Quicklink: Favourites exists', Boolean(qlFavourites));
  await act(async () => {
    click(qlFavourites);
  });
  check('Favourites quicklink fired callback', viewFavouritesCalled);

  // Quick link 5: Reviews
  const qlReviews = byId('quicklink-reviews');
  check('Quicklink: Reviews exists', Boolean(qlReviews));
  await act(async () => {
    click(qlReviews);
  });
  check('Reviews quicklink fired callback', openReviewsCalled);

  // Quick link 6: Referral
  const qlReferral = byId('quicklink-referral');
  check('Quicklink: Referral exists', Boolean(qlReferral));
  await act(async () => {
    click(qlReferral);
  });
  check('Referral quicklink fired callback', openReferralCalled);

  // Quick link 7: Settings
  const qlSettings = byId('quicklink-settings');
  check('Quicklink: Settings exists', Boolean(qlSettings));
  await act(async () => {
    click(qlSettings);
  });
  check('Settings quicklink fired callback', openSettingsCalled);

  // Quick link 8: Help & Support
  const qlSupport = byId('quicklink-help-support');
  check('Quicklink: Help & Support exists', Boolean(qlSupport));
  await act(async () => {
    click(qlSupport);
  });
  check('Support section exists and target available', Boolean(byId('section-support')));

  // Quick link 9: Logout
  const qlLogout = byId('quicklink-logout');
  check('Quicklink: Logout exists', Boolean(qlLogout));
  await act(async () => {
    click(qlLogout);
  });
  const confirmLogoutBtn = byId('confirm-logout-btn');
  check('Logout modal opened with confirm button', Boolean(confirmLogoutBtn));
  await act(async () => {
    click(confirmLogoutBtn);
  });
  check('Logout confirmed fired onLogout callback', logoutCalled);

  // Summary
  console.log(`\n${passed}/${passed + failed} customer profile page UI checks passed`);
  await act(async () => {
    root.unmount();
  });
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

void run();
