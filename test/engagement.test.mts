/**
 * Engagement rules + service tests (pure Node — no React/DOM, no live DB).
 *
 * Covers the vertical slice added for QR check-in / rewards / real-time:
 *
 *   1. src/lib/engagement.ts — QR payload format, points math, tier
 *      progression, birthday rules, summary aggregation.
 *   2. server/engagement.ts — QR generation, check-in awarding (incl. the
 *      once-per-day duplicate guard), summary assembly, HTTP behaviors.
 *
 * Run: npm run test:engagement
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildQrCode,
  parseQrCode,
  bookingRewardPoints,
  checkInRewardPoints,
  tierForLifetimePoints,
  computeTierState,
  isBirthdayOn,
  dayKey,
  buildEngagementSummary,
  TIER_MIN_POINTS,
  type CheckInRow,
  type QrCodeRow,
  type ReferralRow,
  type RewardRow,
  type UserMembershipRow,
} from '../src/lib/engagement';
import {
  ensureUserQrCode,
  processQrCheckIn,
  getEngagementSummary,
  buildQrRow,
  buildCheckInRow,
  buildRewardRow,
  type EngagementStore,
} from '../server/engagement';

const USER_A = '11111111-2222-3333-4444-555555555555';
const USER_B = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const USER_BAD = 'not-a-uuid';

// ---------------------------------------------------------------------------
// QR payload format
// ---------------------------------------------------------------------------

describe('QR payload', () => {
  it('builds NXQR1.<userId>.<nonce> with a random nonce', () => {
    const code = buildQrCode(USER_A);
    const parsed = parseQrCode(code);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.userId, USER_A);
    assert.ok(parsed.nonce && parsed.nonce.length >= 20);
  });

  it('accepts deterministic nonce (server round-trip for scans)', () => {
    const code = buildQrCode(USER_A, 'abc123_XYZ-abc123_XYZ-1234');
    const parsed = parseQrCode(code);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.nonce, 'abc123_XYZ-abc123_XYZ-1234');
  });

  it('rejects foreign / malformed / oversized codes', () => {
    assert.equal(parseQrCode('https://evil.example/q').ok, false);
    assert.equal(parseQrCode('NXQR1.abc.xyz').ok, false); // bad userId
    assert.equal(parseQrCode(`NXQR1.${USER_A}.${'x'.repeat(300)}`).ok, false);
    assert.equal(parseQrCode(undefined).ok, false);
    assert.equal(parseQrCode('').ok, false);
  });
});

// ---------------------------------------------------------------------------
// Points & tiers
// ---------------------------------------------------------------------------

describe('points math', () => {
  it('booking points = floor(10% of total)', () => {
    assert.equal(bookingRewardPoints(1999), 199);
    assert.equal(bookingRewardPoints(1000), 100);
    assert.equal(bookingRewardPoints(0), 0);
    assert.equal(bookingRewardPoints(-5), 0);
  });

  it('check-in reward is the fixed daily amount', () => {
    assert.equal(checkInRewardPoints(), 10);
  });
});

describe('tier progression', () => {
  it('maps lifetime points to the correct tier', () => {
    assert.equal(tierForLifetimePoints(0), 'standard');
    assert.equal(tierForLifetimePoints(499), 'standard');
    assert.equal(tierForLifetimePoints(500), 'silver');
    assert.equal(tierForLifetimePoints(1499), 'silver');
    assert.equal(tierForLifetimePoints(1500), 'gold');
    assert.equal(tierForLifetimePoints(3999), 'gold');
    assert.equal(tierForLifetimePoints(4000), 'platinum');
    assert.equal(tierForLifetimePoints(100000), 'platinum');
  });

  it('reports progress and distance to the next tier', () => {
    const state = computeTierState(750); // silver (500) toward gold (1500)
    assert.equal(state.tier, 'silver');
    assert.equal(state.nextTier, 'gold');
    assert.equal(state.discountPercent, 5);
    assert.equal(state.pointsToNext, 750);
    assert.equal(state.progressPercent, 25);
  });

  it('max tier has no next tier and full progress', () => {
    const state = computeTierState(9000);
    assert.equal(state.tier, 'platinum');
    assert.equal(state.nextTier, null);
    assert.equal(state.progressPercent, 100);
    assert.equal(state.discountPercent, 15);
  });

  it('tier table matches UI membership thresholds', () => {
    assert.deepEqual(
      [TIER_MIN_POINTS.silver, TIER_MIN_POINTS.gold, TIER_MIN_POINTS.platinum],
      [500, 1500, 4000]
    );
  });
});

describe('birthday + day helpers', () => {
  it('recognizes the birthday day only', () => {
    const dob = '1995-03-14';
    assert.equal(isBirthdayOn(dob, new Date(2026, 2, 14)), true); // Mar 14
    assert.equal(isBirthdayOn(dob, new Date(2026, 2, 15)), false);
    assert.equal(isBirthdayOn(null, new Date(2026, 2, 14)), false);
    assert.equal(isBirthdayOn('not-a-date', new Date(2026, 2, 14)), false);
  });

  it('dayKey produces YYYY-MM-DD', () => {
    assert.equal(dayKey(new Date(2026, 0, 5)), '2026-01-05');
  });
});

// ---------------------------------------------------------------------------
// Row builders
// ---------------------------------------------------------------------------

describe('row builders', () => {
  it('buildQrRow generates a unique, parseable code', () => {
    const { row, code } = buildQrRow(USER_A);
    assert.equal(row.qr_code_data, code);
    assert.equal(row.user_id, USER_A);
    assert.equal(parseQrCode(code).ok, true);
  });

  it('buildCheckInRow / buildRewardRow carry the award facts', () => {
    const checkIn = buildCheckInRow({
      userId: USER_A,
      salonId: 'salon-1',
      salonName: 'Scissors & Shears Salon',
      points: 10,
      day: '2026-09-08',
    });
    assert.equal(checkIn.salon_id, 'salon-1');
    assert.equal(checkIn.points_awarded, 10);
    assert.equal(checkIn.day_date, '2026-09-08');

    const reward = buildRewardRow({
      userId: USER_A,
      points: 199,
      type: 'booking',
      description: '10% on booking',
      salonId: 'salon-1',
    });
    assert.equal(reward.points_earned, 199);
    assert.equal(reward.transaction_type, 'booking');
    assert.equal(reward.salon_id, 'salon-1');
  });
});

// ---------------------------------------------------------------------------
// In-memory fake store
// ---------------------------------------------------------------------------

function makeFakeStore() {
  const qrByUser = new Map<string, QrCodeRow>();
  const qrByCode = new Map<string, QrCodeRow>();
  const checkIns: CheckInRow[] = [];
  const rewards: RewardRow[] = [];
  const referrals: ReferralRow[] = [];
  const memberships = new Map<string, UserMembershipRow>();

  const store: EngagementStore = {
    async findQrByUserId(userId) {
      return { ok: true, row: qrByUser.get(userId) ?? null };
    },
    async findQrByCode(code) {
      return { ok: true, row: qrByCode.get(code) ?? null };
    },
    async insertQrCode(row) {
      qrByUser.set(row.user_id, row);
      qrByCode.set(row.qr_code_data, row);
      return { ok: true };
    },
    async touchQrScan(userId) {
      const row = qrByUser.get(userId);
      if (row) row.last_scanned_at = new Date().toISOString();
      return { ok: true };
    },
    async findCheckIn(userId, salonId, day) {
      const row = checkIns.find(
        (c) => c.user_id === userId && c.salon_id === salonId && c.day_date === day
      );
      return { ok: true, row: row ?? null };
    },
    async insertCheckIn(row) {
      checkIns.push(row);
      return { ok: true };
    },
    async insertReward(row) {
      rewards.push(row);
      return { ok: true };
    },
    async upsertMembershipFromReward(userId, points) {
      const existing = memberships.get(userId);
      const base = existing ?? { user_id: userId, lifetime_points: 0, current_points: 0 };
      memberships.set(userId, {
        user_id: userId,
        lifetime_points: base.lifetime_points + Math.max(0, points),
        current_points: Math.max(0, base.current_points + points),
        tier_name: tierForLifetimePoints(base.lifetime_points + Math.max(0, points)),
        updated_at: new Date().toISOString(),
      });
      return { ok: true };
    },
    async listRewards(userId) {
      return { ok: true, rows: rewards.filter((r) => r.user_id === userId) };
    },
    async listCheckIns(userId) {
      return { ok: true, rows: checkIns.filter((c) => c.user_id === userId) };
    },
    async listReferralsFor(userId) {
      return { ok: true, rows: referrals.filter((r) => r.referrer_user_id === userId) };
    },
    async findMembership(userId) {
      return { ok: true, row: memberships.get(userId) ?? null };
    },
  };

  return { store, qrByUser, checkIns, rewards, referrals, memberships };
}

describe('ensureUserQrCode', () => {
  it('creates a code on first call and returns the same one after', async () => {
    const { store, qrByUser } = makeFakeStore();
    const first = await ensureUserQrCode(store, USER_A);
    assert.equal(first.status, 'created');
    const again = await ensureUserQrCode(store, USER_A);
    assert.equal(again.status, 'existing');
    assert.equal(again.code, first.code);
    assert.equal(qrByUser.size, 1);
  });
});

describe('processQrCheckIn', () => {
  it('rejects unregistered codes', async () => {
    const { store } = makeFakeStore();
    const res = await processQrCheckIn(store, {
      code: buildQrCode(USER_B, 'nope-nope-nope-nope-nope-nope'),
      salonId: 'salon-1',
      salonName: 'Salon One',
    });
    assert.equal(res.status, 'not_found');
  });

  it('awards points once per user/salon/day and rejects the duplicate scan', async () => {
    const { store, qrByUser, rewards, checkIns } = makeFakeStore();
    await ensureUserQrCode(store, USER_A);
    const code = qrByUser.get(USER_A)!.qr_code_data;

    const first = await processQrCheckIn(store, { code, salonId: 'salon-1', salonName: 'Salon One' });
    assert.equal(first.status, 'ok');
    if (first.status === 'ok') {
      assert.equal(first.pointsAwarded, 10);
      assert.equal(first.userId, USER_A);
    }

    const dup = await processQrCheckIn(store, { code, salonId: 'salon-1', salonName: 'Salon One' });
    assert.equal(dup.status, 'duplicate');

    // A different salon the same day is allowed and rewarded separately.
    const otherSalon = await processQrCheckIn(store, {
      code,
      salonId: 'salon-2',
      salonName: 'Salon Two',
    });
    assert.equal(otherSalon.status, 'ok');

    assert.equal(checkIns.length, 2);
    assert.equal(rewards.filter((r) => r.transaction_type === 'qr_check_in').length, 2);
    assert.equal(rewards.filter((r) => r.transaction_type === 'qr_check_in')[0].points_earned, 10);
  });
});

describe('getEngagementSummary', () => {
  it('aggregates ledger, tier, check-ins and referrals', async () => {
    const { store, qrByUser, rewards, checkIns, referrals, memberships } = makeFakeStore();
    await ensureUserQrCode(store, USER_A);
    const code = qrByUser.get(USER_A)!.qr_code_data;
    await processQrCheckIn(store, { code, salonId: 'salon-1', salonName: 'Salon One' });

    // Manual booking reward + referral row like the DB triggers would create.
    rewards.push(
      buildRewardRow({
        userId: USER_A,
        points: 499,
        type: 'booking',
        description: '10% on booking',
        salonId: 'salon-1',
      })
    );
    await store.upsertMembershipFromReward(USER_A, 499);
    referrals.push({
      id: 'ref-1',
      referrer_user_id: USER_A,
      referred_user_id: USER_B,
      referred_name: 'Friend',
      status: 'pending',
      reward_points: 150,
      created_at: new Date().toISOString(),
    });
    void checkIns;

    const res = await getEngagementSummary(store, USER_A);
    assert.equal(res.status, 'ok');
    if (res.status !== 'ok') return;
    const s = res.summary;
    assert.equal(s.qr.exists, true);
    assert.equal(s.lifetimePoints, 509); // 10 (check-in) + 499 (booking)
    assert.equal(s.currentPoints, 509);
    assert.equal(s.tier.tier, 'silver'); // ≥500 lifetime
    assert.equal(s.tier.discountPercent, 5);
    assert.equal(s.checkInsThisMonth >= 1, true);
    assert.equal(s.totalCheckIns, 1);
    assert.equal(s.referralCount.pending, 1);
    assert.equal(s.pendingBonusPoints, 150);
    assert.equal(s.recentTransactions.length, 2);
    void memberships;
  });
});

// ---------------------------------------------------------------------------
// HTTP handler behaviors (real express, injected fake store)
// ---------------------------------------------------------------------------

import express from 'express';
import type { AddressInfo } from 'node:net';
import { createEngagementRouter } from '../server/engagement';

describe('POST /api/engagement endpoints over HTTP', () => {
  let server: import('node:http').Server | null = null;
  let baseUrl = '';

  function listen(app: express.Express) {
    const srv = app.listen(0, '127.0.0.1');
    return srv;
  }

  async function start(store: EngagementStore | null) {
    const app = express();
    app.use(express.json());
    app.use('/api/engagement', createEngagementRouter({} as NodeJS.ProcessEnv, store));
    server = listen(app);
    await new Promise<void>((resolve) => server?.once('listening', () => resolve()));
    baseUrl = `http://127.0.0.1:${(server?.address() as AddressInfo).port}`;
  }

  async function stop() {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    server = null;
  }

  it('answers 503 honestly without a service client', async () => {
    await start(null);
    try {
      const res = await fetch(`${baseUrl}/api/engagement/qr/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: USER_A }),
      });
      assert.equal(res.status, 503);
    } finally {
      await stop();
    }
  });

  it('rejects a malformed userId with 400', async () => {
    const { store } = makeFakeStore();
    await start(store);
    try {
      const res = await fetch(`${baseUrl}/api/engagement/qr/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: USER_BAD }),
      });
      assert.equal(res.status, 400);
    } finally {
      await stop();
    }
  });

  it('generate → check-in → duplicate 409 → summary 200 round trip', async () => {
    const fake = makeFakeStore();
    await start(fake.store);
    try {
      const gen = await fetch(`${baseUrl}/api/engagement/qr/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: USER_A }),
      });
      assert.equal(gen.status, 201);
      const genPayload = (await gen.json()) as { qrCode: { code: string } };

      const scan = await fetch(`${baseUrl}/api/engagement/qr/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: genPayload.qrCode.code,
          salonId: 'salon-1',
          salonName: 'Salon One',
        }),
      });
      assert.equal(scan.status, 201);
      const scanPayload = (await scan.json()) as { pointsAwarded: number };
      assert.equal(scanPayload.pointsAwarded, 10);

      const dup = await fetch(`${baseUrl}/api/engagement/qr/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: genPayload.qrCode.code,
          salonId: 'salon-1',
          salonName: 'Salon One',
        }),
      });
      assert.equal(dup.status, 409);

      const summary = await fetch(`${baseUrl}/api/engagement/summary/${USER_A}`);
      assert.equal(summary.status, 200);
      const summaryPayload = (await summary.json()) as {
        summary: { currentPoints: number; totalCheckIns: number; qr: { exists: boolean } };
      };
      assert.equal(summaryPayload.summary.qr.exists, true);
      assert.equal(summaryPayload.summary.currentPoints, 10);
      assert.equal(summaryPayload.summary.totalCheckIns, 1);
    } finally {
      await stop();
    }
  });
});
