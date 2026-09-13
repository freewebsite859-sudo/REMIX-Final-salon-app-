/**
 * Client for the account-lifecycle API (`server/userAccount.ts`).
 *
 * The browser sends only its own access token. It never sends a user id and
 * never holds the service-role key — the server derives the identity from the
 * verified token, so a caller cannot target someone else's account.
 */

export interface DeleteAccountOutcome {
  success: boolean;
  /** Machine-readable reason so the UI can explain itself precisely. */
  reason: 'deleted' | 'unauthenticated' | 'not_configured' | 'server_error' | 'network_error';
  /** Human-readable message, safe to show verbatim. */
  message: string;
}

/**
 * Request permanent deletion of the calling account.
 *
 * Never throws: every failure mode resolves to a `{ success: false }` outcome,
 * so a caller cannot mistake a thrown error for a completed deletion.
 */
export async function requestAccountDeletion(accessToken: string | null): Promise<DeleteAccountOutcome> {
  if (!accessToken) {
    return {
      success: false,
      reason: 'unauthenticated',
      message: 'Your session has expired. Sign in again, then retry.',
    };
  }

  let response: Response;
  try {
    response = await fetch('/api/user/delete', {
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
      message: `Could not reach the account service. No data was deleted. (${
        err instanceof Error ? err.message : 'network error'
      })`,
    };
  }

  // A non-JSON body (proxy error page, 502 HTML) must not be treated as success.
  let body: any = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (response.ok && body?.success === true) {
    return { success: true, reason: 'deleted', message: 'Your account has been deleted.' };
  }

  if (response.status === 401) {
    return {
      success: false,
      reason: 'unauthenticated',
      message: body?.error || 'Your session has expired. Sign in again, then retry.',
    };
  }

  if (response.status === 503) {
    return {
      success: false,
      reason: 'not_configured',
      message:
        'Account deletion is not available on this deployment because the secure deletion service is not configured. No data was deleted.',
    };
  }

  return {
    success: false,
    reason: 'server_error',
    message:
      body?.error ||
      `Account deletion failed (HTTP ${response.status}). No data was deleted.`,
  };
}
