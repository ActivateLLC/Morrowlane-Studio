import { resolveUrl } from '@morrowlane/shared';

export interface SitemapEntry {
  url: string;
  lastModified: string | null;
  priority: number | null;
}

export interface SitemapDocument {
  kind: 'index' | 'urlset' | 'feed' | 'unknown';
  /** Child sitemap URLs when `kind` is `index`. */
  children: string[];
  entries: SitemapEntry[];
}

function tagValues(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'gi');
  const out: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) out.push(match[1]!);
  return out;
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

function firstTagValue(block: string, tag: string): string | null {
  const values = tagValues(block, tag);
  return values.length > 0 ? decodeXml(values[0]!) : null;
}

/** Parses sitemaps, sitemap indexes, RSS and Atom feeds with one code path. */
export function parseSitemap(xml: string, baseUrl: string): SitemapDocument {
  const sitemapBlocks = tagValues(xml, 'sitemap');
  if (sitemapBlocks.length > 0) {
    const children = sitemapBlocks
      .map((block) => firstTagValue(block, 'loc'))
      .filter((loc): loc is string => Boolean(loc))
      .map((loc) => resolveUrl(baseUrl, loc))
      .filter((url): url is string => Boolean(url));
    return { kind: 'index', children, entries: [] };
  }

  const urlBlocks = tagValues(xml, 'url');
  if (urlBlocks.length > 0) {
    const entries = urlBlocks
      .map((block) => {
        const loc = firstTagValue(block, 'loc');
        const url = loc ? resolveUrl(baseUrl, loc) : null;
        if (!url) return null;
        const priorityRaw = firstTagValue(block, 'priority');
        const priority = priorityRaw ? Number.parseFloat(priorityRaw) : null;
        return {
          url,
          lastModified: firstTagValue(block, 'lastmod'),
          priority: priority !== null && Number.isFinite(priority) ? priority : null,
        } satisfies SitemapEntry;
      })
      .filter((entry): entry is SitemapEntry => entry !== null);
    return { kind: 'urlset', children: [], entries };
  }

  const feedEntries = parseFeed(xml, baseUrl);
  if (feedEntries.length > 0) return { kind: 'feed', children: [], entries: feedEntries };

  return { kind: 'unknown', children: [], entries: [] };
}

function parseFeed(xml: string, baseUrl: string): SitemapEntry[] {
  const entries: SitemapEntry[] = [];

  for (const item of tagValues(xml, 'item')) {
    const link = firstTagValue(item, 'link');
    const url = link ? resolveUrl(baseUrl, link) : null;
    if (url) entries.push({ url, lastModified: firstTagValue(item, 'pubDate'), priority: null });
  }

  for (const item of tagValues(xml, 'entry')) {
    // Atom puts the URL in a link element's href attribute.
    const href = /<link[^>]*href=["']([^"']+)["']/i.exec(item)?.[1];
    const url = href ? resolveUrl(baseUrl, href) : null;
    if (url) entries.push({ url, lastModified: firstTagValue(item, 'updated'), priority: null });
  }

  return entries;
}
