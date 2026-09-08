/**
 * Nexora Customer Reviews Service
 *
 * Rules:
 * - Review allowed ONLY after completed booking (status === 'completed').
 * - Rate salon (1–5 stars)
 * - Rate staff (1–5 stars)
 * - Write review comment
 * - Upload review photo
 * - View submitted reviews
 */
import type { Appointment } from '../types.ts';

export interface CustomerReview {
  id: string;
  bookingId: string;
  salonId: string;
  salonName: string;
  salonAddress: string;
  salonImage?: string;
  salonRating: number; // 1 to 5
  staffName?: string;
  staffAvatar?: string;
  staffRole?: string;
  staffRating: number; // 1 to 5
  comment: string;
  photoUrl?: string;
  serviceName: string;
  date: string; // e.g. "02 Sep 2026"
  createdAt: string; // ISO
  userName: string;
  userAvatar: string;
  verifiedBooking: boolean;
}

export const DEFAULT_CUSTOMER_REVIEWS: CustomerReview[] = [
  {
    id: 'rev-01',
    bookingId: 'apt-seed-comp-01',
    salonId: 'salon-1',
    salonName: 'Scissors & Shears Salon',
    salonAddress: 'Mansarovar, Jaipur',
    salonImage: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=600&q=80',
    salonRating: 5,
    staffName: 'Aarav Sharma',
    staffAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80',
    staffRole: 'Master Stylist',
    staffRating: 5,
    comment: 'Fantastic precision haircut and relaxing hair spa! Aarav understood exactly what style suited my face shape. The salon is spotless, and paying via Nexora QR gave me instant 10% cashback.',
    photoUrl: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=600&q=80',
    serviceName: 'Precision Hair Cut & Scalp Spa',
    date: '01 Sep 2026',
    createdAt: '2026-09-01T15:30:00.000Z',
    userName: 'Ananya Sharma',
    userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80',
    verifiedBooking: true,
  },
  {
    id: 'rev-02',
    bookingId: 'apt-seed-comp-02',
    salonId: 'salon-2',
    salonName: 'Luxe Beauty Lounge',
    salonAddress: 'C-Scheme, Jaipur',
    salonImage: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=600&q=80',
    salonRating: 5,
    staffName: 'Priya Meena',
    staffAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=120&q=80',
    staffRole: 'Senior Esthetician',
    staffRating: 4,
    comment: 'The Hydra Facial Deluxe was deeply rejuvenating! Premium products and courteous staff. Left with glowing skin.',
    photoUrl: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=600&q=80',
    serviceName: 'Hydra Facial Deluxe',
    date: '25 Aug 2026',
    createdAt: '2026-08-25T17:00:00.000Z',
    userName: 'Ananya Sharma',
    userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80',
    verifiedBooking: true,
  },
];

const STORAGE_PREFIX = 'nexora_customer_reviews';

export function getReviewsStorageKey(userId?: string): string {
  return userId ? `${STORAGE_PREFIX}_${userId}` : STORAGE_PREFIX;
}

export function loadCustomerReviews(userId?: string): CustomerReview[] {
  if (typeof window === 'undefined') return DEFAULT_CUSTOMER_REVIEWS;
  try {
    const raw = localStorage.getItem(getReviewsStorageKey(userId));
    if (!raw) return DEFAULT_CUSTOMER_REVIEWS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_CUSTOMER_REVIEWS;
  } catch {
    return DEFAULT_CUSTOMER_REVIEWS;
  }
}

export function saveCustomerReviews(reviews: CustomerReview[], userId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getReviewsStorageKey(userId), JSON.stringify(reviews));
  } catch (err) {
    console.warn('[Nexora] Could not save reviews to localStorage', err);
  }
}

/**
 * Checks if a booking is eligible for review.
 * Rule: Review allowed ONLY after completed booking (status === 'completed').
 */
export function canReviewBooking(appointment: Appointment): { eligible: boolean; reason?: string } {
  if (appointment.status !== 'completed') {
    return {
      eligible: false,
      reason: `Review allowed only after completed booking. This booking is currently "${appointment.status}".`,
    };
  }
  return { eligible: true };
}

/**
 * Returns list of completed appointments that are eligible for a new review.
 */
export function getCompletedAppointmentsForReview(
  appointments: Appointment[],
  existingReviews: CustomerReview[]
): Appointment[] {
  const reviewedBookingIds = new Set(existingReviews.map((r) => r.bookingId));
  return appointments.filter(
    (apt) => apt.status === 'completed' && !reviewedBookingIds.has(apt.id)
  );
}

// =============================================================================
// LIVE SUPABASE REVIEWS
// =============================================================================
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase, isLiveCustomerDataEnabled, isSupabaseConfigured } from './supabase';
import { SALONOS_TABLES } from './supabase/tables';

function reviewFromRow(row: Record<string, unknown>): CustomerReview {
  const dateRaw = String(row.created_at ?? row.date ?? new Date().toISOString());
  return {
    id: String(row.id || ''),
    bookingId: String(row.booking_id ?? row.bookingId ?? ''),
    salonId: String(row.salon_id ?? row.salonId ?? ''),
    salonName: String(row.salon_name ?? row.salonName ?? 'Salon'),
    salonAddress: String(row.salon_address ?? row.salonAddress ?? ''),
    salonImage: typeof row.salon_image === 'string' ? row.salon_image : undefined,
    salonRating: Number(row.salon_rating ?? row.rating ?? 0),
    staffName: String(row.staff_name ?? row.staffName ?? 'Stylist Team'),
    staffAvatar: typeof row.staff_avatar === 'string' ? row.staff_avatar : undefined,
    staffRole: typeof row.staff_role === 'string' ? row.staff_role : undefined,
    staffRating: Number(row.staff_rating ?? 0),
    comment: String(row.comment ?? row.review ?? ''),
    photoUrl: typeof row.photo_url === 'string' ? row.photo_url : undefined,
    serviceName: String(row.service_name ?? row.serviceUsed ?? 'Salon Service'),
    date: dateRaw,
    createdAt: dateRaw,
    userName: String(row.user_name ?? row.full_name ?? 'Nexora Customer'),
    userAvatar: typeof row.user_avatar === 'string' ? row.user_avatar : '',
    verifiedBooking: Boolean(row.verified_booking ?? true),
  };
}

/**
 * Load the signed-in customer's own reviews from the canonical `reviews` table.
 */
export async function loadLiveReviews(
  userId: string,
  client: SupabaseClient | null = supabase
): Promise<CustomerReview[]> {
  if (!client || !isSupabaseConfigured || !isLiveCustomerDataEnabled || !userId) return [];
  try {
    const { data, error } = await client.from(SALONOS_TABLES.reviews).select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error || !Array.isArray(data)) return [];
    return data.map((row) => reviewFromRow(row));
  } catch {
    return [];
  }
}

/**
 * Insert a verified review from a completed booking.
 */
export async function saveReviewLive(
  userId: string,
  review: CustomerReview,
  client: SupabaseClient | null = supabase
): Promise<{ error: string | null }> {
  if (!client || !isSupabaseConfigured || !isLiveCustomerDataEnabled || !userId) {
    return { error: 'Live Supabase reviews service is not configured.' };
  }
  const now = new Date().toISOString();
  const { error } = await client.from(SALONOS_TABLES.reviews).insert({
    user_id: userId,
    booking_id: review.bookingId || null,
    salon_id: review.salonId || null,
    salon_name: review.salonName || null,
    salon_address: review.salonAddress || null,
    salon_image: review.salonImage || null,
    salon_rating: review.salonRating,
    staff_id: null,
    staff_name: review.staffName || null,
    staff_avatar: review.staffAvatar || null,
    staff_role: review.staffRole || null,
    staff_rating: review.staffRating,
    comment: review.comment,
    photo_url: review.photoUrl || null,
    service_name: review.serviceName || null,
    user_name: review.userName || null,
    user_avatar: review.userAvatar || null,
    verified_booking: true,
    created_at: now,
  });
  return { error: error?.message || null };
}
