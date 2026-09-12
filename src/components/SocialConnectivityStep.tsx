import React, { useState, useEffect, useRef } from 'react';
import { SalonProfile, SocialVideo, VideoCategoryTag } from '../types';
import { getDefaultVideosForTemplate } from '../templateSocialVideos';
import {
  buildYouTubeEmbedUrl,
  buildYouTubeShortsUrl,
  buildYouTubeThumbnailUrl,
  buildYouTubeWatchUrl,
  extractYouTubeId as extractYouTubeIdFromShared,
  isYouTubeVideoId,
  YOUTUBE_IFRAME_ALLOW,
} from '../utils/youtube';

export const DEFAULT_SHOWCASE_VIDEOS: SocialVideo[] = [
  {
    id: 'video-sc-1',
    youtubeUrl: 'https://www.youtube.com/shorts/kJQP7kiw5Fk',
    videoId: 'kJQP7kiw5Fk',
    title: 'Chrome aura set',
    channelTitle: 'Pinky Nails Studio',
    thumbnailUrl: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=600&q=80',
    categoryTag: 'SHORT',
    isOwnerVideo: true,
    views: '48.2k views',
    transformationTag: '3D Aura Nail Art'
  },
  {
    id: 'video-sc-2',
    youtubeUrl: 'https://www.youtube.com/shorts/fJ9rUzIMcZQ',
    videoId: 'fJ9rUzIMcZQ',
    title: 'Lash lift reveal',
    channelTitle: 'Pinky Lash & Brow Bar',
    thumbnailUrl: 'https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28?auto=format&fit=crop&w=600&q=80',
    categoryTag: 'SHORT',
    isOwnerVideo: true,
    views: '32.1k views',
    transformationTag: 'Keratin Lash Lift'
  },
  {
    id: 'video-sc-3',
    youtubeUrl: 'https://www.youtube.com/shorts/tgbNymZ7vqY',
    videoId: 'tgbNymZ7vqY',
    title: 'French tip clean line',
    channelTitle: 'Pinky Nails Studio',
    thumbnailUrl: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=600&q=80',
    categoryTag: 'SHORT',
    isOwnerVideo: false,
    views: '54.9k views',
    transformationTag: 'Micro French Tip'
  },
  {
    id: 'video-sc-4',
    youtubeUrl: 'https://www.youtube.com/shorts/pAgnJDJN4VA',
    videoId: 'pAgnJDJN4VA',
    title: 'Brow lamination brush-up',
    channelTitle: 'Pinky Lash & Brow Bar',
    thumbnailUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80',
    categoryTag: 'SHORT',
    isOwnerVideo: false,
    views: '29.3k views',
    transformationTag: 'Brow Sculpting'
  },
  {
    id: 'video-sc-5',
    youtubeUrl: 'https://www.youtube.com/shorts/3JZ_D3ELwOQ',
    videoId: '3JZ_D3ELwOQ',
    title: 'Gel removal ASMR',
    channelTitle: 'Pinky Nails Studio',
    thumbnailUrl: 'https://images.unsplash.com/photo-1632345031435-8727fec88f2d?auto=format&fit=crop&w=600&q=80',
    categoryTag: 'SHORT',
    isOwnerVideo: false,
    views: '61.0k views',
    transformationTag: 'Gentle Care ASMR'
  },
  {
    id: 'video-sc-6',
    youtubeUrl: 'https://www.youtube.com/watch?v=fJ9rUzIMcZQ',
    videoId: 'fJ9rUzIMcZQ',
    title: 'Master Balayage & High-Gloss Hair Transformation',
    channelTitle: 'Miraki Hair Studio',
    thumbnailUrl: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=600&q=80',
    categoryTag: 'SHOWCASE',
    isOwnerVideo: false,
    views: '12.4k views',
    transformationTag: 'Hair Transformation'
  },
  {
    id: 'video-sc-7',
    youtubeUrl: 'https://www.youtube.com/shorts/3JZ_D3ELwOQ',
    videoId: '3JZ_D3ELwOQ',
    title: 'Precision Fade & Beard Sculpting Reel',
    channelTitle: 'Miraki Barbering',
    thumbnailUrl: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=600&q=80',
    categoryTag: 'SHORT',
    isOwnerVideo: false,
    views: '28.1k views',
    transformationTag: 'Gentlemen Cut'
  },
  {
    id: 'video-sc-8',
    youtubeUrl: 'https://www.youtube.com/watch?v=L_LUpnjgPso',
    videoId: 'L_LUpnjgPso',
    title: 'Glass Skin Facial & Organic HydraGlow Therapy',
    channelTitle: 'Miraki Skin & Aesthetics',
    thumbnailUrl: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=600&q=80',
    categoryTag: 'LONG',
    isOwnerVideo: false,
    views: '19.8k views',
    transformationTag: 'Skincare Glow'
  }
];

/**
 * Extracts the 11-char YouTube video id from watch / youtu.be / Shorts /
 * embed / path-style links, ignoring extra query params (?si=…, &feature=…).
 * Delegates to the shared utility so every add path behaves identically.
 */
export function extractYouTubeId(url: string): string | null {
  return extractYouTubeIdFromShared(url);
}

interface SocialConnectivityStepProps {
  profile: SalonProfile;
  setProfile: React.Dispatch<React.SetStateAction<SalonProfile>>;
  onBack?: () => void;
  onContinue?: () => void;
}

export const SocialConnectivityStep: React.FC<SocialConnectivityStepProps> = ({
  profile,
  setProfile,
  onBack,
  onContinue,
}) => {
  // Profiles state
  const [instagram, setInstagram] = useState<string>(profile.instagramHandle || '');
  const [facebook, setFacebook] = useState<string>(profile.facebookPage || '');
  const [youtube, setYoutube] = useState<string>(profile.youtubeChannel || '');
  const [tiktok, setTiktok] = useState<string>(profile.tiktokProfile || '');

  // Connection toggles
  const [isInstaConnected, setIsInstaConnected] = useState<boolean>(!!profile.instagramHandle);
  const [isFbConnected, setIsFbConnected] = useState<boolean>(!!profile.facebookPage);
  const [isYtConnected, setIsYtConnected] = useState<boolean>(!!profile.youtubeChannel);
  const [isTtConnected, setIsTtConnected] = useState<boolean>(!!profile.tiktokProfile);

  // Videos state: initialize with profile videos or template-specific defaults
  const [videos, setVideos] = useState<SocialVideo[]>(() => {
    if (profile.socialVideos && profile.socialVideos.length > 0) {
      return profile.socialVideos;
    }
    const templateDefaults = getDefaultVideosForTemplate(profile.businessType);
    return templateDefaults.length > 0 ? templateDefaults : DEFAULT_SHOWCASE_VIDEOS;
  });

  // Modal / Form state for Add Social Video
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [videoUrlInput, setVideoUrlInput] = useState<string>('');
  const [videoTitleInput, setVideoTitleInput] = useState<string>('');
  const [videoCategoryInput, setVideoCategoryInput] = useState<VideoCategoryTag>('SHORT');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [addSuccessMessage, setAddSuccessMessage] = useState<string | null>(null);

  // Manage Video modal state
  const [managingVideo, setManagingVideo] = useState<SocialVideo | null>(null);
  const [activeTabFilter, setActiveTabFilter] = useState<'ALL' | 'YOURS' | 'SHOWCASE'>('ALL');

  // Interactive hover preview for video thumbnails
  const [hoveredVideoId, setHoveredVideoId] = useState<string | null>(null);
  const [previewActiveVideo, setPreviewActiveVideo] = useState<SocialVideo | null>(null);

  // YouTube Data API auto-fetch state
  const [isFetchingVideos, setIsFetchingVideos] = useState<boolean>(false);
  const [fetchStatus, setFetchStatus] = useState<string | null>(null);
  const [fetchedVideos, setFetchedVideos] = useState<SocialVideo[]>([]);

  // Synchronize state back to profile
  const syncToProfile = (
    updatedInsta: string,
    updatedFb: string,
    updatedYt: string,
    updatedTt: string,
    updatedVids: SocialVideo[]
  ) => {
    setProfile((prev) => ({
      ...prev,
      instagramHandle: updatedInsta,
      facebookPage: updatedFb,
      youtubeChannel: updatedYt,
      tiktokProfile: updatedTt,
      socialVideos: updatedVids,
    }));
  };

  const handleConnectPlatform = (
    platform: 'instagram' | 'facebook' | 'youtube' | 'tiktok'
  ) => {
    if (platform === 'instagram') {
      const val = instagram.trim() || `https://instagram.com/${profile.subdomain || 'yoursalon'}`;
      setInstagram(val);
      setIsInstaConnected(true);
      syncToProfile(val, facebook, youtube, tiktok, videos);
    } else if (platform === 'facebook') {
      const val = facebook.trim() || `https://facebook.com/${profile.subdomain || 'yoursalon'}`;
      setFacebook(val);
      setIsFbConnected(true);
      syncToProfile(instagram, val, youtube, tiktok, videos);
    } else if (platform === 'youtube') {
      const val = youtube.trim() || `https://youtube.com/@${profile.subdomain || 'yoursalon'}`;
      setYoutube(val);
      setIsYtConnected(true);
      syncToProfile(instagram, facebook, val, tiktok, videos);
    } else if (platform === 'tiktok') {
      const val = tiktok.trim() || `https://tiktok.com/@${profile.subdomain || 'yoursalon'}`;
      setTiktok(val);
      setIsTtConnected(true);
      syncToProfile(instagram, facebook, youtube, val, videos);
    }
  };

  const handleAddVideoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUrlError(null);

    const extractedId = extractYouTubeId(videoUrlInput);
    if (!extractedId) {
      setUrlError(
        'Invalid YouTube URL. Please paste a valid link (e.g., https://www.youtube.com/watch?v=..., https://youtube.com/shorts/... or https://youtu.be/...).'
      );
      return;
    }

    const title = videoTitleInput.trim() || `Client Transformation Reel #${videos.length + 1}`;
    const newVideo: SocialVideo = {
      id: `vid-owner-${Date.now()}`,
      // Store the CLEAN 11-char video id plus a canonical, query-free URL
      // (shorts stay /shorts/, everything else becomes a watch URL) so embeds
      // on the live preview/site always render.
      youtubeUrl:
        videoCategoryInput === 'SHORT'
          ? buildYouTubeShortsUrl(extractedId)
          : buildYouTubeWatchUrl(extractedId),
      videoId: extractedId,
      title,
      channelTitle: profile?.businessName || 'Your Salon Channel',
      thumbnailUrl: buildYouTubeThumbnailUrl(extractedId, 'hqdefault'),
      categoryTag: videoCategoryInput,
      isOwnerVideo: true, // "yours"
      views: '1.2k views',
      transformationTag: 'Client Transformation'
    };

    const updated = [newVideo, ...videos];
    setVideos(updated);
    syncToProfile(instagram, facebook, youtube, tiktok, updated);

    setVideoUrlInput('');
    setVideoTitleInput('');
    setIsAddModalOpen(false);
    setAddSuccessMessage('New social video added successfully to your website feed!');
    setTimeout(() => setAddSuccessMessage(null), 4000);
  };

  const handleDeleteVideo = (id: string) => {
    const updated = videos.filter((v) => v.id !== id);
    setVideos(updated);
    syncToProfile(instagram, facebook, youtube, tiktok, updated);
    if (managingVideo?.id === id) setManagingVideo(null);
  };

  const handleUpdateCategoryTag = (id: string, tag: VideoCategoryTag) => {
    const updated = videos.map((v) => (v.id === id ? { ...v, categoryTag: tag } : v));
    setVideos(updated);
    syncToProfile(instagram, facebook, youtube, tiktok, updated);
    if (managingVideo?.id === id) {
      setManagingVideo((prev) => (prev ? { ...prev, categoryTag: tag } : null));
    }
  };

  const handleToggleOwnerStatus = (id: string) => {
    const updated = videos.map((v) => (v.id === id ? { ...v, isOwnerVideo: !v.isOwnerVideo } : v));
    setVideos(updated);
    syncToProfile(instagram, facebook, youtube, tiktok, updated);
    if (managingVideo?.id === id) {
      setManagingVideo((prev) => (prev ? { ...prev, isOwnerVideo: !prev.isOwnerVideo } : null));
    }
  };

  const handleAutoFetchVideos = async () => {
    setIsFetchingVideos(true);
    setFetchStatus('Fetching videos from YouTube...');
    setFetchedVideos([]);
    try {
      const res = await fetch('/api/youtube/fetch-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelUrl: youtube || profile.youtubeChannel || `https://youtube.com/@${profile.subdomain || 'yoursalon'}`,
          maxResults: 6,
        }),
      });
      const data = await res.json();
      if (data.success && data.videos && data.videos.length > 0) {
        const fetched = data.videos.map((v: any, i: number) => {
          const videoId = isYouTubeVideoId(v.videoId)
            ? v.videoId
            : extractYouTubeId(v.youtubeUrl) || '';
          return {
            ...v,
            id: `vid-auto-${Date.now()}-${i}`,
            videoId,
            // Normalize whatever the API returned into a clean watch URL.
            youtubeUrl: videoId ? buildYouTubeWatchUrl(videoId) : v.youtubeUrl || '',
            thumbnailUrl: v.thumbnailUrl || (videoId ? buildYouTubeThumbnailUrl(videoId) : ''),
            isOwnerVideo: false,
          };
        });
        setFetchedVideos(fetched);
        setFetchStatus(`Auto-fetched ${fetched.length} videos from YouTube.`);
        // Optionally append fetched videos to main list
        const combined = [...videos, ...fetched];
        setVideos(combined);
        syncToProfile(instagram, facebook, youtube, tiktok, combined);
      } else {
        setFetchStatus(data.notice || 'No videos found for this channel.');
      }
    } catch (err: any) {
      console.warn('Auto-fetch error:', err);
      setFetchStatus('Failed to fetch videos from YouTube. Please check your API key.');
    } finally {
      setIsFetchingVideos(false);
      setTimeout(() => setFetchStatus(null), 6000);
    }
  };

  // Keyboard navigation for video lightbox
  useEffect(() => {
    if (!previewActiveVideo) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewActiveVideo(null);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        // Navigate through videos in the current view
        const currentList = videos.filter((v) => {
          if (activeTabFilter === 'YOURS') return v.isOwnerVideo;
          if (activeTabFilter === 'SHOWCASE') return !v.isOwnerVideo;
          return true;
        });
        const currentIndex = currentList.findIndex((v) => v.id === previewActiveVideo.id);
        if (currentIndex !== -1) {
          const nextIndex = e.key === 'ArrowLeft'
            ? (currentIndex - 1 + currentList.length) % currentList.length
            : (currentIndex + 1) % currentList.length;
          setPreviewActiveVideo(currentList[nextIndex]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewActiveVideo, videos, activeTabFilter]);

  // Dynamically compute count breakdown
  const ownerCount = videos.filter((v) => v.isOwnerVideo).length;
  const showcaseCount = videos.filter((v) => !v.isOwnerVideo).length;

  // Filter list
  const filteredVideos = videos.filter((v) => {
    if (activeTabFilter === 'YOURS') return v.isOwnerVideo;
    if (activeTabFilter === 'SHOWCASE') return !v.isOwnerVideo;
    return true;
  });

  // Resolve the id used by the lightbox player (fall back to extracting from
  // the URL for videos added before normalization).
  const previewVideoId = previewActiveVideo
    ? isYouTubeVideoId(previewActiveVideo.videoId)
      ? previewActiveVideo.videoId
      : extractYouTubeId(previewActiveVideo.youtubeUrl) || ''
    : '';
  const previewEmbedSrc = buildYouTubeEmbedUrl(previewVideoId, { autoplay: true });

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto">
      {/* STEP TITLE HEADER */}
      <div className="flex flex-col gap-1 bg-gradient-to-r from-rose-50/50 via-white to-purple-50/30 p-5 rounded-2xl border border-gray-200/80">
        <span className="font-mono-caps text-xs font-bold text-[#b0004a] tracking-widest uppercase flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#b0004a] animate-pulse" />
          <span>SOCIAL MEDIA & REELS SHOWCASE</span>
        </span>
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
          Connect your social channels & video feeds
        </h1>
        <p className="text-gray-600 text-xs sm:text-sm max-w-3xl leading-relaxed">
          Add your social profiles and YouTube short transformation videos. They appear directly on your live website to build social trust and attract more bookings.
        </p>
      </div>

      {addSuccessMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-2xl flex items-center gap-3 text-xs font-bold shadow-xs animate-fade-in">
          <span className="material-symbols-outlined text-emerald-600 text-lg">check_circle</span>
          <span>{addSuccessMessage}</span>
        </div>
      )}

      {/* TWO-COLUMN INTERACTIVE SETUP GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* ============================================================ */}
        {/* LEFT PANEL: SOCIAL SETUP CONTROLS */}
        {/* ============================================================ */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* SUB-SECTION 1: SOCIAL PROFILES */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-xl">share</span>
                </div>
                <div>
                  <h2 className="font-display font-bold text-base text-gray-900">
                    Social Profiles
                  </h2>
                  <p className="text-xs text-gray-500">
                    Enter your official social media profile URLs
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-mono font-bold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                4 Platforms
              </span>
            </div>

            <div className="flex flex-col gap-4">
              {/* 1. Instagram Profile Input */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-gray-50/80 border border-gray-200">
                <div className="flex items-center gap-2.5 flex-1">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white flex items-center justify-center text-xs font-bold shadow-xs shrink-0">
                    IG
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">
                      Instagram Profile
                    </label>
                    <input
                      type="text"
                      value={instagram}
                      onChange={(e) => {
                        setInstagram(e.target.value);
                        if (e.target.value.trim().length > 5) setIsInstaConnected(true);
                        syncToProfile(e.target.value, facebook, youtube, tiktok, videos);
                      }}
                      placeholder="https://instagram.com/pinkynails.studio"
                      className="w-full text-xs font-mono bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {isInstaConnected ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-lg">
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      Connected
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-gray-500 bg-gray-200 px-2.5 py-1 rounded-lg">
                      Not connected
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleConnectPlatform('instagram')}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg bg-gray-900 hover:bg-black text-white transition-colors cursor-pointer shadow-xs"
                  >
                    {isInstaConnected ? 'Update' : 'Connect'}
                  </button>
                </div>
              </div>

              {/* 2. Facebook Page/Profile Input */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-gray-50/80 border border-gray-200">
                <div className="flex items-center gap-2.5 flex-1">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-xs shrink-0">
                    FB
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">
                      Facebook Page/Profile
                    </label>
                    <input
                      type="text"
                      value={facebook}
                      onChange={(e) => {
                        setFacebook(e.target.value);
                        if (e.target.value.trim().length > 5) setIsFbConnected(true);
                        syncToProfile(instagram, e.target.value, youtube, tiktok, videos);
                      }}
                      placeholder="https://facebook.com/pinkynailsstudio"
                      className="w-full text-xs font-mono bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {isFbConnected ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-lg">
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      Connected
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-gray-500 bg-gray-200 px-2.5 py-1 rounded-lg">
                      Not connected
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleConnectPlatform('facebook')}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg bg-gray-900 hover:bg-black text-white transition-colors cursor-pointer shadow-xs"
                  >
                    {isFbConnected ? 'Update' : 'Connect'}
                  </button>
                </div>
              </div>

              {/* 3. YouTube Channel Input */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-gray-50/80 border border-gray-200">
                <div className="flex items-center gap-2.5 flex-1">
                  <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center text-xs font-bold shadow-xs shrink-0">
                    YT
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">
                      YouTube Channel
                    </label>
                    <input
                      type="text"
                      value={youtube}
                      onChange={(e) => {
                        setYoutube(e.target.value);
                        if (e.target.value.trim().length > 5) setIsYtConnected(true);
                        syncToProfile(instagram, facebook, e.target.value, tiktok, videos);
                      }}
                      placeholder="https://youtube.com/@pinkynails"
                      className="w-full text-xs font-mono bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-900"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {isYtConnected ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-lg">
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      Connected
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-gray-500 bg-gray-200 px-2.5 py-1 rounded-lg">
                      Not connected
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleConnectPlatform('youtube')}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg bg-gray-900 hover:bg-black text-white transition-colors cursor-pointer shadow-xs"
                  >
                    {isYtConnected ? 'Update' : 'Connect'}
                  </button>
                </div>
              </div>

              {/* 4. TikTok Profile Input */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-gray-50/80 border border-gray-200">
                <div className="flex items-center gap-2.5 flex-1">
                  <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center text-xs font-bold shadow-xs shrink-0 border border-gray-800">
                    TT
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">
                      TikTok Profile
                    </label>
                    <input
                      type="text"
                      value={tiktok}
                      onChange={(e) => {
                        setTiktok(e.target.value);
                        if (e.target.value.trim().length > 5) setIsTtConnected(true);
                        syncToProfile(instagram, facebook, youtube, e.target.value, videos);
                      }}
                      placeholder="https://tiktok.com/@pinkynails"
                      className="w-full text-xs font-mono bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {isTtConnected ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-lg">
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      Connected
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-gray-500 bg-gray-200 px-2.5 py-1 rounded-lg">
                      Not connected
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleConnectPlatform('tiktok')}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg bg-gray-900 hover:bg-black text-white transition-colors cursor-pointer shadow-xs"
                  >
                    {isTtConnected ? 'Update' : 'Connect'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* SUB-SECTION 2: SHOW YOUR WORK */}
          <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white border border-purple-800/40 rounded-2xl p-5 sm:p-6 shadow-md flex flex-col gap-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <span className="material-symbols-outlined text-9xl text-white">movie</span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-400 text-xl">auto_videocam</span>
                <h3 className="font-display font-bold text-lg text-white">
                  Show Your Work
                </h3>
              </div>
              <p className="text-xs text-purple-200 mt-1 leading-relaxed">
                Paste a YouTube URL only — thumbnail, title, description and channel fill in automatically.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-[#b0004a] to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-base">add_circle</span>
                <span>+ Add Social Video</span>
              </button>
            </div>
          </div>

          {/* SUB-SECTION: AUTO-FETCH FROM YOUTUBE DATA API */}
          <div className="bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 border border-amber-200 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col gap-4 relative overflow-hidden">
            <div className="absolute -top-6 -right-6 text-amber-100 opacity-40">
              <span className="material-symbols-outlined text-9xl">autorenew</span>
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600 text-xl">autorenew</span>
                <h3 className="font-display font-bold text-base text-amber-900">
                  Auto-Fetch Videos from YouTube
                </h3>
              </div>
              <p className="text-xs text-amber-800 mt-1.5 leading-relaxed">
                Connect your YouTube channel and automatically pull the latest videos, shorts, and showcases into your salon feed using the YouTube Data API.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 relative z-10">
              <div className="flex-1 min-w-0">
                <label className="text-[10px] font-bold text-amber-700 uppercase font-mono-caps block mb-0.5">
                  YouTube Channel URL
                </label>
                <input
                  type="text"
                  value={youtube || profile.youtubeChannel || ''}
                  onChange={(e) => {
                    setYoutube(e.target.value);
                    syncToProfile(instagram, facebook, e.target.value, tiktok, videos);
                  }}
                  placeholder="https://youtube.com/@pinky-nails-studio"
                  className="w-full text-xs font-mono bg-white/80 border border-amber-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400 text-amber-900"
                />
              </div>
              <button
                type="button"
                onClick={handleAutoFetchVideos}
                disabled={isFetchingVideos || !(youtube || profile.youtubeChannel)}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer active:scale-[0.97] whitespace-nowrap"
              >
                {isFetchingVideos ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-sm">autorenew</span>
                    <span>Fetching...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">autorenew</span>
                    <span>Auto-Fetch Videos</span>
                  </>
                )}
              </button>
            </div>

            {fetchStatus && (
              <div className="bg-amber-50/70 border border-amber-200 text-amber-800 p-3 rounded-xl text-[11px] font-medium flex items-center gap-2 shadow-xs animate-fade-in relative z-10">
                <span className="material-symbols-outlined text-amber-600 text-base">info</span>
                <span>{fetchStatus}</span>
              </div>
            )}

            {/* Fetched videos preview */}
            {fetchedVideos.length > 0 && (
              <div className="relative z-10">
                <h4 className="text-xs font-bold text-amber-900 mb-2">Successfully fetched videos ({fetchedVideos.length}):</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {fetchedVideos.map((v) => (
                    <div
                      key={v.id}
                      onMouseEnter={() => setHoveredVideoId(v.id)}
                      onMouseLeave={() => setHoveredVideoId(null)}
                      onClick={() => setPreviewActiveVideo(v)}
                      className="group relative rounded-lg overflow-hidden border border-amber-200 bg-white shadow-xs hover:shadow-md transition-all cursor-pointer"
                    >
                      <div className="aspect-video w-full overflow-hidden relative">
                        {hoveredVideoId === v.id && (
                          <div className="absolute inset-0 z-20 bg-amber-600/20 backdrop-blur-xs flex items-center justify-center animate-fade-in pointer-events-none">
                            <span className="text-[9px] font-bold text-amber-900 bg-amber-300 px-2 py-0.5 rounded shadow-lg">PREVIEW ACTIVE</span>
                          </div>
                        )}
                        <img src={v.thumbnailUrl} alt={v.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      </div>
                      <div className="p-2 bg-amber-50/50">
                        <h5 className="text-[10px] font-bold text-amber-950 truncate">{v.title}</h5>
                        <p className="text-[9px] text-amber-700 font-mono truncate">{v.channelTitle}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] text-amber-700 font-medium">These videos have been added to your gallery feed.</span>
                  <button
                    type="button"
                    onClick={() => setFetchedVideos([])}
                    className="text-[10px] text-amber-800 underline hover:text-amber-950"
                  >
                    Clear fetched results
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* SUB-SECTION 3: VIDEO MANAGEMENT (OWNER VIEW) */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-display font-bold text-base text-gray-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-red-600 text-lg">play_circle</span>
                  <span>Video Management (Owner View)</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Manage your website video gallery & showcase transformations
                </p>
              </div>

              {/* Dynamic Counters Breakdown (e.g., 0 yours · 10 showcase) */}
              <div className="inline-flex items-center gap-2 bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-xl font-mono text-xs font-bold text-gray-800 shrink-0">
                <span className="text-[#b0004a]">{ownerCount} yours</span>
                <span className="text-gray-300">·</span>
                <span className="text-purple-700">{showcaseCount} showcase</span>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
              <button
                type="button"
                onClick={() => setActiveTabFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  activeTabFilter === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All Videos ({videos.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTabFilter('YOURS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  activeTabFilter === 'YOURS'
                    ? 'bg-[#b0004a] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Yours ({ownerCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTabFilter('SHOWCASE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  activeTabFilter === 'SHOWCASE'
                    ? 'bg-purple-700 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Showcase ({showcaseCount})
              </button>
            </div>

            {/* Managed Video List */}
            <div className="flex flex-col gap-3 max-h-[420px] overflow-y-auto pr-1">
              {filteredVideos.length === 0 ? (
                <div className="p-8 text-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-xs">
                  No videos found in this view. Click <strong>+ Add Social Video</strong> above to paste a YouTube link!
                </div>
              ) : (
                filteredVideos.map((vid) => (
                  <div
                    key={vid.id}
                    className="p-3 rounded-xl border border-gray-200 bg-gray-50/50 hover:bg-white hover:border-gray-300 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Thumbnail */}
                      <div className="w-20 h-14 rounded-lg bg-gray-900 relative overflow-hidden shrink-0 border border-gray-200">
                        <img
                          src={vid.thumbnailUrl}
                          alt={vid.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                          <span className="material-symbols-outlined text-white text-lg drop-shadow-xs">play_arrow</span>
                        </div>
                        {vid.isOwnerVideo && (
                          <span className="absolute top-1 left-1 bg-[#b0004a] text-white text-[9px] font-mono font-bold px-1 rounded">
                            YOURS
                          </span>
                        )}
                      </div>

                      {/* Video Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          {/* Tag Category Badge */}
                          <span
                            className={`text-[9px] font-mono font-extrabold uppercase px-2 py-0.5 rounded text-white ${
                              vid.categoryTag === 'SHORT'
                                ? 'bg-rose-600'
                                : vid.categoryTag === 'SHOWCASE'
                                ? 'bg-sky-600'
                                : 'bg-purple-600'
                            }`}
                          >
                            {vid.categoryTag}
                          </span>
                          <span className="text-[10px] text-gray-500 font-mono">
                            {vid.channelTitle || 'YouTube'}
                          </span>
                        </div>
                        <h4 className="font-bold text-xs text-gray-900 truncate">
                          {vid.title}
                        </h4>
                        <p className="text-[10px] text-gray-500 truncate mt-0.5">
                          {vid.transformationTag || 'Transformation Reel'} · {vid.views || '1.2k views'}
                        </p>
                      </div>
                    </div>

                    {/* Manage Button */}
                    <div className="shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => setManagingVideo(vid)}
                        className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 text-gray-800 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                      >
                        <span className="material-symbols-outlined text-sm">settings</span>
                        <span>MANAGE</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* RIGHT PANEL: INTERACTIVE LIVE WEBSITE PREVIEW */}
        {/* ============================================================ */}
        <div className="lg:col-span-5 flex flex-col gap-4 sticky top-20">
          <div className="flex flex-col relative">
            {/* Simulated Live Website Container */}
            <div className="p-4 sm:p-5 flex flex-col gap-5 bg-slate-950 min-h-[580px] max-h-[720px] overflow-y-auto relative text-slate-100 rounded-2xl border border-slate-800 shadow-xl">
              
              {/* 1. TOP ANNOUNCEMENT & STATUS BAR */}
              <div className="bg-gradient-to-r from-rose-950/80 via-purple-950/80 to-slate-900 border border-rose-500/20 p-2.5 rounded-xl flex items-center justify-between text-[10px] font-mono">
                <div className="flex items-center gap-2">
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    OPEN NOW
                  </span>
                  <span className="text-slate-300 truncate hidden sm:inline">
                    Elevate Your Beauty • Premium Hair & Nail Art Sanctuary
                  </span>
                </div>

                {/* Language Switcher */}
                <div className="flex items-center gap-1 text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800 shrink-0">
                  <span className="text-white font-bold">EN</span>
                  <span>|</span>
                  <span className="hover:text-white cursor-pointer">HI</span>
                  <span>|</span>
                  <span className="hover:text-white cursor-pointer">FR</span>
                </div>
              </div>

              {/* 2. CLIENT WEBSITE HEADER BAR */}
              <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl flex flex-col gap-2.5 shadow-md">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#b0004a] to-[#d81b60] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                      {profile?.businessName ? profile.businessName.charAt(0) : 'P'}
                    </div>
                    <span className="font-display font-extrabold text-sm text-white tracking-tight truncate">
                      {profile?.businessName || 'Pinky Nails Studio'}
                    </span>
                  </div>

                  {/* Primary [BOOK APPOINTMENT] CTA Button */}
                  <button
                    type="button"
                    onClick={() => alert('Simulated client appointment booking modal triggered!')}
                    className="bg-[#b0004a] hover:bg-[#d81b60] text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1 shrink-0 cursor-pointer transition-all"
                  >
                    <span>BOOK APPOINTMENT</span>
                    <span className="material-symbols-outlined text-xs">arrow_forward</span>
                  </button>
                </div>

                {/* Client Website Navigation Tabs */}
                <div className="flex items-center gap-2 overflow-x-auto text-[10px] font-bold font-mono text-slate-400 border-t border-slate-800/80 pt-2 no-scrollbar">
                  <span className="text-rose-400 bg-rose-950/60 border border-rose-500/30 px-2 py-0.5 rounded">HOME</span>
                  <span className="hover:text-white cursor-pointer transition-colors px-1.5 py-0.5">SERVICES</span>
                  <span className="hover:text-white cursor-pointer transition-colors px-1.5 py-0.5">OFFERS</span>
                  <span className="hover:text-white cursor-pointer transition-colors px-1.5 py-0.5">GALLERY</span>
                  <span className="hover:text-white cursor-pointer transition-colors px-1.5 py-0.5">ABOUT</span>
                  <span className="hover:text-white cursor-pointer transition-colors px-1.5 py-0.5">TEAM</span>
                  <span className="hover:text-white cursor-pointer transition-colors px-1.5 py-0.5">CONTACT</span>
                  <span className="hover:text-white cursor-pointer transition-colors px-1.5 py-0.5">MY BOOKINGS</span>
                </div>
              </div>

              {/* 3. CONNECTED SOCIAL MEDIA HANDLES HUB */}
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col gap-2">
                <span className="text-[10px] font-mono uppercase text-amber-400 tracking-wider font-bold">
                  CONNECTED SOCIAL HANDLES
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {instagram && (
                    <a href={instagram} target="_blank" rel="noreferrer" className="text-[10px] font-mono bg-gradient-to-r from-amber-500/20 to-rose-500/20 text-rose-300 border border-rose-500/30 px-2.5 py-1 rounded-full flex items-center gap-1">
                      <span>IG</span>
                      <span>@{instagram.split('/').pop() || 'pinkynails.studio'}</span>
                    </a>
                  )}
                  {facebook && (
                    <a href={facebook} target="_blank" rel="noreferrer" className="text-[10px] font-mono bg-blue-950/60 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded-full flex items-center gap-1">
                      <span>FB</span>
                      <span>Facebook</span>
                    </a>
                  )}
                  {youtube && (
                    <a href={youtube} target="_blank" rel="noreferrer" className="text-[10px] font-mono bg-red-950/60 text-red-300 border border-red-500/30 px-2.5 py-1 rounded-full flex items-center gap-1">
                      <span>YT</span>
                      <span>YouTube</span>
                    </a>
                  )}
                  {tiktok && (
                    <a href={tiktok} target="_blank" rel="noreferrer" className="text-[10px] font-mono bg-slate-800 text-slate-200 border border-slate-700 px-2.5 py-1 rounded-full flex items-center gap-1">
                      <span>TT</span>
                      <span>TikTok</span>
                    </a>
                  )}
                  {!instagram && !facebook && !youtube && !tiktok && (
                    <span className="text-[11px] text-slate-500 italic">
                      No handles connected yet. Enter profile links on the left!
                    </span>
                  )}
                </div>
              </div>

              {/* 4. DYNAMIC GALLERY SECTION 1: "THE EDIT, ON FILM" (YouTube Shorts Reel) */}
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <div>
                    <span className="text-[9px] font-mono uppercase text-rose-400 font-bold tracking-widest block">
                      FEATURED REELS
                    </span>
                    <h5 className="font-display font-extrabold text-xs text-white flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-rose-500 text-base">play_circle</span>
                      <span>The edit, on film</span>
                    </h5>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {videos.filter(v => v.categoryTag === 'SHORT').length} Shorts
                  </span>
                </div>

                {/* Horizontal / Grid Reels Display */}
                <div className="grid grid-cols-2 gap-2.5">
                  {videos.filter(v => v.categoryTag === 'SHORT').slice(0, 4).map((v) => (
                    <div
                      key={v.id}
                      onMouseEnter={() => setHoveredVideoId(v.id)}
                      onMouseLeave={() => setHoveredVideoId(null)}
                      onClick={() => setPreviewActiveVideo(v)}
                      className="group relative rounded-xl bg-slate-900 border border-slate-800 overflow-hidden cursor-pointer hover:border-rose-500/60 transition-all flex flex-col justify-between h-48 shadow-md"
                    >
                      {/* Interactive hover preview overlay */}
                      {hoveredVideoId === v.id && (
                        <div className="absolute inset-0 z-30 bg-black/40 backdrop-blur-xs flex items-center justify-center animate-fade-in pointer-events-none">
                          <div className="bg-rose-600/90 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-lg flex items-center gap-1.5">
                            <span className="material-symbols-outlined animate-pulse">play_circle</span>
                            <span>Interactive Preview Active</span>
                          </div>
                        </div>
                      )}
                      <img
                        src={v.thumbnailUrl}
                        alt={v.title}
                        className="absolute inset-0 w-full h-full object-cover opacity-85 group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />

                      {/* Top Badges */}
                      <div className="relative z-10 p-2 flex justify-between items-start">
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded text-white bg-rose-600 shadow-xs">
                          SHORT
                        </span>
                        {v.isOwnerVideo && (
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#b0004a] text-white">
                            YOURS
                          </span>
                        )}
                      </div>

                      {/* Play Icon Center */}
                      <div className="relative z-10 self-center w-9 h-9 rounded-full bg-white/25 backdrop-blur-md border border-white/50 text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                        <span className="material-symbols-outlined text-lg ml-0.5">play_arrow</span>
                      </div>

                      {/* Bottom Title & Views */}
                      <div className="relative z-10 p-2 bg-slate-950/80 backdrop-blur-xs border-t border-slate-800/60">
                        <p className="text-[11px] font-bold text-white truncate leading-snug">
                          {v.title}
                        </p>
                        <div className="flex items-center justify-between text-[9px] font-mono text-slate-300 mt-0.5">
                          <span>{v.transformationTag || 'Transformation'}</span>
                          <span className="text-rose-300 font-bold">{v.views || 'Short'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 5. DYNAMIC GALLERY SECTION 2: "WEEKLY TOP VIDEOS" (Showcase & Long Videos) */}
              <div className="flex flex-col gap-2.5 pt-1">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <div>
                    <span className="text-[9px] font-mono uppercase text-sky-400 font-bold tracking-widest block">
                      FEATURED SHOWCASE
                    </span>
                    <h5 className="font-display font-extrabold text-xs text-white flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sky-400 text-base">video_library</span>
                      <span>Weekly Top Videos</span>
                    </h5>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {videos.filter(v => v.categoryTag !== 'SHORT').length} Showcase
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  {videos.filter(v => v.categoryTag !== 'SHORT').slice(0, 3).map((v) => (
                    <div
                      key={v.id}
                      onMouseEnter={() => setHoveredVideoId(v.id)}
                      onMouseLeave={() => setHoveredVideoId(null)}
                      onClick={() => setPreviewActiveVideo(v)}
                      className="group p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-sky-500/50 cursor-pointer transition-all flex items-center gap-3 shadow-sm relative overflow-hidden"
                    >
                      <div className="relative w-20 h-14 rounded-lg overflow-hidden shrink-0 border border-slate-800">
                        {hoveredVideoId === v.id && (
                          <div className="absolute inset-0 z-20 bg-sky-600/20 backdrop-blur-xs flex items-center justify-center animate-fade-in pointer-events-none">
                            <span className="text-[9px] font-bold text-white bg-sky-600 px-2 py-0.5 rounded shadow-lg">PREVIEW ACTIVE</span>
                          </div>
                        )}
                        <img
                          src={v.thumbnailUrl}
                          alt={v.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                          <span className="w-6 h-6 rounded-full bg-white/80 text-black flex items-center justify-center text-xs">
                            ▶
                          </span>
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-sky-950 text-sky-300 border border-sky-500/30">
                            {v.categoryTag}
                          </span>
                          <span className="text-[9px] font-mono text-slate-400 truncate">
                            {v.channelTitle}
                          </span>
                        </div>
                        <h6 className="font-bold text-xs text-white truncate leading-tight">
                          {v.title}
                        </h6>
                        <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                          {v.views || '12.4k views'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 6. INTERACTIVE FLOATING QUICK-CONTACT BUTTONS */}
              <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-20">
                <button
                  type="button"
                  title="Call Salon"
                  onClick={() => alert(`Dialing salon phone number: ${profile.phone || '+1 (555) 019-2834'}`)}
                  className="w-9 h-9 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg cursor-pointer transition-transform hover:scale-110"
                >
                  <span className="material-symbols-outlined text-base">call</span>
                </button>
                <button
                  type="button"
                  title="Social Media Links"
                  onClick={() => alert('Social media links opened!')}
                  className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white flex items-center justify-center shadow-lg cursor-pointer transition-transform hover:scale-110"
                >
                  <span className="material-symbols-outlined text-base">share</span>
                </button>
                <button
                  type="button"
                  title="Back to Top"
                  onClick={() => {
                    const el = document.querySelector('.min-h-\\[580px\\]');
                    if (el) el.scrollTop = 0;
                  }}
                  className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 flex items-center justify-center shadow-lg cursor-pointer transition-transform hover:scale-110"
                >
                  <span className="material-symbols-outlined text-base">keyboard_arrow_up</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* ADD SOCIAL VIDEO MODAL */}
      {/* ============================================================ */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-5 animate-scale-up">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#b0004a] text-xl">add_to_queue</span>
                <h3 className="font-display font-bold text-lg text-gray-900">
                  Add Social Video URL
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setUrlError(null);
                }}
                className="text-gray-400 hover:text-gray-700 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Paste a YouTube or YouTube Shorts video link below. Thumbnail, channel info, and embed details will auto-generate for your website!
            </p>

            {urlError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs font-medium flex items-center gap-2">
                <span className="material-symbols-outlined text-rose-600 text-base">error</span>
                <span>{urlError}</span>
              </div>
            )}

            <form onSubmit={handleAddVideoSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-gray-700 uppercase font-mono-caps block mb-1">
                  YouTube Video URL *
                </label>
                <input
                  type="text"
                  required
                  value={videoUrlInput}
                  onChange={(e) => setVideoUrlInput(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=... or https://youtube.com/shorts/..."
                  className="w-full text-xs font-mono p-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#b0004a] focus:outline-none text-gray-900"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 uppercase font-mono-caps block mb-1">
                  Video Title (Optional)
                </label>
                <input
                  type="text"
                  value={videoTitleInput}
                  onChange={(e) => setVideoTitleInput(e.target.value)}
                  placeholder="e.g. Keratin Smooth Transformation Reel"
                  className="w-full text-xs p-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#b0004a] focus:outline-none text-gray-900"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 uppercase font-mono-caps block mb-1">
                  Video Format Category
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['SHORT', 'SHOWCASE', 'LONG'] as VideoCategoryTag[]).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setVideoCategoryInput(cat)}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                        videoCategoryInput === cat
                          ? 'bg-[#b0004a] text-white border-[#b0004a] shadow-xs'
                          : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 mt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#b0004a] hover:bg-[#d81b60] text-white text-xs font-bold shadow-md cursor-pointer transition-all"
                >
                  Save & Add Video
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MANAGE VIDEO MODAL */}
      {/* ============================================================ */}
      {managingVideo && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-display font-bold text-base text-gray-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-600 text-lg">settings</span>
                <span>Manage Video Item</span>
              </h3>
              <button
                type="button"
                onClick={() => setManagingVideo(null)}
                className="text-gray-400 hover:text-gray-700 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Item Preview Card */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
              <img
                src={managingVideo.thumbnailUrl}
                alt={managingVideo.title}
                className="w-16 h-12 object-cover rounded-lg border border-gray-300"
              />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-xs text-gray-900 truncate">{managingVideo.title}</p>
                <span className="text-[10px] font-mono text-gray-500">{managingVideo.channelTitle}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] font-bold text-gray-700 uppercase font-mono-caps block mb-1">
                  Change Category Tag
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['SHORT', 'SHOWCASE', 'LONG'] as VideoCategoryTag[]).map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleUpdateCategoryTag(managingVideo.id, tag)}
                      className={`py-1.5 text-xs font-bold rounded-lg border ${
                        managingVideo.categoryTag === tag
                          ? 'bg-purple-700 text-white border-purple-700'
                          : 'bg-white text-gray-700 border-gray-300'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-bold text-gray-700">Video Ownership Tag</span>
                <button
                  type="button"
                  onClick={() => handleToggleOwnerStatus(managingVideo.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                    managingVideo.isOwnerVideo
                      ? 'bg-[#b0004a] text-white border-[#b0004a]'
                      : 'bg-gray-100 text-gray-700 border-gray-300'
                  }`}
                >
                  {managingVideo.isOwnerVideo ? 'Marked as YOURS' : 'Mark as SHOWCASE'}
                </button>
              </div>

              <div className="pt-2 border-t border-gray-100 flex justify-between items-center mt-2">
                <button
                  type="button"
                  onClick={() => handleDeleteVideo(managingVideo.id)}
                  className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center gap-1 border border-rose-200 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                  <span>Delete Video</span>
                </button>

                <button
                  type="button"
                  onClick={() => setManagingVideo(null)}
                  className="px-5 py-2 rounded-xl bg-gray-900 text-white font-bold text-xs hover:bg-black cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* VIDEO LIGHTBOX PLAYER MODAL */}
      {/* ============================================================ */}
      {previewActiveVideo && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-4 text-white shadow-2xl flex flex-col gap-3 animate-scale-up">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div>
                <h4 className="font-bold text-sm text-white">{previewActiveVideo.title}</h4>
                <p className="text-[11px] font-mono text-slate-400">{previewActiveVideo.channelTitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewActiveVideo(null)}
                className="text-slate-400 hover:text-white font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="aspect-video w-full rounded-xl bg-black overflow-hidden border border-slate-800">
              {previewEmbedSrc ? (
                <iframe
                  src={previewEmbedSrc}
                  title={previewActiveVideo.title}
                  className="w-full h-full border-0"
                  allow={YOUTUBE_IFRAME_ALLOW}
                  allowFullScreen
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs font-mono">
                  Video unavailable
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* NAVIGATION FOOTER (IF WIZARD MODE) */}
      {(onBack || onContinue) && (
        <div className="flex justify-between items-center border-t border-gray-200 pt-6 mt-4">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="px-6 py-3 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-700 hover:bg-gray-100 flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              <span>Back</span>
            </button>
          )}

          {onContinue && (
            <button
              type="button"
              onClick={onContinue}
              className="ml-auto bg-[#b0004a] hover:bg-[#d81b60] text-white text-xs font-bold px-8 py-3.5 rounded-xl shadow-md shadow-[#b0004a]/20 hover:shadow-lg flex items-center gap-2 transition-all cursor-pointer"
            >
              <span>Continue</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
