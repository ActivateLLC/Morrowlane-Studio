import type { DiscoveryResult } from '@morrowlane/shared';
import { createLogger, normalizeUrl, originOf, resolveUrl } from '@morrowlane/shared';
import type { Fetcher } from './fetcher.js';
import { isAllowed, parseRobots, type RobotsRules } from './robots.js';
import { parseSitemap } from './sitemap.js';
import { scorePriority } from './priority.js';

const log = createLogger('crawl-engine:discover');

const COMMON_SITEMAPS = ['/sitemap.xml', '/sitemap_index.xml', '/sitemap-index.xml', '/sitemap/sitemap.xml'];
const COMMON_FEEDS = ['/rss.xml', '/feed', '/feed.xml', '/atom.xml', '/blog/rss.xml', '/index.xml'];

export interface DiscoverOptions {
  maxCandidates?: number;
  /** Depth of sitemap-index recursion. Two levels covers essentially every site. */
  maxSitemapDepth?: number;
  respectRobots?: boolean;
}

export interface Discovery extends DiscoveryResult {
  robots: RobotsRules;
}

/**
 * Finds every URL worth reading, in priority order, before a single page is parsed.
 * Sitemaps first, then feeds, then a link crawl from the homepage as the fallback.
 */
export async function discoverSite(
  websiteUrl: string,
  fetcher: Fetcher,
  options: DiscoverOptions = {},
): Promise<Discovery> {
  const maxCandidates = options.maxCandidates ?? 300;
  const maxSitemapDepth = options.maxSitemapDepth ?? 2;
  const respectRobots = options.respectRobots ?? true;

  const origin = originOf(websiteUrl);
  if (!origin) throw new Error(`Not a usable website URL: ${websiteUrl}`);

  const notes: string[] = [];
  const found = new Map<string, number>();
  const add = (url: string, boost = 0) => {
    const normalized = normalizeUrl(url);
    if (!normalized || !normalized.startsWith(origin)) return;
    if (respectRobots && !isAllowed(robots, new URL(normalized).pathname)) return;
    const score = scorePriority(normalized) + boost;
    found.set(normalized, Math.max(found.get(normalized) ?? -Infinity, score));
  };

  let robots: RobotsRules = { sitemaps: [], disallow: [], allow: [], crawlDelaySeconds: null };
  let robotsUrl: string | null = null;

  const robotsDoc = await fetcher.fetch(`${origin}/robots.txt`);
  if (robotsDoc && robotsDoc.status === 200 && robotsDoc.body) {
    robots = parseRobots(robotsDoc.body);
    robotsUrl = `${origin}/robots.txt`;
    notes.push(`robots.txt declared ${robots.sitemaps.length} sitemap(s)`);
  } else {
    notes.push('no robots.txt found');
  }

  add(`${origin}/`, 100);

  const sitemapQueue: Array<{ url: string; depth: number }> = [];
  const seenSitemaps = new Set<string>();
  const sitemapUrls: string[] = [];
  const feedUrls: string[] = [];

  for (const declared of robots.sitemaps) {
    const url = resolveUrl(origin, declared);
    if (url) sitemapQueue.push({ url, depth: 0 });
  }
  for (const path of COMMON_SITEMAPS) sitemapQueue.push({ url: `${origin}${path}`, depth: 0 });

  let sitemapEntryCount = 0;
  while (sitemapQueue.length > 0) {
    const next = sitemapQueue.shift()!;
    if (seenSitemaps.has(next.url) || next.depth > maxSitemapDepth) continue;
    seenSitemaps.add(next.url);

    const doc = await fetcher.fetch(next.url);
    if (!doc || doc.status !== 200 || !doc.body.trim()) continue;

    const parsed = parseSitemap(doc.body, next.url);
    if (parsed.kind === 'unknown') continue;

    if (parsed.kind === 'index') {
      sitemapUrls.push(next.url);
      for (const child of parsed.children.slice(0, 50)) {
        sitemapQueue.push({ url: child, depth: next.depth + 1 });
      }
      continue;
    }

    if (parsed.kind === 'feed') feedUrls.push(next.url);
    else sitemapUrls.push(next.url);

    for (const entry of parsed.entries) {
      sitemapEntryCount += 1;
      // Sitemap priority is advisory but free; recency is a stronger signal.
      const recencyBoost = entry.lastModified && isRecent(entry.lastModified) ? 5 : 0;
      add(entry.url, (entry.priority ?? 0) * 4 + recencyBoost);
    }
  }

  for (const path of COMMON_FEEDS) {
    if (feedUrls.length >= 3) break;
    const url = `${origin}${path}`;
    if (seenSitemaps.has(url)) continue;
    const doc = await fetcher.fetch(url);
    if (!doc || doc.status !== 200 || !doc.body.trim()) continue;
    const parsed = parseSitemap(doc.body, url);
    if (parsed.kind !== 'feed') continue;
    feedUrls.push(url);
    for (const entry of parsed.entries) add(entry.url, 3);
  }

  let source: DiscoveryResult['source'] = 'sitemap';
  if (sitemapEntryCount === 0 && feedUrls.length === 0) source = 'crawl';
  else if (sitemapEntryCount === 0) source = 'feed';
  else if (feedUrls.length > 0) source = 'mixed';

  // No machine-readable index: read the homepage and follow its navigation.
  if (found.size <= 1) {
    notes.push('no sitemap or feed; falling back to a link crawl from the homepage');
    const home = await fetcher.fetch(`${origin}/`);
    if (home?.body) {
      for (const href of extractHrefs(home.body)) {
        const url = resolveUrl(`${origin}/`, href);
        if (url) add(url);
      }
    }
    source = 'crawl';
  } else {
    notes.push(`discovered ${found.size} candidate page(s) from ${sitemapUrls.length} sitemap(s)`);
  }

  const candidates = [...found.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, maxCandidates)
    .map(([url]) => url);

  log.info('discovery complete', { origin, candidates: candidates.length, source });

  return { origin, robotsUrl, sitemapUrls, feedUrls, candidates, source, notes, robots };
}

function isRecent(value: string): boolean {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return Date.now() - date.getTime() < 1000 * 60 * 60 * 24 * 120;
}

function extractHrefs(html: string): string[] {
  const out: string[] = [];
  const regex = /<a\b[^>]*href=["']([^"'#][^"']*)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) out.push(match[1]!);
  return out;
}
