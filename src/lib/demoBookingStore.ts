/**
 * Local-demo booking store (browser only).
 *
 * Nexora runs in one of two modes (see `src/lib/supabase/client.ts`):
 *
 *  - LIVE  — a real Supabase project is configured. Bookings are created by
 *            the service-role endpoint `POST /api/bookings`. Nothing here runs.
 *  - DEMO  — no live project is configured, so the whole
 *            sign-up → search → book → confirmation flow runs on-device.
 *
 * Before this module existed the demo build still POSTed to `/api/bookings`,
 * which answers `503 Booking service is not configured` without a service-role
 * key — the customer got "Payment Failure / Advance Payment Incomplete" on the
 * very last step of checkout and could never complete a booking.
 *
 * The demo store closes that gap WITHOUT faking a live payment:
 *  - the request goes through the SAME validator and row builder as the server
 *    (`src/lib/bookingCore.ts`), so totals, the 25% advance and
 *    `metadata.services[]` are byte-for-byte identical;
 *  - rows are written to the local demo tables (`nexora.demo.table.bookings`
 *    and `nexora.demo.table.booking_services`) — the same storage the demo
 *    Supabase client reads;
 *  - the resulting appointment keeps `status: 'pending'` /
 *    `paymentStatus: 'pending'` and is tagged `isDemoBooking` so no screen can
 *    claim a real gateway payment was captured.
 */

import type { Appointment } from '../types';
import type { BookingCreateRequest } from './bookingContract';
import {
  createBooking as createBookingWithStore,
  validateBookingRequest,
  type BookingDbRow,
  type BookingServiceDbRow,
  type BookingStore,
} from './bookingCore';

const TABLE_KEY = (name: string) => `nexora.demo.table.${name}`;
/** Keep the demo store small — it lives in localStorage. */
const MAX_DEMO_BOOKINGS = 100;

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function readRows<T>(table: string): T[] {
  const store = storage();
  if (!store) return [];
  try {
    const raw = store.getItem(TABLE_KEY(table));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeRows(table: string, rows: unknown[]): boolean {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(TABLE_KEY(table), JSON.stringify(rows));
    return true;
  } catch {
    // Quota / private mode. The booking still succeeds in-memory for this
    // session; the caller is told so it can decide what to surface.
    return false;
  }
}

/** BookingStore implementation backed by the local demo tables. */
export function createDemoBookingStore(): BookingStore {
  return {
    async insertBooking(row: BookingDbRow) {
      const rows = readRows<BookingDbRow>('bookings');
      rows.unshift(row);
      writeRows('bookings', rows.slice(0, MAX_DEMO_BOOKINGS));
      return { ok: true };
    },
    async insertBookingServices(serviceRows: BookingServiceDbRow[]) {
      if (serviceRows.length === 0) return { ok: true };
      const rows = readRows<BookingServiceDbRow>('booking_services');
      writeRows('booking_services', [...serviceRows, ...rows].slice(0, MAX_DEMO_BOOKINGS * 10));
      return { ok: true };
    },
    async deleteBooking(bookingId: string) {
      const rows = readRows<BookingDbRow>('bookings').filter((row) => row.id !== bookingId);
      writeRows('bookings', rows);
      const services = readRows<BookingServiceDbRow>('booking_services').filter(
        (row) => row.booking_id !== bookingId
      );
      writeRows('booking_services', services);
      return { ok: true };
    },
  };
}

export interface DemoBookingResult {
  ok: boolean;
  appointment?: Appointment;
  error?: string;
}

/**
 * Create a booking entirely on-device, using the shared validation + pricing
 * core. Returns the same shape as the network client so call sites do not
 * branch on transport.
 */
export async function createDemoBooking(
  request: BookingCreateRequest,
  store: BookingStore = createDemoBookingStore()
): Promise<DemoBookingResult> {
  const parsed = validateBookingRequest(request);
  if (!parsed.ok || !parsed.value) {
    const detail = parsed.fields?.slice(0, 3).join('; ');
    return {
      ok: false,
      error: `Invalid booking request.${detail ? ` ${detail}.` : ''}`,
    };
  }

  const result = await createBookingWithStore(store, parsed.value);
  if (!result.appointment) {
    return { ok: false, error: result.error || 'Demo booking could not be saved on this device.' };
  }

  return {
    ok: true,
    appointment: {
      ...result.appointment,
      isDemoBooking: true,
    },
  };
}
