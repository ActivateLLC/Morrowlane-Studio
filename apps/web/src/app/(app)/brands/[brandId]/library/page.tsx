import { CHANNELS, CONTENT_FORMATS, FORMAT_PROFILES } from '@morrowlane/shared';
import { Badge, Button, Card, CardBody, EmptyState, Input, PageHeader, Select } from '@morrowlane/ui';
import Link from 'next/link';
import { requireBrand } from '@/server/session';
import { approveContent, deleteContentItem, scheduleContentItem, updateContentBody } from '@/server/actions';
import { STATUS_TONES, statusLabel } from '@/lib/format';
import { LibraryItem } from './item';

/** Everything generated, reusable, searchable — the content library from the spec. */
export default async function LibraryPage({
  params,
  searchParams,
}: {
  params: Promise<{ brandId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { brandId } = await params;
  const query = await searchParams;
  const { runtime } = await requireBrand(brandId);

  const { items, total } = await runtime.store.queryContent({
    brandId,
    search: query['q'] || undefined,
    channel: query['channel'] || undefined,
    format: query['format'] || undefined,
    status: query['status'] ? [query['status'] as never] : undefined,
    limit: 30,
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Content library" description={`${total} pieces of content, all reusable.`} />

      <form className="grid gap-3 sm:grid-cols-[1fr_170px_170px_150px_auto]">
        <Input name="q" placeholder="Search content…" defaultValue={query['q'] ?? ''} />
        <Select name="format" defaultValue={query['format'] ?? ''}>
          <option value="">All formats</option>
          {CONTENT_FORMATS.map((format) => (
            <option key={format} value={format}>
              {FORMAT_PROFILES[format].label}
            </option>
          ))}
        </Select>
        <Select name="channel" defaultValue={query['channel'] ?? ''}>
          <option value="">All channels</option>
          {CHANNELS.map((channel) => (
            <option key={channel} value={channel}>
              {channel}
            </option>
          ))}
        </Select>
        <Select name="status" defaultValue={query['status'] ?? ''}>
          <option value="">Any status</option>
          {['draft', 'needs_review', 'approved', 'scheduled', 'published'].map((status) => (
            <option key={status} value={status}>
              {statusLabel(status)}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>

      {items.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          description="Generate content in the Studio, remix a URL, or run a campaign — everything lands in this library."
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="relative">
              <Link
                href={`/brands/${brandId}/library/${item.id}`}
                className="absolute right-4 top-4 z-10 text-[12px] font-medium text-accent hover:underline"
              >
                Open
              </Link>
              <LibraryItem
                item={item}
                approve={approveContent.bind(null, brandId, item.id)}
                remove={deleteContentItem.bind(null, brandId, item.id)}
                saveBody={updateContentBody.bind(null, brandId, item.id)}
                schedule={scheduleContentItem.bind(null, brandId, item.id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
