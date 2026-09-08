/**
 * Nexora server-side booking endpoint (multi-service aware).
 *
 * Why this lives on the server
 * ----------------------------
 * Appointments must never be created from an unauthenticated client event
 * (see App.tsx handleConfirmBooking guard). The browser bundle only holds an
 * anon key; every booking write goes through this service-role endpoint:
 *
 *   POST /api/bookings   create booking + booking_services line items
 *
 * The customer UI reaches it through `onPayDeposit` (BookingSummaryModal →
 * App.tsx). In production this endpoint is expected to sit BEHIND the payment
 * adapter: the caller verifies the Razorpay order/signature first and only
 * then creates the booking with a `pending` status. This module never claims
 * a payment happened — there is intentionally no server-side fake payment.
 *
 * Validation, pricing and row building now live in the isomorphic core
 * (`src/lib/bookingCore.ts`) so the browser checkout, the local demo store and
 * this endpoint agree on every rupee — a mismatch is what used to surface as
 * "Advance Payment Incomplete" at checkout.
 *
 * Persistence format (matches supabase/setup.sql):
 *  - `bookings.metadata` jsonb  → { services: BookingServiceLine[] }
 *  - `booking_services` rows    → one normalized child row per line item.
 *
 * If the services insert fails after the parent insert, the parent row is
 * deleted (compensating action) so no orphan booking survives.
 */

import { Router, Request, Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from './notifications';
import {
  BookingDbRow,
  BookingServiceDbRow,
  BookingStore,
  createBooking,
  validateBookingRequest,
} from '../src/lib/bookingCore';

// Re-exported so existing importers (tests, tooling) keep one canonical entry
// point for the booking contract implementation.
export {
  ADVANCE_PAYMENT_RATE,
  buildBookingRows,
  bookingToAppointment,
  computeBookingTotals,
  createBooking,
  validateBookingRequest,
} from '../src/lib/bookingCore';
export type {
  BookingDbRow,
  BookingServiceDbRow,
  BookingStore,
  BookingTotals,
} from '../src/lib/bookingCore';

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

export function jsonError(res: Response, status: number, error: string, fields?: string[]) {
  return res.status(status).json({
    error,
    ...(fields && fields.length > 0 ? { fields } : {}),
  });
}

// ---------------------------------------------------------------------------
// Supabase-backed store
// ---------------------------------------------------------------------------

export function createSupabaseBookingStore(client: SupabaseClient): BookingStore {
  return {
    async insertBooking(row: BookingDbRow) {
      const { error } = await client.from('bookings').insert(row);
      return error ? { ok: false, error: error.message } : { ok: true };
    },
    async insertBookingServices(rows: BookingServiceDbRow[]) {
      if (rows.length === 0) return { ok: true };
      const { error } = await client.from('booking_services').insert(rows);
      return error ? { ok: false, error: error.message } : { ok: true };
    },
    async deleteBooking(bookingId: string) {
      const { error } = await client.from('bookings').delete().eq('id', bookingId);
      return error ? { ok: false, error: error.message } : { ok: true };
    },
  };
}

// ---------------------------------------------------------------------------
// Express router
// ---------------------------------------------------------------------------

export function createBookingsRouter(
  env: NodeJS.ProcessEnv = process.env,
  storeOverride?: BookingStore | null
): Router {
  const router = Router();
  const { client, reason } = createServiceClient(env);
  const store: BookingStore | null =
    storeOverride !== undefined ? storeOverride : client ? createSupabaseBookingStore(client) : null;

  router.post('/', createBookingsHandler(store, reason));
  return router;
}

/** Express handler for POST /api/bookings — separated so tests can drive it. */
export function createBookingsHandler(
  store: BookingStore | null,
  reason?: string
): (req: Request, res: Response) => Promise<Response | void> {
  return async (req: Request, res: Response) => {
    if (!store) {
      return jsonError(res, 503, 'Booking service is not configured (no service-role client).', [
        reason ?? 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured',
      ]);
    }

    const parsed = validateBookingRequest(req.body);
    if (!parsed.ok) {
      return jsonError(res, 400, 'Invalid booking request.', parsed.fields?.slice(0, 15));
    }

    try {
      const result = await createBooking(store, parsed.value!);
      if (!result.appointment) {
        return jsonError(res, 500, result.error ?? 'Booking creation failed.');
      }
      return res.status(201).json({ appointment: result.appointment });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected booking service failure';
      console.error('[Nexora] Booking creation threw:', err);
      return jsonError(res, 500, message);
    }
  };
}
