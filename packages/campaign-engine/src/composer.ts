import { truncate } from '@morrowlane/shared';
import type { CampaignPlan, LocalComposer } from '@morrowlane/content-engine';

/** Local composition of a campaign plan from brand facts alone. */
export function composeCampaignPlan(brief: Record<string, unknown>): CampaignPlan {
  const company = str(brief['company'], 'the brand');
  const goal = str(brief['goal'], 'grow the business');
  const audience = strArr(brief['audience'])[0] ?? 'their customers';
  const product = record(brief['product']);
  const productName = str(product['name'], company);
  const benefits = strArr(product['benefits']);
  const totalPosts = num(brief['totalPosts'], 12);
  const phaseSpecs = arr(brief['phases']).map(record);

  const narratives: Record<string, string> = {
    problem_awareness: `Name the problem ${audience} live with before naming ${productName}. No pitch in this phase — the goal is recognition.`,
    education: `Teach the mechanics. Once ${audience} understand how this actually works, ${productName} stops needing to be sold.`,
    solution: `Show ${productName} as the direct answer to the problem phase one named${benefits[0] ? `, led by: ${truncate(benefits[0], 120)}` : ''}.`,
    proof: `Replace assertion with evidence: customer outcomes, specifics and the objections that stop people signing up.`,
    conversion: `Make the ask, once, clearly, to an audience that has now been given a reason to say yes.`,
  };

  const kinds = phaseSpecs.length > 0
    ? phaseSpecs.map((p) => str(p['kind'], 'education'))
    : ['problem_awareness', 'education', 'solution', 'proof', 'conversion'];

  const weights: Record<string, number> = {
    problem_awareness: 0.2, education: 0.25, solution: 0.2, proof: 0.2, conversion: 0.15,
  };
  const weightTotal = kinds.reduce((sum, kind) => sum + (weights[kind] ?? 1 / kinds.length), 0);

  let assigned = 0;
  const phases = kinds.map((kind, index) => {
    const isLast = index === kinds.length - 1;
    const share = (weights[kind] ?? 1 / kinds.length) / weightTotal;
    const postCount = isLast ? Math.max(0, totalPosts - assigned) : Math.max(1, Math.round(totalPosts * share));
    assigned += postCount;
    return {
      kind: kind as CampaignPlan['phases'][number]['kind'],
      title: str(phaseSpecs[index]?.['title'], titleFor(kind)),
      narrative: narratives[kind] ?? `Advance the argument toward ${goal}.`,
      postCount,
    };
  });

  return {
    name: `${productName}: ${truncate(goal, 60)}`,
    narrative: `A ${num(brief['durationDays'], 30)}-day argument for ${audience}: start by naming the problem they already feel, teach the mechanics until the solution is obvious, then show ${productName} working before asking for anything.`,
    phases,
  };
}

function titleFor(kind: string): string {
  return kind.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

export const CAMPAIGN_COMPOSERS: Record<string, LocalComposer> = {
  plan_campaign: (brief) => composeCampaignPlan(brief),
};

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}
function strArr(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0) : [];
}
function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
