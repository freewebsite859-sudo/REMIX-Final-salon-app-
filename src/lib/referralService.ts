import type { SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './supabase';
import { SIGNUP_PATH, isSignupRoute, redirectToSignup } from './authRoutes';
import type { UserRole } from './profileService';

/**
 * Nexora referral service — the ONE place referral data is read, validated and
 * persisted.
 *
 * Flow (matches the app's existing Supabase auth, it never replaces it):
 *
 *   invite link  →  captureReferralFromUrl()      (untrusted input, normalized)
 *   signup form  →  validateReferralCode()        (database-backed check)
 *   after signup →  createReferralRelationship()  (permanent, DB-enforced)
 *
 * Security notes
 * --------------
 * - A referral code from a URL is UNTRUSTED. It is normalized to `[A-Z0-9]{3,24}`
 *   and re-validated against the database before anything is stored.
 * - The referrer user id is resolved by the database (RPC or trigger), never
 *   taken from the client. A relationship is never stored as bare text.
 * - Only the public referral code ever appears in a URL. No tokens, no user ids.
 * - No service_role key is used anywhere here; writes run with the signed-in
 *   user's JWT and are constrained by RLS (see supabase/policies/referrals.sql).
 */

function readEnv(name: string): string | undefined {
  const viteEnv =
    (import.meta as unknown as { env?: Record<string, string | undefined> })?.env || {};
  const fromVite = viteEnv[name];
  if (fromVite) return fromVite;
  const nodeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env;
  return nodeEnv?.[name];
}

/** Tables/views the client talks to. Names are overridable for reused backends. */
export const REFERRAL_CODES_TABLE =
  readEnv('VITE_NEXORA_REFERRAL_CODES_TABLE')?.trim() || 'referral_codes';
export const REFERRALS_TABLE = readEnv('VITE_NEXORA_REFERRALS_TABLE')?.trim() || 'referrals';
export const REFERRAL_CODE_LOOKUP_VIEW =
  readEnv('VITE_NEXORA_REFERRAL_LOOKUP_VIEW')?.trim() || 'referral_code_lookup';

/** Canonical referral-code shape: public-safe, uppercase, no ambiguous separators. */
export const REFERRAL_CODE_PATTERN = /^[A-Z0-9]{3,24}$/;

/**
 * Query parameter names accepted as a referral code.
 *
 * `ref` is the canonical one used by generated links; the rest are tolerated
 * aliases so links shared from other Nexora surfaces keep working.
 * `code` is deliberately NOT accepted — Supabase PKCE uses `?code=` for the
 * authorization exchange and must never be mistaken for an invite code.
 */
export const REFERRAL_QUERY_PARAMS = [
  'ref',
  'referral',
  'referralcode',
  'referral_code',
  'invite',
  'invitecode',
  'invite_code',
] as const;

/** Temporary (per-tab) referral context — survives reloads and SPA navigation. */
export const REFERRAL_STORAGE_KEY = 'nexora.referral.context';
/** Durable fallback with a TTL, for invitees who close the tab and come back. */
export const REFERRAL_PERSISTENT_KEY = 'nexora.referral.pending';
/** 30 days: an invite stays relevant, but stale context eventually expires. */
export const REFERRAL_CONTEXT_TTL_MS = 1000 * 60 * 60 * 24 * 30;
/**
 * A stored code is only auto-applied to accounts created inside this window,
 * so an existing user who logs in later can never be silently re-attributed.
 */
export const REFERRAL_PENDING_WINDOW_MS = 1000 * 60 * 60 * 24;

/** Business rule: which roles may invite / be invited. Configurable in one place. */
export const REFERRAL_ELIGIBLE_ROLES: UserRole[] = ['customer', 'salon_owner'];

export type ReferralStatus =
  | 'valid'
  | 'invalid'
  | 'inactive'
  | 'self_referral'
  | 'already_referred'
  | 'created'
  | 'unavailable';

export interface ReferralValidation {
  status: Extract<ReferralStatus, 'valid' | 'invalid' | 'inactive' | 'unavailable'>;
  /** Resolved by the database. `null` unless status === 'valid'. */
  referrerUserId: string | null;
  error?: string | null;
}

export interface ReferralSaveResult {
  status: Extract<
    ReferralStatus,
    'created' | 'already_referred' | 'invalid' | 'inactive' | 'self_referral' | 'unavailable'
  >;
  error?: string | null;
}

export interface ReferralContext {
  code: string;
  capturedAt: number;
}

// ---------------------------------------------------------------------------
// Normalization (untrusted input boundary)
// ---------------------------------------------------------------------------

/**
 * Characters tolerated in a RAW code before normalization. A code may be pasted
 * with separators or spaces (`abc-123`, `ABC 123`), but anything outside this
 * set means the input is not a code at all and is rejected outright rather than
 * silently mangled into something that looks valid.
 */
const RAW_REFERRAL_INPUT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 _\-.]{0,31}$/;

/**
 * Normalize an untrusted referral code. Returns `null` for anything that is not
 * a plausible code so garbage from a URL can never reach the database or UI.
 */
export function normalizeReferralCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || !RAW_REFERRAL_INPUT_PATTERN.test(trimmed)) return null;
  const cleaned = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!REFERRAL_CODE_PATTERN.test(cleaned)) return null;
  return cleaned;
}

/**
 * Extract a referral code from a URL string (defaults to the current location).
 * Accepts every alias in `REFERRAL_QUERY_PARAMS`, case-insensitively, and looks
 * in the search string first and in a `#/path?query` hash as a fallback.
 */
export function readReferralCodeFromUrl(url?: string): string | null {
  if (typeof window === 'undefined' && !url) return null;
  const href = url ?? (typeof window !== 'undefined' ? window.location.href : '');
  if (!href) return null;

  let parsed: URL;
  try {
    parsed = new URL(href);
  } catch {
    return null;
  }

  const candidates: string[] = [];
  parsed.searchParams.forEach((value, key) => candidates.push(`${key}=${value}`));

  // Some share tools append the query after the hash: https://app/#/?ref=ABC123
  const hash = parsed.hash || '';
  const hashQueryIndex = hash.indexOf('?');
  const hashParams = new URLSearchParams(hashQueryIndex >= 0 ? hash.slice(hashQueryIndex + 1) : '');
  hashParams.forEach((value, key) => candidates.push(`${key}=${value}`));

  for (const entry of candidates) {
    const separator = entry.indexOf('=');
    if (separator <= 0) continue;
    const key = entry.slice(0, separator).trim().toLowerCase().replace(/[-\s]/g, '');
    const value = decodeURIComponent(entry.slice(separator + 1));
    if (!(REFERRAL_QUERY_PARAMS as readonly string[]).includes(key)) continue;
    const normalized = normalizeReferralCode(value);
    if (normalized) return normalized;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Temporary referral context (client storage is NEVER the source of truth)
// ---------------------------------------------------------------------------

function safeStorage(kind: 'session' | 'local'): Storage | null {
  try {
    const storage = kind === 'session' ? window.sessionStorage : window.localStorage;
    // Some privacy modes throw on access; probe before trusting it.
    const probe = '__nexora_probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

/** Keep the referral context for the rest of the signup journey. */
export function storeReferralContext(code: string): boolean {
  if (typeof window === 'undefined') return false;
  const normalized = normalizeReferralCode(code);
  if (!normalized) return false;
  const payload: ReferralContext = { code: normalized, capturedAt: Date.now() };
  let stored = false;

  const session = safeStorage('session');
  if (session) {
    try {
      session.setItem(REFERRAL_STORAGE_KEY, JSON.stringify(payload));
      stored = true;
    } catch {
      /* storage unavailable */
    }
  }

  const local = safeStorage('local');
  if (local) {
    try {
      local.setItem(REFERRAL_PERSISTENT_KEY, JSON.stringify(payload));
      stored = true;
    } catch {
      /* storage unavailable */
    }
  }
  return stored;
}

/**
 * Read the stored referral context, honouring the TTL on the durable copy.
 * Session storage wins: it is scoped to the active signup journey.
 */
export function getStoredReferralContext(): ReferralContext | null {
  if (typeof window === 'undefined') return null;

  const read = (storage: Storage | null, key: string): ReferralContext | null => {
    if (!storage) return null;
    try {
      const raw = storage.getItem(key);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) return null;
      const record = parsed as { code?: unknown; capturedAt?: unknown };
      const code = normalizeReferralCode(record.code);
      if (!code) return null;
      const capturedAt = typeof record.capturedAt === 'number' ? record.capturedAt : 0;
      if (capturedAt && Date.now() - capturedAt > REFERRAL_CONTEXT_TTL_MS) {
        storage.removeItem(key);
        return null;
      }
      return { code, capturedAt };
    } catch {
      try {
        storage.removeItem(key);
      } catch {
        /* ignore */
      }
      return null;
    }
  };

  return read(safeStorage('session'), REFERRAL_STORAGE_KEY) ??
    read(safeStorage('local'), REFERRAL_PERSISTENT_KEY);
}

export function getStoredReferralCode(): string | null {
  return getStoredReferralContext()?.code ?? null;
}

export function hasReferralContext(): boolean {
  return Boolean(getStoredReferralCode());
}

/** Called once the database has taken over as the source of truth. */
export function clearReferralContext(): void {
  if (typeof window === 'undefined') return;
  for (const storage of [safeStorage('session'), safeStorage('local')]) {
    if (!storage) continue;
    try {
      storage.removeItem(REFERRAL_STORAGE_KEY);
      storage.removeItem(REFERRAL_PERSISTENT_KEY);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Capture a referral code from the current URL into temporary storage.
 *
 * The code is stored BEFORE the visible URL is cleaned, so cleanup can never
 * lose the invite. Returns the code and where it came from.
 */
export function captureReferralFromUrl(options: { cleanUrl?: boolean } = {}): {
  code: string | null;
  source: 'url' | 'storage' | null;
} {
  const { cleanUrl = true } = options;
  const fromUrl = readReferralCodeFromUrl();

  if (fromUrl) {
    storeReferralContext(fromUrl);
    if (cleanUrl) stripReferralParamsFromUrl();
    return { code: fromUrl, source: 'url' };
  }

  const stored = getStoredReferralCode();
  return { code: stored, source: stored ? 'storage' : null };
}

/** Remove referral params from the visible URL after they have been captured. */
export function stripReferralParamsFromUrl(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const url = new URL(window.location.href);
    let changed = false;

    url.searchParams.forEach((_value, key) => {
      const normalizedKey = key.trim().toLowerCase().replace(/[-\s]/g, '');
      if ((REFERRAL_QUERY_PARAMS as readonly string[]).includes(normalizedKey)) {
        url.searchParams.delete(key);
        changed = true;
      }
    });

    const hash = url.hash || '';
    const hashQueryIndex = hash.indexOf('?');
    if (hashQueryIndex >= 0) {
      const hashParams = new URLSearchParams(hash.slice(hashQueryIndex + 1));
      let hashChanged = false;
      hashParams.forEach((_value, key) => {
        const normalizedKey = key.trim().toLowerCase().replace(/[-\s]/g, '');
        if ((REFERRAL_QUERY_PARAMS as readonly string[]).includes(normalizedKey)) {
          hashParams.delete(key);
          hashChanged = true;
        }
      });
      if (hashChanged) {
        const remaining = hashParams.toString();
        url.hash = remaining ? `${hash.slice(0, hashQueryIndex)}?${remaining}` : hash.slice(0, hashQueryIndex);
        changed = true;
      }
    }

    if (changed) {
      window.history.replaceState(window.history.state, '', url.toString());
    }
    return changed;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Link generation
// ---------------------------------------------------------------------------

/**
 * Canonical invite link. It points at the signup route so opening the link
 * lands on the signup screen with the code pre-filled — never on the homepage.
 */
export function buildReferralSignupLink(code: string, origin?: string): string | null {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return null;
  const base =
    origin?.trim() ||
    (typeof window !== 'undefined' && window.location.origin ? window.location.origin : '');
  if (!base) return null;
  return `${base.replace(/\/+$/, '')}${SIGNUP_PATH}?ref=${encodeURIComponent(normalized)}`;
}

/** Short landing form used by share sheets that prefer the bare alias route. */
export function buildReferralAliasLink(code: string, origin?: string): string | null {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return null;
  const base =
    origin?.trim() ||
    (typeof window !== 'undefined' && window.location.origin ? window.location.origin : '');
  if (!base) return null;
  return `${base.replace(/\/+$/, '')}/signup?ref=${encodeURIComponent(normalized)}`;
}

/**
 * Referral entry guard.
 *
 * An invite link must open the SIGNUP screen — historically `/?ref=CODE` simply
 * rendered the guest homepage and the code was thrown away. This captures the
 * code first (so it can never be lost) and then routes to the existing signup
 * screen with the referral parameter still attached.
 *
 * Returns `true` when a navigation happened.
 */
export function redirectReferralEntryToSignup(): boolean {
  if (typeof window === 'undefined') return false;

  const code = readReferralCodeFromUrl();
  if (!code) return false;

  // Capture before navigating: storage keeps the invite even if the redirect
  // is interrupted, and the signup form can auto-fill from it.
  storeReferralContext(code);

  if (isSignupRoute()) return false;
  return redirectToSignup({ replace: true });
}

// ---------------------------------------------------------------------------
// Referral code generation (stable, unique, public-safe)
// ---------------------------------------------------------------------------

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I ambiguity

/** Deterministic-ish prefix from the account name, e.g. "RAH" → RAH + random. */
function codeSeedPrefix(seed?: string | null): string {
  const cleaned = (seed || '').replace(/[^A-Za-z]/g, '').toUpperCase();
  if (!cleaned) return '';
  return cleaned.slice(0, 3);
}

function randomCodeSegment(length: number): string {
  const bytes = new Uint32Array(length);
  const cryptoRef = (globalThis as { crypto?: Crypto }).crypto;
  if (cryptoRef?.getRandomValues) {
    cryptoRef.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i += 1) bytes[i] = Math.floor(Math.random() * 0xffffffff);
  }
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

/** Build a candidate code: optional name prefix + random suffix, 8 chars total. */
export function generateReferralCode(seed?: string | null, length = 8): string {
  const prefix = codeSeedPrefix(seed);
  const suffixLength = Math.max(4, length - prefix.length);
  return `${prefix}${randomCodeSegment(suffixLength)}`.slice(0, Math.max(6, length));
}

export interface EnsureReferralCodeResult {
  code: string | null;
  /** False when the referral backend is unavailable — nothing was persisted. */
  persisted: boolean;
  error?: string | null;
}

/**
 * Return the user's existing referral code, creating a unique one if needed.
 *
 * Uniqueness is enforced by the database (`referral_codes.code` unique index);
 * a collision is retried rather than surfaced.
 */
export async function ensureReferralCode(
  userId: string,
  options: { seed?: string | null; client?: SupabaseClient | null } = {}
): Promise<EnsureReferralCodeResult> {
  const client = options.client === undefined ? supabase : options.client;
  if (!userId) return { code: null, persisted: false, error: 'Missing user id' };
  if (!client || !isSupabaseConfigured) {
    return { code: null, persisted: false, error: 'Supabase not configured' };
  }

  // Preferred path: a SECURITY DEFINER RPC that owns code generation.
  try {
    const { data, error } = await client.rpc('ensure_referral_code', {
      p_seed: options.seed ?? null,
    });
    if (!error) {
      const code = normalizeReferralCode(Array.isArray(data) ? data[0] : data);
      if (code) return { code, persisted: true };
    }
    if (error && !isMissingFunctionError(error)) {
      return { code: null, persisted: false, error: error.message };
    }
  } catch (err) {
    if (!isMissingFunctionError(err)) {
      return { code: null, persisted: false, error: (err as Error)?.message || 'RPC failed' };
    }
  }

  // Fallback: direct table access (RLS lets a user manage only their own row).
  try {
    const existing = await client
      .from(REFERRAL_CODES_TABLE)
      .select('code')
      .eq('user_id', userId)
      .maybeSingle();
    if (!existing.error) {
      const code = normalizeReferralCode((existing.data as { code?: string } | null)?.code);
      if (code) return { code, persisted: true };
    } else if (!isMissingTableError(existing.error)) {
      return { code: null, persisted: false, error: existing.error.message };
    } else {
      return { code: null, persisted: false, error: 'Referral backend unavailable' };
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = generateReferralCode(options.seed);
      const { error } = await client
        .from(REFERRAL_CODES_TABLE)
        .upsert({ user_id: userId, code: candidate }, { onConflict: 'user_id' });
      if (!error) return { code: candidate, persisted: true };
      if (!isUniqueViolation(error)) {
        return { code: null, persisted: false, error: error.message };
      }
    }
    return { code: null, persisted: false, error: 'Could not allocate a unique referral code' };
  } catch (err) {
    return { code: null, persisted: false, error: (err as Error)?.message || 'Referral lookup failed' };
  }
}

// ---------------------------------------------------------------------------
// Validation + persistence
// ---------------------------------------------------------------------------

const FATAL_CODES = new Set([
  '42P01', // undefined_table
  '42703', // undefined_column
  '42501', // insufficient_privilege (RLS denial)
  'PGRST204', // column not in schema cache
  'PGRST205', // table not in schema cache
  'PGRST301', // JWT role not permitted
]);

function errorCode(error: unknown): string {
  return String((error as { code?: unknown } | null)?.code ?? '');
}

function errorMessage(error: unknown): string {
  return String((error as { message?: unknown } | null)?.message ?? '');
}

function isMissingTableError(error: unknown): boolean {
  const code = errorCode(error);
  const message = errorMessage(error).toLowerCase();
  return (
    FATAL_CODES.has(code) ||
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('row-level security')
  );
}

function isMissingFunctionError(error: unknown): boolean {
  const code = errorCode(error);
  const message = errorMessage(error).toLowerCase();
  return (
    code === '42883' ||
    code === 'PGRST202' ||
    message.includes('could not find the function') ||
    message.includes('does not exist')
  );
}

function isUniqueViolation(error: unknown): boolean {
  return errorCode(error) === '23505' || errorMessage(error).toLowerCase().includes('duplicate key');
}

/**
 * Validate a referral code against the database BEFORE signup completes.
 *
 * Never trusts the client: the code is normalized, then resolved server-side.
 * `referrerUserId` comes from the database, not from the invite link.
 */
export async function validateReferralCode(
  rawCode: unknown,
  options: { client?: SupabaseClient | null } = {}
): Promise<ReferralValidation> {
  const code = normalizeReferralCode(rawCode);
  if (!code) return { status: 'invalid', referrerUserId: null, error: 'Malformed referral code' };

  const client = options.client === undefined ? supabase : options.client;
  if (!client || !isSupabaseConfigured) {
    return { status: 'unavailable', referrerUserId: null, error: 'Supabase not configured' };
  }

  // Preferred path: SECURITY DEFINER RPC.
  try {
    const { data, error } = await client.rpc('validate_referral_code', { p_code: code });
    if (!error) {
      const row = (Array.isArray(data) ? data[0] : data) as
        | { status?: string; referrer_user_id?: string | null }
        | null
        | undefined;
      const status = row?.status;
      if (status === 'valid') {
        return { status: 'valid', referrerUserId: row?.referrer_user_id ?? null };
      }
      if (status === 'inactive') return { status: 'inactive', referrerUserId: null };
      if (status === 'invalid') return { status: 'invalid', referrerUserId: null };
    } else if (!isMissingFunctionError(error)) {
      return { status: 'unavailable', referrerUserId: null, error: error.message };
    }
  } catch (err) {
    if (!isMissingFunctionError(err)) {
      return { status: 'unavailable', referrerUserId: null, error: (err as Error)?.message };
    }
  }

  // Fallback: read the code directly (RLS-guarded), then the public lookup view.
  const lookups: Array<{ table: string; columns: string }> = [
    { table: REFERRAL_CODES_TABLE, columns: 'code,is_active,user_id' },
    { table: REFERRAL_CODE_LOOKUP_VIEW, columns: 'code,is_active' },
  ];

  for (const lookup of lookups) {
    try {
      const { data, error } = await client
        .from(lookup.table)
        .select(lookup.columns)
        .ilike('code', code)
        .maybeSingle();
      if (error) {
        if (isMissingTableError(error)) continue;
        return { status: 'unavailable', referrerUserId: null, error: error.message };
      }
      if (!data) return { status: 'invalid', referrerUserId: null };
      const row = data as { is_active?: boolean; user_id?: string | null };
      if (row.is_active === false) return { status: 'inactive', referrerUserId: null };
      return { status: 'valid', referrerUserId: row.user_id ?? null };
    } catch (err) {
      return { status: 'unavailable', referrerUserId: null, error: (err as Error)?.message };
    }
  }

  return {
    status: 'unavailable',
    referrerUserId: null,
    error: 'Referral backend unavailable',
  };
}

/** Read the referral relationship already stored for a user, if any. */
export async function getReferralForUser(
  userId: string,
  options: { client?: SupabaseClient | null } = {}
): Promise<{ referredBy: string | null; code: string | null; exists: boolean }> {
  const client = options.client === undefined ? supabase : options.client;
  if (!userId || !client || !isSupabaseConfigured) {
    return { referredBy: null, code: null, exists: false };
  }
  try {
    const { data, error } = await client
      .from(REFERRALS_TABLE)
      .select('referrer_user_id,referral_code')
      .eq('referred_user_id', userId)
      .maybeSingle();
    if (error || !data) return { referredBy: null, code: null, exists: false };
    const row = data as { referrer_user_id?: string | null; referral_code?: string | null };
    return {
      referredBy: row.referrer_user_id ?? null,
      code: normalizeReferralCode(row.referral_code),
      exists: true,
    };
  } catch {
    return { referredBy: null, code: null, exists: false };
  }
}

/**
 * Persist the referral relationship for a freshly created account.
 *
 * Guarantees (client + database):
 *  - the referrer is resolved from the code, never supplied by the browser,
 *  - one relationship per referred user — the first valid referral wins
 *    (`referrals.referred_user_id` unique + `ignoreDuplicates`),
 *  - self-referral is rejected (`referrals_no_self_referral` check),
 *  - a failure never leaves a half-written relationship behind.
 */
export async function createReferralRelationship(input: {
  referredUserId: string;
  code: unknown;
  referrerUserId?: string | null;
  client?: SupabaseClient | null;
}): Promise<ReferralSaveResult> {
  const code = normalizeReferralCode(input.code);
  if (!code) return { status: 'invalid', error: 'Malformed referral code' };

  const client = input.client === undefined ? supabase : input.client;
  if (!client || !isSupabaseConfigured) {
    return { status: 'unavailable', error: 'Supabase not configured' };
  }
  if (!input.referredUserId) return { status: 'unavailable', error: 'Missing referred user id' };

  // Self-referral guard (also enforced by the database check constraint).
  if (input.referrerUserId && input.referrerUserId === input.referredUserId) {
    return { status: 'self_referral', error: 'You cannot use your own referral code.' };
  }

  // Preferred path: SECURITY DEFINER RPC that resolves + inserts atomically.
  try {
    const { data, error } = await client.rpc('apply_referral', { p_code: code });
    if (!error) {
      const row = (Array.isArray(data) ? data[0] : data) as { status?: string } | null | undefined;
      const status = row?.status;
      if (
        status === 'created' ||
        status === 'already_referred' ||
        status === 'invalid' ||
        status === 'inactive' ||
        status === 'self_referral'
      ) {
        return { status } as ReferralSaveResult;
      }
    } else if (!isMissingFunctionError(error)) {
      return { status: classifyReferralError(error), error: error.message };
    }
  } catch (err) {
    if (!isMissingFunctionError(err)) {
      return { status: 'unavailable', error: (err as Error)?.message };
    }
  }

  // Fallback: direct insert. A BEFORE INSERT trigger resolves the referrer from
  // the code; `ignoreDuplicates` keeps the original relationship on a repeat.
  try {
    const existing = await getReferralForUser(input.referredUserId, { client });
    if (existing.exists) return { status: 'already_referred' };

    const payload: Record<string, unknown> = {
      referred_user_id: input.referredUserId,
      referral_code: code,
    };
    // Only send the referrer id when the database itself resolved it for us.
    if (input.referrerUserId) payload.referrer_user_id = input.referrerUserId;

    const { data, error, count } = await client
      .from(REFERRALS_TABLE)
      .upsert(payload, { onConflict: 'referred_user_id', ignoreDuplicates: true, count: 'exact' });

    if (error) return { status: classifyReferralError(error), error: error.message };
    // With `ignoreDuplicates` a conflicting (already referred) account writes
    // nothing, so zero affected rows means the original relationship stands.
    const rows =
      typeof count === 'number'
        ? count
        : Array.isArray(data)
        ? (data as unknown[]).length
        : 0;
    return rows > 0 ? { status: 'created' } : { status: 'already_referred' };
  } catch (err) {
    return { status: 'unavailable', error: (err as Error)?.message };
  }
}

function classifyReferralError(error: unknown): ReferralSaveResult['status'] {
  const code = errorCode(error);
  const message = errorMessage(error).toLowerCase();

  if (isUniqueViolation(error) || message.includes('already_referred')) return 'already_referred';
  if (message.includes('invalid_referral_code')) return 'invalid';
  if (message.includes('referral_code_inactive') || message.includes('no longer active')) {
    return 'inactive';
  }
  if (message.includes('self_referral') || message.includes('cannot use your own')) {
    return 'self_referral';
  }
  if (FATAL_CODES.has(code) || isMissingTableError(error)) return 'unavailable';
  return 'unavailable';
}

/**
 * Apply a referral code that was captured before the session existed (e.g. the
 * project requires email confirmation, so signup returns no session).
 *
 * Only runs for accounts created inside `REFERRAL_PENDING_WINDOW_MS`, so an
 * existing user signing in later is never silently attributed to an invite.
 */
export async function finalizePendingReferral(input: {
  userId: string;
  code: string;
  accountCreatedAt?: string | null;
  /** When the invite was captured (from the stored referral context). */
  capturedAt?: number | null;
  client?: SupabaseClient | null;
}): Promise<ReferralSaveResult | null> {
  const code = normalizeReferralCode(input.code);
  if (!code || !input.userId) return null;

  if (input.accountCreatedAt) {
    const createdAt = Date.parse(input.accountCreatedAt);
    if (Number.isFinite(createdAt)) {
      // An invite that arrived AFTER the account existed is not a signup
      // referral: an existing user who clicks a link and signs in must never be
      // attributed to it. (Small skew allowance for client/server clocks.)
      if (typeof input.capturedAt === 'number' && input.capturedAt > createdAt + 60_000) {
        return null;
      }
      if (Date.now() - createdAt > REFERRAL_PENDING_WINDOW_MS) {
        return null; // stale context on an old account — never attribute it
      }
    }
  }

  const existing = await getReferralForUser(input.userId, { client: input.client });
  if (existing.exists) return { status: 'already_referred' };

  return createReferralRelationship({
    referredUserId: input.userId,
    code,
    client: input.client,
  });
}
