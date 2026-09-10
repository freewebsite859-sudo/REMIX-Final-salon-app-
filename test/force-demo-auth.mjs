/**
 * Test harness helper — forces the LOCAL DEMO auth client.
 *
 * setup-jsdom.mjs seeds an anon-shaped JWT so the integration suite can talk to
 * a stubbed Supabase HTTP endpoint. The invite/referral suite instead exercises
 * the real sign-up code path offline, so it needs the on-device demo client
 * (src/lib/supabase/localDemo.ts). A non-JWT key makes the client factory pick
 * that branch without touching any production code.
 *
 * Load order does not matter: setup-jsdom uses `||=`, so a value set here is
 * never overwritten.
 */
process.env.VITE_SUPABASE_ANON_KEY = 'local-demo-anon-key';
process.env.VITE_NEXORA_ENGAGEMENT = 'false';
