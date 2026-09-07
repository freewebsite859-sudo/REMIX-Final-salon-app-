/**
 * Booking status + confirmation helpers.
 */
import assert from 'node:assert/strict';
import type { Appointment, SalonService } from '../src/types.ts';
import {
  BOOKING_STATUSES,
  bookingDirectionsUrl,
  buildGoogleCalendarUrl,
  buildIcsDataUrl,
  canCancelBooking,
  canRebook,
  formatBookingDate,
  getBookingStatusMeta,
  isActiveBooking,
  isCancelledBooking,
  isHistoryBooking,
  isValidBookingStatus,
  normalizeBookingStatus,
  resolveWhatsAppStatus,
} from '../src/lib/bookingStatus.ts';
import { isAppointmentUpcoming } from '../src/lib/appointments.ts';

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
// Status catalog
// ---------------------------------------------------------------------------

check(
  'statuses include required five',
  BOOKING_STATUSES.includes('pending') &&
    BOOKING_STATUSES.includes('confirmed') &&
    BOOKING_STATUSES.includes('completed') &&
    BOOKING_STATUSES.includes('cancelled') &&
    BOOKING_STATUSES.includes('no_show')
);

check('normalize: pending', normalizeBookingStatus('pending') === 'pending');
check('normalize: confirmed', normalizeBookingStatus('confirmed') === 'confirmed');
check('normalize: completed', normalizeBookingStatus('completed') === 'completed');
check('normalize: cancelled', normalizeBookingStatus('cancelled') === 'cancelled');
check('normalize: no_show', normalizeBookingStatus('no_show') === 'no_show');
check('normalize: no-show hyphen', normalizeBookingStatus('no-show') === 'no_show');
check('normalize: in_progress → confirmed', normalizeBookingStatus('in_progress') === 'confirmed');
check('normalize: unknown → pending', normalizeBookingStatus('weird') === 'pending');
check('normalize: empty → pending', normalizeBookingStatus('') === 'pending');

check('isValid: confirmed', isValidBookingStatus('confirmed'));
check('isValid: rejects garbage', !isValidBookingStatus('foo'));

for (const id of BOOKING_STATUSES) {
  const meta = getBookingStatusMeta(id);
  check(`meta:${id} has label`, Boolean(meta.label && meta.icon && meta.description));
}

check(
  'confirmed headline text',
  getBookingStatusMeta('confirmed').description.toLowerCase().includes('confirmed')
);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const service: SalonService = {
  id: 's1',
  name: 'Haircut',
  category: 'hair',
  duration: 45,
  price: 399,
  description: 'Classic cut',
};

function makeApt(overrides: Partial<Appointment> = {}): Appointment {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const date = tomorrow.toISOString().split('T')[0];
  return {
    id: 'apt-1',
    salonId: 'salon-1',
    salonName: 'Scissors & Shears Salon',
    salonAddress: 'Plot 42, Madhyam Marg, Mansarovar, Jaipur',
    salonImage: 'https://example.com/s.jpg',
    services: [service],
    stylist: {
      id: 'st-1',
      name: 'Aarav Sharma',
      role: 'Senior',
      avatar: '',
      rating: 4.9,
      experience: '7y',
      specialty: ['Fade'],
    },
    date,
    time: '5:30 PM',
    status: 'confirmed',
    totalPrice: 399,
    advancePaid: 100,
    remainingAmount: 299,
    bookingRef: 'NX-DEMO-001',
    createdAt: new Date().toISOString(),
    mapsUrl: 'https://maps.google.com/?q=Mansarovar',
    whatsappConfirmationStatus: 'sent',
    whatsappSentAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Lifecycle helpers
// ---------------------------------------------------------------------------

{
  const confirmed = makeApt({ status: 'confirmed' });
  check('active: confirmed upcoming', isActiveBooking(confirmed));
  check('upcoming: confirmed', isAppointmentUpcoming(confirmed));
  check('history: not yet', !isHistoryBooking(confirmed));
  check('rebook: not for confirmed', !canRebook(confirmed));
}

{
  const pending = makeApt({ status: 'pending' });
  check('active: pending', isActiveBooking(pending));
  check('upcoming: pending', isAppointmentUpcoming(pending));
}

{
  const completed = makeApt({ status: 'completed' });
  check('history: completed', isHistoryBooking(completed));
  check('rebook: completed', canRebook(completed));
  check('not active: completed', !isActiveBooking(completed));
}

{
  const cancelled = makeApt({ status: 'cancelled' });
  check('cancelled flag', isCancelledBooking(cancelled));
  check('rebook: cancelled', canRebook(cancelled));
}

{
  const noshow = makeApt({ status: 'no_show' });
  check('history: no_show', isHistoryBooking(noshow));
  check('rebook: no_show', canRebook(noshow));
  check('meta label No-show', getBookingStatusMeta('no_show').label === 'No-show');
}

{
  // Past confirmed → history
  const past = makeApt({
    status: 'confirmed',
    date: '2020-01-15',
    time: '10:00 AM',
  });
  check('history: stale confirmed', isHistoryBooking(past));
  check('not upcoming: stale confirmed', !isAppointmentUpcoming(past));
}

// ---------------------------------------------------------------------------
// WhatsApp
// ---------------------------------------------------------------------------

{
  const sent = resolveWhatsAppStatus(makeApt({ whatsappConfirmationStatus: 'sent' }));
  check('wa: sent label', /whatsapp confirmation sent/i.test(sent.label));

  const queued = resolveWhatsAppStatus(makeApt({ whatsappConfirmationStatus: 'queued' }));
  check('wa: queued', queued.status === 'queued');

  const failed = resolveWhatsAppStatus(makeApt({ whatsappConfirmationStatus: 'failed' }));
  check('wa: failed', failed.status === 'failed');

  const inferred = resolveWhatsAppStatus(
    makeApt({ whatsappConfirmationStatus: undefined, status: 'confirmed' })
  );
  check('wa: inferred queued for confirmed', inferred.status === 'queued');
}

// ---------------------------------------------------------------------------
// Calendar / directions
// ---------------------------------------------------------------------------

{
  const apt = makeApt();
  const gcal = buildGoogleCalendarUrl(apt);
  check('gcal: google url', gcal.includes('calendar.google.com'));
  check('gcal: title encoded', gcal.includes('Salon'));
  check('gcal: ref present', gcal.includes(encodeURIComponent(apt.bookingRef)) || gcal.includes('NX'));

  const ics = buildIcsDataUrl(apt);
  check('ics: data url', ics.startsWith('data:text/calendar'));
  check('ics: contains VEVENT', decodeURIComponent(ics).includes('BEGIN:VEVENT'));
  check('ics: contains summary', decodeURIComponent(ics).includes('Scissors'));

  const dir = bookingDirectionsUrl(apt);
  check('directions: maps url', Boolean(dir && dir.includes('maps')));

  const dirFallback = bookingDirectionsUrl(
    makeApt({ mapsUrl: undefined, salonAddress: 'C-Scheme, Jaipur' })
  );
  check(
    'directions: address fallback',
    Boolean(dirFallback && dirFallback.includes('C-Scheme'))
  );
}

{
  const label = formatBookingDate(new Date().toISOString().split('T')[0]);
  check('format date: today', /today/i.test(label));
}

// Confirmation copy contract
check(
  'confirmation phrase available',
  getBookingStatusMeta('confirmed').description === 'Your booking is confirmed'
);

// Cancel rules (My Bookings)
{
  const upcoming = makeApt({ status: 'confirmed' });
  check('canCancel: upcoming confirmed', canCancelBooking(upcoming));

  const pending = makeApt({ status: 'pending' });
  check('canCancel: pending', canCancelBooking(pending));

  const completed = makeApt({ status: 'completed' });
  check('canCancel: not completed', !canCancelBooking(completed));

  const cancelled = makeApt({ status: 'cancelled' });
  check('canCancel: not cancelled', !canCancelBooking(cancelled));

  const past = makeApt({ status: 'confirmed', date: '2020-01-15', time: '10:00 AM' });
  check('canCancel: not past confirmed', !canCancelBooking(past));
}

console.log(`\n${passed}/${passed + failed} passed`);
if (failed > 0) process.exit(1);
