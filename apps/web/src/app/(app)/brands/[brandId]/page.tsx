import Link from 'next/link';
import { buildOpportunities, performanceByContent } from '@morrowlane/analytics';
import { addDays, nowIso } from '@morrowlane/shared';
import { Badge, Button, Card, CardBody, CardHeader, ProgressBar, Stat } from '@morrowlane/ui';
import { actOnOpportunity, reanalyzeBrand } from '@/server/actions';
import { requireBrand } from '@/server/session';
import { formatDateTime, formatNumber, STATUS_TONES, statusLabel } from '@/lib/format';

/**
 * The brand home. It opens with creation — the three doors from the spec — and only
 * below that shows what is coming up, what happened, and what Morrowlane recommends.
 */
export default async function BrandTodayPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const { runtime, brand } = await requireBrand(brandId);
  const store = runtime.store;

  const brain = await store.getBrain(brandId);

  if (!brain || brand.status === 'crawling' || brand.status === 'analyzing') {
    const jobs = await store.listJobs(brandId, { status: ['running', 'queued'], limit: 1 });
    const running = jobs[0];
    return (
      <div className="mx-auto max-w-xl pt-10">
        <Card>
          <CardBody className="py-8 text-center">
            {brand.status === 'failed' ? (
              <>
                <p className="font-medium text-ink">The analysis could not finish</p>
                <p className="mt-1 text-sm text-ink-soft">{brand.statusDetail}</p>
                <form action={reanalyzeBrand.bind(null, brandId)} className="mt-4">
                  <Button type="submit">Try again</Button>
                </form>
              </>
            ) : (
              <>
                <p className="font-medium text-ink">Morrowlane is reading {brand.websiteUrl}</p>
                <p className="mt-1 text-sm text-ink-soft">
                  Discovering the sitemap, reading every page that matters, and building the brand profile.
                </p>
                <div className="mx-auto mt-5 max-w-sm">
                  <ProgressBar value={running?.progress ?? 0.05} label={running?.progressLabel ?? 'Starting'} />
                </div>
                <meta httpEquiv="refresh" content="3" />
              </>
            )}
          </CardBody>
        </Card>
      </div>
    );
  }

  const [upcoming, recent, insights, competitors, trends, pages, publishedQuery, posts, events] = await Promise.all([
    store.queryScheduledPosts({ brandId, status: ['scheduled'], from: nowIso(), to: addDays(nowIso(), 7) }),
    store.queryContent({ brandId, limit: 5 }),
    store.listInsights(brandId),
    store.listCompetitors(brandId),
    store.listTrends(brandId),
    store.listPages(brandId),
    store.queryContent({ brandId, status: ['published'], limit: 200 }),
    store.queryScheduledPosts({ brandId }),
    store.listEvents(brandId),
  ]);

  const performance = performanceByContent(publishedQuery.items, posts, events);
  const opportunities = buildOpportunities({
    brain,
    competitors,
    trends,
    ownPages: pages.map((page) => ({ url: page.url, title: page.title, pageType: page.pageType, topics: page.headings.slice(0, 3) })),
    publishedContent: publishedQuery.items,
    performance,
  });

  const contentById = new Map((await store.queryContent({ brandId, limit: 500 })).items.map((item) => [item.id, item]));

  return (
    <div className="space-y-8">
      <section>
        <h1 className="mb-4 text-xl font-semibold tracking-tight text-ink">What are we marketing today?</h1>
        <div className="grid gap-4 md:grid-cols-3">
          <Link href={`/brands/${brandId}/studio`}>
            <Card className="h-full transition-shadow hover:shadow-lifted">
              <CardBody className="py-5">
                <p className="font-medium text-ink">Generate content</p>
                <p className="mt-1 text-[13px] text-ink-soft">Create content from your entire brand.</p>
              </CardBody>
            </Card>
          </Link>
          <Link href={`/brands/${brandId}/campaigns`}>
            <Card className="h-full transition-shadow hover:shadow-lifted">
              <CardBody className="py-5">
                <p className="font-medium text-ink">Run a campaign</p>
                <p className="mt-1 text-[13px] text-ink-soft">Turn a business objective into a coordinated campaign.</p>
              </CardBody>
            </Card>
          </Link>
          <Link href={`/brands/${brandId}/remix`}>
            <Card className="h-full transition-shadow hover:shadow-lifted">
              <CardBody className="py-5">
                <p className="font-medium text-ink">Promote a URL</p>
                <p className="mt-1 text-[13px] text-ink-soft">Turn one webpage into content everywhere.</p>
              </CardBody>
            </Card>
          </Link>
        </div>
      </section>

      {opportunities.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-ink">Brand opportunities</h2>
          <div className="space-y-3">
            {opportunities.slice(0, 3).map((opportunity) => (
              <Card key={opportunity.id}>
                <CardBody className="py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{opportunity.headline}</p>
                      <p className="mt-0.5 text-[13px] text-ink-soft">{opportunity.reasoning}</p>
                      <ul className="mt-2 space-y-0.5 break-words text-[12px] text-ink-faint">
                        {opportunity.evidence.slice(0, 3).map((line) => (
                          <li key={line}>• {line}</li>
                        ))}
                      </ul>
                    </div>
                    <form action={actOnOpportunity.bind(null, brandId, opportunity.action.kind, opportunity.action.payload)}>
                      <Button type="submit" variant="secondary" size="sm">
                        {opportunity.action.label}
                      </Button>
                    </form>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Upcoming posts</h2>
            <Link href={`/brands/${brandId}/calendar`} className="text-[13px] text-accent hover:underline">
              Open calendar
            </Link>
          </div>
          <Card>
            <CardBody className="divide-y divide-line p-0">
              {upcoming.length === 0 ? (
                <p className="px-5 py-6 text-center text-[13px] text-ink-faint">Nothing scheduled this week.</p>
              ) : (
                upcoming.slice(0, 6).map((post) => {
                  const item = contentById.get(post.contentId);
                  return (
                    <div key={post.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-ink">{item?.title ?? post.contentId}</p>
                        <p className="text-[12px] text-ink-faint">
                          {formatDateTime(post.scheduledFor)} · {post.channel}
                        </p>
                      </div>
                      <Badge tone={STATUS_TONES[post.status]}>{statusLabel(post.status)}</Badge>
                    </div>
                  );
                })
              )}
            </CardBody>
          </Card>
        </section>

        <section className="min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Recent content</h2>
            <Link href={`/brands/${brandId}/library`} className="text-[13px] text-accent hover:underline">
              Open library
            </Link>
          </div>
          <Card>
            <CardBody className="divide-y divide-line p-0">
              {recent.items.length === 0 ? (
                <p className="px-5 py-6 text-center text-[13px] text-ink-faint">Nothing generated yet.</p>
              ) : (
                recent.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-ink">{item.title}</p>
                      <p className="text-[12px] text-ink-faint">{statusLabel(item.format)} · {item.channel}</p>
                    </div>
                    <Badge tone={STATUS_TONES[item.status]}>{statusLabel(item.status)}</Badge>
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </section>
      </div>

      {insights.length > 0 ? (
        <section>
          <Card>
            <CardHeader className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Performance insights</h2>
              <Link href={`/brands/${brandId}/analytics`} className="text-[13px] text-accent hover:underline">
                See analytics
              </Link>
            </CardHeader>
            <CardBody>
              <div className="grid gap-4 sm:grid-cols-3">
                <Stat
                  label="Impressions"
                  value={formatNumber(performance.reduce((sum, row) => sum + row.totals.impression, 0))}
                />
                <Stat
                  label="Qualified visits"
                  value={formatNumber(performance.reduce((sum, row) => sum + row.qualifiedVisits, 0))}
                />
                <Stat label="Leads" value={formatNumber(performance.reduce((sum, row) => sum + row.totals.lead, 0))} />
              </div>
              <p className="mt-4 rounded-lg bg-accent-soft px-4 py-3 text-[13px] text-accent-strong">
                {insights[0]!.statement}
              </p>
            </CardBody>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
