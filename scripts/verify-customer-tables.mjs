#!/usr/bin/env node
/**
 * Verify that the 18 customer-app tables are present on the configured
 * Supabase project.
 *
 * Usage:
 *   VITE_SUPABASE_URL=https://<project>.supabase.co \
 *   VITE_SUPABASE_ANON_KEY=<anon public key> \
 *   node scripts/verify-customer-tables.mjs
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env' });

const TABLES = [
  'profiles',
  'salons',
  'salon_services',
  'salon_staff',
  'staff_slots',
  'bookings',
  'booking_services',
  'favourites',
  'reviews',
  'reward_wallets',
  'reward_transactions',
  'customer_qr_payments',
  'memberships',
  'referrals',
  'notifications',
  'search_history',
  'offers',
  'offer_redemptions',
];

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

const url = process.env.VITE_SUPABASE_URL;
const anon = process.env.VITE_SUPABASE_ANON_KEY;
if (!url) fail('VITE_SUPABASE_URL is required.');
if (!anon || anon.length < 20) fail('VITE_SUPABASE_ANON_KEY is required (public anon key).');
try {
  const payload = JSON.parse(Buffer.from(anon.split('.')[1], 'base64').toString());
  if (payload.role === 'service_role') fail('VITE_SUPABASE_ANON_KEY must be the anon public key, not service_role.');
} catch {
  // Not decodable — let Supabase handle it.
}

const client = createClient(url, anon, { auth: { persistSession: false } });

async function checkTable(name) {
  try {
    const { error } = await client.from(name).select('*', { count: 'exact', head: true });
    if (!error) return { name, present: true };
    const code = error.code || '';
    const msg = error.message || '';
    if (code === '42P01' || code === 'PGRST205' || msg.includes('does not exist') || msg.includes('Could not find the table')) {
      return { name, present: false, error: msg };
    }
    // RLS/policy errors still prove the table exists.
    return { name, present: true, error: msg };
  } catch (err) {
    return { name, present: false, error: err instanceof Error ? err.message : String(err) };
  }
}

const results = await Promise.all(TABLES.map(checkTable));
let detected = 0;
for (const r of results) {
  if (r.present) detected += 1;
  console.log(`${r.present ? '✓' : '✗'} ${r.name}${r.present && r.error ? ` (${r.error})` : r.present ? '' : ` (${r.error || 'missing'})`}`);
}

console.log(`\n${detected}/${TABLES.length} customer-app tables detected.`);
if (detected !== TABLES.length) process.exit(1);
console.log('All 18 customer-app tables are present. The app can read/write the canonical Nexora SalonOS schema.');
