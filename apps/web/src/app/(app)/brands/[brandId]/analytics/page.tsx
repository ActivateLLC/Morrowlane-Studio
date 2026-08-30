import { performanceByContent, summariseFunnel } from '@morrowlane/analytics';
import { CHANNELS } from '@morrowlane/shared';
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, PageHeader, Stat } from '@morrowlane/ui';
import { applyInsight, recomputeInsights, unapplyInsight } from '@/server/actions';
import { requireBrand } from '@/server/session';
import { formatNumber, statusLabel } from '@/lib/format';
import { ChannelBars, FunnelChart } from '@/components/charts';

/**
 * The funnel from the spec: Content → Engagement → Visit → Lead → Customer → Revenue.
 * No vanity-metric wall — the page leads with insights you can apply.
 */
export default async function AnalyticsPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const { runtime } = await requireBrand(brandId);
  const store = runtime.store;

  const [content, posts, events, insights] = await Promise.all([
    store.queryContent({ brandId, limit: 500 }),
    store.queryScheduledPosts({ brandId }),
    store.listEvents(brandId),
    store.listInsights(brandId),
  ]);

  const totals = summariseFunnel(events);
  const performance = performanceByContent(content.items, posts, events)
    .filter((row) => row.totals.impression > 0)
    .sort((a, b) => b.qualifiedVisits - a.qualifiedVisits);
  const contentById = new Map(content.items.map((item) => [item.id, item]));

  if (events.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Analytics" description="Content → Engagement → Visit → Lead → Customer → Revenue." />
        <EmptyState
          title="No performance data yet"
          description="Once posts publish and metrics come back, the attribution graph fills in and Morrowlane starts learning what works."
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Analytics"
        description="The goal is not charts. It is learning what produces business outcomes."
        action={
          <form action={recomputeInsights.bind(null, brandId)}>
            <Button type="submit" variant="secondary">
              Recompute insights
            </Button>
          </form>
        }
      />

      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink">Insights</h2>
        {insights.length === 0 ? (
          <p className="text-[13px] text-ink-faint">
            Not enough measured content yet for a comparison Morrowlane would stand behind.
          </p>
        ) : (
          <div className="space-y-3">
            {insights.map((insight) => (
              <Card key={insight.id}>
                <CardBody className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div>
                    <p className="text-sm font-medium text-ink">{insight.statement}</p>
                    <p className="mt-0.5 text-[12px] text-ink-faint">
                      {insight.sampleSize} posts measured · confidence {Math.round(insight.confidence * 100)}%
                    </p>
                  </div>
                  {insight.applied ? (
                    <form action={unapplyInsight.bind(null, brandId, insight.id)}>
                      <span className="flex items-center gap-2">
                        <Badge tone="positive">applied to future content</Badge>
                        <Button type="submit" variant="ghost" size="sm">
                          Undo
                        </Button>
                      </span>
                    </form>
                  ) : (
                    <form action={applyInsight.bind(null, brandId, insight.id)}>
                      <Button type="submit" size="sm">
                        Apply insight
                      </Button>
                    </form>
                  )}
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Impressions" value={formatNumber(totals.impression)} />
        <Stat label="Qualified visits" value={formatNumber(Math.min(totals.visit, totals.click))} />
        <Stat label="Leads" value={formatNumber(totals.lead)} />
        {/* Revenue is currency, not a count — it never shares the funnel's axis. */}
        <Stat label="Revenue" value={`$${formatNumber(totals.revenue)}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-ink">The funnel</h2>
            <p className="mt-0.5 text-[12px] text-ink-faint">Each stage as a share of the one before it.</p>
          </CardHeader>
          <CardBody>
            <FunnelChart
              stages={[
                { label: 'Impressions', value: totals.impression },
                { label: 'Engagements', value: totals.engagement },
                { label: 'Clicks', value: totals.click },
                { label: 'Visits', value: totals.visit },
                { label: 'Leads', value: totals.lead },
                { label: 'Customers', value: totals.customer },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-ink">Qualified visits by channel</h2>
            <p className="mt-0.5 text-[12px] text-ink-faint">Where the traffic that converts comes from.</p>
          </CardHeader>
          <CardBody>
            <ChannelBars
              unit="qualified visits"
              data={CHANNELS.map((channel) => ({
                label: channel.replace('_', ' '),
                value: performance
                  .filter((row) => row.channel === channel)
                  .reduce((sum, row) => sum + row.qualifiedVisits, 0),
              })).filter((datum) => datum.value > 0)}
            />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-ink">Content by qualified traffic</h2>
        </CardHeader>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-line text-[12px] text-ink-faint">
                  <th className="px-5 py-2.5 font-medium">Content</th>
                  <th className="px-3 py-2.5 font-medium">Format</th>
                  <th className="px-3 py-2.5 text-right font-medium">Impressions</th>
                  <th className="px-3 py-2.5 text-right font-medium">Qualified visits</th>
                  <th className="px-3 py-2.5 text-right font-medium">Leads</th>
                  <th className="px-5 py-2.5 text-right font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {performance.slice(0, 12).map((row) => (
                  <tr key={row.contentId}>
                    <td className="max-w-[280px] truncate px-5 py-2.5 text-ink">
                      {contentById.get(row.contentId)?.title ?? row.contentId}
                    </td>
                    <td className="px-3 py-2.5 text-ink-soft">{statusLabel(row.format)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">{formatNumber(row.totals.impression)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink">{formatNumber(row.qualifiedVisits)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">{formatNumber(row.totals.lead)}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-ink-soft">${formatNumber(row.totals.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
