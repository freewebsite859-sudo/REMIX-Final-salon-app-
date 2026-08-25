#!/usr/bin/env node
import 'dotenv/config';

/**
 * Nexora LIVE end-to-end verification — NO STUBS.
 *
 * Talks directly to the real Supabase project over the network and verifies
 * the auth + location architecture end to end:
 *
 *   1. Backend reachability
 *   2. Anon key is a real anon key (never service_role)
 *   3. Sign-in with a real user
 *   4. Session persistence under the Nexora storage key
 *   5. Session restore ("auto-login") with a fresh client
 *   6. Token refresh produces a new access token
 *   7. useLocationSync write path — upsert under RLS
 *   8. RLS read-back returns exactly the caller's own row
 *   9. RLS isolation — a foreign user_id write is REJECTED
 *  10. Logout teardown — row deleted BEFORE the JWT is invalidated
 *  11. Post-logout writes are rejected (no anonymous access)
 *
 * Usage:
 *   VITE_SUPABASE_URL=https://qwaehqsmodekbgvnaavz.supabase.co \
 *   VITE_SUPABASE_ANON_KEY=<anon key> \
 *   NEXORA_TEST_EMAIL=<user> NEXORA_TEST_PASSWORD=<pass> \
 *   node scripts/verify-live.mjs
 *
 * Exits non-zero if any check fails. Safe to run against production: it only
 * touches the signed-in test user's own row and cleans up after itself.
 */

import { createClient } from '@supabase/supabase-js';

const URL_ = process.env.VITE_SUPABASE_URL || 'https://qwaehqsmodekbgvnaavz.supabase.co';
const ANON = process.env.VITE_SUPABASE_ANON_KEY || '';
const STORAGE_KEY =
  process.env.VITE_SUPABASE_STORAGE_KEY || 'nexora.auth.qwaehqsmodekbgvnaavz';
const TABLE = process.env.VITE_NEXORA_LOCATION_TABLE || 'user_locations';
const EMAIL = process.env.NEXORA_TEST_EMAIL || '';
const PASSWORD = process.env.NEXORA_TEST_PASSWORD || '';

const results = [];
const ok = (n, p, d = '') => {
  results.push({ n, p, d });
  console.log(`${p ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`);
};
const info = (m) => console.log(`      ${m}`);

function die(msg) {
  console.error(`\nFATAL: ${msg}`);
  process.exit(2);
}

if (!ANON) die('VITE_SUPABASE_ANON_KEY is required.');
if (!EMAIL || !PASSWORD) {
  die('NEXORA_TEST_EMAIL and NEXORA_TEST_PASSWORD are required (a real Supabase user).');
}

function jwtRole(token) {
  try {
    const p = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(Buffer.from(p, 'base64').toString()).role ?? null;
  } catch {
    return null;
  }
}

/** In-memory localStorage shim so persistence is observable in Node. */
function makeStorage() {
  const m = new Map();
  return {
    store: m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

const clientOpts = (storage) => ({
  auth: {
    storageKey: STORAGE_KEY,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
    storage,
  },
});

console.log(`\nNexora live verification\n  URL:   ${URL_}\n  table: ${TABLE}\n  user:  ${EMAIL}\n`);

// 1. Reachability -----------------------------------------------------------
try {
  const r = await fetch(`${URL_}/auth/v1/health`, {
    headers: { apikey: ANON },
    signal: AbortSignal.timeout(15000),
  });
  ok('backend reachable', r.ok, `HTTP ${r.status}`);
  if (!r.ok) die('Supabase health check failed — check URL/network.');
} catch (e) {
  ok('backend reachable', false, e.message);
  die(`Cannot reach ${URL_} (${e.cause?.code || e.message}). Run this from an un-sandboxed network.`);
}

// 2. Key hygiene ------------------------------------------------------------
const role = jwtRole(ANON);
ok('anon key is NOT a service_role key', role !== 'service_role', `role=${role ?? 'unknown'}`);
if (role === 'service_role') die('service_role key supplied — aborting.');

// 3. Sign in ----------------------------------------------------------------
const storage = makeStorage();
const supabase = createClient(URL_, ANON, clientOpts(storage));

const { data: signIn, error: signInErr } = await supabase.auth.signInWithPassword({
  email: EMAIL,
  password: PASSWORD,
});
ok('sign in with password', !signInErr && !!signIn?.session, signInErr?.message || '');
if (signInErr || !signIn?.session) die('Sign-in failed — cannot continue.');

const userId = signIn.user.id;
const firstAccessToken = signIn.session.access_token;
info(`user id: ${userId}`);

// 4. Persistence ------------------------------------------------------------
const persisted = storage.getItem(STORAGE_KEY);
ok('session persisted under Nexora storage key', !!persisted, STORAGE_KEY);

// 5. Restore / auto-login with a brand-new client ---------------------------
const restoreClient = createClient(URL_, ANON, clientOpts(storage));
const { data: restored } = await restoreClient.auth.getSession();
ok(
  'session restored by a fresh client (auto-login after reload)',
  restored?.session?.user?.id === userId,
  restored?.session ? 'session found' : 'no session'
);

// 6. Token refresh ----------------------------------------------------------
const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
const newToken = refreshed?.session?.access_token;
ok('token refresh succeeds', !refreshErr && !!newToken, refreshErr?.message || '');
ok('refreshed access token is new', !!newToken && newToken !== firstAccessToken);

// 7. Location upsert (the useLocationSync write path) ------------------------
const coords = { latitude: 26.8533, longitude: 75.7681 };
const { error: upsertErr } = await supabase.from(TABLE).upsert(
  {
    user_id: userId,
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: 12.5,
    heading: null,
    speed: null,
    updated_at: new Date().toISOString(),
  },
  { onConflict: 'user_id' }
);
ok('live coordinates upserted under RLS', !upsertErr, upsertErr?.message || '');
if (upsertErr) {
  info(`code=${upsertErr.code}`);
  info(`Has supabase/policies/user_locations.sql been applied to this project?`);
}

// 8. Read back own row ------------------------------------------------------
const { data: rows, error: readErr } = await supabase.from(TABLE).select('*').eq('user_id', userId);
ok('own location row readable', !readErr && rows?.length === 1, readErr?.message || `rows=${rows?.length ?? 0}`);
if (rows?.[0]) {
  const near = Math.abs(rows[0].latitude - coords.latitude) < 0.001;
  ok('stored coordinates match what was sent', near, `lat=${rows[0].latitude} lng=${rows[0].longitude}`);
}

// 9. RLS isolation ----------------------------------------------------------
const foreignId = '00000000-0000-4000-8000-000000000000';
const { error: foreignErr } = await supabase
  .from(TABLE)
  .upsert({ user_id: foreignId, latitude: 0, longitude: 0 }, { onConflict: 'user_id' });
ok(
  "RLS rejects writing another user's row",
  !!foreignErr,
  foreignErr ? `blocked (${foreignErr.code})` : 'NOT BLOCKED — policy is too permissive'
);

const { data: allRows } = await supabase.from(TABLE).select('user_id');
ok(
  'RLS scopes reads to the caller only',
  Array.isArray(allRows) && allRows.every((r) => r.user_id === userId),
  `visible rows=${allRows?.length ?? 0}`
);

// 10. Logout teardown: delete BEFORE invalidating the JWT --------------------
const { error: delErr } = await supabase.from(TABLE).delete().eq('user_id', userId);
ok('location row deleted while JWT still valid', !delErr, delErr?.message || '');

const { data: afterDel } = await supabase.from(TABLE).select('*').eq('user_id', userId);
ok('location row is gone before sign-out', (afterDel?.length ?? 0) === 0, `rows=${afterDel?.length ?? 0}`);

const { error: outErr } = await supabase.auth.signOut();
ok('sign out succeeds', !outErr, outErr?.message || '');

const { data: postOut } = await supabase.auth.getSession();
ok('session cleared after sign out', !postOut?.session);
ok('persisted session removed from storage', !storage.getItem(STORAGE_KEY));

// 11. No anonymous writes ---------------------------------------------------
const anonClient = createClient(URL_, ANON, clientOpts(makeStorage()));
const { error: anonErr } = await anonClient
  .from(TABLE)
  .upsert({ user_id: userId, latitude: 1, longitude: 1 }, { onConflict: 'user_id' });
ok(
  'anonymous (signed-out) writes are rejected',
  !!anonErr,
  anonErr ? `blocked (${anonErr.code})` : 'NOT BLOCKED — anon can write!'
);

// Summary -------------------------------------------------------------------
const failed = results.filter((r) => !r.p);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log('\nFAILED:');
  for (const f of failed) console.log(`  - ${f.n}${f.d ? ` (${f.d})` : ''}`);
  process.exit(1);
}
console.log('\nAll live checks passed.');
process.exit(0);
