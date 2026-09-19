/**
 * Cancellation refund policy — one source of truth shared by the browser
 * (quote preview) and the server (`server/paymentsExtra.ts`, which is
 * authoritative and performs the actual Razorpay refund).
 *
 *   ≥ 24 h before the slot → 100 % of the advance
 *   2 h – 24 h before      → 50 %
 *   < 2 h / after start    → 0 %
 */
import { parseAppointmentDateTime } from './appointments';

export interface RefundPolicyQuote {
  percent: 100 | 50 | 0;
  amountRupees: number;
  hoursBefore: number;
  label: string;
}

export function refundPolicyFor(slotDate: string, slotTime: string, advanceRupees: number, nowMs = Date.now()): RefundPolicyQuote {
  const start = parseAppointmentDateTime(slotDate, slotTime);
  const hoursBefore = start ? (start.getTime() - nowMs) / 3_600_000 : -1;
  const percent: 100 | 50 | 0 = hoursBefore >= 24 ? 100 : hoursBefore >= 2 ? 50 : 0;
  const amountRupees = Math.round((advanceRupees * percent) / 100);
  const label = percent === 100 ? 'Full refund (cancelled 24h+ ahead)' : percent === 50 ? '50% refund (cancelled 2–24h ahead)' : 'Non-refundable (under 2h notice)';
  return { percent, amountRupees, hoursBefore: Math.round(hoursBefore * 10) / 10, label };
}
