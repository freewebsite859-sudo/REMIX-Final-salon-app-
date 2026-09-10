/**
 * Invite-link redirects — the HTTP half of `https://<host>/invite?code=NX-…`.
 *
 * The SPA already knows how to open signup from an invite URL, but relying on
 * React alone leaves three holes this module closes:
 *
 *   • A static host with no SPA fallback answers `/invite` with a 404 — React
 *     never boots, so the invited visitor sees an error page.
 *   • A visitor with JS disabled (or a link preview crawler, or WhatsApp's
 *     unfurler) gets nothing.
 *   • A full page load of `/invite?code=NX-…` hands the `code` query param to
 *     Supabase's `detectSessionInUrl`, which treats it as a PKCE authorization
 *     code. We redirect to `?ref=`, which GoTrue never reads.
 *
 * So the server answers the invite paths with a real 302 to the signup screen
 * before anything else runs. Mounted in `server.ts` (dev + production) and in
 * the Vite dev-server plugin, so every way of running this app behaves alike.
 */

import type { Express, Request, Response, NextFunction } from 'express';

/** Mirrors `src/lib/inviteLink.ts` (kept inline so this file has no bundle deps). */
const INVITE_PATHS = ['/invite', '/invited', '/join', '/ref', '/refer', '/referral-link', '/r'];
const CODE_PARAMS = ['code', 'ref', 'referral', 'referral_code', 'invite', 'invite_code', 'rc'];
const SIGNUP_REFERRAL_PARAM = 'ref';
const CUSTOMER_SIGNUP = '/customer/signup';
const LEGACY_SIGNUP = '/auth/signup';

/** Same contract as `normalizeReferralCode`: upper-case, URL-safe, 4–24 chars. */
export function normalizeInviteCode(raw?: string | null): string {
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

function normalizePathname(pathname: string): string {
  const trimmed = (pathname || '/').replace(/\/+$/, '') || '/';
  return trimmed.length > 1 ? trimmed.toLowerCase() : trimmed;
}

/** True for `/invite`, `/invite/NX-ABC`, `/r/NX-ABC`, … */
export function isInvitePathname(pathname: string): boolean {
  const path = normalizePathname(pathname);
  if (INVITE_PATHS.includes(path)) return true;
  return INVITE_PATHS.some(
    (base) => path.startsWith(`${base}/`) && path.slice(base.length + 1).length > 0
  );
}

function decodeSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Pure resolver: given a request target (`/invite?code=NX-VIJAY634`) return the
 * signup path to redirect to, or null when the request is not ours to touch.
 *
 * Two families are rewritten:
 *   1. invite paths (`/invite`, `/r/:code`, `/join`, …) — always → signup;
 *   2. signup URLs that carry the code in the unsafe `?code=` param — rewritten
 *      to `?ref=` so GoTrue cannot mistake it for a PKCE authorization code.
 */
export function resolveInviteRedirect(target: string): string | null {
  const [rawPath, rawQuery = ''] = String(target || '').split('?');
  const path = normalizePathname(rawPath);
  const params = new URLSearchParams(rawQuery);

  let code = '';
  for (const key of CODE_PARAMS) {
    const found = normalizeInviteCode(params.get(key));
    if (found) {
      code = found;
      break;
    }
  }
  if (!code && isInvitePathname(path)) {
    // Path-segment form: /invite/NX-ABC, /r/nx-abc
    for (const base of INVITE_PATHS) {
      if (path.startsWith(`${base}/`)) {
        const segment = path.slice(base.length + 1).split('/')[0];
        const found = normalizeInviteCode(decodeSafe(segment));
        if (found) {
          code = found;
          break;
        }
      }
    }
  }

  const isInvite = isInvitePathname(path);
  const isSignup = path === normalizePathname(CUSTOMER_SIGNUP) || path === LEGACY_SIGNUP;
  if (!isInvite && !isSignup) return null;

  // On the signup screen only the unsafe `?code=` needs rewriting; leaving a
  // clean `/customer/signup` (or one already using ?ref=) alone avoids a loop.
  if (!isInvite && !code) return null;
  if (!isInvite && params.get(SIGNUP_REFERRAL_PARAM) && !params.get('code')) return null;

  const destination = code
    ? `${CUSTOMER_SIGNUP}?${SIGNUP_REFERRAL_PARAM}=${encodeURIComponent(code)}`
    : CUSTOMER_SIGNUP;
  if (destination === `${path}${rawQuery ? `?${rawQuery}` : ''}`) return null;
  return destination;
}

/** Connect-compatible middleware (works in Express and in Vite's dev server). */
export function inviteRedirectMiddleware() {
  return function nexoraInviteRedirect(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }
    const url = req.url || '/';
    // Never touch API or asset routes.
    if (url.startsWith('/api') || url.startsWith('/@') || /\.[a-z0-9]+(\?|$)/i.test(url)) {
      next();
      return;
    }
    const destination = resolveInviteRedirect(url);
    if (!destination) {
      next();
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vary', 'Accept-Encoding');
    res.writeHead(302, { Location: destination });
    res.end();
  };
}

/** Attach the invite redirects to an Express app (must come before static/SPA). */
export function attachInviteRedirects(app: Express): void {
  app.use(inviteRedirectMiddleware());
}
