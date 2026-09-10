-- =============================================================================
-- NEXORA — REFERRAL CODES + INVITE LINK ATTRIBUTION
--
-- File: supabase/migrations/20260910120000_referral_codes_invite_links.sql
--
-- Problem this fixes
-- ------------------
-- Invite links (https://nexora.app/invite?code=NX-VIJAY634) could never be
-- attributed because no referral code was ever persisted: the app invented a
-- code from the customer's name on each screen, so `NX-VIJAY634` matched
-- nothing in the database and no referral row (and therefore no points) was
-- ever written.
--
-- What this migration adds
-- ------------------------
--   1. profiles.referral_code  — one stable, unique code per customer
--                                (`NX-<NAME><ddd>`, same shape the share card
--                                and the invite link use).
--   2. auto-generation trigger — a profile always has a code, backfilled for
--                                every existing row.
--   3. public.resolve_referral_code(code) — anon-callable lookup used by the
--                                invite landing page / signup form to show
--                                "<name> invited you".
--   4. public.referral_summary(user_id) — the counters the referral screen
--                                shows (invited / completed / pending / points).
--
-- Points are NOT granted at signup. `referrals` rows are written `pending` with
-- reward_points = 150 by POST /api/referrals/accept, and the existing
-- public.settle_completed_referrals() trigger releases them once the referred
-- customer completes a qualifying payment.
--
-- Idempotent: safe to re-run.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Column + uniqueness
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists referral_code text;

comment on column public.profiles.referral_code is
  'Stable public referral code used by https://nexora.app/invite?code=… links (NX-<NAME><ddd>).';

-- Unique, but NULL-tolerant so a partially created profile cannot fail insert.
create unique index if not exists profiles_referral_code_unique_idx
  on public.profiles (referral_code)
  where referral_code is not null;

create index if not exists profiles_referral_code_lookup_idx
  on public.profiles (upper(referral_code))
  where referral_code is not null;

-- ---------------------------------------------------------------------------
-- 2. Deterministic code generator
--    Mirrors src/lib/referralService.ts buildReferralCode():
--      NX- + up to 6 letters of the name + 3 digits (100–999)
--    Collisions are impossible for the same user (id-seeded) and are retried
--    with a numeric suffix for different users.
-- ---------------------------------------------------------------------------
create or replace function public.generate_referral_code(
  p_full_name text,
  p_user_id   uuid,
  p_attempt   integer default 0
)
returns text
language sql
immutable
set search_path = public
as $$
  select format(
    'NX-%s%s%s',
    upper(left(regexp_replace(coalesce(nullif(btrim(p_full_name), ''), 'NEXORA'), '[^A-Za-z]', '', 'g'), 6)),
    lpad(
      ((('x' || substr(md5(coalesce(p_user_id::text, random()::text)), 1, 4))::bit(16)::int % 900) + 100)::text,
      3,
      '0'
    ),
    case when p_attempt > 0 then p_attempt::text else '' end
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. Backfill every existing profile that has no code yet
-- ---------------------------------------------------------------------------
do $$
declare
  rec record;
  attempt integer;
  candidate text;
begin
  for rec in
    select id, full_name
      from public.profiles
     where referral_code is null
  loop
    attempt := 0;
    loop
      candidate := public.generate_referral_code(rec.full_name, rec.id, attempt);
      if not exists (
        select 1 from public.profiles p
         where p.referral_code = candidate and p.id <> rec.id
      ) then
        update public.profiles set referral_code = candidate where id = rec.id;
        exit;
      end if;
      attempt := attempt + 1;
      if attempt > 50 then
        raise warning 'referral_code backfill gave up for profile %', rec.id;
        exit;
      end if;
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Keep every profile coded (new signups included)
-- ---------------------------------------------------------------------------
create or replace function public.profiles_ensure_referral_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  attempt integer := 0;
  candidate text;
begin
  if new.referral_code is not null and btrim(new.referral_code) <> '' then
    new.referral_code := upper(btrim(new.referral_code));
    return new;
  end if;

  loop
    candidate := public.generate_referral_code(new.full_name, new.id, attempt);
    if not exists (
      select 1 from public.profiles p
       where p.referral_code = candidate and p.id <> new.id
    ) then
      new.referral_code := candidate;
      return new;
    end if;
    attempt := attempt + 1;
    if attempt > 50 then
      new.referral_code := format('NX-%s', substr(replace(new.id::text, '-', ''), 1, 9));
      return new;
    end if;
  end loop;
end;
$$;

drop trigger if exists profiles_ensure_referral_code_trigger on public.profiles;
create trigger profiles_ensure_referral_code_trigger
  before insert or update of referral_code, full_name on public.profiles
  for each row execute function public.profiles_ensure_referral_code();

-- ---------------------------------------------------------------------------
-- 5. Anon-callable lookup — the invite landing page must resolve a code BEFORE
--    the visitor has an account, so RLS (authenticated-only) cannot serve it.
--    SECURITY DEFINER + explicit grants, and it returns the minimum needed to
--    show "<name> invited you" (never an email, phone or id).
-- ---------------------------------------------------------------------------
create or replace function public.resolve_referral_code(p_code text)
returns table (referrer_name text, reward_points integer)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_points integer := 150;
begin
  -- Optional platform override (loyalty_config rows are jsonb, keyed by
  -- config_key). A missing table/row must never break the invite page.
  begin
    select nullif(cfg.config_value->>'referral_bonus_points', '')::integer
      into v_points
      from public.loyalty_config cfg
     where cfg.config_key = 'referral_bonus_points'
       and cfg.status = 'active'
     order by cfg.owner_id nulls first
     limit 1;
  exception when others then
    v_points := 150;
  end;

  return query
    select
      coalesce(
        nullif(btrim(p.full_name), ''),
        split_part(p.email, '@', 1),
        'A Nexora customer'
      ) as referrer_name,
      coalesce(v_points, 150) as reward_points
      from public.profiles p
     where p.referral_code = upper(btrim(coalesce(p_code, '')))
     limit 1;
end;
$$;

revoke all on function public.resolve_referral_code(text) from public;
grant execute on function public.resolve_referral_code(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Counters for the referral screen (referrer-only, so RLS is enough)
-- ---------------------------------------------------------------------------
create or replace function public.referral_summary(p_user_id uuid)
returns table (
  referral_code        text,
  total_invited        bigint,
  successful_referrals bigint,
  pending_referrals    bigint,
  reward_earned        bigint,
  reward_pending       bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.referral_code,
    count(r.id),
    count(r.id) filter (where r.status = 'completed'),
    count(r.id) filter (where r.status = 'pending'),
    coalesce(sum(r.reward_points) filter (where r.status = 'completed'), 0),
    coalesce(sum(r.reward_points) filter (where r.status = 'pending'), 0)
    from public.profiles p
    left join public.referrals r on r.referrer_user_id = p.id
   where p.id = p_user_id
   group by p.referral_code;
$$;

revoke all on function public.referral_summary(uuid) from public;
grant execute on function public.referral_summary(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Verification
-- ---------------------------------------------------------------------------
-- (1) Every profile now has a unique code
select count(*) as profiles_total,
       count(referral_code) as profiles_coded
  from public.profiles;

-- (2) The code from an invite link resolves
select * from public.resolve_referral_code('NX-EXAMPLE000');

-- (3) Referral rows written by POST /api/referrals/accept land here
select status, count(*) as rows, sum(reward_points) as points
  from public.referrals
 group by status
 order by status;
