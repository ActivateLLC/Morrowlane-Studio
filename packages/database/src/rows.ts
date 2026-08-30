import type {
  AttributionEvent,
  Brand,
  BrandBrain,
  Campaign,
  CampaignPhase,
  Competitor,
  ContentItem,
  CrawledPage,
  Insight,
  Job,
  MediaAsset,
  Membership,
  Organization,
  PostMetrics,
  ScheduledPost,
  SocialConnection,
  Trend,
} from '@morrowlane/shared';

/**
 * Mapping between Postgres rows and domain objects. Kept in one file so the column
 * names live next to the schema they mirror and nothing else has to know about
 * snake_case.
 */

type Row = Record<string, unknown>;

const str = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);
const nullableStr = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const num = (value: unknown, fallback = 0): number => (typeof value === 'number' ? value : fallback);
const nullableNum = (value: unknown): number | null => (typeof value === 'number' ? value : null);
const bool = (value: unknown, fallback = false): boolean => (typeof value === 'boolean' ? value : fallback);
const json = <T>(value: unknown, fallback: T): T => (value === null || value === undefined ? fallback : (value as T));
const iso = (value: unknown, fallback = new Date(0).toISOString()): string =>
  typeof value === 'string' ? new Date(value).toISOString() : fallback;
const nullableIso = (value: unknown): string | null =>
  typeof value === 'string' ? new Date(value).toISOString() : null;

export const toOrganization = (row: Row): Organization => ({
  id: str(row['id']),
  name: str(row['name']),
  slug: str(row['slug']),
  createdAt: iso(row['created_at']),
});

export const toMembership = (row: Row): Membership => ({
  id: str(row['id']),
  organizationId: str(row['organization_id']),
  userId: str(row['user_id']),
  email: str(row['email']),
  role: str(row['role'], 'editor') as Membership['role'],
  invitedAt: iso(row['invited_at']),
  acceptedAt: nullableIso(row['accepted_at']),
});

export const toBrand = (row: Row): Brand => ({
  id: str(row['id']),
  organizationId: str(row['organization_id']),
  name: str(row['name']),
  websiteUrl: str(row['website_url']),
  status: str(row['status'], 'draft') as Brand['status'],
  statusDetail: nullableStr(row['status_detail']),
  createdAt: iso(row['created_at']),
  updatedAt: iso(row['updated_at']),
});

export const fromBrand = (brand: Brand): Row => ({
  id: brand.id,
  organization_id: brand.organizationId,
  name: brand.name,
  website_url: brand.websiteUrl,
  status: brand.status,
  status_detail: brand.statusDetail,
  created_at: brand.createdAt,
  updated_at: brand.updatedAt,
});

export const toPage = (row: Row): CrawledPage => ({
  id: str(row['id']),
  brandId: str(row['brand_id']),
  url: str(row['url']),
  canonicalUrl: nullableStr(row['canonical_url']),
  pageType: str(row['page_type'], 'other') as CrawledPage['pageType'],
  pageTypeConfidence: num(row['page_type_confidence']),
  title: nullableStr(row['title']),
  metaDescription: nullableStr(row['meta_description']),
  headings: json(row['headings'], [] as string[]),
  text: str(row['body_text']),
  wordCount: num(row['word_count']),
  language: nullableStr(row['language']),
  images: json(row['images'], [] as CrawledPage['images']),
  internalLinks: json(row['internal_links'], [] as string[]),
  externalLinks: json(row['external_links'], [] as string[]),
  socialLinks: json(row['social_links'], [] as string[]),
  faqs: json(row['faqs'], [] as CrawledPage['faqs']),
  testimonials: json(row['testimonials'], [] as CrawledPage['testimonials']),
  ctas: json(row['ctas'], [] as string[]),
  prices: json(row['prices'], [] as string[]),
  structuredData: json(row['structured_data'], [] as unknown[]),
  publishedAt: nullableIso(row['published_at']),
  fetchedAt: iso(row['fetched_at']),
  contentHash: str(row['content_hash']),
});

export const fromPage = (page: CrawledPage): Row => ({
  id: page.id,
  brand_id: page.brandId,
  url: page.url,
  canonical_url: page.canonicalUrl,
  page_type: page.pageType,
  page_type_confidence: page.pageTypeConfidence,
  title: page.title,
  meta_description: page.metaDescription,
  headings: page.headings,
  body_text: page.text,
  word_count: page.wordCount,
  language: page.language,
  images: page.images,
  internal_links: page.internalLinks,
  external_links: page.externalLinks,
  social_links: page.socialLinks,
  faqs: page.faqs,
  testimonials: page.testimonials,
  ctas: page.ctas,
  prices: page.prices,
  structured_data: page.structuredData,
  published_at: page.publishedAt,
  fetched_at: page.fetchedAt,
  content_hash: page.contentHash,
});

/** The brain is stored as one JSON document; its shape changes faster than a schema should. */
export const toBrain = (row: Row): BrandBrain => {
  const payload = json(row['payload'], {} as Partial<BrandBrain>);
  return {
    ...(payload as BrandBrain),
    brandId: str(row['brand_id'], payload.brandId ?? ''),
    version: num(row['version'], payload.version ?? 1),
    completeness: num(row['completeness'], payload.completeness ?? 0),
    sourcePageCount: num(row['source_page_count'], payload.sourcePageCount ?? 0),
    lockedFields: json(row['locked_fields'], payload.lockedFields ?? []),
    generatedAt: iso(row['generated_at'], payload.generatedAt ?? new Date(0).toISOString()),
  };
};

export const fromBrain = (brain: BrandBrain, id: string): Row => ({
  id,
  brand_id: brain.brandId,
  version: brain.version,
  payload: brain,
  completeness: brain.completeness,
  source_page_count: brain.sourcePageCount,
  locked_fields: brain.lockedFields,
  generated_at: brain.generatedAt,
});

export const toContent = (row: Row): ContentItem => ({
  id: str(row['id']),
  brandId: str(row['brand_id']),
  campaignId: nullableStr(row['campaign_id']),
  campaignPhaseId: nullableStr(row['campaign_phase_id']),
  format: str(row['format'], 'instagram_post') as ContentItem['format'],
  channel: str(row['channel'], 'instagram') as ContentItem['channel'],
  status: str(row['status'], 'draft') as ContentItem['status'],
  title: str(row['title']),
  hook: str(row['hook']),
  body: str(row['body']),
  segments: json(row['segments'], [] as ContentItem['segments']),
  hashtags: json(row['hashtags'], [] as string[]),
  cta: nullableStr(row['cta']),
  linkUrl: nullableStr(row['link_url']),
  mediaAssetIds: json(row['media_asset_ids'], [] as string[]),
  topics: json(row['topics'], [] as string[]),
  lineage: json(row['lineage'], {
    sourceType: 'brand',
    sourceUrl: null,
    sourceId: null,
    instruction: null,
    parentContentId: null,
    appliedInsightIds: [],
  } as ContentItem['lineage']),
  violations: json(row['violations'], [] as ContentItem['violations']),
  model: nullableStr(row['model']),
  createdAt: iso(row['created_at']),
  updatedAt: iso(row['updated_at']),
});

export const fromContent = (item: ContentItem): Row => ({
  id: item.id,
  brand_id: item.brandId,
  campaign_id: item.campaignId,
  campaign_phase_id: item.campaignPhaseId,
  format: item.format,
  channel: item.channel,
  status: item.status,
  title: item.title,
  hook: item.hook,
  body: item.body,
  segments: item.segments,
  hashtags: item.hashtags,
  cta: item.cta,
  link_url: item.linkUrl,
  media_asset_ids: item.mediaAssetIds,
  topics: item.topics,
  lineage: item.lineage,
  violations: item.violations,
  model: item.model,
  created_at: item.createdAt,
  updated_at: item.updatedAt,
});

export const toMedia = (row: Row): MediaAsset => ({
  id: str(row['id']),
  brandId: str(row['brand_id']),
  kind: str(row['kind'], 'image') as MediaAsset['kind'],
  url: str(row['url']),
  thumbnailUrl: nullableStr(row['thumbnail_url']),
  prompt: nullableStr(row['prompt']),
  width: nullableNum(row['width']),
  height: nullableNum(row['height']),
  durationSeconds: nullableNum(row['duration_seconds']),
  renderer: str(row['renderer'], 'upload') as MediaAsset['renderer'],
  createdAt: iso(row['created_at']),
});

export const fromMedia = (asset: MediaAsset): Row => ({
  id: asset.id,
  brand_id: asset.brandId,
  kind: asset.kind,
  url: asset.url,
  thumbnail_url: asset.thumbnailUrl,
  prompt: asset.prompt,
  width: asset.width,
  height: asset.height,
  duration_seconds: asset.durationSeconds,
  renderer: asset.renderer,
  created_at: asset.createdAt,
});

export const toPhase = (row: Row): CampaignPhase => ({
  id: str(row['id']),
  campaignId: str(row['campaign_id']),
  kind: str(row['kind'], 'education') as CampaignPhase['kind'],
  title: str(row['title']),
  narrative: str(row['narrative']),
  startDay: num(row['start_day']),
  endDay: num(row['end_day']),
  postCount: num(row['post_count']),
});

export const fromPhase = (phase: CampaignPhase, position: number): Row => ({
  id: phase.id,
  campaign_id: phase.campaignId,
  kind: phase.kind,
  title: phase.title,
  narrative: phase.narrative,
  start_day: phase.startDay,
  end_day: phase.endDay,
  post_count: phase.postCount,
  position,
});

export const toCampaign = (row: Row, phases: CampaignPhase[]): Campaign => ({
  id: str(row['id']),
  brandId: str(row['brand_id']),
  name: str(row['name']),
  goal: str(row['goal']),
  productId: nullableStr(row['product_id']),
  channels: json(row['channels'], [] as Campaign['channels']),
  durationDays: num(row['duration_days'], 30),
  startDate: iso(row['start_date']),
  status: str(row['status'], 'draft') as Campaign['status'],
  narrative: str(row['narrative']),
  phases,
  createdAt: iso(row['created_at']),
  updatedAt: iso(row['updated_at']),
});

export const fromCampaign = (campaign: Campaign): Row => ({
  id: campaign.id,
  brand_id: campaign.brandId,
  name: campaign.name,
  goal: campaign.goal,
  product_id: campaign.productId,
  channels: campaign.channels,
  duration_days: campaign.durationDays,
  start_date: campaign.startDate,
  status: campaign.status,
  narrative: campaign.narrative,
  created_at: campaign.createdAt,
  updated_at: campaign.updatedAt,
});

export const toConnection = (row: Row): SocialConnection => ({
  id: str(row['id']),
  brandId: str(row['brand_id']),
  channel: str(row['channel'], 'instagram') as SocialConnection['channel'],
  displayName: str(row['display_name']),
  externalAccountId: str(row['external_account_id']),
  status: str(row['status'], 'active') as SocialConnection['status'],
  scopes: json(row['scopes'], [] as string[]),
  expiresAt: nullableIso(row['expires_at']),
  lastValidatedAt: nullableIso(row['last_validated_at']),
  createdAt: iso(row['created_at']),
});

export const toScheduledPost = (row: Row): ScheduledPost => ({
  id: str(row['id']),
  brandId: str(row['brand_id']),
  contentId: str(row['content_id']),
  connectionId: nullableStr(row['connection_id']),
  channel: str(row['channel'], 'instagram') as ScheduledPost['channel'],
  scheduledFor: iso(row['scheduled_for']),
  status: str(row['status'], 'scheduled') as ScheduledPost['status'],
  attempts: num(row['attempts']),
  lastError: nullableStr(row['last_error']),
  externalPostId: nullableStr(row['external_post_id']),
  externalUrl: nullableStr(row['external_url']),
  publishedAt: nullableIso(row['published_at']),
});

export const fromScheduledPost = (post: ScheduledPost): Row => ({
  id: post.id,
  brand_id: post.brandId,
  content_id: post.contentId,
  connection_id: post.connectionId,
  channel: post.channel,
  scheduled_for: post.scheduledFor,
  status: post.status,
  attempts: post.attempts,
  last_error: post.lastError,
  external_post_id: post.externalPostId,
  external_url: post.externalUrl,
  published_at: post.publishedAt,
});

export const toCompetitor = (row: Row): Competitor & { snapshot?: unknown } => ({
  id: str(row['id']),
  brandId: str(row['brand_id']),
  name: str(row['name']),
  websiteUrl: str(row['website_url']),
  lastCheckedAt: nullableIso(row['last_checked_at']),
  signals: json(row['signals'], [] as Competitor['signals']),
  snapshot: row['snapshot'] ?? undefined,
});

export const toTrend = (row: Row): Trend => ({
  id: str(row['id']),
  brandId: str(row['brand_id']),
  topic: str(row['topic']),
  source: str(row['source'], 'search') as Trend['source'],
  summary: str(row['summary']),
  relevance: num(row['relevance']),
  momentum: num(row['momentum']),
  expiresAt: nullableIso(row['expires_at']),
  observedAt: iso(row['observed_at']),
});

export const fromTrend = (trend: Trend): Row => ({
  id: trend.id,
  brand_id: trend.brandId,
  topic: trend.topic,
  source: trend.source,
  summary: trend.summary,
  relevance: trend.relevance,
  momentum: trend.momentum,
  expires_at: trend.expiresAt,
  observed_at: trend.observedAt,
});

export const toInsight = (row: Row): Insight => ({
  id: str(row['id']),
  brandId: str(row['brand_id']),
  dimension: str(row['dimension']),
  subject: str(row['subject']),
  comparison: nullableStr(row['comparison']),
  lift: num(row['lift'], 1),
  metric: str(row['metric']),
  sampleSize: num(row['sample_size']),
  confidence: num(row['confidence']),
  statement: str(row['statement']),
  applied: bool(row['applied']),
  createdAt: iso(row['created_at']),
});

export const fromInsight = (insight: Insight): Row => ({
  id: insight.id,
  brand_id: insight.brandId,
  dimension: insight.dimension,
  subject: insight.subject,
  comparison: insight.comparison,
  lift: insight.lift,
  metric: insight.metric,
  sample_size: insight.sampleSize,
  confidence: insight.confidence,
  statement: insight.statement,
  applied: insight.applied,
  created_at: insight.createdAt,
});

export const toEvent = (row: Row): AttributionEvent => ({
  id: str(row['id']),
  brandId: str(row['brand_id']),
  contentId: nullableStr(row['content_id']),
  scheduledPostId: nullableStr(row['scheduled_post_id']),
  channel: nullableStr(row['channel']) as AttributionEvent['channel'],
  stage: str(row['stage'], 'impression') as AttributionEvent['stage'],
  value: num(row['value'], 1),
  currency: nullableStr(row['currency']),
  occurredAt: iso(row['occurred_at']),
  metadata: json(row['metadata'], {} as Record<string, unknown>),
});

export const fromEvent = (event: AttributionEvent): Row => ({
  id: event.id,
  brand_id: event.brandId,
  content_id: event.contentId,
  scheduled_post_id: event.scheduledPostId,
  channel: event.channel,
  stage: event.stage,
  value: event.value,
  currency: event.currency,
  occurred_at: event.occurredAt,
  metadata: event.metadata,
});

export const toMetrics = (row: Row): PostMetrics => ({
  scheduledPostId: str(row['scheduled_post_id']),
  impressions: num(row['impressions']),
  engagements: num(row['engagements']),
  clicks: num(row['clicks']),
  shares: num(row['shares']),
  comments: num(row['comments']),
  collectedAt: iso(row['collected_at']),
});

export const toJob = (row: Row): Job => ({
  id: str(row['id']),
  organizationId: str(row['organization_id']),
  brandId: nullableStr(row['brand_id']),
  kind: str(row['kind'], 'crawl_site') as Job['kind'],
  status: str(row['status'], 'queued') as Job['status'],
  payload: json(row['payload'], {} as Record<string, unknown>),
  result: (row['result'] ?? null) as Record<string, unknown> | null,
  error: nullableStr(row['error']),
  progress: num(row['progress']),
  progressLabel: nullableStr(row['progress_label']),
  attempts: num(row['attempts']),
  runAfter: iso(row['run_after']),
  startedAt: nullableIso(row['started_at']),
  finishedAt: nullableIso(row['finished_at']),
  createdAt: iso(row['created_at']),
});
