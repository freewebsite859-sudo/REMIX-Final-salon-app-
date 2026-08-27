import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Nexora universal Supabase client (Customer App).
 *
 * This is the ONE shared browser client for the whole application.
 * Never call `createClient()` anywhere else — import `supabase` from here so
 * every feature (auth, location sync, data access) shares a single session,
 * a single storage key and a single token-refresh timer.
 *
 * Only public `VITE_*` values are ever read here. A `service_role` key must
 * never reach the browser bundle; a defensive guard below rejects one if it is
 * ever mis-configured into `VITE_SUPABASE_ANON_KEY`.
 */

/**
 * Read public config from Vite's `import.meta.env` (browser/bundled) and fall
 * back to `process.env` for Node contexts such as SSR and test harnesses.
 * Both sources are restricted to public `VITE_*` values.
 */
function readEnv(name: string): string | undefined {
  const viteEnv =
    (import.meta as unknown as { env?: Record<string, string | undefined> })?.env || {};
  const fromVite = viteEnv[name];
  if (fromVite) return fromVite;

  const nodeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env;
  return nodeEnv?.[name];
}

/** Public Nexora project URL (safe to ship — it is in every network request). */
export const NEXORA_SUPABASE_URL =
  readEnv('VITE_SUPABASE_URL')?.trim() || 'https://qwaehqsmodekbgvnaavz.supabase.co';

/**
 * Shared Nexora auth storage key. Every Nexora surface (customer, salon,
 * admin) uses this exact key so a session created by one is recognised by the
 * others on the same origin.
 */
export const NEXORA_AUTH_STORAGE_KEY =
  readEnv('VITE_SUPABASE_STORAGE_KEY')?.trim() || 'nexora.auth.qwaehqsmodekbgvnaavz';

/**
 * Public anon (publishable) key for the Nexora project.
 *
 * This value is PUBLIC BY DESIGN — it is inlined into every browser bundle and
 * is safe to ship because Supabase Row-Level Security governs all data access
 * (an anonymous visitor can read only what RLS publishes; a signed-in user can
 * touch only their own rows). It is provided as a built-in default for the same
 * reason the project URL is: it keeps live authentication working even when a
 * hosting environment has not set `VITE_SUPABASE_ANON_KEY` yet (a missing env
 * var previously made the whole client null and produced the "Live
 * authentication is unavailable" failure). The env var still overrides this
 * default when supplied. NEVER replace it with a service_role key — the guard
 * below rejects privileged keys.
 */
const NEXORA_PUBLIC_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3YWVocXNtb2Rla2Jndm5hYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNjQ5MjksImV4cCI6MjEwMDc0MDkyOX0.K92b2vkEb77dyu8fYYZpMTIbTyP98Vo80TaMo_Hmq_E';

/** Env override wins; otherwise the built-in public anon key is used. */
const supabaseAnonKey = readEnv('VITE_SUPABASE_ANON_KEY')?.trim() || NEXORA_PUBLIC_ANON_KEY;

/**
 * Decode the `role` claim of a Supabase JWT without pulling in a JWT library.
 * Returns `null` when the token is not a decodable JWT.
 */
function readJwtRole(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = JSON.parse(atob(padded)) as { role?: string };
    return typeof decoded?.role === 'string' ? decoded.role : null;
  } catch {
    return null;
  }
}

const anonKeyRole = supabaseAnonKey ? readJwtRole(supabaseAnonKey) : null;

/**
 * Hard security stop: a privileged key in frontend code would bypass RLS for
 * every visitor. Refuse to construct the client instead of leaking it.
 */
const isPrivilegedKey = anonKeyRole === 'service_role';

if (isPrivilegedKey && typeof console !== 'undefined') {
  console.error(
    '[Nexora] SECURITY: VITE_SUPABASE_ANON_KEY contains a service_role key. ' +
      'Supabase client disabled. Replace it with the project anon (public) key.'
  );
}

export const isSupabaseConfigured = Boolean(
  NEXORA_SUPABASE_URL && supabaseAnonKey && !isPrivilegedKey
);

/**
 * Explicit QA switch for the hybrid catalog. In normal operation the same
 * fixture is used only as a graceful fallback when the canonical catalog is
 * empty/unavailable; valid remote rows always win and are never mixed with it.
 */
export const isNexoraDemoMode = readEnv('VITE_NEXORA_DEMO_MODE') === 'true';

/**
 * Singleton guard: Vite HMR (and React StrictMode double-invocation) can
 * re-evaluate this module. Reusing the instance stored on `globalThis`
 * guarantees exactly one GoTrue client — multiple clients on one storage key
 * fight over refresh tokens and randomly sign users out.
 */
const globalRef = globalThis as typeof globalThis & {
  __nexoraSupabaseClient__?: SupabaseClient | null;
};

function createNexoraClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;

  return createClient(NEXORA_SUPABASE_URL, supabaseAnonKey, {
    auth: {
      storageKey: NEXORA_AUTH_STORAGE_KEY,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
    global: {
      headers: {
        'x-nexora-app': 'customer-web',
      },
    },
  });
}

export const supabase: SupabaseClient | null =
  globalRef.__nexoraSupabaseClient__ ?? (globalRef.__nexoraSupabaseClient__ = createNexoraClient());

/** Convenience guard for call-sites that need a non-null client. */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      '[Nexora] Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
    );
  }
  return supabase;
}
