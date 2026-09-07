/**
 * Reviews Service Unit Tests
 *
 * Rules:
 * - Review allowed ONLY after completed booking (status === 'completed').
 * - Rate salon & staff
 * - Upload photo
 * - View submitted reviews
 */
import {
  canReviewBooking,
  getCompletedAppointmentsForReview,
  DEFAULT_CUSTOMER_REVIEWS,
  type CustomerReview,
} from '../src/lib/reviewsService.ts';
import type { Appointment } from '../src/types.ts';

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

// 1. Default Reviews
check('default submitted reviews exist', DEFAULT_CUSTOMER_REVIEWS.length >= 2);
check('default reviews have verifiedBooking set', DEFAULT_CUSTOMER_REVIEWS.every((r) => r.verifiedBooking));
check('default reviews have salonRating and staffRating', DEFAULT_CUSTOMER_REVIEWS.every((r) => r.salonRating >= 1 && r.staffRating >= 1));

// 2. Rule: Review allowed ONLY after completed booking
const completedApt: Appointment = {
  id: 'apt-comp-01',
  salonId: 'salon-1',
  salonName: 'Scissors & Shears Salon',
  salonAddress: 'Mansarovar, Jaipur',
  salonImage: '',
  services: [{ id: 's1', name: 'Hair Cut', category: 'hair', duration: 30, price: 399, description: '' }],
  date: '2026-09-02',
  time: '3:00 PM',
  status: 'completed',
  totalPrice: 399,
  bookingRef: 'NX-901',
  createdAt: '2026-09-02T10:00:00Z',
};

const pendingApt: Appointment = {
  ...completedApt,
  id: 'apt-pend-01',
  status: 'pending',
};

const confirmedApt: Appointment = {
  ...completedApt,
  id: 'apt-conf-01',
  status: 'confirmed',
};

const cancelledApt: Appointment = {
  ...completedApt,
  id: 'apt-canc-01',
  status: 'cancelled',
};

// Check eligibility
const resCompleted = canReviewBooking(completedApt);
check('completed booking is eligible for review', resCompleted.eligible === true);

const resPending = canReviewBooking(pendingApt);
check('pending booking is NOT eligible for review', resPending.eligible === false);
check('pending rejection explains completed booking rule', resPending.reason?.includes('completed booking') === true);

const resConfirmed = canReviewBooking(confirmedApt);
check('confirmed booking is NOT eligible for review', resConfirmed.eligible === false);

const resCancelled = canReviewBooking(cancelledApt);
check('cancelled booking is NOT eligible for review', resCancelled.eligible === false);

// 3. getCompletedAppointmentsForReview filter
const allApts = [completedApt, pendingApt, confirmedApt, cancelledApt];
const existingReviews: CustomerReview[] = [];

const eligible = getCompletedAppointmentsForReview(allApts, existingReviews);
check('only completed booking is returned in eligible list', eligible.length === 1 && eligible[0].id === 'apt-comp-01');

// When already reviewed
const reviewedList: CustomerReview[] = [
  {
    ...DEFAULT_CUSTOMER_REVIEWS[0],
    bookingId: 'apt-comp-01',
  },
];
const eligibleAfter = getCompletedAppointmentsForReview(allApts, reviewedList);
check('already reviewed completed booking is excluded from eligible list', eligibleAfter.length === 0);

console.log(`\n${passed}/${passed + failed} reviews service checks passed`);
if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
