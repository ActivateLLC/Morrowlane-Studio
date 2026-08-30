import { BRAND_COMPOSERS, buildBrandFromProfile } from '@morrowlane/brand-engine';
import {
  CAMPAIGN_COMPOSERS,
  fillMonth,
  generateCampaignContent,
  planCampaign,
  scheduleCampaign,
  scheduleContent,
} from '@morrowlane/campaign-engine';
import { generateContent, remixUrl, type AiGateway } from '@morrowlane/content-engine';
import { crawlSinglePage, createHttpFetcher, type Fetcher } from '@morrowlane/crawl-engine';
import { buildRenderRequests, type ImageRenderer, type MediaStorage } from '@morrowlane/creative-engine';
import type { DataStore } from '@morrowlane/database';
import { applyInsights, computeInsights, performanceByContent, recordEvent } from '@morrowlane/analytics';
import { publishPost, type SocialRegistry } from '@morrowlane/social';
import type { CampaignOutcomeId, Channel, Job, JobKind } from '@morrowlane/shared';
import { NotFoundError, createLogger, isCampaignOutcome, isChannel, isContentFormat, newId, normalizeUrl, nowIso } from '@morrowlane/shared';
import type { StepContext } from './graph.js';
import { runOnboarding } from './onboarding.js';

const log = createLogger('agents:handlers');

export interface HandlerDeps {
  store: DataStore;
  gateway: AiGateway;
  social: SocialRegistry;
  imageRenderer: ImageRenderer;
  mediaStorage: MediaStorage;
  fetcher?: Fetcher;
}

export type JobHandler = (job: Job, deps: HandlerDeps, context: StepContext) => Promise<Record<string, unknown>>;

/** Every composer the gateway needs. Registering one place avoids "no local composer" gaps. */
export const ALL_COMPOSERS = { ...BRAND_COMPOSERS, ...CAMPAIGN_COMPOSERS };

async function requireBrain(store: DataStore, brandId: string) {
  const brain = await store.getBrain(brandId);
  if (!brain) throw new NotFoundError('Brand profile. Run the website analysis first');
  return brain;
}

function str(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function int(payload: Record<string, unknown>, key: string, fallback: number): number {
  const value = payload[key];
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function channels(payload: Record<string, unknown>): Channel[] {
  const value = payload['channels'];
  if (!Array.isArray(value)) return [];
  return value.filter((c): c is Channel => typeof c === 'string' && isChannel(c));
}

function outcome(payload: Record<string, unknown>): CampaignOutcomeId | null {
  const value = payload['outcome'];
  return isCampaignOutcome(value) ? value : null;
}

function stringList(payload: Record<string, unknown>, key: string): string[] {
  const value = payload[key];
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
}

export const HANDLERS: Record<JobKind, JobHandler> = {
  async crawl_site(job, deps, context) {
    const brandId = job.brandId;
    if (!brandId) throw new Error('crawl_site requires a brand.');
    const brand = await deps.store.getBrand(brandId);
    if (!brand) throw new NotFoundError('Brand');

    const result = await runOnboarding(
      deps,
      { brandId, websiteUrl: str(job.payload, 'websiteUrl') ?? brand.websiteUrl, maxPages: int(job.payload, 'maxPages', 60) },
      context,
    );

    if (result.failed.length > 0) throw new Error(result.failed[0]!.error);
    return {
      pages: result.state.summary?.pages.length ?? 0,
      products: result.state.brain?.products.length ?? 0,
      completeness: result.state.brain?.completeness ?? 0,
    };
  },

  async build_brand_brain(job, deps, context) {
    // The same pipeline, entered after a crawl already exists.
    return HANDLERS.crawl_site(job, deps, context);
  },

  /** The no-website path: build the first Brand Profile from the Brand Builder answers. */
  async build_brand_profile(job, deps, context) {
    const brandId = job.brandId;
    if (!brandId) throw new Error('build_brand_profile requires a brand.');
    const businessName = str(job.payload, 'businessName');
    const whatYouSell = str(job.payload, 'whatYouSell');
    if (!businessName || !whatYouSell) throw new Error('A business name and what you sell are required.');

    await deps.store.updateBrand(brandId, { status: 'analyzing', statusDetail: 'Building your profile' });
    await context.progress(0.3, 'Building your profile');

    const brain = await buildBrandFromProfile(deps.gateway, {
      brandId,
      businessName,
      whatYouSell,
      audience: str(job.payload, 'audience') ?? undefined,
      desiredAction: str(job.payload, 'desiredAction') ?? undefined,
      contactChannels: stringList(job.payload, 'contactChannels'),
      brandFeel: str(job.payload, 'brandFeel') ?? undefined,
      logoUrls: stringList(job.payload, 'logoUrls'),
      imageUrls: stringList(job.payload, 'imageUrls'),
    });
    await deps.store.saveBrain(brain);

    await context.progress(0.9, 'Finishing up');
    await deps.store.updateBrand(brandId, { status: 'ready', statusDetail: null, name: businessName });

    return { products: brain.products.length, completeness: brain.completeness };
  },

  async generate_content(job, deps, context) {
    const brandId = job.brandId;
    if (!brandId) throw new Error('generate_content requires a brand.');
    const brain = await requireBrain(deps.store, brandId);

    const format = str(job.payload, 'format');
    if (!format || !isContentFormat(format)) throw new Error(`"${format}" is not a content format Morrowlane produces.`);

    await context.progress(0.2, `Writing ${format.replace(/_/g, ' ')}`);
    const channelValue = str(job.payload, 'channel');

    const insights = (await deps.store.listInsights(brandId)).filter((insight) => insight.applied);
    const parentContentId = str(job.payload, 'parentContentId');
    const result = await generateContent(deps.gateway, {
      brain,
      format,
      channel: channelValue && isChannel(channelValue) ? channelValue : undefined,
      count: int(job.payload, 'count', 5),
      instruction: str(job.payload, 'instruction'),
      topic: str(job.payload, 'topic'),
      productName: str(job.payload, 'productName'),
      campaignId: str(job.payload, 'campaignId'),
      // Variants remember what they varied from; the learning loop needs the edge.
      ...(parentContentId ? { lineage: { parentContentId } } : {}),
      insights: insights.map((insight) => insight.statement),
      appliedInsightIds: insights.map((insight) => insight.id),
    });

    await context.progress(0.9, 'Saving');
    await deps.store.saveContent(result.items);
    return { contentIds: result.items.map((item) => item.id), count: result.items.length };
  },

  async remix_url(job, deps, context) {
    const brandId = job.brandId;
    if (!brandId) throw new Error('remix_url requires a brand.');
    const brain = await requireBrain(deps.store, brandId);

    const url = normalizeUrl(str(job.payload, 'url') ?? '');
    if (!url) throw new Error('That does not look like a web address.');

    await context.progress(0.15, 'Reading the page');
    // Prefer the crawled copy; fetch live only when the page is new to us.
    const page =
      (await deps.store.getPageByUrl(brandId, url)) ??
      (await crawlSinglePage(url, deps.fetcher ?? createHttpFetcher(), brandId));
    if (!page) throw new Error(`That page could not be read: ${url}`);

    await context.progress(0.35, 'Building the distribution tree');
    const result = await remixUrl(deps.gateway, { brain, page, instruction: str(job.payload, 'instruction') });

    await context.progress(0.9, 'Saving');
    await deps.store.saveContent(result.items);
    return {
      contentIds: result.items.map((item) => item.id),
      count: result.items.length,
      breakdown: result.breakdown,
    };
  },

  async plan_campaign(job, deps, context) {
    const brandId = job.brandId;
    if (!brandId) throw new Error('plan_campaign requires a brand.');
    const brain = await requireBrain(deps.store, brandId);

    // Guided flow: plan and write the content, but hold scheduling until the user
    // approves the consolidated plan. Free-form campaigns (the power path) keep the
    // one-shot behaviour of scheduling immediately.
    const review = Boolean(job.payload['review']);

    await context.progress(0.15, 'Planning the narrative');
    const campaign = await planCampaign(deps.gateway, {
      brain,
      goal: str(job.payload, 'goal') ?? 'Grow the business.',
      outcome: outcome(job.payload),
      productName: str(job.payload, 'productName'),
      channels: channels(job.payload),
      durationDays: int(job.payload, 'durationDays', 30),
      startDate: str(job.payload, 'startDate') ?? undefined,
    });
    await deps.store.saveCampaign(campaign);

    await context.progress(0.4, 'Writing the content');
    const generated = await generateCampaignContent(deps.gateway, { brain, campaign });
    await deps.store.saveContent(generated.items);

    if (review) {
      // Leave status 'ready': the plan is written and waiting on the review screen.
      return {
        campaignId: campaign.id,
        phases: campaign.phases.length,
        count: generated.items.length,
        scheduled: 0,
        errors: generated.errors,
      };
    }

    await context.progress(0.85, 'Filling the calendar');
    const posts = scheduleCampaign(campaign, generated.items);
    await deps.store.saveScheduledPosts(posts);
    await deps.store.updateCampaign(campaign.id, { status: 'active' });

    return {
      campaignId: campaign.id,
      phases: campaign.phases.length,
      count: generated.items.length,
      scheduled: posts.length,
      errors: generated.errors,
    };
  },

  /** Schedules an approved plan onto the calendar and activates the campaign. */
  async activate_campaign(job, deps, context) {
    const campaignId = str(job.payload, 'campaignId');
    if (!campaignId) throw new Error('activate_campaign requires a campaign.');
    const campaign = await deps.store.getCampaign(campaignId);
    if (!campaign) throw new NotFoundError('Campaign');

    await context.progress(0.3, 'Filling the calendar');
    const { items: content } = await deps.store.queryContent({ brandId: campaign.brandId, campaignId, limit: 500 });
    // Only approved, rule-clean content is scheduled; anything still in review is left out.
    const publishable = content.filter(
      (item) => item.status === 'approved' && !item.violations.some((v) => v.severity === 'error'),
    );
    const posts = scheduleCampaign(campaign, publishable);
    await deps.store.saveScheduledPosts(posts);
    await deps.store.updateCampaign(campaignId, { status: 'active' });

    return { campaignId, scheduled: posts.length };
  },

  async fill_calendar(job, deps, context) {
    const brandId = job.brandId;
    if (!brandId) throw new Error('fill_calendar requires a brand.');
    const brain = await requireBrain(deps.store, brandId);

    const days = int(job.payload, 'days', 30);
    const requested = channels(job.payload);
    // Default to the channels the brand has actually connected.
    const connected = (await deps.store.listConnections(brandId))
      .filter((connection) => connection.status === 'active')
      .map((connection) => connection.channel);
    const target = requested.length > 0 ? requested : connected.length > 0 ? connected : (['instagram'] as Channel[]);

    const applied = (await deps.store.listInsights(brandId)).filter((insight) => insight.applied);
    const preferredFormats = applyInsights(applied).preferredFormats;

    await context.progress(0.2, 'Planning the month');
    const result = await fillMonth(deps.gateway, {
      brain,
      channels: target,
      days,
      preferredFormats,
    });
    await deps.store.saveContent(result.items);

    await context.progress(0.85, 'Filling the calendar');
    const connectionByChannel = Object.fromEntries(
      (await deps.store.listConnections(brandId)).map((connection) => [connection.channel, connection.id]),
    ) as Partial<Record<Channel, string>>;

    const posts = scheduleContent(result.items, {
      startDate: str(job.payload, 'startDate') ?? nowIso(),
      days,
      connectionByChannel,
    });
    await deps.store.saveScheduledPosts(posts);

    return {
      count: result.items.length,
      scheduled: posts.length,
      plan: result.plan,
      errors: result.errors,
    };
  },

  async render_media(job, deps, context) {
    const brandId = job.brandId;
    if (!brandId) throw new Error('render_media requires a brand.');
    const contentId = str(job.payload, 'contentId');
    if (!contentId) throw new Error('render_media requires a content item.');

    const item = await deps.store.getContent(contentId);
    if (!item) throw new NotFoundError('Content');
    const brain = await requireBrain(deps.store, brandId);

    const requests = buildRenderRequests(item, brain).filter((request) => request.kind === 'image');
    if (requests.length === 0) {
      throw new Error(
        item.segments.length > 0 || item.hook
          ? 'This format renders as video, which runs through services/video (Remotion) and is not wired yet.'
          : 'This content has nothing to render.',
      );
    }

    const assetIds: string[] = [];
    for (const [index, request] of requests.entries()) {
      await context.progress(
        0.1 + (index / requests.length) * 0.8,
        `Rendering ${index + 1} of ${requests.length}`,
      );
      const image = await deps.imageRenderer.render(request);
      const { url } = await deps.mediaStorage.put({
        bytes: image.bytes,
        contentType: image.contentType,
        keyHint: `${brandId}/${contentId}`,
      });

      const [asset] = await deps.store.saveMedia([
        {
          id: newId('asset'),
          brandId,
          kind: 'image',
          url,
          thumbnailUrl: null,
          prompt: request.prompt,
          width: image.width,
          height: image.height,
          durationSeconds: null,
          renderer: deps.imageRenderer.name,
          createdAt: nowIso(),
        },
      ]);
      if (asset) assetIds.push(asset.id);
    }

    await deps.store.updateContent(contentId, {
      mediaAssetIds: [...item.mediaAssetIds, ...assetIds],
    });
    return { rendered: assetIds.length, renderer: deps.imageRenderer.name, assetIds };
  },

  async publish_post(job, deps, context) {
    const postId = str(job.payload, 'scheduledPostId');
    if (!postId) throw new Error('publish_post requires a scheduled post.');

    const post = await deps.store.getScheduledPost(postId);
    if (!post) throw new NotFoundError('Scheduled post');
    const content = await deps.store.getContent(post.contentId);
    if (!content) throw new NotFoundError('Content');

    const connection = post.connectionId
      ? await deps.store.getConnection(post.connectionId)
      : (await deps.store.listConnections(post.brandId)).find((c) => c.channel === post.channel) ?? null;

    if (!connection) {
      await deps.store.updateScheduledPost(post.id, {
        status: 'failed',
        lastError: `No ${post.channel} account is connected.`,
        attempts: post.attempts + 1,
      });
      throw new Error(`No ${post.channel} account is connected.`);
    }

    const secret = await deps.store.getConnectionSecret(connection.id);
    if (!secret) throw new Error('The stored credentials for this connection could not be read.');

    await context.progress(0.5, `Publishing to ${post.channel}`);
    const media = await deps.store.listMedia(post.brandId);
    const mediaUrls = content.mediaAssetIds
      .map((id) => media.find((asset) => asset.id === id)?.url)
      .filter((url): url is string => Boolean(url));

    const result = await publishPost(deps.social, {
      post,
      content,
      connection,
      accessToken: secret.accessToken,
      mediaUrls,
    });

    await deps.store.updateScheduledPost(post.id, result.post);

    if (result.post.status === 'published') {
      await deps.store.updateContent(content.id, { status: 'published' });
      await deps.store.recordEvents([
        recordEvent({
          brandId: post.brandId,
          contentId: content.id,
          scheduledPostId: post.id,
          channel: post.channel,
          stage: 'impression',
          value: 0,
          metadata: { externalPostId: result.post.externalPostId },
        }),
      ]);
      // Metrics are collected after the post has had time to accumulate them.
      await deps.store.enqueueJob({
        organizationId: job.organizationId,
        brandId: post.brandId,
        kind: 'collect_metrics',
        payload: { scheduledPostId: post.id },
        runAfter: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      });
      return { published: true, externalPostId: result.post.externalPostId };
    }

    if (result.retry) {
      await deps.store.enqueueJob({
        organizationId: job.organizationId,
        brandId: post.brandId,
        kind: 'publish_post',
        payload: { scheduledPostId: post.id },
        runAfter: new Date(Date.now() + (result.retryAfterSeconds ?? 60) * 1000).toISOString(),
      });
      return { published: false, retrying: true, error: result.post.lastError };
    }

    throw new Error(result.post.lastError ?? 'Publishing failed.');
  },

  async collect_metrics(job, deps) {
    const brandId = job.brandId;
    if (!brandId) throw new Error('collect_metrics requires a brand.');

    const postId = str(job.payload, 'scheduledPostId');
    const posts = postId
      ? [await deps.store.getScheduledPost(postId)].filter((p): p is NonNullable<typeof p> => p !== null)
      : (await deps.store.queryScheduledPosts({ brandId, status: ['published'] }));

    const collected: string[] = [];
    for (const post of posts) {
      if (!post.externalPostId || !post.connectionId) continue;
      const connection = await deps.store.getConnection(post.connectionId);
      const secret = connection ? await deps.store.getConnectionSecret(connection.id) : null;
      if (!connection || !secret) continue;

      const provider = deps.social.find(post.channel);
      const analytics = await provider?.retrieveAnalytics(connection, secret.accessToken, post.externalPostId);
      if (!analytics) continue;

      await deps.store.saveMetrics([{ ...analytics, scheduledPostId: post.id, brandId }]);
      // Metrics become attribution events so one funnel query covers every source.
      await deps.store.recordEvents([
        recordEvent({ brandId, contentId: post.contentId, scheduledPostId: post.id, channel: post.channel, stage: 'impression', value: analytics.impressions }),
        recordEvent({ brandId, contentId: post.contentId, scheduledPostId: post.id, channel: post.channel, stage: 'engagement', value: analytics.engagements }),
        recordEvent({ brandId, contentId: post.contentId, scheduledPostId: post.id, channel: post.channel, stage: 'click', value: analytics.clicks }),
      ]);
      collected.push(post.id);
    }

    return { collected: collected.length };
  },

  async scan_competitors(job, deps) {
    const brandId = job.brandId;
    if (!brandId) throw new Error('scan_competitors requires a brand.');
    // Competitor crawling is queued per competitor by the scheduler; this handler
    // exists so the kind is complete and reports what it did.
    const competitors = await deps.store.listCompetitors(brandId);
    return { competitors: competitors.length, scanned: 0 };
  },

  async scan_trends(job, deps) {
    const brandId = job.brandId;
    if (!brandId) throw new Error('scan_trends requires a brand.');
    const trends = await deps.store.listTrends(brandId);
    return { trends: trends.length };
  },

  async compute_insights(job, deps) {
    const brandId = job.brandId;
    if (!brandId) throw new Error('compute_insights requires a brand.');

    const { items } = await deps.store.queryContent({ brandId, limit: 500 });
    const posts = await deps.store.queryScheduledPosts({ brandId });
    const events = await deps.store.listEvents(brandId);

    const insights = computeInsights(brandId, performanceByContent(items, posts, events));
    if (insights.length > 0) await deps.store.saveInsights(insights);
    return { insights: insights.length };
  },
};

/** Runs one claimed job and records its outcome. Never throws. */
export async function runJob(job: Job, deps: HandlerDeps): Promise<Job> {
  const handler = HANDLERS[job.kind];
  const context: StepContext = {
    async progress(fraction, label) {
      await deps.store.updateJob(job.id, {
        progress: Math.max(0, Math.min(1, fraction)),
        progressLabel: label,
      });
    },
  };

  if (!handler) {
    return deps.store.updateJob(job.id, {
      status: 'failed',
      error: `No handler is registered for job kind "${job.kind}".`,
      finishedAt: nowIso(),
    });
  }

  try {
    const result = await handler(job, deps, context);
    return await deps.store.updateJob(job.id, {
      status: 'succeeded',
      result,
      progress: 1,
      progressLabel: null,
      finishedAt: nowIso(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.warn('job failed', { jobId: job.id, kind: job.kind, error: message });
    return deps.store.updateJob(job.id, { status: 'failed', error: message, finishedAt: nowIso() });
  }
}
