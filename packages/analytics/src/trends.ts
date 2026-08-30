import type { BrandBrain, Trend } from '@morrowlane/shared';
import { keywords, newId, nowIso } from '@morrowlane/shared';

/**
 * Trend Radar scoring. The spec is explicit that the point is not to chase every trend,
 * so relevance is scored against the Brand Brain and anything below the floor is dropped
 * before a user ever sees it.
 */

export interface TrendCandidate {
  topic: string;
  source: Trend['source'];
  summary: string;
  /** 0–1, how fast the topic is growing wherever it was observed. */
  momentum: number;
  expiresAt?: string | null;
}

export function scoreTrendRelevance(brain: BrandBrain, candidate: TrendCandidate): number {
  const brandVocabulary = new Set([
    ...keywords(
      [
        brain.identity.description,
        brain.identity.oneLiner,
        brain.identity.category,
        ...brain.identity.audience,
        ...brain.terminology,
        ...brain.products.flatMap((product) => [product.name, product.description, ...product.benefits]),
        ...brain.faqs.map((faq) => faq.question),
      ].join(' '),
      60,
    ),
    ...brain.terminology.flatMap((term) => term.toLowerCase().split(' ')),
  ]);

  const candidateWords = keywords(`${candidate.topic} ${candidate.summary}`, 20);
  if (candidateWords.length === 0) return 0;

  let overlap = 0;
  for (const word of candidateWords) if (brandVocabulary.has(word)) overlap += 1;

  const coverage = overlap / candidateWords.length;
  // Exact vocabulary hits in the topic itself matter more than in the summary.
  const topicWords = keywords(candidate.topic, 8);
  const topicHits = topicWords.filter((word) => brandVocabulary.has(word)).length;
  const topicCoverage = topicWords.length > 0 ? topicHits / topicWords.length : 0;

  return Number(Math.min(1, coverage * 0.5 + topicCoverage * 0.5).toFixed(2));
}

export function evaluateTrends(
  brandId: string,
  brain: BrandBrain,
  candidates: TrendCandidate[],
  relevanceFloor = 0.4,
): Trend[] {
  return candidates
    .map((candidate) => ({
      id: newId('trend'),
      brandId,
      topic: candidate.topic,
      source: candidate.source,
      summary: candidate.summary,
      relevance: scoreTrendRelevance(brain, candidate),
      momentum: candidate.momentum,
      expiresAt: candidate.expiresAt ?? null,
      observedAt: nowIso(),
    }))
    .filter((trend) => trend.relevance >= relevanceFloor)
    .sort((a, b) => b.relevance * b.momentum - a.relevance * a.momentum);
}
