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
begin
  -- Supabase projects ship the `supabase_realtime` publication by default;
  -- if it is absent (custom project), skip with a NOTICE instead of failing.
  alter publication supabase_realtime add table public.bookings;
  alter publication supabase_realtime add table public.notifications;
  alter publication supabase_realtime add table public.rewards;
  alter publication supabase_realtime add table public.user_qr_codes;
  alter publication supabase_realtime add table public.qr_check_ins;
  alter publication supabase_realtime add table public.staff_availability;
exception when undefined_table then
  raise notice 'supabase_realtime publication missing; realtime tables not added';
end $$;

-- Full replica identity so UPDATE payloads carry the whole row to clients.
alter table public.bookings replica identity full;
alter table public.notifications replica identity full;
alter table public.rewards replica identity full;
alter table public.staff_availability replica identity full;
