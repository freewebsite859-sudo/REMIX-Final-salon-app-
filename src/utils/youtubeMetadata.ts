import { buildYouTubeWatchUrl, getYouTubeDetails, type YouTubeDetails } from './youtube.js';

export interface YouTubeMetadata extends YouTubeDetails {
  youtubeUrl: string;
  title: string;
  description: string;
  likeCount: number;
  commentCount: number;
}

export const YOUTUBE_METADATA_TIMEOUT_MS = 4000;

const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

export function createYouTubeMetadata(video: YouTubeDetails, fallbackTitle: unknown): YouTubeMetadata {
  return {
    ...video,
    youtubeUrl: buildYouTubeWatchUrl(video.videoId),
    title: text(fallbackTitle) || 'YouTube Video',
    description: '',
    likeCount: 0,
    commentCount: 0,
  };
}

function count(value: unknown, fallback: number): number {
  const number = typeof value === 'string' || typeof value === 'number' ? Number(value) : NaN;
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
}

function thumbnail(value: unknown, fallback: string): string {
  const candidate = text(value);
  try {
    return ['http:', 'https:'].includes(new URL(candidate).protocol) ? candidate : fallback;
  } catch {
    return fallback;
  }
}

/** Whitelist optional fields; remote metadata must never replace the local id/playback URLs. */
export function mergeYouTubeMetadata(fallback: YouTubeMetadata, value: unknown): YouTubeMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  const data = value as Record<string, unknown>;
  return {
    ...fallback,
    title: text(data.title) || fallback.title,
    description: text(data.description) || fallback.description,
    thumbnailUrl: thumbnail(data.thumbnailUrl, fallback.thumbnailUrl),
    likeCount: count(data.likeCount, fallback.likeCount),
    commentCount: count(data.commentCount, fallback.commentCount),
  };
}

/**
 * One deadline covers the entire lookup, including reading JSON. The race also
 * bounds a stalled response body; abort cancels outstanding network work.
 * Keep persistence OUTSIDE this optional-metadata boundary.
 */
export async function withOptionalYouTubeMetadata<T>(
  fallback: T,
  lookup: (signal: AbortSignal) => Promise<T>,
  timeoutMs = YOUTUBE_METADATA_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout>;
  const deadline = new Promise<T>((resolve) => {
    timeout = setTimeout(() => {
      controller.abort();
      resolve(fallback);
    }, timeoutMs);
  });

  try {
    return await Promise.race([lookup(controller.signal), deadline]);
  } catch {
    // Offline, CORS, non-JSON responses and upstream errors are all optional.
    return fallback;
  } finally {
    clearTimeout(timeout);
  }
}

/** Use our same-origin endpoint so API keys and cross-origin lookups stay server-side. */
export async function enrichYouTubeMetadata(
  video: YouTubeDetails,
  fallbackTitle: string,
): Promise<YouTubeMetadata> {
  const fallback = createYouTubeMetadata(video, fallbackTitle);
  return withOptionalYouTubeMetadata(fallback, async (signal) => {
    const response = await fetch('/api/fetch-youtube-meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ youtubeUrl: fallback.youtubeUrl, fallbackTitle: fallback.title }),
      signal,
    });
    if (!response.ok) return fallback;

    const data = await response.json();
    if (data?.success !== true || data?.videoId !== video.videoId) return fallback;
    return mergeYouTubeMetadata(fallback, data);
  });
}

export async function addYouTubeItem<T>(
  url: unknown,
  fallbackTitle: string,
  save: (metadata: YouTubeMetadata) => T | Promise<T>,
): Promise<T> {
  // Reject bad URLs before making any metadata or persistence request.
  const video = getYouTubeDetails(url);
  if (!video) throw new Error('Invalid YouTube URL');

  const metadata = await enrichYouTubeMetadata(video, fallbackTitle);
  // Deliberately not caught: a failed save is a real error, not a metadata fallback.
  return await save(metadata);
}
