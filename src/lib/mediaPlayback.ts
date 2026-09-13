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

// ---------------------------------------------------------------------------
// Source fallback
// ---------------------------------------------------------------------------

/**
 * Alternate stream tried when a reel's own `videoUrl` fails to load.
 *
 * Ordered so the first entry that the browser can actually fetch wins. Set
 * `VITE_NEXORA_FALLBACK_VIDEO_URL` to point at a mirror you control.
 *
 * NOTE ON VERIFICATION: the automated environment this was written in has no
 * outbound network access, so none of these URLs were fetched successfully
 * during development. Treat this list as a starting point to confirm against a
 * real browser, not as a verified set. The animated poster fallback below is
 * what actually guarantees the card is never blank.
 */
export const FALLBACK_VIDEO_SOURCES: readonly string[] = [
  'https://assets.mixkit.co/videos/preview/mixkit-hairdresser-cutting-hair-with-scissors-and-a-comb-41131-large.mp4',
  'https://assets.mixkit.co/videos/preview/mixkit-barber-styling-a-mans-hair-with-a-brush-41139-large.mp4',
];

/**
 * Pick the next source to try for a reel whose current one failed.
 *
 * Returns the reel's own URL first, then each configured fallback that has not
 * already been attempted, then `null` when every option is exhausted — at which
 * point the caller shows the animated poster instead of a dead player.
 */
export function nextPlayableSource(
  primaryUrl: string,
  attempted: readonly string[],
  fallbacks: readonly string[] = FALLBACK_VIDEO_SOURCES
): string | null {
  const tried = new Set(attempted);
  if (primaryUrl && !tried.has(primaryUrl)) return primaryUrl;
  for (const candidate of fallbacks) {
    if (candidate && !tried.has(candidate)) return candidate;
  }
  return null;
}

// ---------------------------------------------------------------------------
// First-gesture autoplay unlock
// ---------------------------------------------------------------------------

let gestureUnlockInstalled = false;
let userHasInteracted = false;
const pendingAutoplay = new Set<PlaybackTarget>();

function runFirstGestureUnlock(): void {
  userHasInteracted = true;
  // Copy: safePlay callbacks can unregister during iteration.
  for (const video of Array.from(pendingAutoplay)) {
    safePlay(video);
  }
  pendingAutoplay.clear();
}

/**
 * Install the one-time page-level interaction listener that releases blocked
 * autoplay.
 *
 * Browsers allow muted autoplay but routinely block it anyway (data-saver
 * modes, low-power mode, WebViews, aggressive privacy settings). A real user
 * gesture is always sufficient, so the first pointer/key interaction retries
 * every video that asked to play and was refused.
 *
 * Singleton by design: many reel cards mount at once and each would otherwise
 * attach its own listener.
 */
export function installGestureAutoplayUnlock(): void {
  if (gestureUnlockInstalled || typeof window === 'undefined') return;
  gestureUnlockInstalled = true;

  const options: AddEventListenerOptions = { once: false, capture: true, passive: true };
  const onGesture = () => {
    runFirstGestureUnlock();
    window.removeEventListener('pointerdown', onGesture, options);
    window.removeEventListener('touchstart', onGesture, options);
    window.removeEventListener('keydown', onGesture, options);
  };

  window.addEventListener('pointerdown', onGesture, options);
  window.addEventListener('touchstart', onGesture, options);
  window.addEventListener('keydown', onGesture, options);
}

/** True once the user has clicked/tapped/typed anywhere on the page. */
export function hasUserInteracted(): boolean {
  return userHasInteracted;
}

/**
 * Ask for playback to be retried on the next user gesture.
 *
 * Returns an unregister function for effect cleanup.
 */
export function requestAutoplayOnGesture(video: PlaybackTarget | null | undefined): () => void {
  if (!video) return () => undefined;
  installGestureAutoplayUnlock();
  if (userHasInteracted) {
    // Already unlocked — no need to wait for a gesture that may never come.
    safePlay(video);
    return () => undefined;
  }
  pendingAutoplay.add(video);
  return () => {
    pendingAutoplay.delete(video);
  };
}

/** Test/reset hook so suites can exercise the gesture path repeatedly. */
export function resetGestureAutoplayUnlockForTests(): void {
  gestureUnlockInstalled = false;
  userHasInteracted = false;
  pendingAutoplay.clear();
}
