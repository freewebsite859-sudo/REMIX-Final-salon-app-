/**
 * Device geolocation access for the location picker.
 *
 * `navigator.geolocation.getCurrentPosition` fails for a handful of very
 * different reasons — the user declined the prompt, the OS has no fix, the
 * call timed out, the page is not a secure context, or an embedding frame
 * blocked the API through Permissions Policy. They all used to collapse into
 * one catch-all message ("Unable to detect location. Please select an area
 * below."), which left the user with no idea what to do next.
 *
 * This module classifies the failure, retries once with cheaper settings when
 * a retry can plausibly help, and returns an actionable, user-facing message
 * for each case. Nothing here ever invents a position: a failure is reported
 * as a failure so the caller can fall back to manual area selection.
 */

export type DeviceLocationErrorCode =
  /** `navigator.geolocation` is missing entirely. */
  | 'unsupported'
  /** Page is not a secure context (plain HTTP on a non-localhost host). */
  | 'insecure'
  /** Blocked by the embedding document's Permissions Policy (iframe previews). */
  | 'blocked'
  /** User / OS / browser site-settings refused location access. */
  | 'denied'
  /** The device has no position to report right now (no GPS / Wi-Fi / cell). */
  | 'unavailable'
  /** Both attempts timed out before a fix arrived. */
  | 'timeout'
  /** Anything else the browser threw back at us. */
  | 'unknown';

export interface DeviceLocationSuccess {
  status: 'ok';
  latitude: number;
  longitude: number;
  /** metres, when the browser reports it */
  accuracy: number | null;
}

export interface DeviceLocationFailure {
  status: 'error';
  code: DeviceLocationErrorCode;
  /** Actionable message suitable for display in the UI. */
  message: string;
  /** Raw browser diagnostic, for support / console logs. Never displayed prominently. */
  detail?: string;
  /** True when the app is running inside an iframe (embedded preview, webview…). */
  isEmbedded: boolean;
  /** True when another attempt could succeed without any settings change. */
  canRetry: boolean;
}

export type DeviceLocationResult = DeviceLocationSuccess | DeviceLocationFailure;

export interface RequestDeviceLocationOptions {
  /** Per-attempt timeout in ms. The low-accuracy retry gets double this. */
  timeoutMs?: number;
  /** Retry once with `enableHighAccuracy: false` on timeout/no-fix. Default true. */
  allowLowAccuracyRetry?: boolean;
  /** Called before each attempt, starting at 1 — lets the UI show progress. */
  onAttempt?: (attempt: number) => void;
}

const CODE_PERMISSION_DENIED = 1;
const CODE_POSITION_UNAVAILABLE = 2;
const CODE_TIMEOUT = 3;

/** True when the document is framed by another document (preview iframe, webview…). */
export function isEmbeddedFrame(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.top != null && window.top !== window.self;
  } catch {
    // Cross-origin access to the parent throws — we are definitely framed.
    return true;
  }
}

function geolocationMissing(): boolean {
  return (
    typeof navigator === 'undefined' ||
    typeof navigator.geolocation?.getCurrentPosition !== 'function'
  );
}

/** Insecure-context detection; localhost and HTTPS are both secure contexts. */
function isInsecureContext(): boolean {
  if (typeof window === 'undefined') return false;
  return window.isSecureContext === false;
}

function errorCodeOf(error: unknown): number | null {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'number') return code;
  }
  return null;
}

function messageOf(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = (error as { message?: unknown }).message;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  return '';
}

/** Retrying only helps when the device simply could not produce a fix in time. */
function isRetryable(code: number | null): boolean {
  return code === CODE_TIMEOUT || code === CODE_POSITION_UNAVAILABLE || code === null;
}

function looksLikePolicyBlock(detail: string): boolean {
  return /permission[s]?\s*policy|disabled in this document|blocked by a? ?policy/i.test(detail);
}

/**
 * Build the failure object for a code. Exported so callers (e.g. a Permissions
 * API pre-check) can surface the exact same wording the request path uses.
 */
export function describeLocationFailure(
  code: DeviceLocationErrorCode,
  context: { isEmbedded?: boolean; timeoutMs?: number; detail?: string } = {}
): DeviceLocationFailure {
  const isEmbedded = context.isEmbedded ?? isEmbeddedFrame();
  const seconds = Math.round((context.timeoutMs ?? 10_000) / 1000);
  const detail = context.detail?.trim() || undefined;

  const build = (
    message: string,
    canRetry: boolean
  ): DeviceLocationFailure => ({ status: 'error', code, message, detail, isEmbedded, canRetry });

  switch (code) {
    case 'unsupported':
      return build(
        'This browser does not support location sharing. Please select an area below.',
        false
      );
    case 'insecure':
      return build(
        'Device location needs a secure (HTTPS) connection. Please select an area below.',
        false
      );
    case 'blocked':
      return build(
        'Location access is blocked by the frame this app is embedded in. Open it in a new tab to use your device location — or select an area below.',
        false
      );
    case 'denied':
      return build(
        isEmbedded
          ? 'Location permission is blocked. Allow Location for this site in your browser settings, or open the app in a new tab (embedded previews often block location) — or select an area below.'
          : 'Location permission is blocked. Allow Location for this site in your browser settings (the lock icon in the address bar), then try again — or select an area below.',
        true
      );
    case 'unavailable':
      return build(
        'Your device could not determine a position right now (no GPS, Wi-Fi or mobile signal). Move somewhere with a clearer signal and try again — or select an area below.',
        true
      );
    case 'timeout':
      return build(
        `No GPS fix in ${seconds}s. Turn on device location (or step closer to a window) and try again — or select an area below.`,
        true
      );
    case 'unknown':
    default:
      return build('Unable to detect location. Please select an area below.', true);
  }
}

function toSuccess(position: GeolocationPosition): DeviceLocationSuccess {
  return {
    status: 'ok',
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
  };
}

function attempt(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

/**
 * Ask the browser for the device position.
 *
 * Pass 1 asks for a precise fix (GPS). If that only failed because the device
 * could not get one in time, pass 2 retries with cheaper, slower settings
 * (Wi-Fi / cell triangulation) so flaky indoor signal still resolves.
 */
export async function requestDeviceLocation(
  options: RequestDeviceLocationOptions = {}
): Promise<DeviceLocationResult> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const allowRetry = options.allowLowAccuracyRetry !== false;
  const isEmbedded = isEmbeddedFrame();

  if (geolocationMissing()) {
    return describeLocationFailure('unsupported', { isEmbedded });
  }
  if (isInsecureContext()) {
    return describeLocationFailure('insecure', {
      isEmbedded,
      detail: `Origin ${typeof window !== 'undefined' ? window.location.origin : 'unknown'} is not a secure context.`,
    });
  }

  let lastError: unknown = null;

  try {
    options.onAttempt?.(1);
    return toSuccess(
      await attempt({ enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 })
    );
  } catch (error) {
    lastError = error;
    if (!isRetryable(errorCodeOf(error))) {
      return classifyGeolocationError(error, isEmbedded, timeoutMs);
    }
  }

  if (!allowRetry) {
    return classifyGeolocationError(lastError, isEmbedded, timeoutMs);
  }

  try {
    options.onAttempt?.(2);
    return toSuccess(
      await attempt({
        enableHighAccuracy: false,
        timeout: timeoutMs * 2,
        maximumAge: 5 * 60_000,
      })
    );
  } catch (error) {
    lastError = error;
    return classifyGeolocationError(lastError, isEmbedded, timeoutMs);
  }
}

/**
 * Map a raw `GeolocationPositionError` (or anything else the browser throws)
 * onto a classified failure. Exported so `useLocationSync` reports the same
 * wording as the picker.
 */
export function classifyGeolocationError(
  error: unknown,
  isEmbedded = isEmbeddedFrame(),
  timeoutMs = 10_000
): DeviceLocationFailure {
  const code = errorCodeOf(error);
  const detail = messageOf(error);

  if (code === CODE_PERMISSION_DENIED) {
    // Chrome rejects the call outright with code 1 when an embedding document
    // withholds `geolocation` via Permissions Policy — indistinguishable from
    // a user denial except for the message text and the fact we are framed.
    const code2: DeviceLocationErrorCode =
      looksLikePolicyBlock(detail) || (isEmbedded && !detail) ? 'blocked' : 'denied';
    return describeLocationFailure(code2, { isEmbedded, timeoutMs, detail });
  }
  if (code === CODE_POSITION_UNAVAILABLE) {
    return describeLocationFailure('unavailable', { isEmbedded, timeoutMs, detail });
  }
  if (code === CODE_TIMEOUT) {
    return describeLocationFailure('timeout', { isEmbedded, timeoutMs, detail });
  }
  return describeLocationFailure('unknown', { isEmbedded, timeoutMs, detail });
}

/**
 * Current geolocation permission state, without triggering a prompt.
 * Returns `null` when the Permissions API is unavailable (Safari, Firefox…).
 */
export async function getGeolocationPermissionState(): Promise<PermissionState | null> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) return null;
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state;
  } catch {
    return null;
  }
}
