// Razorpay Integration Service & Utilities
export interface RazorpayPaymentSuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
  method?: 'upi' | 'card' | 'netbanking' | 'qr' | 'wallet';
  upi_id?: string;
  bank?: string;
  wallet?: string;
}

export interface RazorpayOptions {
  key: string;
  amount: number; // in paise
  currency: string;
  name: string;
  description: string;
  image?: string;
  order_id?: string;
  handler: (response: RazorpayPaymentSuccessResponse) => void;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
    method?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
  };
  modal?: {
    ondismiss?: () => void;
    escape?: boolean;
    backdropclose?: boolean;
  };
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => {
      open: () => void;
      on: (event: string, callback: (response: any) => void) => void;
      close: () => void;
    };
  }
}

const RAZORPAY_STORAGE_KEY = 'nexora-razorpay-key-id';
export const DEFAULT_RAZORPAY_TEST_KEY = 'rzp_test_NEXORA_SALON_7788';

/**
 * Get active Razorpay Key ID
 */
export function getRazorpayKeyId(): string {
  if (typeof window !== 'undefined') {
    const customKey = localStorage.getItem(RAZORPAY_STORAGE_KEY);
    if (customKey && customKey.trim().length > 5) {
      return customKey.trim();
    }
  }
  const envKey = (import.meta as any).env?.VITE_RAZORPAY_KEY_ID;
  if (envKey && typeof envKey === 'string' && envKey.trim().length > 5) {
    return envKey.trim();
  }
  return DEFAULT_RAZORPAY_TEST_KEY;
}

/**
 * Save custom Razorpay Key ID for merchant/user
 */
export function saveRazorpayKeyId(key: string): void {
  if (typeof window !== 'undefined') {
    if (!key.trim()) {
      localStorage.removeItem(RAZORPAY_STORAGE_KEY);
    } else {
      localStorage.setItem(RAZORPAY_STORAGE_KEY, key.trim());
    }
  }
}

/**
 * Load official Razorpay checkout.js script asynchronously
 */
export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const existingScript = document.getElementById('razorpay-checkout-script');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true));
      existingScript.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.id = 'razorpay-checkout-script';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.warn('Failed to load external Razorpay checkout.js; falling back to integrated Razorpay checkout module.');
      resolve(false);
    };
    document.body.appendChild(script);
  });
}

/**
 * Generate a unique Razorpay Payment ID
 */
export function generateRazorpayPaymentId(prefix = 'pay_'): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = prefix;
  for (let i = 0; i < 14; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate a unique Razorpay Order ID
 */
export function generateRazorpayOrderId(prefix = 'order_'): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = prefix;
  for (let i = 0; i < 14; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
