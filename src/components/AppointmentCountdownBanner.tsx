import React, { useState, useEffect } from 'react';
import { Appointment, Salon } from '../types';

interface AppointmentCountdownBannerProps {
  appointment: Appointment;
  salon?: Salon;
  onOpenDetails: (appointment: Appointment) => void;
  onGetDirections?: (mapsUrl?: string) => void;
}

export const parseAppointmentDateTime = (dateStr: string, timeStr: string): Date => {
  try {
    const cleanTime = timeStr.trim().toUpperCase();
    const isPM = cleanTime.includes('PM');
    const isAM = cleanTime.includes('AM');
    const match = cleanTime.match(/(\d+):(\d+)/);

    let hours = 17;
    let minutes = 30;

    if (match) {
      hours = parseInt(match[1], 10);
      minutes = parseInt(match[2], 10);
      if (isPM && hours < 12) hours += 12;
      if (isAM && hours === 12) hours = 0;
    }

    const hoursStr = hours.toString().padStart(2, '0');
    const minutesStr = minutes.toString().padStart(2, '0');
    const dateFormatted = dateStr.includes('-') ? dateStr : new Date().toISOString().split('T')[0];

    const targetDate = new Date(`${dateFormatted}T${hoursStr}:${minutesStr}:00`);
    if (!isNaN(targetDate.getTime())) {
      return targetDate;
    }
  } catch (e) {
    console.error('Error parsing date:', e);
  }
  return new Date(Date.now() + 10 * 3600 * 1000);
};

export const AppointmentCountdownBanner: React.FC<AppointmentCountdownBannerProps> = ({
  appointment,
  salon,
  onOpenDetails,
  onGetDirections,
}) => {
  const [timeLeft, setTimeLeft] = useState<{
    totalMs: number;
    hours: number;
    minutes: number;
    seconds: number;
    isPast: boolean;
    isImminent: boolean; // < 1 hour
  }>({
    totalMs: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isPast: false,
    isImminent: false,
  });

  useEffect(() => {
    const calculateTimeRemaining = () => {
      const targetTime = parseAppointmentDateTime(appointment.date, appointment.time);
      const now = new Date();
      const diff = targetTime.getTime() - now.getTime();

      if (diff <= 0) {
        // If it just passed within 2 hours, show in progress
        const isRecentlyStarted = diff > -2 * 60 * 60 * 1000;
        setTimeLeft({
          totalMs: diff,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isPast: !isRecentlyStarted,
          isImminent: isRecentlyStarted,
        });
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        setTimeLeft({
          totalMs: diff,
          hours,
          minutes,
          seconds,
          isPast: false,
          isImminent: diff < 60 * 60 * 1000,
        });
      }
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 1000);
    return () => clearInterval(interval);
  }, [appointment.date, appointment.time]);

  // Check if within 24 hours
  const isWithin24Hours = timeLeft.totalMs > 0 && timeLeft.totalMs <= 24 * 60 * 60 * 1000;
  const isToday = appointment.date === new Date().toISOString().split('T')[0];

  // If not within 24 hours and not today, do not render banner
  if (!isWithin24Hours && !isToday && !timeLeft.isImminent) {
    return null;
  }

  const mapsUrl =
    appointment.mapsUrl ||
    salon?.location.mapsUrl ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      appointment.salonName + ' ' + (appointment.salonAddress || '')
    )}`;

  return (
    <section 
      id="appointment-countdown-banner"
      className="px-page-margin mb-6 animate-in fade-in slide-in-from-top-3 duration-300"
    >
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#720938] via-primary to-[#4a0022] text-white p-4 sm:p-5 shadow-lg border border-white/15">
        {/* Background glow & decorative graphics */}
        <div className="absolute -right-6 -top-6 w-36 h-36 bg-nexora-pink/30 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -left-6 -bottom-6 w-28 h-28 bg-warning-amber/20 rounded-full blur-xl pointer-events-none" />

        {/* Header Strip with Live Pulse Pill */}
        <div className="relative z-10 flex items-center justify-between gap-2 mb-3 border-b border-white/15 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning-amber opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-warning-amber" />
            </span>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-200">
              {timeLeft.isImminent
                ? '⚡ Starting Soon · Get Ready'
                : 'Confirmed Appointment · Upcoming Today'}
            </span>
          </div>

          <span className="text-[11px] font-mono font-bold bg-white/15 px-2 py-0.5 rounded-full backdrop-blur-xs">
            Ref: {appointment.bookingRef}
          </span>
        </div>

        {/* Main Countdown Stage */}
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          {/* Salon & Service Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-white/80 text-[12px] mb-1">
              <span className="material-symbols-outlined text-[16px] text-amber-300">location_on</span>
              <span className="font-medium truncate">{appointment.salonAddress || salon?.location.area || 'Mansarovar'}</span>
              <span>·</span>
              <span className="font-semibold text-amber-300">{appointment.time}</span>
            </div>
            <h3 className="font-card-title text-[18px] sm:text-[20px] font-bold text-white leading-tight truncate">
              {appointment.salonName}
            </h3>
            <p className="text-[13px] text-white/90 font-medium truncate mt-0.5">
              {appointment.services[0]?.name}
              {appointment.stylist && ` · Stylist: ${appointment.stylist.name.split(' ')[0]}`}
            </p>
          </div>

          {/* Visual Digital Timer Block */}
          <div className="flex items-center gap-1.5 bg-black/35 backdrop-blur-md p-2.5 rounded-xl border border-white/15 self-start sm:self-auto shrink-0 shadow-inner">
            {/* Hours */}
            <div className="flex flex-col items-center min-w-[42px]">
              <span className="font-mono text-[20px] sm:text-[22px] font-extrabold text-white leading-none">
                {String(Math.max(0, timeLeft.hours)).padStart(2, '0')}
              </span>
              <span className="text-[9px] uppercase tracking-wider text-white/70 font-semibold mt-1">
                Hours
              </span>
            </div>

            <span className="font-mono text-[18px] font-bold text-amber-300/80 -mt-3">:</span>

            {/* Minutes */}
            <div className="flex flex-col items-center min-w-[42px]">
              <span className="font-mono text-[20px] sm:text-[22px] font-extrabold text-white leading-none">
                {String(Math.max(0, timeLeft.minutes)).padStart(2, '0')}
              </span>
              <span className="text-[9px] uppercase tracking-wider text-white/70 font-semibold mt-1">
                Mins
              </span>
            </div>

            <span className="font-mono text-[18px] font-bold text-amber-300/80 -mt-3">:</span>

            {/* Seconds */}
            <div className="flex flex-col items-center min-w-[42px]">
              <span className="font-mono text-[20px] sm:text-[22px] font-extrabold text-amber-300 leading-none">
                {String(Math.max(0, timeLeft.seconds)).padStart(2, '0')}
              </span>
              <span className="text-[9px] uppercase tracking-wider text-amber-200/80 font-semibold mt-1">
                Secs
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="relative z-10 flex items-center gap-2 pt-1">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="flex-1 py-2 px-3 bg-white/15 hover:bg-white/25 border border-white/20 text-white rounded-xl text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-colors backdrop-blur-xs"
          >
            <span className="material-symbols-outlined text-[16px] text-amber-300">near_me</span>
            <span>Directions</span>
          </a>

          <button
            onClick={() => onOpenDetails(appointment)}
            className="flex-2 py-2 px-4 bg-white text-primary hover:bg-white/95 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-98"
          >
            <span className="material-symbols-outlined text-[16px]">qr_code_2</span>
            <span>View Pass & Details</span>
          </button>
        </div>
      </div>
    </section>
  );
};
