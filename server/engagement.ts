/**
 * Nexora engagement endpoints — QR codes, salon check-in and the rewards
 * ledger summary. Multi-service/real-time booking features live alongside
 * these in the same service-role trust zone.
 *
 *   POST /api/engagement/qr/generate   create/return the user's QR code
 *   POST /api/engagement/qr/check-in   validate a scanned code, log the salon
 *                                      visit and award daily check-in points
 *   GET  /api/engagement/summary/:userId  aggregated wallet/tier summary
 *
 * Trust model (same as server/bookings.ts)
 * ---------------------------------------
 * Only this service-role code may touch the engagement tables; the browser
 * anon key gets no RLS grants on them (see supabase/setup.sql). Check-ins
 * are rewarded exactly once per user/salon/day — enforced in the DB AND
 * re-checked here so the API answers a friendly 409 instead of a constraint
 * error. Points are written to the immutable `rewards` ledger and mirrored
 * into `user_memberships` by `apply_points_ledger()` semantics implemented
 * in the store, with tier derivation recomputed from lifetime points.
 */

import crypto from 'crypto';
import express, { Router, Request, Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from './notifications';
import { jsonError } from './bookings';
import {
  buildQrCode,
  parseQrCode,
  checkInRewardPoints,
  dayKey,
  buildEngagementSummary,
  type CheckInRow,
  type EngagementSummary,
  type QrCodeRow,
  type ReferralRow,
  type RewardRow,
  type RewardTxType,
  type UserMembershipRow,
} from '../src/lib/engagement';

// ---------------------------------------------------------------------------
// Row contracts (mirror supabase/setup.sql engagement tables)
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface EngagementStore {
  findQrByUserId(userId: string): Promise<{ ok: boolean; row?: QrCodeRow | null; error?: string }>;
  findQrByCode(code: string): Promise<{ ok: boolean; row?: QrCodeRow | null; error?: string }>;
  insertQrCode(row: QrCodeRow): Promise<{ ok: boolean; error?: string }>;
  touchQrScan(userId: string, at: string): Promise<{ ok: boolean; error?: string }>;
  findCheckIn(
    userId: string,
    salonId: string,
    day: string
  ): Promise<{ ok: boolean; row?: CheckInRow | null; error?: string }>;
  insertCheckIn(row: CheckInRow): Promise<{ ok: boolean; error?: string }>;
  insertReward(row: RewardRow): Promise<{ ok: boolean; error?: string }>;
  upsertMembershipFromReward(userId: string, points: number): Promise<{ ok: boolean; error?: string }>;
  listRewards(userId: string, limit: number): Promise<{ ok: boolean; rows: RewardRow[]; error?: string }>;
  listCheckIns(userId: string): Promise<{ ok: boolean; rows: CheckInRow[]; error?: string }>;
  listReferralsFor(userId: string): Promise<{ ok: boolean; rows: ReferralRow[]; error?: string }>;
  findMembership(userId: string): Promise<{ ok: boolean; row?: UserMembershipRow | null; error?: string }>;
}

export function createSupabaseEngagementStore(client: SupabaseClient): EngagementStore {
  return {
    async findQrByUserId(userId) {
      const { data, error } = await client
        .from('user_qr_codes')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      return error ? { ok: false, error: error.message } : { ok: true, row: (data as QrCodeRow | null) ?? null };
    },
    async findQrByCode(code) {
      const { data, error } = await client
        .from('user_qr_codes')
        .select('*')
        .eq('qr_code_data', code)
        .maybeSingle();
      return error ? { ok: false, error: error.message } : { ok: true, row: (data as QrCodeRow | null) ?? null };
    },
    async insertQrCode(row) {
      const { error } = await client.from('user_qr_codes').insert(row);
      return error ? { ok: false, error: error.message } : { ok: true };
    },
    async touchQrScan(userId, at) {
      const { error } = await client
        .from('user_qr_codes')
        .update({ last_scanned_at: at })
        .eq('user_id', userId);
      return error ? { ok: false, error: error.message } : { ok: true };
    },
    async findCheckIn(userId, salonId, day) {
      const { data, error } = await client
        .from('qr_check_ins')
        .select('*')
        .eq('user_id', userId)
        .eq('salon_id', salonId)
        .eq('day_date', day)
        .maybeSingle();
      return error ? { ok: false, error: error.message } : { ok: true, row: (data as CheckInRow | null) ?? null };
    },
    async insertCheckIn(row) {
      const { error } = await client.from('qr_check_ins').insert(row);
      return error ? { ok: false, error: error.message } : { ok: true };
    },
    async insertReward(row) {
      const { error } = await client.from('rewards').insert(row);
      return error ? { ok: false, error: error.message } : { ok: true };
    },
    async upsertMembershipFromReward(userId, points) {
      // Mirrors public.apply_points_ledger in supabase/setup.sql: positive
      // points add to lifetime + current; negative only reduces current.
      const { error } = await client.rpc('apply_points_ledger', {
        p_user: userId,
        p_points: points,
      });
      return error ? { ok: false, error: error.message } : { ok: true };
    },
    async listRewards(userId, limit) {
      const { data, error } = await client
        .from('rewards')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
      return error ? { ok: false, rows: [], error: error.message } : { ok: true, rows: (data as RewardRow[]) ?? [] };
    },
    async listCheckIns(userId) {
      const { data, error } = await client
        .from('qr_check_ins')
        .select('*')
        .eq('user_id', userId)
        .order('checked_in_at', { ascending: false });
      return error ? { ok: false, rows: [], error: error.message } : { ok: true, rows: (data as CheckInRow[]) ?? [] };
    },
    async listReferralsFor(userId) {
      const { data, error } = await client
        .from('referrals')
        .select('*')
        .eq('referrer_user_id', userId)
        .order('created_at', { ascending: false });
      return error ? { ok: false, rows: [], error: error.message } : { ok: true, rows: (data as ReferralRow[]) ?? [] };
    },
    async findMembership(userId) {
      const { data, error } = await client
        .from('user_memberships')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      return error ? { ok: false, error: error.message } : { ok: true, row: (data as UserMembershipRow | null) ?? null };
    },
  };
}

// ---------------------------------------------------------------------------
// Row builders (pure, testable)
// ---------------------------------------------------------------------------

export function buildQrRow(userId: string): { row: QrCodeRow; code: string } {
  const now = new Date().toISOString();
  const code = buildQrCode(userId, crypto.randomBytes(18).toString('base64url'));
  return {
    code,
    row: {
      id: crypto.randomUUID(),
      user_id: userId,
      qr_code_data: code,
      generated_at: now,
      last_scanned_at: null,
    },
  };
}

export function buildCheckInRow(input: {
  userId: string;
  salonId: string;
  salonName: string;
  points: number;
  day: string;
}): CheckInRow {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    user_id: input.userId,
    salon_id: input.salonId,
    salon_name: input.salonName,
    points_awarded: input.points,
    day_date: input.day,
    checked_in_at: now,
  };
}

export function buildRewardRow(input: {
  userId: string;
  points: number;
  type: RewardTxType;
  description: string;
  salonId?: string;
  bookingId?: string;
  referralId?: string;
}): RewardRow {
  return {
    id: crypto.randomUUID(),
    user_id: input.userId,
    points_earned: input.points,
    transaction_type: input.type,
    description: input.description,
    ...(input.salonId ? { salon_id: input.salonId } : {}),
    ...(input.bookingId ? { booking_id: input.bookingId } : {}),
    ...(input.referralId ? { referral_id: input.referralId } : {}),
    created_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Service core (pure of express so tests drive it through a fake store)
// ---------------------------------------------------------------------------

export type GenerateResult =
  | { status: 'created' | 'existing'; code: string; row: QrCodeRow }
  | { status: 'error'; error: string };

export async function ensureUserQrCode(store: EngagementStore, userId: string): Promise<GenerateResult> {
  const found = await store.findQrByUserId(userId);
  if (!found.ok) return { status: 'error', error: `QR lookup failed: ${found.error ?? 'unknown store error'}` };
  if (found.row) return { status: 'existing', code: found.row.qr_code_data, row: found.row };

  const { row, code } = buildQrRow(userId);
  const inserted = await store.insertQrCode(row);
  if (!inserted.ok) return { status: 'error', error: `QR creation failed: ${inserted.error ?? 'unknown store error'}` };
  return { status: 'created', code, row };
}

export type CheckInResult =
  | { status: 'ok'; pointsAwarded: number; checkIn: CheckInRow; code: string; userId: string }
  | { status: 'duplicate'; message: string }
  | { status: 'not_found'; message: string }
  | { status: 'error'; error: string };

export async function processQrCheckIn(
  store: EngagementStore,
  input: { code: string; salonId: string; salonName: string }
): Promise<CheckInResult> {
  const parsed = parseQrCode(input.code);
  if (!parsed.ok || !parsed.userId) {
    return { status: 'not_found', message: parsed.error ?? 'Invalid QR code.' };
  }
  const userId = parsed.userId;

  const qr = await store.findQrByCode(input.code.trim());
  if (!qr.ok) return { status: 'error', error: `QR lookup failed: ${qr.error ?? 'unknown store error'}` };
  if (!qr.row) return { status: 'not_found', message: 'This QR code is not registered.' };

  const day = dayKey();
  const existing = await store.findCheckIn(userId, input.salonId, day);
  if (!existing.ok) return { status: 'error', error: `Check-in lookup failed: ${existing.error ?? 'unknown store error'}` };
  if (existing.row) {
    return { status: 'duplicate', message: 'Already checked in at this salon today.' };
  }

  const points = checkInRewardPoints();
  const checkIn = buildCheckInRow({
    userId,
    salonId: input.salonId,
    salonName: input.salonName,
    points,
    day,
  });
  const reward = buildRewardRow({
    userId,
    points,
    type: 'qr_check_in',
    description: `Salon check-in reward at ${input.salonName}`,
    salonId: input.salonId,
  });

  const ci = await store.insertCheckIn(checkIn);
  if (!ci.ok) {
    // Unique (user_id, salon_id, day_date) violation under concurrency.
    if (/duplicate|unique/i.test(ci.error ?? '')) {
      return { status: 'duplicate', message: 'Already checked in at this salon today.' };
    }
    return { status: 'error', error: `Check-in failed: ${ci.error ?? 'unknown store error'}` };
  }
  const rw = await store.insertReward(reward);
  if (!rw.ok) return { status: 'error', error: `Reward write failed: ${rw.error ?? 'unknown store error'}` };
  const mem = await store.upsertMembershipFromReward(userId, points);
  if (!mem.ok) return { status: 'error', error: `Membership sync failed: ${mem.error ?? 'unknown store error'}` };
  await store.touchQrScan(userId, new Date().toISOString());

  return { status: 'ok', pointsAwarded: points, checkIn, code: input.code.trim(), userId };
}

export type SummaryResult = { status: 'ok'; summary: EngagementSummary } | { status: 'error'; error: string };

export async function getEngagementSummary(store: EngagementStore, userId: string): Promise<SummaryResult> {
  const [rewards, checkIns, referrals, memberships, qr] = await Promise.all([
    store.listRewards(userId, 100),
    store.listCheckIns(userId),
    store.listReferralsFor(userId),
    store.findMembership(userId),
    store.findQrByUserId(userId),
  ]);
  if (!rewards.ok) return { status: 'error', error: rewards.error ?? 'Rewards fetch failed' };
  if (!checkIns.ok) return { status: 'error', error: checkIns.error ?? 'Check-ins fetch failed' };
  if (!referrals.ok) return { status: 'error', error: referrals.error ?? 'Referrals fetch failed' };
  if (!memberships.ok) return { status: 'error', error: memberships.error ?? 'Membership fetch failed' };
  if (!qr.ok) return { status: 'error', error: qr.error ?? 'QR fetch failed' };

  return {
    status: 'ok',
    summary: buildEngagementSummary({
      userId,
      rewards: rewards.rows,
      checkIns: checkIns.rows,
      referrals: referrals.rows,
      memberships: memberships.row,
      qr: qr.row,
    }),
  };
}

// ---------------------------------------------------------------------------
// Express router
// ---------------------------------------------------------------------------

export function createEngagementRouter(
  env: NodeJS.ProcessEnv = process.env,
  storeOverride?: EngagementStore | null
): Router {
  const router = Router();
  const { client, reason } = createServiceClient(env);
  const store: EngagementStore | null =
    storeOverride !== undefined ? storeOverride : client ? createSupabaseEngagementStore(client) : null;

  const guard = (res: Response): EngagementStore | null => {
    if (!store) {
      jsonError(res, 503, 'Engagement service is not configured (no service-role client).', [
        reason ?? 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured',
      ]);
      return null;
    }
    return store;
  };

  router.post('/qr/generate', async (req: Request, res: Response) => {
    const active = guard(res);
    if (!active) return;
    const userId = typeof req.body?.userId === 'string' ? req.body.userId.trim() : '';
    if (!UUID_RE.test(userId)) {
      return jsonError(res, 400, 'A valid user id is required.', ['userId']);
    }
    const result = await ensureUserQrCode(active, userId);
    if (result.status === 'error') return jsonError(res, 500, result.error);
    return res.status(result.status === 'created' ? 201 : 200).json({
      qrCode: {
        code: result.code,
        generatedAt: result.row.generated_at,
        lastScannedAt: result.row.last_scanned_at ?? null,
      },
    });
  });

  router.post('/qr/check-in', async (req: Request, res: Response) => {
    const active = guard(res);
    if (!active) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    const salonId = typeof body.salonId === 'string' ? body.salonId.trim() : '';
    const salonName = typeof body.salonName === 'string' ? body.salonName.trim() : '';

    const fields: string[] = [];
    if (!code) fields.push('code');
    if (!salonId) fields.push('salonId');
    if (!salonName || salonName.length > 200) fields.push('salonName');
    if (fields.length > 0) return jsonError(res, 400, 'Check-in payload is incomplete.', fields);

    try {
      const result = await processQrCheckIn(active, { code, salonId, salonName });
      switch (result.status) {
        case 'ok':
          return res.status(201).json({
            checkIn: result.checkIn,
            pointsAwarded: result.pointsAwarded,
            userId: result.userId,
          });
        case 'duplicate':
          return jsonError(res, 409, result.message);
        case 'not_found':
          return jsonError(res, 404, result.message);
        default:
          return jsonError(res, 500, result.error);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected engagement failure';
      console.error('[Nexora] Check-in threw:', err);
      return jsonError(res, 500, message);
    }
  });

  router.get('/summary/:userId', async (req: Request, res: Response) => {
    const active = guard(res);
    if (!active) return;
    const userId = req.params.userId ?? '';
    if (!UUID_RE.test(userId)) return jsonError(res, 400, 'A valid user id is required.');
    const result = await getEngagementSummary(active, userId);
    if (result.status === 'error') return jsonError(res, 500, result.error);
    return res.status(200).json({ summary: result.summary });
  });

  return router;
}
