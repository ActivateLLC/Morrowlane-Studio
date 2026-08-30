import type { BrandBrain, Campaign, ContentFormat, ContentItem } from '@morrowlane/shared';
import { formatsForChannel } from '@morrowlane/shared';
import { type AiGateway, generateContent } from '@morrowlane/content-engine';

export interface GenerateCampaignContentRequest {
  brain: BrandBrain;
  campaign: Campaign;
  /** Overrides the per-channel format choice. */
  formats?: ContentFormat[];
}

export interface GenerateCampaignContentResult {
  items: ContentItem[];
  errors: Array<{ phaseId: string; error: string }>;
}

/**
 * Writes a campaign's content phase by phase, passing each phase's narrative into the
 * generation so the posts argue in sequence instead of restating the same pitch.
 */
export async function generateCampaignContent(
  gateway: AiGateway,
  request: GenerateCampaignContentRequest,
): Promise<GenerateCampaignContentResult> {
  const { campaign, brain } = request;
  const items: ContentItem[] = [];
  const errors: GenerateCampaignContentResult['errors'] = [];

  const product = campaign.productId
    ? brain.products.find((p) => p.id === campaign.productId) ?? null
    : null;

  for (const phase of campaign.phases) {
    // A phase's posts are split across the campaign's channels, largest share first.
    const perChannel = splitCount(phase.postCount, campaign.channels.length);

    for (const [index, channel] of campaign.channels.entries()) {
      const count = perChannel[index] ?? 0;
      if (count === 0) continue;

      const format =
        request.formats?.find((f) => formatsForChannel(channel).some((p) => p.id === f)) ??
        formatsForChannel(channel)[0]?.id ??
        'instagram_post';

      try {
        const result = await generateContent(gateway, {
          brain,
          format,
          channel,
          count,
          campaignId: campaign.id,
          campaignPhaseId: phase.id,
          phaseTitle: phase.title,
          phaseNarrative: phase.narrative,
          productName: product?.name ?? null,
          instruction: campaign.goal,
          lineage: { sourceType: 'campaign', sourceId: campaign.id, instruction: campaign.goal },
        });
        items.push(...result.items);
      } catch (error) {
        errors.push({ phaseId: phase.id, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  return { items, errors };
}

/** Splits n items into b buckets, distributing the remainder from the front. */
export function splitCount(total: number, buckets: number): number[] {
  if (buckets <= 0) return [];
  const base = Math.floor(total / buckets);
  const remainder = total % buckets;
  return Array.from({ length: buckets }, (_, i) => base + (i < remainder ? 1 : 0));
}
