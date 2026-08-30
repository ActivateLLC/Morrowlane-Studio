/** Typed reader over the loosely-typed brief object the gateway passes around. */

export interface BriefProduct {
  name: string;
  kind: string;
  description: string;
  benefits: string[];
  priceHint: string | null;
  claims: string[];
  url: string | null;
}

export interface BriefRequest {
  format: string;
  formatLabel: string;
  channel: string;
  channelLabel: string;
  count: number;
  segments: number;
  targetWords: number;
  maxCharacters: number | null;
  maxHashtags: number;
  linkAllowedInBody: boolean;
  instruction: string | null;
  topic: string | null;
  sourceUrl: string | null;
  sourceExcerpt: string | null;
  phase: { title: string; narrative: string | null } | null;
  applyInsights: string[];
}

export interface BriefView {
  company: string;
  category: string;
  oneLiner: string;
  description: string;
  audience: string[];
  voiceTraits: string[];
  product: BriefProduct | null;
  offers: string[];
  faqs: Array<{ question: string; answer: string }>;
  testimonials: Array<{ quote: string; attribution: string | null }>;
  preferredCtas: string[];
  approvedTerminology: string[];
  request: BriefRequest;
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function strArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0) : [];
}

function obj(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function readBrief(brief: Record<string, unknown>): BriefView {
  const request = obj(brief['request']);
  const voice = obj(brief['voice']);
  const productRaw = brief['product'];

  const product = productRaw
    ? (() => {
        const p = obj(productRaw);
        return {
          name: str(p['name'], 'our offering'),
          kind: str(p['kind'], 'product'),
          description: str(p['description']),
          benefits: strArray(p['benefits']),
          priceHint: typeof p['priceHint'] === 'string' ? p['priceHint'] : null,
          claims: strArray(p['claims']),
          url: typeof p['url'] === 'string' ? p['url'] : null,
        } satisfies BriefProduct;
      })()
    : null;

  const phaseRaw = request['phase'];
  const phase = phaseRaw
    ? (() => {
        const p = obj(phaseRaw);
        return { title: str(p['title']), narrative: typeof p['narrative'] === 'string' ? p['narrative'] : null };
      })()
    : null;

  return {
    company: str(brief['company'], 'The company'),
    category: str(brief['category']),
    oneLiner: str(brief['oneLiner']),
    description: str(brief['description']),
    audience: strArray(brief['audience']),
    voiceTraits: strArray(voice['traits']),
    product,
    offers: strArray(brief['offers']),
    faqs: Array.isArray(brief['faqs'])
      ? (brief['faqs'] as unknown[]).map(obj).map((f) => ({ question: str(f['question']), answer: str(f['answer']) })).filter((f) => f.question)
      : [],
    testimonials: Array.isArray(brief['testimonials'])
      ? (brief['testimonials'] as unknown[])
          .map(obj)
          .map((t) => ({ quote: str(t['quote']), attribution: typeof t['attribution'] === 'string' ? t['attribution'] : null }))
          .filter((t) => t.quote)
      : [],
    preferredCtas: strArray(brief['preferredCtas']),
    approvedTerminology: strArray(brief['approvedTerminology']),
    request: {
      format: str(request['format'], 'instagram_post'),
      formatLabel: str(request['formatLabel'], 'post'),
      channel: str(request['channel'], 'instagram'),
      channelLabel: str(request['channelLabel'], 'Instagram'),
      count: num(request['count'], 1),
      segments: num(request['segments'], 1),
      targetWords: num(request['targetWords'], 100),
      maxCharacters: typeof request['maxCharacters'] === 'number' ? request['maxCharacters'] : null,
      maxHashtags: num(request['maxHashtags'], 3),
      linkAllowedInBody: request['linkAllowedInBody'] !== false,
      instruction: typeof request['instruction'] === 'string' ? request['instruction'] : null,
      topic: typeof request['topic'] === 'string' ? request['topic'] : null,
      sourceUrl: typeof request['sourceUrl'] === 'string' ? request['sourceUrl'] : null,
      sourceExcerpt: typeof request['sourceExcerpt'] === 'string' ? request['sourceExcerpt'] : null,
      phase,
      applyInsights: strArray(request['applyInsights']),
    },
  };
}
