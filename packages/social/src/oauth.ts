import { createHash, randomBytes } from 'node:crypto';

/** OAuth 2.0 plumbing shared by every adapter that speaks it. */

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  usePkce?: boolean;
  /** Extra parameters a specific provider requires on the authorize call. */
  extraAuthorizeParams?: Record<string, string>;
}

export function base64Url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function createCodeVerifier(): string {
  return base64Url(randomBytes(48));
}

export function codeChallengeFor(verifier: string): string {
  return base64Url(createHash('sha256').update(verifier).digest());
}

export function buildAuthorizationUrl(
  config: OAuthConfig,
  options: { redirectUri: string; state: string; codeVerifier?: string },
): string {
  const url = new URL(config.authorizeUrl);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', options.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', options.state);
  if (config.scopes.length > 0) url.searchParams.set('scope', config.scopes.join(','));
  if (config.usePkce && options.codeVerifier) {
    url.searchParams.set('code_challenge', codeChallengeFor(options.codeVerifier));
    url.searchParams.set('code_challenge_method', 'S256');
  }
  for (const [key, value] of Object.entries(config.extraAuthorizeParams ?? {})) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  scopes: string[];
  raw: Record<string, unknown>;
}

export async function exchangeCodeForToken(
  config: OAuthConfig,
  options: { code: string; redirectUri: string; codeVerifier?: string },
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'authorization_code',
    code: options.code,
    redirect_uri: options.redirectUri,
  });
  if (config.usePkce && options.codeVerifier) body.set('code_verifier', options.codeVerifier);

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Token exchange failed with ${response.status}: ${detail.slice(0, 300)}`);
  }

  return readTokenResponse((await response.json()) as Record<string, unknown>);
}

export function readTokenResponse(payload: Record<string, unknown>): TokenResponse {
  const accessToken = typeof payload['access_token'] === 'string' ? payload['access_token'] : '';
  if (!accessToken) throw new Error('The token response did not contain an access token.');

  const expiresIn = typeof payload['expires_in'] === 'number' ? payload['expires_in'] : null;
  const scopeRaw = payload['scope'];

  return {
    accessToken,
    refreshToken: typeof payload['refresh_token'] === 'string' ? payload['refresh_token'] : null,
    expiresAt: expiresIn !== null ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
    scopes: typeof scopeRaw === 'string' ? scopeRaw.split(/[ ,]/).filter(Boolean) : [],
    raw: payload,
  };
}

/** Reads provider credentials from the environment using a consistent naming scheme. */
export function credentialsFor(channel: string): { clientId: string; clientSecret: string } {
  const prefix = channel.toUpperCase();
  return {
    clientId: process.env[`${prefix}_CLIENT_ID`] ?? '',
    clientSecret: process.env[`${prefix}_CLIENT_SECRET`] ?? '',
  };
}
