import React, { useEffect, useRef, useState } from 'react';
import { Salon, SalonService, Stylist, Appointment } from '../types';
import { BookingConfirmationPage } from './BookingConfirmationPage';
import { buildBookingMetadataServices } from '../lib/bookingContract';
import { computeBookingTotals, couponDiscountAmount } from '../lib/bookingCore';

/** Indian-rupee formatting with thousands separators (e.g. ₹3,150). */
function formatINR(amount: number): string {
  return `₹${(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

interface BookingModalProps {
  salon?: Salon | null;
  initialService?: SalonService | null;
  initialServices?: SalonService[] | null;
  initialStylist?: Stylist | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmBooking?: (appointment: Appointment) => void;
  onViewAppointments?: () => void;
  onOpenSummary?: (draft: {
    salon: Salon;
    services: SalonService[];
    stylist: Stylist | null;
    date: string;
    time: string;
    notes?: string;
  }) => void;
  fromHistory?: boolean;
  profile?: any;
  services?: SalonService[];
  stylists?: Stylist[];
  onShowToast?: (toastData: any) => void;
  onAddAppointment?: (appointment: any) => void;
  themeAccentHex?: string;
  user?: any;
  onRequireAuth?: () => void;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  salon,
  initialService,
  initialServices,
  initialStylist,
  isOpen,
  onClose,
  onConfirmBooking,
  onViewAppointments,
  onOpenSummary,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const [selectedServices, setSelectedServices] = useState<SalonService[]>([]);
  const [selectedStylist, setSelectedStylist] = useState<Stylist | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedTime, setSelectedTime] = useState<string>('5:30 PM');
  const [specialNotes, setSpecialNotes] = useState<string>('');
  const [couponCode, setCouponCode] = useState<string>('');
  const [appliedDiscountPercent, setAppliedDiscountPercent] = useState<number>(0);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [confirmedBooking, setConfirmedBooking] = useState<Appointment | null>(null);

  // Reset the flow each time the modal is (re)opened for a salon. The chosen
  // services intentionally seed from the full incoming selection (multi-service
  // re-entries after "Change date/time" from the summary keep every service),
  // then fall back to the single service the user tapped "Book" on, or the
  // salon's first service. Once open, nothing resets between Steps 1–4.
  //
  // Guard rails so a *fix* can never look like a regression:
  //  - Seeds are content-addressed (salon id + incoming service ids + stylist
  //    id), NOT object-identity addressed. A parent re-render that passes a
  //    brand-new array/object instance holding the SAME services no longer
  //    wipes the user's in-progress multi-service selection, stylist pick,
  //    date/time or notes (the old effect reset on every new array identity).
  //  - The reset only fires on a closed→open transition, a salon change, or a
  //    genuinely different incoming seed.
  //  - Incoming selections are deduped and validated against the salon catalog
  //    so duplicate line items (same service id twice) can never double-count
  //    totals or render a checked card twice.
  const prevOpenRef = useRef(false);
  const seededContentRef = useRef('');

  useEffect(() => {
    const openedNow = isOpen && !prevOpenRef.current;
    prevOpenRef.current = isOpen;
    if (!isOpen || !salon) return;

    const incoming = initialServices?.length
      ? initialServices.filter((srv) => salon.services.some((s) => s.id === srv.id))
      : initialService
        ? [initialService]
        : [];
    // Dedupe by service id so duplicate line items can never double-count.
    const deduped = Array.from(new Map(incoming.map((srv) => [srv.id, srv])).values());
    const contentKey = [
      salon.id,
      salon.services.map((s) => s.id).join(','),
      deduped.map((s) => s.id).join(','),
      initialStylist?.id ?? '',
    ].join('|');

    if (!openedNow && seededContentRef.current === contentKey) {
      // Same salon, same incoming seed, modal still open: this is a plain
      // parent re-render — never clobber what the user is doing.
      return;
    }
    seededContentRef.current = contentKey;

    if (deduped.length > 0) {
      setSelectedServices(deduped);
    } else if (initialServices?.length) {
      // A non-empty incoming selection that does not belong to this salon's
      // catalog resolves to the explicit zero-selection state — never to a
      // silently reseeded default.
      setSelectedServices([]);
    } else {
      setSelectedServices(salon.services.length > 0 ? [salon.services[0]] : []);
    }

    setSelectedStylist(initialStylist || (salon.stylists.length > 0 ? salon.stylists[0] : null));
    setSelectedDate(todayStr);
    setSelectedTime('5:30 PM');
    setSpecialNotes('');
    setCouponCode('');
    setAppliedDiscountPercent(0);
    setCouponMessage(null);
    setBookingError(null);
    setIsSuccess(false);
    setConfirmedBooking(null);
  }, [isOpen, salon, initialService, initialServices, initialStylist, todayStr]);

  if (!isOpen || !salon) return null;

  const timeSlots = [
    '10:00 AM',
    '11:00 AM',
    '12:30 PM',
    '2:00 PM',
    '3:30 PM',
    '4:45 PM',
    '5:30 PM',
    '6:30 PM',
    '7:15 PM',
    '8:00 PM',
  ];

  /**
   * Checkbox-style toggle: a service can be added or removed independently.
   * The last remaining service may be removed too — the sticky footer then
   * shows a clear "select at least one service" state instead of silently
   * locking the selection.
   */
  const toggleService = (srv: SalonService) => {
    setSelectedServices((prev) =>
      prev.some((s) => s.id === srv.id) ? prev.filter((s) => s.id !== srv.id) : [...prev, srv]
    );
  };

  const handleApplyCoupon = () => {
    const code = couponCode.trim().toUpperCase();
    if (code === 'NEXORA20' || code === 'FIRST20' || code === 'STYLE20') {
      setAppliedDiscountPercent(20);
      setCouponMessage('🎉 Promo code applied: 20% Discount!');
    } else if (code === 'SPA50') {
      setAppliedDiscountPercent(30);
      setCouponMessage('✨ VIP Discount: 30% Off Applied!');
    } else {
      setCouponMessage('❌ Invalid coupon code. Try NEXORA20');
      setAppliedDiscountPercent(0);
    }
  };

  // --- Dynamic totals across every selected service -------------------------
  // Computed from the canonical booking line items (same helpers the summary
  // modal and the server use) so the cart, the deposit and the server-side
  // recomputation can never disagree.
  const lineItems = buildBookingMetadataServices(selectedServices);
  const baseTotals = computeBookingTotals(lineItems, 0);
  const totals = computeBookingTotals(
    lineItems,
    couponDiscountAmount(baseTotals.subtotal, appliedDiscountPercent)
  );
  const subtotal = totals.subtotal;
  const totalDuration = totals.durationMinutes;
  const discountAmount = totals.discountAmount;
  const finalTotal = totals.total;
  const advanceAmount = totals.advanceAmount;
  const hasSelection = selectedServices.length > 0;

  const buildDraft = () => ({
    salon,
    services: selectedServices,
    stylist: selectedStylist,
    date: selectedDate,
    time: selectedTime,
    notes: specialNotes,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedServices.length === 0) return;

    if (onOpenSummary) {
      // Every booking must go through the server-side payment contract. The
      // old direct-confirm path created a local appointment without a hold or
      // verified deposit, so it is intentionally removed.
      onOpenSummary(buildDraft());
      return;
    }

    setBookingError(
      'Booking is unavailable because the secure booking and payment service is not configured. No appointment was created.'
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div
        id="booking-flow-container"
        className="w-full max-w-lg bg-surface rounded-t-3xl sm:rounded-2xl shadow-2xl border border-outline-variant/30 max-h-[92vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-3 sm:slide-in-from-bottom-none duration-200"
      >
        {isSuccess && confirmedBooking ? (
          <div className="overflow-y-auto flex-1">
            <BookingConfirmationPage
              appointment={confirmedBooking}
              justBooked
              embedded
              onClose={onClose}
              onViewAppointments={onViewAppointments}
            />
          </div>
        ) : (
          /* Booking Form */
          <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
            {/* Modal Header (fixed) */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 sm:px-6 border-b border-outline-variant/30 bg-surface shrink-0">
              <div>
                <span className="text-[11px] font-bold text-nexora-pink uppercase tracking-wider">
                  Book Service
                </span>
                <h2 className="font-card-title text-[18px] text-on-surface">{salon.name}</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close booking"
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Scrollable Steps 1–4 */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 flex flex-col gap-5 min-h-0">
              {/* Step 1: Multi-Service Selection */}
              <div>
                <label className="font-section-heading text-[14px] text-on-surface mb-1 block flex items-center justify-between">
                  <span>1. Select Services</span>
                  <span
                    className={`text-[12px] font-normal px-2 py-0.5 rounded-full ${
                      hasSelection
                        ? 'bg-nexora-pink/10 text-nexora-pink font-bold'
                        : 'bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    {selectedServices.length}{' '}
                    {selectedServices.length === 1 ? 'service' : 'services'} selected
                  </span>
                </label>
                <p className="text-[11px] text-on-surface-variant mb-2">
                  Tap any treatment to add it — combine multiple services in one appointment.
                </p>

                {salon.services.length === 0 ? (
                  <p className="text-[12px] text-on-surface-variant bg-surface-container-low rounded-xl p-3 border border-dashed border-outline-variant/50">
                    No services are currently listed for this salon.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                    {salon.services.map((srv) => {
                      const isSelected = selectedServices.some((s) => s.id === srv.id);
                      return (
                        <div
                          key={srv.id}
                          role="checkbox"
                          aria-checked={isSelected}
                          tabIndex={0}
                          data-service-id={srv.id}
                          onClick={() => toggleService(srv)}
                          onKeyDown={(e) => {
                            if (e.key === ' ' || e.key === 'Enter') {
                              e.preventDefault();
                              toggleService(srv);
                            }
                          }}
                          className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start justify-between gap-3 outline-none select-none ${
                            isSelected
                              ? 'bg-nexora-pink/[0.06] border-nexora-pink ring-1 ring-nexora-pink shadow-xs'
                              : 'bg-surface-container-lowest border-outline-variant/50 hover:bg-surface-container hover:border-nexora-pink/60'
                          }`}
                        >
                          {/* Checkbox visual */}
                          <div
                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                              isSelected
                                ? 'bg-nexora-pink border-nexora-pink text-white'
                                : 'border-on-surface-variant/50 bg-surface text-transparent'
                            }`}
                          >
                            <span
                              className="material-symbols-outlined text-[13px]"
                              style={{ fontVariationSettings: "'FILL' 1" }}
                            >
                              check
                            </span>
                          </div>

                          {/* Service details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium text-[13px] text-on-surface">
                                {srv.name}
                              </span>
                              {srv.popular && (
                                <span className="bg-warning-amber/15 text-warning-amber text-[9px] font-bold px-1.5 py-0.2 rounded uppercase">
                                  Popular
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-on-surface-variant line-clamp-1">
                              {srv.description}
                            </p>
                            <span className="text-[10px] text-on-surface-variant inline-flex items-center gap-1">
                              <span className="material-symbols-outlined text-[12px]">schedule</span>
                              {srv.duration} mins · {srv.category}
                            </span>
                          </div>

                          {/* Price + explicit add/remove toggle */}
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <span className="font-bold text-[14px] text-primary leading-none">
                              {formatINR(srv.discountPrice || srv.price)}
                            </span>
                            {srv.discountPrice && (
                              <span className="text-[10px] line-through text-on-surface-variant leading-none">
                                {formatINR(srv.price)}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleService(srv);
                              }}
                              aria-label={
                                isSelected ? `Remove ${srv.name} from booking` : `Add ${srv.name} to booking`
                              }
                              className={`mt-1 px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors active:scale-95 ${
                                isSelected
                                  ? 'bg-error/10 text-error hover:bg-error/20'
                                  : 'bg-nexora-pink/10 text-nexora-pink hover:bg-nexora-pink hover:text-white'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[13px]">
                                {isSelected ? 'close' : 'add'}
                              </span>
                              {isSelected ? 'Remove' : 'Add to Booking'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Step 2: Choose Stylist */}
              {salon.stylists.length > 0 && (
                <div>
                  <label className="font-section-heading text-[14px] text-on-surface mb-2 block">
                    2. Select Specialist / Stylist
                  </label>
                  <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
                    <button
                      type="button"
                      onClick={() => setSelectedStylist(null)}
                      className={`min-w-[120px] p-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center ${
                        selectedStylist === null
                          ? 'bg-primary-container text-white border-primary shadow-sm'
                          : 'bg-surface-container-lowest border-outline-variant/50 hover:bg-surface-container'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-primary mb-1">
                        <span className="material-symbols-outlined text-[20px]">group</span>
                      </div>
                      <span className="text-[12px] font-semibold">Any Expert</span>
                      <span className="text-[10px] opacity-80">Earliest slot</span>
                    </button>

                    {salon.stylists.map((stylist) => {
                      const isSelected = selectedStylist?.id === stylist.id;
                      return (
                        <button
                          key={stylist.id}
                          type="button"
                          onClick={() => setSelectedStylist(stylist)}
                          className={`min-w-[130px] p-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center ${
                            isSelected
                              ? 'bg-primary text-white border-primary shadow-sm'
                              : 'bg-surface-container-lowest border-outline-variant/50 hover:bg-surface-container text-on-surface'
                          }`}
                        >
                          <img
                            src={stylist.avatar}
                            alt={stylist.name}
                            className="w-10 h-10 rounded-full object-cover mb-1 ring-1 ring-white"
                          />
                          <span className="text-[12px] font-semibold truncate max-w-[110px]">
                            {stylist.name}
                          </span>
                          <span className="text-[10px] opacity-85 flex items-center gap-0.5 justify-center">
                            ★ {stylist.rating} · {stylist.experience}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 3: Date & Time */}
              <div>
                <label className="font-section-heading text-[14px] text-on-surface mb-2 block">
                  3. Select Date & Slot
                </label>
                <div className="flex gap-2 mb-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedDate(todayStr)}
                    className={`flex-1 py-2 rounded-xl text-[12px] font-semibold border ${
                      selectedDate === todayStr
                        ? 'bg-primary text-white border-primary'
                        : 'bg-surface-container-lowest text-on-surface border-outline-variant/50'
                    }`}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDate(tomorrowStr)}
                    className={`flex-1 py-2 rounded-xl text-[12px] font-semibold border ${
                      selectedDate === tomorrowStr
                        ? 'bg-primary text-white border-primary'
                        : 'bg-surface-container-lowest text-on-surface border-outline-variant/50'
                    }`}
                  >
                    Tomorrow
                  </button>
                  <input
                    type="date"
                    min={todayStr}
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="px-2 py-1.5 bg-surface-container-highest rounded-xl text-[12px] text-on-surface border-0 focus:ring-1 focus:ring-nexora-pink"
                  />
                </div>

                {/* Time slots */}
                <div className="grid grid-cols-5 gap-1.5">
                  {timeSlots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedTime(slot)}
                      className={`py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
                        selectedTime === slot
                          ? 'bg-nexora-pink text-white border-nexora-pink font-semibold shadow-xs'
                          : 'bg-surface-container-lowest text-on-surface border-outline-variant/40 hover:bg-surface-container'
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 4: Promo Code & Price Summary */}
              <div className="bg-surface-container-low p-3.5 rounded-xl border border-outline-variant/50">
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="Coupon (e.g. NEXORA20)"
                    className="flex-1 px-3 py-1.5 text-[12px] bg-white rounded-lg border border-outline-variant uppercase font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    className="px-3 py-1.5 bg-secondary text-white text-[12px] font-semibold rounded-lg hover:bg-primary transition-colors"
                  >
                    Apply
                  </button>
                </div>
                {couponMessage && (
                  <p className="text-[11px] font-medium text-nexora-pink mb-2">{couponMessage}</p>
                )}

                <div className="flex flex-col gap-1 text-[12px] text-on-surface-variant pt-2 border-t border-outline-variant/40">
                  <div className="flex justify-between">
                    <span>
                      Subtotal ({selectedServices.length}{' '}
                      {selectedServices.length === 1 ? 'service' : 'services'})
                    </span>
                    <span>{formatINR(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Duration</span>
                    <span>{totalDuration} mins</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-success-emerald font-medium">
                      <span>Promo Discount ({appliedDiscountPercent}%)</span>
                      <span>-{formatINR(discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-on-surface text-[14px] pt-1 border-t border-outline-variant/30">
                    <span>Total Amount</span>
                    <span className="text-primary text-[16px]">{formatINR(finalTotal)}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span>Advance payable now (25%)</span>
                    <span className="font-semibold text-on-surface">{formatINR(advanceAmount)}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span>Balance at salon</span>
                    <span className="font-semibold text-on-surface">
                      {formatINR(Math.max(0, finalTotal - advanceAmount))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <textarea
                  value={specialNotes}
                  onChange={(e) => setSpecialNotes(e.target.value)}
                  placeholder="Add any styling notes or special requests..."
                  rows={2}
                  className="w-full p-2.5 text-[12px] bg-surface-container-highest text-on-surface rounded-xl border-0 focus:ring-1 focus:ring-nexora-pink"
                />
              </div>

              {bookingError && (
                <div
                  role="alert"
                  className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-900"
                >
                  {bookingError}
                </div>
              )}
            </div>

            {/* Floating summary bar + actions (always visible at the bottom) */}
            <div className="px-5 sm:px-6 pt-3 pb-4 border-t border-outline-variant/30 bg-surface/95 backdrop-blur-md shrink-0 space-y-2.5">
              {hasSelection ? (
                <div
                  id="booking-selection-summary-bar"
                  className="flex items-center justify-between gap-2 flex-wrap text-[12px]"
                >
                  <div className="flex items-center gap-2">
                    <span className="bg-nexora-pink/10 text-nexora-pink text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        check_circle
                      </span>
                      {selectedServices.length}{' '}
                      {selectedServices.length === 1 ? 'Service' : 'Services'} Selected
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 font-semibold text-on-surface-variant">
                    {discountAmount > 0 && (
                      <span className="text-success-emerald font-bold">-{formatINR(discountAmount)}</span>
                    )}
                    <span>
                      Total: <span className="font-extrabold text-primary text-[14px]">{formatINR(finalTotal)}</span>
                    </span>
                    <span className="opacity-60">•</span>
                    <span className="flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-[13px]">schedule</span>
                      {totalDuration} mins
                    </span>
                  </div>
                </div>
              ) : (
                <p
                  id="booking-no-services-hint"
                  className="text-[12px] font-semibold text-warning-amber bg-warning-amber/10 border border-warning-amber/30 rounded-lg px-3 py-1.5 flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[15px]">info</span>
                  Select at least one service to continue booking.
                </p>
              )}

              <div className="flex flex-col gap-2.5">
                {onOpenSummary && (
                  <button
                    type="button"
                    onClick={() => {
                      if (hasSelection) onOpenSummary(buildDraft());
                    }}
                    disabled={!hasSelection}
                    className="w-full py-2.5 bg-surface-container border border-outline-variant/70 hover:border-nexora-pink text-nexora-pink font-bold rounded-xl hover:bg-surface-container-high transition-all flex items-center justify-center gap-2 text-[13px] shadow-2xs disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:bg-surface-container disabled:hover:border-outline-variant/70"
                  >
                    <span className="material-symbols-outlined text-[18px]">assignment_turned_in</span>
                    <span>Review Full Appointment Summary</span>
                  </button>
                )}

                <button
                  type="submit"
                  disabled={!hasSelection}
                  className="w-full py-3.5 bg-primary text-on-primary font-button-text rounded-xl hover:bg-nexora-pink transition-all shadow-md flex items-center justify-center gap-2 font-bold disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:bg-primary"
                >
                  <span className="material-symbols-outlined text-[20px]">calendar_month</span>
                  <span>Confirm Booking (Pay at Salon / UPI)</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
