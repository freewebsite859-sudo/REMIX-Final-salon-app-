/**
 * QR & Engagement card — rendered inside the Rewards wallet tab.
 *
 * Shows the customer's personal Nexora QR code (for salon check-in / benefit
 * activation), their DB-backed tier + points summary, and a live indicator
 * when Supabase Realtime is enabled. Honest states only:
 *
 *  - engagement disabled (no VITE_NEXORA_ENGAGEMENT) → small offline note
 *  - server unreachable / not configured            → the server's message
 *  - ready                                          → real QR + summary
 *
 * The card never fabricates a code or a point balance. When userId is missing
 * (guest) it renders nothing at all.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { fetchMyQrCode, fetchEngagementSummary } from '../lib/engagementClient';
import { isRealtimeEnabled, subscribeToTable } from '../lib/realtimeService';
import type { EngagementSummary } from '../lib/engagement';

interface QrEngagementCardProps {
  userId?: string | null;
}

type CardState =
  | { mode: 'hidden' }
  | { mode: 'loading' }
  | { mode: 'disabled'; message: string }
  | { mode: 'error'; message: string }
  | {
      mode: 'ready';
      code: string;
      qrDataUrl: string;
      summary: EngagementSummary;
      live: boolean;
    };

export const QrEngagementCard: React.FC<QrEngagementCardProps> = ({ userId }) => {
  const [state, setState] = useState<CardState>({ mode: 'hidden' });
  const [copied, setCopied] = useState(false);
  const mountedRef = useRef(true);
  const stateRef = useRef(state);
  stateRef.current = state;

  const loadSummary = useCallback(async () => {
    if (!userId || !mountedRef.current) return;
    const sumRes = await fetchEngagementSummary(userId);
    if (!sumRes.ok || !sumRes.data) return; // keep the existing view on refresh failure
    const current = stateRef.current;
    if (current.mode === 'ready') {
      setState({ ...current, summary: sumRes.data });
    }
  }, [userId]);

  useEffect(() => {
    mountedRef.current = true;
    if (!userId) {
      setState({ mode: 'hidden' });
      return;
    }

    let cancelled = false;
    setState({ mode: 'loading' });

    (async () => {
      const qrRes = await fetchMyQrCode(userId);
      const sumRes = await fetchEngagementSummary(userId);
      if (cancelled || !mountedRef.current) return;

      if (!qrRes.ok || !qrRes.data) {
        setState({
          mode: qrRes.code === 'disabled' ? 'disabled' : 'error',
          message:
            qrRes.error ??
            'QR code could not be loaded. The engagement service may be offline.',
        });
        return;
      }

      try {
        const qrFn = QRCode.toDataURL || (QRCode as unknown as { default: { toDataURL: typeof QRCode.toDataURL } }).default?.toDataURL;
        const qrDataUrl = await qrFn(qrRes.data.code, {
          width: 208,
          margin: 1,
          errorCorrectionLevel: 'M',
          color: { dark: '#1a1a1a', light: '#ffffff' },
        });
        if (cancelled || !mountedRef.current) return;
        const zeroTier: EngagementSummary['tier'] = {
          tier: 'standard',
          tierName: 'Standard Guest',
          discountPercent: 0,
          lifetimePoints: 0,
          pointsToNext: 500,
          nextTier: 'silver' as const,
          nextTierMinPoints: 500,
          progressPercent: 0,
        };
        setState({
          mode: 'ready',
          code: qrRes.data.code,
          qrDataUrl,
          summary:
            sumRes.ok && sumRes.data
              ? sumRes.data
              : {
                  userId,
                  qr: { exists: true },
                  tier: zeroTier,
                  currentPoints: 0,
                  lifetimePoints: 0,
                  lifetimeEarned: 0,
                  lifetimeRedeemed: 0,
                  pendingBonusPoints: 0,
                  checkInsThisMonth: 0,
                  totalCheckIns: 0,
                  referralCount: { total: 0, completed: 0, pending: 0, pendingBonusPoints: 0 },
                  recentTransactions: [],
                },
          live: false,
        });
      } catch {
        if (!cancelled && mountedRef.current) {
          setState({ mode: 'error', message: 'QR image could not be generated.' });
        }
      }
    })();

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, [userId]);

  // Live refresh: own rewards / check-in ledger changes push new summaries.
  useEffect(() => {
    if (!userId || !isRealtimeEnabled()) return;
    const filter = `user_id=eq.${userId}`;
    const onStatus = (status: string) => {
      const current = stateRef.current;
      if (current.mode === 'ready') {
        setState({ ...current, live: status === 'subscribed' });
      }
    };
    const rewardsSub = subscribeToTable(
      'rewards',
      () => {
        void loadSummary();
      },
      { filter, onStatus }
    );
    const checkInsSub = subscribeToTable(
      'qr_check_ins',
      () => {
        void loadSummary();
      },
      { filter, onStatus }
    );
    return () => {
      void rewardsSub.unsubscribe();
      void checkInsSub.unsubscribe();
    };
  }, [userId, loadSummary]);

  if (state.mode === 'hidden' || state.mode === 'loading') return null;

  const handleCopy = () => {
    if (state.mode !== 'ready') return;
    void navigator.clipboard?.writeText(state.code).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  };

  return (
    <section
      id="qr-engagement-card"
      aria-label="QR check-in and rewards status"
      className="bg-surface-container-low border border-outline-variant/50 rounded-2xl p-4 sm:p-5 shadow-xs mb-4"
    >
      {state.mode === 'disabled' || state.mode === 'error' ? (
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-surface flex items-center justify-center text-on-surface-variant shrink-0">
            <span className="material-symbols-outlined text-[20px]">qr_code_2</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-card-title text-[14px] font-bold text-on-surface">
              QR Check-in & Live Rewards
            </h3>
            <p className="text-[12px] text-on-surface-variant mt-0.5 leading-relaxed">
              {state.mode === 'disabled'
                ? 'Offline in this build. Connect the Nexora engagement service to unlock salon QR check-ins and live reward updates.'
                : state.message}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start">
          {/* QR visual */}
          <div className="relative shrink-0">
            <div className="w-[208px] h-[208px] rounded-2xl bg-white p-2 shadow-sm ring-1 ring-outline-variant/40">
              <img
                src={state.qrDataUrl}
                alt="Your Nexora check-in QR code"
                className="w-full h-full rounded-xl"
                width={208}
                height={208}
              />
            </div>
            <span
              className={`absolute -top-1.5 -right-1.5 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide shadow-xs ${
                state.live
                  ? 'bg-success-emerald text-white'
                  : 'bg-surface-container-highest text-on-surface-variant'
              }`}
            >
              {state.live ? 'Live' : 'Standby'}
            </span>
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0 w-full">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-card-title text-[16px] font-bold text-on-surface">
                Salon Check-in QR
              </h3>
              <span className="bg-primary/10 text-nexora-pink text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                {state.summary.tier.tierName}
              </span>
              <span className="bg-success-emerald/10 text-success-emerald text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                {state.summary.tier.discountPercent}% off
              </span>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-1 leading-relaxed">
              Show this code at the salon counter to check in and unlock your{' '}
              {state.summary.tier.tierName} benefits.
            </p>

            {/* Code + copy */}
            <div className="flex items-center gap-2 mt-2.5 bg-surface rounded-xl border border-outline-variant/40 px-3 py-2">
              <code className="flex-1 min-w-0 truncate text-[11px] font-mono text-on-surface-variant">
                {state.code}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className="text-[11px] font-bold text-nexora-pink hover:bg-nexora-pink/10 rounded-lg px-2 py-1 transition-colors flex items-center gap-1 shrink-0"
              >
                <span className="material-symbols-outlined text-[13px]">
                  {copied ? 'check' : 'content_copy'}
                </span>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="bg-surface rounded-xl border border-outline-variant/40 p-2.5 text-center">
                <span className="block font-black text-[16px] text-primary leading-none">
                  {state.summary.currentPoints}
                </span>
                <span className="text-[10px] text-on-surface-variant font-semibold mt-1 block">
                  Points
                </span>
              </div>
              <div className="bg-surface rounded-xl border border-outline-variant/40 p-2.5 text-center">
                <span className="block font-black text-[16px] text-primary leading-none">
                  {state.summary.checkInsThisMonth}
                </span>
                <span className="text-[10px] text-on-surface-variant font-semibold mt-1 block">
                  Check-ins
                </span>
              </div>
              <div className="bg-surface rounded-xl border border-outline-variant/40 p-2.5 text-center">
                <span className="block font-black text-[16px] text-primary leading-none">
                  {state.summary.tier.pointsToNext > 0
                    ? state.summary.tier.pointsToNext
                    : '★'}
                </span>
                <span className="text-[10px] text-on-surface-variant font-semibold mt-1 block">
                  {state.summary.tier.nextTier
                    ? `to ${state.summary.tier.nextTier}`
                    : 'Max tier'}
                </span>
              </div>
            </div>

            {/* Tier progress */}
            <div className="mt-3">
              <div className="h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-nexora-pink to-primary transition-all duration-500"
                  style={{ width: `${Math.max(2, state.summary.tier.progressPercent)}%` }}
                />
              </div>
              <p className="text-[10px] text-on-surface-variant mt-1">
                {state.summary.lifetimePoints} lifetime points ·{' '}
                {state.summary.tier.nextTier
                  ? `${state.summary.tier.pointsToNext} points to ${state.summary.tier.nextTier}`
                  : 'platinum benefits unlocked'}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
