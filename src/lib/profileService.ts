import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserProfile } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';

/**
 * Profile / Role lookup service
 *
 * Logical relationship:
 * auth.users.id → profiles.id / profiles.user_id → profiles.role
 *
 * Roles are ONLY:
 * - customer
 * - salon_owner
 *
 * This service safely handles missing profiles and never guesses role from frontend.
 */

export type UserRole = 'customer' | 'salon_owner';

export interface UserProfileRow {
  id: string;
  user_id?: string;
  email?: string | null;
  full_name?: string | null;
  role: UserRole;
  created_at?: string;
  updated_at?: string;
}

const VALID_ROLES: UserRole[] = ['customer', 'salon_owner'];

function isValidRole(role: unknown): role is UserRole {
  return typeof role === 'string' && VALID_ROLES.includes(role as UserRole);
}

/**
 * Try to fetch profile from multiple possible table/column conventions.
 * Handles:
 * - profiles table with id = auth.users.id
 * - profiles table with user_id = auth.users.id
 * - user_profiles table
 * - profiles table with role column
 *
 * Returns null if not found, never throws for missing table.
 */
export async function fetchUserProfile(
  userId: string,
  client: SupabaseClient | null = supabase
): Promise<{ profile: UserProfileRow | null; error: string | null; isMissing: boolean }> {
  if (!client || !isSupabaseConfigured) {
    return { profile: null, error: 'Supabase not configured', isMissing: true };
  }
  if (!userId) {
    return { profile: null, error: 'Missing user id', isMissing: true };
  }

  // Try canonical tables in order
  const tablesToTry = ['profiles', 'user_profiles', 'users'];
  
  for (const table of tablesToTry) {
    try {
      // Try id column first
      let { data, error } = await client.from(table).select('*').eq('id', userId).maybeSingle();
      
      if (!error && data) {
        const role = (data as any).role;
        if (isValidRole(role)) {
          return { profile: data as UserProfileRow, error: null, isMissing: false };
        }
        // If profile exists but role invalid/missing, treat as customer default but flag
        if (role == null) {
          // Role missing - default to customer but allow caller to handle
          return { 
            profile: { ...(data as any), role: 'customer' as UserRole } as UserProfileRow, 
            error: null, 
            isMissing: false 
          };
        }
      }

      // Try user_id column if id didn't work
      if (!data) {
        const result = await client.from(table).select('*').eq('user_id', userId).maybeSingle();
        if (!result.error && result.data) {
          const role = (result.data as any).role;
          if (isValidRole(role) || role == null) {
            return { 
              profile: { ...(result.data as any), role: (role as UserRole) || 'customer' } as UserProfileRow, 
              error: null, 
              isMissing: false 
            };
          }
        }
        // If table doesn't exist or RLS blocks, error code will be present
        if (result.error) {
          const code = (result.error as any).code;
          // If table doesn't exist, try next table
          if (code === '42P01' || code === 'PGRST205' || result.error.message?.includes('does not exist')) {
            continue;
          }
          // For other errors (RLS, etc), return but mark as missing safely
          if (code === 'PGRST116' || result.error.message?.includes('0 rows')) {
            continue; // Not found, try next
          }
        }
      }

      if (error) {
        const code = (error as any).code;
        if (code === '42P01' || code === 'PGRST205' || error.message?.includes('does not exist')) {
          continue; // Table doesn't exist, try next
        }
        if (code === 'PGRST116') {
          continue; // No rows, try next table
        }
        // Other errors - log but don't crash
        console.warn(`[Nexora] Profile fetch from ${table} failed:`, error.message);
      }
    } catch (err) {
      console.warn(`[Nexora] Profile fetch exception from ${table}:`, err);
      continue;
    }
  }

  // No profile found in any table - this is safe, caller should handle missing profile
  return { profile: null, error: null, isMissing: true };
}

/**
 * Create or update profile with role.
 * Called after successful signup.
 */
export async function upsertUserProfile(
  userId: string,
  email: string,
  role: UserRole,
  fullName?: string,
  client: SupabaseClient | null = supabase
): Promise<{ success: boolean; error: string | null }> {
  if (!client || !isSupabaseConfigured) {
    return { success: false, error: 'Supabase not configured' };
  }
  if (!userId || !email) {
    return { success: false, error: 'Missing user id or email' };
  }
  if (!isValidRole(role)) {
    return { success: false, error: `Invalid role: ${role}. Must be customer or salon_owner` };
  }

  const tablesToTry = ['profiles', 'user_profiles'];

  for (const table of tablesToTry) {
    try {
      // Try upsert with id
      const payload: any = {
        id: userId,
        email: email.toLowerCase(),
        role,
        full_name: fullName || email.split('@')[0],
        updated_at: new Date().toISOString(),
      };

      // For user_profiles that uses user_id
      if (table === 'user_profiles') {
        payload.user_id = userId;
      }

      const { error } = await client.from(table).upsert(payload, { onConflict: 'id' });

      if (!error) {
        return { success: true, error: null };
      }

      const code = (error as any).code;
      // If table doesn't exist, try next
      if (code === '42P01' || code === 'PGRST205' || error.message?.includes('does not exist')) {
        continue;
      }

      // Try with user_id conflict if id conflict fails
      if (table === 'user_profiles' || code === 'PGRST116') {
        const { error: retryError } = await client
          .from(table)
          .upsert({ ...payload, user_id: userId }, { onConflict: 'user_id' });
        if (!retryError) {
          return { success: true, error: null };
        }
        const retryCode = (retryError as any).code;
        if (retryCode === '42P01' || retryCode === 'PGRST205') {
          continue;
        }
      }

      console.warn(`[Nexora] Profile upsert to ${table} failed:`, error.message);
      // If RLS or other error, try next table but eventually return error
    } catch (err) {
      console.warn(`[Nexora] Profile upsert exception to ${table}:`, err);
      continue;
    }
  }

  // If all tables fail, it's not fatal for auth - profile can be created later
  // Return success false but don't block auth flow
  console.warn('[Nexora] All profile upsert attempts failed - auth will continue, profile may be missing');
  return { success: false, error: 'Profile table not available, but auth succeeded' };
}

/**
 * Get user role from profile or fallback to customer.
 * Never guesses from frontend - always tries backend first.
 */
export async function getUserRole(
  userId: string,
  client: SupabaseClient | null = supabase
): Promise<UserRole> {
  const { profile } = await fetchUserProfile(userId, client);
  if (profile && isValidRole(profile.role)) {
    return profile.role;
  }
  // Default to customer if no profile or role - safe fallback
  // Real role should be set during signup
  return 'customer';
}

/**
 * Map a `profiles` row to the app's UserProfile view model. Only the fields
 * this customer owns are used; never read anything from another user's row.
 */
export function profileRowToUser(row: Record<string, unknown>): Partial<UserProfile> {
  const value = (key: string): unknown => row[key];
  const text = (key: string, fallback = ''): string => {
    const v = value(key);
    return typeof v === 'string' && v.trim() ? v.trim() : fallback;
  };
  const num = (key: string): number | undefined => {
    const v = value(key);
    const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
    return Number.isFinite(n) ? n : undefined;
  };
  const language = text('language').toLowerCase();
  return {
    name: text('full_name') || text('name'),
    email: text('email'),
    phone: text('phone') || text('mobile') || text('phone_number'),
    avatar: text('avatar_url') || text('avatar') || text('image'),
    locationArea: text('location_area') || text('area') || text('locality'),
    city: text('city') || text('town'),
    defaultLocality: text('location_area') || text('area') || text('locality'),
    role: (text('role') as UserProfile['role']) || 'customer',
    dateOfBirth: text('date_of_birth') || undefined,
    gender: (text('gender') as UserProfile['gender']) || undefined,
    genderPreference:
      text('gender') === 'women'
        ? 'women'
        : text('gender') === 'men'
          ? 'men'
          : (text('gender_preference') as UserProfile['genderPreference']) || 'all',
    referralCode: text('referral_code') || text('referralCode'),
    loyaltyPoints: num('loyalty_points') ?? num('points') ?? 0,
    membershipTier: (text('membership_tier') || text('membership')) as UserProfile['membershipTier'] | undefined,
    language: language === 'hi' ? 'hi' : 'en',
    notificationsEnabled: typeof value('notifications_enabled') === 'boolean' ? (value('notifications_enabled') as boolean) : undefined,
    appointmentReminders: typeof value('appointment_reminders') === 'boolean' ? (value('appointment_reminders') as boolean) : undefined,
    bookingConfirmationNotification: typeof value('booking_confirmation_notification') === 'boolean' ? (value('booking_confirmation_notification') as boolean) : undefined,
    rewardsNotification: typeof value('rewards_notification') === 'boolean' ? (value('rewards_notification') as boolean) : undefined,
    referralUpdatesNotification: typeof value('referral_updates_notification') === 'boolean' ? (value('referral_updates_notification') as boolean) : undefined,
    promotionalOffers: typeof value('promotional_offers') === 'boolean' ? (value('promotional_offers') as boolean) : undefined,
    whatsappAlerts: typeof value('whatsapp_alerts') === 'boolean' ? (value('whatsapp_alerts') as boolean) : undefined,
  };
}

/**
 * Persist the signed-in customer's own profile row. The payload is written
 * only when the caller is authenticated (RLS `auth.uid() = id/user_id`).
 * The function first tries the canonical `profiles` table with `id`, then the
 * `user_id` convention used by some deployments.
 */
export async function saveUserProfile(
  userId: string,
  profile: Partial<UserProfile>,
  client: SupabaseClient | null = supabase
): Promise<{ success: boolean; error: string | null }> {
  if (!client || !isSupabaseConfigured || !userId) {
    return { success: false, error: 'Supabase is not configured.' };
  }
  const payload: Record<string, unknown> = {
    email: profile.email?.toLowerCase() || undefined,
    full_name: profile.name || undefined,
    phone: profile.phone || undefined,
    mobile: profile.phone || undefined,
    avatar_url: profile.avatar || undefined,
    avatar: profile.avatar || undefined,
    city: profile.city || undefined,
    area: profile.locationArea || undefined,
    location_area: profile.locationArea || undefined,
    gender: profile.gender || undefined,
    gender_preference: profile.genderPreference || undefined,
    date_of_birth: profile.dateOfBirth || undefined,
    referral_code: profile.referralCode || undefined,
    language: profile.language || undefined,
    notifications_enabled: profile.notificationsEnabled,
    appointment_reminders: profile.appointmentReminders,
    booking_confirmation_notification: profile.bookingConfirmationNotification,
    rewards_notification: profile.rewardsNotification,
    referral_updates_notification: profile.referralUpdatesNotification,
    promotional_offers: profile.promotionalOffers,
    whatsapp_alerts: profile.whatsappAlerts,
    updated_at: new Date().toISOString(),
  };
  // Drop undefined so existing columns with NOT NULL constraints are not hit.
  for (const key of Object.keys(payload)) {
    if (payload[key] === undefined) delete payload[key];
  }

  // Canonical profiles table keyed by auth uuid.
  const idPayload = { ...payload, id: userId, user_id: userId };
  const { error: idError } = await client.from('profiles').upsert(idPayload, { onConflict: 'id' });
  if (!idError) return { success: true, error: null };

  const code = (idError as { code?: string }).code || '';
  if (code !== '42P01' && code !== 'PGRST205' && !idError.message.includes('does not exist')) {
    // Some deployments key profiles by user_id. Try that too before failing.
    const { error: userError } = await client
      .from('profiles')
      .upsert({ ...payload, user_id: userId }, { onConflict: 'user_id' });
    if (!userError) return { success: true, error: null };
    return { success: false, error: userError.message || idError.message };
  }

  // If the canonical namespaced table is missing, try the alternative
  // user_profiles table without inventing a new table (it already exists there).
  const { error: altError } = await client
    .from('user_profiles')
    .upsert({ ...payload, user_id: userId }, { onConflict: 'user_id' });
  if (!altError) return { success: true, error: null };

  return { success: false, error: altError.message || 'Profile could not be saved.' };
}
