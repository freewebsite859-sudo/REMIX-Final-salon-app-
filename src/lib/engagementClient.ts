/**
 * Browser-safe client for the engagement API (server/engagement.ts).
 * Same honesty contract as createBookingClient: a QR code or a summary only
 * "exists" when the server actually returned it — no client-side fabrication.
 *
 * Opt-in flag: VITE_NEXORA_ENGAGEMENT=true is required (see .env.example).
 * Without it these calls short-circuit to { ok:false, error:'disabled' } so
 * the UI shows an honest offline state in demo/unconfigured builds.
 */

import type { EngagementSummary } from './engagement';

export interface QrCodeResponse {
  code: string;
  generatedAt: string;
  lastScannedAt?: string | null;
}

export interface CheckInResponse {
  checkIn: {
    id: string;
    user_id: string;
    salon_id: string;
    salon_name: string;
    points_awarded: number;
    day_date: string;
    checked_in_at: string;
  };
  pointsAwarded: number;
  userId: string;
}

export interface EngagementApiResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  code?: 'disabled' | 'offline' | 'duplicate' | 'not_found' | 'error';
}

function engagementFlagEnabled(): boolean {
  try {
    const meta = (import.meta as { env?: Record<string, string | undefined> }).env;
    if (meta?.VITE_NEXORA_ENGAGEMENT === 'true') return true;
  } catch {
    /* import.meta.env unavailable outside Vite */
  }
  try {
    return process.env?.VITE_NEXORA_ENGAGEMENT === 'true';
  } catch {
    return false;
  }
}

const engagementEnabled = engagementFlagEnabled();

function baseUrl(): string {
  return `${window.location.origin}/api/engagement`;
}

async function request<T>(
  path: string,
  init?: RequestInit
): Promise<{ ok: boolean; payload?: T; error?: string; code?: EngagementApiResult<T>['code'] }> {
  if (!engagementEnabled) {
    return { ok: false, code: 'disabled', error: 'Engagement service is disabled in this build.' };
  }
  let response: Response;
  try {
    response = await fetch(`${baseUrl()}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
  } catch {
    return { ok: false, code: 'offline', error: 'Engagement service is unreachable right now.' };
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    /* non-JSON body */
  }
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && typeof (payload as { error?: unknown }).error === 'string'
        ? ((payload as { error: string }).error as string)
        : `Engagement request failed with status ${response.status}.`;
    const code =
      response.status === 404 ? 'not_found' : response.status === 409 ? 'duplicate' : 'error';
    return { ok: false, code, error: message };
  }
  return { ok: true, payload: payload as T };
}

export async function fetchMyQrCode(userId: string): Promise<EngagementApiResult<QrCodeResponse>> {
  const result = await request<{ qrCode: QrCodeResponse }>('/qr/generate', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
  if (!result.ok || !result.payload) {
    return { ok: false, code: result.code, error: result.error };
  }
  return { ok: true, data: result.payload.qrCode };
}

export async function submitQrCheckIn(input: {
  code: string;
  salonId: string;
  salonName: string;
}): Promise<EngagementApiResult<CheckInResponse>> {
  const result = await request<{
    checkIn: CheckInResponse['checkIn'];
    pointsAwarded: number;
    userId: string;
  }>('/qr/check-in', { method: 'POST', body: JSON.stringify(input) });
  if (!result.ok || !result.payload) {
    return { ok: false, code: result.code, error: result.error };
  }
  return {
    ok: true,
    data: {
      checkIn: result.payload.checkIn,
      pointsAwarded: result.payload.pointsAwarded,
      userId: result.payload.userId,
    },
  };
}

export async function fetchEngagementSummary(
  userId: string
): Promise<EngagementApiResult<EngagementSummary>> {
  const result = await request<{ summary: EngagementSummary }>(`/summary/${userId}`);
  if (!result.ok || !result.payload) {
    return { ok: false, code: result.code, error: result.error };
  }
  return { ok: true, data: result.payload.summary };
}
