import type { CampaignPhaseKind } from './domain.js';

/**
 * Business outcomes are the front door of the guided flow (step 5). Instead of a blank
 * "what's your goal?" box — which is where generic, unfocused campaigns come from — the
 * user picks the outcome they're after, and that choice biases the campaign's phase mix,
 * default length and calls to action. Each outcome multiplies the base phase weights in
 * the campaign engine, so the same 5-phase arc leans toward whatever moves this goal.
 */
export const CAMPAIGN_OUTCOME_IDS = ['awareness', 'leads', 'sales', 'launch', 'retention'] as const;

export type CampaignOutcomeId = (typeof CAMPAIGN_OUTCOME_IDS)[number];

export interface CampaignOutcome {
  id: CampaignOutcomeId;
  label: string;
  /** One line for the outcome card. */
  tagline: string;
  /** Default goal text handed to the planner when the user doesn't override it. */
  goalTemplate: string;
  defaultDurationDays: number;
  /** Multiplicative bias on the base phase weights; phases left out keep 1.0. */
  phaseBias: Partial<Record<CampaignPhaseKind, number>>;
  /** Guidance on the kind of CTA this outcome wants, surfaced to generation. */
  ctaEmphasis: string;
}

export const CAMPAIGN_OUTCOMES: readonly CampaignOutcome[] = [
  {
    id: 'awareness',
    label: 'Build awareness',
    tagline: 'Reach new people and make the problem you solve impossible to ignore.',
    goalTemplate: 'Grow awareness of the brand among people who have the problem it solves.',
    defaultDurationDays: 30,
    phaseBias: { problem_awareness: 1.6, education: 1.3, conversion: 0.4 },
    ctaEmphasis: 'Soft CTAs — follow, read, learn more. No hard sell.',
  },
  {
    id: 'leads',
    label: 'Generate leads',
    tagline: 'Turn interest into contacts you can nurture — signups, downloads, demos.',
    goalTemplate: 'Generate qualified leads by trading useful material for contact details.',
    defaultDurationDays: 30,
    phaseBias: { education: 1.5, solution: 1.3, proof: 1.2, conversion: 0.9 },
    ctaEmphasis: 'Lead-capture CTAs — get the guide, join the list, book a call.',
  },
  {
    id: 'sales',
    label: 'Drive sales',
    tagline: 'Convert warm demand into revenue with proof and clear offers.',
    goalTemplate: 'Drive purchases of the product from people already aware of it.',
    defaultDurationDays: 14,
    phaseBias: { problem_awareness: 0.6, proof: 1.5, conversion: 1.8 },
    ctaEmphasis: 'Direct CTAs — buy now, start the trial, claim the offer.',
  },
  {
    id: 'launch',
    label: 'Launch something',
    tagline: 'Announce a new product or feature with a build-up and a moment.',
    goalTemplate: 'Launch a new product with anticipation, a clear reveal and a reason to act now.',
    defaultDurationDays: 21,
    phaseBias: { problem_awareness: 1.3, solution: 1.5, proof: 1.1, conversion: 1.4 },
    ctaEmphasis: 'Momentum CTAs — get early access, be first, see what’s new.',
  },
  {
    id: 'retention',
    label: 'Keep customers',
    tagline: 'Deepen loyalty with existing customers — usage, upsell, advocacy.',
    goalTemplate: 'Retain and expand existing customers by helping them get more value.',
    defaultDurationDays: 30,
    phaseBias: { education: 1.6, proof: 1.3, problem_awareness: 0.5, conversion: 0.7 },
    ctaEmphasis: 'Value CTAs — try this feature, share your result, refer a friend.',
  },
];

export function getCampaignOutcome(id: string | null | undefined): CampaignOutcome | null {
  return CAMPAIGN_OUTCOMES.find((outcome) => outcome.id === id) ?? null;
}

export function isCampaignOutcome(value: unknown): value is CampaignOutcomeId {
  return typeof value === 'string' && CAMPAIGN_OUTCOME_IDS.includes(value as CampaignOutcomeId);
}
