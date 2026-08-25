import type { Appointment } from '../types';

/**
 * Parse the display time stored by the booking flow without relying on the
 * JavaScript implementation's handling of an invalid date. The date is a
 * salon-local calendar date, so it is intentionally constructed in local
 * time rather than through `toISOString()`.
 */
export function parseAppointmentDateTime(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || hours < 1 || hours > 12 || minutes > 59) return null;
  const meridiem = match[3].toUpperCase();
  if (meridiem === 'PM' && hours !== 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;

  const result = new Date(`${date}T00:00:00`);
  result.setHours(hours, minutes, 0, 0);
  return Number.isNaN(result.getTime()) ? null : result;
}

/** True only for a confirmed appointment whose slot has not passed. */
export function isAppointmentUpcoming(appointment: Appointment, now = new Date()): boolean {
  if (appointment.status === 'in_progress') return true;
  if (appointment.status !== 'confirmed') return false;
  const scheduledAt = parseAppointmentDateTime(appointment.date, appointment.time);
  return Boolean(scheduledAt && scheduledAt.getTime() >= now.getTime());
}
