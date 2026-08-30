import { DEFAULT_REMIX_RECIPE } from '@morrowlane/content-engine';
import { Badge, Button, Card, CardBody, Input, PageHeader } from '@morrowlane/ui';
import { remix } from '@/server/actions';
import { requireBrand } from '@/server/session';
import { STATUS_TONES, statusLabel } from '@/lib/format';

/** The flagship: one page in, an entire distribution tree out. */
export default async function RemixPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const { runtime } = await requireBrand(brandId);

  const pages = await runtime.store.listPages(brandId);
  const promotable = pages
    .filter((page) => ['article', 'product', 'service', 'landing', 'pricing'].includes(page.pageType))
    .slice(0, 10);

  const recent = await runtime.store.queryContent({ brandId, limit: 200 });
  const remixed = recent.items.filter((item) => item.lineage.sourceType === 'remix');
  const bySource = new Map<string, typeof remixed>();
  for (const item of remixed) {
    const key = item.lineage.sourceUrl ?? 'unknown';
    const bucket = bySource.get(key);
    if (bucket) bucket.push(item);
    else bySource.set(key, [item]);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Promote a URL"
        description="Paste any page from your site. One source becomes posts, carousels, scripts, an article, an email and image concepts."
      />

      <Card>
        <CardBody className="py-6">
          <form action={remix.bind(null, brandId)} className="flex gap-2">
            <Input name="url" placeholder="https://your-site.com/product/widget" required />
            <Button type="submit">Turn this into everything</Button>
          </form>
          <div className="mt-4 flex flex-wrap gap-2">
            {DEFAULT_REMIX_RECIPE.map((step) => (
              <Badge key={step.format} tone="accent">
                {step.label}
              </Badge>
            ))}
          </div>
        </CardBody>
      </Card>

      {promotable.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-ink">Pages worth promoting</h2>
          <Card>
            <CardBody className="divide-y divide-line p-0">
              {promotable.map((page) => (
                <div key={page.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-ink">{page.title ?? page.url}</p>
                    <p className="truncate text-[12px] text-ink-faint">{page.url}</p>
                  </div>
                  <form action={remix.bind(null, brandId)}>
                    <input type="hidden" name="url" value={page.url} />
                    <Button type="submit" variant="secondary" size="sm">
                      Remix
                    </Button>
                  </form>
                </div>
              ))}
            </CardBody>
          </Card>
        </section>
      ) : null}

      {bySource.size > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-ink">Distribution trees</h2>
          <div className="space-y-3">
            {[...bySource.entries()].slice(0, 5).map(([sourceUrl, items]) => (
              <Card key={sourceUrl}>
                <CardBody className="py-4">
                  <p className="truncate text-[13px] font-medium text-ink">{sourceUrl}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(
                      items.reduce<Record<string, number>>((acc, item) => {
                        acc[item.format] = (acc[item.format] ?? 0) + 1;
                        return acc;
                      }, {}),
                    ).map(([format, count]) => (
                      <Badge key={format} tone={STATUS_TONES[items[0]!.status] ?? 'neutral'}>
                        {count}× {statusLabel(format)}
                      </Badge>
                    ))}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
