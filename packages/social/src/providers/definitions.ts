import type { Channel } from '@morrowlane/shared';
import { ProviderError, type ProviderCapabilities, type PublishRequest, type PublishResult } from '../provider.js';
import { renderForProvider } from '../render.js';
import { providerFetch, publishedNow, type ProviderDefinition } from './base.js';

/**
 * Real network adapters. OAuth endpoints and scopes are the public contract of each
 * platform; the publish flows follow each platform's documented shape. These call live
 * APIs, so they are exercised against the providers themselves rather than in unit
 * tests — see docs/integrations/social-providers.md for verification status per network.
 */

const TEXT_CAPS = (over: Partial<ProviderCapabilities> = {}): ProviderCapabilities => ({
  nativeScheduling: false,
  media: { images: true, video: false, maxImages: 4 },
  requiresMedia: false,
  supportsThreads: false,
  analytics: true,
  requiresAssistedPublishing: false,
  ...over,
});

/* ------------------------------- LinkedIn -------------------------------- */

export const linkedinDefinition: ProviderDefinition = {
  channel: 'linkedin',
  label: 'LinkedIn',
  capabilities: TEXT_CAPS({ media: { images: true, video: true, maxImages: 9 } }),
  oauth: {
    authorizeUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    scopes: ['openid', 'profile', 'w_member_social'],
  },
  async identify(accessToken) {
    const me = await providerFetch<{ sub: string; name?: string }>('linkedin', 'https://api.linkedin.com/v2/userinfo', {
      accessToken,
    });
    return { id: me.sub, name: me.name ?? 'LinkedIn member', metadata: { authorUrn: `urn:li:person:${me.sub}` } };
  },
  async publish(request: PublishRequest): Promise<PublishResult> {
    const rendered = renderForProvider(request.content, 'linkedin');
    const authorUrn = `urn:li:person:${request.connection.externalAccountId}`;

    const response = await providerFetch<{ id: string }>('linkedin', 'https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      accessToken: request.accessToken,
      headers: { 'X-Restli-Protocol-Version': '2.0.0', 'content-type': 'application/json' },
      body: JSON.stringify({
        author: authorUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text: rendered.text },
            shareMediaCategory: rendered.linkUrl ? 'ARTICLE' : 'NONE',
            ...(rendered.linkUrl
              ? { media: [{ status: 'READY', originalUrl: rendered.linkUrl }] }
              : {}),
          },
        },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
      }),
    });

    return publishedNow(response.id, `https://www.linkedin.com/feed/update/${response.id}`);
  },
};

/* ----------------------------------- X ----------------------------------- */

export const xDefinition: ProviderDefinition = {
  channel: 'x',
  label: 'X',
  capabilities: TEXT_CAPS({ supportsThreads: true, media: { images: true, video: true, maxImages: 4 } }),
  oauth: {
    authorizeUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
    usePkce: true,
  },
  async identify(accessToken) {
    const me = await providerFetch<{ data: { id: string; username: string } }>('x', 'https://api.twitter.com/2/users/me', {
      accessToken,
    });
    return { id: me.data.id, name: `@${me.data.username}`, metadata: { username: me.data.username } };
  },
  async publish(request) {
    const rendered = renderForProvider(request.content, 'x');
    let replyTo: string | null = null;
    let rootId: string | null = null;

    // A thread is a chain of replies; each post must land before the next can target it.
    for (const text of rendered.chain) {
      const response: { data: { id: string } } = await providerFetch('x', 'https://api.twitter.com/2/tweets', {
        method: 'POST',
        accessToken: request.accessToken,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, ...(replyTo ? { reply: { in_reply_to_tweet_id: replyTo } } : {}) }),
      });
      replyTo = response.data.id;
      rootId ??= response.data.id;
    }

    if (!rootId) throw new ProviderError('x', 'validation', 'There was nothing to post.');
    const username = String((request.connection as { metadata?: Record<string, unknown> }).metadata?.['username'] ?? 'i');
    return publishedNow(rootId, `https://x.com/${username}/status/${rootId}`);
  },
};

/* -------------------------------- Facebook -------------------------------- */

export const facebookDefinition: ProviderDefinition = {
  channel: 'facebook',
  label: 'Facebook',
  capabilities: TEXT_CAPS({ nativeScheduling: true, media: { images: true, video: true, maxImages: 10 } }),
  oauth: {
    authorizeUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v21.0/oauth/access_token',
    scopes: ['pages_manage_posts', 'pages_read_engagement', 'pages_show_list', 'business_management'],
  },
  async identify(accessToken) {
    // Publishing targets a Page, not the person, so the Page token is what we keep.
    const pages = await providerFetch<{ data: Array<{ id: string; name: string; access_token: string }> }>(
      'facebook',
      `https://graph.facebook.com/v21.0/me/accounts?access_token=${encodeURIComponent(accessToken)}`,
    );
    const page = pages.data[0];
    if (!page) {
      throw new ProviderError('facebook', 'validation', 'This account does not manage any Facebook Page.');
    }
    return { id: page.id, name: page.name, metadata: { pageAccessToken: page.access_token } };
  },
  async publish(request) {
    const rendered = renderForProvider(request.content, 'facebook');
    const pageToken =
      String((request.connection as { metadata?: Record<string, unknown> }).metadata?.['pageAccessToken'] ?? '') ||
      request.accessToken;

    const response = await providerFetch<{ id: string }>(
      'facebook',
      `https://graph.facebook.com/v21.0/${request.connection.externalAccountId}/feed`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: rendered.text,
          ...(rendered.linkUrl ? { link: rendered.linkUrl } : {}),
          ...(request.scheduledFor
            ? {
                published: false,
                scheduled_publish_time: Math.floor(new Date(request.scheduledFor).getTime() / 1000),
              }
            : {}),
          access_token: pageToken,
        }),
      },
    );

    return publishedNow(response.id, `https://facebook.com/${response.id}`);
  },
};

/* ------------------------------- Instagram -------------------------------- */

export const instagramDefinition: ProviderDefinition = {
  channel: 'instagram',
  label: 'Instagram',
  capabilities: TEXT_CAPS({ requiresMedia: true, media: { images: true, video: true, maxImages: 10 } }),
  oauth: {
    authorizeUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v21.0/oauth/access_token',
    scopes: ['instagram_basic', 'instagram_content_publish', 'pages_show_list', 'business_management'],
  },
  async identify(accessToken) {
    const pages = await providerFetch<{ data: Array<{ id: string; name: string; instagram_business_account?: { id: string } }> }>(
      'instagram',
      `https://graph.facebook.com/v21.0/me/accounts?fields=name,instagram_business_account&access_token=${encodeURIComponent(accessToken)}`,
    );
    const page = pages.data.find((p) => p.instagram_business_account?.id);
    if (!page?.instagram_business_account) {
      throw new ProviderError('instagram', 'validation', 'No Instagram professional account is linked to this Facebook Page.');
    }
    return { id: page.instagram_business_account.id, name: page.name, metadata: { pageId: page.id } };
  },
  async publish(request) {
    // Instagram is two-phase: build media containers, then publish them together.
    if (request.mediaUrls.length === 0) {
      throw new ProviderError('instagram', 'validation', 'Instagram requires at least one image or video.');
    }
    const rendered = renderForProvider(request.content, 'instagram');
    const account = request.connection.externalAccountId;
    const base = `https://graph.facebook.com/v21.0/${account}`;
    const isCarousel = request.mediaUrls.length > 1;

    const containerIds: string[] = [];
    for (const mediaUrl of request.mediaUrls.slice(0, 10)) {
      const container = await providerFetch<{ id: string }>('instagram', `${base}/media`, {
        method: 'POST',
        accessToken: request.accessToken,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          image_url: mediaUrl,
          ...(isCarousel ? { is_carousel_item: true } : { caption: rendered.text }),
        }),
      });
      containerIds.push(container.id);
    }

    const creationId = isCarousel
      ? (
          await providerFetch<{ id: string }>('instagram', `${base}/media`, {
            method: 'POST',
            accessToken: request.accessToken,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ media_type: 'CAROUSEL', children: containerIds, caption: rendered.text }),
          })
        ).id
      : containerIds[0]!;

    const published = await providerFetch<{ id: string }>('instagram', `${base}/media_publish`, {
      method: 'POST',
      accessToken: request.accessToken,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ creation_id: creationId }),
    });

    return publishedNow(published.id, null);
  },
};

/* --------------------------------- Threads -------------------------------- */

export const threadsDefinition: ProviderDefinition = {
  channel: 'threads',
  label: 'Threads',
  capabilities: TEXT_CAPS({ supportsThreads: true, analytics: true }),
  oauth: {
    authorizeUrl: 'https://threads.net/oauth/authorize',
    tokenUrl: 'https://graph.threads.net/oauth/access_token',
    scopes: ['threads_basic', 'threads_content_publish'],
  },
  async identify(accessToken) {
    const me = await providerFetch<{ id: string; username?: string }>(
      'threads',
      'https://graph.threads.net/v1.0/me?fields=id,username',
      { accessToken },
    );
    return { id: me.id, name: me.username ? `@${me.username}` : 'Threads account' };
  },
  async publish(request) {
    const rendered = renderForProvider(request.content, 'threads');
    const base = `https://graph.threads.net/v1.0/${request.connection.externalAccountId}`;

    const container = await providerFetch<{ id: string }>('threads', `${base}/threads`, {
      method: 'POST',
      accessToken: request.accessToken,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ media_type: 'TEXT', text: rendered.text }),
    });

    const published = await providerFetch<{ id: string }>('threads', `${base}/threads_publish`, {
      method: 'POST',
      accessToken: request.accessToken,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ creation_id: container.id }),
    });

    return publishedNow(published.id, null);
  },
};

/* -------------------------------- Pinterest ------------------------------- */

export const pinterestDefinition: ProviderDefinition = {
  channel: 'pinterest',
  label: 'Pinterest',
  capabilities: TEXT_CAPS({ requiresMedia: true }),
  oauth: {
    authorizeUrl: 'https://www.pinterest.com/oauth/',
    tokenUrl: 'https://api.pinterest.com/v5/oauth/token',
    scopes: ['boards:read', 'pins:read', 'pins:write'],
  },
  async identify(accessToken) {
    const me = await providerFetch<{ username: string; id?: string }>('pinterest', 'https://api.pinterest.com/v5/user_account', {
      accessToken,
    });
    return { id: me.id ?? me.username, name: me.username };
  },
  async publish(request) {
    if (request.mediaUrls.length === 0) {
      throw new ProviderError('pinterest', 'validation', 'A pin requires an image.');
    }
    const rendered = renderForProvider(request.content, 'pinterest');
    const boardId = String((request.connection as { metadata?: Record<string, unknown> }).metadata?.['boardId'] ?? '');
    if (!boardId) throw new ProviderError('pinterest', 'validation', 'Choose a board before publishing to Pinterest.');

    const pin = await providerFetch<{ id: string }>('pinterest', 'https://api.pinterest.com/v5/pins', {
      method: 'POST',
      accessToken: request.accessToken,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        board_id: boardId,
        title: request.content.title.slice(0, 100),
        description: rendered.text,
        link: rendered.linkUrl,
        media_source: { source_type: 'image_url', url: request.mediaUrls[0] },
      }),
    });

    return publishedNow(pin.id, `https://www.pinterest.com/pin/${pin.id}/`);
  },
};

/* --------------------------------- TikTok --------------------------------- */

export const tiktokDefinition: ProviderDefinition = {
  channel: 'tiktok',
  label: 'TikTok',
  capabilities: TEXT_CAPS({ requiresMedia: true, media: { images: false, video: true, maxImages: 0 } }),
  oauth: {
    authorizeUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    scopes: ['user.info.basic', 'video.publish', 'video.upload'],
    usePkce: true,
    extraAuthorizeParams: { client_key: process.env['TIKTOK_CLIENT_ID'] ?? '' },
  },
  async identify(accessToken) {
    const me = await providerFetch<{ data: { user: { open_id: string; display_name?: string } } }>(
      'tiktok',
      'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name',
      { accessToken },
    );
    return { id: me.data.user.open_id, name: me.data.user.display_name ?? 'TikTok account' };
  },
  async publish(request) {
    if (request.mediaUrls.length === 0) {
      throw new ProviderError('tiktok', 'validation', 'TikTok requires a rendered video. Run the video service first.');
    }
    const rendered = renderForProvider(request.content, 'tiktok');
    const response = await providerFetch<{ data: { publish_id: string } }>(
      'tiktok',
      'https://open.tiktokapis.com/v2/post/publish/video/init/',
      {
        method: 'POST',
        accessToken: request.accessToken,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          post_info: { title: rendered.text.slice(0, 2200), privacy_level: 'PUBLIC_TO_EVERYONE' },
          source_info: { source: 'PULL_FROM_URL', video_url: request.mediaUrls[0] },
        }),
      },
    );
    return publishedNow(response.data.publish_id, null);
  },
};

/* --------------------------------- YouTube -------------------------------- */

export const youtubeDefinition: ProviderDefinition = {
  channel: 'youtube',
  label: 'YouTube',
  capabilities: TEXT_CAPS({ requiresMedia: true, media: { images: false, video: true, maxImages: 0 } }),
  oauth: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly'],
    extraAuthorizeParams: { access_type: 'offline', prompt: 'consent' },
  },
  async identify(accessToken) {
    const channels = await providerFetch<{ items?: Array<{ id: string; snippet: { title: string } }> }>(
      'youtube',
      'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
      { accessToken },
    );
    const channel = channels.items?.[0];
    if (!channel) throw new ProviderError('youtube', 'validation', 'This Google account has no YouTube channel.');
    return { id: channel.id, name: channel.snippet.title };
  },
  async publish(request) {
    // Uploading bytes is the video service's job; this adapter only handles the API call.
    throw new ProviderError(
      'youtube',
      'validation',
      'YouTube publishing runs through the video service, which uploads the rendered file and returns the video id.',
    );
  },
};

/* ---------------------------- Google Business ----------------------------- */

export const googleBusinessDefinition: ProviderDefinition = {
  channel: 'google_business',
  label: 'Google Business Profile',
  capabilities: TEXT_CAPS({ analytics: false }),
  oauth: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/business.manage'],
    extraAuthorizeParams: { access_type: 'offline', prompt: 'consent' },
  },
  async identify(accessToken) {
    const accounts = await providerFetch<{ accounts?: Array<{ name: string; accountName: string }> }>(
      'google_business',
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
      { accessToken },
    );
    const account = accounts.accounts?.[0];
    if (!account) throw new ProviderError('google_business', 'validation', 'No Business Profile account was found.');
    return { id: account.name, name: account.accountName };
  },
  async publish(request) {
    const rendered = renderForProvider(request.content, 'google_business');
    const location = String((request.connection as { metadata?: Record<string, unknown> }).metadata?.['locationName'] ?? '');
    if (!location) throw new ProviderError('google_business', 'validation', 'Choose a business location before publishing.');

    const post = await providerFetch<{ name: string }>(
      'google_business',
      `https://mybusiness.googleapis.com/v4/${location}/localPosts`,
      {
        method: 'POST',
        accessToken: request.accessToken,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          languageCode: 'en',
          summary: rendered.text.slice(0, 1500),
          topicType: 'STANDARD',
          ...(rendered.linkUrl ? { callToAction: { actionType: 'LEARN_MORE', url: rendered.linkUrl } } : {}),
        }),
      },
    );
    return publishedNow(post.name, null);
  },
};

/* --------------------------------- Bluesky -------------------------------- */

/**
 * Bluesky authenticates with an app password rather than OAuth, so it does not use
 * the shared OAuth base — see `createBlueskyProvider`.
 */
export const BLUESKY_SERVICE = 'https://bsky.social';

export const CHANNELS_WITHOUT_WRITE_API: Channel[] = [];
