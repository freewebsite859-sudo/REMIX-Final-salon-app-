import {
  getRazorpayKeyId,
  loadRazorpayScript,
  checkoutWithRazorpay,
  RazorpayPaymentSuccessResponse,
} from './razorpay';
import { Salon, SalonService, Stylist, Appointment } from '../types';

export interface AdvanceCalculation {
  totalAmount: number;
  advancePercent: number;
  advanceAmount: number;
  remainingAmount: number;
}

export interface PaymentCustomerDetails {
  name?: string;
  email?: string;
  phone?: string;
}

export interface InitiatePaymentParams {
  salon: Salon;
  services: SalonService[];
  stylist?: Stylist | null;
  totalAmount: number;
  advancePercent?: number;
  customer?: PaymentCustomerDetails;
  notes?: Record<string, string>;
  onSuccess: (response: RazorpayPaymentSuccessResponse) => void;
  onFailure: (error: string) => void;
  onDismiss?: () => void;
}

export interface PaymentVerificationResult {
  verified: boolean;
  paymentId: string;
  orderId?: string;
  advancePaid: number;
  remainingDue: number;
  timestamp: string;
  errorMessage?: string;
}

export interface PaymentTransaction {
  id: string; // Razorpay Payment ID (e.g. pay_rzp_984129)
  orderId?: string;
  bookingId: string; // Booking Reference ID (e.g. NX-78291 or apt-101)
  appointmentId: string; // Internal appointment ID
  salonId: string;
  salonName: string;
  salonImage?: string;
  salonAddress?: string;
  salonPhone?: string;
  serviceNames: string[];
  stylistName?: string;
  amount: number; // Advance paid in INR (25%)
  totalBill: number; // Full invoice amount in INR
  remainingDue: number; // 75% due at salon counter
  paymentMethod: string; // 'upi' | 'card' | 'netbanking' | 'wallet'
  status: 'successful' | 'captured' | 'refunded';
  date: string; // Human-formatted date
  appointmentDate?: string;
  appointmentTime?: string;
  createdAt: string; // ISO String
  notes?: string;
}

const STORAGE_KEY_PAYMENT_HISTORY = 'nexora-payment-history';

/**
 * Client-side simulated payments are forbidden. A booking is created only
 * after POST /api/payments/orders + signature verification.
 */
export const processAdvancePayment = async (_amount: number): Promise<string> => {
  throw new Error(
    'Client-side payment shortcuts are disabled. Pay the 25% deposit through the server-side Razorpay order.'
  );
};

export class PaymentService {
  private static instance: PaymentService;

  private constructor() {}

  public static getInstance(): PaymentService {
    if (!PaymentService.instance) {
      PaymentService.instance = new PaymentService();
    }
    return PaymentService.instance;
  }

  /**
   * Process advance payment with a 3-second simulation delay
   */
  public async processAdvancePayment(amount: number): Promise<string> {
    return processAdvancePayment(amount);
  }

  /**
   * Calculate 25% mandatory advance and 75% remaining counter balance
   */
  public static calculateAdvance(totalAmount: number, advancePercent = 25): AdvanceCalculation {
    const validTotal = Math.max(0, Math.round(totalAmount));
    const advanceAmount = Math.round((validTotal * advancePercent) / 100);
    const remainingAmount = Math.max(0, validTotal - advanceAmount);

    return {
      totalAmount: validTotal,
      advancePercent,
      advanceAmount,
      remainingAmount,
    };
  }

  /**
   * Get active Razorpay Key ID
   */
  public getKeyId(): string {
    return getRazorpayKeyId();
  }

  /**
   * Preload official Razorpay SDK script
   */
  public async preloadSDK(): Promise<boolean> {
    return await loadRazorpayScript();
  }

  /**
   * Launches standard Razorpay Checkout popup if SDK is loaded in window
   */
  public async launchRazorpayStandardCheckout(params: {
    salon: Salon;
    advanceAmount: number;
    totalAmount: number;
    customer?: PaymentCustomerDetails;
    description?: string;
    onSuccess: (response: RazorpayPaymentSuccessResponse) => void;
    onFailure: (error: string) => void;
    onDismiss?: () => void;
  }): Promise<boolean> {
    const isLoaded = await loadRazorpayScript();
    const key = this.getKeyId();

    if (!isLoaded || typeof window === 'undefined' || !window.Razorpay) {
      return false; // Fallback to integrated in-app Razorpay modal
    }

    if (!key) {
      params.onFailure(
        'Secure deposit cannot start: no Razorpay key was issued by the server. No merchant QR or in-app shortcut is available.'
      );
      return false;
    }

    const notes = (params as { orderId?: string }).orderId;
    if (!notes) {
      params.onFailure(
        'Secure deposit cannot start without a server-side gateway order. Client-generated order ids are not accepted.'
      );
      return false;
    }

    const result = await checkoutWithRazorpay({
      keyId: key,
      orderId: notes,
      amountPaise: Math.round(params.advanceAmount * 100),
      name: params.salon.name || 'Nexora Salon Experience',
      description: params.description || `25% Advance Booking Deposit for ${params.salon.name}`,
      image: params.salon.image,
      prefill: {
        name: params.customer?.name,
        email: params.customer?.email,
        contact: params.customer?.phone,
      },
      notes: {
        salon_id: params.salon.id,
        salon_name: params.salon.name,
        advance_percentage: '25%',
      },
    });
    if (result.ok === false) {
      if (/cancelled/i.test(result.error)) {
        params.onDismiss?.();
      } else {
        params.onFailure(result.error);
      }
      return false;
    }
    params.onSuccess(result.payment);
    return true;
  }

  /**
   * Verify and confirm payment authorization for 25% Advance
   */
  public async verifyAndConfirmAdvance(params: {
    paymentResponse: RazorpayPaymentSuccessResponse;
    expectedAdvance: number;
    totalAmount: number;
  }): Promise<PaymentVerificationResult> {
    const { paymentResponse, expectedAdvance, totalAmount } = params;

    if (
      !paymentResponse.razorpay_payment_id ||
      !paymentResponse.razorpay_order_id ||
      !paymentResponse.razorpay_signature
    ) {
      return {
        verified: false,
        paymentId: '',
        advancePaid: 0,
        remainingDue: totalAmount,
        timestamp: new Date().toISOString(),
        errorMessage:
          'Invalid Razorpay payment authorization: order id, payment id and signature are all required. Client-side shortcuts are not accepted.',
      };
    }

    // The browser cannot verify HMAC (the secret never ships). Callers must
    // POST these three fields to /api/payments/verify; this method only
    // confirms the payload is complete enough to send.
    const remainingDue = Math.max(0, totalAmount - expectedAdvance);

    return {
      verified: false,
      paymentId: paymentResponse.razorpay_payment_id,
      orderId: paymentResponse.razorpay_order_id,
      advancePaid: expectedAdvance,
      remainingDue,
      timestamp: new Date().toISOString(),
      errorMessage: 'Signature verification is server-side only. POST /api/payments/verify.',
    };
  }

  /**
   * Build confirmed appointment record strictly after payment verification
   */
  public createConfirmedAppointmentRecord(_params: {
    salon: Salon;
    services: SalonService[];
    stylist?: Stylist | null;
    date: string;
    time: string;
    totalPrice: number;
    advancePaid: number;
    remainingAmount: number;
    discountApplied?: number;
    paymentResponse: RazorpayPaymentSuccessResponse;
    notes?: string;
  }): Appointment {
    throw new Error(
      'Appointments are created only after POST /api/payments/verify succeeds. The browser must not mint a confirmed booking from checkout state.'
    );
  }

  /**
   * Persist a payment transaction to history storage
   */
  public recordTransaction(transaction: PaymentTransaction): void {
    try {
      const history = this.getStoredTransactions();
      // Avoid duplicate transactions by payment ID
      const filtered = history.filter((t) => t.id !== transaction.id);
      const updated = [transaction, ...filtered];
      localStorage.setItem(STORAGE_KEY_PAYMENT_HISTORY, JSON.stringify(updated));
    } catch {
      // Storage unavailable or quota exceeded
    }
  }

  /**
   * Retrieve all stored payment transactions
   */
  public getStoredTransactions(): PaymentTransaction[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PAYMENT_HISTORY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /**
   * Get complete payment transaction history merged with appointments
   */
  public getPaymentHistory(appointments: Appointment[] = []): PaymentTransaction[] {
    const stored = this.getStoredTransactions();
    const storedMap = new Map(stored.map((t) => [t.id, t]));
    const appointmentMap = new Map(stored.map((t) => [t.appointmentId, t]));

    // Generate transaction records from appointments with paid advance
    const fromAppointments: PaymentTransaction[] = appointments
      .filter((a) => (a.advancePaid && a.advancePaid > 0) || a.paymentStatus === 'paid')
      .map((a) => {
        const paymentId = a.razorpayPaymentId || `pay_rzp_${a.id.replace(/[^a-zA-Z0-9]/g, '')}`;
        const existing = storedMap.get(paymentId) || appointmentMap.get(a.id);

        if (existing) {
          return existing;
        }

        const dateObj = a.createdAt ? new Date(a.createdAt) : new Date(a.date);
        const formattedDate = !isNaN(dateObj.getTime())
          ? dateObj.toLocaleDateString('en-US', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : `${a.date} · ${a.time}`;

        return {
          id: paymentId,
          orderId: a.razorpayOrderId,
          bookingId: a.bookingRef || a.id,
          appointmentId: a.id,
          salonId: a.salonId,
          salonName: a.salonName,
          salonImage: a.salonImage,
          salonAddress: a.salonAddress,
          salonPhone: a.salonPhone,
          serviceNames: a.services.map((s) => s.name),
          stylistName: a.stylist?.name,
          amount: a.advancePaid || Math.round(a.totalPrice * 0.25),
          totalBill: a.totalPrice,
          remainingDue: a.remainingAmount !== undefined ? a.remainingAmount : Math.max(0, a.totalPrice - (a.advancePaid || 0)),
          paymentMethod: a.paymentMethodUsed || 'upi',
          status: 'successful',
          date: formattedDate,
          appointmentDate: a.date,
          appointmentTime: a.time,
          createdAt: a.createdAt || new Date().toISOString(),
          notes: a.notes,
        };
      });

    // Merge and deduplicate by payment ID and booking ID
    const mergedMap = new Map<string, PaymentTransaction>();

    // First add all stored ones
    stored.forEach((item) => {
      mergedMap.set(item.id, item);
    });

    // Then add derived ones
    fromAppointments.forEach((item) => {
      if (!mergedMap.has(item.id)) {
        mergedMap.set(item.id, item);
      }
    });

    return Array.from(mergedMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }
}

// Global convenience singleton and helper exports
export const paymentService = PaymentService.getInstance();
export const calculateAdvancePayment = PaymentService.calculateAdvance;
