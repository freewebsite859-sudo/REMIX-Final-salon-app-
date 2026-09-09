// Razorpay checkout utilities. Order ids and signatures are NEVER generated
// in the browser — they come from POST /api/payments/orders and the official
// checkout.js handler. A missing SDK is a hard failure, not a fake-QR fallback.

export interface RazorpayPaymentSuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
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
  order_id: string;
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
      on: (event: string, callback: (response: unknown) => void) => void;
      close: () => void;
    };
  }
}

/**
 * Public Razorpay Key ID. Only the server-issued key from /api/payments/orders
 * (or VITE_RAZORPAY_KEY_ID) is used. There is no baked-in test key — a missing
 * key means checkout cannot start.
 */
export function getRazorpayKeyId(): string {
  const envKey = (import.meta as { env?: { VITE_RAZORPAY_KEY_ID?: string } }).env?.VITE_RAZORPAY_KEY_ID;
  if (envKey && typeof envKey === 'string' && envKey.trim().length > 5) {
    return envKey.trim();
  }
  return '';
}

/**
 * Load official Razorpay checkout.js. Failure resolves false — callers must
 * NOT fall back to an in-app QR or simulated payment.
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
      console.warn('[Nexora] Failed to load Razorpay checkout.js. No in-app payment shortcut will be used.');
      resolve(false);
    };
    document.body.appendChild(script);
  });
}

export interface CheckoutWithRazorpayInput {
  keyId: string;
  orderId: string;
  amountPaise: number;
  name: string;
  description: string;
  image?: string;
  prefill?: RazorpayOptions['prefill'];
  notes?: Record<string, string>;
}

/**
 * Open the official Razorpay Checkout with a SERVER-CREATED order id.
 * Rejects if the SDK is missing, the key/order are missing, or the user
 * dismisses the modal. Never invents payment/order/signature values.
 */
export async function checkoutWithRazorpay(
  input: CheckoutWithRazorpayInput
): Promise<
  | { ok: true; payment: RazorpayPaymentSuccessResponse }
  | { ok: false; error: string }
> {
  if (!input.keyId || !input.orderId || !Number.isFinite(input.amountPaise) || input.amountPaise <= 0) {
    return {
      ok: false,
      error:
        'Secure deposit cannot start: the server did not return a gateway order. No merchant QR code or client-side payment shortcut is used.',
    };
  }

  const loaded = await loadRazorpayScript();
  if (!loaded || typeof window === 'undefined' || !window.Razorpay) {
    return {
      ok: false,
      error:
        'The Razorpay checkout could not be loaded. No merchant QR code or in-app payment shortcut is offered. No slot was locked and no payment was taken.',
    };
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: { ok: true; payment: RazorpayPaymentSuccessResponse } | { ok: false; error: string }) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    try {
      const rzp = new window.Razorpay({
        key: input.keyId,
        amount: Math.round(input.amountPaise),
        currency: 'INR',
        name: input.name || 'Nexora Salon Experience',
        description: input.description,
        image: input.image,
        order_id: input.orderId,
        handler: (response) => {
          if (
            !response?.razorpay_payment_id ||
            !response?.razorpay_order_id ||
            !response?.razorpay_signature ||
            response.razorpay_order_id !== input.orderId
          ) {
            finish({
              ok: false,
              error:
                'Razorpay did not return a verifiable payment (order id / payment id / signature). No booking was created.',
            });
            return;
          }
          finish({
            ok: true,
            payment: {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
              method: response.method,
            },
          });
        },
        prefill: input.prefill,
        notes: input.notes,
        theme: { color: '#d63384' },
        modal: {
          ondismiss: () => {
            finish({
              ok: false,
              error: 'Payment was cancelled. No slot was locked and no booking was created.',
            });
          },
          escape: true,
          backdropclose: false,
        },
      });
      rzp.on('payment.failed', (response: unknown) => {
        const err = response as { error?: { description?: string } };
        finish({
          ok: false,
          error: err.error?.description || 'Payment was declined. No slot was locked and no booking was created.',
        });
      });
      rzp.open();
    } catch (err) {
      finish({
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : 'Razorpay checkout failed to start. No in-app payment shortcut is available.',
      });
    }
  });
}
