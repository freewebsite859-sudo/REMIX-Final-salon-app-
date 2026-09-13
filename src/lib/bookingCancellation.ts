/**
 * Client for `POST /api/bookings/:id/cancel`.
 *
 * Mirrors `accountDeletion.ts`: the browser sends only its own access token and
 * never a user id, so the server decides who owns the booking. Never throws —
 * every failure resolves to `{ success: false }` so a caller cannot mistake a
 * thrown error for a completed cancellation.
 */

export interface CancelBookingOutcome {
  success: boolean;
  reason:
    | 'cancelled'
    | 'unauthenticated'
    | 'not_found'
    | 'not_configured'
    | 'server_error'
    | 'network_error';
  /** Human-readable message, safe to show verbatim. */
  message: string;
}

export async function requestBookingCancellation(
  bookingId: string,
  accessToken: string | null
): Promise<CancelBookingOutcome> {
  if (!bookingId.trim()) {
    return {
      success: false,
      reason: 'not_found',
      message: 'That booking could not be identified. Reload your appointments and retry.',
    };
  }

  if (!accessToken) {
    return {
      success: false,
      reason: 'unauthenticated',
      message: 'Your session has expired. Sign in again, then retry.',
    };
  }

  let response: Response;
  try {
    response = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch (err) {
    return {
      success: false,
      reason: 'network_error',
      message: `Could not reach the booking service. The appointment is still active. (${
        err instanceof Error ? err.message : 'network error'
      })`,
    };
  }

  // A non-JSON body (proxy error page, 502 HTML) must never read as success.
  let body: any = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (response.ok && body?.success === true) {
    return { success: true, reason: 'cancelled', message: 'Your appointment has been cancelled.' };
  }

  if (response.status === 401) {
    return {
      success: false,
      reason: 'unauthenticated',
      message: 'Your session has expired. Sign in again, then retry.',
    };
  }

  if (response.status === 404) {
    return {
      success: false,
      reason: 'not_found',
      message:
        typeof body?.error === 'string'
          ? body.error
          : 'No active booking was found for your account.',
    };
  }

  if (response.status === 503 || body?.configured === false) {
    return {
      success: false,
      reason: 'not_configured',
      message: 'Cancelling online is unavailable right now. Please contact the salon directly.',
    };
  }

  return {
    success: false,
    reason: 'server_error',
    message:
      typeof body?.error === 'string' && body.error.trim()
        ? body.error
        : 'Cancellation failed. The appointment is still active.',
  };
}
