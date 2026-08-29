import React, { useState, useMemo } from 'react';
import { Appointment, UserProfile } from '../types';
import {
  paymentService,
  PaymentTransaction,
  processAdvancePayment,
} from '../lib/PaymentService';
import { PaymentFailureDialog } from './PaymentFailureDialog';

interface PaymentHistorySectionProps {
  user: UserProfile;
  appointments?: Appointment[];
  onNavigateToBooking?: () => void;
}

export const PaymentHistorySection: React.FC<PaymentHistorySectionProps> = ({
  user,
  appointments = [],
  onNavigateToBooking,
}) => {
  // Local transaction state merged from PaymentService & Appointments
  const [filterTab, setFilterTab] = useState<'all' | 'recent' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentTransaction | null>(null);

  // Simulation test state for processAdvancePayment
  const [isSimulatingPayment, setIsSimulatingPayment] = useState(false);
  const [simulatedPaymentSuccess, setSimulatedPaymentSuccess] = useState<string | null>(null);
  const [simulationCountdown, setSimulationCountdown] = useState<number>(3);

  // Test state for Payment Failure Alert Dialog
  const [showTestFailureDialog, setShowTestFailureDialog] = useState(false);
  const [testFailureReason, setTestFailureReason] = useState<string | null>(
    'Bank gateway timeout: The issuing bank took too long to authorize the ₹350 advance deposit.'
  );
  const [isRetryingTest, setIsRetryingTest] = useState(false);

  // Retrieve complete transaction history
  const [transactionsVersion, setTransactionsVersion] = useState(0);

  const transactions = useMemo(() => {
    // Calling getPaymentHistory reads both stored transactions and appointments
    return paymentService.getPaymentHistory(appointments);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointments, transactionsVersion]);

  // Aggregate Metrics
  const totalAdvancePaid = useMemo(() => {
    return transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  }, [transactions]);

  const totalBillValue = useMemo(() => {
    return transactions.reduce((sum, t) => sum + (t.totalBill || 0), 0);
  }, [transactions]);

  const totalRemainingDue = useMemo(() => {
    return transactions.reduce((sum, t) => sum + (t.remainingDue || 0), 0);
  }, [transactions]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      // Tab filter
      if (filterTab === 'recent') {
        const itemDate = new Date(t.createdAt).getTime();
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        if (itemDate < thirtyDaysAgo) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesBookingId = t.bookingId?.toLowerCase().includes(query);
        const matchesAppointmentId = t.appointmentId?.toLowerCase().includes(query);
        const matchesPaymentId = t.id?.toLowerCase().includes(query);
        const matchesSalon = t.salonName?.toLowerCase().includes(query);
        const matchesService = t.serviceNames?.some((s) => s.toLowerCase().includes(query));
        return (
          matchesBookingId ||
          matchesAppointmentId ||
          matchesPaymentId ||
          matchesSalon ||
          matchesService
        );
      }

      return true;
    });
  }, [transactions, filterTab, searchQuery]);

  // 1-Click Copy helper
  const handleCopy = (text: string, label: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedId(label);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      // Fallback
    }
  };

  // Trigger simulated 3-second advance payment test using processAdvancePayment
  const handleRunSimulator = async () => {
    if (isSimulatingPayment) return;
    setIsSimulatingPayment(true);
    setSimulatedPaymentSuccess(null);
    setSimulationCountdown(3);

    const timer = setInterval(() => {
      setSimulationCountdown((prev) => (prev > 1 ? prev - 1 : 1));
    }, 1000);

    try {
      const testAmount = 350;
      // Uses the exact 3-second simulation function
      const paymentId = await processAdvancePayment(testAmount);
      clearInterval(timer);

      const simBookingRef = `NX-${Math.floor(10000 + Math.random() * 90000)}`;
      const simAppointmentId = `apt-sim-${Date.now()}`;
      const nowIso = new Date().toISOString();

      const newTx: PaymentTransaction = {
        id: paymentId,
        orderId: `order_sim_${Date.now()}`,
        bookingId: simBookingRef,
        appointmentId: simAppointmentId,
        salonId: 'salon-1',
        salonName: 'Scissors & Shears Salon',
        salonImage:
          'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=600&q=80',
        salonAddress: 'Plot 42, Madhyam Marg, Mansarovar, Jaipur',
        salonPhone: '+91 141 278 9901',
        serviceNames: ['Signature Hair Cut & Wash', 'Express Hair Spa'],
        stylistName: 'Aarav Sharma',
        amount: testAmount,
        totalBill: 1400,
        remainingDue: 1050,
        paymentMethod: 'upi',
        status: 'successful',
        date: new Date().toLocaleDateString('en-US', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        appointmentDate: nowIso.split('T')[0],
        appointmentTime: '4:00 PM',
        createdAt: nowIso,
        notes: 'Simulated live advance payment via PaymentService',
      };

      paymentService.recordTransaction(newTx);
      setTransactionsVersion((v) => v + 1);
      setIsSimulatingPayment(false);
      setSimulatedPaymentSuccess(
        `Advance of ₹${testAmount} paid successfully! Payment ID: ${paymentId} (Booking ID: ${simBookingRef})`
      );

      setTimeout(() => {
        setSimulatedPaymentSuccess(null);
      }, 5000);
    } catch (err: any) {
      clearInterval(timer);
      setIsSimulatingPayment(false);
      alert(err?.message || 'Payment simulation failed');
    }
  };

  // WhatsApp share receipt
  const handleShareWhatsApp = (tx: PaymentTransaction) => {
    const text = encodeURIComponent(
      `🧾 *Nexora Salon Advance Payment Receipt*\n\n` +
        `• *Booking ID:* ${tx.bookingId}\n` +
        `• *Payment ID:* ${tx.id}\n` +
        `• *Salon:* ${tx.salonName}\n` +
        `• *Services:* ${tx.serviceNames.join(', ')}\n` +
        `• *Date & Time:* ${tx.date}\n` +
        `• *Advance Paid (25%):* ₹${tx.amount} ✅ (Razorpay)\n` +
        `• *Balance at Salon (75%):* ₹${tx.remainingDue}\n` +
        `• *Total Bill:* ₹${tx.totalBill}\n\n` +
        `Verified by Salon Owner. Present this Booking ID at salon arrival.`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  return (
    <div
      id="section-payment-history"
      className="bg-surface-container-low border border-outline-variant/50 rounded-2xl p-4 sm:p-5 shadow-xs mb-4 scroll-mt-20"
    >
      {/* ========================================================================= */}
      {/* SECTION HEADER                                                            */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 border-b border-outline-variant/30 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shadow-xs shrink-0">
            <span className="material-symbols-outlined text-[22px]">receipt_long</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-card-title text-[16px] font-bold text-on-surface">
                4. Payment & Advance Transaction History
              </h3>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">verified_user</span>
                PaymentService Active
              </span>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-0.5">
              Verified Razorpay 25% booking deposits, transaction references, and associated booking IDs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto">
          {/* Test Failure Dialog Trigger */}
          <button
            type="button"
            id="test-payment-failure-dialog-btn"
            onClick={() => {
              setTestFailureReason('Bank authorization timeout: UPI transaction was not approved within 3 minutes.');
              setShowTestFailureDialog(true);
            }}
            className="flex-1 sm:flex-initial px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-700 dark:text-red-300 border border-red-500/30 rounded-xl text-[12px] font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            title="Preview the dedicated Payment Failure & Retry Alert Dialog"
          >
            <span className="material-symbols-outlined text-[15px]">error_outline</span>
            <span>Test Failure Alert</span>
          </button>

          {/* Live Simulator Test Button */}
          <button
            type="button"
            id="simulate-advance-payment-btn"
            onClick={handleRunSimulator}
            disabled={isSimulatingPayment}
            className="flex-1 sm:flex-initial px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl text-[12px] font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
            title="Simulates 3-second live Razorpay payment processing"
          >
            {isSimulatingPayment ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                <span>Simulating ({simulationCountdown}s)...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[15px]">credit_score</span>
                <span>Test Payment (3s Simulation)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Simulation Feedback Alert */}
      {simulatedPaymentSuccess && (
        <div className="p-3 mb-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-900 dark:text-emerald-100 flex items-center justify-between gap-2 text-[12px] animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-emerald-600">
              check_circle
            </span>
            <span className="font-semibold">{simulatedPaymentSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setSimulatedPaymentSuccess(null)}
            className="text-emerald-700 hover:text-emerald-900 text-[14px] cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* FINANCIAL METRICS SUMMARY STRIP                                            */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {/* Metric 1: Total Advance Paid */}
        <div className="p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/30 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-on-surface-variant font-medium block">
              Total 25% Advance Paid
            </span>
            <span className="text-[18px] font-extrabold text-emerald-700 dark:text-emerald-400">
              ₹{totalAdvancePaid.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
          </div>
        </div>

        {/* Metric 2: Successful Transactions */}
        <div className="p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/30 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-on-surface-variant font-medium block">
              Successful Transactions
            </span>
            <span className="text-[18px] font-extrabold text-on-surface">
              {transactions.length}{' '}
              <span className="text-[11px] font-normal text-on-surface-variant">Payments</span>
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
          </div>
        </div>

        {/* Metric 3: Total Value Booked */}
        <div className="p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/30 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-on-surface-variant font-medium block">
              Total Salon Bill Value
            </span>
            <span className="text-[18px] font-extrabold text-on-surface">
              ₹{totalBillValue.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px]">storefront</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FILTER TABS & SEARCH BAR                                                  */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 mb-3.5">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 bg-surface-container-lowest p-1 rounded-xl border border-outline-variant/30">
          <button
            type="button"
            id="filter-all-payments-btn"
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
              filterTab === 'all'
                ? 'bg-primary text-white shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            All ({transactions.length})
          </button>
          <button
            type="button"
            id="filter-recent-payments-btn"
            onClick={() => setFilterTab('recent')}
            className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
              filterTab === 'recent'
                ? 'bg-primary text-white shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Last 30 Days
          </button>
        </div>

        {/* Search by Booking ID / Salon / Payment ID */}
        <div className="relative flex-1 max-w-xs">
          <input
            type="text"
            id="search-payments-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Booking ID, Salon or Txn ID..."
            className="w-full h-8 px-3 pl-8 bg-surface-container-lowest text-on-surface rounded-xl text-[11px] border border-outline-variant/40 focus:border-primary focus:ring-1 focus:ring-primary transition-all"
          />
          <span className="material-symbols-outlined text-[15px] text-on-surface-variant absolute left-2.5 top-2 pointer-events-none">
            search
          </span>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1.5 text-on-surface-variant hover:text-on-surface text-[12px] cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TRANSACTION CARDS LIST                                                    */}
      {/* ========================================================================= */}
      {filteredTransactions.length === 0 ? (
        <div className="p-8 text-center bg-surface-container-lowest rounded-2xl border border-outline-variant/30 flex flex-col items-center justify-center gap-2">
          <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
            <span className="material-symbols-outlined text-[24px]">receipt</span>
          </div>
          <h4 className="font-bold text-[14px] text-on-surface">No Payment History Found</h4>
          <p className="text-[12px] text-on-surface-variant max-w-sm">
            {searchQuery
              ? `No transactions matching "${searchQuery}". Try clearing search.`
              : 'Advance payments made via Razorpay during salon bookings will appear here automatically.'}
          </p>
          {onNavigateToBooking && (
            <button
              type="button"
              onClick={onNavigateToBooking}
              className="mt-2 px-4 py-2 bg-primary text-white text-[12px] font-bold rounded-xl hover:bg-[#b00055] transition-colors cursor-pointer shadow-xs"
            >
              Explore Salons & Book Now
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredTransactions.map((tx) => (
            <div
              key={tx.id}
              id={`tx-card-${tx.bookingId}`}
              className="p-3.5 sm:p-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 hover:border-outline-variant/60 transition-all shadow-xs flex flex-col gap-3"
            >
              {/* Top Row: Salon Info, Date & Amount */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-outline-variant/20">
                <div className="flex items-center gap-3">
                  {tx.salonImage ? (
                    <img
                      src={tx.salonImage}
                      alt={tx.salonName}
                      className="w-11 h-11 rounded-xl object-cover ring-1 ring-black/10 shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary font-bold flex items-center justify-center text-[14px] shrink-0">
                      {tx.salonName.charAt(0)}
                    </div>
                  )}

                  <div>
                    <h4 className="font-bold text-[14px] text-on-surface leading-tight">
                      {tx.salonName}
                    </h4>
                    <div className="flex items-center gap-2 text-[11px] text-on-surface-variant mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px] text-primary">
                          event
                        </span>
                        <span>{tx.date}</span>
                      </span>
                      <span>·</span>
                      <span className="uppercase text-[10px] font-semibold bg-surface-container px-1.5 py-0.2 rounded">
                        {tx.paymentMethod || 'UPI / Razorpay'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Amount Paid Pill */}
                <div className="flex items-center sm:flex-col sm:items-end justify-between sm:justify-center">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-extrabold px-2 py-0.5 rounded-md uppercase">
                      25% Advance
                    </span>
                    <span className="text-[16px] font-black text-emerald-700 dark:text-emerald-400">
                      ₹{tx.amount}
                    </span>
                  </div>
                  <span className="text-[10px] text-on-surface-variant mt-0.5">
                    ₹{tx.remainingDue} due at salon counter
                  </span>
                </div>
              </div>

              {/* Middle Row: Associated Booking ID & Transaction Reference */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px]">
                {/* Associated Booking ID */}
                <div className="p-2.5 rounded-xl bg-surface-container/40 border border-outline-variant/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-primary">
                      confirmation_number
                    </span>
                    <div>
                      <span className="text-[10px] text-on-surface-variant font-medium block">
                        Associated Booking ID
                      </span>
                      <span className="font-mono font-bold text-on-surface text-[12px]">
                        {tx.bookingId}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopy(tx.bookingId, `booking-${tx.bookingId}`)}
                    className="p-1 px-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    title="Copy Booking ID"
                  >
                    <span className="material-symbols-outlined text-[13px]">
                      {copiedId === `booking-${tx.bookingId}` ? 'check' : 'content_copy'}
                    </span>
                    <span>{copiedId === `booking-${tx.bookingId}` ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                {/* Razorpay Payment Reference ID */}
                <div className="p-2.5 rounded-xl bg-surface-container/40 border border-outline-variant/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-emerald-600">
                      verified
                    </span>
                    <div className="min-w-0">
                      <span className="text-[10px] text-on-surface-variant font-medium block">
                        Razorpay Payment ID
                      </span>
                      <span className="font-mono font-bold text-on-surface text-[11px] truncate block max-w-[140px] sm:max-w-[170px]">
                        {tx.id}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopy(tx.id, `payment-${tx.id}`)}
                    className="p-1 px-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    title="Copy Payment ID"
                  >
                    <span className="material-symbols-outlined text-[13px]">
                      {copiedId === `payment-${tx.id}` ? 'check' : 'content_copy'}
                    </span>
                    <span>{copiedId === `payment-${tx.id}` ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Services Booked Summary */}
              {tx.serviceNames && tx.serviceNames.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                  <span className="text-on-surface-variant font-medium">Services:</span>
                  {tx.serviceNames.map((svc, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md bg-surface-container text-on-surface font-semibold"
                    >
                      {svc}
                    </span>
                  ))}
                  {tx.stylistName && (
                    <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-bold">
                      ✂️ {tx.stylistName}
                    </span>
                  )}
                </div>
              )}

              {/* Bottom Actions Row */}
              <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                  <span>Payment Captured & Confirmed by Salon</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleShareWhatsApp(tx)}
                    className="px-3 py-1.5 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] dark:text-[#25D366] text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">share</span>
                    <span>WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedReceipt(tx)}
                    className="px-3.5 py-1.5 rounded-xl bg-primary text-white text-[11px] font-bold hover:bg-[#b00055] transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                  >
                    <span className="material-symbols-outlined text-[14px]">receipt</span>
                    <span>View Digital Receipt</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* DIGITAL RECEIPT MODAL                                                     */}
      {/* ========================================================================= */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-surface rounded-3xl p-5 sm:p-6 shadow-2xl border border-outline-variant/40 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            {/* Receipt Header */}
            <div className="flex items-start justify-between border-b border-outline-variant/30 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-[18px] text-primary">Nexora</span>
                  <span className="text-[11px] bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-extrabold px-2 py-0.5 rounded-full uppercase">
                    Paid Deposit
                  </span>
                </div>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  Official Advance Payment Receipt
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Receipt Body */}
            <div className="flex flex-col gap-3.5 text-[13px]">
              {/* Booking & Txn Identifiers Card */}
              <div className="p-3.5 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 flex flex-col gap-2">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-on-surface-variant">Associated Booking ID:</span>
                  <strong className="font-mono text-primary font-bold text-[14px]">
                    {selectedReceipt.bookingId}
                  </strong>
                </div>

                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-on-surface-variant">Razorpay Payment ID:</span>
                  <span className="font-mono text-[11px] font-bold text-on-surface">
                    {selectedReceipt.id}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-on-surface-variant">Date & Time:</span>
                  <span className="font-medium text-on-surface">{selectedReceipt.date}</span>
                </div>
              </div>

              {/* Salon Details */}
              <div className="p-3 bg-surface-container-lowest rounded-2xl border border-outline-variant/30">
                <h5 className="font-bold text-[13px] text-on-surface">
                  {selectedReceipt.salonName}
                </h5>
                {selectedReceipt.salonAddress && (
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    {selectedReceipt.salonAddress}
                  </p>
                )}
                {selectedReceipt.salonPhone && (
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    Tel: {selectedReceipt.salonPhone}
                  </p>
                )}
              </div>

              {/* Services Breakdown */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-on-surface uppercase tracking-wider">
                  Booked Services
                </span>
                <div className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/30 flex flex-col gap-1.5">
                  {selectedReceipt.serviceNames?.map((svc, i) => (
                    <div key={i} className="flex items-center justify-between text-[12px]">
                      <span className="text-on-surface font-medium">• {svc}</span>
                      <span className="text-on-surface-variant">Included</span>
                    </div>
                  ))}
                  {selectedReceipt.stylistName && (
                    <div className="pt-1.5 mt-1 border-t border-outline-variant/20 flex items-center justify-between text-[11px]">
                      <span className="text-on-surface-variant">Assigned Stylist:</span>
                      <span className="font-bold text-primary">{selectedReceipt.stylistName}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Math Breakdown */}
              <div className="p-3.5 bg-emerald-500/10 dark:bg-emerald-950/30 rounded-2xl border border-emerald-500/30 flex flex-col gap-2">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-on-surface-variant">Total Salon Estimate:</span>
                  <span className="font-bold text-on-surface">₹{selectedReceipt.totalBill}</span>
                </div>
                <div className="flex items-center justify-between text-[13px] font-extrabold text-emerald-800 dark:text-emerald-300">
                  <span>25% Advance Paid Online:</span>
                  <span>₹{selectedReceipt.amount}</span>
                </div>
                <div className="pt-1.5 border-t border-emerald-500/20 flex items-center justify-between text-[12px] font-semibold text-on-surface">
                  <span>Remaining Balance at Salon:</span>
                  <span>₹{selectedReceipt.remainingDue}</span>
                </div>
              </div>

              <p className="text-[10px] text-center text-on-surface-variant">
                🔒 Protected by Nexora Buyer Guarantee. Present Booking ID{' '}
                <strong>{selectedReceipt.bookingId}</strong> upon arrival.
              </p>
            </div>

            {/* Receipt Modal Footer Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-outline-variant/30">
              <button
                type="button"
                onClick={() => handleShareWhatsApp(selectedReceipt)}
                className="flex-1 py-2.5 rounded-xl bg-[#25D366] text-white text-[12px] font-bold hover:bg-[#20ba5c] transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-[16px]">share</span>
                <span>Send to WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-2.5 rounded-xl bg-surface-container text-on-surface text-[12px] font-bold hover:bg-surface-container-high transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">print</span>
                <span>Print</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test / Interactive Payment Failure Alert Dialog */}
      <PaymentFailureDialog
        isOpen={showTestFailureDialog}
        onClose={() => setShowTestFailureDialog(false)}
        onRetryPayment={async () => {
          setIsRetryingTest(true);
          setShowTestFailureDialog(false);
          setIsRetryingTest(false);
          await handleRunSimulator();
        }}
        errorMessage={testFailureReason}
        salon={{
          id: 'salon-test',
          name: 'Scissors & Shears Premium Salon',
          tagline: 'Expert Hair & Spa Studio',
          categories: ['Hair Care', 'Spa Treatments'],
          rating: 4.9,
          reviewCount: 420,
          distance: '1.2 km',
          location: {
            area: 'Mansarovar',
            city: 'Jaipur',
            address: 'Plot 42, Madhyam Marg, Mansarovar, Jaipur',
            latitude: 26.8523,
            longitude: 75.7654,
          },
          image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=600&q=80',
          gallery: [],
          isOpen: true,
          openingHours: '09:00 AM - 09:00 PM',
          priceRange: '₹₹',
          gender: 'unisex',
          amenities: ['AC', 'WiFi', 'Parking'],
          phone: '+91 141 278 9901',
          services: [],
          stylists: [],
          reviews: [],
        }}
        advanceAmount={350}
        totalAmount={1400}
        services={[
          { id: 's1', name: 'Signature Hair Cut & Styling', price: 600, duration: 45, category: 'hair', description: 'Expert hair cut' },
          { id: 's2', name: 'Express Keratin Glow Hair Spa', price: 800, duration: 60, category: 'hair', description: 'Nourishing spa' },
        ]}
        stylist={{
          id: 'st-1',
          name: 'Aarav Sharma',
          role: 'Master Stylist',
          experience: '8 Years',
          rating: 4.9,
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
          specialty: ['Haircuts', 'Styling'],
        }}
        date="Tomorrow, 2:30 PM"
        time="2:30 PM"
        isRetrying={isRetryingTest}
      />
    </div>
  );
};
