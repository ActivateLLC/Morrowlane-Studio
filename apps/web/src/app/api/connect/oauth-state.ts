import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';

/**
 * The OAuth handshake spans two requests, so what the start route knew — which brand,
 * which channel, the anti-CSRF state, the PKCE verifier — travels in an HttpOnly cookie
 * and is verified on the way back. Lax is deliberate: the return from the network is a
 * top-level GET navigation, which Lax cookies accompany.
 */
const COOKIE = 'mwl_oauth_state';
const MAX_AGE_SECONDS = 600;

export interface OAuthStateRecord {
  state: string;
  brandId: string;
  channel: string;
  codeVerifier?: string;
}

export function newOAuthState(): string {
  return randomBytes(24).toString('base64url');
}

export async function writeOAuthState(record: OAuthStateRecord): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, Buffer.from(JSON.stringify(record)).toString('base64url'), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/connect',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function readAndClearOAuthState(): Promise<OAuthStateRecord | null> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  store.delete(COOKIE);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as OAuthStateRecord;
    return parsed.state && parsed.brandId && parsed.channel ? parsed : null;
  } catch {
    return null;
  }
}

/** The absolute base for redirect URIs — the custom domain when set, else this request's origin. */
export function siteBase(requestUrl: URL): string {
  return process.env['NEXT_PUBLIC_SITE_URL'] ?? requestUrl.origin;
}
