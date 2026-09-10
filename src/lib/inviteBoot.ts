/**
 * Invite-link boot guard.
 *
 * Imported as the FIRST module of `main.tsx` on purpose: ESM evaluates imports
 * in declaration order, so this runs before `AuthProvider`/`App` construct the
 * Supabase client. Importing first is what guarantees the referral code is read
 * out of the URL (and `?code=` is replaced by `?ref=`) before GoTrue's
 * `detectSessionInUrl` inspects the address bar and tries to exchange the
 * visitor's referral code for a session — a collision that used to bounce an
 * invited visitor to the login screen, losing the invite entirely.
 *
 * Browsers that load `index.html` unmodified already ran the equivalent inline
 * script; this module is what makes the flow work when that script is missing,
 * stale, or stripped by a CDN — and it is directly unit-testable.
 */

import { captureInviteCode } from './inviteLink';

export const inviteBoot = captureInviteCode();
