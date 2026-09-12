import React from 'react';
import { Lock, LogIn, UserPlus } from 'lucide-react';

interface GuestModeBannerProps {
  title?: string;
  description?: string;
  onRequireAuth?: (mode?: 'login' | 'signup') => void;
  className?: string;
}

export const GuestModeBanner: React.FC<GuestModeBannerProps> = ({
  title = 'Guest Mode (Read-Only)',
  description = 'You are browsing in preview mode. Sign in or create a salon owner account to add, edit, or customize details.',
  onRequireAuth,
  className = '',
}) => {
  return (
    <div
      className={`p-4 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${className}`}
      id="guest-mode-read-only-banner"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
          <Lock className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-amber-950 text-xs sm:text-sm">{title}</h3>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 border border-amber-300">
              Read-Only
            </span>
          </div>
          <p className="text-amber-800/90 mt-0.5 text-[11px] sm:text-xs">
            {description}
          </p>
        </div>
      </div>
      {onRequireAuth && (
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button
            type="button"
            onClick={() => onRequireAuth('login')}
            className="px-3 py-1.5 rounded-xl border border-amber-300 bg-white hover:bg-amber-100/70 text-amber-900 font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            id="guest-mode-login-btn"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Log In</span>
          </button>
          <button
            type="button"
            onClick={() => onRequireAuth('signup')}
            className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            id="guest-mode-signup-btn"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Sign Up</span>
          </button>
        </div>
      )}
    </div>
  );
};
