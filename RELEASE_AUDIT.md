# Nexora SalonOS — Release Audit (single source of truth)

**Last updated:** 2026-08-30 (Asia/Calcutta)
**Branch:** `arena/01a051cc-remix-final-salon-app`
**Supersedes:** `GAP_ANALYSIS_REPORT.md` and `FINAL_RELEASE_AUDIT.md`, both deleted.
Those two documents overlapped and contradicted each other — the gap analysis still
listed referrals as a missing table and recommended a config banner that had since
been shipped, while the release audit carried an older file inventory. This is now
the only release specification. Where it disagrees with an older note, this wins.

---

## 1. Status

**🔴 NOT PRODUCTION READY.**

The customer web app is structurally sound and its data-integrity rules are enforced
in the database rather than the client. What blocks release is external: live Supabase
credentials, canonical catalog/booking/payment schema, and a Razorpay backend. None of
those can be produced from inside this repository.

---

## 2. Verified in this checkout

Commands and results, run against this working tree:

| Command | Result |
|---|---|
| `npm run lint` (`tsc --noEmit`) | clean |
| `npm run build` | ✓ `dist/` + `dist/server.cjs` |
| `npm run test:referral` | 64/64 |
| `npm run test:notifications` | 51/51 |
| `npm run test:profile` | 130/130 |
| `npm run test:nexora` | 22/22 |
| `npm run test:catalog` | 7/7 |
| `npm run test:smoke` | PASS |

`node_modules` is not persisted between sessions in this workspace — run
`npm ci --no-audit --no-fund` before any of the above.

---

## 3. What is implemented and enforced

### 3.1 Referrals — database is the source of truth
`supabase/policies/referrals.sql` defines `referral_codes` and `referrals` with the
constraints that make the business rules unforgeable from the client:

- `referrals_one_per_referred_user unique (referred_user_id)` — one relationship per account
- `referrals_no_self_referral check (referred_user_id <> referrer_user_id)`
- `referrals_code_format check (referral_code ~ '^[A-Z0-9]{3,24}$')`
- foreign keys to `auth.users` on both sides
- RLS enabled; no update or delete path for `authenticated`

Three `SECURITY DEFINER` RPCs are the only write surface the browser has:
`validate_referral_code`, `apply_referral`, `ensure_referral_code`. `apply_referral`
re-checks authentication, code format, prior relationship, code existence, active
flag and self-referral, and inserts with `on conflict do nothing`.

The client sends only the public code — never a referrer user id, and never a
service_role key.

### 3.2 Notifications
`supabase/policies/notifications.sql`, `src/lib/notificationService.ts`,
`src/lib/notificationChannels.ts`, `server/notifications.ts`.

Delivery honesty is enforced at three levels: the DB `CHECK` requires
`provider_status` + `confirmed_at` before a row may read `delivered`, a
`BEFORE UPDATE` trigger guards it, and `authenticated` has no policy that can set it.
`postToProvider` returns `sent` only on an explicit `accepted === true` from the
provider, and `markDelivered` refuses to run without both a provider message id and
a provider status. Unconfigured channels answer `503 {configured:false}`, never a
silent success.

### 3.3 Customer profile
`src/components/ProfileTab.tsx`, `ProfileMenu.tsx`, `ProfileLegalModal.tsx`.
Overview shows photo, name, email, mobile, membership badge and reward balance from
stored data; the menu is the 13 specified destinations in order; Personal Information
carries all 7 specified fields. No placeholder phone, locality, tier or reward credit.

### 3.4 Auth routing
`src/lib/authRoutes.ts`. Canonical `/auth/signup`, aliases `/signup`, `/register`,
`/auth/register`, plus `/?ref=…` on the root. Invite links resolve to the signup
screen with the code pre-filled. `code` is deliberately **not** treated as a referral
parameter, because Supabase PKCE uses `?code=`.

### 3.5 Referral context capture
`src/lib/referralService.ts` stores the incoming code in `sessionStorage` with a
`localStorage` fallback carrying a TTL, survives refresh and navigation between
login and signup, and rewrites the address bar with `history.replaceState` so the
code is hidden without being lost.

### 3.6 Unconfigured-environment surfacing
`src/components/SupabaseConfigBanner.tsx` renders proactively — before any input —
on the auth page, password reset modal and password update page. It names the exact
missing variable and distinguishes *missing* from *invalid* from
*service_role-key-present*. Previously this only appeared after submit.

---

## 4. Open blockers, in priority order

### CRITICAL

**B1. Supply live Supabase credentials.**
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are unset; the app therefore reports
"Live authentication is unavailable". `npm run setup:auth <anon-key>` writes the key,
verifies the client configures itself, and rebuilds. Vite inlines `VITE_*` at build
time, so `npm start` needs a rebuild after any change (`npm run dev` does not).
*Expected:* `isSupabaseConfigured === true`, sign-in reaches Supabase.

**B2. Apply the SQL to the canonical project.**
`supabase/policies/{referrals,notifications,user_locations}.sql` are written but have
never been applied to a live database. Inspect first; these are non-destructive
(`create … if not exists`, `drop policy if exists`) but must be reviewed against
whatever already exists. *Expected:* RPCs callable, RLS rejecting foreign rows.

**B3. Booking and payment backend does not exist.**
There is no availability hold, no duplicate protection, no server-side order
creation, and no signature verification. Server routes today are only
`/api/health`, four `/api/salons/*` AI endpoints, and `/api/notifications/*`.
A booking must not be confirmable from client state. *Expected:* two concurrent
clients cannot reserve one slot; a booking is confirmed only after verified payment.

**B4. Account deletion is not implemented.**
`App.tsx` `handleDeleteAccount` deliberately returns `false` and logs a warning rather
than pretending to delete. It needs a trusted service_role Edge Function and a
`POST /api/user/delete` route that forwards the user's JWT. Compliance blocker.

**B5. Invalid Gemini model names.**
`server.ts` requests `gemini-3.6-flash` (lines 114, 164) and `gemini-3.7-flash`
(lines 289, 381). These model ids do not exist, so every AI endpoint fails. Replace
with a supported model and make it configurable via `GEMINI_MODEL`.

### HIGH

**B6. Canonical catalog schema unverified.** The app queries `salons`, `services`,
`categories`, `professionals` with tolerant column mapping and falls back to the
in-repo catalog when the remote root is empty or unreachable. The fallback must never
mix with remote rows — `test:catalog` covers this — but the real column names still
need confirming against the canonical schema.

**B7. Browser bundle is 795 kB (195 kB gzip).** Lazy-load AI, gallery, profile,
booking and category surfaces.

**B8. No end-to-end run against a real backend.** Every suite here stubs Supabase.
Signup, email confirmation, login, refresh, direct protected URL, booking, payment
and cross-tenant denial have not been exercised against a live project.

### MEDIUM

**B9. `src/lib/supabase.ts`** is a backward-compatibility re-export of
`src/lib/supabase/client.ts`. Intentional and harmless, but new code should import
the canonical path so the shim can eventually be removed.

**B10. No QR code.** The referral share modal previously drew a fixed SVG pattern
that encoded nothing while telling users to scan it. It now shows the real link and
code. Adding a scannable QR requires a verified encoder — a wrong QR is worse than none.

---

## 5. Environment contract

Only public, browser-safe values may use the `VITE_` prefix — they are inlined into
the client bundle. The app detects a `service_role` key in `VITE_SUPABASE_ANON_KEY`
and refuses to construct the client.

| Variable | Required | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | yes | `https://<project>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | yes | anon **public** key only |
| `VITE_SUPABASE_STORAGE_KEY` | recommended | shared across Nexora apps |
| `VITE_NEXORA_DEMO_MODE` | no | force the in-repo catalog for QA |
| `VITE_NEXORA_SUPPORT_EMAIL` | no | Profile → Support contact; hidden if unset |
| `GEMINI_API_KEY` | server only | never `VITE_` |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | never `VITE_` |
| `RAZORPAY_*` | server only | not yet consumed — see B3 |

`.env` is gitignored. `.env.example` documents every variable.

---

## 6. Commands

```bash
npm ci --no-audit --no-fund        # node_modules is not persisted between sessions
npm run lint                       # tsc --noEmit
npm run build                      # vite build + esbuild server
npm run dev                        # Express + Vite middleware (reads .env live)
npm start                          # production, serves dist/
npm run setup:auth <anon-key>      # install anon key, verify, rebuild
npm run test:referral              # 64 checks
npm run test:notifications         # 51 checks
npm run test:profile               # 130 checks
npm run test:nexora                # 22 checks
npm run test:catalog               # 7 checks
npm run test:smoke                 # App mounts cleanly
```
