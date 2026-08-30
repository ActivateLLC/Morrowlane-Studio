import { nowIso } from '@morrowlane/shared';
import {
  ProviderError,
  type OAuthStart,
  type PostAnalytics,
  type ProviderAccount,
  type PublishRequest,
  type PublishResult,
  type RetrievedPost,
  type SocialProvider,
  type ValidationResult,
} from '../provider.js';
import { renderForProvider } from '../render.js';
import { providerFetch } from './base.js';

const SERVICE = process.env['BLUESKY_SERVICE'] ?? 'https://bsky.social';

/**
 * Bluesky uses an app password against an AT Protocol PDS rather than OAuth, so it does
 * not fit the shared OAuth base. The session it returns is short-lived; `validate`
 * refreshes it, which is why the refresh token is what gets stored.
 */
export function createBlueskyProvider(): SocialProvider {
  return {
    channel: 'bluesky',
    label: 'Bluesky',
    capabilities: {
      nativeScheduling: false,
      media: { images: true, video: false, maxImages: 4 },
      requiresMedia: false,
      supportsThreads: true,
      analytics: false,
      requiresAssistedPublishing: false,
    },
    configured: true,

    async connect(): Promise<OAuthStart> {
      // The UI collects a handle and app password directly; there is no redirect flow.
      throw new ProviderError(
        'bluesky',
        'validation',
        'Bluesky connects with a handle and an app password rather than a redirect. Use createSession instead.',
      );
    },

    async exchange(): Promise<ProviderAccount> {
      throw new ProviderError('bluesky', 'validation', 'Bluesky does not use an authorization code exchange.');
    },

    async disconnect(): Promise<void> {},

    async validate(connection, accessToken): Promise<ValidationResult> {
      try {
        await providerFetch('bluesky', `${SERVICE}/xrpc/com.atproto.server.getSession`, { accessToken });
        return { valid: true, reason: null, expiresAt: connection.expiresAt };
      } catch (error) {
        return {
          valid: false,
          reason: error instanceof Error ? error.message : 'The Bluesky session could not be validated.',
          expiresAt: connection.expiresAt,
        };
      }
    },

    async publish(request: PublishRequest): Promise<PublishResult> {
      const rendered = renderForProvider(request.content, 'bluesky');
      const did = request.connection.externalAccountId;

      let root: { uri: string; cid: string } | null = null;
      let parent: { uri: string; cid: string } | null = null;

      for (const text of rendered.chain) {
        const created: { uri: string; cid: string } = await providerFetch(
          'bluesky',
          `${SERVICE}/xrpc/com.atproto.repo.createRecord`,
          {
            method: 'POST',
            accessToken: request.accessToken,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              repo: did,
              collection: 'app.bsky.feed.post',
              record: {
                $type: 'app.bsky.feed.post',
                text,
                createdAt: nowIso(),
                ...(root && parent ? { reply: { root, parent } } : {}),
              },
            }),
          },
        );
        root ??= created;
        parent = created;
      }

      if (!root) throw new ProviderError('bluesky', 'validation', 'There was nothing to post.');
      const rkey = root.uri.split('/').pop() ?? '';
      return {
        externalPostId: root.uri,
        externalUrl: `https://bsky.app/profile/${did}/post/${rkey}`,
        publishedAt: nowIso(),
      };
    },

    async schedule(): Promise<PublishResult> {
      throw new ProviderError(
        'bluesky',
        'validation',
        'Bluesky has no scheduling API; Morrowlane holds the post and publishes it at the scheduled time.',
      );
    },

    async retrievePost(_connection, accessToken, externalPostId): Promise<RetrievedPost | null> {
      const result = await providerFetch<{ posts?: Array<{ uri: string; record?: { text?: string; createdAt?: string } }> }>(
        'bluesky',
        `${SERVICE}/xrpc/app.bsky.feed.getPosts?uris=${encodeURIComponent(externalPostId)}`,
        { accessToken },
      );
      const post = result.posts?.[0];
      if (!post) return null;
      return {
        externalPostId: post.uri,
        url: null,
        publishedAt: post.record?.createdAt ?? null,
        text: post.record?.text ?? null,
      };
    },

    async retrieveAnalytics(): Promise<PostAnalytics | null> {
      return null;
    },
  };
}

/** Exchanges a handle and app password for a session. Called by the connect screen. */
export async function createBlueskySession(
  identifier: string,
  appPassword: string,
): Promise<ProviderAccount> {
  const session = await providerFetch<{
    did: string;
    handle: string;
    accessJwt: string;
    refreshJwt: string;
  }>('bluesky', `${SERVICE}/xrpc/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier, password: appPassword }),
  });

  return {
    externalAccountId: session.did,
    displayName: `@${session.handle}`,
    accessToken: session.accessJwt,
    refreshToken: session.refreshJwt,
    expiresAt: null,
    scopes: ['post'],
    metadata: { handle: session.handle, service: SERVICE },
  };
}
