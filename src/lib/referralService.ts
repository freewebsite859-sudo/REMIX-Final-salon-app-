/**
 * Nexora Customer Referral Service
 *
 * Referral Rules:
 * 1. Customer gets referral points only when referred user makes minimum ₹100 QR payment at Nexora partner shop.
 * 2. Referral rewards are not cash (no cash withdrawal).
 * 3. Rewards can be redeemed only at partner shops.
 *
 * Attribution flow (invite link → signup → counting):
 *   a. Every customer owns ONE stable referral code (`NX-VIJAY634` style),
 *      registered in a local registry and mirrored to `profiles.referral_code`
 *      when a live Supabase project is configured.
 *   b. `https://<deployment-origin>/invite?code=NX-VIJAY634` opens the signup
 *      form with that code prefilled (see `lib/inviteLink.ts`; the origin comes
 *      from VITE_APP_URL/APP_URL, falling back to the current host, and the
 *      server 302s the invite path — see `server/inviteRedirects.ts`).
 *      Internal URLs use `?ref=` because `?code=` belongs to Supabase's PKCE
 *      exchange; `?code=` only ever appears in the public share link.
 *   c. On a successful signup the code is resolved back to the referrer and a
 *      PENDING referral row is written — that is what "Total Invited" counts.
 *   d. When the referred friend completes a qualifying ₹100+ QR payment the row
 *      flips to `completed` and the referrer is credited 150 points.
 */

import { buildInviteLink, normalizeReferralCode } from './inviteLink';
import { addReferralReward, MIN_QR_PAYMENT_INR } from './rewardsService';

export interface ReferralRecord {
  id: string;
  friendName: string;
  friendMobile?: string;
  friendAvatar?: string;
  invitedDate: string;
  completedDate?: string;
  status: 'completed' | 'pending';
  rewardPoints: number;
  qualifyingPaymentAmount?: number;
  salonName?: string;
  /** Set for real (non-demo) rows created from an invite-link signup. */
  referredUserId?: string;
  referredEmail?: string;
  source?: 'invite_link' | 'manual_invite';
}

export interface ReferralSummary {
  referralCode: string;
  referralLink: string;
  totalInvited: number;
  successfulReferrals: number;
  pendingReferrals: number;
  rewardEarned: number;
  friends: ReferralRecord[];
}

/** Who owns a referral code (local registry entry). */
export interface ReferralCodeOwner {
  code: string;
  /** Storage key of the referrer — same key their referral records use. */
  ownerKey: string;
  userId?: string;
  name?: string;
  email?: string;
  mobile?: string;
  createdAt: string;
}

/** Result of registering a signup against a referral code. */
export interface ReferralRegistrationResult {
  success: boolean;
  /** Reason when success is false — surfaced honestly in the UI. */
  reason?: 'missing_code' | 'unknown_code' | 'duplicate' | 'self_referral' | 'error';
  code: string;
  record?: ReferralRecord;
  referrer?: ReferralCodeOwner;
  summary?: ReferralSummary;
  message: string;
}

export const MIN_QUALIFYING_QR_PAYMENT = MIN_QR_PAYMENT_INR;
export const REFERRAL_POINTS_PER_INVITE = 150;

export const DEFAULT_REFERRAL_RECORDS: ReferralRecord[] = [
  {
    id: 'ref-01',
    friendName: 'Rahul Verma',
    friendMobile: '+91 98291 •••••',
    friendAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80',
    invitedDate: '15 Aug 2026',
    completedDate: '20 Aug 2026',
    status: 'completed',
    rewardPoints: 150,
    qualifyingPaymentAmount: 450,
    salonName: 'Nexora Signature C-Scheme',
  },
  {
    id: 'ref-02',
    friendName: 'Priya Sen',
    friendMobile: '+91 98292 •••••',
    friendAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80',
    invitedDate: '22 Aug 2026',
    completedDate: '28 Aug 2026',
    status: 'completed',
    rewardPoints: 150,
    qualifyingPaymentAmount: 1200,
    salonName: 'Scissors & Shears Salon',
  },
  {
    id: 'ref-03',
    friendName: 'Vikram Rathore',
    friendMobile: '+91 98293 •••••',
    friendAvatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=120&q=80',
    invitedDate: '01 Sep 2026',
    completedDate: '04 Sep 2026',
    status: 'completed',
    rewardPoints: 150,
    qualifyingPaymentAmount: 350,
    salonName: 'Luxe Beauty Lounge',
  },
  {
    id: 'ref-04',
    friendName: 'Neha Meena',
    friendMobile: '+91 98294 •••••',
    friendAvatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=120&q=80',
    invitedDate: '05 Sep 2026',
    status: 'pending',
    rewardPoints: 150,
    salonName: 'Awaiting first ₹100+ QR payment',
  },
  {
    id: 'ref-05',
    friendName: 'Amit Joshi',
    friendMobile: '+91 98295 •••••',
    friendAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80',
    invitedDate: '06 Sep 2026',
    status: 'pending',
    rewardPoints: 150,
    salonName: 'Awaiting first ₹100+ QR payment',
  },
];

const STORAGE_PREFIX = 'nexora_customer_referrals';
/** code → owner map, so an invite code can be resolved back to a customer. */
const CODE_REGISTRY_KEY = 'nexora_referral_code_registry';
/** per-customer stable code */
const REFERRAL_CODE_KEY = 'nexora_referral_code';
/** per-customer "who invited me" */
const REFERRED_BY_KEY = 'nexora_referred_by';
/** Broadcast so open referral screens refresh their counts live. */
export const REFERRAL_UPDATED_EVENT = 'nexora:referral-updated';

export function getReferralStorageKey(userId?: string): string {
  return userId ? `${STORAGE_PREFIX}_${userId}` : STORAGE_PREFIX;
}

function notifyUpdated(): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new Event(REFERRAL_UPDATED_EVENT));
  } catch {
    /* ignore */
  }
}

/**
 * Real, device-recorded rows only. Unlike `loadReferralRecords` this never
 * falls back to the demo seeds, so counts stay truthful once a real referral
 * has been recorded.
 */
export function loadStoredReferralRecords(userId?: string): ReferralRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getReferralStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ReferralRecord[]) : [];
  } catch {
    return [];
  }
}

export function loadReferralRecords(userId?: string): ReferralRecord[] {
  if (typeof window === 'undefined') return DEFAULT_REFERRAL_RECORDS;
  try {
    const raw = localStorage.getItem(getReferralStorageKey(userId));
    if (!raw) return DEFAULT_REFERRAL_RECORDS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_REFERRAL_RECORDS;
  } catch {
    return DEFAULT_REFERRAL_RECORDS;
  }
}

export function saveReferralRecords(records: ReferralRecord[], userId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getReferralStorageKey(userId), JSON.stringify(records));
  } catch (err) {
    console.warn('[Nexora] Could not save referral records to localStorage', err);
  }
  notifyUpdated();
}

export function computeReferralSummary(
  code: string,
  records: ReferralRecord[]
): ReferralSummary {
  const completed = records.filter((r) => r.status === 'completed');
  const pending = records.filter((r) => r.status === 'pending');
  const rewardEarned = completed.reduce((sum, r) => sum + (r.rewardPoints || 0), 0);

  return {
    referralCode: code,
    referralLink: buildInviteLink(code),
    totalInvited: records.length,
    successfulReferrals: completed.length,
    pendingReferrals: pending.length,
    rewardEarned,
    friends: records,
  };
}

// ---------------------------------------------------------------------------
// Referral codes — stable per customer, resolvable from an invite link
// ---------------------------------------------------------------------------

function hashToDigits(seed: string): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i += 1) {
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) | 0;
  }
  return 100 + (Math.abs(hash) % 900);
}

/**
 * Build the `NX-<NAME><ddd>` code shown on the share card (e.g. `NX-VIJAY634`).
 * Deterministic for a given (name, email, id) triple so a customer never sees
 * two different codes, and it uses the FIRST name only so the code stays short
 * and readable in a WhatsApp message.
 */
export function buildReferralCode(input: {
  name?: string;
  email?: string;
  id?: string;
}): string {
  const source = input.name || input.email || 'NEXORA';
  const firstName = source.trim().split(/\s+/)[0] || source;
  const letters =
    firstName.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 6) || 'NXUSER';
  const seed = `${input.name || ''}|${input.email || ''}|${input.id || ''}`;
  return `NX-${letters}${hashToDigits(seed)}`;
}

export function loadReferralCodeRegistry(): Record<string, ReferralCodeOwner> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CODE_REGISTRY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ReferralCodeOwner>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** Map a code to its owner so a signup can be attributed (and counted). */
export function registerReferralCode(owner: Partial<ReferralCodeOwner> & { code: string }): void {
  const code = normalizeReferralCode(owner.code);
  if (!code || typeof window === 'undefined') return;
  try {
    const registry = loadReferralCodeRegistry();
    const existing = registry[code];
    registry[code] = {
      code,
      ownerKey: owner.ownerKey || existing?.ownerKey || owner.email || owner.userId || '',
      userId: owner.userId || existing?.userId,
      name: owner.name || existing?.name,
      email: owner.email || existing?.email,
      mobile: owner.mobile || existing?.mobile,
      createdAt: existing?.createdAt || owner.createdAt || new Date().toISOString(),
    };
    localStorage.setItem(CODE_REGISTRY_KEY, JSON.stringify(registry));
  } catch (err) {
    console.warn('[Nexora] Could not register referral code', err);
  }
}

/** Resolve an invite code back to the customer who shared it. */
export function findReferralCodeOwner(code?: string | null): ReferralCodeOwner | null {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return null;
  return loadReferralCodeRegistry()[normalized] || null;
}

/**
 * The customer's stable referral code. Prefers the value already on the
 * profile, then a previously issued code, then derives one — and always
 * (re)registers it so invite links keep resolving.
 *
 * Deliberately side-effect free apart from localStorage: this runs inside
 * render (useMemo) on three screens, so it must never touch the network. Cloud
 * persistence is a separate, explicit step — see `syncReferralCodeToProfile`.
 */
export function ensureReferralCode(user: {
  name?: string;
  email?: string;
  phone?: string;
  userId?: string;
  referralCode?: string;
}): string {
  const ownerKey = user.email || user.phone || user.userId || '';
  const fromProfile = normalizeReferralCode(user.referralCode);
  let stored = '';
  if (typeof window !== 'undefined' && ownerKey) {
    try {
      stored = normalizeReferralCode(localStorage.getItem(`${REFERRAL_CODE_KEY}_${ownerKey}`));
    } catch {
      stored = '';
    }
  }

  const code =
    fromProfile ||
    stored ||
    buildReferralCode({ name: user.name, email: user.email, id: ownerKey });

  if (typeof window !== 'undefined' && ownerKey && stored !== code) {
    try {
      localStorage.setItem(`${REFERRAL_CODE_KEY}_${ownerKey}`, code);
    } catch {
      /* storage unavailable */
    }
  }

  registerReferralCode({
    code,
    ownerKey,
    name: user.name,
    email: user.email,
    mobile: user.phone,
    userId: user.userId,
  });

  return code;
}

/**
 * Mirror the code into `profiles.referral_code` so an invite link opened on
 * ANOTHER device can be resolved by the backend (server/referrals.ts).
 *
 * Explicit and awaited-by-nobody on purpose: it is called once per session from
 * App's post-auth effect, never from render, and only when a LIVE Supabase
 * project is configured. The column ships with
 * `supabase/migrations/20260910120000_referral_codes_invite_links.sql`.
 */
export async function syncReferralCodeToProfile(user: {
  userId?: string;
  name?: string;
  email?: string;
  phone?: string;
  referralCode?: string;
}): Promise<{ synced: boolean; code: string; error?: string }> {
  const code = ensureReferralCode(user);
  if (!user.userId) return { synced: false, code, error: 'no user id' };
  try {
    const { supabase, isRealSupabaseConfigured } = await import('./supabase');
    if (!supabase || !isRealSupabaseConfigured) {
      return { synced: false, code, error: 'live supabase not configured' };
    }
    const { error } = await supabase
      .from('profiles')
      .update({ referral_code: code, updated_at: new Date().toISOString() })
      .eq('id', user.userId);
    if (error) {
      // Usually "column does not exist" on a project that has not run the
      // migration yet — local attribution still works.
      return { synced: false, code, error: error.message };
    }
    return { synced: true, code };
  } catch (err) {
    return { synced: false, code, error: err instanceof Error ? err.message : String(err) };
  }
}

// ---------------------------------------------------------------------------
// "Who invited me" (the referred side)
// ---------------------------------------------------------------------------

export interface ReferredByRecord {
  code: string;
  referrerName?: string;
  referrerKey?: string;
  at: string;
}

function referredByKey(userKey: string): string {
  return `${REFERRED_BY_KEY}_${userKey}`;
}

/** Remember that this new account arrived through someone's invite link. */
export function rememberReferredBy(
  userKey: string | undefined,
  owner: ReferralCodeOwner | { code: string; name?: string; ownerKey?: string }
): void {
  const code = normalizeReferralCode(owner.code);
  if (!code || !userKey || typeof window === 'undefined') return;
  try {
    const record: ReferredByRecord = {
      code,
      referrerName: (owner as ReferralCodeOwner).name,
      referrerKey: (owner as ReferralCodeOwner).ownerKey,
      at: new Date().toISOString(),
    };
    localStorage.setItem(referredByKey(userKey), JSON.stringify(record));
  } catch {
    /* storage unavailable */
  }
}

export function readReferredBy(userKey?: string): ReferredByRecord | null {
  if (!userKey || typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(referredByKey(userKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReferredByRecord;
    return normalizeReferralCode(parsed?.code) ? parsed : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Counting — signup attributed to the referrer
// ---------------------------------------------------------------------------

function todayLabel(date: Date = new Date()): string {
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Attribute a fresh signup to the customer whose code was used.
 *
 * Writes a PENDING referral row under the REFERRER's storage key (that is what
 * the referrer's "Total Invited" / "Pending" counters read) and remembers the
 * referrer on the new account. Points stay at 0 until the friend completes a
 * ₹100+ QR payment — the documented program rule.
 */
export function recordReferredSignup(params: {
  code?: string | null;
  referredName?: string;
  referredEmail?: string;
  referredMobile?: string;
  referredUserId?: string;
}): ReferralRegistrationResult {
  const code = normalizeReferralCode(params.code);
  if (!code) {
    return {
      success: false,
      reason: 'missing_code',
      code: '',
      message: 'No referral code was supplied with this signup.',
    };
  }

  const owner = findReferralCodeOwner(code);
  if (!owner) {
    return {
      success: false,
      reason: 'unknown_code',
      code,
      message: `Referral code ${code} is not registered on this device. It will be attributed once the backend is reachable.`,
    };
  }

  const referrerKey = owner.ownerKey || owner.email || owner.userId || '';
  const referredKey = params.referredEmail || params.referredUserId || '';
  if (referredKey && referredKey === referrerKey) {
    return {
      success: false,
      reason: 'self_referral',
      code,
      referrer: owner,
      message: 'You cannot use your own referral code.',
    };
  }

  const existingRecords = loadStoredReferralRecords(referrerKey);
  const duplicate =
    (referredKey &&
      existingRecords.find(
        (r) =>
          (r.referredEmail && r.referredEmail === params.referredEmail) ||
          (r.referredUserId && r.referredUserId === params.referredUserId) ||
          (params.referredMobile && r.friendMobile === params.referredMobile)
      )) ||
    null;

  if (duplicate) {
    return {
      success: true,
      reason: 'duplicate',
      code,
      referrer: owner,
      record: duplicate,
      summary: computeReferralSummary(code, loadReferralRecords(referrerKey)),
      message: `${duplicate.friendName} was already counted for this referral code.`,
    };
  }

  const record: ReferralRecord = {
    id: `ref-signup-${Date.now()}`,
    friendName: params.referredName?.trim() || 'Nexora friend',
    friendMobile: params.referredMobile || undefined,
    invitedDate: todayLabel(),
    status: 'pending',
    rewardPoints: REFERRAL_POINTS_PER_INVITE,
    salonName: `Signed up with ${code} — awaiting first ₹${MIN_QUALIFYING_QR_PAYMENT}+ QR payment`,
    referredUserId: params.referredUserId,
    referredEmail: params.referredEmail,
    source: 'invite_link',
  };

  saveReferralRecords([...existingRecords, record], referrerKey);
  rememberReferredBy(referredKey || undefined, owner);

  const summary = computeReferralSummary(code, loadReferralRecords(referrerKey));
  return {
    success: true,
    code,
    record,
    referrer: owner,
    summary,
    message: `${owner.name || 'Your friend'} now has ${summary.totalInvited} invite${
      summary.totalInvited === 1 ? '' : 's'
    } counted (${summary.pendingReferrals} pending a ₹${MIN_QUALIFYING_QR_PAYMENT}+ QR payment).`,
  };
}

/**
 * Flip the referred friend's referral to `completed` and credit the referrer
 * 150 points — called when that friend completes a qualifying ₹100+ QR payment.
 */
export function completeReferralByQrPayment(params: {
  referredUserId?: string;
  referredEmail?: string;
  amountInr: number;
  salonName?: string;
}): {
  success: boolean;
  updated: number;
  pointsCredited: number;
  records: ReferralRecord[];
  message: string;
} {
  const { referredUserId, referredEmail, amountInr, salonName } = params;
  if (!referredUserId && !referredEmail) {
    return { success: false, updated: 0, pointsCredited: 0, records: [], message: 'Missing referred user.' };
  }
  if (amountInr < MIN_QUALIFYING_QR_PAYMENT) {
    return {
      success: false,
      updated: 0,
      pointsCredited: 0,
      records: [],
      message: `Referral points need a ₹${MIN_QUALIFYING_QR_PAYMENT}+ QR payment.`,
    };
  }

  const registry = loadReferralCodeRegistry();
  const completed: ReferralRecord[] = [];
  let pointsCredited = 0;

  for (const owner of Object.values(registry)) {
    const referrerKey = owner.ownerKey || owner.email || owner.userId || '';
    if (!referrerKey) continue;
    const records = loadStoredReferralRecords(referrerKey);
    let changed = false;

    const next = records.map((record) => {
      const matches =
        (referredUserId && record.referredUserId === referredUserId) ||
        (referredEmail && record.referredEmail === referredEmail);
      if (!matches || record.status === 'completed') return record;
      changed = true;
      pointsCredited += record.rewardPoints || REFERRAL_POINTS_PER_INVITE;
      completed.push({ ...record, status: 'completed' });
      return {
        ...record,
        status: 'completed' as const,
        completedDate: todayLabel(),
        qualifyingPaymentAmount: amountInr,
        salonName: salonName || record.salonName,
      };
    });

    if (changed) {
      saveReferralRecords(next, referrerKey);
      // Credit the referrer's rewards wallet for each newly completed friend.
      next
        .filter(
          (record) =>
            record.status === 'completed' &&
            ((referredUserId && record.referredUserId === referredUserId) ||
              (referredEmail && record.referredEmail === referredEmail)) &&
            completed.some((c) => c.id === record.id)
        )
        .forEach((record) => {
          addReferralReward({
            userId: referrerKey,
            friendName: record.friendName,
            salonName: salonName || 'Nexora Partner Salon',
            amountInr,
            status: 'Approved',
          });
        });
    }
  }

  notifyUpdated();
  return {
    success: completed.length > 0,
    updated: completed.length,
    pointsCredited,
    records: completed,
    message:
      completed.length > 0
        ? `Referral completed — ${pointsCredited} points credited to the referrer.`
        : 'No pending referral matched this QR payment.',
  };
}

// ---------------------------------------------------------------------------
// Signup hook — everything AuthPage needs after a successful sign-up
// ---------------------------------------------------------------------------

export interface ReferralSignupOutcome extends ReferralRegistrationResult {
  /** What the server said (undefined when the API is disabled/offline). */
  remote?: { ok: boolean; error?: string; referralId?: string; referrerName?: string };
}

/**
 * Called by the signup form once the account exists. Local attribution happens
 * first (always), then the backend is asked to record the same referral so the
 * count survives across devices.
 */
export async function registerReferralAfterSignup(params: {
  code?: string | null;
  name?: string;
  email?: string;
  mobile?: string;
  userId?: string;
}): Promise<ReferralSignupOutcome> {
  // Map the signup payload onto the attribution record: the name/email/mobile
  // of the NEW account become the referrer's "friend" row, and the email/id are
  // what a later ₹100+ QR payment is matched against.
  const local = recordReferredSignup({
    code: params.code,
    referredName: params.name,
    referredEmail: params.email,
    referredMobile: params.mobile,
    referredUserId: params.userId,
  });

  let remote: ReferralSignupOutcome['remote'];
  try {
    const { acceptReferralOnSignup } = await import('./referralClient');
    const result = await acceptReferralOnSignup({
      code: local.code || params.code || '',
      referredUserId: params.userId,
      referredName: params.name,
      referredEmail: params.email,
    });
    remote = {
      ok: result.ok,
      error: result.error,
      referralId: result.referralId,
      referrerName: result.referrerName,
    };
  } catch (err) {
    remote = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  return { ...local, remote };
}
