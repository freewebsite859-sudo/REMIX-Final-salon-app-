import React from 'react';
import { isSupabaseConfigured, getSupabaseConfigStatus } from '../lib/supabase';

interface SupabaseConfigBannerProps {
  /** What the user is trying to do, e.g. "sign in" or "reset your password". */
  action?: string;
  /** Compact variant for narrow modals. */
  compact?: boolean;
}

/**
 * Proactive banner for a missing/invalid Supabase configuration.
 *
 * Every auth surface used to report this only after the user filled in the form
 * and pressed submit, so an unconfigured deployment looked like a working app
 * until it silently failed. This renders the reason up front and names the exact
 * variables to set, instead of a generic "something went wrong".
 *
 * Renders nothing when the client is configured, so production is unaffected.
 */
export const SupabaseConfigBanner: React.FC<SupabaseConfigBannerProps> = ({
  action = 'continue',
  compact = false,
}) => {
  if (isSupabaseConfigured) return null;

  const status = getSupabaseConfigStatus();

  // A privileged key is a security fault, not just a missing value: the app
  // refuses to build a client with it, and it must never ship to the browser.
  const missing: string[] = [];
  if (!status.hasUrl) missing.push('VITE_SUPABASE_URL');
  if (!status.hasAnonKey) missing.push('VITE_SUPABASE_ANON_KEY');

  const headline = status.isPrivilegedKey
    ? 'Insecure key configured — authentication disabled'
    : `Live authentication is not configured — you cannot ${action}`;

  const detail = status.isPrivilegedKey
    ? 'VITE_SUPABASE_ANON_KEY contains a service_role key. That key would bypass row-level security for every visitor, so the Supabase client is disabled on purpose. Replace it with the project anon (public) key.'
    : missing.length
      ? `Missing ${missing.join(' and ')}. Add ${missing.length === 1 ? 'it' : 'them'} to your .env, then rebuild (npm run build) or restart the dev server.`
      : 'The Supabase URL or anon key is invalid. Check VITE_SUPABASE_URL is an https://<project>.supabase.co address and VITE_SUPABASE_ANON_KEY is the anon public key.';

  return (
    <div
      id="supabase-config-banner"
      role="alert"
      data-reason={
        status.isPrivilegedKey ? 'privileged-key' : missing.length ? 'missing-env' : 'invalid-env'
      }
      className={`rounded-2xl border border-amber-500/40 bg-amber-500/10 text-amber-900 ${
        compact ? 'p-3' : 'p-4'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <span className="material-symbols-outlined text-[20px] shrink-0 mt-0.5">
          {status.isPrivilegedKey ? 'gpp_bad' : 'cloud_off'}
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-bold leading-snug">{headline}</p>
          <p className={`text-[11px] leading-relaxed mt-1 break-words`}>{detail}</p>
          {!status.isPrivilegedKey && status.url && (
            <p className="text-[10px] mt-1.5 opacity-80">
              Project URL currently in use:{' '}
              <span className="font-mono">{status.url}</span>
            </p>
          )}
          <p className="text-[10px] mt-1.5 opacity-80">
            Nothing you enter here is sent anywhere until this is fixed.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SupabaseConfigBanner;
