import { collapseWhitespace, keywords, titleCase, truncate } from '@morrowlane/shared';
import type { BrandBrainDraft } from '@morrowlane/content-engine';

/**
 * Local composition of a Brand Brain from crawl evidence alone. Runs when no model
 * provider is configured, so onboarding still produces a reviewable profile.
 */
export function composeBrandBrain(brief: Record<string, unknown>): BrandBrainDraft {
  const observed = record(brief['observed']);
  const pages = record(brief['pages']);

  const companyName = str(observed['companyName'], 'Your brand');
  const description = str(observed['description']);
  const oneLiner = str(observed['oneLiner'], truncate(description, 140));
  const corpus = buildCorpus(observed, pages);

  const products = arr(observed['products']).map(record).map((p) => ({
    name: str(p['name'], 'Untitled'),
    kind: (str(p['kind'], 'product') === 'service' ? 'service' : 'product') as 'product' | 'service',
    description: str(p['description']),
    benefits: strArr(p['benefits']),
    audience: [] as string[],
    priceHint: typeof p['priceHint'] === 'string' ? p['priceHint'] : null,
    sourceUrls: typeof p['url'] === 'string' ? [p['url']] : [],
    imageUrls: [] as string[],
    claims: [] as string[],
    ctas: [] as string[],
  }));

  return {
    identity: {
      companyName,
      category: inferCategory(corpus),
      oneLiner,
      description: truncate(description, 900),
      audience: inferAudience(corpus),
      industries: inferCategory(corpus) ? [inferCategory(corpus)] : [],
      locations: strArr(observed['locations']),
    },
    voice: {
      traits: inferVoiceTraits(corpus),
      readingLevel: inferReadingLevel(corpus),
      personSummary: `Writes to ${inferAudience(corpus)[0] ?? 'its customers'} in plain, direct language.`,
      sampleSentences: sampleSentences(corpus),
      avoid: ['jargon the customer would not use', 'hype without evidence'],
    },
    products,
    offers: strArr(observed['offers']),
    terminology: strArr(observed['terminology']),
    rules: {
      approvedTerminology: strArr(observed['terminology']).slice(0, 10),
      prohibitedTerminology: [],
      approvedClaims: [],
      prohibitedClaims: [],
      regulatoryNotes: [],
      preferredCtas: strArr(observed['ctas']).slice(0, 6),
      visualGuidelines: buildVisualGuidelines(strArr(observed['colors'])),
    },
    notes: [
      'Profile built from crawl evidence without a language model. Configure an AI provider for a richer read of voice and audience.',
    ],
  };
}

const CATEGORY_RULES: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(credit score|credit building|credit builder|bureau|fico|lending|loan|banking|fintech|payments?)\b/i, label: 'Financial technology' },
  { pattern: /\b(supplement|wellness|clinic|patient|therapy|nutrition)\b/i, label: 'Health and wellness' },
  { pattern: /\b(attorney|law firm|lawyer|litigation)\b/i, label: 'Legal services' },
  { pattern: /\b(real estate|realtor|listing|mortgage|homebuyer)\b/i, label: 'Real estate' },
  { pattern: /\b(saas|software|platform|api|dashboard|integration)\b/i, label: 'Software' },
  { pattern: /\b(agency|marketing|branding|creative studio)\b/i, label: 'Marketing services' },
  { pattern: /\b(restaurant|menu|catering|cafe|bakery)\b/i, label: 'Food and beverage' },
  { pattern: /\b(course|curriculum|students?|training|bootcamp)\b/i, label: 'Education' },
  { pattern: /\b(shipping|returns|add to cart|sizes?|collection)\b/i, label: 'Ecommerce' },
];

function inferCategory(corpus: string): string {
  return CATEGORY_RULES.find((rule) => rule.pattern.test(corpus))?.label ?? 'General business';
}

const AUDIENCE_RULES: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(first[- ]time homebuyer)/i, label: 'first-time homebuyers' },
  { pattern: /\b(small business(es)?|smb)\b/i, label: 'small business owners' },
  { pattern: /\b(enterprise|procurement|compliance team)\b/i, label: 'enterprise buyers' },
  { pattern: /\b(credit score|credit building|build credit)\b/i, label: 'consumers building credit' },
  { pattern: /\b(students?|learners?)\b/i, label: 'students' },
  { pattern: /\b(founders?|startups?)\b/i, label: 'founders' },
  { pattern: /\b(parents?|famil(y|ies))\b/i, label: 'families' },
  { pattern: /\b(marketers?|marketing teams?)\b/i, label: 'marketers' },
];

function inferAudience(corpus: string): string[] {
  const found = AUDIENCE_RULES.filter((rule) => rule.pattern.test(corpus)).map((rule) => rule.label);
  return found.length > 0 ? found.slice(0, 3) : ['their customers'];
}

const VOICE_RULES: Array<{ pattern: RegExp; trait: string }> = [
  { pattern: /\b(plain[- ]english|in plain language|simply put|no jargon|straightforward)\b/i, trait: 'clear' },
  { pattern: /\b(we believe|our mission|we think)\b/i, trait: 'confident' },
  { pattern: /\b(you can|here is how|let us|we are here)\b/i, trait: 'approachable' },
  { pattern: /\b(learn|understand|explain|guide|how it works)\b/i, trait: 'educational' },
  { pattern: /\b(certified|regulated|compliance|licensed|secure)\b/i, trait: 'trustworthy' },
  { pattern: /\b(fast|instantly|in minutes|quick)\b/i, trait: 'energetic' },
];

function inferVoiceTraits(corpus: string): string[] {
  const traits = VOICE_RULES.filter((rule) => rule.pattern.test(corpus)).map((rule) => rule.trait);
  return traits.length > 0 ? [...new Set(traits)].slice(0, 5) : ['clear', 'direct'];
}

/** Average sentence and word length is a crude but stable readability proxy. */
function inferReadingLevel(corpus: string): number {
  const sentences = corpus.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  if (sentences.length === 0) return 3;
  const words = corpus.split(/\s+/).filter(Boolean);
  const wordsPerSentence = words.length / sentences.length;
  const longWords = words.filter((w) => w.replace(/[^a-z]/gi, '').length >= 9).length / Math.max(1, words.length);
  const score = wordsPerSentence / 12 + longWords * 6;
  return Math.max(1, Math.min(5, Math.round(score)));
}

function sampleSentences(corpus: string): string[] {
  return corpus
    .split(/(?<=[.!?])\s+/)
    .map(collapseWhitespace)
    .filter((s) => s.length >= 45 && s.length <= 180)
    .slice(0, 4);
}

function buildVisualGuidelines(colors: string[]): string[] {
  if (colors.length === 0) return [];
  const guidelines = [`Primary colour ${colors[0]}.`];
  if (colors.length > 1) guidelines.push(`Supporting palette: ${colors.slice(1, 4).join(', ')}.`);
  return guidelines;
}

function buildCorpus(observed: Record<string, unknown>, pages: Record<string, unknown>): string {
  const parts: string[] = [
    str(observed['description']),
    str(observed['oneLiner']),
    strArr(observed['terminology']).join(' '),
    strArr(observed['offers']).join(' '),
  ];

  for (const key of ['homepage', 'about', 'pricing', 'products', 'services']) {
    for (const page of arr(pages[key]).map(record)) {
      parts.push(str(page['title']), strArr(page['headings']).join(' '), str(page['excerpt']));
    }
  }

  for (const product of arr(observed['products']).map(record)) {
    parts.push(str(product['name']), str(product['description']), strArr(product['benefits']).join(' '));
  }

  for (const faq of arr(observed['faqs']).map(record)) {
    parts.push(str(faq['question']), str(faq['answer']));
  }

  return collapseWhitespace(parts.filter(Boolean).join(' '));
}

/** Exported so the brand builder can reuse the same corpus for compliance detection. */
export function corpusFromBrief(brief: Record<string, unknown>): string {
  return buildCorpus(record(brief['observed']), record(brief['pages']));
}

export function topicsFromCorpus(corpus: string, limit = 10): string[] {
  return keywords(corpus, limit).map(titleCase);
}

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
