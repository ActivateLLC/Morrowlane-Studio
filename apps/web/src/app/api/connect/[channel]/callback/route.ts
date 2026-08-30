import { NextResponse, type NextRequest } from 'next/server';
import { isChannel, newId, nowIso } from '@morrowlane/shared';
import { requireBrandAdmin } from '@/server/session';
import { readAndClearOAuthState, siteBase } from '../../oauth-state';

/**
 * The network sends the browser back here. The state cookie proves this callback
 * belongs to a handshake we started for this brand; only then is the code exchanged
 * for tokens and the connection stored (token encrypted at rest by the store).
 */
export async function GET(request: NextRequest, context: { params: Promise<{ channel: string }> }) {
  const { channel } = await context.params;
  const params = request.nextUrl.searchParams;
  const stored = await readAndClearOAuthState();
  const brandId = stored?.brandId ?? '';
  const back = (query: string) =>
    NextResponse.redirect(`${siteBase(request.nextUrl)}/brands/${brandId}/connections?${query}`);

  if (!stored || !brandId) {
    return NextResponse.redirect(`${siteBase(request.nextUrl)}/`);
  }
  if (!isChannel(channel) || stored.channel !== channel || params.get('state') !== stored.state) {
    // A state mismatch means this response is not from the handshake we started.
    return back('connect_error=' + encodeURIComponent('The sign-in could not be verified. Please try again.'));
  }

  const denied = params.get('error');
  if (denied) {
    return back(
      'connect_error=' + encodeURIComponent(params.get('error_description') ?? 'The network declined the connection.'),
    );
  }
  const code = params.get('code');
  if (!code) return back('connect_error=' + encodeURIComponent('The network did not return a sign-in code.'));

  let runtime;
  try {
    ({ runtime } = await requireBrandAdmin(brandId));
  } catch {
    return NextResponse.redirect(`${siteBase(request.nextUrl)}/sign-in`);
  }

  try {
    const provider = runtime.social.get(channel);
    const redirectUri = `${siteBase(request.nextUrl)}/api/connect/${channel}/callback`;
    const account = await provider.exchange({
      code,
      redirectUri,
      ...(stored.codeVerifier ? { codeVerifier: stored.codeVerifier } : {}),
    });

    await runtime.store.saveConnection(
      {
        id: newId('connection'),
        brandId,
        channel,
        displayName: account.displayName,
        externalAccountId: account.externalAccountId,
        status: 'active',
        scopes: account.scopes,
        expiresAt: account.expiresAt,
        lastValidatedAt: nowIso(),
        createdAt: nowIso(),
      },
      { accessToken: account.accessToken, refreshToken: account.refreshToken, metadata: account.metadata },
    );

    return back(`connected=${channel}`);
  } catch (error) {
    return back(
      'connect_error=' + encodeURIComponent(error instanceof Error ? error.message : 'The connection could not be completed.'),
    );
  }
}
