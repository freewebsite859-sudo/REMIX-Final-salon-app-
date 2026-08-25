import type { AuthChangeEvent, Session, Subscription } from '@supabase/supabase-js';
import { supabase } from './supabase';

/**
 * Single auth-state listener for the entire application.
 *
 * Supabase fires `onAuthStateChange` per registered listener; registering one
 * per component causes duplicate work, duplicate redirects and duplicate
 * network calls. This module registers EXACTLY ONE subscription against the
 * shared client and fans the events out to any number of in-app handlers.
 */

export type NexoraAuthEvent = AuthChangeEvent;
export type AuthStateHandler = (event: NexoraAuthEvent, session: Session | null) => void;

const globalRef = globalThis as typeof globalThis & {
  __nexoraAuthHandlers__?: Set<AuthStateHandler>;
  __nexoraAuthSubscription__?: Subscription | null;
};

const handlers: Set<AuthStateHandler> = (globalRef.__nexoraAuthHandlers__ ??= new Set());

function ensureSubscription(): void {
  if (!supabase) return;
  if (globalRef.__nexoraAuthSubscription__) return;

  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    // Copy before iterating: a handler may unsubscribe during dispatch.
    for (const handler of Array.from(handlers)) {
      try {
        handler(event, session);
      } catch (err) {
        console.error('[Nexora] auth state handler failed:', err);
      }
    }
  });

  globalRef.__nexoraAuthSubscription__ = data.subscription;
}

/**
 * Register an auth-state handler. Returns an unsubscribe function.
 * The underlying Supabase subscription is created once and kept alive for the
 * lifetime of the page so token refresh never has a listener gap.
 */
export function subscribeToAuthState(handler: AuthStateHandler): () => void {
  handlers.add(handler);
  ensureSubscription();
  return () => {
    handlers.delete(handler);
  };
}

/** Test/HMR helper — tears the single subscription down. */
export function resetAuthListener(): void {
  globalRef.__nexoraAuthSubscription__?.unsubscribe();
  globalRef.__nexoraAuthSubscription__ = null;
  handlers.clear();
}
