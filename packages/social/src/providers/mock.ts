import type { Channel, SocialConnection } from '@morrowlane/shared';
import { newId, nowIso } from '@morrowlane/shared';
import type {
  OAuthStart,
  PostAnalytics,
  ProviderAccount,
  ProviderCapabilities,
  PublishRequest,
  PublishResult,
  RetrievedPost,
  SocialProvider,
  ValidationResult,
} from '../provider.js';
import { renderForProvider } from '../render.js';

export interface MockPublishRecord {
  channel: Channel;
  contentId: string;
  text: string;
  chain: string[];
  mediaUrls: string[];
  externalPostId: string;
  publishedAt: string;
}

/**
 * A working provider with no network calls. It is how the publishing pipeline is
 * tested end to end, and how a demo brand can walk the whole flow — connect, schedule,
 * publish, collect metrics — without anyone creating developer apps on ten networks.
 */
export function createMockProvider(
  channel: Channel,
  options: { label?: string; capabilities?: Partial<ProviderCapabilities>; failOnce?: boolean } = {},
): SocialProvider & { published: MockPublishRecord[] } {
  const published: MockPublishRecord[] = [];
  let shouldFail = options.failOnce ?? false;

  const capabilities: ProviderCapabilities = {
    nativeScheduling: true,
    media: { images: true, video: true, maxImages: 10 },
    requiresMedia: false,
    supportsThreads: true,
    analytics: true,
    requiresAssistedPublishing: false,
    ...options.capabilities,
  };

  const doPublish = async (request: PublishRequest): Promise<PublishResult> => {
    if (shouldFail) {
      shouldFail = false;
      const { ProviderError } = await import('../provider.js');
      throw new ProviderError(channel, 'network', 'Simulated transient failure.', { retryable: true });
    }
    const rendered = renderForProvider(request.content, channel);
    const externalPostId = newId('event').replace('evt_', `${channel}_`);
    published.push({
      channel,
      contentId: request.content.id,
      text: rendered.text,
      chain: rendered.chain,
      mediaUrls: request.mediaUrls,
      externalPostId,
      publishedAt: nowIso(),
    });
    return { externalPostId, externalUrl: `https://mock.local/${channel}/${externalPostId}`, publishedAt: nowIso() };
  };

  return {
    channel,
    label: options.label ?? `${channel} (mock)`,
    capabilities,
    configured: true,
    published,

    async connect(): Promise<OAuthStart> {
      return { authorizationUrl: `https://mock.local/oauth/${channel}` };
    },
    async exchange(): Promise<ProviderAccount> {
      return {
        externalAccountId: `${channel}_account`,
        displayName: `Demo ${channel} account`,
        accessToken: 'mock-access-token',
        refreshToken: null,
        expiresAt: null,
        scopes: ['read', 'write'],
        metadata: {},
      };
    },
    async disconnect(): Promise<void> {},
    async validate(connection: SocialConnection): Promise<ValidationResult> {
      return { valid: true, reason: null, expiresAt: connection.expiresAt };
    },
    publish: doPublish,
    schedule: doPublish,
    async retrievePost(_connection, _token, externalPostId): Promise<RetrievedPost | null> {
      const record = published.find((p) => p.externalPostId === externalPostId);
      return record
        ? { externalPostId, url: `https://mock.local/${channel}/${externalPostId}`, publishedAt: record.publishedAt, text: record.text }
        : null;
    },
    async retrieveAnalytics(_connection, _token, externalPostId): Promise<PostAnalytics | null> {
      const record = published.find((p) => p.externalPostId === externalPostId);
      if (!record) return null;
      // Deterministic pseudo-metrics derived from the post id, so tests can assert on them.
      const seed = [...externalPostId].reduce((sum, char) => sum + char.charCodeAt(0), 0);
      return {
        externalPostId,
        impressions: 500 + (seed % 2500),
        engagements: 20 + (seed % 180),
        clicks: 5 + (seed % 60),
        shares: seed % 25,
        comments: seed % 15,
        collectedAt: nowIso(),
      };
    },
  };
}
