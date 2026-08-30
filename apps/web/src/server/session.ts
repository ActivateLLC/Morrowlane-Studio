import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getRuntime, seedDemo, type Runtime } from '@morrowlane/agents';
import { UnauthorizedError, createLogger } from '@morrowlane/shared';

const log = createLogger('web:session');

const DEMO_COOKIE = 'morrowlane_demo_session';

export interface SessionUser {
  id: string;
  email: string;
}

export interface Session {
  user: SessionUser;
  organizationId: string;
  runtime: Runtime;
}

export function supabaseConfigured(): boolean {
  return Boolean(process.env['NEXT_PUBLIC_SUPABASE_URL'] && process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']);
}

/**
 * Reads the signed-in user. With Supabase configured this is Supabase Auth; without it
 * the app issues a local demo session so the whole product is explorable from a clean
 * checkout. The demo path is refused whenever real credentials are present, so it can
 * never become an authentication bypass in a deployed environment.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (supabaseConfigured()) {
    const store = await cookies();
    const client = createServerClient(
      process.env['NEXT_PUBLIC_SUPABASE_URL']!,
      process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
      {
        cookies: {
          getAll: () => store.getAll(),
          setAll: (list: Array<{ name: string; value: string; options?: Record<string, unknown> }>) => {
            for (const { name, value, options } of list) {
              try {
                store.set(name, value, options);
              } catch {
                // Server components cannot set cookies; middleware refreshes the session.
              }
            }
          },
        },
      },
    );
    const { data } = await client.auth.getUser();
    if (!data.user) return null;
    return { id: data.user.id, email: data.user.email ?? '' };
  }

  const store = await cookies();
  const raw = store.get(DEMO_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as SessionUser;
    return parsed.id ? parsed : null;
  } catch {
    return null;
  }
}

export function encodeDemoSession(user: SessionUser): { name: string; value: string } {
  return { name: DEMO_COOKIE, value: Buffer.from(JSON.stringify(user)).toString('base64url') };
}

export const DEMO_COOKIE_NAME = DEMO_COOKIE;

/**
 * The session every server action and route handler starts from. Resolving the
 * organization here means no handler has to remember to scope its queries.
 */
export async function requireSession(): Promise<Session> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();

  const runtime = getRuntime();

  // Claim any workspace invitations addressed to this email before resolving orgs,
  // so an invited teammate lands in the workspace that invited them rather than a
  // brand-new empty one.
  const pending = await runtime.store.listPendingInvitesByEmail(user.email);
  for (const invite of pending) {
    await runtime.store.acceptInvite({ membershipId: invite.id, userId: user.id });
    log.info('accepted workspace invitation', { userId: user.id, organizationId: invite.organizationId });
  }

  const organizations = await runtime.store.listOrganizationsForUser(user.id);

  if (organizations.length === 0) {
    // A first sign-in with no organization gets one, so onboarding never dead-ends.
    const organization = await runtime.store.createOrganization({
      name: user.email.split('@')[0] ?? 'My workspace',
      ownerUserId: user.id,
      ownerEmail: user.email,
    });
    log.info('created first organization', { userId: user.id, organizationId: organization.id });
    return { user, organizationId: organization.id, runtime };
  }

  return { user, organizationId: organizations[0]!.id, runtime };
}

/** Confirms the brand belongs to the caller's organization before anything touches it. */
export async function requireBrand(brandId: string) {
  const session = await requireSession();
  const brand = await session.runtime.store.getBrand(brandId);
  if (!brand || brand.organizationId !== session.organizationId) {
    throw new UnauthorizedError('That brand is not in your workspace.');
  }
  return { ...session, brand };
}

let demoSeeded: Promise<void> | null = null;

/** Seeds the demo workspace once per process, on first use of the demo session. */
export async function ensureDemoSeed(): Promise<{ email: string; userId: string }> {
  const runtime = getRuntime();
  const email = 'demo@morrowlane.local';
  const userId = 'demo-user';

  demoSeeded ??= (async () => {
    const existing = await runtime.store.listOrganizationsForUser(userId);
    if (existing.length > 0) return;
    await seedDemo(runtime, { email, userId });
  })();

  await demoSeeded;
  return { email, userId };
}
