import Link from 'next/link';
import { Button, Card, CardBody, PageHeader } from '@morrowlane/ui';
import { fillMonthAction } from '@/server/actions';
import { requireBrand } from '@/server/session';
import { SetupNeeded } from '@/components/setup-needed';
import { SubmitButton } from '@/components/submit-button';

/**
 * The confirmation in front of Fill my month. One click here used to generate and
 * schedule a month of posts with no warning and no way back — a bulk write disguised
 * as a navigation card. This page says what will happen before it happens.
 */
export default async function FillMonthPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const { runtime } = await requireBrand(brandId);
  const brain = await runtime.store.getBrain(brandId);
  if (!brain) return <SetupNeeded brandId={brandId} />;

  const connections = await runtime.store.listConnections(brandId);
  const channels = [...new Set(connections.filter((c) => c.status === 'active').map((c) => c.channel))];

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        title="Fill my month"
        description="A balanced month of content — mostly helpful, some proof, a little promotion — written and placed on your calendar."
      />

      <Card>
        <CardBody className="space-y-4 py-5">
          <ul className="space-y-2 text-[13px] text-ink-soft">
            <li>
              <strong className="font-medium text-ink">30 days</strong> of content, spread out rather than bunched.
            </li>
            <li>
              Published to{' '}
              <strong className="font-medium text-ink">
                {channels.length > 0 ? channels.join(', ') : 'Instagram (connect accounts for more)'}
              </strong>
              .
            </li>
            <li>Everything lands as scheduled posts you can open, edit, reschedule or cancel.</li>
          </ul>

          {channels.length === 0 ? (
            <p className="rounded-lg bg-caution-soft px-3 py-2 text-[12px] text-caution">
              No accounts are connected yet, so posts will be written and scheduled but cannot publish until you{' '}
              <Link href={`/brands/${brandId}/connections`} className="font-medium underline">
                connect one
              </Link>
              .
            </p>
          ) : null}

          <form action={fillMonthAction.bind(null, brandId)} className="flex flex-wrap items-center gap-3 pt-1">
            <SubmitButton size="lg" pendingLabel="Writing your month…" hint="Planning the mix, then writing every post. About a minute.">
              Fill my month
            </SubmitButton>
            <Link href={`/brands/${brandId}`}>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </Link>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
