-- =============================================================================
-- NEXORA — PROFILE CONTACT & AVATAR PERSISTENCE
--
-- File: supabase/migrations/20260910140000_profile_phone_avatar.sql
--
-- Gap found during the QA pass: the sign-up form collects a mobile number and
-- sends it to Supabase Auth as `user_metadata.mobile`, but `public.profiles`
-- had no phone column at all, so the number never reached the profile row that
-- the app (and the salon side) reads. `profiles.avatar_url` already existed but
-- no client code ever wrote it.
--
-- This adds the missing column and a lookup-friendly index. The client change
-- (src/lib/profileService.ts) persists phone + avatar on sign-up and profile
-- edits; it degrades gracefully on a project that has not run this migration.
--
-- Idempotent: safe to re-run.
-- =============================================================================

alter table public.profiles
  add column if not exists phone text;

comment on column public.profiles.phone is
  'Customer mobile captured at sign-up (E.164 or local format). Mirrors auth.users.user_metadata.mobile.';

create index if not exists profiles_phone_idx
  on public.profiles (phone)
  where phone is not null;

-- Backfill from the auth metadata that signup already stored, so existing
-- accounts get their number without asking for it again.
update public.profiles p
   set phone = nullif(btrim(u.raw_user_meta_data->>'mobile'), '')
  from auth.users u
 where u.id = p.id
   and p.phone is null
   and nullif(btrim(u.raw_user_meta_data->>'mobile'), '') is not null;

-- Keep phone in sync when auth metadata changes (profile edits go through
-- supabase.auth.updateUser, which does not touch public.profiles).
create or replace function public.profiles_sync_contact_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles p
     set phone = coalesce(
           nullif(btrim(new.raw_user_meta_data->>'mobile'), ''),
           p.phone
         ),
         full_name = coalesce(
           nullif(btrim(new.raw_user_meta_data->>'full_name'), ''),
           p.full_name
         ),
         updated_at = now()
   where p.id = new.id;
  return new;
end;
$$;

-- Fires on INSERT as well as UPDATE: a brand-new signup already carries
-- user_metadata.mobile, and an AFTER UPDATE-only trigger would leave
-- profiles.phone NULL for every new account.
--
-- Ordering: `on_auth_user_created` (which creates the profile row) sorts before
-- `profiles_sync_contact_from_auth_trigger`, and PostgreSQL fires same-event
-- triggers on a table in name order — so the profile row always exists first.
drop trigger if exists profiles_sync_contact_from_auth_trigger on auth.users;
create trigger profiles_sync_contact_from_auth_trigger
  after insert or update of raw_user_meta_data on auth.users
  for each row execute function public.profiles_sync_contact_from_auth();

-- Verification (read-only)
select count(*) as profiles_total,
       count(phone) as profiles_with_phone,
       count(avatar_url) as profiles_with_avatar
  from public.profiles;
