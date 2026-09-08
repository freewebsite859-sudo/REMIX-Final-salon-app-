/**
 * Nexora SalonOS Customer App — secure online booking payment backend.
 *
 * This is the trusted side of the booking flow. It:
 *
 *   GET  /config        returns payment readiness (never leaks secrets, never 500s)
 *   POST /order         validates the authenticated customer and draft, then
 *                       creates a Razorpay order and a server-owned
 *                       `pending_payment` booking draft
 *   POST /verify        verifies the Razorpay payment signature + capture status
 *                       server-side, then confirms the booking and creates the
 *                       `booking_services` rows
 *   POST /webhook/razorpay  provider reconciliation for payments that finish
 *                       after the browser is closed
 *
 * Every mutation runs through a service-role Supabase client. The customer JWT
 * is only used to authenticate the caller; no browser code ever touches the
 * service key, Razorpay key secret, signature secret, or webhook secret.
 */
import crypto from 'crypto';
import express, { Request, Response, Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from './notifications';
import { normalizeBooking } from '../src/lib/bookingService';

const BOOKINGS_TABLE = 'bookings';
const BOOKING_SERVICES_TABLE = 'booking_services';
const SALONS_TABLE = 'salons';
const SALON_SERVICES_TABLE = 'salon_services';
const SALON_STAFF_TABLE = 'salon_staff';
const STAFF_SLOTS_TABLE = 'staff_slots';
const OFFERS_TABLE = 'offers';

const DRAFT_VALID_MS = 15 * 60 * 1000;
const CURRENCY = 'INR';

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function json(res: Response, status: number, body: Record<string, unknown>): void {
  res.status(status).json(body);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function asText(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function displayTime(value: unknown): string {
  const raw = asText(value);
  if (!raw) return '';
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return raw;
  let hour = Number(match[1]);
  const minute = match[2];
  const suffix = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${suffix}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function safeLog(prefix: string, data: unknown): void {
  // Logs shallow, non-secret diagnostics. Never log env values or raw
  // authorization headers.
  const safe = asRecord(data) || {};
  console.error(prefix, {
    status: safe.status,
    code: safe.code,
    description: safe.description,
    message: safe.message,
  });
}

function makeBookingRef(existing?: string): string {
  const value = asString(existing);
  if (/^NX-JPR-\d{5,}$/i.test(value)) return value.toUpperCase();
  const suffix = Math.floor(10000 + Math.random() * 90000);
  return `NX-JPR-${suffix}`;
}

// ---------------------------------------------------------------------------
// Auth / provider
// ---------------------------------------------------------------------------

async function authenticate(
  req: Request,
  client: SupabaseClient
): Promise<{ user: { id: string } | null; error?: string }> {
  const header = asString(req.headers.authorization);
  if (!header.startsWith('Bearer ')) {
    return { user: null, error: 'Missing Supabase access token.' };
  }
  const token = header.slice('Bearer '.length).trim();
  if (!token) return { user: null, error: 'Missing Supabase access token.' };

  // Verify the JWT against GoTrue. `getUser` does not trust the client; it
  // validates the token with the auth service and returns the active user.
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    return { user: null, error: error?.message || 'Unauthenticated payment request.' };
  }
  return { user: { id: data.user.id } };
}

function hasProviderCredentials(env: NodeJS.ProcessEnv): boolean {
  return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
}

function hasServiceCredentials(env: NodeJS.ProcessEnv): boolean {
  return Boolean((env.SUPABASE_URL || env.VITE_SUPABASE_URL) && env.SUPABASE_SERVICE_ROLE_KEY);
}

async function razorpayRequest(
  method: 'GET' | 'POST',
  path: string,
  body: Record<string, unknown> | undefined,
  env: NodeJS.ProcessEnv
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> | null; errorMessage?: string }> {
  const key = env.RAZORPAY_KEY_ID?.trim();
  const secret = env.RAZORPAY_KEY_SECRET?.trim();
  if (!key || !secret) {
    return { ok: false, status: 503, data: null, errorMessage: 'Razorpay provider is not configured.' };
  }
  const auth = 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64');
  try {
    const res = await fetch(`https://api.razorpay.com/v1${path}`, {
      method,
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data: Record<string, unknown> | null = null;
    try {
      data = asRecord(JSON.parse(text)) || null;
    } catch {
      data = null;
    }
    if (!res.ok) {
      safeLog('[Nexora] Razorpay provider request failed:', {
        status: res.status,
        code: asRecord(data)?.error && asRecord(asRecord(data)?.error)?.code,
        description: asRecord(data)?.error && asRecord(asRecord(data)?.error)?.description,
        message: asRecord(data)?.error && asRecord(asRecord(data)?.error)?.reason,
      });
      return {
        ok: false,
        status: res.status,
        data,
        errorMessage:
          asRecord(data)?.error && asRecord(asRecord(data)?.error)?.description
            ? String(asRecord(asRecord(data)?.error)?.description)
            : `Razorpay provider returned ${res.status}.`,
      };
    }
    return { ok: true, status: res.status, data };
  } catch (err) {
    safeLog('[Nexora] Razorpay provider network failure:', { message: err instanceof Error ? err.message : String(err) });
    return { ok: false, status: 503, data: null, errorMessage: 'Payment provider is unreachable.' };
  }
}

// ---------------------------------------------------------------------------
// Slot / booking validation
// ---------------------------------------------------------------------------

interface SlotRow {
  id: string;
  staffId?: string;
  date?: string;
  time?: string;
}

async function findAvailableSlots(
  client: SupabaseClient,
  input: { salonId: string; staffId?: string | null; date: string; time: string }
): Promise<{ slots: SlotRow[]; error?: string }> {
  try {
    const { data, error } = await client
      .from(STAFF_SLOTS_TABLE)
      .select('*')
      .eq('salon_id', input.salonId);
    if (error) return { slots: [], error: error.message };
    const rows = (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
    const slots = rows
      .map((row) => {
        const id = asString(row.id);
        const staffId = asString(row.staff_id ?? row.staffId) || undefined;
        const date = asString(row.date ?? row.slot_date);
        const time = displayTime(row.start_time ?? row.time ?? row.slot_time);
        const isAvailable =
          row.is_available === true ||
          row.isAvailable === true ||
          row.available === true ||
          Number(row.is_available ?? row.isAvailable ?? row.available) === 1;
        const status = asString(row.status);
        const bookingId = asString(row.booking_id ?? row.bookingId);
        return { id, staffId, date, time, isAvailable, status, bookingId };
      })
      .filter((slot) => {
        if (!slot.id || !slot.date || !slot.time) return false;
        if (slot.date !== input.date || slot.time !== input.time) return false;
        if (input.staffId && slot.staffId !== input.staffId) return false;
        if (!slot.isAvailable) return false;
        if (slot.status && slot.status.toLowerCase() === 'unavailable') return false;
        if (slot.bookingId) return false;
        return true;
      })
      .map((slot) => ({ id: slot.id, staffId: slot.staffId, date: slot.date, time: slot.time }));
    return { slots };
  } catch (err) {
    return { slots: [], error: err instanceof Error ? err.message : String(err) };
  }
}

async function validateCatalogAndSlot(
  client: SupabaseClient,
  input: {
    salonId: string;
    serviceIds: string[];
    staffId?: string | null;
    date: string;
    time: string;
  }
): Promise<{
  ok: boolean;
  error?: string;
  services?: Record<string, unknown>[];
  resolvedStaffId?: string | null;
}> {
  const { data: salon, error: salonErr } = await client
    .from(SALONS_TABLE)
    .select('id,is_active')
    .eq('id', input.salonId)
    .maybeSingle();
  if (salonErr || !salon) {
    return { ok: false, error: salonErr?.message || 'Salon is not available for booking.' };
  }
  if (salon.is_active === false) {
    return { ok: false, error: 'This salon is currently inactive and cannot accept bookings.' };
  }

  if (!input.serviceIds.length) {
    return { ok: false, error: 'At least one salon service is required.' };
  }
  const { data: serviceRows, error: serviceErr } = await client
    .from(SALON_SERVICES_TABLE)
    .select('*')
    .in('id', input.serviceIds)
    .eq('salon_id', input.salonId);
  if (serviceErr) {
    return { ok: false, error: `Selected services could not be verified: ${serviceErr.message}` };
  }
  const services = Array.isArray(serviceRows) ? serviceRows.filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null) : [];
  const activeIds = new Set(services.filter((s) => s.is_active !== false).map((s) => asString(s.id)));
  const missing = input.serviceIds.filter((id) => !activeIds.has(id));
  if (missing.length) {
    return { ok: false, error: 'One or more selected services are unavailable at this salon.' };
  }

  let resolvedStaffId = input.staffId || null;
  if (input.staffId) {
    const { data: staff, error: staffErr } = await client
      .from(SALON_STAFF_TABLE)
      .select('id,is_active')
      .eq('id', input.staffId)
      .eq('salon_id', input.salonId)
      .maybeSingle();
    if (staffErr || !staff) {
      return { ok: false, error: staffErr?.message || 'Selected staff member is not available at this salon.' };
    }
    if (staff.is_active === false) {
      return { ok: false, error: 'Selected staff member is currently inactive.' };
    }
  }

  const slotResult = await findAvailableSlots(client, {
    salonId: input.salonId,
    staffId: input.staffId || null,
    date: input.date,
    time: input.time,
  });
  if (slotResult.error) {
    return { ok: false, error: `Slot availability could not be verified: ${slotResult.error}` };
  }
  if (slotResult.slots.length === 0) {
    return { ok: false, error: 'The selected slot is no longer available.' };
  }
  // For "Any Expert" pick an available staff member so the confirmed booking can
  // reference the actual holding slot.
  if (!resolvedStaffId && slotResult.slots[0]?.staffId) {
    resolvedStaffId = slotResult.slots[0].staffId;
  }

  return { ok: true, services, resolvedStaffId };
}

function computeAmounts(
  services: Record<string, unknown>[],
  couponCode: string | undefined,
  offers: Record<string, unknown>[]
): { total: number; advance: number; remaining: number; appliedDiscount: number } {
  const total = services.reduce(
    (sum, s) => sum + (asNumber(s.discount_price ?? s.discountPrice) ?? asNumber(s.price) ?? 0),
    0
  );
  let appliedDiscount = 0;
  if (couponCode && offers.length) {
    const offer = offers[0];
    const percent = asNumber(offer.discount_percent ?? offer.discount_percentage);
    const amountOff = asNumber(offer.discount_amount);
    if (percent && percent > 0) {
      appliedDiscount = Math.round((total * percent) / 100);
    } else if (amountOff && amountOff > 0) {
      appliedDiscount = Math.min(amountOff, total);
    }
  }
  const payable = Math.max(0, total - appliedDiscount);
  const advance = Math.round(payable * 0.25);
  return { total, advance, remaining: Math.max(0, payable - advance), appliedDiscount };
}

async function validateCoupon(
  client: SupabaseClient,
  code: string | undefined,
  salonId: string
): Promise<{ ok: boolean; error?: string; offers?: Record<string, unknown>[] }> {
  if (!code) return { ok: true, offers: [] };
  const now = Date.now();
  const { data, error } = await client.from(OFFERS_TABLE).select('*').eq('code', code).eq('salon_id', salonId);
  if (error) return { ok: false, error: `Offer code could not be verified: ${error.message}` };
  const rows = (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
  const active = rows.filter((row) => {
    if (row.is_active === false || row.active === false) return false;
    const end = asString(row.ends_at ?? row.valid_until ?? row.end_date);
    if (end && Number.isFinite(new Date(end).getTime()) && new Date(end).getTime() < now) return false;
    return true;
  });
  if (!active.length) return { ok: false, error: 'Offer code is not active for this salon.' };
  return { ok: true, offers: active };
}

async function findConflict(
  client: SupabaseClient,
  userId: string,
  input: { salonId: string; staffId?: string | null; date: string; time: string }
): Promise<{ error?: string }> {
  const { data, error } = await client
    .from(BOOKINGS_TABLE)
    .select('id,status,staff_id,stylist_id,user_id,customer_id')
    .eq('salon_id', input.salonId)
    .eq('date', input.date)
    .eq('time', input.time);
  if (error) return { error: `Booking conflict check failed: ${error.message}` };
  const rows = (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
  const duplicate = rows.find((row) => {
    const owner = asString(row.user_id) === userId || asString(row.customer_id) === userId;
    const status = asString(row.status).toLowerCase();
    if (!owner) return false;
    if (['cancelled', 'no_show', 'completed'].includes(status)) return false;
    if (status === 'pending_payment' || status === 'pending') return false;
    const rowStaff = asString(row.staff_id ?? row.stylist_id);
    return !input.staffId || rowStaff === input.staffId;
  });
  return duplicate ? { error: 'You already have a confirmed booking for this slot. Select another date or time.' } : {};
}

async function upsertDraftBooking(
  client: SupabaseClient,
  input: {
    userId: string;
    salonId: string;
    staffId?: string | null;
    date: string;
    time: string;
    services: Record<string, unknown>[];
    couponCode?: string;
    notes?: string;
    draftBookingRef?: string;
    total: number;
    advance: number;
    remaining: number;
    appliedDiscount: number;
  }
): Promise<{ ok: boolean; bookingId?: string; bookingRef?: string; error?: string }> {
  const now = new Date().toISOString();
  const validUntil = new Date(Date.now() + DRAFT_VALID_MS).toISOString();
  const serviceIds = input.services.map((s) => asString(s.id)).filter(Boolean);
  const metadata = {
    serviceIds,
    staffId: input.staffId || null,
    date: input.date,
    time: input.time,
    total: input.total,
    advance: input.advance,
    currency: CURRENCY,
  };

  // Reuse an existing owned pending draft. This is what lets a failed or left
  // open checkout retry safely (including across a page reload) without
  // creating a duplicate booking or duplicate booking reference.
  const { data: ownedRows, error: existingError } = await client
    .from(BOOKINGS_TABLE)
    .select('*')
    .or(`user_id.eq.${input.userId},customer_id.eq.${input.userId}`)
    .order('updated_at', { ascending: false })
    .limit(10);
  if (existingError) return { ok: false, error: `Draft booking lookup failed: ${existingError.message}` };
  const owned = (Array.isArray(ownedRows) ? ownedRows : []) as Array<Record<string, unknown>>;
  const pendingRows = owned.filter((row) => ['pending_payment', 'pending'].includes(asString(row.status).toLowerCase()));
  const existing =
    (input.draftBookingRef
      ? pendingRows.find(
          (row) =>
            asString(row.booking_ref) === input.draftBookingRef ||
            asString(row.ref_code) === input.draftBookingRef
        )
      : undefined) ||
    pendingRows[0] ||
    null;
  const ref = existing
    ? asString(existing.booking_ref ?? existing.ref_code) || makeBookingRef(input.draftBookingRef)
    : makeBookingRef(input.draftBookingRef);

  // Only reuse an existing Razorpay order when the owned pending draft matches
  // the same catalogue/slot/amounts and the payment window is still valid. That
  // prevents duplicate orders and duplicate bookings on a safe retry while a
  // stale or changed selection gets a fresh order.
  const existingRow = existing || null;
  const existingOrderId = existingRow ? getOrderIdFromBooking(existingRow) : '';
  const existingMetadata = existingRow ? asRecord(existingRow.request_metadata) : null;
  const existingServiceIds = Array.isArray(existingMetadata?.serviceIds)
    ? existingMetadata.serviceIds.map((v) => asString(v)).filter(Boolean)
    : [];
  const normalizedCurrentServices = [...serviceIds].sort().join('|');
  const normalizedExistingServices = [...existingServiceIds].sort().join('|');
  const existingValidUntil = existingRow ? asString(existingRow.payment_valid_until) : '';
  const existingValid =
    existingRow && existingValidUntil && new Date(existingValidUntil).getTime() > Date.now();
  const detailsMatch =
    Boolean(existingRow) &&
    asString(existingRow.salon_id) === input.salonId &&
    asString(existingRow.date ?? existingRow.booking_date) === input.date &&
    asString(existingRow.time ?? existingRow.slot_time) === input.time &&
    asString(existingRow.staff_id ?? existingRow.stylist_id) === (input.staffId || '') &&
    normalizedExistingServices === normalizedCurrentServices &&
    (asNumber(existingRow.total_price ?? existingRow.amount) ?? -1) === input.total &&
    (asNumber(existingRow.advance_paid ?? existingRow.advance_amount) ?? -1) === input.advance;
  // Existing drafts without a stored window are treated as reusable if they
  // already contain a provider order; newly migrated rows without an order go
  // through the normal fresh-order path.
  const canReuseOrder =
    Boolean(existingRow && existingOrderId && detailsMatch && (existingValid || !existingValidUntil));
  const effectiveOrderId = canReuseOrder ? existingOrderId : null;
  const effectiveValidUntil = canReuseOrder ? existingValidUntil : validUntil;

  const payload = {
    user_id: input.userId,
    customer_id: input.userId,
    salon_id: input.salonId,
    staff_id: input.staffId || null,
    stylist_id: input.staffId || null,
    date: input.date,
    booking_date: input.date,
    time: input.time,
    slot_time: input.time,
    status: 'pending_payment',
    booking_status: 'pending_payment',
    total_price: input.total,
    amount: input.total,
    advance_paid: input.advance,
    advance_amount: input.advance,
    remaining_amount: input.remaining,
    payment_status: 'pending',
    payment_mode: 'advance_25',
    discount_applied: input.appliedDiscount || null,
    booking_ref: ref,
    ref_code: ref,
    coupon_code: input.couponCode || null,
    notes: input.notes || null,
    request_metadata: metadata,
    payment_valid_until: effectiveValidUntil,
    razorpay_order_id: effectiveOrderId,
    razorpay_payment_id: null,
    razorpay_signature: null,
    updated_at: now,
  };

  if (existing) {
    const id = asString(existing.id);
    const { error: updateErr } = await client
      .from(BOOKINGS_TABLE)
      .update(payload)
      .eq('id', id);
    if (updateErr) return { ok: false, error: `Draft booking could not be updated: ${updateErr.message}` };
    return { ok: true, bookingId: id, bookingRef: ref };
  }

  const { data: created, error: insertErr } = await client
    .from(BOOKINGS_TABLE)
    .insert({ ...payload, created_at: now })
    .select('id,booking_ref')
    .maybeSingle();
  if (insertErr || !created) {
    return { ok: false, error: insertErr?.message || 'Draft booking could not be created.' };
  }
  return {
    ok: true,
    bookingId: asString((created as Record<string, unknown>).id),
    bookingRef: asText((created as Record<string, unknown>).booking_ref, ref),
  };
}

async function fetchDraftById(
  client: SupabaseClient,
  userId: string,
  bookingId?: string,
  draftBookingRef?: string
): Promise<Record<string, unknown> | null> {
  if (bookingId) {
    const { data, error } = await client
      .from(BOOKINGS_TABLE)
      .select('*')
      .eq('id', bookingId)
      .maybeSingle();
    if (!error && data && (asString((data as Record<string, unknown>).user_id) === userId || asString((data as Record<string, unknown>).customer_id) === userId)) {
      return data as Record<string, unknown>;
    }
  }
  if (draftBookingRef) {
    const { data } = await client
      .from(BOOKINGS_TABLE)
      .select('*')
      .or(`booking_ref.eq.${draftBookingRef},ref_code.eq.${draftBookingRef}`)
      .maybeSingle();
    if (
      data &&
      (asString((data as Record<string, unknown>).user_id) === userId ||
        asString((data as Record<string, unknown>).customer_id) === userId)
    ) {
      return data as Record<string, unknown>;
    }
  }
  return null;
}

function getOrderIdFromBooking(row: Record<string, unknown>): string {
  return asString(row.razorpay_order_id ?? row.order_id);
}

/**
 * Attach every catalog service for a confirmed booking. Idempotent: services
 * already present are skipped, and a partial insert is repaired on retry.
 */
async function ensureBookingServices(
  client: SupabaseClient,
  draftRow: Record<string, unknown>,
  timestamp: string
): Promise<{ ok: boolean; error?: string; inserted: number }> {
  const bookingId = asString(draftRow.id);
  const metadata = asRecord(draftRow.request_metadata);
  const serviceIds = Array.isArray(metadata?.serviceIds)
    ? metadata.serviceIds.map((v) => asString(v)).filter(Boolean)
    : [];
  if (!bookingId || serviceIds.length === 0) {
    return { ok: true, inserted: 0 };
  }

  const { data: existingRows, error: existingErr } = await client
    .from(BOOKING_SERVICES_TABLE)
    .select('service_id')
    .eq('booking_id', bookingId);
  if (existingErr) {
    return { ok: false, error: `Existing booking services could not be read: ${existingErr.message}`, inserted: 0 };
  }
  const existingIds = new Set(
    (Array.isArray(existingRows) ? existingRows : []).map((row) => asString((row as Record<string, unknown>).service_id))
  );
  const missingIds = serviceIds.filter((id) => !existingIds.has(id));
  if (missingIds.length === 0) {
    return { ok: true, inserted: 0 };
  }

  const { data: serviceRows, error: serviceErr } = await client
    .from(SALON_SERVICES_TABLE)
    .select('*')
    .in('id', missingIds)
    .eq('salon_id', asString(draftRow.salon_id));
  if (serviceErr) {
    return { ok: false, error: `Booking services could not be loaded: ${serviceErr.message}`, inserted: 0 };
  }
  const services = Array.isArray(serviceRows) ? serviceRows : [];
  const payloads = services.map((row) => ({
    booking_id: bookingId,
    service_id: asString((row as Record<string, unknown>).id),
    service_name: asString((row as Record<string, unknown>).name),
    category: asString((row as Record<string, unknown>).category),
    duration_minutes:
      asNumber((row as Record<string, unknown>).duration_minutes) ??
      asNumber((row as Record<string, unknown>).duration) ??
      30,
    duration:
      asNumber((row as Record<string, unknown>).duration) ??
      asNumber((row as Record<string, unknown>).duration_minutes) ??
      30,
    price: asNumber((row as Record<string, unknown>).price) ?? 0,
    discount_price: asNumber((row as Record<string, unknown>).discount_price) ?? null,
    amount:
      asNumber((row as Record<string, unknown>).discount_price) ??
      asNumber((row as Record<string, unknown>).price) ??
      0,
    created_at: timestamp,
  }));

  if (payloads.length === 0) {
    return { ok: false, error: 'Booking services could not be attached because catalogue rows were not found.', inserted: 0 };
  }
  const { error: insertErr } = await client.from(BOOKING_SERVICES_TABLE).insert(payloads);
  if (insertErr) {
    // The unique (booking_id, service_id) index makes concurrent retries safe:
    // a duplicate-key race means the row already exists, so treat it as done.
    if (insertErr.message?.toLowerCase().includes('duplicate key') || insertErr.code === '23505') {
      return { ok: true, inserted: 0 };
    }
    return { ok: false, error: `Booking services could not be attached: ${insertErr.message}`, inserted: 0 };
  }
  return { ok: true, inserted: payloads.length };
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export function readPaymentConfig(
  env: NodeJS.ProcessEnv = process.env
): { configured: boolean; provider: string; keyId?: string; currency: string; missing: string[] } {
  const missing: string[] = [];
  if (!env.RAZORPAY_KEY_ID) missing.push('RAZORPAY_KEY_ID');
  if (!env.RAZORPAY_KEY_SECRET) missing.push('RAZORPAY_KEY_SECRET');
  if (!env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  return {
    configured: missing.length === 0,
    provider: 'razorpay',
    keyId: env.RAZORPAY_KEY_ID?.trim(),
    currency: env.RAZORPAY_CURRENCY || CURRENCY,
    missing,
  };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export function createPaymentsRouter(env: NodeJS.ProcessEnv = process.env): Router {
  const router = Router();

  router.get('/config', (_req: Request, res: Response) => {
    try {
      const config = readPaymentConfig(env);
      const endpointConfigured = hasServiceCredentials(env) && hasProviderCredentials(env);
      if (!endpointConfigured) {
        json(res, 200, {
          state: 'payment_service_unavailable',
          configured: false,
          provider: config.provider,
          currency: config.currency,
          missing: config.missing,
          message: 'Secure payment service is not configured. Booking is not available until server-side Razorpay and Supabase service-role configuration is added.',
        });
        return;
      }
      json(res, 200, {
        state: 'payment_ready',
        configured: true,
        provider: config.provider,
        keyId: config.keyId,
        currency: config.currency,
      });
    } catch (err) {
      // The config endpoint must never be an HTTP 500 for the caller. Keep the
      // client in a clean "service unavailable" state and log the real cause.
      safeLog('[Nexora] Payment config endpoint failed:', { message: err instanceof Error ? err.message : String(err) });
      json(res, 200, {
        state: 'payment_service_unavailable',
        configured: false,
        provider: 'razorpay',
        currency: CURRENCY,
        message: 'Secure payment service is not configured. Payment configuration is missing on the backend.',
      });
    }
  });

  router.post('/order', async (req: Request, res: Response) => {
    try {
      const config = readPaymentConfig(env);
      if (!config.configured || !hasServiceCredentials(env)) {
        json(res, 200, {
          state: 'payment_service_unavailable',
          message: 'Secure payment service is not configured. Check backend Razorpay and Supabase service-role settings.',
        });
        return;
      }

      const serviceClient = createServiceClient(env)?.client;
      if (!serviceClient) {
        json(res, 200, {
          state: 'payment_service_unavailable',
          message: 'Secure Supabase backend is not configured.',
        });
        return;
      }

      const auth = await authenticate(req, serviceClient);
      if (!auth.user) {
        json(res, 401, { state: 'payment_failed', message: auth.error || 'Authentication required.' });
        return;
      }
      const userId = auth.user.id;
      const body = asRecord(req.body) || {} as Record<string, unknown>;

      const salonId = asString(body.salonId);
      const serviceIds = Array.isArray(body.serviceIds) ? body.serviceIds.map((v) => asString(v)).filter(Boolean) : [];
      const staffId = asString(body.stylistId) || null;
      const date = asString(body.date);
      const time = asString(body.time);
      const couponCode = asString(body.couponCode) || undefined;
      const notes = asString(body.notes) || undefined;
      const draftBookingRef = asString(body.draftBookingRef) || undefined;

      if (!salonId || serviceIds.length === 0 || !date || !time) {
        json(res, 400, { state: 'payment_failed', message: 'Incomplete booking request.' });
        return;
      }

      const validation = await validateCatalogAndSlot(serviceClient, {
        salonId,
        serviceIds,
        staffId,
        date,
        time,
      });
      if (!validation.ok) {
        json(res, 400, { state: 'payment_failed', message: validation.error || 'Booking draft is invalid.' });
        return;
      }

      const conflict = await findConflict(serviceClient, userId, {
        salonId,
        staffId: validation.resolvedStaffId || staffId,
        date,
        time,
      });
      if (conflict.error) {
        json(res, 409, { state: 'payment_failed', message: conflict.error });
        return;
      }

      const coupon = await validateCoupon(serviceClient, couponCode, salonId);
      if (!coupon.ok) {
        json(res, 400, { state: 'payment_failed', message: coupon.error || 'Offer code is invalid.' });
        return;
      }

      const amounts = computeAmounts(validation.services || [], couponCode, coupon.offers || []);
      const reportedAmount = asNumber(body.amount);
      if (reportedAmount !== null && Math.abs(reportedAmount - amounts.advance) > 1) {
        json(res, 400, {
          state: 'payment_failed',
          message: 'Booking amount does not match the verified catalogue price.',
        });
        return;
      }

      const draft = await upsertDraftBooking(serviceClient, {
        userId,
        salonId,
        staffId: validation.resolvedStaffId || staffId,
        date,
        time,
        services: validation.services || [],
        couponCode,
        notes,
        draftBookingRef,
        total: amounts.total,
        advance: amounts.advance,
        remaining: amounts.remaining,
        appliedDiscount: amounts.appliedDiscount,
      });
      if (!draft.ok || !draft.bookingId) {
        json(res, 400, { state: 'payment_failed', message: draft.error || 'Booking draft could not be created.' });
        return;
      }

      // Idempotency: reuse the existing Razorpay order if one was already
      // created for this draft and is not consumed.
      const draftRow = await fetchDraftById(serviceClient, userId, draft.bookingId, draft.bookingRef);
      const existingOrderId = draftRow ? getOrderIdFromBooking(draftRow) : '';
      let orderId = existingOrderId;
      if (!orderId) {
        const orderRes = await razorpayRequest(
          'POST',
          '/orders',
          {
            amount: amounts.advance * 100,
            currency: env.RAZORPAY_CURRENCY || CURRENCY,
            receipt: draft.bookingRef,
            notes: { booking_id: draft.bookingId, user_id: userId },
            payment_capture: 1,
          },
          env
        );
        if (!orderRes.ok || !orderRes.data) {
          json(res, 503, {
            state: 'payment_failed',
            message: orderRes.errorMessage || 'Payment order could not be created.',
          });
          return;
        }
        orderId = asString(orderRes.data.id);
        const { error: updateErr } = await serviceClient
          .from(BOOKINGS_TABLE)
          .update({ razorpay_order_id: orderId, updated_at: new Date().toISOString() })
          .eq('id', draft.bookingId);
        if (updateErr) {
          json(res, 503, {
            state: 'payment_failed',
            message: 'Payment order was created but the booking draft could not store it.',
          });
          return;
        }
      }

      json(res, 200, {
        state: 'payment_ready',
        provider: 'razorpay',
        keyId: env.RAZORPAY_KEY_ID,
        orderId,
        amountPaise: amounts.advance * 100,
        amount: amounts.advance,
        currency: env.RAZORPAY_CURRENCY || CURRENCY,
        bookingId: draft.bookingId,
        draftBookingRef: draft.bookingRef,
        totalAmount: amounts.total,
        remainingAmount: amounts.remaining,
        discountApplied: amounts.appliedDiscount,
        validUntil: new Date(Date.now() + DRAFT_VALID_MS).toISOString(),
      });
    } catch (err) {
      safeLog('[Nexora] Payment order endpoint failed:', { message: err instanceof Error ? err.message : String(err) });
      json(res, 500, { state: 'payment_failed', message: 'Payment order could not be created. Please retry.' });
    }
  });

  router.post('/verify', async (req: Request, res: Response) => {
    try {
      const config = readPaymentConfig(env);
      if (!config.configured || !hasServiceCredentials(env)) {
        json(res, 200, {
          state: 'payment_service_unavailable',
          message: 'Secure payment service is not configured. Booking was not created.',
        });
        return;
      }
      const serviceClient = createServiceClient(env)?.client;
      if (!serviceClient) {
        json(res, 200, { state: 'payment_service_unavailable', message: 'Secure Supabase backend is not configured.' });
        return;
      }
      const auth = await authenticate(req, serviceClient);
      if (!auth.user) {
        json(res, 401, { state: 'payment_failed', message: auth.error || 'Authentication required.' });
        return;
      }
      const userId = auth.user.id;
      const body = asRecord(req.body) || {} as Record<string, unknown>;
      const paymentId = asString(body.razorpayPaymentId);
      const orderId = asString(body.razorpayOrderId);
      const signature = asString(body.razorpaySignature);
      const bookingId = asString(body.bookingId) || undefined;
      const draftBookingRef = asString(body.draftBookingRef) || undefined;

      if (!paymentId || !orderId || !signature) {
        json(res, 400, { state: 'payment_failed', message: 'Payment verification response is incomplete.' });
        return;
      }

      // Server-side HMAC signature check. The client never knows the key secret.
      const expectedSignature = crypto
        .createHmac('sha256', env.RAZORPAY_KEY_SECRET!)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');
      if (crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature)) === false) {
        json(res, 400, { state: 'payment_failed', message: 'Payment signature verification failed. No appointment was created.' });
        return;
      }

      // Also ask Razorpay for the authoritative payment status/amount.
      const payRes = await razorpayRequest('GET', `/payments/${encodeURIComponent(paymentId)}`, undefined, env);
      if (!payRes.ok || !payRes.data) {
        json(res, 502, {
          state: 'payment_failed',
          message: 'Payment could not be verified with the provider. No appointment was created.',
        });
        return;
      }
      const providerStatus = asString(payRes.data.status);
      if (!['captured', 'authorized'].includes(providerStatus)) {
        json(res, 400, {
          state: 'payment_failed',
          message: `Payment is not captured (${providerStatus}). No appointment was created.`,
        });
        return;
      }
      if (asString(payRes.data.order_id) !== orderId) {
        json(res, 400, { state: 'payment_failed', message: 'Payment order mismatch. No appointment was created.' });
        return;
      }

      const draftRow = await fetchDraftById(serviceClient, userId, bookingId, draftBookingRef);
      if (!draftRow) {
        json(res, 404, { state: 'payment_failed', message: 'Booking draft was not found.' });
        return;
      }
      const draftId = asString(draftRow.id);
      const draftOrderId = getOrderIdFromBooking(draftRow);
      if (draftOrderId && draftOrderId !== orderId) {
        json(res, 400, { state: 'payment_failed', message: 'Payment order does not match the booking draft.' });
        return;
      }
      const currentStatus = asString(draftRow.status).toLowerCase();
      if (['confirmed', 'in_progress', 'completed'].includes(currentStatus)) {
        // Idempotent: return the already-confirmed booking instead of creating
        // a duplicate, but first repair any missing booking_services rows from
        // a partial earlier confirmation.
        const fresh = await fetchCustomerBookingAppointment(serviceClient, userId, draftId);
        if (fresh) {
          const ensure = await ensureBookingServices(serviceClient, draftRow, new Date().toISOString());
          if (!ensure.ok) {
            json(res, 500, {
              state: 'payment_failed',
              message: `Payment was already verified but booking services could not be attached: ${ensure.error || 'unknown error'}. Please contact support.`,
            });
            return;
          }
          json(res, 200, { state: 'payment_successful', appointment: fresh });
          return;
        }
      }
      if (currentStatus === 'canceled' || currentStatus === 'cancelled') {
        json(res, 400, { state: 'payment_failed', message: 'This booking draft was cancelled.' });
        return;
      }

      const expectedAmount = asNumber(draftRow.advance_paid ?? draftRow.advance_amount) ?? 0;
      const paidAmount = asNumber(payRes.data.amount);
      if (paidAmount === null || expectedAmount <= 0 || paidAmount !== expectedAmount * 100) {
        json(res, 400, { state: 'payment_failed', message: 'Paid amount does not match the verified booking amount.' });
        return;
      }

      const now = new Date().toISOString();
      const { error: updateErr } = await serviceClient
        .from(BOOKINGS_TABLE)
        .update({
          status: 'confirmed',
          booking_status: 'confirmed',
          payment_status: 'paid',
          payment_verified_at: now,
          paid_at: now,
          confirmed_at: now,
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature,
          payment_method_used: asString(payRes.data.method) || 'upi',
          payment_mode: 'advance_25',
          updated_at: now,
        })
        .eq('id', draftId);
      if (updateErr) {
        json(res, 500, {
          state: 'payment_failed',
          message: 'Verified payment could not be recorded. No appointment was confirmed.',
        });
        return;
      }

      const servicesAttached = await ensureBookingServices(serviceClient, draftRow, now);
      if (!servicesAttached.ok) {
        safeLog('[Nexora] booking_services insert failed after verified payment:', { message: servicesAttached.error });
        json(res, 500, {
          state: 'payment_failed',
          message: 'Payment was verified but booking services could not be attached. Please contact support.',
        });
        return;
      }

      const appointment = await fetchCustomerBookingAppointment(serviceClient, userId, draftId);
      json(res, 200, {
        state: 'payment_successful',
        appointment: appointment || undefined,
        draftBookingRef: asString(draftRow.booking_ref),
      });
    } catch (err) {
      safeLog('[Nexora] Payment verify endpoint failed:', { message: err instanceof Error ? err.message : String(err) });
      json(res, 500, { state: 'payment_failed', message: 'Payment verification failed. Please retry.' });
    }
  });

  return router;
}

/**
 * Razorpay webhook handler. Mounted BEFORE the global JSON parser so the raw
 * body can be HMAC-verified. Only `payment.captured` finalizes a booking; a
 * failed/cancelled event never creates an appointment.
 */
export async function paymentsWebhookHandler(
  req: Request,
  res: Response,
  env: NodeJS.ProcessEnv = process.env
): Promise<void> {
  try {
    const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      json(res, 503, { state: 'payment_service_unavailable', message: 'Payment webhook is not configured.' });
      return;
    }
    const header = asString(req.headers['x-razorpay-signature']);
    if (!header) {
      json(res, 401, { state: 'payment_failed', message: 'Missing Razorpay webhook signature.' });
      return;
    }
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
    const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    try {
      if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(header)) === false) {
        json(res, 401, { state: 'payment_failed', message: 'Invalid Razorpay webhook signature.' });
        return;
      }
    } catch {
      json(res, 401, { state: 'payment_failed', message: 'Invalid Razorpay webhook signature.' });
      return;
    }

    const parsed = asRecord(JSON.parse(String(rawBody))) || (asRecord(req.body) as Record<string, unknown>);
    const event = asString(parsed.event);
    const payload = asRecord(parsed.payload) || {};
    const entity = asRecord(payload.payment) || asRecord(payload.order) || {};
    const paymentId = asString(entity.id);
    const orderId = asString(entity.order_id);
    const status = asString(entity.status);

    if (!event || !orderId) {
      json(res, 200, { ok: true });
      return;
    }
    const serviceClient = createServiceClient(env)?.client;
    if (!serviceClient) {
      json(res, 503, { state: 'payment_service_unavailable', message: 'Secure Supabase backend is not configured.' });
      return;
    }

    const { data: rows, error } = await serviceClient
      .from(BOOKINGS_TABLE)
      .select('*')
      .or(`razorpay_order_id.eq.${orderId},order_id.eq.${orderId}`)
      .limit(10);
    const draftRow = (Array.isArray(rows) ? rows : []).find(
      (r): r is Record<string, unknown> => typeof r === 'object' && r !== null && asString(r.status).toLowerCase() !== 'completed'
    ) as Record<string, unknown> | undefined;
    if (!draftRow || !draftRow.id) {
      json(res, 200, { ok: true });
      return;
    }

    const isCaptured = status === 'captured' || status === 'authorized';
    if (isCaptured) {
      const currentStatus = asString(draftRow.status).toLowerCase();
      if (!['confirmed', 'completed', 'in_progress'].includes(currentStatus)) {
        const now = new Date().toISOString();
        const { error: updateErr } = await serviceClient
          .from(BOOKINGS_TABLE)
          .update({
            status: 'confirmed',
            booking_status: 'confirmed',
            payment_status: 'paid',
            payment_verified_at: now,
            paid_at: now,
            confirmed_at: now,
            razorpay_order_id: orderId,
            razorpay_payment_id: paymentId,
            updated_at: now,
          })
          .eq('id', draftRow.id);
        // If services are missing, reconciling them from the catalogue here is
        // safe because the payment was captured by the provider.
        const metadata = asRecord(draftRow.request_metadata);
        const serviceIds = Array.isArray(metadata?.serviceIds) ? metadata.serviceIds.map((v) => asString(v)).filter(Boolean) : [];
        if (!updateErr && serviceIds.length) {
          const { data: serviceRows, error: serviceErr } = await serviceClient
            .from(SALON_SERVICES_TABLE)
            .select('*')
            .in('id', serviceIds)
            .eq('salon_id', asString(draftRow.salon_id));
          if (!serviceErr && Array.isArray(serviceRows)) {
            const payloads = serviceRows.map((s) => ({
              booking_id: draftRow.id,
              service_id: asString(s.id),
              service_name: asString(s.name),
              category: asString(s.category),
              duration_minutes: asNumber(s.duration_minutes) ?? asNumber(s.duration) ?? 30,
              duration: asNumber(s.duration) ?? asNumber(s.duration_minutes) ?? 30,
              price: asNumber(s.price) ?? 0,
              discount_price: asNumber(s.discount_price) ?? null,
              amount: asNumber(s.discount_price) ?? asNumber(s.price) ?? 0,
              created_at: now,
            }));
            await serviceClient.from(BOOKING_SERVICES_TABLE).insert(payloads).select('id');
          }
        }
      }
    } else if (status === 'failed' || status === 'cancelled') {
      // Keep the pending_payment draft so the customer can retry; never touch
      // `status` to confirmed.
      await serviceClient
        .from(BOOKINGS_TABLE)
        .update({ payment_status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', draftRow.id);
    }

    json(res, 200, { ok: true });
  } catch (err) {
    safeLog('[Nexora] Razorpay webhook failed:', { message: err instanceof Error ? err.message : String(err) });
    json(res, 500, { state: 'payment_failed', message: 'Webhook processing failed.' });
  }
}

/**
 * Load a normalized Appointment the same way the customer booking page does.
 * Uses the service-role client so webhooks/verification can read the row before
 * the customer browser refreshes.
 */
async function fetchCustomerBookingAppointment(
  client: SupabaseClient,
  userId: string,
  bookingId: string
): Promise<Record<string, unknown> | null> {
  const { data, error } = await client
    .from(BOOKINGS_TABLE)
    .select('*')
    .eq('id', bookingId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as Record<string, unknown>;
  const services: Record<string, unknown>[] = [];
  const { data: serviceRows, error: serviceErr } = await client
    .from(BOOKING_SERVICES_TABLE)
    .select('*')
    .eq('booking_id', bookingId);
  if (!serviceErr && Array.isArray(serviceRows)) {
    for (const child of serviceRows) {
      services.push(child as Record<string, unknown>);
    }
  }
  const { data: salonRows } = await client.from(SALONS_TABLE).select('*').eq('id', asString(row.salon_id)).maybeSingle();
  const salon = asRecord(salonRows) || {};
  const { data: staffRows } = await client
    .from(SALON_STAFF_TABLE)
    .select('*')
    .eq('id', asString(row.staff_id ?? row.stylist_id))
    .maybeSingle();
  const staff = asRecord(staffRows) || {};
  const normalized = normalizeBooking({
    ...row,
    services,
    salon_name: asText(row.salon_name, asString(salon.name)),
    salon_image: asText(row.salon_image, asString(salon.image)),
    salon_address: asText(row.salon_address, asString(salon.address)),
    salon_phone: asText(row.salon_phone, asString(salon.phone)),
    maps_url: asText(row.maps_url, asString(salon.maps_url)),
    staff_name: asText(row.staff_name, asString(staff.name)),
    staff_role: asText(row.staff_role, asString(staff.role)),
    staff_avatar: asText(row.staff_avatar, asString(staff.avatar)),
    staff_rating: asNumber(staff.rating) ?? 0,
    staff_experience: asText(row.staff_experience, asString(staff.experience)),
    staff_specialty: row.staff_specialty ?? staff.specialty ?? [],
  });
  return normalized as unknown as Record<string, unknown>;
}
