import { LOCAL_COMPOSERS, createGateway } from '@morrowlane/content-engine';
import { BRAND_COMPOSERS, buildBrandBrain } from '@morrowlane/brand-engine';
import { ORCA_ORIGIN, ORCA_SITE, crawlSite, createStaticFetcher } from '@morrowlane/crawl-engine';
import type { BrandBrain, Campaign, ContentItem } from '@morrowlane/shared';
import { dayKey } from '@morrowlane/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { CAMPAIGN_COMPOSERS } from './composer.js';
import { generateCampaignContent, splitCount } from './generate.js';
import { fillMonth, planMonth } from './fill.js';
import { phaseDateRange, planCampaign } from './plan.js';
import { groupByDay, scheduleCampaign, scheduleContent } from './schedule.js';

const gateway = createGateway({
  composers: { ...LOCAL_COMPOSERS, ...BRAND_COMPOSERS, ...CAMPAIGN_COMPOSERS },
});

let brain: BrandBrain;
let campaign: Campaign;

beforeAll(async () => {
  const summary = await crawlSite(ORCA_ORIGIN, createStaticFetcher(ORCA_SITE), { brandId: 'brd_orca' });
  brain = await buildBrandBrain(gateway, {
    brandId: 'brd_orca',
    websiteUrl: ORCA_ORIGIN,
    pages: summary.pages,
    siteColors: summary.colors,
    siteSocialLinks: summary.socialLinks,
  });
  campaign = await planCampaign(gateway, {
    brain,
    goal: 'Generate qualified customers.',
    productName: 'Credit Builder Account',
    channels: ['instagram', 'tiktok', 'linkedin'],
    durationDays: 30,
    startDate: '2026-09-01T00:00:00.000Z',
  });
});

describe('planCampaign', () => {
  it('produces the five-phase narrative arc from the spec', () => {
    expect(campaign.phases.map((p) => p.kind)).toEqual([
      'problem_awareness',
      'education',
      'solution',
      'proof',
      'conversion',
    ]);
  });

  it('covers the full duration with contiguous, non-overlapping phases', () => {
    expect(campaign.phases[0]!.startDay).toBe(0);
    expect(campaign.phases.at(-1)!.endDay).toBe(29);
    for (let i = 1; i < campaign.phases.length; i += 1) {
      expect(campaign.phases[i]!.startDay).toBe(campaign.phases[i - 1]!.endDay + 1);
    }
  });

  it('weights the plan toward education and proof over conversion', () => {
    const byKind = new Map(campaign.phases.map((p) => [p.kind, p]));
    const education = byKind.get('education')!;
    const conversion = byKind.get('conversion')!;
    expect(education.postCount).toBeGreaterThan(conversion.postCount);
  });

  it('biases the phase mix toward the chosen business outcome', async () => {
    const base = { brain, channels: ['instagram'] as const, durationDays: 30, startDate: '2026-09-01T00:00:00.000Z' };
    const sales = await planCampaign(gateway, { ...base, goal: 'Sell.', outcome: 'sales' });
    const awareness = await planCampaign(gateway, { ...base, goal: 'Get known.', outcome: 'awareness' });

    const conv = (c: typeof sales) => c.phases.find((p) => p.kind === 'conversion')!.postCount;
    const top = (c: typeof sales) => c.phases.find((p) => p.kind === 'problem_awareness')!.postCount;

    // Sales pushes budget onto conversion; awareness pushes it onto the top of the funnel.
    expect(conv(sales)).toBeGreaterThan(conv(awareness));
    expect(top(awareness)).toBeGreaterThan(top(sales));
    expect(sales.outcome).toBe('sales');
  });

  it('grounds the narrative in the brand it was built from', () => {
    expect(campaign.narrative).toContain('consumers building credit');
    expect(campaign.name).toContain('Credit Builder Account');
    expect(campaign.productId).toBe(brain.products.find((p) => p.name === 'Credit Builder Account')?.id);
  });

  it('maps phase day offsets to real dates', () => {
    const range = phaseDateRange(campaign, campaign.phases[0]!);
    expect(dayKey(range.start)).toBe('2026-09-01');
  });
});

describe('generateCampaignContent', () => {
  let items: ContentItem[];

  beforeAll(async () => {
    const result = await generateCampaignContent(gateway, { brain, campaign });
    items = result.items;
    expect(result.errors).toEqual([]);
  });

  it('produces the post count each phase asked for', () => {
    for (const phase of campaign.phases) {
      expect(items.filter((i) => i.campaignPhaseId === phase.id)).toHaveLength(phase.postCount);
    }
  });

  it('covers every channel on the campaign', () => {
    expect(new Set(items.map((i) => i.channel))).toEqual(new Set(['instagram', 'tiktok', 'linkedin']));
  });

  it('tags every item with the campaign for attribution', () => {
    expect(items.every((i) => i.campaignId === campaign.id)).toBe(true);
    expect(items.every((i) => i.lineage.sourceType === 'campaign')).toBe(true);
  });

  it('writes each phase to its own angle rather than repeating the pitch', () => {
    const awareness = items.filter((i) => i.campaignPhaseId === campaign.phases[0]!.id);
    const conversion = items.filter((i) => i.campaignPhaseId === campaign.phases.at(-1)!.id);
    const overlap = awareness.filter((a) => conversion.some((c) => c.hook === a.hook));
    expect(overlap).toEqual([]);
  });
});

describe('splitCount', () => {
  it('distributes evenly and puts the remainder at the front', () => {
    expect(splitCount(7, 3)).toEqual([3, 2, 2]);
    expect(splitCount(6, 3)).toEqual([2, 2, 2]);
    expect(splitCount(2, 3)).toEqual([1, 1, 0]);
    expect(splitCount(5, 0)).toEqual([]);
  });
});

describe('scheduleContent', () => {
  it('never double-books a channel slot', async () => {
    const { items } = await import('@morrowlane/content-engine').then((m) =>
      m.generateContent(gateway, { brain, format: 'instagram_post', count: 12 }),
    );
    const posts = scheduleContent(items, { startDate: '2026-09-01T00:00:00.000Z', days: 30 });
    const stamps = posts.map((p) => `${p.channel}@${p.scheduledFor}`);
    expect(new Set(stamps).size).toBe(stamps.length);
  });

  it('keeps every post inside the requested window', async () => {
    const { items } = await import('@morrowlane/content-engine').then((m) =>
      m.generateContent(gateway, { brain, format: 'instagram_post', count: 8 }),
    );
    const posts = scheduleContent(items, { startDate: '2026-09-01T00:00:00.000Z', days: 7 });
    for (const post of posts) {
      expect(dayKey(post.scheduledFor) >= '2026-09-01').toBe(true);
      expect(dayKey(post.scheduledFor) <= '2026-09-07').toBe(true);
    }
  });

  it('honours skipped weekdays', async () => {
    const { items } = await import('@morrowlane/content-engine').then((m) =>
      m.generateContent(gateway, { brain, format: 'linkedin_post', count: 6 }),
    );
    // 2026-09-05 is a Saturday and 2026-09-06 a Sunday.
    const posts = scheduleContent(items, {
      startDate: '2026-09-01T00:00:00.000Z',
      days: 14,
      skipWeekdays: [0, 6],
    });
    for (const post of posts) {
      expect([0, 6]).not.toContain(new Date(post.scheduledFor).getUTCDay());
    }
  });

  it('schedules every item it is given', async () => {
    const { items } = await import('@morrowlane/content-engine').then((m) =>
      m.generateContent(gateway, { brain, format: 'x_post', count: 20 }),
    );
    expect(scheduleContent(items, { startDate: '2026-09-01T00:00:00.000Z', days: 5 })).toHaveLength(20);
  });
});

describe('scheduleCampaign', () => {
  it('lands each phase\'s posts inside that phase\'s date range', async () => {
    const { items } = await generateCampaignContent(gateway, { brain, campaign });
    const posts = scheduleCampaign(campaign, items);
    const byContent = new Map(items.map((i) => [i.id, i]));

    for (const post of posts) {
      const item = byContent.get(post.contentId)!;
      const phase = campaign.phases.find((p) => p.id === item.campaignPhaseId)!;
      const range = phaseDateRange(campaign, phase);
      expect(dayKey(post.scheduledFor) >= dayKey(range.start)).toBe(true);
      expect(dayKey(post.scheduledFor) <= dayKey(range.end)).toBe(true);
    }
  });

  it('returns posts in chronological order', async () => {
    const { items } = await generateCampaignContent(gateway, { brain, campaign });
    const posts = scheduleCampaign(campaign, items);
    const stamps = posts.map((p) => p.scheduledFor);
    expect(stamps).toEqual([...stamps].sort());
  });
});

describe('groupByDay', () => {
  it('buckets posts into calendar days', async () => {
    const { items } = await import('@morrowlane/content-engine').then((m) =>
      m.generateContent(gateway, { brain, format: 'instagram_post', count: 4 }),
    );
    const grouped = groupByDay(scheduleContent(items, { startDate: '2026-09-01T00:00:00.000Z', days: 30 }));
    expect([...grouped.keys()].every((key) => /^\d{4}-\d{2}-\d{2}$/.test(key))).toBe(true);
    expect([...grouped.values()].flat()).toHaveLength(4);
  });
});

describe('planMonth', () => {
  it('keeps promotion in the minority of the month', () => {
    const plan = planMonth({ brain, channels: ['instagram'], days: 30 });
    const total = plan.reduce((sum, slot) => sum + slot.count, 0);
    const promotional = plan.filter((s) => s.reason.startsWith('Promotional')).reduce((s, x) => s + x.count, 0);
    expect(promotional / total).toBeLessThan(0.3);
  });

  it('plans for every requested channel', () => {
    const plan = planMonth({ brain, channels: ['instagram', 'linkedin', 'x'], days: 30 });
    expect(new Set(plan.map((s) => s.channel))).toEqual(new Set(['instagram', 'linkedin', 'x']));
  });

  it('leads with formats that have measured performance', () => {
    const plan = planMonth({
      brain,
      channels: ['instagram'],
      days: 30,
      preferredFormats: ['instagram_carousel'],
    });
    expect(plan[0]!.format).toBe('instagram_carousel');
  });
});

describe('fillMonth', () => {
  it('produces a full month of content across channels', async () => {
    const result = await fillMonth(gateway, { brain, channels: ['instagram', 'linkedin'], days: 30 });
    expect(result.errors).toEqual([]);
    expect(result.items.length).toBeGreaterThanOrEqual(20);
    expect(new Set(result.items.map((i) => i.channel))).toEqual(new Set(['instagram', 'linkedin']));
  });

  it('records why each slot exists so the plan is explainable', async () => {
    const result = await fillMonth(gateway, { brain, channels: ['instagram'], days: 14 });
    expect(result.plan.every((slot) => slot.reason.length > 0)).toBe(true);
    expect(result.items.every((i) => i.lineage.instruction !== null)).toBe(true);
  });
});
