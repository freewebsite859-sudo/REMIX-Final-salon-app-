/**
 * Probe used by security.check.mts.
 *
 * The Supabase client reads its configuration once, at module evaluation time,
 * so each scenario needs a process of its own. This probe loads the client
 * under whatever environment it was spawned with and prints the resulting
 * configuration verdict as JSON on the last line of stdout.
 */
const { supabase, getSupabaseConfigStatus } = await import('../src/lib/supabase.ts');

const status = getSupabaseConfigStatus();

process.stdout.write(
  '\nPROBE ' +
    JSON.stringify({
      clientCreated: supabase !== null,
      isConfigured: status.isConfigured,
      hasUrl: status.hasUrl,
      hasAnonKey: status.hasAnonKey,
      isPrivilegedKey: status.isPrivilegedKey,
      anonKeyRole: status.anonKeyRole,
      urlPlaceholder: status.urlPlaceholder,
      anonKeyPlaceholder: status.anonKeyPlaceholder,
    }) +
    '\n',
);

process.exit(0);
