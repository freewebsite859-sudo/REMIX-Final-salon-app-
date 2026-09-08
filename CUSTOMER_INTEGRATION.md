# Nexora SalonOS Customer App — Supabase Integration

The customer app is now wired to the canonical 18-table Nexora SalonOS schema
on Supabase. It reads and writes the **existing** database; it does not create
duplicate tables, rename tables, drop anything, or overwrite existing rows.

## Tables connected

| Table | Purpose | Access |
|---|---|---|
| `profiles` | Register/update the signed-in customer profile | owner only |
| `salons` | Salon discovery / home / salon profile | read-only |
| `salon_services` | Services shown on the salon profile | read-only |
| `salon_staff` | Stylists / professionals shown on the salon profile | read-only |
| `staff_slots` | Real-time available slots in the booking flow | read-only |
| `bookings` | Customer bookings / booking history | owner only |
| `booking_services` | Services attached to each booking (transactional booking creation) | owner only |
| `favourites` | Saved salons, services and staff | owner only |
| `reviews` | Submitted reviews + salon-profile review display | owner write; public read |
| `reward_wallets` | Current loyalty/points balance | owner only |
| `reward_transactions` | Reward wallet activity | owner only |
| `customer_qr_payments` | QR payment rewards ledger | owner only |
| `memberships` | Silver/Gold/Platinum membership | owner only |
| `referrals` | Referral relationships and rewards | involved users only |
| `notifications` | In-app notification inbox | owner only |
| `search_history` | Recent search history | owner only |
| `offers` | Offer catalogue | read-only |
| `offer_redemptions` | Customer offer redemptions | owner only |

## How the app connects

- **Catalog / Home / Salon Discovery / Services / Staff / Offers**
  `src/lib/customerCatalogService.ts` reads `salons`, `salon_services`,
  `salon_staff`, `staff_slots`, `reviews` and `offers`. When a real Supabase
  project is configured the app never falls back to mock salons.

- **Availability**
  `src/lib/bookingService.ts::fetchAvailableSlots` reads `staff_slots`; the
  booking modal uses those real slots instead of the static demo times.

- **Booking / Booking Services**
  `createCustomerBooking` inserts the `bookings` row, then every
  `booking_services` row, then refreshes the canonical booking. `bookings`
  and `booking_services` are private to the signed-in user (RLS).

- **Booking history & realtime**
  `fetchCustomerBookings` loads the customer's own bookings and
  `subscribeToCustomerBookings` listens for Supabase realtime changes so
  salon confirmations/cancellations are reflected live.

- **Favourites**
  `src/lib/favouritesService.ts` reads/toggles rows in `favourites`.

- **Reviews**
  `loadLiveReviews` / `saveReviewLive` use `reviews`, scoped to the signed-in
  user for writes.

- **Rewards / QR payments / redemptions**
  `src/lib/rewardsService.ts` reads `reward_wallets`, `reward_transactions`
  and `customer_qr_payments`. These three are **read-only** for the customer
  app. Reward credits, redemptions and offer redemptions require backend /
  QR-terminal verification; the client never marks a reward approved.

- **Membership**
  `loadMembership` / `saveMembership` use `memberships`.

- **Referrals**
  `loadLiveReferrals` / `saveReferralRecordLive` use `referrals`.

- **Notifications**
  The existing `notificationService.ts` reads/writes `notifications`; the
  Notifications page is now fully backed by that service in live mode.

- **Offers**
  `src/lib/offersService.ts` reads `offers` and the customer's own
  `offer_redemptions`.

- **Search history**
  `src/lib/searchHistoryService.ts` records reads from `search_history`; the
  Search tab also loads the customer's recent searches from that table.

- **Profile / Settings**
  `src/lib/profileService.ts` loads the signed-in profile via `auth.uid()` and
  persists name/email/mobile/city/area/avatar/language/referral-code updates to
  `profiles`. No other customer's row is read.

- **Booking safety**
  Before creating a booking the service re-checks that the salon, service and
  staff are active, that the selected `staff_slots` row is still available, and
  that no duplicate active booking exists for the same salon/staff/date/time.

## Database setup

Run the idempotent SQL against the existing Supabase project:

```
supabase/customer_tables.sql
```

It uses `create table if not exists` and `drop policy if exists` — no table is
renamed, dropped, truncated, or reset, and existing rows are untouched. RLS is
enabled so a customer can only access their own private records; salons,
services, staff, slots and offers are read-only.

The file `supabase/setup.sql` still contains the auth, location and
notification backend; `supabase/customer_tables.sql` adds the customer
catalogue/booking/reward/referral tables.

## Verification

`src/lib/supabase/schema.ts` performs runtime read-only schema detection for
all 18 tables. There is also a Node verification script:

```bash
VITE_SUPABASE_URL=https://qwaehqsmodekbgvnaavz.supabase.co \
VITE_SUPABASE_ANON_KEY=<anon public key> \
npm run verify:customer-tables
```

Expected output: `18/18 customer-app tables detected`.

## Open external requirement

This checkout does not contain the project's public `anon` key (it is gitignored
and must not be committed), so the live schema detection/verification cannot be
run inside the sandbox. To complete the live connection:

1. Set `VITE_SUPABASE_ANON_KEY` in `.env` (anon public key only, never
   `service_role`).
2. Run `supabase/customer_tables.sql` once against the project (it is safe to
   re-run).
3. Run `npm run verify:customer-tables`.

With those three steps, every screen uses the live database and no screen falls
back to demo data in production.
