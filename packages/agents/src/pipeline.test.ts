import { LOCAL_COMPOSERS, createGateway } from '@morrowlane/content-engine';
import { createDataUrlStorage, createSvgRenderer } from '@morrowlane/creative-engine';
import { ORCA_ORIGIN, ORCA_SITE, createStaticFetcher } from '@morrowlane/crawl-engine';
import { createMemoryStore } from '@morrowlane/database';
import { createSocialRegistry } from '@morrowlane/social';
import { addDays, nowIso } from '@morrowlane/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { ALL_COMPOSERS, runJob } from './handlers.js';
import type { Runtime } from './runtime.js';
import { seedDemo } from './seed.js';
import { promoteDuePosts, runWorker } from './worker.js';

function makeRuntime(): Runtime {
  return {
    store: createMemoryStore(),
    gateway: createGateway({ composers: { ...LOCAL_COMPOSERS, ...ALL_COMPOSERS } }),
    social: createSocialRegistry({ useMocks: true }),
    fetcher: createStaticFetcher(ORCA_SITE),
    imageRenderer: createSvgRenderer(),
    mediaStorage: createDataUrlStorage(),
    demoMode: true,
  };
}

async function runNextJob(runtime: Runtime) {
  const job = await runtime.store.claimJob('test-worker');
  if (!job) throw new Error('Expected a queued job.');
  return runJob(job, runtime);
}

describe('the whole product, end to end', () => {
  let runtime: Runtime;
  let organizationId: string;
  let brandId: string;

  beforeAll(async () => {
    runtime = makeRuntime();
    const organization = await runtime.store.createOrganization({
      name: 'Acme',
      ownerUserId: 'user-1',
      ownerEmail: 'owner@acme.test',
    });
    organizationId = organization.id;
    const brand = await runtime.store.createBrand({
      organizationId,
      name: 'Pending',
      websiteUrl: ORCA_ORIGIN,
    });
    brandId = brand.id;
  });

  it('milestone 3 and 4: pasting a URL produces a reviewable Brand Brain', async () => {
    await runtime.store.enqueueJob({
      organizationId,
      brandId,
      kind: 'crawl_site',
      payload: { websiteUrl: ORCA_ORIGIN },
    });
    const job = await runNextJob(runtime);

    expect(job.status).toBe('succeeded');
    expect(job.result?.['pages']).toBeGreaterThan(5);

    const brand = await runtime.store.getBrand(brandId);
    expect(brand?.status).toBe('ready');
    // The brand is renamed to what the site says it is called.
    expect(brand?.name).toBe('Orca Credit');

    const brain = await runtime.store.getBrain(brandId);
    expect(brain?.identity.category).toBe('Financial technology');
    expect(brain?.products.map((p) => p.name)).toContain('Credit Builder Account');
    expect(brain?.rules.prohibitedClaims).toContain('guaranteed approval');
  });

  it('milestone 5: the studio generates content grounded in the brand', async () => {
    await runtime.store.enqueueJob({
      organizationId,
      brandId,
      kind: 'generate_content',
      payload: { format: 'instagram_post', count: 5, instruction: 'Promote our credit builder.' },
    });
    const job = await runNextJob(runtime);

    expect(job.status).toBe('succeeded');
    const { items } = await runtime.store.queryContent({ brandId });
    expect(items.length).toBeGreaterThanOrEqual(5);
    expect(items.some((item) => item.body.includes('Credit Builder Account'))).toBe(true);
  });

  it('milestone 6: URL Remix turns one page into a whole distribution tree', async () => {
    await runtime.store.enqueueJob({
      organizationId,
      brandId,
      kind: 'remix_url',
      payload: { url: `${ORCA_ORIGIN}/blog/how-credit-scores-work` },
    });
    const job = await runNextJob(runtime);

    expect(job.status).toBe('succeeded');
    expect(job.result?.['count']).toBeGreaterThanOrEqual(20);

    const remixed = await runtime.store.queryContent({
      brandId,
      sourceUrl: `${ORCA_ORIGIN}/blog/how-credit-scores-work`,
      limit: 100,
    });
    // The spec's recipe: posts, carousels, video scripts, an article, an email, images.
    expect(new Set(remixed.items.map((item) => item.format)).size).toBeGreaterThanOrEqual(6);
    expect(remixed.items.every((item) => item.lineage.sourceType === 'remix')).toBe(true);
  });

  it('milestone 8: a campaign lands on the calendar as a scheduled sequence', async () => {
    await runtime.store.enqueueJob({
      organizationId,
      brandId,
      kind: 'plan_campaign',
      payload: {
        goal: 'Generate qualified customers.',
        channels: ['instagram', 'linkedin'],
        durationDays: 30,
        startDate: addDays(nowIso(), 1),
      },
    });
    const job = await runNextJob(runtime);

    expect(job.status).toBe('succeeded');
    expect(job.result?.['phases']).toBe(5);
    expect(job.result?.['scheduled']).toBe(job.result?.['count']);

    const campaigns = await runtime.store.listCampaigns(brandId);
    expect(campaigns[0]?.status).toBe('active');

    const posts = await runtime.store.queryScheduledPosts({ brandId });
    expect(posts.length).toBeGreaterThan(0);
    expect(posts.every((post) => post.status === 'scheduled')).toBe(true);
  });

  it('guided flow: a reviewed plan writes content but schedules nothing until approved', async () => {
    await runtime.store.enqueueJob({
      organizationId,
      brandId,
      kind: 'plan_campaign',
      payload: {
        goal: 'Drive sales.',
        outcome: 'sales',
        channels: ['instagram'],
        durationDays: 14,
        startDate: addDays(nowIso(), 1),
        review: true,
      },
    });
    const planned = await runNextJob(runtime);
    expect(planned.status).toBe('succeeded');
    expect(planned.result?.['scheduled']).toBe(0);

    const campaignId = planned.result?.['campaignId'] as string;
    const campaign = await runtime.store.getCampaign(campaignId);
    expect(campaign?.status).toBe('ready'); // not 'active' — awaiting review
    expect(campaign?.outcome).toBe('sales');

    let posts = await runtime.store.queryScheduledPosts({ brandId });
    const before = posts.length;

    // Approve the plan's content, then activate: only now does it hit the calendar.
    const { items } = await runtime.store.queryContent({ brandId, campaignId, limit: 500 });
    for (const item of items) {
      if (!item.violations.some((v) => v.severity === 'error')) {
        await runtime.store.updateContent(item.id, { status: 'approved' });
      }
    }
    await runtime.store.enqueueJob({ organizationId, brandId, kind: 'activate_campaign', payload: { campaignId } });
    const activated = await runNextJob(runtime);
    expect(activated.status).toBe('succeeded');
    expect(activated.result?.['scheduled']).toBeGreaterThan(0);

    posts = await runtime.store.queryScheduledPosts({ brandId });
    expect(posts.length).toBeGreaterThan(before);
    expect((await runtime.store.getCampaign(campaignId))?.status).toBe('active');
  });


  it('flags a connection whose token has already expired, before a campaign relies on it', async () => {
    // Social tokens lapse silently — nothing tells you until posts stop going out.
    await runtime.store.saveConnection(
      {
        id: 'con_stale',
        brandId,
        channel: 'facebook' as const,
        displayName: '@orcacredit',
        externalAccountId: 'acct-stale',
        status: 'active' as const,
        scopes: ['write'],
        expiresAt: addDays(nowIso(), -1),
        lastValidatedAt: null,
        createdAt: nowIso(),
      },
      { accessToken: 'stale-token', refreshToken: null, metadata: {} },
    );

    await runtime.store.enqueueJob({ organizationId, brandId, kind: 'validate_connections', payload: {} });
    const job = await runNextJob(runtime);

    expect(job.status).toBe('succeeded');
    expect(Number(job.result?.['expired'])).toBeGreaterThanOrEqual(1);

    const checked = await runtime.store.getConnection('con_stale');
    expect(checked?.status).toBe('expired');
    expect(checked?.lastValidatedAt).not.toBeNull();
  });

  it('fills a month with a balanced mix rather than a wall of promotion', async () => {
    await runtime.store.enqueueJob({
      organizationId,
      brandId,
      kind: 'fill_calendar',
      payload: { days: 30, channels: ['instagram'], startDate: addDays(nowIso(), 40) },
    });
    const job = await runNextJob(runtime);

    expect(job.status).toBe('succeeded');
    const plan = job.result?.['plan'] as Array<{ reason: string; count: number }>;
    const total = plan.reduce((sum, slot) => sum + slot.count, 0);
    const promotional = plan.filter((s) => s.reason.startsWith('Promotional')).reduce((s, x) => s + x.count, 0);
    expect(promotional / total).toBeLessThan(0.3);
  });

  it('milestone 9: a due post is promoted, published and recorded', async () => {
    const connection = {
      id: 'con_test',
      brandId,
      channel: 'instagram' as const,
      displayName: '@orcacredit',
      externalAccountId: 'acct',
      status: 'active' as const,
      scopes: ['write'],
      expiresAt: null,
      lastValidatedAt: null,
      createdAt: nowIso(),
    };
    await runtime.store.saveConnection(connection, { accessToken: 'token', refreshToken: null, metadata: {} });

    const { items } = await runtime.store.queryContent({ brandId, channel: 'instagram', limit: 1 });
    const item = items[0]!;
    await runtime.store.saveScheduledPosts([
      {
        id: 'sch_due',
        brandId,
        contentId: item.id,
        connectionId: connection.id,
        channel: 'instagram',
        scheduledFor: addDays(nowIso(), -1),
        status: 'scheduled',
        attempts: 0,
        lastError: null,
        externalPostId: null,
        externalUrl: null,
        publishedAt: null,
      },
    ]);

    expect(await promoteDuePosts(runtime)).toBe(1);
    await runWorker(runtime, { maxJobs: 1, kinds: ['publish_post'] });

    const published = await runtime.store.getScheduledPost('sch_due');
    expect(published?.status).toBe('published');
    expect(published?.externalPostId).toMatch(/^instagram_/);
    expect((await runtime.store.getContent(item.id))?.status).toBe('published');
  });

  it('milestone 10: metrics collection feeds the attribution graph', async () => {
    const before = (await runtime.store.listEvents(brandId)).length;
    await runtime.store.enqueueJob({
      organizationId,
      brandId,
      kind: 'collect_metrics',
      payload: { scheduledPostId: 'sch_due' },
    });
    const job = await runNextJob(runtime);

    expect(job.status).toBe('succeeded');
    expect(job.result?.['collected']).toBe(1);
    expect((await runtime.store.listEvents(brandId)).length).toBeGreaterThan(before);
    expect((await runtime.store.listMetrics(brandId))[0]?.impressions).toBeGreaterThan(0);
  });

  it('renders branded graphics for an image format and attaches them', async () => {
    await runtime.store.enqueueJob({
      organizationId,
      brandId,
      kind: 'generate_content',
      payload: { format: 'instagram_carousel', count: 1 },
    });
    await runNextJob(runtime);
    const { items } = await runtime.store.queryContent({ brandId, format: 'instagram_carousel', limit: 1 });
    const carousel = items[0]!;

    await runtime.store.enqueueJob({
      organizationId,
      brandId,
      kind: 'render_media',
      payload: { contentId: carousel.id },
    });
    const job = await runNextJob(runtime);

    expect(job.status).toBe('succeeded');
    // One creative per slide.
    expect(job.result?.['rendered']).toBe(carousel.segments.length);

    const updated = await runtime.store.getContent(carousel.id);
    expect(updated?.mediaAssetIds).toHaveLength(carousel.segments.length);

    const media = await runtime.store.listMedia(brandId);
    const asset = media.find((candidate) => candidate.id === updated!.mediaAssetIds[0]);
    expect(asset?.renderer).toBe('svg');
    expect(asset?.url.startsWith('data:image/svg+xml;base64,')).toBe(true);
    // The rendered card is real brand output: it carries the brand colour.
    const svg = Buffer.from(asset!.url.split(',')[1]!, 'base64').toString('utf8');
    expect(svg).toContain('#1b6ef3');
  });

  it('reports a failure honestly rather than silently succeeding', async () => {
    await runtime.store.enqueueJob({
      organizationId,
      brandId,
      kind: 'remix_url',
      payload: { url: 'not a url' },
    });
    const job = await runNextJob(runtime);
    expect(job.status).toBe('failed');
    expect(job.error).toMatch(/web address/i);
  });

  it('refuses to generate before the brand has been analysed', async () => {
    const fresh = makeRuntime();
    const organization = await fresh.store.createOrganization({ name: 'New', ownerUserId: 'u', ownerEmail: 'e@e.test' });
    const brand = await fresh.store.createBrand({
      organizationId: organization.id,
      name: 'New',
      websiteUrl: 'https://new.example',
    });
    await fresh.store.enqueueJob({
      organizationId: organization.id,
      brandId: brand.id,
      kind: 'generate_content',
      payload: { format: 'instagram_post', count: 1 },
    });
    const job = await runNextJob(fresh);
    expect(job.status).toBe('failed');
    expect(job.error).toMatch(/website analysis/i);
  });

  it('reports progress while a long job runs', async () => {
    const fresh = makeRuntime();
    const organization = await fresh.store.createOrganization({ name: 'P', ownerUserId: 'u', ownerEmail: 'e@e.test' });
    const brand = await fresh.store.createBrand({
      organizationId: organization.id,
      name: 'P',
      websiteUrl: ORCA_ORIGIN,
    });
    const queued = await fresh.store.enqueueJob({
      organizationId: organization.id,
      brandId: brand.id,
      kind: 'crawl_site',
      payload: {},
    });

    const claimed = await fresh.store.claimJob('w');
    await runJob(claimed!, fresh);
    const finished = await fresh.store.getJob(queued.id);
    expect(finished?.progress).toBe(1);
    expect(finished?.status).toBe('succeeded');
  });
});

describe('seedDemo', () => {
  it('produces an account that already shows the product working', async () => {
    const runtime = makeRuntime();
    const seed = await seedDemo(runtime);

    const brain = await runtime.store.getBrain(seed.brandId);
    expect(brain?.identity.companyName).toBe('Orca Credit');

    const connections = await runtime.store.listConnections(seed.brandId);
    expect(connections.map((c) => c.channel).sort()).toEqual(['instagram', 'linkedin', 'x']);

    const upcoming = await runtime.store.queryScheduledPosts({ brandId: seed.brandId, status: ['scheduled'] });
    expect(upcoming.length).toBeGreaterThan(0);

    const history = await runtime.store.queryScheduledPosts({ brandId: seed.brandId, status: ['published'] });
    expect(history.length).toBeGreaterThan(0);

    const insights = await runtime.store.listInsights(seed.brandId);
    expect(insights.length).toBeGreaterThan(0);
    // The seeded performance carries a real signal, so the engine should find it.
    expect(insights.some((insight) => insight.statement.includes('carousel'))).toBe(true);

    const competitors = await runtime.store.listCompetitors(seed.brandId);
    expect(competitors).toHaveLength(2);
  });
});

describe('worker resilience', () => {
  it('backs off and keeps running when the store is unreachable, instead of crashing', async () => {
    const runtime = makeRuntime();
    let failures = 0;
    // Simulate the production failure mode: every poll hits a dead database.
    runtime.store.claimDuePosts = async () => {
      failures += 1;
      throw new Error('Could not read scheduled_posts: Invalid API key');
    };

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 120);

    // Must resolve (0 jobs) rather than reject — a crash here is the bug.
    const processed = await runWorker(runtime, {
      signal: controller.signal,
      errorBackoffMs: 10,
      idleDelayMs: 5,
    });
    expect(processed).toBe(0);
    expect(failures).toBeGreaterThanOrEqual(2);
  });

  it('still surfaces the failure on one-shot runs', async () => {
    const runtime = makeRuntime();
    runtime.store.claimDuePosts = async () => {
      throw new Error('down');
    };
    // maxJobs marks a bounded run (tests, cron): it should stop, not spin.
    const processed = await runWorker(runtime, { maxJobs: 3, errorBackoffMs: 1 });
    expect(processed).toBe(0);
  });
});
