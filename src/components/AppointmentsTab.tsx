/**
 * My Bookings page — `/customer/bookings`
 *
 * Tabs: Upcoming · Completed · Cancelled
 * Cards: salon image/name, service, staff, date, time, status, price,
 *        view details, cancel (when allowed), rebook, review after completion.
 * Empty: “No bookings yet. Find your next salon visit.” + Explore Salons CTA.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Appointment } from '../types';
import { isAppointmentUpcoming } from '../lib/appointments';
import {
  bookingStatusChipClasses,
  buildGoogleCalendarUrl,
  canCancelBooking,
  canRebook,
  formatBookingDate,
  getBookingStatusMeta,
  isCancelledBooking,
  isHistoryBooking,
  normalizeBookingStatus,
} from '../lib/bookingStatus';
export type BookingsSegment = 'upcoming' | 'completed' | 'cancelled';

interface AppointmentsTabProps {
  appointments: Appointment[];
  /** Deep-link highlight from `/customer/booking/:bookingId`. */
  highlightedBookingId?: string;
  onCancelAppointment: (id: string) => void;
  onRescheduleAppointment: (id: string) => void;
  onBookAgain?: (appointment: Appointment) => void;
  onOpenSalonDetailsById?: (salonId: string) => void;
  /** Navigate to `/customer/booking/:bookingId`. */
  onOpenBookingDetail?: (bookingId: string) => void;
  /** Empty-state CTA — typically navigates to `/customer/home` or search. */
  onExploreSalons?: () => void;
}

function serviceLabel(apt: Appointment): string {
  if (!apt.services || apt.services.length === 0) return 'Service TBC';
  if (apt.services.length === 1) return apt.services[0].name;
  if (apt.services.length === 2) {
    return `${apt.services[0].name}, ${apt.services[1].name}`;
  }
  return `${apt.services[0].name} +${apt.services.length - 1} more`;
}

function priceLabel(apt: Appointment): string {
  return `₹${Number(apt.totalPrice || 0).toLocaleString('en-IN')}`;
}

export const AppointmentsTab: React.FC<AppointmentsTabProps> = ({
  appointments,
  highlightedBookingId,
  onCancelAppointment,
  onRescheduleAppointment,
  onBookAgain,
  onOpenSalonDetailsById,
  onOpenBookingDetail,
  onExploreSalons,
}) => {
  const [activeSegment, setActiveSegment] = useState<BookingsSegment>('upcoming');
  const [ratingInput, setRatingInput] = useState<number>(5);
  const [reviewNote, setReviewNote] = useState<string>('');
  const [reviewSubmittedId, setReviewSubmittedId] = useState<string | null>(null);
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);

  // Deep-link `/customer/booking/:id` is owned by BookingDetailPage via App.
  // When a highlight id arrives here (legacy), jump the parent to detail.
  useEffect(() => {
    if (!highlightedBookingId) return;
    const match = appointments.find(
      (a) => a.id === highlightedBookingId || a.bookingRef === highlightedBookingId
    );
    if (match) {
      onOpenBookingDetail?.(match.id);
      const status = normalizeBookingStatus(match.status);
      if (isCancelledBooking(match)) setActiveSegment('cancelled');
      else if (isHistoryBooking(match) || status === 'completed' || status === 'no_show') {
        setActiveSegment('completed');
      } else {
        setActiveSegment('upcoming');
      }
    }
  }, [highlightedBookingId, appointments, onOpenBookingDetail]);

  const upcomingApts = useMemo(
    () =>
      appointments
        .filter((a) => isAppointmentUpcoming(a))
        .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)),
    [appointments]
  );

  // History: completed + no-show + stale confirmed (past visits).
  const completedApts = useMemo(
    () =>
      appointments
        .filter((a) => isHistoryBooking(a))
        .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)),
    [appointments]
  );

  const cancelledApts = useMemo(
    () =>
      appointments
        .filter((a) => isCancelledBooking(a))
        .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)),
    [appointments]
  );

  const displayedList =
    activeSegment === 'upcoming'
      ? upcomingApts
      : activeSegment === 'completed'
        ? completedApts
        : cancelledApts;

  const totalCount = appointments.length;
  const isGloballyEmpty = totalCount === 0;

  const handleGenerateCalendarEvent = (apt: Appointment) => {
    window.open(buildGoogleCalendarUrl(apt), '_blank', 'noopener,noreferrer');
  };

  const handleSubmitReview = (aptId: string) => {
    setReviewSubmittedId(aptId);
    window.setTimeout(() => {
      setReviewSubmittedId(null);
      setReviewNote('');
      setRatingInput(5);
    }, 2500);
  };

  const openDetail = (apt: Appointment) => {
    onOpenBookingDetail?.(apt.id);
  };

  const handleCancel = (id: string) => {
    onCancelAppointment(id);
    setCancelConfirmId(null);
  };

  return (
    <div
      id="my-bookings-page"
      data-route="/customer/bookings"
      className="flex flex-col w-full pb-28 max-w-4xl mx-auto px-page-margin pt-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="min-w-0">
          <h1 className="font-hero-heading-mobile text-[22px] font-bold text-on-surface">
            My Bookings
          </h1>
          <p className="text-[13px] text-on-surface-variant">
            {isGloballyEmpty
              ? 'Your salon visits will show up here'
              : `${totalCount} booking${totalCount === 1 ? '' : 's'} · manage visits & reviews`}
          </p>
        </div>
        {onExploreSalons && !isGloballyEmpty && (
          <button
            type="button"
            id="my-bookings-explore-header-btn"
            onClick={onExploreSalons}
            className="shrink-0 px-3 py-2 rounded-xl bg-primary/10 text-primary text-[12px] font-bold hover:bg-primary/15 transition-colors cursor-pointer inline-flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">explore</span>
            Explore
          </button>
        )}
      </div>

      {/* Segment Tabs: Upcoming · Completed · Cancelled */}
      <div
        id="my-bookings-tabs"
        role="tablist"
        aria-label="Booking filters"
        className="flex bg-surface-container-low p-1 rounded-xl border border-outline-variant/40 mb-5"
      >
        {(
          [
            { id: 'upcoming' as const, label: 'Upcoming', count: upcomingApts.length },
            { id: 'completed' as const, label: 'Completed', count: completedApts.length },
            { id: 'cancelled' as const, label: 'Cancelled', count: cancelledApts.length },
          ] as const
        ).map((tab) => {
          const selected = activeSegment === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`my-bookings-tab-${tab.id}`}
              aria-selected={selected}
              onClick={() => setActiveSegment(tab.id)}
              className={`flex-1 py-2.5 rounded-lg text-[13px] font-semibold transition-all cursor-pointer ${
                selected
                  ? 'bg-white text-primary shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {tab.label}
              <span
                className={`ml-1 tabular-nums ${
                  selected ? 'text-primary' : 'text-on-surface-variant/80'
                }`}
              >
                ({tab.count})
              </span>
            </button>
          );
        })}
      </div>

      {/* Empty states */}
      {isGloballyEmpty ? (
        <div
          id="my-bookings-empty-global"
          className="py-14 flex flex-col items-center justify-center text-center bg-white rounded-3xl border border-outline-variant/50 p-8 shadow-xs"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[32px]">event_busy</span>
          </div>
          <h2 className="font-page-heading text-[18px] font-bold text-on-surface mb-1.5 max-w-xs">
            No bookings yet. Find your next salon visit.
          </h2>
          <p className="text-[13px] text-on-surface-variant max-w-sm mb-5 leading-relaxed">
            Browse verified salons near you, lock a slot in under a minute, and track every visit
            here.
          </p>
          {onExploreSalons && (
            <button
              type="button"
              id="my-bookings-explore-salons-btn"
              onClick={onExploreSalons}
              className="px-6 py-3.5 rounded-xl bg-primary text-white text-[14px] font-bold hover:bg-nexora-pink transition-colors shadow-md cursor-pointer inline-flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">storefront</span>
              Explore Salons
            </button>
          )}
        </div>
      ) : displayedList.length === 0 ? (
        <div
          id={`my-bookings-empty-${activeSegment}`}
          className="py-12 flex flex-col items-center justify-center text-center bg-surface-container-low rounded-2xl border border-outline-variant/40 p-6"
        >
          <div className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center text-nexora-pink mb-3">
            <span className="material-symbols-outlined text-[28px]">
              {activeSegment === 'upcoming'
                ? 'event_available'
                : activeSegment === 'completed'
                  ? 'task_alt'
                  : 'cancel'}
            </span>
          </div>
          <h3 className="font-card-title text-[16px] font-bold text-on-surface mb-1">
            No {activeSegment} bookings
          </h3>
          <p className="text-[13px] text-on-surface-variant max-w-xs mb-4">
            {activeSegment === 'upcoming'
              ? 'You have no upcoming visits. Explore salons to book your next appointment.'
              : activeSegment === 'completed'
                ? 'Completed visits will appear here after you attend.'
                : 'Cancelled bookings will be listed here.'}
          </p>
          {activeSegment === 'upcoming' && onExploreSalons && (
            <button
              type="button"
              id="my-bookings-explore-upcoming-btn"
              onClick={onExploreSalons}
              className="px-5 py-2.5 rounded-xl bg-primary text-white text-[13px] font-bold hover:bg-nexora-pink transition-colors shadow-xs cursor-pointer inline-flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">storefront</span>
              Explore Salons
            </button>
          )}
        </div>
      ) : (
        <div id="my-bookings-list" className="flex flex-col gap-3.5" role="list">
          {displayedList.map((apt) => {
            const status = normalizeBookingStatus(apt.status);
            const statusMeta = getBookingStatusMeta(status);
            const isHighlighted =
              highlightedBookingId === apt.id || highlightedBookingId === apt.bookingRef;
            const allowCancel = canCancelBooking(apt);
            const allowRebook = canRebook(apt) && Boolean(onBookAgain);
            const showReview = status === 'completed';
            const confirmingCancel = cancelConfirmId === apt.id;

            return (
              <article
                key={apt.id}
                id={`booking-card-${apt.id}`}
                role="listitem"
                data-booking-status={status}
                className={`bg-white border rounded-2xl p-4 shadow-xs relative overflow-hidden flex flex-col gap-3 transition-shadow ${
                  isHighlighted
                    ? 'border-primary ring-2 ring-primary/30'
                    : 'border-outline-variant/50 hover:shadow-md'
                }`}
              >
                {/* Top: image + name + status */}
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => openDetail(apt)}
                    className="shrink-0 cursor-pointer"
                    aria-label={`View ${apt.salonName} booking`}
                  >
                    <img
                      src={apt.salonImage}
                      alt={apt.salonName}
                      loading="lazy"
                      className="w-[72px] h-[72px] rounded-xl object-cover ring-1 ring-outline-variant/40"
                    />
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-nexora-pink">
                          {apt.bookingRef}
                        </p>
                        <h3
                          onClick={() => openDetail(apt)}
                          className="font-card-title text-[16px] font-bold text-on-surface mt-0.5 truncate cursor-pointer hover:text-nexora-pink transition-colors"
                        >
                          {apt.salonName}
                        </h3>
                      </div>
                      <span
                        className={`shrink-0 text-[11px] font-bold px-2 py-1 rounded-full border inline-flex items-center gap-0.5 ${bookingStatusChipClasses(
                          status
                        )}`}
                      >
                        <span className="material-symbols-outlined text-[12px]">
                          {statusMeta.icon}
                        </span>
                        {statusMeta.label}
                      </span>
                    </div>

                    {/* Service */}
                    <p className="mt-1.5 text-[13px] text-on-surface flex items-start gap-1.5">
                      <span className="material-symbols-outlined text-[15px] text-on-surface-variant shrink-0 mt-0.5">
                        content_cut
                      </span>
                      <span className="font-semibold leading-snug">{serviceLabel(apt)}</span>
                    </p>

                    {/* Staff */}
                    <p className="mt-1 text-[12px] text-on-surface-variant flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px]">badge</span>
                      <span>
                        Staff:{' '}
                        <span className="font-semibold text-on-surface">
                          {apt.stylist?.name || 'Any available'}
                        </span>
                      </span>
                    </p>
                  </div>
                </div>

                {/* Date · Time · Price row */}
                <div className="grid grid-cols-3 gap-2 bg-surface-container-low rounded-xl p-2.5 border border-outline-variant/30">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                      Date
                    </p>
                    <p className="text-[12px] font-semibold text-on-surface truncate mt-0.5">
                      {formatBookingDate(apt.date)}
                    </p>
                  </div>
                  <div className="min-w-0 border-l border-outline-variant/40 pl-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                      Time
                    </p>
                    <p className="text-[12px] font-semibold text-on-surface truncate mt-0.5">
                      {apt.time}
                    </p>
                  </div>
                  <div className="min-w-0 border-l border-outline-variant/40 pl-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                      Price
                    </p>
                    <p className="text-[13px] font-extrabold text-primary truncate mt-0.5">
                      {priceLabel(apt)}
                    </p>
                  </div>
                </div>

                {/* Review after completion */}
                {showReview && (
                  <div
                    id={`booking-review-${apt.id}`}
                    className="rounded-xl border border-outline-variant/40 bg-surface-container-low/80 p-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {reviewSubmittedId === apt.id ? (
                      <div className="flex items-center gap-1.5 text-success-emerald text-[12px] font-semibold">
                        <span className="material-symbols-outlined text-[16px]">check_circle</span>
                        Thanks! Your review was submitted.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[12px] font-bold text-on-surface">
                            Review this visit
                          </span>
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => setRatingInput(star)}
                                className="text-warning-amber hover:scale-110 transition-transform cursor-pointer"
                                aria-label={`Rate ${star} stars`}
                              >
                                <span
                                  className={`material-symbols-outlined text-[20px] ${
                                    star <= ratingInput ? 'fill-1' : ''
                                  }`}
                                >
                                  star
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                        <textarea
                          value={reviewNote}
                          onChange={(e) => setReviewNote(e.target.value)}
                          placeholder="How was your experience? (optional)"
                          rows={2}
                          className="w-full px-3 py-2 text-[12px] rounded-lg border border-outline-variant/50 bg-white text-on-surface focus:outline-none focus:border-primary/40 resize-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleSubmitReview(apt.id)}
                          className="self-end px-3.5 py-1.5 rounded-lg bg-primary text-white text-[12px] font-bold hover:bg-nexora-pink transition-colors cursor-pointer"
                        >
                          Submit review
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Cancel confirm strip */}
                {confirmingCancel && (
                  <div
                    className="rounded-xl border border-error/30 bg-error-container/40 p-3 flex flex-col sm:flex-row sm:items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="text-[12px] text-on-surface flex-1">
                      Cancel this booking at <strong>{apt.salonName}</strong>? This can’t be undone.
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setCancelConfirmId(null)}
                        className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-on-surface border border-outline-variant/50 cursor-pointer"
                      >
                        Keep
                      </button>
                      <button
                        type="button"
                        id={`booking-confirm-cancel-${apt.id}`}
                        onClick={() => handleCancel(apt.id)}
                        className="px-3 py-1.5 rounded-lg text-[12px] font-bold text-white bg-error hover:bg-error-crimson cursor-pointer"
                      >
                        Yes, cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div
                  className="flex flex-wrap items-center gap-2 pt-1 border-t border-outline-variant/30"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    id={`booking-view-details-${apt.id}`}
                    onClick={() => openDetail(apt)}
                    className="px-3 py-2 rounded-xl bg-primary text-white text-[12px] font-bold hover:bg-nexora-pink transition-colors shadow-xs cursor-pointer inline-flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[15px]">receipt_long</span>
                    View details
                  </button>

                  {allowCancel && !confirmingCancel && (
                    <button
                      type="button"
                      id={`booking-cancel-${apt.id}`}
                      onClick={() => setCancelConfirmId(apt.id)}
                      className="px-3 py-2 rounded-xl border border-error/30 text-error text-[12px] font-bold hover:bg-error-container/40 transition-colors cursor-pointer inline-flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[15px]">cancel</span>
                      Cancel booking
                    </button>
                  )}

                  {allowRebook && (
                    <button
                      type="button"
                      id={`booking-rebook-${apt.id}`}
                      onClick={() => onBookAgain?.(apt)}
                      className="px-3 py-2 rounded-xl bg-primary/10 text-primary text-[12px] font-bold hover:bg-primary/15 transition-colors cursor-pointer inline-flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[15px]">replay</span>
                      Rebook
                    </button>
                  )}

                  {status === 'confirmed' && isAppointmentUpcoming(apt) && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleGenerateCalendarEvent(apt)}
                        className="px-3 py-2 rounded-xl bg-surface-container text-on-surface text-[12px] font-semibold hover:bg-surface-container-high transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[15px]">event</span>
                        Calendar
                      </button>
                      <button
                        type="button"
                        onClick={() => onRescheduleAppointment(apt.id)}
                        className="px-3 py-2 rounded-xl bg-secondary-container text-on-secondary-container text-[12px] font-semibold hover:opacity-90 transition-opacity cursor-pointer"
                      >
                        Reschedule
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AppointmentsTab;
