-- =============================================================================
-- NEXORA SALONOS CUSTOMER APP — 18 CANONICAL TABLES
-- =============================================================================
--
-- This file is the idempotent, NON-DESTRUCTIVE schema for the customer app.
--
--   * It creates ONLY tables that do not already exist (`create table if not
--     exists`). It never renames, drops, truncates or resets an existing table
--     or row.
--   * Independent tables use `text` ids so a deployment that already uses
--     `services`, `professionals`, `categories` or string salon ids can be
--     mapped without destructive migration.
--   * RLS is enabled. A signed-in customer can only access their own private
--     rows (`user_id = auth.uid()`). Salon/service/staff/slot/offer catalog
--     rows are read-only to authenticated users.
--   * Policies use `drop policy if exists` + `create policy` so the file can be
--     safely re-run to repair a partially applied policy set. No table policy
--     drop touches data.
--
-- Run this ONCE in the existing project:
--   Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
--
-- This file intentionally does not define `auth.users` or `profiles`; those are
-- owned by the auth/notification setup in `supabase/setup.sql`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Customer catalog
-- -----------------------------------------------------------------------------

create table if not exists public.salons (
  id             text primary key,
  name           text not null,
  description    text,
  address        text,
  area           text,
  city           text,
  state          text,
  pincode        text,
  latitude       numeric,
  longitude      numeric,
  phone          text,
  email          text,
  image          text,
  banner_image   text,
  rating         numeric,
  review_count   int default 0,
  price_range    text,
  gender         text default 'unisex',
  open_time      text,
  close_time     text,
  days_open      text,
  is_open        boolean default false,
  is_active      boolean default true,
  is_verified    boolean default false,
  is_featured    boolean default false,
  is_trending    boolean default false,
  amenities      text,
  discount_offer text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.salon_services (
  id               text primary key,
  salon_id         text not null references public.salons (id) on delete cascade,
  name             text not null,
  category         text,
  description      text,
  price            numeric not null default 0,
  discount_price   numeric,
  duration_minutes int not null default 30,
  duration         int,
  popular          boolean default false,
  is_active        boolean default true,
  image            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists salon_services_salon_idx on public.salon_services (salon_id);

create table if not exists public.salon_staff (
  id           text primary key,
  salon_id     text not null references public.salons (id) on delete cascade,
  name         text not null,
  role         text,
  title        text,
  avatar       text,
  image        text,
  rating       numeric,
  review_count int default 0,
  experience   text,
  specialty    text,
  skills       text,
  is_active    boolean default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists salon_staff_salon_idx on public.salon_staff (salon_id);

create table if not exists public.staff_slots (
  id           text primary key,
  salon_id     text not null references public.salons (id) on delete cascade,
  staff_id     text references public.salon_staff (id) on delete set null,
  date         date,
  slot_date    date,
  start_time   time,
  end_time     time,
  time         text,
  is_available boolean default true,
  status       text default 'available',
  booking_id   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists staff_slots_salon_date_idx
  on public.staff_slots (salon_id, coalesce(date, slot_date));

create table if not exists public.offers (
  id               text primary key,
  salon_id         text references public.salons (id) on delete cascade,
  name             text,
  title            text not null,
  description      text,
  code             text,
  discount_percent numeric,
  discount_percentage numeric,
  discount_amount  numeric,
  starts_at        timestamptz,
  valid_from       timestamptz,
  ends_at          timestamptz,
  valid_until      timestamptz,
  is_active        boolean default false,
  image            text,
  terms            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists offers_active_idx on public.offers (is_active, ends_at, valid_until);

-- -----------------------------------------------------------------------------
-- Customer-owned records
-- -----------------------------------------------------------------------------

create table if not exists public.bookings (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  salon_id         text not null references public.salons (id) on delete cascade,
  staff_id         text references public.salon_staff (id) on delete set null,
  date             date not null,
  booking_date     date,
  time             text,
  slot_time        text,
  status           text not null default 'pending',
  booking_status   text,
  total_price      numeric not null default 0,
  amount           numeric,
  advance_paid     numeric,
  advance_amount   numeric,
  remaining_amount numeric,
  payment_status   text default 'pending',
  payment_mode     text,
  discount_applied numeric,
  coupon_code      text,
  booking_ref      text,
  ref_code         text,
  notes            text,
  special_notes    text,
  owner_confirmed_at timestamptz,
  confirmed_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists bookings_user_idx on public.bookings (user_id, created_at desc);
create index if not exists bookings_salon_idx on public.bookings (salon_id);
create index if not exists bookings_staff_idx on public.bookings (staff_id);

create table if not exists public.booking_services (
  id               uuid primary key default gen_random_uuid(),
  booking_id       uuid not null references public.bookings (id) on delete cascade,
  service_id       text references public.salon_services (id) on delete set null,
  service_name     text not null,
  category         text,
  price            numeric,
  discount_price   numeric,
  amount           numeric,
  duration_minutes int,
  duration         int,
  created_at       timestamptz not null default now()
);

create index if not exists booking_services_booking_idx on public.booking_services (booking_id);

create table if not exists public.favourites (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  salon_id   text references public.salons (id) on delete cascade,
  service_id text references public.salon_services (id) on delete cascade,
  staff_id   text references public.salon_staff (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, salon_id, service_id, staff_id)
);

create index if not exists favourites_user_idx on public.favourites (user_id);

create table if not exists public.reviews (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  booking_id      uuid references public.bookings (id) on delete set null,
  salon_id        text references public.salons (id) on delete cascade,
  salon_name      text,
  salon_address   text,
  salon_image     text,
  salon_rating    int,
  rating          int,
  staff_id        text references public.salon_staff (id) on delete set null,
  staff_name      text,
  staff_avatar    text,
  staff_role      text,
  staff_rating    int,
  service_name    text,
  service_used    text,
  comment         text,
  review          text,
  photo_url       text,
  user_name       text,
  user_avatar     text,
  verified_booking boolean default true,
  created_at      timestamptz not null default now()
);

create index if not exists reviews_salon_idx on public.reviews (salon_id);
create index if not exists reviews_user_idx on public.reviews (user_id);

create table if not exists public.reward_wallets (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null unique references auth.users (id) on delete cascade,
  current_points     numeric default 0,
  lifetime_earned    numeric default 0,
  lifetime_redeemed  numeric default 0,
  pending_points     numeric default 0,
  expiring_points    numeric default 0,
  expired_points     numeric default 0,
  qr_payment_rewards numeric default 0,
  referral_rewards   numeric default 0,
  updated_at         timestamptz not null default now()
);

create table if not exists public.reward_transactions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  type               text not null,
  points             numeric not null default 0,
  status             text default 'Pending',
  salon_id           text references public.salons (id) on delete set null,
  salon_name         text,
  bill_amount        numeric,
  friend_name        text,
  referral_id        text,
  description        text,
  qr_transaction_ref text,
  expires_at         timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists reward_transactions_user_idx
  on public.reward_transactions (user_id, created_at desc);

create table if not exists public.customer_qr_payments (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  salon_id           text references public.salons (id) on delete set null,
  salon_name         text,
  bill_amount        numeric not null default 0,
  points_earned      numeric default 0,
  status             text default 'Approved',
  qr_reference       text,
  description        text,
  created_at         timestamptz not null default now()
);

create index if not exists customer_qr_payments_user_idx
  on public.customer_qr_payments (user_id, created_at desc);

create table if not exists public.memberships (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references auth.users (id) on delete cascade,
  tier       text not null default 'standard',
  points     numeric default 0,
  spend      numeric default 0,
  lifetime_spend numeric default 0,
  expires_at timestamptz,
  status     text default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.referrals (
  id                      uuid primary key default gen_random_uuid(),
  referrer_user_id        uuid not null references auth.users (id) on delete cascade,
  referred_user_id        uuid references auth.users (id) on delete set null,
  referred_user_name      text,
  referred_user_mobile    text,
  referred_user_avatar    text,
  friend_name             text,
  status                  text not null default 'pending',
  reward_points           numeric default 150,
  qualifying_payment_amount numeric,
  salon_id                text references public.salons (id) on delete set null,
  salon_name              text,
  invited_at              timestamptz not null default now(),
  completed_at            timestamptz,
  qualified_at            timestamptz,
  created_at              timestamptz not null default now()
);

create index if not exists referrals_referrer_idx on public.referrals (referrer_user_id, created_at desc);
create index if not exists referrals_referred_idx on public.referrals (referred_user_id);

create table if not exists public.search_history (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  query      text not null,
  area       text,
  city       text,
  created_at timestamptz not null default now()
);

create index if not exists search_history_user_idx on public.search_history (user_id, created_at desc);

create table if not exists public.offer_redemptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  offer_id      text references public.offers (id) on delete set null,
  salon_id      text references public.salons (id) on delete set null,
  code          text,
  status        text not null default 'redeemed',
  redeemed_at   timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index if not exists offer_redemptions_user_idx on public.offer_redemptions (user_id, redeemed_at desc);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.salons enable row level security;
alter table public.salon_services enable row level security;
alter table public.salon_staff enable row level security;
alter table public.staff_slots enable row level security;
alter table public.offers enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_services enable row level security;
alter table public.favourites enable row level security;
alter table public.reviews enable row level security;
alter table public.reward_wallets enable row level security;
alter table public.reward_transactions enable row level security;
alter table public.customer_qr_payments enable row level security;
alter table public.memberships enable row level security;
alter table public.referrals enable row level security;
alter table public.search_history enable row level security;
alter table public.offer_redemptions enable row level security;

-- Catalog: read-only for any authenticated customer.

drop policy if exists "customer_catalog_salons_read" on public.salons;
create policy "customer_catalog_salons_read"
  on public.salons for select to authenticated
  using (is_active = true or is_verified = true);

drop policy if exists "customer_catalog_salon_services_read" on public.salon_services;
create policy "customer_catalog_salon_services_read"
  on public.salon_services for select to authenticated
  using (true);

drop policy if exists "customer_catalog_salon_staff_read" on public.salon_staff;
create policy "customer_catalog_salon_staff_read"
  on public.salon_staff for select to authenticated
  using (true);

drop policy if exists "customer_catalog_staff_slots_read" on public.staff_slots;
create policy "customer_catalog_staff_slots_read"
  on public.staff_slots for select to authenticated
  using (true);

drop policy if exists "customer_catalog_offers_read" on public.offers;
create policy "customer_catalog_offers_read"
  on public.offers for select to authenticated
  using (true);

-- Private customer data: owner only.

drop policy if exists "customer_bookings_select_own" on public.bookings;
create policy "customer_bookings_select_own"
  on public.bookings for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "customer_bookings_insert_own" on public.bookings;
create policy "customer_bookings_insert_own"
  on public.bookings for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "customer_bookings_update_own" on public.bookings;
create policy "customer_bookings_update_own"
  on public.bookings for update to authenticated
  using (auth.uid() = user_id);

drop policy if exists "customer_booking_services_select_own" on public.booking_services;
create policy "customer_booking_services_select_own"
  on public.booking_services for select to authenticated
  using (
    exists (select 1 from public.bookings b where b.id = booking_id and b.user_id = auth.uid())
  );

drop policy if exists "customer_booking_services_insert_own" on public.booking_services;
create policy "customer_booking_services_insert_own"
  on public.booking_services for insert to authenticated
  with check (
    exists (select 1 from public.bookings b where b.id = booking_id and b.user_id = auth.uid())
  );

drop policy if exists "customer_favourites_select_own" on public.favourites;
create policy "customer_favourites_select_own"
  on public.favourites for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "customer_favourites_insert_own" on public.favourites;
create policy "customer_favourites_insert_own"
  on public.favourites for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "customer_favourites_delete_own" on public.favourites;
create policy "customer_favourites_delete_own"
  on public.favourites for delete to authenticated
  using (auth.uid() = user_id);

drop policy if exists "customer_reviews_select" on public.reviews;
create policy "customer_reviews_select"
  on public.reviews for select to authenticated
  using (true);

drop policy if exists "customer_reviews_insert_own" on public.reviews;
create policy "customer_reviews_insert_own"
  on public.reviews for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "customer_review_wallets_select_own" on public.reward_wallets;
create policy "customer_review_wallets_select_own"
  on public.reward_wallets for select to authenticated
  using (auth.uid() = user_id);

-- Rewards wallet and transactions are read-only for the customer app. Credits,
-- redemptions and wallet mutations are performed by the backend/payment
-- verification path only.
drop policy if exists "customer_review_wallets_upsert_own" on public.reward_wallets;
drop policy if exists "customer_reward_wallets_update_own" on public.reward_wallets;
drop policy if exists "customer_reward_transactions_insert_own" on public.reward_transactions;
drop policy if exists "customer_qr_payments_insert_own" on public.customer_qr_payments;
drop policy if exists "customer_offer_redemptions_insert_own" on public.offer_redemptions;

drop policy if exists "customer_reward_transactions_select_own" on public.reward_transactions;
create policy "customer_reward_transactions_select_own"
  on public.reward_transactions for select to authenticated
  using (auth.uid() = user_id);


drop policy if exists "customer_qr_payments_select_own" on public.customer_qr_payments;
create policy "customer_qr_payments_select_own"
  on public.customer_qr_payments for select to authenticated
  using (auth.uid() = user_id);


drop policy if exists "customer_memberships_select_own" on public.memberships;
create policy "customer_memberships_select_own"
  on public.memberships for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "customer_memberships_insert_own" on public.memberships;
create policy "customer_memberships_insert_own"
  on public.memberships for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "customer_memberships_update_own" on public.memberships;
create policy "customer_memberships_update_own"
  on public.memberships for update to authenticated
  using (auth.uid() = user_id);

drop policy if exists "customer_referrals_select_own" on public.referrals;
create policy "customer_referrals_select_own"
  on public.referrals for select to authenticated
  using (auth.uid() = referrer_user_id or auth.uid() = referred_user_id);

drop policy if exists "customer_referrals_insert_own" on public.referrals;
create policy "customer_referrals_insert_own"
  on public.referrals for insert to authenticated
  with check (auth.uid() = referrer_user_id);

drop policy if exists "customer_search_history_select_own" on public.search_history;
create policy "customer_search_history_select_own"
  on public.search_history for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "customer_search_history_insert_own" on public.search_history;
create policy "customer_search_history_insert_own"
  on public.search_history for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "customer_search_history_delete_own" on public.search_history;
create policy "customer_search_history_delete_own"
  on public.search_history for delete to authenticated
  using (auth.uid() = user_id);

drop policy if exists "customer_offer_redemptions_select_own" on public.offer_redemptions;
create policy "customer_offer_redemptions_select_own"
  on public.offer_redemptions for select to authenticated
  using (auth.uid() = user_id);


-- -----------------------------------------------------------------------------
-- Helpful verification query (no data change)
-- -----------------------------------------------------------------------------

-- select table_name, table_type
-- from information_schema.tables
-- where table_schema = 'public'
--   and table_name in (
--     'profiles', 'salons', 'salon_services', 'salon_staff', 'staff_slots',
--     'bookings', 'booking_services', 'favourites', 'reviews',
--     'reward_wallets', 'reward_transactions', 'customer_qr_payments',
--     'memberships', 'referrals', 'notifications', 'search_history', 'offers',
--     'offer_redemptions'
--   )
-- order by table_name;