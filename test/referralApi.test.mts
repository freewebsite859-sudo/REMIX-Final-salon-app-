/**
 * Referral attribution API (server/referrals.ts) — real Express router, real
 * HTTP, in-memory store.
 *
 * Proves the cross-device half of the invite flow:
 *   • an unknown code is a clean 404 (never a 500)
 *   • a known code resolves to the referrer's display name
 *   • POST /accept writes ONE pending referral row carrying the 150-point award
 *   • re-POSTing the same signup is idempotent (no double counting)
 *   • self-referral is refused
 *   • GET /:userId returns the counters the referral screen shows
 *   • without a service-role client the API says 503 honestly
 */
import express from 'express';
import type { AddressInfo } from 'node:net';
import {
  createReferralsRouter,
  summariseReferrals,
  type ReferralRowLite,
  type ReferralStore,
} from '../server/referrals.ts';
import { REFERRAL_POINTS_PER_INVITE } from '../src/lib/referralService.ts';

let passed = 0;
let failed = 0;
function check(label: string, cond: boolean, detail = '') {
  if (cond) {
    console.log(`PASS  ${label}${detail ? ` — ${detail}` : ''}`);
    passed += 1;
  } else {
    console.log(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
    failed += 1;
  }
}

const REFERRER_ID = '11111111-1111-4111-8111-111111111111';
const REFERRED_ID = '22222222-2222-4222-8222-222222222222';
const CODE = 'NX-VIJAY634';

function makeStore(): ReferralStore & { rows: ReferralRowLite[] } {
  const rows: ReferralRowLite[] = [];
  return {
    rows,
    async findReferrerByCode(code) {
      if (code.toUpperCase() !== CODE) return { ok: true, row: null };
      return {
        ok: true,
        row: { id: REFERRER_ID, referral_code: CODE, full_name: 'Vijay Kumar', email: 'vijay@example.com' },
      };
    },
    async findReferral(referrerUserId, referredUserId) {
      const row =
        rows.find(
          (r) => r.referrer_user_id === referrerUserId && r.referred_user_id === referredUserId
        ) ?? null;
      return { ok: true, row };
    },
    async insertReferral(row) {
      if (
        rows.some(
          (r) =>
            r.referrer_user_id === row.referrer_user_id &&
            r.referred_user_id === row.referred_user_id
        )
      ) {
        return { ok: false, error: 'duplicate' };
      }
      const id = `referral-${rows.length + 1}`;
      rows.push({
        id,
        referrer_user_id: row.referrer_user_id,
        referred_user_id: row.referred_user_id,
        referred_name: row.referred_name ?? null,
        status: row.status,
        reward_points: row.reward_points,
      });
      return { ok: true, id };
    },
    async listReferralsFor(userId) {
      return { ok: true, rows: rows.filter((r) => r.referrer_user_id === userId) };
    },
    async readReferralCode(userId) {
      return { ok: true, code: userId === REFERRER_ID ? CODE : null };
    },
  };
}

async function startServer(store: ReferralStore | null): Promise<{ base: string; close: () => void }> {
  const app = express();
  app.use(express.json());
  app.use('/api/referrals', createReferralsRouter({}, store));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const { port } = server.address() as AddressInfo;
  return {
    base: `http://127.0.0.1:${port}/api/referrals`,
    close: () => server.close(),
  };
}

async function run() {
  const store = makeStore();
  const { base, close } = await startServer(store);

  // 1. Unknown code → clean 404
  const missing = await fetch(`${base}/resolve?code=NX-NOBODY000`);
  check('unknown code resolves to 404', missing.status === 404, String(missing.status));
  check(
    'unknown code carries a readable error',
    typeof (await missing.json()).error === 'string'
  );

  // 2. Known code → referrer name
  const found = await fetch(`${base}/resolve?code=${CODE.toLowerCase()}`);
  const foundBody = (await found.json()) as any;
  check('known code resolves to 200', found.status === 200, String(found.status));
  check('resolver returns the referrer name', foundBody.referrer?.name === 'Vijay Kumar', foundBody.referrer?.name);
  check(
    'resolver reports the 150-point award',
    foundBody.rewardPoints === REFERRAL_POINTS_PER_INVITE,
    String(foundBody.rewardPoints)
  );

  // 3. Accept a signup → one pending row with the award attached
  const accept = await fetch(`${base}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: CODE,
      referredUserId: REFERRED_ID,
      referredName: 'Asha Meena',
      referredEmail: 'asha@example.com',
    }),
  });
  const acceptBody = (await accept.json()) as any;
  check('signup attribution accepted (201)', accept.status === 201, String(accept.status));
  check('referral row written', store.rows.length === 1, String(store.rows.length));
  check('referral row is pending', store.rows[0]?.status === 'pending', store.rows[0]?.status);
  check(
    'referral row carries 150 points',
    store.rows[0]?.reward_points === REFERRAL_POINTS_PER_INVITE,
    String(store.rows[0]?.reward_points)
  );
  check('referrer named in the response', acceptBody.referrerName === 'Vijay Kumar', acceptBody.referrerName);

  // 4. Re-POSTing the same signup does not double count
  const replay = await fetch(`${base}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: CODE, referredUserId: REFERRED_ID, referredName: 'Asha Meena' }),
  });
  const replayBody = (await replay.json()) as any;
  check('replay is idempotent (200)', replay.status === 200, String(replay.status));
  check('replay flagged as duplicate', replayBody.duplicate === true);
  check('still exactly one referral row', store.rows.length === 1, String(store.rows.length));

  // 5. Self-referral refused
  const selfRef = await fetch(`${base}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: CODE, referredUserId: REFERRER_ID }),
  });
  check('self-referral refused (400)', selfRef.status === 400, String(selfRef.status));

  // 6. Bad payload → 400 with the offending fields
  const bad = await fetch(`${base}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: '', referredUserId: 'not-a-uuid' }),
  });
  const badBody = (await bad.json()) as any;
  check('incomplete payload refused (400)', bad.status === 400, String(bad.status));
  check(
    'response lists the bad fields',
    Array.isArray(badBody.fields) && badBody.fields.includes('referredUserId'),
    JSON.stringify(badBody.fields)
  );

  // 7. Counters for the referral screen
  const summary = await fetch(`${base}/${REFERRER_ID}`);
  const summaryBody = (await summary.json()) as any;
  check('summary endpoint returns the code', summaryBody.referralCode === CODE, summaryBody.referralCode);
  check('summary counts 1 invite', summaryBody.summary?.totalInvited === 1, String(summaryBody.summary?.totalInvited));
  check('summary counts 1 pending', summaryBody.summary?.pendingReferrals === 1, String(summaryBody.summary?.pendingReferrals));
  check(
    'summary holds the points until completion',
    summaryBody.summary?.rewardPending === REFERRAL_POINTS_PER_INVITE &&
      summaryBody.summary?.rewardEarned === 0,
    `earned=${summaryBody.summary?.rewardEarned} pending=${summaryBody.summary?.rewardPending}`
  );

  // 8. Summariser flips when a row completes
  store.rows[0].status = 'completed';
  const settled = summariseReferrals(store.rows);
  check(
    'completed referral moves points to earned',
    settled.successfulReferrals === 1 &&
      settled.rewardEarned === REFERRAL_POINTS_PER_INVITE &&
      settled.rewardPending === 0,
    JSON.stringify(settled)
  );

  close();

  // 9. Without a service-role client the API is honest instead of pretending
  const unconfigured = await startServer(null);
  const down = await fetch(`${unconfigured.base}/resolve?code=${CODE}`);
  check('unconfigured backend returns 503', down.status === 503, String(down.status));
  unconfigured.close();
}

run()
  .catch((err) => {
    console.error('Referral API test crashed:', err);
    failed += 1;
  })
  .finally(() => {
    console.log(`\n${passed}/${passed + failed} referral API checks passed`);
    process.exit(failed > 0 ? 1 : 0);
  });
