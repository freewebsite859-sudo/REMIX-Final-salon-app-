/**
 * Media playback hardening.
 *
 * Covers the four guarantees every reel surface depends on:
 *
 *   1. a failed stream steps down a source ladder instead of dying
 *   2. once every source has failed the card shows the animated poster,
 *      never a black rectangle
 *   3. a blocked autoplay is retried on the user's first real gesture
 *   4. playback never throws into React
 *
 * jsdom reports `canPlayType() === ''`, so a bare video element is treated as
 * undecodable and `safePlay` short-circuits. Where a test needs real playback
 * it stubs `canPlayType` explicitly rather than relying on jsdom.
 */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';

import {
  FALLBACK_VIDEO_SOURCES,
  hasUserInteracted,
  installGestureAutoplayUnlock,
  nextPlayableSource,
  requestAutoplayOnGesture,
  resetGestureAutoplayUnlockForTests,
  safePause,
  safePlay,
} from '../src/lib/mediaPlayback.ts';
import {
  ReelPosterFallback,
  ReelPlayToggle,
  useReelVideo,
} from '../src/hooks/useReelVideo.tsx';

let passed = 0;
let failed = 0;

function check(label: string, cond: boolean, detail = '') {
  if (cond) {
    console.log(`PASS  ${label}${detail ? ` — ${detail}` : ''}`);
    passed++;
  } else {
    console.log(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

const wait = (ms = 30) => new Promise<void>((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// 1. nextPlayableSource — the fallback ladder (pure)
// ---------------------------------------------------------------------------

const PRIMARY = 'https://cdn.example.com/reel-primary.mp4';
const FB = ['https://cdn.example.com/fallback-a.mp4', 'https://cdn.example.com/fallback-b.mp4'];

check(
  'ladder: serves the reel’s own URL first',
  nextPlayableSource(PRIMARY, [], FB) === PRIMARY
);

check(
  'ladder: steps to the first fallback after the primary fails',
  nextPlayableSource(PRIMARY, [PRIMARY], FB) === FB[0]
);

check(
  'ladder: steps to the second fallback after the first fails',
  nextPlayableSource(PRIMARY, [PRIMARY, FB[0]], FB) === FB[1]
);

check(
  'ladder: returns null once every source has failed',
  nextPlayableSource(PRIMARY, [PRIMARY, FB[0], FB[1]], FB) === null,
  'caller shows the animated poster at this point'
);

check(
  'ladder: never revisits an already-attempted source',
  nextPlayableSource(PRIMARY, [PRIMARY, FB[0]], [FB[0], FB[1]]) === FB[1]
);

check(
  'ladder: skips empty-string sources',
  nextPlayableSource(PRIMARY, [PRIMARY], ['', FB[0]]) === FB[0]
);

check(
  'ladder: falls back when the primary URL is empty',
  nextPlayableSource('', [], FB) === FB[0]
);

check(
  'ladder: default source list is non-empty',
  FALLBACK_VIDEO_SOURCES.length > 0,
  `${FALLBACK_VIDEO_SOURCES.length} configured`
);

// ---------------------------------------------------------------------------
// 2. safePlay / safePause never throw
// ---------------------------------------------------------------------------

const throwingVideo = {
  play() {
    throw new Error('NotAllowedError: play() failed');
  },
  pause() {
    throw new Error('InvalidStateError');
  },
  canPlayType: () => 'probably',
  muted: false,
};

let syncThrowSurvived = true;
let syncPlayResult: boolean | null = null;
try {
  safePlay(throwingVideo, (r) => {
    syncPlayResult = r;
  });
  safePause(throwingVideo);
} catch {
  syncThrowSurvived = false;
}
check('safePlay survives a synchronous play() throw', syncThrowSurvived);
check(
  'safePlay reports failure rather than throwing',
  syncPlayResult === false,
  `onResult=${String(syncPlayResult)}`
);

const rejectingVideo = {
  play: () => Promise.reject(new DOMException('blocked', 'NotAllowedError')),
  pause: () => undefined,
  canPlayType: () => 'probably',
  muted: false,
};

await new Promise<void>((resolve) => {
  safePlay(rejectingVideo, () => resolve());
  // The muted retry also rejects; the callback must still fire.
  setTimeout(resolve, 200);
});
check('safePlay survives a rejected play() promise', true);

let undecodablePlayed = false;
safePlay(
  {
    play: () => {
      undecodablePlayed = true;
      return undefined;
    },
    canPlayType: () => '',
    muted: false,
  },
  () => undefined
);
check(
  'safePlay does not call play() on an undecodable element',
  undecodablePlayed === false,
  'jsdom / no-codec WebView path'
);

// ---------------------------------------------------------------------------
// 3. First-gesture autoplay unlock
// ---------------------------------------------------------------------------

resetGestureAutoplayUnlockForTests();
check('gesture: no interaction recorded at start', hasUserInteracted() === false);

let gesturePlayCount = 0;
const blockedVideo = {
  play: () => {
    gesturePlayCount++;
    return Promise.resolve();
  },
  pause: () => undefined,
  canPlayType: () => 'probably',
  muted: false,
};

requestAutoplayOnGesture(blockedVideo);
check(
  'gesture: blocked video is queued, not played immediately',
  gesturePlayCount === 0 && hasUserInteracted() === false
);

await act(async () => {
  window.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  await wait(20);
});

check(
  'gesture: first pointerdown releases the queued video',
  gesturePlayCount === 1,
  `play() called ${gesturePlayCount}×`
);
check('gesture: interaction is now recorded', hasUserInteracted() === true);

await act(async () => {
  window.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  await wait(20);
});
check(
  'gesture: listener fires once, not on every click',
  gesturePlayCount === 1,
  `still ${gesturePlayCount}×`
);

// A video that asks *after* the unlock must play immediately.
let latePlayCount = 0;
requestAutoplayOnGesture({
  play: () => {
    latePlayCount++;
    return Promise.resolve();
  },
  pause: () => undefined,
  canPlayType: () => 'probably',
  muted: false,
});
await wait(20);
check(
  'gesture: post-unlock requests play immediately',
  latePlayCount === 1,
  `play() called ${latePlayCount}×`
);

// The unregister function must drop the request (effect cleanup).
resetGestureAutoplayUnlockForTests();
let cancelledCount = 0;
const unregister = requestAutoplayOnGesture({
  play: () => {
    cancelledCount++;
    return Promise.resolve();
  },
  pause: () => undefined,
  canPlayType: () => 'probably',
  muted: false,
});
unregister();
await act(async () => {
  window.dispatchEvent(new Event('keydown', { bubbles: true }));
  await wait(20);
});
check(
  'gesture: unregistering cancels the pending request',
  cancelledCount === 0,
  `play() called ${cancelledCount}×`
);

resetGestureAutoplayUnlockForTests();
installGestureAutoplayUnlock();
installGestureAutoplayUnlock(); // must not double-register
let doubleCount = 0;
requestAutoplayOnGesture({
  play: () => {
    doubleCount++;
    return Promise.resolve();
  },
  pause: () => undefined,
  canPlayType: () => 'probably',
  muted: false,
});
await act(async () => {
  window.dispatchEvent(new Event('touchstart', { bubbles: true }));
  await wait(20);
});
check(
  'gesture: install is idempotent (single listener)',
  doubleCount === 1,
  `play() called ${doubleCount}×`
);

// ---------------------------------------------------------------------------
// 4. useReelVideo — hook-driven ladder + poster fallback
// ---------------------------------------------------------------------------

const REEL_URL = 'https://cdn.example.com/hook-reel.mp4';
const POSTER = 'https://cdn.example.com/hook-poster.jpg';

function Harness({ wantPlaying = false }: { wantPlaying?: boolean }) {
  const state = useReelVideo({
    videoUrl: REEL_URL,
    posterUrl: POSTER,
    wantPlaying,
    muted: true,
    fallbackSources: FB,
  });
  return (
    <div>
      {state.exhausted ? (
        <ReelPosterFallback posterUrl={POSTER} title="Harness reel" onRetry={state.resetLadder} />
      ) : state.activeSrc ? (
        <video
          ref={state.videoRef}
          key={state.activeSrc}
          src={state.activeSrc}
          poster={POSTER}
          playsInline
          muted
          autoPlay
          loop
          onError={state.onVideoError}
          onPlaying={state.onVideoPlaying}
          onPause={state.onVideoPause}
          onLoadedData={state.onLoadedData}
        />
      ) : null}
      <ReelPlayToggle isPlaying={state.isPlaying} onToggle={state.togglePlay} />
    </div>
  );
}

const container = document.createElement('div');
document.body.appendChild(container);
let root: Root | null = createRoot(container);

await act(async () => {
  root!.render(<Harness />);
  await wait(30);
});

let video = container.querySelector('video');
check('hook: mounts a video element', video !== null);
check(
  'hook: initial source is the reel’s own URL',
  video?.getAttribute('src') === REEL_URL,
  `src=${video?.getAttribute('src')}`
);
/*
  `muted` is checked as a DOM *property*, not an attribute. React deliberately
  sets it via `node.muted = true` and never emits the attribute, so
  `hasAttribute('muted')` is always false on a correctly-muted React video —
  asserting on the attribute would fail against working code.
*/
check(
  'hook: video is muted',
  (video as HTMLVideoElement | null)?.muted === true,
  'React sets .muted as a property, not an attribute'
);
check('hook: video is playsInline', video?.hasAttribute('playsinline') === true);
check('hook: video is autoPlay', video?.hasAttribute('autoplay') === true);
check('hook: video loops', video?.hasAttribute('loop') === true);
check(
  'hook: poster attribute is set',
  video?.getAttribute('poster') === POSTER
);

// Fail the primary -> should step to fallback A, not give up.
await act(async () => {
  video!.dispatchEvent(new Event('error'));
  await wait(30);
});
video = container.querySelector('video');
check(
  'hook: a failed stream steps down to fallback A',
  video?.getAttribute('src') === FB[0],
  `src=${video?.getAttribute('src')}`
);
check(
  'hook: still on a video element after the first failure',
  video !== null && container.querySelector('[data-testid="reel-poster-fallback"]') === null
);

// Fail fallback A -> fallback B.
await act(async () => {
  video!.dispatchEvent(new Event('error'));
  await wait(30);
});
video = container.querySelector('video');
check(
  'hook: a second failure steps down to fallback B',
  video?.getAttribute('src') === FB[1],
  `src=${video?.getAttribute('src')}`
);

// Fail fallback B -> every source exhausted, poster fallback shown.
await act(async () => {
  video!.dispatchEvent(new Event('error'));
  await wait(30);
});
video = container.querySelector('video');
const poster = container.querySelector('[data-testid="reel-poster-fallback"]');
check('hook: exhausted ladder removes the video element', video === null);
check(
  'hook: exhausted ladder renders the animated poster fallback',
  poster !== null,
  'data-testid="reel-poster-fallback"'
);
check(
  'hook: poster fallback keeps the reel thumbnail visible',
  poster?.querySelector('img')?.getAttribute('src') === POSTER
);
check(
  'hook: poster fallback tells the user what happened',
  /unavailable/i.test(poster?.textContent ?? ''),
  `"${(poster?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 48)}…"`
);

// The manual toggle is always rendered, even while playback is impossible.
const toggle = container.querySelector('[data-testid="reel-play-toggle"]');
check(
  'hook: play/pause toggle is always rendered',
  toggle !== null,
  'required so a blocked autoplay is not a dead end'
);
check(
  'hook: toggle is a real button with an accessible label',
  toggle?.tagName === 'BUTTON' && (toggle?.getAttribute('aria-label') ?? '').length > 0,
  `aria-label="${toggle?.getAttribute('aria-label')}"`
);

// ---------------------------------------------------------------------------
// 5. Manual toggle drives playback on a decodable element
// ---------------------------------------------------------------------------

await act(async () => {
  root!.render(<Harness wantPlaying={false} />);
  root!.unmount();
  await wait(20);
});
root = createRoot(container);

// Make the element decodable so safePlay actually reaches play().
const proto = window.HTMLMediaElement?.prototype;
const originalCanPlayType = proto?.canPlayType;
if (proto) {
  (proto as any).canPlayType = () => 'probably';
}
(proto as any).play = function () {
  (this as any).__played = true;
  return Promise.resolve();
};
(proto as any).pause = function () {
  (this as any).__played = false;
};

await act(async () => {
  root!.render(<Harness />);
  await wait(30);
});

const toggleBtn = container.querySelector(
  '[data-testid="reel-play-toggle"]'
) as HTMLButtonElement | null;
check('toggle: rendered for a decodable element', toggleBtn !== null);

await act(async () => {
  toggleBtn!.dispatchEvent(
    new window.MouseEvent('click', { bubbles: true, cancelable: true })
  );
  await wait(40);
});

const liveVideo = container.querySelector('video') as any;
check(
  'toggle: clicking play starts playback',
  liveVideo?.__played === true,
  'element .play() was invoked'
);

if (originalCanPlayType && proto) {
  (proto as any).canPlayType = originalCanPlayType;
}

await act(async () => {
  root!.unmount();
  await wait(10);
});
container.remove();

// ---------------------------------------------------------------------------
// 6. Every reel surface opts into the shared controller
// ---------------------------------------------------------------------------

const surfaces = [
  '../src/components/VideoReelsSection.tsx',
  '../src/components/SalonVideoReelsModal.tsx',
  '../src/components/SalonStoriesReelFeed.tsx',
];

const { readFileSync } = await import('node:fs');
const { fileURLToPath } = await import('node:url');

for (const rel of surfaces) {
  const abs = fileURLToPath(new URL(rel, import.meta.url));
  const src = readFileSync(abs, 'utf8');
  const name = rel.split('/').pop()!;

  check(`${name}: uses the shared useReelVideo controller`, src.includes('useReelVideo('));
  check(`${name}: wires onError to the source ladder`, src.includes('onError={onVideoError}'));
  check(`${name}: video is muted`, /\bmuted[=\s/>]/.test(src));
  check(`${name}: video is playsInline`, src.includes('playsInline'));
  check(`${name}: video is autoPlay`, src.includes('autoPlay'));
  check(`${name}: video loops`, /\bloop[=\s/>]/.test(src));
  check(
    `${name}: no direct unguarded .play() call`,
    !/\.play\(\s*\)/.test(src.replace(/safePlay\([^)]*\)/g, ''))
  );
}

// The global unlock must be installed once, at the app root.
const mainSrc = readFileSync(
  fileURLToPath(new URL('../src/main.tsx', import.meta.url)),
  'utf8'
);
check(
  'main.tsx installs the global gesture unlock',
  mainSrc.includes('installGestureAutoplayUnlock()')
);

console.log(`\n${passed}/${passed + failed} passed`);
if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
process.exit(0);
