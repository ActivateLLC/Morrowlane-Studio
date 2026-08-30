import type { BrandRules } from '@morrowlane/shared';
import { describe, expect, it } from 'vitest';
import { checkRules, hasBlockingViolation, renderForChannel } from './rules.js';

const rules: BrandRules = {
  approvedTerminology: ['credit builder'],
  prohibitedTerminology: ['loan'],
  approvedClaims: ['reports to all three bureaus'],
  prohibitedClaims: ['guaranteed approval'],
  regulatoryNotes: [],
  preferredCtas: ['Get started'],
  visualGuidelines: [],
};

const base = {
  channel: 'instagram' as const,
  format: 'instagram_post' as const,
  hook: 'Build credit.',
  segments: [],
  hashtags: ['#credit'],
  cta: 'Get started',
  rules,
};

describe('checkRules', () => {
  it('passes clean copy', () => {
    const violations = checkRules({ ...base, body: 'Our credit builder reports to all three bureaus.' });
    expect(violations).toEqual([]);
  });

  it('blocks prohibited terminology as an error', () => {
    const violations = checkRules({ ...base, body: 'This is a loan you can afford.' });
    expect(violations[0]?.rule).toBe('prohibited_terminology');
    expect(hasBlockingViolation(violations)).toBe(true);
  });

  it('does not fire on a word that merely contains the term', () => {
    const violations = checkRules({ ...base, body: 'Ask about our loaner card programme.' });
    expect(violations).toEqual([]);
  });

  it('blocks a prohibited claim wherever it appears, including in segments', () => {
    const violations = checkRules({
      ...base,
      body: 'Clean body.',
      segments: [{ body: 'Guaranteed approval for everyone.' }],
    });
    expect(violations.some((v) => v.rule === 'prohibited_claim')).toBe(true);
  });

  it('counts hashtags toward the character ceiling', () => {
    const violations = checkRules({
      ...base,
      channel: 'x',
      format: 'x_post',
      body: 'a'.repeat(275),
      hashtags: ['#credit', '#score'],
    });
    expect(violations.some((v) => v.rule === 'length')).toBe(true);
  });

  it('warns rather than blocks on too many hashtags', () => {
    const violations = checkRules({ ...base, body: 'Short.', hashtags: Array.from({ length: 20 }, (_, i) => `#t${i}`) });
    const hashtagViolation = violations.find((v) => v.rule === 'hashtag_limit');
    expect(hashtagViolation?.severity).toBe('warning');
    expect(hasBlockingViolation(violations)).toBe(false);
  });

  it('warns when a text asset has no call to action', () => {
    const violations = checkRules({ ...base, body: 'Short.', cta: null });
    expect(violations.some((v) => v.rule === 'missing_cta')).toBe(true);
  });
});

describe('renderForChannel', () => {
  it('appends hashtags the way platforms count them', () => {
    expect(renderForChannel('Body', ['credit', '#score'])).toBe('Body\n\n#credit #score');
    expect(renderForChannel('Body', [])).toBe('Body');
  });
});
