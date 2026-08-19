import React, { useState, useMemo, useEffect } from 'react';
import { Salon, SalonService, Stylist, Appointment } from '../types';

export interface BookingSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  salon: Salon | null;
  services: SalonService[];
  stylist: Stylist | null;
  date: string;
  time: string;
  specialNotes?: string;
  onConfirmBooking: (appointment: Appointment) => void;
  onChangeSalon?: () => void;
  onChangeServices?: () => void;
  onChangeProfessional?: () => void;
  onChangeDateTime?: () => void;
  onUpdateServices?: (services: SalonService[]) => void;
  onUpdateNotes?: (notes: string) => void;
  onViewAppointments?: () => void;
}

// Helpers
function formatReadableDate(dateStr: string): string {
  if (!dateStr) return 'Today';
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  if (dateStr === todayStr) {
    return `Today, ${today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }
  if (dateStr === tomorrowStr) {
    return `Tomorrow, ${tomorrow.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }

  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  return dateStr;
}

function calculateEndTime(startTime: string, durationMinutes: number): string {
  if (!startTime) return '';
  const match = startTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return '';
  let hours = parseInt(match[1], 10);
  const mins = parseInt(match[2], 10);
  const meridiem = match[3].toUpperCase();

  if (meridiem === 'PM' && hours !== 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;

  const totalStartMinutes = hours * 60 + mins;
  const totalEndMinutes = totalStartMinutes + durationMinutes;

  let endHours = Math.floor(totalEndMinutes / 60) % 24;
  const endMins = totalEndMinutes % 60;
  const endMeridiem = endHours >= 12 ? 'PM' : 'AM';

  if (endHours > 12) endHours -= 12;
  if (endHours === 0) endHours = 12;

  const paddedMins = endMins < 10 ? `0${endMins}` : `${endMins}`;
  return `${endHours}:${paddedMins} ${endMeridiem}`;
}

export const BookingSummaryModal: React.FC<BookingSummaryModalProps> = ({
  isOpen,
  onClose,
  salon,
  services,
  stylist,
  date,
  time,
  specialNotes = '',
  onConfirmBooking,
  onChangeSalon,
  onChangeServices,
  onChangeProfessional,
  onChangeDateTime,
  onUpdateServices,
  onUpdateNotes,
  onViewAppointments,
}) => {
  const [notes, setNotes] = useState<string>(specialNotes);
  const [couponCode, setCouponCode] = useState<string>('');
  const [appliedDiscountPercent, setAppliedDiscountPercent] = useState<number>(0);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [confirmedBooking, setConfirmedBooking] = useState<Appointment | null>(null);
  const [isEditingNotes, setIsEditingNotes] = useState<boolean>(false);
  const [buttonState, setButtonState] = useState<'idle' | 'loading' | 'success'>('idle');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [copiedUpi, setCopiedUpi] = useState<boolean>(false);
  const isSubmitting = buttonState !== 'idle';

  useEffect(() => {
    if (!isOpen) return;
    setNotes(specialNotes);
    setCouponCode('');
    setAppliedDiscountPercent(0);
    setCouponMessage(null);
    setIsSuccess(false);
    setConfirmedBooking(null);
    setIsEditingNotes(false);
    setButtonState('idle');
    setPaymentError(null);
    setCopiedUpi(false);
  }, [isOpen, salon?.id, date, time, specialNotes]);

  // Total duration & price calculations
  const totalDuration = useMemo(() => {
    return services.reduce((sum, s) => sum + (s.duration || 30), 0);
  }, [services]);

  const subtotal = useMemo(() => {
    return services.reduce((sum, s) => sum + (s.discountPrice || s.price || 0), 0);
  }, [services]);

  const discountAmount = useMemo(() => {
    return Math.round((subtotal * appliedDiscountPercent) / 100);
  }, [subtotal, appliedDiscountPercent]);

  const finalTotal = useMemo(() => {
    return Math.max(0, subtotal - discountAmount);
  }, [subtotal, discountAmount]);

  // Advance Payment (25%) & Remaining at Salon (75%)
  const advanceAmount = useMemo(() => {
    return Math.round(finalTotal * 0.25);
  }, [finalTotal]);

  const remainingAmount = useMemo(() => {
    return Math.max(0, finalTotal - advanceAmount);
  }, [finalTotal, advanceAmount]);

  const handleCopyUpi = () => {
    navigator.clipboard.writeText('nexorasalon@upi');
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const formattedDate = useMemo(() => formatReadableDate(date), [date]);
  const estimatedEndTime = useMemo(() => calculateEndTime(time, totalDuration), [time, totalDuration]);

  // Handle promo code
  const handleApplyCoupon = () => {
    const code = couponCode.trim().toUpperCase();
    if (code === 'NEXORA20' || code === 'FIRST20' || code === 'STYLE20') {
      setAppliedDiscountPercent(20);
      setCouponMessage('🎉 Promo code applied: 20% Discount!');
      setPaymentError(null);
    } else if (code === 'SPA50') {
      setAppliedDiscountPercent(30);
      setCouponMessage('✨ VIP Discount: 30% Off Applied!');
      setPaymentError(null);
    } else if (code === 'FAIL') {
      setCouponMessage('⚠️ "FAIL" code active — Will simulate payment failure on confirmation.');
      setAppliedDiscountPercent(0);
    } else {
      setCouponMessage('❌ Invalid coupon code. Try NEXORA20 or SPA50');
      setAppliedDiscountPercent(0);
    }
  };

  const handleRemoveService = (srvId: string) => {
    if (services.length <= 1) {
      alert('At least one service must remain in your appointment.');
      return;
    }
    const updated = services.filter((s) => s.id !== srvId);
    if (onUpdateServices) {
      onUpdateServices(updated);
    }
  };

  const handleConfirm = async () => {
    if (buttonState !== 'idle' || !salon) return;
    setPaymentError(null);
    setButtonState('loading');

    try {
      // Simulate async payment gateway verification call
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Trigger payment verification error if code 'FAIL' is entered
      if (couponCode.trim().toUpperCase() === 'FAIL') {
        throw new Error(
          `Payment Verification Failed: Your 25% advance deposit of ₹${advanceAmount} could not be authorized by Nexora SalonOS Merchant Gateway. Transaction timed out or was declined by issuing bank.`
        );
      }

      // Visual checkmark feedback state on the button
      setButtonState('success');
      await new Promise((resolve) => setTimeout(resolve, 600));

      const bookingRef = `NX-${Math.floor(10000 + Math.random() * 90000)}`;
      const newAppointment: Appointment = {
        id: `apt-${Date.now()}`,
        salonId: salon.id,
        salonName: salon.name,
        salonAddress: salon.location.address,
        salonImage: salon.image,
        salonPhone: salon.phone,
        services: services,
        stylist: stylist || undefined,
        date: date || new Date().toISOString().split('T')[0],
        time: time || '2:30 PM',
        status: 'confirmed',
        totalPrice: finalTotal,
        discountApplied: discountAmount,
        bookingRef,
        notes: notes,
        createdAt: new Date().toISOString(),
        mapsUrl: salon.location.mapsUrl,
      };

      setConfirmedBooking(newAppointment);
      setIsSuccess(true);
      onConfirmBooking(newAppointment);
    } catch (err: any) {
      console.error('Payment verification error:', err);
      setPaymentError(
        err.message ||
          'Payment verification failed. Your 25% advance deposit could not be processed. No appointment was created.'
      );
      setButtonState('idle');
    }
  };

  const handleNotesBlur = () => {
    setIsEditingNotes(false);
    if (onUpdateNotes) {
      onUpdateNotes(notes);
    }
  };

  if (!isOpen || !salon) return null;

  return (
    <div
      id="booking-summary-modal-backdrop"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
    >
      <div
        id="booking-summary-modal-container"
        className="w-full max-w-xl bg-surface rounded-t-3xl sm:rounded-2xl shadow-2xl border border-outline-variant/30 max-h-[94vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-3 duration-200"
      >
        {isSuccess && confirmedBooking ? (
          /* Confirmation Success Screen */
          <div className="p-6 text-center overflow-y-auto">
            <div className="w-16 h-16 bg-success-emerald/10 text-success-emerald rounded-full flex items-center justify-center mx-auto mb-3 ring-8 ring-success-emerald/5">
              <span className="material-symbols-outlined text-[36px]">check_circle</span>
            </div>
            <h2 className="font-hero-heading text-[22px] font-bold text-on-surface mb-1">
              Appointment Confirmed!
            </h2>
            <p className="text-body-md text-on-surface-variant mb-5">
              Your appointment at <strong className="text-on-surface">{confirmedBooking.salonName}</strong> has been successfully booked.
            </p>

            {/* Confirmed Ticket Card */}
            <div className="bg-surface-container-low border border-outline-variant/60 rounded-2xl p-5 text-left mb-6 shadow-sm relative overflow-hidden">
              <div className="flex justify-between items-start border-b border-outline-variant/50 pb-3.5 mb-3.5">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-nexora-pink bg-primary/10 px-2.5 py-0.5 rounded-full">
                    Confirmed Pass
                  </span>
                  <h4 className="font-card-title text-[17px] text-on-surface font-bold mt-1.5">
                    {confirmedBooking.salonName}
                  </h4>
                  <p className="text-[12px] text-on-surface-variant mt-0.5">
                    {confirmedBooking.salonAddress}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-on-surface-variant uppercase font-semibold block">
                    Booking ID
                  </span>
                  <p className="font-mono font-bold text-nexora-pink text-[15px]">
                    {confirmedBooking.bookingRef}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-[13px] mb-4">
                <div className="bg-surface p-2.5 rounded-xl border border-outline-variant/40">
                  <span className="text-on-surface-variant text-[11px] font-medium block">
                    Scheduled Date & Time
                  </span>
                  <span className="font-bold text-on-surface text-[13px] mt-0.5 block">
                    {formattedDate} · {confirmedBooking.time}
                  </span>
                </div>
                <div className="bg-surface p-2.5 rounded-xl border border-outline-variant/40">
                  <span className="text-on-surface-variant text-[11px] font-medium block">
                    Assigned Professional
                  </span>
                  <span className="font-bold text-on-surface text-[13px] mt-0.5 block">
                    {confirmedBooking.stylist ? confirmedBooking.stylist.name : 'Any Available Team'}
                  </span>
                </div>
              </div>

              {/* Services List in Confirmation */}
              <div className="border-t border-outline-variant/40 pt-3">
                <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block mb-2">
                  Reserved Services ({confirmedBooking.services.length})
                </span>
                <div className="space-y-1.5 mb-3">
                  {confirmedBooking.services.map((s) => (
                    <div key={s.id} className="flex justify-between items-center text-[12px]">
                      <span className="text-on-surface font-medium">{s.name} ({s.duration}m)</span>
                      <span className="font-semibold text-on-surface">₹{s.discountPrice || s.price}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-1.5 pt-2 border-t border-outline-variant/40 text-[13px]">
                  <div className="flex justify-between items-center">
                    <span className="text-on-surface-variant">Total Service Amount</span>
                    <span className="font-bold text-on-surface">₹{confirmedBooking.totalPrice}</span>
                  </div>
                  <div className="flex justify-between items-center text-emerald-700 bg-emerald-500/10 p-2 rounded-xl">
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">verified</span>
                      <span className="font-bold">25% Advance Deposit Paid</span>
                    </div>
                    <span className="font-extrabold">₹{Math.round(confirmedBooking.totalPrice * 0.25)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 text-on-surface">
                    <span className="font-semibold text-on-surface-variant">Remaining Balance Due at Salon (75%)</span>
                    <span className="font-extrabold text-nexora-pink text-[15px]">
                      ₹{confirmedBooking.totalPrice - Math.round(confirmedBooking.totalPrice * 0.25)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2.5">
              {confirmedBooking.mapsUrl && (
                <a
                  href={confirmedBooking.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3 px-4 bg-surface-container border border-outline-variant/60 rounded-xl text-nexora-pink font-semibold flex items-center justify-center gap-2 hover:bg-surface-container-high transition-colors text-[14px]"
                >
                  <span className="material-symbols-outlined text-[18px]">directions</span>
                  <span>View Route on Google Maps</span>
                </a>
              )}
              <button
                onClick={() => {
                  if (onViewAppointments) {
                    onViewAppointments();
                  } else {
                    onClose();
                  }
                }}
                className="w-full py-3.5 bg-primary text-white font-bold rounded-xl hover:bg-nexora-pink transition-colors shadow-md text-[14px]"
              >
                Done & View Appointments
              </button>
            </div>
          </div>
        ) : (
          /* Main Summary Review Body */
          <>
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-outline-variant/30 flex items-center justify-between bg-surface sticky top-0 z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-nexora-pink flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-[20px]">assignment_turned_in</span>
                </div>
                <div>
                  <h2 className="font-card-title text-[18px] font-bold text-on-surface leading-tight">
                    Booking Summary
                  </h2>
                  <p className="text-[11px] text-on-surface-variant">
                    Review appointment details before confirmation
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
                aria-label="Close summary"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Scrollable Context Fields List */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Payment Failure Error Handling UI */}
              {paymentError && (
                <div
                  id="payment-error-alert"
                  className="bg-red-500/10 border-2 border-red-500/40 rounded-2xl p-4 text-left space-y-3 animate-in fade-in slide-in-from-top-2 duration-200"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                      <span className="material-symbols-outlined text-[22px]">gpp_bad</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-[14px] font-extrabold text-on-surface">
                          Payment Verification Failed
                        </h4>
                        <span className="text-[10px] bg-red-500/20 text-red-700 dark:text-red-300 font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                          Not Confirmed
                        </span>
                      </div>
                      <p className="text-[12px] text-on-surface-variant mt-1.5 leading-relaxed">
                        {paymentError}
                      </p>
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-red-600 dark:text-red-400 mt-2 bg-red-500/10 p-2 rounded-lg">
                        <span className="material-symbols-outlined text-[15px]">lock_clock</span>
                        <span>No slot reserved. Verified 25% deposit (₹{advanceAmount}) required.</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-red-500/20">
                    <button
                      type="button"
                      onClick={handleConfirm}
                      id="retry-payment-btn"
                      className="w-full sm:w-auto flex-1 px-4 py-2.5 bg-red-600 text-white text-[12px] font-bold rounded-xl hover:bg-red-700 transition-colors flex items-center justify-center gap-1.5 shadow-md active:scale-95"
                    >
                      <span className="material-symbols-outlined text-[16px]">refresh</span>
                      <span>Retry Payment</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPaymentError(null);
                        if (onChangeDateTime) {
                          onChangeDateTime();
                        }
                      }}
                      id="choose-another-time-btn"
                      className="w-full sm:w-auto flex-1 px-4 py-2.5 bg-surface border border-outline-variant text-on-surface text-[12px] font-bold rounded-xl hover:bg-surface-container-high transition-colors flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      <span className="material-symbols-outlined text-[16px]">edit_calendar</span>
                      <span>Choose Another Time</span>
                    </button>
                  </div>
                </div>
              )}
              {/* Field 1: Salon Information */}
              <div
                id="summary-field-salon"
                className="bg-surface-container-low rounded-2xl p-4 border border-outline-variant/50 relative group transition-all hover:border-outline-variant"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                      Salon & Venue
                    </span>
                    <span className="material-symbols-outlined text-[14px] text-nexora-pink">storefront</span>
                  </div>
                  {onChangeSalon && (
                    <button
                      type="button"
                      onClick={onChangeSalon}
                      id="change-salon-btn"
                      className="px-2.5 py-1 rounded-lg bg-surface border border-outline-variant/60 hover:border-nexora-pink text-nexora-pink text-[11px] font-bold flex items-center gap-1 transition-colors shadow-2xs active:scale-95"
                    >
                      <span className="material-symbols-outlined text-[13px]">swap_horiz</span>
                      <span>Change</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3.5">
                  <img
                    src={salon.image}
                    alt={salon.name}
                    className="w-14 h-14 rounded-xl object-cover ring-1 ring-outline-variant/40 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-[15px] text-on-surface truncate leading-snug">
                      {salon.name}
                    </h3>
                    <p className="text-[12px] text-on-surface-variant truncate mt-0.5">
                      {salon.location.address}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[11px]">
                      <span className="flex items-center gap-0.5 text-warning-amber font-bold">
                        <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                          star
                        </span>
                        {salon.rating}
                      </span>
                      <span className="text-on-surface-variant">({salon.reviewCount} reviews)</span>
                      <span className="text-on-surface-variant font-medium">· {salon.distance} away</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Field 2: Selected Services */}
              <div
                id="summary-field-services"
                className="bg-surface-container-low rounded-2xl p-4 border border-outline-variant/50 relative group transition-all hover:border-outline-variant"
              >
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                      Selected Services ({services.length})
                    </span>
                    <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.2 rounded-full">
                      {totalDuration} mins total
                    </span>
                  </div>
                  {onChangeServices && (
                    <button
                      type="button"
                      onClick={onChangeServices}
                      id="change-services-btn"
                      className="px-2.5 py-1 rounded-lg bg-surface border border-outline-variant/60 hover:border-nexora-pink text-nexora-pink text-[11px] font-bold flex items-center gap-1 transition-colors shadow-2xs active:scale-95"
                    >
                      <span className="material-symbols-outlined text-[13px]">edit</span>
                      <span>Change</span>
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {services.map((srv) => (
                    <div
                      key={srv.id}
                      className="bg-surface rounded-xl p-3 border border-outline-variant/40 flex items-center justify-between gap-2 shadow-2xs"
                    >
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-nexora-pink mt-1.5 flex-shrink-0"></span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-[13px] text-on-surface truncate">
                              {srv.name}
                            </span>
                            <span className="bg-surface-variant text-on-surface-variant text-[9px] font-semibold px-1.5 py-0.2 rounded capitalize">
                              {srv.category}
                            </span>
                          </div>
                          <span className="text-[11px] text-on-surface-variant flex items-center gap-1 mt-0.5">
                            <span className="material-symbols-outlined text-[12px]">schedule</span>
                            {srv.duration} mins session
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-right">
                          <span className="font-bold text-[13px] text-on-surface">
                            ₹{srv.discountPrice || srv.price}
                          </span>
                          {srv.discountPrice && (
                            <span className="text-[10px] line-through text-on-surface-variant block">
                              ₹{srv.price}
                            </span>
                          )}
                        </div>

                        {services.length > 1 && onUpdateServices && (
                          <button
                            type="button"
                            onClick={() => handleRemoveService(srv.id)}
                            className="w-6 h-6 rounded-full flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors"
                            title="Remove service"
                          >
                            <span className="material-symbols-outlined text-[14px]">delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Field 3: Assigned Professional */}
              <div
                id="summary-field-professional"
                className="bg-surface-container-low rounded-2xl p-4 border border-outline-variant/50 relative group transition-all hover:border-outline-variant"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                      Assigned Professional
                    </span>
                    <span className="material-symbols-outlined text-[14px] text-nexora-pink">badge</span>
                  </div>
                  {onChangeProfessional && (
                    <button
                      type="button"
                      onClick={onChangeProfessional}
                      id="change-professional-btn"
                      className="px-2.5 py-1 rounded-lg bg-surface border border-outline-variant/60 hover:border-nexora-pink text-nexora-pink text-[11px] font-bold flex items-center gap-1 transition-colors shadow-2xs active:scale-95"
                    >
                      <span className="material-symbols-outlined text-[13px]">person_search</span>
                      <span>Change</span>
                    </button>
                  )}
                </div>

                {stylist ? (
                  <div className="flex items-center gap-3.5">
                    <img
                      src={stylist.avatar}
                      alt={stylist.name}
                      className="w-13 h-13 rounded-full object-cover ring-2 ring-primary/20 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-bold text-[14px] text-on-surface">{stylist.name}</h4>
                        <span className="inline-flex items-center gap-0.5 bg-primary/10 text-nexora-pink text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                          <span className="material-symbols-outlined text-[11px]">verified</span>
                          Assigned
                        </span>
                      </div>
                      <p className="text-[12px] text-on-surface-variant truncate mt-0.5">
                        {stylist.role} · {stylist.specialty?.join(', ')}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[11px]">
                        <span className="flex items-center gap-0.5 text-warning-amber font-bold">
                          <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                            star
                          </span>
                          {stylist.rating}
                        </span>
                        <span className="text-on-surface-variant font-medium">· {stylist.experience}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-[24px]">group</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-bold text-[14px] text-on-surface">Any Available Professional</h4>
                        <span className="bg-emerald-500/10 text-emerald-700 text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                          Flexible Team
                        </span>
                      </div>
                      <p className="text-[12px] text-on-surface-variant mt-0.5">
                        Allocated to the top specialist ready at your selected time slot.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Field 4: Date & Time Slot */}
              <div
                id="summary-field-datetime"
                className="bg-surface-container-low rounded-2xl p-4 border border-outline-variant/50 relative group transition-all hover:border-outline-variant"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                      Date & Appointment Window
                    </span>
                    <span className="material-symbols-outlined text-[14px] text-nexora-pink">calendar_month</span>
                  </div>
                  {onChangeDateTime && (
                    <button
                      type="button"
                      onClick={onChangeDateTime}
                      id="change-datetime-btn"
                      className="px-2.5 py-1 rounded-lg bg-surface border border-outline-variant/60 hover:border-nexora-pink text-nexora-pink text-[11px] font-bold flex items-center gap-1 transition-colors shadow-2xs active:scale-95"
                    >
                      <span className="material-symbols-outlined text-[13px]">schedule</span>
                      <span>Change</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-1">
                  <div className="bg-surface p-3 rounded-xl border border-outline-variant/40 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-nexora-pink flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-[18px]">event</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-on-surface-variant uppercase font-semibold block">
                        Reserved Date
                      </span>
                      <span className="font-bold text-[13px] text-on-surface">{formattedDate}</span>
                    </div>
                  </div>

                  <div className="bg-surface p-3 rounded-xl border border-outline-variant/40 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-nexora-pink flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-[18px]">schedule</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-on-surface-variant uppercase font-semibold block">
                        Time Slot & Window
                      </span>
                      <span className="font-bold text-[13px] text-on-surface">
                        {time} {estimatedEndTime ? `→ ${estimatedEndTime}` : ''}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Field 5: Special Notes / Requests */}
              <div className="bg-surface-container-low rounded-2xl p-4 border border-outline-variant/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">edit_note</span>
                    Special Instructions (Optional)
                  </span>
                  {!isEditingNotes && (
                    <button
                      type="button"
                      onClick={() => setIsEditingNotes(true)}
                      className="text-[11px] font-bold text-nexora-pink hover:underline"
                    >
                      {notes ? 'Edit Note' : '+ Add Note'}
                    </button>
                  )}
                </div>

                {isEditingNotes ? (
                  <div className="flex flex-col gap-2">
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. Quiet appointment, sensitive skin, specific styling preference..."
                      rows={2}
                      className="w-full p-2.5 text-[12px] bg-surface text-on-surface rounded-xl border border-outline-variant focus:ring-1 focus:ring-nexora-pink"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={handleNotesBlur}
                        className="px-3 py-1 bg-nexora-pink text-white text-[11px] font-bold rounded-lg shadow-2xs"
                      >
                        Save Note
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[12px] text-on-surface-variant italic">
                    {notes ? `"${notes}"` : 'No special requests added.'}
                  </p>
                )}
              </div>

              {/* Price Breakdown, 25% Advance & Nexora SalonOS QR Code */}
              <div className="bg-surface-container-low rounded-2xl p-4 border border-outline-variant/50 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                    Payment Breakdown & Slot Lock
                  </span>
                  <span className="text-[11px] text-nexora-pink bg-nexora-pink/10 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">lock</span>
                    <span>25% Deposit Required</span>
                  </span>
                </div>

                {/* Promo code input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="Coupon (e.g. NEXORA20, SPA50, FAIL)"
                    className="flex-1 px-3 py-1.5 text-[12px] bg-surface text-on-surface rounded-lg border border-outline-variant uppercase font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    className="px-3.5 py-1.5 bg-secondary text-white text-[12px] font-semibold rounded-lg hover:bg-primary transition-colors shadow-2xs"
                  >
                    Apply
                  </button>
                </div>
                {couponMessage && (
                  <p className="text-[11px] font-medium text-nexora-pink">{couponMessage}</p>
                )}
                <p className="text-[10px] text-on-surface-variant/70 italic">
                  💡 Promo tips: Enter <code className="font-mono bg-surface px-1 py-0.5 rounded text-primary">NEXORA20</code> for 20% off, or <code className="font-mono bg-surface px-1 py-0.5 rounded text-red-500">FAIL</code> to test payment failure handling.
                </p>

                {/* Service Amount & Advance Calculation Table */}
                <div className="flex flex-col gap-1.5 text-[12px] text-on-surface-variant pt-2 border-t border-outline-variant/40">
                  <div className="flex justify-between">
                    <span>Services Subtotal</span>
                    <span className="font-semibold text-on-surface">₹{subtotal}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-success-emerald font-semibold">
                      <span>Coupon Discount ({appliedDiscountPercent}%)</span>
                      <span>-₹{discountAmount}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[11px]">
                    <span>Convenience & Booking Fee</span>
                    <span className="text-emerald-700 font-bold">FREE (₹0)</span>
                  </div>

                  <div className="flex justify-between font-extrabold text-on-surface text-[14px] pt-2 border-t border-outline-variant/40">
                    <span>Total Service Amount</span>
                    <span className="text-on-surface text-[16px]">₹{finalTotal}</span>
                  </div>

                  {/* 25% Advance & 75% Balance Highlight Cards */}
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="bg-primary/10 border border-primary/20 p-2.5 rounded-xl text-left">
                      <span className="text-[10px] uppercase font-extrabold text-primary block tracking-wider">
                        25% Advance Deposit
                      </span>
                      <span className="text-[17px] font-black text-nexora-pink block mt-0.5">
                        ₹{advanceAmount}
                      </span>
                      <span className="text-[10px] text-on-surface-variant block mt-0.5">
                        Payable now to lock slot
                      </span>
                    </div>

                    <div className="bg-surface p-2.5 rounded-xl border border-outline-variant/50 text-left">
                      <span className="text-[10px] uppercase font-bold text-on-surface-variant block tracking-wider">
                        75% Balance at Salon
                      </span>
                      <span className="text-[17px] font-bold text-on-surface block mt-0.5">
                        ₹{remainingAmount}
                      </span>
                      <span className="text-[10px] text-on-surface-variant block mt-0.5">
                        Pay after appointment
                      </span>
                    </div>
                  </div>
                </div>

                {/* Nexora SalonOS QR Code & UPI Gate */}
                <div className="bg-surface rounded-xl p-3.5 border border-outline-variant/60 flex flex-col items-center text-center">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="material-symbols-outlined text-nexora-pink text-[18px]">qr_code_scanner</span>
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-primary">
                      Nexora SalonOS Merchant UPI Pay
                    </span>
                  </div>

                  {/* QR Code Image Placeholder Container */}
                  <div className="p-2 bg-neutral-900 rounded-2xl shadow-md border border-neutral-800 my-1 flex flex-col items-center">
                    <img
                      src="/src/assets/images/nexora_qr_code_1787067887544.jpg"
                      alt="Nexora SalonOS Payment QR Code"
                      referrerPolicy="no-referrer"
                      className="w-36 h-36 object-cover rounded-xl border border-neutral-700 shadow-xs"
                      onError={(e) => {
                        // Fallback to SVG if image asset fails to load
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>

                  <span className="text-[12px] font-bold text-on-surface mt-1.5 block">
                    Scan to Pay ₹{advanceAmount} Deposit
                  </span>
                  <span className="text-[10px] text-on-surface-variant block">
                    GPay · PhonePe · Paytm · BHIM · Any UPI App
                  </span>

                  {/* Copy UPI shortcut */}
                  <div className="flex items-center gap-2 mt-2 bg-surface-container px-3 py-1.5 rounded-lg border border-outline-variant/50">
                    <span className="text-[11px] font-mono font-medium text-on-surface">nexorasalon@upi</span>
                    <button
                      type="button"
                      onClick={handleCopyUpi}
                      className="text-[11px] font-bold text-nexora-pink hover:underline flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[13px]">content_copy</span>
                      <span>{copiedUpi ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="p-4 border-t border-outline-variant/30 bg-surface flex flex-col sm:flex-row items-center justify-between gap-3 sticky bottom-0 z-10">
              <div className="flex flex-col text-left w-full sm:w-auto">
                <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant font-medium">
                  <span>{services.length} Service{services.length > 1 ? 's' : ''} · {totalDuration} min</span>
                  <span>·</span>
                  <span className="text-emerald-700 font-bold">Total: ₹{finalTotal}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[11px] text-primary font-bold">25% Advance:</span>
                  <span className="text-[19px] font-black text-nexora-pink">₹{advanceAmount}</span>
                  <span className="text-[10px] text-on-surface-variant font-normal">(Bal: ₹{remainingAmount})</span>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="flex-1 sm:flex-initial px-4 py-3 bg-surface-container border border-outline-variant text-on-surface text-[13px] font-bold rounded-xl hover:bg-surface-container-high transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isSubmitting}
                  id="confirm-booking-btn"
                  className={`flex-1 sm:flex-initial px-6 py-3 text-white text-[13px] font-bold rounded-xl transition-all duration-200 shadow-md flex items-center justify-center gap-2 min-w-[210px] ${
                    buttonState === 'success'
                      ? 'bg-emerald-600 scale-[1.03] shadow-lg ring-2 ring-emerald-300 font-extrabold'
                      : buttonState === 'loading'
                      ? 'bg-primary opacity-80 cursor-not-allowed'
                      : 'bg-primary hover:bg-nexora-pink active:scale-98'
                  }`}
                >
                  {buttonState === 'loading' ? (
                    <>
                      <span className="material-symbols-outlined text-[18px] animate-spin">
                        progress_activity
                      </span>
                      <span>Processing Deposit...</span>
                    </>
                  ) : buttonState === 'success' ? (
                    <>
                      <span
                        className="material-symbols-outlined text-[20px] animate-bounce text-white"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        task_alt
                      </span>
                      <span className="tracking-wide font-black">Slot Reserved & Locked!</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">lock</span>
                      <span>Pay ₹{advanceAmount} & Lock Slot</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
