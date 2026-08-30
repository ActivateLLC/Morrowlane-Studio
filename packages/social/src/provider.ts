import type { Channel, ContentItem, SocialConnection } from '@morrowlane/shared';

/**
 * Every network Morrowlane publishes to implements this. Nothing above this layer
 * knows that Instagram needs a container before it can publish, or that X counts
 * characters differently — that belongs behind the adapter.
 */

export interface OAuthStartRequest {
  brandId: string;
  redirectUri: string;
  /** Opaque value the caller verifies on return. */
  state: string;
}

export interface OAuthStart {
  authorizationUrl: string;
  /** PKCE verifier when the provider requires it; stored against `state`. */
  codeVerifier?: string;
}

export interface OAuthCallbackRequest {
  code: string;
  redirectUri: string;
  codeVerifier?: string;
}

export interface ProviderAccount {
  externalAccountId: string;
  displayName: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  scopes: string[];
  metadata: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  reason: string | null;
  expiresAt: string | null;
}

export interface PublishRequest {
  connection: SocialConnection;
  accessToken: string;
  content: ContentItem;
  mediaUrls: string[];
  /** Set when the caller is publishing a previously scheduled post. */
  scheduledFor?: string | null;
}

export interface PublishResult {
  externalPostId: string;
  externalUrl: string | null;
  publishedAt: string;
}

export interface RetrievedPost {
  externalPostId: string;
  url: string | null;
  publishedAt: string | null;
  text: string | null;
}

export interface PostAnalytics {
  externalPostId: string;
  impressions: number;
  engagements: number;
  clicks: number;
  shares: number;
  comments: number;
  collectedAt: string;
}

/** Distinguishes "try again later" from "the user must reconnect". */
export class ProviderError extends Error {
  readonly channel: Channel;
  readonly kind: 'auth' | 'rate_limit' | 'validation' | 'network' | 'provider';
  readonly retryable: boolean;
  readonly retryAfterSeconds: number | null;

  constructor(
    channel: Channel,
    kind: ProviderError['kind'],
    message: string,
    options: { retryable?: boolean; retryAfterSeconds?: number | null } = {},
  ) {
    super(message);
    this.name = 'ProviderError';
    this.channel = channel;
    this.kind = kind;
    this.retryable = options.retryable ?? (kind === 'rate_limit' || kind === 'network');
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
  }
}

export interface ProviderCapabilities {
  /** The provider can hold a post and publish it at a future time itself. */
  nativeScheduling: boolean;
  media: { images: boolean; video: boolean; maxImages: number };
  requiresMedia: boolean;
  supportsThreads: boolean;
  analytics: boolean;
  /** Networks with no official write API; publishing needs assisted automation. */
  requiresAssistedPublishing: boolean;
}

export interface SocialProvider {
  readonly channel: Channel;
  readonly label: string;
  readonly capabilities: ProviderCapabilities;
  /** False when the deployment has not configured this provider's credentials. */
  readonly configured: boolean;

  connect(request: OAuthStartRequest): Promise<OAuthStart>;
  exchange(request: OAuthCallbackRequest): Promise<ProviderAccount>;
  disconnect(connection: SocialConnection, accessToken: string): Promise<void>;
  validate(connection: SocialConnection, accessToken: string): Promise<ValidationResult>;
  publish(request: PublishRequest): Promise<PublishResult>;
  schedule(request: PublishRequest): Promise<PublishResult>;
  retrievePost(connection: SocialConnection, accessToken: string, externalPostId: string): Promise<RetrievedPost | null>;
  retrieveAnalytics(connection: SocialConnection, accessToken: string, externalPostId: string): Promise<PostAnalytics | null>;
}
