import Link from 'next/link';
import { Alert, Badge, Button, Card, CardBody, PageHeader } from '@morrowlane/ui';
import { connectBluesky, connectDemoAccount, disconnectAccount } from '@/server/actions';
import { BlueskyConnectForm } from './bluesky-form';
import { requireBrand } from '@/server/session';
import { formatDateTime } from '@/lib/format';

/** Milestone 7: centralized OAuth connections behind the provider abstraction. */
export default async function ConnectionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ brandId: string }>;
  searchParams: Promise<{ connected?: string; connect_error?: string }>;
}) {
  const { brandId } = await params;
  const { connected: justConnected, connect_error: connectError } = await searchParams;
  const { runtime } = await requireBrand(brandId);
  // Real OAuth is not wired yet, so the page must say what it actually does.
  const demoMode = runtime.demoMode;

  const connections = await runtime.store.listConnections(brandId);
  const connectedChannels = new Set(connections.map((connection) => connection.channel));
  const providers = runtime.social.list();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Social connections"
        description="The accounts Morrowlane publishes to. Access tokens are encrypted at rest and never shown."
      />

      {justConnected ? <Alert tone="positive" title={`${justConnected} is connected. Scheduled posts will publish to it.`} /> : null}
      {connectError ? <Alert tone="critical" title={connectError} /> : null}

      {demoMode ? (
        <Card className="border-caution/40 bg-caution-soft/40">
          <CardBody className="py-3">
            <p className="text-[13px] text-ink">
              <span className="font-medium">These are sample connections.</span> Connecting a real account opens that
              network&apos;s own sign-in, which isn&apos;t switched on in this workspace yet — so Connect below adds a
              stand-in account you can schedule and publish against to see the whole flow.
            </p>
          </CardBody>
        </Card>
      ) : null}

      {connections.length > 0 ? (
        <Card>
          <CardBody className="divide-y divide-line p-0">
            {connections.map((connection) => (
              <div key={connection.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p className="text-[13px] font-medium text-ink">{connection.displayName}</p>
                  <p className="text-[12px] text-ink-faint">
                    {connection.channel}
                    {connection.lastValidatedAt ? ` · validated ${formatDateTime(connection.lastValidatedAt)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={connection.status === 'active' ? 'positive' : 'critical'}>{connection.status}</Badge>
                  <form action={disconnectAccount.bind(null, brandId, connection.id)}>
                    <Button type="submit" variant="ghost" size="sm">
                      Disconnect
                    </Button>
                  </form>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink">Available networks</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map((provider) => {
            const connected = connectedChannels.has(provider.channel);
            return (
              <Card key={provider.channel}>
                <CardBody className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div>
                    <p className="text-[13px] font-medium text-ink">{provider.label}</p>
                    <p className="text-[12px] text-ink-faint">
                      {demoMode
                        ? 'Adds a sample account'
                        : provider.channel === 'bluesky'
                          ? 'Connects with a handle and app password'
                          : provider.configured
                            ? 'Opens the network\u2019s own sign-in'
                            : 'Not set up on this workspace yet'}
                    </p>
                  </div>
                  {connected ? (
                    <Badge tone="positive">connected</Badge>
                  ) : demoMode ? (
                    <form action={connectDemoAccount.bind(null, brandId, provider.channel)}>
                      <Button type="submit" variant="secondary" size="sm">
                        Add sample
                      </Button>
                    </form>
                  ) : provider.channel === 'bluesky' ? (
                    <BlueskyConnectForm connect={connectBluesky.bind(null, brandId)} />
                  ) : provider.configured ? (
                    <Link href={`/api/connect/${provider.channel}?brandId=${brandId}`}>
                      <Button variant="secondary" size="sm">
                        Connect
                      </Button>
                    </Link>
                  ) : (
                    <Button variant="secondary" size="sm" disabled>
                      Not available yet
                    </Button>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
        <p className="mt-3 text-[12px] text-ink-faint">
          Morrowlane speaks each network&apos;s own publishing API and stores only an encrypted access token — never
          your password. You can disconnect at any time.
        </p>
      </section>
    </div>
  );
}
