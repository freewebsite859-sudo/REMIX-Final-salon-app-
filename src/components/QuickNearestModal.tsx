import React, { useEffect, useState } from 'react';
import { Salon, SalonService, Appointment } from '../types';

interface QuickNearestModalProps {
  isOpen: boolean;
  onClose: () => void;
  salons: Salon[];
  currentLocation: string;
  onConfirmBooking: (appointment: Appointment) => void;
  onViewAppointments?: () => void;
}

export const QuickNearestModal: React.FC<QuickNearestModalProps> = ({
  isOpen,
  onClose,
  salons,
  currentLocation,
  onConfirmBooking,
  onViewAppointments,
}) => {
  const nearestSalon = salons[0] || null;
  const [selectedServiceType, setSelectedServiceType] = useState<'haircut' | 'beard' | 'facial' | 'blowdry'>('haircut');
  const [selectedSlot, setSelectedSlot] = useState<string>('In 15 mins (Ready)');
  const [isBooked, setIsBooked] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedServiceType('haircut');
    setSelectedSlot('In 15 mins (Ready)');
    setIsBooked(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const quickServices = [
    { id: 'haircut', name: 'Express Haircut & Style', price: 349, duration: '30 mins', icon: 'content_cut' },
    { id: 'beard', name: 'Beard Trim & Hot Towel', price: 249, duration: '20 mins', icon: 'face_6' },
    { id: 'facial', name: 'Express Glow Cleanse', price: 599, duration: '30 mins', icon: 'spa' },
    { id: 'blowdry', name: 'Wash & Blowdry Finish', price: 399, duration: '25 mins', icon: 'air' },
  ];

  const quickSlots = [
    'In 15 mins (Ready)',
    'In 30 mins',
    'In 45 mins',
    'In 1 hour',
  ];

  const chosenService = quickServices.find((s) => s.id === selectedServiceType)!;

  const handleInstantConfirm = () => {
    if (!nearestSalon) return;
    const srv: SalonService = {
      id: `quick-${chosenService.id}`,
      name: chosenService.name,
      category: 'hair',
      duration: parseInt(chosenService.duration),
      price: chosenService.price,
      description: 'Quick Express Chair Reservation',
    };

    const apt: Appointment = {
      id: `apt-quick-${Date.now()}`,
      salonId: nearestSalon.id,
      salonName: nearestSalon.name,
      salonAddress: nearestSalon.location.address,
      salonImage: nearestSalon.image,
      salonPhone: nearestSalon.phone,
      services: [srv],
      stylist: nearestSalon.stylists[0],
      date: new Date().toISOString().split('T')[0],
      time: selectedSlot,
      status: 'confirmed',
      totalPrice: chosenService.price,
      bookingRef: `NX-Q${Math.floor(1000 + Math.random() * 9000)}`,
      notes: 'Express 1-Tap Urgent Booking',
      createdAt: new Date().toISOString(),
      mapsUrl: nearestSalon.location.mapsUrl,
    };

    setIsBooked(true);
    onConfirmBooking(apt);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div 
        id="quick-nearest-modal-container"
        className="w-full max-w-md bg-surface rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl border border-outline-variant/30 max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/30 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-[22px]">⚡</span>
            <div>
              <h2 className="font-card-title text-[17px] font-bold text-on-surface">Book Nearest Chair</h2>
              <p className="text-[11px] text-on-surface-variant">Instant queue-free salon reservation</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {isBooked ? (
          <div className="text-center py-5">
            <div className="w-14 h-14 bg-success-emerald/10 text-success-emerald rounded-full flex items-center justify-center mx-auto mb-2">
              <span className="material-symbols-outlined text-[32px]">bolt</span>
            </div>
            <h3 className="font-hero-heading text-[18px] font-bold text-on-surface mb-1">
              Your Chair is Reserved!
            </h3>
            <p className="text-[13px] text-on-surface-variant mb-4">
              Head over to <strong className="text-on-surface">{nearestSalon?.name}</strong> ({nearestSalon?.distance}). The stylist is ready for your arrival.
            </p>
            <button
              onClick={() => {
                if (onViewAppointments) {
                  onViewAppointments();
                } else {
                  onClose();
                }
              }}
              className="w-full py-3 bg-primary text-white font-button-text rounded-xl"
            >
              Done & View Appointments
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Nearest Salon Highlight */}
            {nearestSalon && (
              <div className="p-3 bg-surface-container-low border border-outline-variant rounded-xl flex items-center gap-3">
                <img
                  src={nearestSalon.image}
                  alt={nearestSalon.name}
                  className="w-12 h-12 rounded-lg object-cover"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-[14px] text-on-surface truncate">{nearestSalon.name}</span>
                    <span className="bg-success-emerald text-white text-[9px] font-bold px-1 rounded uppercase">Open</span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant truncate">
                    {nearestSalon.location.area} · <strong className="text-primary">{nearestSalon.distance} away</strong>
                  </p>
                </div>
              </div>
            )}

            {/* Quick Service options */}
            <div>
              <span className="text-[12px] font-semibold text-on-surface mb-2 block">Choose Express Treatment:</span>
              <div className="grid grid-cols-2 gap-2">
                {quickServices.map((srv) => (
                  <button
                    key={srv.id}
                    onClick={() => setSelectedServiceType(srv.id as any)}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      selectedServiceType === srv.id
                        ? 'bg-primary-container text-white border-primary shadow-xs'
                        : 'bg-surface-container-lowest text-on-surface border-outline-variant/40 hover:bg-surface-container'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="material-symbols-outlined text-[20px]">{srv.icon}</span>
                      <span className="text-[10px] opacity-80">{srv.duration}</span>
                    </div>
                    <span className="text-[12px] font-semibold leading-tight mb-1">{srv.name}</span>
                    <span className="text-[13px] font-bold">₹{srv.price}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Express Slots */}
            <div>
              <span className="text-[12px] font-semibold text-on-surface mb-1.5 block">When are you arriving?</span>
              <div className="grid grid-cols-2 gap-1.5">
                {quickSlots.map((slot) => (
                  <button
                    key={slot}
                    onClick={() => setSelectedSlot(slot)}
                    className={`py-2 px-2.5 rounded-lg text-[11px] font-medium border text-center transition-all ${
                      selectedSlot === slot
                        ? 'bg-nexora-pink text-white border-nexora-pink font-semibold'
                        : 'bg-surface-container-lowest text-on-surface border-outline-variant/40'
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>

            {/* Book Now Button */}
            <button
              onClick={handleInstantConfirm}
              className="w-full py-3.5 bg-nexora-pink text-white font-button-text rounded-xl hover:bg-primary transition-all shadow-md flex items-center justify-center gap-2"
            >
              <span>⚡</span>
              <span>Instant Reserve Chair (₹{chosenService.price})</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
