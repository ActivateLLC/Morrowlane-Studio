import type { Channel, ContentFormat } from '@morrowlane/shared';
import { CHANNELS, CONTENT_FORMATS, isChannel, isContentFormat, normalizeUrl } from '@morrowlane/shared';
import type { StudioIntent } from './schemas.js';

const CHANNEL_ALIASES: Record<string, Channel> = {
  ig: 'instagram',
  insta: 'instagram',
  instagram: 'instagram',
  fb: 'facebook',
  facebook: 'facebook',
  meta: 'facebook',
  tiktok: 'tiktok',
  'tik tok': 'tiktok',
  linkedin: 'linkedin',
  li: 'linkedin',
  x: 'x',
  twitter: 'x',
  tweet: 'x',
  threads: 'threads',
  youtube: 'youtube',
  yt: 'youtube',
  shorts: 'youtube',
  pinterest: 'pinterest',
  pin: 'pinterest',
  google: 'google_business',
  'google business': 'google_business',
  gbp: 'google_business',
  bluesky: 'bluesky',
  blog: 'blog',
  article: 'blog',
  newsletter: 'email',
  email: 'email',
};

const FORMAT_ALIASES: Record<string, ContentFormat> = {
  post: 'instagram_post',
  posts: 'instagram_post',
  carousel: 'instagram_carousel',
  carousels: 'instagram_carousel',
  reel: 'reel_concept',
  reels: 'reel_concept',
  script: 'tiktok_script',
  scripts: 'tiktok_script',
  'short video': 'short_video',
  'short videos': 'short_video',
  thread: 'x_thread',
  threads: 'x_thread',
  tweet: 'x_post',
  tweets: 'x_post',
  caption: 'tiktok_caption',
  captions: 'tiktok_caption',
  article: 'blog_article',
  articles: 'blog_article',
  blog: 'blog_article',
  'blog post': 'blog_article',
  newsletter: 'newsletter',
  email: 'promotional_email',
  emails: 'promotional_email',
  ad: 'advertisement',
  ads: 'advertisement',
  advert: 'advertisement',
  meme: 'meme',
  memes: 'meme',
  infographic: 'infographic',
  infographics: 'infographic',
  quote: 'quote_graphic',
  'quote graphic': 'quote_graphic',
  graphic: 'educational_graphic',
  graphics: 'educational_graphic',
};

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, fifteen: 15, twenty: 20, thirty: 30,
};

/**
 * Reads the Studio's single input box. This is deliberately a rule-based parser:
 * the user typed a short instruction, and a round-trip to a model to learn that
 * "5 tiktoks" means five TikTok scripts is latency the interface cannot afford.
 * Anything it cannot resolve falls through to a model-backed pass.
 */
export function parseStudioIntent(input: string): StudioIntent {
  const text = input.trim();
  const lower = text.toLowerCase();

  const url = findUrl(text);
  const durationDays = findDuration(lower);
  const channels = findChannels(lower);
  const formats = findFormats(lower, channels);
  const count = findCount(lower, durationDays, formats.length);

  let action: StudioIntent['action'] = 'generate_content';
  if (url && /(remix|turn (this|it)|from this (page|url|link)|promote (this|https?))/i.test(lower)) action = 'remix_url';
  else if (url && formats.length === 0) action = 'remix_url';
  else if (/\bcampaign\b/.test(lower)) action = 'plan_campaign';
  else if (durationDays !== null && durationDays >= 7 && formats.length === 0) action = 'fill_calendar';
  else if (/(fill (my |the )?(month|calendar|week)|schedule .* (month|week))/.test(lower)) action = 'fill_calendar';

  return {
    action,
    formats,
    channels,
    count,
    durationDays,
    url,
    productHint: findProductHint(text),
    topic: findTopic(text),
    goal: action === 'plan_campaign' ? text : null,
  };
}

function findUrl(text: string): string | null {
  const match = /\bhttps?:\/\/[^\s<>"')]+|\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>"')]*)?/i.exec(text);
  if (!match) return null;
  const normalized = normalizeUrl(match[0]);
  // A bare sentence word like "e.g" should not be read as a destination.
  if (!normalized) return null;
  const host = new URL(normalized).hostname;
  if (!/\.[a-z]{2,}$/i.test(host)) return null;
  return normalized;
}

function findDuration(lower: string): number | null {
  const explicit = /(\d+)\s*(day|days|week|weeks|month|months)/.exec(lower);
  if (explicit) {
    const value = Number.parseInt(explicit[1]!, 10);
    const unit = explicit[2]!;
    if (unit.startsWith('day')) return clampDays(value);
    if (unit.startsWith('week')) return clampDays(value * 7);
    return clampDays(value * 30);
  }
  if (/\ba month\b|\bthis month\b|\bmonthly\b/.test(lower)) return 30;
  if (/\ba week\b|\bthis week\b|\bweekly\b/.test(lower)) return 7;
  return null;
}

function clampDays(value: number): number {
  return Math.max(1, Math.min(value, 90));
}

function findChannels(lower: string): Channel[] {
  const found = new Set<Channel>();
  for (const [alias, channel] of Object.entries(CHANNEL_ALIASES)) {
    if (new RegExp(`(^|[^a-z])${alias}([^a-z]|$)`, 'i').test(lower)) found.add(channel);
  }
  for (const channel of CHANNELS) {
    if (new RegExp(`(^|[^a-z])${channel.replace('_', ' ')}([^a-z]|$)`, 'i').test(lower)) found.add(channel);
  }
  return [...found];
}

function findFormats(lower: string, channels: Channel[]): ContentFormat[] {
  const found = new Set<ContentFormat>();

  for (const format of CONTENT_FORMATS) {
    if (lower.includes(format.replace(/_/g, ' '))) found.add(format);
  }
  // Longest aliases first so "blog post" wins over "post".
  const aliases = Object.entries(FORMAT_ALIASES).sort((a, b) => b[0].length - a[0].length);
  for (const [alias, format] of aliases) {
    if (new RegExp(`(^|[^a-z])${alias}([^a-z]|$)`, 'i').test(lower)) found.add(format);
  }

  // "instagram post" should mean an Instagram post, not the alias default.
  const resolved = [...found].map((format) => retargetToChannel(format, channels, lower));
  return [...new Set(resolved)].filter(isContentFormat);
}

function retargetToChannel(format: ContentFormat, channels: Channel[], lower: string): ContentFormat {
  if (channels.length !== 1) return format;
  const channel = channels[0]!;
  if (!isChannel(channel)) return format;

  const map: Partial<Record<Channel, Partial<Record<ContentFormat, ContentFormat>>>> = {
    linkedin: { instagram_post: 'linkedin_post' },
    facebook: { instagram_post: 'facebook_post' },
    x: { instagram_post: 'x_post' },
    threads: { instagram_post: 'threads_post', x_thread: 'threads_post' },
    tiktok: { instagram_post: 'tiktok_caption', reel_concept: 'tiktok_script' },
    youtube: { reel_concept: 'youtube_short_script', tiktok_script: 'youtube_short_script' },
    pinterest: { instagram_post: 'pinterest_post' },
    bluesky: { instagram_post: 'x_post' },
    google_business: { instagram_post: 'facebook_post' },
    blog: { instagram_post: 'blog_article' },
    email: { instagram_post: 'newsletter' },
  };

  // Only retarget when the sentence did not name the format's own channel.
  const target = map[channel]?.[format];
  if (!target) return format;
  const formatChannelWord = format.split('_')[0]!;
  if (lower.includes(formatChannelWord)) return format;
  return target;
}

function findCount(lower: string, durationDays: number | null, formatCount: number): number {
  const digits = /(\d+)\s*(?:x\s*)?(?=[a-z])/.exec(lower);
  const numeric = /\b(\d{1,3})\b/.exec(lower);

  for (const candidate of [digits?.[1], numeric?.[1]]) {
    if (!candidate) continue;
    const value = Number.parseInt(candidate, 10);
    // A duration reads as days, not as an asset count.
    if (durationDays !== null && value === durationDays) continue;
    if (value >= 1 && value <= 120) return value;
  }

  for (const [word, value] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`(^|[^a-z])${word}([^a-z]|$)`, 'i').test(lower)) return value;
  }

  if (durationDays !== null) return Math.min(durationDays, 30);
  return formatCount > 0 ? 5 : 5;
}

function findProductHint(text: string): string | null {
  const match = /(?:promote|about|for|featuring|highlight(?:ing)?)\s+(?:our|the|my)\s+([a-z0-9][a-z0-9 '&-]{2,40})/i.exec(text);
  return match ? match[1]!.trim().replace(/[.,!?]$/, '') : null;
}

function findTopic(text: string): string | null {
  const match = /\b(?:about|on|covering|explaining)\s+([a-z0-9][a-z0-9 '&-]{3,60})/i.exec(text);
  if (!match) return null;
  const topic = match[1]!.trim().replace(/[.,!?]$/, '');
  return topic.length >= 4 ? topic : null;
}
