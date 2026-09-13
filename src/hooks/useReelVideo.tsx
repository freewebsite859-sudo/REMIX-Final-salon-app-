/**
 * Shared reel-video playback controller.
 *
 * Every salon reel surface (VideoReelsSection, SalonVideoReelsModal,
 * SalonStoriesReelFeed, and the SalonDetailModal reel grid) needs the same
 * four guarantees, and having each implement them separately is how they
 * drifted apart in the first place:
 *
 *   1. playback never throws into React (see lib/mediaPlayback)
 *   2. a failed stream steps down to a fallback source, then to an animated
 *      poster — the card is never a dead black box
 *   3. a blocked autoplay is retried on the user's first real gesture
 *   4. the user can always force playback manually
 *
 * Components own their own `wantPlaying` intent (hover, IntersectionObserver,
 * active modal index); this hook turns that intent into safe DOM calls.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  FALLBACK_VIDEO_SOURCES,
  nextPlayableSource,
  requestAutoplayOnGesture,
  safePause,
  safePlay,
  safeSetMuted,
} from '../lib/mediaPlayback';

export interface UseReelVideoOptions {
  /** The reel's own stream. */
  videoUrl: string;
  /** Shown behind the video and as the animated fallback when every source fails. */
  posterUrl: string;
  /** Caller's intent — hover, viewport visibility, active index. */
  wantPlaying: boolean;
  muted: boolean;
  /** Extra sources to try before giving up. Defaults to the shared list. */
  fallbackSources?: readonly string[];
}

export interface ReelVideoState {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Source currently loaded — the reel's own, or a fallback. */
  activeSrc: string | null;
  /** True once every candidate source has failed; show the animated poster. */
  exhausted: boolean;
  /** True while the element is actually playing (not merely requested). */
  isPlaying: boolean;
  /** True once the first frame has decoded, so callers can crossfade. */
  hasDecoded: boolean;
  /** Flip playback regardless of `wantPlaying` — the manual override. */
  togglePlay: () => void;
  /** User forced this card on; it overrides hover/visibility intent. */
  userOverride: boolean;
  clearUserOverride: () => void;
  /** Restart the source ladder from the first source. */
  resetLadder: () => void;
  onVideoError: () => void;
  onVideoPlaying: () => void;
  onVideoPause: () => void;
  onLoadedData: () => void;
}

export function useReelVideo(options: UseReelVideoOptions): ReelVideoState {
  const { videoUrl, posterUrl, wantPlaying, muted } = options;
  const fallbackSources = options.fallbackSources ?? FALLBACK_VIDEO_SOURCES;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [attempted, setAttempted] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasDecoded, setHasDecoded] = useState(false);
  const [userOverride, setUserOverride] = useState(false);

  // Reset the attempt ladder whenever the reel changes, otherwise a reel that
  // already burned its fallbacks would open exhausted.
  useEffect(() => {
    setAttempted([]);
    setHasDecoded(false);
    setIsPlaying(false);
    setUserOverride(false);
  }, [videoUrl]);

  const activeSrc = useMemo(
    () => nextPlayableSource(videoUrl, attempted, fallbackSources),
    [videoUrl, attempted, fallbackSources]
  );

  const exhausted = activeSrc === null;

  // Mirror the caller's intent onto the element. Deliberately does NOT depend
  // on `muted` toggling playback; mute is applied separately below.
  const effectivePlay = wantPlaying || userOverride;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    safeSetMuted(video, muted);

    let subscribed = true;
    if (effectivePlay && activeSrc) {
      // safePlay never throws; the callback reports the real outcome so the UI
      // reflects what the browser allowed rather than what we asked for.
      safePlay(video, (played) => {
        if (!subscribed) return;
        setIsPlaying(played);
        if (!played) {
          // Blocked by autoplay policy — queue a retry on the first gesture.
          requestAutoplayOnGesture(video);
        }
      });
    } else {
      safePause(video);
      setIsPlaying(false);
    }

    return () => {
      subscribed = false;
    };
  }, [effectivePlay, activeSrc, muted]);

  // Step down the source ladder on failure instead of showing a dead player.
  const onVideoError = useCallback(() => {
    setIsPlaying(false);
    setAttempted((prev) => {
      const failed = videoRef.current?.currentSrc || activeSrc;
      if (!failed || prev.includes(failed)) return prev;
      return [...prev, failed];
    });
  }, [activeSrc]);

  const onVideoPlaying = useCallback(() => {
    setIsPlaying(true);
    setHasDecoded(true);
  }, []);

  const onVideoPause = useCallback(() => setIsPlaying(false), []);
  const onLoadedData = useCallback(() => setHasDecoded(true), []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || !activeSrc) return;
    if (isPlaying) {
      safePause(video);
      setIsPlaying(false);
      // A manual pause must win over hover/visibility intent until undone.
      setUserOverride(false);
      return;
    }
    // Explicit user gesture: this is exactly what autoplay policy wants.
    safePlay(video, (played) => {
      setIsPlaying(played);
      if (played) setHasDecoded(true);
    });
    setUserOverride(true);
  }, [activeSrc, isPlaying]);

  const clearUserOverride = useCallback(() => setUserOverride(false), []);

  /**
   * Restart the source ladder from the first source.
   *
   * The `videoUrl` effect already does this when the reel changes; callers that
   * retry the *same* reel (reopening a modal, hitting "try again") need it
   * directly because no prop changed and so no effect re-runs.
   */
  const resetLadder = useCallback(() => {
    setAttempted([]);
    setUserOverride(false);
    setIsPlaying(false);
    setHasDecoded(false);
  }, []);

  return {
    videoRef,
    activeSrc,
    exhausted,
    isPlaying,
    hasDecoded,
    togglePlay,
    userOverride,
    clearUserOverride,
    resetLadder,
    onVideoError,
    onVideoPlaying,
    onVideoPause,
    onLoadedData,
  };
}

/**
 * Animated poster shown when every source failed.
 *
 * Kept here so all four surfaces degrade identically: a slow Ken Burns drift on
 * the reel's own thumbnail plus an explicit "unavailable" affordance, rather
 * than a black rectangle that looks like a broken app.
 */
export function ReelPosterFallback({
  posterUrl,
  title,
  onRetry,
}: {
  posterUrl: string;
  title: string;
  onRetry?: () => void;
}) {
  return (
    <div
      data-testid="reel-poster-fallback"
      className="absolute inset-0 w-full h-full overflow-hidden bg-slate-950"
    >
      {posterUrl ? (
        <img
          src={posterUrl}
          alt={title}
          className="w-full h-full object-cover opacity-70 motion-safe:animate-[nexora-reel-drift_12s_ease-in-out_infinite_alternate]"
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/60 flex flex-col items-center justify-center gap-2 p-4 text-center">
        <span className="material-symbols-outlined text-white/80 text-[28px]">
          videofile
        </span>
        <p className="text-white text-[12px] font-bold leading-snug">
          Video preview unavailable
        </p>
        <p className="text-white/70 text-[11px] leading-snug max-w-[180px]">
          Your connection or browser blocked the stream. The salon details below
          are still accurate.
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-1 px-3 py-1.5 rounded-lg bg-white/15 border border-white/30 text-white text-[11px] font-bold hover:bg-white/25 transition-colors"
          >
            Try again
          </button>
        )}
      </div>
      <style>{`
        @keyframes nexora-reel-drift {
          from { transform: scale(1) translate3d(0, 0, 0); }
          to   { transform: scale(1.08) translate3d(-1.5%, -1.5%, 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-testid="reel-poster-fallback"] img { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

/**
 * Manual play/pause affordance.
 *
 * Autoplay is blocked often enough (data saver, low-power mode, WebViews) that
 * a card with no manual control is a dead end. Always rendered so the user can
 * force playback regardless of what the browser decided.
 */
export function ReelPlayToggle({
  isPlaying,
  onToggle,
  label,
  className = '',
}: {
  isPlaying: boolean;
  onToggle: () => void;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      data-testid="reel-play-toggle"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-label={isPlaying ? 'Pause video' : 'Play video'}
      aria-pressed={isPlaying}
      title={isPlaying ? 'Pause' : 'Play'}
      className={`w-9 h-9 rounded-full bg-black/45 backdrop-blur-md border border-white/30 text-white flex items-center justify-center hover:bg-black/65 active:scale-90 transition-all shadow-md ${className}`}
    >
      <span className="material-symbols-outlined text-[18px]">
        {isPlaying ? 'pause' : 'play_arrow'}
      </span>
      {label ? <span className="sr-only">{label}</span> : null}
    </button>
  );
}
