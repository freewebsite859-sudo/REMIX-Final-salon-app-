import React, { useState, useEffect } from 'react';
import { getRazorpayKeyId, saveRazorpayKeyId, generateRazorpayPaymentId, generateRazorpayOrderId, RazorpayPaymentSuccessResponse } from '../lib/razorpay';
import { Salon } from '../types';

interface RazorpayCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  salon: Salon;
  advanceAmount: number;
  totalAmount: number;
  remainingAmount: number;
  serviceCount: number;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  onPaymentSuccess: (response: RazorpayPaymentSuccessResponse) => void;
  onPaymentFailure: (errorMsg: string) => void;
}

type PaymentMethodTab = 'upi' | 'qr' | 'card' | 'netbanking' | 'wallet';

export const RazorpayCheckoutModal: React.FC<RazorpayCheckoutModalProps> = ({
  isOpen,
  onClose,
  salon,
  advanceAmount,
  totalAmount,
  remainingAmount,
  serviceCount,
  customerName = 'Salon Guest',
  customerPhone = '9876543210',
  customerEmail = 'guest@nexorasalon.com',
  onPaymentSuccess,
  onPaymentFailure,
}) => {
  const [activeTab, setActiveTab] = useState<PaymentMethodTab>('upi');
  const [selectedUpiApp, setSelectedUpiApp] = useState<string>('gpay');
  const [customUpiId, setCustomUpiId] = useState<string>('');
  const [upiIdError, setUpiIdError] = useState<string | null>(null);

  // Card details state
  const [cardNumber, setCardNumber] = useState<string>('4532 •••• •••• 8892');
  const [cardExpiry, setCardExpiry] = useState<string>('08/29');
  const [cardCvv, setCardCvv] = useState<string>('786');
  const [cardHolder, setCardHolder] = useState<string>(customerName);

  // Netbanking state
  const [selectedBank, setSelectedBank] = useState<string>('HDFC');

  // Wallets state
  const [selectedWallet, setSelectedWallet] = useState<string>('Paytm');

  // Key configuration
  const [showKeyConfig, setShowKeyConfig] = useState<boolean>(false);
  const [razorpayKeyInput, setRazorpayKeyInput] = useState<string>(getRazorpayKeyId());
  const [keySavedNotice, setKeySavedNotice] = useState<boolean>(false);

  // Processing & Simulation State
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [showOtpModal, setShowOtpModal] = useState<boolean>(false);
  const [otpValue, setOtpValue] = useState<string>('482910');

  // QR Timer
  const [qrTimeLeft, setQrTimeLeft] = useState<number>(300);

  useEffect(() => {
    if (!isOpen) {
      setIsProcessing(false);
      setShowOtpModal(false);
      return;
    }
    setRazorpayKeyInput(getRazorpayKeyId());
    setQrTimeLeft(300);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'qr') return;
    const interval = setInterval(() => {
      setQrTimeLeft((prev) => (prev > 0 ? prev - 1 : 300));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const handleSaveKey = () => {
    saveRazorpayKeyId(razorpayKeyInput);
    setKeySavedNotice(true);
    setTimeout(() => {
      setKeySavedNotice(false);
      setShowKeyConfig(false);
    }, 1200);
  };

  const handleExecutePayment = async (methodType: PaymentMethodTab) => {
    if (methodType === 'upi' && selectedUpiApp === 'custom') {
      if (!customUpiId.trim() || !customUpiId.includes('@')) {
        setUpiIdError('Please enter a valid UPI ID (e.g. mobile@upi or name@okhdfcbank)');
        return;
      }
      setUpiIdError(null);
    }

    if (methodType === 'card') {
      setShowOtpModal(true);
      return;
    }

    processRazorpayTransaction(methodType);
  };

  const processRazorpayTransaction = async (methodType: PaymentMethodTab) => {
    setIsProcessing(true);
    setProcessingStep('Connecting to Razorpay Banking Gateway...');

    try {
      await new Promise((res) => setTimeout(res, 600));
      setProcessingStep('Authorizing 25% Advance Online Deposit...');

      await new Promise((res) => setTimeout(res, 700));
      setProcessingStep('Verifying 25% Payment Token with NPCI / Bank...');

      await new Promise((res) => setTimeout(res, 600));

      const paymentId = generateRazorpayPaymentId();
      const orderId = generateRazorpayOrderId();

      const response: RazorpayPaymentSuccessResponse = {
        razorpay_payment_id: paymentId,
        razorpay_order_id: orderId,
        razorpay_signature: `sig_${Math.random().toString(36).substring(2, 15)}`,
        method: methodType,
        upi_id: selectedUpiApp === 'custom' ? customUpiId : `${selectedUpiApp}@razorpay`,
        bank: selectedBank,
        wallet: selectedWallet,
      };

      setIsProcessing(false);
      setShowOtpModal(false);
      onPaymentSuccess(response);
    } catch (err: any) {
      setIsProcessing(false);
      setShowOtpModal(false);
      onPaymentFailure(err?.message || 'Razorpay payment was interrupted or declined.');
    }
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processRazorpayTransaction('card');
  };

  const formatQrTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#0c2340] text-white rounded-3xl shadow-2xl border border-white/10 flex flex-col overflow-hidden my-auto relative animate-in zoom-in-95 duration-200">
        {/* Razorpay Top Header */}
        <div className="bg-[#08182b] p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0c65e8] flex items-center justify-center font-black text-white text-base shadow-sm">
              ₹
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-bold tracking-tight text-white">Razorpay Secure</span>
                <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-1.5 py-0.2 rounded flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-[11px]">verified_user</span> 256-Bit
                </span>
              </div>
              <p className="text-[11px] text-white/60 truncate max-w-[200px]">{salon.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowKeyConfig(!showKeyConfig)}
              title="Razorpay API Key Settings"
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">settings</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        {/* Razorpay Key Config Dropdown if opened */}
        {showKeyConfig && (
          <div className="p-3 bg-[#05111f] border-b border-white/10 text-[12px] animate-in slide-in-from-top-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-white/90">Merchant Razorpay Key ID</span>
              <span className="text-[10px] text-white/50">Live / Test API</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={razorpayKeyInput}
                onChange={(e) => setRazorpayKeyInput(e.target.value)}
                placeholder="rzp_test_..."
                className="flex-1 bg-white/10 border border-white/20 rounded-lg px-2.5 py-1.5 text-white text-[12px] font-mono focus:outline-none focus:border-[#0c65e8]"
              />
              <button
                type="button"
                onClick={handleSaveKey}
                className="px-3 py-1.5 bg-[#0c65e8] hover:bg-[#0a52be] text-white font-bold rounded-lg text-[11px]"
              >
                {keySavedNotice ? 'Saved!' : 'Save'}
              </button>
            </div>
            <p className="text-[10px] text-white/50 mt-1">
              Currently using Razorpay merchant gateway for {salon.name}.
            </p>
          </div>
        )}

        {/* Amount & 25% Advance Breakdown Banner */}
        <div className="p-4 bg-gradient-to-br from-[#0c2e56] to-[#0c2340] border-b border-white/10">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] text-white/70 uppercase tracking-wider font-semibold block">
                Mandatory Advance to Confirm Slot
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-[28px] font-extrabold text-white tracking-tight">₹{advanceAmount}</span>
                <span className="text-[13px] text-emerald-400 font-bold bg-emerald-500/20 px-2 py-0.5 rounded-full">
                  25% Advance
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-white/60 block">Full Bill</span>
              <span className="text-[14px] font-semibold text-white/90">₹{totalAmount}</span>
              <span className="text-[10px] text-amber-300 block mt-0.5">
                ₹{remainingAmount} due at salon (75%)
              </span>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] text-white/70">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-emerald-400">lock</span>
              Slot locked only upon 25% payment
            </span>
            <span>{serviceCount} Service{serviceCount > 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Payment Methods Navigation Bar */}
        <div className="flex border-b border-white/10 bg-[#091d34] overflow-x-auto scrollbar-none text-[12px] font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('upi')}
            className={`flex-1 min-w-[70px] py-2.5 px-2 flex flex-col items-center gap-1 border-b-2 transition-all ${
              activeTab === 'upi'
                ? 'border-[#0c65e8] text-white bg-white/5 font-bold'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
            <span>UPI Apps</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('qr')}
            className={`flex-1 min-w-[70px] py-2.5 px-2 flex flex-col items-center gap-1 border-b-2 transition-all ${
              activeTab === 'qr'
                ? 'border-[#0c65e8] text-white bg-white/5 font-bold'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
            <span>Scan QR</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('card')}
            className={`flex-1 min-w-[70px] py-2.5 px-2 flex flex-col items-center gap-1 border-b-2 transition-all ${
              activeTab === 'card'
                ? 'border-[#0c65e8] text-white bg-white/5 font-bold'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">credit_card</span>
            <span>Cards</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('netbanking')}
            className={`flex-1 min-w-[70px] py-2.5 px-2 flex flex-col items-center gap-1 border-b-2 transition-all ${
              activeTab === 'netbanking'
                ? 'border-[#0c65e8] text-white bg-white/5 font-bold'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">account_balance</span>
            <span>NetBanking</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('wallet')}
            className={`flex-1 min-w-[70px] py-2.5 px-2 flex flex-col items-center gap-1 border-b-2 transition-all ${
              activeTab === 'wallet'
                ? 'border-[#0c65e8] text-white bg-white/5 font-bold'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">wallet</span>
            <span>Wallets</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-4 flex-1 overflow-y-auto max-h-[340px]">
          {/* TAB 1: UPI APPS */}
          {activeTab === 'upi' && (
            <div className="space-y-3">
              <span className="text-[11px] font-semibold text-white/70 uppercase tracking-wider block">
                Select UPI Payment Method
              </span>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'gpay', name: 'Google Pay', icon: 'payments', tag: 'Fastest' },
                  { id: 'phonepe', name: 'PhonePe', icon: 'mobile_friendly', tag: 'Popular' },
                  { id: 'paytm', name: 'Paytm UPI', icon: 'account_balance_wallet' },
                  { id: 'cred', name: 'CRED UPI', icon: 'verified' },
                ].map((upi) => (
                  <button
                    key={upi.id}
                    type="button"
                    onClick={() => {
                      setSelectedUpiApp(upi.id);
                      setUpiIdError(null);
                    }}
                    className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                      selectedUpiApp === upi.id
                        ? 'bg-[#0c65e8]/20 border-[#0c65e8] ring-1 ring-[#0c65e8]'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-white">
                        <span className="material-symbols-outlined text-[16px]">{upi.icon}</span>
                      </div>
                      <div>
                        <span className="text-[13px] font-bold block leading-tight">{upi.name}</span>
                        {upi.tag && <span className="text-[9px] text-emerald-400 font-bold">{upi.tag}</span>}
                      </div>
                    </div>
                    {selectedUpiApp === upi.id && (
                      <span className="material-symbols-outlined text-[#0c65e8] text-[18px]">check_circle</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Custom UPI ID Option */}
              <div
                onClick={() => setSelectedUpiApp('custom')}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  selectedUpiApp === 'custom'
                    ? 'bg-[#0c65e8]/20 border-[#0c65e8] ring-1 ring-[#0c65e8]'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-white/80">alternate_email</span>
                    <span className="text-[12px] font-bold">Enter other UPI ID (VPA)</span>
                  </div>
                  {selectedUpiApp === 'custom' && (
                    <span className="material-symbols-outlined text-[#0c65e8] text-[18px]">check_circle</span>
                  )}
                </div>

                {selectedUpiApp === 'custom' && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={customUpiId}
                        onChange={(e) => {
                          setCustomUpiId(e.target.value);
                          setUpiIdError(null);
                        }}
                        placeholder="e.g. mobile@okhdfcbank or user@paytm"
                        className="flex-1 bg-black/40 border border-white/20 rounded-lg px-3 py-2 text-white text-[12px] focus:outline-none focus:border-[#0c65e8]"
                      />
                    </div>
                    {upiIdError && <p className="text-[11px] text-rose-400 font-semibold">{upiIdError}</p>}
                    <div className="flex flex-wrap gap-1 text-[10px] text-white/50 pt-1">
                      <span>Popular handles:</span>
                      {['@okhdfcbank', '@oksbi', '@ybl', '@paytm'].map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCustomUpiId((prev) => (prev.includes('@') ? prev.split('@')[0] + h : prev + h));
                          }}
                          className="bg-white/10 hover:bg-white/20 px-1.5 py-0.2 rounded text-white/80"
                        >
                          {h}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: QR CODE SCAN */}
          {activeTab === 'qr' && (
            <div className="flex flex-col items-center text-center space-y-3 py-1">
              <div className="bg-white p-3 rounded-2xl shadow-lg border-2 border-emerald-400 flex flex-col items-center">
                {/* Visual authentic QR Pattern */}
                <div className="w-40 h-40 bg-[#0c2340] rounded-xl p-2 flex flex-col items-center justify-center relative overflow-hidden">
                  <div className="grid grid-cols-6 gap-1 w-full h-full opacity-90 p-1">
                    {Array.from({ length: 36 }).map((_, i) => (
                      <div
                        key={i}
                        className={`rounded-xs ${
                          i % 2 === 0 || i % 5 === 0 || i === 0 || i === 5 || i === 30 || i === 35
                            ? 'bg-white'
                            : 'bg-emerald-400/80'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-white p-1 rounded-md shadow-md flex items-center justify-center">
                      <span className="text-[#0c65e8] font-black text-[12px]">₹ RZP</span>
                    </div>
                  </div>
                </div>
                <span className="text-black font-extrabold text-[14px] mt-2">Scan & Pay ₹{advanceAmount}</span>
                <span className="text-slate-500 text-[10px] font-semibold">Works with GPay, PhonePe, Paytm & BHIM</span>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-amber-300 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                <span className="material-symbols-outlined text-[14px]">timer</span>
                <span>QR expires in <strong>{formatQrTime(qrTimeLeft)}</strong></span>
              </div>

              <button
                type="button"
                onClick={() => processRazorpayTransaction('qr')}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-[12px] flex items-center justify-center gap-1.5 shadow-sm"
              >
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                <span>Simulate QR Scan Payment (₹{advanceAmount})</span>
              </button>
            </div>
          )}

          {/* TAB 3: CARDS */}
          {activeTab === 'card' && (
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-white/70 block mb-1">Card Number</label>
                <div className="relative">
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-white text-[13px] font-mono focus:outline-none focus:border-[#0c65e8]"
                  />
                  <div className="absolute right-3 top-2.5 flex items-center gap-1 text-[11px] font-bold text-white/60">
                    <span>VISA / RuPay</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-white/70 block mb-1">Expiry (MM/YY)</label>
                  <input
                    type="text"
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(e.target.value)}
                    className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-white text-[13px] font-mono focus:outline-none focus:border-[#0c65e8]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-white/70 block mb-1">CVV / CVC</label>
                  <input
                    type="password"
                    maxLength={4}
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value)}
                    className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-white text-[13px] font-mono focus:outline-none focus:border-[#0c65e8]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-white/70 block mb-1">Cardholder Name</label>
                <input
                  type="text"
                  value={cardHolder}
                  onChange={(e) => setCardHolder(e.target.value)}
                  className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-white text-[13px] focus:outline-none focus:border-[#0c65e8]"
                />
              </div>

              <p className="text-[10px] text-white/50 flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px] text-emerald-400">shield</span>
                Secured via Razorpay PCI-DSS compliant vault. OTP will be sent to registered mobile.
              </p>
            </div>
          )}

          {/* TAB 4: NETBANKING */}
          {activeTab === 'netbanking' && (
            <div className="space-y-3">
              <span className="text-[11px] font-semibold text-white/70 uppercase tracking-wider block">
                Popular Banks
              </span>
              <div className="grid grid-cols-2 gap-2">
                {['HDFC', 'SBI', 'ICICI', 'Axis', 'Kotak', 'PNB'].map((bank) => (
                  <button
                    key={bank}
                    type="button"
                    onClick={() => setSelectedBank(bank)}
                    className={`p-2.5 rounded-xl border text-left flex items-center justify-between text-[12px] font-semibold transition-all ${
                      selectedBank === bank
                        ? 'bg-[#0c65e8]/20 border-[#0c65e8] ring-1 ring-[#0c65e8]'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <span>{bank} Bank</span>
                    {selectedBank === bank && (
                      <span className="material-symbols-outlined text-[#0c65e8] text-[16px]">check_circle</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: WALLETS */}
          {activeTab === 'wallet' && (
            <div className="space-y-3">
              <span className="text-[11px] font-semibold text-white/70 uppercase tracking-wider block">
                Supported Wallets
              </span>
              <div className="grid grid-cols-2 gap-2">
                {['Paytm Wallet', 'Amazon Pay', 'PhonePe Wallet', 'MobiKwik'].map((wallet) => (
                  <button
                    key={wallet}
                    type="button"
                    onClick={() => setSelectedWallet(wallet)}
                    className={`p-2.5 rounded-xl border text-left flex items-center justify-between text-[12px] font-semibold transition-all ${
                      selectedWallet === wallet
                        ? 'bg-[#0c65e8]/20 border-[#0c65e8] ring-1 ring-[#0c65e8]'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <span>{wallet}</span>
                    {selectedWallet === wallet && (
                      <span className="material-symbols-outlined text-[#0c65e8] text-[16px]">check_circle</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* OTP Simulation Modal for 3D Secure Card verification */}
        {showOtpModal && (
          <div className="absolute inset-0 z-40 bg-[#08182b]/95 backdrop-blur-md p-5 flex flex-col items-center justify-center text-center animate-in fade-in">
            <div className="w-12 h-12 rounded-full bg-[#0c65e8]/20 text-[#0c65e8] flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-[26px]">sms</span>
            </div>
            <h3 className="text-[16px] font-bold text-white">Bank 3D Secure OTP</h3>
            <p className="text-[12px] text-white/70 mt-1 max-w-xs">
              Enter the 6-digit OTP sent to customer mobile ending in <strong>••••3210</strong> to authorize ₹{advanceAmount}.
            </p>

            <form onSubmit={handleOtpSubmit} className="w-full max-w-xs mt-4 space-y-3">
              <input
                type="text"
                maxLength={6}
                value={otpValue}
                onChange={(e) => setOtpValue(e.target.value)}
                className="w-full text-center tracking-[8px] font-mono text-[20px] bg-white/10 border border-white/20 rounded-xl py-2 text-white focus:outline-none focus:border-[#0c65e8]"
              />
              <button
                type="submit"
                className="w-full py-2.5 bg-[#0c65e8] hover:bg-[#0a52be] text-white font-bold rounded-xl text-[13px] shadow-md flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px]">verified</span>
                <span>Submit OTP & Pay ₹{advanceAmount}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowOtpModal(false)}
                className="text-[11px] text-white/50 hover:text-white"
              >
                Cancel & Return
              </button>
            </form>
          </div>
        )}

        {/* Live Processing Overlay */}
        {isProcessing && (
          <div className="absolute inset-0 z-50 bg-[#08182b]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
            <div className="w-14 h-14 rounded-full border-4 border-[#0c65e8]/30 border-t-[#0c65e8] animate-spin mb-4" />
            <h3 className="text-[17px] font-bold text-white">Processing Razorpay Payment</h3>
            <p className="text-[12px] text-white/70 mt-1">{processingStep}</p>
            <div className="mt-4 px-3 py-1.5 rounded-full bg-white/5 text-[11px] text-emerald-400 flex items-center gap-1.5 font-semibold">
              <span className="material-symbols-outlined text-[14px]">lock</span>
              <span>256-Bit Encrypted Razorpay Transaction</span>
            </div>
          </div>
        )}

        {/* Footer Action Bar */}
        <div className="p-4 bg-[#08182b] border-t border-white/10 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-[13px] font-semibold transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            id="razorpay-pay-advance-btn"
            onClick={() => handleExecutePayment(activeTab)}
            className="flex-1 py-2.5 px-4 rounded-xl bg-[#0c65e8] hover:bg-[#0a52be] active:scale-[0.99] text-white font-bold text-[14px] shadow-lg shadow-[#0c65e8]/30 flex items-center justify-center gap-2 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">lock</span>
            <span>Pay 25% Advance (₹{advanceAmount})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
