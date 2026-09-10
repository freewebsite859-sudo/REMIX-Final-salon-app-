/**
 * Browser client for the referral attribution API (server/referrals.ts).
 *
 * Why a server round-trip at all? An invite link is opened by a DIFFERENT
 * person on a DIFFERENT device, so the browser that signs up cannot look the
 * referrer up in its own localStorage. The service-role API resolves the code
 * against `profiles.referral_code` and writes the `referrals` row — that is the
 * cross-device source of truth for the referrer's counts and points.
 *
 * Honesty contract (same as createBookingClient): a referral is only "saved to
 * the cloud" when the server says so. Local attribution still happens in
 * `referralService` so the flow works in demo/offline builds.
 */

import { normalizeReferralCode } from './inviteLink';

export interface ReferralApiResult {
  ok: boolean;
  code: string;
  referrerName?: string;
  referrerUserId?: string;
  referralId?: string;
  rewardPoints?: number;
  status?: 'pending' | 'completed';
  error?: string;
  /** 'disabled' = API unreachable/absent, 'not_found' = unknown code. */
  reason?: 'disabled' | 'not_found' | 'invalid' | 'error';
}

function baseUrl(): string {
  if (typeof window === 'undefined') return '/api/referrals';
  return `${window.location.origin}/api/referrals`;
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const payload = (await response.json()) as Record<string, unknown>;
    return payload && typeof payload === 'object' ? payload : {};
  } catch {
    return {};
  }
}

/** Ask the backend who owns an invite code (used by the invite landing page). */
export async function resolveInviteCode(code?: string | null): Promise<ReferralApiResult> {
  const normalized = normalizeReferralCode(code);
  if (!normalized) {
    return { ok: false, code: '', reason: 'invalid', error: 'Missing referral code.' };
  }
  try {
    const response = await fetch(
      `${baseUrl()}/resolve?code=${encodeURIComponent(normalized)}`,
      { headers: { Accept: 'application/json' } }
    );
    const payload = await readJson(response);
    if (!response.ok) {
      return {
        ok: false,
        code: normalized,
        reason: response.status === 404 ? 'not_found' : 'error',
        error: typeof payload.error === 'string' ? payload.error : `Lookup failed (${response.status}).`,
      };
    }
    const referrer = (payload.referrer || {}) as Record<string, unknown>;
    return {
      ok: true,
      code: normalized,
      referrerName: typeof referrer.name === 'string' ? referrer.name : undefined,
      referrerUserId: typeof referrer.userId === 'string' ? referrer.userId : undefined,
      rewardPoints: typeof payload.rewardPoints === 'number' ? payload.rewardPoints : undefined,
    };
  } catch {
    return {
      ok: false,
      code: normalized,
      reason: 'disabled',
      error: 'Referral service is unreachable right now.',
    };
  }
}

/**
 * Record "this new account arrived with this code" so the referrer's counters
 * move. Safe to call once per signup; the API is idempotent per pair.
 */
export async function acceptReferralOnSignup(input: {
  code?: string | null;
  referredUserId?: string;
  referredName?: string;
  referredEmail?: string;
}): Promise<ReferralApiResult> {
  const code = normalizeReferralCode(input.code);
  if (!code) {
    return { ok: false, code: '', reason: 'invalid', error: 'Missing referral code.' };
  }
  try {
    const response = await fetch(`${baseUrl()}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        code,
        referredUserId: input.referredUserId,
        referredName: input.referredName,
        referredEmail: input.referredEmail,
      }),
    });
    const payload = await readJson(response);
    if (!response.ok) {
      return {
        ok: false,
        code,
        reason:
          response.status === 404 ? 'not_found' : response.status === 503 ? 'disabled' : 'error',
        error:
          typeof payload.error === 'string'
            ? payload.error
            : `Referral could not be saved (${response.status}).`,
      };
    }
    return {
      ok: true,
      code,
      referralId: typeof payload.referralId === 'string' ? payload.referralId : undefined,
      referrerName: typeof payload.referrerName === 'string' ? payload.referrerName : undefined,
      rewardPoints: typeof payload.rewardPoints === 'number' ? payload.rewardPoints : undefined,
      status: payload.status === 'completed' ? 'completed' : 'pending',
    };
  } catch {
    return {
      ok: false,
      code,
      reason: 'disabled',
      error: 'Referral service is unreachable right now.',
    };
  }
}
