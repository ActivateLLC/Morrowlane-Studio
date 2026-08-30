import { createHash } from 'node:crypto';
import type { CrawledPage } from '@morrowlane/shared';
import { createLogger, newId, nowIso, wordCount } from '@morrowlane/shared';
import { classifyPage } from './classify.js';
import { discoverSite, type DiscoverOptions } from './discover.js';
import { extractPage } from './extract.js';
import type { Fetcher } from './fetcher.js';

const log = createLogger('crawl-engine:crawl');

export interface CrawlOptions extends DiscoverOptions {
  brandId: string;
  /** Hard ceiling on pages fetched. Crawl budget, not a quality setting. */
  maxPages?: number;
  concurrency?: number;
  onProgress?: (progress: { fetched: number; total: number; url: string }) => void;
}

export interface CrawlSummary {
  origin: string;
  pages: CrawledPage[];
  discovered: number;
  fetched: number;
  failed: string[];
  sitemapUrls: string[];
  feedUrls: string[];
  source: string;
  notes: string[];
  socialLinks: string[];
  colors: string[];
}

export async function crawlSite(
  websiteUrl: string,
  fetcher: Fetcher,
  options: CrawlOptions,
): Promise<CrawlSummary> {
  const maxPages = options.maxPages ?? 60;
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 4, 10));

  const discovery = await discoverSite(websiteUrl, fetcher, options);
  const queue = discovery.candidates.slice(0, maxPages);
  const pages: CrawledPage[] = [];
  const failed: string[] = [];
  const socialLinks = new Set<string>();
  const colorCounts = new Map<string, number>();
  const seenHashes = new Set<string>();

  let cursor = 0;
  let fetched = 0;

  const worker = async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      const url = queue[index];
      if (url === undefined) return;

      const doc = await fetcher.fetch(url);
      fetched += 1;
      options.onProgress?.({ fetched, total: queue.length, url });

      if (!doc || doc.status !== 200 || !doc.body.trim()) {
        failed.push(url);
        continue;
      }
      if (!/text\/html|xhtml/i.test(doc.contentType) && !/<html/i.test(doc.body)) {
        continue;
      }

      const extracted = extractPage(doc.body, doc.finalUrl);
      const text = extracted.text;
      const hash = createHash('sha256').update(text.slice(0, 20_000)).digest('hex').slice(0, 32);

      // Templated pages (tag archives, near-duplicate location pages) add noise, not knowledge.
      if (text.length > 200 && seenHashes.has(hash)) continue;
      seenHashes.add(hash);

      const words = wordCount(text);
      const { pageType, confidence } = classifyPage({
        url: doc.finalUrl,
        origin: discovery.origin,
        title: extracted.title,
        headings: extracted.headings,
        text,
        structuredDataTypes: extracted.structuredDataTypes,
        wordCount: words,
        hasPublishedDate: extracted.publishedAt !== null,
      });

      for (const link of extracted.socialLinks) socialLinks.add(link);
      for (const [rank, color] of extracted.colors.entries()) {
        // Colors seen on many pages, high in the stylesheet, are the real brand palette.
        colorCounts.set(color, (colorCounts.get(color) ?? 0) + (8 - Math.min(rank, 7)));
      }

      pages.push({
        id: newId('page'),
        brandId: options.brandId,
        url: doc.finalUrl,
        canonicalUrl: extracted.canonicalUrl,
        pageType,
        pageTypeConfidence: confidence,
        title: extracted.title,
        metaDescription: extracted.metaDescription,
        headings: extracted.headings,
        text,
        wordCount: words,
        language: extracted.language,
        images: extracted.images,
        internalLinks: extracted.internalLinks,
        externalLinks: extracted.externalLinks,
        socialLinks: extracted.socialLinks,
        faqs: extracted.faqs,
        testimonials: extracted.testimonials,
        ctas: extracted.ctas,
        prices: extracted.prices,
        structuredData: extracted.structuredData,
        publishedAt: extracted.publishedAt,
        fetchedAt: nowIso(),
        contentHash: hash,
      });
    }
  };

  await Promise.all(Array.from({ length: concurrency }, worker));

  const colors = [...colorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([hex]) => hex);

  log.info('crawl complete', { origin: discovery.origin, pages: pages.length, failed: failed.length });

  return {
    origin: discovery.origin,
    pages,
    discovered: discovery.candidates.length,
    fetched,
    failed,
    sitemapUrls: discovery.sitemapUrls,
    feedUrls: discovery.feedUrls,
    source: discovery.source,
    notes: discovery.notes,
    socialLinks: [...socialLinks],
    colors,
  };
}

/** Fetches and extracts a single page — the entry point for URL Remix. */
export async function crawlSinglePage(
  url: string,
  fetcher: Fetcher,
  brandId: string,
): Promise<CrawledPage | null> {
  const doc = await fetcher.fetch(url);
  if (!doc || doc.status !== 200 || !doc.body.trim()) return null;

  const extracted = extractPage(doc.body, doc.finalUrl);
  const words = wordCount(extracted.text);
  const { pageType, confidence } = classifyPage({
    url: doc.finalUrl,
    origin: new URL(doc.finalUrl).origin,
    title: extracted.title,
    headings: extracted.headings,
    text: extracted.text,
    structuredDataTypes: extracted.structuredDataTypes,
    wordCount: words,
    hasPublishedDate: extracted.publishedAt !== null,
  });

  return {
    id: newId('page'),
    brandId,
    url: doc.finalUrl,
    canonicalUrl: extracted.canonicalUrl,
    pageType,
    pageTypeConfidence: confidence,
    title: extracted.title,
    metaDescription: extracted.metaDescription,
    headings: extracted.headings,
    text: extracted.text,
    wordCount: words,
    language: extracted.language,
    images: extracted.images,
    internalLinks: extracted.internalLinks,
    externalLinks: extracted.externalLinks,
    socialLinks: extracted.socialLinks,
    faqs: extracted.faqs,
    testimonials: extracted.testimonials,
    ctas: extracted.ctas,
    prices: extracted.prices,
    structuredData: extracted.structuredData,
    publishedAt: extracted.publishedAt,
    fetchedAt: nowIso(),
    contentHash: createHash('sha256').update(extracted.text.slice(0, 20_000)).digest('hex').slice(0, 32),
  };
}
