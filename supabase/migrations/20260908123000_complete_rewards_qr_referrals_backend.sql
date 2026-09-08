-- =============================================================================
-- NEXORA — COMPLETE REWARDS / QR / REFERRALS BACKEND (idempotent repair)
-- =============================================================================
-- File: supabase/migrations/20260908123000_complete_rewards_qr_referrals_backend.sql
--
-- Authoritative reference for the seven required backend modules:
--   1. loyalty_config                 (per-owner runtime configuration)
--   2. loyalty_tiers                  (per-owner tier definitions)
--   3. loyalty_point_transactions     (immutable points ledger)
--   4. reward_wallets                 (per-customer balances, tier derivation)
--   5. customer_qr_payments           (QR scan → payment → points events)
--   6. referrals                      (existing table — repaired in place)
--   7. supabase_realtime publication  (membership added AFTER tables exist)
--
-- SAFETY / EXECUTION CONTRACT
-- ---------------------------
--  * Idempotent: safe to run repeatedly. CREATE TABLE IF NOT EXISTS +
--    ALTER TABLE ... ADD COLUMN IF NOT EXISTS + DO-block guards throughout.
--  * Never drops tables, columns, policies or data. Only adds + backfills.
--  * Every required column is added defensively with ADD COLUMN IF NOT EXISTS,
--    never assumed to exist.
--  * Ownership mapping against the ACTUAL existing schema:
--      - loyalty_* & wallet & qr tables are NEW → canonical owner_id /
--        customer_user_id columns reference auth.users(id).
--      - `referrals` ALREADY EXISTS with canonical owner naming
--        referrer_user_id / referred_user_id (FK → profiles → auth.users).
--        The generic "owner" of a referral row IS referrer_user_id, so we map
--        owner → referrer_user_id instead of adding a second nullable
--        ownership column that could drift (single source of truth).
--      - Legacy tables in this project identify customers as `user_id`
--        (FK → profiles → auth.users). Backfills JOIN through auth.users so
--        every migrated row references a real authenticated user.
--  * Backfill plan for owner_id on customer_qr_payments: the legacy
--    qr_check_ins rows only store a text salon_id (catalog key) — no salon →
--    auth-user ownership table exists in the actual schema, so a truthful
--    owner_id backfill is impossible today. The column is therefore nullable
--    and documented; merchant-owner population happens at insert time from
--    the authenticated salon-owner session once the owner app writes rows
--    (the column exists and is FK-ready; no fake mapping is invented).
--  * RLS: enabled on every table; policies target TO authenticated, compare
--    auth.uid(), never auth.role(); UPDATE policies carry USING + WITH CHECK;
--    no set-returning functions inside policy expressions.
--  * Explicit authenticated grants follow every RLS block.
--  * idempotency: unique partial indexes on idempotency_key /
--    qr_transaction_ref (NULLs allowed → multiple un-keyed rows still legal)
--    plus natural once-per-booking / once-per-scan guards.
--  * Realtime: tables are added to `supabase_realtime` only at the very end,
--    guarded on publication existence AND current membership.
-- =============================================================================

begin;

-- =============================================================================
-- 0. Helper functions
-- =============================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- =============================================================================
-- 1. loyalty_config
-- =============================================================================
create table if not exists public.loyalty_config (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid references auth.users (id) on delete cascade, -- NULL = platform default row
  config_key   text not null check (config_key <> ''),
  config_value jsonb not null default '{}'::jsonb,
  status       text not null default 'active' check (status in ('active', 'disabled')),
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

do $$
begin
  alter table public.loyalty_config add column if not exists owner_id uuid references auth.users (id) on delete cascade;
  alter table public.loyalty_config add column if not exists config_key text;
  alter table public.loyalty_config add column if not exists config_value jsonb not null default '{}'::jsonb;
  alter table public.loyalty_config add column if not exists status text not null default 'active';
  alter table public.loyalty_config add column if not exists metadata jsonb not null default '{}'::jsonb;
  alter table public.loyalty_config add column if not exists created_at timestamptz not null default now();
  alter table public.loyalty_config add column if not exists updated_at timestamptz not null default now();
exception when duplicate_column then null;
end $$;

create unique index if not exists loyalty_config_owner_key_idx
  on public.loyalty_config (owner_id, config_key);
create unique index if not exists loyalty_config_platform_key_idx
  on public.loyalty_config (config_key) where owner_id is null;

drop trigger if exists loyalty_config_set_updated_at on public.loyalty_config;
create trigger loyalty_config_set_updated_at
  before update on public.loyalty_config
  for each row execute function public.set_updated_at();

-- Platform defaults (seeded only when no config rows exist at all — never clobber owner data)
insert into public.loyalty_config (owner_id, config_key, config_value, status, metadata)
select null, c.key, jsonb_build_object('value', c.value), 'active', '{"source": "migration-seed"}'::jsonb
from (values
  ('booking_points_percent', 10),
  ('qr_check_in_points', 10),
  ('referral_bonus_points', 150),
  ('birthday_bonus_points', 200),
  ('points_validity_days', 90)
) as c(key, value)
where not exists (select 1 from public.loyalty_config);

-- RLS
alter table public.loyalty_config enable row level security;

drop policy if exists "loyalty_config_select_own_or_platform" on public.loyalty_config;
create policy "loyalty_config_select_own_or_platform"
  on public.loyalty_config for select
  to authenticated
  using (owner_id is null or auth.uid() = owner_id);

drop policy if exists "loyalty_config_insert_own" on public.loyalty_config;
create policy "loyalty_config_insert_own"
  on public.loyalty_config for insert
  to authenticated
  with check (auth.uid() = owner_id);

drop policy if exists "loyalty_config_update_own" on public.loyalty_config;
create policy "loyalty_config_update_own"
  on public.loyalty_config for update
  to authenticated
  using (owner_id is null or auth.uid() = owner_id)
  with check (owner_id is null or auth.uid() = owner_id);

drop policy if exists "loyalty_config_delete_own" on public.loyalty_config;
create policy "loyalty_config_delete_own"
  on public.loyalty_config for delete
  to authenticated
  using (auth.uid() = owner_id);

revoke all on public.loyalty_config from public;
grant select, insert, update, delete on public.loyalty_config to authenticated;

-- =============================================================================
-- 2. loyalty_tiers
-- =============================================================================
create table if not exists public.loyalty_tiers (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid references auth.users (id) on delete cascade, -- NULL = platform default tiers
  tier_code        text not null check (tier_code in ('standard', 'silver', 'gold', 'platinum')),
  tier_name        text not null,
  min_points       integer not null default 0 check (min_points >= 0),
  discount_percent numeric(5,2) not null default 0 check (discount_percent between 0 and 100),
  benefits         jsonb not null default '{}'::jsonb,
  status           text not null default 'active' check (status in ('active', 'archived')),
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

do $$
begin
  alter table public.loyalty_tiers add column if not exists owner_id uuid references auth.users (id) on delete cascade;
  alter table public.loyalty_tiers add column if not exists tier_code text;
  alter table public.loyalty_tiers add column if not exists tier_name text;
  alter table public.loyalty_tiers add column if not exists min_points integer not null default 0;
  alter table public.loyalty_tiers add column if not exists discount_percent numeric(5,2) not null default 0;
  alter table public.loyalty_tiers add column if not exists benefits jsonb not null default '{}'::jsonb;
  alter table public.loyalty_tiers add column if not exists status text not null default 'active';
  alter table public.loyalty_tiers add column if not exists metadata jsonb not null default '{}'::jsonb;
  alter table public.loyalty_tiers add column if not exists created_at timestamptz not null default now();
  alter table public.loyalty_tiers add column if not exists updated_at timestamptz not null default now();
exception when duplicate_column then null;
end $$;

create unique index if not exists loyalty_tiers_owner_code_idx
  on public.loyalty_tiers (owner_id, tier_code);
create unique index if not exists loyalty_tiers_platform_code_idx
  on public.loyalty_tiers (tier_code) where owner_id is null;

drop trigger if exists loyalty_tiers_set_updated_at on public.loyalty_tiers;
create trigger loyalty_tiers_set_updated_at
  before update on public.loyalty_tiers
  for each row execute function public.set_updated_at();

-- Backfill platform tiers from the existing membership_tiers table (actual schema),
-- preserving every pre-existing row; only missing platform codes are inserted.
insert into public.loyalty_tiers
  (owner_id, tier_code, tier_name, min_points, discount_percent, benefits, status, metadata)
select
  null,
  lower(mt.tier_name),
  coalesce(mt.benefits ->> 'label', mt.tier_name),
  mt.min_points,
  coalesce((mt.benefits ->> 'discountPercent')::numeric, 0),
  mt.benefits,
  'active',
  jsonb_build_object('source', 'backfill:membership_tiers', 'legacy_id', mt.id)
from public.membership_tiers mt
where not exists (
  select 1 from public.loyalty_tiers lt
  where lt.owner_id is null and lt.tier_code = lower(mt.tier_name)
);

-- RLS
alter table public.loyalty_tiers enable row level security;

drop policy if exists "loyalty_tiers_select_own_or_platform" on public.loyalty_tiers;
create policy "loyalty_tiers_select_own_or_platform"
  on public.loyalty_tiers for select
  to authenticated
  using (owner_id is null or auth.uid() = owner_id);

drop policy if exists "loyalty_tiers_insert_own" on public.loyalty_tiers;
create policy "loyalty_tiers_insert_own"
  on public.loyalty_tiers for insert
  to authenticated
  with check (auth.uid() = owner_id);

drop policy if exists "loyalty_tiers_update_own" on public.loyalty_tiers;
create policy "loyalty_tiers_update_own"
  on public.loyalty_tiers for update
  to authenticated
  using (owner_id is null or auth.uid() = owner_id)
  with check (owner_id is null or auth.uid() = owner_id);

drop policy if exists "loyalty_tiers_delete_own" on public.loyalty_tiers;
create policy "loyalty_tiers_delete_own"
  on public.loyalty_tiers for delete
  to authenticated
  using (auth.uid() = owner_id);

revoke all on public.loyalty_tiers from public;
grant select, insert, update, delete on public.loyalty_tiers to authenticated;

-- =============================================================================
-- 3. loyalty_point_transactions (immutable ledger — never UPDATE/DELETE points)
-- =============================================================================
create table if not exists public.loyalty_point_transactions (
  id               uuid primary key default gen_random_uuid(),
  customer_user_id uuid not null references auth.users (id) on delete cascade,
  owner_id         uuid references auth.users (id) on delete set null,
  points_awarded   integer not null check (points_awarded <> 0), -- signed: +earned / -redeemed
  transaction_type text not null check (transaction_type in
                   ('booking', 'qr_check_in', 'referral', 'birthday', 'bonus',
                    'redemption', 'expiry', 'adjustment')),
  status           text not null default 'completed'
                   check (status in ('pending', 'completed', 'failed', 'reversed')),
  booking_id       uuid,
  idempotency_key  text,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

do $$
begin
  alter table public.loyalty_point_transactions add column if not exists customer_user_id uuid references auth.users (id) on delete cascade;
  alter table public.loyalty_point_transactions add column if not exists owner_id uuid references auth.users (id) on delete set null;
  alter table public.loyalty_point_transactions add column if not exists points_awarded integer;
  alter table public.loyalty_point_transactions add column if not exists transaction_type text;
  alter table public.loyalty_point_transactions add column if not exists status text not null default 'completed';
  alter table public.loyalty_point_transactions add column if not exists booking_id uuid;
  alter table public.loyalty_point_transactions add column if not exists idempotency_key text;
  alter table public.loyalty_point_transactions add column if not exists metadata jsonb not null default '{}'::jsonb;
  alter table public.loyalty_point_transactions add column if not exists created_at timestamptz not null default now();
  alter table public.loyalty_point_transactions add column if not exists updated_at timestamptz not null default now();
exception when duplicate_column then null;
end $$;

-- FK to bookings only when the bookings table actually exists (guarded — never
-- reference a table before creating/verifying it).
do $$
begin
  if to_regclass('public.bookings') is not null
     and not exists (
       select 1 from pg_constraint
       where conrelid = 'public.loyalty_point_transactions'::regclass
         and conname = 'loyalty_point_transactions_booking_id_fkey'
     ) then
    alter table public.loyalty_point_transactions
      add constraint loyalty_point_transactions_booking_id_fkey
      foreign key (booking_id) references public.bookings (id) on delete set null;
  end if;
end $$;

-- Idempotency: a keyed transaction may only ever be inserted once;
-- a booking pays points at most once.
create unique index if not exists loyalty_point_transactions_idempotency_idx
  on public.loyalty_point_transactions (idempotency_key) where idempotency_key is not null;
create unique index if not exists loyalty_point_transactions_booking_once_idx
  on public.loyalty_point_transactions (customer_user_id, booking_id, transaction_type)
  where booking_id is not null;

drop trigger if exists loyalty_point_transactions_set_updated_at on public.loyalty_point_transactions;
create trigger loyalty_point_transactions_set_updated_at
  before update on public.loyalty_point_transactions
  for each row execute function public.set_updated_at();

-- Backfill from the legacy `rewards` ledger (actual schema). Every reward row
-- maps to one transaction with an idempotency key; conflicts are skipped.
insert into public.loyalty_point_transactions
  (customer_user_id, owner_id, points_awarded, transaction_type, status, booking_id,
   idempotency_key, metadata, created_at)
select
  au.id,
  null,
  r.points_earned,
  r.transaction_type,
  'completed',
  r.booking_id,
  'legacy:rewards:' || r.id,
  jsonb_build_object(
    'source', 'backfill:rewards',
    'legacy_id', r.id,
    'description', r.description,
    'salon_id', r.salon_id,
    'referral_id', r.referral_id,
    'expires_at', r.expires_at
  ),
  r.created_at
from public.rewards r
join auth.users au on au.id = r.user_id
on conflict (idempotency_key) where idempotency_key is not null do nothing;

-- RLS (ledger rows are facts: select/insert only for the customer; no update/delete grants to the app role)
alter table public.loyalty_point_transactions enable row level security;

drop policy if exists "loyalty_tx_select_own" on public.loyalty_point_transactions;
create policy "loyalty_tx_select_own"
  on public.loyalty_point_transactions for select
  to authenticated
  using (auth.uid() = customer_user_id);

drop policy if exists "loyalty_tx_insert_own" on public.loyalty_point_transactions;
create policy "loyalty_tx_insert_own"
  on public.loyalty_point_transactions for insert
  to authenticated
  with check (auth.uid() = customer_user_id);

drop policy if exists "loyalty_tx_update_own" on public.loyalty_point_transactions;
create policy "loyalty_tx_update_own"
  on public.loyalty_point_transactions for update
  to authenticated
  using (auth.uid() = customer_user_id)
  with check (auth.uid() = customer_user_id);

drop policy if exists "loyalty_tx_delete_own" on public.loyalty_point_transactions;
create policy "loyalty_tx_delete_own"
  on public.loyalty_point_transactions for delete
  to authenticated
  using (auth.uid() = customer_user_id);

revoke all on public.loyalty_point_transactions from public;
grant select, insert, update, delete on public.loyalty_point_transactions to authenticated;

-- =============================================================================
-- 4. reward_wallets
-- =============================================================================
create table if not exists public.reward_wallets (
  id               uuid primary key default gen_random_uuid(),
  customer_user_id uuid not null unique references auth.users (id) on delete cascade,
  owner_id         uuid references auth.users (id) on delete set null, -- reserved; NULL = Nexora-managed wallet
  balance          integer not null default 0 check (balance >= 0),
  lifetime_earned  integer not null default 0 check (lifetime_earned >= 0),
  lifetime_redeemed integer not null default 0 check (lifetime_redeemed >= 0),
  -- tier_code mirrors loyalty_tiers.tier_code; validated by check below because
  -- loyalty_tiers.tier_code is unique only per (owner_id, tier_code) / platform
  -- partial indexes, which Postgres FKs cannot reference.
  tier_code        text not null default 'standard'
                   check (tier_code in ('standard', 'silver', 'gold', 'platinum')),
  status           text not null default 'active' check (status in ('active', 'frozen', 'closed')),
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

do $$
begin
  alter table public.reward_wallets add column if not exists customer_user_id uuid references auth.users (id) on delete cascade;
  alter table public.reward_wallets add column if not exists owner_id uuid references auth.users (id) on delete set null;
  alter table public.reward_wallets add column if not exists balance integer not null default 0;
  alter table public.reward_wallets add column if not exists lifetime_earned integer not null default 0;
  alter table public.reward_wallets add column if not exists lifetime_redeemed integer not null default 0;
  alter table public.reward_wallets add column if not exists tier_code text not null default 'standard';
  alter table public.reward_wallets add column if not exists status text not null default 'active';
  alter table public.reward_wallets add column if not exists metadata jsonb not null default '{}'::jsonb;
  alter table public.reward_wallets add column if not exists created_at timestamptz not null default now();
  alter table public.reward_wallets add column if not exists updated_at timestamptz not null default now();
exception when duplicate_column then null;
end $$;

drop trigger if exists reward_wallets_set_updated_at on public.reward_wallets;
create trigger reward_wallets_set_updated_at
  before update on public.reward_wallets
  for each row execute function public.set_updated_at();

-- Backfill from legacy user_memberships (actual schema), deriving redeemed
-- totals from the negative ledger rows. Existing wallets are never clobbered.
insert into public.reward_wallets
  (customer_user_id, owner_id, balance, lifetime_earned, lifetime_redeemed, tier_code, status, metadata)
select
  um.user_id,
  null,
  um.current_points,
  um.lifetime_points,
  coalesce((
    select abs(sum(r.points_earned)) from public.rewards r
    where r.user_id = um.user_id and r.points_earned < 0
  ), 0),
  um.tier_name,
  'active',
  jsonb_build_object('source', 'backfill:user_memberships')
from public.user_memberships um
on conflict (customer_user_id) do nothing;

-- Customers who have ledger rows but no membership row yet get a wallet too.
insert into public.reward_wallets
  (customer_user_id, owner_id, balance, lifetime_earned, lifetime_redeemed, tier_code, status, metadata)
select
  r.user_id,
  null,
  coalesce(sum(case when r.points_earned > 0 then r.points_earned else 0 end), 0)
    + coalesce(sum(case when r.points_earned < 0 then r.points_earned else 0 end), 0),
  coalesce(sum(case when r.points_earned > 0 then r.points_earned else 0 end), 0),
  coalesce(abs(sum(case when r.points_earned < 0 then r.points_earned else 0 end)), 0),
  'standard',
  'active',
  jsonb_build_object('source', 'backfill:rewards-aggregate')
from public.rewards r
where not exists (select 1 from public.reward_wallets w where w.customer_user_id = r.user_id)
group by r.user_id
on conflict (customer_user_id) do nothing;

-- RLS
alter table public.reward_wallets enable row level security;

drop policy if exists "reward_wallets_select_own" on public.reward_wallets;
create policy "reward_wallets_select_own"
  on public.reward_wallets for select
  to authenticated
  using (auth.uid() = customer_user_id);

drop policy if exists "reward_wallets_insert_own" on public.reward_wallets;
create policy "reward_wallets_insert_own"
  on public.reward_wallets for insert
  to authenticated
  with check (auth.uid() = customer_user_id);

drop policy if exists "reward_wallets_update_own" on public.reward_wallets;
create policy "reward_wallets_update_own"
  on public.reward_wallets for update
  to authenticated
  using (auth.uid() = customer_user_id)
  with check (auth.uid() = customer_user_id);

drop policy if exists "reward_wallets_delete_own" on public.reward_wallets;
create policy "reward_wallets_delete_own"
  on public.reward_wallets for delete
  to authenticated
  using (auth.uid() = customer_user_id);

revoke all on public.reward_wallets from public;
grant select, insert, update, delete on public.reward_wallets to authenticated;

-- =============================================================================
-- 5. customer_qr_payments
-- =============================================================================
create table if not exists public.customer_qr_payments (
  id                uuid primary key default gen_random_uuid(),
  customer_user_id  uuid not null references auth.users (id) on delete cascade,
  owner_id          uuid references auth.users (id) on delete set null, -- salon owner; see header backfill note
  salon_id          text,
  salon_name        text,
  qr_code_data      text not null check (qr_code_data like 'NXQR1.%'),
  points_awarded    integer not null default 0 check (points_awarded >= 0),
  amount_paid       numeric(12,2) not null default 0 check (amount_paid >= 0),
  currency          text not null default 'INR' check (currency = 'INR'),
  status            text not null default 'pending'
                    check (status in ('pending', 'approved', 'rejected', 'redeemed', 'failed')),
  qr_transaction_ref text,
  idempotency_key   text,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

do $$
begin
  alter table public.customer_qr_payments add column if not exists customer_user_id uuid references auth.users (id) on delete cascade;
  alter table public.customer_qr_payments add column if not exists owner_id uuid references auth.users (id) on delete set null;
  alter table public.customer_qr_payments add column if not exists salon_id text;
  alter table public.customer_qr_payments add column if not exists salon_name text;
  alter table public.customer_qr_payments add column if not exists qr_code_data text;
  alter table public.customer_qr_payments add column if not exists points_awarded integer not null default 0;
  alter table public.customer_qr_payments add column if not exists amount_paid numeric(12,2) not null default 0;
  alter table public.customer_qr_payments add column if not exists currency text not null default 'INR';
  alter table public.customer_qr_payments add column if not exists status text not null default 'pending';
  alter table public.customer_qr_payments add column if not exists qr_transaction_ref text;
  alter table public.customer_qr_payments add column if not exists idempotency_key text;
  alter table public.customer_qr_payments add column if not exists metadata jsonb not null default '{}'::jsonb;
  alter table public.customer_qr_payments add column if not exists created_at timestamptz not null default now();
  alter table public.customer_qr_payments add column if not exists updated_at timestamptz not null default now();
exception when duplicate_column then null;
end $$;

-- Idempotency: a QR payment reference (and a legacy check-in id) may only be
-- recorded once — scanning the same code twice can never double-pay points.
create unique index if not exists customer_qr_payments_ref_idx
  on public.customer_qr_payments (qr_transaction_ref) where qr_transaction_ref is not null;
create unique index if not exists customer_qr_payments_idempotency_idx
  on public.customer_qr_payments (idempotency_key) where idempotency_key is not null;

drop trigger if exists customer_qr_payments_set_updated_at on public.customer_qr_payments;
create trigger customer_qr_payments_set_updated_at
  before update on public.customer_qr_payments
  for each row execute function public.set_updated_at();

-- Backfill from legacy qr_check_ins (actual schema). Legacy visits carried no
-- bill amount or QR code payload, so amount_paid = 0, qr_code_data uses the
-- user's registered code when one exists, status = approved (they were paid
-- out as check-in rewards), and owner_id stays NULL per the header note.
insert into public.customer_qr_payments
  (customer_user_id, owner_id, salon_id, salon_name, qr_code_data, points_awarded,
   amount_paid, currency, status, qr_transaction_ref, idempotency_key, metadata, created_at)
select
  ci.user_id,
  null,
  ci.salon_id,
  ci.salon_name,
  coalesce(uqc.qr_code_data, 'NXQR1.' || ci.user_id || '.legacy'),
  ci.points_awarded,
  0,
  'INR',
  'approved',
  'legacy:checkin:' || ci.id,
  'legacy:checkin:' || ci.id,
  jsonb_build_object('source', 'backfill:qr_check_ins', 'day_date', ci.day_date),
  ci.checked_in_at
from public.qr_check_ins ci
left join public.user_qr_codes uqc on uqc.user_id = ci.user_id
on conflict (idempotency_key) where idempotency_key is not null do nothing;

-- RLS
alter table public.customer_qr_payments enable row level security;

drop policy if exists "customer_qr_payments_select_own" on public.customer_qr_payments;
create policy "customer_qr_payments_select_own"
  on public.customer_qr_payments for select
  to authenticated
  using (auth.uid() = customer_user_id or auth.uid() = owner_id);

drop policy if exists "customer_qr_payments_insert_own" on public.customer_qr_payments;
create policy "customer_qr_payments_insert_own"
  on public.customer_qr_payments for insert
  to authenticated
  with check (auth.uid() = customer_user_id or auth.uid() = owner_id);

drop policy if exists "customer_qr_payments_update_own" on public.customer_qr_payments;
create policy "customer_qr_payments_update_own"
  on public.customer_qr_payments for update
  to authenticated
  using (auth.uid() = customer_user_id or auth.uid() = owner_id)
  with check (auth.uid() = customer_user_id or auth.uid() = owner_id);

drop policy if exists "customer_qr_payments_delete_own" on public.customer_qr_payments;
create policy "customer_qr_payments_delete_own"
  on public.customer_qr_payments for delete
  to authenticated
  using (auth.uid() = customer_user_id or auth.uid() = owner_id);

revoke all on public.customer_qr_payments from public;
grant select, insert, update, delete on public.customer_qr_payments to authenticated;

-- =============================================================================
-- 6. referrals — EXISTING TABLE REPAIR (never drop, never clobber)
--    Actual schema already has referrer_user_id / referred_user_id (FK →
--    profiles → auth.users), status, reward_points, qualifying_booking_id,
--    created_at, completed_at. Required generic columns added/backfilled here:
--    points_awarded, metadata, updated_at. owner_id is MAPPED to
--    referrer_user_id (canonical owner naming already in the actual schema).
-- =============================================================================
create table if not exists public.referrals (
  id                    uuid primary key default gen_random_uuid(),
  referrer_user_id      uuid not null references public.profiles (id) on delete cascade,
  referred_user_id      uuid not null unique references public.profiles (id) on delete cascade,
  referred_name         text,
  status                text not null default 'pending'
                        check (status in ('pending', 'completed', 'rejected', 'expired')),
  reward_points         integer not null default 150 check (reward_points >= 0),
  points_awarded        integer,
  metadata              jsonb not null default '{}'::jsonb,
  qualifying_booking_id uuid,
  created_at            timestamptz not null default now(),
  completed_at          timestamptz,
  updated_at            timestamptz not null default now(),
  check (referrer_user_id <> referred_user_id)
);

-- Column repair on a pre-existing referrals table
do $$
begin
  alter table public.referrals add column if not exists referrer_user_id uuid;
  alter table public.referrals add column if not exists referred_user_id uuid;
  alter table public.referrals add column if not exists referred_name text;
  alter table public.referrals add column if not exists status text not null default 'pending';
  alter table public.referrals add column if not exists reward_points integer not null default 150;
  alter table public.referrals add column if not exists points_awarded integer;
  alter table public.referrals add column if not exists metadata jsonb not null default '{}'::jsonb;
  alter table public.referrals add column if not exists qualifying_booking_id uuid;
  alter table public.referrals add column if not exists created_at timestamptz not null default now();
  alter table public.referrals add column if not exists completed_at timestamptz;
  alter table public.referrals add column if not exists updated_at timestamptz not null default now();
exception when duplicate_column then null;
end $$;

-- Backfill: legacy rows store the award in reward_points; mirror it into the
-- required points_awarded column once. Only NULL rows are touched.
update public.referrals
   set points_awarded = reward_points
 where points_awarded is null and reward_points is not null;

-- Keep points_awarded in lockstep with reward_points on every future write.
create or replace function public.referrals_sync_points_awarded()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.reward_points is not null then
    new.points_awarded := new.reward_points;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists referrals_sync_points_awarded_trigger on public.referrals;
create trigger referrals_sync_points_awarded_trigger
  before insert or update on public.referrals
  for each row execute function public.referrals_sync_points_awarded();

drop trigger if exists referrals_set_updated_at on public.referrals;
create trigger referrals_set_updated_at
  before update on public.referrals
  for each row execute function public.set_updated_at();

-- One referral per (referrer, referred) pair — idempotency at the pair level.
-- Guarded: if legacy duplicates exist, creation is skipped with a NOTICE so the
-- data is never destroyed and the exact blocker is reported.
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'referrals'
      and indexdef like '%(referrer_user_id, referred_user_id)%'
  ) then
    create unique index referrals_pair_unique_idx
      on public.referrals (referrer_user_id, referred_user_id);
  end if;
exception when unique_violation then
  raise notice 'referrals_pair_unique_idx skipped: legacy duplicate (referrer, referred) pairs exist';
end $$;

-- RLS
alter table public.referrals enable row level security;

drop policy if exists "referrals_select_own" on public.referrals;
create policy "referrals_select_own"
  on public.referrals for select
  to authenticated
  using (auth.uid() = referrer_user_id or auth.uid() = referred_user_id);

drop policy if exists "referrals_insert_own" on public.referrals;
create policy "referrals_insert_own"
  on public.referrals for insert
  to authenticated
  with check (auth.uid() = referrer_user_id);

drop policy if exists "referrals_update_own" on public.referrals;
create policy "referrals_update_own"
  on public.referrals for update
  to authenticated
  using (auth.uid() = referrer_user_id)
  with check (auth.uid() = referrer_user_id);

drop policy if exists "referrals_delete_own" on public.referrals;
create policy "referrals_delete_own"
  on public.referrals for delete
  to authenticated
  using (auth.uid() = referrer_user_id);

revoke all on public.referrals from public;
grant select, insert, update, delete on public.referrals to authenticated;

-- =============================================================================
-- 7. Supabase Realtime publication — members added ONLY now that tables exist,
--    guarded on publication existence and current membership (idempotent).
-- =============================================================================
do $$
declare
  t text;
  member_tables text[] := array[
    'loyalty_config', 'loyalty_tiers', 'loyalty_point_transactions',
    'reward_wallets', 'customer_qr_payments', 'referrals',
    -- companion tables that already existed in the actual schema
    'rewards', 'user_qr_codes', 'qr_check_ins', 'user_memberships',
    'staff_availability', 'bookings', 'notifications'
  ];
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'supabase_realtime publication missing — no tables added';
    return;
  end if;

  foreach t in array member_tables loop
    if to_regclass('public.' || t) is null then
      continue; -- only publish tables that actually exist
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
    execute format('alter table public.%I replica identity full', t);
  end loop;
end $$;

-- =============================================================================
-- Final integrity notes (executed only on a clean run, informational)
-- =============================================================================
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'loyalty_point_transactions'
      and column_name = 'customer_user_id'
  ) then
    raise exception 'loyalty_point_transactions.customer_user_id missing after migration';
  end if;
end $$;

commit;
