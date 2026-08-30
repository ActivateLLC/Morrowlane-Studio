import Link from 'next/link';
import { buildOpportunities, performanceByContent } from '@morrowlane/analytics';
import { addDays, nowIso } from '@morrowlane/shared';
import { Badge, Button, Card, CardBody, CardHeader, Input, ProgressBar, Stat } from '@morrowlane/ui';
import { actOnOpportunity, deleteBrandAction, retryWithNewAddress } from '@/server/actions';
import { requireBrand } from '@/server/session';
import { formatDateTime, formatNumber, STATUS_TONES, statusLabel } from '@/lib/format';
import { AutoRefresh } from '@/components/auto-refresh';
import { SubmitButton } from '@/components/submit-button';

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
                <p className="font-medium text-ink">Morrowlane couldn&apos;t read that website</p>
                <p className="mt-1 text-sm text-ink-soft">{brand.statusDetail}</p>
                {/* A failed crawl used to be a dead end: the only offer was re-running the
                    identical crawl. Now: fix the address, switch to questions, or delete. */}
                <form action={retryWithNewAddress.bind(null, brandId)} className="mx-auto mt-5 flex max-w-sm flex-col gap-2 sm:flex-row">
                  <Input name="websiteUrl" defaultValue={brand.websiteUrl} aria-label="Website address" required />
                  <SubmitButton pendingLabel="Reading…" className="shrink-0">
                    Try this address
                  </SubmitButton>
                </form>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-[13px]">
                  <Link href="/new" className="font-medium text-accent-strong hover:underline">
                    Answer a few questions instead →
                  </Link>
                  <form action={deleteBrandAction.bind(null, brandId)}>
                    <Button type="submit" variant="ghost" size="sm">
                      Delete this brand
                    </Button>
                  </form>
                </div>
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
                <AutoRefresh intervalMs={3000} label="Reading your website…" />
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
        <h1 className="mb-4 text-xl font-semibold tracking-tight text-ink">What do you want to do?</h1>
        {/* Intent-based, not object-based: the door names the goal; behind it, the real
            power page does the work. */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link href={`/brands/${brandId}/studio`}>
            <Card className="h-full transition-shadow hover:shadow-lifted">
              <CardBody className="py-5">
                <p className="font-medium text-ink">Create content</p>
                <p className="mt-1 text-[13px] text-ink-soft">Posts, threads, emails and more from your brand.</p>
              </CardBody>
            </Card>
          </Link>
          <Link href={`/brands/${brandId}/remix`}>
            <Card className="h-full transition-shadow hover:shadow-lifted">
              <CardBody className="py-5">
                <p className="font-medium text-ink">Promote something</p>
                <p className="mt-1 text-[13px] text-ink-soft">Turn a product, page or link into content everywhere.</p>
              </CardBody>
            </Card>
          </Link>
          <Link href={`/brands/${brandId}/plan`}>
            <Card className="h-full border-accent/40 transition-shadow hover:shadow-lifted">
              <CardBody className="py-5">
                <p className="font-medium text-ink">Get more customers</p>
                <p className="mt-1 text-[13px] text-ink-soft">Pick a goal; get one campaign plan to approve.</p>
              </CardBody>
            </Card>
          </Link>
          <Link href={`/brands/${brandId}/fill`}>
            <Card className="h-full transition-shadow hover:shadow-lifted">
              <CardBody className="py-5">
                <p className="font-medium text-ink">Fill my month</p>
                <p className="mt-1 text-[13px] text-ink-soft">A balanced month of content, scheduled for you.</p>
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
            <Link href={`/brands/${brandId}/calendar`} className="text-[13px] text-accent-strong hover:underline">
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
            <Link href={`/brands/${brandId}/library`} className="text-[13px] text-accent-strong hover:underline">
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
              <Link href={`/brands/${brandId}/analytics`} className="text-[13px] text-accent-strong hover:underline">
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
