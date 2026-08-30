import type { ContentItem, ScheduledPost, SocialConnection } from '@morrowlane/shared';
import { createLogger, nowIso } from '@morrowlane/shared';
import { ProviderError } from './provider.js';
import type { SocialRegistry } from './registry.js';

const log = createLogger('social:publish');

export interface PublishAttemptRequest {
  post: ScheduledPost;
  content: ContentItem;
  connection: SocialConnection;
  accessToken: string;
  mediaUrls?: string[];
  maxAttempts?: number;
}

export interface PublishAttemptResult {
  post: ScheduledPost;
  /** True when the post should be retried later rather than surfaced as a failure. */
  retry: boolean;
  retryAfterSeconds: number | null;
}

/**
 * The one place a post actually goes out. Returns an updated ScheduledPost rather than
 * mutating anything, so the caller decides what to persist and the retry policy is
 * visible in one place instead of scattered through the worker.
 */
export async function publishPost(
  registry: SocialRegistry,
  request: PublishAttemptRequest,
): Promise<PublishAttemptResult> {
  const { post, content, connection } = request;
  const maxAttempts = request.maxAttempts ?? 3;
  const provider = registry.get(post.channel);
  const attempts = post.attempts + 1;

  if (content.violations.some((violation) => violation.severity === 'error')) {
    return {
      post: {
        ...post,
        status: 'failed',
        attempts,
        lastError: 'This post breaks a brand rule and was not published. Resolve the violation first.',
      },
      retry: false,
      retryAfterSeconds: null,
    };
  }

  if (provider.capabilities.requiresMedia && (request.mediaUrls?.length ?? 0) === 0) {
    return {
      post: {
        ...post,
        status: 'failed',
        attempts,
        lastError: `${provider.label} requires media. Render the creative before publishing.`,
      },
      retry: false,
      retryAfterSeconds: null,
    };
  }

  try {
    const result = await provider.publish({
      connection,
      accessToken: request.accessToken,
      content,
      mediaUrls: request.mediaUrls ?? [],
      scheduledFor: post.scheduledFor,
    });

    log.info('published', { channel: post.channel, contentId: content.id, externalPostId: result.externalPostId });

    return {
      post: {
        ...post,
        status: 'published',
        attempts,
        lastError: null,
        externalPostId: result.externalPostId,
        externalUrl: result.externalUrl,
        publishedAt: result.publishedAt ?? nowIso(),
      },
      retry: false,
      retryAfterSeconds: null,
    };
  } catch (error) {
    const providerError = error instanceof ProviderError ? error : null;
    const message = error instanceof Error ? error.message : String(error);
    // An expired token is not a transient failure; retrying it just burns attempts.
    const retry = (providerError?.retryable ?? false) && attempts < maxAttempts;

    log.warn('publish failed', { channel: post.channel, attempts, retry, error: message });

    return {
      post: {
        ...post,
        status: retry ? 'scheduled' : 'failed',
        attempts,
        lastError: message,
      },
      retry,
      retryAfterSeconds: providerError?.retryAfterSeconds ?? (retry ? 2 ** attempts * 30 : null),
    };
  }
}
