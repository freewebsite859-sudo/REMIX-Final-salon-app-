/**
 * Nexora invite (referral) deep links.
 *
 * A shareable link looks like:
 *
 *   https://<deployment-origin>/invite?code=NX-VIJAY634
 *
 * This module is the single source of truth for that URL and for everything the
 * link promises. Four guarantees, in the order they can fail:
 *
 *   1. THE LINK LOADS SOMETHING REAL.
 *      The origin is derived from the deployment (VITE_APP_URL → APP_URL →
 *      window.location.origin), never from a hardcoded marketing domain, so a
 *      link copied in staging opens staging and a link copied in dev opens dev.
 *      `/invite` is additionally answered by the Node server with a real HTTP
 *      302 (see `server/inviteRedirects.ts`) and by a pre-React capture script
 *      in `index.html`, so the link survives a cold load, a static host with no
 *      SPA fallback, and a browser that has not run our bundle yet.
 *
 *   2. THE CODE IS KEPT.
 *      Parsed from `?code=`, `?ref=`, `…` aliases or a path segment
 *      (`/r/NX-ABC`), stashed in localStorage under
 *      `PENDING_REFERRAL_CODE_KEY` (plus `window.__NEXORA_INVITE__` for private
 *      modes where storage throws), and re-attached to the signup URL so a
 *      reload or a back-button press cannot lose it.
 *
 *   3. IT NEVER COLLIDES WITH SUPABASE AUTH.
 *      GoTrue's `detectSessionInUrl` treats a `?code=` query param as a PKCE
 *      authorization code. The PUBLIC link keeps `?code=` (that is the format
 *      already shared in WhatsApp threads), but the INTERNAL signup URL uses
 *      `?ref=`, so a referral code can never be handed to the token exchange —
 *      and `cleanAuthParamsFromUrl()` only deletes `?code=` when it looks like
 *      a spent auth code, never when it looks like a referral.
 *
 *   4. IT IS COUNTED.
 *      `referralService.registerReferralAfterSignup` turns the code into a
 *      pending referral row and, after the friend's ₹100+ QR payment, 150
 *      points for the referrer.
 */

import { CUSTOMER_SIGNUP } from './customerRoutes';

/** Paths that mean "someone invited me". `/r/:code` and friends are aliases. */
export const INVITE_PATHS: readonly string[] = [
  '/invite',
  '/invited',
  '/join',
  '/ref',
  '/refer',
  '/referral-link',
  '/r',
];

/**
 * Query params accepted on an invite link. `code` is first because it is what
 * the share buttons emit and what is already circulating.
 */
export const INVITE_CODE_PARAMS: readonly string[] = [
  'code',
  'ref',
  'referral',
  'referral_code',
  'invite',
  'invite_code',
  'rc',
];

/** Param used in PUBLIC shared links. */
export const PUBLIC_INVITE_PARAM = 'code';

/**
 * Param used on the internal signup URL. Deliberately NOT `code`: see
 * guarantee (3) in the header — `code` belongs to Supabase's PKCE exchange.
 */
export const SIGNUP_REFERRAL_PARAM = 'ref';

/** Session-persistent stash for the code, so a reload cannot lose it. */
export const PENDING_REFERRAL_CODE_KEY = 'nexora-pending-referral-code';

/** In-memory mirror of the stash, written by the pre-React capture script. */
export const INVITE_BOOT_MARKER = '__NEXORA_INVITE__';

/** Last-resort origin, used only when no deployment origin can be determined. */
export const INVITE_ORIGIN = 'https://nexora.app';

/** The shipped code shape: `NX-VIJAY634`. */
const REFERRAL_CODE_SHAPE = /^NX-[A-Z0-9-]{2,}$/;

// ---------------------------------------------------------------------------
// Small primitives
// ---------------------------------------------------------------------------

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

/**
 * True when a raw URL value is a human referral code rather than a Supabase
 * authorization code. GoTrue codes are long mixed-case base64url blobs; Nexora
 * codes are short, upper-case and `NX-`prefixed.
 */
export function isReferralCodeValue(raw?: string | null): boolean {
  const value = String(raw ?? '').trim();
  if (!value) return false;
  const normalized = normalizeReferralCode(value);
  if (!normalized || normalized.length > 24) return false;
  if (REFERRAL_CODE_SHAPE.test(normalized)) return true;
  // Anything else only counts when the URL value is already exactly its own
  // sanitised upper-case form — an auth code never is.
  return value === value.toUpperCase() && value === normalized;
}
/** True for `/invite`, `/invite/NX-ABC`, `/join`, `/r/NX-ABC`, … */
export function isInvitePath(pathname: string): boolean {
  const path = normalizePathname(pathname);
  if (INVITE_PATHS.includes(path)) return true;
  return INVITE_PATHS.some(
    (base) => path.startsWith(`${base}/`) && path.slice(base.length + 1).length > 0
  );
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Code carried in a path segment: `/invite/NX-ABC` → `NX-ABC`. */
export function referralCodeFromPathname(pathname: string): string {
  const path = normalizePathname(pathname);
  for (const base of INVITE_PATHS) {
    if (path.startsWith(`${base}/`)) {
      const segment = path.slice(base.length + 1).split('/')[0];
      const decoded = decodeURIComponentSafe(segment);
      const code = isReferralCodeValue(decoded) ? normalizeReferralCode(decoded) : '';
      if (code) return code;
    }
  }
  return '';
}

/**
 * Extract the referral code from an invite URL. Query string wins over the
 * path segment, because `?code=` is what the share buttons generate.
 *
 * URL values are checked with `isReferralCodeValue` rather than merely
 * normalised, so a Supabase authorization code sitting in `?code=` (password
 * reset, OAuth return) can never be mistaken for a referral code.
 */
export function extractReferralCode(search?: string, pathname = ''): string {
  const query = search ?? (typeof window !== 'undefined' ? window.location.search : '');
  if (query) {
    const params = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
    for (const key of INVITE_CODE_PARAMS) {
      const raw = params.get(key);
      if (!isReferralCodeValue(raw)) continue;
      const code = normalizeReferralCode(raw);
      if (code) return code;
    }
  }
  return referralCodeFromPathname(pathname);
}

// ---------------------------------------------------------------------------
// Origin — why "the link does nothing" is usually the whole bug
// ---------------------------------------------------------------------------

/**
 * Read a build-time (`import.meta.env`) or runtime (`process.env`) variable.
 * Wrapped so the same module is safe in a browser bundle, in `tsx`, and in the
 * esbuild CJS server bundle where `import.meta` may be undefined.
 */
function envValue(name: string): string {
  try {
    const meta = (import.meta as unknown as { env?: Record<string, string | undefined> })?.env;
    const fromVite = meta?.[name];
    if (typeof fromVite === 'string' && fromVite.trim()) return fromVite.trim();
  } catch {
    /* import.meta unavailable — fall through to process.env */
  }
  try {
    const fromNode = (
      globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }
    ).process?.env?.[name];
    if (typeof fromNode === 'string' && fromNode.trim()) return fromNode.trim();
  } catch {
    /* no process (browser) */
  }
  return '';
}

/** Accepts `https://host`, `host`, `//host`; rejects placeholders like `MY_APP_URL`. */
function normalizeOrigin(value?: string | null): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const candidate = /^https?:\/\//i.test(raw)
    ? raw
    : /^\/\//.test(raw)
      ? `https:${raw}`
      : /^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?$/i.test(raw) || /^localhost(:\d+)?$/i.test(raw)
        ? `http://${raw}`
        : '';
  if (!candidate) return '';
  try {
    const url = new URL(candidate);
    if (!/^https?:$/.test(url.protocol)) return '';
    // Only an origin: paths/queries in a config value are noise for a link.
    return url.origin;
  } catch {
    return '';
  }
}

/**
 * Origin used when rendering shareable links.
 *
 * Priority: explicit argument → `VITE_APP_URL` → `APP_URL` →
 * `VERCEL_PROJECT_PRODUCTION_URL` → the current browser origin → `nexora.app`.
 *
 * The current origin is preferred over the marketing fallback on purpose: a
 * link that opens the app on the environment it was copied from is far more
 * useful than a pretty domain that serves nothing.
 */
export function resolveInviteOrigin(explicit?: string | null): string {
  const fromEnv =
    normalizeOrigin(explicit) ||
    normalizeOrigin(envValue('VITE_APP_URL')) ||
    normalizeOrigin(envValue('APP_URL')) ||
    normalizeOrigin(envValue('VERCEL_PROJECT_PRODUCTION_URL'));
  if (fromEnv) return fromEnv;
  if (typeof window !== 'undefined' && window.location?.origin) {
    const live = normalizeOrigin(window.location.origin);
    if (live) return live;
  }
  return INVITE_ORIGIN;
}

/** Shareable link for a code (what the copy/share buttons emit). */
export function buildInviteLink(code: string, origin?: string | null): string {
  const base = resolveInviteOrigin(origin);
  const normalized = normalizeReferralCode(code);
  return normalized
    ? `${base}/invite?${PUBLIC_INVITE_PARAM}=${encodeURIComponent(normalized)}`
    : `${base}/invite`;
}

/** Internal signup URL that keeps the code visible without using `?code=`. */
export function inviteSignupPath(code?: string | null): string {
  const normalized = normalizeReferralCode(code);
  return normalized
    ? `${CUSTOMER_SIGNUP}?${SIGNUP_REFERRAL_PARAM}=${encodeURIComponent(normalized)}`
    : CUSTOMER_SIGNUP;
}

// ---------------------------------------------------------------------------
// Pending-code stash (survives navigation, reloads and the signup redirect)
// ---------------------------------------------------------------------------

interface PendingReferral {
  code: string;
  at: string;
}

interface InviteBootMarker {
  code?: string;
  at?: string;
  cameFromInvite?: boolean;
}

function readStashRaw(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(PENDING_REFERRAL_CODE_KEY) || '';
  } catch {
    return '';
  }
}

/** Value the pre-React capture script left on `window`, if any. */
function readBootMarkerRaw(): InviteBootMarker | null {
  if (typeof window === 'undefined') return null;
  const marker = (window as unknown as { [INVITE_BOOT_MARKER]?: InviteBootMarker })[
    INVITE_BOOT_MARKER
  ];
  return marker && typeof marker === 'object' ? marker : null;
}

/** Marker holding a usable code (the shape the referral stash expects). */
function readBootMarker(): InviteBootMarker | null {
  const marker = readBootMarkerRaw();
  return marker && normalizeReferralCode(marker.code) ? marker : null;
}

/**
 * Mirror the code onto `window` so the flow still works when localStorage is
 * blocked (private mode, sandboxed iframe). `cameFromInvite` records that this
 * page load started on an invite link.
 */
function writeBootMarker(code: string, cameFromInvite?: boolean): void {
  if (typeof window === 'undefined' || !code) return;
  try {
    const previous = readBootMarkerRaw();
    (window as unknown as { [INVITE_BOOT_MARKER]?: InviteBootMarker })[INVITE_BOOT_MARKER] = {
      code,
      at: new Date().toISOString(),
      cameFromInvite: Boolean(cameFromInvite || previous?.cameFromInvite),
    };
  } catch {
    /* window not writable — the localStorage copy is enough */
  }
}

function readPendingRaw(): PendingReferral | null {
  const raw = readStashRaw();
  if (raw) {
    // The React side writes JSON; the pre-React script may write the bare code
    // (it must not throw when JSON.parse fails), so accept both shapes.
    try {
      const parsed = JSON.parse(raw) as PendingReferral | string;
      if (typeof parsed === 'string') {
        const code = normalizeReferralCode(parsed);
        return code ? { code, at: new Date(0).toISOString() } : null;
      }
      const code = normalizeReferralCode((parsed as PendingReferral)?.code);
      if (code) return { code, at: (parsed as PendingReferral).at || new Date(0).toISOString() };
    } catch {
      const code = normalizeReferralCode(raw);
      if (code) return { code, at: new Date(0).toISOString() };
    }
  }
  const marker = readBootMarker();
  const markerCode = normalizeReferralCode(marker?.code);
  return markerCode ? { code: markerCode, at: marker?.at || new Date(0).toISOString() } : null;
}

/** Remember the code from an invite link until a signup consumes it. */
export function rememberPendingReferralCode(code?: string | null): string {
  const normalized = normalizeReferralCode(code);
  if (!normalized || typeof window === 'undefined') return '';
  writeBootMarker(normalized, isInvitePath(window.location?.pathname || '/'));
  try {
    window.localStorage.setItem(
      PENDING_REFERRAL_CODE_KEY,
      JSON.stringify({ code: normalized, at: new Date().toISOString() })
    );
  } catch {
    /* storage unavailable (private mode, embed) — the window marker + URL still work */
  }
  return normalized;
}

/**
 * True when THIS page load began on an invite link. The pre-React capture
 * script sets the marker, so the app can tell "invited visitor on the signup
 * screen" from "visitor who reloaded signup earlier in the session" — the
 * difference decides whether an already-signed-in user is shown their own
 * Refer & Earn screen instead of a signup form.
 */
export function cameFromInviteLink(): boolean {
  if (typeof window === 'undefined') return false;
  if (readBootMarkerRaw()?.cameFromInvite === true) return true;
  return isInvitePath(window.location.pathname || '/');
}

/** Current pending code without clearing it (the signup form prefill). */
export function peekPendingReferralCode(): string {
  return readPendingRaw()?.code || '';
}

/**
 * Pending code from the URL if present, else the stashed one. This is what the
 * signup form should show.
 */
export function resolveReferralCodeForSignup(search?: string, pathname?: string): string {
  const path = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '');
  const fromUrl = extractReferralCode(search, path);
  if (fromUrl) return rememberPendingReferralCode(fromUrl);
  return peekPendingReferralCode();
}

/** Consume the stashed code (after the referral has been registered). */
export function consumePendingReferralCode(): string {
  const code = peekPendingReferralCode();
  if (code && typeof window !== 'undefined') {
    clearPendingReferralCode();
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
  try {
    delete (window as unknown as { [INVITE_BOOT_MARKER]?: InviteBootMarker })[INVITE_BOOT_MARKER];
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
  /** Normalised code found on the link ('' when the link carried none). */
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
 * First-thing-on-boot capture: read the referral code out of the address bar,
 * stash it, and (when the URL is an invite link or a signup screen holding the
 * unsafe `?code=`) rewrite the address bar to the signup screen.
 *
 * Runs from `main.tsx` before the Supabase client is constructed, and mirrors
 * the inline script in `index.html` for hosts that serve a stale/edited index.
 * Nothing here navigates or reloads, so a real auth callback (`?code=` from
 * GoTrue) is left strictly alone — it fails the referral-code shape test.
 */
export function captureInviteCode(): {
  code: string;
  stashed: string;
  target: string;
  rewrote: boolean;
  isInvite: boolean;
} {
  const noOp = {
    code: '',
    stashed: '',
    target: inviteSignupPath(''),
    rewrote: false,
    isInvite: false,
  };
  if (typeof window === 'undefined') return noOp;

  const path = window.location.pathname || '/';
  const search = window.location.search || '';
  const isInvite = isInvitePath(path);
  const code = extractReferralCode(search, path);
  const stashed = rememberPendingReferralCode(code) || peekPendingReferralCode();
  if (!stashed) return noOp;

  // Rewrite only where the link's promise is "open signup" (invite paths) or
  // where the param would collide with GoTrue (a signup URL carrying ?code=).
  const pathIsSignup =
    normalizePathname(path) === normalizePathname(CUSTOMER_SIGNUP) ||
    normalizePathname(path) === '/auth/signup';
  const needsRewrite = isInvite || (pathIsSignup && !isSignupReferralUrl(path, search));
  const target = inviteSignupPath(stashed);
  if (needsRewrite) writeLocation(target, stashed, isInvite);

  return { code, stashed, target, rewrote: needsRewrite, isInvite };
}

/** True when the signup screen already carries the code in the safe param. */
export function isSignupReferralUrl(pathname: string, search: string): boolean {
  const path = normalizePathname(pathname);
  if (path !== normalizePathname(CUSTOMER_SIGNUP) && path !== '/auth/signup') return false;
  return Boolean(
    normalizeReferralCode(new URLSearchParams(search.replace(/^\?/, '')).get(SIGNUP_REFERRAL_PARAM))
  );
}

/** Apply a URL via the History API (no reload → the Supabase client survives). */
function writeLocation(target: string, code: string, fromInvite = false): boolean {
  if (typeof window === 'undefined') return false;
  const current = `${window.location.pathname}${window.location.search}`;
  if (current === target) return false;
  const state = { nexoraAuth: 'signup', nexoraInviteCode: code || undefined };
  window.history.replaceState(state, '', target);
  writeBootMarker(code, fromInvite);
  return true;
}

/**
 * Rewrite an invite deep link to `/customer/signup?ref=…` using the History API
 * (same contract as the rest of the router — no full page load, so the
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
