import { Badge, Button, Card, CardBody, PageHeader } from '@morrowlane/ui';
import { connectDemoAccount, disconnectAccount } from '@/server/actions';
import { requireBrand } from '@/server/session';
import { formatDateTime } from '@/lib/format';

/** Milestone 7: centralized OAuth connections behind the provider abstraction. */
export default async function ConnectionsPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const { runtime } = await requireBrand(brandId);

  const connections = await runtime.store.listConnections(brandId);
  const connectedChannels = new Set(connections.map((connection) => connection.channel));
  const providers = runtime.social.list();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Social connections"
        description="Connect the accounts Morrowlane publishes to. Tokens are encrypted and never shown."
      />

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
                <CardBody className="flex items-center justify-between py-4">
                  <div>
                    <p className="text-[13px] font-medium text-ink">{provider.label}</p>
                    <p className="text-[12px] text-ink-faint">
                      {provider.configured
                        ? provider.capabilities.requiresMedia
                          ? 'Requires rendered media'
                          : 'Ready to connect'
                        : 'Not available on this plan yet'}
                    </p>
                  </div>
                  {connected ? (
                    <Badge tone="positive">connected</Badge>
                  ) : (
                    <form action={connectDemoAccount.bind(null, brandId, provider.channel)}>
                      <Button type="submit" variant="secondary" size="sm" disabled={!provider.configured}>
                        Connect
                      </Button>
                    </form>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
        <p className="mt-3 text-[12px] text-ink-faint">
          Connecting an account opens that network's own sign-in, so your password is never shared with
          Morrowlane. You can disconnect at any time.
        </p>
      </section>
    </div>
  );
}
