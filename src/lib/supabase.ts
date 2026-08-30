/**
 * Nexora universal Supabase client - backward compatibility re-export
 * 
 * This file re-exports from the canonical location src/lib/supabase/client.ts
 * to ensure exactly one shared client instance across the app.
 * 
 * New code should import from '@/lib/supabase/client' or './supabase/client'
 * Existing code continues to work via this re-export.
 */

// Re-export everything from the canonical client location
export * from './supabase/client';
