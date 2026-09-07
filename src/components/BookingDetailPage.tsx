/**
 * Booking Detail Page — `/customer/booking/:bookingId`
 *
 * Full booking ticket with:
 *   Booking ID · Status · Salon · Services · Staff · Date/time · Price
 *   Customer note · Payment status · Reward status
 *   Directions · Contact salon · Cancel (if upcoming) · Review (if completed)
 */
import React, { useState } from 'react';
import type { Appointment } from '../types';
import {
  bookingDirectionsUrl,
  bookingStatusChipClasses,
  buildGoogleCalendarUrl,
  buildIcsDataUrl,
  canCancelBooking,
  canRebook,
  formatBookingDate,
  getBookingStatusMeta,
  isHistoryBooking,
  normalizeBookingStatus,
  resolveWhatsAppStatus,
} from '../lib/bookingStatus';
import { isAppointmentUpcoming } from '../lib/appointments';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** ~1 loyalty point per ₹10 spent on completed visits (display estimate). */
export function estimateRewardPoints(totalPrice: number): number {
  const n = Number(totalPrice);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(1, Math.floor(n / 10));
}

export function paymentStatusMeta(apt: Appointment): {
  label: string;
  detail: string;
  tone: 'emerald' | 'amber' | 'rose' | 'slate';
  icon: string;
} {
  const status = (apt.paymentStatus || '').toLowerCase();
  const advance =
    apt.advancePaid !== undefined ? apt.advancePaid : Math.round(apt.totalPrice * 0.25);
  const remaining =
    apt.remainingAmount !== undefined
      ? apt.remainingAmount
      : Math.max(0, apt.totalPrice - advance);

  if (status === 'paid' || (apt.advancePaid !== undefined && apt.advancePaid > 0)) {
    return {
      label: 'Advance paid',
      detail:
        remaining > 0
          ? `₹${advance.toLocaleString('en-IN')} paid online · ₹${remaining.toLocaleString('en-IN')} due at salon`
          : `₹${advance.toLocaleString('en-IN')} paid in full`,
      tone: 'emerald',
      icon: 'verified',
    };
  }
  if (status === 'failed') {
    return {
      label: 'Payment failed',
      detail: 'No deposit was captured. Rebook to lock this slot again.',
      tone: 'rose',
      icon: 'error',
    };
  }
  if (status === 'pending') {
    return {
      label: 'Payment pending',
      detail: `Awaiting ₹${advance.toLocaleString('en-IN')} advance confirmation`,
      tone: 'amber',
      icon: 'hourglass_top',
    };
  }
  // Infer from booking lifecycle when paymentStatus is absent.
  const booking = normalizeBookingStatus(apt.status);
  if (booking === 'confirmed' || booking === 'completed') {
    return {
      label: 'Advance paid',
      detail:
        remaining > 0
          ? `₹${advance.toLocaleString('en-IN')} online · ₹${remaining.toLocaleString('en-IN')} at salon`
          : `₹${apt.totalPrice.toLocaleString('en-IN')} settled`,
      tone: 'emerald',
      icon: 'payments',
    };
  }
  if (booking === 'cancelled') {
    return {
      label: 'Payment voided',
      detail: 'Any advance will follow the salon refund policy.',
      tone: 'slate',
      icon: 'money_off',
    };
  }
  return {
    label: 'Payment not started',
    detail: 'Deposit is collected when the slot is locked.',
    tone: 'slate',
    icon: 'account_balance_wallet',
  };
}

export function rewardStatusMeta(apt: Appointment): {
  label: string;
  detail: string;
  tone: 'emerald' | 'amber' | 'slate' | 'rose';
  icon: string;
  points: number;
} {
  const points = estimateRewardPoints(apt.totalPrice);
  const status = normalizeBookingStatus(apt.status);

  if (status === 'completed') {
    return {
      label: 'Rewards credited',
      detail: `≈ ${points.toLocaleString('en-IN')} loyalty points earned on this visit`,
      tone: 'emerald',
      icon: 'stars',
      points,
    };
  }
  if (status === 'confirmed' || status === 'pending') {
    return {
      label: 'Rewards pending',
      detail: `Complete the visit to unlock ≈ ${points.toLocaleString('en-IN')} points`,
      tone: 'amber',
      icon: 'workspace_premium',
      points,
    };
  }
  if (status === 'cancelled' || status === 'no_show') {
    return {
      label: 'No rewards',
      detail: 'Points are only earned on completed visits.',
      tone: 'slate',
      icon: 'block',
      points: 0,
    };
  }
  return {
    label: 'Rewards pending',
    detail: `≈ ${points.toLocaleString('en-IN')} points after completion`,
    tone: 'amber',
    icon: 'stars',
    points,
  };
}

function contactSalonHref(apt: Appointment): { tel?: string; wa?: string } {
  const raw = (apt.salonPhone || '').replace(/[^\d+]/g, '');
  const digits = raw.replace(/\D/g, '');
  const out: { tel?: string; wa?: string } = {};
  if (raw) out.tel = `tel:${raw}`;
  if (digits.length >= 10) {
    const waNumber = digits.startsWith('91') ? digits : `91${digits.slice(-10)}`;
    const msg = encodeURIComponent(
      `Hi, this is about my Nexora booking ${apt.bookingRef || apt.id} on ${apt.date} at ${apt.time}.`
    );
    out.wa = `https://wa.me/${waNumber}?text=${msg}`;
  }
  return out;
}

const toneBox: Record<string, string> = {
  emerald: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-800',
  amber: 'bg-amber-500/10 border-amber-500/25 text-amber-900',
  rose: 'bg-error-container/70 border-error/25 text-error',
  slate: 'bg-surface-container-low border-outline-variant/50 text-on-surface',
};

const toneIcon: Record<string, string> = {
  emerald: 'bg-emerald-600 text-white',
  amber: 'bg-amber-500 text-white',
  rose: 'bg-error text-white',
  slate: 'bg-primary/10 text-primary',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface BookingDetailPageProps {
  appointment: Appointment | null;
  bookingId?: string;
  onBack?: () => void;
  onCancel?: (id: string) => void;
  onRebook?: (appointment: Appointment) => void;
  onReschedule?: (id: string) => void;
  onOpenSalon?: (salonId: string) => void;
  onOpenRewards?: () => void;
  /** Called after a review is submitted (UI-only until a reviews API exists). */
  onSubmitReview?: (appointmentId: string, rating: number, note: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const BookingDetailPage: React.FC<BookingDetailPageProps> = ({
  appointment,
  bookingId,
  onBack,
  onCancel,
  onRebook,
  onReschedule,
  onOpenSalon,
  onOpenRewards,
  onSubmitReview,
}) => {
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Not found
  if (!appointment) {
    return (
      <div
        id="booking-detail-page"
        data-route-pattern="/customer/booking/:bookingId"
        data-booking-id={bookingId || ''}
        className="flex flex-col w-full pb-28 max-w-xl mx-auto px-page-margin pt-4"
      >
        <button
          type="button"
          id="booking-detail-back-btn"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-[13px] font-bold text-nexora-pink hover:underline cursor-pointer mb-6 self-start"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          My Bookings
        </button>
        <div
          id="booking-detail-not-found"
          className="py-14 flex flex-col items-center text-center bg-white rounded-3xl border border-outline-variant/50 p-8 shadow-xs"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[32px]">search_off</span>
          </div>
          <h1 className="font-page-heading text-[18px] font-bold text-on-surface mb-1.5">
            Booking not found
          </h1>
          <p className="text-[13px] text-on-surface-variant max-w-sm mb-5 leading-relaxed">
            We couldn’t find booking
            {bookingId ? (
              <>
                {' '}
                <span className="font-mono font-semibold text-on-surface">{bookingId}</span>
              </>
            ) : null}
            . It may have been removed or belongs to another account.
          </p>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="px-5 py-3 rounded-xl bg-primary text-white text-[13px] font-bold hover:bg-nexora-pink transition-colors cursor-pointer"
            >
              Back to My Bookings
            </button>
          )}
        </div>
      </div>
    );
  }

  const status = normalizeBookingStatus(appointment.status);
  const meta = getBookingStatusMeta(status);
  const payment = paymentStatusMeta(appointment);
  const reward = rewardStatusMeta(appointment);
  const whatsapp = resolveWhatsAppStatus(appointment);
  const directionsUrl = bookingDirectionsUrl(appointment);
  const contacts = contactSalonHref(appointment);
  const upcoming = isAppointmentUpcoming(appointment);
  const allowCancel = canCancelBooking(appointment);
  const allowRebook = canRebook(appointment);
  const allowReview = status === 'completed';
  const fromHistory = isHistoryBooking(appointment) || status === 'cancelled';

  const advance =
    appointment.advancePaid !== undefined
      ? appointment.advancePaid
      : Math.round(appointment.totalPrice * 0.25);
  const remaining =
    appointment.remainingAmount !== undefined
      ? appointment.remainingAmount
      : Math.max(0, appointment.totalPrice - advance);

  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(appointment.bookingRef || appointment.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const handleSubmitReview = () => {
    onSubmitReview?.(appointment.id, rating, reviewNote.trim());
    setReviewSubmitted(true);
    window.setTimeout(() => {
      setShowReview(false);
    }, 1800);
  };

  return (
    <div
      id="booking-detail-page"
      data-route-pattern="/customer/booking/:bookingId"
      data-booking-id={appointment.id}
      data-booking-status={status}
      className="flex flex-col w-full pb-28 max-w-xl mx-auto"
    >
      {/* Top bar */}
      <div className="px-page-margin pt-3 pb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          id="booking-detail-back-btn"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-[13px] font-bold text-nexora-pink hover:underline cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          My Bookings
        </button>
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${bookingStatusChipClasses(
            status
          )}`}
        >
          <span className="material-symbols-outlined text-[14px]">{meta.icon}</span>
          {meta.label}
        </span>
      </div>

      {/* Hero */}
      <section className="mx-page-margin mt-1 relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-[#5a0028] to-nexora-pink text-white px-5 pt-5 pb-6 shadow-lg">
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="relative z-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/75 mb-1">
            Booking detail
          </p>
          <h1 className="font-hero-heading text-[22px] font-extrabold leading-tight">
            {appointment.salonName}
          </h1>
          <p className="mt-1 text-[13px] text-white/85">
            {formatBookingDate(appointment.date)} · {appointment.time}
          </p>

          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 border border-white/20">
            <span className="text-[11px] font-semibold text-white/80 uppercase tracking-wider">
              Booking ID
            </span>
            <span
              id="booking-detail-id"
              className="font-mono font-bold text-[14px] tracking-wide"
            >
              {appointment.bookingRef || appointment.id}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              aria-label="Copy booking ID"
              className="w-7 h-7 rounded-full hover:bg-white/20 flex items-center justify-center cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">
                {copied ? 'check' : 'content_copy'}
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Status + meta chips */}
      <div className="px-page-margin mt-3 flex flex-wrap gap-2">
        <span
          id="booking-detail-status"
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${bookingStatusChipClasses(
            status
          )}`}
        >
          <span className="material-symbols-outlined text-[14px]">{meta.icon}</span>
          Status: {meta.label}
        </span>
        {appointment.salonConfirmationStatus === 'confirmed_by_owner' && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
            <span className="material-symbols-outlined text-[14px]">verified</span>
            Owner confirmed
          </span>
        )}
        {upcoming && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-primary/10 text-primary border border-primary/15">
            <span className="material-symbols-outlined text-[14px]">event_upcoming</span>
            Upcoming
          </span>
        )}
      </div>

      {/* Main detail card */}
      <section
        id="booking-detail-card"
        className="mx-page-margin mt-3 bg-white border border-outline-variant/50 rounded-2xl shadow-xs overflow-hidden"
      >
        {/* Salon */}
        <button
          type="button"
          id="booking-detail-salon"
          onClick={() => onOpenSalon?.(appointment.salonId)}
          className="w-full px-4 pt-4 pb-3 flex items-center gap-3 text-left cursor-pointer group border-b border-outline-variant/30"
        >
          {appointment.salonImage && (
            <img
              src={appointment.salonImage}
              alt={appointment.salonName}
              className="w-14 h-14 rounded-xl object-cover ring-1 ring-outline-variant/40 shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-nexora-pink">Salon</p>
            <h2 className="font-card-title text-[16px] font-bold text-on-surface group-hover:text-nexora-pink transition-colors truncate">
              {appointment.salonName}
            </h2>
            <p className="text-[12px] text-on-surface-variant line-clamp-2 mt-0.5">
              {appointment.salonAddress}
            </p>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant text-[18px]">
            chevron_right
          </span>
        </button>

        <div className="px-4 py-1 divide-y divide-outline-variant/30">
          {/* Services */}
          <div id="booking-detail-services" className="py-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-2 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">content_cut</span>
              Services ({appointment.services.length})
            </p>
            {appointment.services.length === 0 ? (
              <p className="text-[13px] text-on-surface-variant">No services listed</p>
            ) : (
              <ul className="space-y-2">
                {appointment.services.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-2 text-[13px]"
                  >
                    <span className="font-semibold text-on-surface min-w-0 truncate">
                      {s.name}
                      <span className="text-on-surface-variant font-normal">
                        {' '}
                        · {s.duration}m
                      </span>
                    </span>
                    <span className="font-bold text-on-surface shrink-0">
                      ₹{(s.discountPrice || s.price).toLocaleString('en-IN')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Staff */}
          <div id="booking-detail-staff" className="py-3 flex items-center gap-3">
            {appointment.stylist?.avatar ? (
              <img
                src={appointment.stylist.avatar}
                alt={appointment.stylist.name}
                className="w-10 h-10 rounded-full object-cover ring-2 ring-primary/15 shrink-0"
              />
            ) : (
              <span className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px]">badge</span>
              </span>
            )}
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                Staff
              </p>
              <p className="text-[14px] font-semibold text-on-surface truncate">
                {appointment.stylist?.name || 'Any available professional'}
              </p>
              {appointment.stylist?.role && (
                <p className="text-[11px] text-on-surface-variant truncate">
                  {appointment.stylist.role}
                </p>
              )}
            </div>
          </div>

          {/* Date / time */}
          <div id="booking-detail-datetime" className="py-3 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">event</span>
                Date
              </p>
              <p className="text-[14px] font-semibold text-on-surface mt-0.5">
                {formatBookingDate(appointment.date)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">schedule</span>
                Time
              </p>
              <p className="text-[14px] font-semibold text-on-surface mt-0.5">{appointment.time}</p>
            </div>
          </div>

          {/* Price */}
          <div id="booking-detail-price" className="py-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1 mb-1">
              <span className="material-symbols-outlined text-[14px]">payments</span>
              Price
            </p>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[20px] font-extrabold text-on-surface">
                ₹{appointment.totalPrice.toLocaleString('en-IN')}
              </span>
              <span className="text-[11px] text-on-surface-variant text-right">
                {advance > 0 && (
                  <>
                    Adv ₹{advance.toLocaleString('en-IN')}
                    {remaining > 0 ? ` · Due ₹${remaining.toLocaleString('en-IN')}` : ''}
                  </>
                )}
              </span>
            </div>
            {appointment.discountApplied && appointment.discountApplied > 0 && (
              <p className="text-[11px] text-emerald-700 font-semibold mt-1">
                Discount applied: −₹{appointment.discountApplied.toLocaleString('en-IN')}
              </p>
            )}
          </div>

          {/* Customer note */}
          <div id="booking-detail-note" className="py-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1 mb-1">
              <span className="material-symbols-outlined text-[14px]">sticky_note_2</span>
              Customer note
            </p>
            {appointment.notes && appointment.notes.trim() ? (
              <p className="text-[13px] text-on-surface leading-relaxed bg-surface-container-low rounded-xl px-3 py-2 border border-outline-variant/40">
                “{appointment.notes.trim()}”
              </p>
            ) : (
              <p className="text-[13px] text-on-surface-variant italic">No special requests added.</p>
            )}
          </div>
        </div>
      </section>

      {/* Payment status */}
      <section
        id="booking-detail-payment"
        className={`mx-page-margin mt-3 p-3.5 rounded-2xl border flex items-start gap-3 ${toneBox[payment.tone]}`}
      >
        <span
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${toneIcon[payment.tone]}`}
        >
          <span className="material-symbols-outlined text-[20px]">{payment.icon}</span>
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">Payment status</p>
          <p className="text-[14px] font-bold mt-0.5">{payment.label}</p>
          <p className="text-[12px] mt-0.5 leading-snug opacity-90">{payment.detail}</p>
          {appointment.razorpayPaymentId && (
            <p className="text-[10px] font-mono mt-1.5 opacity-70 truncate">
              Txn: {appointment.razorpayPaymentId}
            </p>
          )}
          {appointment.paymentMethodUsed && (
            <p className="text-[11px] mt-1 font-semibold capitalize opacity-80">
              Via {appointment.paymentMethodUsed.replace('_', ' ')}
            </p>
          )}
        </div>
      </section>

      {/* Reward status */}
      <section
        id="booking-detail-reward"
        className={`mx-page-margin mt-2.5 p-3.5 rounded-2xl border flex items-start gap-3 ${toneBox[reward.tone]}`}
      >
        <span
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${toneIcon[reward.tone]}`}
        >
          <span className="material-symbols-outlined text-[20px]">{reward.icon}</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">Reward status</p>
          <p className="text-[14px] font-bold mt-0.5">{reward.label}</p>
          <p className="text-[12px] mt-0.5 leading-snug opacity-90">{reward.detail}</p>
          {onOpenRewards && (
            <button
              type="button"
              id="booking-detail-rewards-link"
              onClick={onOpenRewards}
              className="mt-2 text-[12px] font-bold underline underline-offset-2 cursor-pointer"
            >
              View rewards
            </button>
          )}
        </div>
      </section>

      {/* WhatsApp (compact) */}
      <section
        id="booking-detail-whatsapp"
        className="mx-page-margin mt-2.5 p-3 rounded-2xl border border-outline-variant/50 bg-white flex items-center gap-3"
      >
        <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[18px]">{whatsapp.icon}</span>
        </span>
        <div className="min-w-0">
          <p className="text-[12px] font-bold text-on-surface">{whatsapp.label}</p>
          <p className="text-[11px] text-on-surface-variant truncate">{whatsapp.detail}</p>
        </div>
      </section>

      {/* Review panel (completed) */}
      {allowReview && showReview && (
        <section
          id="booking-detail-review-panel"
          className="mx-page-margin mt-3 p-4 rounded-2xl border border-outline-variant/50 bg-white shadow-xs"
        >
          {reviewSubmitted ? (
            <div className="flex items-center gap-2 text-success-emerald text-[13px] font-semibold">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              Thanks! Your review was submitted.
            </div>
          ) : (
            <>
              <h3 className="font-card-title text-[15px] font-bold text-on-surface mb-2">
                How was your visit?
              </h3>
              <div className="flex items-center gap-1 mb-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="text-warning-amber hover:scale-110 transition-transform cursor-pointer"
                    aria-label={`Rate ${star} stars`}
                  >
                    <span
                      className={`material-symbols-outlined text-[28px] ${
                        star <= rating ? 'fill-1' : ''
                      }`}
                    >
                      star
                    </span>
                  </button>
                ))}
              </div>
              <textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="Share feedback for the salon (optional)"
                rows={3}
                className="w-full px-3 py-2 text-[13px] rounded-xl border border-outline-variant/50 bg-surface-container-low text-on-surface focus:outline-none focus:border-primary/40 resize-none"
              />
              <div className="flex items-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => setShowReview(false)}
                  className="flex-1 py-2.5 rounded-xl border border-outline-variant/60 text-[13px] font-bold text-on-surface cursor-pointer"
                >
                  Not now
                </button>
                <button
                  type="button"
                  id="booking-detail-submit-review-btn"
                  onClick={handleSubmitReview}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-white text-[13px] font-bold hover:bg-nexora-pink cursor-pointer"
                >
                  Submit review
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {/* Cancel confirm */}
      {cancelConfirm && (
        <section
          id="booking-detail-cancel-confirm"
          className="mx-page-margin mt-3 p-4 rounded-2xl border border-error/30 bg-error-container/40"
        >
          <p className="text-[13px] text-on-surface font-semibold">
            Cancel booking {appointment.bookingRef}?
          </p>
          <p className="text-[12px] text-on-surface-variant mt-1">
            This can’t be undone. Any advance follows the salon’s refund policy.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={() => setCancelConfirm(false)}
              className="flex-1 py-2.5 rounded-xl border border-outline-variant/60 text-[13px] font-bold text-on-surface cursor-pointer"
            >
              Keep booking
            </button>
            <button
              type="button"
              id="booking-detail-confirm-cancel-btn"
              onClick={() => {
                onCancel?.(appointment.id);
                setCancelConfirm(false);
              }}
              className="flex-1 py-2.5 rounded-xl bg-error text-white text-[13px] font-bold hover:bg-error-crimson cursor-pointer"
            >
              Yes, cancel
            </button>
          </div>
        </section>
      )}

      {/* Actions */}
      <section id="booking-detail-actions" className="px-page-margin mt-4 space-y-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Directions */}
          {directionsUrl ? (
            <a
              id="booking-detail-directions-btn"
              href={directionsUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full py-3 px-4 rounded-xl bg-white border border-outline-variant/60 text-nexora-pink font-bold text-[13px] flex items-center justify-center gap-2 hover:border-nexora-pink/40 hover:shadow-xs transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">directions</span>
              Get directions
            </a>
          ) : (
            <button
              type="button"
              id="booking-detail-directions-btn"
              disabled
              className="w-full py-3 px-4 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface-variant font-bold text-[13px] flex items-center justify-center gap-2 opacity-60 cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[18px]">directions_off</span>
              Directions unavailable
            </button>
          )}

          {/* Contact salon */}
          {contacts.tel || contacts.wa ? (
            <div className="relative flex gap-2">
              {contacts.tel && (
                <a
                  id="booking-detail-contact-btn"
                  href={contacts.tel}
                  className="flex-1 py-3 px-3 rounded-xl bg-white border border-outline-variant/60 text-on-surface font-bold text-[13px] flex items-center justify-center gap-1.5 hover:border-primary/40 transition-all"
                >
                  <span className="material-symbols-outlined text-[18px] text-primary">call</span>
                  Call salon
                </a>
              )}
              {contacts.wa && (
                <a
                  id="booking-detail-whatsapp-btn"
                  href={contacts.wa}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 py-3 px-3 rounded-xl bg-white border border-outline-variant/60 text-on-surface font-bold text-[13px] flex items-center justify-center gap-1.5 hover:border-primary/40 transition-all"
                >
                  <span className="material-symbols-outlined text-[18px] text-emerald-600">chat</span>
                  WhatsApp
                </a>
              )}
            </div>
          ) : (
            <button
              type="button"
              id="booking-detail-contact-btn"
              disabled
              className="w-full py-3 px-4 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface-variant font-bold text-[13px] flex items-center justify-center gap-2 opacity-60 cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[18px]">call</span>
              Contact unavailable
            </button>
          )}
        </div>

        {/* Secondary: calendar */}
        {(status === 'confirmed' || status === 'pending') && upcoming && (
          <div className="relative">
            <button
              type="button"
              id="booking-detail-calendar-btn"
              onClick={() => setCalendarOpen((v) => !v)}
              className="w-full py-3 px-4 rounded-xl bg-white border border-outline-variant/60 text-on-surface font-bold text-[13px] flex items-center justify-center gap-2 hover:border-primary/40 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px] text-primary">event</span>
              Add to calendar
            </button>
            {calendarOpen && (
              <div
                role="menu"
                className="absolute left-0 right-0 top-full mt-1.5 z-20 bg-white border border-outline-variant/50 rounded-xl shadow-lg overflow-hidden"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    window.open(
                      buildGoogleCalendarUrl(appointment),
                      '_blank',
                      'noopener,noreferrer'
                    );
                    setCalendarOpen(false);
                  }}
                  className="w-full px-4 py-3 text-left text-[13px] font-semibold hover:bg-surface-container-low cursor-pointer"
                >
                  Google Calendar
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = buildIcsDataUrl(appointment);
                    a.download = `nexora-${appointment.bookingRef || appointment.id}.ics`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    setCalendarOpen(false);
                  }}
                  className="w-full px-4 py-3 text-left text-[13px] font-semibold hover:bg-surface-container-low cursor-pointer border-t border-outline-variant/40"
                >
                  Download .ics
                </button>
              </div>
            )}
          </div>
        )}

        {/* Cancel — upcoming only */}
        {allowCancel && !cancelConfirm && (
          <button
            type="button"
            id="booking-detail-cancel-btn"
            onClick={() => setCancelConfirm(true)}
            className="w-full py-3.5 px-4 rounded-xl border-2 border-error/40 text-error font-bold text-[14px] flex items-center justify-center gap-2 hover:bg-error-container/40 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">cancel</span>
            Cancel booking
          </button>
        )}

        {/* Review — completed only */}
        {allowReview && !showReview && !reviewSubmitted && (
          <button
            type="button"
            id="booking-detail-review-btn"
            onClick={() => setShowReview(true)}
            className="w-full py-3.5 px-4 rounded-xl bg-primary text-white font-bold text-[14px] flex items-center justify-center gap-2 hover:bg-nexora-pink transition-colors shadow-md cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">rate_review</span>
            Write a review
          </button>
        )}

        {/* Reschedule */}
        {allowCancel && status === 'confirmed' && onReschedule && (
          <button
            type="button"
            id="booking-detail-reschedule-btn"
            onClick={() => onReschedule(appointment.id)}
            className="w-full py-3 px-4 rounded-xl bg-secondary-container text-on-secondary-container font-bold text-[13px] flex items-center justify-center gap-2 hover:opacity-90 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">edit_calendar</span>
            Reschedule
          </button>
        )}

        {/* Rebook */}
        {allowRebook && onRebook && (
          <button
            type="button"
            id="booking-detail-rebook-btn"
            onClick={() => onRebook(appointment)}
            className="w-full py-3.5 px-4 rounded-xl bg-primary text-white font-bold text-[14px] flex items-center justify-center gap-2 hover:bg-nexora-pink transition-colors shadow-md cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">replay</span>
            Rebook this visit
          </button>
        )}
      </section>

      <p className="px-page-margin mt-4 mb-2 text-center text-[11px] text-on-surface-variant">
        {meta.description}
        {fromHistory ? ' · From your booking history' : ''}
      </p>
    </div>
  );
};

export default BookingDetailPage;
