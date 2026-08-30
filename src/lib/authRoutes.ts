/**
 * Nexora auth routing helpers.
 *
 * The Customer App is a single-page app without a router library, so
 * "redirect to /auth/login" is performed with the History API instead of a
 * full page load. That keeps the Supabase client, its in-memory session and
 * the PKCE verifier alive across the transition — a hard `location.href`
 * assignment during a token refresh is exactly what causes redirect loops.
 */

import { NEXORA_AUTH_STORAGE_KEY } from './supabase';

export const LOGIN_PATH = '/auth/login';

/**
 * Snapshot, taken at module load (before GoTrue can prune a bad token),
 * of whether this browser had a persisted Nexora session.
 *
 * It lets the provider distinguish "expired/invalid session — send them to
 * login" from "brand-new visitor — leave the guest experience alone".
 */
const hadPersistedSessionAtBoot: boolean = (() => {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean(window.localStorage.getItem(NEXORA_AUTH_STORAGE_KEY));
  } catch {
    return false;
  }
})();

export function hadPersistedSession(): boolean {
  return hadPersistedSessionAtBoot;
}

/** Paths that render the unauthenticated shell. */
const AUTH_PATHS = new Set([LOGIN_PATH, '/auth/signup', '/auth/reset', '/auth/callback']);

export function currentPath(): string {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname || '/';
}

export function isAuthRoute(path: string = currentPath()): boolean {
  return AUTH_PATHS.has(path);
}

export function isLoginRoute(path: string = currentPath()): boolean {
  return path === LOGIN_PATH;
}

/**
 * Navigate to `/auth/login` exactly once.
 *
 * Loop protection: if we are already on the login route this is a no-op, so a
 * burst of `SIGNED_OUT` / failed-refresh events cannot push a stack of history
 * entries or re-trigger navigation-driven auth checks.
 *
 * Also prevents back navigation to protected pages after logout by replacing history.
 */
export function redirectToLogin(options: { replace?: boolean } = {}): boolean {
  if (typeof window === 'undefined') return false;
  if (isLoginRoute()) return false;

  const { replace = true } = options;
  const url = `${LOGIN_PATH}${window.location.search}`;

  if (replace) {
    window.history.replaceState({ nexoraAuth: 'login' }, '', url);
    // Push additional entry to prevent back navigation to protected pages
    // After logout, browser back should not reveal protected content
    try {
      window.history.pushState({ nexoraAuth: 'login-block' }, '', url);
      window.history.replaceState({ nexoraAuth: 'login' }, '', url);
    } catch {
      /* ignore history errors */
    }
  } else {
    window.history.pushState({ nexoraAuth: 'login' }, '', url);
  }
  window.dispatchEvent(new PopStateEvent('popstate'));
  return true;
}

/**
 * Enforce route protection - redirects unauthenticated users to login
 * and prevents access to protected pages via back navigation
 */
export function enforceRouteProtection(isAuthenticated: boolean, requiredRole?: string, userRole?: string | null): boolean {
  if (typeof window === 'undefined') return false;
  
  // If not authenticated and trying to access protected route
  if (!isAuthenticated && !isAuthRoute()) {
    redirectToLogin({ replace: true });
    return false;
  }
  
  // If role-based protection
  if (isAuthenticated && requiredRole && userRole && userRole !== requiredRole) {
    // User doesn't have required role - redirect to appropriate home
    // For now, allow but log warning (in full multi-app setup, would redirect to role-specific dashboard)
    console.warn(`[Nexora] Role mismatch: required ${requiredRole}, got ${userRole}`);
    // Don't block, just warn - customer app currently handles both roles
  }
  
  return true;
}

/** Return to the application root after a successful sign-in. */
export function redirectToApp(): boolean {
  if (typeof window === 'undefined') return false;
  if (!isAuthRoute()) return false;

  window.history.replaceState({ nexoraAuth: 'app' }, '', '/');
  window.dispatchEvent(new PopStateEvent('popstate'));
  return true;
}

/**
 * Strip Supabase's `?code=` / `#access_token=` fragments once
 * `detectSessionInUrl` has consumed them, so a reload cannot replay a
 * spent authorization code and bounce the user back to login.
 */
export function cleanAuthParamsFromUrl(): void {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  const dirtyParams = ['code', 'error', 'error_description', 'error_code'];
  let changed = false;

  for (const param of dirtyParams) {
    if (url.searchParams.has(param)) {
      url.searchParams.delete(param);
      changed = true;
    }
  }

  if (url.hash.includes('access_token') || url.hash.includes('refresh_token')) {
    url.hash = '';
    changed = true;
  }

  if (changed) {
    window.history.replaceState(window.history.state, '', url.toString());
  }
}
