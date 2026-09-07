/**
 * Post-booking confirmation page.
 *
 * Shown after a successful payment/booking so the customer clearly knows
 * the booking was submitted and confirmed. Also reusable as a read-only
 * booking detail ticket from My Appointments / history (with Rebook CTA).
 */
import React, { useMemo, useState } from 'react';
import type { Appointment } from '../types';
import {
  BOOKING_STATUSES,
  bookingDirectionsUrl,
  bookingStatusChipClasses,
  buildGoogleCalendarUrl,
  buildIcsDataUrl,
  canRebook,
  formatBookingDate,
  getBookingStatusMeta,
  normalizeBookingStatus,
  resolveWhatsAppStatus,
  type BookingStatus,
} from '../lib/bookingStatus';

export interface BookingConfirmationPageProps {
  appointment: Appointment;
  /**
   * When true, copy leans on “Your booking is confirmed.” even if status is
   * still pending (e.g. right after the client submitted and the server
   * returned a locked slot).
   */
  justBooked?: boolean;
  /** History / cancelled / completed context — shows Rebook. */
  fromHistory?: boolean;
  onClose?: () => void;
  onViewAppointments?: () => void;
  onRebook?: (appointment: Appointment) => void;
  onOpenSalon?: (salonId: string) => void;
  /** Optional compact mode when embedded inside a modal. */
  embedded?: boolean;
  className?: string;
}

function DetailRow({
  icon,
  label,
  value,
  mono,
}: {
  icon: string;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-outline-variant/30 last:border-0">
      <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
          {label}
        </p>
        <p
          className={`mt-0.5 text-[14px] font-semibold text-on-surface break-words ${
            mono ? 'font-mono text-nexora-pink' : ''
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

export const BookingConfirmationPage: React.FC<BookingConfirmationPageProps> = ({
  appointment,
  justBooked = false,
  fromHistory = false,
  onClose,
  onViewAppointments,
  onRebook,
  onOpenSalon,
  embedded = false,
  className = '',
}) => {
  const [calendarMenuOpen, setCalendarMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const status = normalizeBookingStatus(appointment.status);
  const meta = getBookingStatusMeta(status);
  const whatsapp = resolveWhatsAppStatus(appointment);
  const directionsUrl = bookingDirectionsUrl(appointment);
  const showRebook = fromHistory || appointment.rebookFromHistory || canRebook(appointment);

  const headline = useMemo(() => {
    if (justBooked || status === 'confirmed') return 'Your booking is confirmed.';
    if (status === 'pending') return 'Your booking has been submitted.';
    if (status === 'completed') return 'Visit completed.';
    if (status === 'cancelled') return 'This booking was cancelled.';
    if (status === 'no_show') return 'Marked as no-show.';
    return meta.description;
  }, [justBooked, status, meta.description]);

  const subline = useMemo(() => {
    if (justBooked || status === 'confirmed') {
      return 'You’re all set — the salon has your slot locked. Save the details below and we’ll see you there.';
    }
    if (status === 'pending') {
      return 'We’ve received your request. You’ll get a confirmation as soon as the salon locks the slot.';
    }
    return meta.description;
  }, [justBooked, status, meta.description]);

  const serviceLabel =
    appointment.services.length === 0
      ? '—'
      : appointment.services.length === 1
        ? appointment.services[0].name
        : appointment.services.map((s) => s.name).join(', ');

  const staffLabel = appointment.stylist?.name || 'Any available professional';
  const totalLabel = `₹${appointment.totalPrice.toLocaleString('en-IN')}`;
  const advance =
    appointment.advancePaid !== undefined
      ? appointment.advancePaid
      : Math.round(appointment.totalPrice * 0.25);
  const remaining =
    appointment.remainingAmount !== undefined
      ? appointment.remainingAmount
      : Math.max(0, appointment.totalPrice - advance);

  const handleCopyRef = async () => {
    try {
      await navigator.clipboard?.writeText(appointment.bookingRef || appointment.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const handleAddToGoogleCal = () => {
    window.open(buildGoogleCalendarUrl(appointment), '_blank', 'noopener,noreferrer');
    setCalendarMenuOpen(false);
  };

  const handleDownloadIcs = () => {
    const url = buildIcsDataUrl(appointment);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexora-${appointment.bookingRef || appointment.id}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setCalendarMenuOpen(false);
  };

  const heroTone =
    status === 'confirmed' || justBooked
      ? 'from-emerald-600 via-emerald-700 to-primary'
      : status === 'pending'
        ? 'from-amber-500 via-amber-600 to-primary'
        : status === 'cancelled' || status === 'no_show'
          ? 'from-rose-600 via-rose-700 to-neutral-charcoal'
          : 'from-secondary via-neutral-charcoal to-primary';

  return (
    <div
      id="booking-confirmation-page"
      data-booking-status={status}
      data-just-booked={justBooked ? 'true' : 'false'}
      className={`flex flex-col w-full ${embedded ? '' : 'pb-28 max-w-xl mx-auto'} ${className}`}
    >
      {/* Hero banner */}
      <section
        className={`relative overflow-hidden ${
          embedded ? 'rounded-2xl mx-0' : 'rounded-none sm:rounded-3xl sm:mx-page-margin sm:mt-3'
        } bg-gradient-to-br ${heroTone} text-white px-5 pt-6 pb-7 shadow-lg`}
      >
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="absolute -left-8 bottom-0 w-28 h-28 rounded-full bg-white/5 blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center text-center">
          {!embedded && onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close confirmation"
              className="absolute right-0 top-0 w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}

          <div className="w-16 h-16 rounded-full bg-white/20 ring-8 ring-white/10 flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-[36px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              {justBooked || status === 'confirmed' ? 'check_circle' : meta.icon}
            </span>
          </div>

          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/80 mb-1.5">
            {justBooked ? 'Booking submitted & confirmed' : meta.label}
          </p>
          <h1
            id="booking-confirmation-headline"
            className="font-hero-heading text-[22px] sm:text-[26px] font-extrabold leading-tight tracking-tight max-w-sm"
          >
            {headline}
          </h1>
          <p className="mt-2 text-[13px] text-white/85 leading-relaxed max-w-sm">{subline}</p>

          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 border border-white/20 backdrop-blur-sm">
            <span className="text-[11px] font-semibold text-white/80 uppercase tracking-wider">
              Booking ID
            </span>
            <span className="font-mono font-bold text-[14px] tracking-wide">
              {appointment.bookingRef || appointment.id}
            </span>
            <button
              type="button"
              onClick={handleCopyRef}
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

      {/* Status chip row */}
      <div className={`${embedded ? 'px-0 mt-4' : 'px-page-margin mt-4'} flex flex-wrap items-center gap-2`}>
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${bookingStatusChipClasses(
            status
          )}`}
        >
          <span className="material-symbols-outlined text-[14px]">{meta.icon}</span>
          {meta.label}
        </span>
        {appointment.salonConfirmationStatus === 'confirmed_by_owner' && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
            <span className="material-symbols-outlined text-[14px]">verified</span>
            Owner confirmed
          </span>
        )}
        {appointment.paymentStatus === 'paid' && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-primary/10 text-primary border border-primary/15">
            <span className="material-symbols-outlined text-[14px]">payments</span>
            Advance paid
          </span>
        )}
      </div>

      {/* Ticket card */}
      <section
        id="booking-confirmation-ticket"
        className={`${embedded ? 'mt-3' : 'mx-page-margin mt-3'} bg-white border border-outline-variant/50 rounded-2xl shadow-xs overflow-hidden`}
      >
        <div className="px-4 pt-4 pb-2">
          <button
            type="button"
            onClick={() => onOpenSalon?.(appointment.salonId)}
            className="w-full flex items-center gap-3 text-left cursor-pointer group"
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
            {onOpenSalon && (
              <span className="material-symbols-outlined text-on-surface-variant text-[18px]">
                chevron_right
              </span>
            )}
          </button>
        </div>

        <div className="px-4 pb-2">
          <DetailRow icon="tag" label="Booking ID" value={appointment.bookingRef || appointment.id} mono />
          <DetailRow icon="content_cut" label="Service" value={serviceLabel} />
          <DetailRow icon="badge" label="Staff" value={staffLabel} />
          <DetailRow icon="event" label="Date" value={formatBookingDate(appointment.date)} />
          <DetailRow icon="schedule" label="Time" value={appointment.time} />
          <DetailRow
            icon="location_on"
            label="Address"
            value={appointment.salonAddress || 'Address shared by salon'}
          />
          <DetailRow
            icon="payments"
            label="Total price"
            value={
              <span className="flex flex-col gap-0.5">
                <span className="text-[16px] font-extrabold">{totalLabel}</span>
                {(advance > 0 || remaining > 0) && (
                  <span className="text-[11px] font-medium text-on-surface-variant">
                    Advance ₹{advance.toLocaleString('en-IN')}
                    {remaining > 0 ? ` · Due at salon ₹${remaining.toLocaleString('en-IN')}` : ''}
                  </span>
                )}
              </span>
            }
          />
        </div>

        {/* WhatsApp confirmation status */}
        <div
          id="booking-whatsapp-status"
          className={`mx-4 mb-4 p-3 rounded-xl border flex items-start gap-3 ${
            whatsapp.status === 'sent'
              ? 'bg-emerald-500/10 border-emerald-500/25'
              : whatsapp.status === 'failed'
                ? 'bg-error-container/60 border-error/25'
                : 'bg-surface-container-low border-outline-variant/50'
          }`}
        >
          <span
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              whatsapp.status === 'sent'
                ? 'bg-emerald-600 text-white'
                : whatsapp.status === 'failed'
                  ? 'bg-error text-white'
                  : 'bg-primary/10 text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{whatsapp.icon}</span>
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-on-surface">{whatsapp.label}</p>
            <p className="text-[11px] text-on-surface-variant mt-0.5 leading-snug">
              {whatsapp.detail}
            </p>
          </div>
        </div>
      </section>

      {/* Primary actions */}
      <section
        className={`${embedded ? 'mt-3 space-y-2.5' : 'px-page-margin mt-4 space-y-2.5'}`}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Add to calendar */}
          <div className="relative">
            <button
              type="button"
              id="booking-add-to-calendar-btn"
              onClick={() => setCalendarMenuOpen((v) => !v)}
              aria-expanded={calendarMenuOpen}
              className="w-full py-3 px-4 rounded-xl bg-white border border-outline-variant/60 text-on-surface font-bold text-[13px] flex items-center justify-center gap-2 hover:border-primary/40 hover:shadow-xs transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px] text-primary">event</span>
              Add to calendar
            </button>
            {calendarMenuOpen && (
              <div
                role="menu"
                className="absolute left-0 right-0 top-full mt-1.5 z-20 bg-white border border-outline-variant/50 rounded-xl shadow-lg overflow-hidden"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleAddToGoogleCal}
                  className="w-full px-4 py-3 text-left text-[13px] font-semibold text-on-surface hover:bg-surface-container-low flex items-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px] text-primary">
                    calendar_add_on
                  </span>
                  Google Calendar
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleDownloadIcs}
                  className="w-full px-4 py-3 text-left text-[13px] font-semibold text-on-surface hover:bg-surface-container-low flex items-center gap-2 cursor-pointer border-t border-outline-variant/40"
                >
                  <span className="material-symbols-outlined text-[18px] text-primary">download</span>
                  Download .ics
                </button>
              </div>
            )}
          </div>

          {/* Directions */}
          {directionsUrl ? (
            <a
              id="booking-directions-btn"
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
              id="booking-directions-btn"
              disabled
              className="w-full py-3 px-4 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface-variant font-bold text-[13px] flex items-center justify-center gap-2 opacity-60 cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[18px]">directions_off</span>
              Directions unavailable
            </button>
          )}
        </div>

        {/* Rebook CTA (history) */}
        {showRebook && onRebook && (
          <button
            type="button"
            id="booking-rebook-btn"
            onClick={() => onRebook(appointment)}
            className="w-full py-3.5 px-4 rounded-xl bg-primary text-white font-bold text-[14px] flex items-center justify-center gap-2 hover:bg-nexora-pink transition-colors shadow-md cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">replay</span>
            Rebook this visit
          </button>
        )}

        {/* Done / view appointments */}
        {(onViewAppointments || onClose) && (
          <button
            type="button"
            id="booking-confirmation-done-btn"
            onClick={() => {
              if (onViewAppointments) onViewAppointments();
              else onClose?.();
            }}
            className={`w-full py-3.5 px-4 rounded-xl font-bold text-[14px] flex items-center justify-center gap-2 transition-colors cursor-pointer ${
              showRebook && onRebook
                ? 'bg-white border border-outline-variant/60 text-on-surface hover:border-primary/40'
                : 'bg-primary text-white hover:bg-nexora-pink shadow-md'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {onViewAppointments ? 'calendar_month' : 'check'}
            </span>
            {onViewAppointments ? 'Done & view appointments' : 'Done'}
          </button>
        )}
      </section>

      {/* Status legend (education) — only on just-booked / embedded confirm */}
      {(justBooked || embedded) && (
        <section
          id="booking-status-legend"
          className={`${embedded ? 'mt-5' : 'px-page-margin mt-6'} mb-2`}
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
            Booking status guide
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {BOOKING_STATUSES.map((id: BookingStatus) => {
              const m = getBookingStatusMeta(id);
              const active = id === status;
              return (
                <li
                  key={id}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border text-[12px] ${
                    active
                      ? 'bg-primary/5 border-primary/30 font-semibold'
                      : 'bg-surface-container-low/60 border-outline-variant/30'
                  }`}
                >
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[12px] border ${bookingStatusChipClasses(
                      id
                    )}`}
                  >
                    <span className="material-symbols-outlined text-[14px]">{m.icon}</span>
                  </span>
                  <span className="text-on-surface">
                    <span className="font-bold">{m.label}</span>
                    <span className="text-on-surface-variant font-normal"> — {m.description}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
};

export default BookingConfirmationPage;
