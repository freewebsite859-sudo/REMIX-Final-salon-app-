-- =============================================================================
-- Nexora catalog — public read policy (reference, idempotent)
-- =============================================================================
-- The customer discovery UI reads salons/services/categories/professionals from
-- Supabase BEFORE a visitor has signed in, so these catalog tables must be
-- readable by both the `anon` role (guests) and the `authenticated` role
-- (signed-in customers). As audited against project qwaehqsmodekbgvnaavz:
--   * `services`      -> readable by anon (real rows returned)
--   * `salons`        -> table EXISTS but `permission denied for table salons`
--   * `user_locations`-> correctly locked down (own-rows only)
--   * `categories`, `professionals` -> not present in the schema cache yet
--
-- This script ONLY grants read access to catalog data. It never enables writes
-- from anon/authenticated (customer bookings/availability mutations belong on
-- the canonical server/Edge-Function layer), and it does not touch the
-- per-user `user_locations` RLS contract. It is safe to re-run and skips any
-- table that does not yet exist (categories/professionals are created by the
-- canonical migration chain; when they arrive they can simply be re-run here).
--
-- Apply in the Supabase SQL Editor or via:
--   supabase db execute --file supabase/policies/catalog_public_read.sql
-- =============================================================================

do $$
declare
  catalog_tables text[] := array[
    'salons',
    'services',
    'categories',
    'professionals'
  ];
  tbl text;
begin
  foreach tbl in array catalog_tables loop
    -- Skip tables the canonical migrations have not created yet.
    if to_regclass(format('public.%I', tbl)) is null then
      continue;
    end if;

    -- RLS stays ON (defense in depth); we then publish read-only visibility.
    execute format('alter table public.%I enable row level security;', tbl);

    -- Grant the SELECT privilege at the table level to both roles.
    execute format('grant select on public.%I to anon;', tbl);
    execute format('grant select on public.%I to authenticated;', tbl);

    -- A permissive "public read" policy. Dropping/re-creating keeps the file
    -- idempotent. No INSERT/UPDATE/DELETE policy is created, so the catalog is
    -- read-only from the browser for every role.
    execute format('drop policy if exists "catalog public read" on public.%I;', tbl);
    execute format($p$
      create policy "catalog public read"
        on public.%I
        for select
        to anon, authenticated
        using (true)
    $p$, tbl);
  end loop;
end $$;
