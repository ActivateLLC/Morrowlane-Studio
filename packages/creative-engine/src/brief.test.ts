import type { BrandBrain, ContentItem } from '@morrowlane/shared';
import { newId, nowIso } from '@morrowlane/shared';
import { describe, expect, it } from 'vitest';
import { buildRenderRequests } from './brief.js';

const brain = {
  brandId: 'brd_1',
  version: 1,
  identity: { companyName: 'Orca', category: 'Financial technology', oneLiner: '', description: '', audience: [], industries: [], locations: [] },
  voice: { traits: ['clear', 'confident'], readingLevel: 2, personSummary: '', sampleSentences: [], avoid: [] },
  products: [],
  offers: [],
  faqs: [],
  testimonials: [],
  visuals: { logoUrls: ['https://cdn/logo.svg'], colors: ['#1b6ef3'], imageUrls: [], fontHints: [] },
  rules: { approvedTerminology: [], prohibitedTerminology: [], approvedClaims: [], prohibitedClaims: [], regulatoryNotes: [], preferredCtas: [], visualGuidelines: ['Primary colour #1b6ef3.'] },
  terminology: [],
  socialLinks: [],
  notes: [],
  completeness: 1,
  sourcePageCount: 1,
  generatedAt: nowIso(),
  lockedFields: [],
} satisfies BrandBrain;

function item(over: Partial<ContentItem>): ContentItem {
  return {
    id: newId('content'),
    brandId: 'brd_1',
    campaignId: null,
    campaignPhaseId: null,
    format: 'instagram_carousel',
    channel: 'instagram',
    status: 'approved',
    title: 'Title',
    hook: 'Hook',
    body: 'Body',
    segments: [],
    hashtags: [],
    cta: null,
    linkUrl: null,
    mediaAssetIds: [],
    topics: [],
    lineage: { sourceType: 'brand', sourceUrl: null, sourceId: null, instruction: null, parentContentId: null, appliedInsightIds: [] },
    violations: [],
    model: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    ...over,
  };
}

describe('buildRenderRequests', () => {
  it('produces nothing for text formats', () => {
    expect(buildRenderRequests(item({ format: 'linkedin_post' }), brain)).toEqual([]);
  });

  it('produces one image request per carousel slide, carrying brand assets', () => {
    const carousel = item({
      segments: [0, 1, 2].map((index) => ({ index, heading: `S${index}`, body: `Slide ${index}`, visualDirection: 'big type' })),
    });
    const requests = buildRenderRequests(carousel, brain);
    expect(requests).toHaveLength(3);
    expect(requests.every((request) => request.kind === 'image')).toBe(true);
    const first = requests[0]!;
    expect(first.kind === 'image' && first.brandColor).toBe('#1b6ef3');
    expect(first.kind === 'image' && first.slideIndex).toBe(0);
    expect(first.kind === 'image' && first.prompt).toContain('big type');
  });

  it('produces one vertical video request with paced beats', () => {
    const video = item({
      format: 'tiktok_script',
      segments: [0, 1, 2].map((index) => ({ index, heading: null, body: `Beat ${index}`, visualDirection: null })),
    });
    const requests = buildRenderRequests(video, brain);
    expect(requests).toHaveLength(1);
    const request = requests[0]!;
    expect(request.kind).toBe('video');
    if (request.kind === 'video') {
      expect(request.height).toBe(1920);
      expect(request.beats[0]!.durationSeconds).toBeLessThan(request.beats[1]!.durationSeconds);
    }
  });

  it('falls back to the hook when an image format has no segments', () => {
    const single = item({ format: 'quote_graphic' });
    const requests = buildRenderRequests(single, brain);
    expect(requests).toHaveLength(1);
    expect(requests[0]!.kind === 'image' && requests[0]!.slideIndex).toBeNull();
  });
});
