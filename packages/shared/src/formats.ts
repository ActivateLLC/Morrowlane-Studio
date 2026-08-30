import type { Channel } from './channels.js';

/** Every asset Morrowlane can produce. Adding a format is a data change, not a code change. */
export const CONTENT_FORMATS = [
  'instagram_post',
  'instagram_carousel',
  'reel_concept',
  'tiktok_script',
  'tiktok_caption',
  'facebook_post',
  'linkedin_post',
  'x_post',
  'x_thread',
  'threads_post',
  'youtube_short_script',
  'pinterest_post',
  'blog_article',
  'newsletter',
  'promotional_email',
  'advertisement',
  'quote_graphic',
  'educational_graphic',
  'infographic',
  'meme',
  'short_video',
] as const;

export type ContentFormat = (typeof CONTENT_FORMATS)[number];

/** How a format is rendered downstream — drives which creative service runs. */
export type FormatMedium = 'text' | 'image' | 'video';

export interface FormatProfile {
  id: ContentFormat;
  label: string;
  channel: Channel;
  medium: FormatMedium;
  /** Number of slides/beats/frames the generator should produce. 1 for single assets. */
  segments: number;
  /** Words the body should land near — the generator is asked to hit this. */
  targetWords: number;
  /** Text formats are cheap and unlimited; media formats consume render capacity. */
  costTier: 'text' | 'image' | 'video';
  description: string;
}

export const FORMAT_PROFILES: Record<ContentFormat, FormatProfile> = {
  instagram_post: { id: 'instagram_post', label: 'Instagram post', channel: 'instagram', medium: 'text', segments: 1, targetWords: 110, costTier: 'text', description: 'Single-image caption with a hook, value and CTA.' },
  instagram_carousel: { id: 'instagram_carousel', label: 'Instagram carousel', channel: 'instagram', medium: 'image', segments: 7, targetWords: 220, costTier: 'image', description: 'Multi-slide teaching sequence ending on a conversion slide.' },
  reel_concept: { id: 'reel_concept', label: 'Reel concept', channel: 'instagram', medium: 'video', segments: 5, targetWords: 150, costTier: 'video', description: 'Shot-by-shot Reel treatment with on-screen text and audio direction.' },
  tiktok_script: { id: 'tiktok_script', label: 'TikTok script', channel: 'tiktok', medium: 'video', segments: 5, targetWords: 170, costTier: 'video', description: 'Spoken script with a three-second hook and beat timings.' },
  tiktok_caption: { id: 'tiktok_caption', label: 'TikTok caption', channel: 'tiktok', medium: 'text', segments: 1, targetWords: 45, costTier: 'text', description: 'Short caption engineered for comments and shares.' },
  facebook_post: { id: 'facebook_post', label: 'Facebook post', channel: 'facebook', medium: 'text', segments: 1, targetWords: 90, costTier: 'text', description: 'Conversational post with a link and a clear next step.' },
  linkedin_post: { id: 'linkedin_post', label: 'LinkedIn post', channel: 'linkedin', medium: 'text', segments: 1, targetWords: 200, costTier: 'text', description: 'Professional narrative post with a point of view.' },
  x_post: { id: 'x_post', label: 'X post', channel: 'x', medium: 'text', segments: 1, targetWords: 35, costTier: 'text', description: 'One tight idea under the character ceiling.' },
  x_thread: { id: 'x_thread', label: 'X thread', channel: 'x', medium: 'text', segments: 7, targetWords: 230, costTier: 'text', description: 'Sequenced thread where each post stands alone.' },
  threads_post: { id: 'threads_post', label: 'Threads post', channel: 'threads', medium: 'text', segments: 1, targetWords: 60, costTier: 'text', description: 'Casual, conversational post inviting replies.' },
  youtube_short_script: { id: 'youtube_short_script', label: 'YouTube Short script', channel: 'youtube', medium: 'video', segments: 5, targetWords: 160, costTier: 'video', description: 'Vertical short script with retention beats.' },
  pinterest_post: { id: 'pinterest_post', label: 'Pinterest pin', channel: 'pinterest', medium: 'image', segments: 1, targetWords: 60, costTier: 'image', description: 'Keyword-rich pin description with a destination.' },
  blog_article: { id: 'blog_article', label: 'Blog article', channel: 'blog', medium: 'text', segments: 6, targetWords: 1100, costTier: 'text', description: 'Structured long-form article with headings and internal links.' },
  newsletter: { id: 'newsletter', label: 'Newsletter', channel: 'email', medium: 'text', segments: 4, targetWords: 480, costTier: 'text', description: 'Editorial email that leads with usefulness.' },
  promotional_email: { id: 'promotional_email', label: 'Promotional email', channel: 'email', medium: 'text', segments: 3, targetWords: 260, costTier: 'text', description: 'Offer-led email with subject lines and a single CTA.' },
  advertisement: { id: 'advertisement', label: 'Advertisement', channel: 'facebook', medium: 'text', segments: 3, targetWords: 90, costTier: 'text', description: 'Primary text, headline and description variants for paid.' },
  quote_graphic: { id: 'quote_graphic', label: 'Quote graphic', channel: 'instagram', medium: 'image', segments: 1, targetWords: 40, costTier: 'image', description: 'Short quotable line rendered on brand.' },
  educational_graphic: { id: 'educational_graphic', label: 'Educational graphic', channel: 'instagram', medium: 'image', segments: 1, targetWords: 70, costTier: 'image', description: 'One concept explained visually.' },
  infographic: { id: 'infographic', label: 'Infographic', channel: 'pinterest', medium: 'image', segments: 5, targetWords: 160, costTier: 'image', description: 'Data or process laid out as a single tall visual.' },
  meme: { id: 'meme', label: 'Meme', channel: 'instagram', medium: 'image', segments: 1, targetWords: 25, costTier: 'image', description: 'On-brand humour tied to a real customer tension.' },
  short_video: { id: 'short_video', label: 'Short video', channel: 'tiktok', medium: 'video', segments: 6, targetWords: 180, costTier: 'video', description: 'Fully specified short-form video ready for rendering.' },
};

export function isContentFormat(value: string): value is ContentFormat {
  return (CONTENT_FORMATS as readonly string[]).includes(value);
}

export function formatProfile(format: ContentFormat): FormatProfile {
  return FORMAT_PROFILES[format];
}

export function formatsForChannel(channel: Channel): FormatProfile[] {
  return CONTENT_FORMATS.map((f) => FORMAT_PROFILES[f]).filter((p) => p.channel === channel);
}

export function textFormats(): FormatProfile[] {
  return CONTENT_FORMATS.map((f) => FORMAT_PROFILES[f]).filter((p) => p.costTier === 'text');
}
