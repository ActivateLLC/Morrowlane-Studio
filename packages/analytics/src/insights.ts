import type { ContentFormat, Insight } from '@morrowlane/shared';
import { CONTENT_FORMATS, formatProfile, newId, nowIso } from '@morrowlane/shared';
import type { ContentPerformance } from './attribution.js';

/**
 * Turns performance into rules the content engine can act on. The bar is deliberately
 * high: a comparison needs enough posts on both sides and a large enough gap before it
 * is stated as fact, because a confident wrong insight quietly degrades every future
 * campaign that applies it.
 */

export type MetricKey = 'qualifiedVisits' | 'leads' | 'revenue' | 'engagementRate' | 'clickRate';

const METRIC_LABELS: Record<MetricKey, string> = {
  qualifiedVisits: 'qualified traffic',
  leads: 'leads',
  revenue: 'revenue',
  engagementRate: 'engagement',
  clickRate: 'click-throughs',
};

export interface InsightOptions {
  /** Minimum posts on each side of a comparison. */
  minSampleSize?: number;
  /** Minimum multiple before a difference is worth telling anyone about. */
  minLift?: number;
  metric?: MetricKey;
  maxInsights?: number;
}

export function metricValue(row: ContentPerformance, metric: MetricKey): number {
  switch (metric) {
    case 'qualifiedVisits':
      return row.qualifiedVisits;
    case 'leads':
      return row.totals.lead;
    case 'revenue':
      return row.totals.revenue;
    case 'engagementRate':
      return row.totals.impression > 0 ? row.totals.engagement / row.totals.impression : 0;
    case 'clickRate':
      return row.totals.impression > 0 ? row.totals.click / row.totals.impression : 0;
  }
}

export function computeInsights(
  brandId: string,
  performance: ContentPerformance[],
  options: InsightOptions = {},
): Insight[] {
  const minSampleSize = options.minSampleSize ?? 4;
  const minLift = options.minLift ?? 1.3;
  const metric = options.metric ?? 'qualifiedVisits';
  const maxInsights = options.maxInsights ?? 12;

  // Content with no impressions has not had a chance to perform yet.
  const measured = performance.filter((row) => row.totals.impression > 0);
  if (measured.length < minSampleSize * 2) return [];

  const dimensions: Array<{ name: string; key: (row: ContentPerformance) => string | null; label: (key: string) => string }> = [
    { name: 'format', key: (row) => row.format, label: (key) => formatProfile(key as ContentFormat).label.toLowerCase() },
    { name: 'channel', key: (row) => row.channel, label: (key) => key },
    { name: 'topic', key: (row) => row.topics[0] ?? null, label: (key) => key },
  ];

  const insights = dimensions.flatMap((dimension) =>
    compareWithinDimension(brandId, dimension.name, measured, metric, {
      minSampleSize,
      minLift,
      key: dimension.key,
      label: dimension.label,
    }),
  );

  return insights
    .sort((a, b) => b.confidence * b.lift - a.confidence * a.lift)
    .slice(0, maxInsights);
}

interface CompareOptions {
  minSampleSize: number;
  minLift: number;
  key: (row: ContentPerformance) => string | null;
  label: (key: string) => string;
}

function compareWithinDimension(
  brandId: string,
  dimension: string,
  rows: ContentPerformance[],
  metric: MetricKey,
  options: CompareOptions,
): Insight[] {
  const groups = new Map<string, number[]>();
  for (const row of rows) {
    const key = options.key(row);
    if (!key) continue;
    const bucket = groups.get(key);
    const value = metricValue(row, metric);
    if (bucket) bucket.push(value);
    else groups.set(key, [value]);
  }

  const eligible = [...groups.entries()]
    .filter(([, values]) => values.length >= options.minSampleSize)
    .map(([key, values]) => ({ key, values, mean: mean(values) }))
    .sort((a, b) => b.mean - a.mean);

  // A comparison needs two sides. One group on its own says nothing.
  if (eligible.length < 2) return [];

  const best = eligible[0]!;
  const worst = eligible[eligible.length - 1]!;
  if (worst.mean <= 0 || best.mean <= 0) return [];

  const lift = best.mean / worst.mean;
  if (lift < options.minLift) return [];

  const confidence = confidenceFor(best.values, worst.values);
  const roundedLift = Number(lift.toFixed(1));

  return [
    {
      id: newId('insight'),
      brandId,
      dimension,
      subject: options.label(best.key),
      comparison: options.label(worst.key),
      lift: roundedLift,
      metric,
      sampleSize: best.values.length + worst.values.length,
      confidence,
      statement: `${sentenceCase(options.label(best.key))} generate ${roundedLift}× more ${METRIC_LABELS[metric]} than ${options.label(worst.key)}.`,
      applied: false,
      createdAt: nowIso(),
    },
  ];
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function variance(values: number[]): number {
  if (values.length < 2) return 0;
  const average = mean(values);
  return values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
}

/**
 * Welch's t statistic mapped into 0–1. This is a ranking signal, not a p-value: it keeps
 * a two-sample fluke below a consistent difference, which is all the UI needs to decide
 * what to show first and whether to offer "Apply insight".
 */
function confidenceFor(a: number[], b: number[]): number {
  const varianceA = variance(a);
  const varianceB = variance(b);
  const standardError = Math.sqrt(varianceA / a.length + varianceB / b.length);
  if (standardError === 0) {
    // Identical within groups but different between them: believable, not certain.
    return mean(a) === mean(b) ? 0 : 0.75;
  }
  const t = Math.abs(mean(a) - mean(b)) / standardError;
  const sampleBonus = Math.min(1, (a.length + b.length) / 30);
  return Number(Math.min(0.95, (t / (t + 2.5)) * 0.8 + sampleBonus * 0.15).toFixed(2));
}

function sentenceCase(value: string): string {
  return value ? value[0]!.toUpperCase() + value.slice(1) : value;
}

/**
 * The "Apply Insight" action: turns accepted insights into concrete generation
 * preferences, so the next campaign is shaped by what actually worked.
 */
export interface AppliedPreferences {
  preferredFormats: ContentFormat[];
  preferredChannels: string[];
  preferredTopics: string[];
  /** Passed into the generation brief so the model is told what has been working. */
  guidance: string[];
  appliedInsightIds: string[];
}

export function applyInsights(insights: Insight[]): AppliedPreferences {
  const applied = insights.filter((insight) => insight.applied);

  return {
    preferredFormats: applied
      .filter((insight) => insight.dimension === 'format')
      .map((insight) => formatIdFromLabel(insight.subject))
      .filter((format): format is ContentFormat => format !== null),
    preferredChannels: applied.filter((i) => i.dimension === 'channel').map((i) => i.subject),
    preferredTopics: applied.filter((i) => i.dimension === 'topic').map((i) => i.subject),
    guidance: applied.map((insight) => insight.statement),
    appliedInsightIds: applied.map((insight) => insight.id),
  };
}

function formatIdFromLabel(label: string): ContentFormat | null {
  const normalized = label.trim().toLowerCase();
  return CONTENT_FORMATS.find((format) => formatProfile(format).label.toLowerCase() === normalized) ?? null;
}
