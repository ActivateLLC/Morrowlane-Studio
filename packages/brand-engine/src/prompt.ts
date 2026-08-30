import type { CrawledPage } from '@morrowlane/shared';
import { truncate } from '@morrowlane/shared';
import type { BrandSignals } from './signals.js';

/** The evidence pack the analyst reasons over. Grounded, capped, and page-attributed. */
export function buildBrandBrief(
  signals: BrandSignals,
  pages: CrawledPage[],
  websiteUrl: string,
): Record<string, unknown> {
  const byType = (type: CrawledPage['pageType']) => pages.filter((p) => p.pageType === type);

  const pageSummary = (page: CrawledPage) => ({
    url: page.url,
    type: page.pageType,
    title: page.title,
    headings: page.headings.slice(0, 8),
    excerpt: truncate(page.text, 1200),
  });

  return {
    websiteUrl,
    observed: {
      companyName: signals.companyName,
      oneLiner: signals.oneLiner,
      description: signals.description,
      products: signals.products.map((p) => ({
        name: p.name,
        kind: p.kind,
        description: truncate(p.description, 400),
        benefits: p.benefits,
        priceHint: p.priceHint,
        url: p.sourceUrls[0] ?? null,
      })),
      offers: signals.offers,
      faqs: signals.faqs.slice(0, 10),
      testimonials: signals.testimonials.slice(0, 6),
      ctas: signals.ctas,
      terminology: signals.terminology,
      socialLinks: signals.socialLinks,
      locations: signals.locations,
      colors: signals.visuals.colors,
    },
    pages: {
      homepage: byType('homepage').slice(0, 1).map(pageSummary),
      about: byType('about').slice(0, 2).map(pageSummary),
      pricing: byType('pricing').slice(0, 2).map(pageSummary),
      products: byType('product').slice(0, 6).map(pageSummary),
      services: byType('service').slice(0, 6).map(pageSummary),
      articles: byType('article').slice(0, 6).map((p) => ({ url: p.url, title: p.title })),
    },
    counts: {
      totalPages: pages.length,
      byType: Object.fromEntries(
        [...new Set(pages.map((p) => p.pageType))].map((type) => [type, byType(type).length]),
      ),
    },
  };
}

export const BRAND_ANALYST_SYSTEM_PROMPT = [
  'You are a brand analyst. You are given everything a crawler found on a company website and you produce the profile that every future piece of marketing will be written from.',
  '',
  'Rules:',
  '- Use only what is in the brief. If the site does not say who the customer is, infer it from the language on the page and say so in notes; never invent a fact.',
  '- Voice traits must be observable in the copy you were given, not aspirational.',
  '- Products come from product and service pages. Do not merge two distinct products into one.',
  '- Prohibited claims are claims this brand must never make in its category, not claims it currently makes.',
  '- Preferred CTAs must be phrasings the site actually uses.',
  '- Approved terminology is the brand\'s own vocabulary for its own things.',
  '',
  'Return JSON only, matching this shape:',
  '{"identity":{"companyName":string,"category":string,"oneLiner":string,"description":string,"audience":string[],"industries":string[],"locations":string[]},',
  '"voice":{"traits":string[],"readingLevel":number,"personSummary":string,"sampleSentences":string[],"avoid":string[]},',
  '"products":[{"name":string,"kind":"product"|"service","description":string,"benefits":string[],"audience":string[],"priceHint":string|null,"sourceUrls":string[],"imageUrls":string[],"claims":string[],"ctas":string[]}],',
  '"offers":string[],"terminology":string[],',
  '"rules":{"approvedTerminology":string[],"prohibitedTerminology":string[],"approvedClaims":string[],"prohibitedClaims":string[],"regulatoryNotes":string[],"preferredCtas":string[],"visualGuidelines":string[]},',
  '"notes":string[]}',
].join('\n');
