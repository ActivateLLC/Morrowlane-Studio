import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge, Button, Card, CardBody, EmptyState, Input, PageHeader } from '@morrowlane/ui';
import { addBrand } from '@/server/actions';
import { requireSession } from '@/server/session';

/**
 * The home screen opens with creation, never with analytics charts. With no brand yet
 * it is the onboarding question from the spec: "What's your website?". With brands it
 * routes into the newest one's workspace.
 */
export default async function HomePage() {
  const session = await requireSession();
  const brands = await session.runtime.store.listBrands(session.organizationId);

  // One brand is the overwhelmingly common case; take the user straight to work.
  if (brands.length === 1) redirect(`/brands/${brands[0]!.id}`);

  if (brands.length === 0) {
    return (
      <div className="mx-auto max-w-xl pt-16">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">What’s your website?</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Paste it in. Morrowlane reads the whole site — products, pricing, voice, FAQs, testimonials —
            and builds the brand profile everything else is generated from.
          </p>
        </div>
        <Card>
          <CardBody className="py-6">
            <form action={addBrand} className="flex gap-2">
              <Input name="websiteUrl" placeholder="https://example.com" autoFocus required />
              <Button type="submit">Build my brand</Button>
            </form>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Your brands"
        description="Each brand has its own knowledge, content, calendar and analytics."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {brands.map((brand) => (
          <Link key={brand.id} href={`/brands/${brand.id}`}>
            <Card className="transition-shadow hover:shadow-lifted">
              <CardBody className="py-5">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-ink">{brand.name}</p>
                  <Badge tone={brand.status === 'ready' ? 'positive' : brand.status === 'failed' ? 'critical' : 'accent'}>
                    {brand.status}
                  </Badge>
                </div>
                <p className="mt-1 text-[13px] text-ink-faint">{brand.websiteUrl}</p>
              </CardBody>
            </Card>
          </Link>
        ))}
        <Card className="border-dashed">
          <CardBody className="py-5">
            <p className="mb-3 text-sm font-medium text-ink">Add another brand</p>
            <form action={addBrand} className="flex gap-2">
              <Input name="websiteUrl" placeholder="https://example.com" required />
              <Button type="submit" variant="secondary">
                Add
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
