import { Badge, Button, Card, CardBody, CardHeader, PageHeader, ProgressBar } from '@morrowlane/ui';
import { reanalyzeBrand } from '@/server/actions';
import { requireBrand } from '@/server/session';
import { EditableField } from './editable';
import { updateBrainField } from '@/server/actions';
import { BrandGraph } from './graph';

/** Milestone 4: the extracted business, laid out for review and correction. */
export default async function BrainPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const { runtime, brand } = await requireBrand(brandId);
  const brain = await runtime.store.getBrain(brandId);
  const connections = await runtime.store.listConnections(brandId);

  if (!brain) {
    return (
      <PageHeader
        title="Brand Brain"
        description="The analysis has not finished yet. This page fills in as soon as it does."
      />
    );
  }

  const save = (path: string) => updateBrainField.bind(null, brandId, path);
  const lockedSet = new Set(brain.lockedFields);
  const isLocked = (path: string) => lockedSet.has(path);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Brand Brain"
        description={
          brand.websiteUrl
            ? `Built from ${brain.sourcePageCount} pages on ${brand.websiteUrl}. Edit anything — your edits survive re-analysis.`
            : 'Built from your Brand Builder answers. Edit anything — your edits are kept. Add a website any time to enrich it.'
        }
        action={
          brand.websiteUrl ? (
            <form action={reanalyzeBrand.bind(null, brandId)}>
              <Button type="submit" variant="secondary">
                Re-read the website
              </Button>
            </form>
          ) : null
        }
      />

      <BrandGraph
        brain={brain}
        channels={connections.filter((c) => c.status === 'active').map((c) => c.channel)}
      />

      <Card>
        <CardBody className="py-4">
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-ink-soft">
              Profile completeness · version {brain.version}
            </p>
            <p className="text-[13px] font-medium text-ink">{Math.round(brain.completeness * 100)}%</p>
          </div>
          <div className="mt-2">
            <ProgressBar value={brain.completeness} />
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-ink">Identity</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <EditableField label="Company" value={brain.identity.companyName} save={save('identity.companyName')} locked={isLocked('identity.companyName')} />
            <EditableField label="Category" value={brain.identity.category} save={save('identity.category')} locked={isLocked('identity.category')} />
            <EditableField label="One-liner" value={brain.identity.oneLiner} save={save('identity.oneLiner')} locked={isLocked('identity.oneLiner')} multiline />
            <EditableField label="Description" value={brain.identity.description} save={save('identity.description')} locked={isLocked('identity.description')} multiline />
            <EditableField
              label="Audience"
              value={brain.identity.audience.join('\n')}
              save={save('identity.audience')} locked={isLocked('identity.audience')}
              multiline
              hint="One audience per line."
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-ink">Voice</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <EditableField
              label="Traits"
              value={brain.voice.traits.join('\n')}
              save={save('voice.traits')} locked={isLocked('voice.traits')}
              multiline
              hint="One trait per line: clear, confident, approachable…"
            />
            <EditableField label="How it sounds" value={brain.voice.personSummary} save={save('voice.personSummary')} locked={isLocked('voice.personSummary')} multiline />
            <div>
              <p className="mb-1.5 text-[13px] font-medium text-ink-soft">
                {brand.websiteUrl ? 'Sample sentences from the site' : 'What you told Morrowlane'}
              </p>
              <ul className="space-y-1">
                {brain.voice.sampleSentences.map((sentence) => (
                  <li key={sentence} className="rounded bg-surface-sunken px-3 py-1.5 text-[12px] italic text-ink-soft">
                    “{sentence}”
                  </li>
                ))}
              </ul>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-ink">Products and services</h2>
        </CardHeader>
        <CardBody className="grid gap-4 md:grid-cols-2">
          {brain.products.map((product) => (
            <div key={product.id} className="min-w-0 rounded-lg border border-line p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-ink">{product.name}</p>
                <Badge tone="neutral">{product.kind}</Badge>
              </div>
              {product.priceHint ? <p className="mt-0.5 text-[12px] text-accent-strong">{product.priceHint}</p> : null}
              <p className="mt-2 text-[13px] text-ink-soft">{product.description}</p>
              {product.benefits.length > 0 ? (
                <ul className="mt-2 space-y-0.5 text-[12px] text-ink-soft">
                  {product.benefits.map((benefit) => (
                    <li key={benefit}>• {benefit}</li>
                  ))}
                </ul>
              ) : null}
              {product.sourceUrls[0] ? (
                <p className="mt-2 truncate text-[11px] text-ink-faint">{product.sourceUrls[0]}</p>
              ) : null}
            </div>
          ))}
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-ink">Brand rules</h2>
            <p className="mt-0.5 text-[12px] text-ink-faint">
              Content that breaks these cannot be approved or published.
            </p>
          </CardHeader>
          <CardBody className="space-y-4">
            <EditableField
              label="Prohibited claims"
              value={brain.rules.prohibitedClaims.join('\n')}
              save={save('rules.prohibitedClaims')} locked={isLocked('rules.prohibitedClaims')}
              multiline
            />
            <EditableField
              label="Prohibited terminology"
              value={brain.rules.prohibitedTerminology.join('\n')}
              save={save('rules.prohibitedTerminology')} locked={isLocked('rules.prohibitedTerminology')}
              multiline
            />
            <EditableField
              label="Preferred calls to action"
              value={brain.rules.preferredCtas.join('\n')}
              save={save('rules.preferredCtas')} locked={isLocked('rules.preferredCtas')}
              multiline
            />
            {brain.rules.regulatoryNotes.length > 0 ? (
              <div>
                <p className="mb-1.5 text-[13px] font-medium text-ink-soft">Regulatory notes</p>
                <ul className="space-y-1 text-[12px] text-ink-soft">
                  {brain.rules.regulatoryNotes.map((note) => (
                    <li key={note} className="rounded bg-caution-soft px-3 py-1.5 text-caution">
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-ink">Knowledge</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            {brain.visuals.colors.length > 0 ? (
              <div>
                <p className="mb-1.5 text-[13px] font-medium text-ink-soft">Brand colours</p>
                <div className="flex gap-2">
                  {brain.visuals.colors.map((color) => (
                    <span key={color} className="flex items-center gap-1.5 text-[12px] text-ink-faint">
                      <span className="h-5 w-5 rounded border border-line" style={{ backgroundColor: color }} />
                      {color}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {brain.faqs.length > 0 ? (
              <div>
                <p className="mb-1.5 text-[13px] font-medium text-ink-soft">{brain.faqs.length} FAQs</p>
                <ul className="space-y-1 text-[12px] text-ink-soft">
                  {brain.faqs.slice(0, 4).map((faq) => (
                    <li key={faq.question}>• {faq.question}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {brain.testimonials.length > 0 ? (
              <div>
                <p className="mb-1.5 text-[13px] font-medium text-ink-soft">{brain.testimonials.length} testimonials</p>
                <p className="rounded bg-surface-sunken px-3 py-2 text-[12px] italic text-ink-soft">
                  “{brain.testimonials[0]!.quote}”
                  {brain.testimonials[0]!.attribution ? ` — ${brain.testimonials[0]!.attribution}` : ''}
                </p>
              </div>
            ) : null}
            {brain.terminology.length > 0 ? (
              <div>
                <p className="mb-1.5 text-[13px] font-medium text-ink-soft">Terminology</p>
                <div className="flex flex-wrap gap-1.5">
                  {brain.terminology.slice(0, 10).map((term) => (
                    <Badge key={term} tone="neutral">
                      {term}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
