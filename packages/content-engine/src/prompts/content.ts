import type { BrandBrain, Channel, ContentFormat } from '@morrowlane/shared';
import { channelProfile, formatProfile, truncate } from '@morrowlane/shared';

export interface ContentBriefInput {
  brain: BrandBrain;
  format: ContentFormat;
  channel: Channel;
  count: number;
  instruction: string | null;
  topic: string | null;
  productName: string | null;
  sourceExcerpt: string | null;
  sourceUrl: string | null;
  phaseTitle: string | null;
  phaseNarrative: string | null;
  /** Learned rules the analytics package wants applied to this generation. */
  insights: string[];
}

/**
 * The brief is the single source of truth for a generation. Remote models receive it
 * as data in the prompt; the local composer reads the same object. Keeping one shape
 * means "why did it write that?" is always answerable from one record.
 */
export function buildContentBrief(input: ContentBriefInput): Record<string, unknown> {
  const { brain } = input;
  const product =
    brain.products.find((p) => p.name === input.productName) ??
    (input.productName
      ? brain.products.find((p) => p.name.toLowerCase().includes(input.productName!.toLowerCase()))
      : undefined) ??
    brain.products[0];

  const formatMeta = formatProfile(input.format);
  const channelMeta = channelProfile(input.channel);

  return {
    company: brain.identity.companyName,
    category: brain.identity.category,
    oneLiner: brain.identity.oneLiner,
    description: truncate(brain.identity.description, 600),
    audience: brain.identity.audience,
    voice: {
      traits: brain.voice.traits,
      readingLevel: brain.voice.readingLevel,
      summary: brain.voice.personSummary,
      avoid: brain.voice.avoid,
    },
    product: product
      ? {
          name: product.name,
          kind: product.kind,
          description: truncate(product.description, 500),
          benefits: product.benefits.slice(0, 6),
          priceHint: product.priceHint,
          claims: product.claims.slice(0, 6),
          url: product.sourceUrls[0] ?? null,
        }
      : null,
    otherProducts: brain.products.filter((p) => p.name !== product?.name).map((p) => p.name).slice(0, 6),
    offers: brain.offers.slice(0, 4),
    faqs: brain.faqs.slice(0, 6),
    testimonials: brain.testimonials.slice(0, 4),
    preferredCtas: brain.rules.preferredCtas.slice(0, 6),
    prohibitedTerminology: brain.rules.prohibitedTerminology,
    prohibitedClaims: brain.rules.prohibitedClaims,
    regulatoryNotes: brain.rules.regulatoryNotes,
    approvedTerminology: brain.rules.approvedTerminology.slice(0, 12),
    request: {
      format: input.format,
      formatLabel: formatMeta.label,
      formatGuidance: formatMeta.description,
      channel: input.channel,
      channelLabel: channelMeta.label,
      count: input.count,
      segments: formatMeta.segments,
      targetWords: formatMeta.targetWords,
      maxCharacters: channelMeta.maxCharacters,
      maxHashtags: channelMeta.maxHashtags,
      linkAllowedInBody: channelMeta.supportsLinkInBody,
      instruction: input.instruction,
      topic: input.topic,
      sourceUrl: input.sourceUrl,
      sourceExcerpt: input.sourceExcerpt ? truncate(input.sourceExcerpt, 3000) : null,
      phase: input.phaseTitle ? { title: input.phaseTitle, narrative: input.phaseNarrative } : null,
      applyInsights: input.insights,
    },
  };
}

export function contentSystemPrompt(input: ContentBriefInput): string {
  const formatMeta = formatProfile(input.format);
  const channelMeta = channelProfile(input.channel);

  return [
    `You are the copywriter for ${input.brain.identity.companyName}. You write ${channelMeta.label} content that sounds like the brand, not like an AI.`,
    '',
    'Rules that are never broken:',
    '- Every factual claim must trace to the brief. If the brief does not support a number, a guarantee or an outcome, do not write it.',
    '- Never use any prohibited terminology or make any prohibited claim listed in the brief.',
    '- Honour the regulatory notes exactly.',
    `- Stay inside ${channelMeta.maxCharacters === null ? 'a sensible length for the channel' : `${channelMeta.maxCharacters} characters`} including hashtags, and use at most ${channelMeta.maxHashtags} hashtags.`,
    `- Produce ${formatMeta.segments === 1 ? 'a single body' : `${formatMeta.segments} segments`} of roughly ${formatMeta.targetWords} words in total.`,
    channelMeta.supportsLinkInBody ? '' : '- This channel does not support links in the body. Reference the destination in words instead.',
    '',
    'Craft:',
    '- Open on a specific tension the audience actually feels. No "In today\'s world".',
    '- One idea per asset. Assets in the same batch must not repeat each other\'s angle.',
    '- Write at reading level ' + String(input.brain.voice.readingLevel) + ' out of 5.',
    '- End with a concrete next step drawn from the preferred calls to action.',
    '',
    'Return JSON only, matching this shape:',
    '{"assets":[{"title":string,"hook":string,"body":string,"segments":[{"heading":string|null,"body":string,"visualDirection":string|null}],"hashtags":string[],"cta":string|null,"topics":string[]}]}',
  ]
    .filter(Boolean)
    .join('\n');
}
