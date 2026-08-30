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
 *
 * Uses Vite public env vars:
 * - VITE_SUPABASE_URL
 * - VITE_SUPABASE_ANON_KEY
 * Both are read via import.meta.env (Vite injects at build time) with fallback
 * to process.env for Node contexts (SSR, tests).
 */

// Read env with static access for Vite inlining + dynamic fallback for Node
function getEnvVar(name: string): string | undefined {
  // Vite static access - these are inlined at build time
  // We check both static and dynamic to support HMR and tests
  try {
    // @ts-ignore - Vite env
    const viteEnv = (import.meta as any)?.env as Record<string, string | undefined> | undefined;
    if (viteEnv) {
      const val = viteEnv[name];
      if (val) return val;
    }
  } catch {
    // import.meta not available in Node
  }

  // Node fallback (tests, SSR, server.ts)
  try {
    const nodeEnv = (globalThis as any)?.process?.env as Record<string, string | undefined> | undefined;
    if (nodeEnv) {
      const val = nodeEnv[name];
      if (val) return val;
    }
  } catch {
    // no process
  }

  return undefined;
}

// Public URL - with fallback to intended project for safety
// Uses static import.meta.env access so Vite can inline at build
const envUrl = (() => {
  try {
    // Static access for Vite build-time inlining
    // @ts-ignore
    return (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  } catch {
    return undefined;
  }
})() || getEnvVar('VITE_SUPABASE_URL')?.trim();

export const NEXORA_SUPABASE_URL =
  envUrl || 'https://qwaehqsmodekbgvnaavz.supabase.co';

// Shared auth storage key
const envStorageKey = (() => {
  try {
    // @ts-ignore
    return (import.meta.env.VITE_SUPABASE_STORAGE_KEY as string | undefined)?.trim();
  } catch {
    return undefined;
  }
})() || getEnvVar('VITE_SUPABASE_STORAGE_KEY')?.trim();

export const NEXORA_AUTH_STORAGE_KEY =
  envStorageKey || 'nexora.auth.qwaehqsmodekbgvnaavz';

// Public anon key - MUST be supplied via VITE_SUPABASE_ANON_KEY
// No hardcoded fallback for anon key to avoid leaking credentials
// In dev, .env provides it; in tests, setup-jsdom provides dummy JWT
const envAnonKey = (() => {
  try {
    // Static access for Vite inlining - critical for build to include env
    // @ts-ignore
    return (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
  } catch {
    return undefined;
  }
})() || getEnvVar('VITE_SUPABASE_ANON_KEY')?.trim();

const supabaseAnonKey = envAnonKey || '';

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
    const decoded = JSON.parse(atob(padded)) as { role?: string; ref?: string };
    return typeof decoded?.role === 'string' ? decoded.role : null;
  } catch {
    return null;
  }
}

function readJwtRef(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = JSON.parse(atob(padded)) as { ref?: string };
    return typeof decoded?.ref === 'string' ? decoded.ref : null;
  } catch {
    return null;
  }
}

const anonKeyRole = supabaseAnonKey ? readJwtRole(supabaseAnonKey) : null;
const anonKeyRef = supabaseAnonKey ? readJwtRef(supabaseAnonKey) : null;

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

// Validate URL format and anon key presence
const hasValidUrl = Boolean(
  NEXORA_SUPABASE_URL && NEXORA_SUPABASE_URL.startsWith('https://') && NEXORA_SUPABASE_URL.includes('.supabase.co')
);
const hasAnonKey = Boolean(supabaseAnonKey && supabaseAnonKey.length > 20);

export const isSupabaseConfigured = Boolean(hasValidUrl && hasAnonKey && !isPrivilegedKey);

/**
 * Safe diagnostics — reports whether config exists without ever printing the full key.
 * Useful for debugging Vite env injection issues.
 */
function logConfigDiagnostics(): void {
  if (typeof console === 'undefined') return;
  
  let isDev = false;
  try {
    // @ts-ignore
    isDev = Boolean((import.meta.env as any)?.DEV);
  } catch {
    isDev = getEnvVar('MODE') === 'development' || getEnvVar('DEV') === 'true';
  }
  
  if (!isSupabaseConfigured) {
    console.warn(
      '[Nexora] Supabase not configured — live authentication unavailable. ' +
        `URL present: ${hasValidUrl}, anon key present: ${hasAnonKey}, privileged key: ${isPrivilegedKey}. ` +
        'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY then rebuild.'
    );
    return;
  }

  if (isDev) {
    // Safe: only show first 8 chars and role, never full key
    const keyPreview = supabaseAnonKey ? `${supabaseAnonKey.slice(0, 8)}...${supabaseAnonKey.slice(-4)}` : 'missing';
    console.info(
      `[Nexora] Supabase configured — URL: ${NEXORA_SUPABASE_URL}, ` +
        `anon key: ${keyPreview} (role=${anonKeyRole}, ref=${anonKeyRef}), ` +
        `storage: ${NEXORA_AUTH_STORAGE_KEY}`
    );

    // Verify key belongs to same project as URL if possible
    if (anonKeyRef) {
      const urlRef = NEXORA_SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
      if (urlRef && anonKeyRef !== urlRef) {
        console.warn(
          `[Nexora] WARNING: anon key ref (${anonKeyRef}) does not match URL ref (${urlRef}). ` +
            'Ensure both belong to same Supabase project.'
        );
      }
    }
  }
}

// Run diagnostics once at module load
logConfigDiagnostics();

// Demo mode flag
const demoModeEnv = (() => {
  try {
    // @ts-ignore
    return (import.meta.env.VITE_NEXORA_DEMO_MODE as string | undefined);
  } catch {
    return undefined;
  }
})() || getEnvVar('VITE_NEXORA_DEMO_MODE');

export const isNexoraDemoMode = demoModeEnv === 'true';

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

/**
 * Returns detailed config status for error handling UI.
 * Distinguishes CONFIGURATION ERROR from other error types.
 */
export function getSupabaseConfigStatus(): {
  isConfigured: boolean;
  hasUrl: boolean;
  hasAnonKey: boolean;
  isPrivilegedKey: boolean;
  url: string;
  anonKeyRole: string | null;
  anonKeyRef: string | null;
} {
  return {
    isConfigured: isSupabaseConfigured,
    hasUrl: hasValidUrl,
    hasAnonKey,
    isPrivilegedKey,
    url: NEXORA_SUPABASE_URL,
    anonKeyRole,
    anonKeyRef,
  };
}
