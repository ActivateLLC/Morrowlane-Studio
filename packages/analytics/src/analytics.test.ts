import type { AttributionEvent, BrandBrain, Competitor, ContentItem, CrawledPage } from '@morrowlane/shared';
import { newId, nowIso } from '@morrowlane/shared';
import { describe, expect, it } from 'vitest';
import { conversionRates, performanceByContent, recordEvent, summariseFunnel } from './attribution.js';
import { diffSnapshots, snapshotFrom } from './competitors.js';
import { applyInsights, computeInsights } from './insights.js';
import { buildOpportunities } from './opportunities.js';
import { evaluateTrends, scoreTrendRelevance } from './trends.js';

function content(over: Partial<ContentItem> = {}): ContentItem {
  return {
    id: newId('content'),
    brandId: 'brd_1',
    campaignId: null,
    campaignPhaseId: null,
    format: 'instagram_post',
    channel: 'instagram',
    status: 'published',
    title: 'Title',
    hook: 'Hook',
    body: 'Body',
    segments: [],
    hashtags: [],
    cta: 'Get started',
    linkUrl: null,
    mediaAssetIds: [],
    topics: ['credit'],
    lineage: { sourceType: 'brand', sourceUrl: null, sourceId: null, instruction: null, parentContentId: null, appliedInsightIds: [] },
    violations: [],
    model: 'local',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    ...over,
  };
}

function events(contentId: string, counts: Partial<Record<AttributionEvent['stage'], number>>): AttributionEvent[] {
  return Object.entries(counts).flatMap(([stage, value]) =>
    value === undefined
      ? []
      : [
          recordEvent({
            brandId: 'brd_1',
            contentId,
            scheduledPostId: null,
            stage: stage as AttributionEvent['stage'],
            value,
          }),
        ],
  );
}

describe('funnel', () => {
  it('totals events by stage', () => {
    const totals = summariseFunnel(events('c1', { impression: 1000, click: 40, lead: 4, revenue: 900 }));
    expect(totals.impression).toBe(1000);
    expect(totals.revenue).toBe(900);
    expect(totals.customer).toBe(0);
  });

  it('reports conversion between adjacent stages and skips revenue', () => {
    const rates = conversionRates(summariseFunnel(events('c1', { impression: 1000, engagement: 100, click: 50 })));
    expect(rates.find((r) => r.to === 'engagement')?.rate).toBe(0.1);
    expect(rates.find((r) => r.to === 'click')?.rate).toBe(0.5);
    expect(rates.some((r) => r.to === 'revenue')).toBe(false);
  });

  it('reports zero rather than dividing by zero', () => {
    expect(conversionRates(summariseFunnel([])).every((r) => r.rate === 0)).toBe(true);
  });
});

describe('performanceByContent', () => {
  it('attributes events reaching it only through a post id', () => {
    const item = content();
    const post = {
      id: newId('schedule'),
      brandId: 'brd_1',
      contentId: item.id,
      connectionId: null,
      channel: 'instagram' as const,
      scheduledFor: nowIso(),
      status: 'published' as const,
      attempts: 1,
      lastError: null,
      externalPostId: 'x',
      externalUrl: null,
      publishedAt: nowIso(),
    };
    const rows = performanceByContent(
      [item],
      [post],
      [recordEvent({ brandId: 'brd_1', contentId: null, scheduledPostId: post.id, stage: 'click', value: 12 })],
    );
    expect(rows[0]?.totals.click).toBe(12);
  });

  it('never reports more qualified visits than clicks', () => {
    const item = content();
    const rows = performanceByContent([item], [], events(item.id, { click: 5, visit: 50, impression: 100 }));
    expect(rows[0]?.qualifiedVisits).toBe(5);
  });
});

describe('computeInsights', () => {
  const carousels = Array.from({ length: 6 }, () => content({ format: 'instagram_carousel' }));
  const graphics = Array.from({ length: 6 }, () => content({ format: 'quote_graphic' }));

  const performance = [
    ...carousels.map((item) => ({
      contentId: item.id,
      format: item.format,
      channel: item.channel,
      topics: item.topics,
      campaignId: null,
      totals: { impression: 1000, engagement: 100, click: 60, visit: 54, lead: 6, customer: 1, revenue: 300 },
      qualifiedVisits: 54,
      revenuePerImpression: 0.3,
    })),
    ...graphics.map((item) => ({
      contentId: item.id,
      format: item.format,
      channel: item.channel,
      topics: item.topics,
      campaignId: null,
      totals: { impression: 1000, engagement: 40, click: 22, visit: 20, lead: 1, customer: 0, revenue: 40 },
      qualifiedVisits: 20,
      revenuePerImpression: 0.04,
    })),
  ];

  it('states the comparison the way the spec describes it', () => {
    const insights = computeInsights('brd_1', performance);
    const formatInsight = insights.find((i) => i.dimension === 'format');
    expect(formatInsight?.statement).toBe(
      'Instagram carousels generate 2.7× more qualified traffic than quote graphics.',
    );
    expect(formatInsight?.lift).toBe(2.7);
    expect(formatInsight?.sampleSize).toBe(12);
  });

  it('stays silent when there is not enough data', () => {
    expect(computeInsights('brd_1', performance.slice(0, 3))).toEqual([]);
  });

  it('needs both sides of a comparison to clear the sample floor', () => {
    const lopsided = [...performance.slice(0, 6), ...performance.slice(6, 8)];
    expect(computeInsights('brd_1', lopsided, { minSampleSize: 4 }).some((i) => i.dimension === 'format')).toBe(false);
  });

  it('ignores differences too small to act on', () => {
    const flat = performance.map((row) => ({ ...row, qualifiedVisits: 30 }));
    expect(computeInsights('brd_1', flat)).toEqual([]);
  });

  it('scores confidence between zero and the cap', () => {
    for (const insight of computeInsights('brd_1', performance)) {
      expect(insight.confidence).toBeGreaterThan(0);
      expect(insight.confidence).toBeLessThanOrEqual(0.95);
    }
  });

  it('can compare on other metrics', () => {
    const revenue = computeInsights('brd_1', performance, { metric: 'revenue' });
    expect(revenue[0]?.statement).toContain('more revenue than');
  });
});

describe('applyInsights', () => {
  it('turns accepted insights into generation preferences', () => {
    const insights = computeInsights('brd_1', [
      ...Array.from({ length: 6 }, () => ({
        contentId: newId('content'),
        format: 'instagram_carousel' as const,
        channel: 'instagram' as const,
        topics: ['credit'],
        campaignId: null,
        totals: { impression: 1000, engagement: 100, click: 60, visit: 54, lead: 6, customer: 1, revenue: 300 },
        qualifiedVisits: 54,
        revenuePerImpression: 0.3,
      })),
      ...Array.from({ length: 6 }, () => ({
        contentId: newId('content'),
        format: 'quote_graphic' as const,
        channel: 'instagram' as const,
        topics: ['credit'],
        campaignId: null,
        totals: { impression: 1000, engagement: 40, click: 22, visit: 20, lead: 1, customer: 0, revenue: 40 },
        qualifiedVisits: 20,
        revenuePerImpression: 0.04,
      })),
    ]).map((insight) => ({ ...insight, applied: insight.dimension === 'format' }));

    const preferences = applyInsights(insights);
    expect(preferences.preferredFormats).toContain('instagram_carousel');
    expect(preferences.guidance[0]).toContain('2.7×');
    expect(preferences.appliedInsightIds).toHaveLength(1);
  });

  it('ignores insights the user has not applied', () => {
    expect(applyInsights([]).preferredFormats).toEqual([]);
  });
});

const brain: BrandBrain = {
  brandId: 'brd_1',
  version: 1,
  identity: {
    companyName: 'Orca Credit',
    category: 'Financial technology',
    oneLiner: 'Build credit without the guesswork',
    description: 'Orca Credit helps consumers build credit with a builder account and coaching.',
    audience: ['consumers building credit'],
    industries: ['Consumer finance and credit'],
    locations: [],
  },
  voice: { traits: ['clear'], readingLevel: 2, personSummary: '', sampleSentences: [], avoid: [] },
  products: [
    {
      id: 'prd_1',
      name: 'Credit Builder Account',
      kind: 'product',
      description: 'Reports on-time payments to all three credit bureaus.',
      benefits: ['Reports to all three bureaus'],
      audience: [],
      priceHint: '$10 a month',
      sourceUrls: ['https://orcacredit.example/products/credit-builder'],
      imageUrls: [],
      claims: [],
      ctas: [],
    },
  ],
  offers: [],
  faqs: [{ question: 'Does this hurt my credit?', answer: 'No hard credit check is required.' }],
  testimonials: [],
  visuals: { logoUrls: [], colors: [], imageUrls: [], fontHints: [] },
  rules: {
    approvedTerminology: ['credit builder'],
    prohibitedTerminology: [],
    approvedClaims: [],
    prohibitedClaims: [],
    regulatoryNotes: [],
    preferredCtas: ['Get started'],
    visualGuidelines: [],
  },
  terminology: ['credit builder', 'credit score'],
  socialLinks: [],
  notes: [],
  completeness: 0.8,
  sourcePageCount: 11,
  generatedAt: nowIso(),
  lockedFields: [],
};

describe('trend relevance', () => {
  it('scores an on-brand topic highly', () => {
    expect(
      scoreTrendRelevance(brain, {
        topic: 'credit score changes',
        source: 'search',
        summary: 'Consumers are searching for how credit score models are changing.',
        momentum: 0.8,
      }),
    ).toBeGreaterThan(0.4);
  });

  it('scores an unrelated topic near zero', () => {
    expect(
      scoreTrendRelevance(brain, {
        topic: 'sourdough starter recipes',
        source: 'social',
        summary: 'Home bakers are sharing sourdough hydration ratios.',
        momentum: 0.9,
      }),
    ).toBeLessThan(0.2);
  });

  it('drops irrelevant trends however hot they are', () => {
    const trends = evaluateTrends('brd_1', brain, [
      { topic: 'credit score changes', source: 'search', summary: 'Credit score model updates.', momentum: 0.4 },
      { topic: 'sourdough starter', source: 'social', summary: 'Baking bread at home.', momentum: 1 },
    ]);
    expect(trends.map((t) => t.topic)).toEqual(['credit score changes']);
  });
});

describe('competitor diffing', () => {
  const page = (url: string, over: Partial<CrawledPage> = {}): CrawledPage => ({
    id: newId('page'),
    brandId: 'brd_x',
    url,
    canonicalUrl: null,
    pageType: 'article',
    pageTypeConfidence: 0.9,
    title: 'First-time homebuyer credit guide',
    metaDescription: null,
    headings: ['What lenders look for'],
    text: 'text',
    wordCount: 100,
    language: 'en',
    images: [],
    internalLinks: [],
    externalLinks: [],
    socialLinks: [],
    faqs: [],
    testimonials: [],
    ctas: [],
    prices: [],
    structuredData: [],
    publishedAt: null,
    fetchedAt: nowIso(),
    contentHash: 'hash-1',
    ...over,
  });

  it('returns nothing on the first ever crawl', () => {
    const pages = [page('https://rival.com/a')];
    expect(diffSnapshots(null, snapshotFrom(pages), pages)).toEqual([]);
  });

  it('detects new articles, rewrites and pricing changes', () => {
    const before = [page('https://rival.com/a', { pageType: 'pricing', prices: ['$9'] })];
    const previous = snapshotFrom(before);

    const after = [
      page('https://rival.com/a', { pageType: 'pricing', prices: ['$12'], contentHash: 'hash-2' }),
      page('https://rival.com/b'),
    ];
    const signals = diffSnapshots(previous, snapshotFrom(after), after);

    expect(signals.map((s) => s.kind)).toEqual(expect.arrayContaining(['new_article', 'positioning_change', 'offer_change']));
  });

  it('flags a publishing surge', () => {
    const previous = snapshotFrom([page('https://rival.com/a')]);
    const after = ['a', 'b', 'c', 'd', 'e'].map((slug) => page(`https://rival.com/${slug}`));
    const signals = diffSnapshots(previous, snapshotFrom(after), after);
    expect(signals.some((s) => s.kind === 'cadence_change')).toBe(true);
  });
});

describe('buildOpportunities', () => {
  const competitors: Competitor[] = [
    {
      id: 'cpt_1',
      brandId: 'brd_1',
      name: 'Rival One',
      websiteUrl: 'https://rival1.com',
      lastCheckedAt: nowIso(),
      signals: [{ observedAt: nowIso(), kind: 'new_article', summary: 'Posted a homebuyer guide', url: null, themes: ['first-time homebuyer education'] }],
    },
    {
      id: 'cpt_2',
      brandId: 'brd_1',
      name: 'Rival Two',
      websiteUrl: 'https://rival2.com',
      lastCheckedAt: nowIso(),
      signals: [{ observedAt: nowIso(), kind: 'new_article', summary: 'Posted a homebuyer explainer', url: null, themes: ['first-time homebuyer education'] }],
    },
  ];

  const ownPages = [
    { url: 'https://orcacredit.example/blog/first-time-homebuyer-credit', title: 'Credit for first-time homebuyers', pageType: 'article', topics: ['homebuyer'] },
    { url: 'https://orcacredit.example/blog/how-credit-scores-work', title: 'How credit scores work', pageType: 'article', topics: ['credit'] },
  ];

  it('produces the spec\'s competitor recommendation with a one-click action', () => {
    const opportunities = buildOpportunities({
      brain,
      competitors,
      trends: [],
      ownPages,
      publishedContent: [],
      performance: [],
    });
    const competitorOpportunity = opportunities.find((o) => o.kind === 'competitor');
    expect(competitorOpportunity?.headline).toContain('2 competitors are increasing content around');
    expect(competitorOpportunity?.reasoning).toContain('never been promoted');
    expect(competitorOpportunity?.action.kind).toBe('generate_campaign');
    expect(competitorOpportunity?.action.label).toBe('Generate response campaign');
  });

  it('stays quiet when only one competitor moves', () => {
    const opportunities = buildOpportunities({
      brain,
      competitors: [competitors[0]!],
      trends: [],
      ownPages,
      publishedContent: [],
      performance: [],
    });
    expect(opportunities.some((o) => o.kind === 'competitor')).toBe(false);
  });

  it('does not recommend promoting a page that was already promoted', () => {
    const opportunities = buildOpportunities({
      brain,
      competitors: [],
      trends: [],
      ownPages,
      publishedContent: [
        content({
          lineage: {
            sourceType: 'remix',
            sourceUrl: ownPages[0]!.url,
            sourceId: null,
            instruction: null,
            parentContentId: null,
            appliedInsightIds: [],
          },
        }),
      ],
      performance: [],
    });
    const urls = opportunities.filter((o) => o.kind === 'unpromoted_asset').map((o) => o.action.payload['url']);
    expect(urls).not.toContain(ownPages[0]!.url);
  });

  it('every opportunity carries an action', () => {
    const opportunities = buildOpportunities({
      brain,
      competitors,
      trends: evaluateTrends('brd_1', brain, [
        { topic: 'credit score changes', source: 'search', summary: 'Credit score models are changing.', momentum: 0.7 },
      ]),
      ownPages,
      publishedContent: [],
      performance: [],
    });
    expect(opportunities.length).toBeGreaterThan(0);
    expect(opportunities.every((o) => o.action.label.length > 0 && o.evidence.length > 0)).toBe(true);
  });
});
