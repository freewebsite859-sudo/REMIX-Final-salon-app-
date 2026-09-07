/**
 * Referral Service Unit Tests
 *
 * Rules:
 * - Customer gets referral points only when referred user makes min ₹100 QR payment.
 * - Referral rewards are not cash.
 * - Rewards can be redeemed only at partner shops.
 */
import {
  computeReferralSummary,
  MIN_QUALIFYING_QR_PAYMENT,
  REFERRAL_POINTS_PER_INVITE,
  DEFAULT_REFERRAL_RECORDS,
  type ReferralRecord,
} from '../src/lib/referralService.ts';

let passed = 0;
let failed = 0;

function check(label: string, cond: boolean, detail = '') {
  if (cond) {
    console.log(`PASS  ${label}${detail ? ` — ${detail}` : ''}`);
    passed++;
  } else {
    console.log(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

// 1. Constants
check('min qualifying QR payment is ₹100', MIN_QUALIFYING_QR_PAYMENT === 100);
check('referral points per invite is 150 pts', REFERRAL_POINTS_PER_INVITE === 150);

// 2. Default Seed Records
check('default seed records exist', DEFAULT_REFERRAL_RECORDS.length >= 5);
const completedSeeds = DEFAULT_REFERRAL_RECORDS.filter((r) => r.status === 'completed');
const pendingSeeds = DEFAULT_REFERRAL_RECORDS.filter((r) => r.status === 'pending');
check('includes completed referrals', completedSeeds.length >= 3);
check('includes pending referrals', pendingSeeds.length >= 2);

// 3. Calculation Logic
const testRecords: ReferralRecord[] = [
  {
    id: 't-1',
    friendName: 'Aman',
    invitedDate: '01 Sep 2026',
    completedDate: '03 Sep 2026',
    status: 'completed',
    rewardPoints: 150,
    qualifyingPaymentAmount: 300,
  },
  {
    id: 't-2',
    friendName: 'Bhavna',
    invitedDate: '02 Sep 2026',
    completedDate: '04 Sep 2026',
    status: 'completed',
    rewardPoints: 150,
    qualifyingPaymentAmount: 500,
  },
  {
    id: 't-3',
    friendName: 'Chirag',
    invitedDate: '05 Sep 2026',
    status: 'pending',
    rewardPoints: 150,
  },
];

const summary = computeReferralSummary('NEXORA-TEST99', testRecords);

check('referral code set in summary', summary.referralCode === 'NEXORA-TEST99');
check('referral link contains code', summary.referralLink.includes('NEXORA-TEST99'));
check('total invited count is 3', summary.totalInvited === 3, String(summary.totalInvited));
check('successful referrals count is 2', summary.successfulReferrals === 2, String(summary.successfulReferrals));
check('pending referrals count is 1', summary.pendingReferrals === 1, String(summary.pendingReferrals));
check('reward earned is 300 pts (2 * 150)', summary.rewardEarned === 300, String(summary.rewardEarned));

console.log(`\n${passed}/${passed + failed} referral service checks passed`);
if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
