import type {
  BrandBrain,
  Campaign,
  CampaignPhase,
  CampaignPhaseKind,
  Channel,
} from '@morrowlane/shared';
import { addDays, newId, nowIso, startOfUtcDay, truncate } from '@morrowlane/shared';
import { type AiGateway, campaignPlanSchema } from '@morrowlane/content-engine';

export interface PlanCampaignRequest {
  brain: BrandBrain;
  goal: string;
  productName?: string | null;
  channels: Channel[];
  durationDays: number;
  startDate?: string;
  /** Posts per channel per week. Defaults to a sustainable cadence. */
  postsPerChannelPerWeek?: number;
}

/**
 * A campaign is an argument told over time, not a bag of posts. The phase weights
 * below put most of the budget into education and proof because those are what move
 * someone who is not ready yet; conversion is short on purpose.
 */
const PHASE_WEIGHTS: Array<{ kind: CampaignPhaseKind; weight: number; title: string }> = [
  { kind: 'problem_awareness', weight: 0.2, title: 'Problem awareness' },
  { kind: 'education', weight: 0.25, title: 'Education' },
  { kind: 'solution', weight: 0.2, title: 'Solution' },
  { kind: 'proof', weight: 0.2, title: 'Proof' },
  { kind: 'conversion', weight: 0.15, title: 'Conversion' },
];

export async function planCampaign(
  gateway: AiGateway,
  request: PlanCampaignRequest,
): Promise<Campaign> {
  const durationDays = Math.max(3, Math.min(request.durationDays, 90));
  const channels = request.channels.length > 0 ? request.channels : (['instagram'] as Channel[]);
  const startDate = startOfUtcDay(request.startDate ?? nowIso());
  const perWeek = request.postsPerChannelPerWeek ?? 3;
  const totalPosts = Math.max(
    channels.length,
    Math.round((durationDays / 7) * perWeek * channels.length),
  );

  const product =
    request.brain.products.find((p) => p.name === request.productName) ?? request.brain.products[0] ?? null;

  const { value: plan } = await gateway.completeObject(
    {
      purpose: 'plan_campaign',
      tier: 'deep',
      temperature: 0.6,
      maxTokens: 3000,
      messages: [{ role: 'system', content: CAMPAIGN_SYSTEM_PROMPT }],
      brief: {
        company: request.brain.identity.companyName,
        category: request.brain.identity.category,
        audience: request.brain.identity.audience,
        oneLiner: request.brain.identity.oneLiner,
        description: truncate(request.brain.identity.description, 500),
        goal: request.goal,
        product: product
          ? {
              name: product.name,
              description: truncate(product.description, 400),
              benefits: product.benefits,
              priceHint: product.priceHint,
            }
          : null,
        offers: request.brain.offers.slice(0, 4),
        faqs: request.brain.faqs.slice(0, 6),
        testimonials: request.brain.testimonials.slice(0, 3),
        channels,
        durationDays,
        totalPosts,
        phases: PHASE_WEIGHTS.map((phase) => ({ kind: phase.kind, title: phase.title })),
      },
    },
    campaignPlanSchema,
  );

  const campaignId = newId('campaign');
  const phases = layOutPhases(campaignId, plan.phases, durationDays, totalPosts);
  const now = nowIso();

  return {
    id: campaignId,
    brandId: request.brain.brandId,
    name: plan.name,
    goal: request.goal,
    productId: product?.id ?? null,
    channels,
    durationDays,
    startDate,
    status: 'ready',
    narrative: plan.narrative,
    phases,
    createdAt: now,
    updatedAt: now,
  };
}

interface PlannedPhase {
  kind: CampaignPhaseKind;
  title: string;
  narrative: string;
  postCount: number;
}

/**
 * Turns phase weights into day ranges and post counts that add up exactly.
 * Rounding is corrected on the last phase so no post is silently lost.
 */
export function layOutPhases(
  campaignId: string,
  planned: PlannedPhase[],
  durationDays: number,
  totalPosts: number,
): CampaignPhase[] {
  const phases = planned.length > 0 ? planned : PHASE_WEIGHTS.map((p) => ({ ...p, narrative: '', postCount: 0 }));
  const weights = phases.map((phase) => PHASE_WEIGHTS.find((w) => w.kind === phase.kind)?.weight ?? 1 / phases.length);
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);

  let dayCursor = 0;
  let postsAssigned = 0;

  return phases.map((phase, index) => {
    const isLast = index === phases.length - 1;
    const share = weights[index]! / weightTotal;

    const days = isLast ? durationDays - dayCursor : Math.max(1, Math.round(durationDays * share));
    const posts = isLast ? Math.max(0, totalPosts - postsAssigned) : Math.max(1, Math.round(totalPosts * share));

    const startDay = dayCursor;
    const endDay = Math.min(durationDays - 1, dayCursor + days - 1);
    dayCursor = endDay + 1;
    postsAssigned += posts;

    return {
      id: newId('campaignPhase'),
      campaignId,
      kind: phase.kind,
      title: phase.title,
      narrative: phase.narrative,
      startDay,
      endDay,
      postCount: posts,
    };
  });
}

export function phaseDateRange(campaign: Campaign, phase: CampaignPhase): { start: string; end: string } {
  return {
    start: addDays(campaign.startDate, phase.startDay),
    end: addDays(campaign.startDate, phase.endDay),
  };
}

const CAMPAIGN_SYSTEM_PROMPT = [
  'You are a campaign strategist. You are given a business goal and everything known about the brand, and you produce the argument the campaign will make over its full run.',
  '',
  'Rules:',
  '- The narrative is a single argument, not a list of themes. Each phase must set up the next.',
  '- Ground every phase in the brand facts provided. Do not invent products, offers or proof.',
  '- Phase post counts must sum to the total post count given in the brief.',
  '- Name the campaign after what it argues, not after the product.',
  '',
  'Return JSON only:',
  '{"name":string,"narrative":string,"phases":[{"kind":"problem_awareness"|"education"|"solution"|"proof"|"conversion","title":string,"narrative":string,"postCount":number}]}',
].join('\n');
