# Nexora Customer App — Deployment & Live Verification

The Nexora auth + location architecture is merged into `main`. Three steps
remain that **cannot be performed from a CI sandbox** because they require the
real anon key, Supabase project credentials, and unrestricted network egress.

Run them in this order.

---

## 1. Set the Supabase anon key

Get the key from **Supabase → Project `qwaehqsmodekbgvnaavz` → Settings → API →
Project API keys → `anon` / `public`**.

> Use the **anon** key, never `service_role`. Anything prefixed `VITE_` is
> inlined into the browser bundle and is publicly readable. The app refuses to
> start its Supabase client if it detects a `service_role` JWT.

### Local

```bash
# .env  (already gitignored — never commit it)
VITE_SUPABASE_URL=https://qwaehqsmodekbgvnaavz.supabase.co
VITE_SUPABASE_STORAGE_KEY=nexora.auth.qwaehqsmodekbgvnaavz
VITE_SUPABASE_ANON_KEY=<paste the anon key>
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

Until this step is done the app runs in its existing offline/demo mode: the UI
works, but no real authentication or location sync occurs.

---

## 2. Apply the RLS policies

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

---

## 3. Run live end-to-end verification

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

## 4. Browser smoke test

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

## CI checks (already passing)

```bash
npm run typecheck   # 0 errors
npm run build       # 0 errors
npm run test:nexora # 22/22 integration checks
npm run test:smoke  # renders cleanly
```
