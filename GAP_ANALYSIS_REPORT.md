# REMIX Final Salon App — Comprehensive Gap Analysis
**Repo:** https://github.com/freewebsite859-sudo/REMIX-Final-salon-app-.git  
**Branch:** arena/01a04bd6-remix-final-salon-app  
**Date:** 2026-08-29  
**App Name:** Nexora SalonOS (Remix Nexora SalonOS)

> This report was generated from a full static audit of `server.ts`, `src/lib/*`, `src/hooks/*`, `src/providers/*`, `src/components/*`, `supabase/policies/*`, `package.json`, `.env.example`, `DEPLOYMENT.md`, `FINAL_RELEASE_AUDIT.md`, and test harnesses. No live Supabase credentials were used.

---

## 1. Supabase Database Tables, Schema Mismatches & Unapplied Migrations

### 1.1 Existing Migration State
- **Only one policy file exists:** `supabase/policies/user_locations.sql`
  - Creates `public.user_locations` (`user_id uuid PK FK auth.users`, `latitude`, `longitude`, `accuracy`, `heading`, `speed`, `updated_at`)
  - Enables RLS and creates 4 policies (`select/insert/update/delete` where `auth.uid() = user_id`)
  - Adds latitude/longitude check constraints and index on `updated_at`
  - **Idempotent** (`if not exists`, `drop policy if exists`) — safe to re-run.
- **No `supabase/migrations/` folder, no `config.toml`, no `supabase seed`.** CI cannot auto-apply; manual `psql` or Dashboard SQL Editor required.
- `verify-live.mjs` expects this table and will fail with `42P01 undefined_table` or `PGRST205` if not applied.

### 1.2 Missing Canonical Tables (referenced by code but no DDL)

#### Catalog (used by `catalogService.ts` + `useCatalog.ts`)
Expected table names (overridable via `VITE_NEXORA_*_TABLE`):
- `salons` (default `salons`)
  - Required columns inferred from normalizer: `id`, `name`, `tagline|description`, `latitude`, `lat`, `longitude`, `lng`, `address`, `area`, `city`, `maps_url`, `image`, `gallery`, `is_open`, `opening_hours`, `price_range`, `rating`, `review_count`, `featured`, `trending`, `amenities`, `discount_offer`, `phone`, `gender`
  - Optional embedded JSON: `services`, `professionals|stylists`, `reviews`, `photo_gallery`, `location`
- `services` (`services`)
  - `id`, `salon_id|business_id`, `name`, `category|category_slug`, `duration|duration_minutes`, `price|amount`, `discount_price`, `description`, `popular`
- `categories` (`categories`)
  - `id`, `salon_id`, `name|label|slug`
- `professionals` (`professionals`)
  - `id`, `salon_id`, `name`, `role|title`, `avatar|avatar_url`, `rating`, `experience`, `specialty|specialties`

**Gap:** No migration creates these tables. The app falls back to `DEMO_SALONS` from `src/data/demoCatalog.ts` (hard-coded Jaipur salons with Unsplash images). In production this fallback is explicitly disallowed by `DEPLOYMENT.md`.

#### Appointments / Bookings
- `src/types.ts` defines `Appointment` with `salonId`, `services[]`, `stylist`, `date` (YYYY-MM-DD), `time` (h:mm AM/PM), `status`, `totalPrice`, `bookingRef`, `salonLatitude`, `salonLongitude`, `mapsUrl`, `salonPhone`
- `src/App.tsx` stores appointments **only in localStorage** scoped by `userId` (`nexora-appointments:<uid>`). No Supabase table.
- `BookingModal` and `BookingSummaryModal` both contain comments: *"Every booking must go through server-side payment contract. Old direct-confirm path removed."* but `onPayDeposit` prop is **optional and never passed** from `App.tsx`. Result: UI shows *"Online booking is temporarily unavailable because the secure payment and booking service is not configured. No appointment was created."*
- **Missing:** `appointments` or `bookings` table, `booking_services` join, `availability` / `holds` table, idempotency key.

#### User Profiles & Preferences
- `UserProfile` has 30+ fields: `name`, `email`, `phone`, `avatar`, `locationArea`, `city`, `loyaltyPoints`, `dateOfBirth`, `gender`, `preferredServices`, `genderPreference`, `hairProfile`, `hairType`, `desiredLength`, `faceShape`, `stylingGoal`, `skinConcern`, `favoriteStylist`, `defaultLocality`, `referralCode`, `referralCount`, `referralEarnings`, `claimedDiscounts`, `referredFriends[]`, `notificationsEnabled`, `appointmentReminders`, `promotionalOffers`, `whatsappAlerts`, `aiAdvisorAlerts`, `appTheme`
- Currently persisted only in `localStorage` (`nexora-profile:<uid>`). No `user_profiles` table, no RLS.

#### Saved Items
- `savedSalonIds` (`nexora-saved-salons:<uid>`) and `savedServices` (`nexora-saved-services:<uid>` as `SavedServiceRef[]`) are localStorage only. No `saved_salons` or `saved_services` tables.

#### Reviews & Photos
- `reviews` are expected either embedded in salon row or via separate table, but no `reviews` table DDL. Same for `gallery_photos` / `photo_gallery`.

#### Notifications, Referrals, Loyalty
- `NotificationsModal.tsx` uses 3 hardcoded notifications. No `notifications` table.
- `ProfileTab.tsx` implements referral code copy, invite friend input, loyalty points display, but no `referrals`, `referred_friends`, `loyalty_transactions` tables.

### 1.3 Schema Mismatches
| Area | Code Expectation | Migration Reality | Impact |
|------|------------------|-------------------|--------|
| `user_locations` | `getCurrentPositionOnce` captures `altitude`, `heading`, `speed`, `accuracy` | Table has no `altitude` column, only `accuracy, heading, speed` | Altitude silently dropped; future schema change may break upsert |
| `salons.location` | Normalizer looks for `location` JSON or flat `latitude/longitude` | No canonical definition whether location is JSONB or columns | If column is JSONB, RLS + PostgREST filtering breaks distance queries |
| `priceRange` | `Salon.priceRange` union `'₹'|'₹₹'|'₹₹₹'|'₹₹₹₹'|'$'|'$$'|'$$$'` | No check constraint defined; any string could be inserted | UI filter `Luxury = length>=3` fails for `$` |
| `distance` | `distance` string e.g. "1.2 km" or `distance_km` numeric | No generated column for distance; computed client-side | Sorting by distance impossible server-side |
| `appointments` | `salonLatitude/Longitude` required to reconstruct salon from appointment | No table, so `salonFromAppointment` guard blocks `Book Again` if coords missing | Booking history loses map pins after catalog refresh |
| `services.category` | Union `'hair'|'skin'|'nails'|'spa'|'grooming'|'bridal'` mapped via `categoryValue()` | No enum type in DB | Invalid categories silently mapped to `hair` |
| `user_profiles` | Many optional fields | No table | Profile completeness calculation (5 checks) based on localStorage only |

### 1.4 Unapplied Migrations & Operational Gap
- `user_locations.sql` is present but **not applied in CI/sandbox** because `verify-live.mjs` requires real anon key + network egress. In sandbox it fails with `ECONNRESET` or `relation does not exist`.
- No migration history table, no `supabase db push` workflow.
- `DEPLOYMENT.md` section 3 explicitly says: *"This checkout contains only the customer-web shell and the `user_locations` RLS contract. It does not contain the ecosystem's claimed organization, membership, salon catalog, availability, booking, payment-order, or webhook migrations/API."* — acknowledges missing migrations but does not provide them.

---

## 2. Missing API Routes, Broken Integrations, Sandbox Egress Blocks

### 2.1 Implemented Routes in `server.ts`
```
GET  /api/health
POST /api/salons/grounded-search       -> Gemini + googleMaps grounding
POST /api/salons/ai-advisor           -> Gemini + googleMaps grounding
POST /api/salons/ai-style-quiz        -> Gemini + googleMaps grounding (model gemini-3.7-flash)
POST /api/salons/sentiment-summary    -> Gemini JSON mode (model gemini-3.7-flash)
*    Vite middleware in dev, static dist in prod
```

### 2.2 Missing Routes (referenced or required by UI)
| Expected Route | Where Referenced | Current Behavior |
|----------------|------------------|------------------|
| `POST /api/bookings` or `/api/payments/create-order` | `BookingSummaryModal.onPayDeposit` prop (never wired) | UI shows error, no appointment created |
| `POST /api/payments/verify` / Razorpay signature verification | `BookingSummaryModal` comments mention Razorpay | No endpoint, no webhook |
| `POST /api/availability/hold` | `DEPLOYMENT.md` says availability holds must be server-side idempotent | Missing |
| `POST /api/razorpay/webhook` | Required for payment reconciliation | Missing |
| `GET /api/salons/:id/availability` | `BookingModal` timeSlots hardcoded 10 slots, no real availability | Always shows same slots, double-booking possible |
| `GET /api/user/profile`, `PUT /api/user/profile` | `ProfileTab` `onUpdateUser` only updates local state | No persistence |
| `POST /api/user/avatar/upload` | `ProfileTab` compresses image client-side but never uploads | Avatar only in localStorage base64, may exceed localStorage quota |
| `POST /api/referrals/invite`, `GET /api/referrals` | `ProfileTab` referral UI | No backend |
| `GET /api/notifications` | `NotificationsModal` | Hardcoded, not live |
| `DELETE /api/user` | `ProfileTab` `onDeleteAccount` returns false, logs warning | No Edge Function, violates GDPR deletion requirement |
| `GET /auth/callback` | Supabase PKCE flow `detectSessionInUrl` expects to clean `?code=` | No explicit route; relies on SPA history cleanup, but `APP_URL` env must be set for email templates |

### 2.3 Broken Integrations
- **Gemini model names invalid:** `gemini-3.6-flash` and `gemini-3.7-flash` do not exist in Google Generative AI API (as of 2024-2026, valid are `gemini-1.5-flash`, `gemini-2.0-flash`, `gemini-2.5-flash`). The code will throw and return 502 `AI service temporarily unavailable`. All AI features (grounded search, advisor, style quiz, sentiment) will fail in production until model names corrected.
- **Google Maps grounding tool:** `tools: [{ googleMaps: {} }]` requires Maps grounding enabled on API key and billing. If not enabled, API returns error. No fallback to text-only search.
- **StaticMapPreview:** Likely uses Google Maps Static API without key handling; if key missing, shows broken image. No API key env for maps.
- **Razorpay:** No `razorpay` npm dependency in `package.json`, no env `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`. Payment integration completely absent.
- **Supabase storage for avatars:** No bucket, no upload logic. Avatar compression to 480px JPEG base64 stored in localStorage can exceed 5MB quota and is not cross-device.
- **Rate limiting:** `aiRateBuckets` is in-memory `Map`. In serverless / multi-instance deployment, each instance has own map, so limit is per-instance, not global. No Redis, no IP forwarding trust (`req.ip` may be proxy).

### 2.4 Sandbox Egress Blocks
- **Gemini API (`generativelanguage.googleapis.com`):** Blocked in many CI sandboxes. `verify-live.mjs` already notes `ECONNRESET` as egress blocked. `server.ts` will 502 when egress blocked.
- **Google Maps grounding:** Same egress dependency.
- **Supabase (`qwaehqsmodekbgvnaavz.supabase.co`):** Requires unrestricted egress. In sandbox, `fetchCatalog` fails and falls back to demo catalog. `useLocationSync` disables itself after detecting `42P01` or `PGRST205`.
- **Unsplash / Google User Content images:** Demo catalog uses `images.unsplash.com` and `lh3.googleusercontent.com`. If egress blocked or referrer policy strict, images fail. No local fallback.
- **No retry / circuit breaker:** On egress failure, client immediately disables location sync (kill-switch) and never retries until page reload.

---

## 3. Incomplete UI Components, Missing Auth/AuthZ (RLS), Broken State Handlers

### 3.1 Incomplete UI Components
| Component | Issue |
|-----------|-------|
| `BookingModal.tsx` | `isSuccess` and `confirmedBooking` state never reached; `handleSubmit` now always calls `onOpenSummary` or shows error. Old confirmation UI dead code. Coupon logic hardcoded client-side (`NEXORA20`, `FIRST20`, `STYLE20`, `SPA50`). No server validation, easily bypassed. |
| `BookingSummaryModal.tsx` | `onPayDeposit` optional and not provided from `App.tsx`; always shows *"Online booking is temporarily unavailable..."*. Advance 25% / remaining 75% calculation client-side only. No Razorpay checkout script loaded. |
| `QuickNearestModal.tsx` | Calls `onBookingUnavailable` if `!isSupabaseConfigured || !userId` then opens auth screen, but doesn't handle `permissionDenied` from `useLocationSync`. May show empty list if catalog empty. |
| `ChooseProfessionalScreen.tsx` | Service toggle uses `selectedServiceIds` but doesn't validate if service still exists after catalog refresh; rebind logic in `App.tsx` filters out missing services but UI may show stale count. |
| `ServiceCategoryScreen.tsx` | Horizontal category pills include 'Hair', 'Grooming', etc. but filter uses `category === active` exact match; mismatch with `SalonService.category` union causes empty results for some categories. |
| `SalonDetailModal.tsx` | AI sentiment banner shows hardcoded "96% Positive" even before sentiment fetch; `onOpenAIAdvisorSentiment` opens AI modal but doesn't pass grounding sources. Photo gallery uses `SalonPhotoGallery` which may not handle empty `photoGallery`. |
| `NotificationsModal.tsx` | 3 static notifications, no mark-as-read persistence, no real-time subscription. |
| `ProfileTab.tsx` | Avatar compression to base64 JPEG stored in localStorage; `compressAndResizeImage` uses canvas but no error handling for large files. Referral invite input only shows toast, no API call. Loyalty points, claimedDiscounts only local. `handleConfirmDeleteAccount` checks for "DELETE" text but always returns false after warning; no actual deletion. Cache clear only clears localStorage? Implementation shows progress but may not clear IndexedDB. |
| `AppointmentsTab.tsx` | Calendar event generation uses Google Calendar URL without time zone; `handleGenerateCalendarEvent` doesn't include end time. Review submission is local state only (`reviewSubmittedId` with 2.5s timeout), not persisted. Cancel/Reschedule directly mutates local state, no server call, no confirmation modal for cancel. |
| `HomeTab.tsx` | Hero carousel auto-scrolls every 4.5s, pauses on hover/touch but not on keyboard focus (a11y). `exploreCategories` hardcoded 12 categories with Unsplash images, not from DB. Search input adds to `recentSearches` local state only. Quick filters (Open Now, Top Rated, etc.) filter client-side only; `At Home` filter not implemented (always true). |
| `ExploreTab.tsx` | Grounded search calls `/api/salons/grounded-search` with `query, latitude, longitude, areaName, category` but UI shows "Click Ground with Maps" hint; no loading skeleton for grounding chunks. If AI fails, shows generic error, no retry. |
| `AIAdvisorModal.tsx` | 3 tabs (quiz, sentiment, chat). Quiz saves to profile via `onUpdateUser` only local. Sentiment fetch caches in component state, not persisted. Chat uses `responseMarkdown` but renders as plain text? No markdown parser. Sample prompts hardcoded. Grounding chunks rendered as links but no sanitization. |
| `LocationModal.tsx` | "Use Current Device Location" button calls `navigator.geolocation.getCurrentPosition` but doesn't handle `PERMISSION_DENIED` with persistent UI; if permission denied, `useLocationSync` sets `permissionDenied` but modal doesn't show instruction to enable in browser settings. |
| `Header.tsx` | Shows live sync indicator based on `locationSync.isWatching` but if backendUnavailable, indicator may show inactive without explaining why. |
| `BottomNav.tsx` | `activeAppointmentsCount` filters `status === 'confirmed'` but `isAppointmentUpcoming` also checks date; count may include past confirmed appointments that are stale. |
| `StaticMapPreview.tsx` | Likely uses Google Static Maps without API key; if key missing, image 403. No fallback to OSM. |
| `OfferDetailModal.tsx` / `AppointmentCountdownBanner.tsx` | Not audited deeply but likely similar static data issues. |

### 3.2 Missing Authentication / Authorization (RLS) Policies
- **Only `user_locations` has RLS.** For production, every table needs RLS:
  - `salons`: `select` for `authenticated` and `anon`? Currently anon can read if RLS disabled, but if enabled without policy, no reads. Need policy allowing public read, but write only for admin/salon owner role.
  - `services`, `categories`, `professionals`: same as salons, plus `salon_id` ownership check for writes.
  - `appointments`: `select/insert/update/delete` where `auth.uid() = user_id`, plus salon owner can read own salon's appointments. Missing.
  - `user_profiles`: `auth.uid() = user_id` for all operations. Missing.
  - `saved_salons`, `saved_services`: `auth.uid() = user_id`. Missing.
  - `reviews`: user can insert own review, update own, public read. Missing.
  - `notifications`: `auth.uid() = user_id`. Missing.
- **Supabase Auth:**
  - `AuthProvider.tsx` uses single listener via `subscribeToAuthState`, good. But `hadPersistedSession()` snapshot from `localStorage.getItem(NEXORA_AUTH_STORAGE_KEY)` at module load; if storage cleared, guest browsing preserved (not redirected). However, if session expired, `guardedRedirectToLogin` redirects to `/auth/login` once. Loop protection via `redirectGuardRef` but if user manually navigates back, guard may stay true and prevent redirect? Potential stuck state.
  - `PasswordResetModal` and `PasswordUpdatePage` rely on Supabase email redirect; `APP_URL` must be set, but no server route validates it. If `APP_URL` misconfigured, reset link goes to wrong domain.
  - No MFA, no OAuth providers (Google, Apple) — only email/password. `AuthPage.tsx` shows email/password only.
  - `isSupabaseConfigured` false when anon key missing → app runs in demo mode with full UI but no auth; `App.tsx` shows auth screen only when `isSupabaseConfigured && !isAuthenticated`? Actually `showAuthScreen` logic: if `!isSupabaseConfigured || !userId` booking triggers auth screen, but guest can still browse catalog (demo). This is intentional but could be confusing: guest sees "Book Now" then forced to login, but no explanation why booking unavailable.
- **Service role leak protection:** `supabase.ts` checks JWT role claim and disables client if `service_role`. Good. But no check for `VITE_SUPABASE_URL` being empty or pointing to wrong project.

### 3.3 Broken State Handlers
- **Appointments:**
  - `sanitizeAppointments` validates `bookingRef` string, but `bookingRef` generation not seen; likely `Math.random` based? Could collide.
  - `parseAppointmentDateTime` parses `YYYY-MM-DD` + `h:mm AM/PM` using `new Date(\`\${date}T00:00:00\`)` then `setHours`. This uses local timezone, but salon time may be IST (Jaipur). If user in different timezone, appointment time shifts. No timezone stored.
  - `isAppointmentUpcoming` returns true for `in_progress` regardless of date, but no logic to transition `confirmed` → `in_progress` → `completed`. Status never auto-updates; past confirmed appointments stay `confirmed` but filtered as past visits via date check, causing inconsistent counts.
  - Cancel: `handleCancelAppointment` maps `status: 'cancelled'` but doesn't free availability hold, no server call, no refund logic.
  - Reschedule: finds salon from `salons.find` or `salonFromAppointment`; if salon not in current catalog (e.g., fallback vs remote mismatch), warning and abort. No date validation.
- **Saved items:**
  - `savedSalonIds` and `savedServices` stored per userId but never synced to server; if user logs in on new device, saved items lost. `sanitizeSalonIds` and `sanitizeSavedServices` may drop invalid entries silently.
- **User profile:**
  - `user` state initialized from `EMPTY_USER` then hydrated from localStorage scoped by userId. `onUpdateUser` updates local state and localStorage but not Supabase. If user clears localStorage, profile resets to empty, losing loyalty points, referral code, etc.
  - `ProfileTab` has 3 save states (`detailsSaveState`, `avatarSaveState`, `settingsSaveState`) that show "saving/saved" but actually only set localStorage, no async server call; toast may be misleading.
- **Catalog:**
  - `useCatalog` starts with `DEMO_SALONS` then fetches remote. If remote returns empty, keeps demo. If remote returns valid but empty child tables, `normalizeCatalog` returns salon with empty services/stylists, which may break booking (no services to book). No UI warning for empty services.
  - Refresh interval 60s via `setInterval`; if tab hidden, still fetches, wasting quota. No `visibilitychange` pause.
  - Error handling: `setError` shows warnings joined, but UI in `HomeTab` only shows "Salon catalog unavailable" when `salons.length===0`, not when warnings exist. User may not see partial failures.
- **Location sync:**
  - `useLocationSync` has module-level `watcherRegistry` to prevent duplicates, but if component unmounts and another mounts quickly, `watchId` may be null and new watcher created, then old cleanup clears new watcher (owner token check mitigates but not fully if Symbol mismatch).
  - `minDistanceMeters=25` and `minIntervalMs=30s` throttling: if user moves 20m every 10s, no sync for 30s, location stale.
  - `backendUnavailable` kill-switch: once `isFatalLocationError` true (e.g., `42P01`), sync disables forever until reload. No retry after migration applied.
  - `clearUserLocation` on logout deletes row while JWT still valid, good, but if delete fails (network), row remains and user appears still live after logout (privacy issue).
- **Auth state:**
  - `AuthProvider` `applySession` updates `session` state, but `user` object in `App.tsx` derived from `session?.user`? Actually `App.tsx` has separate `user` state for profile, not directly from `session.user`. Could get out of sync.
  - `redirectToLogin` uses `history.replaceState` and dispatches `popstate`, but `App.tsx` also has `showAuthScreen` boolean; two sources of truth for auth route. Potential race where `showAuthScreen` false but path is `/auth/login`.
- **Booking flow state:**
  - `selectedSalonForBooking`, `selectedServiceForBooking`, `selectedServicesForBooking`, `selectedStylistForBooking` held in `App.tsx` but also in `BookingModal` local state; if catalog rebinding changes salon, `App.tsx` rebinds but modal may still have old service IDs.
  - `bookingSummaryDraft` holds date/time/notes but no validation that date is not in past; user can select past date via input? `BookingModal` sets `todayStr` as default but allows any date via input? Need check.
  - No loading state for payment; `buttonState` in `BookingSummaryModal` has idle/loading/success but `onPayDeposit` never implemented, so always error.

---

## 4. Prioritized Findings with Immediate Action Items

### CRITICAL (Block Production Release)

#### C1. Missing Supabase Tables & RLS — No Production Data Layer
- **Impact:** App runs on demo catalog, bookings not persisted, profiles lost on new device, no multi-tenancy, no GDPR compliance.
- **Action:**
  1. Create migrations for `salons`, `services`, `categories`, `professionals`, `reviews`, `gallery_photos`, `appointments`, `appointment_services`, `user_profiles`, `saved_salons`, `saved_services`, `notifications`, `referrals`.
  2. Define enums: `service_category`, `salon_gender`, `appointment_status`, `price_range`.
  3. Add RLS policies for each table (public read for catalog, `auth.uid() = user_id` for user-owned, salon owner role for salon writes).
  4. Move `supabase/policies/user_locations.sql` into `supabase/migrations/xxxx_user_locations.sql` and add new migrations.
  5. Add `supabase/config.toml` and document `supabase db push` workflow.
  6. Update `catalogService.ts` to use strict column names, not fallback tolerant, once schema finalized.

#### C2. Booking & Payment Backend Absent — Revenue Flow Broken
- **Impact:** User cannot book; `BookingSummaryModal` always shows error. If guard bypassed, local appointment created without payment verification, double-booking risk.
- **Action:**
  1. Add Razorpay dependency and env `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.
  2. Implement server routes:
     - `POST /api/bookings/hold` → check availability, create hold with expiry, return holdId
     - `POST /api/payments/order` → create Razorpay order for 25% advance, return orderId
     - `POST /api/payments/verify` → verify signature, create appointment in `appointments` table, return canonical appointment
     - `POST /api/webhooks/razorpay` → handle payment success/failure, idempotency via `bookingRef`
     - `GET /api/appointments` → list user's appointments with RLS
     - `POST /api/appointments/:id/cancel` → cancel with refund logic, free hold
  3. In `App.tsx`, replace localStorage appointments with Supabase fetch, and pass `onPayDeposit` implementation to `BookingSummaryModal`.
  4. Add server-side coupon validation (currently client-side only).

#### C3. Invalid Gemini Model Names — All AI Features 502
- **Impact:** `gemini-3.6-flash` and `gemini-3.7-flash` do not exist; every AI request returns 502.
- **Action:**
  1. Change models to `gemini-2.0-flash` or `gemini-1.5-flash` (check Google AI Studio docs).
  2. Add fallback to text-only if `googleMaps` tool not enabled.
  3. Add model name to env `GEMINI_MODEL` for easy override.
  4. Add retry with exponential backoff and log `err.message`.
  5. Test in un-sandboxed environment with real `GEMINI_API_KEY`.

#### C4. Service Role Leak Guard Good, But Anon Key Missing in Production — Demo Mode in Prod Risk
- **Impact:** If `VITE_SUPABASE_ANON_KEY` not set, `isSupabaseConfigured=false`, app shows demo catalog and allows browsing but bookings blocked with confusing auth screen. Could be deployed to prod accidentally.
- **Action:**
  1. In `server.ts` health check, also report `hasSupabaseAnonKey` and `catalogSource`.
  2. In `App.tsx`, if `!isSupabaseConfigured`, show banner "Supabase not configured — running in demo mode" and disable booking buttons with tooltip.
  3. Ensure hosting platform env vars are set and redeploy after setting (VITE_ baked at build).
  4. Add CI check: fail build if `VITE_SUPABASE_ANON_KEY` empty and `VITE_NEXORA_DEMO_MODE!=true`.

#### C5. Account Deletion Not Implemented — Compliance Blocker
- **Impact:** `ProfileTab` shows DELETE confirmation but `handleDeleteAccount` returns false, logs warning. User data cannot be deleted, violates GDPR.
- **Action:**
  1. Create Supabase Edge Function `delete-user` that uses service_role to delete `auth.users` and cascade delete `user_locations`, `appointments`, `user_profiles`, etc.
  2. Add server route `POST /api/user/delete` that calls Edge Function with user's JWT, verifies `DELETE` text.
  3. On success, clear localStorage and sign out.
  4. Document in `DEPLOYMENT.md`.

#### C6. Location Table Missing Altitude & No Retry After Fatal Error
- **Impact:** Altitude captured but not stored; kill-switch disables sync forever if table missing, even after migration applied, until reload. Privacy risk if delete fails on logout.
- **Action:**
  1. Add `altitude double precision` column to `user_locations` migration.
  2. In `useLocationSync`, add retry after 5min or on `visibilitychange`, not permanent disable.
  3. In `handleTeardownLocation`, retry delete with exponential backoff and log if fails; show warning to user if row remains.

### HIGH (Must Fix Before Scale)

#### H1. All User Data in localStorage — Data Loss & No Cross-Device Sync
- **Impact:** Appointments, saved salons/services, profile, loyalty points lost if user clears storage or switches device. `localStorage` 5MB limit may be exceeded by base64 avatar.
- **Action:**
  1. Create `user_profiles`, `saved_salons`, `saved_services`, `appointments` tables with RLS.
  2. Migrate `App.tsx` hydration from `loadJson(scopedStorageKey(...))` to Supabase queries.
  3. Keep localStorage as cache, but sync to Supabase on change.
  4. For avatar, use Supabase Storage bucket `avatars` with RLS, upload compressed JPEG, store public URL in `user_profiles.avatar_url`.

#### H2. No Availability / Double-Booking Protection
- **Impact:** `BookingModal` timeSlots hardcoded 10 slots, no check against existing bookings. Two users can book same stylist same time.
- **Action:**
  1. Create `availability` table or `stylist_schedules` with working hours and blocked slots.
  2. Implement hold mechanism with expiry (e.g., 10min) in `bookings/hold`.
  3. On booking confirm, check hold still valid and no overlapping confirmed appointments.
  4. Show real availability in `BookingModal` fetched from `/api/salons/:id/availability?date=YYYY-MM-DD`.

#### H3. No CORS, No Input Validation, In-Memory Rate Limiter
- **Impact:** `server.ts` no CORS config; if frontend hosted on different domain, requests fail. No zod validation; 32kb JSON limit but no schema validation for `latitude` etc. Rate limiter per-instance, not global, easy to bypass.
- **Action:**
  1. Add `cors` middleware with `origin: APP_URL` env.
  2. Add `zod` validation for all `/api/salons/*` bodies.
  3. Replace in-memory rate limiter with Redis or Supabase-based or at least use `express-rate-limit` with `trust proxy`.
  4. Add `helmet` for security headers.

#### H4. Coupon & Pricing Logic Client-Side Only — Easily Bypassed
- **Impact:** `NEXORA20`, `SPA50` checked client-side, discount applied locally. User can modify JS to get 100% discount.
- **Action:**
  1. Move coupon validation to server: `POST /api/coupons/validate` checks DB `coupons` table (code, discount_percent, valid_until, max_uses).
  2. Server calculates `finalTotal`, `advanceAmount` and returns canonical amounts.
  3. Remove hardcoded codes from frontend, fetch valid promos from `/api/coupons`.

#### H5. Notifications Static, No Real-Time
- **Impact:** `NotificationsModal` shows 3 hardcoded notifications, no real data. User misses appointment reminders.
- **Action:**
  1. Create `notifications` table with `user_id`, `title`, `message`, `type`, `is_read`, `created_at`.
  2. Implement `GET /api/notifications` and `PATCH /api/notifications/:id/read`.
  3. Use Supabase Realtime subscription for new notifications.
  4. Generate notifications on booking, cancellation, 2h reminder via cron/Edge Function.

#### H6. Egress Blocks & No Fallback for Gemini / Maps
- **Impact:** In sandbox or restricted network, AI features 502, location sync disabled, images fail. No user feedback.
- **Action:**
  1. In `server.ts`, catch egress errors and return `503` with `error: "AI service temporarily unavailable, no egress"` and log.
  2. In frontend, show "AI Advisor offline" banner when `fetch` fails, with retry button.
  3. For `StaticMapPreview`, add fallback to OSM static map or placeholder if Google Maps fails.
  4. Document in `DEPLOYMENT.md` that `verify:live` must run outside sandbox.

#### H7. No Supabase Migrations Folder & No CI for Schema
- **Impact:** Only one policy file, no versioned migrations, no `supabase db push`. Schema drift between local and prod.
- **Action:**
  1. Init `supabase` with `supabase init`, move `user_locations.sql` to `supabase/migrations/20240101_user_locations.sql`.
  2. Create new migrations for catalog, bookings, profiles, etc.
  3. Add `supabase/config.toml` with project ref.
  4. Add GitHub Action to run `supabase db lint` and `typecheck`.

#### H8. Password Reset & Auth Callback Handling
- **Impact:** `PasswordResetModal` calls `supabase.auth.resetPasswordForEmail` with `redirectTo: APP_URL + "/auth/reset"`? Not verified. If `APP_URL` missing, email link broken. `/auth/reset` route renders `PasswordUpdatePage` only if `showAuthScreen` true and `currentPath()==='/auth/reset'`, but `AuthProvider` also cleans auth params from URL, may remove code before page handles it.
- **Action:**
  1. Explicitly set `redirectTo` in `PasswordResetModal` using `VITE_APP_URL` or `window.location.origin`.
  2. Add server route `GET /auth/callback` that serves `index.html` and lets Supabase client handle PKCE.
  3. Test full reset flow in browser: request reset → email → click link → update password → login.

### MEDIUM (Improve Quality & Maintainability)

#### M1. Hardcoded Jaipur, INR, and Demo Images
- **Impact:** App not usable outside Jaipur; currency hardcoded ₹, city hardcoded in many components. Demo images from Unsplash may 403 or be slow.
- **Action:**
  1. Move default city, currency, and hero slides to env or DB config.
  2. Use Supabase Storage for salon images, not external URLs.
  3. Add i18n support for at least en-IN.

#### M2. No Pagination, No Search Index
- **Impact:** `fetchCatalog` does `select('*')` on all tables, loads all rows at once. If 1000 salons, performance degrades.
- **Action:**
  1. Add pagination: `select` with `range` and `order`.
  2. Add full-text search via Supabase `textSearch` or `pg_trgm`.
  3. Implement infinite scroll in `HomeTab` and `ExploreTab`.

#### M3. Accessibility & UX
- Carousel pauses on hover/touch but not on focus; no keyboard arrow navigation. Time slots not keyboard accessible. No `aria-label` for many icon buttons.
- **Action:** Add `onFocus`/`onBlur` pause, keyboard handlers, proper aria attributes.

#### M4. Bundle Size & Performance
- `FINAL_RELEASE_AUDIT.md` mentions bundle-size warning. `motion` (framer-motion) + `lucide-react` + `react` 19 + `vite` may be large.
- **Action:** Lazy load `AIAdvisorModal`, `BookingModal`, `SalonDetailModal` via `React.lazy`, code-split.

#### M5. Testing Gaps
- Only `test:nexora` (22 checks), `test:catalog` (7 checks), `test:smoke` (render). No tests for `BookingModal`, `AppointmentsTab`, `ProfileTab`, `useLocationSync` edge cases.
- **Action:** Add unit tests for `appointments.ts` date parsing, `BookingModal` coupon logic, `ProfileTab` avatar compression.

#### M6. Referral & Loyalty System UI Only
- Referral code copy, invite friend input, loyalty points display exist but no backend. `referredFriends` array in `UserProfile` never populated.
- **Action:** Create `referrals` table, generate referral code on signup, track `referralEarnings`, implement invite via email/SMS.

#### M7. Theme & Notification Preferences Local Only
- `appTheme`, `notificationsEnabled`, etc. stored in `user` localStorage, not synced. If user switches device, preferences lost.
- **Action:** Move to `user_profiles` table.

#### M8. Error Boundaries & Logging
- Only top-level `ErrorBoundary`, no per-tab boundaries. Errors in `HomeTab` crash entire app. No error reporting (Sentry).
- **Action:** Add per-tab ErrorBoundary, integrate Sentry or LogRocket, log AI failures with request ID.

---

## 5. Immediate Action Checklist (Next 48h)

**Day 1 — Critical Blockers:**
- [ ] Fix Gemini model names to `gemini-2.0-flash` and test grounded search.
- [ ] Apply `user_locations.sql` to Supabase project `qwaehqsmodekbgvnaavz` via Dashboard SQL Editor.
- [ ] Create `supabase/migrations/` and move policy file, add `config.toml`.
- [ ] Run `npm run verify:live` outside sandbox with real anon key + test user; confirm 11/11 pass.
- [ ] Document `VITE_SUPABASE_ANON_KEY` setup and add banner for demo mode.

**Day 2 — Booking & Schema:**
- [ ] Design and create migrations for `salons`, `services`, `professionals`, `appointments`, `user_profiles` with RLS.
- [ ] Implement `POST /api/bookings/hold`, `POST /api/payments/order`, `POST /api/payments/verify` stubs that return 501 with clear message, then replace BookingModal error with "Payment coming soon" UI.
- [ ] Move coupon validation server-side and remove hardcoded codes from frontend.
- [ ] Implement avatar upload to Supabase Storage and replace base64 localStorage.

**Week 1 — High Priority:**
- [ ] Replace localStorage appointments/saved/profile with Supabase queries + RLS.
- [ ] Add availability table and real time slot fetching.
- [ ] Add CORS, zod validation, and proper rate limiting.
- [ ] Implement notifications table + realtime.
- [ ] Add `DELETE /api/user` Edge Function.

---

## 6. References
- `DEPLOYMENT.md` — acknowledges missing canonical backend, lists 3 manual steps.
- `FINAL_RELEASE_AUDIT.md` — lists files changed, claims 0 typecheck errors, 22/22 auth checks, 7/7 catalog checks.
- `supabase/policies/user_locations.sql` — only migration.
- `src/lib/catalogService.ts` — tolerant normalizer, fallback to demo catalog.
- `src/lib/locationService.ts` — kill-switch on fatal errors, no altitude column.
- `server.ts` — 5 API routes, in-memory rate limiter, invalid model names.
- `src/App.tsx` — localStorage scoped by userId, no Supabase writes for bookings.
- `test/nexora.integration.test.tsx` — 22 checks, stubs Supabase HTTP, counts watchers.

---

**Conclusion:** The codebase is a well-structured **frontend shell** with solid auth listener singleton, location sync with RLS, and hybrid catalog fallback. However, it is **not production-ready** as a full salon booking platform: missing catalog/bookings/profile tables, missing RLS for all but one table, missing payment/availability backend, invalid Gemini models, and all user data in localStorage. Fixing Critical items C1-C6 will unblock a true production deployment; High items H1-H8 are required before scaling beyond demo.
