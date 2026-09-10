-- =============================================================================
-- NEXORA — REFERRAL SETTLEMENT, WALLET SYNC & REFERRER NOTIFICATIONS
--
-- File: supabase/migrations/20260910130000_referral_settlement_wallet_notifications.sql
--
-- These four defects were found by executing the schema on PostgreSQL 16 and
-- walking a real referral end to end (signup → attribution → qualifying visit):
--
--   A. `bookings_award_points_trigger` was AFTER UPDATE OF status ONLY.
--      A booking INSERTed directly as 'confirmed'/'completed' (admin creates,
--      backfills, any integration that writes the final state in one shot)
--      never awarded booking points and never settled the referral.
--
--   B. `apply_points_ledger()` wrote only `user_memberships`. The canonical
--      `reward_wallets` table added by 20260908 stayed EMPTY forever — after a
--      verified 150-point referral payout the wallet had zero rows, so any
--      balance read from `reward_wallets` showed 0.
--
--   C. `settle_completed_referrals()` never notified the referrer, although the
--      notifications CHECK constraint already whitelists `referral_qualified`.
--      The customer earned points with no message in their notification feed.
--
--   D. The documented rule is "referral points count only after the referred
--      friend's first ₹100+ QR PAYMENT", but nothing on `customer_qr_payments`
--      settled referrals — only a confirmed booking did.
--
-- All statements are idempotent (CREATE OR REPLACE / DROP IF EXISTS + guarded
-- DO blocks) and never drop data.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- B. apply_points_ledger() — keep BOTH wallets in lockstep
--    user_memberships stays the legacy source; reward_wallets is the canonical
--    per-customer wallet the 20260908 schema introduced.
-- ---------------------------------------------------------------------------
create or replace function public.apply_points_ledger(p_user uuid, p_points integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier text;
  v_lifetime integer;
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

  -- Canonical wallet mirror (same sign rules as above).
  insert into public.reward_wallets (
    customer_user_id,
    balance,
    lifetime_earned,
    lifetime_redeemed
  )
  values (
    p_user,
    p_points,
    greatest(p_points, 0),
    case when p_points < 0 then -p_points else 0 end
  )
  on conflict (customer_user_id) do update
    set balance = greatest(0, public.reward_wallets.balance + p_points),
        lifetime_earned = case when p_points > 0
                               then public.reward_wallets.lifetime_earned + p_points
                               else public.reward_wallets.lifetime_earned end,
        lifetime_redeemed = case when p_points < 0
                                 then public.reward_wallets.lifetime_redeemed - p_points
                                 else public.reward_wallets.lifetime_redeemed end,
        updated_at = now();

  -- Derive the tier from the platform loyalty ladder and persist it.
  select lt.tier_code into v_tier
    from public.loyalty_tiers lt
   where lt.owner_id is null
     and lt.min_points <= (
       select coalesce(w.lifetime_earned, 0)
         from public.reward_wallets w
        where w.customer_user_id = p_user
     )
   order by lt.min_points desc
   limit 1;

  v_tier := coalesce(v_tier, 'standard');
  select w.lifetime_earned into v_lifetime
    from public.reward_wallets w
   where w.customer_user_id = p_user;

  update public.reward_wallets
     set tier_code = v_tier
   where customer_user_id = p_user
     and tier_code is distinct from v_tier;
end;
$$;

-- Backfill: existing memberships get their wallet row (idempotent upsert).
insert into public.reward_wallets (customer_user_id, balance, lifetime_earned, tier_code)
select m.user_id,
       greatest(0, m.current_points),
       greatest(0, m.lifetime_points),
       coalesce(
         (select lt.tier_code
            from public.loyalty_tiers lt
           where lt.owner_id is null
             and lt.min_points <= greatest(0, m.lifetime_points)
           order by lt.min_points desc
           limit 1),
         'standard'
       )
  from public.user_memberships m
on conflict (customer_user_id) do update
  set balance         = greatest(0, excluded.balance),
      lifetime_earned = greatest(excluded.lifetime_earned, public.reward_wallets.lifetime_earned),
      tier_code       = excluded.tier_code,
      updated_at      = now();

-- ---------------------------------------------------------------------------
-- A. award_booking_points() — fire on INSERT as well as the status transition
-- ---------------------------------------------------------------------------
create or replace function public.award_booking_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_points integer;
  v_prev_status text;
begin
  -- On INSERT there is no OLD row; treat the previous status as absent.
  v_prev_status := case when tg_op = 'INSERT' then null else old.status end;

  -- Only when the row *is* confirmed/completed and was not already in that
  -- state (so re-saving a confirmed booking cannot pay twice).
  if new.status not in ('confirmed', 'completed')
     or v_prev_status in ('confirmed', 'completed') then
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
  after insert or update of status on public.bookings
  for each row execute function public.award_booking_points();

-- ---------------------------------------------------------------------------
-- C. settle_completed_referrals() — pay once AND notify the referrer once
-- ---------------------------------------------------------------------------
create or replace function public.settle_completed_referrals(p_referred uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_friend_name text;
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

  -- A qualifying ₹100+ QR payment settles it too (documented program rule).
  update public.referrals x
     set status = 'completed',
         completed_at = now(),
         metadata = x.metadata || jsonb_build_object(
           'qualifying_qr_ref',
           (select qr.qr_transaction_ref
              from public.customer_qr_payments qr
             where qr.customer_user_id = p_referred
               and qr.status in ('approved', 'redeemed')
               and qr.amount_paid >= 100
             order by qr.created_at asc
             limit 1)
         )
   where x.referred_user_id = p_referred
     and x.status = 'pending'
     and exists (
       select 1 from public.customer_qr_payments qr
        where qr.customer_user_id = p_referred
          and qr.status in ('approved', 'redeemed')
          and qr.amount_paid >= 100
     );

  select coalesce(p.full_name, split_part(p.email, '@', 1), 'Your friend')
    into v_friend_name
    from public.profiles p
   where p.id = p_referred;

  -- Pay each completed-but-unpaid referral exactly once (ledger guard), and
  -- tell the referrer about it in the same transaction.
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

    insert into public.notifications (user_id, type, title, body, payload)
    values (
      r.referrer_user_id,
      'referral_qualified',
      format('You earned %s points!', r.reward_points),
      format('%s completed a qualifying visit. %s reward points are now in your wallet — redeem them at any partner salon.',
             coalesce(v_friend_name, 'Your friend'), r.reward_points),
      jsonb_build_object(
        'referral_id', r.id,
        'points', r.reward_points,
        'referred_user_id', p_referred,
        'route', '/customer/rewards'
      )
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- D. QR payment → settle the payer's pending referral (₹100+ rule)
-- ---------------------------------------------------------------------------
create or replace function public.customer_qr_payments_settle_referral()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only settled money counts, and only at or above the ₹100 threshold.
  if new.customer_user_id is null
     or new.status not in ('approved', 'redeemed')
     or coalesce(new.amount_paid, 0) < 100 then
    return new;
  end if;

  perform public.settle_completed_referrals(new.customer_user_id);
  return new;
end;
$$;

drop trigger if exists customer_qr_payments_settle_referral_trigger on public.customer_qr_payments;
create trigger customer_qr_payments_settle_referral_trigger
  after insert or update of status on public.customer_qr_payments
  for each row execute function public.customer_qr_payments_settle_referral();

-- ---------------------------------------------------------------------------
-- Repair pass 1: referrals completed before this migration may never have been
-- PAID (old trigger only fired on a status UPDATE). Safe to re-run — the payout
-- loop inside settle_completed_referrals() is guarded by NOT EXISTS on the
-- rewards ledger, so nothing can be paid twice.
-- ---------------------------------------------------------------------------
do $$
declare
  v_user uuid;
begin
  for v_user in
    select distinct referred_user_id from public.referrals
  loop
    perform public.settle_completed_referrals(v_user);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Repair pass 2: referrals that WERE already paid before this migration got no
-- notification (the insert above only runs inside the not-yet-paid loop).
-- Backfill one notification per paid referral that has none. Guarded by
-- NOT EXISTS on the notification payload, so re-running is a no-op.
-- ---------------------------------------------------------------------------
insert into public.notifications (user_id, type, title, body, payload)
select r.referrer_user_id,
       'referral_qualified',
       format('You earned %s points!', r.reward_points),
       format('%s completed a qualifying visit. %s reward points are now in your wallet — redeem them at any partner salon.',
              coalesce(
                nullif(btrim(p.full_name), ''),
                split_part(p.email, '@', 1),
                'Your friend'
              ),
              r.reward_points),
       jsonb_build_object(
         'referral_id', r.id,
         'points', r.reward_points,
         'referred_user_id', r.referred_user_id,
         'route', '/customer/rewards'
       )
  from public.referrals r
  join public.profiles p on p.id = r.referred_user_id
 where r.status = 'completed'
   and exists (
     select 1 from public.rewards w
      where w.referral_id = r.id and w.transaction_type = 'referral'
   )
   and not exists (
     select 1 from public.notifications n
      where n.user_id = r.referrer_user_id
        and n.type = 'referral_qualified'
        and n.payload->>'referral_id' = r.id::text
   );

-- ---------------------------------------------------------------------------
-- Verification (read-only)
-- ---------------------------------------------------------------------------
-- (1) Trigger now covers INSERT
select tgname, (tgtype::int & 4) > 0 as after_insert, (tgtype::int & 16) > 0 as after_update
  from pg_trigger
 where tgrelid = 'public.bookings'::regclass and tgname = 'bookings_award_points_trigger';

-- (2) Wallet rows exist for every member
select (select count(*) from public.user_memberships) as members,
       (select count(*) from public.reward_wallets)   as wallets;

-- (3) QR settlement trigger installed
select tgname from pg_trigger
 where tgrelid = 'public.customer_qr_payments'::regclass
   and tgname = 'customer_qr_payments_settle_referral_trigger';
