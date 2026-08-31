import Link from 'next/link';
import { addDays, nowIso } from '@morrowlane/shared';
import { Alert, Button, Card, CardBody, Stat } from '@morrowlane/ui';
import { requireBrand } from '@/server/session';
import { channelLabel } from '@/lib/format';
import { LocalTime } from '@/components/local-time';

/**
 * The golden-path completion screen — the "your month is ready" moment. It summarises the
 * real objects that were just created and hands the user into the power pages that manage
 * them (Review campaign → Campaigns, View calendar → Calendar). Nothing new is created
 * here; it's a hand-off, so the two UX layers stay over one system.
 */
export default async function ReadyPage({
  params,
  searchParams,
}: {
  params: Promise<{ brandId: string }>;
  searchParams: Promise<{ campaign?: string; fill?: string }>;
}) {
  const { brandId } = await params;
  const { campaign: campaignId } = await searchParams;
  const { runtime } = await requireBrand(brandId);
  const base = `/brands/${brandId}`;

  let title = 'Your content is ready';
  let pieces = 0;
  let platforms = 0;
  let days = 0;
  let reviewHref: string | null = null;

  if (campaignId) {
    const campaign = await runtime.store.getCampaign(campaignId);
    const [{ items }, posts] = await Promise.all([
      runtime.store.queryContent({ brandId, campaignId, limit: 500 }),
      runtime.store.queryScheduledPosts({ brandId }),
    ]);
    const contentIds = new Set(items.map((i) => i.id));
    const campaignPosts = posts.filter((p) => contentIds.has(p.contentId));
    title = campaign ? `${campaign.name} is scheduled` : 'Your campaign is scheduled';
    pieces = items.length;
    platforms = new Set(campaignPosts.map((p) => p.channel)).size;
    days = new Set(campaignPosts.map((p) => p.scheduledFor.slice(0, 10))).size || (campaign?.durationDays ?? 0);
    reviewHref = `${base}/campaigns/${campaignId}`;
  } else {
    // Fill My Month: everything scheduled across the next ~5 weeks.
    const posts = await runtime.store.queryScheduledPosts({
      brandId,
      status: ['scheduled'],
      from: nowIso(),
      to: addDays(nowIso(), 35),
    });
    title = 'Your month is ready';
    pieces = new Set(posts.map((p) => p.contentId)).size;
    platforms = new Set(posts.map((p) => p.channel)).size;
    days = new Set(posts.map((p) => p.scheduledFor.slice(0, 10))).size;
  }

  // The completion screen is the natural moment to say whether any of this can actually
  // go out. For a brand-new user nothing is connected, and staying silent here means
  // their month sits unpublishable forever.
  const connections = await runtime.store.listConnections(brandId);
  const activeConnections = connections.filter((connection) => connection.status === 'active');
  const nextPosts = await runtime.store.queryScheduledPosts({
    brandId,
    status: ['scheduled'],
    from: nowIso(),
    to: addDays(nowIso(), 35),
  });
  const upcoming = [...nextPosts]
    .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))
    .slice(0, 4);
  const upcomingTitles = new Map(
    (await runtime.store.queryContent({ brandId, limit: 500 })).items.map((item) => [item.id, item.title]),
  );

  // Nothing was scheduled: congratulating the user here would simply be untrue.
  if (pieces === 0) {
    return (
      <div className="mx-auto max-w-lg pt-10">
        <Card>
          <CardBody className="py-8 text-center">
            <h1 className="text-xl font-semibold tracking-tight text-ink">Nothing on your calendar yet</h1>
            <p className="mt-1 text-[13px] text-ink-soft">
              Once you create something it shows up here, ready to schedule.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link href={`${base}/studio`}>
                <Button>Make your first post</Button>
              </Link>
              <Link href={`${base}/plan`}>
                <Button variant="secondary">Plan a campaign</Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 pt-10">
      <Card>
        <CardBody className="py-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
          <p className="mt-1 text-[13px] text-ink-soft">Everything is created and on your calendar. Here&apos;s the shape of it.</p>

          <div className="mx-auto mt-6 grid max-w-sm grid-cols-3 gap-3">
            <Stat label="Pieces" value={String(pieces)} />
            <Stat label={platforms === 1 ? 'Platform' : 'Platforms'} value={String(platforms)} />
            <Stat label="Publishing days" value={String(days)} />
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            {reviewHref ? (
              <Link href={reviewHref}>
                <Button variant="secondary">Review campaign</Button>
              </Link>
            ) : (
              <Link href={`${base}/library`}>
                <Button variant="secondary">View library</Button>
              </Link>
            )}
            <Link href={`${base}/calendar`}>
              <Button>View calendar</Button>
            </Link>
          </div>
        </CardBody>
      </Card>

      {activeConnections.length === 0 ? (
        <Alert tone="caution" title="Nothing is connected to publish these yet">
          <p>
            These posts are on your calendar, but Morrowlane has no account to send them from. Connecting one takes
            about two minutes and they go out on schedule.
          </p>
          <div className="mt-3">
            <Link href={`${base}/connections`}>
              <Button size="sm" variant="secondary">
                Connect an account
              </Button>
            </Link>
          </div>
        </Alert>
      ) : null}

      {upcoming.length > 0 ? (
        <Card>
          <CardBody className="p-0">
            <p className="px-5 pt-4 text-sm font-semibold text-ink">What happens next</p>
            <ul className="mt-2 divide-y divide-line">
              {upcoming.map((post) => (
                <li key={post.id} className="px-5 py-3">
                  <p className="truncate text-[13px] font-medium text-ink">
                    {upcomingTitles.get(post.contentId) ?? 'Scheduled post'}
                  </p>
                  <p className="text-[12px] text-ink-faint">
                    <LocalTime iso={post.scheduledFor} showZone /> · {channelLabel(post.channel)}
                  </p>
                </li>
              ))}
            </ul>
            <p className="px-5 py-3 text-[12px] text-ink-soft">
              Morrowlane watches how these perform and puts new opportunities on{' '}
              <Link href={base} className="font-medium text-accent-strong hover:underline">
                Today
              </Link>
              .
            </p>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
