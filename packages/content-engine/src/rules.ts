import type { BrandRules, Channel, ContentFormat, RuleViolation } from '@morrowlane/shared';
import { channelProfile, formatProfile, truncate } from '@morrowlane/shared';

export interface RuleCheckInput {
  channel: Channel;
  format: ContentFormat;
  body: string;
  hook: string;
  segments: Array<{ body: string }>;
  hashtags: string[];
  cta: string | null;
  rules: BrandRules;
}

/**
 * Runs before anything can be approved. Regulated businesses are the hard case:
 * "guaranteed approval" in a credit ad is a compliance incident, not a typo, so a
 * prohibited claim is an error and blocks approval rather than warning.
 */
export function checkRules(input: RuleCheckInput): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const fullText = [input.hook, input.body, ...input.segments.map((s) => s.body)].join('\n');
  const haystack = fullText.toLowerCase();

  for (const term of input.rules.prohibitedTerminology) {
    const needle = term.trim().toLowerCase();
    if (!needle) continue;
    if (containsPhrase(haystack, needle)) {
      violations.push({
        rule: 'prohibited_terminology',
        severity: 'error',
        message: `Uses prohibited terminology: "${term}".`,
        excerpt: excerptAround(fullText, needle),
      });
    }
  }

  for (const claim of input.rules.prohibitedClaims) {
    const needle = claim.trim().toLowerCase();
    if (!needle) continue;
    if (containsPhrase(haystack, needle)) {
      violations.push({
        rule: 'prohibited_claim',
        severity: 'error',
        message: `Makes a prohibited claim: "${claim}".`,
        excerpt: excerptAround(fullText, needle),
      });
    }
  }

  const profile = channelProfile(input.channel);
  const rendered = renderForChannel(input.body, input.hashtags);
  if (profile.maxCharacters !== null && rendered.length > profile.maxCharacters) {
    violations.push({
      rule: 'length',
      severity: 'error',
      message: `${rendered.length} characters exceeds the ${profile.label} limit of ${profile.maxCharacters}.`,
      excerpt: truncate(rendered.slice(profile.maxCharacters - 40), 120),
    });
  }

  if (input.hashtags.length > profile.maxHashtags) {
    violations.push({
      rule: 'hashtag_limit',
      severity: 'warning',
      message: `${input.hashtags.length} hashtags is above the ${profile.label} guideline of ${profile.maxHashtags}.`,
      excerpt: input.hashtags.slice(profile.maxHashtags).join(' '),
    });
  }

  // Every asset should ask for something; a post with no next step cannot convert.
  const formatMeta = formatProfile(input.format);
  if (!input.cta && formatMeta.costTier === 'text' && formatMeta.medium === 'text') {
    violations.push({
      rule: 'missing_cta',
      severity: 'warning',
      message: 'No call to action. Readers have nothing to do next.',
      excerpt: null,
    });
  }

  return violations;
}

export function hasBlockingViolation(violations: RuleViolation[]): boolean {
  return violations.some((violation) => violation.severity === 'error');
}

/** What the platform actually counts: body plus the hashtag block appended to it. */
export function renderForChannel(body: string, hashtags: string[]): string {
  const tags = hashtags.filter(Boolean).map((tag) => (tag.startsWith('#') ? tag : `#${tag}`));
  return tags.length > 0 ? `${body}\n\n${tags.join(' ')}` : body;
}

function containsPhrase(haystack: string, needle: string): boolean {
  // Word-boundary matching so "loan" does not fire on "loaner" or "sloane".
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(haystack);
}

function excerptAround(text: string, needle: string): string | null {
  const index = text.toLowerCase().indexOf(needle);
  if (index === -1) return null;
  const start = Math.max(0, index - 40);
  return truncate(text.slice(start, index + needle.length + 40), 120);
}
