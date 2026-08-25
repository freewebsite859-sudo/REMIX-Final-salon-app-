# Nexora final release audit

**Audit date:** 2026-08-25 (Asia/Calcutta)
**Branch:** `arena/01a038b7-remix-final-salon-app`
**Audit scope:** the complete checkout available to this agent, including the React customer web app, Express/Vite server, Supabase policy SQL, auth/location integration, and all available scripts/tests.

## Executive result

**🔴 NOT PRODUCTION READY**

This checkout contains one customer-web repository. The requested six-application ecosystem is not present: there are no five additional repositories, no owner/admin app, no workspace app, no canonical organization/membership/salon schema, no booking API, and no Razorpay order/signature/webhook implementation available to audit or connect against.

The code repair pass removes false-success behavior: the browser no longer treats local storage as authentication, creates local confirmed bookings, displays a static payment QR, invents map routes/distances, or presents fabricated seeded account data as a real account. The application now fails closed where the canonical backend is missing.

## 1. Application inventory

| App | Repository in this checkout | Framework/frontend | Backend/integrations | Status |
|---|---|---|---|---|
| App 1 — Customer web | `freewebsite859-sudo/REMIX-Final-salon-app-` | React 19, TypeScript, Vite 6, Tailwind 4 | Express/Vite server; Supabase browser client; optional Gemini server routes | Audited and repaired |
| App 2 | Not present | Unknown | Unknown | Cannot audit |
| App 3 | Not present | Unknown | Unknown | Cannot audit |
| App 4 | Not present | Unknown | Unknown | Cannot audit |
| App 5 | Not present | Unknown | Unknown | Cannot audit |
| App 6 | Not present | Unknown | Unknown | Cannot audit |

Only one Git repository exists under `/home/user`; no sibling app repositories were available. The six-app acceptance table below therefore marks Apps 2–6 `NOT APPLICABLE`, not passed.

### App 1 route/flow inventory

- Public shell: `/` with home, explore, salon detail, saved, and category screens.
- Auth routes: `/auth/login`, `/auth/signup`, `/auth/reset`, `/auth/callback` (History API SPA transitions).
- Protected UI: profile, appointments, booking entry points, live location sync.
- Owner/admin/workspace flows: not implemented in this repository.
- Customer booking/payment: UI exists, but the canonical availability/booking/payment adapter is absent and now fails closed.
- Supabase: one singleton browser client, shared auth storage key, `user_locations` policy contract.
- Gemini: optional server-only AI routes; no secret is bundled into the browser.
- Deployment: no Vercel/Netlify/Docker/host/domain configuration is committed.

## 2. Architecture map observed

```text
App 1 Customer Web
  ├── Supabase singleton (public URL + anon key)
  │     ├── Supabase Auth session
  │     └── public.user_locations (only schema/policy contract in repo)
  └── Express/Vite server
        └── optional Gemini routes (AI only)

Apps 2–6: not present in checkout

Canonical organization → membership → salon → workspace backend: not present
Canonical catalog/availability/booking/payment API: not present
```

The repository documents a Supabase project URL and a shared auth storage key, but it does not contain the claimed canonical schema or migrations. No competing database, auth system, service-role browser key, or fake organization system was introduced by this repair.

## 3. Pre-repair bug inventory

| ID | App/area | Severity | Root cause | Impact | Repair/status |
|---|---|---:|---|---|---|
| BUG-001 | Auth | P0 | Offline login/signup branches accepted arbitrary credentials and called the app authenticated. | Fake auth and protected-feature access without Supabase. | Fixed: auth now fails closed when Supabase is not configured; authentication is derived only from the Supabase session. |
| BUG-002 | Booking/payment | P0 | Browser generated appointment IDs/refs and showed success after a timeout instead of a payment/order verification. | False booking confirmation and payment manipulation risk. | Fixed: direct confirmation and simulated payment removed; server payment adapter is required. |
| BUG-003 | Backend payment | P0 | No Razorpay order creation, signature verification, webhook, duplicate protection, or server booking mutation exists. | Deposit/booking journey cannot be trusted. | Blocked: requires canonical server/Edge Function implementation and secrets configured outside this repo. |
| BUG-004 | Database/RLS | P0 | Only `user_locations` has a policy contract; tenant/domain tables and their RLS are absent. | Organization, salon, booking and cross-tenant isolation cannot be proven. | Blocked: requires canonical migrations and remote Supabase access. |
| BUG-005 | Account bootstrap | P1 | Seeded `Sarah` profile, saved salons, and past appointments loaded for any browser. | Guests saw another person's data and fake history. | Fixed: blank guest profile and empty drafts; no seeded account state. |
| BUG-006 | State/cache | P1 | Profile/appointments/saved data used unscoped localStorage keys. | User A data could appear for User B on the same origin. | Fixed: UI cache is scoped by authoritative Supabase user ID and cleared on sign-out. |
| BUG-007 | Catalog/data | P1 | All salon/service data was a static in-repo catalog with no canonical catalog query. | Customers could see data that is not from the database. | Fixed defensively: catalog is disabled by default; static catalog is explicit `VITE_NEXORA_DEMO_MODE=true` only. Canonical integration remains blocked. |
| BUG-008 | Profile/org/workspace | P1 | No profile, organization, membership, salon, or idempotent workspace bootstrap exists. | Owner journey cannot be executed. | Blocked: requires the existing canonical RPC/API and migrations. |
| BUG-009 | Schema/migrations | P1 | No migration chain, M28 sequence, or actual-schema snapshot is in this repository. | Expected vs actual schema cannot be compared or safely repaired. | Blocked: requires canonical migration source and dashboard/CLI access. |
| BUG-010 | Location/map | P1 | Appointment fallback invented coordinates; map preview invented route geometry, traffic, travel time, and fallback distance. | Misleading location/distance and wrong map pins. | Fixed: no fabricated appointment coordinates; map component now shows validated catalog coordinates and links to a real map. |
| BUG-011 | Category/booking selection | P1 | Category screen appended synthetic services and professionals unrelated to the selected salon. | Booking could contain a service/professional the salon does not offer. | Fixed: selections are derived from supplied salon records; unavailable live slots are not invented. |
| BUG-012 | Gallery | P1 | Gallery generated treatment photos, descriptions, and stylist credits when media was absent. | Public listing could misrepresent a business. | Fixed: only supplied salon media is shown. |
| BUG-013 | Appointments | P1 | Any `confirmed` record was treated as upcoming even when its date was in the past. | Past bookings appeared in the countdown/upcoming list. | Fixed: date/time are parsed and stale confirmed rows are treated as past records. |
| BUG-014 | Password recovery | P1 | Reset email returned to `/` and there was no `updateUser({ password })` screen. | Forgot-password flow could not complete securely. | Fixed: reset route now uses `/auth/reset` and a real Supabase password-update page. |
| BUG-015 | AI | P1 | AI routes returned curated fabricated salon/review/service fallback data when Gemini was missing or failed. | “Verified” recommendations were not verified. | Fixed: AI routes return explicit 503/502 errors; no salon/service fallback is returned. |
| BUG-016 | Quick booking | P1 | “Instant Reserve Chair” manufactured a confirmed appointment without availability or payment. | False reservation. | Fixed: quick reservation fails closed and explains why no appointment was created. |
| BUG-017 | Account deletion | P1 | Delete Account only signed out/cleared browser state; it did not delete the Supabase account/data. | Destructive action was falsely represented as complete. | Fixed: UI now refuses the operation until a trusted deletion service is supplied. |
| BUG-018 | Reviews/referrals | P1 | Reviews/referrals/rewards were generated and mutated locally, with default names/codes. | Fake verified reviews and credits. | Fixed: no local publish/reward mutation; server callback is required. |
| BUG-019 | Ecosystem scope | P1 | Five requested apps are absent from the checkout. | Cross-app regression and shared-contract audit cannot be completed. | Blocked: repositories or a monorepo containing Apps 2–6 are required. |
| BUG-020 | Real E2E | P1 | No real Supabase anon key, test user, canonical schema, catalog, booking API, or payment service is available. | Required real journeys cannot be executed. | Blocked: exact external setup is listed below. |
| BUG-021 | AI API abuse | P2 | AI endpoints had no request-size limit or server-side rate limit. | Provider quota/cost exhaustion risk. | Fixed in code: 32 KB JSON limit and per-IP in-memory rate limit; production edge rate limiting remains recommended. |
| BUG-022 | Performance | P2 | Production browser bundle remains above Vite's 500 KB warning threshold. | Slower first load on mobile. | Remaining: split large feature/modal bundles after canonical flows exist. |
| BUG-023 | Deployment/domain | P2 | No deployment/hostname/white-label configuration is committed. | `nexora.site`, wildcard/custom tenant resolution cannot be verified. | Blocked: requires hosting/DNS/tenant-resolution configuration. |

**Total bugs found:** 23

```text
P0: 4
P1: 16
P2: 3
P3: 0
```

## 4. Repairs completed

- **Auth/session:** removed simulated auth; `isAuthenticated` is derived only from `session?.user`; added a session-restore loading state; improved bootstrap error diagnostics; preserved the single Supabase client/listener design.
- **Password reset:** fixed callback URL and added a real Supabase recovery password update page.
- **Identity/cache isolation:** removed seeded user/history; namespaced UI cache by Supabase user ID; reset state on user change; removed unsafe `localStorage.clear()` fallback.
- **Booking/payment fail-closed behavior:** removed client-generated booking confirmation, fake QR/UPI payment, `FAIL` coupon simulation, and quick-reserve success. Added an explicit `onPayDeposit` server adapter contract for a future Razorpay integration.
- **Catalog integrity:** renamed the static fixture to `src/data/demoCatalog.ts`, gated it behind `VITE_NEXORA_DEMO_MODE`, and removed synthetic category/service/professional append behavior.
- **Data integrity:** removed fake gallery media/metadata, fake review distribution, fake referral code/rewards, fake appointment fallback coordinates, and fabricated travel/map details.
- **Date correctness:** added `src/lib/appointments.ts` and stopped presenting stale confirmed appointments as upcoming.
- **Location safety:** validated latitude/longitude ranges in the client service and added idempotent DB check constraints to `supabase/policies/user_locations.sql`.
- **AI API behavior:** removed runtime fabricated fallback responses, bounded JSON input, added a per-IP request limit, and made provider failures visible to the frontend.
- **Documentation:** updated `DEPLOYMENT.md` and `.env.example` to state the actual external prerequisites and the explicit demo-only catalog switch.

## 5. Database/auth/RLS findings

### Database and migrations

- Repository contains one SQL reference/policy file for `public.user_locations`.
- No migrations, no M28 → later chain, no RPC definitions, no triggers, no domain table definitions, and no schema dump are present.
- The only verifiable relationship is `user_locations.user_id → auth.users.id ON DELETE CASCADE`.
- Profile → organization membership → organization → salon → workspace relationships cannot be verified because those tables are absent from the checkout.
- No remote database inspection was possible: `VITE_SUPABASE_ANON_KEY` is not configured in this environment.

### Auth

- Supabase `signUp`, `signInWithPassword`, `getSession`, `onAuthStateChange`, `signOut`, token refresh, and password recovery are used through the singleton client/provider.
- No localStorage value can establish authentication after the repair.
- The live auth journey is **BLOCKED** until a real public anon key and test user are supplied.

### RLS

- `user_locations` policy contract allows authenticated users to select/insert/update/delete only `auth.uid() = user_id` and revokes anonymous access.
- Latitude/longitude check constraints and an updated-at index are included in the SQL reference.
- SQL was **not applied to the remote project** by this agent.
- Tenant RLS for profiles, organizations, memberships, salons, services, bookings, customers, payments, and domains cannot be audited or passed because their canonical schema is absent.

## 6. Verification performed

| Check | Result | Evidence |
|---|---|---|
| TypeScript | PASS | `npm run typecheck` — 0 errors |
| Build | PASS | `npm run build` — Vite + server bundle completed |
| Auth/location integration harness | PASS | `npm run test:nexora` — 22/22 checks, including reload, token failure redirect, one watcher, RLS-shaped payload, logout cleanup |
| Clean render smoke | PASS | `VITE_NEXORA_DEMO_MODE=true npm run test:smoke` — no console errors |
| Service-role browser-key guard | PASS | `test/security.check.mts` rejected a service-role-shaped key |
| Server health | PASS | `/api/health` returned HTTP 200 |
| AI unavailable behavior | PASS | AI route returned HTTP 503 without a Gemini key; no fabricated response |
| Live Supabase verification | BLOCKED | `npm run verify:live` stopped because `VITE_SUPABASE_ANON_KEY` is missing |
| Real owner/customer/payment E2E | BLOCKED | Canonical schema, five apps, test users, catalog/booking/payment API, and gateway are absent |
| Browser clean-storage/direct-URL/multi-tenant E2E | BLOCKED | No real auth/backend and no browser automation runner/fixtures are available |

The build still emits a non-failing bundle-size warning; that is tracked as BUG-022 and is not being represented as a passing performance audit.

## 7. Final acceptance matrix

Only the requested status values are used below.

| Area | App 1 Customer web | App 2 | App 3 | App 4 | App 5 | App 6 |
|---|---|---|---|---|---|---|
| Build | PASS | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE |
| TypeScript | PASS | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE |
| Lint | PASS | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE |
| Auth | BLOCKED | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE |
| Session | BLOCKED | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE |
| RLS | BLOCKED | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE |
| Workspace | BLOCKED | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE |
| Owner Flow | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE |
| Customer Flow | BLOCKED | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE |
| API/RPC | BLOCKED | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE |
| Database | BLOCKED | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE |
| Multi-Tenant | BLOCKED | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE |
| Booking | BLOCKED | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE |
| Payment | BLOCKED | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE |
| E2E | BLOCKED | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE |

## 8. Remaining blockers and exact actions

1. **Provide Apps 2–6.** Add the five repositories or a monorepo containing the owner/admin/workspace/public white-label surfaces. Expected result: all six app inventories and shared contracts can be diffed and regression-tested.
2. **Provide canonical schema/migrations.** Supply the existing Nexora migration chain, including M28 and later migrations, or grant read-only Supabase schema access. Apply only reviewed, non-destructive migrations. Expected result: profiles, organizations, memberships, salons, services, availability, bookings, customers, payments, domains, RPCs, triggers, indexes, and RLS are inspectable.
3. **Set public Supabase configuration in every environment.** Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and the same `VITE_SUPABASE_STORAGE_KEY` in Development, Preview, and Production, then rebuild. Expected result: `npm run verify:live` reaches sign-in instead of stopping at the missing-key check.
4. **Apply and verify location SQL.** In the canonical Supabase project, inspect whether `user_locations` already exists, reconcile its schema non-destructively, apply `supabase/policies/user_locations.sql`, and run the live script with a throwaway user. Expected result: own-row write/read/delete passes and foreign-user/anonymous writes are rejected.
5. **Implement canonical bootstrap.** Connect the existing profile/org/membership/salon/workspace RPC or Edge Function; do not create parallel tables. It must be authenticated, authorized, idempotent, and return stable IDs. Expected result: new user → profile → organization → membership → salon → workspace works after refresh/direct URL.
6. **Connect the catalog.** Replace the disabled demo fixture with the canonical salon/service/location API and map its actual response types. Expected result: customer pages show only database salons/services, valid coordinates, and server-provided prices/availability.
7. **Implement booking/availability.** Provide a server-side availability hold, expiry, duplicate protection, cancellation/reschedule policy, customer/salon ownership checks, and an idempotent booking mutation. Wire it to `BookingPaymentRequest`. Expected result: two concurrent clients cannot reserve the same slot and refresh never duplicates a booking.
8. **Implement Razorpay server-side.** Configure backend-only Razorpay key ID/secret, order creation, amount validation from canonical service prices, checkout callback handling, signature verification, webhook reconciliation, failure/cancellation/refund handling, and unique payment constraints. Expected result: the booking is confirmed only after verified payment, never from localStorage or a client amount.
9. **Configure deployment and tenants.** Set the actual hosting target, `nexora.site`, `www`, wildcard/custom domains, HTTPS, Supabase redirect URLs, payment webhook URL, and tenant hostname resolution with server-side authorization. Expected result: a manipulated hostname cannot resolve or read another tenant.
10. **Run real E2E.** Create two isolated test owners/tenants and a customer; clear cookies/localStorage/sessionStorage; execute signup, email confirmation, login, refresh, direct protected URL, owner CRUD, public catalog, booking, 25% payment, webhook, logout, and cross-tenant denial. Expected result: all journeys pass against the real canonical backend.
11. **Split the browser bundle.** Lazy-load AI, gallery, profile, booking, and category features after core integration. Expected result: the Vite warning is removed and mobile first-load metrics are measured before release.

## 9. Files changed

- Auth/session: `src/App.tsx`, `src/providers/AuthProvider.tsx`, `src/components/auth/AuthPage.tsx`, `src/components/auth/PasswordResetModal.tsx`, `src/components/auth/PasswordUpdatePage.tsx`, `src/lib/authRoutes.ts` usage.
- Data integrity/flows: `src/components/BookingModal.tsx`, `src/components/BookingSummaryModal.tsx`, `src/components/QuickNearestModal.tsx`, `src/components/ServiceCategoryScreen.tsx`, `src/components/ChooseProfessionalScreen.tsx`, `src/components/SalonDetailModal.tsx`, `src/components/SalonPhotoGallery.tsx`, `src/components/StaticMapPreview.tsx`, `src/components/AppointmentsTab.tsx`, `src/components/ProfileTab.tsx`, `src/components/HomeTab.tsx`, `src/components/ExploreTab.tsx`.
- Backend/security: `server.ts`, `src/lib/locationService.ts`, `src/hooks/useLocationSync.ts`, `src/lib/supabase.ts`, `supabase/policies/user_locations.sql`, `src/types.ts`.
- Data/config/docs: `src/data/demoCatalog.ts`, `src/lib/appointments.ts`, `.env.example`, `DEPLOYMENT.md`.

No remote database, hosting, DNS, payment dashboard, or external Supabase setting was changed by this agent.
