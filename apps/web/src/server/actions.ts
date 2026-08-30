'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { parseStudioIntent } from '@morrowlane/content-engine';
import { applyInsights } from '@morrowlane/analytics';
import { runJob } from '@morrowlane/agents';
import {
  ValidationError,
  getCampaignOutcome,
  isChannel,
  isContentFormat,
  normalizeUrl,
  registrableHost,
  titleCase,
  type Campaign,
  type Channel,
  type ContentFormat,
} from '@morrowlane/shared';
import {
  DEMO_COOKIE_NAME,
  encodeDemoSession,
  ensureDemoSeed,
  requireBrandAdmin,
  requireBrandWrite,
  requireOrgAdmin,
  requireOrgWrite,
  requireSession,
  supabaseConfigured,
} from './session.js';

/**
 * Every write in the product. Jobs are enqueued and then run inline when no separate
 * worker is running, so a single `pnpm dev` process behaves like the full deployment.
 */

async function enqueueAndMaybeRun(
  input: { organizationId: string; brandId: string | null; kind: Parameters<Awaited<ReturnType<typeof requireSession>>['runtime']['store']['enqueueJob']>[0]['kind']; payload: Record<string, unknown> },
) {
  const session = await requireSession();
  const job = await session.runtime.store.enqueueJob(input);

  if (process.env['MORROWLANE_WORKER'] === 'external') return job;

  // Inline execution keeps local development to one process. The worker claims the
  // job first so the two paths cannot both run it.
  const claimed = await session.runtime.store.claimJob('inline');
  if (!claimed || claimed.id !== job.id) return job;
  return runJob(claimed, session.runtime);
}

/* ------------------------------- Auth ---------------------------------- */

export async function startDemoSession() {
  if (supabaseConfigured()) {
    throw new ValidationError('This deployment uses Supabase Auth. Sign in with your account.');
  }
  const { email, userId } = await ensureDemoSeed();
  const cookie = encodeDemoSession({ id: userId, email });
  const store = await cookies();
  store.set(cookie.name, cookie.value, { httpOnly: true, sameSite: 'lax', path: '/' });
  redirect('/');
}

export async function signOut() {
  const store = await cookies();
  store.delete(DEMO_COOKIE_NAME);
  redirect('/sign-in');
}

/* ------------------------------ Brands --------------------------------- */

/** Uploaded images become data URLs so the zero-config store can hold them; big files are skipped. */
async function fileToDataUrl(file: File, maxBytes: number): Promise<string | null> {
  if (!file || file.size === 0 || file.size > maxBytes || !file.type.startsWith('image/')) return null;
  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64');
  return `data:${file.type};base64,${base64}`;
}

/**
 * The "I don't have a website yet" path. Instead of a crawl, the user answers a few
 * high-value questions and Morrowlane builds the first Brand Profile from them — a real
 * Brand Brain in the same system, editable and ready to generate against.
 */
export async function startBrandBuilder(formData: FormData) {
  const session = await requireOrgWrite();

  const businessName = String(formData.get('businessName') ?? '').trim();
  const whatYouSell = String(formData.get('whatYouSell') ?? '').trim();
  if (!businessName) throw new ValidationError('What is your business called?');
  if (!whatYouSell) throw new ValidationError('Tell Morrowlane what you sell so it has something to work from.');

  const contactChannels = String(formData.get('contactChannels') ?? '')
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  // A logo and up to four images, small ones only, stored inline as data URLs.
  const logoUrls = ([await fileToDataUrl(formData.get('logo') as File, 800_000)].filter(Boolean) as string[]);
  const imageUrls = (
    await Promise.all(formData.getAll('images').slice(0, 4).map((f) => fileToDataUrl(f as File, 1_200_000)))
  ).filter(Boolean) as string[];

  const brand = await session.runtime.store.createBrand({
    organizationId: session.organizationId,
    name: businessName,
    websiteUrl: '',
  });

  await enqueueAndMaybeRun({
    organizationId: session.organizationId,
    brandId: brand.id,
    kind: 'build_brand_profile',
    payload: {
      businessName,
      whatYouSell,
      audience: String(formData.get('audience') ?? '').trim() || null,
      desiredAction: String(formData.get('desiredAction') ?? '').trim() || null,
      contactChannels,
      brandFeel: String(formData.get('brandFeel') ?? '').trim() || null,
      logoUrls,
      imageUrls,
    },
  });

  revalidatePath('/');
  redirect(`/brands/${brand.id}`);
}

export async function addBrand(formData: FormData) {
  const session = await requireOrgWrite();
  const raw = String(formData.get('websiteUrl') ?? '');
  const websiteUrl = normalizeUrl(raw);
  if (!websiteUrl) {
    throw new ValidationError(`"${raw}" does not look like a website address.`);
  }

  const host = registrableHost(websiteUrl) ?? websiteUrl;
  const brand = await session.runtime.store.createBrand({
    organizationId: session.organizationId,
    // Renamed to the real company name once the analysis reads the site.
    name: titleCase(host.split('.')[0] ?? host),
    websiteUrl,
  });

  await enqueueAndMaybeRun({
    organizationId: session.organizationId,
    brandId: brand.id,
    kind: 'crawl_site',
    payload: { websiteUrl },
  });

  revalidatePath('/');
  redirect(`/brands/${brand.id}`);
}

export async function reanalyzeBrand(brandId: string) {
  const { brand, organizationId } = await requireBrandWrite(brandId);
  await enqueueAndMaybeRun({
    organizationId,
    brandId: brand.id,
    kind: 'crawl_site',
    payload: { websiteUrl: brand.websiteUrl },
  });
  revalidatePath(`/brands/${brandId}`);
}

/** Editing a Brand Brain field locks it, so the next analysis cannot overwrite it. */
export async function updateBrainField(brandId: string, path: string, value: string) {
  const { runtime } = await requireBrandWrite(brandId);
  const brain = await runtime.store.getBrain(brandId);
  if (!brain) throw new ValidationError('This brand has not been analysed yet.');

  const next = structuredClone(brain);
  const keys = path.split('.');
  const last = keys.pop();
  if (!last) throw new ValidationError('That field cannot be edited.');

  let node: Record<string, unknown> = next as unknown as Record<string, unknown>;
  for (const key of keys) {
    const child = node[key];
    if (child === null || typeof child !== 'object') throw new ValidationError('That field cannot be edited.');
    node = child as Record<string, unknown>;
  }

  const current = node[last];
  node[last] = Array.isArray(current)
    ? value.split('\n').map((line) => line.trim()).filter(Boolean)
    : value;

  next.lockedFields = [...new Set([...brain.lockedFields, path])];
  await runtime.store.saveBrain(next);
  revalidatePath(`/brands/${brandId}`);
}

/* ------------------------------ Studio --------------------------------- */

export async function runStudio(brandId: string, formData: FormData) {
  const { organizationId } = await requireBrandWrite(brandId);
  const instruction = String(formData.get('instruction') ?? '').trim();
  if (!instruction) throw new ValidationError('Tell Morrowlane what you want to create.');

  const intent = parseStudioIntent(instruction);

  if (intent.action === 'remix_url' && intent.url) {
    await enqueueAndMaybeRun({
      organizationId,
      brandId,
      kind: 'remix_url',
      payload: { url: intent.url, instruction },
    });
  } else if (intent.action === 'plan_campaign') {
    await enqueueAndMaybeRun({
      organizationId,
      brandId,
      kind: 'plan_campaign',
      payload: {
        goal: intent.goal ?? instruction,
        channels: intent.channels,
        durationDays: intent.durationDays ?? 30,
        productName: intent.productHint,
      },
    });
  } else if (intent.action === 'fill_calendar') {
    await enqueueAndMaybeRun({
      organizationId,
      brandId,
      kind: 'fill_calendar',
      payload: { days: intent.durationDays ?? 30, channels: intent.channels },
    });
  } else {
    const formats: ContentFormat[] = intent.formats.filter(isContentFormat);
    const targets = formats.length > 0 ? formats : (['instagram_post'] as ContentFormat[]);
    for (const format of targets) {
      await enqueueAndMaybeRun({
        organizationId,
        brandId,
        kind: 'generate_content',
        payload: {
          format,
          channel: intent.channels[0],
          count: intent.count,
          instruction,
          topic: intent.topic,
          productName: intent.productHint,
        },
      });
    }
  }

  revalidatePath(`/brands/${brandId}/studio`);
  revalidatePath(`/brands/${brandId}/library`);
}

export async function generateFormat(brandId: string, formData: FormData) {
  const { organizationId } = await requireBrandWrite(brandId);
  const format = String(formData.get('format') ?? '');
  if (!isContentFormat(format)) throw new ValidationError('Choose a content format.');

  await enqueueAndMaybeRun({
    organizationId,
    brandId,
    kind: 'generate_content',
    payload: {
      format,
      count: Number(formData.get('count') ?? 5),
      productName: String(formData.get('productName') ?? '') || null,
      topic: String(formData.get('topic') ?? '') || null,
      instruction: String(formData.get('instruction') ?? '') || null,
    },
  });

  revalidatePath(`/brands/${brandId}/studio`);
  revalidatePath(`/brands/${brandId}/library`);
}

export async function remix(brandId: string, formData: FormData) {
  const { organizationId } = await requireBrandWrite(brandId);
  const url = normalizeUrl(String(formData.get('url') ?? ''));
  if (!url) throw new ValidationError('Paste a page address to remix.');

  await enqueueAndMaybeRun({
    organizationId,
    brandId,
    kind: 'remix_url',
    payload: { url, instruction: String(formData.get('instruction') ?? '') || null },
  });

  revalidatePath(`/brands/${brandId}/remix`);
  revalidatePath(`/brands/${brandId}/library`);
}

/* ----------------------------- Campaigns -------------------------------- */

export async function createCampaign(brandId: string, formData: FormData) {
  const { organizationId } = await requireBrandWrite(brandId);
  const goal = String(formData.get('goal') ?? '').trim();
  if (!goal) throw new ValidationError('Describe what this campaign should achieve.');

  const channels = formData.getAll('channels').map(String).filter(isChannel) as Channel[];

  await enqueueAndMaybeRun({
    organizationId,
    brandId,
    kind: 'plan_campaign',
    payload: {
      goal,
      productName: String(formData.get('productName') ?? '') || null,
      channels: channels.length > 0 ? channels : ['instagram'],
      durationDays: Number(formData.get('durationDays') ?? 30),
    },
  });

  revalidatePath(`/brands/${brandId}/campaigns`);
  revalidatePath(`/brands/${brandId}/calendar`);
}

/**
 * The guided flow's generate step (steps 5–6): the user picked a business outcome, so we
 * derive the goal from it (unless they typed their own), plan the campaign and write the
 * content — but hold scheduling (review:true) so nothing goes live before the consolidated
 * plan is approved. Runs inline in dev so we can land straight on the review screen.
 */
export async function startGuidedCampaign(brandId: string, formData: FormData) {
  const { organizationId } = await requireBrandWrite(brandId);

  const outcomeId = String(formData.get('outcome') ?? '');
  const outcome = getCampaignOutcome(outcomeId);
  if (!outcome) throw new ValidationError('Choose a business outcome to aim for.');

  const customGoal = String(formData.get('goal') ?? '').trim();
  const channels = formData.getAll('channels').map(String).filter(isChannel) as Channel[];
  const durationDays = Number(formData.get('durationDays') ?? outcome.defaultDurationDays);

  const job = await enqueueAndMaybeRun({
    organizationId,
    brandId,
    kind: 'plan_campaign',
    payload: {
      goal: customGoal || outcome.goalTemplate,
      outcome: outcome.id,
      productName: String(formData.get('productName') ?? '') || null,
      channels: channels.length > 0 ? channels : ['instagram'],
      durationDays: Number.isFinite(durationDays) ? durationDays : outcome.defaultDurationDays,
      review: true,
    },
  });

  revalidatePath(`/brands/${brandId}/campaigns`);
  // Inline execution carries the new campaign id in the job result; land on its plan.
  const campaignId = job?.result && typeof job.result['campaignId'] === 'string' ? job.result['campaignId'] : null;
  redirect(campaignId ? `/brands/${brandId}/campaigns/${campaignId}` : `/brands/${brandId}/campaigns`);
}

/**
 * The consolidated approval (steps 7 → 9): approve every rule-clean piece in the plan at
 * once, then schedule the whole thing onto the calendar and activate the campaign. Content
 * that breaks a brand rule is left in review and reported back, never silently published.
 */
export async function approvePlan(brandId: string, campaignId: string) {
  const { organizationId, runtime } = await requireBrandWrite(brandId);
  const campaign = await runtime.store.getCampaign(campaignId);
  if (!campaign || campaign.brandId !== brandId) throw new ValidationError('That campaign is not in this brand.');

  const { items } = await runtime.store.queryContent({ brandId, campaignId, limit: 500 });
  const blocked = items.filter((item) => item.violations.some((v) => v.severity === 'error'));
  const approvable = items.filter((item) => !blocked.includes(item) && item.status !== 'published');

  for (const item of approvable) {
    if (item.status !== 'approved') await runtime.store.updateContent(item.id, { status: 'approved' });
  }

  if (approvable.length === 0) {
    throw new ValidationError(
      blocked.length > 0
        ? 'Every piece in this plan breaks a brand rule. Fix them before scheduling.'
        : 'There is nothing in this plan to schedule yet.',
    );
  }

  await enqueueAndMaybeRun({ organizationId, brandId, kind: 'activate_campaign', payload: { campaignId } });

  revalidatePath(`/brands/${brandId}/campaigns/${campaignId}`);
  revalidatePath(`/brands/${brandId}/calendar`);
  // Golden-path completion: the "your month is ready" hand-off into the power pages.
  redirect(`/brands/${brandId}/ready?campaign=${campaignId}`);
}

export async function updateCampaignStatus(brandId: string, campaignId: string, status: string) {
  const { runtime } = await requireBrandWrite(brandId);
  const campaign = await runtime.store.getCampaign(campaignId);
  if (!campaign || campaign.brandId !== brandId) throw new ValidationError('That campaign is not in this brand.');
  if (!['active', 'complete', 'archived', 'ready'].includes(status)) {
    throw new ValidationError('That is not a campaign status.');
  }
  await runtime.store.updateCampaign(campaignId, { status: status as Campaign['status'] });
  revalidatePath(`/brands/${brandId}/campaigns`);
  revalidatePath(`/brands/${brandId}/campaigns/${campaignId}`);
}

/* ------------------------------ Calendar -------------------------------- */

export async function fillMonthAction(brandId: string) {
  const { organizationId } = await requireBrandWrite(brandId);
  await enqueueAndMaybeRun({
    organizationId,
    brandId,
    kind: 'fill_calendar',
    payload: { days: 30 },
  });
  revalidatePath(`/brands/${brandId}/calendar`);
  revalidatePath(`/brands/${brandId}/library`);
  // Golden-path completion: summarise what was made, then hand off to the power page.
  redirect(`/brands/${brandId}/ready?fill=1`);
}

export async function reschedulePost(brandId: string, postId: string, scheduledFor: string) {
  const { runtime } = await requireBrandWrite(brandId);
  const post = await runtime.store.getScheduledPost(postId);
  if (!post || post.brandId !== brandId) throw new ValidationError('That post is not on this calendar.');
  if (post.status === 'published') throw new ValidationError('A published post cannot be rescheduled.');

  await runtime.store.updateScheduledPost(postId, { scheduledFor });
  revalidatePath(`/brands/${brandId}/calendar`);
}

export async function cancelPost(brandId: string, postId: string) {
  const { runtime } = await requireBrandWrite(brandId);
  const post = await runtime.store.getScheduledPost(postId);
  if (!post || post.brandId !== brandId) throw new ValidationError('That post is not on this calendar.');
  await runtime.store.updateScheduledPost(postId, { status: 'cancelled' });
  revalidatePath(`/brands/${brandId}/calendar`);
}

export async function publishNow(brandId: string, postId: string) {
  const { organizationId, runtime } = await requireBrandWrite(brandId);
  const post = await runtime.store.getScheduledPost(postId);
  if (!post || post.brandId !== brandId) throw new ValidationError('That post is not on this calendar.');

  await runtime.store.updateScheduledPost(postId, { status: 'publishing' });
  await enqueueAndMaybeRun({
    organizationId,
    brandId,
    kind: 'publish_post',
    payload: { scheduledPostId: postId },
  });
  revalidatePath(`/brands/${brandId}/calendar`);
}

/* ------------------------------- Content -------------------------------- */

export async function approveContent(brandId: string, contentId: string) {
  const { runtime } = await requireBrandWrite(brandId);
  const item = await runtime.store.getContent(contentId);
  if (!item || item.brandId !== brandId) throw new ValidationError('That content is not in this brand.');

  if (item.violations.some((violation) => violation.severity === 'error')) {
    throw new ValidationError('This breaks a brand rule. Edit it before approving.');
  }
  await runtime.store.updateContent(contentId, { status: 'approved' });
  revalidatePath(`/brands/${brandId}/library`);
}

export async function updateContentBody(brandId: string, contentId: string, body: string) {
  const { runtime } = await requireBrandWrite(brandId);
  const brain = await runtime.store.getBrain(brandId);
  const item = await runtime.store.getContent(contentId);
  if (!item || item.brandId !== brandId) throw new ValidationError('That content is not in this brand.');

  // Re-check rules on every edit: a human can introduce a violation just as easily.
  const { checkRules } = await import('@morrowlane/content-engine');
  const violations = brain
    ? checkRules({
        channel: item.channel,
        format: item.format,
        body,
        hook: item.hook,
        segments: item.segments,
        hashtags: item.hashtags,
        cta: item.cta,
        rules: brain.rules,
      })
    : [];

  await runtime.store.updateContent(contentId, {
    body,
    violations,
    status: violations.some((v) => v.severity === 'error') ? 'needs_review' : item.status,
  });
  revalidatePath(`/brands/${brandId}/library`);
}

export async function scheduleContentItem(brandId: string, contentId: string, scheduledFor: string) {
  const { runtime } = await requireBrandWrite(brandId);
  const item = await runtime.store.getContent(contentId);
  if (!item || item.brandId !== brandId) throw new ValidationError('That content is not in this brand.');
  if (item.violations.some((v) => v.severity === 'error')) {
    throw new ValidationError('This breaks a brand rule and cannot be scheduled.');
  }

  const connection = (await runtime.store.listConnections(brandId)).find((c) => c.channel === item.channel);
  const { newId } = await import('@morrowlane/shared');

  await runtime.store.saveScheduledPosts([
    {
      id: newId('schedule'),
      brandId,
      contentId,
      connectionId: connection?.id ?? null,
      channel: item.channel,
      scheduledFor,
      status: 'scheduled',
      attempts: 0,
      lastError: null,
      externalPostId: null,
      externalUrl: null,
      publishedAt: null,
    },
  ]);
  await runtime.store.updateContent(contentId, { status: 'scheduled' });
  revalidatePath(`/brands/${brandId}/calendar`);
  revalidatePath(`/brands/${brandId}/library`);
}

export async function duplicateContent(brandId: string, contentId: string) {
  const { runtime } = await requireBrandWrite(brandId);
  const item = await runtime.store.getContent(contentId);
  if (!item || item.brandId !== brandId) throw new ValidationError('That content is not in this brand.');

  const { newId, nowIso } = await import('@morrowlane/shared');
  const copy = {
    ...structuredClone(item),
    id: newId('content'),
    status: 'draft' as const,
    title: `${item.title} (copy)`,
    lineage: { ...item.lineage, parentContentId: item.id },
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await runtime.store.saveContent([copy]);
  revalidatePath(`/brands/${brandId}/library`);
  redirect(`/brands/${brandId}/library/${copy.id}`);
}

/** Three fresh takes on the same idea, linked back to this item for the learning loop. */
export async function generateVariants(brandId: string, contentId: string) {
  const { organizationId, runtime } = await requireBrandWrite(brandId);
  const item = await runtime.store.getContent(contentId);
  if (!item || item.brandId !== brandId) throw new ValidationError('That content is not in this brand.');

  await enqueueAndMaybeRun({
    organizationId,
    brandId,
    kind: 'generate_content',
    payload: {
      format: item.format,
      channel: item.channel,
      count: 3,
      topic: item.topics[0] ?? item.title,
      instruction: item.lineage.instruction ?? `Fresh angles on: ${item.title}`,
      campaignId: item.campaignId,
      parentContentId: item.id,
    },
  });
  revalidatePath(`/brands/${brandId}/library`);
  revalidatePath(`/brands/${brandId}/library/${contentId}`);
}

/** Renders the creatives for an image-format piece: slides, quote cards, infographics. */
export async function renderMedia(brandId: string, contentId: string) {
  const { organizationId, runtime } = await requireBrandWrite(brandId);
  const item = await runtime.store.getContent(contentId);
  if (!item || item.brandId !== brandId) throw new ValidationError('That content is not in this brand.');

  await enqueueAndMaybeRun({
    organizationId,
    brandId,
    kind: 'render_media',
    payload: { contentId },
  });
  revalidatePath(`/brands/${brandId}/library/${contentId}`);
}

export async function deleteContentItem(brandId: string, contentId: string) {
  const { runtime } = await requireBrandWrite(brandId);
  const item = await runtime.store.getContent(contentId);
  if (!item || item.brandId !== brandId) throw new ValidationError('That content is not in this brand.');
  await runtime.store.deleteContent(contentId);
  revalidatePath(`/brands/${brandId}/library`);
}

/* ----------------------------- Intelligence ----------------------------- */

export async function addCompetitor(brandId: string, formData: FormData) {
  const { runtime } = await requireBrandWrite(brandId);
  const websiteUrl = normalizeUrl(String(formData.get('websiteUrl') ?? ''));
  if (!websiteUrl) throw new ValidationError('Paste a competitor website address.');

  const { newId } = await import('@morrowlane/shared');
  const host = registrableHost(websiteUrl) ?? websiteUrl;

  await runtime.store.saveCompetitor({
    id: newId('competitor'),
    brandId,
    name: String(formData.get('name') ?? '') || titleCase(host.split('.')[0] ?? host),
    websiteUrl,
    lastCheckedAt: null,
    signals: [],
  });
  revalidatePath(`/brands/${brandId}/intelligence`);
}

export async function removeCompetitor(brandId: string, competitorId: string) {
  const { runtime } = await requireBrandWrite(brandId);
  const owned = (await runtime.store.listCompetitors(brandId)).some((c) => c.id === competitorId);
  if (!owned) throw new ValidationError('That competitor is not tracked by this brand.');
  await runtime.store.deleteCompetitor(competitorId);
  revalidatePath(`/brands/${brandId}/intelligence`);
}

export async function applyInsight(brandId: string, insightId: string) {
  const { runtime } = await requireBrandWrite(brandId);
  const owned = (await runtime.store.listInsights(brandId)).some((i) => i.id === insightId);
  if (!owned) throw new ValidationError('That insight is not in this brand.');
  await runtime.store.updateInsight(insightId, { applied: true });
  revalidatePath(`/brands/${brandId}/analytics`);
}

export async function unapplyInsight(brandId: string, insightId: string) {
  const { runtime } = await requireBrandWrite(brandId);
  const owned = (await runtime.store.listInsights(brandId)).some((i) => i.id === insightId);
  if (!owned) throw new ValidationError('That insight is not in this brand.');
  await runtime.store.updateInsight(insightId, { applied: false });
  revalidatePath(`/brands/${brandId}/analytics`);
}

export async function recomputeInsights(brandId: string) {
  const { organizationId } = await requireBrandWrite(brandId);
  await enqueueAndMaybeRun({ organizationId, brandId, kind: 'compute_insights', payload: {} });
  revalidatePath(`/brands/${brandId}/analytics`);
}

/** Runs an opportunity's one-click action. This is the whole point of the card. */
export async function actOnOpportunity(brandId: string, kind: string, payload: Record<string, unknown>) {
  const { organizationId } = await requireBrandWrite(brandId);

  if (kind === 'generate_campaign') {
    await enqueueAndMaybeRun({
      organizationId,
      brandId,
      kind: 'plan_campaign',
      payload: { goal: String(payload['goal'] ?? 'Respond to the market.'), durationDays: 30, channels: [] },
    });
    revalidatePath(`/brands/${brandId}/campaigns`);
    return;
  }

  if (kind === 'remix_url') {
    await enqueueAndMaybeRun({
      organizationId,
      brandId,
      kind: 'remix_url',
      payload: { url: String(payload['url'] ?? '') },
    });
    revalidatePath(`/brands/${brandId}/library`);
    return;
  }

  await enqueueAndMaybeRun({
    organizationId,
    brandId,
    kind: 'generate_content',
    payload: {
      format: 'instagram_post',
      count: Number(payload['count'] ?? 5),
      topic: payload['topic'] ? String(payload['topic']) : null,
    },
  });
  revalidatePath(`/brands/${brandId}/library`);
}

/* ----------------------------- Connections ------------------------------ */

export async function connectDemoAccount(brandId: string, channel: string) {
  const { runtime } = await requireBrandAdmin(brandId);
  if (!isChannel(channel)) throw new ValidationError('That is not a channel Morrowlane publishes to.');

  const provider = runtime.social.find(channel);
  if (!provider) throw new ValidationError(`Morrowlane has no adapter for ${channel}.`);
  if (provider.configured && !runtime.demoMode) {
    throw new ValidationError(`${provider.label} is configured for real OAuth. Use Connect instead.`);
  }

  const account = await provider.exchange({ code: 'demo', redirectUri: 'demo' });
  const { newId, nowIso } = await import('@morrowlane/shared');

  await runtime.store.saveConnection(
    {
      id: newId('connection'),
      brandId,
      channel,
      displayName: account.displayName,
      externalAccountId: account.externalAccountId,
      status: 'active',
      scopes: account.scopes,
      expiresAt: account.expiresAt,
      lastValidatedAt: nowIso(),
      createdAt: nowIso(),
    },
    { accessToken: account.accessToken, refreshToken: account.refreshToken, metadata: account.metadata },
  );

  revalidatePath(`/brands/${brandId}/connections`);
}

export async function disconnectAccount(brandId: string, connectionId: string) {
  const { runtime } = await requireBrandAdmin(brandId);
  const owned = (await runtime.store.listConnections(brandId)).some((c) => c.id === connectionId);
  if (!owned) throw new ValidationError('That connection is not in this brand.');
  await runtime.store.deleteConnection(connectionId);
  revalidatePath(`/brands/${brandId}/connections`);
}

/* -------------------------------- Team ---------------------------------- */

export async function inviteTeammate(formData: FormData) {
  const session = await requireOrgAdmin();
  const email = String(formData.get('email') ?? '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ValidationError('Enter a valid email address.');

  const role = String(formData.get('role') ?? 'editor');
  await session.runtime.store.inviteMember({
    organizationId: session.organizationId,
    email,
    role: (['owner', 'admin', 'editor', 'viewer'] as const).includes(role as never) ? (role as 'editor') : 'editor',
  });
  revalidatePath('/settings');
}

export async function removeTeammate(membershipId: string) {
  const session = await requireOrgAdmin();
  const members = await session.runtime.store.listMemberships(session.organizationId);
  const target = members.find((member) => member.id === membershipId);
  if (!target) throw new ValidationError('That member is not in your workspace.');
  if (target.role === 'owner') throw new ValidationError('The workspace owner cannot be removed.');

  await session.runtime.store.removeMember(membershipId);
  revalidatePath('/settings');
}
