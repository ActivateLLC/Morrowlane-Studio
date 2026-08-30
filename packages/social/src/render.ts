import type { Channel, ContentItem } from '@morrowlane/shared';
import { channelProfile, truncate } from '@morrowlane/shared';

/**
 * One content item can go to several networks. Each one wants it shaped differently,
 * and that shaping is the adapter's job, not the copywriter's.
 */
export interface RenderedPost {
  /** The single body a normal post carries. */
  text: string;
  /** Populated for channels that thread; each entry is one post in the chain. */
  chain: string[];
  hashtags: string[];
  linkUrl: string | null;
}

export function renderForProvider(content: ContentItem, channel: Channel): RenderedPost {
  const profile = channelProfile(channel);
  const hashtags = content.hashtags.slice(0, profile.maxHashtags).map((t) => (t.startsWith('#') ? t : `#${t}`));
  const tagBlock = hashtags.length > 0 ? `\n\n${hashtags.join(' ')}` : '';

  // Channels that do not linkify the body get the URL mentioned rather than pasted.
  const link = content.linkUrl;
  const bodyWithLink =
    link && profile.supportsLinkInBody && !content.body.includes(link)
      ? `${content.body}\n\n${link}`
      : content.body;

  if (profile.supportsThreads && content.segments.length > 1) {
    const chain = content.segments.map((segment, index) => {
      const suffix = index === content.segments.length - 1 ? tagBlock : '';
      return fit(`${segment.body}${suffix}`, profile.maxCharacters);
    });
    return { text: chain[0]!, chain, hashtags, linkUrl: link };
  }

  const text = fit(`${bodyWithLink}${tagBlock}`, profile.maxCharacters);
  return { text, chain: [text], hashtags, linkUrl: link };
}

function fit(text: string, max: number | null): string {
  if (max === null || text.length <= max) return text;
  return truncate(text, max);
}
