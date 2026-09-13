/**
 * Nexora account lifecycle endpoints.
 *
 *   POST /api/user/delete    permanently delete the calling user's auth account
 *
 * Why this lives server-side: deleting a row from `auth.users` requires the
 * service-role key, which must never reach the browser. The browser therefore
 * sends only its own access token; this router verifies that token and deletes
 * exactly — and only — the account it belongs to.
 *
 * Identity is taken from the verified token, never from the request body. A
 * caller cannot delete someone else's account by supplying a different id.
 */

import { Router, Request, Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from './notifications';
import { jsonError } from './bookings';

export interface AccountStore {
  /** Verify an access token and return the user id it belongs to. */
  verifyAccessToken(token: string): Promise<{ ok: boolean; userId?: string; error?: string }>;
  /** Permanently delete the auth user (cascades to auth-owned rows). */
  deleteUser(userId: string): Promise<{ ok: boolean; error?: string }>;
}

/** Supabase-backed store. Kept injectable so the router is testable offline. */
export function createSupabaseAccountStore(client: SupabaseClient): AccountStore {
  return {
    async verifyAccessToken(token: string) {
      try {
        const { data, error } = await client.auth.getUser(token);
        if (error || !data?.user?.id) {
          return { ok: false, error: error?.message || 'Token could not be verified' };
        }
        return { ok: true, userId: data.user.id };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Token verification failed' };
      }
    },
    async deleteUser(userId: string) {
      try {
        const { error } = await client.auth.admin.deleteUser(userId);
        if (error) return { ok: false, error: error.message };
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Deletion failed' };
      }
    },
  };
}

/** Pull the bearer token off the request, or null when absent/malformed. */
export function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization || req.headers.Authorization;
  if (typeof header !== 'string') return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();
  return token ? token : null;
}

export function createUserAccountRouter(
  env: NodeJS.ProcessEnv = process.env,
  injectedStore?: AccountStore
): Router {
  const router = Router();

  router.post('/delete', async (req: Request, res: Response) => {
    // Resolve the store per-request so a late-arriving env var is picked up,
    // and so an injected test store always wins.
    let store = injectedStore;
    if (!store) {
      const { client, reason } = createServiceClient(env);
      if (!client) {
        // Honest 503 — never pretend a deletion happened. The client shows
        // "not configured" rather than signing the user out of an account that
        // still exists.
        return res.status(503).json({
          error: 'Account deletion is not available',
          reason: reason || 'service client unavailable',
          configured: false,
        });
      }
      store = createSupabaseAccountStore(client);
    }

    const token = extractBearerToken(req);
    if (!token) {
      return jsonError(res, 401, 'Missing access token. Sign in again and retry.');
    }

    const verified = await store.verifyAccessToken(token);
    if (!verified.ok || !verified.userId) {
      return jsonError(res, 401, verified.error || 'Session expired. Sign in again and retry.');
    }

    const deleted = await store.deleteUser(verified.userId);
    if (!deleted.ok) {
      return jsonError(
        res,
        500,
        `Account deletion failed: ${deleted.error || 'unknown error'}. No data was deleted.`
      );
    }

    return res.json({ success: true, deletedUserId: verified.userId });
  });

  return router;
}
