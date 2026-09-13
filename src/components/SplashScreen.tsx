import React, { useEffect, useState } from 'react';
import { NexoraLogo } from './auth/NexoraLogo';

interface SplashScreenProps {
  /**
   * Human-readable phase shown under the wordmark — "Restoring your session",
   * "Loading salons near you"… Empty hides the line entirely.
   */
  status?: string;
  /**
   * Milliseconds the splash stays on screen even if everything resolves
   * instantly. A splash that flashes for 40 ms reads as a rendering glitch,
   * so the brand mark gets a stable minimum hold.
   */
  minimumMs?: number;
  /** Fired once the minimum hold has elapsed, so the caller can hand off. */
  onMinimumElapsed?: () => void;
  /**
   * Plays the exit animation instead of the entrance. The caller keeps the
   * component mounted for the duration so the handoff into login/home is a
   * crossfade rather than the splash vanishing on the next paint.
   */
  exiting?: boolean;
}

/** Length of the exit crossfade; the caller waits this long before unmounting. */
export const SPLASH_EXIT_MS = 240;

/**
 * Minimum time the splash stays up even when everything resolves instantly.
 * The brand mark's entrance animation runs 600 ms, so a shorter hold cuts it
 * off mid-draw and the splash reads as a rendering glitch rather than a boot.
 */
export const SPLASH_MINIMUM_MS = 900;

/**
 * Nexora splash screen.
 *
 * Shown while the app restores the Supabase session and resolves the catalog.
 * It replaces the bare "Restoring your secure session…" paragraph that used to
 * sit in `App.tsx`, which left a blank white viewport for the whole
 * round-trip on a cold start.
 *
 * Accessibility: the container is a live `role="status"` region with an
 * `aria-live="polite"` announcement, so a screen reader hears the phase rather
 * than silence, and the animation is suppressed under `prefers-reduced-motion`.
 */
export const SplashScreen: React.FC<SplashScreenProps> = ({
  status = 'Getting things ready',
  minimumMs = SPLASH_MINIMUM_MS,
  onMinimumElapsed,
  exiting = false,
}) => {
  const [heldFor, setHeldFor] = useState(0);

  useEffect(() => {
    if (minimumMs <= 0) {
      onMinimumElapsed?.();
      return;
    }
    // Count in 120 ms steps so the progress bar animates without a timer per
    // frame. The handoff fires from the timer callback itself — never from
    // inside the state updater, which React requires to stay pure (it may be
    // invoked twice under StrictMode, or not at the moment we expect).
    const step = 120;
    let elapsed = 0;
    const id = window.setInterval(() => {
      elapsed += step;
      setHeldFor(Math.min(elapsed, minimumMs));
      if (elapsed >= minimumMs) {
        window.clearInterval(id);
        onMinimumElapsed?.();
      }
    }, step);
    return () => window.clearInterval(id);
    // The callback identity is deliberately not a dependency: a parent that
    // re-renders must not restart the hold timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minimumMs]);

  const progress =
    minimumMs > 0 ? Math.min(100, Math.round((heldFor / minimumMs) * 100)) : 100;

  return (
    <main
      data-testid="nexora-splash"
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-exiting={exiting ? 'true' : undefined}
      className={`min-h-screen w-full flex flex-col items-center justify-center bg-gradient-to-b from-surface-off-white via-white to-[#fdf2f8] text-on-surface px-6 motion-safe:${
        exiting
          ? `animate-[nexora-splash-out_${SPLASH_EXIT_MS}ms_ease-in_both]`
          : 'animate-none'
      }`}
    >
      {/* Brand mark */}
      <div className="flex flex-col items-center motion-safe:animate-[nexora-splash-in_600ms_ease-out_both]">
        <NexoraLogo size="lg" className="pointer-events-none" />
      </div>

      {/* Phase label */}
      {status ? (
        <p className="mt-8 text-[13px] font-medium text-on-surface-variant text-center max-w-[280px]">
          {status}
        </p>
      ) : null}

      {/* Determinate progress — the hold is a known duration, so this is honest */}
      <div
        className="mt-4 h-[3px] w-40 overflow-hidden rounded-full bg-surface-container"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        aria-label="Loading Nexora"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#b90064] to-[#e6007e] transition-[width] duration-150 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      <noscript>
        <p className="mt-6 text-[12px] text-on-surface-variant">
          Nexora needs JavaScript enabled to book appointments.
        </p>
      </noscript>

      <style>{`
        @keyframes nexora-splash-in {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes nexora-splash-out {
          from { opacity: 1; transform: none; }
          to   { opacity: 0; transform: scale(1.01); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-testid="nexora-splash"] * { animation: none !important; transition: none !important; }
        }
      `}</style>
    </main>
  );
};

export default SplashScreen;
