import { CONTENT_FORMATS, FORMAT_PROFILES } from '@morrowlane/shared';
import { Badge, Button, Card, CardBody, Input, Label, PageHeader, ProgressBar, Select, Textarea } from '@morrowlane/ui';
import { generateFormat, runStudio } from '@/server/actions';
import { requireBrand } from '@/server/session';
import { STATUS_TONES, statusLabel } from '@/lib/format';
import { AutoRefresh } from '@/components/auto-refresh';
import { SubmitButton } from '@/components/submit-button';
import { SetupNeeded } from '@/components/setup-needed';

/**
 * The central creation interface. One large input; the intent parser decides whether
 * the words mean posts, a remix, a campaign or a filled calendar. The user never
 * writes a prompt.
 */
export default async function StudioPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const { runtime } = await requireBrand(brandId);
  const brain = await runtime.store.getBrain(brandId);
  if (!brain) return <SetupNeeded brandId={brandId} />;
  const recent = await runtime.store.queryContent({ brandId, limit: 8 });
  const jobs = await runtime.store.listJobs(brandId, { limit: 6 });
  const active = jobs.filter((job) => job.status === 'running' || job.status === 'queued');

  return (
    <div className="space-y-8">
      <PageHeader
        title="What do you want to create?"
        description="Describe it in your own words. Morrowlane already knows the business."
      />

      <Card>
        <CardBody className="py-6">
          <form action={runStudio.bind(null, brandId)} className="space-y-3">
            <Textarea aria-label="What should Morrowlane create?" name="instruction"
              rows={3}
              required
              className="text-base"
              placeholder={`Promote our ${brain?.products[0]?.name ?? 'newest service'}.\nCreate a week of Instagram content.\nTurn https://… into a campaign.`}
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[12px] text-ink-faint max-sm:order-2">
                Try: “Generate 30 days of content”, “10 TikTok scripts about {brain?.terminology[0] ?? 'your product'}”.
              </p>
              <SubmitButton size="lg" className="max-sm:w-full" pendingLabel="Writing…" hint="Grounding every line in your Brand Brain.">
                Generate content
              </SubmitButton>
            </div>
          </form>
        </CardBody>
      </Card>

      {jobs.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-ink">Activity</h2>
          <Card>
            <CardBody className="divide-y divide-line p-0">
              {jobs.map((job) => (
                <div key={job.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[13px] font-medium text-ink">{statusLabel(job.kind)}</p>
                    <Badge
                      tone={
                        job.status === 'succeeded'
                          ? 'positive'
                          : job.status === 'failed'
                            ? 'critical'
                            : 'accent'
                      }
                    >
                      {job.status}
                    </Badge>
                  </div>
                  {job.status === 'running' ? (
                    <div className="mt-2">
                      <ProgressBar value={job.progress} label={job.progressLabel ?? undefined} />
                    </div>
                  ) : null}
                  {job.status === 'failed' && job.error ? (
                    <p className="mt-1 text-[12px] text-critical">{job.error}</p>
                  ) : null}
                  {job.status === 'succeeded' && typeof job.result?.['count'] === 'number' ? (
                    <p className="mt-1 text-[12px] text-ink-faint">{String(job.result['count'])} pieces created.</p>
                  ) : null}
                </div>
              ))}
            </CardBody>
          </Card>
          {active.length > 0 ?
      <AutoRefresh intervalMs={4000} label="Morrowlane is working…" /> : null}
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink">Or pick a format</h2>
        <Card>
          <CardBody>
            <form action={generateFormat.bind(null, brandId)} className="grid gap-4 sm:grid-cols-[1fr_120px_1fr_auto]">
              <div>
                <Label htmlFor="format">Format</Label>
                <Select id="format" name="format" defaultValue="instagram_post">
                  {CONTENT_FORMATS.map((format) => (
                    <option key={format} value={format}>
                      {FORMAT_PROFILES[format].label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="count">How many</Label>
                <Input id="count" name="count" type="number" min={1} max={60} defaultValue={5} />
              </div>
              <div>
                <Label htmlFor="productName">Product (optional)</Label>
                <Select id="productName" name="productName" defaultValue="">
                  <option value="">Whole brand</option>
                  {(brain?.products ?? []).map((product) => (
                    <option key={product.id} value={product.name}>
                      {product.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex items-end">
                <SubmitButton variant="secondary" pendingLabel="Writing…">
                  Generate
                </SubmitButton>
              </div>
            </form>
          </CardBody>
        </Card>
      </section>

      {recent.items.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-ink">Just generated</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {recent.items.map((item) => (
              <Card key={item.id}>
                <CardBody className="py-4">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="truncate text-[13px] font-medium text-ink">{item.title}</p>
                    <Badge tone={STATUS_TONES[item.status]}>{statusLabel(item.status)}</Badge>
                  </div>
                  <p className="line-clamp-3 whitespace-pre-line text-[13px] text-ink-soft">{item.body}</p>
                  <p className="mt-2 text-[12px] text-ink-faint">
                    {statusLabel(item.format)} · {item.channel}
                  </p>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
