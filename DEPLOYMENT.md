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

Until this step is done the app remains a read-only shell: no authentication,
booking, payment, or location sync is available. Authentication is never
simulated and a local profile cannot unlock protected features.

The customer app uses a hybrid catalog strategy. It renders the in-repo
catalog immediately as a graceful fallback while Supabase is unavailable or
empty, then atomically replaces it with valid Supabase salon rows. It never
mixes fallback rows into a non-empty real catalog. Set `VITE_NEXORA_DEMO_MODE=true`
only to force the fixture for visual QA; a demo catalog is never a production
source of truth.

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

## 6. Invite (referral) links — what makes `/invite?code=NX-…` work

A shared invite link is four independent systems that must all be right. Each one
has broken in the past, so each is verified separately.

```
https://<your-host>/invite?code=NX-VIJAY634
        │                        └── 4. attribution: the code must resolve to a real referrer
        └── 1. the host must route this path
            2. it must land on SIGNUP, carrying the code
            3. the code must survive to the moment the account is created
```

### Layer 1 — the HTTP layer (`server/inviteRedirects.ts`)

`/invite`, `/invited`, `/join`, `/ref`, `/refer`, `/referral-link`, `/r/:code` and
`/invite/:code` answer with a real **302 → `/customer/signup?ref=<CODE>`**. This
runs before Vite/static handling in `server.ts` *and* in the Vite dev-server
plugin, so `npm run dev`, a preview, and `node dist/server.cjs` behave the same.
A 302 works with JS disabled, for link-unfurlers, and before React boots.

Responses are `Cache-Control: no-store`, so a fixed deploy is visible on the
very next click instead of being pinned by the browser cache.

### Layer 2 — the pre-React capture (`index.html` + `src/lib/inviteBoot.ts`)

If a host serves a stale `index.html`, or the path is reached client-side, the
inline script in `index.html` runs **before the app bundle**: it finds the code in
`?code= / ?ref= / ?rc= …` or in the path segment, stashes it under
`nexora-pending-referral-code` (+ `window.__NEXORA_INVITE__` when storage is
blocked), and rewrites the address bar to `/customer/signup?ref=…`.

That rewrite is also what keeps Supabase out of the way: GoTrue's
`detectSessionInUrl` reads `?code=` as a **PKCE authorization code**. A referral
code sitting there used to be swallowed by the token exchange — the visitor was
bounced to login and the invite was lost. Public links keep `?code=` (that is the
format already circulating); internal URLs use `?ref=`. `cleanAuthParamsFromUrl()`
now refuses to delete a referral-shaped `code` for the same reason.

### Layer 3 — static hosts (`public/_redirects`)

`public/_redirects` ships the same rules for Netlify and Cloudflare Pages (it is
copied into `dist/` by Vite), including the `/* → /index.html 200` SPA fallback.
For **Vercel**, either deploy the Node server (`npm run build && node dist/server.cjs`
— Layer 1 then applies) or add:

```json
{
  "redirects": [
    {
      "source": "/invite",
      "has": [{ "type": "query", "key": "code", "value": "(?<code>[A-Za-z0-9_-]{4,24})" }],
      "destination": "/customer/signup?ref=$code",
      "permanent": false
    },
    { "source": "/invite", "destination": "/customer/signup", "permanent": false },
    { "source": "/r/:code", "destination": "/customer/signup?ref=:code", "permanent": false }
  ],
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### Layer 4 — the share link must point at a real host

`buildInviteLink()` no longer hardcodes a marketing domain. Origin priority:
`VITE_APP_URL` → `APP_URL` → `VERCEL_PROJECT_PRODUCTION_URL` →
`window.location.origin` → `https://nexora.app`. **Set `VITE_APP_URL` to your
public origin and redeploy** — `VITE_*` values are baked in at build time, so an
existing deployment keeps emitting links built from its old origin until it is
rebuilt. A value that is not a URL (e.g. the `MY_APP_URL` placeholder) is ignored
rather than pasted into a share link.

### Layer 5 — cross-device counting (not in this repo's hands)

An invite is opened by a **different person on a different device**, so only the
database can count it. Two things are required:

1. `supabase/migrations/20260910120000_referral_codes_invite_links.sql` — creates
   `profiles.referral_code`, the generator trigger and `resolve_referral_code()`
   (see `SUPABASE_DEPLOY.md`).
2. `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` on the server — `/api/referrals/accept`
   returns **503** without them, which means signups are attributed only inside one
   browser (the local registry) and the referrer's cloud counters never move.

### Verifying it on a real deployment

```bash
npm run verify:invite -- --base https://your-app.vercel.app --code NX-VIJAY634
```

It probes every layer (302 target, code retention, `?code=` → `?ref=`
normalisation, `/api/referrals/resolve` classification) and prints the exact next
action for anything missing. Manual equivalents:

```bash
curl -i "https://<host>/invite?code=NX-VIJAY634"   # expect: 302 → /customer/signup?ref=NX-VIJAY634
curl -i "https://<host>/r/nx-vijay634"             # expect: same 302
curl  "https://<host>/api/referrals/resolve?code=NX-VIJAY634"   # 200 = counted; 404 = code unregistered; 503 = no service-role key
```

Automated coverage: `npm run test:invite-redirect` (HTTP layer + the inline
capture script + `_redirects` + origin rules), `npm run test:invite-referral`
(boot guard, signup prefill, counting), `npm run test:referral` (incl. the
"already signed in, clicked a friend's link" prompt).

---

## CI checks

```bash
npm run typecheck   # 0 errors
npm run build       # 0 errors (with a bundle-size warning)
npm run test:nexora # 22/22 auth + location integration checks
npm run test:catalog # 7/7 hybrid catalog strategy checks
npm run test:smoke  # renders cleanly
npm run test:invite-redirect # 37/37 invite HTTP layer + pre-React capture
npm run test:invite-referral # 66/66 invite link → signup → referral counted
npm run test:referral        # 47/47 Refer & Earn screen (incl. apply-a-friend's-code)
npm run verify:live   # requires real anon key + test user + applied RLS
npm run verify:invite # requires a deployed host; see §6
```

`verify:live` is expected to stop before network checks when its required
credentials are absent; that is an external release blocker, not a passing
production verification.
