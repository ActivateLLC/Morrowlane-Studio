import type { PageType } from '@morrowlane/shared';
import { pathSegments } from '@morrowlane/shared';

interface Signal {
  type: PageType;
  weight: number;
}

const PATH_PATTERNS: Array<{ pattern: RegExp; type: PageType; weight: number }> = [
  { pattern: /^(products?|shop|store|item|collections?)$/i, type: 'product', weight: 3 },
  { pattern: /^(services?|solutions?|what-we-do|capabilities)$/i, type: 'service', weight: 3 },
  { pattern: /^(pricing|plans?|packages?|cost|rates?)$/i, type: 'pricing', weight: 4 },
  { pattern: /^(faqs?|help|support|questions)$/i, type: 'faq', weight: 4 },
  { pattern: /^(testimonials?|reviews?|case-stud(y|ies)|success-stories|customers)$/i, type: 'testimonial', weight: 4 },
  { pattern: /^(about|about-us|our-story|team|company|mission)$/i, type: 'about', weight: 4 },
  { pattern: /^(contact|contact-us|get-in-touch|book|demo)$/i, type: 'contact', weight: 4 },
  { pattern: /^(blog|news|articles?|insights?|resources?|guides?|learn)$/i, type: 'article', weight: 3 },
  { pattern: /^(lp|landing|offer|promo|campaign|get|start|signup|sign-up)$/i, type: 'landing', weight: 3 },
  { pattern: /^(privacy|terms|legal|cookie|disclosures?|accessibility|dmca)$/i, type: 'legal', weight: 5 },
];

const TEXT_PATTERNS: Array<{ pattern: RegExp; type: PageType; weight: number }> = [
  { pattern: /\b(per month|\/mo\b|billed annually|free plan|starting at \$|choose your plan)\b/i, type: 'pricing', weight: 3 },
  { pattern: /\b(frequently asked questions|common questions)\b/i, type: 'faq', weight: 3 },
  { pattern: /\b(what our customers say|testimonial|rated \d(\.\d)? out of)\b/i, type: 'testimonial', weight: 2 },
  { pattern: /\b(our mission|founded in|our team|we believe)\b/i, type: 'about', weight: 2 },
  { pattern: /\b(contact us|email us|call us|office hours|schedule a call)\b/i, type: 'contact', weight: 2 },
  { pattern: /\b(add to cart|buy now|in stock|sku\b|free shipping)\b/i, type: 'product', weight: 3 },
];

export interface ClassificationInput {
  url: string;
  origin: string;
  title: string | null;
  headings: string[];
  text: string;
  structuredDataTypes: string[];
  wordCount: number;
  hasPublishedDate: boolean;
}

export interface Classification {
  pageType: PageType;
  confidence: number;
}

/**
 * Page type drives everything downstream: a pricing page becomes offer knowledge,
 * an article becomes remix inventory. Guessing badly is worse than guessing "other",
 * so confidence is reported and low-confidence pages are re-checked by the analyst agent.
 */
export function classifyPage(input: ClassificationInput): Classification {
  const segments = pathSegments(input.url);
  if (segments.length === 0) return { pageType: 'homepage', confidence: 0.98 };

  const signals: Signal[] = [];

  for (const [index, segment] of segments.entries()) {
    for (const { pattern, type, weight } of PATH_PATTERNS) {
      if (pattern.test(segment)) {
        // A match in the first segment is a stronger statement than one deep in a path.
        signals.push({ type, weight: index === 0 ? weight : weight * 0.6 });
      }
    }
  }

  const haystack = `${input.title ?? ''} ${input.headings.join(' ')} ${input.text.slice(0, 4000)}`;
  for (const { pattern, type, weight } of TEXT_PATTERNS) {
    if (pattern.test(haystack)) signals.push({ type, weight });
  }

  for (const schemaType of input.structuredDataTypes) {
    const normalized = schemaType.toLowerCase();
    if (normalized === 'product' || normalized === 'offer') signals.push({ type: 'product', weight: 5 });
    else if (normalized === 'service') signals.push({ type: 'service', weight: 5 });
    else if (normalized === 'faqpage') signals.push({ type: 'faq', weight: 6 });
    else if (normalized === 'blogposting' || normalized === 'article' || normalized === 'newsarticle') {
      signals.push({ type: 'article', weight: 6 });
    } else if (normalized === 'aboutpage') signals.push({ type: 'about', weight: 5 });
    else if (normalized === 'contactpage') signals.push({ type: 'contact', weight: 5 });
    else if (normalized === 'review') signals.push({ type: 'testimonial', weight: 4 });
  }

  // A dated, long page under a content path is almost always editorial.
  if (input.hasPublishedDate && input.wordCount > 350) signals.push({ type: 'article', weight: 2 });

  if (signals.length === 0) return { pageType: 'other', confidence: 0.3 };

  const totals = new Map<PageType, number>();
  for (const signal of signals) totals.set(signal.type, (totals.get(signal.type) ?? 0) + signal.weight);

  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const [topType, topScore] = ranked[0]!;
  const runnerUpScore = ranked[1]?.[1] ?? 0;
  const total = ranked.reduce((sum, [, score]) => sum + score, 0);

  // Confidence blends share-of-signal with the margin over the runner-up.
  const share = topScore / total;
  const margin = (topScore - runnerUpScore) / topScore;
  const confidence = Math.min(0.97, 0.4 + share * 0.35 + margin * 0.25);

  return { pageType: topType, confidence: Number(confidence.toFixed(2)) };
}
