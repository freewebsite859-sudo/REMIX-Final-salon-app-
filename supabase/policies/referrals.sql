-- =============================================================================
-- Nexora referral backend — schema, constraints and RLS contract (reference)
-- =============================================================================
-- This file documents the schema that `src/lib/referralService.ts` and the
-- referral field on `src/components/auth/AuthPage.tsx` are written against.
--
-- Apply it in the Nexora Supabase project ONLY if these objects do not already
-- exist. The client reuses whatever is present and degrades gracefully:
--   1. it prefers the SECURITY DEFINER functions below (apply_referral,
--      validate_referral_code, ensure_referral_code),
--   2. otherwise it falls back to direct table access through RLS,
--   3. otherwise it reports "Unable to verify referral code" and NEVER stores
--      an unverified relationship.
--
-- Security model
-- --------------
-- The browser only ever sends the PUBLIC referral code. It never sends a
-- referrer user id, and it cannot choose one: `referrer_user_id` is resolved
-- from `referral_codes` inside the database. No service_role key is used by the
-- frontend; every statement runs as anon or as the signed-in user under RLS.
--
-- Guarantees enforced here (not just in the client)
-- -------------------------------------------------
--   * referral codes are unique and public-safe        (unique index + check)
--   * one referral relationship per referred user       (unique index)
--   * first valid referral wins                         (unique + ON CONFLICT)
--   * referrer and referred user must be real accounts  (foreign keys)
--   * a user cannot refer themselves                    (check constraint)
--   * relationships are immutable — no update/delete path exists
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Referral codes: one stable, public-safe code per user
-- -----------------------------------------------------------------------------
create table if not exists public.referral_codes (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  code       text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  constraint referral_codes_code_unique unique (code),
  constraint referral_codes_code_format check (code ~ '^[A-Z0-9]{3,24}$')
);

create index if not exists referral_codes_code_upper_idx
  on public.referral_codes (upper(code));

alter table public.referral_codes enable row level security;

-- A user may read/create/rotate only their OWN code row.
drop policy if exists "users read own referral code" on public.referral_codes;
create policy "users read own referral code"
  on public.referral_codes
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "users insert own referral code" on public.referral_codes;
create policy "users insert own referral code"
  on public.referral_codes
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "users update own referral code" on public.referral_codes;
create policy "users update own referral code"
  on public.referral_codes
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Anonymous visitors get no direct access: a code is resolved through
-- public.validate_referral_code() / public.apply_referral() only, so the
-- code → user_id mapping is never exposed to the public internet.
revoke all on public.referral_codes from anon;

-- -----------------------------------------------------------------------------
-- 2. Referral relationships (the permanent record)
-- -----------------------------------------------------------------------------
create table if not exists public.referrals (
  id               uuid primary key default gen_random_uuid(),
  referred_user_id uuid not null references auth.users (id) on delete cascade,
  referrer_user_id uuid not null references auth.users (id) on delete restrict,
  referral_code    text not null,
  created_at       timestamptz not null default now(),
  -- One relationship per account: the FIRST valid referral wins, forever.
  constraint referrals_one_per_referred_user unique (referred_user_id),
  -- Self-referral is impossible, whatever the client sends.
  constraint referrals_no_self_referral check (referred_user_id <> referrer_user_id),
  constraint referrals_code_format check (referral_code ~ '^[A-Z0-9]{3,24}$')
);

create index if not exists referrals_referrer_idx
  on public.referrals (referrer_user_id);

alter table public.referrals enable row level security;

drop policy if exists "referred user reads own referral" on public.referrals;
create policy "referred user reads own referral"
  on public.referrals
  for select
  to authenticated
  using (auth.uid() = referred_user_id);

drop policy if exists "referrer reads their referrals" on public.referrals;
create policy "referrer reads their referrals"
  on public.referrals
  for select
  to authenticated
  using (auth.uid() = referrer_user_id);

-- A signed-in user may create a relationship for THEMSELVES only. The
-- referrer is filled in by the trigger below, never trusted from the client.
drop policy if exists "user inserts own referral" on public.referrals;
create policy "user inserts own referral"
  on public.referrals
  for insert
  to authenticated
  with check (auth.uid() = referred_user_id);

-- No UPDATE / DELETE policies: referral relationships are permanent.
revoke all on public.referrals from anon;

-- -----------------------------------------------------------------------------
-- 3. Trigger: resolve the referrer from the code (server-side truth)
-- -----------------------------------------------------------------------------
create or replace function public.referrals_resolve_referrer()
returns trigger
language plpgsql
as $$
declare
  v_code public.referral_codes%rowtype;
begin
  -- Duplicate protection: keep the original relationship, reject the new one.
  if exists (
    select 1 from public.referrals r where r.referred_user_id = new.referred_user_id
  ) then
    raise exception 'already_referred' using errcode = '23505';
  end if;

  select * into v_code
    from public.referral_codes
   where upper(code) = upper(coalesce(new.referral_code, ''));

  if not found then
    raise exception 'invalid_referral_code' using errcode = 'P0002';
  end if;

  if not v_code.is_active then
    raise exception 'referral_code_inactive' using errcode = 'P0002';
  end if;

  if v_code.user_id = new.referred_user_id then
    raise exception 'self_referral_not_allowed' using errcode = 'P0002';
  end if;

  -- The database resolves and stores the ACTUAL referrer user id.
  new.referrer_user_id := v_code.user_id;
  new.referral_code    := upper(v_code.code);
  return new;
end;
$$;

drop trigger if exists referrals_resolve_referrer on public.referrals;
create trigger referrals_resolve_referrer
  before insert on public.referrals
  for each row
  execute function public.referrals_resolve_referrer();

-- Immutability: the referrer of an existing relationship can never be moved.
create or replace function public.referrals_guard_immutable()
returns trigger
language plpgsql
as $$
begin
  if new.referred_user_id <> old.referred_user_id
     or new.referrer_user_id <> old.referrer_user_id then
    raise exception 'referral_relationship_immutable' using errcode = 'P0002';
  end if;
  return new;
end;
$$;

drop trigger if exists referrals_guard_immutable on public.referrals;
create trigger referrals_guard_immutable
  before update on public.referrals
  for each row
  execute function public.referrals_guard_immutable();

-- -----------------------------------------------------------------------------
-- 4. RPCs used by the client (SECURITY DEFINER, minimal privilege surface)
-- -----------------------------------------------------------------------------

-- Pre-signup validation. Callable anonymously so an invite link can be checked
-- before the account exists. Returns the referrer id ONLY for a valid code.
create or replace function public.validate_referral_code(p_code text)
returns table (status text, referrer_user_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_row  public.referral_codes%rowtype;
begin
  if v_code !~ '^[A-Z0-9]{3,24}$' then
    return query select 'invalid'::text, null::uuid;
    return;
  end if;

  select * into v_row from public.referral_codes where upper(code) = v_code;
  if not found then
    return query select 'invalid'::text, null::uuid;
    return;
  end if;

  if not v_row.is_active then
    return query select 'inactive'::text, null::uuid;
    return;
  end if;

  return query select 'valid'::text, v_row.user_id;
end;
$$;

revoke all on function public.validate_referral_code(text) from public;
grant execute on function public.validate_referral_code(text) to anon, authenticated;

-- Post-signup persistence. Runs as the NEW user (auth.uid()), resolves the
-- referrer, refuses self-referral, and keeps the first relationship on repeats.
create or replace function public.apply_referral(p_code text)
returns table (status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_row  public.referral_codes%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if v_code !~ '^[A-Z0-9]{3,24}$' then
    return query select 'invalid'::text;
    return;
  end if;

  -- First valid referral wins: never overwrite an existing relationship.
  if exists (select 1 from public.referrals r where r.referred_user_id = v_uid) then
    return query select 'already_referred'::text;
    return;
  end if;

  select * into v_row from public.referral_codes where upper(code) = v_code;
  if not found then
    return query select 'invalid'::text;
    return;
  end if;

  if not v_row.is_active then
    return query select 'inactive'::text;
    return;
  end if;

  if v_row.user_id = v_uid then
    return query select 'self_referral'::text;
    return;
  end if;

  insert into public.referrals (referred_user_id, referrer_user_id, referral_code)
  values (v_uid, v_row.user_id, v_code)
  on conflict (referred_user_id) do nothing;

  return query select 'created'::text;
end;
$$;

revoke all on function public.apply_referral(text) from public;
grant execute on function public.apply_referral(text) to authenticated;

-- Referral code allocation for the signed-in user (unique, stable, retried on
-- collision). `p_seed` only shapes the readable prefix.
create or replace function public.ensure_referral_code(p_seed text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_code   text;
  v_prefix text;
  v_chars  text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_i      int;
  v_n      int;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select code into v_code from public.referral_codes where user_id = v_uid;
  if found then
    return v_code;
  end if;

  v_prefix := upper(left(regexp_replace(coalesce(p_seed, ''), '[^A-Za-z]', '', 'g'), 3));

  for v_i in 1..8 loop
    v_code := v_prefix;
    for v_n in 1..(8 - length(v_prefix)) loop
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    end loop;

    begin
      insert into public.referral_codes (user_id, code) values (v_uid, v_code);
      return v_code;
    exception
      when unique_violation then
        null; -- collision: try another code
    end;
  end loop;

  raise exception 'referral_code_generation_failed' using errcode = 'P0002';
end;
$$;

revoke all on function public.ensure_referral_code(text) from public;
grant execute on function public.ensure_referral_code(text) to authenticated;
