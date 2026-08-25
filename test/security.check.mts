/**
 * Verifies the frontend refuses to construct a Supabase client when a
 * privileged service_role key is mis-configured into a public VITE_* var.
 */
const { supabase, isSupabaseConfigured } = await import('../src/lib/supabase.ts');
const blocked = supabase === null && isSupabaseConfigured === false;
console.log(blocked
  ? 'PASS  service_role key rejected — client NOT created'
  : 'FAIL  service_role key was accepted (client leaked)');
process.exit(blocked ? 0 : 1);
