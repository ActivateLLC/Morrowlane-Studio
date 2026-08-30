import { createClient, type SupabaseClient } from '@supabase/supabase-js';
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
import { MorrowlaneError, NotFoundError, newId, nowIso, slugify } from '@morrowlane/shared';
import { decryptSecret, encryptSecret } from './crypto.js';
import * as map from './rows.js';
import type { ConnectionSecret, ContentQuery, DataStore, ScheduleQuery } from './store.js';

type Row = Record<string, unknown>;

/**
 * Supabase implementation of the persistence port.
 *
 * This is constructed with the service role key inside the API and worker, where RLS
 * would otherwise block cross-user work such as the publishing queue. Request-scoped
 * reads in the web app use the user's own client so RLS applies — see
 * docs/architecture/data-access.md.
 */
export function createSupabaseStore(options: { url?: string; serviceRoleKey?: string; client?: SupabaseClient } = {}): DataStore {
  const client =
    options.client ??
    createClient(
      options.url ?? requireEnv('SUPABASE_URL'),
      options.serviceRoleKey ?? requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

  const fail = (context: string, error: { message: string } | null): never => {
    throw new MorrowlaneError('database_error', `${context}: ${error?.message ?? 'unknown error'}`, 500);
  };

  async function selectMany(table: string, build: (q: any) => any): Promise<Row[]> {
    const { data, error } = await build(client.from(table).select('*'));
    if (error) fail(`Could not read ${table}`, error);
    return (data ?? []) as Row[];
  }

  async function selectOne(table: string, build: (q: any) => any): Promise<Row | null> {
    const { data, error } = await build(client.from(table).select('*')).maybeSingle();
    if (error) fail(`Could not read ${table}`, error);
    return (data as Row | null) ?? null;
  }

  async function upsert(table: string, rows: Row[], onConflict = 'id'): Promise<Row[]> {
    if (rows.length === 0) return [];
    const { data, error } = await client.from(table).upsert(rows, { onConflict }).select();
    if (error) fail(`Could not write to ${table}`, error);
    return (data ?? []) as Row[];
  }

  async function updateRow(table: string, id: string, patch: Row): Promise<Row> {
    const { data, error } = await client.from(table).update(patch).eq('id', id).select().maybeSingle();
    if (error) fail(`Could not update ${table}`, error);
    if (!data) throw new NotFoundError(table);
    return data as Row;
  }

  async function removeRow(table: string, id: string): Promise<void> {
    const { error } = await client.from(table).delete().eq('id', id);
    if (error) fail(`Could not delete from ${table}`, error);
  }

  const loadPhases = async (campaignIds: string[]) => {
    if (campaignIds.length === 0) return new Map<string, ReturnType<typeof map.toPhase>[]>();
    const rows = await selectMany('campaign_phases', (q) => q.in('campaign_id', campaignIds).order('position'));
    const byCampaign = new Map<string, ReturnType<typeof map.toPhase>[]>();
    for (const row of rows) {
      const phase = map.toPhase(row);
      const bucket = byCampaign.get(phase.campaignId);
      if (bucket) bucket.push(phase);
      else byCampaign.set(phase.campaignId, [phase]);
    }
    return byCampaign;
  };

  return {
    /* ------------------------------ Accounts ------------------------------ */

    async createOrganization({ name, ownerUserId, ownerEmail }): Promise<Organization> {
      const organization = {
        id: newId('organization'),
        name,
        slug: `${slugify(name)}-${newId('organization').slice(-6)}`,
        created_at: nowIso(),
      };
      const [row] = await upsert('organizations', [organization]);
      await upsert('memberships', [
        {
          id: newId('membership'),
          organization_id: organization.id,
          user_id: ownerUserId,
          email: ownerEmail,
          role: 'owner',
          invited_at: nowIso(),
          accepted_at: nowIso(),
        },
      ]);
      return map.toOrganization(row ?? organization);
    },

    async getOrganization(id) {
      const row = await selectOne('organizations', (q) => q.eq('id', id));
      return row ? map.toOrganization(row) : null;
    },

    async listOrganizationsForUser(userId) {
      const memberRows = await selectMany('memberships', (q) =>
        q.eq('user_id', userId).not('accepted_at', 'is', null),
      );
      const ids = [...new Set(memberRows.map((row) => String(row['organization_id'])))];
      if (ids.length === 0) return [];
      const rows = await selectMany('organizations', (q) => q.in('id', ids).order('created_at'));
      return rows.map(map.toOrganization);
    },

    async listMemberships(organizationId) {
      const rows = await selectMany('memberships', (q) => q.eq('organization_id', organizationId));
      return rows.map(map.toMembership);
    },

    async inviteMember({ organizationId, email, role }): Promise<Membership> {
      const existing = await selectOne('memberships', (q) =>
        q.eq('organization_id', organizationId).ilike('email', email),
      );
      if (existing) return map.toMembership(existing);

      const [row] = await upsert('memberships', [
        {
          id: newId('membership'),
          organization_id: organizationId,
          user_id: null,
          email,
          role,
          invited_at: nowIso(),
          accepted_at: null,
        },
      ]);
      return map.toMembership(row ?? {});
    },

    async listPendingInvitesByEmail(email) {
      const rows = await selectMany('memberships', (q) => q.is('user_id', null).is('accepted_at', null).ilike('email', email));
      return rows.map(map.toMembership);
    },

    async acceptInvite({ membershipId, userId }) {
      return map.toMembership(await updateRow('memberships', membershipId, { user_id: userId, accepted_at: nowIso() }));
    },

    async removeMember(membershipId) {
      await removeRow('memberships', membershipId);
    },

    async getMembership(organizationId, userId) {
      const row = await selectOne('memberships', (q) => q.eq('organization_id', organizationId).eq('user_id', userId));
      return row ? map.toMembership(row) : null;
    },

    /* ------------------------------- Brands ------------------------------- */

    async createBrand({ organizationId, name, websiteUrl }): Promise<Brand> {
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
      const [row] = await upsert('brands', [map.fromBrand(brand)]);
      return row ? map.toBrand(row) : brand;
    },

    async getBrand(id) {
      const row = await selectOne('brands', (q) => q.eq('id', id));
      return row ? map.toBrand(row) : null;
    },

    async listBrands(organizationId) {
      const rows = await selectMany('brands', (q) =>
        q.eq('organization_id', organizationId).order('created_at', { ascending: false }),
      );
      return rows.map(map.toBrand);
    },

    async updateBrand(id, patch) {
      const row = await updateRow('brands', id, {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.statusDetail !== undefined ? { status_detail: patch.statusDetail } : {}),
        updated_at: nowIso(),
      });
      return map.toBrand(row);
    },

    async deleteBrand(id) {
      await removeRow('brands', id);
    },

    /* -------------------------- Website intelligence ---------------------- */

    async replacePages(brandId, pages: CrawledPage[]) {
      // A recrawl is a full replacement: stale pages must not linger in the graph.
      const { error } = await client.from('brand_pages').delete().eq('brand_id', brandId);
      if (error) fail('Could not clear brand pages', error);
      await upsert('brand_pages', pages.map(map.fromPage), 'brand_id,url');
    },

    async listPages(brandId, options) {
      const rows = await selectMany('brand_pages', (q) => {
        let query = q.eq('brand_id', brandId);
        if (options?.pageType) query = query.eq('page_type', options.pageType);
        if (options?.limit) query = query.limit(options.limit);
        return query;
      });
      return rows.map(map.toPage);
    },

    async getPageByUrl(brandId, url) {
      const row = await selectOne('brand_pages', (q) => q.eq('brand_id', brandId).eq('url', url));
      return row ? map.toPage(row) : null;
    },

    /* ----------------------------- Brand Brain ---------------------------- */

    async saveBrain(brain: BrandBrain) {
      const [row] = await upsert('brand_brains', [map.fromBrain(brain, newId('brand'))], 'brand_id,version');
      return row ? map.toBrain(row) : brain;
    },

    async getBrain(brandId, version) {
      const row = await selectOne('brand_brains', (q) => {
        const query = q.eq('brand_id', brandId);
        return version === undefined ? query.order('version', { ascending: false }).limit(1) : query.eq('version', version);
      });
      return row ? map.toBrain(row) : null;
    },

    async listBrainVersions(brandId) {
      const rows = await selectMany('brand_brains', (q) =>
        q.eq('brand_id', brandId).order('version', { ascending: false }),
      );
      return rows.map((row) => ({
        version: Number(row['version'] ?? 0),
        generatedAt: String(row['generated_at'] ?? ''),
        completeness: Number(row['completeness'] ?? 0),
      }));
    },

    /* ------------------------------- Content ------------------------------ */

    async saveContent(items: ContentItem[]) {
      const rows = await upsert('content_items', items.map(map.fromContent));
      return rows.length > 0 ? rows.map(map.toContent) : items;
    },

    async updateContent(id, patch) {
      const current = await this.getContent(id);
      if (!current) throw new NotFoundError('Content');
      const merged = { ...current, ...patch, id, updatedAt: nowIso() };
      const row = await updateRow('content_items', id, map.fromContent(merged));
      return map.toContent(row);
    },

    async getContent(id) {
      const row = await selectOne('content_items', (q) => q.eq('id', id));
      return row ? map.toContent(row) : null;
    },

    async queryContent(query: ContentQuery) {
      const { data, error, count } = await buildContentQuery(client, query);
      if (error) fail('Could not read content', error);
      return { items: ((data ?? []) as Row[]).map(map.toContent), total: count ?? (data ?? []).length };
    },

    async deleteContent(id) {
      await removeRow('content_items', id);
    },

    /* -------------------------------- Media ------------------------------- */

    async saveMedia(assets: MediaAsset[]) {
      const rows = await upsert('media_assets', assets.map(map.fromMedia));
      return rows.length > 0 ? rows.map(map.toMedia) : assets;
    },

    async listMedia(brandId) {
      const rows = await selectMany('media_assets', (q) => q.eq('brand_id', brandId).order('created_at', { ascending: false }));
      return rows.map(map.toMedia);
    },

    /* ------------------------------ Campaigns ----------------------------- */

    async saveCampaign(campaign: Campaign) {
      await upsert('campaigns', [map.fromCampaign(campaign)]);
      await upsert('campaign_phases', campaign.phases.map((phase, index) => map.fromPhase(phase, index)));
      return campaign;
    },

    async getCampaign(id) {
      const row = await selectOne('campaigns', (q) => q.eq('id', id));
      if (!row) return null;
      const phases = await loadPhases([id]);
      return map.toCampaign(row, phases.get(id) ?? []);
    },

    async listCampaigns(brandId) {
      const rows = await selectMany('campaigns', (q) => q.eq('brand_id', brandId).order('created_at', { ascending: false }));
      const phases = await loadPhases(rows.map((row) => String(row['id'])));
      return rows.map((row) => map.toCampaign(row, phases.get(String(row['id'])) ?? []));
    },

    async updateCampaign(id, patch) {
      const current = await this.getCampaign(id);
      if (!current) throw new NotFoundError('Campaign');
      const merged = { ...current, ...patch, id, updatedAt: nowIso() };
      await updateRow('campaigns', id, map.fromCampaign(merged));
      if (patch.phases) await upsert('campaign_phases', patch.phases.map((phase, index) => map.fromPhase(phase, index)));
      return merged;
    },

    /* ----------------------------- Connections ---------------------------- */

    async saveConnection(connection: SocialConnection, secret: ConnectionSecret) {
      await upsert(
        'social_connections',
        [
          {
            id: connection.id,
            brand_id: connection.brandId,
            channel: connection.channel,
            display_name: connection.displayName,
            external_account_id: connection.externalAccountId,
            status: connection.status,
            scopes: connection.scopes,
            access_token_encrypted: encryptSecret(secret.accessToken),
            refresh_token_encrypted: secret.refreshToken ? encryptSecret(secret.refreshToken) : null,
            metadata: secret.metadata,
            expires_at: connection.expiresAt,
            last_validated_at: connection.lastValidatedAt,
            created_at: connection.createdAt,
          },
        ],
        'brand_id,channel,external_account_id',
      );
      return connection;
    },

    async listConnections(brandId) {
      const rows = await selectMany('social_connections', (q) => q.eq('brand_id', brandId));
      return rows.map(map.toConnection);
    },

    async getConnection(id) {
      const row = await selectOne('social_connections', (q) => q.eq('id', id));
      return row ? map.toConnection(row) : null;
    },

    async getConnectionSecret(id) {
      const row = await selectOne('social_connections', (q) => q.eq('id', id));
      if (!row) return null;
      const access = row['access_token_encrypted'];
      if (typeof access !== 'string') return null;
      const refresh = row['refresh_token_encrypted'];
      return {
        accessToken: decryptSecret(access),
        refreshToken: typeof refresh === 'string' ? decryptSecret(refresh) : null,
        metadata: (row['metadata'] ?? {}) as Record<string, unknown>,
      };
    },

    async updateConnection(id, patch) {
      const row = await updateRow('social_connections', id, {
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.displayName !== undefined ? { display_name: patch.displayName } : {}),
        ...(patch.expiresAt !== undefined ? { expires_at: patch.expiresAt } : {}),
        ...(patch.lastValidatedAt !== undefined ? { last_validated_at: patch.lastValidatedAt } : {}),
      });
      return map.toConnection(row);
    },

    async deleteConnection(id) {
      await removeRow('social_connections', id);
    },

    /* ----------------------------- Scheduling ----------------------------- */

    async saveScheduledPosts(posts: ScheduledPost[]) {
      const rows = await upsert('scheduled_posts', posts.map(map.fromScheduledPost));
      return rows.length > 0 ? rows.map(map.toScheduledPost) : posts;
    },

    async updateScheduledPost(id, patch) {
      const row = await updateRow('scheduled_posts', id, {
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.scheduledFor !== undefined ? { scheduled_for: patch.scheduledFor } : {}),
        ...(patch.connectionId !== undefined ? { connection_id: patch.connectionId } : {}),
        ...(patch.attempts !== undefined ? { attempts: patch.attempts } : {}),
        ...(patch.lastError !== undefined ? { last_error: patch.lastError } : {}),
        ...(patch.externalPostId !== undefined ? { external_post_id: patch.externalPostId } : {}),
        ...(patch.externalUrl !== undefined ? { external_url: patch.externalUrl } : {}),
        ...(patch.publishedAt !== undefined ? { published_at: patch.publishedAt } : {}),
      });
      return map.toScheduledPost(row);
    },

    async getScheduledPost(id) {
      const row = await selectOne('scheduled_posts', (q) => q.eq('id', id));
      return row ? map.toScheduledPost(row) : null;
    },

    async queryScheduledPosts(query: ScheduleQuery) {
      const rows = await selectMany('scheduled_posts', (q) => {
        let built = q.eq('brand_id', query.brandId).order('scheduled_for');
        if (query.from) built = built.gte('scheduled_for', query.from);
        if (query.to) built = built.lte('scheduled_for', query.to);
        if (query.status) built = built.in('status', query.status);
        return built;
      });
      return rows.map(map.toScheduledPost);
    },

    async claimDuePosts(limit, now = nowIso()) {
      // Claimed by flipping status in one statement so two workers cannot both take it.
      const candidates = await selectMany('scheduled_posts', (q) =>
        q.eq('status', 'scheduled').lte('scheduled_for', now).order('scheduled_for').limit(limit),
      );
      if (candidates.length === 0) return [];

      const ids = candidates.map((row) => String(row['id']));
      const { data, error } = await client
        .from('scheduled_posts')
        .update({ status: 'publishing' })
        .in('id', ids)
        .eq('status', 'scheduled')
        .select();
      if (error) fail('Could not claim due posts', error);
      return ((data ?? []) as Row[]).map(map.toScheduledPost);
    },

    async deleteScheduledPost(id) {
      await removeRow('scheduled_posts', id);
    },

    /* ---------------------------- Intelligence ---------------------------- */

    async saveCompetitor(competitor: Competitor & { snapshot?: unknown }) {
      await upsert('competitors', [
        {
          id: competitor.id,
          brand_id: competitor.brandId,
          name: competitor.name,
          website_url: competitor.websiteUrl,
          last_checked_at: competitor.lastCheckedAt,
          snapshot: competitor.snapshot ?? null,
          signals: competitor.signals,
        },
      ]);
      return competitor;
    },

    async listCompetitors(brandId) {
      const rows = await selectMany('competitors', (q) => q.eq('brand_id', brandId));
      return rows.map(map.toCompetitor);
    },

    async deleteCompetitor(id) {
      await removeRow('competitors', id);
    },

    async saveTrends(trends: Trend[]) {
      const rows = await upsert('trends', trends.map(map.fromTrend));
      return rows.length > 0 ? rows.map(map.toTrend) : trends;
    },

    async listTrends(brandId) {
      const rows = await selectMany('trends', (q) => q.eq('brand_id', brandId).order('relevance', { ascending: false }));
      return rows.map(map.toTrend);
    },

    async saveInsights(insights: Insight[]) {
      const rows = await upsert('insights', insights.map(map.fromInsight));
      return rows.length > 0 ? rows.map(map.toInsight) : insights;
    },

    async listInsights(brandId) {
      const rows = await selectMany('insights', (q) => q.eq('brand_id', brandId).order('created_at', { ascending: false }));
      return rows.map(map.toInsight);
    },

    async updateInsight(id, patch) {
      const row = await updateRow('insights', id, {
        ...(patch.applied !== undefined ? { applied: patch.applied } : {}),
      });
      return map.toInsight(row);
    },

    /* ------------------------------ Analytics ----------------------------- */

    async recordEvents(events: AttributionEvent[]) {
      await upsert('attribution_events', events.map(map.fromEvent));
    },

    async listEvents(brandId, options) {
      const rows = await selectMany('attribution_events', (q) => {
        let built = q.eq('brand_id', brandId).order('occurred_at', { ascending: false });
        if (options?.from) built = built.gte('occurred_at', options.from);
        if (options?.to) built = built.lte('occurred_at', options.to);
        return built;
      });
      return rows.map(map.toEvent);
    },

    async saveMetrics(metrics: Array<PostMetrics & { brandId: string }>) {
      await upsert(
        'post_metrics',
        metrics.map((entry) => ({
          scheduled_post_id: entry.scheduledPostId,
          brand_id: entry.brandId,
          impressions: entry.impressions,
          engagements: entry.engagements,
          clicks: entry.clicks,
          shares: entry.shares,
          comments: entry.comments,
          collected_at: entry.collectedAt,
        })),
        'scheduled_post_id',
      );
    },

    async listMetrics(brandId) {
      const rows = await selectMany('post_metrics', (q) => q.eq('brand_id', brandId));
      return rows.map(map.toMetrics);
    },

    /* -------------------------------- Jobs -------------------------------- */

    async enqueueJob({ organizationId, brandId, kind, payload, runAfter }): Promise<Job> {
      const [row] = await upsert('jobs', [
        {
          id: newId('job'),
          organization_id: organizationId,
          brand_id: brandId,
          kind,
          status: 'queued',
          payload,
          progress: 0,
          attempts: 0,
          run_after: runAfter ?? nowIso(),
          created_at: nowIso(),
        },
      ]);
      return map.toJob(row ?? {});
    },

    async claimJob(workerId, kinds?: JobKind[]) {
      // claim_job() uses FOR UPDATE SKIP LOCKED so concurrent workers never collide.
      const { data, error } = await client.rpc('claim_job', {
        worker_id: workerId,
        kinds: kinds ?? null,
      });
      if (error) fail('Could not claim a job', error);
      const row = Array.isArray(data) ? (data[0] as Row | undefined) : (data as Row | null);
      // plpgsql's `return null` arrives through PostgREST as a composite row whose
      // fields are all null, not as null itself. Without this guard the worker
      // "claims" a phantom job with an empty id on every idle poll.
      if (!row || typeof row['id'] !== 'string' || row['id'].length === 0) return null;
      return map.toJob(row);
    },

    async updateJob(id, patch) {
      const row = await updateRow('jobs', id, {
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.result !== undefined ? { result: patch.result } : {}),
        ...(patch.error !== undefined ? { error: patch.error } : {}),
        ...(patch.progress !== undefined ? { progress: patch.progress } : {}),
        ...(patch.progressLabel !== undefined ? { progress_label: patch.progressLabel } : {}),
        ...(patch.runAfter !== undefined ? { run_after: patch.runAfter } : {}),
        ...(patch.finishedAt !== undefined ? { finished_at: patch.finishedAt } : {}),
      });
      return map.toJob(row);
    },

    async getJob(id) {
      const row = await selectOne('jobs', (q) => q.eq('id', id));
      return row ? map.toJob(row) : null;
    },

    async listJobs(brandId, options) {
      const rows = await selectMany('jobs', (q) => {
        let built = q.eq('brand_id', brandId).order('created_at', { ascending: false });
        if (options?.status) built = built.in('status', options.status);
        return built.limit(options?.limit ?? 50);
      });
      return rows.map(map.toJob);
    },
  };
}

function buildContentQuery(client: SupabaseClient, query: ContentQuery) {
  let built = client
    .from('content_items')
    .select('*', { count: 'exact' })
    .eq('brand_id', query.brandId)
    .order('created_at', { ascending: false });

  if (query.status) built = built.in('status', query.status);
  if (query.campaignId !== undefined) {
    built = query.campaignId === null ? built.is('campaign_id', null) : built.eq('campaign_id', query.campaignId);
  }
  if (query.channel) built = built.eq('channel', query.channel);
  if (query.format) built = built.eq('format', query.format);
  if (query.sourceUrl) built = built.eq('lineage->>sourceUrl', query.sourceUrl);
  if (query.topic) built = built.contains('topics', [query.topic]);
  if (query.search) built = built.or(`title.ilike.%${query.search}%,body.ilike.%${query.search}%`);

  const offset = query.offset ?? 0;
  return built.range(offset, offset + (query.limit ?? 50) - 1);
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required to use the Supabase store.`);
  return value;
}
