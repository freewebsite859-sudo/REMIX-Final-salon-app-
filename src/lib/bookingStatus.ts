/**
 * Canonical booking lifecycle statuses for Nexora customer bookings.
 *
 * Lifecycle:
 *   pending → confirmed → completed
 *            ↘ cancelled
 *            ↘ no_show
 */
import type { Appointment } from '../types';
import { isAppointmentUpcoming, parseAppointmentDateTime } from './appointments';

/** Customer-facing booking status (stored on `Appointment.status`). */
export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'no_show';

/** Legacy alias kept during transition (`in_progress` → treated as confirmed). */
export const BOOKING_STATUSES: readonly BookingStatus[] = [
  'pending',
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
] as const;

export const BOOKING_STATUS_SET = new Set<string>(BOOKING_STATUSES);

/** Normalize any stored/legacy status string into a canonical BookingStatus. */
export function normalizeBookingStatus(raw: string | undefined | null): BookingStatus {
  const s = (raw || '').toLowerCase().trim().replace(/[\s-]+/g, '_');
  if (s === 'in_progress' || s === 'inprogress') return 'confirmed';
  if (s === 'noshow' || s === 'no-show') return 'no_show';
  if (BOOKING_STATUS_SET.has(s)) return s as BookingStatus;
  // Unknown → pending so we never invent a "confirmed" badge.
  return 'pending';
}

export function isValidBookingStatus(raw: unknown): raw is BookingStatus {
  if (typeof raw !== 'string') return false;
  const s = raw.toLowerCase().trim().replace(/[\s-]+/g, '_');
  // Accept canonical + legacy aliases only — do not treat unknowns as valid
  // just because normalize maps them to pending.
  if (BOOKING_STATUS_SET.has(s)) return true;
  if (s === 'in_progress' || s === 'inprogress' || s === 'noshow') return true;
  return false;
}

/** Statuses accepted when hydrating from local storage / API payloads. */
export const SANITIZE_STATUS_ALLOWLIST = [
  'pending',
  'confirmed',
  'in_progress', // legacy → normalized later
  'completed',
  'cancelled',
  'no_show',
  'no-show',
] as const;

export interface BookingStatusMeta {
  id: BookingStatus;
  label: string;
  /** Short line shown under the badge. */
  description: string;
  /** Tailwind-ish tone keys used by UI chips. */
  tone: 'amber' | 'emerald' | 'slate' | 'rose' | 'orange';
  icon: string;
}

export const BOOKING_STATUS_META: Record<BookingStatus, BookingStatusMeta> = {
  pending: {
    id: 'pending',
    label: 'Pending',
    description: 'Submitted — waiting for salon confirmation',
    tone: 'amber',
    icon: 'hourglass_top',
  },
  confirmed: {
    id: 'confirmed',
    label: 'Confirmed',
    description: 'Your booking is confirmed',
    tone: 'emerald',
    icon: 'check_circle',
  },
  completed: {
    id: 'completed',
    label: 'Completed',
    description: 'Visit finished — thanks for coming',
    tone: 'slate',
    icon: 'task_alt',
  },
  cancelled: {
    id: 'cancelled',
    label: 'Cancelled',
    description: 'This booking was cancelled',
    tone: 'rose',
    icon: 'cancel',
  },
  no_show: {
    id: 'no_show',
    label: 'No-show',
    description: 'Marked as missed — you can rebook anytime',
    tone: 'orange',
    icon: 'person_off',
  },
};

export function getBookingStatusMeta(status: string | undefined | null): BookingStatusMeta {
  return BOOKING_STATUS_META[normalizeBookingStatus(status)];
}

/** Tailwind class bundles for status chips. */
export function bookingStatusChipClasses(status: string | undefined | null): string {
  const id = normalizeBookingStatus(status);
  switch (id) {
    case 'pending':
      return 'bg-amber-500/15 text-amber-800 border-amber-500/25';
    case 'confirmed':
      return 'bg-success-emerald/15 text-success-emerald border-success-emerald/25';
    case 'completed':
      return 'bg-secondary-container text-secondary border-outline-variant/40';
    case 'cancelled':
      return 'bg-error-container text-error border-error/20';
    case 'no_show':
      return 'bg-orange-500/15 text-orange-800 border-orange-500/25';
    default:
      return 'bg-surface-container text-on-surface-variant border-outline-variant/40';
  }
}

/** True when the booking still needs customer attention on the upcoming list. */
export function isActiveBooking(appointment: Appointment, now = new Date()): boolean {
  const status = normalizeBookingStatus(appointment.status);
  if (status === 'pending') return true;
  if (status === 'confirmed') return isAppointmentUpcoming(appointment, now);
  return false;
}

/** Past / history bucket (completed visits + no-shows + stale confirmed). */
export function isHistoryBooking(appointment: Appointment, now = new Date()): boolean {
  const status = normalizeBookingStatus(appointment.status);
  if (status === 'completed' || status === 'no_show') return true;
  if (status === 'confirmed' && !isAppointmentUpcoming(appointment, now)) return true;
  return false;
}

export function isCancelledBooking(appointment: Appointment): boolean {
  return normalizeBookingStatus(appointment.status) === 'cancelled';
}

/** Rebook is offered from history (completed / cancelled / no-show). */
export function canRebook(appointment: Appointment): boolean {
  const status = normalizeBookingStatus(appointment.status);
  return status === 'completed' || status === 'cancelled' || status === 'no_show';
}

/**
 * Cancel is allowed for pending / confirmed bookings whose slot has not
 * started yet. Completed, cancelled, and no-show cannot be cancelled again.
 */
export function canCancelBooking(appointment: Appointment, now = new Date()): boolean {
  const status = normalizeBookingStatus(appointment.status);
  if (status !== 'pending' && status !== 'confirmed') return false;
  return isAppointmentUpcoming(appointment, now);
}

// ---------------------------------------------------------------------------
// WhatsApp confirmation
// ---------------------------------------------------------------------------

export type WhatsAppConfirmationStatus =
  | 'sent'
  | 'queued'
  | 'not_sent'
  | 'failed'
  | 'unknown';

export function resolveWhatsAppStatus(
  appointment: Appointment
): { status: WhatsAppConfirmationStatus; label: string; detail: string; icon: string } {
  const explicit = appointment.whatsappConfirmationStatus;
  if (explicit === 'sent') {
    return {
      status: 'sent',
      label: 'WhatsApp confirmation sent',
      detail: appointment.whatsappSentAt
        ? `Sent ${formatShortStamp(appointment.whatsappSentAt)}`
        : 'Details shared on WhatsApp',
      icon: 'mark_chat_read',
    };
  }
  if (explicit === 'queued') {
    return {
      status: 'queued',
      label: 'WhatsApp confirmation queued',
      detail: 'You will receive a message shortly',
      icon: 'schedule_send',
    };
  }
  if (explicit === 'failed') {
    return {
      status: 'failed',
      label: 'WhatsApp delivery failed',
      detail: 'Open your booking to resend or share manually',
      icon: 'error',
    };
  }
  if (explicit === 'not_sent') {
    return {
      status: 'not_sent',
      label: 'WhatsApp not sent',
      detail: 'Enable WhatsApp alerts in Profile to receive updates',
      icon: 'chat_error',
    };
  }

  // Infer from booking status when the field is absent.
  const bookingStatus = normalizeBookingStatus(appointment.status);
  if (bookingStatus === 'confirmed' || bookingStatus === 'pending') {
    return {
      status: 'queued',
      label: 'WhatsApp confirmation on the way',
      detail: 'A confirmation message is being prepared for your number',
      icon: 'sms',
    };
  }
  return {
    status: 'unknown',
    label: 'WhatsApp status unavailable',
    detail: 'Check Notifications for booking updates',
    icon: 'chat',
  };
}

function formatShortStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Calendar helpers
// ---------------------------------------------------------------------------

/** Build a Google Calendar template URL for the appointment. */
export function buildGoogleCalendarUrl(apt: Appointment): string {
  const title = encodeURIComponent(`Salon Appointment: ${apt.salonName}`);
  const services = apt.services.map((s) => s.name).join(', ');
  const details = encodeURIComponent(
    `Services: ${services}\nStaff: ${apt.stylist?.name || 'Any available'}\nRef: ${apt.bookingRef}\nBooked via Nexora`
  );
  const location = encodeURIComponent(apt.salonAddress || '');

  const start = parseAppointmentDateTime(apt.date, apt.time);
  let datesParam = '';
  if (start) {
    const durationMins = apt.services.reduce((sum, s) => sum + (s.duration || 30), 0) || 60;
    const end = new Date(start.getTime() + durationMins * 60_000);
    datesParam = `&dates=${toCalStamp(start)}/${toCalStamp(end)}`;
  }

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}${datesParam}`;
}

/** Build a downloadable .ics data URL. */
export function buildIcsDataUrl(apt: Appointment): string {
  const start = parseAppointmentDateTime(apt.date, apt.time) || new Date();
  const durationMins = apt.services.reduce((sum, s) => sum + (s.duration || 30), 0) || 60;
  const end = new Date(start.getTime() + durationMins * 60_000);
  const uid = `${apt.bookingRef || apt.id}@nexora.app`;
  const summary = escapeIcs(`Salon: ${apt.salonName}`);
  const description = escapeIcs(
    `Services: ${apt.services.map((s) => s.name).join(', ')}\\nStaff: ${
      apt.stylist?.name || 'Any available'
    }\\nRef: ${apt.bookingRef}`
  );
  const location = escapeIcs(apt.salonAddress || '');

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nexora//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toCalStamp(new Date())}`,
    `DTSTART:${toCalStamp(start)}`,
    `DTEND:${toCalStamp(end)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

function toCalStamp(d: Date): string {
  // UTC basic format YYYYMMDDTHHMMSSZ
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

function escapeIcs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/** Directions URL — prefer stored mapsUrl, else compose from address. */
export function bookingDirectionsUrl(apt: Appointment): string | null {
  if (apt.mapsUrl) return apt.mapsUrl;
  if (apt.salonLatitude != null && apt.salonLongitude != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${apt.salonLatitude},${apt.salonLongitude}`;
  }
  if (apt.salonAddress) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(apt.salonAddress)}`;
  }
  return null;
}

/** Human-readable date for confirmation tickets. */
export function formatBookingDate(dateStr: string): string {
  if (!dateStr) return '—';
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  if (dateStr === todayStr) {
    return `Today, ${today.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}`;
  }
  if (dateStr === tomorrowStr) {
    return `Tomorrow, ${tomorrow.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}`;
  }
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString('en-IN', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  return dateStr;
}
