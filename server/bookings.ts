/**
 * Nexora server-side booking endpoint (multi-service aware).
 *
 * Why this lives on the server
 * ----------------------------
 * Appointments must never be created from an unauthenticated client event
 * (see App.tsx handleConfirmBooking guard). The browser bundle only holds an
 * anon key; every booking write goes through this service-role endpoint:
 *
 *   POST /api/bookings   REJECTED (402) — bookings are created only after
 *                        POST /api/payments/orders + POST /api/payments/verify
 *
 * The customer UI reaches checkout through `onPayDeposit` (BookingSummaryModal →
 * App.tsx → createBookingClient). Direct inserts from the browser are refused.
 * Persistence (`createBooking`) is still used by the payments router AFTER
 * HMAC verification. This module never claims a payment happened.
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
import { isRazorpayConfigured } from '../src/lib/paymentCore';
import {
  createSupabaseAccountStore,
  extractBearerToken,
  type AccountStore,
} from './userAccount';

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
// Stores
// ---------------------------------------------------------------------------

/** In-process store used when Razorpay/Supabase are not configured (preview / demo). */
export function createMemoryBookingStore(): BookingStore {
  const bookings: BookingDbRow[] = [];
  const services: BookingServiceDbRow[] = [];
  return {
    async insertBooking(row) {
      bookings.unshift(row);
      return { ok: true };
    },
    async insertBookingServices(rows) {
      if (rows.length === 0) return { ok: true };
      services.unshift(...rows);
      return { ok: true };
    },
    async deleteBooking(bookingId) {
      const idx = bookings.findIndex((row) => row.id === bookingId);
      if (idx >= 0) bookings.splice(idx, 1);
      for (let i = services.length - 1; i >= 0; i--) {
        if (services[i].booking_id === bookingId) services.splice(i, 1);
      }
      return { ok: true };
    },
    async cancelBooking(bookingId, ownerUserId) {
      // Owner match is part of the query, not a post-filter: an id guess
      // cannot reach another customer's row.
      const row = bookings.find(
        (b) => b.id === bookingId && b.user_id === ownerUserId
      );
      if (!row) return { ok: false, found: false };
      (row as { status: string }).status = 'cancelled';
      return { ok: true, found: true };
    },
    async findActiveSlot(salonId, slotDate, slotTime, stylistId) {
      const wantChair = stylistId && stylistId.trim() ? stylistId.trim() : null;
      return bookings.some((row) => {
        if (row.salon_id !== salonId || row.slot_date !== slotDate || row.slot_time !== slotTime) return false;
        if ((row.status as string) === 'cancelled' || (row.status as string) === 'no_show') return false;
        const held = row.stylist_snapshot?.id ?? null;
        if (!wantChair) return true;
        return !held || held === wantChair;
      });
    },
  };
}

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
    async cancelBooking(bookingId, ownerUserId) {
      // Scope the update by BOTH id and owner. `select('id')` reports whether
      // anything matched, which is how the route tells 404 apart from 500.
      const { data, error } = await client
        .from('bookings')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', bookingId)
        .eq('user_id', ownerUserId)
        .select('id');
      if (error) return { ok: false, error: error.message };
      return { ok: true, found: Array.isArray(data) && data.length > 0 };
    },
    async findActiveSlot(salonId, slotDate, slotTime, stylistId) {
      let query = client
        .from('bookings')
        .select('id, stylist_snapshot, status')
        .eq('salon_id', salonId)
        .eq('slot_date', slotDate)
        .eq('slot_time', slotTime)
        .in('status', ['pending', 'confirmed', 'in_progress']);
      const { data, error } = await query;
      if (error || !Array.isArray(data)) return false;
      const wantChair = stylistId && stylistId.trim() ? stylistId.trim() : null;
      return data.some((row) => {
        const held =
          row && typeof row === 'object'
            ? (row as { stylist_snapshot?: { id?: string } | null }).stylist_snapshot?.id ?? null
            : null;
        if (!wantChair) return true;
        return !held || held === wantChair;
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Express router
// ---------------------------------------------------------------------------

export function createBookingsRouter(
  env: NodeJS.ProcessEnv = process.env,
  storeOverride?: BookingStore | null,
  accountStoreOverride?: AccountStore | null
): Router {
  const router = Router();
  const { client, reason } = createServiceClient(env);
  const store: BookingStore | null =
    storeOverride !== undefined ? storeOverride : client ? createSupabaseBookingStore(client) : null;

  router.post('/', (req: Request, res: Response) => {
    // Live Razorpay deployments: this endpoint is not a payment shortcut.
    if (isRazorpayConfigured(env)) {
      return jsonError(
        res,
        402,
        'Secure deposit required to lock this slot. Create a gateway order at POST /api/payments/orders and confirm it at POST /api/payments/verify. Bookings are not created from this endpoint.'
      );
    }
    // Preview / demo (no gateway keys): persist a pending booking so older
    // clients that still POST /api/bookings do not 404 with
    // "booking service endpoint was not found".
    const effectiveStore = store ?? createMemoryBookingStore();
    return createBookingsHandler(effectiveStore, reason)(req, res);
  });

  // POST /api/bookings/:id/cancel — authenticated, owner-scoped.
  //
  // Cancelling used to be client-only: App.tsx flipped the row's status in
  // React state and never told the server, so the salon still saw an active
  // booking, the slot stayed occupied, and a reload restored the appointment.
  router.post('/:id/cancel', (req: Request, res: Response) => {
    const effectiveStore = store ?? createMemoryBookingStore();
    const accountStore = accountStoreOverride ?? (client ? createSupabaseAccountStore(client) : null);
    return createCancelBookingHandler(effectiveStore, accountStore, reason)(req, res);
  });

  return router;
}

/**
 * Express handler for POST /api/bookings/:id/cancel — separated so tests can
 * drive the success path without a live Supabase project.
 *
 * Identity comes only from the verified access token. The booking id in the URL
 * is matched against that identity inside the store, so a caller cannot cancel
 * another customer's booking by guessing an id, and "not yours" is
 * indistinguishable from "does not exist".
 */
export function createCancelBookingHandler(
  store: BookingStore | null,
  accountStore: AccountStore | null,
  reason?: string
): (req: Request, res: Response) => Promise<Response | void> {
  return async (req: Request, res: Response) => {
    if (!accountStore) {
      // Same honesty rule as account deletion: never report a cancellation
      // that did not happen. The client keeps the booking active.
      return res.status(503).json({
        error: 'Cancellation is not available',
        reason: reason || 'service client unavailable',
        configured: false,
      });
    }

    if (!store || typeof store.cancelBooking !== 'function') {
      return jsonError(res, 501, 'This booking service cannot cancel appointments.');
    }

    const token = extractBearerToken(req);
    if (!token) {
      return jsonError(res, 401, 'Missing access token. Sign in again and retry.');
    }

    const verified = await accountStore.verifyAccessToken(token);
    if (!verified.ok || !verified.userId) {
      return jsonError(res, 401, verified.error || 'Session expired. Sign in again and retry.');
    }

    const bookingId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (!bookingId) {
      return jsonError(res, 400, 'A booking id is required.');
    }

    const outcome = await store.cancelBooking(bookingId, verified.userId);
    if (!outcome.ok) {
      return jsonError(
        res,
        500,
        `Cancellation failed: ${outcome.error || 'unknown error'}. The booking is still active.`
      );
    }
    if (outcome.found === false) {
      // Identical shape for "not yours" and "does not exist" so the endpoint
      // cannot be used to enumerate other customers' booking ids.
      return jsonError(res, 404, 'No active booking found for your account.');
    }

    return res.json({ success: true, bookingId, status: 'cancelled' });
  };
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
