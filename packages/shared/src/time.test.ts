import { describe, expect, it } from 'vitest';
import { addDays, atHour, dayKey, dayRange, startOfUtcDay } from './time.js';

describe('time helpers', () => {
  it('adds days across month boundaries', () => {
    expect(dayKey(addDays('2026-01-30T12:00:00.000Z', 3))).toBe('2026-02-02');
  });

  it('produces an inclusive day range', () => {
    expect(dayRange('2026-03-01T09:30:00.000Z', 3)).toEqual(['2026-03-01', '2026-03-02', '2026-03-03']);
  });

  it('normalizes to the start of the UTC day', () => {
    expect(startOfUtcDay('2026-03-01T23:59:00.000Z')).toBe('2026-03-01T00:00:00.000Z');
  });

  it('pins a slot to an hour of a given day', () => {
    expect(atHour('2026-03-01T23:59:00.000Z', 9, 30)).toBe('2026-03-01T09:30:00.000Z');
  });
});
