import React, { useState } from 'react';
import { Appointment } from '../types';

interface AppointmentsTabProps {
  appointments: Appointment[];
  onCancelAppointment: (id: string) => void;
  onRescheduleAppointment: (id: string) => void;
  onBookAgain?: (appointment: Appointment) => void;
  onOpenSalonDetailsById?: (salonId: string) => void;
}

export const AppointmentsTab: React.FC<AppointmentsTabProps> = ({
  appointments,
  onCancelAppointment,
  onRescheduleAppointment,
  onBookAgain,
  onOpenSalonDetailsById,
}) => {
  const [activeSegment, setActiveSegment] = useState<'upcoming' | 'completed' | 'cancelled'>('upcoming');
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [ratingInput, setRatingInput] = useState<number>(5);
  const [reviewNote, setReviewNote] = useState<string>('');
  const [reviewSubmittedId, setReviewSubmittedId] = useState<string | null>(null);

  const upcomingApts = appointments.filter((a) => a.status === 'confirmed' || a.status === 'in_progress');
  const completedApts = appointments.filter((a) => a.status === 'completed');
  const cancelledApts = appointments.filter((a) => a.status === 'cancelled');

  const displayedList =
    activeSegment === 'upcoming'
      ? upcomingApts
      : activeSegment === 'completed'
      ? completedApts
      : cancelledApts;

  const handleGenerateCalendarEvent = (apt: Appointment) => {
    const title = encodeURIComponent(`Salon Appointment: ${apt.salonName}`);
    const details = encodeURIComponent(`Services: ${apt.services.map((s) => s.name).join(', ')}\nRef: ${apt.bookingRef}`);
    const location = encodeURIComponent(apt.salonAddress);
    const googleCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}`;
    window.open(googleCalUrl, '_blank');
  };

  const handleSubmitReview = (aptId: string) => {
    setReviewSubmittedId(aptId);
    setTimeout(() => {
      setReviewSubmittedId(null);
      setReviewNote('');
    }, 2500);
  };

  return (
    <div className="flex flex-col w-full pb-28 max-w-4xl mx-auto px-page-margin pt-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-hero-heading-mobile text-[22px] font-bold text-on-surface">
            My Appointments
          </h1>
          <p className="text-[13px] text-on-surface-variant">Manage upcoming salon visits & bookings</p>
        </div>
      </div>

      {/* Segment Tabs */}
      <div className="flex bg-surface-container-low p-1 rounded-xl border border-outline-variant/40 mb-5">
        <button
          onClick={() => setActiveSegment('upcoming')}
          className={`flex-1 py-2 rounded-lg text-[13px] font-semibold transition-all ${
            activeSegment === 'upcoming'
              ? 'bg-white text-primary shadow-xs'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Upcoming ({upcomingApts.length})
        </button>
        <button
          onClick={() => setActiveSegment('completed')}
          className={`flex-1 py-2 rounded-lg text-[13px] font-semibold transition-all ${
            activeSegment === 'completed'
              ? 'bg-white text-primary shadow-xs'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Past Visits ({completedApts.length})
        </button>
        <button
          onClick={() => setActiveSegment('cancelled')}
          className={`flex-1 py-2 rounded-lg text-[13px] font-semibold transition-all ${
            activeSegment === 'cancelled'
              ? 'bg-white text-primary shadow-xs'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Cancelled ({cancelledApts.length})
        </button>
      </div>

      {/* List Content */}
      {displayedList.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center text-center bg-surface-container-low rounded-2xl border border-outline-variant/40 p-6">
          <div className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center text-nexora-pink mb-3">
            <span className="material-symbols-outlined text-[30px]">calendar_today</span>
          </div>
          <h3 className="font-card-title text-[16px] font-bold text-on-surface mb-1">
            No {activeSegment} appointments
          </h3>
          <p className="text-[13px] text-on-surface-variant max-w-xs mb-4">
            Discover top salons nearby in Jaipur and book your next haircut, spa or facial in seconds.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {displayedList.map((apt) => {
            const isUpcoming = apt.status === 'confirmed';

            return (
              <div
                key={apt.id}
                className="bg-surface-container-low border border-outline-variant rounded-2xl p-4 shadow-xs relative overflow-hidden flex flex-col gap-3"
              >
                {/* Header info */}
                <div className="flex items-start justify-between gap-3 border-b border-outline-variant/30 pb-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={apt.salonImage}
                      alt={apt.salonName}
                      className="w-12 h-12 rounded-xl object-cover"
                    />
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-nexora-pink bg-surface-container px-1.5 py-0.2 rounded">
                        {apt.bookingRef}
                      </span>
                      <h3 className="font-card-title text-[16px] font-bold text-on-surface mt-0.5">{apt.salonName}</h3>
                      <p className="text-[12px] text-on-surface-variant">{apt.salonAddress}</p>
                    </div>
                  </div>

                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full capitalize ${
                      apt.status === 'confirmed'
                        ? 'bg-success-emerald/15 text-success-emerald'
                        : apt.status === 'completed'
                        ? 'bg-secondary-container text-secondary'
                        : 'bg-error-container text-error'
                    }`}
                  >
                    {apt.status}
                  </span>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/30 text-[12px]">
                  <div>
                    <span className="text-[11px] text-on-surface-variant block">Scheduled Time</span>
                    <span className="font-semibold text-on-surface">
                      {apt.date} · {apt.time}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-on-surface-variant block">Stylist</span>
                    <span className="font-semibold text-on-surface">
                      {apt.stylist?.name || 'Any Expert'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-on-surface-variant block">Amount</span>
                    <span className="font-bold text-primary text-[13px]">₹{apt.totalPrice}</span>
                  </div>
                </div>

                {/* Services list */}
                <div className="text-[12px]">
                  <span className="font-semibold text-on-surface-variant">Services booked: </span>
                  <span className="text-on-surface">{apt.services.map((s) => s.name).join(', ')}</span>
                </div>

                {/* Action Controls */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-outline-variant/30">
                  {isUpcoming && (
                    <>
                      {apt.mapsUrl && (
                        <a
                          href={apt.mapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 bg-surface-container text-nexora-pink text-[12px] font-semibold rounded-lg flex items-center gap-1 hover:bg-surface-container-high transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px]">directions</span>
                          <span>Directions</span>
                        </a>
                      )}

                      <button
                        onClick={() => handleGenerateCalendarEvent(apt)}
                        className="px-3 py-1.5 bg-surface-container text-on-surface text-[12px] font-semibold rounded-lg flex items-center gap-1 hover:bg-surface-container-high transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px]">event</span>
                        <span>Add to Calendar</span>
                      </button>

                      <button
                        onClick={() => onRescheduleAppointment(apt.id)}
                        className="px-3 py-1.5 bg-secondary-container text-on-secondary-container text-[12px] font-semibold rounded-lg hover:opacity-80 transition-opacity"
                      >
                        Reschedule
                      </button>

                      <button
                        onClick={() => onCancelAppointment(apt.id)}
                        className="px-3 py-1.5 text-error text-[12px] font-semibold rounded-lg hover:bg-error-container/30 transition-colors ml-auto"
                      >
                        Cancel
                      </button>
                    </>
                  )}

                  {apt.status === 'completed' && (
                    <div className="w-full flex flex-col gap-3">
                      {reviewSubmittedId === apt.id ? (
                        <div className="p-2.5 bg-success-emerald/10 text-success-emerald rounded-lg text-[12px] font-semibold flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px]">check_circle</span>
                          <span>Thank you! Your rating and feedback were submitted.</span>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-medium text-on-surface-variant">Rate service:</span>
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                  key={star}
                                  onClick={() => setRatingInput(star)}
                                  className="text-warning-amber hover:scale-110 transition-transform"
                                  title={`Rate ${star} stars`}
                                >
                                  <span className={`material-symbols-outlined text-[18px] ${star <= ratingInput ? 'fill-1' : ''}`}>
                                    star
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                          <button
                            onClick={() => handleSubmitReview(apt.id)}
                            className="px-3 py-1 bg-surface-container text-on-surface text-[11px] font-semibold rounded-lg hover:bg-surface-container-high transition-colors"
                          >
                            Submit Rating
                          </button>
                        </div>
                      )}

                      {onBookAgain && (
                        <div className="flex items-center justify-between pt-2 border-t border-outline-variant/30">
                          <span className="text-[11px] text-on-surface-variant hidden sm:inline">
                            Rebook with {apt.stylist?.name || 'same expert'}
                          </span>
                          <button
                            onClick={() => onBookAgain(apt)}
                            className="w-full sm:w-auto px-4 py-2 bg-primary text-white font-button-text text-[12px] font-bold rounded-xl hover:bg-nexora-pink transition-colors shadow-xs flex items-center justify-center gap-1.5 ml-auto"
                          >
                            <span className="material-symbols-outlined text-[16px]">replay</span>
                            <span>Book Again</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {apt.status === 'cancelled' && onBookAgain && (
                    <div className="w-full flex items-center justify-end pt-1">
                      <button
                        onClick={() => onBookAgain(apt)}
                        className="px-4 py-2 bg-primary text-white font-button-text text-[12px] font-bold rounded-xl hover:bg-nexora-pink transition-colors shadow-xs flex items-center justify-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[16px]">replay</span>
                        <span>Book Again</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
