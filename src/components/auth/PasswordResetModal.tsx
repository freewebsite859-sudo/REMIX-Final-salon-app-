import React, { useState } from 'react';
import { Mail, ArrowLeft, CheckCircle2, Loader2, X } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

interface PasswordResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEmail?: string;
}

export const PasswordResetModal: React.FC<PasswordResetModalProps> = ({
  isOpen,
  onClose,
  initialEmail = '',
}) => {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Please enter your email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);

    try {
      if (isSupabaseConfigured && supabase) {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: window.location.origin,
        });

        if (resetError) {
          setError(resetError.message || 'Unable to send reset link. Please try again.');
          setIsLoading(false);
          return;
        }
      } else {
        // Simulated network delay for smooth UI feedback
        await new Promise((resolve) => setTimeout(resolve, 800));
      }

      setIsLoading(false);
      setIsSuccess(true);
    } catch {
      setIsLoading(false);
      setError('An unexpected error occurred. Please try again.');
    }
  };

  const handleResetState = () => {
    setIsSuccess(false);
    setError(null);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1c1b1b]/40 backdrop-blur-md animate-in fade-in duration-300"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleResetState();
      }}
    >
      <div
        className="w-full max-w-[440px] rounded-[24px] p-6 sm:p-8 text-[#1c1b1b] relative transition-all duration-300 animate-in zoom-in-95"
        style={{
          background: 'rgba(255, 255, 255, 0.75)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          border: '1px solid rgba(255, 255, 255, 0.75)',
          boxShadow: '0 25px 70px rgba(185, 0, 100, 0.12), 0 10px 30px rgba(0, 0, 0, 0.08)',
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={handleResetState}
          aria-label="Close modal"
          className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center text-[#594047] hover:text-[#1c1b1b] hover:bg-black/5 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {isSuccess ? (
          /* Success State */
          <div className="flex flex-col items-center text-center py-3">
            <div className="w-14 h-14 rounded-2xl bg-[#b90064]/10 text-[#b90064] flex items-center justify-center mb-4 ring-8 ring-[#b90064]/5">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h3 className="text-[22px] sm:text-[24px] font-bold text-[#1c1b1b] tracking-tight">
              Reset Link Sent
            </h3>

            <p className="text-[14px] text-[#594047] mt-2 leading-relaxed max-w-[320px]">
              Check your inbox at <strong className="text-[#1c1b1b]">{email}</strong> for instructions to securely reset your password.
            </p>

            <button
              type="button"
              onClick={handleResetState}
              className="mt-6 w-full h-[50px] bg-[#b90064] hover:bg-[#a00056] text-white font-semibold rounded-lg text-[14px] shadow-sm transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(185,0,100,0.25)]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Login</span>
            </button>
          </div>
        ) : (
          /* Input Form */
          <div>
            <div className="text-center mb-6">
              <div className="inline-flex w-12 h-12 rounded-2xl bg-[#b90064]/10 text-[#b90064] items-center justify-center mb-3">
                <Mail className="w-6 h-6" />
              </div>
              <h2 className="text-[24px] font-bold text-[#1c1b1b] tracking-tight">
                Reset Your Password
              </h2>
              <p className="text-[14px] text-[#594047] mt-1.5 leading-relaxed">
                Enter your email address and we'll send you a secure password reset link.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="reset-email"
                  className="block text-[13px] font-medium text-[#1c1b1b] mb-1.5"
                >
                  Gmail / Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#594047]">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="you@gmail.com"
                    className="w-full h-[52px] pl-10 pr-4 bg-white/80 focus:bg-white text-[#1c1b1b] placeholder:text-[#594047]/50 rounded-lg text-[14px] border border-[#e8e8e8] focus:border-[#b90064] focus:ring-4 focus:ring-[#b90064]/10 transition-all outline-none"
                  />
                </div>
                {error && (
                  <p className="text-[12px] text-[#b90064] font-medium mt-1.5 flex items-center gap-1">
                    <span>{error}</span>
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="mt-2 w-full h-[52px] bg-[#b90064] hover:bg-[#a00056] text-white font-semibold rounded-lg text-[15px] shadow-sm transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(185,0,100,0.25)] disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Sending Reset Link...</span>
                  </>
                ) : (
                  <span>Send Reset Link</span>
                )}
              </button>

              <button
                type="button"
                onClick={handleResetState}
                className="w-full text-center text-[13px] font-medium text-[#594047] hover:text-[#b90064] transition-colors py-1 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Login</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
