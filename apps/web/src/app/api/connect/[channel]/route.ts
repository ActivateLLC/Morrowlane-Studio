import { NextResponse, type NextRequest } from 'next/server';
import { isChannel } from '@morrowlane/shared';
import { requireBrandAdmin } from '@/server/session';
import { newOAuthState, siteBase, writeOAuthState } from '../oauth-state';

/**
 * Starts a real account connection: verifies the caller may manage this brand's
 * connections, asks the provider for its authorization URL, pins the handshake in a
 * state cookie, and hands the browser to the network's own sign-in.
 *
 * Every failure lands back on the connections page with a readable reason — an OAuth
 * misfire must never strand the user on a JSON error.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ channel: string }> }) {
  const { channel } = await context.params;
  const brandId = request.nextUrl.searchParams.get('brandId') ?? '';
  const back = (reason?: string) =>
    NextResponse.redirect(
      `${siteBase(request.nextUrl)}/brands/${brandId}/connections${reason ? `?connect_error=${encodeURIComponent(reason)}` : ''}`,
    );

  if (!brandId || !isChannel(channel)) {
    return NextResponse.redirect(`${siteBase(request.nextUrl)}/`);
  }

  let runtime;
  try {
    ({ runtime } = await requireBrandAdmin(brandId));
  } catch {
    return NextResponse.redirect(`${siteBase(request.nextUrl)}/sign-in`);
  }

  const provider = runtime.social.find(channel);
  if (!provider) return back(`Morrowlane cannot publish to ${channel} yet.`);
  if (!provider.configured) return back(`${provider.label} is not set up on this workspace yet.`);
  if (channel === 'bluesky') return back('Bluesky connects with a handle and app password below.');

  try {
    const state = newOAuthState();
    const redirectUri = `${siteBase(request.nextUrl)}/api/connect/${channel}/callback`;
    const start = await provider.connect({ brandId, redirectUri, state });
    await writeOAuthState({ state, brandId, channel, ...(start.codeVerifier ? { codeVerifier: start.codeVerifier } : {}) });
    return NextResponse.redirect(start.authorizationUrl);
  } catch (error) {
    return back(error instanceof Error ? error.message : 'The connection could not be started.');
  }
}
