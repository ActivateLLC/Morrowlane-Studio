/**
 * The channel list is the spine of the product: providers, content formats,
 * calendar lanes and analytics all key off these identifiers.
 */
export const CHANNELS = [
  'instagram',
  'facebook',
  'tiktok',
  'linkedin',
  'x',
  'threads',
  'youtube',
  'pinterest',
  'google_business',
  'bluesky',
  'blog',
  'email',
] as const;

export type Channel = (typeof CHANNELS)[number];

export interface ChannelProfile {
  id: Channel;
  label: string;
  /** Hard character ceiling enforced by the platform, if any. */
  maxCharacters: number | null;
  /** Where we aim: comfortably inside the ceiling and tuned for the feed. */
  targetCharacters: number;
  maxHashtags: number;
  supportsThreads: boolean;
  supportsCarousel: boolean;
  supportsVideo: boolean;
  supportsLinkInBody: boolean;
  /** Publishing surface. `social` channels flow through a SocialProvider. */
  surface: 'social' | 'owned';
}

export const CHANNEL_PROFILES: Record<Channel, ChannelProfile> = {
  instagram: {
    id: 'instagram',
    label: 'Instagram',
    maxCharacters: 2200,
    targetCharacters: 700,
    maxHashtags: 12,
    supportsThreads: false,
    supportsCarousel: true,
    supportsVideo: true,
    supportsLinkInBody: false,
    surface: 'social',
  },
  facebook: {
    id: 'facebook',
    label: 'Facebook',
    maxCharacters: 63206,
    targetCharacters: 500,
    maxHashtags: 4,
    supportsThreads: false,
    supportsCarousel: true,
    supportsVideo: true,
    supportsLinkInBody: true,
    surface: 'social',
  },
  tiktok: {
    id: 'tiktok',
    label: 'TikTok',
    maxCharacters: 2200,
    targetCharacters: 300,
    maxHashtags: 6,
    supportsThreads: false,
    supportsCarousel: true,
    supportsVideo: true,
    supportsLinkInBody: false,
    surface: 'social',
  },
  linkedin: {
    id: 'linkedin',
    label: 'LinkedIn',
    maxCharacters: 3000,
    targetCharacters: 1200,
    maxHashtags: 5,
    supportsThreads: false,
    supportsCarousel: true,
    supportsVideo: true,
    supportsLinkInBody: true,
    surface: 'social',
  },
  x: {
    id: 'x',
    label: 'X',
    maxCharacters: 280,
    targetCharacters: 240,
    maxHashtags: 2,
    supportsThreads: true,
    supportsCarousel: false,
    supportsVideo: true,
    supportsLinkInBody: true,
    surface: 'social',
  },
  threads: {
    id: 'threads',
    label: 'Threads',
    maxCharacters: 500,
    targetCharacters: 400,
    maxHashtags: 1,
    supportsThreads: true,
    supportsCarousel: true,
    supportsVideo: true,
    supportsLinkInBody: true,
    surface: 'social',
  },
  youtube: {
    id: 'youtube',
    label: 'YouTube',
    maxCharacters: 5000,
    targetCharacters: 900,
    maxHashtags: 3,
    supportsThreads: false,
    supportsCarousel: false,
    supportsVideo: true,
    supportsLinkInBody: true,
    surface: 'social',
  },
  pinterest: {
    id: 'pinterest',
    label: 'Pinterest',
    maxCharacters: 500,
    targetCharacters: 320,
    maxHashtags: 5,
    supportsThreads: false,
    supportsCarousel: false,
    supportsVideo: true,
    supportsLinkInBody: true,
    surface: 'social',
  },
  google_business: {
    id: 'google_business',
    label: 'Google Business Profile',
    maxCharacters: 1500,
    targetCharacters: 700,
    maxHashtags: 0,
    supportsThreads: false,
    supportsCarousel: false,
    supportsVideo: true,
    supportsLinkInBody: true,
    surface: 'social',
  },
  bluesky: {
    id: 'bluesky',
    label: 'Bluesky',
    maxCharacters: 300,
    targetCharacters: 260,
    maxHashtags: 2,
    supportsThreads: true,
    supportsCarousel: true,
    supportsVideo: true,
    supportsLinkInBody: true,
    surface: 'social',
  },
  blog: {
    id: 'blog',
    label: 'Blog',
    maxCharacters: null,
    targetCharacters: 9000,
    maxHashtags: 0,
    supportsThreads: false,
    supportsCarousel: false,
    supportsVideo: false,
    supportsLinkInBody: true,
    surface: 'owned',
  },
  email: {
    id: 'email',
    label: 'Email',
    maxCharacters: null,
    targetCharacters: 2400,
    maxHashtags: 0,
    supportsThreads: false,
    supportsCarousel: false,
    supportsVideo: false,
    supportsLinkInBody: true,
    surface: 'owned',
  },
};

export function isChannel(value: string): value is Channel {
  return (CHANNELS as readonly string[]).includes(value);
}

export function channelProfile(channel: Channel): ChannelProfile {
  return CHANNEL_PROFILES[channel];
}

export const SOCIAL_CHANNELS = CHANNELS.filter((c) => CHANNEL_PROFILES[c].surface === 'social');
