import { buildOpportunities, performanceByContent } from '@morrowlane/analytics';
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Input, PageHeader } from '@morrowlane/ui';
import { actOnOpportunity, addCompetitor, removeCompetitor } from '@/server/actions';
import { requireBrand } from '@/server/session';
import { formatDateTime } from '@/lib/format';

/**
 * Competitor intelligence and Trend Radar. The page's job is "what should we do
 * because of this?" — every recommendation carries its one-click action.
 */
export default async function IntelligencePage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const { runtime } = await requireBrand(brandId);
  const store = runtime.store;

  const [brain, competitors, trends, pages, published, posts, events] = await Promise.all([
    store.getBrain(brandId),
    store.listCompetitors(brandId),
    store.listTrends(brandId),
    store.listPages(brandId),
    store.queryContent({ brandId, status: ['published'], limit: 200 }),
    store.queryScheduledPosts({ brandId }),
    store.listEvents(brandId),
  ]);

  const opportunities = brain
    ? buildOpportunities({
        brain,
        competitors,
        trends,
        ownPages: pages.map((page) => ({ url: page.url, title: page.title, pageType: page.pageType, topics: page.headings.slice(0, 3) })),
        publishedContent: published.items,
        performance: performanceByContent(published.items, posts, events),
      })
    : [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Intelligence"
        description="Morrowlane watches your market and tells you what to do about it — not just what happened."
      />

      {opportunities.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-ink">What should we do?</h2>
          <div className="space-y-3">
            {opportunities.map((opportunity) => (
              <Card key={opportunity.id}>
                <CardBody className="py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge tone="accent">{opportunity.kind.replace(/_/g, ' ')}</Badge>
                        <p className="text-sm font-medium text-ink">{opportunity.headline}</p>
                      </div>
                      <p className="mt-1 text-[13px] text-ink-soft">{opportunity.reasoning}</p>
                      <ul className="mt-2 space-y-0.5 text-[12px] text-ink-faint">
                        {opportunity.evidence.map((line) => (
                          <li key={line}>• {line}</li>
                        ))}
                      </ul>
                    </div>
                    <form action={actOnOpportunity.bind(null, brandId, opportunity.action.kind, opportunity.action.payload)}>
                      <Button type="submit" size="sm">
                        {opportunity.action.label}
                      </Button>
                    </form>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      ) : (
        <EmptyState
          title="No recommendations yet"
          description="Add competitors below. As Morrowlane observes their sites and your performance, recommendations appear here with one-click actions."
        />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-ink">Competitors</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <form action={addCompetitor.bind(null, brandId)} className="flex gap-2">
              <Input name="websiteUrl" placeholder="https://competitor.com" required />
              <Button type="submit" variant="secondary">
                Watch
              </Button>
            </form>
            <div className="space-y-3">
              {competitors.map((competitor) => (
                <div key={competitor.id} className="rounded-lg border border-line p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[13px] font-medium text-ink">{competitor.name}</p>
                      <p className="text-[12px] text-ink-faint">
                        {competitor.websiteUrl}
                        {competitor.lastCheckedAt ? ` · checked ${formatDateTime(competitor.lastCheckedAt)}` : ' · not checked yet'}
                      </p>
                    </div>
                    <form action={removeCompetitor.bind(null, brandId, competitor.id)}>
                      <Button type="submit" variant="ghost" size="sm">
                        Remove
                      </Button>
                    </form>
                  </div>
                  {competitor.signals.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-[12px] text-ink-soft">
                      {competitor.signals.slice(0, 3).map((signal, index) => (
                        <li key={index}>• {signal.summary}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-ink">Trend radar</h2>
            <p className="mt-0.5 text-[12px] text-ink-faint">
              Only trends with real relevance to your brand appear. The rest are filtered before you see them.
            </p>
          </CardHeader>
          <CardBody>
            {trends.length === 0 ? (
              <p className="py-4 text-center text-[13px] text-ink-faint">
                No relevant trends observed yet.
              </p>
            ) : (
              <div className="space-y-3">
                {trends.slice(0, 6).map((trend) => (
                  <div key={trend.id} className="rounded-lg border border-line p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-medium text-ink">{trend.topic}</p>
                      <Badge tone="accent">{Math.round(trend.relevance * 100)}% fit</Badge>
                    </div>
                    <p className="mt-1 text-[12px] text-ink-soft">{trend.summary}</p>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
