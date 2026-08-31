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

  // A library capped at 30 with no way forward hid everything a working brand makes
  // in its first fortnight. ContentQuery already supported offset in both stores.
  const pageSize = 30;
  const pageNumber = Math.max(1, Number(query['page'] ?? 1) || 1);
  const { items, total } = await runtime.store.queryContent({
    brandId,
    search: query['q'] || undefined,
    channel: query['channel'] || undefined,
    format: query['format'] || undefined,
    status: query['status'] ? [query['status'] as never] : undefined,
    limit: pageSize,
    offset: (pageNumber - 1) * pageSize,
  });

  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const pageHref = (target: number) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value && key !== 'page') next.set(key, value);
    }
    if (target > 1) next.set('page', String(target));
    const suffix = next.toString();
    return `/brands/${brandId}/library${suffix ? `?${suffix}` : ''}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Content library" description={`${total} ${total === 1 ? 'piece' : 'pieces'} of content, all reusable.`} />

      <form className="grid gap-3 sm:grid-cols-[1fr_170px_170px_150px_auto]">
        <Input aria-label="Search content" name="q" placeholder="Search content…" defaultValue={query['q'] ?? ''} />
        <Select aria-label="Filter by format" name="format" defaultValue={query['format'] ?? ''}>
          <option value="">All formats</option>
          {CONTENT_FORMATS.map((format) => (
            <option key={format} value={format}>
              {FORMAT_PROFILES[format].label}
            </option>
          ))}
        </Select>
        <Select aria-label="Filter by channel" name="channel" defaultValue={query['channel'] ?? ''}>
          <option value="">All channels</option>
          {CHANNELS.map((channel) => (
            <option key={channel} value={channel}>
              {channel}
            </option>
          ))}
        </Select>
        <Select aria-label="Filter by status" name="status" defaultValue={query['status'] ?? ''}>
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
            <div key={item.id}>
              <LibraryItem
                openHref={`/brands/${brandId}/library/${item.id}`}
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

      {lastPage > 1 ? (
        <nav className="flex items-center justify-between gap-3" aria-label="Library pages">
          {pageNumber > 1 ? (
            <Link href={pageHref(pageNumber - 1)}>
              <Button variant="secondary" size="sm">
                Newer
              </Button>
            </Link>
          ) : (
            <span />
          )}
          <p className="text-[12px] text-ink-faint">
            Page {pageNumber} of {lastPage}
          </p>
          {pageNumber < lastPage ? (
            <Link href={pageHref(pageNumber + 1)}>
              <Button variant="secondary" size="sm">
                Older
              </Button>
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
