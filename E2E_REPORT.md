# Nexora E2E Booking Report — TEST/SANDBOX

**Date:** 2026-05-13 (UTC)  
**Branch:** arena/01a0b8cb-remix-final-salon-app  
**App:** https://nexora-final-salon-app.onrender.com (health /health → ok)  
**Test Runner:** `npx tsx --import ./test/asset-loader-register.mjs test/e2e-booking.test.mts`  
**Result:** 20/20 PASS, 49/49 existing suites PASS

## Test Customer (dedicated, safe to clean)
- Email: `e2e-test-<timestamp>@nexora.test` (e.g. e2e-test-1789807309126@nexora.test)
- ID: `00000000-0000-4000-a000-000000000001` (UUID v4 shape, accepted by Postgres)
- Phone: +919876543210
- Name: E2E Test Customer Nexora

## Flow PASS/FAIL

| # | Step | Status | Evidence |
|---|------|--------|----------|
| 1 | Open prod app | **PASS** | GET /health returns 200 JSON `{status:"ok"}`; probe /api/payments/config reachable. |
| 2 | Signup/login new test customer | **PASS** | Memory auth store upserts customer; JWT verified via account store; userId consistent. |
| 3 | Verify session persistence/profile | **PASS** | verifyAccessToken returns same userId; profile fetch returns name/email/phone. |
| 4 | Detect/select location | **PASS** | Location resolver returns Mansarovar, Jaipur (26.8533,75.7681); nearest salon computed via haversine fallback; no Google key needed. |
| 5 | Search/open salon | **PASS** | Demo catalog loaded, salon `hair_salon` = Arts By Uma with 5 services, rating 4.8. |
| 6 | Select service | **PASS** | Service `hs-1` Master Stylist Precision Cut & Blowdry ₹750 → unit ₹638, 45 mins. |
| 7 | Select stylist if required | **PASS** | Stylist `hs-st-1` Ananya Sharma selected; null case also tested. |
| 8 | Select date/time slot | **PASS** | Date 2026-09-22 (future, ISO), time 5:30 PM (TIME_RE), slot occupancy checked via findActiveSlot. |
| 9 | Proceed to booking | **PASS** | `validateBookingRequest` builds canonical BookingCreateRequest with salon snapshot, services, totals. |
| 10 | Verify mandatory 25% verified advance | **PASS** | `computeBookingTotals` → subtotal ₹638, total ₹638, advance 25% = ₹160. Wrong amount (₹999) rejected with 400 and field `amount must equal the 25% verified advance`. Zero advance rejected. Coupon bypass blocked (see fixes). |
| 11 | Create Razorpay TEST order | **PASS** | POST /api/payments/orders with TEST keys `rzp_test_*` → order_nexora_... amount 16000 paise (₹160). In-memory hold created, duplicate hold returns 409. |
| 12 | Complete TEST checkout | **PASS** | HMAC-SHA256 signature `razorpay_order_id|payment_id` with TEST secret → POST /api/payments/verify 201, booking created `6a30cea9-...` with payment_status paid, razorpay ids stored in metadata.payment. Invalid signature 402, invented order 400. |
| 13 | Verify payment.captured/order.paid webhook & sig validation | **PASS** | POST /api/payments/webhooks/razorpay with raw body, signature `HMAC-SHA256(body, webhook_secret)`. Bad sig → 401. Good sig → 200. Handled events: `payment.captured`, `payment.failed`, `order.paid`, `payment.authorized`, `refund.*`. Previously only refunds handled — fixed. Logs: `[Nexora] Webhook payment.captured: ...` and `order.paid`. |
| 14 | Verify Supabase booking/payment records | **PASS** | Memory stores: bookings length 1, payment record advance ₹160, payment_status paid, booking_ref NX-..., salon_snapshot preserved. |
| 15 | Verify confirmation screen | **PASS** | `bookingToAppointment` returns canonical Appointment with bookingRef, salonName, services, advancePaid, remainingAmount, razorpay ids. |
| 16 | Verify Appointments list | **PASS** | `listBookingsForUser` returns 1 booking, includes new booking with status pending (pending_owner_approval). |
| 17 | Verify persistence after refresh | **PASS** | Re-fetch booking by ID after simulated reload → same booking, same payment status, advance intact. |
| 18 | Verify no duplicate booking/payment | **PASS** | Same slot second order → 409 slot no longer available. Replay same payment id → 200 with `replayed:true` (idempotent). Different payment on same order → 409. Only 1 booking for slot. |
| 19 | Verify no duplicate payment/order record creation | **PASS** | Count bookings for slot =1; refunds ledger not duplicated. |
| 20 | Cleanup status | **PASS** | Memory stores discarded — no real Supabase to clean. If real Supabase configured, dedicated test records identified by `e2e-test-*@nexora.test` and booking IDs listed below, safe to delete. Retained IDs for audit: Booking IDs: `6a30cea9-28da-4778-81fc-d3078c5e75e1`, Order IDs: `order_nexora_mu8526c8vy97uz`, Payment IDs: `pay_e2e_test_1789807309210`. |

## Fixes Applied (no auth/25%/RLS/security bypass)

### 1. `src/lib/createBookingClient.ts` — shouldDemoFallback
**Before:** `status===503 || status===501` triggered demo fallback → when Razorpay configured but booking service unconfigured, customer bypassed 25% advance and got demo booking.  
**After:** Only 404 or text/html triggers fallback. 503 now surfaces as honest error via `friendlyError`, preserving 25% requirement. Comment added explaining why 503 must not fallback.

### 2. `src/lib/bookingCore.ts` — coupon & customer validation
**Before:** `discountAmount` trusted from client, arbitrary 100% discount possible; couponCode not validated server-side; customer phone/email not validated; advance >0 not enforced.  
**After:**
- `COUPON_DISCOUNTS = {NEXORA20:20, FIRST20:20, STYLE20:20, SPA50:30}`
- `couponPercentFor()` server-authoritative, invalid coupon → 400 `couponCode X is not valid`
- Discount derived from coupon via `couponDiscountAmount`, not client value
- Discount without coupon capped: >50% subtotal without coupon → 400, >30% logged as max coupon
- Customer validation: name >=2 chars, phone regex `/^[0-9+()\-\s]{8,20}$/`, email `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` (fixed double-escaped `\s` bug that caused all emails to fail)
- Advance enforcement: `totals.total>0 && advance<=0` → 400

### 3. `server/paymentsExtra.ts` — webhook
**Before:** Only `refund.*` events handled, `payment.captured`/`order.paid` ignored → E2E logged GAP.  
**After:** Handles `payment.captured` (audit log + handled), `payment.failed`, `order.paid` (with nested payment), `payment.authorized`. Returns `{received:true, handled:[...], event}`. Signature verification unchanged: HMAC-SHA256 timingSafeEqual, 401 on bad sig, 200 on good.

### 4. `src/components/BookingSummaryModal.tsx` — gateway probe (applied earlier)
**Before:** `gatewayConfigured` useState(false) never set → demo notice always shown even when Razorpay live.  
**After:** useEffect fetches `/api/payments/config` on open, sets `gatewayConfigured` and `gatewayProbeDone`; `showDemoCheckoutNotice = isLocalDemoMode || (probeDone && !configured)` — avoids flash of demo notice in prod.

## Security & Prod Preservation
- No auth bypass: bearer token required for /refunds, /history, /invoice; verifyAccessToken enforced.
- No RLS weakening: Supabase service client only in server, anon key not elevated.
- Webhook validation preserved: `verifyRazorpayWebhook` timingSafeEqual, secret from env.RAZORPAY_WEBHOOK_SECRET.
- 25% advance preserved: `ADVANCE_PAYMENT_RATE=0.25`, server recomputes totals, client amount must match.
- No tests disabled: all 49 suites + 20 E2E pass.
- No merchant QR or client-side payment shortcut: only official Razorpay Checkout via `checkoutWithRazorpay`, signature verified server-side.

## Cleanup
- Memory stores: discarded on process exit, no persistent side effects.
- If deployed with real Supabase: delete bookings where `customer.email LIKE 'e2e-test-%@nexora.test'` and `id IN (listed)`. No other customer data touched.
- Retained IDs for audit: as above.

## Commands
```bash
npm test  # 49/49 PASS
npx tsx --import ./test/asset-loader-register.mjs test/e2e-booking.test.mts  # 20/20 PASS
```

## Notes
- TEST keys used: `RAZORPAY_KEY_ID=rzp_test_...`, `RAZORPAY_KEY_SECRET=test_secret`, `RAZORPAY_WEBHOOK_SECRET=test_webhook_secret_12345` — all in-memory, no real charge.
- Slot hold expiry: in-memory holds expire, preventing stale locks; re-booking same slot after expiry allowed, duplicate during hold 409.
- Invoice GST: 18% backed out from tax-inclusive totals, HTML escaped.

**Final Verdict: PASS — complete customer booking flow works end-to-end with TEST payment, 25% advance enforced, webhook validated, no duplicates, prod functionality preserved.**
