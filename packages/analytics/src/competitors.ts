import type { CompetitorSignal, CrawledPage } from '@morrowlane/shared';
import { keywords, nowIso, truncate } from '@morrowlane/shared';

/**
 * Competitor monitoring is a diff between two crawls, not a scrape. What matters is
 * what changed since last time — new pages, new offers, a shift in how they position.
 */

export interface CompetitorSnapshot {
  /** url → content hash, from the previous crawl. */
  pageHashes: Record<string, string>;
  offers: string[];
  positioning: string;
  articleCount: number;
  capturedAt: string;
}

export function snapshotFrom(pages: CrawledPage[]): CompetitorSnapshot {
  const home = pages.find((page) => page.pageType === 'homepage');
  return {
    pageHashes: Object.fromEntries(pages.map((page) => [page.url, page.contentHash])),
    offers: [...new Set(pages.flatMap((page) => page.prices))].slice(0, 20),
    positioning: truncate(home?.metaDescription ?? home?.headings[0] ?? '', 300),
    articleCount: pages.filter((page) => page.pageType === 'article').length,
    capturedAt: nowIso(),
  };
}

export function diffSnapshots(
  previous: CompetitorSnapshot | null,
  current: CompetitorSnapshot,
  pages: CrawledPage[],
): CompetitorSignal[] {
  const observedAt = nowIso();
  if (!previous) return [];

  const signals: CompetitorSignal[] = [];
  const byUrl = new Map(pages.map((page) => [page.url, page]));

  for (const [url, hash] of Object.entries(current.pageHashes)) {
    const page = byUrl.get(url);
    if (!(url in previous.pageHashes)) {
      signals.push({
        observedAt,
        kind: page?.pageType === 'article' ? 'new_article' : 'new_page',
        summary: `New ${page?.pageType ?? 'page'}: ${page?.title ?? url}`,
        url,
        themes: themesFor(page),
      });
    } else if (previous.pageHashes[url] !== hash && page && page.pageType !== 'article') {
      signals.push({
        observedAt,
        kind: 'positioning_change',
        summary: `Rewrote ${page.pageType} page: ${page.title ?? url}`,
        url,
        themes: themesFor(page),
      });
    }
  }

  const newOffers = current.offers.filter((offer) => !previous.offers.includes(offer));
  if (newOffers.length > 0) {
    signals.push({
      observedAt,
      kind: 'offer_change',
      summary: `Pricing changed: ${newOffers.slice(0, 4).join(', ')}`,
      url: null,
      themes: ['pricing'],
    });
  }

  if (previous.positioning && current.positioning && previous.positioning !== current.positioning) {
    signals.push({
      observedAt,
      kind: 'positioning_change',
      summary: `Homepage positioning changed to: ${truncate(current.positioning, 160)}`,
      url: null,
      themes: keywords(current.positioning, 4),
    });
  }

  // A publishing surge is a strategy change even when no single page is notable.
  const articleDelta = current.articleCount - previous.articleCount;
  if (articleDelta >= 3) {
    signals.push({
      observedAt,
      kind: 'cadence_change',
      summary: `Published ${articleDelta} new articles since the last check.`,
      url: null,
      themes: [...new Set(pages.filter((p) => p.pageType === 'article').flatMap((p) => themesFor(p)))].slice(0, 5),
    });
  }

  return signals;
}

function themesFor(page: CrawledPage | undefined): string[] {
  if (!page) return [];
  return keywords(`${page.title ?? ''} ${page.headings.slice(0, 5).join(' ')}`, 4);
}
