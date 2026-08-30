import type { ContentItem, ScheduledPost, SocialConnection } from '@morrowlane/shared';
import { newId, nowIso } from '@morrowlane/shared';
import { describe, expect, it } from 'vitest';
import { buildAuthorizationUrl, codeChallengeFor, createCodeVerifier, readTokenResponse } from './oauth.js';
import { publishPost } from './publish.js';
import { createSocialRegistry } from './registry.js';
import { renderForProvider } from './render.js';
import { createMockProvider } from './providers/mock.js';

function makeContent(over: Partial<ContentItem> = {}): ContentItem {
  return {
    id: newId('content'),
    brandId: 'brd_test',
    campaignId: null,
    campaignPhaseId: null,
    format: 'instagram_post',
    channel: 'instagram',
    status: 'approved',
    title: 'Title',
    hook: 'Hook line.',
    body: 'Body copy that explains the idea.',
    segments: [],
    hashtags: ['#credit', '#score'],
    cta: 'Get started',
    linkUrl: 'https://orcacredit.example/pricing',
    mediaAssetIds: [],
    topics: ['credit'],
    lineage: { sourceType: 'brand', sourceUrl: null, sourceId: null, instruction: null, parentContentId: null, appliedInsightIds: [] },
    violations: [],
    model: 'local:test',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    ...over,
  };
}

function makeConnection(channel: SocialConnection['channel']): SocialConnection {
  return {
    id: newId('connection'),
    brandId: 'brd_test',
    channel,
    displayName: 'Demo account',
    externalAccountId: 'acct_1',
    status: 'active',
    scopes: ['write'],
    expiresAt: null,
    lastValidatedAt: null,
    createdAt: nowIso(),
  };
}

function makePost(channel: ScheduledPost['channel'], contentId: string): ScheduledPost {
  return {
    id: newId('schedule'),
    brandId: 'brd_test',
    contentId,
    connectionId: null,
    channel,
    scheduledFor: nowIso(),
    status: 'scheduled',
    attempts: 0,
    lastError: null,
    externalPostId: null,
    externalUrl: null,
    publishedAt: null,
  };
}

describe('OAuth helpers', () => {
  it('builds an authorization URL with the required parameters', () => {
    const url = new URL(
      buildAuthorizationUrl(
        {
          clientId: 'client-1',
          clientSecret: 'secret',
          authorizeUrl: 'https://example.com/oauth',
          tokenUrl: 'https://example.com/token',
          scopes: ['read', 'write'],
        },
        { redirectUri: 'https://app.local/callback', state: 'state-1' },
      ),
    );
    expect(url.searchParams.get('client_id')).toBe('client-1');
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.local/callback');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('state')).toBe('state-1');
    expect(url.searchParams.get('scope')).toBe('read,write');
  });

  it('adds a PKCE challenge only when the provider uses PKCE', () => {
    const verifier = createCodeVerifier();
    const config = {
      clientId: 'c',
      clientSecret: 's',
      authorizeUrl: 'https://example.com/oauth',
      tokenUrl: 'https://example.com/token',
      scopes: [],
    };
    const without = new URL(buildAuthorizationUrl(config, { redirectUri: 'r', state: 's', codeVerifier: verifier }));
    expect(without.searchParams.get('code_challenge')).toBeNull();

    const withPkce = new URL(
      buildAuthorizationUrl({ ...config, usePkce: true }, { redirectUri: 'r', state: 's', codeVerifier: verifier }),
    );
    expect(withPkce.searchParams.get('code_challenge')).toBe(codeChallengeFor(verifier));
    expect(withPkce.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('produces url-safe PKCE values', () => {
    const verifier = createCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(codeChallengeFor(verifier)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('reads expiry and scopes out of a token response', () => {
    const token = readTokenResponse({ access_token: 'a', refresh_token: 'r', expires_in: 3600, scope: 'read write' });
    expect(token.accessToken).toBe('a');
    expect(token.refreshToken).toBe('r');
    expect(token.scopes).toEqual(['read', 'write']);
    expect(new Date(token.expiresAt!).getTime()).toBeGreaterThan(Date.now());
  });

  it('rejects a token response with no access token', () => {
    expect(() => readTokenResponse({ token_type: 'bearer' })).toThrow(/access token/i);
  });
});

describe('renderForProvider', () => {
  it('appends the link on channels that linkify the body', () => {
    const rendered = renderForProvider(makeContent({ channel: 'linkedin' }), 'linkedin');
    expect(rendered.text).toContain('https://orcacredit.example/pricing');
  });

  it('leaves the link out on channels that do not', () => {
    const rendered = renderForProvider(makeContent(), 'instagram');
    expect(rendered.text).not.toContain('https://orcacredit.example/pricing');
  });

  it('trims hashtags to the channel guideline', () => {
    const content = makeContent({ hashtags: ['#a', '#b', '#c', '#d'] });
    expect(renderForProvider(content, 'x').hashtags).toHaveLength(2);
  });

  it('splits segments into a chain on threading channels', () => {
    const content = makeContent({
      channel: 'x',
      format: 'x_thread',
      segments: [
        { index: 0, heading: null, body: 'First post.', visualDirection: null },
        { index: 1, heading: null, body: 'Second post.', visualDirection: null },
      ],
    });
    const rendered = renderForProvider(content, 'x');
    expect(rendered.chain).toHaveLength(2);
    expect(rendered.chain[0]).toBe('First post.');
    expect(rendered.chain[1]).toContain('Second post.');
  });

  it('never exceeds the channel character ceiling', () => {
    const content = makeContent({ channel: 'x', body: 'a'.repeat(600) });
    expect(renderForProvider(content, 'x').text.length).toBeLessThanOrEqual(280);
  });
});

describe('createSocialRegistry', () => {
  it('registers every social channel from the spec', () => {
    const registry = createSocialRegistry({ useMocks: true });
    expect(registry.list().map((p) => p.channel).sort()).toEqual(
      ['bluesky', 'facebook', 'google_business', 'instagram', 'linkedin', 'pinterest', 'threads', 'tiktok', 'x', 'youtube'].sort(),
    );
  });

  it('reports which real providers have credentials configured', () => {
    const registry = createSocialRegistry({ useMocks: false });
    // Without credentials in the environment, nothing but Bluesky is connectable.
    expect(registry.available().map((p) => p.channel)).toEqual(['bluesky']);
    expect(registry.get('linkedin').configured).toBe(false);
  });

  it('refuses to start an OAuth flow for an unconfigured provider', async () => {
    const registry = createSocialRegistry({ useMocks: false });
    await expect(
      registry.get('linkedin').connect({ brandId: 'brd_1', redirectUri: 'https://app.local/cb', state: 's' }),
    ).rejects.toThrow(/LINKEDIN_CLIENT_ID/);
  });

  it('accepts per-channel overrides', () => {
    const custom = createMockProvider('instagram', { label: 'Custom' });
    const registry = createSocialRegistry({ useMocks: true, overrides: { instagram: custom } });
    expect(registry.get('instagram').label).toBe('Custom');
  });
});

describe('publishPost', () => {
  const registry = createSocialRegistry({ useMocks: true });

  it('publishes and records the external identifiers', async () => {
    const content = makeContent();
    const result = await publishPost(registry, {
      post: makePost('instagram', content.id),
      content,
      connection: makeConnection('instagram'),
      accessToken: 'token',
      mediaUrls: ['https://cdn.local/a.png'],
    });
    expect(result.post.status).toBe('published');
    expect(result.post.externalPostId).toMatch(/^instagram_/);
    expect(result.post.publishedAt).not.toBeNull();
  });

  it('refuses to publish content that breaks a brand rule', async () => {
    const content = makeContent({
      violations: [{ rule: 'prohibited_claim', severity: 'error', message: 'Guaranteed approval.', excerpt: null }],
    });
    const result = await publishPost(registry, {
      post: makePost('instagram', content.id),
      content,
      connection: makeConnection('instagram'),
      accessToken: 'token',
      mediaUrls: ['https://cdn.local/a.png'],
    });
    expect(result.post.status).toBe('failed');
    expect(result.retry).toBe(false);
    expect(result.post.lastError).toMatch(/brand rule/i);
  });

  it('fails fast when a media-only channel has no media', async () => {
    const mediaOnly = createSocialRegistry({
      useMocks: true,
      overrides: { instagram: createMockProvider('instagram', { capabilities: { requiresMedia: true } }) },
    });
    const content = makeContent();
    const result = await publishPost(mediaOnly, {
      post: makePost('instagram', content.id),
      content,
      connection: makeConnection('instagram'),
      accessToken: 'token',
    });
    expect(result.post.status).toBe('failed');
    expect(result.post.lastError).toMatch(/requires media/i);
  });

  it('keeps a transient failure scheduled for another attempt', async () => {
    const flaky = createSocialRegistry({
      useMocks: true,
      overrides: { linkedin: createMockProvider('linkedin', { failOnce: true }) },
    });
    const content = makeContent({ channel: 'linkedin', format: 'linkedin_post' });
    const post = makePost('linkedin', content.id);
    const first = await publishPost(flaky, { post, content, connection: makeConnection('linkedin'), accessToken: 't' });
    expect(first.post.status).toBe('scheduled');
    expect(first.retry).toBe(true);
    expect(first.retryAfterSeconds).toBeGreaterThan(0);

    const second = await publishPost(flaky, {
      post: first.post,
      content,
      connection: makeConnection('linkedin'),
      accessToken: 't',
    });
    expect(second.post.status).toBe('published');
    expect(second.post.attempts).toBe(2);
  });

  it('stops retrying once the attempt budget is spent', async () => {
    const alwaysFails = createSocialRegistry({
      useMocks: true,
      overrides: { x: createMockProvider('x', { failOnce: true }) },
    });
    const content = makeContent({ channel: 'x', format: 'x_post' });
    const post = { ...makePost('x', content.id), attempts: 2 };
    const result = await publishPost(alwaysFails, {
      post,
      content,
      connection: makeConnection('x'),
      accessToken: 't',
      maxAttempts: 3,
    });
    expect(result.post.status).toBe('failed');
    expect(result.retry).toBe(false);
  });

  it('collects analytics for a published post', async () => {
    const content = makeContent();
    const connection = makeConnection('instagram');
    const result = await publishPost(registry, {
      post: makePost('instagram', content.id),
      content,
      connection,
      accessToken: 'token',
      mediaUrls: ['https://cdn.local/a.png'],
    });
    const analytics = await registry
      .get('instagram')
      .retrieveAnalytics(connection, 'token', result.post.externalPostId!);
    expect(analytics?.impressions).toBeGreaterThan(0);
    expect(analytics?.externalPostId).toBe(result.post.externalPostId);
  });
});
