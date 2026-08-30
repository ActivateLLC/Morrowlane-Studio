import { describe, expect, it } from 'vitest';
import { crawlSinglePage, crawlSite } from './crawl.js';
import { discoverSite } from './discover.js';
import { extractPage } from './extract.js';
import { createStaticFetcher } from './fetcher.js';
import { ORCA_ORIGIN, ORCA_SITE } from './fixtures/orca.js';
import { scorePriority } from './priority.js';

const fetcher = createStaticFetcher(ORCA_SITE);

describe('discoverSite', () => {
  it('follows robots.txt to the sitemap index and through to child sitemaps', async () => {
    const discovery = await discoverSite(ORCA_ORIGIN, fetcher);
    expect(discovery.robotsUrl).toBe(`${ORCA_ORIGIN}/robots.txt`);
    expect(discovery.sitemapUrls).toContain(`${ORCA_ORIGIN}/sitemap-blog.xml`);
    expect(discovery.candidates).toContain(`${ORCA_ORIGIN}/blog/how-credit-scores-work`);
  });

  it('excludes paths robots.txt disallows', async () => {
    const discovery = await discoverSite(ORCA_ORIGIN, fetcher);
    expect(discovery.candidates).not.toContain(`${ORCA_ORIGIN}/account/settings`);
  });

  it('ranks the homepage and commercial pages above legal pages', async () => {
    const { candidates } = await discoverSite(ORCA_ORIGIN, fetcher);
    expect(candidates[0]).toBe(`${ORCA_ORIGIN}/`);
    expect(candidates.indexOf(`${ORCA_ORIGIN}/pricing`)).toBeLessThan(
      candidates.indexOf(`${ORCA_ORIGIN}/privacy`),
    );
  });

  it('falls back to a homepage link crawl when there is no sitemap', async () => {
    const bare = createStaticFetcher({ [`${ORCA_ORIGIN}/`]: ORCA_SITE[`${ORCA_ORIGIN}/`]! });
    const discovery = await discoverSite(ORCA_ORIGIN, bare);
    expect(discovery.source).toBe('crawl');
    expect(discovery.candidates).toContain(`${ORCA_ORIGIN}/pricing`);
  });
});

describe('scorePriority', () => {
  it('puts the homepage first and archives last', () => {
    expect(scorePriority('https://a.com/')).toBeGreaterThan(scorePriority('https://a.com/pricing'));
    expect(scorePriority('https://a.com/pricing')).toBeGreaterThan(scorePriority('https://a.com/blog'));
    expect(scorePriority('https://a.com/blog')).toBeGreaterThan(scorePriority('https://a.com/tag/credit'));
    expect(scorePriority('https://a.com/terms')).toBeLessThan(0);
  });
});

describe('extractPage', () => {
  it('pulls structured facts out of a product page', () => {
    const url = `${ORCA_ORIGIN}/products/credit-builder`;
    const page = extractPage(ORCA_SITE[url]!, url);
    expect(page.title).toContain('Credit Builder Account');
    expect(page.metaDescription).toContain('reports on-time payments');
    expect(page.structuredDataTypes).toContain('Product');
    expect(page.prices).toContain('$10 a month');
    expect(page.ctas).toContain('Get started');
    expect(page.images.some((i) => i.url.endsWith('credit-builder-card.png'))).toBe(true);
  });

  it('separates internal, external and social links', () => {
    const page = extractPage(ORCA_SITE[`${ORCA_ORIGIN}/`]!, `${ORCA_ORIGIN}/`);
    expect(page.socialLinks).toContain('https://instagram.com/orcacredit');
    expect(page.socialLinks).toContain('https://x.com/orcacredit');
    expect(page.internalLinks).toContain(`${ORCA_ORIGIN}/pricing`);
    expect(page.internalLinks.every((l) => l.startsWith(ORCA_ORIGIN))).toBe(true);
  });

  it('reads FAQs from both JSON-LD and accordion markup', () => {
    const url = `${ORCA_ORIGIN}/faq`;
    const page = extractPage(ORCA_SITE[url]!, url);
    // JSON-LD wins when present, so the schema question is the one captured.
    expect(page.faqs.map((f) => f.question)).toContain('Is Orca Credit a loan?');
    expect(page.faqs[0]?.answer).toContain('savings product');
  });

  it('reads testimonials with attribution from blockquotes and cards', () => {
    const url = `${ORCA_ORIGIN}/testimonials`;
    const page = extractPage(ORCA_SITE[url]!, url);
    expect(page.testimonials.length).toBeGreaterThanOrEqual(3);
    expect(page.testimonials[0]?.quote).toContain('74 points');
    expect(page.testimonials[0]?.attribution).toContain('Dana R.');
  });

  it('keeps saturated brand colors and discards greys', () => {
    const page = extractPage(ORCA_SITE[`${ORCA_ORIGIN}/`]!, `${ORCA_ORIGIN}/`);
    expect(page.colors).toContain('#1b6ef3');
    expect(page.colors).not.toContain('#111827');
  });

  it('reads a published date from meta tags', () => {
    const url = `${ORCA_ORIGIN}/blog/how-credit-scores-work`;
    expect(extractPage(ORCA_SITE[url]!, url).publishedAt).toBe('2026-07-02T09:00:00.000Z');
  });

  it('drops script and nav text from the page body', () => {
    const page = extractPage(ORCA_SITE[`${ORCA_ORIGIN}/`]!, `${ORCA_ORIGIN}/`);
    expect(page.text).not.toContain('schema.org');
    expect(page.text).toContain('Build credit without the guesswork');
  });
});

describe('crawlSite', () => {
  it('classifies each page type it fetches', async () => {
    const summary = await crawlSite(ORCA_ORIGIN, fetcher, { brandId: 'brd_test', maxPages: 40 });
    const byUrl = new Map(summary.pages.map((p) => [p.url, p]));

    expect(byUrl.get(`${ORCA_ORIGIN}/`)?.pageType).toBe('homepage');
    expect(byUrl.get(`${ORCA_ORIGIN}/products/credit-builder`)?.pageType).toBe('product');
    expect(byUrl.get(`${ORCA_ORIGIN}/services/credit-coaching`)?.pageType).toBe('service');
    expect(byUrl.get(`${ORCA_ORIGIN}/pricing`)?.pageType).toBe('pricing');
    expect(byUrl.get(`${ORCA_ORIGIN}/faq`)?.pageType).toBe('faq');
    expect(byUrl.get(`${ORCA_ORIGIN}/about`)?.pageType).toBe('about');
    expect(byUrl.get(`${ORCA_ORIGIN}/contact`)?.pageType).toBe('contact');
    expect(byUrl.get(`${ORCA_ORIGIN}/testimonials`)?.pageType).toBe('testimonial');
    expect(byUrl.get(`${ORCA_ORIGIN}/privacy`)?.pageType).toBe('legal');
    expect(byUrl.get(`${ORCA_ORIGIN}/blog/how-credit-scores-work`)?.pageType).toBe('article');
  });

  it('aggregates brand-level signals across the whole site', async () => {
    const summary = await crawlSite(ORCA_ORIGIN, fetcher, { brandId: 'brd_test' });
    expect(summary.socialLinks).toContain('https://instagram.com/orcacredit');
    expect(summary.colors[0]).toBe('#1b6ef3');
    expect(summary.source).toBe('sitemap');
  });

  it('respects the page budget and reports progress', async () => {
    const seen: string[] = [];
    const summary = await crawlSite(ORCA_ORIGIN, fetcher, {
      brandId: 'brd_test',
      maxPages: 3,
      concurrency: 1,
      onProgress: (p) => seen.push(p.url),
    });
    expect(summary.pages.length).toBeLessThanOrEqual(3);
    expect(seen.length).toBe(3);
  });

  it('deduplicates pages that render identical content', async () => {
    const duplicated = {
      ...ORCA_SITE,
      [`${ORCA_ORIGIN}/sitemap-pages.xml`]: ORCA_SITE[`${ORCA_ORIGIN}/sitemap-pages.xml`]!.replace(
        '</urlset>',
        `<url><loc>${ORCA_ORIGIN}/about-us</loc></url></urlset>`,
      ),
      [`${ORCA_ORIGIN}/about-us`]: ORCA_SITE[`${ORCA_ORIGIN}/about`]!,
    };
    const summary = await crawlSite(ORCA_ORIGIN, createStaticFetcher(duplicated), {
      brandId: 'brd_test',
      concurrency: 1,
    });
    const aboutPages = summary.pages.filter((p) => p.text.includes('make credit building understandable'));
    expect(aboutPages).toHaveLength(1);
  });
});

describe('crawlSinglePage', () => {
  it('returns one fully extracted page for URL Remix', async () => {
    const page = await crawlSinglePage(`${ORCA_ORIGIN}/blog/how-credit-scores-work`, fetcher, 'brd_test');
    expect(page?.pageType).toBe('article');
    expect(page?.wordCount).toBeGreaterThan(60);
    expect(page?.headings).toContain('Utilization');
  });

  it('returns null for a URL that cannot be fetched', async () => {
    expect(await crawlSinglePage(`${ORCA_ORIGIN}/missing`, fetcher, 'brd_test')).toBeNull();
  });
});
