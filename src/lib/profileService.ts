import type { SupabaseClient } from '@supabase/supabase-js';
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
