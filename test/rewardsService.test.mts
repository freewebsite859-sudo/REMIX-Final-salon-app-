/**
 * Rewards Wallet service & business rules unit tests.
 */
import {
  MIN_QR_PAYMENT_INR,
  QR_CASHBACK_PERCENT,
  REFERRAL_BONUS_POINTS,
  POINTS_TO_INR_RATIO,
  isQrPaymentEligible,
  calculateQrPoints,
  calculateWalletSummary,
  filterRewardTransactions,
  getStatusBadgeMeta,
  getTypeBadgeMeta,
  formatRewardDate,
  getDefaultSeedTransactions,
  type RewardTransaction,
  type RewardStatus,
  type RewardType,
} from '../src/lib/rewardsService.ts';

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

// ---------------------------------------------------------------------------
// 1. Constants & Business Rules
// ---------------------------------------------------------------------------
check('min QR payment is ₹100', MIN_QR_PAYMENT_INR === 100);
check('QR cashback is 10%', QR_CASHBACK_PERCENT === 10);
check('referral bonus points is 150', REFERRAL_BONUS_POINTS === 150);
check('points to INR ratio is 1:1', POINTS_TO_INR_RATIO === 1);

// ---------------------------------------------------------------------------
// 2. Minimum ₹100 QR Payment Rule
// ---------------------------------------------------------------------------
check('₹50 is not eligible for rewards', isQrPaymentEligible(50) === false);
check('₹99 is not eligible for rewards', isQrPaymentEligible(99) === false);
check('₹100 is eligible for rewards', isQrPaymentEligible(100) === true);
check('₹500 is eligible for rewards', isQrPaymentEligible(500) === true);
check('₹0 is not eligible', isQrPaymentEligible(0) === false);
check('-100 is not eligible', isQrPaymentEligible(-100) === false);

// ---------------------------------------------------------------------------
// 3. Points Calculation
// ---------------------------------------------------------------------------
check('₹50 bill earns 0 points', calculateQrPoints(50) === 0);
check('₹100 bill earns 10 points', calculateQrPoints(100) === 10);
check('₹500 bill earns 50 points', calculateQrPoints(500) === 50);
check('₹1,200 bill earns 120 points', calculateQrPoints(1200) === 120);

// ---------------------------------------------------------------------------
// 4. Default Seed Transactions Check
// ---------------------------------------------------------------------------
const seeds = getDefaultSeedTransactions();
check('seed transactions exist', Array.isArray(seeds) && seeds.length >= 6);

const statuses: RewardStatus[] = ['Pending', 'Approved', 'Redeemed', 'Expired'];
statuses.forEach((st) => {
  const hasStatus = seeds.some((tx) => tx.status === st);
  check(`seed includes transaction with status: ${st}`, hasStatus);
});

const types: RewardType[] = ['qr_payment', 'referral', 'redemption', 'expired'];
types.forEach((tp) => {
  const hasType = seeds.some((tx) => tx.type === tp);
  check(`seed includes transaction with type: ${tp}`, hasType);
});

// ---------------------------------------------------------------------------
// 5. Wallet Summary Calculations
// ---------------------------------------------------------------------------
const testTransactions: RewardTransaction[] = [
  {
    id: 'tx-1',
    type: 'qr_payment',
    typeLabel: 'QR Payment Reward',
    points: 100,
    date: '01 Sep 2026',
    createdAt: '2026-09-01T10:00:00Z',
    salonName: 'Salon A',
    status: 'Approved',
  },
  {
    id: 'tx-2',
    type: 'referral',
    typeLabel: 'Referral Reward',
    points: 150,
    date: '02 Sep 2026',
    createdAt: '2026-09-02T10:00:00Z',
    salonName: 'Salon B',
    status: 'Approved',
  },
  {
    id: 'tx-3',
    type: 'redemption',
    typeLabel: 'In-Shop QR Redemption',
    points: -50,
    date: '03 Sep 2026',
    createdAt: '2026-09-03T10:00:00Z',
    salonName: 'Salon C',
    status: 'Redeemed',
  },
  {
    id: 'tx-4',
    type: 'expired',
    typeLabel: 'Expired Points',
    points: -20,
    date: '04 Sep 2026',
    createdAt: '2026-09-04T10:00:00Z',
    salonName: 'Salon D',
    status: 'Expired',
  },
  {
    id: 'tx-5',
    type: 'qr_payment',
    typeLabel: 'QR Payment Reward',
    points: 80,
    date: '05 Sep 2026',
    createdAt: '2026-09-05T10:00:00Z',
    salonName: 'Salon E',
    status: 'Pending',
  },
];

const summary = calculateWalletSummary(testTransactions);
check('lifetime earned is 250 (100 + 150)', summary.lifetimeEarned === 250, String(summary.lifetimeEarned));
check('lifetime redeemed is 50', summary.lifetimeRedeemed === 50, String(summary.lifetimeRedeemed));
check('expired points is 20', summary.expiredPoints === 20, String(summary.expiredPoints));
check('current points is 180 (250 - 50 - 20)', summary.currentPoints === 180, String(summary.currentPoints));
check('qr payment rewards is 100', summary.qrPaymentRewards === 100, String(summary.qrPaymentRewards));
check('referral rewards is 150', summary.referralRewards === 150, String(summary.referralRewards));
check('pending points is 80', summary.pendingPoints === 80, String(summary.pendingPoints));

// ---------------------------------------------------------------------------
// 6. Filtering & Searching
// ---------------------------------------------------------------------------
const allFiltered = filterRewardTransactions(testTransactions, 'all');
check('filter all returns 5 items', allFiltered.length === 5);

const qrFiltered = filterRewardTransactions(testTransactions, 'qr_payment');
check('filter qr_payment returns 2 items', qrFiltered.length === 2);

const refFiltered = filterRewardTransactions(testTransactions, 'referral');
check('filter referral returns 1 item', refFiltered.length === 1);

const redFiltered = filterRewardTransactions(testTransactions, 'redeemed');
check('filter redeemed returns 1 item', redFiltered.length === 1);

const expFiltered = filterRewardTransactions(testTransactions, 'expired');
check('filter expired returns 1 item', expFiltered.length === 1);

const penFiltered = filterRewardTransactions(testTransactions, 'pending');
check('filter pending returns 1 item', penFiltered.length === 1);

const searchFiltered = filterRewardTransactions(testTransactions, 'all', 'Salon A');
check('search by salon name returns matched item', searchFiltered.length === 1 && searchFiltered[0].salonName === 'Salon A');

// ---------------------------------------------------------------------------
// 7. Status & Type Metadata
// ---------------------------------------------------------------------------
check('status meta Approved has check_circle', getStatusBadgeMeta('Approved').icon === 'check_circle');
check('status meta Pending has hourglass_top', getStatusBadgeMeta('Pending').icon === 'hourglass_top');
check('status meta Redeemed has shopping_bag', getStatusBadgeMeta('Redeemed').icon === 'shopping_bag');
check('status meta Expired has schedule', getStatusBadgeMeta('Expired').icon === 'schedule');

check('type meta qr_payment label is QR Payment Reward', getTypeBadgeMeta('qr_payment').label === 'QR Payment Reward');
check('type meta referral label is Referral Reward', getTypeBadgeMeta('referral').label === 'Referral Reward');
check('type meta redemption label is In-Shop QR Redemption', getTypeBadgeMeta('redemption').label === 'In-Shop QR Redemption');
check('type meta expired label is Expired Points', getTypeBadgeMeta('expired').label === 'Expired Points');

// ---------------------------------------------------------------------------
// 8. Date formatting
// ---------------------------------------------------------------------------
const formatted = formatRewardDate('2026-09-07T12:00:00Z');
check('formatRewardDate produces valid date string', formatted.includes('2026') && formatted.length > 5);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${passed}/${passed + failed} rewards service checks passed`);
if (failed > 0) {
  process.exit(1);
}
