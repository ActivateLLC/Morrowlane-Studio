import type { Channel, SocialConnection } from '@morrowlane/shared';
import { nowIso } from '@morrowlane/shared';
import {
  buildAuthorizationUrl,
  createCodeVerifier,
  credentialsFor,
  exchangeCodeForToken,
  type OAuthConfig,
} from '../oauth.js';
import {
  ProviderError,
  type OAuthCallbackRequest,
  type OAuthStart,
  type OAuthStartRequest,
  type PostAnalytics,
  type ProviderAccount,
  type ProviderCapabilities,
  type PublishRequest,
  type PublishResult,
  type RetrievedPost,
  type SocialProvider,
  type ValidationResult,
} from '../provider.js';

export interface ProviderDefinition {
  channel: Channel;
  label: string;
  capabilities: ProviderCapabilities;
  oauth: Omit<OAuthConfig, 'clientId' | 'clientSecret'>;
  /** Reads the account identity from the provider after a token exchange. */
  identify(accessToken: string, raw: Record<string, unknown>): Promise<{ id: string; name: string; metadata?: Record<string, unknown> }>;
  publish(request: PublishRequest): Promise<PublishResult>;
  validate?(connection: SocialConnection, accessToken: string): Promise<ValidationResult>;
  revoke?(connection: SocialConnection, accessToken: string): Promise<void>;
  retrievePost?(connection: SocialConnection, accessToken: string, externalPostId: string): Promise<RetrievedPost | null>;
  retrieveAnalytics?(connection: SocialConnection, accessToken: string, externalPostId: string): Promise<PostAnalytics | null>;
}

/**
 * Shared implementation of the OAuth half of every adapter. A provider definition only
 * has to describe what is genuinely different about its network.
 */
export function createOAuthProvider(definition: ProviderDefinition): SocialProvider {
  const { clientId, clientSecret } = credentialsFor(definition.channel);
  const config: OAuthConfig = { ...definition.oauth, clientId, clientSecret };
  const configured = Boolean(clientId && clientSecret);

  const requireConfigured = () => {
    if (!configured) {
      throw new ProviderError(
        definition.channel,
        'auth',
        `${definition.label} is not configured. Set ${definition.channel.toUpperCase()}_CLIENT_ID and ${definition.channel.toUpperCase()}_CLIENT_SECRET.`,
      );
    }
  };

  return {
    channel: definition.channel,
    label: definition.label,
    capabilities: definition.capabilities,
    configured,

    async connect(request: OAuthStartRequest): Promise<OAuthStart> {
      requireConfigured();
      const codeVerifier = config.usePkce ? createCodeVerifier() : undefined;
      return {
        authorizationUrl: buildAuthorizationUrl(config, {
          redirectUri: request.redirectUri,
          state: request.state,
          codeVerifier,
        }),
        ...(codeVerifier ? { codeVerifier } : {}),
      };
    },

    async exchange(request: OAuthCallbackRequest): Promise<ProviderAccount> {
      requireConfigured();
      const token = await exchangeCodeForToken(config, request);
      const identity = await definition.identify(token.accessToken, token.raw);
      return {
        externalAccountId: identity.id,
        displayName: identity.name,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        expiresAt: token.expiresAt,
        scopes: token.scopes.length > 0 ? token.scopes : config.scopes,
        metadata: identity.metadata ?? {},
      };
    },

    async disconnect(connection, accessToken) {
      // Not every network offers token revocation; forgetting the token locally is
      // the baseline and the caller always does that regardless of what happens here.
      await definition.revoke?.(connection, accessToken);
    },

    async validate(connection, accessToken): Promise<ValidationResult> {
      if (definition.validate) return definition.validate(connection, accessToken);
      if (connection.expiresAt && new Date(connection.expiresAt).getTime() < Date.now()) {
        return { valid: false, reason: 'The access token has expired.', expiresAt: connection.expiresAt };
      }
      return { valid: true, reason: null, expiresAt: connection.expiresAt };
    },

    async publish(request) {
      requireConfigured();
      return definition.publish(request);
    },

    async schedule(request) {
      if (!definition.capabilities.nativeScheduling) {
        // Morrowlane's own scheduler holds the post and calls publish() at the time.
        throw new ProviderError(
          definition.channel,
          'validation',
          `${definition.label} does not support scheduling through its API; Morrowlane schedules this channel itself.`,
        );
      }
      requireConfigured();
      return definition.publish(request);
    },

    async retrievePost(connection, accessToken, externalPostId) {
      return definition.retrievePost?.(connection, accessToken, externalPostId) ?? null;
    },

    async retrieveAnalytics(connection, accessToken, externalPostId) {
      if (!definition.capabilities.analytics) return null;
      return definition.retrieveAnalytics?.(connection, accessToken, externalPostId) ?? null;
    },
  };
}

/** JSON request helper that turns provider HTTP failures into typed ProviderErrors. */
export async function providerFetch<T>(
  channel: Channel,
  url: string,
  init: RequestInit & { accessToken?: string } = {},
): Promise<T> {
  const { accessToken, ...rest } = init;
  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      headers: {
        accept: 'application/json',
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        ...(rest.body && !(rest.headers as Record<string, string> | undefined)?.['content-type']
          ? { 'content-type': 'application/json' }
          : {}),
        ...((rest.headers as Record<string, string> | undefined) ?? {}),
      },
    });
  } catch (error) {
    throw new ProviderError(channel, 'network', `Could not reach the provider: ${String(error)}`);
  }

  if (response.status === 401 || response.status === 403) {
    throw new ProviderError(channel, 'auth', 'The connection is no longer authorised. Reconnect the account.');
  }
  if (response.status === 429) {
    const retryAfter = Number.parseInt(response.headers.get('retry-after') ?? '', 10);
    throw new ProviderError(channel, 'rate_limit', 'Rate limited by the provider.', {
      retryAfterSeconds: Number.isFinite(retryAfter) ? retryAfter : 60,
    });
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new ProviderError(
      channel,
      response.status >= 500 ? 'provider' : 'validation',
      `Provider responded ${response.status}: ${detail.slice(0, 300)}`,
      { retryable: response.status >= 500 },
    );
  }

  if (response.status === 204) return {} as T;
  return (await response.json()) as T;
}

export function publishedNow(externalPostId: string, externalUrl: string | null): PublishResult {
  return { externalPostId, externalUrl, publishedAt: nowIso() };
}
