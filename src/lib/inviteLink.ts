/**
 * Nexora invite (referral) deep links.
 *
 * Shared links look like:
 *   https://nexora.app/invite?code=NX-VIJAY634
 *
 * Before this module existed `/invite` was not a known route at all, so the
 * SPA canonicalised it to `/customer/home`: the visitor saw the guest home
 * screen, the referral code in the query string was thrown away and nobody was
 * ever counted. These helpers make the link do the three things it promises:
 *
 *   1. OPEN SIGNUP  — an invite path always lands on the signup form.
 *   2. CARRY CODE   — the code is parsed from the URL, kept in the address bar
 *                     (`/customer/signup?code=NX-VIJAY634`) and stashed in
 *                     localStorage so it survives a reload or a navigation.
 *   3. COUNT IT     — `referralService.registerReferralAfterSignup` turns the
 *                     stashed code into a referral row + reward points.
 */

import { CUSTOMER_SIGNUP } from './customerRoutes';

/** Paths that mean "someone invited me". `/r/:code` and friends are aliases. */
export const INVITE_PATHS: readonly string[] = [
  '/invite',
  '/invited',
  '/join',
  '/ref',
  '/r',
  '/refer',
  '/referral-link',
];

/** Query params accepted on an invite link (`?code=` is the canonical one). */
export const INVITE_CODE_PARAMS: readonly string[] = [
  'code',
  'ref',
  'referral',
  'referral_code',
  'invite',
  'invite_code',
  'rc',
];

/** Session-persistent stash for the code, so a reload cannot lose it. */
export const PENDING_REFERRAL_CODE_KEY = 'nexora-pending-referral-code';

/** Origin used when rendering shareable links. */
export const INVITE_ORIGIN = 'https://nexora.app';

function normalizePathname(pathname: string): string {
  const trimmed = (pathname || '/').replace(/\/+$/, '') || '/';
  return trimmed.length > 1 ? trimmed.toLowerCase() : trimmed;
}

/**
 * Sanitise a referral code: uppercase, URL-safe characters only, 4–24 chars.
 * Returns an empty string when nothing usable is left (never a partial code).
 */
export function normalizeReferralCode(raw?: string | null): string {
  if (raw === null || raw === undefined) return '';
  const cleaned = String(raw)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  return cleaned.length >= 4 ? cleaned : '';
}

/** True for `/invite`, `/invite/NX-ABC`, `/join`, `/r/NX-ABC`, … */
export function isInvitePath(pathname: string): boolean {
  const path = normalizePathname(pathname);
  if (INVITE_PATHS.includes(path)) return true;
  return INVITE_PATHS.some(
    (base) => path.startsWith(`${base}/`) && path.slice(base.length + 1).length > 0
  );
}

/** Code carried in a path segment: `/invite/NX-ABC` → `NX-ABC`. */
function codeFromPathname(pathname: string): string {
  const path = normalizePathname(pathname);
  for (const base of INVITE_PATHS) {
    if (path.startsWith(`${base}/`)) {
      const segment = path.slice(base.length + 1).split('/')[0];
      const code = normalizeReferralCode(decodeURIComponentSafe(segment));
      if (code) return code;
    }
  }
  return '';
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Extract the referral code from an invite URL. Query string wins over the
 * path segment, because `?code=` is what the share buttons generate.
 */
export function extractReferralCode(search?: string, pathname = ''): string {
  const query = search ?? (typeof window !== 'undefined' ? window.location.search : '');
  if (query) {
    const params = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
    for (const key of INVITE_CODE_PARAMS) {
      const code = normalizeReferralCode(params.get(key));
      if (code) return code;
    }
  }
  return codeFromPathname(pathname);
}

/** Canonical signup URL that keeps the code visible in the address bar. */
export function inviteSignupPath(code?: string | null): string {
  const normalized = normalizeReferralCode(code);
  return normalized
    ? `${CUSTOMER_SIGNUP}?code=${encodeURIComponent(normalized)}`
    : CUSTOMER_SIGNUP;
}

/** Shareable link for a code (what the copy/share buttons emit). */
export function buildInviteLink(code: string, origin: string = INVITE_ORIGIN): string {
  const normalized = normalizeReferralCode(code);
  return normalized
    ? `${origin.replace(/\/+$/, '')}/invite?code=${encodeURIComponent(normalized)}`
    : `${origin.replace(/\/+$/, '')}/invite`;
}

// ---------------------------------------------------------------------------
// Pending-code stash (survives navigation, reloads and the signup redirect)
// ---------------------------------------------------------------------------

interface PendingReferral {
  code: string;
  at: string;
}

function readPendingRaw(): PendingReferral | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PENDING_REFERRAL_CODE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingReferral;
    const code = normalizeReferralCode(parsed?.code);
    return code ? { code, at: parsed?.at || new Date(0).toISOString() } : null;
  } catch {
    return null;
  }
}

/** Remember the code from an invite link until a signup consumes it. */
export function rememberPendingReferralCode(code?: string | null): string {
  const normalized = normalizeReferralCode(code);
  if (!normalized || typeof window === 'undefined') return '';
  try {
    window.localStorage.setItem(
      PENDING_REFERRAL_CODE_KEY,
      JSON.stringify({ code: normalized, at: new Date().toISOString() })
    );
  } catch {
    /* storage unavailable — the URL copy still works */
  }
  return normalized;
}

/** Current pending code without clearing it (the signup form prefill). */
export function peekPendingReferralCode(): string {
  return readPendingRaw()?.code || '';
}

/**
 * Pending code from the URL if present, else the stashed one. This is what the
 * signup form should show.
 */
export function resolveReferralCodeForSignup(
  search?: string,
  pathname?: string
): string {
  const fromUrl = extractReferralCode(
    search,
    pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '')
  );
  if (fromUrl) return rememberPendingReferralCode(fromUrl);
  return peekPendingReferralCode();
}

/** Consume the stashed code (after the referral has been registered). */
export function consumePendingReferralCode(): string {
  const code = peekPendingReferralCode();
  if (code && typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(PENDING_REFERRAL_CODE_KEY);
    } catch {
      /* ignore */
    }
  }
  return code;
}

export function clearPendingReferralCode(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PENDING_REFERRAL_CODE_KEY);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

export interface InviteRouteResolution {
  /** True when the current URL is an invite deep link. */
  isInvite: boolean;
  /** Normalised code found in the link ('' when the link carried none). */
  code: string;
  /** Canonical signup URL the visitor should be sent to. */
  target: string;
}

/** Resolve an invite URL (pure — no navigation) for tests and guards. */
export function resolveInviteRoute(
  pathname?: string,
  search?: string
): InviteRouteResolution {
  const path = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '/');
  const query = search ?? (typeof window !== 'undefined' ? window.location.search : '');
  if (!isInvitePath(path)) {
    return { isInvite: false, code: '', target: path };
  }
  const code = extractReferralCode(query, path);
  if (code) rememberPendingReferralCode(code);
  return { isInvite: true, code, target: inviteSignupPath(code) };
}

/**
 * Rewrite an invite deep link to `/customer/signup?code=…` using the History
 * API (same contract as the rest of the router — no full page load, so the
 * Supabase client and its session survive).
 *
 * Returns the code found on the link ('' when the path was not an invite link).
 */
export function redirectInviteToSignup(options: { replace?: boolean } = {}): string {
  if (typeof window === 'undefined') return '';
  const { isInvite, code, target } = resolveInviteRoute(
    window.location.pathname,
    window.location.search
  );
  if (!isInvite) return '';

  const current = `${window.location.pathname}${window.location.search}`;
  if (current !== target) {
    const state = { nexoraAuth: 'signup', nexoraInviteCode: code || undefined };
    if (options.replace ?? true) {
      window.history.replaceState(state, '', target);
    } else {
      window.history.pushState(state, '', target);
    }
  }
  try {
    window.dispatchEvent(
      typeof PopStateEvent === 'function'
        ? new PopStateEvent('popstate', { state: { nexoraAuth: 'signup' } })
        : new Event('popstate')
    );
  } catch {
    /* non-browser harness */
  }
  return code;
}
