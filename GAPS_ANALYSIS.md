# Nexora SalonOS — Customer App Gaps Analysis & Fix Report

**Date:** 2026-09-13 (UTC)
**Branch:** `arena/01a09995-remix-final-salon-app`
**Scope:** the 16 screens of the Authentication + Customer App specification, end to end.

This report covers three things, in order:

1. **Screen-by-screen gap analysis** — what existed, what was missing.
2. **Bugs found and fixed** — with the evidence that they were real.
3. **What is still open** — honestly, including what I could not verify here.

---

## 1. Verification baseline

Everything below was run against this working tree.

| Command | Before | After |
|---|---|---|
| `npx tsc --noEmit` | clean | clean |
| `npm test` | **31/35 suites** (4 failing) | **37/37 suites** |
| `npm run build` | ✓ | ✓ |

`node_modules` is not persisted in this workspace — run
`npm install --no-audit --no-fund` before any of the above.

### The four suites that were failing

`RELEASE_AUDIT.md` claimed `test:catalog 7/7` and `test:smoke PASS`. **Those claims
were false against this tree.** The actual starting state was:

| Suite | Was | Root cause |
|---|---|---|
| `test:catalog` | `ERR_UNKNOWN_FILE_EXTENSION` (never ran) | npm script missing the asset loader |
| `test:salon-search` | `ERR_UNKNOWN_FILE_EXTENSION` (never ran) | npm script missing the asset loader |
| `test:search-location` | 99/100 | search ranking bug |
| `test:smoke` | FAIL | unguarded media calls |

Two of those four were **silently not running at all**. A suite that dies on
module load still exits non-zero, but it reports nothing about the code it was
meant to cover — so the catalog and search logic had no coverage in practice.

---

## 2. Screen-by-screen gap analysis

| # | Screen | Status at start | Now |
|---|---|---|---|
| **A1** | Splash Screen | **MISSING** — no component existed; boot showed a bare `<p>Restoring your secure session…</p>` on a white viewport | ✅ `src/components/SplashScreen.tsx` |
| **A2** | Login Screen | Present — `auth/AuthPage.tsx` (mode `login`) | unchanged |
| **A3** | Sign Up Screen | Present — `auth/AuthPage.tsx` (mode `signup`) | unchanged |
| **A4** | Forgot Password Screen | Present — `auth/PasswordResetModal.tsx` | unchanged |
| **A5** | Reset Password Screen | Present — `auth/PasswordUpdatePage.tsx` at `/auth/reset` | unchanged |
| **B6** | Home Screen | Present — `HomeTab.tsx` | unchanged |
| **B7** | Services Screen | **MISSING** — no catalog browser; only salon-level search and home category chips | ✅ `src/components/ServicesScreen.tsx` at `/customer/services` |
| **B8** | Service Detail Screen | **MISSING** — tapping a service jumped straight into booking; no treatment page existed | ✅ `src/components/ServiceDetailScreen.tsx` at `/customer/service/:id` |
| **B9** | Select Appointment Date | Present — `BookingModal` step 3 | unchanged |
| **B10** | Select Time Slot | Present — `BookingModal` step 3 / `ChooseProfessionalScreen` | unchanged |
| **B11** | Customer Details Screen | **PARTIAL** — only a free-text "notes" box; no name/phone/email capture | ✅ `BookingModal` step 5, validated |
| **B12** | Booking Review Screen | Present — `BookingSummaryModal.tsx` | now receives the customer details |
| **B13** | Booking Success Screen | Present — `BookingConfirmationPage.tsx` | unchanged |
| **B14** | My Appointments Screen | Present — `AppointmentsTab.tsx` | unchanged |
| **B15** | Appointment Detail Screen | Present — `BookingDetailPage.tsx` | unchanged |
| **B16** | Profile / Account Screen | Present — `ProfileTab.tsx` | unchanged |

**Four gaps closed: A1, B7, B8, B11.**

---

## 3. Bugs found and fixed

### BUG 1 — Catalog: demo salons leaked into live remote results (data integrity)

`fetchCatalog()` returned `source: 'remote'` but built its list with
`mergeTemplateSalons(normalized)`, which **appended every seeded demo salon**
whose id was not already present.

The consequence: the moment a real Supabase catalog connected, the customer saw
the real salons *plus* the entire in-repo demo catalog — and could attempt to
book a salon that does not exist upstream. This directly contradicted the
function's own docstring ("falling back without ever mixing fake rows into real
rows") and `useCatalog`'s ("child-table failures never append fake children to
real salons").

**Fix** (`src/lib/catalogService.ts`): split the function in two.
`sanitizeRemoteSalons()` keeps the genuinely useful part (per-id dedupe,
service/stylist normalization, video-preview resolution) with **no** template
injection, and `fetchCatalog` now uses it. `mergeTemplateSalons()` remains for
demo/diagnostic paths only.

**Evidence:** `test:catalog` went **6/9 → 9/9**. The three checks that now pass
are exactly the mixing invariants:
`non-empty valid remote catalog replaces fallback`,
`remote catalog contains no fallback salon rows`,
`child-table failure never mixes fallback children into remote salons`.

### BUG 2 — Search: corrected results outranked exact matches

`relevanceScore()` applied a −6 penalty to fuzzy (typo-corrected) hits, with a
comment asserting "an exact match can never be pushed under a corrected one".
But the penalty only affects the `default` (relevance) ordering. The default
sort is `'nearest'`, and **every** explicit mode (`nearest`, `top_rated`,
`lowest_price`, `most_popular`, `available_today`) sorts by distance / rating /
price / popularity and ignored the penalty entirely.

Searching `BARBAR SHOP` returned a fuzzy hit at index 1 above an exact hit at
index 3 — the customer's literal match was buried below a guess.

**Fix** (`src/lib/salonSearch.ts`): an `exactMatchesFirst()` comparator wrapper
partitions results before applying the chosen mode's ordering, so each mode
still orders correctly *within* the exact group and *within* the fuzzy group.

**Evidence:** `test:search-location` went **99/100 → 100/100**; the failing
check now reads `firstFuzzy=2 lastExact=1`.

### BUG 3 — Unguarded media calls took the app down

`VideoReelsSection.tsx` and `SalonVideoReelsModal.tsx` called `video.play()`,
`video.pause()` and `video.currentTime = …` directly. `test:smoke` failed
because of it.

**Correction to an earlier claim of mine:** I first described this as "the app
crashes and fails to mount." That was wrong. The rendered DOM was 386,627
characters — the app *did* mount. What actually happens is that jsdom reports
`HTMLMediaElement.prototype.pause` as *not implemented* through `console.error`,
and `test:smoke` asserts zero console errors. I verified this with a direct
probe: in jsdom, `pause()` does not throw, `play()` returns `undefined`, and
`currentTime = 0` / `muted = true` succeed silently.

It is still a genuine product bug, just a different one: the reel feed was
attempting playback on elements that report they cannot decode any format we
serve. `canPlayType('video/mp4')` returns `''` in that case — a real-world
signal (Android WebView without H.264, data-saver browsers), not a test
artefact.

**Fix** (new `src/lib/mediaPlayback.ts`): `safePlay`, `safePause`, `safeSeek`,
`safeSetMuted`, gated on a `canPlayAny()` capability check. A reel that cannot
play now stays on its poster frame instead of firing errors. All direct media
calls were routed through it — `grep` for `.play()|.pause()|.currentTime =` now
matches only `mediaPlayback.ts` itself.

**Evidence:** `test:smoke` went **FAIL → PASS**, reporting `no console errors`.

### BUG 4 — Two suites were not running at all

`test:catalog` and `test:salon-search` import `src/data/demoCatalog`, which
imports `.jpg` assets. Their npm scripts ran bare `tsx` without
`--import ./test/asset-loader-register.mjs`, so both died at module load.

**Fix:** added the loader to both scripts. `test:catalog` then surfaced BUG 1
(it had been masking it); `test:salon-search` passed 47/47.

### BUG 5 — `parseCustomerRoute` could not parse its own output

`customerServicePath()` appends `?salon=…`, but `parseCustomerRoute()` treated a
`?` in the path argument as part of the last path segment, yielding
`serviceId === 'svc-1?salon=salon-9'`. Since `App.tsx` builds these paths and
re-parses them, this would have broken service-detail deep links.

**Fix:** the parser now splits an inline query string out of the path argument
(an explicit `search` argument still wins).

**Evidence:** `test:customer-routes` **42/42 → 58/58**, including
`service ids with spaces and slashes survive a round trip`.

### BUG 6 (self-inflicted, caught before shipping) — splash blocked the whole app

My first version of the splash gated on `catalog.isLoading`. The new
`test:app-services-routing` integration test caught it: the app rendered
*only* `Loading salons near you…` and never reached any screen.

`useCatalog` seeds `salons` with `DEMO_SALONS` synchronously, so there was never
a reason to block — and with a slow or unreachable Supabase the customer would
have been stuck on the splash indefinitely. This was a real regression, worse
than the state it replaced.

**Fix:** the splash now covers only the session restore, which is the one
moment there is genuinely nothing to render.

---

## 4. What was added

### A1 — Splash Screen (`src/components/SplashScreen.tsx`)

Branded boot screen using the existing `NexoraLogo`. Shown only during session
restore. `role="status"` + `aria-live="polite"` so a screen reader hears the
phase; determinate `progressbar` (the hold is a known duration, so an
indeterminate spinner would be dishonest); animation suppressed under
`prefers-reduced-motion`.

### B7 — Services Screen (`src/components/ServicesScreen.tsx`)

`/customer/services` (public — browsable while signed out). Flattens every
salon's services into one list grouped by category, with category chips, price
caps, a popular-only filter, free-text search, and a real empty state. Cheapest
first within a group. Entry point added to the Search tab
(`#browse-all-services`).

### B8 — Service Detail Screen (`src/components/ServiceDetailScreen.tsx`)

`/customer/service/:serviceId?salon=:salonId`. The `?salon=` hint
disambiguates service ids that repeat across salons. Shows description, price
(and struck-through list price when discounted), duration, the 25% advance, the
offering salon, capable professionals, and same-named treatments at other
salons for comparison. Unknown ids render a not-found state, never a crash.

### B11 — Customer Details step (`BookingModal` step 5)

Name, contact number and optional email, prefilled from the signed-in
profile. Both the "Review Full Appointment Summary" button and form submit are
gated on validation — a salon must not receive an appointment it cannot contact
the customer about. The details travel on the draft into the review screen.

**Note on an existing test:** `test:booking-modal` had a check that advanced to
review with no contact details. That asserted the old behaviour, so it was
updated to supply a customer (as a signed-in user would), preserving its actual
intent — that the draft carries every selected service. Eight new checks cover
the gate itself.

---

## 5. Test coverage added

| Suite | Checks | Covers |
|---|---|---|
| `test:services-flow` (new) | 36 | catalog flattening, both new screens, splash |
| `test:app-services-routing` (new) | 7 | the **real App shell** reaching both routes |
| `test:customer-routes` | +16 | the two new routes, encoding round trips |
| `test:booking-modal` | +8 | the Customer Details gate |

`test:app-services-routing` exists because the component tests render the new
screens in isolation and would have passed even with the `App.tsx` wiring
broken — which is exactly what caught BUG 6.

---

## 6. Still open

These are unchanged by this work and were **not** verified here:

- **Live Supabase credentials.** `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
  are unset, so every suite stubs Supabase. No end-to-end run against a real
  project has happened — signup, email confirmation, login, refresh, booking,
  payment and cross-tenant denial remain unexercised against live infrastructure.
- **Account deletion** (`handleDeleteAccount` in `App.tsx`) still deliberately
  returns `false` rather than pretending. Needs a trusted service_role endpoint.
  Compliance blocker.
- **Invalid Gemini model names** in `server.ts` (`gemini-3.6-flash`,
  `gemini-3.7-flash`) — every AI endpoint will fail until these are replaced.
- **SQL never applied** to a live database (`supabase/policies/*`).
- **Browser bundle is 1,379 kB** (360 kB gzip) — larger than the 795 kB
  previously recorded, partly because of the new screens. Worth code-splitting.
- The **Services Screen is not in the bottom nav.** It is reachable from the
  Search tab and by URL. Adding a fifth nav item is a product decision, not a
  bug, so it was left alone.

---

## 7. Commands

```bash
npm install --no-audit --no-fund   # node_modules is not persisted
npx tsc --noEmit                   # typecheck
npm test                           # 37 suites
npm run build                      # vite build + esbuild server
npm run test:services-flow         # new screens (36 checks)
npm run test:app-services-routing  # App-shell routing (7 checks)
```
