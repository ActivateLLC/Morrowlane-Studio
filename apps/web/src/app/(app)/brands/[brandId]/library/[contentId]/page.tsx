import Link from 'next/link';
import { notFound } from 'next/navigation';
import { summariseFunnel } from '@morrowlane/analytics';
import { Badge, Button, Card, CardBody, CardHeader, Stat } from '@morrowlane/ui';
import { formatProfile } from '@morrowlane/shared';
import {
  approveContent,
  deleteContentItem,
  duplicateContent,
  generateVariants,
  renderMedia,
  scheduleContentItem,
  updateContentBody,
} from '@/server/actions';
import { requireBrand } from '@/server/session';
import { formatDateTime, formatNumber, STATUS_TONES, statusLabel } from '@/lib/format';
import { LibraryItem } from '../item';

/**
 * One piece of content, end to end: the editable item itself, and the spec's
 * lineage chain made visible — source → instruction → creative → posts →
 * performance — plus its family of copies and variants.
 */
export default async function ContentDetailPage({
  params,
}: {
  params: Promise<{ brandId: string; contentId: string }>;
}) {
  const { brandId, contentId } = await params;
  const { runtime } = await requireBrand(brandId);
  const store = runtime.store;

  const item = await store.getContent(contentId);
  if (!item || item.brandId !== brandId) notFound();

  const [posts, events, campaign, parent, siblings] = await Promise.all([
    store.queryScheduledPosts({ brandId }),
    store.listEvents(brandId),
    item.campaignId ? store.getCampaign(item.campaignId) : Promise.resolve(null),
    item.lineage.parentContentId ? store.getContent(item.lineage.parentContentId) : Promise.resolve(null),
    store.queryContent({ brandId, limit: 500 }),
  ]);

  const itemPosts = posts.filter((post) => post.contentId === item.id);
  const media = (await store.listMedia(brandId)).filter((asset) => item.mediaAssetIds.includes(asset.id));
  const isVisualFormat = formatProfile(item.format).medium === 'image';
  const totals = summariseFunnel(events.filter((event) => event.contentId === item.id));
  const variants = siblings.items.filter((candidate) => candidate.lineage.parentContentId === item.id);

  const trail: Array<{ label: string; body: React.ReactNode }> = [
    {
      label: 'Source',
      body: item.lineage.sourceUrl ? (
        <a href={item.lineage.sourceUrl} target="_blank" rel="noreferrer" className="break-words text-accent hover:underline">
          {item.lineage.sourceUrl}
        </a>
      ) : (
        <span className="capitalize">{item.lineage.sourceType.replace(/_/g, ' ')} knowledge</span>
      ),
    },
    ...(item.lineage.instruction
      ? [{ label: 'Instruction', body: <span className="italic">“{item.lineage.instruction}”</span> }]
      : []),
    ...(parent
      ? [
          {
            label: 'Variant of',
            body: (
              <Link href={`/brands/${brandId}/library/${parent.id}`} className="text-accent hover:underline">
                {parent.title}
              </Link>
            ),
          },
        ]
      : []),
    ...(campaign
      ? [
          {
            label: 'Campaign',
            body: (
              <Link href={`/brands/${brandId}/campaigns/${campaign.id}`} className="text-accent hover:underline">
                {campaign.name}
              </Link>
            ),
          },
        ]
      : []),
    ...(item.lineage.appliedInsightIds.length > 0
      ? [{ label: 'Shaped by', body: <span>{item.lineage.appliedInsightIds.length} applied insight(s)</span> }]
      : []),
    {
      label: 'Posts',
      body:
        itemPosts.length === 0 ? (
          <span className="text-ink-faint">Not scheduled yet.</span>
        ) : (
          <span className="space-y-1">
            {itemPosts.map((post) => (
              <span key={post.id} className="flex flex-wrap items-center gap-2">
                <Badge tone={STATUS_TONES[post.status]}>{statusLabel(post.status)}</Badge>
                <span className="text-ink-soft">
                  {formatDateTime(post.scheduledFor)} · {post.channel}
                </span>
                {post.externalUrl ? (
                  <a href={post.externalUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                    view live
                  </a>
                ) : null}
                {post.lastError ? <span className="text-critical">{post.lastError}</span> : null}
              </span>
            ))}
          </span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/brands/${brandId}/library`} className="text-[13px] text-ink-faint hover:text-ink">
          ← Library
        </Link>
        <div className="flex flex-wrap gap-2">
          {isVisualFormat ? (
            <form action={renderMedia.bind(null, brandId, contentId)}>
              <Button type="submit" size="sm">
                {media.length > 0 ? 'Re-render graphics' : 'Render graphics'}
              </Button>
            </form>
          ) : null}
          <form action={generateVariants.bind(null, brandId, contentId)}>
            <Button type="submit" variant="secondary" size="sm">
              Generate 3 variants
            </Button>
          </form>
          <form action={duplicateContent.bind(null, brandId, contentId)}>
            <Button type="submit" variant="ghost" size="sm">
              Duplicate
            </Button>
          </form>
        </div>
      </div>

      <LibraryItem
        item={item}
        approve={approveContent.bind(null, brandId, item.id)}
        remove={deleteContentItem.bind(null, brandId, item.id)}
        saveBody={updateContentBody.bind(null, brandId, item.id)}
        schedule={scheduleContentItem.bind(null, brandId, item.id)}
        defaultOpen
      />

      {media.length > 0 ? (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Creatives</h2>
            <p className="text-[12px] text-ink-faint">
              rendered by {media[0]!.renderer === 'svg' ? 'the branded composer' : media[0]!.renderer}
            </p>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {media.map((asset, index) => (
                <a key={asset.id} href={asset.url} target="_blank" rel="noreferrer" className="group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset.url}
                    alt={`Creative ${index + 1}`}
                    className="aspect-[4/5] w-full rounded-lg border border-line object-cover transition-shadow group-hover:shadow-lifted"
                  />
                </a>
              ))}
            </div>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-ink">Lineage</h2>
            <p className="mt-0.5 text-[12px] text-ink-faint">Where this came from and where it went.</p>
          </CardHeader>
          <CardBody>
            <ol className="relative space-y-4 border-l border-line pl-4">
              {trail.map((step) => (
                <li key={step.label} className="relative">
                  <span className="absolute -left-[1.3rem] top-1 h-2 w-2 rounded-full bg-accent" />
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{step.label}</p>
                  <div className="mt-0.5 text-[13px] text-ink">{step.body}</div>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-ink">Performance</h2>
          </CardHeader>
          <CardBody>
            {totals.impression === 0 ? (
              <p className="py-4 text-center text-[13px] text-ink-faint">
                No performance yet — it lands here after this publishes and metrics come back.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Stat label="Impressions" value={formatNumber(totals.impression)} />
                <Stat label="Engagements" value={formatNumber(totals.engagement)} />
                <Stat label="Clicks" value={formatNumber(totals.click)} />
                <Stat label="Visits" value={formatNumber(totals.visit)} />
                <Stat label="Leads" value={formatNumber(totals.lead)} />
                <Stat label="Revenue" value={`$${formatNumber(totals.revenue)}`} />
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {variants.length > 0 ? (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-ink">Variants and copies of this piece</h2>
          </CardHeader>
          <CardBody className="divide-y divide-line p-0">
            {variants.map((variant) => (
              <Link
                key={variant.id}
                href={`/brands/${brandId}/library/${variant.id}`}
                className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-sunken"
              >
                <p className="min-w-0 truncate text-[13px] text-ink">{variant.title}</p>
                <Badge tone={STATUS_TONES[variant.status]}>{statusLabel(variant.status)}</Badge>
              </Link>
            ))}
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
