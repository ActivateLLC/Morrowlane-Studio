import type { Channel } from './channels.js';
import type { ContentFormat } from './formats.js';

/* ------------------------------------------------------------------ */
/* Accounts                                                            */
/* ------------------------------------------------------------------ */

export type MemberRole = 'owner' | 'admin' | 'editor' | 'viewer';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface Membership {
  id: string;
  organizationId: string;
  userId: string;
  email: string;
  role: MemberRole;
  invitedAt: string;
  acceptedAt: string | null;
}

/* ------------------------------------------------------------------ */
/* Website intelligence                                                */
/* ------------------------------------------------------------------ */

export const PAGE_TYPES = [
  'homepage',
  'product',
  'service',
  'landing',
  'article',
  'pricing',
  'faq',
  'testimonial',
  'about',
  'contact',
  'legal',
  'other',
] as const;

export type PageType = (typeof PAGE_TYPES)[number];

export interface ExtractedFaq {
  question: string;
  answer: string;
}

export interface ExtractedTestimonial {
  quote: string;
  attribution: string | null;
}

export interface ExtractedImage {
  url: string;
  alt: string | null;
  /** Rough role guess so the creative engine can pick a hero vs. an icon. */
  role: 'logo' | 'hero' | 'content' | 'icon';
}

export interface CrawledPage {
  id: string;
  brandId: string;
  url: string;
  canonicalUrl: string | null;
  pageType: PageType;
  /** 0–1 confidence in `pageType`; low scores get re-checked by the Brand Analyst. */
  pageTypeConfidence: number;
  title: string | null;
  metaDescription: string | null;
  headings: string[];
  text: string;
  wordCount: number;
  language: string | null;
  images: ExtractedImage[];
  internalLinks: string[];
  externalLinks: string[];
  socialLinks: string[];
  faqs: ExtractedFaq[];
  testimonials: ExtractedTestimonial[];
  ctas: string[];
  prices: string[];
  structuredData: unknown[];
  publishedAt: string | null;
  fetchedAt: string;
  contentHash: string;
}

export interface DiscoveryResult {
  origin: string;
  robotsUrl: string | null;
  sitemapUrls: string[];
  feedUrls: string[];
  /** URLs to fetch, already deduplicated, normalized and priority-ordered. */
  candidates: string[];
  source: 'sitemap' | 'feed' | 'crawl' | 'mixed';
  notes: string[];
}

/* ------------------------------------------------------------------ */
/* Brand Brain                                                         */
/* ------------------------------------------------------------------ */

export interface BrandIdentity {
  companyName: string;
  category: string;
  oneLiner: string;
  description: string;
  audience: string[];
  industries: string[];
  locations: string[];
}

export interface BrandVoice {
  /** Adjectives such as "clear", "confident", "approachable". */
  traits: string[];
  /** Reading level target, 1 (plain) – 5 (technical). */
  readingLevel: number;
  personSummary: string;
  sampleSentences: string[];
  avoid: string[];
}

export interface BrandProduct {
  id: string;
  name: string;
  kind: 'product' | 'service';
  description: string;
  benefits: string[];
  audience: string[];
  priceHint: string | null;
  sourceUrls: string[];
  imageUrls: string[];
  claims: string[];
  ctas: string[];
}

export interface BrandVisuals {
  logoUrls: string[];
  /** Hex values ordered by prominence on the site. */
  colors: string[];
  imageUrls: string[];
  fontHints: string[];
}

export interface BrandRules {
  approvedTerminology: string[];
  prohibitedTerminology: string[];
  approvedClaims: string[];
  prohibitedClaims: string[];
  regulatoryNotes: string[];
  preferredCtas: string[];
  visualGuidelines: string[];
}

export interface BrandBrain {
  brandId: string;
  version: number;
  identity: BrandIdentity;
  voice: BrandVoice;
  products: BrandProduct[];
  offers: string[];
  faqs: ExtractedFaq[];
  testimonials: ExtractedTestimonial[];
  visuals: BrandVisuals;
  rules: BrandRules;
  terminology: string[];
  socialLinks: string[];
  /** Free-form facts the agents accumulate that do not fit the schema yet. */
  notes: string[];
  /** 0–1. Drives the "review your brand" nudges in the UI. */
  completeness: number;
  sourcePageCount: number;
  generatedAt: string;
  /** Fields a human edited; regeneration must not overwrite these. */
  lockedFields: string[];
}

export type BrandStatus = 'draft' | 'crawling' | 'analyzing' | 'ready' | 'failed';

export interface Brand {
  id: string;
  organizationId: string;
  name: string;
  websiteUrl: string;
  status: BrandStatus;
  statusDetail: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */

export type ContentStatus = 'draft' | 'needs_review' | 'approved' | 'scheduled' | 'published' | 'failed' | 'archived';

export interface ContentSegment {
  /** Slide, beat, thread post or article section. */
  index: number;
  heading: string | null;
  body: string;
  /** Visual direction for image/video formats. */
  visualDirection: string | null;
}

/** Where a piece of content came from. This is the head of the attribution graph. */
export interface ContentLineage {
  sourceType: 'brand' | 'url' | 'product' | 'campaign' | 'trend' | 'competitor' | 'insight' | 'remix';
  sourceUrl: string | null;
  sourceId: string | null;
  /** The user's own words, kept verbatim for regeneration and for learning. */
  instruction: string | null;
  parentContentId: string | null;
  /** Insight ids that shaped this generation, so we can measure whether they helped. */
  appliedInsightIds: string[];
}

export interface ContentItem {
  id: string;
  brandId: string;
  campaignId: string | null;
  campaignPhaseId: string | null;
  format: ContentFormat;
  channel: Channel;
  status: ContentStatus;
  title: string;
  hook: string;
  body: string;
  segments: ContentSegment[];
  hashtags: string[];
  cta: string | null;
  linkUrl: string | null;
  mediaAssetIds: string[];
  topics: string[];
  lineage: ContentLineage;
  /** Rule-check results; content with violations cannot be approved. */
  violations: RuleViolation[];
  model: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RuleViolation {
  rule: 'prohibited_terminology' | 'prohibited_claim' | 'length' | 'missing_cta' | 'hashtag_limit';
  severity: 'error' | 'warning';
  message: string;
  excerpt: string | null;
}

export interface MediaAsset {
  id: string;
  brandId: string;
  kind: 'image' | 'video' | 'audio';
  url: string;
  thumbnailUrl: string | null;
  prompt: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  renderer: 'comfyui' | 'remotion' | 'huggingface' | 'svg' | 'upload' | 'source_site';
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Campaigns                                                           */
/* ------------------------------------------------------------------ */

export type CampaignStatus = 'draft' | 'planning' | 'ready' | 'active' | 'complete' | 'archived';

export const CAMPAIGN_PHASE_KINDS = [
  'problem_awareness',
  'education',
  'solution',
  'proof',
  'conversion',
] as const;

export type CampaignPhaseKind = (typeof CAMPAIGN_PHASE_KINDS)[number];

export interface CampaignPhase {
  id: string;
  campaignId: string;
  kind: CampaignPhaseKind;
  title: string;
  narrative: string;
  /** Inclusive day offsets from campaign start. */
  startDay: number;
  endDay: number;
  postCount: number;
}

export interface Campaign {
  id: string;
  brandId: string;
  name: string;
  goal: string;
  productId: string | null;
  channels: Channel[];
  durationDays: number;
  startDate: string;
  status: CampaignStatus;
  narrative: string;
  phases: CampaignPhase[];
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Scheduling and publishing                                           */
/* ------------------------------------------------------------------ */

export type ScheduleStatus = 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled';

export interface ScheduledPost {
  id: string;
  brandId: string;
  contentId: string;
  connectionId: string | null;
  channel: Channel;
  scheduledFor: string;
  status: ScheduleStatus;
  attempts: number;
  lastError: string | null;
  /** Provider-side identifier, populated after a successful publish. */
  externalPostId: string | null;
  externalUrl: string | null;
  publishedAt: string | null;
}

export type ConnectionStatus = 'active' | 'expired' | 'revoked' | 'error';

export interface SocialConnection {
  id: string;
  brandId: string;
  channel: Channel;
  /** Handle or page name shown in the UI. */
  displayName: string;
  externalAccountId: string;
  status: ConnectionStatus;
  scopes: string[];
  expiresAt: string | null;
  lastValidatedAt: string | null;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Intelligence: competitors, trends, analytics                        */
/* ------------------------------------------------------------------ */

export interface Competitor {
  id: string;
  brandId: string;
  name: string;
  websiteUrl: string;
  lastCheckedAt: string | null;
  /** Signals observed since the last check, newest first. */
  signals: CompetitorSignal[];
}

export interface CompetitorSignal {
  observedAt: string;
  kind: 'new_page' | 'new_article' | 'offer_change' | 'positioning_change' | 'cadence_change';
  summary: string;
  url: string | null;
  themes: string[];
}

export interface Trend {
  id: string;
  brandId: string;
  topic: string;
  source: 'search' | 'news' | 'social' | 'competitor' | 'seasonal';
  summary: string;
  /** 0–1 relevance to the Brand Brain. Below the floor we never surface it. */
  relevance: number;
  momentum: number;
  expiresAt: string | null;
  observedAt: string;
}

/** A recommendation with a one-click action attached — never a bare statistic. */
export interface Opportunity {
  id: string;
  brandId: string;
  kind: 'competitor' | 'trend' | 'unpromoted_asset' | 'performance';
  headline: string;
  reasoning: string;
  /** Evidence rows rendered under the headline. */
  evidence: string[];
  action: {
    label: string;
    kind: 'generate_campaign' | 'generate_content' | 'remix_url';
    payload: Record<string, unknown>;
  };
  score: number;
  createdAt: string;
}

export const ATTRIBUTION_STAGES = [
  'impression',
  'engagement',
  'click',
  'visit',
  'lead',
  'customer',
  'revenue',
] as const;

export type AttributionStage = (typeof ATTRIBUTION_STAGES)[number];

export interface AttributionEvent {
  id: string;
  brandId: string;
  contentId: string | null;
  scheduledPostId: string | null;
  channel: Channel | null;
  stage: AttributionStage;
  value: number;
  currency: string | null;
  occurredAt: string;
  metadata: Record<string, unknown>;
}

export interface PostMetrics {
  scheduledPostId: string;
  impressions: number;
  engagements: number;
  clicks: number;
  shares: number;
  comments: number;
  collectedAt: string;
}

/** A learned rule the content engine applies to future generations. */
export interface Insight {
  id: string;
  brandId: string;
  /** e.g. "format", "hook", "topic", "channel", "posting_time", "cta", "offer". */
  dimension: string;
  subject: string;
  comparison: string | null;
  /** Multiplier vs. the baseline, e.g. 2.7 for "2.7× more qualified traffic". */
  lift: number;
  metric: string;
  sampleSize: number;
  confidence: number;
  statement: string;
  applied: boolean;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Jobs                                                                */
/* ------------------------------------------------------------------ */

export const JOB_KINDS = [
  'crawl_site',
  'build_brand_brain',
  'generate_content',
  'remix_url',
  'plan_campaign',
  'fill_calendar',
  'render_media',
  'publish_post',
  'collect_metrics',
  'scan_competitors',
  'scan_trends',
  'compute_insights',
] as const;

export type JobKind = (typeof JOB_KINDS)[number];
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface Job {
  id: string;
  brandId: string | null;
  organizationId: string;
  kind: JobKind;
  status: JobStatus;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  progress: number;
  progressLabel: string | null;
  attempts: number;
  runAfter: string;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}
