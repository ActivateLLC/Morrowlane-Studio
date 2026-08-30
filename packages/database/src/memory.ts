import type {
  AttributionEvent,
  Brand,
  BrandBrain,
  Campaign,
  Competitor,
  ContentItem,
  CrawledPage,
  Insight,
  Job,
  JobKind,
  MediaAsset,
  Membership,
  Organization,
  PostMetrics,
  ScheduledPost,
  SocialConnection,
  Trend,
} from '@morrowlane/shared';
import { NotFoundError, newId, nowIso, slugify } from '@morrowlane/shared';
import type { ConnectionSecret, ContentQuery, DataStore, ScheduleQuery } from './store.js';

/**
 * In-memory implementation of the whole port. It backs local development, the demo
 * brand and the test suite, so a contributor can run every screen of the product with
 * `pnpm dev` and nothing else installed.
 *
 * Not durable and not concurrent — one process, one copy. Production is Supabase.
 */
export function createMemoryStore(): DataStore & { reset(): void } {
  const organizations = new Map<string, Organization>();
  const memberships = new Map<string, Membership>();
  const brands = new Map<string, Brand>();
  const pages = new Map<string, CrawledPage[]>();
  const brains = new Map<string, BrandBrain[]>();
  const content = new Map<string, ContentItem>();
  const media = new Map<string, MediaAsset>();
  const campaigns = new Map<string, Campaign>();
  const connections = new Map<string, SocialConnection>();
  const secrets = new Map<string, ConnectionSecret>();
  const scheduled = new Map<string, ScheduledPost>();
  const competitors = new Map<string, Competitor & { snapshot?: unknown }>();
  const trends = new Map<string, Trend>();
  const insights = new Map<string, Insight>();
  const events: AttributionEvent[] = [];
  const metrics = new Map<string, PostMetrics & { brandId: string }>();
  const jobs = new Map<string, Job>();

  const clone = <T>(value: T): T => structuredClone(value);

  const requireBrand = (id: string): Brand => {
    const brand = brands.get(id);
    if (!brand) throw new NotFoundError('Brand');
    return brand;
  };

  return {
    reset() {
      for (const map of [organizations, memberships, brands, content, media, campaigns, connections, secrets, scheduled, competitors, trends, insights, metrics, jobs]) {
        (map as Map<string, unknown>).clear();
      }
      pages.clear();
      brains.clear();
      events.length = 0;
    },

    /* ------------------------------ Accounts ------------------------------ */

    async createOrganization({ name, ownerUserId, ownerEmail }) {
      const organization: Organization = {
        id: newId('organization'),
        name,
        slug: `${slugify(name)}-${newId('organization').slice(-6)}`,
        createdAt: nowIso(),
      };
      organizations.set(organization.id, organization);

      const membership: Membership = {
        id: newId('membership'),
        organizationId: organization.id,
        userId: ownerUserId,
        email: ownerEmail,
        role: 'owner',
        invitedAt: nowIso(),
        acceptedAt: nowIso(),
      };
      memberships.set(membership.id, membership);
      return clone(organization);
    },

    async getOrganization(id) {
      const organization = organizations.get(id);
      return organization ? clone(organization) : null;
    },

    async listOrganizationsForUser(userId) {
      const ids = [...memberships.values()]
        .filter((m) => m.userId === userId && m.acceptedAt !== null)
        .map((m) => m.organizationId);
      return [...new Set(ids)]
        .map((id) => organizations.get(id))
        .filter((org): org is Organization => Boolean(org))
        .map(clone);
    },

    async listMemberships(organizationId) {
      return [...memberships.values()].filter((m) => m.organizationId === organizationId).map(clone);
    },

    async inviteMember({ organizationId, email, role }) {
      const existing = [...memberships.values()].find(
        (m) => m.organizationId === organizationId && m.email.toLowerCase() === email.toLowerCase(),
      );
      if (existing) return clone(existing);

      const membership: Membership = {
        id: newId('membership'),
        organizationId,
        // The invite is claimed when the invited person signs in and accepts.
        userId: '',
        email,
        role,
        invitedAt: nowIso(),
        acceptedAt: null,
      };
      memberships.set(membership.id, membership);
      return clone(membership);
    },

    async listPendingInvitesByEmail(email) {
      const target = email.toLowerCase();
      return [...memberships.values()]
        .filter((m) => m.acceptedAt === null && m.userId === '' && m.email.toLowerCase() === target)
        .map(clone);
    },

    async acceptInvite({ membershipId, userId }) {
      const membership = memberships.get(membershipId);
      if (!membership) throw new NotFoundError('Invitation');
      const accepted = { ...membership, userId, acceptedAt: nowIso() };
      memberships.set(membershipId, accepted);
      return clone(accepted);
    },

    async removeMember(membershipId) {
      memberships.delete(membershipId);
    },

    async getMembership(organizationId, userId) {
      const membership = [...memberships.values()].find(
        (m) => m.organizationId === organizationId && m.userId === userId,
      );
      return membership ? clone(membership) : null;
    },

    /* ------------------------------- Brands ------------------------------- */

    async createBrand({ organizationId, name, websiteUrl }) {
      const brand: Brand = {
        id: newId('brand'),
        organizationId,
        name,
        websiteUrl,
        status: 'draft',
        statusDetail: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      brands.set(brand.id, brand);
      return clone(brand);
    },

    async getBrand(id) {
      const brand = brands.get(id);
      return brand ? clone(brand) : null;
    },

    async listBrands(organizationId) {
      return [...brands.values()]
        .filter((brand) => brand.organizationId === organizationId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(clone);
    },

    async updateBrand(id, patch) {
      const brand = requireBrand(id);
      const updated = { ...brand, ...patch, updatedAt: nowIso() };
      brands.set(id, updated);
      return clone(updated);
    },

    async deleteBrand(id) {
      brands.delete(id);
      pages.delete(id);
      brains.delete(id);
      for (const [key, item] of content) if (item.brandId === id) content.delete(key);
      for (const [key, post] of scheduled) if (post.brandId === id) scheduled.delete(key);
    },

    /* -------------------------- Website intelligence ---------------------- */

    async replacePages(brandId, crawled) {
      pages.set(brandId, crawled.map(clone));
    },

    async listPages(brandId, options) {
      let list = pages.get(brandId) ?? [];
      if (options?.pageType) list = list.filter((page) => page.pageType === options.pageType);
      return list.slice(0, options?.limit ?? list.length).map(clone);
    },

    async getPageByUrl(brandId, url) {
      const page = (pages.get(brandId) ?? []).find((p) => p.url === url || p.canonicalUrl === url);
      return page ? clone(page) : null;
    },

    /* ----------------------------- Brand Brain ---------------------------- */

    async saveBrain(brain) {
      const versions = brains.get(brain.brandId) ?? [];
      const withoutSameVersion = versions.filter((v) => v.version !== brain.version);
      brains.set(brain.brandId, [...withoutSameVersion, clone(brain)].sort((a, b) => a.version - b.version));
      return clone(brain);
    },

    async getBrain(brandId, version) {
      const versions = brains.get(brandId) ?? [];
      if (versions.length === 0) return null;
      const found = version === undefined ? versions[versions.length - 1] : versions.find((v) => v.version === version);
      return found ? clone(found) : null;
    },

    async listBrainVersions(brandId) {
      return (brains.get(brandId) ?? []).map((brain) => ({
        version: brain.version,
        generatedAt: brain.generatedAt,
        completeness: brain.completeness,
      }));
    },

    /* ------------------------------- Content ------------------------------ */

    async saveContent(items) {
      for (const item of items) content.set(item.id, clone(item));
      return items.map(clone);
    },

    async updateContent(id, patch) {
      const item = content.get(id);
      if (!item) throw new NotFoundError('Content');
      const updated = { ...item, ...patch, id, updatedAt: nowIso() };
      content.set(id, updated);
      return clone(updated);
    },

    async getContent(id) {
      const item = content.get(id);
      return item ? clone(item) : null;
    },

    async queryContent(query: ContentQuery) {
      let items = [...content.values()].filter((item) => item.brandId === query.brandId);

      if (query.status) items = items.filter((item) => query.status!.includes(item.status));
      if (query.campaignId !== undefined) items = items.filter((item) => item.campaignId === query.campaignId);
      if (query.channel) items = items.filter((item) => item.channel === query.channel);
      if (query.format) items = items.filter((item) => item.format === query.format);
      if (query.sourceUrl) items = items.filter((item) => item.lineage.sourceUrl === query.sourceUrl);
      if (query.topic) {
        const topic = query.topic.toLowerCase();
        items = items.filter((item) => item.topics.some((t) => t.toLowerCase().includes(topic)));
      }
      if (query.search) {
        const needle = query.search.toLowerCase();
        items = items.filter((item) =>
          `${item.title} ${item.hook} ${item.body} ${item.topics.join(' ')}`.toLowerCase().includes(needle),
        );
      }

      items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const total = items.length;
      const offset = query.offset ?? 0;
      return { items: items.slice(offset, offset + (query.limit ?? 50)).map(clone), total };
    },

    async deleteContent(id) {
      content.delete(id);
      for (const [key, post] of scheduled) if (post.contentId === id) scheduled.delete(key);
    },

    /* -------------------------------- Media ------------------------------- */

    async saveMedia(assets) {
      for (const asset of assets) media.set(asset.id, clone(asset));
      return assets.map(clone);
    },

    async listMedia(brandId) {
      return [...media.values()].filter((asset) => asset.brandId === brandId).map(clone);
    },

    /* ------------------------------ Campaigns ----------------------------- */

    async saveCampaign(campaign) {
      campaigns.set(campaign.id, clone(campaign));
      return clone(campaign);
    },

    async getCampaign(id) {
      const campaign = campaigns.get(id);
      return campaign ? clone(campaign) : null;
    },

    async listCampaigns(brandId) {
      return [...campaigns.values()]
        .filter((campaign) => campaign.brandId === brandId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(clone);
    },

    async updateCampaign(id, patch) {
      const campaign = campaigns.get(id);
      if (!campaign) throw new NotFoundError('Campaign');
      const updated = { ...campaign, ...patch, id, updatedAt: nowIso() };
      campaigns.set(id, updated);
      return clone(updated);
    },

    /* ----------------------------- Connections ---------------------------- */

    async saveConnection(connection, secret) {
      connections.set(connection.id, clone(connection));
      secrets.set(connection.id, clone(secret));
      return clone(connection);
    },

    async listConnections(brandId) {
      return [...connections.values()].filter((c) => c.brandId === brandId).map(clone);
    },

    async getConnection(id) {
      const connection = connections.get(id);
      return connection ? clone(connection) : null;
    },

    async getConnectionSecret(id) {
      const secret = secrets.get(id);
      return secret ? clone(secret) : null;
    },

    async updateConnection(id, patch) {
      const connection = connections.get(id);
      if (!connection) throw new NotFoundError('Connection');
      const updated = { ...connection, ...patch, id };
      connections.set(id, updated);
      return clone(updated);
    },

    async deleteConnection(id) {
      connections.delete(id);
      secrets.delete(id);
    },

    /* ----------------------------- Scheduling ----------------------------- */

    async saveScheduledPosts(posts) {
      for (const post of posts) scheduled.set(post.id, clone(post));
      return posts.map(clone);
    },

    async updateScheduledPost(id, patch) {
      const post = scheduled.get(id);
      if (!post) throw new NotFoundError('Scheduled post');
      const updated = { ...post, ...patch, id };
      scheduled.set(id, updated);
      return clone(updated);
    },

    async getScheduledPost(id) {
      const post = scheduled.get(id);
      return post ? clone(post) : null;
    },

    async queryScheduledPosts(query: ScheduleQuery) {
      return [...scheduled.values()]
        .filter((post) => post.brandId === query.brandId)
        .filter((post) => (query.from ? post.scheduledFor >= query.from : true))
        .filter((post) => (query.to ? post.scheduledFor <= query.to : true))
        .filter((post) => (query.status ? query.status.includes(post.status) : true))
        .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))
        .map(clone);
    },

    async claimDuePosts(limit, now = nowIso()) {
      const due = [...scheduled.values()]
        .filter((post) => post.status === 'scheduled' && post.scheduledFor <= now)
        .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))
        .slice(0, limit);
      // Marked immediately so a second call cannot hand out the same post.
      for (const post of due) scheduled.set(post.id, { ...post, status: 'publishing' });
      return due.map((post) => clone({ ...post, status: 'publishing' as const }));
    },

    async deleteScheduledPost(id) {
      scheduled.delete(id);
    },

    /* ---------------------------- Intelligence ---------------------------- */

    async saveCompetitor(competitor) {
      competitors.set(competitor.id, clone(competitor));
      return clone(competitor);
    },

    async listCompetitors(brandId) {
      return [...competitors.values()].filter((c) => c.brandId === brandId).map(clone);
    },

    async deleteCompetitor(id) {
      competitors.delete(id);
    },

    async saveTrends(list) {
      for (const trend of list) trends.set(trend.id, clone(trend));
      return list.map(clone);
    },

    async listTrends(brandId) {
      return [...trends.values()]
        .filter((trend) => trend.brandId === brandId)
        .sort((a, b) => b.relevance - a.relevance)
        .map(clone);
    },

    async saveInsights(list) {
      for (const insight of list) insights.set(insight.id, clone(insight));
      return list.map(clone);
    },

    async listInsights(brandId) {
      return [...insights.values()]
        .filter((insight) => insight.brandId === brandId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(clone);
    },

    async updateInsight(id, patch) {
      const insight = insights.get(id);
      if (!insight) throw new NotFoundError('Insight');
      const updated = { ...insight, ...patch, id };
      insights.set(id, updated);
      return clone(updated);
    },

    /* ------------------------------ Analytics ----------------------------- */

    async recordEvents(list) {
      events.push(...list.map(clone));
    },

    async listEvents(brandId, options) {
      return events
        .filter((event) => event.brandId === brandId)
        .filter((event) => (options?.from ? event.occurredAt >= options.from : true))
        .filter((event) => (options?.to ? event.occurredAt <= options.to : true))
        .map(clone);
    },

    async saveMetrics(list) {
      for (const entry of list) metrics.set(entry.scheduledPostId, clone(entry));
    },

    async listMetrics(brandId) {
      return [...metrics.values()].filter((entry) => entry.brandId === brandId).map(clone);
    },

    /* -------------------------------- Jobs -------------------------------- */

    async enqueueJob({ organizationId, brandId, kind, payload, runAfter }) {
      const job: Job = {
        id: newId('job'),
        organizationId,
        brandId,
        kind,
        status: 'queued',
        payload,
        result: null,
        error: null,
        progress: 0,
        progressLabel: null,
        attempts: 0,
        runAfter: runAfter ?? nowIso(),
        startedAt: null,
        finishedAt: null,
        createdAt: nowIso(),
      };
      jobs.set(job.id, job);
      return clone(job);
    },

    async claimJob(_workerId, kinds?: JobKind[]) {
      const now = nowIso();
      const next = [...jobs.values()]
        .filter((job) => job.status === 'queued' && job.runAfter <= now)
        .filter((job) => (kinds ? kinds.includes(job.kind) : true))
        .sort((a, b) => a.runAfter.localeCompare(b.runAfter))[0];
      if (!next) return null;

      const claimed: Job = {
        ...next,
        status: 'running',
        attempts: next.attempts + 1,
        startedAt: next.startedAt ?? now,
      };
      jobs.set(claimed.id, claimed);
      return clone(claimed);
    },

    async updateJob(id, patch) {
      const job = jobs.get(id);
      if (!job) throw new NotFoundError('Job');
      const updated = { ...job, ...patch, id };
      jobs.set(id, updated);
      return clone(updated);
    },

    async getJob(id) {
      const job = jobs.get(id);
      return job ? clone(job) : null;
    },

    async listJobs(brandId, options) {
      return [...jobs.values()]
        .filter((job) => job.brandId === brandId)
        .filter((job) => (options?.status ? options.status.includes(job.status) : true))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, options?.limit ?? 50)
        .map(clone);
    },
  };
}
