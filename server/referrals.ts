/**
 * Nexora referral attribution endpoints.
 *
 *   GET  /api/referrals/resolve?code=NX-VIJAY634   who shared this code?
 *   POST /api/referrals/accept                     "a new account used it"
 *   GET  /api/referrals/:userId                    my code + counted referrals
 *
 * Why these live server-side: an invite link is opened by a DIFFERENT person on
 * a DIFFERENT device, so the signing-up browser cannot resolve the code (nor
 * write into the referrer's rows) with an anon key. The `referrals` RLS policy
 * only lets a customer insert rows they own as referrer — attribution is
 * therefore done here with the service-role client, exactly like
 * server/bookings.ts and server/engagement.ts.
 *
 * Points are NOT handed out at signup. A referral row is written as `pending`
 * with reward_points = 150; `public.settle_completed_referrals()` credits the
 * referrer once the friend completes a qualifying payment (see
 * supabase/consolidated_cloud_sync.sql).
 */

import { Router, Request, Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from './notifications';
import { jsonError } from './bookings';
import { REFERRAL_POINTS_PER_INVITE } from '../src/lib/referralService';
import { normalizeReferralCode } from '../src/lib/inviteLink';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ReferrerRow {
  id: string;
  referral_code?: string | null;
  full_name?: string | null;
  email?: string | null;
}

export interface ReferralRowLite {
  id: string;
  referrer_user_id: string;
  referred_user_id: string;
  referred_name?: string | null;
  status: string;
  reward_points: number;
  created_at?: string | null;
  completed_at?: string | null;
}

export interface ReferralStore {
  findReferrerByCode(code: string): Promise<{ ok: boolean; row?: ReferrerRow | null; error?: string }>;
  findReferral(
    referrerUserId: string,
    referredUserId: string
  ): Promise<{ ok: boolean; row?: ReferralRowLite | null; error?: string }>;
  insertReferral(row: {
    referrer_user_id: string;
    referred_user_id: string;
    referred_name?: string | null;
    status: 'pending';
    reward_points: number;
    metadata?: Record<string, unknown>;
  }): Promise<{ ok: boolean; id?: string; error?: string }>;
  listReferralsFor(userId: string): Promise<{ ok: boolean; rows: ReferralRowLite[]; error?: string }>;
  readReferralCode(userId: string): Promise<{ ok: boolean; code?: string | null; error?: string }>;
}

export function createSupabaseReferralStore(client: SupabaseClient): ReferralStore {
  return {
    async findReferrerByCode(code) {
      const { data, error } = await client
        .from('profiles')
        .select('id, referral_code, full_name, email')
        .ilike('referral_code', code)
        .maybeSingle();
      if (error) {
        const anyError = error as { code?: string };
        if (anyError.code === '42703' || error.message?.includes('referral_code')) {
          return {
            ok: false,
            error:
              'profiles.referral_code is missing — run supabase/migrations/20260910120000_referral_codes_invite_links.sql',
          };
        }
        return { ok: false, error: error.message };
      }
      return { ok: true, row: (data as ReferrerRow | null) ?? null };
    },
    async findReferral(referrerUserId, referredUserId) {
      const { data, error } = await client
        .from('referrals')
        .select('*')
        .eq('referrer_user_id', referrerUserId)
        .eq('referred_user_id', referredUserId)
        .maybeSingle();
      return error
        ? { ok: false, error: error.message }
        : { ok: true, row: (data as ReferralRowLite | null) ?? null };
    },
    async insertReferral(row) {
      const { data, error } = await client.from('referrals').insert(row).select('id').single();
      if (error) {
        // A duplicate (referrer, referred) pair is an idempotent re-run, not a
        // failure worth surfacing as 500.
        if ((error as { code?: string }).code === '23505') {
          return { ok: false, error: 'duplicate' };
        }
        return { ok: false, error: error.message };
      }
      const id = (data as { id?: string } | null)?.id;
      return { ok: true, id };
    },
    async listReferralsFor(userId) {
      const { data, error } = await client
        .from('referrals')
        .select('*')
        .eq('referrer_user_id', userId)
        .order('created_at', { ascending: false });
      return error
        ? { ok: false, rows: [], error: error.message }
        : { ok: true, rows: (data as ReferralRowLite[]) ?? [] };
    },
    async readReferralCode(userId) {
      const { data, error } = await client
        .from('profiles')
        .select('referral_code')
        .eq('id', userId)
        .maybeSingle();
      if (error) return { ok: false, error: error.message };
      const row = data as { referral_code?: string | null } | null;
      return { ok: true, code: row?.referral_code ?? null };
    },
  };
}

/** Counted referral metrics — the numbers the referral screen shows. */
export function summariseReferrals(rows: ReferralRowLite[]): {
  totalInvited: number;
  successfulReferrals: number;
  pendingReferrals: number;
  rewardEarned: number;
  rewardPending: number;
} {
  const completed = rows.filter((r) => r.status === 'completed');
  const pending = rows.filter((r) => r.status === 'pending');
  return {
    totalInvited: rows.length,
    successfulReferrals: completed.length,
    pendingReferrals: pending.length,
    rewardEarned: completed.reduce((sum, r) => sum + (r.reward_points || 0), 0),
    rewardPending: pending.reduce((sum, r) => sum + (r.reward_points || 0), 0),
  };
}

export function createReferralsRouter(
  env: NodeJS.ProcessEnv = process.env,
  storeOverride?: ReferralStore | null
): Router {
  const router = Router();
  const { client, reason } = createServiceClient(env);
  const store: ReferralStore | null =
    storeOverride !== undefined
      ? storeOverride
      : client
        ? createSupabaseReferralStore(client)
        : null;

  const guard = (res: Response): ReferralStore | null => {
    if (!store) {
      jsonError(res, 503, 'Referral service is not configured (no service-role client).', [
        reason ?? 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured',
      ]);
      return null;
    }
    return store;
  };

  router.get('/resolve', async (req: Request, res: Response) => {
    const active = guard(res);
    if (!active) return;
    const code = normalizeReferralCode(
      typeof req.query.code === 'string' ? req.query.code : ''
    );
    if (!code) return jsonError(res, 400, 'A referral code is required.', ['code']);

    const found = await active.findReferrerByCode(code);
    if (!found.ok) return jsonError(res, 500, found.error ?? 'Referral lookup failed');
    if (!found.row) {
      return jsonError(res, 404, `No Nexora customer owns the referral code ${code}.`);
    }

    return res.status(200).json({
      code,
      referrer: {
        userId: found.row.id,
        name: found.row.full_name || found.row.email?.split('@')[0] || 'A Nexora customer',
      },
      rewardPoints: REFERRAL_POINTS_PER_INVITE,
    });
  });

  router.post('/accept', async (req: Request, res: Response) => {
    const active = guard(res);
    if (!active) return;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const code = normalizeReferralCode(typeof body.code === 'string' ? body.code : '');
    const referredUserId =
      typeof body.referredUserId === 'string' ? body.referredUserId.trim() : '';
    const referredName = typeof body.referredName === 'string' ? body.referredName.trim() : '';
    const referredEmail = typeof body.referredEmail === 'string' ? body.referredEmail.trim() : '';

    const fields: string[] = [];
    if (!code) fields.push('code');
    if (!UUID_RE.test(referredUserId)) fields.push('referredUserId');
    if (fields.length > 0) {
      return jsonError(res, 400, 'Referral payload is incomplete.', fields);
    }

    const found = await active.findReferrerByCode(code);
    if (!found.ok) return jsonError(res, 500, found.error ?? 'Referral lookup failed');
    if (!found.row) {
      return jsonError(res, 404, `No Nexora customer owns the referral code ${code}.`);
    }
    if (found.row.id === referredUserId) {
      return jsonError(res, 400, 'You cannot use your own referral code.', ['code']);
    }

    const existing = await active.findReferral(found.row.id, referredUserId);
    if (existing.ok && existing.row) {
      return res.status(200).json({
        referralId: existing.row.id,
        referrerName: found.row.full_name || 'A Nexora customer',
        rewardPoints: existing.row.reward_points,
        status: existing.row.status === 'completed' ? 'completed' : 'pending',
        duplicate: true,
      });
    }

    const inserted = await active.insertReferral({
      referrer_user_id: found.row.id,
      referred_user_id: referredUserId,
      referred_name: referredName || null,
      status: 'pending',
      reward_points: REFERRAL_POINTS_PER_INVITE,
      metadata: {
        referral_code: code,
        referred_email: referredEmail || null,
        source: 'invite_link',
      },
    });

    if (!inserted.ok) {
      if (inserted.error === 'duplicate') {
        return jsonError(res, 409, 'This referral was already recorded.');
      }
      return jsonError(res, 500, inserted.error ?? 'Referral could not be saved');
    }

    return res.status(201).json({
      referralId: inserted.id,
      referrerName: found.row.full_name || 'A Nexora customer',
      rewardPoints: REFERRAL_POINTS_PER_INVITE,
      status: 'pending',
      message: `Referral counted for ${found.row.full_name || code}. ${REFERRAL_POINTS_PER_INVITE} points release after the first ₹100+ QR payment.`,
    });
  });

  router.get('/:userId', async (req: Request, res: Response) => {
    const active = guard(res);
    if (!active) return;
    const userId = req.params.userId ?? '';
    if (!UUID_RE.test(userId)) return jsonError(res, 400, 'A valid user id is required.');

    const [codeResult, listResult] = await Promise.all([
      active.readReferralCode(userId),
      active.listReferralsFor(userId),
    ]);
    if (!listResult.ok) return jsonError(res, 500, listResult.error ?? 'Referral list failed');

    return res.status(200).json({
      referralCode: codeResult.ok ? codeResult.code ?? null : null,
      referrals: listResult.rows,
      summary: summariseReferrals(listResult.rows),
    });
  });

  return router;
}
