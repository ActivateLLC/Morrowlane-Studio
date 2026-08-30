import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge, Button, Card, CardBody, Input, PageHeader } from '@morrowlane/ui';
import { addBrand } from '@/server/actions';
import { requireSession } from '@/server/session';
import { Icon } from '@/components/icons';
import { LogoMark } from '@/components/logo';
import { TopBarPage } from '@/components/topbar';

/**
 * The home screen opens with creation, never with analytics charts. With no brand yet
 * it is the onboarding question from the spec, styled as the reference's dark modal:
 * paste the site, hit Analyze. With brands it routes into the newest one's workspace.
 */
export default async function HomePage() {
  const session = await requireSession();
  const brands = await session.runtime.store.listBrands(session.organizationId);

  // One brand is the overwhelmingly common case; take the user straight to work.
  if (brands.length === 1) redirect(`/brands/${brands[0]!.id}`);

  if (brands.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-shell px-4">
        <div className="w-full max-w-lg">
          <div className="mb-6 flex justify-center">
            <span className="inline-flex items-center gap-2.5">
              <LogoMark />
              <span className="text-[15px] font-semibold text-shell-bright">
                Morrowlane <span className="font-normal text-shell-text">Studio</span>
              </span>
            </span>
          </div>
          <div className="rounded-2xl border border-shell-line bg-shell-raised p-8 shadow-lifted">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-shell-hover text-accent">
              <Icon name="globe" className="h-6 w-6" />
            </div>
            <h1 className="text-center text-xl font-semibold tracking-tight text-shell-bright">
              How should Morrowlane learn your business?
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-center text-[13px] leading-relaxed text-shell-text">
              Paste your website and Morrowlane reads the whole thing — products, pricing, voice, FAQs — to build
              your brand profile.
            </p>
            <form action={addBrand} className="mt-6 flex flex-col gap-2 sm:flex-row">
              <input
                name="websiteUrl"
                placeholder="https://example.com"
                autoFocus
                required
                className="h-11 w-full rounded-lg border border-shell-line bg-shell px-3.5 text-sm text-shell-bright placeholder:text-shell-text/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
              <Button type="submit" size="lg" className="px-5 max-sm:w-full">
                Analyze
              </Button>
            </form>
            <div className="mt-5 flex items-center gap-3 text-[11px] uppercase tracking-wide text-shell-text/60">
              <span className="h-px flex-1 bg-shell-line" />
              or
              <span className="h-px flex-1 bg-shell-line" />
            </div>
            <Link
              href="/new"
              className="mt-4 flex w-full items-center justify-center rounded-lg border border-shell-line px-4 py-2.5 text-[13px] font-medium text-shell-bright transition hover:bg-shell-hover"
            >
              I don’t have a website yet →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <TopBarPage email={session.user.email}>
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
                Analyze
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </TopBarPage>
  );
}
