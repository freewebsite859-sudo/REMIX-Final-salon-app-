import React, { useEffect, useState } from 'react';
import { Salon, SalonService, Stylist, Appointment } from '../types';

interface BookingModalProps {
  salon: Salon | null;
  initialService?: SalonService | null;
  initialServices?: SalonService[] | null;
  initialStylist?: Stylist | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmBooking: (appointment: Appointment) => void;
  onViewAppointments?: () => void;
  onOpenSummary?: (draft: {
    salon: Salon;
    services: SalonService[];
    stylist: Stylist | null;
    date: string;
    time: string;
    notes?: string;
  }) => void;
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
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [confirmedBooking, setConfirmedBooking] = useState<Appointment | null>(null);

  useEffect(() => {
    if (!isOpen || !salon) return;

    if (initialServices && initialServices.length > 0) {
      setSelectedServices(initialServices);
    } else if (initialService) {
      setSelectedServices([initialService]);
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

  const toggleService = (srv: SalonService) => {
    if (selectedServices.find((s) => s.id === srv.id)) {
      if (selectedServices.length > 1) {
        setSelectedServices(selectedServices.filter((s) => s.id !== srv.id));
      }
    } else {
      setSelectedServices([...selectedServices, srv]);
    }
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

  const subtotal = selectedServices.reduce((acc, s) => acc + (s.discountPrice || s.price), 0);
  const discountAmount = Math.round((subtotal * appliedDiscountPercent) / 100);
  const finalTotal = Math.max(0, subtotal - discountAmount);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedServices.length === 0) return;
    const newAppointment: Appointment = {
      id: `apt-${Date.now()}`,
      salonId: salon.id,
      salonName: salon.name,
      salonAddress: salon.location.address,
      salonImage: salon.image,
      salonPhone: salon.phone,
      services: selectedServices,
      stylist: selectedStylist || undefined,
      date: selectedDate,
      time: selectedTime,
      status: 'confirmed',
      totalPrice: finalTotal,
      discountApplied: discountAmount,
      bookingRef: `NX-${Math.floor(10000 + Math.random() * 90000)}`,
      notes: specialNotes,
      createdAt: new Date().toISOString(),
      mapsUrl: salon.location.mapsUrl,
    };

    setConfirmedBooking(newAppointment);
    setIsSuccess(true);
    onConfirmBooking(newAppointment);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div 
        id="booking-flow-container"
        className="w-full max-w-lg bg-surface rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl border border-outline-variant/30 max-h-[92vh] overflow-y-auto"
      >
        {isSuccess && confirmedBooking ? (
          /* Confirmation Success Screen */
          <div className="text-center py-4 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-success-emerald/10 text-success-emerald rounded-full flex items-center justify-center mx-auto mb-3 ring-8 ring-success-emerald/5">
              <span className="material-symbols-outlined text-[36px]">check_circle</span>
            </div>
            <h2 className="font-hero-heading text-[22px] font-bold text-on-surface mb-1">
              Appointment Confirmed!
            </h2>
            <p className="text-body-md text-on-surface-variant mb-4">
              Your appointment at <strong className="text-on-surface">{confirmedBooking.salonName}</strong> has been scheduled.
            </p>

            {/* Ticket Card */}
            <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-4 text-left mb-5 shadow-sm relative overflow-hidden">
              <div className="flex justify-between items-start border-b border-outline-variant/50 pb-3 mb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-nexora-pink bg-surface-container px-2 py-0.5 rounded">
                    Confirmed Pass
                  </span>
                  <h4 className="font-card-title text-[16px] text-on-surface mt-1">{confirmedBooking.salonName}</h4>
                  <p className="text-[12px] text-on-surface-variant">{confirmedBooking.salonAddress}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-on-surface-variant uppercase">Booking Ref</span>
                  <p className="font-mono font-bold text-nexora-pink text-[14px]">{confirmedBooking.bookingRef}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[13px] mb-3">
                <div>
                  <span className="text-on-surface-variant text-[11px] block">Date & Time</span>
                  <span className="font-semibold text-on-surface">
                    {confirmedBooking.date === todayStr ? 'Today' : confirmedBooking.date} · {confirmedBooking.time}
                  </span>
                </div>
                <div>
                  <span className="text-on-surface-variant text-[11px] block">Stylist</span>
                  <span className="font-semibold text-on-surface">
                    {confirmedBooking.stylist ? confirmedBooking.stylist.name : 'Any Available'}
                  </span>
                </div>
              </div>

              <div className="border-t border-outline-variant/50 pt-2 flex justify-between items-center text-[13px]">
                <span className="text-on-surface-variant">Services ({confirmedBooking.services.length})</span>
                <span className="font-bold text-primary text-[15px]">₹{confirmedBooking.totalPrice}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              {confirmedBooking.mapsUrl && (
                <a
                  href={confirmedBooking.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2.5 px-4 bg-surface-container border border-outline-variant rounded-xl text-nexora-pink font-button-text flex items-center justify-center gap-2 hover:bg-surface-container-high transition-colors"
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
                className="w-full py-3 bg-primary text-white font-button-text rounded-xl hover:bg-nexora-pink transition-colors shadow-md"
              >
                Done & View Appointments
              </button>
            </div>
          </div>
        ) : (
          /* Booking Form */
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/30 mb-4">
              <div>
                <span className="text-[11px] font-bold text-nexora-pink uppercase tracking-wider">Book Service</span>
                <h2 className="font-card-title text-[18px] text-on-surface">{salon.name}</h2>
              </div>
              <button 
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {/* Step 1: Services Selection */}
              <div>
                <label className="font-section-heading text-[14px] text-on-surface mb-2 block flex items-center justify-between">
                  <span>1. Select Services</span>
                  <span className="text-[12px] font-normal text-on-surface-variant">({selectedServices.length} selected)</span>
                </label>
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                  {salon.services.map((srv) => {
                    const isSelected = selectedServices.some((s) => s.id === srv.id);
                    return (
                      <div
                        key={srv.id}
                        onClick={() => toggleService(srv)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-surface-container-low border-nexora-pink ring-1 ring-nexora-pink'
                            : 'bg-surface-container-lowest border-outline-variant/50 hover:bg-surface-container'
                        }`}
                      >
                        <div className="flex-1 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-[13px] text-on-surface">{srv.name}</span>
                            {srv.popular && (
                              <span className="bg-warning-amber/15 text-warning-amber text-[9px] font-bold px-1.5 py-0.2 rounded uppercase">
                                Popular
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-on-surface-variant line-clamp-1">{srv.description}</p>
                          <span className="text-[10px] text-on-surface-variant">⏱ {srv.duration} mins</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-[14px] text-primary">₹{srv.discountPrice || srv.price}</span>
                          {srv.discountPrice && (
                            <span className="text-[11px] line-through text-on-surface-variant block">₹{srv.price}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
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
                          <span className="text-[12px] font-semibold truncate max-w-[110px]">{stylist.name}</span>
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
                    <span>Subtotal</span>
                    <span>₹{subtotal}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-success-emerald font-medium">
                      <span>Promo Discount ({appliedDiscountPercent}%)</span>
                      <span>-₹{discountAmount}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-on-surface text-[14px] pt-1 border-t border-outline-variant/30">
                    <span>Total Amount</span>
                    <span className="text-primary text-[16px]">₹{finalTotal}</span>
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

              {/* Submit & Summary Buttons */}
              <div className="flex flex-col gap-2.5">
                {onOpenSummary && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenSummary({
                        salon,
                        services: selectedServices,
                        stylist: selectedStylist,
                        date: selectedDate,
                        time: selectedTime,
                        notes: specialNotes,
                      });
                    }}
                    className="w-full py-3 bg-surface-container border border-outline-variant/70 hover:border-nexora-pink text-nexora-pink font-bold rounded-xl hover:bg-surface-container-high transition-all flex items-center justify-center gap-2 text-[13px] shadow-2xs"
                  >
                    <span className="material-symbols-outlined text-[18px]">assignment_turned_in</span>
                    <span>Review Full Appointment Summary</span>
                  </button>
                )}

                <button
                  type="submit"
                  className="w-full py-3.5 bg-primary text-on-primary font-button-text rounded-xl hover:bg-nexora-pink transition-all shadow-md flex items-center justify-center gap-2 font-bold"
                >
                  <span className="material-symbols-outlined text-[20px]">calendar_month</span>
                  <span>Confirm Booking (Pay at Salon / UPI)</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
