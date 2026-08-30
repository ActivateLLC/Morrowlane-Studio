import type {
  AttributionEvent,
  AttributionStage,
  ContentItem,
  ScheduledPost,
} from '@morrowlane/shared';
import { ATTRIBUTION_STAGES, newId, nowIso } from '@morrowlane/shared';

/**
 * The lineage chain from the spec, made queryable:
 * brand source → content → post → platform → engagement → visit → lead → customer → revenue.
 * Every event carries the content id, which is what lets a dollar of revenue be traced
 * back to the hook that earned it.
 */

export interface RecordEventRequest {
  brandId: string;
  contentId: string | null;
  scheduledPostId: string | null;
  stage: AttributionStage;
  value?: number;
  currency?: string | null;
  occurredAt?: string;
  metadata?: Record<string, unknown>;
  channel?: AttributionEvent['channel'];
}

export function recordEvent(request: RecordEventRequest): AttributionEvent {
  return {
    id: newId('event'),
    brandId: request.brandId,
    contentId: request.contentId,
    scheduledPostId: request.scheduledPostId,
    channel: request.channel ?? null,
    stage: request.stage,
    value: request.value ?? 1,
    currency: request.currency ?? null,
    occurredAt: request.occurredAt ?? nowIso(),
    metadata: request.metadata ?? {},
  };
}

export interface FunnelTotals {
  impression: number;
  engagement: number;
  click: number;
  visit: number;
  lead: number;
  customer: number;
  revenue: number;
}

export function emptyFunnel(): FunnelTotals {
  return { impression: 0, engagement: 0, click: 0, visit: 0, lead: 0, customer: 0, revenue: 0 };
}

export function summariseFunnel(events: AttributionEvent[]): FunnelTotals {
  const totals = emptyFunnel();
  for (const event of events) totals[event.stage] += event.value;
  return totals;
}

export interface StageConversion {
  from: AttributionStage;
  to: AttributionStage;
  rate: number;
}

/** Where the funnel actually leaks, which is the only reason to look at it. */
export function conversionRates(totals: FunnelTotals): StageConversion[] {
  const rates: StageConversion[] = [];
  for (let i = 0; i < ATTRIBUTION_STAGES.length - 1; i += 1) {
    const from = ATTRIBUTION_STAGES[i]!;
    const to = ATTRIBUTION_STAGES[i + 1]!;
    // Revenue is an amount, not a count, so a rate into it would be meaningless.
    if (to === 'revenue') continue;
    const numerator = totals[to];
    const denominator = totals[from];
    rates.push({ from, to, rate: denominator > 0 ? Number((numerator / denominator).toFixed(4)) : 0 });
  }
  return rates;
}

export interface ContentPerformance {
  contentId: string;
  format: ContentItem['format'];
  channel: ContentItem['channel'];
  topics: string[];
  campaignId: string | null;
  totals: FunnelTotals;
  /** Qualified traffic: visits that came from a real click, not an accidental tap. */
  qualifiedVisits: number;
  revenuePerImpression: number;
}

export function performanceByContent(
  content: ContentItem[],
  posts: ScheduledPost[],
  events: AttributionEvent[],
): ContentPerformance[] {
  const postToContent = new Map(posts.map((post) => [post.id, post.contentId]));
  const byContent = new Map<string, AttributionEvent[]>();

  for (const event of events) {
    const contentId = event.contentId ?? (event.scheduledPostId ? postToContent.get(event.scheduledPostId) : null);
    if (!contentId) continue;
    const bucket = byContent.get(contentId);
    if (bucket) bucket.push(event);
    else byContent.set(contentId, [event]);
  }

  return content.map((item) => {
    const totals = summariseFunnel(byContent.get(item.id) ?? []);
    return {
      contentId: item.id,
      format: item.format,
      channel: item.channel,
      topics: item.topics,
      campaignId: item.campaignId,
      totals,
      qualifiedVisits: Math.min(totals.visit, totals.click),
      revenuePerImpression: totals.impression > 0 ? totals.revenue / totals.impression : 0,
    };
  });
}
