import type {
  BrandBrain,
  Competitor,
  CompetitorSignal,
  ContentItem,
  Opportunity,
  Trend,
} from '@morrowlane/shared';
import { keywords, newId, nowIso, truncate } from '@morrowlane/shared';
import type { ContentPerformance } from './attribution.js';

/**
 * Opportunities are the product's answer to "so what?". Every one carries a single
 * action that can be taken from the card, because a competitor dashboard nobody acts
 * on is a report, not a feature.
 */

export interface OpportunityInput {
  brain: BrandBrain;
  competitors: Competitor[];
  trends: Trend[];
  /** Pages on the brand's own site, used to find assets that were never promoted. */
  ownPages: Array<{ url: string; title: string | null; pageType: string; topics: string[] }>;
  publishedContent: ContentItem[];
  performance: ContentPerformance[];
  /** Trends below this relevance are never surfaced, however hot they are. */
  relevanceFloor?: number;
}

export function buildOpportunities(input: OpportunityInput): Opportunity[] {
  const relevanceFloor = input.relevanceFloor ?? 0.55;

  return [
    ...competitorOpportunities(input),
    ...trendOpportunities(input, relevanceFloor),
    ...unpromotedAssetOpportunities(input),
    ...performanceOpportunities(input),
  ]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

/**
 * The example from the spec: several competitors moving on one theme, while the brand
 * already owns relevant pages it has never promoted. That combination is the whole
 * recommendation — neither half is interesting alone.
 */
function competitorOpportunities(input: OpportunityInput): Opportunity[] {
  const themeCounts = new Map<string, { competitors: Set<string>; signals: CompetitorSignal[] }>();

  for (const competitor of input.competitors) {
    for (const signal of competitor.signals) {
      for (const theme of signal.themes) {
        const key = theme.toLowerCase();
        const entry = themeCounts.get(key) ?? { competitors: new Set<string>(), signals: [] };
        entry.competitors.add(competitor.name);
        entry.signals.push(signal);
        themeCounts.set(key, entry);
      }
    }
  }

  const opportunities: Opportunity[] = [];

  for (const [theme, entry] of themeCounts) {
    // One competitor doing something is noise. Several is a market movement.
    if (entry.competitors.size < 2) continue;

    const relevantPages = input.ownPages.filter(
      (page) => matchesTheme(page.title ?? '', theme) || page.topics.some((topic) => matchesTheme(topic, theme)),
    );
    const promotedUrls = new Set(input.publishedContent.map((item) => item.lineage.sourceUrl).filter(Boolean));
    const unpromoted = relevantPages.filter((page) => !promotedUrls.has(page.url));

    if (unpromoted.length === 0) continue;

    opportunities.push({
      id: newId('event').replace('evt_', 'opp_'),
      brandId: input.brain.brandId,
      kind: 'competitor',
      headline: `${entry.competitors.size} competitors are increasing content around ${theme}.`,
      reasoning: `Your site contains ${unpromoted.length} relevant resource${unpromoted.length === 1 ? '' : 's'} that ${unpromoted.length === 1 ? 'has' : 'have'} never been promoted.`,
      evidence: [
        ...[...entry.competitors].slice(0, 4).map((name) => `${name} published on this theme recently.`),
        ...unpromoted.slice(0, 4).map((page) => `Unpromoted: ${page.title ?? page.url}`),
      ],
      action: {
        label: 'Generate response campaign',
        kind: 'generate_campaign',
        payload: {
          goal: `Own the conversation around ${theme}.`,
          topic: theme,
          sourceUrls: unpromoted.slice(0, 6).map((page) => page.url),
        },
      },
      score: 0.6 + Math.min(0.3, entry.competitors.size * 0.08) + Math.min(0.1, unpromoted.length * 0.02),
      createdAt: nowIso(),
    });
  }

  return opportunities;
}

function trendOpportunities(input: OpportunityInput, relevanceFloor: number): Opportunity[] {
  return input.trends
    .filter((trend) => trend.relevance >= relevanceFloor)
    .filter((trend) => !trend.expiresAt || new Date(trend.expiresAt).getTime() > Date.now())
    .slice(0, 4)
    .map((trend) => ({
      id: newId('event').replace('evt_', 'opp_'),
      brandId: input.brain.brandId,
      kind: 'trend' as const,
      headline: `${trend.topic} is rising and fits what you sell.`,
      reasoning: truncate(trend.summary, 240),
      evidence: [
        `Relevance to your brand: ${Math.round(trend.relevance * 100)}%.`,
        `Momentum: ${Math.round(trend.momentum * 100)}%.`,
        `Source: ${trend.source}.`,
      ],
      action: {
        label: 'Generate content',
        kind: 'generate_content' as const,
        payload: { topic: trend.topic, count: 5 },
      },
      score: trend.relevance * 0.7 + trend.momentum * 0.3,
      createdAt: nowIso(),
    }));
}

/** Pages that already answer a customer question and have never been distributed. */
function unpromotedAssetOpportunities(input: OpportunityInput): Opportunity[] {
  const promoted = new Set(input.publishedContent.map((item) => item.lineage.sourceUrl).filter(Boolean));
  const candidates = input.ownPages
    .filter((page) => page.pageType === 'article' || page.pageType === 'product' || page.pageType === 'service')
    .filter((page) => !promoted.has(page.url))
    .slice(0, 3);

  return candidates.map((page) => ({
    id: newId('event').replace('evt_', 'opp_'),
    brandId: input.brain.brandId,
    kind: 'unpromoted_asset' as const,
    headline: `"${truncate(page.title ?? page.url, 70)}" has never been promoted.`,
    reasoning: 'This page already does the work. One remix turns it into a month of distribution.',
    evidence: [page.url, `Page type: ${page.pageType}.`],
    action: { label: 'Promote a URL', kind: 'remix_url' as const, payload: { url: page.url } },
    score: page.pageType === 'article' ? 0.55 : 0.6,
    createdAt: nowIso(),
  }));
}

function performanceOpportunities(input: OpportunityInput): Opportunity[] {
  const withImpressions = input.performance.filter((row) => row.totals.impression > 0);
  if (withImpressions.length < 4) return [];

  const leaders = [...withImpressions].sort((a, b) => b.qualifiedVisits - a.qualifiedVisits).slice(0, 1);
  const leader = leaders[0];
  if (!leader || leader.qualifiedVisits === 0) return [];

  const item = input.publishedContent.find((content) => content.id === leader.contentId);
  if (!item) return [];

  return [
    {
      id: newId('event').replace('evt_', 'opp_'),
      brandId: input.brain.brandId,
      kind: 'performance',
      headline: `"${truncate(item.title, 60)}" is your strongest post for qualified traffic.`,
      reasoning: 'Content that works once usually works again in another format. Extend it rather than starting over.',
      evidence: [
        `${leader.qualifiedVisits} qualified visits.`,
        `${leader.totals.lead} lead${leader.totals.lead === 1 ? '' : 's'}.`,
        `Format: ${item.format}.`,
      ],
      action: {
        label: 'Generate content',
        kind: 'generate_content',
        payload: { topic: item.topics[0] ?? item.title, count: 5, parentContentId: item.id },
      },
      score: 0.65,
      createdAt: nowIso(),
    },
  ];
}

function matchesTheme(text: string, theme: string): boolean {
  const haystack = text.toLowerCase();
  if (haystack.includes(theme)) return true;
  // Fall back to overlapping keywords so "first-time homebuyer education" matches
  // "Credit for first-time homebuyers".
  const themeWords = new Set(keywords(theme, 6).map(stem));
  if (themeWords.size === 0) return false;
  const textWords = new Set(keywords(text, 12).map(stem));
  let overlap = 0;
  for (const word of themeWords) if (textWords.has(word)) overlap += 1;
  return overlap >= Math.min(2, themeWords.size);
}

/** Crude singularisation. Themes and page titles disagree on plurals constantly. */
function stem(word: string): string {
  if (word.length > 5 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 5 && (word.endsWith('ses') || word.endsWith('xes') || word.endsWith('ches'))) {
    return word.slice(0, -2);
  }
  if (word.length > 4 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}
