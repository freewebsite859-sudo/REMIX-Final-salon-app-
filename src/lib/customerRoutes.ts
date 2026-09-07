/**
 * Nexora Customer App routes.
 *
 * The customer shell is still a single-page app (no React Router). Routes are
 * expressed with the History API so the Supabase client and in-memory session
 * stay alive across navigations — the same contract as `authRoutes.ts`.
 *
 * Canonical paths:
 *   /customer
 *   /customer/login
 *   /customer/signup
 *   /customer/home
 *   /customer/search
 *   /customer/salon/:salonSlug
 *   /customer/book/:salonId
 *   /customer/bookings
 *   /customer/booking/:bookingId
 *   /customer/rewards
 *   /customer/membership
 *   /customer/favourites
 *   /customer/profile
 *   /customer/settings
 *   /customer/referral
 *   /customer/reviews
 *   /customer/notifications
 */

import type { ActiveTab } from '../types';

// ---------------------------------------------------------------------------
// Path constants
// ---------------------------------------------------------------------------

export const CUSTOMER_ROOT = '/customer';
export const CUSTOMER_HOME = '/customer/home';
export const CUSTOMER_LOGIN = '/customer/login';
export const CUSTOMER_SIGNUP = '/customer/signup';
export const CUSTOMER_SEARCH = '/customer/search';
export const CUSTOMER_BOOKINGS = '/customer/bookings';
export const CUSTOMER_REWARDS = '/customer/rewards';
export const CUSTOMER_MEMBERSHIP = '/customer/membership';
export const CUSTOMER_FAVOURITES = '/customer/favourites';
export const CUSTOMER_PROFILE = '/customer/profile';
export const CUSTOMER_SETTINGS = '/customer/settings';
export const CUSTOMER_REFERRAL = '/customer/referral';
export const CUSTOMER_REVIEWS = '/customer/reviews';
export const CUSTOMER_NOTIFICATIONS = '/customer/notifications';

/** Prefix used for salon detail pages: `/customer/salon/:salonSlug`. */
export const CUSTOMER_SALON_PREFIX = '/customer/salon/';
/** Prefix used for the booking flow: `/customer/book/:salonId`. */
export const CUSTOMER_BOOK_PREFIX = '/customer/book/';
/** Prefix used for a single booking detail: `/customer/booking/:bookingId`. */
export const CUSTOMER_BOOKING_PREFIX = '/customer/booking/';

/** Session key for the post-login return path (e.g. a book attempt while logged out). */
export const CUSTOMER_RETURN_PATH_KEY = 'nexora-customer-return-path';

// ---------------------------------------------------------------------------
// Route kinds
// ---------------------------------------------------------------------------

export type CustomerRouteKind =
  | 'root'
  | 'login'
  | 'signup'
  | 'home'
  | 'search'
  | 'salon'
  | 'book'
  | 'bookings'
  | 'booking'
  | 'rewards'
  | 'membership'
  | 'favourites'
  | 'profile'
  | 'settings'
  | 'referral'
  | 'reviews'
  | 'notifications'
  | 'unknown';

export interface CustomerRoute {
  kind: CustomerRouteKind;
  path: string;
  /** Present for `/customer/salon/:salonSlug`. */
  salonSlug?: string;
  /** Present for `/customer/book/:salonId`. */
  salonId?: string;
  /** Present for `/customer/booking/:bookingId`. */
  bookingId?: string;
  /** Optional free-text query (`?q=` on search). */
  query?: string;
}

/** Auth screens under the customer namespace (and their legacy aliases). */
const CUSTOMER_AUTH_PATHS = new Set<string>([CUSTOMER_LOGIN, CUSTOMER_SIGNUP]);

/** Routes that require an authenticated session. */
const PROTECTED_KINDS = new Set<CustomerRouteKind>([
  'book',
  'bookings',
  'booking',
  'rewards',
  'membership',
  'profile',
  'settings',
  'referral',
  'reviews',
  'notifications',
]);

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

export function currentPathname(): string {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname || '/';
}

export function currentSearch(): string {
  if (typeof window === 'undefined') return '';
  return window.location.search || '';
}

/** True when the path is under `/customer` (including exact `/customer`). */
export function isCustomerPath(path: string = currentPathname()): boolean {
  return path === CUSTOMER_ROOT || path.startsWith(`${CUSTOMER_ROOT}/`);
}

export function isCustomerAuthPath(path: string = currentPathname()): boolean {
  return CUSTOMER_AUTH_PATHS.has(path);
}

export function isCustomerLoginPath(path: string = currentPathname()): boolean {
  return path === CUSTOMER_LOGIN;
}

export function isCustomerSignupPath(path: string = currentPathname()): boolean {
  return path === CUSTOMER_SIGNUP;
}

/**
 * Decode a URL segment without throwing on malformed percent-encoding.
 */
function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * Build a URL-safe slug from a salon name/id. Used when opening salon detail
 * for a catalog row that has no dedicated slug column.
 */
export function slugifySalon(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'salon';
}

export function customerSalonPath(salonSlug: string): string {
  return `${CUSTOMER_SALON_PREFIX}${encodeURIComponent(salonSlug)}`;
}

export function customerBookPath(salonId: string): string {
  return `${CUSTOMER_BOOK_PREFIX}${encodeURIComponent(salonId)}`;
}

export function customerBookingPath(bookingId: string): string {
  return `${CUSTOMER_BOOKING_PREFIX}${encodeURIComponent(bookingId)}`;
}

export function customerSearchPath(query?: string): string {
  if (!query || !query.trim()) return CUSTOMER_SEARCH;
  return `${CUSTOMER_SEARCH}?q=${encodeURIComponent(query.trim())}`;
}

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

/**
 * Parse a pathname (+ optional search) into a typed customer route.
 * Non-customer paths return `{ kind: 'unknown' }`.
 */
export function parseCustomerRoute(
  path: string = currentPathname(),
  search: string = currentSearch()
): CustomerRoute {
  const normalized = path.replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(
    search.startsWith('?') ? search.slice(1) : search
  );
  const q = params.get('q') || undefined;

  if (normalized === CUSTOMER_ROOT) {
    return { kind: 'root', path: normalized };
  }
  if (normalized === CUSTOMER_LOGIN) {
    return { kind: 'login', path: normalized };
  }
  if (normalized === CUSTOMER_SIGNUP) {
    return { kind: 'signup', path: normalized };
  }
  if (normalized === CUSTOMER_HOME) {
    return { kind: 'home', path: normalized };
  }
  if (normalized === CUSTOMER_SEARCH) {
    return { kind: 'search', path: normalized, query: q };
  }
  if (normalized === CUSTOMER_BOOKINGS) {
    return { kind: 'bookings', path: normalized };
  }
  if (normalized === CUSTOMER_REWARDS) {
    return { kind: 'rewards', path: normalized };
  }
  if (normalized === CUSTOMER_MEMBERSHIP) {
    return { kind: 'membership', path: normalized };
  }
  if (normalized === CUSTOMER_FAVOURITES) {
    return { kind: 'favourites', path: normalized };
  }
  if (normalized === CUSTOMER_PROFILE) {
    return { kind: 'profile', path: normalized };
  }
  if (normalized === CUSTOMER_SETTINGS) {
    return { kind: 'settings', path: normalized };
  }
  if (normalized === CUSTOMER_REFERRAL) {
    return { kind: 'referral', path: normalized };
  }
  if (normalized === CUSTOMER_REVIEWS) {
    return { kind: 'reviews', path: normalized };
  }
  if (normalized === CUSTOMER_NOTIFICATIONS) {
    return { kind: 'notifications', path: normalized };
  }

  if (normalized.startsWith(CUSTOMER_SALON_PREFIX)) {
    const slug = safeDecode(normalized.slice(CUSTOMER_SALON_PREFIX.length).split('/')[0] || '');
    if (slug) return { kind: 'salon', path: normalized, salonSlug: slug };
  }

  if (normalized.startsWith(CUSTOMER_BOOK_PREFIX)) {
    const salonId = safeDecode(normalized.slice(CUSTOMER_BOOK_PREFIX.length).split('/')[0] || '');
    if (salonId) return { kind: 'book', path: normalized, salonId };
  }

  if (normalized.startsWith(CUSTOMER_BOOKING_PREFIX)) {
    const bookingId = safeDecode(
      normalized.slice(CUSTOMER_BOOKING_PREFIX.length).split('/')[0] || ''
    );
    if (bookingId) return { kind: 'booking', path: normalized, bookingId };
  }

  if (isCustomerPath(normalized)) {
    return { kind: 'unknown', path: normalized };
  }

  return { kind: 'unknown', path: normalized };
}

export function isProtectedCustomerRoute(route: CustomerRoute = parseCustomerRoute()): boolean {
  return PROTECTED_KINDS.has(route.kind);
}

/**
 * Map a customer route onto the bottom-nav tab that should appear selected.
 * Overlay routes (salon, book, notifications…) keep the closest parent tab.
 *
 * Bottom-nav items: Home · Search · Bookings · Rewards · Profile
 */
export function customerRouteToTab(route: CustomerRoute): ActiveTab {
  switch (route.kind) {
    case 'search':
      return 'search';
    case 'bookings':
    case 'booking':
    case 'reviews':
      return 'bookings';
    case 'rewards':
      return 'rewards';
    case 'favourites':
      return 'saved';
    case 'profile':
    case 'settings':
    case 'membership':
    case 'referral':
      return 'profile';
    case 'home':
    case 'salon':
    case 'book':
    case 'notifications':
    case 'root':
    default:
      return 'home';
  }
}

/** Inverse of `customerRouteToTab` for bottom-nav clicks. */
export function tabToCustomerPath(tab: ActiveTab): string {
  switch (tab) {
    case 'search':
      return CUSTOMER_SEARCH;
    case 'bookings':
      return CUSTOMER_BOOKINGS;
    case 'rewards':
      return CUSTOMER_REWARDS;
    case 'saved':
      return CUSTOMER_FAVOURITES;
    case 'profile':
      return CUSTOMER_PROFILE;
    case 'home':
    default:
      return CUSTOMER_HOME;
  }
}

// ---------------------------------------------------------------------------
// Navigation (History API — keeps Supabase session alive)
// ---------------------------------------------------------------------------

function navigate(url: string, options: { replace?: boolean; state?: unknown } = {}): boolean {
  if (typeof window === 'undefined') return false;
  const { replace = false, state = { nexoraCustomer: true } } = options;
  const current = `${window.location.pathname}${window.location.search}`;
  if (current === url) {
    // Still broadcast so listeners can re-sync if internal state drifted.
    try {
      window.dispatchEvent(
        typeof PopStateEvent === 'function'
          ? new PopStateEvent('popstate')
          : new Event('popstate')
      );
    } catch {
      /* ignore */
    }
    return false;
  }
  if (replace) {
    window.history.replaceState(state, '', url);
  } else {
    window.history.pushState(state, '', url);
  }
  // Prefer a real PopStateEvent so React listeners see a proper event object;
  // fall back to a plain Event in non-browser test harnesses.
  try {
    window.dispatchEvent(
      typeof PopStateEvent === 'function'
        ? new PopStateEvent('popstate', { state })
        : new Event('popstate')
    );
  } catch {
    try {
      window.dispatchEvent(new Event('popstate'));
    } catch {
      /* ignore */
    }
  }
  return true;
}

export function navigateCustomer(
  path: string,
  options: { replace?: boolean; state?: unknown } = {}
): boolean {
  const url = path.startsWith('/') ? path : `/${path}`;
  return navigate(url, options);
}

/** After login/signup — land on customer home (or a saved return path). */
export function redirectToCustomerHome(options: { replace?: boolean } = {}): boolean {
  const returnPath = consumeCustomerReturnPath();
  const target = returnPath && returnPath.startsWith(CUSTOMER_ROOT) ? returnPath : CUSTOMER_HOME;
  return navigate(target, { replace: options.replace ?? true, state: { nexoraCustomer: 'home' } });
}

/**
 * Alias used by the rest of the app after a successful auth. Prefer customer
 * home over the bare `/` root so deep links stay under `/customer/*`.
 */
export function redirectToCustomerApp(options: { replace?: boolean } = {}): boolean {
  return redirectToCustomerHome(options);
}

export function redirectToCustomerLogin(
  options: { replace?: boolean; returnTo?: string } = {}
): boolean {
  if (typeof window === 'undefined') return false;
  if (isCustomerLoginPath() || currentPathname() === '/auth/login') {
    if (options.returnTo) rememberCustomerReturnPath(options.returnTo);
    return false;
  }
  if (options.returnTo) rememberCustomerReturnPath(options.returnTo);
  const url = `${CUSTOMER_LOGIN}${window.location.search}`;
  return navigate(url, {
    replace: options.replace ?? true,
    state: { nexoraCustomer: 'login' },
  });
}

export function redirectToCustomerSignup(options: { replace?: boolean } = {}): boolean {
  if (typeof window === 'undefined') return false;
  if (isCustomerSignupPath() || currentPathname() === '/auth/signup') return false;
  const url = `${CUSTOMER_SIGNUP}${window.location.search}`;
  return navigate(url, {
    replace: options.replace ?? true,
    state: { nexoraCustomer: 'signup' },
  });
}

/**
 * Remember where the guest was trying to go (typically a book URL) so we can
 * send them back after a successful login/signup.
 */
export function rememberCustomerReturnPath(path: string): void {
  if (typeof window === 'undefined') return;
  // Never store auth screens as a return target — that would loop.
  if (
    path === CUSTOMER_LOGIN ||
    path === CUSTOMER_SIGNUP ||
    path === '/auth/login' ||
    path === '/auth/signup' ||
    path.startsWith('/auth/')
  ) {
    return;
  }
  try {
    sessionStorage.setItem(CUSTOMER_RETURN_PATH_KEY, path);
  } catch {
    /* storage unavailable */
  }
}

export function consumeCustomerReturnPath(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = sessionStorage.getItem(CUSTOMER_RETURN_PATH_KEY);
    sessionStorage.removeItem(CUSTOMER_RETURN_PATH_KEY);
    return value;
  } catch {
    return null;
  }
}

export function peekCustomerReturnPath(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(CUSTOMER_RETURN_PATH_KEY);
  } catch {
    return null;
  }
}

/**
 * If the user is not authenticated and the current (or given) route is a book
 * attempt, stash the destination and send them to login.
 *
 * Returns `true` when a redirect was performed.
 */
export function requireAuthForBooking(
  isAuthenticated: boolean,
  bookPath: string = currentPathname()
): boolean {
  if (isAuthenticated) return false;
  const route = parseCustomerRoute(bookPath);
  const returnTo =
    route.kind === 'book' || bookPath.startsWith(CUSTOMER_BOOK_PREFIX)
      ? bookPath
      : bookPath.startsWith(CUSTOMER_ROOT)
        ? bookPath
        : customerBookPath(route.salonId || 'unknown');
  rememberCustomerReturnPath(returnTo);
  redirectToCustomerLogin({ replace: true, returnTo });
  return true;
}

/**
 * Normalise entry URLs:
 *   `/` or bare `/customer`  → `/customer/home` (when already authenticated,
 *                              callers decide; this only rewrites the path).
 *   unknown `/customer/*`    → `/customer/home`
 */
export function canonicalizeCustomerPath(
  path: string = currentPathname(),
  options: { replace?: boolean; authenticated?: boolean } = {}
): string {
  const route = parseCustomerRoute(path);

  if (path === '/' || path === '') {
    return options.authenticated ? CUSTOMER_HOME : CUSTOMER_HOME;
  }

  if (route.kind === 'root') {
    const target = CUSTOMER_HOME;
    if (path !== target) {
      navigate(target, { replace: options.replace ?? true });
    }
    return target;
  }

  if (isCustomerPath(path) && route.kind === 'unknown') {
    navigate(CUSTOMER_HOME, { replace: options.replace ?? true });
    return CUSTOMER_HOME;
  }

  return path;
}

/**
 * Full list of customer route path patterns (for docs / smoke checks).
 * Dynamic segments are shown with a leading `:`.
 */
export const CUSTOMER_ROUTE_CATALOG: readonly string[] = [
  CUSTOMER_ROOT,
  CUSTOMER_LOGIN,
  CUSTOMER_SIGNUP,
  CUSTOMER_HOME,
  CUSTOMER_SEARCH,
  `${CUSTOMER_SALON_PREFIX}:salonSlug`,
  `${CUSTOMER_BOOK_PREFIX}:salonId`,
  CUSTOMER_BOOKINGS,
  `${CUSTOMER_BOOKING_PREFIX}:bookingId`,
  CUSTOMER_REWARDS,
  CUSTOMER_MEMBERSHIP,
  CUSTOMER_FAVOURITES,
  CUSTOMER_PROFILE,
  CUSTOMER_SETTINGS,
  CUSTOMER_REFERRAL,
  CUSTOMER_REVIEWS,
  CUSTOMER_NOTIFICATIONS,
] as const;
