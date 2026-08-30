import { ORCA_ORIGIN, ORCA_SITE, crawlSite, createStaticFetcher } from '@morrowlane/crawl-engine';
import { LOCAL_COMPOSERS, createGateway, generateContent } from '@morrowlane/content-engine';
import type { BrandBrain, CrawledPage } from '@morrowlane/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildBrandBrain, preserveLockedFields, scoreCompleteness } from './build.js';
import { detectCompliancePresets } from './compliance.js';
import { BRAND_COMPOSERS } from './registry.js';
import { extractSignals } from './signals.js';

const gateway = createGateway({ composers: { ...LOCAL_COMPOSERS, ...BRAND_COMPOSERS } });

let pages: CrawledPage[];
let colors: string[];
let socialLinks: string[];
let brain: BrandBrain;

beforeAll(async () => {
  const summary = await crawlSite(ORCA_ORIGIN, createStaticFetcher(ORCA_SITE), { brandId: 'brd_orca' });
  pages = summary.pages;
  colors = summary.colors;
  socialLinks = summary.socialLinks;
  brain = await buildBrandBrain(gateway, {
    brandId: 'brd_orca',
    websiteUrl: ORCA_ORIGIN,
    pages,
    siteColors: colors,
    siteSocialLinks: socialLinks,
  });
});

describe('extractSignals', () => {
  it('recovers the company name from Organization schema rather than the page title', () => {
    const signals = extractSignals(pages, ORCA_ORIGIN, colors);
    expect(signals.companyName).toBe('Orca Credit');
  });

  it('builds one product entry per product and service page', () => {
    const signals = extractSignals(pages, ORCA_ORIGIN, colors);
    const names = signals.products.map((p) => p.name);
    expect(names).toContain('Credit Builder Account');
    expect(names).toContain('Credit Coaching');
    expect(signals.products.find((p) => p.name === 'Credit Coaching')?.kind).toBe('service');
  });

  it('attaches the price the crawler saw on the product page', () => {
    const signals = extractSignals(pages, ORCA_ORIGIN, colors);
    // The visible page price wins over schema markup: it is what a customer actually sees.
    expect(signals.products.find((p) => p.name === 'Credit Builder Account')?.priceHint).toBe('$10 a month');
  });

  it('ranks a CTA that appears sitewide above a one-off', () => {
    const signals = extractSignals(pages, ORCA_ORIGIN, colors);
    expect(signals.ctas[0]).toBe('Get started');
  });

  it('collects FAQs and testimonials from across the site', () => {
    const signals = extractSignals(pages, ORCA_ORIGIN, colors);
    expect(signals.faqs.length).toBeGreaterThanOrEqual(1);
    expect(signals.testimonials.some((t) => t.quote.includes('74 points'))).toBe(true);
  });
});

describe('compliance presets', () => {
  it('detects consumer finance from the site language', () => {
    expect(detectCompliancePresets('we help you raise your credit score with the bureaus').map((p) => p.id)).toEqual([
      'consumer_finance',
    ]);
  });

  it('does not fire on unrelated businesses', () => {
    expect(detectCompliancePresets('we cater weddings and private events')).toEqual([]);
  });
});

describe('buildBrandBrain', () => {
  it('identifies the company and its category', () => {
    expect(brain.identity.companyName).toBe('Orca Credit');
    expect(brain.identity.category).toBe('Financial technology');
    expect(brain.identity.audience).toContain('consumers building credit');
  });

  it('carries every product through with its source URL and price', () => {
    const builder = brain.products.find((p) => p.name === 'Credit Builder Account');
    expect(builder?.priceHint).toBe('$10 a month');
    expect(builder?.sourceUrls).toContain(`${ORCA_ORIGIN}/products/credit-builder`);
    expect(brain.products.map((p) => p.name)).toContain('Credit Coaching');
  });

  it('loads the regulated-category rules automatically', () => {
    expect(brain.rules.prohibitedClaims).toContain('guaranteed approval');
    expect(brain.rules.regulatoryNotes.some((n) => n.includes('score increase'))).toBe(true);
    expect(brain.identity.industries).toContain('Consumer finance and credit');
  });

  it('prefers the CTAs the site actually uses', () => {
    expect(brain.rules.preferredCtas).toContain('Get started');
  });

  it('keeps the brand palette and social profiles', () => {
    expect(brain.visuals.colors[0]).toBe('#1b6ef3');
    expect(brain.socialLinks).toContain('https://instagram.com/orcacredit');
  });

  it('scores completeness from what it actually found', () => {
    expect(brain.completeness).toBeGreaterThan(0.7);
    expect(brain.completeness).toBeLessThanOrEqual(1);
  });

  it('starts at version 1 and increments on re-analysis', async () => {
    expect(brain.version).toBe(1);
    const second = await buildBrandBrain(gateway, {
      brandId: 'brd_orca',
      websiteUrl: ORCA_ORIGIN,
      pages,
      siteColors: colors,
      siteSocialLinks: socialLinks,
      previous: brain,
    });
    expect(second.version).toBe(2);
  });
});

describe('preserveLockedFields', () => {
  it('keeps human edits through a regeneration', () => {
    const edited: BrandBrain = {
      ...structuredClone(brain),
      identity: { ...brain.identity, oneLiner: 'Credit building that finally makes sense.' },
      lockedFields: ['identity.oneLiner'],
    };
    const regenerated = preserveLockedFields(structuredClone(brain), edited);
    expect(regenerated.identity.oneLiner).toBe('Credit building that finally makes sense.');
    expect(regenerated.lockedFields).toEqual(['identity.oneLiner']);
  });

  it('leaves unlocked fields free to change', () => {
    const edited: BrandBrain = { ...structuredClone(brain), lockedFields: ['identity.oneLiner'] };
    const next = structuredClone(brain);
    next.identity.category = 'Something else';
    expect(preserveLockedFields(next, edited).identity.category).toBe('Something else');
  });
});

describe('scoreCompleteness', () => {
  it('reports a low score for an empty profile', () => {
    const empty: BrandBrain = {
      ...structuredClone(brain),
      identity: { companyName: '', category: '', oneLiner: '', description: '', audience: [], industries: [], locations: [] },
      voice: { traits: [], readingLevel: 3, personSummary: '', sampleSentences: [], avoid: [] },
      products: [],
      faqs: [],
      testimonials: [],
      offers: [],
      socialLinks: [],
      visuals: { logoUrls: [], colors: [], imageUrls: [], fontHints: [] },
      rules: { ...brain.rules, preferredCtas: [] },
    };
    expect(scoreCompleteness(empty)).toBe(0);
  });
});

describe('generation grounded in the Brand Brain', () => {
  it('writes posts that use the brand\'s own facts', async () => {
    const { items } = await generateContent(gateway, {
      brain,
      format: 'instagram_post',
      count: 5,
      instruction: 'Promote our credit builder.',
      productName: 'Credit Builder Account',
    });

    expect(items).toHaveLength(5);
    const corpus = items.map((i) => `${i.hook} ${i.body}`).join(' ');
    expect(corpus).toContain('Credit Builder Account');
    // Every post must carry a next step drawn from the site's real CTAs.
    expect(items.every((i) => i.cta !== null)).toBe(true);
    expect(items.every((i) => i.lineage.instruction === 'Promote our credit builder.')).toBe(true);
  });

  it('produces distinct angles rather than five copies of one post', async () => {
    const { items } = await generateContent(gateway, { brain, format: 'instagram_post', count: 5 });
    expect(new Set(items.map((i) => i.hook)).size).toBe(5);
  });

  it('never exceeds the channel character limit', async () => {
    const { items } = await generateContent(gateway, { brain, format: 'x_post', count: 6 });
    for (const item of items) {
      const rendered = item.hashtags.length > 0 ? `${item.body}\n\n${item.hashtags.join(' ')}` : item.body;
      expect(rendered.length).toBeLessThanOrEqual(280);
      expect(item.violations.filter((v) => v.rule === 'length')).toEqual([]);
    }
  });

  it('builds the requested number of carousel slides and converts on the last one', async () => {
    const { items } = await generateContent(gateway, { brain, format: 'instagram_carousel', count: 1 });
    const carousel = items[0]!;
    expect(carousel.segments).toHaveLength(7);
    expect(carousel.segments.at(-1)?.heading).toBe('Next step');
    expect(carousel.segments.every((s) => s.body.trim().length > 0)).toBe(true);
  });

  it('flags content that breaks a brand rule instead of publishing it', async () => {
    const risky: BrandBrain = {
      ...structuredClone(brain),
      products: [
        {
          ...brain.products[0]!,
          name: 'Fast Loan',
          benefits: ['guaranteed approval for every applicant'],
          description: 'A loan with guaranteed approval.',
        },
      ],
    };
    const { items } = await generateContent(gateway, { brain: risky, format: 'instagram_post', count: 4 });
    const flagged = items.filter((i) => i.status === 'needs_review');
    expect(flagged.length).toBeGreaterThan(0);
    expect(flagged.every((i) => i.violations.some((v) => v.severity === 'error'))).toBe(true);
  });

  it('is deterministic for the same request when running locally', async () => {
    const first = await generateContent(gateway, { brain, format: 'linkedin_post', count: 3, topic: 'utilization' });
    const second = await generateContent(gateway, { brain, format: 'linkedin_post', count: 3, topic: 'utilization' });
    expect(first.items.map((i) => i.body)).toEqual(second.items.map((i) => i.body));
  });
});
