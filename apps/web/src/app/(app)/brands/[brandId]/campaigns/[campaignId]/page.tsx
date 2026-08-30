import Link from 'next/link';
import { notFound } from 'next/navigation';
import { performanceByContent, summariseFunnel } from '@morrowlane/analytics';
import { addDays } from '@morrowlane/shared';
import { Badge, Button, Card, CardBody, CardHeader, Stat, cn } from '@morrowlane/ui';
import { updateCampaignStatus } from '@/server/actions';
import { requireBrand } from '@/server/session';
import { formatDay, formatDateTime, formatNumber, STATUS_TONES, statusLabel } from '@/lib/format';

/** Alternating tints so adjacent phases read apart on the timeline bar. */
const PHASE_TINTS = ['bg-accent', 'bg-accent/70', 'bg-accent/50', 'bg-accent/70', 'bg-accent/90'];

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ brandId: string; campaignId: string }>;
}) {
  const { brandId, campaignId } = await params;
  const { runtime } = await requireBrand(brandId);
  const store = runtime.store;

  const campaign = await store.getCampaign(campaignId);
  if (!campaign || campaign.brandId !== brandId) notFound();

  const [{ items }, allPosts, events] = await Promise.all([
    store.queryContent({ brandId, campaignId, limit: 300 }),
    store.queryScheduledPosts({ brandId }),
    store.listEvents(brandId),
  ]);

  const contentIds = new Set(items.map((item) => item.id));
  const posts = allPosts.filter((post) => contentIds.has(post.contentId));
  const upcoming = posts.filter((post) => post.status === 'scheduled').slice(0, 6);
  const published = posts.filter((post) => post.status === 'published').length;

  const campaignEvents = events.filter((event) => event.contentId && contentIds.has(event.contentId));
  const totals = summariseFunnel(campaignEvents);
  const performance = performanceByContent(items, posts, campaignEvents)
    .filter((row) => row.totals.impression > 0)
    .sort((a, b) => b.qualifiedVisits - a.qualifiedVisits);

  const byPhase = new Map(campaign.phases.map((phase) => [phase.id, items.filter((item) => item.campaignPhaseId === phase.id)]));

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/brands/${brandId}/campaigns`} className="text-[13px] text-ink-faint hover:text-ink">
          ← Campaigns
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-ink">{campaign.name}</h1>
            <p className="mt-1 text-[13px] text-ink-soft">
              {campaign.goal} · {formatDay(campaign.startDate)} – {formatDay(addDays(campaign.startDate, campaign.durationDays - 1))} ·{' '}
              {campaign.channels.join(', ')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={campaign.status === 'active' ? 'positive' : 'neutral'}>{campaign.status}</Badge>
            {campaign.status === 'active' ? (
              <form action={updateCampaignStatus.bind(null, brandId, campaignId, 'complete')}>
                <Button type="submit" variant="secondary" size="sm">
                  Mark complete
                </Button>
              </form>
            ) : campaign.status !== 'archived' ? (
              <form action={updateCampaignStatus.bind(null, brandId, campaignId, 'archived')}>
                <Button type="submit" variant="ghost" size="sm">
                  Archive
                </Button>
              </form>
            ) : null}
          </div>
        </div>
      </div>

      <Card>
        <CardBody className="py-4">
          <p className="text-[13px] leading-relaxed text-ink-soft">{campaign.narrative}</p>
          {/* The argument over time: each phase's share of the run. */}
          <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full">
            {campaign.phases.map((phase, index) => (
              <div
                key={phase.id}
                className={cn('h-full', PHASE_TINTS[index % PHASE_TINTS.length])}
                style={{ width: `${((phase.endDay - phase.startDay + 1) / campaign.durationDays) * 100}%` }}
                title={phase.title}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-ink-faint">
            <span>Day 1</span>
            <span>Day {campaign.durationDays}</span>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Content pieces" value={String(items.length)} />
        <Stat label="Scheduled" value={String(posts.filter((p) => p.status === 'scheduled').length)} />
        <Stat label="Published" value={String(published)} />
        <Stat label="Qualified visits" value={formatNumber(Math.min(totals.visit, totals.click))} />
      </div>

      <section className="space-y-4">
        {campaign.phases.map((phase, index) => {
          const phaseItems = byPhase.get(phase.id) ?? [];
          return (
            <Card key={phase.id}>
              <CardHeader className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className={cn('h-2.5 w-2.5 rounded-full', PHASE_TINTS[index % PHASE_TINTS.length])} />
                  <h2 className="text-sm font-semibold text-ink">{phase.title}</h2>
                </div>
                <p className="text-[12px] text-ink-faint">
                  Day {phase.startDay + 1}–{phase.endDay + 1} · {phaseItems.length} pieces
                </p>
              </CardHeader>
              <CardBody>
                <p className="text-[13px] text-ink-soft">{phase.narrative}</p>
                {phaseItems.length > 0 ? (
                  <div className="mt-3 divide-y divide-line border-t border-line">
                    {phaseItems.map((item) => (
                      <Link
                        key={item.id}
                        href={`/brands/${brandId}/library/${item.id}`}
                        className="flex items-center justify-between gap-3 py-2.5 hover:bg-surface-sunken"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-ink">{item.title}</p>
                          <p className="text-[12px] text-ink-faint">
                            {statusLabel(item.format)} · {item.channel}
                          </p>
                        </div>
                        <Badge tone={STATUS_TONES[item.status]}>{statusLabel(item.status)}</Badge>
                      </Link>
                    ))}
                  </div>
                ) : null}
              </CardBody>
            </Card>
          );
        })}
      </section>

      {upcoming.length > 0 ? (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-ink">Next to publish</h2>
          </CardHeader>
          <CardBody className="divide-y divide-line p-0">
            {upcoming.map((post) => {
              const item = items.find((candidate) => candidate.id === post.contentId);
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
            })}
          </CardBody>
        </Card>
      ) : null}

      {performance.length > 0 ? (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-ink">What's working in this campaign</h2>
          </CardHeader>
          <CardBody className="divide-y divide-line p-0">
            {performance.slice(0, 5).map((row) => {
              const item = items.find((candidate) => candidate.id === row.contentId);
              return (
                <Link
                  key={row.contentId}
                  href={`/brands/${brandId}/library/${row.contentId}`}
                  className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-sunken"
                >
                  <p className="min-w-0 truncate text-[13px] text-ink">{item?.title ?? row.contentId}</p>
                  <p className="shrink-0 text-[12px] tabular-nums text-ink-soft">
                    {formatNumber(row.qualifiedVisits)} qualified visits
                  </p>
                </Link>
              );
            })}
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
