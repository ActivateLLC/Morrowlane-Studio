import Link from 'next/link';
import { completenessChecklist } from '@morrowlane/brand-engine';
import { Alert, Badge, Button, Card, CardBody, CardHeader, Input, Label, PageHeader, ProgressBar, Textarea } from '@morrowlane/ui';
import {
  addBrainFaq,
  addBrainProduct,
  addBrainTestimonial,
  reanalyzeBrand,
  removeBrainFaq,
  removeBrainProduct,
  removeBrainTestimonial,
  unlockBrainField,
  updateBrainField,
} from '@/server/actions';
import { requireBrand } from '@/server/session';
import { ConfirmButton } from '@/components/confirm-button';
import { SubmitButton } from '@/components/submit-button';
import { EditableField } from './editable';
import { BrandGraph } from './graph';

/**
 * The Brand Brain: what Morrowlane believes about the business, and the place to
 * correct it. Sequenced as verify → fix → fill: what's missing comes first (as actions,
 * not a grade), then the fields themselves, then the map of where it all flows.
 */
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

  // How the Brain is actually being used downstream. A profile that shows its work is
  // one people trust enough to correct.
  const { items: allContent } = await runtime.store.queryContent({ brandId, limit: 200 });
  const blockedCount = allContent.filter((item) =>
    item.violations.some((violation) => violation.severity === 'error'),
  ).length;
  const productUsage = new Map<string, number>();
  for (const product of brain.products) {
    const needle = product.name.toLowerCase();
    productUsage.set(
      product.id,
      allContent.filter((item) => `${item.title} ${item.body}`.toLowerCase().includes(needle)).length,
    );
  }

  const checklist = completenessChecklist(brain);
  const missing = checklist.filter((item) => !item.done).sort((a, b) => b.weight - a.weight);
  const percent = Math.round(brain.completeness * 100);
  const thinSource = Boolean(brand.websiteUrl) && brain.sourcePageCount <= 3;

  const save = (path: string) => updateBrainField.bind(null, brandId, path);
  const unlock = (path: string) => unlockBrainField.bind(null, brandId, path);
  const lockedSet = new Set(brain.lockedFields);
  const isLocked = (path: string) => lockedSet.has(path);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Brand Brain"
        description={
          brand.websiteUrl
            ? `Built from ${brain.sourcePageCount} ${brain.sourcePageCount === 1 ? 'page' : 'pages'} on ${brand.websiteUrl}. Edit anything — your edits survive re-analysis.`
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

      {thinSource ? (
        <Alert
          tone="caution"
          title={`Morrowlane could only read ${brain.sourcePageCount} ${brain.sourcePageCount === 1 ? 'page' : 'pages'} of your site`}
        >
          <p>
            Some sites build their content in the browser, where the reader can&apos;t see it. Your Brain works, but
            it&apos;s running on thin evidence — filling the gaps below makes every post more specific.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <form action={reanalyzeBrand.bind(null, brandId)}>
              <SubmitButton size="sm" variant="secondary" pendingLabel="Reading…">
                Try reading it again
              </SubmitButton>
            </form>
            <Link href="/new">
              <Button variant="ghost" size="sm">
                Answer a few questions instead
              </Button>
            </Link>
          </div>
        </Alert>
      ) : null}

      {/* The completeness model as a list of actions. A mute percentage told people they
          were graded; this tells them what to do, in the order that pays off most. */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink">
              {missing.length === 0 ? 'Your Brand Brain is complete' : `Your Brand Brain is ${percent}% complete`}
            </h2>
            <p className="text-[12px] text-ink-faint">Version {brain.version}</p>
          </div>
          <div className="mt-2">
            <ProgressBar value={brain.completeness} />
          </div>
          <p className="mt-2 text-[12px] text-ink-soft">
            {missing.length === 0
              ? 'Everything Morrowlane needs is here. Re-read your site any time to keep it current.'
              : 'The more it knows, the less generic your content. Each of these takes a minute.'}
          </p>
        </CardHeader>
        {missing.length > 0 ? (
          <CardBody className="divide-y divide-line p-0">
            {missing.slice(0, 5).map((item) => (
              <a
                key={item.id}
                href={item.target}
                className="flex min-h-11 items-center justify-between gap-3 px-5 py-3 transition hover:bg-surface-sunken"
              >
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-ink">{item.label}</span>
                  <span className="block text-[12px] text-ink-faint">{item.reason}</span>
                </span>
                <span aria-hidden className="text-ink-faint">
                  →
                </span>
              </a>
            ))}
            {missing.length > 5 ? (
              <p className="px-5 py-3 text-[12px] text-ink-faint">
                {missing.length - 5} more after these.
              </p>
            ) : null}
          </CardBody>
        ) : null}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card id="identity" className="scroll-mt-20">
          <CardHeader>
            <h2 className="text-sm font-semibold text-ink">Identity</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <EditableField label="Company" value={brain.identity.companyName} save={save('identity.companyName')} locked={isLocked('identity.companyName')} unlock={unlock('identity.companyName')} />
            <EditableField label="Category" value={brain.identity.category} save={save('identity.category')} locked={isLocked('identity.category')} unlock={unlock('identity.category')} />
            <EditableField label="One-liner" value={brain.identity.oneLiner} save={save('identity.oneLiner')} locked={isLocked('identity.oneLiner')} unlock={unlock('identity.oneLiner')} multiline />
            <EditableField label="Description" value={brain.identity.description} save={save('identity.description')} locked={isLocked('identity.description')} unlock={unlock('identity.description')} multiline />
            <EditableField
              label="Audience"
              value={brain.identity.audience.join('\n')}
              save={save('identity.audience')} locked={isLocked('identity.audience')} unlock={unlock('identity.audience')}
              multiline
              hint="One audience per line."
            />
          </CardBody>
        </Card>

        <Card id="voice" className="scroll-mt-20">
          <CardHeader>
            <h2 className="text-sm font-semibold text-ink">Voice</h2>
            <p className="mt-0.5 text-[12px] text-ink-faint">
              {allContent.length > 0
                ? `Every one of your ${allContent.length} ${allContent.length === 1 ? 'piece' : 'pieces'} was written in this voice.`
                : 'Everything you create will be written in this voice.'}
            </p>
          </CardHeader>
          <CardBody className="space-y-4">
            <EditableField
              label="Traits"
              value={brain.voice.traits.join('\n')}
              save={save('voice.traits')} locked={isLocked('voice.traits')} unlock={unlock('voice.traits')}
              multiline
              hint="One trait per line: clear, confident, approachable…"
            />
            <EditableField label="How it sounds" value={brain.voice.personSummary} save={save('voice.personSummary')} locked={isLocked('voice.personSummary')} unlock={unlock('voice.personSummary')} multiline />
            <EditableField
              label="Words to avoid"
              value={brain.voice.avoid.join('\n')}
              save={save('voice.avoid')} locked={isLocked('voice.avoid')} unlock={unlock('voice.avoid')}
              multiline
              hint="One per line. Morrowlane keeps these out of your content."
            />
            {brain.voice.sampleSentences.length > 0 ? (
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
            ) : null}
          </CardBody>
        </Card>
      </div>

      <Card id="products" className="scroll-mt-20">
        <CardHeader>
          <h2 className="text-sm font-semibold text-ink">Products and services</h2>
          <p className="mt-0.5 text-[12px] text-ink-faint">
            What content points at when it asks for the sale.
          </p>
        </CardHeader>
        <CardBody className="space-y-4">
          {brain.products.length === 0 ? (
            <p className="text-[13px] text-ink-faint">
              Nothing here yet — add what you sell so content has something to point at.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {brain.products.map((product, index) => (
                <div key={product.id} className="min-w-0 rounded-lg border border-line p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-ink">{product.name}</p>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {(productUsage.get(product.id) ?? 0) > 0 ? (
                        <Badge tone="accent">Used in {productUsage.get(product.id)}</Badge>
                      ) : null}
                      <Badge tone="neutral">{product.kind}</Badge>
                    </div>
                  </div>
                  {product.priceHint ? <p className="mt-0.5 text-[12px] text-accent-strong">{product.priceHint}</p> : null}
                  <div className="mt-2 space-y-3">
                    <EditableField
                      label="Description"
                      value={product.description}
                      save={save(`products.${index}.description`)}
                      locked={isLocked(`products.${index}.description`)}
                      unlock={unlock(`products.${index}.description`)}
                      multiline
                    />
                    <EditableField
                      label="Why it's worth buying"
                      value={product.benefits.join('\n')}
                      save={save(`products.${index}.benefits`)}
                      locked={isLocked(`products.${index}.benefits`)}
                      unlock={unlock(`products.${index}.benefits`)}
                      multiline
                      hint="One benefit per line."
                    />
                  </div>
                  {product.sourceUrls[0] ? (
                    <p className="mt-2 truncate text-[11px] text-ink-faint">{product.sourceUrls[0]}</p>
                  ) : null}
                  <form action={removeBrainProduct.bind(null, brandId, index)} className="mt-2">
                    <ConfirmButton confirmLabel="Remove it">Remove</ConfirmButton>
                  </form>
                </div>
              ))}
            </div>
          )}

          <details className="rounded-lg border border-dashed border-line p-4">
            <summary className="cursor-pointer text-[13px] font-medium text-accent-strong">
              Add a product or service
            </summary>
            <form action={addBrainProduct.bind(null, brandId)} className="mt-3 space-y-3">
              <div>
                <Label htmlFor="product-name">Name</Label>
                <Input id="product-name" name="name" required placeholder="Same-day boiler repair" />
              </div>
              <div>
                <Label htmlFor="product-description">What it is</Label>
                <Textarea id="product-description" name="description" rows={2} />
              </div>
              <div>
                <Label htmlFor="product-benefits">Why it&apos;s worth buying</Label>
                <Textarea id="product-benefits" name="benefits" rows={3} placeholder="One benefit per line" />
              </div>
              <div>
                <Label htmlFor="product-price">Price (optional)</Label>
                <Input id="product-price" name="priceHint" placeholder="From £95" />
              </div>
              <SubmitButton size="sm" variant="secondary" pendingLabel="Adding…">
                Add it
              </SubmitButton>
            </form>
          </details>
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card id="rules" className="scroll-mt-20">
          <CardHeader>
            <h2 className="text-sm font-semibold text-ink">Brand rules</h2>
            <p className="mt-0.5 text-[12px] text-ink-faint">
              These block publishing — nothing that breaks them can go out.
            </p>
            {blockedCount > 0 ? (
              <p className="mt-2">
                <Badge tone="positive">
                  Held back {blockedCount} {blockedCount === 1 ? 'draft' : 'drafts'}
                </Badge>
              </p>
            ) : null}
          </CardHeader>
          <CardBody className="space-y-4">
            <EditableField
              label="Prohibited claims"
              value={brain.rules.prohibitedClaims.join('\n')}
              save={save('rules.prohibitedClaims')} locked={isLocked('rules.prohibitedClaims')} unlock={unlock('rules.prohibitedClaims')}
              multiline
            />
            <EditableField
              label="Prohibited terminology"
              value={brain.rules.prohibitedTerminology.join('\n')}
              save={save('rules.prohibitedTerminology')} locked={isLocked('rules.prohibitedTerminology')} unlock={unlock('rules.prohibitedTerminology')}
              multiline
            />
            <EditableField
              label="Preferred calls to action"
              value={brain.rules.preferredCtas.join('\n')}
              save={save('rules.preferredCtas')} locked={isLocked('rules.preferredCtas')} unlock={unlock('rules.preferredCtas')}
              multiline
              hint="Book, buy, call, message — how you want content to close."
            />
            <EditableField
              label="Claims you can make"
              value={brain.rules.approvedClaims.join('\n')}
              save={save('rules.approvedClaims')} locked={isLocked('rules.approvedClaims')} unlock={unlock('rules.approvedClaims')}
              multiline
              hint="Things you can prove — Morrowlane leans on these."
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

        <Card id="knowledge" className="scroll-mt-20">
          <CardHeader>
            <h2 className="text-sm font-semibold text-ink">Knowledge</h2>
            <p className="mt-0.5 text-[12px] text-ink-faint">
              The questions and proof your content draws on.
            </p>
          </CardHeader>
          <CardBody className="space-y-5">
            <div>
              <p className="mb-1.5 text-[13px] font-medium text-ink-soft">
                {brain.faqs.length > 0 ? `${brain.faqs.length} ${brain.faqs.length === 1 ? 'question' : 'questions'} customers ask` : 'Questions customers ask'}
              </p>
              {brain.faqs.length === 0 ? (
                <p className="text-[12px] text-ink-faint">
                  The richest source of content you already own. Add the three you answer every week.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {brain.faqs.map((faq, index) => (
                    <li key={`${faq.question}-${index}`} className="flex items-start justify-between gap-2">
                      <span className="min-w-0 text-[12px] text-ink-soft">• {faq.question}</span>
                      <form action={removeBrainFaq.bind(null, brandId, index)} className="shrink-0">
                        <ConfirmButton confirmLabel="Remove">Remove</ConfirmButton>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              <details className="mt-2">
                <summary className="cursor-pointer text-[12px] font-medium text-accent-strong">Add a question</summary>
                <form action={addBrainFaq.bind(null, brandId)} className="mt-2 space-y-2">
                  <Input name="question" placeholder="How quickly can you come out?" aria-label="Question" required />
                  <Textarea name="answer" rows={2} placeholder="Your answer" aria-label="Answer" required />
                  <SubmitButton size="sm" variant="secondary" pendingLabel="Adding…">
                    Add it
                  </SubmitButton>
                </form>
              </details>
            </div>

            <div>
              <p className="mb-1.5 text-[13px] font-medium text-ink-soft">
                {brain.testimonials.length > 0 ? `${brain.testimonials.length} customer ${brain.testimonials.length === 1 ? 'quote' : 'quotes'}` : 'Customer quotes'}
              </p>
              {brain.testimonials.length === 0 ? (
                <p className="text-[12px] text-ink-faint">Proof outperforms claims — one real quote is enough to start.</p>
              ) : (
                <ul className="space-y-2">
                  {brain.testimonials.map((testimonial, index) => (
                    <li key={`${testimonial.quote}-${index}`} className="rounded bg-surface-sunken px-3 py-2">
                      <p className="text-[12px] italic text-ink-soft">
                        “{testimonial.quote}”
                        {testimonial.attribution ? ` — ${testimonial.attribution}` : ''}
                      </p>
                      <form action={removeBrainTestimonial.bind(null, brandId, index)} className="mt-1">
                        <ConfirmButton confirmLabel="Remove">Remove</ConfirmButton>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              <details className="mt-2">
                <summary className="cursor-pointer text-[12px] font-medium text-accent-strong">Add a quote</summary>
                <form action={addBrainTestimonial.bind(null, brandId)} className="mt-2 space-y-2">
                  <Textarea name="quote" rows={2} placeholder="What they said" aria-label="Quote" required />
                  <Input name="attribution" placeholder="Who said it (optional)" aria-label="Attribution" />
                  <SubmitButton size="sm" variant="secondary" pendingLabel="Adding…">
                    Add it
                  </SubmitButton>
                </form>
              </details>
            </div>

            <EditableField
              label="Brand colours"
              value={brain.visuals.colors.join('\n')}
              save={save('visuals.colors')} locked={isLocked('visuals.colors')} unlock={unlock('visuals.colors')}
              multiline
              hint="One hex code per line, e.g. #0b7a70."
            />
            {brain.visuals.colors.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {brain.visuals.colors.map((color) => (
                  <span key={color} className="flex items-center gap-1.5 text-[12px] text-ink-faint">
                    <span className="h-5 w-5 rounded border border-line" style={{ backgroundColor: color }} />
                    {color}
                  </span>
                ))}
              </div>
            ) : null}
            <EditableField
              label="Current offers"
              value={brain.offers.join('\n')}
              save={save('offers')} locked={isLocked('offers')} unlock={unlock('offers')}
              multiline
              hint="One per line. Campaigns drive toward these."
            />
            <EditableField
              label="Social profiles"
              value={brain.socialLinks.join('\n')}
              save={save('socialLinks')} locked={isLocked('socialLinks')} unlock={unlock('socialLinks')}
              multiline
              hint="One link per line."
            />
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

      {/* The map comes last: it explains where the Brain flows once you've seen what's
          in it. As the opening element it was a poster in front of the working surface. */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink">How your Brain reaches your channels</h2>
        <BrandGraph
          brain={brain}
          channels={connections.filter((c) => c.status === 'active').map((c) => c.channel)}
        />
      </section>
    </div>
  );
}
