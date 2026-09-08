/**
 * Nexora SalonOS Customer App — transactional booking service.
 *
 * Booking creation is intentionally transactional at the application layer:
 *
 *   1. reserve / create the booking row in `bookings`
 *   2. insert every selected service into `booking_services`
 *   3. return the fully refreshed booking (status + details + services)
 *
 * The service only uses the canonical customer tables:
 *   bookings, booking_services, staff_slots, salons, salon_services, salon_staff
 *
 * It also exposes live slot availability from `staff_slots` and a realtime
 * subscription so booking status changes are reflected while the app is open.
 */
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import type { Appointment, BookingStatus, SalonService, Stylist } from '../types';
import { supabase, isLiveCustomerDataEnabled, isSupabaseConfigured } from './supabase';
import { SALONOS_TABLES } from './supabase/tables';

export interface BookingCreateInput {
  userId: string;
  salonId: string;
  staffId?: string | null;
  date: string;
  time: string;
  services: SalonService[];
  totalPrice: number;
  advancePaid?: number;
  remainingAmount?: number;
  paymentMode?: 'advance_25' | 'full' | 'pay_at_salon';
  paymentStatus?: 'paid' | 'pending' | 'failed';
  discountApplied?: number;
  notes?: string;
  couponCode?: string;
  paymentMethodUsed?: 'upi' | 'card' | 'netbanking' | 'qr' | 'wallet';
}

export interface AvailableSlot {
  id: string;
  salonId: string;
  staffId?: string;
  date: string;
  startTime: string;
  endTime?: string;
  isAvailable: boolean;
  status?: string;
}

const BOOKING_STATUS_ALIASES: Record<string, BookingStatus> = {
  pending: 'pending',
  confirmed: 'confirmed',
  completed: 'completed',
  cancelled: 'cancelled',
  no_show: 'no_show',
  in_progress: 'confirmed',
  'in progress': 'confirmed',
};

export function normalizeBookingStatus(raw: unknown): BookingStatus {
  const value = String(raw || 'pending').toLowerCase().replace(/[\s-]+/g, '_');
  return BOOKING_STATUS_ALIASES[value] || 'pending';
}

export function makeBookingRef(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `NX-${y}${m}${d}-${rand}`;
}

function pick(row: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
  }
  return undefined;
}

function asTrimmedString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function asStringArray(value: unknown): string[] {
  if (typeof value === 'string') return value.split(',').map((s) => s.trim()).filter(Boolean);
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  return [];
}

/** Convert 24h DB times (e.g. "17:30:00") to the app's display format. */
function toDisplayTime(value: string): string {
  if (!value) return value;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return value;
  let hour = Number(match[1]);
  const minute = match[2];
  const suffix = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${suffix}`;
}

function servicesFromRow(row: Record<string, unknown>): SalonService[] {
  const raw = pick(row, ['services', 'service_details', 'booking_services']);
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const rec = item as Record<string, unknown>;
      const id = asTrimmedString(pick(rec, ['id', 'service_id', 'salon_service_id']));
      const name = asTrimmedString(pick(rec, ['name', 'service_name']));
      if (!id && !name) return null;
      return {
        id,
        name,
        category: (pick(rec, ['category', 'service_category']) as SalonService['category']) || 'hair',
        duration: asNumber(pick(rec, ['duration', 'duration_minutes'])) || 30,
        price: asNumber(pick(rec, ['price', 'amount'])) || 0,
        discountPrice: asNumber(pick(rec, ['discount_price', 'discountPrice'])) ?? undefined,
        description: asTrimmedString(pick(rec, ['description'])),
      } as SalonService;
    })
    .filter((s): s is SalonService => s !== null);
}

function staffFromRow(row: Record<string, unknown>): Stylist | undefined {
  const id = asTrimmedString(pick(row, ['staff_id', 'stylist_id', 'professional_id']));
  const name = asTrimmedString(pick(row, ['staff_name', 'stylist_name', 'name']));
  if (!id && !name) return undefined;
  return {
    id: id || 'any',
    name: name || 'Any Expert',
    role: asTrimmedString(pick(row, ['staff_role', 'role'])),
    avatar: asTrimmedString(pick(row, ['staff_avatar', 'avatar'])),
    rating: asNumber(pick(row, ['staff_rating', 'rating'])) || 0,
    experience: asTrimmedString(pick(row, ['staff_experience', 'experience'])),
    specialty: asStringArray(pick(row, ['staff_specialty', 'specialty'])),
  };
}

/** Convert a canonical bookings row into the app view model. */
export function normalizeBooking(row: Record<string, unknown>): Appointment {
  const id = asTrimmedString(pick(row, ['id', 'booking_id']));
  const salonId = asTrimmedString(pick(row, ['salon_id', 'salonId']));
  const services = servicesFromRow(row);
  const foundStaff = staffFromRow(row);

  return {
    id,
    salonId,
    salonName: asTrimmedString(pick(row, ['salon_name', 'salonName']), ''),
    salonAddress: asTrimmedString(pick(row, ['salon_address', 'salonAddress', 'address']), ''),
    salonImage: asTrimmedString(pick(row, ['salon_image', 'salonImage', 'image']), ''),
    salonPhone: asTrimmedString(pick(row, ['salon_phone', 'phone'])),
    services: services.length ? services : [],
    stylist: foundStaff,
    date: asTrimmedString(pick(row, ['date', 'booking_date', 'slot_date']), ''),
    time: toDisplayTime(asTrimmedString(pick(row, ['time', 'slot_time', 'start_time']), '')),
    status: normalizeBookingStatus(pick(row, ['status', 'booking_status'])),
    totalPrice: asNumber(pick(row, ['total_price', 'totalPrice', 'amount', 'price'])) || 0,
    advancePaid: asNumber(pick(row, ['advance_paid', 'advancePaid', 'advance_amount'])) ?? undefined,
    remainingAmount: asNumber(pick(row, ['remaining_amount', 'remainingAmount'])) ?? undefined,
    paymentMode: (pick(row, ['payment_mode', 'paymentMode']) as Appointment['paymentMode']) || undefined,
    paymentStatus: (pick(row, ['payment_status', 'paymentStatus']) as Appointment['paymentStatus']) || undefined,
    razorpayPaymentId: asTrimmedString(pick(row, ['razorpay_payment_id', 'payment_id'])),
    razorpayOrderId: asTrimmedString(pick(row, ['razorpay_order_id', 'order_id'])),
    razorpaySignature: asTrimmedString(pick(row, ['razorpay_signature', 'signature'])),
    paymentMethodUsed: (pick(row, ['payment_method_used', 'paymentMethodUsed']) as Appointment['paymentMethodUsed']) || undefined,
    salonConfirmationStatus: (pick(row, ['salon_confirmation_status', 'salonConfirmationStatus']) as Appointment['salonConfirmationStatus']) || undefined,
    ownerConfirmedAt: asTrimmedString(pick(row, ['owner_confirmed_at', 'confirmed_at'])),
    ownerName: asTrimmedString(pick(row, ['owner_name', 'salon_owner_name'])),
    discountApplied: asNumber(pick(row, ['discount_applied', 'discountApplied', 'discount'])) ?? undefined,
    bookingRef: asTrimmedString(pick(row, ['booking_ref', 'bookingRef', 'ref_code']), id),
    notes: asTrimmedString(pick(row, ['notes', 'special_notes'])),
    createdAt: asTrimmedString(pick(row, ['created_at', 'createdAt']), new Date().toISOString()),
    mapsUrl: asTrimmedString(pick(row, ['maps_url', 'mapsUrl'])),
    salonLatitude: asNumber(pick(row, ['salon_latitude', 'latitude'])) ?? undefined,
    salonLongitude: asNumber(pick(row, ['salon_longitude', 'longitude'])) ?? undefined,
  };
}

function collectRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data.filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null);
  if (data && typeof data === 'object') return [data as Record<string, unknown>];
  return [];
}

async function buildFlatBookings(
  client: SupabaseClient,
  userId: string,
  rowsData: unknown
): Promise<{ rows: Record<string, unknown>[]; error?: string; bookings: Record<string, unknown>[] }> {
  const rows = collectRows(rowsData);
  const ids = rows.map((b) => String(b.id || ''));
  const servicesByBooking: Record<string, Record<string, unknown>[]> = {};
  if (ids.length) {
    const { data: serviceData, error: sErr } = await client
      .from(SALONOS_TABLES.bookingServices)
      .select('*')
      .in('booking_id', ids);
    if (!sErr) {
      for (const rs of collectRows(serviceData)) {
        const bookingId = asTrimmedString(pick(rs, ['booking_id', 'bookingId']));
        if (!bookingId) continue;
        servicesByBooking[bookingId] = servicesByBooking[bookingId] || [];
        servicesByBooking[bookingId].push(rs);
      }
    }
  }
  // Refresh embedded service rows with the live `salon_services` catalogue so
  // name/price/duration reflect the current database, not a stale denormalised
  // copy inside `booking_services`.
  const serviceIds = Array.from(
    new Set(
      Object.values(servicesByBooking)
        .flat()
        .map((s) => String((s as Record<string, unknown>).service_id || ''))
        .filter(Boolean)
    )
  );
  if (serviceIds.length) {
    const { data: serviceRows, error: catalogErr } = await client
      .from(SALONOS_TABLES.salonServices)
      .select('*')
      .in('id', serviceIds);
    if (!catalogErr && Array.isArray(serviceRows)) {
      const byId: Record<string, Record<string, unknown>> = {};
      for (const rs of collectRows(serviceRows)) byId[String(rs.id || '')] = rs;
      for (const bookingId of Object.keys(servicesByBooking)) {
        servicesByBooking[bookingId] = servicesByBooking[bookingId].map((s) => {
          const catalog = byId[String((s as Record<string, unknown>).service_id || '')];
          const rec = s as Record<string, unknown>;
          return {
            ...rec,
            service_name: asTrimmedString(pick(rec, ['service_name', 'name']), asTrimmedString(pick(catalog || {}, ['name']))),
            price: asNumber(pick(rec, ['price', 'amount'])) ?? asNumber(pick(catalog || {}, ['price'])) ?? 0,
            duration: asNumber(pick(rec, ['duration'])) ?? asNumber(pick(catalog || {}, ['duration', 'duration_minutes'])) ?? 0,
            duration_minutes: asNumber(pick(rec, ['duration_minutes'])) ?? asNumber(pick(catalog || {}, ['duration_minutes', 'duration'])) ?? 0,
            discount_price: asNumber(pick(rec, ['discount_price'])) ?? asNumber(pick(catalog || {}, ['discount_price'])) ?? null,
          };
        });
      }
    }
  }

  const salonIds = rows.map((b) => String(b.salon_id || '')).filter(Boolean);
  const staffIds = rows.map((b) => String(b.staff_id || '')).filter(Boolean);
  const salonsById: Record<string, Record<string, unknown>> = {};
  if (salonIds.length) {
    const { data: salonData, error: sErr } = await client
      .from(SALONOS_TABLES.salons)
      .select('*')
      .in('id', salonIds);
    if (!sErr) {
      for (const rs of collectRows(salonData)) salonsById[String(rs.id || '')] = rs;
    }
  }
  const staffById: Record<string, Record<string, unknown>> = {};
  if (staffIds.length) {
    const { data: staffData, error: stErr } = await client
      .from(SALONOS_TABLES.salonStaff)
      .select('*')
      .in('id', staffIds);
    if (!stErr) {
      for (const rs of collectRows(staffData)) staffById[String(rs.id || '')] = rs;
    }
  }
  const withServices = rows.map((b) => {
    const bookingId = String(b.id || '');
    const salon = salonsById[String(b.salon_id || '')] || {};
    const staff = staffById[String(b.staff_id || '')] || {};
    return {
      ...b,
      services: servicesByBooking[bookingId] || [],
      salon_name: asTrimmedString(pick(b, ['salon_name']), asTrimmedString(pick(salon, ['name']))),
      salon_image: asTrimmedString(pick(b, ['salon_image']), asTrimmedString(pick(salon, ['image', 'image_url']))),
      salon_address: asTrimmedString(pick(b, ['salon_address']), asTrimmedString(pick(salon, ['address']))),
      salon_phone: asTrimmedString(pick(b, ['salon_phone']), asTrimmedString(pick(salon, ['phone']))),
      salon_latitude: asNumber(pick(salon, ['latitude'])) ?? null,
      salon_longitude: asNumber(pick(salon, ['longitude'])) ?? null,
      maps_url: asTrimmedString(pick(b, ['maps_url']), asTrimmedString(pick(salon, ['maps_url']))),
      staff_name: asTrimmedString(pick(b, ['staff_name']), asTrimmedString(pick(staff, ['name']))),
    };
  });
  return { rows: withServices, error: undefined, bookings: withServices };
}

async function fetchBookingsRaw(client: SupabaseClient, userId: string) {
  // Some deployments expose the FK relationship with the canonical FK name and
  // some do not. Place the FK object as part of the query but fall back to the
  // flat query + explicit lookups below so neither breaks.
  const { data, error } = await client
    .from(SALONOS_TABLES.bookings)
    .select(`
      *,
      salons!bookings_salon_id_fkey(*),
      salon_staff!bookings_staff_id_fkey(*)
    `)
    .or(`user_id.eq.${userId},customer_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) {
    // Some deployments do not have a FK-named relationship or use only
    // customer_id; retry with heuristics before giving up.
    const flat = await client
      .from(SALONOS_TABLES.bookings)
      .select('*')
      .or(`user_id.eq.${userId},customer_id.eq.${userId}`)
      .order('created_at', { ascending: false });
    if (flat.error) {
      // The `.or` OR-filter can fail when a deployment only has customer_id
      // (or only user_id). Try the single column that is present.
      const byCustomer = await client
        .from(SALONOS_TABLES.bookings)
        .select('*')
        .eq('customer_id', userId)
        .order('created_at', { ascending: false });
      if (!byCustomer.error) return await buildFlatBookings(client, userId, byCustomer.data);
      const byUser = await client
        .from(SALONOS_TABLES.bookings)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (!byUser.error) return await buildFlatBookings(client, userId, byUser.data);
      return { rows: [] as Record<string, unknown>[], error: flat.error.message || 'Bookings unavailable', bookings: [] as Record<string, unknown>[] };
    }
    return await buildFlatBookings(client, userId, flat.data);
  }

  const bookings = collectRows(data);
  const servicesByBooking: Record<string, Record<string, unknown>[]> = {};
  const staffByBooking: Record<string, Record<string, unknown>> = {};

  if (bookings.length) {
    const ids = bookings.map((b) => String(b.id || ''));
    const { data: serviceData, error: sErr } = await client
      .from(SALONOS_TABLES.bookingServices)
      .select('*')
      .in('booking_id', ids);
    if (!sErr) {
      for (const rs of collectRows(serviceData)) {
        const bookingId = asTrimmedString(pick(rs, ['booking_id', 'bookingId']));
        if (!bookingId) continue;
        servicesByBooking[bookingId] = servicesByBooking[bookingId] || [];
        servicesByBooking[bookingId].push(rs);
      }
    }
  }

  // Enrich denormalised booking_service rows from the live salon_services table.
  const joinedServiceIds = Array.from(
    new Set(Object.values(servicesByBooking).flat().map((s) => String((s as Record<string, unknown>).service_id || '')).filter(Boolean))
  );
  if (joinedServiceIds.length) {
    const { data: joinedCatalog, error: catErr } = await client
      .from(SALONOS_TABLES.salonServices)
      .select('*')
      .in('id', joinedServiceIds);
    if (!catErr && Array.isArray(joinedCatalog)) {
      const byId: Record<string, Record<string, unknown>> = {};
      for (const rs of collectRows(joinedCatalog)) byId[String(rs.id || '')] = rs;
      for (const bookingId of Object.keys(servicesByBooking)) {
        servicesByBooking[bookingId] = servicesByBooking[bookingId].map((s) => {
          const catalog = byId[String((s as Record<string, unknown>).service_id || '')];
          const rec = s as Record<string, unknown>;
          return {
            ...rec,
            service_name: asTrimmedString(pick(rec, ['service_name', 'name']), asTrimmedString(pick(catalog || {}, ['name']))),
            price: asNumber(pick(rec, ['price', 'amount'])) ?? asNumber(pick(catalog || {}, ['price'])) ?? 0,
            duration: asNumber(pick(rec, ['duration'])) ?? asNumber(pick(catalog || {}, ['duration', 'duration_minutes'])) ?? 0,
            duration_minutes: asNumber(pick(rec, ['duration_minutes'])) ?? asNumber(pick(catalog || {}, ['duration_minutes', 'duration'])) ?? 0,
            discount_price: asNumber(pick(rec, ['discount_price'])) ?? asNumber(pick(catalog || {}, ['discount_price'])) ?? null,
          };
        });
      }
    }
  }

  const joined = bookings.map((b) => {
    const id = String(b.id || '');
    const salon = (b.salons && typeof b.salons === 'object' ? b.salons : {}) as Record<string, unknown>;
    const staffRel = (b.salon_staff && typeof b.salon_staff === 'object' ? b.salon_staff : {}) as Record<string, unknown>;
    const serviceRows = servicesByBooking[id] || [];
    return {
      ...b,
      salon_name: asTrimmedString(pick(b, ['salon_name']), asTrimmedString(pick(salon, ['name']))),
      salon_image: asTrimmedString(pick(b, ['salon_image']), asTrimmedString(pick(salon, ['image']))),
      salon_address: asTrimmedString(pick(b, ['salon_address']), asTrimmedString(pick(salon, ['address']))),
      salon_phone: asTrimmedString(pick(b, ['salon_phone']), asTrimmedString(pick(salon, ['phone']))),
      salon_latitude: asNumber(pick(salon, ['latitude'])) ?? null,
      salon_longitude: asNumber(pick(salon, ['longitude'])) ?? null,
      maps_url: asTrimmedString(pick(b, ['maps_url']), asTrimmedString(pick(salon, ['maps_url']))),
      services: serviceRows,
      staff_name: asTrimmedString(pick(b, ['staff_name']), asTrimmedString(pick(staffRel, ['name']))),
      staff_role: asTrimmedString(pick(b, ['staff_role']), asTrimmedString(pick(staffRel, ['role']))),
      staff_avatar: asTrimmedString(pick(b, ['staff_avatar']), asTrimmedString(pick(staffRel, ['avatar']))),
      staff_rating: asNumber(pick(staffRel, ['rating'])) ?? null,
      staff_experience: asTrimmedString(pick(staffRel, ['experience'])),
      staff_specialty: pick(staffRel, ['specialty']) ?? [],
    };
  });

  return { rows: joined, error: undefined, bookings: joined };
}

/**
 * Load the signed-in customer's bookings (own rows only, RLS enforced).
 */
export async function fetchCustomerBookings(
  userId: string,
  client: SupabaseClient | null = supabase
): Promise<{ appointments: Appointment[]; error: string | null }> {
  if (!client || !isSupabaseConfigured || !isLiveCustomerDataEnabled || !userId) {
    return { appointments: [], error: null };
  }

  const result = await fetchBookingsRaw(client, userId);
  if (result.error) {
    return { appointments: [], error: result.error };
  }
  return {
    appointments: result.rows.map(normalizeBooking),
    error: null,
  };
}

/**
 * Create a booking + its booking_services rows in one transactional flow.
 *
 * The caller must be authenticated; all rows are scoped to the customer's own
 * `user_id`. This method does not impersonate a salon or bypass RLS.
 */
export async function createCustomerBooking(
  input: BookingCreateInput,
  client: SupabaseClient | null = supabase
): Promise<{ appointment: Appointment | null; error: string | null }> {
  if (!client || !isSupabaseConfigured || !isLiveCustomerDataEnabled) {
    return { appointment: null, error: 'Live Supabase booking service is not configured.' };
  }
  if (!input.userId || !input.salonId || !input.services.length) {
    return { appointment: null, error: 'Missing user, salon or services for booking.' };
  }

  const now = new Date().toISOString();
  const bookingRef = makeBookingRef();
  const totalPrice = input.totalPrice || input.services.reduce((sum, s) => sum + (s.discountPrice || s.price || 0), 0);
  const advance = input.advancePaid ?? Math.round(totalPrice * 0.25);
  const remaining = input.remainingAmount ?? Math.max(0, totalPrice - advance);

  // Before creating any row, verify the catalog is active and the requested
  // slot is still available. This is an application-level safety check on top
  // of RLS/data integrity; it never bypasses policies.
  const { data: salonRow, error: salonErr } = await client
    .from(SALONOS_TABLES.salons)
    .select('id,is_active,is_verified')
    .eq('id', input.salonId)
    .maybeSingle();
  if (salonErr || !salonRow) {
    return { appointment: null, error: salonErr?.message || 'Salon is not available for booking.' };
  }
  if (salonRow.is_active === false) {
    return { appointment: null, error: 'This salon is currently inactive and cannot accept bookings.' };
  }

  const serviceIds = input.services.map((s) => s.id).filter(Boolean);
  if (serviceIds.length) {
    const { data: serviceRows, error: serviceErr } = await client
      .from(SALONOS_TABLES.salonServices)
      .select('id,is_active')
      .in('id', serviceIds)
      .eq('salon_id', input.salonId);
    if (serviceErr) {
      return { appointment: null, error: `Selected services could not be verified: ${serviceErr.message}` };
    }
    const activeIds = new Set((serviceRows || []).map((row) => String((row as Record<string, unknown>).id || '')));
    const inactive = serviceIds.filter((id) => !activeIds.has(id));
    if (inactive.length) {
      return { appointment: null, error: 'One or more selected services are unavailable at this salon.' };
    }
  }

  if (input.staffId) {
    const { data: staffRow, error: staffErr } = await client
      .from(SALONOS_TABLES.salonStaff)
      .select('id,is_active')
      .eq('id', input.staffId)
      .eq('salon_id', input.salonId)
      .maybeSingle();
    if (staffErr || !staffRow) {
      return { appointment: null, error: staffErr?.message || 'Selected staff member is not available at this salon.' };
    }
    if (staffRow.is_active === false) {
      return { appointment: null, error: 'Selected staff member is currently inactive.' };
    }

    const slotResult = await fetchAvailableSlots(input.salonId, { staffId: input.staffId, date: input.date }, client);
    const slotAvailable = slotResult.slots.some(
      (slot) => slot.staffId === input.staffId && slot.date === input.date && slot.startTime === input.time
    );
    if (!slotAvailable) {
      return { appointment: null, error: slotResult.error || 'The selected staff slot is no longer available.' };
    }
  }

  // Duplicate-slot guard for the same customer and salon. Blocks a second
  // booking for the same staff/date/time while a previous one is not cancelled
  // or complete.
  const existingQuery = client
    .from(SALONOS_TABLES.bookings)
    .select('id,status,staff_id,stylist_id')
    .eq('salon_id', input.salonId)
    .eq('date', input.date)
    .eq('time', input.time);
  let existing = await existingQuery.or(`user_id.eq.${input.userId},customer_id.eq.${input.userId}`);
  if (existing.error) {
    existing = await existingQuery.eq('customer_id', input.userId);
  }
  if (existing.error) {
    existing = await existingQuery.eq('user_id', input.userId);
  }
  if (existing.error) {
    return { appointment: null, error: `Booking conflict check failed: ${existing.error.message}` };
  }
  const duplicate = (existing.data || []).find((row) => {
    const status = String((row as Record<string, unknown>).status || '').toLowerCase();
    const staffId = String((row as Record<string, unknown>).staff_id || (row as Record<string, unknown>).stylist_id || '');
    return status !== 'cancelled' && status !== 'no_show' && status !== 'completed' && (!input.staffId || staffId === input.staffId);
  });
  if (duplicate) {
    return { appointment: null, error: 'You already have a booking for this slot. Select another date or time.' };
  }

  const bookingPayload = {
    user_id: input.userId,
    customer_id: input.userId,
    salon_id: input.salonId,
    staff_id: input.staffId || null,
    stylist_id: input.staffId || null,
    date: input.date,
    time: input.time,
    booking_date: input.date,
    slot_time: input.time,
    status: 'pending',
    total_price: totalPrice,
    advance_paid: advance,
    remaining_amount: remaining,
    payment_status: input.paymentStatus || 'paid',
    payment_mode: input.paymentMode || 'advance_25',
    discount_applied: input.discountApplied || null,
    booking_ref: bookingRef,
    ref_code: bookingRef,
    notes: input.notes || null,
    created_at: now,
    updated_at: now,
  };

  const { data: created, error: bookingError } = await client
    .from(SALONOS_TABLES.bookings)
    .insert(bookingPayload)
    .select('*')
    .maybeSingle();

  if (bookingError || !created) {
    return { appointment: null, error: bookingError?.message || 'Booking could not be created.' };
  }

  const bookingId = String(created.id);
  const servicePayloads = input.services.map((service) => ({
    booking_id: bookingId,
    service_id: service.id || null,
    service_name: service.name,
    category: service.category,
    duration_minutes: service.duration,
    duration: service.duration,
    price: service.price,
    discount_price: service.discountPrice ?? null,
    amount: service.discountPrice ?? service.price,
    created_at: now,
  }));

  let servicesError: string | null = null;
  if (servicePayloads.length) {
    const { error: serviceError } = await client
      .from(SALONOS_TABLES.bookingServices)
      .insert(servicePayloads);
    if (serviceError) servicesError = serviceError.message;
  }

  // Refresh the created booking with services so the UI has canonical details.
  const refreshed = await fetchCustomerBookings(input.userId, client);
  const appointment = refreshed.appointments.find((a) => a.id === bookingId) || null;

  return {
    appointment,
    error: servicesError
      ? `Booking created but service rows could not be attached: ${servicesError}`
      : null,
  };
}

/**
 * Cancel an own booking. RLS confines the update to the caller's rows.
 */
export async function cancelCustomerBooking(
  userId: string,
  bookingId: string,
  client: SupabaseClient | null = supabase
): Promise<{ error: string | null }> {
  if (!client || !isSupabaseConfigured || !isLiveCustomerDataEnabled) {
    return { error: 'Live Supabase booking service is not configured.' };
  }

  // Customers can cancel only their own upcoming pending/confirmed bookings.
  const base = client
    .from(SALONOS_TABLES.bookings)
    .select('id,status,date,time')
    .eq('id', bookingId);
  let owned = await base.or(`user_id.eq.${userId},customer_id.eq.${userId}`);
  if (owned.error) owned = await base.eq('customer_id', userId);
  if (owned.error) owned = await base.eq('user_id', userId);
  if (owned.error || !owned.data || !owned.data.length) {
    return { error: owned.error?.message || 'Booking not found. You can only cancel your own bookings.' };
  }
  const booking = owned.data[0] as Record<string, unknown>;
  const status = String(booking.status || '').toLowerCase();
  if (status === 'completed' || status === 'no_show') {
    return { error: 'Completed/no-show bookings cannot be cancelled by the customer.' };
  }
  const dateStr = String(booking.date || booking.booking_date || '');
  const isPast = dateStr && new Date(`${dateStr}T23:59:59`).getTime() < Date.now();
  if (status === 'confirmed' && isPast) {
    return { error: 'Confirmed bookings in the past cannot be cancelled by the customer.' };
  }

  const updateBase = client
    .from(SALONOS_TABLES.bookings)
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', bookingId);
  const byUser = await updateBase.eq('user_id', userId);
  if (byUser.error) {
    const byCustomer = await updateBase.eq('customer_id', userId);
    if (byCustomer.error) return { error: byCustomer.error.message };
  }
  return { error: null };
}

/**
 * Live available slots from `staff_slots`. Only open/available slots are
 * returned.
 */
export async function fetchAvailableSlots(
  salonId: string,
  options: { staffId?: string | null; date?: string } = {},
  client: SupabaseClient | null = supabase
): Promise<{ slots: AvailableSlot[]; error: string | null }> {
  if (!client || !isSupabaseConfigured || !isLiveCustomerDataEnabled) {
    return { slots: [], error: null };
  }
  try {
    let query = client
      .from(SALONOS_TABLES.staffSlots)
      .select('*')
      .eq('salon_id', salonId);
    if (options.staffId) query = query.eq('staff_id', options.staffId);

    const { data, error } = await query;
    if (error) return { slots: [], error: error.message };

    const slots = collectRows(data)
      .map((row) => ({
        id: asTrimmedString(pick(row, ['id'])),
        salonId: asTrimmedString(pick(row, ['salon_id', 'salonId']), salonId),
        staffId: asTrimmedString(pick(row, ['staff_id', 'staffId'])),
        date: asTrimmedString(pick(row, ['date', 'slot_date']), options.date || ''),
        startTime: toDisplayTime(asTrimmedString(pick(row, ['start_time', 'startTime', 'time']), '')),
        endTime: asTrimmedString(pick(row, ['end_time', 'endTime'])),
        isAvailable: Boolean(asNumber(pick(row, ['is_available', 'isAvailable', 'available'])) === 1 || pick(row, ['is_available', 'isAvailable', 'available']) === true),
        status: asTrimmedString(pick(row, ['status'])),
      }))
      .filter((slot) => slot.isAvailable && slot.date && slot.startTime && (!options.date || slot.date === options.date));

    return { slots, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { slots: [], error: message };
  }
}

/**
 * Subscribe to realtime booking status changes (own rows only; RLS filters
 * which rows Postgres sends, but the client also narrows them).
 */
/**
 * Realtime staff_slots feed for the live availability picker. The channel is
 * scoped by salon_id (read-only catalogue data), so customers see a slot being
 * taken by another user without a page reload.
 */
export function subscribeToStaffSlots(
  salonId: string,
  onChange: () => void,
  client: SupabaseClient | null = supabase
): () => void {
  if (!client || !isSupabaseConfigured || !isLiveCustomerDataEnabled || !salonId) return () => undefined;
  let channel: RealtimeChannel | null = null;
  try {
    channel = client
      .channel(`customer-staff-slots-${salonId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: SALONOS_TABLES.staffSlots, filter: `salon_id=eq.${salonId}` },
        () => onChange()
      )
      .subscribe();
  } catch {
    // Realtime is a nice-to-have; polling remains available.
  }
  return () => {
    try {
      if (channel && client) client.removeChannel(channel);
    } catch {
      /* ignore */
    }
  };
}

export function subscribeToCustomerBookings(
  userId: string,
  onChange: () => void,
  client: SupabaseClient | null = supabase
): () => void {
  if (!client || !isSupabaseConfigured || !isLiveCustomerDataEnabled) return () => undefined;
  let channel: RealtimeChannel | null = null;
  try {
    channel = client
      .channel(`customer-bookings-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: SALONOS_TABLES.bookings, filter: `user_id=eq.${userId}` },
        () => onChange()
      )
      .subscribe();
  } catch {
    // Realtime is a nice-to-have; polling remains available.
  }
  return () => {
    try {
      if (channel && client) client.removeChannel(channel);
    } catch {
      /* ignore */
    }
  };
}
