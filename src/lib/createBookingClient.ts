/**
 * Browser-safe client for POST /api/bookings (the server-side booking
 * endpoint defined in server/bookings.ts).
 *
 * This module only speaks the canonical BookingCreateRequest contract — it
 * never invents a fallback appointment, never fabricates a payment and never
 * creates local state. A booking exists only when the server returns 201.
 */

import type { Appointment } from '../types';
import type { BookingCreateRequest } from './bookingContract';

export interface CreateBookingResult {
  ok: boolean;
  appointment?: Appointment;
  error?: string;
}

function bookingEndpoint(): string {
  return `${window.location.origin}/api/bookings`;
}

export async function createBooking(
  request: BookingCreateRequest,
  options: { signal?: AbortSignal } = {}
): Promise<CreateBookingResult> {
  const response = await fetch(bookingEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal: options.signal,
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Non-JSON failure body — fall through to the status-based error below.
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && typeof (payload as { error?: unknown }).error === 'string'
        ? ((payload as { error: string }).error as string)
        : `Booking request failed with status ${response.status}.`;
    return { ok: false, error: message };
  }

  const appointment =
    payload && typeof payload === 'object'
      ? (payload as { appointment?: Appointment }).appointment
      : undefined;

  if (!appointment || !appointment.id) {
    return { ok: false, error: 'Booking service returned an invalid confirmation. No appointment was created.' };
  }

  return { ok: true, appointment };
}
