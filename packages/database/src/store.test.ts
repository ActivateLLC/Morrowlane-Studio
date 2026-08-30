import type { AttributionEvent, ContentItem, ScheduledPost, SocialConnection } from '@morrowlane/shared';
import { addDays, newId, nowIso } from '@morrowlane/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryStore } from './memory.js';
import type { DataStore } from './store.js';

/**
 * The contract every DataStore implementation must satisfy. It runs against the memory
 * store here; a Supabase instance can be pointed at the same suite in CI.
 */
function contract(name: string, create: () => DataStore) {
  describe(name, () => {
    let store: DataStore;
    let organizationId: string;
    let brandId: string;

    beforeEach(async () => {
      store = create();
      const organization = await store.createOrganization({
        name: 'Acme',
        ownerUserId: 'user-1',
        ownerEmail: 'owner@acme.test',
      });
      organizationId = organization.id;
      const brand = await store.createBrand({
        organizationId,
        name: 'Orca Credit',
        websiteUrl: 'https://orcacredit.example',
      });
      brandId = brand.id;
    });

    const content = (over: Partial<ContentItem> = {}): ContentItem => ({
      id: newId('content'),
      brandId,
      campaignId: null,
      campaignPhaseId: null,
      format: 'instagram_post',
      channel: 'instagram',
      status: 'draft',
      title: 'Title',
      hook: 'Hook',
      body: 'Body about credit building',
      segments: [],
      hashtags: [],
      cta: 'Get started',
      linkUrl: null,
      mediaAssetIds: [],
      topics: ['credit'],
      lineage: { sourceType: 'brand', sourceUrl: null, sourceId: null, instruction: null, parentContentId: null, appliedInsightIds: [] },
      violations: [],
      model: 'local',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      ...over,
    });

    describe('organizations and members', () => {
      it('makes the creator an accepted owner', async () => {
        const members = await store.listMemberships(organizationId);
        expect(members).toHaveLength(1);
        expect(members[0]?.role).toBe('owner');
        expect(members[0]?.acceptedAt).not.toBeNull();
      });

      it('lists organizations the user belongs to', async () => {
        expect((await store.listOrganizationsForUser('user-1')).map((o) => o.id)).toEqual([organizationId]);
        expect(await store.listOrganizationsForUser('someone-else')).toEqual([]);
      });

      it('creates a pending invite and claims it on accept', async () => {
        const invite = await store.inviteMember({ organizationId, email: 'new@acme.test', role: 'editor' });
        expect(invite.acceptedAt).toBeNull();

        const accepted = await store.acceptInvite({ membershipId: invite.id, userId: 'user-2' });
        expect(accepted.userId).toBe('user-2');
        expect(accepted.acceptedAt).not.toBeNull();
        expect((await store.listOrganizationsForUser('user-2')).map((o) => o.id)).toEqual([organizationId]);
      });

      it('finds pending invites by email and stops listing them once claimed', async () => {
        const invite = await store.inviteMember({ organizationId, email: 'Pending@acme.test', role: 'viewer' });

        const pending = await store.listPendingInvitesByEmail('pending@acme.test');
        expect(pending.map((m) => m.id)).toEqual([invite.id]);

        await store.acceptInvite({ membershipId: invite.id, userId: 'user-3' });
        expect(await store.listPendingInvitesByEmail('pending@acme.test')).toEqual([]);
      });

      it('does not create a second invite for the same address', async () => {
        const first = await store.inviteMember({ organizationId, email: 'dup@acme.test', role: 'editor' });
        const second = await store.inviteMember({ organizationId, email: 'DUP@acme.test', role: 'viewer' });
        expect(second.id).toBe(first.id);
      });
    });

    describe('brands and pages', () => {
      it('starts a brand in draft and tracks its status', async () => {
        expect((await store.getBrand(brandId))?.status).toBe('draft');
        const updated = await store.updateBrand(brandId, { status: 'crawling', statusDetail: 'Reading sitemap' });
        expect(updated.status).toBe('crawling');
        expect(updated.statusDetail).toBe('Reading sitemap');
      });

      it('replaces the page set on a recrawl rather than appending', async () => {
        const page = (url: string) => ({
          id: newId('page'),
          brandId,
          url,
          canonicalUrl: null,
          pageType: 'article' as const,
          pageTypeConfidence: 0.9,
          title: url,
          metaDescription: null,
          headings: [],
          text: '',
          wordCount: 0,
          language: null,
          images: [],
          internalLinks: [],
          externalLinks: [],
          socialLinks: [],
          faqs: [],
          testimonials: [],
          ctas: [],
          prices: [],
          structuredData: [],
          publishedAt: null,
          fetchedAt: nowIso(),
          contentHash: 'h',
        });

        await store.replacePages(brandId, [page('https://a.test/1'), page('https://a.test/2')]);
        await store.replacePages(brandId, [page('https://a.test/3')]);
        const pages = await store.listPages(brandId);
        expect(pages.map((p) => p.url)).toEqual(['https://a.test/3']);
      });

      it('finds a page by URL for remix', async () => {
        await store.replacePages(brandId, [
          {
            id: newId('page'),
            brandId,
            url: 'https://a.test/product',
            canonicalUrl: null,
            pageType: 'product',
            pageTypeConfidence: 0.9,
            title: 'Product',
            metaDescription: null,
            headings: [],
            text: '',
            wordCount: 0,
            language: null,
            images: [],
            internalLinks: [],
            externalLinks: [],
            socialLinks: [],
            faqs: [],
            testimonials: [],
            ctas: [],
            prices: [],
            structuredData: [],
            publishedAt: null,
            fetchedAt: nowIso(),
            contentHash: 'h',
          },
        ]);
        expect((await store.getPageByUrl(brandId, 'https://a.test/product'))?.pageType).toBe('product');
        expect(await store.getPageByUrl(brandId, 'https://a.test/missing')).toBeNull();
      });

      it('corrects a brand\u2019s website address', async () => {
        const brand = await store.createBrand({ organizationId, name: 'Typo', websiteUrl: 'https://wrong.example' });
        const updated = await store.updateBrand(brand.id, { websiteUrl: 'https://right.example' });
        expect(updated.websiteUrl).toBe('https://right.example');
      });
    });

    describe('brand brain versions', () => {
      const brain = (version: number) => ({
        brandId,
        version,
        identity: { companyName: 'Orca', category: '', oneLiner: '', description: '', audience: [], industries: [], locations: [] },
        voice: { traits: [], readingLevel: 3, personSummary: '', sampleSentences: [], avoid: [] },
        products: [],
        offers: [],
        faqs: [],
        testimonials: [],
        visuals: { logoUrls: [], colors: [], imageUrls: [], fontHints: [] },
        rules: { approvedTerminology: [], prohibitedTerminology: [], approvedClaims: [], prohibitedClaims: [], regulatoryNotes: [], preferredCtas: [], visualGuidelines: [] },
        terminology: [],
        socialLinks: [],
        notes: [],
        completeness: 0.5,
        sourcePageCount: 1,
        generatedAt: nowIso(),
        lockedFields: [],
      });

      it('returns the newest version by default and any version on request', async () => {
        await store.saveBrain(brain(1));
        await store.saveBrain(brain(2));
        expect((await store.getBrain(brandId))?.version).toBe(2);
        expect((await store.getBrain(brandId, 1))?.version).toBe(1);
      });

      it('lists version history', async () => {
        await store.saveBrain(brain(1));
        await store.saveBrain(brain(2));
        expect((await store.listBrainVersions(brandId)).map((v) => v.version).sort()).toEqual([1, 2]);
      });

      it('returns null before any analysis has run', async () => {
        expect(await store.getBrain(brandId)).toBeNull();
      });
    });

    describe('content library', () => {
      it('filters by status, channel and campaign', async () => {
        await store.saveContent([
          content({ status: 'approved', channel: 'instagram' }),
          content({ status: 'draft', channel: 'linkedin' }),
          content({ status: 'approved', channel: 'linkedin', campaignId: 'cmp_1' }),
        ]);

        expect((await store.queryContent({ brandId, status: ['approved'] })).total).toBe(2);
        expect((await store.queryContent({ brandId, channel: 'linkedin' })).total).toBe(2);
        expect((await store.queryContent({ brandId, campaignId: 'cmp_1' })).total).toBe(1);
        expect((await store.queryContent({ brandId, campaignId: null })).total).toBe(2);
      });

      it('searches text and topics', async () => {
        await store.saveContent([content({ title: 'Utilization explained' }), content({ title: 'Something else' })]);
        expect((await store.queryContent({ brandId, search: 'utilization' })).total).toBe(1);
        expect((await store.queryContent({ brandId, topic: 'credit' })).total).toBe(2);
      });

      it('finds everything generated from one source URL', async () => {
        const sourceUrl = 'https://a.test/product';
        await store.saveContent([
          content({ lineage: { sourceType: 'remix', sourceUrl, sourceId: null, instruction: null, parentContentId: null, appliedInsightIds: [] } }),
          content(),
        ]);
        expect((await store.queryContent({ brandId, sourceUrl })).total).toBe(1);
      });

      it('paginates while reporting the full total', async () => {
        await store.saveContent(Array.from({ length: 12 }, () => content()));
        const page = await store.queryContent({ brandId, limit: 5, offset: 5 });
        expect(page.items).toHaveLength(5);
        expect(page.total).toBe(12);
      });

      it('removes a post\'s schedule when the content is deleted', async () => {
        const [item] = await store.saveContent([content()]);
        await store.saveScheduledPosts([
          {
            id: newId('schedule'),
            brandId,
            contentId: item!.id,
            connectionId: null,
            channel: 'instagram',
            scheduledFor: nowIso(),
            status: 'scheduled',
            attempts: 0,
            lastError: null,
            externalPostId: null,
            externalUrl: null,
            publishedAt: null,
          },
        ]);
        await store.deleteContent(item!.id);
        expect(await store.queryScheduledPosts({ brandId })).toEqual([]);
      });
    });

    describe('scheduling', () => {
      const post = (over: Partial<ScheduledPost> = {}): ScheduledPost => ({
        id: newId('schedule'),
        brandId,
        contentId: newId('content'),
        connectionId: null,
        channel: 'instagram',
        scheduledFor: nowIso(),
        status: 'scheduled',
        attempts: 0,
        lastError: null,
        externalPostId: null,
        externalUrl: null,
        publishedAt: null,
        ...over,
      });

      it('queries a calendar window', async () => {
        await store.saveScheduledPosts([
          post({ scheduledFor: addDays(nowIso(), 1) }),
          post({ scheduledFor: addDays(nowIso(), 20) }),
        ]);
        const window = await store.queryScheduledPosts({ brandId, from: nowIso(), to: addDays(nowIso(), 7) });
        expect(window).toHaveLength(1);
      });

      it('claims only posts that are due', async () => {
        await store.saveScheduledPosts([
          post({ scheduledFor: addDays(nowIso(), -1) }),
          post({ scheduledFor: addDays(nowIso(), 5) }),
        ]);
        const claimed = await store.claimDuePosts(10);
        expect(claimed).toHaveLength(1);
        expect(claimed[0]?.status).toBe('publishing');
      });

      it('never hands the same post to two workers', async () => {
        await store.saveScheduledPosts([post({ scheduledFor: addDays(nowIso(), -1) })]);
        const first = await store.claimDuePosts(10);
        const second = await store.claimDuePosts(10);
        expect(first).toHaveLength(1);
        expect(second).toHaveLength(0);
      });
    });

    describe('connections', () => {
      it('keeps tokens out of the connection record', async () => {
        const connection: SocialConnection = {
          id: newId('connection'),
          brandId,
          channel: 'linkedin',
          displayName: 'Orca Credit',
          externalAccountId: 'acct',
          status: 'active',
          scopes: ['w_member_social'],
          expiresAt: null,
          lastValidatedAt: null,
          createdAt: nowIso(),
        };
        await store.saveConnection(connection, { accessToken: 'secret-token', refreshToken: null, metadata: {} });

        const listed = await store.listConnections(brandId);
        expect(JSON.stringify(listed)).not.toContain('secret-token');
        expect((await store.getConnectionSecret(connection.id))?.accessToken).toBe('secret-token');
      });

      it('returns null for the secret of a connection that does not exist', async () => {
        expect(await store.getConnectionSecret('con_missing')).toBeNull();
      });
    });

    describe('jobs', () => {
      it('claims the oldest ready job and marks it running', async () => {
        await store.enqueueJob({ organizationId, brandId, kind: 'crawl_site', payload: { url: 'a' } });
        await store.enqueueJob({ organizationId, brandId, kind: 'generate_content', payload: {} });

        const claimed = await store.claimJob('worker-1');
        expect(claimed?.kind).toBe('crawl_site');
        expect(claimed?.status).toBe('running');
        expect(claimed?.attempts).toBe(1);
      });

      it('does not claim a job scheduled for the future', async () => {
        await store.enqueueJob({
          organizationId,
          brandId,
          kind: 'collect_metrics',
          payload: {},
          runAfter: addDays(nowIso(), 1),
        });
        expect(await store.claimJob('worker-1')).toBeNull();
      });

      it('filters by job kind', async () => {
        await store.enqueueJob({ organizationId, brandId, kind: 'crawl_site', payload: {} });
        expect(await store.claimJob('worker-1', ['publish_post'])).toBeNull();
        expect((await store.claimJob('worker-1', ['crawl_site']))?.kind).toBe('crawl_site');
      });

      it('records progress and completion', async () => {
        const job = await store.enqueueJob({ organizationId, brandId, kind: 'crawl_site', payload: {} });
        await store.updateJob(job.id, { progress: 0.5, progressLabel: 'Fetching pages' });
        const done = await store.updateJob(job.id, { status: 'succeeded', result: { pages: 11 }, finishedAt: nowIso() });
        expect(done.status).toBe('succeeded');
        expect(done.result).toEqual({ pages: 11 });
        expect((await store.listJobs(brandId)).map((j) => j.id)).toContain(job.id);
      });
    });

    describe('analytics', () => {
      it('stores and filters attribution events by time', async () => {
        const event = (occurredAt: string): AttributionEvent => ({
          id: newId('event'),
          brandId,
          contentId: null,
          scheduledPostId: null,
          channel: 'instagram',
          stage: 'impression',
          value: 1,
          currency: null,
          occurredAt,
          metadata: {},
        });
        await store.recordEvents([event(addDays(nowIso(), -10)), event(nowIso())]);
        expect(await store.listEvents(brandId)).toHaveLength(2);
        expect(await store.listEvents(brandId, { from: addDays(nowIso(), -1) })).toHaveLength(1);
      });

      it('keeps one metrics row per post', async () => {
        const scheduledPostId = newId('schedule');
        await store.saveMetrics([
          { scheduledPostId, brandId, impressions: 100, engagements: 10, clicks: 5, shares: 1, comments: 0, collectedAt: nowIso() },
          { scheduledPostId, brandId, impressions: 200, engagements: 20, clicks: 8, shares: 2, comments: 1, collectedAt: nowIso() },
        ]);
        const metrics = await store.listMetrics(brandId);
        expect(metrics).toHaveLength(1);
        expect(metrics[0]?.impressions).toBe(200);
      });
    });
  });
}

contract('memory store', () => createMemoryStore());
