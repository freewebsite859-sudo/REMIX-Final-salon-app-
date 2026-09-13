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
| `npm test` | **31/35 suites** (4 failing) | **42/42 suites** |
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
| **A1** | Splash Screen | **MISSING** — no component existed; boot showed a bare `<p>Restoring your secure session…</p>` on a white viewport | ✅ `src/components/SplashScreen.tsx` — branding, boot animation, **and** a crossfade out (BUG 12) |
| **A2** | Login Screen | Present — `auth/AuthPage.tsx` (mode `login`) | unchanged |
| **A3** | Sign Up Screen | Present — `auth/AuthPage.tsx` (mode `signup`) | unchanged |
| **A4** | Forgot Password Screen | Present — `auth/PasswordResetModal.tsx` | unchanged |
| **A5** | Reset Password Screen | Present — `auth/PasswordUpdatePage.tsx` at `/auth/reset` | unchanged |
| **B6** | Home Screen | Present — `HomeTab.tsx` | unchanged |
| **B7** | Services Screen | **MISSING** — no catalog browser; only salon-level search and home category chips | ✅ `src/components/ServicesScreen.tsx` at `/customer/services` **and** `/services` (BUG 13) |
| **B8** | Service Detail Screen | **MISSING** — tapping a service jumped straight into booking; no treatment page existed | ✅ `src/components/ServiceDetailScreen.tsx` at `/customer/service/:id` **and** `/services/:id` (BUG 13) |
| **B9** | Select Appointment Date | Present — `BookingModal` step 3 | unchanged |
| **B10** | Select Time Slot | Present — `BookingModal` step 3 / `ChooseProfessionalScreen` | unchanged |
| **B11** | Customer Details Screen | **PARTIAL** — only a free-text "notes" box; no name/phone/email capture | ✅ `BookingModal` step 5, validated |
| **B12** | Booking Review Screen | Present — `BookingSummaryModal.tsx` | now renders the contact it will send (BUG 7/9) |
| **B13** | Booking Success Screen | Present — `BookingConfirmationPage.tsx` | now shows the booked contact (BUG 10) |
| **B14** | My Appointments Screen | Present — `AppointmentsTab.tsx` | cancellation now reaches the server (BUG 11) |
| **B15** | Appointment Detail Screen | Present — `BookingDetailPage.tsx` | now shows the booked contact (BUG 10); cancel confirms server-side (BUG 11) |
| **B16** | Profile / Account Screen | Present — `ProfileTab.tsx` | unchanged |

**Four gaps closed: A1, B7, B8, B11.**

---

## 3. Bugs found and fixed (16)

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

### BUG 7 (self-inflicted) — Step 5 "Customer Details" collected the contact details, then threw them away

**Severity: high — data loss on every booking.** Introduced by the screen-11 work in this
same session.

`BookingModal.buildDraft()` returned `customer: { name, phone, email }`, but:

- the `onOpenSummary` prop type did **not** declare `customer`, so no consumer could see it
  (`tsc` did not complain — excess-property checks do not apply to non-fresh literals);
- `App.tsx`'s `bookingSummaryDraft` state had no `customer` field;
- `handleServerBooking` assembled the payload from the **stored profile**
  (`user.name`, `session.user.email`, `user.phone`);
- `BookingSummaryModal` contained **zero** references to `customer`.

**Symptom:** anyone booking on someone else's behalf — a common salon case — typed a
relative's name and phone into Step 5, and the salon received the *account holder's* details
instead. The Booking Review screen never displayed the contact, so the substitution was
invisible to the customer.

**Fix (verified end-to-end):** declare `customer` on the `onOpenSummary` draft and on the
draft state; carry it into `BookingSummaryModal`, which now renders a **Contact For This
Appointment** block so it can be verified before payment; make `handleServerBooking` prefer
the typed details and fall back to the profile only when they are absent or whitespace-only
(the account `id` always stays the signed-in user's, so ownership and payment are
unaffected); and seed the modal from the confirmed details when the customer backs out via
"Change date/time", so editing the date no longer silently resets the contact.

Covered by `test:customer-details-flow` (21 checks).

### BUG 8 — Services Screen marked a service as saved at *every* salon sharing its id

`ServicesScreen` computed `isSaved` from a **flat list of service ids**
(`savedServices.map((s) => s.serviceId)`), but a favourite is a `(salonId, serviceId)` pair
(`SavedServiceRef`) and, as `customerServicePath` documents, **service ids are only unique
within a salon** in this catalog. Saving "Precision Cut" at one salon therefore rendered
every same-id treatment at every other salon as saved.

`SalonDetailModal` and `ServiceDetailScreen` already filtered by `salonId`; only the new
Services Screen got this wrong.

**Fix:** the screen now takes `savedServiceRefs: SavedServiceRef[]` and matches on a
`salonId:serviceId` key. The regression check in `test:services-flow` builds two salons that
deliberately reuse the id `svc-cut` and asserts only the saved one shows a filled heart —
confirmed to **fail** against the old flat-id comparison (`savedAtClash=true`) and to pass
after the fix.

### BUG 9 — The "Choose Professional" booking path never showed the contact

`ChooseProfessionalScreen`'s `onContinueBooking` wrote `bookingSummaryDraft` with no
`customer` field and opened `BookingSummaryModal` directly, bypassing `BookingModal`
step 5. So this entire booking entry point reached the review screen with
`customer` undefined, the contact block rendered nothing, and the salon's contact was
invisible — inconsistent with the modal path fixed in BUG 7.

**Fix:** that path now seeds `customer` from the stored profile using the same resolution
order as `handleServerBooking`, so what the review screen displays is what gets sent. The
catalog-rebind effect spreads `...current`, so the field survives a remote catalog refresh.
Covered by `test:customer-details-flow` (21 checks).

### BUG 10 — The booked contact survived the write and was dropped on read-back

Downstream of BUG 7. `buildBookingRows` persists `bookings.customer` correctly, but
`bookingToAppointment` — the single mapper that reconstructs the `Appointment` returned to
the client — never read it, and `Appointment` had no field to hold it. So the Step 5 contact
reached the database and then vanished from the client record: **screen 13 (Booking Success)**
and **screen 15 (Appointment Detail)** had no way to show who the salon would contact, which
matters most for the book-for-someone-else case BUG 7 was about.

**Fix:** added `Appointment.contact`; `bookingToAppointment` now echoes the persisted
snapshot back (omitting the field entirely when nothing was recorded, so no empty object
appears). Screen 13 renders a **Contact on booking** row via a new `formatBookingContact`
helper; screen 15 renders a `#booking-detail-contact` block. The round trip is covered by
`test:customer-details-flow` running the real `createBooking` against the in-memory store
(21 checks) — asserting the typed name/phone/email come back, and that a booking with no
customer snapshot gains no `contact` field.

### BUG 11 — Cancelling a booking never reached the server

**Severity: high.** `handleCancelAppointment` did this and nothing else:

```ts
setAppointments(appointments.map((a) => (a.id === id ? { ...a, status: 'cancelled' } : a)));
```

There was no cancel route anywhere — `server/bookings.ts` registered exactly one route,
`router.post('/')`. So cancelling was a client-side illusion:

- the salon still saw an **active** booking;
- `findActiveSlot` kept counting the row as occupied, so **the slot stayed locked** and
  nobody else could book it;
- reloading restored the appointment as if nothing had happened;
- `BookingDetailPage`'s `onCancel` navigated away to the list immediately, so the user got
  no signal that anything had failed.

**Fix:**
- `BookingStore.cancelBooking(bookingId, ownerUserId)` — the owner match is part of the store
  contract, not a route post-filter, so an id guess cannot reach another customer's row.
  Implemented for the memory and Supabase stores (`found:false` when nothing matches BOTH id
  and owner).
- `POST /api/bookings/:id/cancel` — identity derived **only** from the verified access token,
  following the account-deletion pattern. 503 `configured:false` when unconfigured (never a
  fake success), 401 for a missing/invalid token, 501 if the store cannot cancel, 500 with
  "still active" on a store failure, and 404 that is deliberately identical for "not yours"
  and "does not exist" so the endpoint cannot enumerate booking ids.
- `src/lib/bookingCancellation.ts` — mirrors `accountDeletion.ts`: never throws, refuses the
  network with a null token, and maps 401/404/503/HTML-502/thrown-fetch/200-without-`success`
  to distinct reasons.
- `handleCancelAppointment` is now async and only flips local state after the server confirms;
  the detail screen only navigates away on success, and a refusal surfaces in a
  `role="alert"` banner on My Bookings instead of silently leaving a booking that looks
  cancelled.

Covered by `test:booking-cancellation` (28 checks), including the two that matter most: a
different user cannot cancel someone's booking, and cancelling actually **releases the slot**
— the concrete harm the old code caused. Verified live against the production build:
`POST /api/bookings/bk-1/cancel` → `503 {configured:false}`.

### BUG 12 — The splash faded in but vanished on a single frame

`SplashScreen` had a 600 ms entrance animation (`nexora-splash-in`) and a
`minimumMs` hold, but `App.tsx` mounted it through an **early return**, so the moment
`isBooting` flipped false the component unmounted and the splash disappeared mid-frame.
The result was an entrance that never finished and no exit at all.

**Fix:** the splash stays mounted for `SPLASH_EXIT_MS` with `exiting` set, swapping the
entrance keyframes for `nexora-splash-out` so the handoff into login/home is a crossfade.
`SPLASH_MINIMUM_MS` (900 ms) is honoured from the moment the splash first appears, so the
entrance always completes — without it a fast session restore cut the 600 ms animation off
at ~240 ms, which reads as a rendering glitch. `prefers-reduced-motion` skips both the hold
and the animation.

Two suites asserted app content at a hardcoded 600 ms and therefore raced the new
transition; both now poll until the splash unmounts instead of sleeping a magic number.

Verified in the real `App` shell (`test:app-services-routing`, 13 checks): splash present at
mount → still present mid-hold → `exiting=true` → unmounted, with app content rendered
afterwards.

### BUG 13 — `/services` and `/services/:id` were not routes

The Services and Service Detail screens existed but were only reachable at
`/customer/services` and `/customer/service/:id`. The bare `/services` spellings returned
`{ kind: 'unknown' }` from `parseCustomerRoute` — and, worse, `isCustomerPath('/services')`
is `false`, so `App.tsx`'s route gate bounced them to home **before** the parse result was
ever consulted. The server returned 200 for them only because the SPA fallback serves
`index.html` for every path.

**Fix:** both spellings now parse to the same `services` / `service` kinds, and
`canonicalizeServicesAlias` rewrites the alias to its canonical `/customer` form inside
`syncFromLocation` so the gate recognises it and the address bar settles on one URL.
Rewriting is idempotent — applying it to its own output returns `null` — so there is no
redirect loop (asserted in test).

### BUG 14 — Unguarded `<img src>` re-requested the whole page

`BookingSummaryModal` rendered `src={salon.image}` and `src={stylist.avatar}`, and
`BookingModal` rendered `src={stylist.avatar}`, with no guard. Catalog rows frequently
carry no image, so an empty `src=""` reached the DOM — which makes the browser re-request
the **current page** over the network. That is a wasted request per image plus a visible
flash, and it surfaced as a console warning during the booking-flow tests.

The rest of the codebase already guards these (`BookingConfirmationPage`,
`BookingDetailPage`, `ServiceDetailScreen`), so this was an inconsistency rather than a
missing convention.

**Fix:** all three now fall back to a sized icon placeholder, matching the existing pattern.
Covered by a regression check in `test:customer-details-flow` asserting zero empty-`src`
images when the salon has no image (23 checks).

### BUG 14 (continued) — the same unguarded `<img src>` existed across nine customer screens

After fixing the three in the booking flow, I swept the whole `src/` tree for the same
pattern rather than assuming it was isolated. Nine more customer-facing images had no guard
and no `||` fallback, so any catalog row or profile without an image emitted `src=""`:

`HomeTab` (×2), `SearchTab`, `SavedTab`, `AppointmentsTab`, `MembershipPage`,
`ChooseProfessionalScreen`, `SalonDetailModal` (reviewer avatar, staff avatar).

All now fall back to a sized icon placeholder. The remaining unguarded `<img>` tags are in
**salon-owner** surfaces (`SalonWebsitePreview`, `SidePanelCustomizer`,
`SocialConnectivityStep`, `OffersManagement`, reels modals, `AILogoSuiteModal`,
`ImageCompressorWidget`, `QrEngagementCard`) — outside the 16 customer screens in scope
here, and left deliberately. `ProfileTab`'s avatar picker is safe: its `url` values are
hardcoded non-empty Unsplash constants, verified.

### BUG 15 — One booking's contact leaked into the next booking

Introduced by my own BUG 7 fix. `bookingCustomerDetails` exists for exactly one purpose: to
survive the review screen's **"Change date/time"** re-entry so editing the date does not
reset the contact. But nothing ever cleared it — the state had only three occurrences in the
whole file: declaration, prefill, and the one `set` in `onChangeDateTime`.

**Symptom:** enter a contact for one appointment, take "Change date/time", then abandon that
booking. Every *subsequent* booking prefilled the previous appointment's name and phone
instead of the signed-in profile. Because those values validate, the booking could be
submitted unnoticed — sending the salon the wrong person's phone number.

**Fix:** cleared at both entry points that open the booking modal —
`handleOpenBooking` and the `/customer/book/:salonId` deep-link handler in `syncFromLocation`.
The deep-link path was easy to miss: it opens the modal *without* going through
`handleOpenBooking`, so fixing only the handler would have left the leak reachable by URL.

**Note on the test.** My first regression test **passed against the buggy code**. It clicked
"Back" to dismiss the review screen, which never sets the override, so it never exercised the
leak. It only became a real test once it clicked `#change-datetime-btn` — the one code path
that sets the state. Verified: the corrected test **fails** against the old code
(`name="Grandma Sharma"` leaking into booking #2) and passes after the fix.

Covered by `test:booking-contact-leak` (10 checks), which drives the real `App` shell with a
real demo session, because the defect lives in `App.tsx` state management rather than in any
single component.

### BUG 16 — Reel videos had no recovery path when a stream failed

**Symptom.** On a slow connection, a dead CDN URL, or a browser that refuses
autoplay, the salon reel surfaces showed a black rectangle with no controls.
The user had no way to tell "loading" from "broken", and no way to force
playback.

**Cause.** Four separate surfaces each implemented video playback by hand, and
each drifted:

| Surface | State before |
|---|---|
| `VideoReelsSection.tsx` | `autoPlay`/`loop`/`muted`, but a single hard-coded `src`; first failure was terminal |
| `SalonVideoReelsModal.tsx` | flipped one `videoError` flag on the first failure and gave up |
| `SalonStoriesReelFeed.tsx` | hover video with **no ref, no `onError`, no manual control** |
| `SalonDetailModal.tsx` | renders **no `<video>` at all** — its Videos tab is a thumbnail grid that delegates to `SalonVideoReelsModal` (`grep -c "<video"` → **0**) |

None of them registered a gesture-unlock listener, so a blocked autoplay stayed
blocked even after the user clicked.

**Fix.** Extracted `src/hooks/useReelVideo.tsx` — one controller, four call
sites:

1. **Source ladder.** `nextPlayableSource()` serves the reel's own URL, then
   each entry in `FALLBACK_VIDEO_SOURCES`, then `null`. A failed stream steps
   down instead of dying; the ladder resets when the reel changes.
2. **Animated poster fallback.** Once every source has genuinely failed,
   `ReelPosterFallback` shows the reel thumbnail with a slow Ken Burns drift, an
   explanation, and a "Try again" button that restarts the ladder. Opt-outs for
   `prefers-reduced-motion`.
3. **Global gesture unlock.** `installGestureAutoplayUnlock()` is called once in
   `main.tsx`. The first `pointerdown`/`touchstart`/`keydown` releases every
   video whose autoplay was refused. Singleton and idempotent — one listener for
   the whole page, not one per card.
4. **Always-visible play/pause toggle.** `ReelPlayToggle` renders regardless of
   playback state. Previously the card controls only appeared once `isPlaying`
   was true, so a blocked autoplay was a dead end with no affordance.

`SalonStoriesReelFeed`'s card was extracted from its `.map()` body into
`StoryReelCard` — hooks cannot run inside a render callback.

**Note on the fallback URLs.** This environment has **no outbound network
access** (`curl` returns `000` / `SSL_ERROR_SYSCALL` for `example.com`,
`google.com`, and both Mixkit URLs), so **the fallback MP4 list could not be
verified**. It is documented in-source as a starting point to confirm against a
real browser. The animated poster fallback is the part that is actually
guaranteed — it is generated locally from the reel's own thumbnail and needs no
network.

**Verified.** `test:media-playback` (60 checks) covers the ladder, the poster
fallback, the gesture unlock, the toggle, and a source scan asserting every
surface carries `muted`/`playsInline`/`autoPlay`/`loop`/`onError` and no
unguarded `.play()`. Negative controls: disabling the ladder →
**58/60** (fails on the step-down checks); disabling the gesture unlock →
**55/60** (fails on all five gesture checks).

**Also note.** One test assertion was itself wrong before it was right: it
checked `video.hasAttribute('muted')`. React sets `muted` as a DOM *property*
and never emits the attribute, so that assertion fails against correctly-muted
React video. It now checks `.muted`.

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

### Shared reel playback controller (`src/hooks/useReelVideo.tsx`)

One controller behind all four reel surfaces, extracted because each had
re-implemented playback separately and drifted (see BUG 16). Exports:

- `useReelVideo({ videoUrl, posterUrl, wantPlaying, muted, fallbackSources? })`
  → `{ videoRef, activeSrc, exhausted, isPlaying, hasDecoded, togglePlay,
  userOverride, clearUserOverride, resetLadder, onVideoError, onVideoPlaying,
  onPause, onLoadedData }`. Components own their *intent* (hover, viewport
  visibility, active modal index); the hook turns intent into safe DOM calls.
- `ReelPosterFallback` — animated thumbnail shown once every source has failed.
- `ReelPlayToggle` — always-rendered play/pause affordance.

Supporting additions in `src/lib/mediaPlayback.ts`: `FALLBACK_VIDEO_SOURCES`,
`nextPlayableSource()`, `installGestureAutoplayUnlock()`,
`hasUserInteracted()`, `requestAutoplayOnGesture()`. The global unlock is
installed once from `src/main.tsx`.

Must be a **`.tsx`** file — the hook module exports JSX components, and a `.ts`
extension fails with `TS1005`/`TS1109`.

### 4.1 Code-splitting the critical path

The bundle had grown to 1,380 kB (360 kB gzip), partly from the new screens.
Two changes moved weight off the first paint — both verified by re-running
`npm run build` and reading the emitted chunk list:

| | Before | After |
|---|---|---|
| Main `index` chunk | 1,380.29 kB (360.52 kB gzip) | **1,245.45 kB (334.71 kB gzip)** |
| `d3-vendor` preloaded on first paint | yes (64.04 kB) | **no** |

- **`PaymentOverviewDashboard` is now `React.lazy`.** It pulls in d3 (~64 kB)
  purely to draw two charts that sit well below the fold on Profile. It now
  splits into its own 24.28 kB chunk and `d3-vendor` is gone from
  `index.html`'s preload list, so no other screen pays for it.
- **Five route-gated screens are `React.lazy`:** `MembershipPage`,
  `SettingsPage`, `ReferralPage`, `ReviewsPage`, `NotificationsPage`. None
  render on first paint — each belongs to one `/customer/*` route the user
  navigates to — so they split into 11–33 kB chunks behind a single Suspense
  boundary that keeps the header and bottom nav interactive while a chunk is in
  flight.

Home, Search, Bookings, Rewards and Profile stay eager: they are the bottom-nav
tabs, so splitting them would trade a measurable win for a visible delay on the
app's primary surfaces.

### B16 — Account deletion (`server/userAccount.ts`, `src/lib/accountDeletion.ts`)

Profile / Account (screen 16) offered "Delete Account" with a type-`DELETE`
confirmation, but `handleDeleteAccount` in `App.tsx` was a stub that logged a
warning and returned `false`. The user typed DELETE, pressed confirm, and got
"Account deletion failed. Please try again." — a message that implies a
transient failure when in fact no deletion service existed at all. This was the
compliance blocker `RELEASE_AUDIT.md` tracked as B4.

Now implemented:

- `POST /api/user/delete` verifies the caller's **own** access token with
  `auth.getUser()` and deletes exactly that account with
  `auth.admin.deleteUser()`, using the service-role key held server-side.
- **Identity comes only from the verified token.** A `userId` in the request
  body is ignored, so a caller cannot target someone else's account. There is a
  test for exactly this.
- Failure modes are honest: 401 (missing/expired token), 500 (upstream failure,
  body states "No data was deleted"), 503 with `configured:false` when
  `SUPABASE_SERVICE_ROLE_KEY` is absent. None of them implies success.
- `requestAccountDeletion()` never throws — every failure resolves to a
  `{ success: false, reason }` outcome, so a caller cannot mistake a thrown
  error for a completed deletion. A 200 that does not carry `success:true`, and
  a non-JSON proxy error page, are both treated as failures.
- `App.tsx` clears local caches and signs out **only** after the endpoint
  confirms deletion.

Verified live with `curl` against `npm run dev`: no token and a bogus token both
return `503 {configured:false}` on this deployment (service-role key unset), and
`/api/health` returns 200.

---

## 5. Test coverage added

| Suite | Checks | Covers |
|---|---|---|
| `test:services-flow` (new) | 44 | catalog flattening, both new screens, splash incl. crossfade |
| `test:booking-contact-leak` (new) | 10 | a booking's contact cannot leak into the next booking |
| `test:media-playback` (new) | 60 | source ladder, poster fallback, gesture unlock, play toggle, per-surface attribute scan |
| `test:booking-cancellation` (new) | 28 | cancel router, owner scoping, slot release, browser client |
| `test:customer-details-flow` (new) | 23 | Step 5 details survive the handoff, appear on the review screen, and reach the booking payload instead of the stored profile |
| `test:app-services-routing` (new) | 13 | the **real App shell** reaching both routes via both spellings |
| `test:account-deletion` (new) | 21 | deletion router + browser client |
| `test:customer-routes` | +30 | the two new routes, encoding round trips, the `/services` aliases |
| `test:booking-modal` | +8 | the Customer Details gate |

`test:app-services-routing` exists because the component tests render the new
screens in isolation and would have passed even with the `App.tsx` wiring
broken — which is exactly what caught BUG 6.

**Test coverage: 35 suites → 42 suites** (31 passing at baseline, 42 passing now).

---

## 6. Still open

These are unchanged by this work and were **not** verified here:

- **Live Supabase credentials.** `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
  are unset, so every suite stubs Supabase. No end-to-end run against a real
  project has happened — signup, email confirmation, login, refresh, booking,
  payment and cross-tenant denial remain unexercised against live infrastructure.
- **Account deletion is implemented but has never run against a live project.**
  `POST /api/user/delete` verifies the caller's own access token and deletes
  exactly that account server-side; `SUPABASE_SERVICE_ROLE_KEY` is unset here,
  so on this deployment it answers an honest `503 {configured:false}`. Verified
  live with `curl`. The success path is covered only against an injected store.
- **Four client-called API endpoints do not exist.** Verified against a running
  `npm run dev` server on 2026-09-13 — all return **HTTP 404**:
  `/api/generate-bio`, `/api/generate-promo-image`, `/api/youtube/fetch-videos`,
  `/api/fetch-youtube-meta`. (`/api/health` returns 200, so the API surface
  itself is mounted.) Every caller degrades rather than crashing —
  `AIBioModal` falls back to a local generator, `youtubeMetadata` returns its
  fallback on `!response.ok`, `OffersManagement` and `SocialConnectivityStep`
  catch and show a message — so this is degraded functionality, not a blank
  screen. All four live in **salon-owner** surfaces, outside the 16 customer
  screens in scope here.

  > **Correction.** The previous revision of this section repeated
  > `RELEASE_AUDIT.md`'s claim that `server.ts` requests invalid Gemini model
  > names (`gemini-3.6-flash`, `gemini-3.7-flash`) at "lines 114, 164, 289,
  > 381". **That claim is false against this tree.** `server.ts` is 39 lines
  > long and contains no model reference; a repo-wide grep for `gemini` matches
  > only prose in `RELEASE_AUDIT.md` and this file. I copied it without
  > checking. The real defect is the missing routes above.
- **SQL never applied** to a live database (`supabase/policies/*`).
- **Browser bundle is still 1,248.98 kB** (335.47 kB gzip) after code-splitting
  and the BUG 7–10 fixes — down from 1,380.29 kB (360.52 kB gzip), but still
  above the 795 kB recorded before this work. See §4.1 for what was split and
  what remains.
- The **Services Screen is not in the bottom nav.** It is reachable from the
  Search tab and by URL. Adding a fifth nav item is a product decision, not a
  bug, so it was left alone.

---

## 7. Commands

```bash
npm install --no-audit --no-fund   # node_modules is not persisted
npx tsc --noEmit                   # typecheck
npm test                           # 42 suites
npm run build                      # vite build + esbuild server
npm run test:services-flow         # new screens (38 checks)
npm run test:customer-details-flow # screen 11 -> 12 -> 13/15 round trip (23 checks)
npm run test:booking-cancellation  # cancel route + client (28 checks)
npm run test:booking-contact-leak  # contact cannot leak across bookings (10 checks)
npm run test:app-services-routing  # App-shell routing (7 checks)
npm run test:media-playback        # reel video fallback + autoplay (60 checks)
```
