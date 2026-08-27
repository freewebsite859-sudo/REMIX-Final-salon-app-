# Nexora Customer App — Deployment & Live Verification

Live authentication is **configured and working**. The public Supabase URL, the
shared storage key, and the **public anon key** for project
`qwaehqsmodekbgvnaavz` are wired into `src/lib/supabase.ts` (the anon key is a
public, browser-safe value protected by RLS) and reproduced in the local,
gitignored `.env`. The Supabase auth service has been verified live (email
sign-in/sign-up enabled, `mailer_autoconfirm: true`).

The only optional/backend steps left are listed below; none of them block
sign-in.

---

## 1. Supabase configuration (already wired — optional overrides)

The app ships built-in defaults for `VITE_SUPABASE_URL`,
`VITE_SUPABASE_STORAGE_KEY`, and `VITE_SUPABASE_ANON_KEY`, so live auth works
out of the box with **no environment variables set**. You only need to set
these to point at a *different* Supabase project or to rotate the key.

> Use the **anon** key, never `service_role`. Anything prefixed `VITE_` is
> inlined into the browser bundle and is publicly readable. The app refuses to
> start its Supabase client if it detects a `service_role` JWT.

### Local (optional override)

```bash
# .env  (already gitignored; safe to leave blank — defaults are built in)
VITE_SUPABASE_URL=https://qwaehqsmodekbgvnaavz.supabase.co
VITE_SUPABASE_STORAGE_KEY=nexora.auth.qwaehqsmodekbgvnaavz
VITE_SUPABASE_ANON_KEY=<optional: override the built-in public anon key>
```

### Hosting platform

This repo has **no hosting config committed** (no `vercel.json`, `netlify.toml`,
Dockerfile, etc.), so the target platform is undetermined. Set the same three
variables in your platform's environment settings, then **redeploy** — `VITE_*`
values are baked in at build time, so an existing deployment will not pick them
up until it is rebuilt.

```bash
# Vercel example
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_STORAGE_KEY production
vercel env add VITE_SUPABASE_ANON_KEY production
vercel --prod
```

Authentication is **live** — there is no read-only shell. Sign-in, sign-up,
session restore, and password recovery all hit the real Supabase project.
Authentication is never simulated and a local profile cannot unlock protected
features.

The customer app uses a hybrid catalog strategy. It renders the in-repo
catalog immediately as a graceful fallback while Supabase is unavailable or
empty, then atomically replaces it with valid Supabase salon rows. It never
mixes fallback rows into a non-empty real catalog. Set `VITE_NEXORA_DEMO_MODE=true`
only to force the fixture for visual QA; a demo catalog is never a production
source of truth.

> **Catalog visibility note (verified live):** the `services` table is already
> readable by guests, but `salons` exists and currently returns
> `42501 permission denied` to the `anon` role, and `categories` /
> `professionals` are not yet created. Until step 2b is applied, guests browse
> the fallback catalog (auth still works fully). Apply `catalog_public_read.sql`
> to publish the real catalog.

---

## 2. Apply the RLS policies

### 2a. Live location (own-rows only)

Apply [`supabase/policies/user_locations.sql`](supabase/policies/user_locations.sql)
to project `qwaehqsmodekbgvnaavz`.

**Supabase Dashboard** → SQL Editor → paste the file contents → Run.

**Or via CLI:**

```bash
supabase link --project-ref qwaehqsmodekbgvnaavz
supabase db execute --file supabase/policies/user_locations.sql
```

The script is idempotent (`create table if not exists`, `drop policy if
exists`), so it is safe to re-run and safe if `user_locations` already exists.

It enforces `auth.uid() = user_id` for **select / insert / update / delete**,
which is what makes the browser-side anon key safe: a signed-in user can only
touch their own row, and `anon` gets no access at all.

> The client degrades gracefully if this step is skipped — `useLocationSync`
> detects the missing table or an RLS denial and disables itself rather than
> retrying forever. Auth still works; only location sync is inert.

### 2b. Publish the catalog for guest discovery

Apply [`supabase/policies/catalog_public_read.sql`](supabase/policies/catalog_public_read.sql)
so guests (the `anon` role) and signed-in customers can **read** the
`salons`, `services`, `categories`, and `professionals` tables. The script is
idempotent, grants read-only access (no browser writes), and automatically
skips tables that do not yet exist.

```bash
supabase db execute --file supabase/policies/catalog_public_read.sql
```

After this runs, the live catalog replaces the fallback atomically. If
`categories`/`professionals` are created later by the canonical migration
chain, re-run the script to publish them.

---

## 3. Required canonical backend work before release

This checkout contains only the customer-web shell and the `user_locations`
RLS contract. It does not contain the ecosystem's claimed organization,
membership, salon catalog, availability, booking, payment-order, or webhook
migrations/API. Do not mark a deployment production-ready until the existing
canonical Nexora backend is connected and these contracts are verified:

- salon/service/location reads come from the canonical catalog;
- profile → organization membership → salon ownership resolves from Supabase;
- availability holds and booking mutations are server-side and idempotent;
- Razorpay order creation, signature verification, webhook reconciliation, and
  duplicate protection run server-side; and
- RLS policies cover every tenant-owned table and reject cross-tenant reads and
  writes.

The booking UI intentionally refuses to create local appointments when that
adapter is absent. It does not display a static QR code or claim a payment
succeeded.

## 4. Run live end-to-end verification

Requires a real Supabase user. Create a throwaway one in
**Authentication → Users** if needed.

```bash
# Option A: put the values in .env, then run:
npm run verify:live

# Option B: pass them inline for a one-off run:
VITE_SUPABASE_URL=https://qwaehqsmodekbgvnaavz.supabase.co \
VITE_SUPABASE_ANON_KEY=<anon key> \
NEXORA_TEST_EMAIL=<user email> \
NEXORA_TEST_PASSWORD=<user password> \
npm run verify:live
```

No stubs — this hits the real backend and checks:

| # | Check |
|---|-------|
| 1 | Backend reachable |
| 2 | Anon key is not a `service_role` key |
| 3 | Sign-in with a real user |
| 4 | Session persisted under `nexora.auth.qwaehqsmodekbgvnaavz` |
| 5 | Session restored by a fresh client (auto-login after reload) |
| 6 | Token refresh returns a genuinely new access token |
| 7 | Live coordinates upserted under RLS (`useLocationSync` write path) |
| 8 | Own row readable, coordinates match |
| 9 | RLS **rejects** writing another user's row, reads scoped to caller |
| 10 | Logout teardown — row deleted **before** the JWT is invalidated |
| 11 | Anonymous (signed-out) writes rejected |

Exits non-zero on any failure and cleans up after itself.

### Troubleshooting

| Symptom | Cause |
|---|---|
| `Cannot reach ... (ECONNRESET)` | Network egress blocked — run from an un-sandboxed machine |
| `relation "user_locations" does not exist` | Step 2 not applied |
| `new row violates row-level security policy` | Policies applied but `auth.uid() = user_id` mismatch |
| `RLS rejects...` shows `NOT BLOCKED` | Policy too permissive — re-apply step 2 |
| `Invalid login credentials` | Test user does not exist or wrong password |

---

## 5. Browser smoke test

After deploying, confirm in a real browser:

1. Sign in → land in the app (not bounced to `/auth/login`).
2. Reload → still signed in (session restored).
3. Grant location permission → a row appears in `user_locations` for your user.
4. Open the location modal → "Live location sync active" indicator shows.
5. Sign out → redirected to `/auth/login`, and the `user_locations` row is gone.
6. Reload while signed out → stays on login, no redirect loop.

Location requires a **secure context** (HTTPS or `localhost`); browsers block
`navigator.geolocation` on plain HTTP.

---

## CI checks

```bash
npm run typecheck   # 0 errors
npm run build       # 0 errors (with a bundle-size warning)
npm run test:nexora # 22/22 auth + location integration checks
npm run test:catalog # 7/7 hybrid catalog strategy checks
npm run test:smoke  # renders cleanly
npm run verify:live # requires real anon key + test user + applied RLS
```

`verify:live` is expected to stop before network checks when its required
credentials are absent; that is an external release blocker, not a passing
production verification.
