-- =============================================================================
-- Nexora payment slot-lock — verified 25% deposit before a booking exists
-- =============================================================================
-- Bookings are created only after POST /api/payments/orders + HMAC verify.
-- This migration:
--   1. Stops the parent-insert trigger from requiring children that do not
--      exist yet (parent is inserted, then booking_services).
--   2. Adds optional payment-proof columns (metadata.payment remains the
--      canonical store so older databases still work without these columns).
--   3. Documents payment_orders for multi-instance holds (the Node process
--      also keeps an in-memory hold map).
-- =============================================================================

drop trigger if exists bookings_lines_match_metadata_trigger on public.bookings;
create trigger bookings_lines_match_metadata_trigger
  after update on public.bookings
  for each row execute function public.booking_lines_match_metadata();

alter table public.bookings
  add column if not exists razorpay_order_id text;
alter table public.bookings
  add column if not exists razorpay_payment_id text;
alter table public.bookings
  add column if not exists payment_verified_at timestamptz;

create unique index if not exists bookings_razorpay_payment_id_uidx
  on public.bookings (razorpay_payment_id)
  where razorpay_payment_id is not null;

create table if not exists public.payment_orders (
  id              text primary key,
  amount_paise    integer not null check (amount_paise > 0),
  currency        text not null default 'INR' check (currency = 'INR'),
  slot_key        text not null,
  booking_draft   jsonb not null,
  status          text not null default 'created'
                  check (status in ('created', 'consumed', 'expired')),
  payment_id      text,
  signature       text,
  appointment_id  uuid,
  expires_at      timestamptz not null,
  created_at      timestamptz not null default now()
);

create index if not exists payment_orders_slot_idx
  on public.payment_orders (slot_key, status);

alter table public.payment_orders enable row level security;
-- No authenticated policies: only the service-role payments router writes here.
revoke all on public.payment_orders from anon, authenticated;
