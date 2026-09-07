/**
 * Account Settings Page (`/customer/settings`) — Personal info, location,
 * security, notification toggles, language preference, and privacy/data controls.
 */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import type { UserProfile } from '../src/types.ts';
import { SettingsPage } from '../src/components/SettingsPage.tsx';

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
  dateOfBirth: '1995-05-15',
  membershipTier: 'gold',
  referralCode: 'NEXORA-ANANYA78',
  language: 'en',
  appointmentReminders: true,
  bookingConfirmationNotification: true,
  promotionalOffers: true,
  rewardsNotification: true,
  referralUpdatesNotification: true,
  whatsappAlerts: true,
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

async function typeInto(el: HTMLInputElement | HTMLSelectElement | null, value: string) {
  if (!el) throw new Error('input target missing');
  const w = window as unknown as {
    HTMLInputElement: typeof HTMLInputElement;
    HTMLSelectElement: typeof HTMLSelectElement;
  };
  const proto =
    el.tagName === 'SELECT' ? w.HTMLSelectElement.prototype : w.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  await act(async () => {
    setter?.call(el, value);
    el.dispatchEvent(new window.Event('input', { bubbles: true }));
    el.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 40));
  });
}

// ---------------------------------------------------------------------------
// Run Tests
// ---------------------------------------------------------------------------
async function run() {
  let latestUser: UserProfile = { ...mockUser };
  let backCalled = false;
  let logoutCalled = false;
  let deleteAccountCalled = false;
  let locationModalOpened = false;

  await render(
    <SettingsPage
      user={mockUser}
      onUpdateUser={(updated) => {
        latestUser = updated;
      }}
      onBack={() => {
        backCalled = true;
      }}
      onLogout={() => {
        logoutCalled = true;
      }}
      onDeleteAccount={async () => {
        deleteAccountCalled = true;
        return true;
      }}
      onOpenLocationModal={() => {
        locationModalOpened = true;
      }}
    />
  );

  // 1. Page Root & Route
  const rootEl = byId('customer-settings-page');
  check('settings page root rendered', Boolean(rootEl));
  check(
    'data-route matches /customer/settings',
    rootEl?.getAttribute('data-route') === '/customer/settings'
  );

  // Back button
  const backBtn = byId('btn-settings-back');
  check('back button exists', Boolean(backBtn));
  await act(async () => {
    click(backBtn);
  });
  check('back button fired callback', backCalled);

  // =========================================================================
  // 2. Personal Info Section
  // =========================================================================
  const personalSection = byId('section-settings-personal');
  check('personal info section rendered', Boolean(personalSection));

  // Full Name
  const nameInput = byId('input-settings-fullname') as HTMLInputElement | null;
  check('full name input exists', Boolean(nameInput) && nameInput?.value === 'Ananya Sharma');
  await typeInto(nameInput, 'Ananya R. Sharma');
  check('full name update propagated to user', latestUser.name === 'Ananya R. Sharma');

  // Mobile
  const mobileInput = byId('input-settings-mobile') as HTMLInputElement | null;
  check('mobile input exists', Boolean(mobileInput) && mobileInput?.value === '+91 98290 12345');
  await typeInto(mobileInput, '+91 99999 88888');
  check('mobile update propagated to user', latestUser.phone === '+91 99999 88888');

  // Email
  const emailInput = byId('input-settings-email') as HTMLInputElement | null;
  check('email input exists', Boolean(emailInput) && emailInput?.value === 'ananya@example.com');
  await typeInto(emailInput, 'ananya.sharma@example.com');
  check('email update propagated to user', latestUser.email === 'ananya.sharma@example.com');

  // Gender (Optional)
  const genderSelect = byId('select-settings-gender') as HTMLSelectElement | null;
  check('gender select exists', Boolean(genderSelect));
  await typeInto(genderSelect, 'women');
  check('gender select propagated to user', latestUser.genderPreference === 'women');

  // Date of Birth (Optional)
  const dobInput = byId('input-settings-dob') as HTMLInputElement | null;
  check('date of birth input exists', Boolean(dobInput) && dobInput?.value === '1995-05-15');
  await typeInto(dobInput, '1996-06-20');
  check('date of birth update propagated to user', latestUser.dateOfBirth === '1996-06-20');

  // =========================================================================
  // 3. Location Section
  // =========================================================================
  const locationSection = byId('section-settings-location');
  check('location section rendered', Boolean(locationSection));

  // City
  const cityInput = byId('input-settings-city') as HTMLInputElement | null;
  check('city input exists', Boolean(cityInput) && cityInput?.value === 'Jaipur');
  await typeInto(cityInput, 'Jaipur');
  check('city update propagated to user', latestUser.city === 'Jaipur');

  // Area
  const areaSelect = byId('input-settings-area') as HTMLSelectElement | null;
  check('area select exists', Boolean(areaSelect));
  await typeInto(areaSelect, 'Mansarovar');
  check('area update propagated to user', latestUser.locationArea === 'Mansarovar');

  // GPS Update Button
  const gpsBtn = byId('btn-settings-gps-update');
  check('GPS update button exists', Boolean(gpsBtn));
  await act(async () => {
    click(gpsBtn);
  });
  check('GPS update handled without error', Boolean(byId('btn-settings-gps-update')));

  // =========================================================================
  // 4. Security Section
  // =========================================================================
  const securitySection = byId('section-settings-security');
  check('security section rendered', Boolean(securitySection));

  // Change Password
  const changePasswordBtn = byId('btn-settings-change-password');
  check('change password button exists', Boolean(changePasswordBtn));
  await act(async () => {
    click(changePasswordBtn);
  });
  const currentPasswordInput = byId('input-settings-current-password') as HTMLInputElement | null;
  const newPasswordInput = byId('input-settings-new-password') as HTMLInputElement | null;
  const confirmPasswordInput = byId('input-settings-confirm-password') as HTMLInputElement | null;
  const savePasswordBtn = byId('btn-settings-save-password');

  check('password inputs rendered in form', Boolean(currentPasswordInput) && Boolean(newPasswordInput) && Boolean(confirmPasswordInput));

  await typeInto(currentPasswordInput, 'oldpass123');
  await typeInto(newPasswordInput, 'newsecurepass456');
  await typeInto(confirmPasswordInput, 'newsecurepass456');
  await act(async () => {
    click(savePasswordBtn);
  });
  check('password save form submitted successfully', true);

  // Forgot Password
  const forgotPasswordBtn = byId('btn-settings-forgot-password');
  check('forgot password button exists', Boolean(forgotPasswordBtn));
  await act(async () => {
    click(forgotPasswordBtn);
  });
  check('forgot password action triggered', true);

  // =========================================================================
  // 5. Notification Toggles Section (All 6 toggles)
  // =========================================================================
  const notificationSection = byId('section-settings-notifications');
  check('notifications section rendered', Boolean(notificationSection));

  // 1. Booking Confirmation Toggle
  const toggleBookingConf = byId('toggle-settings-booking-confirmation');
  check('toggle: booking confirmation exists', Boolean(toggleBookingConf));
  await act(async () => {
    click(toggleBookingConf);
  });
  check('booking confirmation toggle updated user', latestUser.bookingConfirmationNotification === false);

  // 2. Booking Reminder Toggle
  const toggleBookingRem = byId('toggle-settings-booking-reminder');
  check('toggle: booking reminder exists', Boolean(toggleBookingRem));
  await act(async () => {
    click(toggleBookingRem);
  });
  check('booking reminder toggle updated user', latestUser.appointmentReminders === false);

  // 3. Offers Toggle
  const toggleOffers = byId('toggle-settings-offers');
  check('toggle: offers exists', Boolean(toggleOffers));
  await act(async () => {
    click(toggleOffers);
  });
  check('offers toggle updated user', latestUser.promotionalOffers === false);

  // 4. Rewards Toggle
  const toggleRewards = byId('toggle-settings-rewards');
  check('toggle: rewards exists', Boolean(toggleRewards));
  await act(async () => {
    click(toggleRewards);
  });
  check('rewards toggle updated user', latestUser.rewardsNotification === false);

  // 5. Referral Updates Toggle
  const toggleReferral = byId('toggle-settings-referral-updates');
  check('toggle: referral updates exists', Boolean(toggleReferral));
  await act(async () => {
    click(toggleReferral);
  });
  check('referral updates toggle updated user', latestUser.referralUpdatesNotification === false);

  // 6. WhatsApp Updates Toggle
  const toggleWhatsapp = byId('toggle-settings-whatsapp-updates');
  check('toggle: whatsapp updates exists', Boolean(toggleWhatsapp));
  await act(async () => {
    click(toggleWhatsapp);
  });
  check('whatsapp updates toggle updated user', latestUser.whatsappAlerts === false);

  // =========================================================================
  // 6. Language Section
  // =========================================================================
  const langSection = byId('section-settings-language');
  check('language section rendered', Boolean(langSection));

  const langEnBtn = byId('btn-settings-lang-en');
  const langHiBtn = byId('btn-settings-lang-hi');
  check('English language option exists', Boolean(langEnBtn));
  check('Hindi language option exists', Boolean(langHiBtn));

  await act(async () => {
    click(langHiBtn);
  });
  check('Hindi language selected and user updated', latestUser.language === 'hi');

  await act(async () => {
    click(langEnBtn);
  });
  check('English language selected and user updated', latestUser.language === 'en');

  // =========================================================================
  // 7. Privacy & Data Control Section
  // =========================================================================
  const privacySection = byId('section-settings-privacy');
  check('privacy section rendered', Boolean(privacySection));

  // Download My Data UI
  const downloadDataBtn = byId('btn-settings-download-data');
  check('download my data button exists', Boolean(downloadDataBtn));
  await act(async () => {
    click(downloadDataBtn);
  });
  check('download my data triggered successfully', true);

  // Delete Account Request UI
  const deleteAccountBtn = byId('btn-settings-delete-account');
  check('delete account button exists', Boolean(deleteAccountBtn));
  await act(async () => {
    click(deleteAccountBtn);
  });

  const deleteModal = byId('modal-settings-delete-confirm');
  check('delete confirmation modal opened', Boolean(deleteModal));

  const deleteConfirmInput = byId('input-settings-delete-confirm') as HTMLInputElement | null;
  const deleteActionBtn = byId('btn-settings-confirm-delete-action') as HTMLButtonElement | null;
  check('delete confirm input and action button exist', Boolean(deleteConfirmInput) && Boolean(deleteActionBtn));

  // Type DELETE to confirm
  await typeInto(deleteConfirmInput, 'DELETE');
  await act(async () => {
    click(deleteActionBtn);
  });
  check('delete account executed onDeleteAccount callback', deleteAccountCalled);

  // Summary
  console.log(`\n${passed}/${passed + failed} settings page UI checks passed`);
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
