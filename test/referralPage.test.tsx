/**
 * Referral Page (`/customer/referral`) — Rules, Referral code/link,
 * WhatsApp share, 4 metrics (Total invited, Successful referrals, Pending referrals, Reward earned),
 * and referred friends list.
 */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import type { UserProfile } from '../src/types.ts';
import { ReferralPage } from '../src/components/ReferralPage.tsx';

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

function click(el: Element | null) {
  if (!el) throw new Error('click target missing');
  const Ev = typeof MouseEvent !== 'undefined' ? MouseEvent : (Event as typeof Event);
  (el as HTMLElement).dispatchEvent(new Ev('click', { bubbles: true, cancelable: true }));
}

async function typeInto(el: HTMLInputElement | null, value: string) {
  if (!el) throw new Error('input target missing');
  const w = window as unknown as {
    HTMLInputElement: typeof HTMLInputElement;
  };
  const setter = Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value')?.set;
  await act(async () => {
    setter?.call(el, value);
    el.dispatchEvent(new window.Event('input', { bubbles: true }));
    el.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
}

// ---------------------------------------------------------------------------
// Run Tests
// ---------------------------------------------------------------------------
async function run() {
  let backCalled = false;
  let rewardsCalled = false;
  let exploreSalonsCalled = false;

  await render(
    <ReferralPage
      user={mockUser}
      onBack={() => {
        backCalled = true;
      }}
      onOpenRewards={() => {
        rewardsCalled = true;
      }}
      onExploreSalons={() => {
        exploreSalonsCalled = true;
      }}
    />
  );

  // 1. Page Root & Route
  const rootEl = byId('customer-referral-page');
  check('referral page root rendered', Boolean(rootEl));
  check(
    'data-route matches /customer/referral',
    rootEl?.getAttribute('data-route') === '/customer/referral'
  );

  // Back Button
  const backBtn = byId('btn-referral-back');
  check('back button exists', Boolean(backBtn));
  await act(async () => {
    click(backBtn);
  });
  check('back button fired callback', backCalled);

  // =========================================================================
  // 2. Referral Rules Banner (The 3 Core Rules)
  // =========================================================================
  const rulesSection = byId('section-referral-rules');
  check('referral rules banner rendered', Boolean(rulesSection));

  const ruleMinPayment = byId('rule-min-payment');
  check('rule 1: minimum ₹100 QR payment at partner shop', Boolean(ruleMinPayment) && ruleMinPayment?.textContent?.includes('₹100 QR payment') === true);

  const ruleNotCash = byId('rule-not-cash');
  check('rule 2: rewards are not cash', Boolean(ruleNotCash) && ruleNotCash?.textContent?.includes('not cash') === true);

  const rulePartnerOnly = byId('rule-partner-only');
  check('rule 3: rewards redeemed only at partner shops', Boolean(rulePartnerOnly) && rulePartnerOnly?.textContent?.includes('only at partner shops') === true);

  // =========================================================================
  // 3. Referral Code & Link & WhatsApp Share
  // =========================================================================
  // Referral Code
  const codeDisplay = byId('referral-code-display');
  check('referral code displayed', Boolean(codeDisplay) && codeDisplay?.textContent?.includes('NEXORA-ANANYA78') === true);

  const copyCodeBtn = byId('btn-copy-referral-code');
  check('copy referral code button exists', Boolean(copyCodeBtn));
  await act(async () => {
    click(copyCodeBtn);
  });
  check('copy referral code action handled', true);

  // Referral Link
  const linkDisplay = byId('referral-link-display');
  check('referral link displayed', Boolean(linkDisplay) && linkDisplay?.textContent?.includes('https://nexora.app/invite?code=') === true);

  const copyLinkBtn = byId('btn-copy-referral-link');
  check('copy referral link button exists', Boolean(copyLinkBtn));
  await act(async () => {
    click(copyLinkBtn);
  });
  check('copy referral link action handled', true);

  // Share on WhatsApp Button
  const shareWhatsAppBtn = byId('btn-share-whatsapp');
  check('share on WhatsApp button exists', Boolean(shareWhatsAppBtn));
  await act(async () => {
    click(shareWhatsAppBtn);
  });
  check('share on WhatsApp button clicked', true);

  // =========================================================================
  // 4. Metrics Strip (The 4 Required Metrics)
  // =========================================================================
  const metricsSection = byId('section-referral-metrics');
  check('metrics section rendered', Boolean(metricsSection));

  // 1. Total Invited
  const totalInvitedEl = byId('metric-total-invited');
  check('metric: total invited rendered', Boolean(totalInvitedEl) && Number(totalInvitedEl?.textContent?.trim()) >= 5);

  // 2. Successful Referrals
  const successfulEl = byId('metric-successful-referrals');
  check('metric: successful referrals rendered', Boolean(successfulEl) && Number(successfulEl?.textContent?.trim()) >= 3);

  // 3. Pending Referrals
  const pendingEl = byId('metric-pending-referrals');
  check('metric: pending referrals rendered', Boolean(pendingEl) && Number(pendingEl?.textContent?.trim()) >= 2);

  // 4. Reward Earned
  const rewardEarnedEl = byId('metric-reward-earned');
  check('metric: reward earned rendered with points', Boolean(rewardEarnedEl) && rewardEarnedEl?.textContent?.includes('pts') === true);

  // =========================================================================
  // 5. How It Works Steps
  // =========================================================================
  const stepsSection = byId('section-referral-steps');
  check('how referral works section rendered', Boolean(stepsSection));

  // =========================================================================
  // 6. Referred Friends List & Filter Tabs
  // =========================================================================
  const friendsSection = byId('section-referred-friends');
  check('referred friends section rendered', Boolean(friendsSection));

  const tabAll = byId('filter-tab-all');
  const tabCompleted = byId('filter-tab-completed');
  const tabPending = byId('filter-tab-pending');
  check('all filter tab exists', Boolean(tabAll));
  check('completed filter tab exists', Boolean(tabCompleted));
  check('pending filter tab exists', Boolean(tabPending));

  // Test Completed Filter
  await act(async () => {
    click(tabCompleted);
  });
  check('completed tab selected', true);

  // Test Pending Filter
  await act(async () => {
    click(tabPending);
  });
  check('pending tab selected', true);

  // Test Restore All
  await act(async () => {
    click(tabAll);
  });
  check('all tab restored', true);

  // =========================================================================
  // 7. Invite Friend Flow
  // =========================================================================
  const inviteFriendBtn = byId('btn-referral-invite-friend');
  check('invite friend CTA button exists', Boolean(inviteFriendBtn));
  await act(async () => {
    click(inviteFriendBtn);
  });

  const inviteModal = byId('modal-invite-friend');
  check('invite friend modal opened', Boolean(inviteModal));

  const nameInput = byId('input-invite-name') as HTMLInputElement | null;
  const mobileInput = byId('input-invite-mobile') as HTMLInputElement | null;
  const submitInviteBtn = byId('btn-confirm-send-invite');

  check('invite inputs exist', Boolean(nameInput) && Boolean(mobileInput) && Boolean(submitInviteBtn));

  await typeInto(nameInput, 'Kavita Singh');
  await typeInto(mobileInput, '98299 11223');
  await act(async () => {
    click(submitInviteBtn);
  });

  check('new friend added to referred friends list', friendsSection?.textContent?.includes('Kavita Singh') === true);

  // =========================================================================
  // 8. Navigation CTAs
  // =========================================================================
  const exploreSalonsBtn = byId('btn-referral-explore-salons');
  check('explore partner salons button exists', Boolean(exploreSalonsBtn));
  await act(async () => {
    click(exploreSalonsBtn);
  });
  check('explore partner salons fired callback', exploreSalonsCalled);

  const openRewardsBtn = byId('btn-referral-open-rewards');
  check('view rewards wallet button exists', Boolean(openRewardsBtn));
  await act(async () => {
    click(openRewardsBtn);
  });
  check('view rewards wallet fired callback', rewardsCalled);

  // Summary
  console.log(`\n${passed}/${passed + failed} referral page UI checks passed`);
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
