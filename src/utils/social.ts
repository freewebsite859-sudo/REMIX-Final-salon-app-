/**
 * Social Media utilities and URL formatters for Salon Website Header & Footers.
 */

export function formatInstagramUrl(input?: string): string {
  if (!input || !input.trim()) return '';
  const trimmed = input.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  const handle = trimmed.replace(/^@/, '').trim();
  return `https://www.instagram.com/${handle}`;
}

export function formatFacebookUrl(input?: string): string {
  if (!input || !input.trim()) return '';
  const trimmed = input.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  const page = trimmed.replace(/^@/, '').trim();
  return `https://www.facebook.com/${page}`;
}

export function formatTikTokUrl(input?: string): string {
  if (!input || !input.trim()) return '';
  const trimmed = input.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  const handle = trimmed.replace(/^@/, '').trim();
  return `https://www.tiktok.com/@${handle}`;
}

export function displaySocialHandle(input?: string, prefix = '@'): string {
  if (!input || !input.trim()) return '';
  const trimmed = input.trim();
  if (trimmed.includes('instagram.com/')) {
    const parts = trimmed.split('instagram.com/')[1].split('/')[0].split('?')[0];
    return parts ? `${prefix}${parts}` : trimmed;
  }
  if (trimmed.includes('tiktok.com/@')) {
    const parts = trimmed.split('tiktok.com/@')[1].split('/')[0].split('?')[0];
    return parts ? `${prefix}${parts}` : trimmed;
  }
  if (trimmed.includes('tiktok.com/')) {
    const parts = trimmed.split('tiktok.com/')[1].split('/')[0].split('?')[0];
    return parts ? `${prefix}${parts}` : trimmed;
  }
  if (trimmed.includes('facebook.com/')) {
    const parts = trimmed.split('facebook.com/')[1].split('/')[0].split('?')[0];
    return parts ? parts : trimmed;
  }
  return trimmed.startsWith(prefix) ? trimmed : `${prefix}${trimmed}`;
}
