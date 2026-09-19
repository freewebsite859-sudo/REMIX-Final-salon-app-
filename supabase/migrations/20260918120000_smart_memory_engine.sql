-- =============================================================================
-- NEXORA — SMART MEMORY ENGINE
--
-- File: supabase/migrations/20260918120000_smart_memory_engine.sql
--
-- Adds the tables behind personalised recommendations and the 45-day
-- intelligent reminder system:
--
--   public.user_preferences   learned favourites + per-service frequency
--   public.smart_reminders    one row per (user, service_type) cycle
--   public.payment_refunds    Razorpay refund ledger (server-written only)
--   public.push_subscriptions Web-push / FCM device tokens
--
-- Everything the browser reads goes through RLS with the signed-in user's JWT.
-- Learning writes (`service_frequency`, reminder scheduling) are done by the
-- server with the service-role key so a client cannot forge its own history.
--
-- Idempotent: safe to re-run.
-- =============================================================================

create extension if not exists "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. User preferences
-- -----------------------------------------------------------------------------
create table if not exists public.user_preferences (
  id                 uuid primary key default uuid_generate_v4(),
  user_id            uuid not null unique references public.profiles (id) on delete cascade,
  favorite_salons    uuid[]  not null default '{}',
  favorite_staff     uuid[]  not null default '{}',
  preferred_services text[]  not null default '{}',
  -- { "<service_type>": { "count": 4, "last_at": "2026-08-01", "avg_gap_days": 41,
  --                       "avg_spend": 750, "salon_ids": ["..."], "stylist_ids": ["..."] } }
  service_frequency  jsonb   not null default '{}'::jsonb
                     check (jsonb_typeof(service_frequency) = 'object'),
  -- Free-form learned signals (preferred time-of-day, budget band, gender pref…)
  insights           jsonb   not null default '{}'::jsonb
                     check (jsonb_typeof(insights) = 'object'),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- The catalog uses text salon/staff ids (e.g. 'hair_salon', 'stylist-aarav'),
-- not UUIDs. Keep the spec'd uuid[] columns for a future UUID catalog and add
-- text mirrors the app actually writes today.
alter table public.user_preferences
  add column if not exists favorite_salon_ids text[] not null default '{}',
  add column if not exists favorite_staff_ids text[] not null default '{}';

create index if not exists user_preferences_user_idx on public.user_preferences (user_id);

alter table public.user_preferences enable row level security;

drop policy if exists user_preferences_select_own on public.user_preferences;
create policy user_preferences_select_own on public.user_preferences
  for select using (auth.uid() = user_id);

drop policy if exists user_preferences_upsert_own on public.user_preferences;
create policy user_preferences_upsert_own on public.user_preferences
  for insert with check (auth.uid() = user_id);

drop policy if exists user_preferences_update_own on public.user_preferences;
create policy user_preferences_update_own on public.user_preferences
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 2. Smart reminders (service-cycle tracking)
-- -----------------------------------------------------------------------------
create table if not exists public.smart_reminders (
  id                 uuid primary key default uuid_generate_v4(),
  user_id            uuid not null references public.profiles (id) on delete cascade,
  service_type       text not null check (service_type <> ''),
  last_service_date  date,
  next_reminder_date date,
  reminder_sent      boolean not null default false,
  created_at         timestamptz not null default now()
);

alter table public.smart_reminders
  add column if not exists salon_id        text,
  add column if not exists stylist_id      text,
  add column if not exists cycle_days      integer not null default 45 check (cycle_days between 7 and 365),
  add column if not exists sent_at         timestamptz,
  add column if not exists dismissed_at    timestamptz,
  add column if not exists booked_at       timestamptz,
  add column if not exists channel         text check (channel in ('in_app', 'whatsapp', 'push', 'email')),
  add column if not exists message         text,
  add column if not exists updated_at      timestamptz not null default now();

create unique index if not exists smart_reminders_user_service_idx
  on public.smart_reminders (user_id, service_type);
create index if not exists smart_reminders_due_idx
  on public.smart_reminders (next_reminder_date)
  where reminder_sent = false and dismissed_at is null;

alter table public.smart_reminders enable row level security;

drop policy if exists smart_reminders_select_own on public.smart_reminders;
create policy smart_reminders_select_own on public.smart_reminders
  for select using (auth.uid() = user_id);

-- Customers may dismiss / snooze their own reminder, nothing else.
drop policy if exists smart_reminders_update_own on public.smart_reminders;
create policy smart_reminders_update_own on public.smart_reminders
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 3. Refund ledger (server-only)
-- -----------------------------------------------------------------------------
create table if not exists public.payment_refunds (
  id               text primary key,                 -- Razorpay refund id (rfnd_…)
  payment_id       text not null,                    -- Razorpay payment id (pay_…)
  booking_id       uuid references public.bookings (id) on delete set null,
  user_id          uuid references auth.users (id) on delete set null,
  amount_paise     integer not null check (amount_paise > 0),
  currency         text not null default 'INR' check (currency = 'INR'),
  status           text not null default 'pending'
                   check (status in ('pending', 'processed', 'failed')),
  reason           text,
  speed            text not null default 'normal' check (speed in ('normal', 'optimum')),
  provider_payload jsonb,
  created_at       timestamptz not null default now(),
  processed_at     timestamptz
);

create index if not exists payment_refunds_booking_idx on public.payment_refunds (booking_id);
create index if not exists payment_refunds_user_idx on public.payment_refunds (user_id);

alter table public.payment_refunds enable row level security;
drop policy if exists payment_refunds_select_own on public.payment_refunds;
create policy payment_refunds_select_own on public.payment_refunds
  for select using (auth.uid() = user_id);
-- No insert/update policies: only the service-role payments router writes here.

-- -----------------------------------------------------------------------------
-- 4. Push subscriptions
-- -----------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  provider     text not null default 'webpush' check (provider in ('webpush', 'fcm')),
  endpoint     text not null,
  token        jsonb not null,                      -- PushSubscription JSON or { fcmToken }
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;
drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 5. updated_at triggers
-- -----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists user_preferences_touch on public.user_preferences;
create trigger user_preferences_touch before update on public.user_preferences
  for each row execute function public.touch_updated_at();

drop trigger if exists smart_reminders_touch on public.smart_reminders;
create trigger smart_reminders_touch before update on public.smart_reminders
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- 6. Learning hook: every completed booking feeds the memory engine
-- -----------------------------------------------------------------------------
-- Keeps `service_frequency` and `smart_reminders` current without a cron.
-- The same maths lives in src/lib/smartMemory.ts for the in-browser demo store.
create or replace function public.smart_memory_learn_from_booking()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  svc            record;
  prev           jsonb;
  prev_count     int;
  prev_last      date;
  gap            int;
  new_avg_gap    numeric;
  cycle          int;
  stylist_id     text := nullif(new.stylist_snapshot->>'id', '');
begin
  if new.user_id is null then return new; end if;
  if new.status <> 'completed' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'completed' then return new; end if;

  insert into public.user_preferences (user_id) values (new.user_id)
  on conflict (user_id) do nothing;

  for svc in
    select coalesce(nullif(bs.category, ''), bs.service_name) as service_type,
           bs.unit_price
      from public.booking_services bs
     where bs.booking_id = new.id
  loop
    select service_frequency -> svc.service_type into prev
      from public.user_preferences where user_id = new.user_id;

    prev_count := coalesce((prev->>'count')::int, 0);
    prev_last  := nullif(prev->>'last_at', '')::date;
    gap        := case when prev_last is null then null else greatest(1, new.slot_date - prev_last) end;
    new_avg_gap := case
      when gap is null then coalesce((prev->>'avg_gap_days')::numeric, 45)
      when prev_count <= 1 then gap
      else round(((prev->>'avg_gap_days')::numeric * (prev_count - 1) + gap) / prev_count, 1)
    end;
    -- Reminder cycle: learned cadence clamped to a sane band, default 45 days.
    cycle := greatest(14, least(120, round(new_avg_gap)::int));

    update public.user_preferences
       set service_frequency = jsonb_set(
             service_frequency,
             array[svc.service_type],
             jsonb_build_object(
               'count', prev_count + 1,
               'last_at', to_char(new.slot_date, 'YYYY-MM-DD'),
               'avg_gap_days', new_avg_gap,
               'avg_spend', round(((coalesce((prev->>'avg_spend')::numeric, 0) * prev_count) + coalesce(svc.unit_price, 0)) / (prev_count + 1)),
               'salon_ids', (select jsonb_agg(distinct x) from jsonb_array_elements_text(coalesce(prev->'salon_ids', '[]'::jsonb) || to_jsonb(array[new.salon_id])) x),
               'stylist_ids', case when stylist_id is null then coalesce(prev->'stylist_ids', '[]'::jsonb)
                                   else (select jsonb_agg(distinct x) from jsonb_array_elements_text(coalesce(prev->'stylist_ids', '[]'::jsonb) || to_jsonb(array[stylist_id])) x) end
             ),
             true),
           preferred_services = (select array_agg(distinct s) from unnest(preferred_services || array[svc.service_type]) s)
     where user_id = new.user_id;

    insert into public.smart_reminders (user_id, service_type, salon_id, stylist_id, last_service_date, next_reminder_date, cycle_days, reminder_sent)
    values (new.user_id, svc.service_type, new.salon_id, stylist_id, new.slot_date, new.slot_date + cycle, cycle, false)
    on conflict (user_id, service_type) do update
       set last_service_date  = excluded.last_service_date,
           next_reminder_date = excluded.next_reminder_date,
           cycle_days         = excluded.cycle_days,
           salon_id           = excluded.salon_id,
           stylist_id         = coalesce(excluded.stylist_id, public.smart_reminders.stylist_id),
           reminder_sent      = false,
           sent_at            = null,
           dismissed_at       = null,
           booked_at          = null;
  end loop;

  return new;
end $$;

drop trigger if exists bookings_smart_memory_learn on public.bookings;
create trigger bookings_smart_memory_learn
  after insert or update of status on public.bookings
  for each row execute function public.smart_memory_learn_from_booking();

-- -----------------------------------------------------------------------------
-- 7. Due-reminder view for the dispatcher (service role only)
-- -----------------------------------------------------------------------------
create or replace view public.smart_reminders_due as
  select r.*, p.phone, p.full_name
    from public.smart_reminders r
    join public.profiles p on p.id = r.user_id
   where r.reminder_sent = false
     and r.dismissed_at is null
     and r.booked_at is null
     and r.next_reminder_date <= current_date;

revoke all on public.smart_reminders_due from anon, authenticated;
