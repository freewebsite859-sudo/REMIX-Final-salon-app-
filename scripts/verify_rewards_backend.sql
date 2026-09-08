-- =============================================================================
-- NEXORA — VERIFICATION: rewards / QR / referrals backend migration
-- Companion to supabase/migrations/20260908123000_complete_rewards_qr_referrals_backend.sql
-- Read-only against application data (only temporary helper functions + a temp
-- view are created in this session and dropped at the end).
-- Output: one PASS/FAIL row per check + a summary row. FAIL count must be 0.
-- =============================================================================

create or replace function public.vrf_exists_col(t text, c text) returns boolean
language sql stable
as $$ select exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = t and column_name = c
) $$;

create or replace function public.vrf_exists_fk_col(t text, c text, rs text, rt text) returns boolean
language sql stable
as $$ select exists (
  select 1 from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  join pg_class rrel on rrel.oid = con.confrelid
  join pg_namespace rnsp on rnsp.oid = rrel.relnamespace
  where nsp.nspname = 'public' and rel.relname = t
    and con.contype = 'f'
    and con.conkey = (select array_agg(a.attnum) from pg_attribute a
                      where a.attrelid = rel.oid and a.attname = c)
    and rnsp.nspname = rs and rrel.relname = rt
) $$;

create or replace function public.vrf_rls_enabled(t text) returns boolean
language sql stable
as $$ select relrowsecurity from pg_class
     where oid = to_regclass('public.' || t) $$;

create or replace function public.vrf_policy_count(t text) returns bigint
language sql stable
as $$ select count(*) from pg_policies where schemaname = 'public' and tablename = t $$;

create or replace function public.vrf_trigger_exists(t text, trg text) returns boolean
language sql stable
as $$ select exists (
  select 1 from pg_trigger
  where tgrelid = to_regclass('public.' || t) and tgname = trg and not tgisinternal
) $$;

create or replace function public.vrf_realtime_member(t text) returns boolean
language sql stable
as $$ select exists (
  select 1 from pg_publication_tables
  where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
) $$;

create or replace function public.vrf_exists_index(t text, idx text) returns boolean
language sql stable
as $$ select exists (
  select 1 from pg_indexes
  where schemaname = 'public' and tablename = t and indexname = idx
) $$;

create or replace temporary view vrf_checks as
with checks as (
  -- 1) All required tables exist -------------------------------------------------
  select 'table exists: loyalty_config' as check_name,
         to_regclass('public.loyalty_config') is not null as ok
  union all select 'table exists: loyalty_tiers', to_regclass('public.loyalty_tiers') is not null
  union all select 'table exists: loyalty_point_transactions', to_regclass('public.loyalty_point_transactions') is not null
  union all select 'table exists: reward_wallets', to_regclass('public.reward_wallets') is not null
  union all select 'table exists: customer_qr_payments', to_regclass('public.customer_qr_payments') is not null
  union all select 'table exists: referrals', to_regclass('public.referrals') is not null

  -- 2) Required columns ----------------------------------------------------------
  union all select 'col: loyalty_config.owner_id', vrf_exists_col('loyalty_config','owner_id')
  union all select 'col: loyalty_config.status', vrf_exists_col('loyalty_config','status')
  union all select 'col: loyalty_config.metadata', vrf_exists_col('loyalty_config','metadata')
  union all select 'col: loyalty_config.created_at', vrf_exists_col('loyalty_config','created_at')
  union all select 'col: loyalty_config.updated_at', vrf_exists_col('loyalty_config','updated_at')

  union all select 'col: loyalty_tiers.owner_id', vrf_exists_col('loyalty_tiers','owner_id')
  union all select 'col: loyalty_tiers.status', vrf_exists_col('loyalty_tiers','status')
  union all select 'col: loyalty_tiers.metadata', vrf_exists_col('loyalty_tiers','metadata')
  union all select 'col: loyalty_tiers.created_at', vrf_exists_col('loyalty_tiers','created_at')
  union all select 'col: loyalty_tiers.updated_at', vrf_exists_col('loyalty_tiers','updated_at')

  union all select 'col: loyalty_point_transactions.customer_user_id', vrf_exists_col('loyalty_point_transactions','customer_user_id')
  union all select 'col: loyalty_point_transactions.owner_id', vrf_exists_col('loyalty_point_transactions','owner_id')
  union all select 'col: loyalty_point_transactions.points_awarded', vrf_exists_col('loyalty_point_transactions','points_awarded')
  union all select 'col: loyalty_point_transactions.status', vrf_exists_col('loyalty_point_transactions','status')
  union all select 'col: loyalty_point_transactions.metadata', vrf_exists_col('loyalty_point_transactions','metadata')
  union all select 'col: loyalty_point_transactions.created_at', vrf_exists_col('loyalty_point_transactions','created_at')
  union all select 'col: loyalty_point_transactions.updated_at', vrf_exists_col('loyalty_point_transactions','updated_at')

  union all select 'col: reward_wallets.customer_user_id', vrf_exists_col('reward_wallets','customer_user_id')
  union all select 'col: reward_wallets.owner_id', vrf_exists_col('reward_wallets','owner_id')
  union all select 'col: reward_wallets.status', vrf_exists_col('reward_wallets','status')
  union all select 'col: reward_wallets.metadata', vrf_exists_col('reward_wallets','metadata')
  union all select 'col: reward_wallets.created_at', vrf_exists_col('reward_wallets','created_at')
  union all select 'col: reward_wallets.updated_at', vrf_exists_col('reward_wallets','updated_at')

  union all select 'col: customer_qr_payments.customer_user_id', vrf_exists_col('customer_qr_payments','customer_user_id')
  union all select 'col: customer_qr_payments.owner_id', vrf_exists_col('customer_qr_payments','owner_id')
  union all select 'col: customer_qr_payments.points_awarded', vrf_exists_col('customer_qr_payments','points_awarded')
  union all select 'col: customer_qr_payments.status', vrf_exists_col('customer_qr_payments','status')
  union all select 'col: customer_qr_payments.metadata', vrf_exists_col('customer_qr_payments','metadata')
  union all select 'col: customer_qr_payments.created_at', vrf_exists_col('customer_qr_payments','created_at')
  union all select 'col: customer_qr_payments.updated_at', vrf_exists_col('customer_qr_payments','updated_at')

  union all select 'col: referrals.referrer_user_id (canonical owner)', vrf_exists_col('referrals','referrer_user_id')
  union all select 'col: referrals.referred_user_id', vrf_exists_col('referrals','referred_user_id')
  union all select 'col: referrals.points_awarded', vrf_exists_col('referrals','points_awarded')
  union all select 'col: referrals.status', vrf_exists_col('referrals','status')
  union all select 'col: referrals.metadata', vrf_exists_col('referrals','metadata')
  union all select 'col: referrals.created_at', vrf_exists_col('referrals','created_at')
  union all select 'col: referrals.updated_at', vrf_exists_col('referrals','updated_at')

  -- ownership / customer columns reference auth.users ---------------------------
  union all select 'fk: loyalty_config.owner_id -> auth.users', vrf_exists_fk_col('loyalty_config','owner_id','auth','users')
  union all select 'fk: loyalty_point_transactions.customer_user_id -> auth.users', vrf_exists_fk_col('loyalty_point_transactions','customer_user_id','auth','users')
  union all select 'fk: reward_wallets.customer_user_id -> auth.users', vrf_exists_fk_col('reward_wallets','customer_user_id','auth','users')
  union all select 'fk: customer_qr_payments.customer_user_id -> auth.users', vrf_exists_fk_col('customer_qr_payments','customer_user_id','auth','users')

  -- 3) RLS + policies -------------------------------------------------------------
  union all select 'rls enabled: loyalty_config', vrf_rls_enabled('loyalty_config')
  union all select 'rls enabled: loyalty_tiers', vrf_rls_enabled('loyalty_tiers')
  union all select 'rls enabled: loyalty_point_transactions', vrf_rls_enabled('loyalty_point_transactions')
  union all select 'rls enabled: reward_wallets', vrf_rls_enabled('reward_wallets')
  union all select 'rls enabled: customer_qr_payments', vrf_rls_enabled('customer_qr_payments')
  union all select 'rls enabled: referrals', vrf_rls_enabled('referrals')

  union all select 'policies >= 4: loyalty_config', vrf_policy_count('loyalty_config') >= 4
  union all select 'policies >= 4: loyalty_tiers', vrf_policy_count('loyalty_tiers') >= 4
  union all select 'policies >= 4: loyalty_point_transactions', vrf_policy_count('loyalty_point_transactions') >= 4
  union all select 'policies >= 4: reward_wallets', vrf_policy_count('reward_wallets') >= 4
  union all select 'policies >= 4: customer_qr_payments', vrf_policy_count('customer_qr_payments') >= 4
  union all select 'policies >= 4: referrals', vrf_policy_count('referrals') >= 4

  union all select 'no deprecated auth.role() in policies', (
    select count(*) = 0 from pg_policies
    where schemaname = 'public'
      and tablename in ('loyalty_config','loyalty_tiers','loyalty_point_transactions',
                        'reward_wallets','customer_qr_payments','referrals')
      and (qual || ' ' || with_check) ilike '%auth.role(%'
  )
  union all select 'update policies have USING AND WITH CHECK', (
    select count(*) >= 6 from (
      select p.tablename from pg_policies p
      where p.schemaname = 'public' and p.cmd = 'UPDATE'
        and p.qual is not null and p.with_check is not null
        and p.tablename in ('loyalty_config','loyalty_tiers','loyalty_point_transactions',
                            'reward_wallets','customer_qr_payments','referrals')
      group by p.tablename
    ) t
  )

  -- 4) Authenticated grants --------------------------------------------------------
  union all select 'grant SELECT authenticated (all six)', (
    select count(*) = 6 from (
      select table_name from information_schema.role_table_grants
       where grantee = 'authenticated' and privilege_type = 'SELECT'
         and table_name in ('loyalty_config','loyalty_tiers','loyalty_point_transactions',
                            'reward_wallets','customer_qr_payments','referrals')
       group by table_name
    ) t
  )
  union all select 'grant INSERT/UPDATE/DELETE authenticated (all six)', (
    select count(*) = 6 from (
      select table_name from information_schema.role_table_grants
       where grantee = 'authenticated'
         and privilege_type in ('INSERT','UPDATE','DELETE')
         and table_name in ('loyalty_config','loyalty_tiers','loyalty_point_transactions',
                            'reward_wallets','customer_qr_payments','referrals')
       group by table_name
    ) t
  )

  -- 5) Functions & triggers ---------------------------------------------------------
  union all select 'fn: set_updated_at()', to_regprocedure('public.set_updated_at()') is not null
  union all select 'fn: referrals_sync_points_awarded()', to_regprocedure('public.referrals_sync_points_awarded()') is not null
  union all select 'trigger: loyalty_config_set_updated_at', vrf_trigger_exists('loyalty_config','loyalty_config_set_updated_at')
  union all select 'trigger: loyalty_tiers_set_updated_at', vrf_trigger_exists('loyalty_tiers','loyalty_tiers_set_updated_at')
  union all select 'trigger: loyalty_point_transactions_set_updated_at', vrf_trigger_exists('loyalty_point_transactions','loyalty_point_transactions_set_updated_at')
  union all select 'trigger: reward_wallets_set_updated_at', vrf_trigger_exists('reward_wallets','reward_wallets_set_updated_at')
  union all select 'trigger: customer_qr_payments_set_updated_at', vrf_trigger_exists('customer_qr_payments','customer_qr_payments_set_updated_at')
  union all select 'trigger: referrals_sync_points_awarded_trigger', vrf_trigger_exists('referrals','referrals_sync_points_awarded_trigger')
  union all select 'trigger: referrals_set_updated_at', vrf_trigger_exists('referrals','referrals_set_updated_at')

  -- 6) Realtime publication ---------------------------------------------------------
  union all select 'realtime: loyalty_config', vrf_realtime_member('loyalty_config')
  union all select 'realtime: loyalty_tiers', vrf_realtime_member('loyalty_tiers')
  union all select 'realtime: loyalty_point_transactions', vrf_realtime_member('loyalty_point_transactions')
  union all select 'realtime: reward_wallets', vrf_realtime_member('reward_wallets')
  union all select 'realtime: customer_qr_payments', vrf_realtime_member('customer_qr_payments')
  union all select 'realtime: referrals', vrf_realtime_member('referrals')

  -- 7) Seeds / idempotency indexes ---------------------------------------------------
  union all select 'seed: 5 platform loyalty_config rows', (
    select count(*) = 5 from public.loyalty_config where owner_id is null
  )
  union all select 'backfill: platform loyalty_tiers from membership_tiers (>= 4)', (
    select count(*) >= 4 from public.loyalty_tiers where owner_id is null
  )
  union all select 'index: loyalty_point_transactions idempotency (partial unique)', vrf_exists_index('loyalty_point_transactions','loyalty_point_transactions_idempotency_idx')
  union all select 'index: loyalty_point_transactions booking-once (partial unique)', vrf_exists_index('loyalty_point_transactions','loyalty_point_transactions_booking_once_idx')
  union all select 'index: customer_qr_payments qr_transaction_ref (partial unique)', vrf_exists_index('customer_qr_payments','customer_qr_payments_ref_idx')
  union all select 'index: customer_qr_payments idempotency (partial unique)', vrf_exists_index('customer_qr_payments','customer_qr_payments_idempotency_idx')
  union all select 'index: referrals pair unique', vrf_exists_index('referrals','referrals_pair_unique_idx')
)
select check_name, ok from checks;

select check_name,
       case when ok then 'PASS' else 'FAIL' end as status
  from vrf_checks
 order by check_name;

select count(*) filter (where ok) as passed,
       count(*) filter (where not ok) as failed,
       count(*) as total
  from vrf_checks;



drop view if exists vrf_checks;
drop function if exists public.vrf_exists_col(text, text);
drop function if exists public.vrf_exists_fk_col(text, text, text, text);
drop function if exists public.vrf_rls_enabled(text);
drop function if exists public.vrf_policy_count(text);
drop function if exists public.vrf_trigger_exists(text, text);
drop function if exists public.vrf_realtime_member(text);
drop function if exists public.vrf_exists_index(text, text);
