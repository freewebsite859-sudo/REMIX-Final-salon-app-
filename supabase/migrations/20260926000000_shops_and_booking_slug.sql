-- =============================================================================
-- MIGRATION: Add shops table and shop_slug to bookings for external routing
-- Target URL: https://fanal-templetes-app.vercel.app/?site={shop_slug}
-- =============================================================================

-- 1. Ensure shop_slug column exists in bookings table
alter table public.bookings add column if not exists shop_slug text;

-- 2. Create public.shops table for dynamic shop listings
create table if not exists public.shops (
  id               text primary key default gen_random_uuid()::text,
  name             text not null,
  shop_slug        text not null unique,
  slug             text,
  tagline          text,
  description      text,
  category         text,
  categories       text[] default '{}',
  area             text,
  city             text,
  address          text,
  latitude         double precision,
  longitude        double precision,
  maps_url         text,
  image            text,
  gallery          text[] default '{}',
  is_open          boolean default true,
  opening_hours    text,
  price_range      text default '₹₹',
  rating           numeric default 4.8,
  review_count     integer default 0,
  phone            text,
  gender           text default 'unisex',
  services         jsonb default '[]'::jsonb,
  stylists         jsonb default '[]'::jsonb,
  created_at       timestamptz not null default now()
);

alter table public.shops enable row level security;
drop policy if exists "public read shops" on public.shops;
create policy "public read shops" on public.shops for select to anon, authenticated using (true);

-- 3. Seed canonical shops including Roshan Salon
insert into public.shops (
  id, name, shop_slug, slug, tagline, category, categories, area, city, address,
  latitude, longitude, price_range, rating, review_count, phone, gender, is_open
) values (
  'roshan-salon',
  'Roshan Salon',
  'roshan-salon',
  'roshan-salon',
  'Signature haircuts, luxury fades, beard sculpting & premium skin grooming',
  'Barber',
  array['Barber', 'Hair Cut', 'Styling', 'Beard Grooming', 'Grooming', 'Unisex'],
  'Mansarovar',
  'Jaipur',
  'Shop 14, Main Market, Madhyam Marg, Mansarovar, Jaipur, Rajasthan 302020',
  26.8533,
  75.7681,
  '₹₹',
  4.9,
  1850,
  '+91 98290 12345',
  'unisex',
  true
), (
  'scissors-and-shears',
  'Scissors & Shears Salon',
  'scissors-and-shears-salon',
  'scissors-and-shears-salon',
  'Precision haircuts & contemporary styling for trendsetters',
  'Salon',
  array['Hair Cut', 'Styling', 'Unisex', 'Beard Grooming'],
  'Mansarovar',
  'Jaipur',
  'Plot 42, Madhyam Marg, Mansarovar, Jaipur, Rajasthan 302020',
  26.8533,
  75.7681,
  '₹₹',
  4.9,
  1420,
  '+91 141 278 9901',
  'unisex',
  true
)
on conflict (shop_slug) do update set
  name = excluded.name,
  tagline = excluded.tagline,
  category = excluded.category,
  categories = excluded.categories,
  area = excluded.area,
  city = excluded.city;
