import type {
  BrandBrain,
  Channel,
  ContentFormat,
  ContentItem,
  ContentLineage,
} from '@morrowlane/shared';
import { formatProfile, newId, nowIso } from '@morrowlane/shared';
import type { AiGateway } from './gateway/index.js';
import { buildContentBrief, contentSystemPrompt, type ContentBriefInput } from './prompts/content.js';
import { checkRules } from './rules.js';
import { generatedAssetsSchema } from './schemas.js';

export interface GenerateContentRequest {
  brain: BrandBrain;
  format: ContentFormat;
  /** Defaults to the format's home channel. */
  channel?: Channel;
  count?: number;
  instruction?: string | null;
  topic?: string | null;
  productName?: string | null;
  sourceUrl?: string | null;
  sourceExcerpt?: string | null;
  campaignId?: string | null;
  campaignPhaseId?: string | null;
  phaseTitle?: string | null;
  phaseNarrative?: string | null;
  lineage?: Partial<ContentLineage>;
  insights?: string[];
  appliedInsightIds?: string[];
}

export interface GenerateContentResult {
  items: ContentItem[];
  model: string;
}

/**
 * One path for every asset Morrowlane produces. The studio, URL Remix, the campaign
 * engine and Fill My Month all land here, which is why lineage is a required part of
 * the shape rather than something callers remember to attach.
 */
export async function generateContent(
  gateway: AiGateway,
  request: GenerateContentRequest,
): Promise<GenerateContentResult> {
  const format = request.format;
  const meta = formatProfile(format);
  const channel = request.channel ?? meta.channel;
  const count = Math.max(1, Math.min(request.count ?? 1, 60));

  const briefInput: ContentBriefInput = {
    brain: request.brain,
    format,
    channel,
    count,
    instruction: request.instruction ?? null,
    topic: request.topic ?? null,
    productName: request.productName ?? null,
    sourceExcerpt: request.sourceExcerpt ?? null,
    sourceUrl: request.sourceUrl ?? null,
    phaseTitle: request.phaseTitle ?? null,
    phaseNarrative: request.phaseNarrative ?? null,
    insights: request.insights ?? [],
  };

  const brief = buildContentBrief(briefInput);
  const { value, model } = await gateway.completeObject(
    {
      purpose: 'generate_content',
      tier: meta.costTier === 'text' && count > 12 ? 'fast' : 'balanced',
      temperature: 0.8,
      maxTokens: Math.min(8192, 900 + count * meta.targetWords * 2),
      messages: [{ role: 'system', content: contentSystemPrompt(briefInput) }],
      brief,
    },
    generatedAssetsSchema,
  );

  const now = nowIso();
  const lineage: ContentLineage = {
    sourceType: request.lineage?.sourceType ?? (request.sourceUrl ? 'url' : 'brand'),
    sourceUrl: request.lineage?.sourceUrl ?? request.sourceUrl ?? null,
    sourceId: request.lineage?.sourceId ?? null,
    instruction: request.lineage?.instruction ?? request.instruction ?? null,
    parentContentId: request.lineage?.parentContentId ?? null,
    appliedInsightIds: request.appliedInsightIds ?? [],
  };

  const items = value.assets.slice(0, count).map((asset): ContentItem => {
    const violations = checkRules({
      channel,
      format,
      body: asset.body,
      hook: asset.hook,
      segments: asset.segments,
      hashtags: asset.hashtags,
      cta: asset.cta,
      rules: request.brain.rules,
    });

    return {
      id: newId('content'),
      brandId: request.brain.brandId,
      campaignId: request.campaignId ?? null,
      campaignPhaseId: request.campaignPhaseId ?? null,
      format,
      channel,
      // Anything with a rule error must be looked at before it can be scheduled.
      status: violations.some((v) => v.severity === 'error') ? 'needs_review' : 'draft',
      title: asset.title,
      hook: asset.hook,
      body: asset.body,
      segments: asset.segments.map((segment, index) => ({
        index,
        heading: segment.heading,
        body: segment.body,
        visualDirection: segment.visualDirection,
      })),
      hashtags: asset.hashtags,
      cta: asset.cta,
      linkUrl: request.sourceUrl ?? null,
      mediaAssetIds: [],
      topics: asset.topics,
      lineage,
      violations,
      model,
      createdAt: now,
      updatedAt: now,
    };
  });

  return { items, model };
}
