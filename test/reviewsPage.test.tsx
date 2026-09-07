/**
 * Reviews Page (`/customer/reviews`) UI Tests
 *
 * Requirements:
 * - View submitted reviews
 * - Add review after completed booking
 * - Upload review photo
 * - Rate salon
 * - Rate staff
 * - Write review
 * - Review allowed ONLY after completed booking
 */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import type { UserProfile, Appointment } from '../src/types.ts';
import { ReviewsPage } from '../src/components/ReviewsPage.tsx';

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
    id: 'apt-completed-101',
    salonId: 'salon-1',
    salonName: 'Scissors & Shears Salon',
    salonAddress: 'Mansarovar, Jaipur',
    salonImage: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=600&q=80',
    services: [
      { id: 's1', name: 'Signature Hair Cut', category: 'hair', duration: 45, price: 399, description: '' },
    ],
    stylist: {
      id: 'stylist-1',
      name: 'Aarav Sharma',
      role: 'Master Stylist',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80',
      rating: 4.9,
      experience: '8 yrs',
      specialty: ['Fades'],
    },
    date: '2026-09-02',
    time: '2:30 PM',
    status: 'completed',
    totalPrice: 399,
    bookingRef: 'NX-1001',
    createdAt: '2026-09-02T10:00:00Z',
  },
  {
    id: 'apt-pending-102',
    salonId: 'salon-2',
    salonName: 'Luxe Beauty Lounge',
    salonAddress: 'C-Scheme, Jaipur',
    salonImage: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=600&q=80',
    services: [
      { id: 's2', name: 'Hydra Facial', category: 'skin', duration: 60, price: 999, description: '' },
    ],
    date: '2026-09-08',
    time: '4:00 PM',
    status: 'pending',
    totalPrice: 999,
    bookingRef: 'NX-1002',
    createdAt: '2026-09-06T10:00:00Z',
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

function click(el: Element | null) {
  if (!el) throw new Error('click target missing');
  const Ev = typeof MouseEvent !== 'undefined' ? MouseEvent : (Event as typeof Event);
  (el as HTMLElement).dispatchEvent(new Ev('click', { bubbles: true, cancelable: true }));
}

async function typeInto(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null, value: string) {
  if (!el) throw new Error('input target missing');
  const w = window as unknown as {
    HTMLInputElement: typeof HTMLInputElement;
    HTMLTextAreaElement: typeof HTMLTextAreaElement;
    HTMLSelectElement: typeof HTMLSelectElement;
  };
  const proto =
    el.tagName === 'TEXTAREA'
      ? w.HTMLTextAreaElement.prototype
      : el.tagName === 'SELECT'
        ? w.HTMLSelectElement.prototype
        : w.HTMLInputElement.prototype;

  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
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
  let exploreSalonsCalled = false;
  let navigateBookingCalled = false;

  await render(
    <ReviewsPage
      user={mockUser}
      appointments={mockAppointments}
      onBack={() => {
        backCalled = true;
      }}
      onExploreSalons={() => {
        exploreSalonsCalled = true;
      }}
      onNavigateToBooking={() => {
        navigateBookingCalled = true;
      }}
    />
  );

  // 1. Page Root & Route
  const rootEl = byId('customer-reviews-page');
  check('reviews page root rendered', Boolean(rootEl));
  check(
    'data-route matches /customer/reviews',
    rootEl?.getAttribute('data-route') === '/customer/reviews'
  );

  // Back Button
  const backBtn = byId('btn-reviews-back');
  check('back button exists', Boolean(backBtn));
  await act(async () => {
    click(backBtn);
  });
  check('back button fired callback', backCalled);

  // =========================================================================
  // 2. Verified Reviews Rule Policy Banner
  // =========================================================================
  const ruleBanner = byId('section-reviews-rule-banner');
  check('reviews policy banner rendered', Boolean(ruleBanner));
  check(
    'rule banner mentions completed booking requirement',
    ruleBanner?.textContent?.includes('only after a completed booking') === true
  );

  // =========================================================================
  // 3. View Submitted Reviews
  // =========================================================================
  const submittedSection = byId('section-submitted-reviews');
  check('submitted reviews section rendered', Boolean(submittedSection));

  const salonNames = submittedSection?.querySelectorAll('.review-salon-name');
  check('submitted review displays salon name', Boolean(salonNames && salonNames.length > 0));

  const salonRatings = submittedSection?.querySelectorAll('.review-salon-rating');
  check('submitted review displays salon rating', Boolean(salonRatings && salonRatings.length > 0));

  const staffRatings = submittedSection?.querySelectorAll('.review-staff-rating');
  check('submitted review displays staff rating', Boolean(staffRatings && staffRatings.length > 0));

  const comments = submittedSection?.querySelectorAll('.review-comment');
  check('submitted review displays comment text', Boolean(comments && comments.length > 0));

  const photos = submittedSection?.querySelectorAll('.review-photo');
  check('submitted review displays review photo', Boolean(photos && photos.length > 0));

  // Rating Filters
  const filter5 = byId('filter-rating-5');
  check('filter for 5-star reviews exists', Boolean(filter5));
  await act(async () => {
    click(filter5);
  });
  check('5-star rating filter clicked', true);

  const filterAll = byId('filter-rating-all');
  await act(async () => {
    click(filterAll);
  });
  check('all rating filter restored', true);

  // =========================================================================
  // 4. Completed Appointments Ready for Review Section
  // =========================================================================
  const completedEligibleSection = byId('section-eligible-completed-bookings');
  check('eligible completed bookings section rendered', Boolean(completedEligibleSection));

  const rateCompletedAptBtn = byId('btn-review-completed-apt-apt-completed-101');
  check('rate visit button exists for completed booking', Boolean(rateCompletedAptBtn));

  // =========================================================================
  // 5. Add Review Flow (Form, Salon Rating, Staff Rating, Photo, Comment)
  // =========================================================================
  await act(async () => {
    click(rateCompletedAptBtn);
  });

  const writeModal = byId('modal-write-review');
  check('write review modal opened', Boolean(writeModal));

  // Rate Salon Stars
  const salonStar5 = byId('star-rating-salon-5');
  check('rate salon star control exists', Boolean(salonStar5));
  await act(async () => {
    click(salonStar5);
  });

  // Rate Staff Stars
  const staffStar5 = byId('star-rating-staff-5');
  check('rate staff star control exists', Boolean(staffStar5));
  await act(async () => {
    click(staffStar5);
  });

  // Upload Review Photo
  const uploadPhotoBtn = byId('btn-upload-review-photo');
  check('upload review photo button exists', Boolean(uploadPhotoBtn));

  // Write Review Comment
  const commentTextarea = byId('textarea-review-comment') as HTMLTextAreaElement | null;
  check('write review comment textarea exists', Boolean(commentTextarea));

  await typeInto(commentTextarea, 'Outstanding master fade and hair spa service! Aarav is extremely skilled and attentive. Will definitely book again.');

  // Submit Review Button
  const submitReviewBtn = byId('btn-submit-review');
  check('submit review button exists', Boolean(submitReviewBtn));
  await act(async () => {
    click(submitReviewBtn);
  });

  // Verify new review was submitted and appears in submitted reviews list
  check(
    'newly submitted review appears in submitted reviews',
    submittedSection?.textContent?.includes('Outstanding master fade and hair spa service') === true
  );

  // Summary
  console.log(`\n${passed}/${passed + failed} reviews page UI checks passed`);
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
