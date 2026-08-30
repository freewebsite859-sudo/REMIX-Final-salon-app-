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
