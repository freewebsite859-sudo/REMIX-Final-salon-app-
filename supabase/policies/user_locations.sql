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
