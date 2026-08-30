import type { BrandBrain, Campaign, Channel, ContentFormat, ContentItem } from '@morrowlane/shared';
import { formatProfile, formatsForChannel } from '@morrowlane/shared';
import { type AiGateway, generateContent } from '@morrowlane/content-engine';

export interface MonthPlanSlot {
  channel: Channel;
  format: ContentFormat;
  count: number;
  productName: string | null;
  topic: string | null;
  reason: string;
}

export interface FillMonthRequest {
  brain: BrandBrain;
  channels: Channel[];
  days: number;
  /** Posts per channel per week. */
  perChannelPerWeek?: number;
  /** Formats the brand's audience responds to, best first. From the analytics package. */
  preferredFormats?: ContentFormat[];
  campaign?: Campaign | null;
}

/**
 * Decides what a month should contain before writing any of it. The mix rule is the
 * point: mostly educational, some proof, a little promotion. A month that is all
 * promotion is the failure mode of every "generate 30 posts" button on the market.
 */
export function planMonth(request: FillMonthRequest): MonthPlanSlot[] {
  const { brain } = request;
  const channels = request.channels.length > 0 ? request.channels : (['instagram'] as Channel[]);
  const perWeek = request.perChannelPerWeek ?? 3;
  const perChannel = Math.max(1, Math.round((request.days / 7) * perWeek));

  const products = brain.products.length > 0 ? brain.products : [null];
  const topics = topicPool(brain);

  const slots: MonthPlanSlot[] = [];

  for (const channel of channels) {
    const formats = rankFormats(channel, request.preferredFormats);
    // 60% educational, 25% proof-and-story, 15% promotional.
    const educational = Math.max(1, Math.round(perChannel * 0.6));
    const proof = Math.max(1, Math.round(perChannel * 0.25));
    const promotional = Math.max(1, perChannel - educational - proof);

    const primary = formats[0]!;
    const secondary = formats[1] ?? primary;

    slots.push({
      channel,
      format: primary,
      count: educational,
      productName: null,
      topic: topics[slots.length % Math.max(1, topics.length)] ?? null,
      reason: 'Educational content: teaches something useful before asking for anything.',
    });

    slots.push({
      channel,
      format: secondary,
      count: proof,
      productName: products[0]?.name ?? null,
      topic: null,
      reason: 'Proof and customer stories: the evidence that makes the promise credible.',
    });

    slots.push({
      channel,
      format: primary,
      count: promotional,
      productName: products[slots.length % products.length]?.name ?? null,
      topic: null,
      reason: 'Promotional content: a direct ask, kept to a minority of the month.',
    });
  }

  return slots.filter((slot) => slot.count > 0);
}

function rankFormats(channel: Channel, preferred: ContentFormat[] | undefined): ContentFormat[] {
  const available = formatsForChannel(channel).map((profile) => profile.id);
  if (available.length === 0) return ['instagram_post'];

  // Preferred formats come from measured performance, so they lead when they apply here.
  const preferredHere = (preferred ?? []).filter((format) => available.includes(format));
  const textFirst = available
    .filter((format) => !preferredHere.includes(format))
    .sort((a, b) => rankCost(a) - rankCost(b));

  return [...preferredHere, ...textFirst];
}

function rankCost(format: ContentFormat): number {
  const tier = formatProfile(format).costTier;
  return tier === 'text' ? 0 : tier === 'image' ? 1 : 2;
}

function topicPool(brain: BrandBrain): string[] {
  return [
    ...brain.faqs.slice(0, 6).map((faq) => faq.question),
    ...brain.products.flatMap((product) => product.benefits.slice(0, 2)),
    ...brain.terminology.slice(0, 4),
  ].filter(Boolean);
}

export interface FillMonthResult {
  items: ContentItem[];
  plan: MonthPlanSlot[];
  errors: Array<{ slot: MonthPlanSlot; error: string }>;
}

/** Executes a month plan. Partial failure is reported, never silently swallowed. */
export async function fillMonth(
  gateway: AiGateway,
  request: FillMonthRequest,
): Promise<FillMonthResult> {
  const plan = planMonth(request);
  const items: ContentItem[] = [];
  const errors: FillMonthResult['errors'] = [];

  for (const slot of plan) {
    try {
      const result = await generateContent(gateway, {
        brain: request.brain,
        format: slot.format,
        channel: slot.channel,
        count: slot.count,
        topic: slot.topic,
        productName: slot.productName,
        instruction: slot.reason,
        campaignId: request.campaign?.id ?? null,
      });
      items.push(...result.items);
    } catch (error) {
      errors.push({ slot, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return { items, plan, errors };
}
