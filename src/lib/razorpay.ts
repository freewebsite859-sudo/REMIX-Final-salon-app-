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

/**
 * Optional public Razorpay key id for non-core/demo UI. The live booking flow
 * always takes the key id from GET /api/payments/config; this is only a
 * build-time convenience for the unused checkout shell.
 */
export function getRazorpayKeyId(): string {
  const envKey = (import.meta as any).env?.VITE_RAZORPAY_KEY_ID;
  if (envKey && typeof envKey === 'string' && envKey.trim().length > 5) {
    return envKey.trim();
  }
  const stored = typeof window !== 'undefined' ? window.localStorage.getItem(RAZORPAY_STORAGE_KEY) : null;
  return stored && stored.trim().length > 5 ? stored.trim() : '';
}

/**
 * Save a public Razorpay key id for the unused checkout shell. This is not a
 * secret and is never required by the live booking flow.
 */
export function saveRazorpayKeyId(key: string): void {
  if (typeof window !== 'undefined') {
    if (!key.trim()) {
      window.localStorage.removeItem(RAZORPAY_STORAGE_KEY);
    } else {
      window.localStorage.setItem(RAZORPAY_STORAGE_KEY, key.trim());
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

// Payment identifiers are never fabricated in the browser. Razorpay order and
// payment ids come from the secure backend order creation and from the Razorpay
// checkout response, and are verified server-side before a booking is created.
