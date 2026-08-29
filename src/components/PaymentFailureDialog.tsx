import React from 'react';
import { Salon, SalonService, Stylist } from '../types';

export interface PaymentFailureDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRetryPayment: () => void;
  errorMessage?: string | null;
  salon?: Salon | null;
  advanceAmount: number;
  totalAmount: number;
  services?: SalonService[];
  stylist?: Stylist | null;
  date?: string;
  time?: string;
  isRetrying?: boolean;
}

export const PaymentFailureDialog: React.FC<PaymentFailureDialogProps> = ({
  isOpen,
  onClose,
  onRetryPayment,
  errorMessage,
  salon,
  advanceAmount,
  totalAmount,
  services = [],
  stylist,
  date,
  time,
  isRetrying = false,
}) => {
  if (!isOpen) return null;

  const displayError =
    errorMessage ||
    'The transaction could not be completed by your bank or payment gateway. No money was deducted from your account.';

  return (
    <div
      id="payment-failure-dialog-overlay"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="payment-failure-title"
      aria-describedby="payment-failure-description"
    >
      <div
        id="payment-failure-dialog-container"
        className="w-full max-w-md bg-surface text-on-surface rounded-3xl p-5 sm:p-6 shadow-2xl border border-red-500/30 flex flex-col gap-4 max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200"
      >
        {/* Header with Danger/Warning Badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-red-500/15 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 ring-4 ring-red-500/10">
              <span className="material-symbols-outlined text-[28px]">error_outline</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/20">
                  Payment Failed
                </span>
                <span className="text-[10px] text-on-surface-variant font-medium">Razorpay Gateway</span>
              </div>
              <h3
                id="payment-failure-title"
                className="font-bold text-[17px] text-on-surface leading-tight mt-0.5"
              >
                Advance Payment Incomplete
              </h3>
            </div>
          </div>

          <button
            type="button"
            id="close-payment-failure-dialog-btn"
            onClick={onClose}
            aria-label="Close dialog"
            className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Error Details Card */}
        <div
          id="payment-failure-description"
          className="p-3.5 bg-red-500/10 dark:bg-red-950/30 rounded-2xl border border-red-500/25 flex flex-col gap-1.5"
        >
          <div className="flex items-center gap-1.5 text-red-700 dark:text-red-300 font-bold text-[12px]">
            <span className="material-symbols-outlined text-[16px]">info</span>
            <span>Gateway Diagnostic:</span>
          </div>
          <p className="text-[12px] text-on-surface leading-relaxed font-medium">
            {displayError}
          </p>
        </div>

        {/* Booking Draft Safe Guarantee Banner */}
        <div className="p-3 bg-emerald-500/10 dark:bg-emerald-950/30 rounded-2xl border border-emerald-500/25 flex items-start gap-2.5">
          <span className="material-symbols-outlined text-[20px] text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
            inventory_2
          </span>
          <div>
            <h4 className="text-[12px] font-bold text-emerald-800 dark:text-emerald-300">
              Your Booking Draft is Saved
            </h4>
            <p className="text-[11px] text-on-surface-variant mt-0.5">
              Your chosen services, stylist, and time slot have not been discarded. You can retry paying the 25% deposit without re-entering your booking details.
            </p>
          </div>
        </div>

        {/* Booking Draft Details Summary */}
        <div className="p-3.5 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 flex flex-col gap-2 text-[12px]">
          <div className="flex items-center justify-between font-semibold pb-2 border-b border-outline-variant/20">
            <span className="text-on-surface-variant">Salon:</span>
            <span className="text-on-surface font-bold truncate max-w-[200px]">
              {salon?.name || 'Salon'}
            </span>
          </div>

          {(date || time) && (
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
              <span className="text-on-surface-variant">Selected Slot:</span>
              <span className="font-medium text-on-surface">
                {date} · {time}
              </span>
            </div>
          )}

          {services.length > 0 && (
            <div className="flex items-start justify-between pb-2 border-b border-outline-variant/20">
              <span className="text-on-surface-variant shrink-0">Services ({services.length}):</span>
              <span className="text-on-surface font-medium text-right truncate max-w-[200px]">
                {services.map((s) => s.name).join(', ')}
              </span>
            </div>
          )}

          {stylist && (
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
              <span className="text-on-surface-variant">Stylist:</span>
              <span className="text-primary font-bold">{stylist.name}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <span className="text-on-surface-variant font-medium">Mandatory Advance Due (25%):</span>
            <span className="font-extrabold text-primary text-[15px]">₹{advanceAmount}</span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
            <span>Remaining at salon (75%):</span>
            <span>₹{Math.max(0, totalAmount - advanceAmount)}</span>
          </div>
        </div>

        {/* Quick Tips */}
        <div className="text-[11px] text-on-surface-variant px-1 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 font-bold text-on-surface">
            <span className="material-symbols-outlined text-[14px] text-amber-500">lightbulb</span>
            <span>Tips to ensure successful payment:</span>
          </div>
          <p className="pl-4">
            • Try UPI (Google Pay, PhonePe, Paytm QR) or a different Debit/Credit Card.
          </p>
          <p className="pl-4">
            • Ensure sufficient bank balance and stable mobile network.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-outline-variant/30">
          <button
            type="button"
            id="keep-draft-btn"
            onClick={onClose}
            disabled={isRetrying}
            className="w-full sm:w-1/3 py-3 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-[12px] font-bold transition-colors cursor-pointer disabled:opacity-50"
          >
            Review Draft
          </button>

          <button
            type="button"
            id="retry-payment-btn"
            onClick={onRetryPayment}
            disabled={isRetrying}
            className="w-full sm:w-2/3 py-3 rounded-xl bg-[#0c2340] hover:bg-[#08182b] text-white text-[13px] font-extrabold shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer border border-white/10 disabled:opacity-50"
          >
            {isRetrying ? (
              <>
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                <span>Launching Razorpay...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px] text-[#0c65e8]">
                  refresh
                </span>
                <span>Retry Payment (₹{advanceAmount})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
