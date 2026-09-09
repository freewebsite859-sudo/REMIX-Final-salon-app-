/**
 * Nexora booking CORE — the single, isomorphic implementation of how a
 * booking is validated, priced and materialised.
 *
 * Why this module exists
 * ----------------------
 * The exact same rules must hold in three places:
 *   1. `server/bookings.ts`      → POST /api/bookings (service-role Supabase)
 *   2. the browser demo store    → local demo mode (no live project configured)
 *   3. the checkout UI totals    → BookingModal / BookingSummaryModal
 *
 * When those three disagree by even one rupee the customer sees
 * "Advance Payment Incomplete" at checkout, because the server recomputes the
 * 25% advance and rejects a request whose `amount` does not match. Keeping the
 * money math in ONE pure module removes that entire class of failure.
 *
 * This file is pure TypeScript: no express, no Supabase, no DOM. It runs in
 * Node (server bundle), in the browser bundle and in unit tests.
 */

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
} from './bookingContract';
import type { Appointment, Stylist } from '../types';

// ---------------------------------------------------------------------------
// Isomorphic id helpers (Web Crypto in the browser, node:crypto global in Node)
// ---------------------------------------------------------------------------

function randomHex(bytes: number): string {
  const cryptoObj = (globalThis as { crypto?: Crypto }).crypto;
  if (cryptoObj?.getRandomValues) {
    const arr = new Uint8Array(bytes);
    cryptoObj.getRandomValues(arr);
    return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  let out = '';
  for (let i = 0; i < bytes; i++) {
    out += Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
  }
  return out;
}

/** UUID for the booking primary key (uuid v4 shape — accepted by Postgres). */
export function newBookingId(): string {
  const cryptoObj = (globalThis as { crypto?: Crypto }).crypto;
  if (typeof cryptoObj?.randomUUID === 'function') return cryptoObj.randomUUID();
  const h = randomHex(16).split('');
  h[12] = '4';
  h[16] = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  const s = h.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

/** Human-readable booking reference shown on the ticket (NX-XXXXXXXX). */
export function newBookingRef(): string {
  return `NX-${randomHex(4).toUpperCase()}`;
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

  const requestedDiscount = discountAmount === null ? 0 : round2(discountAmount);
  const totals = computeBookingTotals(parsedLines, requestedDiscount);
  if (requestedDiscount > totals.subtotal) {
    return { ok: false, fields: ['discountAmount cannot exceed the service subtotal'] };
  }
  const discount = totals.discountAmount;
  if (amount !== null && Math.abs(round2(amount) - totals.advanceAmount) > 0.0049) {
    return {
      ok: false,
      fields: [
        `amount must equal the 25% verified advance (₹${totals.advanceAmount.toFixed(2)}) of the recomputed total`,
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
  const id = newBookingId();
  const bookingRef = newBookingRef();

  const { subtotal, discountAmount: discount, total, advanceAmount: advance } =
    computeBookingTotals(input.services, input.discountAmount ?? 0);
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
// Money math — the ONE place the 25% advance is defined
// ---------------------------------------------------------------------------

/** Share of the final total collected online as a booking deposit. */
export const ADVANCE_PAYMENT_RATE = 0.25;

export interface BookingTotals {
  /** Σ unitPrice of the canonical line items. */
  subtotal: number;
  /** Coupon discount actually applied (never more than the subtotal). */
  discountAmount: number;
  /** subtotal − discountAmount. */
  total: number;
  /** 25% advance payable now (rounded to whole rupees). */
  advanceAmount: number;
  /** Balance payable at the salon. */
  remainingAmount: number;
  /** Σ durationMinutes of the line items. */
  durationMinutes: number;
  /** Number of valid line items. */
  serviceCount: number;
}

/**
 * Compute every checkout number from canonical line items.
 *
 * The UI, the demo store and the server all call this, so the amount shown on
 * the "Pay ₹X advance" button is byte-for-byte the amount the server expects.
 */
export function computeBookingTotals(
  lines: readonly BookingServiceLine[] | null | undefined,
  requestedDiscount: number = 0
): BookingTotals {
  const safeLines = Array.isArray(lines) ? lines : [];
  const subtotal = round2(lineItemsSubtotal(safeLines));
  const discountRaw = Number.isFinite(requestedDiscount) ? Math.max(0, requestedDiscount) : 0;
  const discountAmount = round2(Math.min(subtotal, discountRaw));
  const total = round2(subtotal - discountAmount);
  const advanceAmount = round2(Math.round(total * ADVANCE_PAYMENT_RATE));
  return {
    subtotal,
    discountAmount,
    total,
    advanceAmount,
    remainingAmount: round2(Math.max(0, total - advanceAmount)),
    durationMinutes: lineItemsDurationMinutes(safeLines),
    serviceCount: safeLines.length,
  };
}

/** Percentage-coupon helper shared by every checkout surface. */
export function couponDiscountAmount(subtotal: number, percent: number): number {
  if (!Number.isFinite(subtotal) || subtotal <= 0) return 0;
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  return Math.round((subtotal * Math.min(100, percent)) / 100);
}

