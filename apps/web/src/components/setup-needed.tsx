import Link from 'next/link';
import { Button, Card, CardBody } from '@morrowlane/ui';

/**
 * Shown on generate surfaces when the brand has no profile yet (analysis still running,
 * or failed). Generating without a Brand Brain used to fail with a cryptic activity-feed
 * error; pointing back to Today — which knows how to finish or fix the setup — is the
 * only honest thing these pages can do.
 */
export function SetupNeeded({ brandId }: { brandId: string }) {
  return (
    <div className="mx-auto max-w-xl pt-10">
      <Card>
        <CardBody className="py-8 text-center">
          <h1 className="text-lg font-semibold tracking-tight text-ink">Finish setting up first</h1>
          <p className="mt-1 text-[13px] text-ink-soft">
            Morrowlane generates from your brand profile, and this brand doesn&apos;t have one yet.
          </p>
          <Link href={`/brands/${brandId}`} className="mt-5 inline-block">
            <Button>Go to setup</Button>
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}
