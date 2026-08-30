import { describe, expect, it } from 'vitest';
import { mapPostHogEvent } from './posthog.js';

describe('mapPostHogEvent', () => {
  it('maps a purchase into a revenue event with the amount', () => {
    const mapped = mapPostHogEvent({
      event: 'purchase_completed',
      properties: { revenue: 240, currency: 'USD', mwl_content: 'cnt_abc' },
      timestamp: '2026-08-01T10:00:00Z',
    });
    expect(mapped).toEqual({
      stage: 'revenue',
      contentId: 'cnt_abc',
      value: 240,
      currency: 'USD',
      occurredAt: '2026-08-01T10:00:00.000Z',
      metadata: { source: 'posthog', event: 'purchase_completed', distinctId: null },
    });
  });

  it('reads the content id out of a utm_content fallback', () => {
    const mapped = mapPostHogEvent({ event: '$pageview', properties: { utm_content: 'cnt_xyz' } });
    expect(mapped?.stage).toBe('visit');
    expect(mapped?.contentId).toBe('cnt_xyz');
  });

  it('ignores events outside the mapping', () => {
    expect(mapPostHogEvent({ event: 'random_click' })).toBeNull();
  });

  it('counts non-revenue events as 1 regardless of properties', () => {
    expect(mapPostHogEvent({ event: 'lead_created', properties: { value: 900 } })?.value).toBe(1);
  });
});
