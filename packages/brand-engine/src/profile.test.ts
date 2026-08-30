import { LOCAL_COMPOSERS, createGateway } from '@morrowlane/content-engine';
import { describe, expect, it } from 'vitest';
import { buildBrandFromProfile } from './profile.js';
import { BRAND_COMPOSERS } from './registry.js';

const gateway = createGateway({ composers: { ...LOCAL_COMPOSERS, ...BRAND_COMPOSERS } });

describe('buildBrandFromProfile', () => {
  it('builds a valid Brand Brain from the Brand Builder answers, no crawl', async () => {
    const brain = await buildBrandFromProfile(gateway, {
      brandId: 'brd_manual',
      businessName: 'Maple & Oak Bakery',
      whatYouSell: 'Handmade sourdough bread and pastries baked fresh every morning.',
      audience: 'Local families and weekend brunch lovers',
      desiredAction: 'visit',
      contactChannels: ['@mapleoak on Instagram', '(555) 010-2020', '123 Main St'],
      brandFeel: 'warm',
    });

    expect(brain.brandId).toBe('brd_manual');
    expect(brain.identity.companyName).toBe('Maple & Oak Bakery');
    expect(brain.sourcePageCount).toBe(0);
    expect(brain.products.length).toBeGreaterThan(0);

    // Answers are ground truth: audience, brand feel and desired-action CTA come through.
    expect(brain.identity.audience).toContain('Local families and weekend brunch lovers');
    expect(brain.voice.traits).toContain('warm');
    expect(brain.rules.preferredCtas).toContain('Visit us');

    // Contact channels split into handles/links vs. a physical location.
    expect(brain.socialLinks).toContain('@mapleoak on Instagram');
    expect(brain.identity.locations).toContain('123 Main St');
    expect(brain.completeness).toBeGreaterThan(0);
  });

  it('still fires compliance presets on a regulated business typed by hand', async () => {
    const brain = await buildBrandFromProfile(gateway, {
      brandId: 'brd_fin',
      businessName: 'Orca Credit',
      whatYouSell: 'A secured credit builder card that reports on-time payments to all three credit bureaus.',
      desiredAction: 'subscribe',
    });

    expect(brain.notes.some((n) => /Compliance preset/i.test(n))).toBe(true);
    expect(brain.rules.prohibitedClaims.length).toBeGreaterThan(0);
    expect(brain.rules.preferredCtas).toContain('Subscribe');
  });
});
