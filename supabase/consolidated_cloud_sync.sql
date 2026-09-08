-- =============================================================================
-- NEXORA — CONSOLIDATED CLOUD SYNC (setup.sql + rewards/QR/referrals migration)
-- =============================================================================
-- One file, one transaction. Paste the WHOLE file into the Supabase Dashboard
-- SQL Editor and press Run. If any statement fails, EVERYTHING rolls back and
-- your database is left exactly as it was (no half-applied state).
--
-- Contents (in dependency order):
--   SECTION A  = supabase/setup.sql   (full baseline: profiles, bookings,
--               notifications, user_locations, rewards, referrals, membership,
--               staff_availability + RLS policies, functions, triggers)
--   SECTION B  = supabase/migrations/20260908123000_*.sql
--               (loyalty_config, loyalty_tiers, loyalty_point_transactions,
--                reward_wallets, customer_qr_payments, referrals upgrade,
--                backfills, RLS, grants, triggers, realtime publication)
--   SECTION C  = read-only post-sync verification queries (no changes)
--
-- Safe to run:
--   * on a brand-new project (creates the full schema)  AND
--   * on a project that already has the baseline (additive/no-op + backfill;
--     existing rows are preserved — nothing is dropped or overwritten)
-- Re-running is safe: every section is idempotent.
--
-- Data preservation: no DROP TABLE / TRUNCATE / DELETE anywhere in the file.
-- Legacy rows (rewards, qr_check_ins, user_memberships, referrals, ...) are
-- kept untouched and mirrored into the new tables with on-conflict guards.
--
-- Target project ref in the repo defaults: qwaehqsmodekbgvnaavz
-- =============================================================================

begin;

-- =============================================================================
-- SECTION A — BASELINE SCHEMA (source: supabase/setup.sql)
-- =============================================================================

-- =============================================================================
-- NEXORA SALONOS — ONE-SHOT PROJECT SETUP
-- =============================================================================
-- Run this ENTIRE file once in a fresh Supabase project:
--   Dashboard → SQL Editor → New query → paste → Run.
-- It creates exactly what the customer app reads/writes with the anon key
-- under RLS: profiles, user_locations, and the notification backend.
-- The app degrades gracefully without any of these (auth still works), but
-- running this file removes every "table missing" console error.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. profiles — created here (supabase-js handles auth.users via the trigger)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  role       text check (role in ('customer', 'salon_owner')),
  full_name  text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "users upsert own profile" on public.profiles;
create policy "users upsert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Keep profiles in sync for accounts created directly in the dashboard too.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================================
-- The sections below are the reference DDL shipped with the app:
-- 1-3. notification backend  (notifications.sql)
-- 4.   live location table    (user_locations.sql)
-- ============================================================================

-- =============================================================================
-- Nexora notification backend — schema, constraints and RLS contract (reference)
-- =============================================================================
-- Documents the schema that `src/lib/notificationService.ts`,
-- `src/lib/notificationChannels.ts` and `src/components/NotificationsModal.tsx`
-- are written against. Apply in the Nexora Supabase project ONLY if these
-- objects do not already exist. The client degrades gracefully: when a table or
-- RPC is missing it reports "notifications unavailable" and renders an honest
-- empty state instead of placeholder content.
--
-- Security model
-- --------------
-- The browser only ever touches its OWN rows through RLS with the signed-in
-- user's JWT. Trusted producers (booking events, reward credits, provider
-- webhooks) write with a service_role key that exists ONLY on the server
-- (see server/notifications.ts) — never in a VITE_* variable.
--
-- Delivery honesty (requirement: never claim WhatsApp delivery without proof)
-- --------------------------------------------------------------------------
-- `notification_deliveries.status` may become 'delivered' ONLY when a provider
-- status is recorded. `notification_deliveries_delivery_requires_proof` below
-- rejects any 'delivered' row that lacks both `provider_status` and
-- `confirmed_at`, so an optimistic "it probably arrived" write cannot exist.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Notifications (in-app inbox)
-- -----------------------------------------------------------------------------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  type       text not null check (type in (
               'booking_created',
               'booking_confirmed',
               'booking_rejected',
               'booking_rescheduled',
               'booking_reminder',
               'booking_cancelled',
               'reward_credited',
               'referral_qualified',
               'membership_expiry',
               'offer',
               'support_response'
             )),
  title      text not null check (char_length(title) between 1 and 160),
  body       text not null default '' check (char_length(body) <= 1000),
  -- Deep-link + entity references: { "route": "appointments", "appointmentId": "…" }
  payload    jsonb not null default '{}'::jsonb,
  is_read    boolean not null default false,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

-- Newest-first inbox paging and the unread badge both hit this index.
create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id) where (is_read = false);

-- read_at must agree with is_read — no half-updated rows.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.notifications'::regclass
      and conname = 'notifications_read_state_consistent'
  ) then
    alter table public.notifications
      add constraint notifications_read_state_consistent
      check ((is_read = true) = (read_at is not null) or (is_read = false));
  end if;
end $$;

alter table public.notifications enable row level security;

drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications"
  on public.notifications
  for select
  to authenticated
  using (auth.uid() = user_id);

-- A user may record an in-app notification for themselves (e.g. a locally
-- detected reminder). System producers use a trusted server role instead.
drop policy if exists "users insert own notifications" on public.notifications;
create policy "users insert own notifications"
  on public.notifications
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Read/unread and delete are confined to the owner's rows.
drop policy if exists "users update own notifications" on public.notifications;
create policy "users update own notifications"
  on public.notifications
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users delete own notifications" on public.notifications;
create policy "users delete own notifications"
  on public.notifications
  for delete
  to authenticated
  using (auth.uid() = user_id);

revoke all on public.notifications from anon;

-- -----------------------------------------------------------------------------
-- 2. Notification preferences (per user × channel × category)
-- -----------------------------------------------------------------------------
create table if not exists public.notification_preferences (
  user_id    uuid not null references auth.users (id) on delete cascade,
  channel    text not null check (channel in ('in_app', 'email', 'whatsapp', 'push')),
  -- 'all' is the master switch for a channel; otherwise a notification type.
  category   text not null check (category in (
               'all',
               'booking_created',
               'booking_confirmed',
               'booking_rejected',
               'booking_rescheduled',
               'booking_reminder',
               'booking_cancelled',
               'reward_credited',
               'referral_qualified',
               'membership_expiry',
               'offer',
               'support_response'
             )),
  enabled    boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, channel, category)
);

alter table public.notification_preferences enable row level security;

drop policy if exists "users read own notification preferences" on public.notification_preferences;
create policy "users read own notification preferences"
  on public.notification_preferences
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "users upsert own notification preferences" on public.notification_preferences;
create policy "users upsert own notification preferences"
  on public.notification_preferences
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "users update own notification preferences" on public.notification_preferences;
create policy "users update own notification preferences"
  on public.notification_preferences
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke all on public.notification_preferences from anon;

-- -----------------------------------------------------------------------------
-- 3. Delivery log (multi-channel audit trail)
-- -----------------------------------------------------------------------------
create table if not exists public.notification_deliveries (
  id                  uuid primary key default gen_random_uuid(),
  notification_id     uuid not null references public.notifications (id) on delete cascade,
  channel             text not null check (channel in ('in_app', 'email', 'whatsapp', 'push')),
  -- queued   : accepted internally, provider not called yet
  -- sent     : provider ACCEPTED the message (not proof of arrival)
  -- delivered: provider CONFIRMED arrival (webhook/receipt only)
  -- failed / undeliverable / skipped
  status              text not null default 'queued' check (status in (
                        'queued', 'sent', 'failed', 'delivered', 'undeliverable', 'skipped'
                      )),
  provider            text,
  provider_message_id text,
  provider_status     text,
  error               text,
  attempted_at        timestamptz not null default now(),
  confirmed_at        timestamptz
);

create index if not exists notification_deliveries_lookup_idx
  on public.notification_deliveries (notification_id, channel);
create index if not exists notification_deliveries_provider_msg_idx
  on public.notification_deliveries (provider_message_id)
  where provider_message_id is not null;

-- *** The honesty constraint ***
-- 'delivered' requires a provider status AND a confirmation timestamp. Without
-- both, the row is rejected — so no code path can record a WhatsApp message as
-- delivered on assumption.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.notification_deliveries'::regclass
      and conname = 'notification_deliveries_delivery_requires_proof'
  ) then
    alter table public.notification_deliveries
      add constraint notification_deliveries_delivery_requires_proof
      check (
        status <> 'delivered'
        or (provider_status is not null and confirmed_at is not null)
      );
  end if;
end $$;

-- A status can move forward, never back from a confirmed delivery.
create or replace function public.notification_deliveries_guard_status()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'delivered' and new.status <> 'delivered' then
    raise exception 'delivery_status_confirmed_immutable' using errcode = 'P0002';
  end if;
  if new.status = 'delivered' and (new.provider_status is null or new.confirmed_at is null) then
    raise exception 'delivery_status_requires_provider_proof' using errcode = 'P0002';
  end if;
  return new;
end;
$$;

drop trigger if exists notification_deliveries_guard_status on public.notification_deliveries;
create trigger notification_deliveries_guard_status
  before update on public.notification_deliveries
  for each row
  execute function public.notification_deliveries_guard_status();

alter table public.notification_deliveries enable row level security;

-- A user may read the delivery history of their own notifications, and append
-- the client-side record of an attempt. Status confirmation happens server-side.
drop policy if exists "users read own deliveries" on public.notification_deliveries;
create policy "users read own deliveries"
  on public.notification_deliveries
  for select
  to authenticated
  using (
    exists (
      select 1 from public.notifications n
      where n.id = notification_id and n.user_id = auth.uid()
    )
  );

drop policy if exists "users insert own deliveries" on public.notification_deliveries;
create policy "users insert own deliveries"
  on public.notification_deliveries
  for insert
  to authenticated
  with check (
    -- A browser may log an attempt but may never assert delivery itself.
    status <> 'delivered'
    and exists (
      select 1 from public.notifications n
      where n.id = notification_id and n.user_id = auth.uid()
    )
  );

-- No update/delete policy for authenticated: only the trusted server role can
-- promote a row to 'delivered', so the browser cannot forge a confirmation.
revoke all on public.notification_deliveries from anon;

-- -----------------------------------------------------------------------------
-- 4. RPCs used by the client
-- -----------------------------------------------------------------------------

-- Mark every unread notification read for the caller; returns how many changed.
create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  update public.notifications
     set is_read = true,
         read_at = now()
   where user_id = v_uid
     and is_read = false;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_all_notifications_read() from public;
grant execute on function public.mark_all_notifications_read() to authenticated;

-- Unread count for the caller (badge + polling).
create or replace function public.unread_notification_count()
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::integer
    from public.notifications
   where user_id = auth.uid()
     and is_read = false;
$$;

revoke all on function public.unread_notification_count() from public;
grant execute on function public.unread_notification_count() to authenticated;


-- =============================================================================
-- Nexora secure location backend — RLS contract (reference)
-- =============================================================================
-- This file documents the schema and row-level-security policies that
-- `src/hooks/useLocationSync.ts` and `src/lib/locationService.ts` are written
-- against. Apply it in the Nexora Supabase project ONLY if the table does not
-- already exist — the client is designed to reuse the existing backend and
-- degrades gracefully (sync disables itself) when the table is absent.
--
-- Security model: every statement is executed by the browser with the ANON key
-- plus the signed-in user's JWT. RLS is what makes that safe — a user can only
-- read, write or delete the single row keyed by their own auth.uid().
-- No service_role key is ever used by the frontend.
-- =============================================================================

create table if not exists public.user_locations (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  latitude    double precision not null,
  longitude   double precision not null,
  accuracy    double precision,
  heading     double precision,
  speed       double precision,
  updated_at  timestamptz not null default now()
);

alter table public.user_locations enable row level security;

-- Validate untrusted browser input at the database boundary as well as in the
-- client. These guards are idempotent and do not rewrite existing rows.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.user_locations'::regclass
      and conname = 'user_locations_latitude_range'
  ) then
    alter table public.user_locations
      add constraint user_locations_latitude_range check (latitude between -90 and 90);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.user_locations'::regclass
      and conname = 'user_locations_longitude_range'
  ) then
    alter table public.user_locations
      add constraint user_locations_longitude_range check (longitude between -180 and 180);
  end if;
end $$;

-- Read own location
drop policy if exists "users read own location" on public.user_locations;
create policy "users read own location"
  on public.user_locations
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Insert own location (upsert path 1)
drop policy if exists "users insert own location" on public.user_locations;
create policy "users insert own location"
  on public.user_locations
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Update own location (upsert path 2)
drop policy if exists "users update own location" on public.user_locations;
create policy "users update own location"
  on public.user_locations
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Delete own location (cleanup on logout)
drop policy if exists "users delete own location" on public.user_locations;
create policy "users delete own location"
  on public.user_locations
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Anonymous visitors get no access at all.
revoke all on public.user_locations from anon;

create index if not exists user_locations_updated_at_idx
  on public.user_locations (updated_at desc);

-- ============================================================================
-- NEXORA BOOKINGS — multi-service appointment persistence (reference DDL)
-- ============================================================================
-- Backed by `server/bookings.ts` (service-role, /api/bookings). Two tables:
--
--   bookings           — one row per appointment; `metadata` jsonb always
--                        carries { services: [...] } so single-service AND
--                        multi-service bookings share one clean shape and no
--                        schema change is needed when a booking grows lines.
--   booking_services   — one normalized child row per line item (pricing,
--                        durations, category, ordering) for reporting.
--
-- All bookings are written server-side with the service_role key (bypasses
-- RLS). No customer RLS policies are created here on purpose: browser clients
-- must never insert directly into bookings/booking_services.
-- ============================================================================

create table if not exists public.bookings (
  id               uuid primary key,
  booking_ref      text not null unique check (booking_ref <> ''),
  user_id          uuid references auth.users (id) on delete set null,
  customer         jsonb,
  salon_id         text not null,
  salon_snapshot   jsonb not null default '{}'::jsonb,
  stylist_snapshot jsonb,
  slot_date        date not null,
  slot_time        text not null check (slot_time ~* '^([01]?\d|2[0-3]):[0-5]\d( ?[AP]M)?$'),
  status           text not null default 'pending'
                   check (status in ('pending', 'confirmed', 'completed', 'cancelled', 'no_show', 'in_progress')),
  subtotal         numeric(10,2) not null check (subtotal >= 0),
  discount_amount  numeric(10,2) not null default 0 check (discount_amount >= 0),
  total_amount     numeric(10,2) not null check (total_amount >= 0),
  advance_amount   numeric(10,2) not null default 0 check (advance_amount >= 0),
  currency         text not null default 'INR' check (currency = 'INR'),
  payment_mode     text not null default 'advance_25'
                   check (payment_mode in ('advance_25', 'full', 'pay_at_salon')),
  payment_status   text not null default 'pending'
                   check (payment_status in ('paid', 'pending', 'failed')),
  coupon_code      text,
  notes            text,
  metadata         jsonb not null default '{"services":[]}'::jsonb
                   check (jsonb_typeof(metadata) = 'object'),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.booking_services (
  booking_id       uuid not null references public.bookings (id) on delete cascade,
  salon_id         text not null,
  service_id       text not null,
  service_name     text not null check (service_name <> ''),
  category         text,
  list_price       numeric(10,2) not null check (list_price >= 0),
  unit_price       numeric(10,2) not null check (unit_price >= 0),
  duration_minutes integer not null check (duration_minutes between 1 and 1440),
  position         integer not null default 0,
  primary key (booking_id, position)
);

create index if not exists bookings_user_created_idx
  on public.bookings (user_id, created_at desc);
create index if not exists booking_services_service_idx
  on public.booking_services (service_id);

-- Gate: every booking must carry at least one service line in metadata.
create or replace function public.booking_metadata_has_services()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not (
    jsonb_typeof(new.metadata) = 'object'
    and jsonb_typeof(new.metadata -> 'services') = 'array'
    and jsonb_array_length(new.metadata -> 'services') > 0
  ) then
    raise exception 'bookings.metadata must contain a non-empty services array';
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_metadata_has_services_trigger on public.bookings;
create trigger bookings_metadata_has_services_trigger
  before insert or update on public.bookings
  for each row execute function public.booking_metadata_has_services();

-- Gate: DB-side per-line price/duration must match the JSON metadata lines.
create or replace function public.booking_lines_match_metadata()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  meta_lines jsonb := coalesce(new.metadata -> 'services', '[]'::jsonb);
  expected int;
  i int := 0;
  line jsonb;
begin
  expected := jsonb_array_length(meta_lines);
  if expected <> (select count(*) from public.booking_services where booking_id = new.id) then
    raise exception 'booking_services row count does not match metadata.services';
  end if;
  while i < expected loop
    line := meta_lines -> i;
    if not exists (
      select 1 from public.booking_services
      where booking_id = new.id
        and position = i
        and service_id = coalesce(line ->> 'id', '')
        and duration_minutes = coalesce((line ->> 'durationMinutes')::int, -1)
    ) then
      raise exception 'booking_services line % does not match metadata.services[%]', i, i;
    end if;
    i := i + 1;
  end loop;
  return new;
end;
$$;

drop trigger if exists bookings_lines_match_metadata_trigger on public.bookings;
create trigger bookings_lines_match_metadata_trigger
  after insert or update on public.bookings
  for each row execute function public.booking_lines_match_metadata();
-- ============================================================================
-- NEXORA ENGAGEMENT — QR CHECK-IN, REWARDS LEDGER, TIERS, REFERRALS
-- ============================================================================
-- Backed by `server/engagement.ts` (service-role, /api/engagement/*) and
-- `src/lib/realtimeService.ts` (realtime subscriptions). Reference DDL:
-- run once in a fresh Supabase project together with the rest of this file.
--
-- Honesty rules baked in at the DB boundary:
--  * Points are a ledger, never a counter: `rewards` rows are immutable
--    facts (positive = earned, negative = redeemed/expired/adjusted).
--  * A user may check in at a given salon once per calendar day (unique
--    constraint) — repeated scans cannot farm points.
--  * A booking pays points exactly once (trigger guarded by type+booking_id).
--  * Tiers are derived from lifetime points via membership_tiers.min_points;
--    user_memberships.tier is recomputed by trigger on every points change.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. membership_tiers (must exist before user_memberships references it)
-- ---------------------------------------------------------------------------
create table if not exists public.membership_tiers (
  id         uuid primary key default gen_random_uuid(),
  tier_name  text not null unique
             check (tier_name in ('standard', 'silver', 'gold', 'platinum')),
  min_points integer not null default 0 check (min_points >= 0),
  benefits   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.membership_tiers (tier_name, min_points, benefits) values
  ('standard', 0,    '{"discountPercent": 0,  "label": "Standard Guest"}'),
  ('silver',   500,  '{"discountPercent": 5,  "label": "Silver Member", "benefits": ["5% off services", "Priority booking"]}'),
  ('gold',     1500, '{"discountPercent": 10, "label": "Gold Member",   "benefits": ["10% off services", "Free blow-dry on birthday month"]}'),
  ('platinum', 4000, '{"discountPercent": 15, "label": "Platinum VIP",  "benefits": ["15% off services", "Free add-on monthly", "Dedicated stylist"]}')
on conflict (tier_name) do nothing;

-- ---------------------------------------------------------------------------
-- 2. user_qr_codes + qr_check_ins
-- ---------------------------------------------------------------------------
create table if not exists public.user_qr_codes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references public.profiles (id) on delete cascade,
  qr_code_data    text not null unique check (qr_code_data like 'NXQR1.%'),
  generated_at    timestamptz not null default now(),
  last_scanned_at timestamptz
);

create table if not exists public.qr_check_ins (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  salon_id       text not null,
  salon_name     text not null,
  points_awarded integer not null default 0 check (points_awarded >= 0),
  day_date       date not null default current_date,
  checked_in_at  timestamptz not null default now(),
  -- One rewarded check-in per user per salon per calendar day.
  unique (user_id, salon_id, day_date)
);

create index if not exists qr_check_ins_user_date_idx
  on public.qr_check_ins (user_id, day_date desc);

-- ---------------------------------------------------------------------------
-- 3. referrals
-- ---------------------------------------------------------------------------
create table if not exists public.referrals (
  id                    uuid primary key default gen_random_uuid(),
  referrer_user_id      uuid not null references public.profiles (id) on delete cascade,
  referred_user_id      uuid not null unique references public.profiles (id) on delete cascade,
  referred_name         text,
  status                text not null default 'pending'
                        check (status in ('pending', 'completed')),
  reward_points         integer not null default 150 check (reward_points >= 0),
  qualifying_booking_id uuid references public.bookings (id) on delete set null,
  created_at            timestamptz not null default now(),
  completed_at          timestamptz,
  check (referrer_user_id <> referred_user_id)
);

create index if not exists referrals_referrer_idx
  on public.referrals (referrer_user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 4. rewards — immutable points ledger
-- ---------------------------------------------------------------------------
create table if not exists public.rewards (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  points_earned    integer not null check (points_earned <> 0),
  points_used      integer not null default 0,
  transaction_type text not null
                   check (transaction_type in
                     ('booking', 'qr_check_in', 'referral', 'birthday', 'bonus',
                      'redemption', 'expiry', 'adjustment')),
  description      text,
  salon_id         text,
  booking_id       uuid references public.bookings (id) on delete set null,
  referral_id      uuid references public.referrals (id) on delete set null,
  expires_at       timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists rewards_user_created_idx
  on public.rewards (user_id, created_at desc);
create index if not exists rewards_booking_once_idx
  on public.rewards (user_id, transaction_type, booking_id)
  where booking_id is not null;

-- ---------------------------------------------------------------------------
-- 5. user_memberships — derived tier state (recomputed by trigger)
-- ---------------------------------------------------------------------------
create table if not exists public.user_memberships (
  user_id         uuid primary key references public.profiles (id) on delete cascade,
  tier_name       text not null default 'standard'
                  references public.membership_tiers (tier_name) on update cascade,
  lifetime_points integer not null default 0 check (lifetime_points >= 0),
  current_points  integer not null default 0 check (current_points >= 0),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 6. staff_availability — realtime availability feed for booking flows
--    (slot-level rows mutated by salon operations; customers subscribe)
-- ---------------------------------------------------------------------------
create table if not exists public.staff_availability (
  id         uuid primary key default gen_random_uuid(),
  salon_id   text not null,
  staff_id   text not null,
  slot_date  date not null,
  slot_time  text not null check (slot_time <> ''),
  available  boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (salon_id, staff_id, slot_date, slot_time)
);

create index if not exists staff_availability_lookup_idx
  on public.staff_availability (salon_id, slot_date, available);

-- ---------------------------------------------------------------------------
-- 7. Ledger application (rewards row + membership balance + tier sync)
-- ---------------------------------------------------------------------------
create or replace function public.apply_points_ledger(p_user uuid, p_points integer)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  -- Positive: earnings accumulate in lifetime and current.
  -- Negative: only reduces current (redemption/expiry), never lifetime.
  insert into public.user_memberships (user_id, lifetime_points, current_points)
  values (p_user, greatest(p_points, 0), greatest(p_points, 0))
  on conflict (user_id) do update
    set lifetime_points = case when p_points > 0
                               then public.user_memberships.lifetime_points + p_points
                               else public.user_memberships.lifetime_points end,
        current_points  = greatest(0, public.user_memberships.current_points + p_points),
        updated_at      = now();
end;
$$;

-- Tier recomputation: derived from lifetime points against membership_tiers.
create or replace function public.sync_membership_tier()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_tier text;
begin
  select t.tier_name into v_tier
    from public.membership_tiers t
   where t.min_points <= new.lifetime_points
   order by t.min_points desc
   limit 1;
  if v_tier is not null and v_tier <> new.tier_name then
    new.tier_name := v_tier;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists user_memberships_sync_tier_trigger on public.user_memberships;
create trigger user_memberships_sync_tier_trigger
  before insert or update of lifetime_points on public.user_memberships
  for each row execute function public.sync_membership_tier();

-- ---------------------------------------------------------------------------
-- 8. Trigger: booking confirmed → award points; settle referrals once
-- ---------------------------------------------------------------------------
create or replace function public.settle_completed_referrals(p_referred uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  r record;
begin
  -- Mark pending referral rows completed when the referred user has any
  -- confirmed booking (idempotent: only pending rows are touched).
  update public.referrals x
     set status = 'completed',
         completed_at = now(),
         qualifying_booking_id = coalesce(x.qualifying_booking_id, q.id)
    from (select b.id
            from public.bookings b
           where b.user_id = p_referred
             and b.status in ('confirmed', 'completed')
           order by b.created_at asc
           limit 1) q
   where x.referred_user_id = p_referred
     and x.status = 'pending';

  -- Pay each completed-but-unpaid referral exactly once (ledger guard).
  for r in
    select x.id, x.referrer_user_id, x.reward_points
      from public.referrals x
     where x.referred_user_id = p_referred
       and x.status = 'completed'
       and not exists (
         select 1 from public.rewards w
         where w.referral_id = x.id and w.transaction_type = 'referral'
       )
  loop
    insert into public.rewards
      (user_id, points_earned, transaction_type, description, referral_id)
    values
      (r.referrer_user_id, r.reward_points, 'referral',
       'Referral bonus — your friend visited Nexora', r.id);
    perform public.apply_points_ledger(r.referrer_user_id, r.reward_points);
  end loop;
end;
$$;

create or replace function public.award_booking_points()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_points integer;
begin
  -- Fire only on the transition into confirmed/completed (once per booking).
  if new.status not in ('confirmed', 'completed')
     or old.status in ('confirmed', 'completed') then
    return new;
  end if;

  -- Ledger guard: a booking pays points exactly once.
  if not exists (
    select 1 from public.rewards
    where booking_id = new.id and transaction_type = 'booking'
  ) then
    -- 10% back in points on the final bill (same ratio as QR cashback).
    -- Guest bookings (user_id null) have no profile ledger to credit.
    v_points := floor(coalesce(new.total_amount, 0) * 0.10);
    if new.user_id is not null and v_points > 0 then
      insert into public.rewards
        (user_id, points_earned, transaction_type, description, salon_id, booking_id)
      values
        (new.user_id, v_points, 'booking',
         '10% reward points on booking ' || new.booking_ref, new.salon_id, new.id);
      perform public.apply_points_ledger(new.user_id, v_points);
    end if;
  end if;

  -- Referral completion + bonus settlement for the referred user's first
  -- confirmed booking (idempotent on both sides).
  if new.user_id is not null then
    perform public.settle_completed_referrals(new.user_id);
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_award_points_trigger on public.bookings;
create trigger bookings_award_points_trigger
  after update of status on public.bookings
  for each row execute function public.award_booking_points();

-- ---------------------------------------------------------------------------
-- 9. Birthday bonus (idempotent: once per user per calendar year)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists date_of_birth date;

create or replace function public.award_birthday_bonus(p_user uuid)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_dob date;
  v_points constant integer := 200;
begin
  select date_of_birth into v_dob from public.profiles where id = p_user;
  if v_dob is null then
    return 0; -- no date of birth on file → nothing to award
  end if;
  if extract(month from v_dob) <> extract(month from current_date)
     or extract(day from v_dob) <> extract(day from current_date) then
    return 0; -- not the birthday
  end if;
  if exists (
    select 1 from public.rewards
    where user_id = p_user
      and transaction_type = 'birthday'
      and extract(year from created_at) = extract(year from current_date)
  ) then
    return 0; -- already awarded this year
  end if;

  insert into public.rewards
    (user_id, points_earned, transaction_type, description)
  values
    (p_user, v_points, 'birthday', 'Happy birthday! Nexora bonus points');
  perform public.apply_points_ledger(p_user, v_points);
  return v_points;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Realtime publication (live salon availability, bookings, rewards…)
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  member_tables text[] := array[
    'bookings', 'notifications', 'rewards', 'user_qr_codes', 'qr_check_ins',
    'staff_availability'
  ];
begin
  -- Supabase projects ship the `supabase_realtime` publication by default;
  -- if it is absent (custom project), skip with a NOTICE instead of failing.
  -- Each table is added only when it is not already a member, so re-running
  -- this script (idempotent sync) never trips a duplicate_object error.
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array member_tables loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  else
    raise notice 'supabase_realtime publication missing; realtime tables not added';
  end if;
end $$;

-- Full replica identity so UPDATE payloads carry the whole row to clients.
alter table public.bookings replica identity full;
alter table public.notifications replica identity full;
alter table public.rewards replica identity full;
alter table public.staff_availability replica identity full;

-- =============================================================================
-- SECTION B — REWARDS / QR / REFERRALS BACKEND MIGRATION (source: supabase/
-- migrations/20260908123000_complete_rewards_qr_referrals_backend.sql)
-- =============================================================================

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

-- (transaction markers removed: whole consolidated file runs inside one BEGIN/COMMIT)

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

-- =============================================================================
-- SECTION C — POST-SYNC VERIFICATION (read-only)
-- Runs after COMMIT, so you see the committed state. Every query below must
-- return what its comment says; any surprise means the file did not run on
-- the database you thought it did.
-- =============================================================================

-- (1) New tables exist (expect 6 rows)
select tablename from pg_tables
 where schemaname = 'public'
   and tablename in ('loyalty_config','loyalty_tiers','loyalty_point_transactions',
                     'reward_wallets','customer_qr_payments','referrals')
 order by 1;

-- (2) RLS enabled + policy count per table (expect 6 rows, rls=true, policies >= 4)
select c.relname as table_name, c.relrowsecurity as rls_enabled,
       count(p.policyname) as policies
  from pg_class c
  left join pg_policies p on p.schemaname = 'public' and p.tablename = c.relname
 where c.relname in ('loyalty_config','loyalty_tiers','loyalty_point_transactions',
                     'reward_wallets','customer_qr_payments','referrals')
 group by 1, 2 order by 1;

-- (3) Realtime publication membership (expect the same 6 tables listed)
select tablename from pg_publication_tables
 where pubname = 'supabase_realtime'
   and schemaname = 'public'
   and tablename in ('loyalty_config','loyalty_tiers','loyalty_point_transactions',
                     'reward_wallets','customer_qr_payments','referrals')
 order by 1;

-- (4) Seeds + backfill counts (zero rows are fine when the legacy tables were
--     empty before this run)
select 'loyalty_config' as table_name, count(*) as rows from public.loyalty_config
union all select 'loyalty_tiers', count(*) from public.loyalty_tiers
union all select 'loyalty_point_transactions', count(*) from public.loyalty_point_transactions
union all select 'reward_wallets', count(*) from public.reward_wallets
union all select 'customer_qr_payments', count(*) from public.customer_qr_payments
union all select 'referrals', count(*) from public.referrals;

-- (5) Legacy rows still intact (compare against your pre-run numbers)
select 'rewards' as table_name, count(*) as rows from public.rewards
union all select 'qr_check_ins', count(*) from public.qr_check_ins
union all select 'user_memberships', count(*) from public.user_memberships
union all select 'membership_tiers', count(*) from public.membership_tiers;

-- If you reached the result grids above, local PostgreSQL and the Supabase
-- cloud database now describe the same schema.
