/**
 * Shared YouTube URL helpers for the Nexora website builder.
 *
 * These helpers are isomorphic (no DOM / window / process.env access) so they
 * can be imported safely from browser components AND from the Node API routes
 * (server.ts / api/index.ts).
 *
 * The goal is one robust source of truth for turning any supported YouTube
 * link into a clean 11-character video id, plus builders for the canonical
 * watch / shorts / embed / thumbnail URLs used across the editor, preview,
 * and public site.
 */

/** Regex for a bare, valid 11-character YouTube video id. */
export const YOUTUBE_VIDEO_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'gaming.youtube.com',
]);
const YOUTUBE_SHORT_HOSTS = new Set(['youtu.be', 'www.youtu.be', 'm.youtu.be']);
const YOUTUBE_EMBED_HOSTS = new Set(['youtube-nocookie.com', 'www.youtube-nocookie.com']);

/**
 * Parse the URL rather than matching a YouTube-looking substring. This keeps
 * lookalike domains and links containing YouTube URLs in their query/path out.
 * Share parameters, fragments and the order of watch query parameters do not
 * affect the extracted id. Scheme-less links are treated as HTTPS.
 */
export function extractYouTubeId(input: unknown): string | null {
  if (typeof input !== 'string' || !input.trim()) return null;

  try {
    const trimmed = input.trim();
    const url = new URL(
      /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    );
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;

    const host = url.hostname.toLowerCase();
    const parts = url.pathname.split('/').filter(Boolean);
    let videoId: string | null | undefined = null;

    if (YOUTUBE_SHORT_HOSTS.has(host)) {
      videoId = parts[0];
    } else if (YOUTUBE_EMBED_HOSTS.has(host)) {
      if (parts[0] === 'embed') videoId = parts[1];
    } else if (YOUTUBE_HOSTS.has(host)) {
      if (parts[0] === 'watch') {
        videoId = url.searchParams.get('v');
      } else if (['shorts', 'embed', 'v', 'live', 'e'].includes(parts[0])) {
        videoId = parts[1];
      } else if (parts[0] === 'u' && parts.length === 3) {
        videoId = parts[2];
      }
    }

    return isYouTubeVideoId(videoId) ? videoId : null;
  } catch {
    return null;
  }
}

export interface YouTubeDetails {
  videoId: string;
  embedUrl: string;
  thumbnailUrl: string;
}

/** Everything needed to add/play a video, without any network dependency. */
export function getYouTubeDetails(input: unknown): YouTubeDetails | null {
  const videoId = extractYouTubeId(input);
  if (!videoId) return null;
  return {
    videoId,
    embedUrl: buildYouTubeEmbedUrl(videoId),
    thumbnailUrl: buildYouTubeThumbnailUrl(videoId),
  };
}

/** True when the value is a YouTube link that yields an 11-char video id. */
export function isValidYouTubeUrl(input: unknown): boolean {
  return extractYouTubeId(input) !== null;
}

/** True when the value is already a bare 11-char video id. */
export function isYouTubeVideoId(value: unknown): value is string {
  return typeof value === 'string' && YOUTUBE_VIDEO_ID_REGEX.test(value);
}

/**
 * Resolves the video id to use for playback. Prefers a clean stored video id
 * and falls back to extracting one from the original URL — useful for older
 * rows that were saved before URL normalization existed.
 */
export function resolveYouTubeVideoId(videoId: unknown, youtubeUrl?: unknown): string | null {
  if (isYouTubeVideoId(videoId)) return videoId;
  return extractYouTubeId(youtubeUrl);
}

/** Canonical clean watch URL: https://www.youtube.com/watch?v=VIDEO_ID */
export function buildYouTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/** Canonical clean Shorts URL: https://www.youtube.com/shorts/VIDEO_ID */
export function buildYouTubeShortsUrl(videoId: string): string {
  return `https://www.youtube.com/shorts/${videoId}`;
}

export interface YouTubeEmbedOptions {
  /** autoplay=1 — plays immediately when the player loads. */
  autoplay?: boolean;
  /** mute=1 — required by browsers for autoplay to be allowed. */
  mute?: boolean;
  /** loop=1 (+ playlist so YouTube actually honors it). */
  loop?: boolean;
  /** controls=1/0 — show or hide the player controls. */
  controls?: boolean;
  /** rel=0/1 — related video behavior. */
  rel?: 0 | 1;
  /** start seconds — begin playback at a timestamp. */
  start?: number;
  /** playsinline=1 — inline playback on mobile instead of fullscreen. */
  playsinline?: boolean;
}

/**
 * Builds the iframe-friendly embed URL used for live preview and the public
 * site: https://www.youtube.com/embed/VIDEO_ID?...
 *
 * Returns an empty string when no usable video id is given so callers can skip
 * rendering a broken player.
 */
export function buildYouTubeEmbedUrl(videoId: string, options: YouTubeEmbedOptions = {}): string {
  const id = (videoId || '').trim();
  if (!id || !YOUTUBE_VIDEO_ID_REGEX.test(id)) return '';

  const query = new URLSearchParams();
  if (typeof options.autoplay === 'boolean') query.set('autoplay', options.autoplay ? '1' : '0');
  if (options.mute) query.set('mute', '1');
  if (options.controls !== undefined) query.set('controls', options.controls ? '1' : '0');
  if (options.rel !== undefined) query.set('rel', String(options.rel));
  if (options.start !== undefined) query.set('start', String(Math.max(0, Math.floor(options.start))));
  if (options.playsinline) query.set('playsinline', '1');
  if (options.loop) {
    query.set('loop', '1');
    // YouTube only honours loop=1 when a playlist is supplied.
    query.set('playlist', id);
  }

  const qs = query.toString();
  return qs ? `https://www.youtube.com/embed/${id}?${qs}` : `https://www.youtube.com/embed/${id}`;
}

export type YouTubeThumbnailQuality =
  | 'default'
  | 'mqdefault'
  | 'hqdefault'
  | 'sddefault'
  | 'maxresdefault';

/** img.youtube.com thumbnail URL for a clean video id. */
export function buildYouTubeThumbnailUrl(
  videoId: string,
  quality: YouTubeThumbnailQuality = 'hqdefault'
): string {
  return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
}

/** Standard iframe `allow` attribute value for YouTube embeds. */
export const YOUTUBE_IFRAME_ALLOW =
  'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
