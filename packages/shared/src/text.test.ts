import { describe, expect, it } from 'vitest';
import { keywords, slugify, truncate, wordCount } from './text.js';

describe('text helpers', () => {
  it('slugifies to url-safe tokens', () => {
    expect(slugify('  Orca Credit — Builder Plan!  ')).toBe('orca-credit-builder-plan');
  });

  it('truncates on a character budget with an ellipsis', () => {
    expect(truncate('one two three four', 9)).toBe('one two…');
    expect(truncate('short', 40)).toBe('short');
  });

  it('counts words after collapsing whitespace', () => {
    expect(wordCount('  a  b \n c ')).toBe(3);
    expect(wordCount('   ')).toBe(0);
  });

  it('extracts frequent non-stopword terms', () => {
    const text = 'Credit building helps credit scores. Credit reports matter for building credit.';
    expect(keywords(text, 2)).toEqual(['credit', 'building']);
  });
});
