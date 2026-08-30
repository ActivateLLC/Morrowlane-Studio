import type { BrandBrain, BrandProduct, CrawledPage } from '@morrowlane/shared';
import { newId, nowIso } from '@morrowlane/shared';
import { type AiGateway, brandBrainDraftSchema } from '@morrowlane/content-engine';
import { applyCompliancePresets, detectCompliancePresets } from './compliance.js';
import { corpusFromBrief } from './composer.js';
import { BRAND_ANALYST_SYSTEM_PROMPT, buildBrandBrief } from './prompt.js';
import { extractSignals } from './signals.js';

export interface BuildBrandBrainRequest {
  brandId: string;
  websiteUrl: string;
  pages: CrawledPage[];
  siteColors: string[];
  siteSocialLinks: string[];
  /** Previous version, so human edits survive a re-analysis. */
  previous?: BrandBrain | null;
}

/**
 * Turns a crawl into the profile everything else reads from. The model interprets;
 * the crawl decides. Where the two disagree on something verifiable — a price, a URL,
 * an image — the crawl wins, because it can be pointed at a page.
 */
export async function buildBrandBrain(
  gateway: AiGateway,
  request: BuildBrandBrainRequest,
): Promise<BrandBrain> {
  const signals = extractSignals(request.pages, request.websiteUrl, request.siteColors);
  const brief = buildBrandBrief(signals, request.pages, request.websiteUrl);

  const { value: draft } = await gateway.completeObject(
    {
      purpose: 'build_brand_brain',
      tier: 'deep',
      temperature: 0.3,
      maxTokens: 6000,
      messages: [{ role: 'system', content: BRAND_ANALYST_SYSTEM_PROMPT }],
      brief,
    },
    brandBrainDraftSchema,
  );

  const products = reconcileProducts(draft.products, signals.products);
  const corpus = corpusFromBrief(brief);
  const presets = detectCompliancePresets(corpus);

  const rules = applyCompliancePresets(
    {
      approvedTerminology: unique([...draft.rules.approvedTerminology, ...signals.terminology]).slice(0, 20),
      prohibitedTerminology: unique(draft.rules.prohibitedTerminology),
      approvedClaims: unique(draft.rules.approvedClaims),
      prohibitedClaims: unique(draft.rules.prohibitedClaims),
      regulatoryNotes: unique(draft.rules.regulatoryNotes),
      // The site's own CTAs outrank invented ones — those are the words that convert here.
      preferredCtas: unique([...signals.ctas, ...draft.rules.preferredCtas]).slice(0, 8),
      visualGuidelines: unique(draft.rules.visualGuidelines),
    },
    presets,
  );

  const brain: BrandBrain = {
    brandId: request.brandId,
    version: (request.previous?.version ?? 0) + 1,
    identity: {
      companyName: draft.identity.companyName || signals.companyName,
      category: draft.identity.category,
      oneLiner: draft.identity.oneLiner || signals.oneLiner,
      description: draft.identity.description || signals.description,
      audience: draft.identity.audience,
      industries: unique([...draft.identity.industries, ...presets.map((p) => p.label)]),
      locations: unique([...draft.identity.locations, ...signals.locations]),
    },
    voice: draft.voice,
    products,
    offers: unique([...signals.offers, ...draft.offers]),
    faqs: signals.faqs,
    testimonials: signals.testimonials,
    visuals: signals.visuals,
    rules,
    terminology: unique([...signals.terminology, ...draft.terminology]),
    socialLinks: unique([...signals.socialLinks, ...request.siteSocialLinks]),
    notes: unique([
      ...draft.notes,
      ...presets.map((p) => `Compliance preset applied: ${p.label}.`),
    ]),
    completeness: 0,
    sourcePageCount: request.pages.length,
    generatedAt: nowIso(),
    lockedFields: request.previous?.lockedFields ?? [],
  };

  brain.completeness = scoreCompleteness(brain);
  return request.previous ? preserveLockedFields(brain, request.previous) : brain;
}

/**
 * The model names and describes products; the crawl owns their URLs, prices and images.
 * Products the model missed entirely are kept — a missing product is a missing campaign.
 */
function reconcileProducts(
  drafted: Array<Omit<BrandProduct, 'id'>>,
  observed: BrandProduct[],
): BrandProduct[] {
  const byName = new Map(observed.map((product) => [product.name.toLowerCase(), product]));
  const used = new Set<string>();

  const merged = drafted.map((draft): BrandProduct => {
    const key = draft.name.toLowerCase();
    const match =
      byName.get(key) ??
      observed.find((product) => product.name.toLowerCase().includes(key) || key.includes(product.name.toLowerCase()));
    if (match) used.add(match.name.toLowerCase());

    return {
      id: match?.id ?? newId('product'),
      name: draft.name,
      kind: draft.kind,
      description: draft.description || match?.description || '',
      benefits: draft.benefits.length > 0 ? draft.benefits : (match?.benefits ?? []),
      audience: draft.audience,
      priceHint: match?.priceHint ?? draft.priceHint,
      sourceUrls: unique([...(match?.sourceUrls ?? []), ...draft.sourceUrls]),
      imageUrls: unique([...(match?.imageUrls ?? []), ...draft.imageUrls]),
      claims: unique([...(match?.claims ?? []), ...draft.claims]),
      ctas: unique([...(match?.ctas ?? []), ...draft.ctas]),
    };
  });

  const missed = observed.filter((product) => !used.has(product.name.toLowerCase()));
  return [...merged, ...missed];
}

/** Drives the "finish your brand profile" prompts rather than being a vanity number. */
export function scoreCompleteness(brain: BrandBrain): number {
  const checks: Array<[boolean, number]> = [
    [Boolean(brain.identity.companyName), 1],
    [Boolean(brain.identity.description), 1],
    [brain.identity.audience.length > 0, 1],
    [Boolean(brain.identity.category), 0.5],
    [brain.voice.traits.length > 0, 1],
    [brain.products.length > 0, 2],
    [brain.products.some((p) => p.benefits.length > 0), 1],
    [brain.faqs.length > 0, 1],
    [brain.testimonials.length > 0, 1],
    [brain.offers.length > 0, 0.5],
    [brain.visuals.colors.length > 0, 0.5],
    [brain.visuals.logoUrls.length > 0, 0.5],
    [brain.rules.preferredCtas.length > 0, 1],
    [brain.socialLinks.length > 0, 0.5],
  ];

  const earned = checks.reduce((sum, [passed, weight]) => sum + (passed ? weight : 0), 0);
  const total = checks.reduce((sum, [, weight]) => sum + weight, 0);
  return Number((earned / total).toFixed(2));
}

/** A human edit is a decision. Regeneration must not quietly undo it. */
export function preserveLockedFields(next: BrandBrain, previous: BrandBrain): BrandBrain {
  if (previous.lockedFields.length === 0) return next;

  const result = structuredClone(next);
  for (const path of previous.lockedFields) {
    const value = readPath(previous, path);
    if (value !== undefined) writePath(result as unknown as Record<string, unknown>, path, value);
  }
  result.lockedFields = previous.lockedFields;
  result.completeness = scoreCompleteness(result);
  return result;
}

function readPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((node, key) => {
    if (node === null || typeof node !== 'object') return undefined;
    return (node as Record<string, unknown>)[key];
  }, source);
}

function writePath(target: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  const last = keys.pop();
  if (!last) return;
  let node: Record<string, unknown> = target;
  for (const key of keys) {
    const next = node[key];
    if (next === null || typeof next !== 'object') return;
    node = next as Record<string, unknown>;
  }
  node[last] = value;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
