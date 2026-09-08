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
 * a payment happened — there is intentionally no browser/local fallback and
 * no `confirmed` status fabricatated here.
 *
 * Data contract
 * -------------
 * The request body is a BookingCreateRequest (see src/lib/bookingContract.ts).
 * Line items are validated field-by-field, totals are RECOMPUTED on the server
 * from `services[].unitPrice` (discountPrice ?? price) and the 25% advance is
 * enforced — a tampered `amount` is rejected instead of stored.
 *
 * Persistence format (matches supabase/setup.sql):
 *  - `bookings.metadata` jsonb  → { services: BookingServiceLine[] }
 *    Single-service bookings store an array of length one; multi-service
 *    bookings store every line item. Never null, always an array.
 *  - `booking_services` rows    → one normalized child row per line item.
 *
 * If the services insert fails after the parent insert, the parent row is
 * deleted (compensating action) so no orphan booking survives.
 */

import crypto from 'crypto';
import express, { Router, Request, Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from './notifications';
import {
  BookingCreateRequest,
  BookingMetadata,
  BookingSalonSnapshot,
  BookingServiceLine,
  BookingStylistSnapshot,
  BookingCustomerSnapshot,
  lineItemsSubtotal,
  lineItemsDurationMinutes,
  toSalonServices,
} from '../src/lib/bookingContract';
import type { Appointment, Stylist } from '../src/types';

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

export function jsonError(res: Response, status: number, error: string, fields?: string[]) {
  return res.status(status).json({
    error,
    ...(fields && fields.length > 0 ? { fields } : {}),
  });
}

/** Round to 2 decimals (INR paise). */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

const TIME_RE = /^(1[0-2]|0?[1-9]):([0-5]\d)\s*(AM|PM)$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------------------
// Row contracts (mirror supabase/setup.sql tables)
// ---------------------------------------------------------------------------

export interface BookingDbRow {
  id: string;
  booking_ref: string;
  user_id: string | null;
  customer: BookingCustomerSnapshot | null;
  salon_id: string;
  salon_snapshot: BookingSalonSnapshot;
  stylist_snapshot: BookingStylistSnapshot | null;
  slot_date: string;
  slot_time: string;
  status: 'pending';
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  advance_amount: number;
  currency: 'INR';
  payment_mode: 'advance_25';
  payment_status: 'pending';
  coupon_code: string | null;
  notes: string | null;
  metadata: BookingMetadata;
  created_at: string;
  updated_at: string;
}

export interface BookingServiceDbRow {
  booking_id: string;
  salon_id: string;
  service_id: string;
  service_name: string;
  category: string | null;
  list_price: number;
  unit_price: number;
  duration_minutes: number;
  position: number;
}

// ---------------------------------------------------------------------------
// Store port — small so route logic is unit-testable without a live project
// ---------------------------------------------------------------------------

export interface BookingStore {
  insertBooking(row: BookingDbRow): Promise<{ ok: boolean; error?: string }>;
  insertBookingServices(rows: BookingServiceDbRow[]): Promise<{ ok: boolean; error?: string }>;
  deleteBooking(bookingId: string): Promise<{ ok: boolean; error?: string }>;
}

export function createSupabaseBookingStore(client: SupabaseClient): BookingStore {
  return {
    async insertBooking(row) {
      const { error } = await client.from('bookings').insert(row);
      return error ? { ok: false, error: error.message } : { ok: true };
    },
    async insertBookingServices(rows) {
      if (rows.length === 0) return { ok: true };
      const { error } = await client.from('booking_services').insert(rows);
      return error ? { ok: false, error: error.message } : { ok: true };
    },
    async deleteBooking(bookingId) {
      const { error } = await client.from('bookings').delete().eq('id', bookingId);
      return error ? { ok: false, error: error.message } : { ok: true };
    },
  };
}

// ---------------------------------------------------------------------------
// Validation (untrusted body → BookingCreateRequest)
// ---------------------------------------------------------------------------

interface ValidationResult {
  ok: boolean;
  value?: BookingCreateRequest;
  fields?: string[];
}

function asString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
}

function asFiniteNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseSalon(raw: unknown): { salon: BookingSalonSnapshot | null; error?: string } {
  const salon = (raw ?? {}) as Record<string, unknown>;
  const id = asString(salon.id, 200);
  const name = asString(salon.name, 200);
  if (!id || !name) return { salon: null, error: 'salon.id and salon.name are required' };
  const result: BookingSalonSnapshot = { id, name };
  const image = asString(salon.image, 2000);
  if (image) result.image = image;
  const address = asString(salon.address, 1000);
  if (address) result.address = address;
  const phone = asString(salon.phone, 40);
  if (phone) result.phone = phone;
  const mapsUrl = asString(salon.mapsUrl, 2000);
  if (mapsUrl) result.mapsUrl = mapsUrl;
  const rating = asFiniteNumber(salon.rating);
  if (rating !== null && rating >= 0 && rating <= 5) result.rating = rating;
  const latitude = asFiniteNumber(salon.latitude);
  if (latitude !== null && latitude >= -90 && latitude <= 90) result.latitude = latitude;
  const longitude = asFiniteNumber(salon.longitude);
  if (longitude !== null && longitude >= -180 && longitude <= 180) result.longitude = longitude;
  return { salon: result };
}

function parseLine(raw: unknown, index: number, errors: string[]): BookingServiceLine | null {
  const item = (raw ?? {}) as Record<string, unknown>;
  const id = asString(item.id, 200);
  const name = asString(item.name, 300);
  const price = asFiniteNumber(item.price);
  const unitPrice = asFiniteNumber(item.unitPrice);
  const discountPrice = asFiniteNumber(item.discountPrice);
  const duration = asFiniteNumber(item.durationMinutes);

  if (!id) {
    errors.push(`services[${index}].id is required`);
    return null;
  }
  if (!name) {
    errors.push(`services[${index}].name is required`);
    return null;
  }
  if (price === null || price < 0) {
    errors.push(`services[${index}].price must be a non-negative number`);
    return null;
  }
  if (unitPrice === null || unitPrice < 0) {
    errors.push(`services[${index}].unitPrice must be a non-negative number`);
    return null;
  }
  if (duration === null || duration <= 0 || duration > 24 * 60) {
    errors.push(`services[${index}].durationMinutes must be between 1 and 1440`);
    return null;
  }
  if (discountPrice !== null && (discountPrice < 0 || discountPrice > price)) {
    errors.push(`services[${index}].discountPrice must be within [0, price]`);
    return null;
  }

  // Integrity: unitPrice must equal the price the customer actually pays.
  const expectedUnit =
    discountPrice !== null && discountPrice < price ? discountPrice : price;
  if (Math.abs(round2(unitPrice) - round2(expectedUnit)) > 0.0049) {
    errors.push(
      `services[${index}].unitPrice must equal discountPrice ?? price (expected ${round2(expectedUnit)})`
    );
    return null;
  }

  const line: BookingServiceLine = {
    id,
    name,
    durationMinutes: Math.round(duration),
    price: round2(price),
    unitPrice: round2(unitPrice),
  };
  if (discountPrice !== null && discountPrice < price) {
    line.discountPrice = round2(discountPrice);
  }
  const category = asString(item.category, 100);
  if (category) line.category = category;
  const description = asString(item.description, 2000);
  if (description) line.description = description;
  if (item.popular === true) line.popular = true;
  return line;
}

function parseServices(raw: unknown): { lines: BookingServiceLine[]; errors: string[] } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { lines: [], errors: ['services must be a non-empty array of line items'] };
  }
  const errors: string[] = [];
  const lines: BookingServiceLine[] = [];
  const seen = new Set<string>();
  raw.forEach((item, index) => {
    if (errors.length > 20) return;
    const line = parseLine(item, index, errors);
    if (!line) return;
    if (seen.has(line.id)) {
      errors.push(`services[${index}].id is duplicated (${line.id})`);
      return;
    }
    seen.add(line.id);
    lines.push(line);
  });
  if (lines.length === 0) {
    errors.push('services must contain at least one valid line item');
  }
  return { lines, errors };
}

function parseStylist(raw: unknown): BookingStylistSnapshot | null | undefined {
  if (raw === null || raw === undefined) return null;
  const stylist = raw as Record<string, unknown>;
  const id = asString(stylist.id, 200);
  const name = asString(stylist.name, 200);
  if (!id || !name) return null;
  const snapshot: BookingStylistSnapshot = { id, name };
  const role = asString(stylist.role, 300);
  if (role) snapshot.role = role;
  const rating = asFiniteNumber(stylist.rating);
  if (rating !== null && rating >= 0 && rating <= 5) snapshot.rating = rating;
  const avatar = asString(stylist.avatar, 2000);
  if (avatar) snapshot.avatar = avatar;
  const experience = asString(stylist.experience, 100);
  if (experience) snapshot.experience = experience;
  if (Array.isArray(stylist.specialty)) {
    const specialty = stylist.specialty
      .filter((s): s is string => typeof s === 'string')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length <= 100)
      .slice(0, 20);
    if (specialty.length > 0) snapshot.specialty = specialty;
  }
  return snapshot;
}

function parseCustomer(raw: unknown): BookingCustomerSnapshot | null | undefined {
  if (raw === null || raw === undefined) return null;
  const customer = raw as Record<string, unknown>;
  const result: BookingCustomerSnapshot = {};
  const id = asString(customer.id, 200);
  if (id) result.id = id;
  const name = asString(customer.name, 200);
  if (name) result.name = name;
  const email = asString(customer.email, 320);
  if (email) result.email = email;
  const phone = asString(customer.phone, 40);
  if (phone) result.phone = phone;
  return result.id || result.name || result.email || result.phone ? result : null;
}

export function validateBookingRequest(body: unknown): ValidationResult {
  const raw = (body ?? {}) as Record<string, unknown>;
  const fields: string[] = [];

  const salonParsed = parseSalon(raw.salon);
  if (salonParsed.error) fields.push(salonParsed.error);

  const servicesParsed = parseServices(raw.services);
  fields.push(...servicesParsed.errors);
  const parsedLines: BookingServiceLine[] = servicesParsed.lines;

  const date = asString(raw.date, 10);
  if (!date || !DATE_RE.test(date)) {
    fields.push('date must be a YYYY-MM-DD string');
  } else {
    // A booking slot cannot be in the past (server-local calendar date).
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
      today.getDate()
    ).padStart(2, '0')}`;
    if (date < todayStr) fields.push('date must not be in the past');
  }

  const time = asString(raw.time, 12);
  if (!time || !TIME_RE.test(time)) fields.push('time must match e.g. "5:30 PM"');

  const amount = asFiniteNumber(raw.amount);
  if (amount === null || amount < 0) fields.push('amount must be a non-negative number');

  const discountAmount = asFiniteNumber(raw.discountAmount);
  if (discountAmount !== null && discountAmount < 0) {
    fields.push('discountAmount must be non-negative');
  }

  const notes = asString(raw.notes, 3000);
  const couponCode = asString(raw.couponCode, 40);

  if (fields.length > 0) return { ok: false, fields };

  const subtotal = lineItemsSubtotal(parsedLines);
  const discount = discountAmount === null ? 0 : round2(discountAmount);
  if (discount > subtotal) {
    return { ok: false, fields: ['discountAmount cannot exceed the service subtotal'] };
  }
  const finalTotal = round2(subtotal - discount);
  const expectedAdvance = round2(Math.round(finalTotal * 0.25));
  if (amount !== null && Math.abs(round2(amount) - expectedAdvance) > 0.0049) {
    return {
      ok: false,
      fields: [
        `amount must equal the 25% verified advance (₹${expectedAdvance.toFixed(2)}) of the recomputed total`,
      ],
    };
  }

  if (!salonParsed.salon) {
    return { ok: false, fields: ['salon is required'] };
  }

  return {
    ok: true,
    value: {
      salon: salonParsed.salon,
      services: parsedLines,
      stylist: parseStylist(raw.stylist),
      customer: parseCustomer(raw.customer),
      date: date as string,
      time: time as string,
      amount: round2(amount as number),
      ...(couponCode ? { couponCode: couponCode.toUpperCase() } : {}),
      ...(discountAmount !== null ? { discountAmount: discount } : {}),
      ...(notes ? { notes } : {}),
    },
  };
}

// ---------------------------------------------------------------------------
// Creation core — pure of express so tests can drive it through a fake store
// ---------------------------------------------------------------------------

export function buildBookingRows(input: BookingCreateRequest): {
  booking: BookingDbRow;
  serviceRows: BookingServiceDbRow[];
} {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const bookingRef = `NX-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

  const subtotal = round2(lineItemsSubtotal(input.services));
  const discount = round2(input.discountAmount ?? 0);
  const total = round2(subtotal - discount);
  const advance = round2(Math.round(total * 0.25));
  const customer = input.customer ?? null;

  // user_id is only set when the customer id is a uuid (auth.users key shape).
  const userId =
    customer?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customer.id)
      ? customer.id
      : null;

  const booking: BookingDbRow = {
    id,
    booking_ref: bookingRef,
    user_id: userId,
    customer,
    salon_id: input.salon.id,
    salon_snapshot: input.salon,
    stylist_snapshot: input.stylist ?? null,
    slot_date: input.date,
    slot_time: input.time,
    status: 'pending',
    subtotal,
    discount_amount: discount,
    total_amount: total,
    advance_amount: advance,
    currency: 'INR',
    payment_mode: 'advance_25',
    payment_status: 'pending',
    coupon_code: input.couponCode ?? null,
    notes: input.notes ?? null,
    metadata: { services: input.services },
    created_at: now,
    updated_at: now,
  };

  const serviceRows: BookingServiceDbRow[] = input.services.map((line, index) => ({
    booking_id: id,
    salon_id: input.salon.id,
    service_id: line.id,
    service_name: line.name,
    category: line.category ?? null,
    list_price: round2(line.price),
    unit_price: round2(line.unitPrice),
    duration_minutes: line.durationMinutes,
    position: index,
  }));

  return { booking, serviceRows };
}

/** Reconstruct the canonical Appointment JSON returned to the client. */
export function bookingToAppointment(input: BookingCreateRequest, booking: BookingDbRow): Appointment {
  const salon = input.salon;
  const stylistSnapshot = input.stylist ?? null;
  const stylist: Stylist | undefined = stylistSnapshot
    ? {
        id: stylistSnapshot.id,
        name: stylistSnapshot.name,
        role: stylistSnapshot.role ?? '',
        avatar: stylistSnapshot.avatar ?? '',
        rating: stylistSnapshot.rating ?? 0,
        experience: stylistSnapshot.experience ?? '',
        specialty: stylistSnapshot.specialty ?? [],
      }
    : undefined;

  const finalTotal = round2(booking.total_amount);
  return {
    id: booking.id,
    bookingRef: booking.booking_ref,
    salonId: salon.id,
    salonName: salon.name,
    salonImage: salon.image ?? '',
    salonAddress: salon.address ?? '',
    ...(salon.phone ? { salonPhone: salon.phone } : {}),
    ...(salon.mapsUrl ? { mapsUrl: salon.mapsUrl } : {}),
    ...(salon.latitude !== undefined ? { salonLatitude: salon.latitude } : {}),
    ...(salon.longitude !== undefined ? { salonLongitude: salon.longitude } : {}),
    services: toSalonServices(booking.metadata.services),
    ...(stylist ? { stylist } : {}),
    date: booking.slot_date,
    time: booking.slot_time,
    status: 'pending',
    totalPrice: finalTotal,
    advancePaid: round2(booking.advance_amount),
    remainingAmount: round2(Math.max(0, finalTotal - booking.advance_amount)),
    paymentMode: 'advance_25',
    paymentStatus: 'pending',
    ...(booking.discount_amount > 0 ? { discountApplied: booking.discount_amount } : {}),
    ...(booking.notes ? { notes: booking.notes } : {}),
    createdAt: booking.created_at,
    salonConfirmationStatus: 'pending_owner_approval',
  };
}

export async function createBooking(
  store: BookingStore,
  input: BookingCreateRequest
): Promise<{ appointment: Appointment | null; error?: string }> {
  const { booking, serviceRows } = buildBookingRows(input);

  const parent = await store.insertBooking(booking);
  if (!parent.ok) {
    return { appointment: null, error: `Booking creation failed: ${parent.error ?? 'unknown store error'}` };
  }

  // Compensate on child failure so a half-written booking can never survive.
  const children = await store.insertBookingServices(serviceRows);
  if (!children.ok) {
    const cleanup = await store.deleteBooking(booking.id);
    if (!cleanup.ok) {
      console.error(`[Nexora] Orphan booking ${booking.id} cleanup failed:`, cleanup.error);
    }
    return { appointment: null, error: `Booking line items failed: ${children.error ?? 'unknown store error'}` };
  }

  return { appointment: bookingToAppointment(input, booking) };
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
