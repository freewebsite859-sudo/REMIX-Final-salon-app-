import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { subscribeToAuthState, type NexoraAuthEvent } from '../lib/authListener';
import {
  cleanAuthParamsFromUrl,
  hadPersistedSession,
  isLoginRoute,
  redirectToLogin,
} from '../lib/authRoutes';
import { getUserRole } from '../lib/profileService';
import type { UserRole } from '../lib/profileService';

export type { UserRole } from '../lib/profileService';

/**
 * Nexora universal auth provider (Customer App).
 *
 * This is the ONLY authentication system in the app — it wraps the existing
 * Supabase email/password screens rather than replacing them. It:
 *   - restores a persisted session on reload (INITIAL_SESSION),
 *   - keeps tokens fresh automatically (TOKEN_REFRESHED, handled by the client),
 *   - reacts to SIGNED_IN / SIGNED_OUT through ONE shared listener,
 *   - sends invalid or expired sessions to /auth/login without looping.
 */

export interface NexoraAuthContextValue {
  session: Session | null;
  user: User | null;
  userId: string | null;
  isAuthenticated: boolean;
  /** True until INITIAL_SESSION (or the getSession fallback) has resolved. */
  isLoading: boolean;
  lastEvent: NexoraAuthEvent | 'UNCONFIGURED' | null;
  role: UserRole | null;
  isRoleLoading: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<Session | null>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<NexoraAuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(isSupabaseConfigured);
  const [lastEvent, setLastEvent] = useState<NexoraAuthContextValue['lastEvent']>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isRoleLoading, setIsRoleLoading] = useState<boolean>(false);

  /** Guards against duplicate redirects when several events land together. */
  const redirectGuardRef = useRef(false);
  const initializedRef = useRef(false);

  const applySession = useCallback((next: Session | null) => {
    setSession(next);
    if (next) {
      // A valid session clears the latch so a later expiry can redirect again.
      redirectGuardRef.current = false;
    } else {
      // Clear role when session cleared
      setRole(null);
    }
  }, []);

  const loadRole = useCallback(async (userId: string) => {
    if (!userId || !isSupabaseConfigured || !supabase) {
      setRole(null);
      return;
    }
    setIsRoleLoading(true);
    try {
      const fetchedRole = await getUserRole(userId);
      setRole(fetchedRole);
    } catch (err) {
      console.warn('[Nexora] Failed to load user role:', err);
      setRole('customer'); // Safe fallback
    } finally {
      setIsRoleLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const uid = session?.user?.id;
    if (uid) {
      await loadRole(uid);
    }
  }, [session?.user?.id, loadRole]);

  // Load role whenever session changes
  useEffect(() => {
    const uid = session?.user?.id;
    if (uid) {
      void loadRole(uid);
    } else {
      setRole(null);
    }
  }, [session?.user?.id, loadRole]);

  /**
   * Redirect an unauthenticated visitor to /auth/login at most once per
   * signed-out period. Without the latch, SIGNED_OUT plus a failed
   * TOKEN_REFRESHED would fire two navigations and re-enter this handler.
   *
   * `reason: 'expired'` covers an invalid/expired stored session and always
   * redirects. `reason: 'absent'` (a first-time visitor with no stored
   * session) only redirects if this browser actually had one at boot, so the
   * app's guest-browsing experience is preserved.
   */
  const guardedRedirectToLogin = useCallback((reason: 'expired' | 'absent' = 'expired') => {
    if (redirectGuardRef.current) return;
    if (reason === 'absent' && !hadPersistedSession()) return;
    if (isLoginRoute()) {
      redirectGuardRef.current = true;
      return;
    }
    redirectGuardRef.current = true;
    redirectToLogin({ replace: true });
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      // Supabase not configured (local/demo mode): never block the UI and
      // never redirect — the app falls back to its offline experience.
      setIsLoading(false);
      setLastEvent('UNCONFIGURED');
      return;
    }

    let cancelled = false;

    // ---- ONE shared auth-state listener ----------------------------------
    const unsubscribe = subscribeToAuthState((event, nextSession) => {
      if (cancelled) return;
      setLastEvent(event);

      switch (event) {
        case 'INITIAL_SESSION': {
          // Session restored from storage after a reload (or confirmed absent).
          initializedRef.current = true;
          applySession(nextSession);
          setIsLoading(false);
          cleanAuthParamsFromUrl();
          if (!nextSession) guardedRedirectToLogin('absent');
          break;
        }

        case 'SIGNED_IN': {
          applySession(nextSession);
          setIsLoading(false);
          cleanAuthParamsFromUrl();
          break;
        }

        case 'TOKEN_REFRESHED': {
          // autoRefreshToken succeeded — adopt the new access token. A null
          // session here means the refresh token was rejected/expired.
          applySession(nextSession);
          if (!nextSession) guardedRedirectToLogin();
          break;
        }

        case 'SIGNED_OUT': {
          applySession(null);
          setIsLoading(false);
          guardedRedirectToLogin();
          break;
        }

        case 'USER_UPDATED':
        case 'PASSWORD_RECOVERY':
        case 'MFA_CHALLENGE_VERIFIED': {
          applySession(nextSession);
          break;
        }

        default: {
          applySession(nextSession);
          break;
        }
      }
    });

    // ---- Fallback bootstrap ----------------------------------------------
    // INITIAL_SESSION is normally emitted by the listener; this covers the
    // case where the listener attaches after it fired, and surfaces a
    // corrupt/expired persisted session as an explicit sign-out.
    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (cancelled || initializedRef.current) return;
        if (error) {
          console.warn('[Nexora] Failed to restore session:', error.message);
          applySession(null);
          guardedRedirectToLogin();
        } else {
          applySession(data.session ?? null);
          if (!data.session) guardedRedirectToLogin('absent');
        }
        setIsLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[Nexora] Session bootstrap failed:', err);
        applySession(null);
        setIsLoading(false);
        // A persisted session that cannot be restored is not an authenticated
        // session. Route it through the same guarded path as an expired token.
        guardedRedirectToLogin(hadPersistedSession() ? 'expired' : 'absent');
      });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [applySession, guardedRedirectToLogin]);

  const signOut = useCallback(async () => {
    if (!supabase) {
      applySession(null);
      setRole(null);
      return;
    }
    try {
      await supabase.auth.signOut();
      // Clear role and session locally
      setRole(null);
      applySession(null);
      // Clear any remaining local storage that might hold stale session data
      // The storage key is managed by Supabase, but we ensure no protected state remains
      try {
        // Prevent back navigation to protected pages by replacing history
        if (typeof window !== 'undefined') {
          window.history.replaceState(null, '', '/auth/login');
        }
      } catch {
        /* ignore history errors */
      }
    } catch (err) {
      console.warn('[Nexora] Sign out failed:', err);
      // Drop the local session anyway so the UI cannot get stuck signed in.
      setRole(null);
      applySession(null);
    }
  }, [applySession]);

  const refreshSession = useCallback(async () => {
    if (!supabase) return null;
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      console.warn('[Nexora] Token refresh failed:', error.message);
      setRole(null);
      applySession(null);
      guardedRedirectToLogin();
      return null;
    }
    applySession(data.session ?? null);
    if (data.session?.user?.id) {
      void loadRole(data.session.user.id);
    }
    return data.session ?? null;
  }, [applySession, guardedRedirectToLogin, loadRole]);

  const value = useMemo<NexoraAuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      userId: session?.user?.id ?? null,
      isAuthenticated: Boolean(session?.user),
      isLoading,
      lastEvent,
      role,
      isRoleLoading,
      signOut,
      refreshSession,
      refreshProfile,
    }),
    [session, isLoading, lastEvent, role, isRoleLoading, signOut, refreshSession, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): NexoraAuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within <AuthProvider>.');
  }
  return ctx;
}

/** Safe variant for components that may render outside the provider. */
export function useOptionalAuth(): NexoraAuthContextValue | null {
  return useContext(AuthContext);
}
