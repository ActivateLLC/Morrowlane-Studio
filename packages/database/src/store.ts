import type {
  AttributionEvent,
  Brand,
  BrandBrain,
  Campaign,
  Competitor,
  ContentItem,
  ContentStatus,
  CrawledPage,
  Insight,
  Job,
  JobKind,
  JobStatus,
  MediaAsset,
  Membership,
  Organization,
  PostMetrics,
  ScheduledPost,
  SocialConnection,
  Trend,
} from '@morrowlane/shared';

/**
 * The single persistence port. Everything above it — the web app, the API, the worker —
 * talks only to this, which is what lets the whole product run against an in-memory
 * store in development and Supabase in production without a second code path.
 */

export interface ContentQuery {
  brandId: string;
  status?: ContentStatus[];
  campaignId?: string | null;
  channel?: string;
  format?: string;
  topic?: string;
  search?: string;
  sourceUrl?: string;
  limit?: number;
  offset?: number;
}

export interface ScheduleQuery {
  brandId: string;
  from?: string;
  to?: string;
  status?: ScheduledPost['status'][];
}

/** Tokens live behind this shape so they are never accidentally serialised to a client. */
export interface ConnectionSecret {
  accessToken: string;
  refreshToken: string | null;
  metadata: Record<string, unknown>;
}

export interface DataStore {
  /* Accounts */
  createOrganization(input: { name: string; ownerUserId: string; ownerEmail: string }): Promise<Organization>;
  getOrganization(id: string): Promise<Organization | null>;
  listOrganizationsForUser(userId: string): Promise<Organization[]>;
  listMemberships(organizationId: string): Promise<Membership[]>;
  inviteMember(input: { organizationId: string; email: string; role: Membership['role'] }): Promise<Membership>;
  acceptInvite(input: { membershipId: string; userId: string }): Promise<Membership>;
  removeMember(membershipId: string): Promise<void>;
  getMembership(organizationId: string, userId: string): Promise<Membership | null>;

  /* Brands */
  createBrand(input: { organizationId: string; name: string; websiteUrl: string }): Promise<Brand>;
  getBrand(id: string): Promise<Brand | null>;
  listBrands(organizationId: string): Promise<Brand[]>;
  updateBrand(id: string, patch: Partial<Pick<Brand, 'name' | 'status' | 'statusDetail'>>): Promise<Brand>;
  deleteBrand(id: string): Promise<void>;

  /* Website intelligence */
  replacePages(brandId: string, pages: CrawledPage[]): Promise<void>;
  listPages(brandId: string, options?: { pageType?: string; limit?: number }): Promise<CrawledPage[]>;
  getPageByUrl(brandId: string, url: string): Promise<CrawledPage | null>;

  /* Brand Brain */
  saveBrain(brain: BrandBrain): Promise<BrandBrain>;
  getBrain(brandId: string, version?: number): Promise<BrandBrain | null>;
  listBrainVersions(brandId: string): Promise<Array<{ version: number; generatedAt: string; completeness: number }>>;

  /* Content */
  saveContent(items: ContentItem[]): Promise<ContentItem[]>;
  updateContent(id: string, patch: Partial<ContentItem>): Promise<ContentItem>;
  getContent(id: string): Promise<ContentItem | null>;
  queryContent(query: ContentQuery): Promise<{ items: ContentItem[]; total: number }>;
  deleteContent(id: string): Promise<void>;

  /* Media */
  saveMedia(assets: MediaAsset[]): Promise<MediaAsset[]>;
  listMedia(brandId: string): Promise<MediaAsset[]>;

  /* Campaigns */
  saveCampaign(campaign: Campaign): Promise<Campaign>;
  getCampaign(id: string): Promise<Campaign | null>;
  listCampaigns(brandId: string): Promise<Campaign[]>;
  updateCampaign(id: string, patch: Partial<Campaign>): Promise<Campaign>;

  /* Connections */
  saveConnection(connection: SocialConnection, secret: ConnectionSecret): Promise<SocialConnection>;
  listConnections(brandId: string): Promise<SocialConnection[]>;
  getConnection(id: string): Promise<SocialConnection | null>;
  getConnectionSecret(id: string): Promise<ConnectionSecret | null>;
  updateConnection(id: string, patch: Partial<SocialConnection>): Promise<SocialConnection>;
  deleteConnection(id: string): Promise<void>;

  /* Scheduling */
  saveScheduledPosts(posts: ScheduledPost[]): Promise<ScheduledPost[]>;
  updateScheduledPost(id: string, patch: Partial<ScheduledPost>): Promise<ScheduledPost>;
  getScheduledPost(id: string): Promise<ScheduledPost | null>;
  queryScheduledPosts(query: ScheduleQuery): Promise<ScheduledPost[]>;
  /** Posts due for publishing, across all brands. The worker's entry point. */
  claimDuePosts(limit: number, now?: string): Promise<ScheduledPost[]>;
  deleteScheduledPost(id: string): Promise<void>;

  /* Intelligence */
  saveCompetitor(competitor: Competitor & { snapshot?: unknown }): Promise<Competitor>;
  listCompetitors(brandId: string): Promise<Array<Competitor & { snapshot?: unknown }>>;
  deleteCompetitor(id: string): Promise<void>;
  saveTrends(trends: Trend[]): Promise<Trend[]>;
  listTrends(brandId: string): Promise<Trend[]>;
  saveInsights(insights: Insight[]): Promise<Insight[]>;
  listInsights(brandId: string): Promise<Insight[]>;
  updateInsight(id: string, patch: Partial<Insight>): Promise<Insight>;

  /* Analytics */
  recordEvents(events: AttributionEvent[]): Promise<void>;
  listEvents(brandId: string, options?: { from?: string; to?: string }): Promise<AttributionEvent[]>;
  saveMetrics(metrics: Array<PostMetrics & { brandId: string }>): Promise<void>;
  listMetrics(brandId: string): Promise<PostMetrics[]>;

  /* Jobs */
  enqueueJob(input: {
    organizationId: string;
    brandId: string | null;
    kind: JobKind;
    payload: Record<string, unknown>;
    runAfter?: string;
  }): Promise<Job>;
  claimJob(workerId: string, kinds?: JobKind[]): Promise<Job | null>;
  updateJob(id: string, patch: Partial<Pick<Job, 'status' | 'result' | 'error' | 'progress' | 'progressLabel' | 'runAfter' | 'finishedAt'>>): Promise<Job>;
  getJob(id: string): Promise<Job | null>;
  listJobs(brandId: string, options?: { status?: JobStatus[]; limit?: number }): Promise<Job[]>;
}
