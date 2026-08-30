import React, { useState } from 'react';
import { CheckCircle2, Eye, EyeOff, Lock, Loader2 } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { SupabaseConfigBanner } from '../SupabaseConfigBanner';

interface PasswordUpdatePageProps {
  onComplete: () => void;
}

/** The second half of Supabase's password-recovery flow. */
export const PasswordUpdatePage: React.FC<PasswordUpdatePageProps> = ({ onComplete }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!isSupabaseConfigured || !supabase) {
      setError('Live password recovery is unavailable. Configure Supabase and try again.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message || 'Unable to update your password.');
        return;
      }
      setSuccess(true);
      window.setTimeout(onComplete, 700);
    } catch (err) {
      console.error('[Nexora] Password update failed:', err);
      setError('A network error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full flex items-center justify-center p-4 bg-[#fcf9f8] font-sans">
      <div className="w-full max-w-[440px] rounded-[24px] p-6 sm:p-8 bg-white shadow-xl border border-[#f0e4e8]">
        {/* Proactive config banner — a password cannot be updated without Supabase. */}
        {!isSupabaseConfigured && (
          <div className="mb-5">
            <SupabaseConfigBanner action="update your password" compact />
          </div>
        )}

        {success ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-14 h-14 mx-auto mb-4 text-[#16804b]" />
            <h1 className="text-2xl font-bold text-[#1c1b1b]">Password updated</h1>
            <p className="mt-2 text-sm text-[#594047]">Your password was changed securely.</p>
          </div>
        ) : (
          <>
            <div className="mb-6 text-center">
              <div className="inline-flex w-12 h-12 rounded-2xl bg-[#b90064]/10 text-[#b90064] items-center justify-center mb-3">
                <Lock className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold text-[#1c1b1b]">Choose a new password</h1>
              <p className="mt-2 text-sm text-[#594047]">Use at least 8 characters for your Nexora account.</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <PasswordField
                id="new-password"
                label="New password"
                value={password}
                visible={showPassword}
                onChange={setPassword}
                onToggle={() => setShowPassword((value) => !value)}
              />
              <PasswordField
                id="confirm-new-password"
                label="Confirm new password"
                value={confirmPassword}
                visible={showConfirmPassword}
                onChange={setConfirmPassword}
                onToggle={() => setShowConfirmPassword((value) => !value)}
              />
              {error && <p className="text-sm text-[#b90064] font-medium">{error}</p>}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-[52px] rounded-lg bg-[#b90064] text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
                {isLoading ? 'Updating password…' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
};

function PasswordField({
  id,
  label,
  value,
  visible,
  onChange,
  onToggle,
}: {
  id: string;
  label: string;
  value: string;
  visible: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-[#1c1b1b] mb-1.5">
        {label}
      </label>
      <div className="relative">
        <Lock className="absolute left-3.5 top-4 w-4 h-4 text-[#594047]/70" />
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={id === 'new-password' ? 'new-password' : 'new-password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full h-[52px] pl-10 pr-11 rounded-lg border border-[#e8e8e8] outline-none focus:border-[#b90064] focus:ring-4 focus:ring-[#b90064]/10"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={visible ? `Hide ${label}` : `Show ${label}`}
          className="absolute right-3 top-3.5 text-[#594047]"
        >
          {visible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}
