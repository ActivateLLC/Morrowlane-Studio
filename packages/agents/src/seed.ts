import { ORCA_ORIGIN, ORCA_SITE, createStaticFetcher } from '@morrowlane/crawl-engine';
import { addDays, createLogger, newId, nowIso, type Channel } from '@morrowlane/shared';
import { scheduleContent } from '@morrowlane/campaign-engine';
import { generateContent } from '@morrowlane/content-engine';
import { recordEvent } from '@morrowlane/analytics';
import { runJob } from './handlers.js';
import type { Runtime } from './runtime.js';

const log = createLogger('agents:seed');

export interface SeedResult {
  organizationId: string;
  brandId: string;
  userId: string;
  email: string;
}

/**
 * Builds a complete, explorable account: a brand analysed from a fixture site, a month
 * of content on the calendar, connected accounts and enough performance history for the
 * insight engine to have something to say. This is what makes the first run of the
 * product show the product rather than an empty state.
 */
export async function seedDemo(runtime: Runtime, options: { email?: string; userId?: string } = {}): Promise<SeedResult> {
  const email = options.email ?? 'demo@morrowlane.local';
  const userId = options.userId ?? 'demo-user';

  const organization = await runtime.store.createOrganization({
    name: 'Morrowlane Demo',
    ownerUserId: userId,
    ownerEmail: email,
  });

  const brand = await runtime.store.createBrand({
    organizationId: organization.id,
    name: 'Orca Credit',
    websiteUrl: ORCA_ORIGIN,
  });

  // The fixture fetcher keeps the seed offline and deterministic.
  const seedRuntime: Runtime = { ...runtime, fetcher: createStaticFetcher(ORCA_SITE) };

  const crawlJob = await runtime.store.enqueueJob({
    organizationId: organization.id,
    brandId: brand.id,
    kind: 'crawl_site',
    payload: { websiteUrl: ORCA_ORIGIN },
  });
  const claimed = await runtime.store.claimJob('seed');
  await runJob(claimed ?? crawlJob, seedRuntime);

  const brain = await runtime.store.getBrain(brand.id);
  if (!brain) {
    log.warn('seed finished without a brand profile');
    return { organizationId: organization.id, brandId: brand.id, userId, email };
  }

  const channels: Channel[] = ['instagram', 'linkedin', 'x'];
  for (const channel of channels) {
    const connection = {
      id: newId('connection'),
      brandId: brand.id,
      channel,
      displayName: `@orcacredit (${channel})`,
      externalAccountId: `${channel}_demo`,
      status: 'active' as const,
      scopes: ['write'],
      expiresAt: null,
      lastValidatedAt: nowIso(),
      createdAt: nowIso(),
    };
    await runtime.store.saveConnection(connection, {
      accessToken: 'demo-token',
      refreshToken: null,
      metadata: { demo: true },
    });
  }

  // A month of content, half of it already "published" with performance attached, so
  // the analytics and insight screens have real shape on the first visit.
  const past = await generateContent(seedRuntime.gateway, { brain, format: 'instagram_carousel', count: 6 });
  const pastGraphics = await generateContent(seedRuntime.gateway, { brain, format: 'quote_graphic', count: 6 });
  const upcoming = await generateContent(seedRuntime.gateway, { brain, format: 'instagram_post', count: 8 });
  const upcomingLinkedIn = await generateContent(seedRuntime.gateway, { brain, format: 'linkedin_post', count: 6 });

  const published = [...past.items, ...pastGraphics.items].map((item) => ({ ...item, status: 'published' as const }));
  const scheduled = [...upcoming.items, ...upcomingLinkedIn.items].map((item) => ({ ...item, status: 'approved' as const }));
  await runtime.store.saveContent([...published, ...scheduled]);

  const connectionByChannel = Object.fromEntries(
    (await runtime.store.listConnections(brand.id)).map((connection) => [connection.channel, connection.id]),
  ) as Partial<Record<Channel, string>>;

  const pastPosts = scheduleContent(published, {
    startDate: addDays(nowIso(), -28),
    days: 28,
    connectionByChannel,
  }).map((post) => ({
    ...post,
    status: 'published' as const,
    attempts: 1,
    externalPostId: `demo_${post.id}`,
    externalUrl: `https://mock.local/${post.channel}/${post.id}`,
    publishedAt: post.scheduledFor,
  }));

  const futurePosts = scheduleContent(scheduled, {
    startDate: addDays(nowIso(), 1),
    days: 21,
    connectionByChannel,
  });

  await runtime.store.saveScheduledPosts([...pastPosts, ...futurePosts]);
  await runtime.store.recordEvents(demoEvents(brand.id, pastPosts, published));

  const insightsJob = await runtime.store.enqueueJob({
    organizationId: organization.id,
    brandId: brand.id,
    kind: 'compute_insights',
    payload: {},
  });
  await runJob(insightsJob, seedRuntime);

  await runtime.store.saveCompetitor({
    id: newId('competitor'),
    brandId: brand.id,
    name: 'Kestrel Credit',
    websiteUrl: 'https://kestrelcredit.example',
    lastCheckedAt: nowIso(),
    signals: [
      { observedAt: nowIso(), kind: 'new_article', summary: 'Published a first-time homebuyer guide.', url: null, themes: ['first-time homebuyer education'] },
    ],
  });
  await runtime.store.saveCompetitor({
    id: newId('competitor'),
    brandId: brand.id,
    name: 'Beacon Score',
    websiteUrl: 'https://beaconscore.example',
    lastCheckedAt: nowIso(),
    signals: [
      { observedAt: nowIso(), kind: 'new_article', summary: 'Three posts on mortgage readiness.', url: null, themes: ['first-time homebuyer education'] },
    ],
  });

  log.info('demo seeded', { brandId: brand.id, published: published.length, scheduled: scheduled.length });
  return { organizationId: organization.id, brandId: brand.id, userId, email };
}

/**
 * Performance that carries a real signal: carousels out-perform quote graphics, which
 * is the comparison the insight engine should find and state.
 */
function demoEvents(
  brandId: string,
  posts: Array<{ id: string; contentId: string; channel: Channel; scheduledFor: string }>,
  content: Array<{ id: string; format: string }>,
) {
  const formatById = new Map(content.map((item) => [item.id, item.format]));

  return posts.flatMap((post, index) => {
    const isCarousel = formatById.get(post.contentId) === 'instagram_carousel';
    const impressions = 900 + index * 40;
    const engagementRate = isCarousel ? 0.11 : 0.04;
    const clickRate = isCarousel ? 0.058 : 0.021;
    const clicks = Math.round(impressions * clickRate);
    const visits = Math.round(clicks * 0.92);
    const leads = isCarousel ? Math.max(1, Math.round(visits * 0.11)) : Math.round(visits * 0.04);

    const base = { brandId, contentId: post.contentId, scheduledPostId: post.id, channel: post.channel, occurredAt: post.scheduledFor };
    return [
      recordEvent({ ...base, stage: 'impression', value: impressions }),
      recordEvent({ ...base, stage: 'engagement', value: Math.round(impressions * engagementRate) }),
      recordEvent({ ...base, stage: 'click', value: clicks }),
      recordEvent({ ...base, stage: 'visit', value: visits }),
      recordEvent({ ...base, stage: 'lead', value: leads }),
      ...(leads > 0 ? [recordEvent({ ...base, stage: 'customer', value: Math.max(0, Math.round(leads * 0.2)) })] : []),
      ...(leads > 0 ? [recordEvent({ ...base, stage: 'revenue', value: Math.round(leads * 0.2) * 120, currency: 'USD' })] : []),
    ];
  });
}
