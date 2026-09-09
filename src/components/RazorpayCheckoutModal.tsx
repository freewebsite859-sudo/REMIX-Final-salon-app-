import React, { useEffect, useRef, useState } from 'react';
import { checkoutWithRazorpay, RazorpayPaymentSuccessResponse } from '../lib/razorpay';
import { Salon } from '../types';

interface RazorpayCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  salon: Salon;
  /** Server-created Razorpay order id from POST /api/payments/orders. */
  orderId: string;
  /** Public key id returned with the order. */
  keyId: string;
  advanceAmount: number;
  amountPaise: number;
  totalAmount: number;
  remainingAmount: number;
  serviceCount: number;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  onPaymentSuccess: (response: RazorpayPaymentSuccessResponse) => void;
  onPaymentFailure: (errorMsg: string) => void;
}

/**
 * Official Razorpay Checkout launcher.
 *
 * There is no merchant QR tab, no OTP simulator, and no "simulate payment"
 * button. If checkout.js fails to load, payment fails honestly.
 */
export const RazorpayCheckoutModal: React.FC<RazorpayCheckoutModalProps> = ({
  isOpen,
  onClose,
  salon,
  orderId,
  keyId,
  advanceAmount,
  amountPaise,
  totalAmount,
  remainingAmount,
  serviceCount,
  customerName,
  customerPhone,
  customerEmail,
  onPaymentSuccess,
  onPaymentFailure,
}) => {
  const [status, setStatus] = useState<string>('Opening Razorpay Secure Checkout…');
  const started = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      started.current = false;
      return;
    }
    if (started.current) return;
    started.current = true;

    if (!orderId || !keyId) {
      onPaymentFailure(
        'Secure deposit cannot start: missing server-side gateway order. No merchant QR code or client-side payment shortcut is used.'
      );
      return;
    }

    void (async () => {
      const result = await checkoutWithRazorpay({
        keyId,
        orderId,
        amountPaise,
        name: salon.name,
        description: `25% advance deposit · ${salon.name}`,
        image: salon.image,
        prefill: {
          name: customerName,
          email: customerEmail,
          contact: customerPhone,
        },
        notes: {
          salon_id: salon.id,
          advance_inr: String(advanceAmount),
        },
      });
      if (result.ok === false) {
        setStatus(result.error);
        onPaymentFailure(result.error);
        return;
      }
      onPaymentSuccess(result.payment);
    })();
  }, [
    isOpen,
    orderId,
    keyId,
    amountPaise,
    salon,
    customerName,
    customerEmail,
    customerPhone,
    advanceAmount,
    onPaymentFailure,
    onPaymentSuccess,
  ]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-3">
      <div className="w-full max-w-md bg-[#0c2340] text-white rounded-3xl shadow-2xl border border-white/10 p-6 text-center">
        <div className="w-14 h-14 rounded-full border-4 border-[#0c65e8]/30 border-t-[#0c65e8] animate-spin mx-auto mb-4" />
        <h3 className="text-[17px] font-bold">Razorpay Secure Checkout</h3>
        <p className="text-[12px] text-white/70 mt-2">{status}</p>
        <p className="text-[11px] text-white/50 mt-3">
          ₹{advanceAmount} · 25% deposit to lock {serviceCount} service{serviceCount === 1 ? '' : 's'}. Full bill ₹
          {totalAmount}; ₹{remainingAmount} due at salon.
        </p>
        <p className="text-[11px] text-emerald-400 mt-3 flex items-center justify-center gap-1">
          <span className="material-symbols-outlined text-[14px]">lock</span>
          No merchant QR or in-app payment shortcut
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-[13px] font-semibold"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
