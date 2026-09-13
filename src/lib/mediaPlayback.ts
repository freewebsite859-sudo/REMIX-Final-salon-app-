/**
 * Defensive HTML5 media helpers.
 *
 * `HTMLMediaElement.play()` / `.pause()` are the single most common way the
 * salon reel feed took the whole app down: both can throw *synchronously*
 * rather than returning a rejected promise. That happens when
 *
 *   - the browser refuses the call outside a user gesture or while the
 *     element is detached,
 *   - autoplay policy aborts an in-flight `play()` (`AbortError`),
 *   - the runtime has no media implementation at all (jsdom in tests,
 *     in-app WebViews with video disabled, low-memory mobile browsers).
 *
 * A throw from inside a `useEffect` body propagates to React and unmounts the
 * tree, so an unrelated carousel failure rendered a blank screen. Every call
 * site now goes through these guards: the reel simply stays on its poster
 * frame instead of taking the app with it.
 */

/** Minimal surface these helpers rely on — keeps them testable without DOM types. */
export interface PlaybackTarget {
  play?: () => Promise<unknown> | undefined;
  pause?: () => void;
  canPlayType?: (type: string) => string;
  muted?: boolean;
  currentTime?: number;
}

/** Codecs the salon reels are encoded in. */
const PLAYABLE_TYPES: readonly string[] = ['video/mp4', 'video/webm', 'video/ogg'];

/**
 * True when this element can actually decode at least one format we serve.
 *
 * `canPlayType` returns `''` when the platform has no decoder for a type —
 * that is a real-world signal, not a test artefact: an Android WebView built
 * without H.264, a data-saver browser, or a jsdom/no-media runtime all answer
 * `''`. Attempting `play()` there is a guaranteed failure, so we skip it and
 * leave the poster frame visible instead of firing an error into the console.
 *
 * When `canPlayType` is absent we assume support rather than blocking real
 * playback on an incomplete implementation.
 */
export function canPlayAny(
  video: PlaybackTarget | null | undefined,
  types: readonly string[] = PLAYABLE_TYPES
): boolean {
  if (!video) return false;
  if (typeof video.canPlayType !== 'function') return true;
  return types.some((type) => {
    try {
      return Boolean(video.canPlayType?.(type));
    } catch {
      return false;
    }
  });
}

/** True when the platform cannot play media at all (jsdom, disabled WebView). */
export function isPlaybackSupported(video: PlaybackTarget | null | undefined): boolean {
  return Boolean(
    video &&
      typeof video.play === 'function' &&
      typeof video.pause === 'function' &&
      canPlayAny(video)
  );
}

/**
 * Pause without throwing. Returns `true` when a pause was actually issued.
 *
 * Gated on capability: pausing an element that can never play is a no-op in a
 * browser, so skipping it changes nothing there — it only avoids asking a
 * media-less runtime to do something it reports as unsupported.
 */
export function safePause(video: PlaybackTarget | null | undefined): boolean {
  if (!video || typeof video.pause !== 'function') return false;
  if (!canPlayAny(video)) return false;
  try {
    video.pause();
    return true;
  } catch {
    return false;
  }
}

/**
 * Start playback without throwing. The muted-autoplay retry is preserved: if
 * the browser blocks playback with sound, we drop to muted and try once more,
 * then give up quietly and leave the poster frame on screen.
 *
 * `onResult` reports the final outcome so callers can drive their own
 * playing/paused UI state without guessing.
 */
export function safePlay(
  video: PlaybackTarget | null | undefined,
  onResult?: (played: boolean) => void
): void {
  if (!video || typeof video.play !== 'function' || !canPlayAny(video)) {
    onResult?.(false);
    return;
  }

  let promise: Promise<unknown> | undefined;
  try {
    promise = video.play();
  } catch {
    // Synchronous throw (unsupported runtime / detached element).
    onResult?.(false);
    return;
  }

  // Some engines return `undefined` instead of a promise.
  if (!promise || typeof promise.then !== 'function') {
    onResult?.(true);
    return;
  }

  promise.then(
    () => onResult?.(true),
    () => {
      // Retry once, muted — the standard autoplay-policy recovery.
      let retry: Promise<unknown> | undefined;
      try {
        if (typeof video.muted === 'boolean') video.muted = true;
        retry = video.play?.();
      } catch {
        onResult?.(false);
        return;
      }
      if (!retry || typeof retry.then !== 'function') {
        onResult?.(true);
        return;
      }
      retry.then(
        () => onResult?.(true),
        () => onResult?.(false)
      );
    }
  );
}

/**
 * Seek to a timestamp without throwing. Returns `true` when the seek was
 * applied.
 */
export function safeSeek(
  video: PlaybackTarget | null | undefined,
  seconds: number
): boolean {
  if (!video) return false;
  try {
    video.currentTime = seconds;
    return true;
  } catch {
    return false;
  }
}

/** Set `muted` without throwing (a detached element can still reject this). */
export function safeSetMuted(
  video: PlaybackTarget | null | undefined,
  muted: boolean
): boolean {
  if (!video) return false;
  try {
    video.muted = muted;
    return true;
  } catch {
    return false;
  }
}
