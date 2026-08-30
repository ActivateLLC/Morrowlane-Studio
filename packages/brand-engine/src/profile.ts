import type { BrandBrain, BrandProduct } from '@morrowlane/shared';
import { newId, nowIso, truncate } from '@morrowlane/shared';
import { type AiGateway, brandBrainDraftSchema } from '@morrowlane/content-engine';
import { applyCompliancePresets, detectCompliancePresets } from './compliance.js';
import { scoreCompleteness } from './build.js';

/** The answers from the no-website Brand Builder flow. Everything but name/whatYouSell is optional. */
export interface BrandProfileInput {
  brandId: string;
  businessName: string;
  /** Natural-language description of what they sell — typed, pasted notes, or transcribed. */
  whatYouSell: string;
  audience?: string;
  /** The single action a customer should take: buy, book, call, message, visit, subscribe, quote. */
  desiredAction?: string;
  /** Where customers can reach them — handles, links, phone, address, marketplace listing. */
  contactChannels?: string[];
  /** One of the brand-feel presets, or free text. */
  brandFeel?: string;
  /** Data URLs (or hosted URLs) for a logo and any images they uploaded. */
  logoUrls?: string[];
  imageUrls?: string[];
}

const FEEL_TRAITS: Record<string, string[]> = {
  professional: ['clear', 'credible', 'professional'],
  bold: ['bold', 'confident', 'direct'],
  warm: ['warm', 'friendly', 'approachable'],
  luxury: ['refined', 'elegant', 'understated'],
  playful: ['playful', 'fun', 'energetic'],
  minimal: ['clean', 'concise', 'uncluttered'],
  educational: ['helpful', 'clear', 'informative'],
};

const ACTION_CTAS: Record<string, string> = {
  buy: 'Shop now',
  book: 'Book now',
  call: 'Call us',
  message: 'Message us',
  visit: 'Visit us',
  subscribe: 'Subscribe',
  quote: 'Request a quote',
};

/**
 * Builds the first Brand Profile from the guided Brand Builder answers instead of a
 * crawl — the "I don't have a website yet" path. The user's answers are ground truth:
 * the model (or the local composer, with no key) fills in voice, category and a starter
 * product, but the name, audience, desired action and where-to-reach come straight from
 * what they told us. Compliance presets still fire on the description, so a regulated
 * business typed by hand is protected the same as one that was crawled.
 */
export async function buildBrandFromProfile(
  gateway: AiGateway,
  input: BrandProfileInput,
): Promise<BrandBrain> {
  const audience = splitLines(input.audience);
  const feel = (input.brandFeel ?? '').toLowerCase().trim();
  const feelTraits = FEEL_TRAITS[feel] ?? [];
  const ctas = actionCtas(input.desiredAction);
  const locations = (input.contactChannels ?? []).filter((c) => !looksLikeUrlOrHandle(c));
  const socialLinks = (input.contactChannels ?? []).filter(looksLikeUrlOrHandle);

  // The brief drives both the model and the offline local composer (which reads `observed`).
  const brief = {
    observed: {
      companyName: input.businessName,
      description: input.whatYouSell,
      oneLiner: truncate(input.whatYouSell, 140),
      audience,
      products: [{ name: input.businessName, description: input.whatYouSell }],
      ctas,
      locations,
      terminology: [],
    },
    manualProfile: {
      businessName: input.businessName,
      whatYouSell: input.whatYouSell,
      audience,
      desiredAction: input.desiredAction ?? null,
      brandFeel: input.brandFeel ?? null,
    },
    pages: {},
  };

  const { value: draft } = await gateway.completeObject(
    {
      purpose: 'build_brand_profile',
      tier: 'balanced',
      temperature: 0.4,
      maxTokens: 3000,
      messages: [{ role: 'system', content: PROFILE_SYSTEM_PROMPT }],
      brief,
    },
    brandBrainDraftSchema,
  );

  const corpus = [input.businessName, input.whatYouSell, input.audience ?? '', ...ctas].join(' ');
  const presets = detectCompliancePresets(corpus);

  const products: BrandProduct[] =
    draft.products.length > 0
      ? draft.products.map((p) => ({
          id: newId('product'),
          name: p.name,
          kind: p.kind,
          description: p.description || truncate(input.whatYouSell, 400),
          benefits: p.benefits,
          audience,
          priceHint: p.priceHint,
          sourceUrls: [],
          imageUrls: input.imageUrls ?? [],
          claims: p.claims,
          ctas: unique([...p.ctas, ...ctas]),
        }))
      : [
          {
            id: newId('product'),
            name: input.businessName,
            kind: 'product',
            description: truncate(input.whatYouSell, 400),
            benefits: [],
            audience,
            priceHint: null,
            sourceUrls: [],
            imageUrls: input.imageUrls ?? [],
            claims: [],
            ctas,
          },
        ];

  const rules = applyCompliancePresets(
    {
      approvedTerminology: unique(draft.rules.approvedTerminology).slice(0, 20),
      prohibitedTerminology: unique(draft.rules.prohibitedTerminology),
      approvedClaims: unique(draft.rules.approvedClaims),
      prohibitedClaims: unique(draft.rules.prohibitedClaims),
      regulatoryNotes: unique(draft.rules.regulatoryNotes),
      preferredCtas: unique([...ctas, ...draft.rules.preferredCtas]).slice(0, 8),
      visualGuidelines: unique(draft.rules.visualGuidelines),
    },
    presets,
  );

  const brain: BrandBrain = {
    brandId: input.brandId,
    version: 1,
    identity: {
      companyName: input.businessName,
      category: draft.identity.category,
      oneLiner: draft.identity.oneLiner || truncate(input.whatYouSell, 140),
      description: draft.identity.description || input.whatYouSell,
      // The user told us who they're reaching; trust it over the model's guess.
      audience: audience.length > 0 ? audience : draft.identity.audience,
      industries: unique([...draft.identity.industries, ...presets.map((p) => p.label)]),
      locations: unique([...locations, ...draft.identity.locations]),
    },
    voice: {
      traits: unique([...feelTraits, ...draft.voice.traits]).slice(0, 6),
      readingLevel: draft.voice.readingLevel,
      personSummary:
        draft.voice.personSummary ||
        `Speaks to ${audience[0] ?? 'its customers'} in a ${feel || 'clear, direct'} voice.`,
      sampleSentences: draft.voice.sampleSentences,
      avoid: draft.voice.avoid,
    },
    products,
    offers: unique(draft.offers),
    faqs: [],
    testimonials: [],
    visuals: {
      logoUrls: input.logoUrls ?? [],
      colors: [],
      imageUrls: input.imageUrls ?? [],
      fontHints: [],
    },
    rules,
    terminology: unique(draft.terminology),
    socialLinks: unique(socialLinks),
    notes: unique([
      'Profile built from the Brand Builder, not a website crawl. Add your website later to enrich it.',
      ...presets.map((p) => `Compliance preset applied: ${p.label}.`),
    ]),
    completeness: 0,
    sourcePageCount: 0,
    generatedAt: nowIso(),
    lockedFields: [],
  };

  brain.completeness = scoreCompleteness(brain);
  return brain;
}

function actionCtas(action?: string): string[] {
  const key = (action ?? '').toLowerCase().trim();
  const match = Object.keys(ACTION_CTAS).find((k) => key.includes(k));
  return match ? [ACTION_CTAS[match]!] : [];
}

function splitLines(value?: string): string[] {
  return unique((value ?? '').split(/[\n,]+/).map((s) => s.trim()));
}

function looksLikeUrlOrHandle(value: string): boolean {
  return /https?:\/\/|www\.|@|\.[a-z]{2,}(\/|$)/i.test(value.trim());
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

const PROFILE_SYSTEM_PROMPT = [
  'You are a brand strategist. You are given a small business owner\'s own description of their business — not a website — and you produce a starter brand profile.',
  '',
  'Rules:',
  '- Treat the owner\'s answers as ground truth. Do not contradict what they told you.',
  '- Infer category, voice and one or two starter products from what they sell. Do not invent prices, testimonials or claims they did not make.',
  '- Keep it honest and specific to this business; no generic filler.',
  '',
  'Return JSON matching the brand brain draft schema.',
].join('\n');
