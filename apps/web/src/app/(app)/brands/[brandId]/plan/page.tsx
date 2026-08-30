import { CAMPAIGN_OUTCOMES, SOCIAL_CHANNELS } from '@morrowlane/shared';
import { Button, Card, CardBody, Label, PageHeader, Select } from '@morrowlane/ui';
import { startGuidedCampaign } from '@/server/actions';
import { requireBrand } from '@/server/session';

/**
 * The guided flow's front door (step 5). Instead of a blank goal box, the user picks the
 * business outcome they're after; Morrowlane derives the goal, plans the campaign and
 * writes every piece, then hands back one plan to review. Connected channels are
 * pre-selected so the fewest decisions stand between here and a finished plan.
 */
export default async function PlanPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const { runtime } = await requireBrand(brandId);
  const [brain, connections] = await Promise.all([
    runtime.store.getBrain(brandId),
    runtime.store.listConnections(brandId),
  ]);

  const connectedChannels = connections.filter((c) => c.status === 'active').map((c) => c.channel);
  const defaultChannels = connectedChannels.length > 0 ? connectedChannels : ['instagram'];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Start a campaign"
        description="Pick the outcome you're after. Morrowlane plans the whole run, writes every post, and gives you one plan to approve."
      />

      <form action={startGuidedCampaign.bind(null, brandId)} className="space-y-6">
        <fieldset className="space-y-3">
          <Label>What should this achieve?</Label>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CAMPAIGN_OUTCOMES.map((outcome, index) => (
              <label
                key={outcome.id}
                className="group relative flex cursor-pointer flex-col rounded-xl border border-line bg-surface p-4 transition hover:border-accent/50 has-[:checked]:border-accent has-[:checked]:bg-accent-soft/40 has-[:checked]:ring-1 has-[:checked]:ring-accent/40"
              >
                <input
                  type="radio"
                  name="outcome"
                  value={outcome.id}
                  defaultChecked={index === 0}
                  required
                  className="sr-only"
                />
                <span className="text-[14px] font-semibold text-ink">{outcome.label}</span>
                <span className="mt-1 text-[12px] leading-relaxed text-ink-soft">{outcome.tagline}</span>
                <span className="mt-2 text-[11px] text-ink-faint">Suggested length · {outcome.defaultDurationDays} days</span>
              </label>
            ))}
          </div>
        </fieldset>

        <Card>
          <CardBody className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="productName">Focus</Label>
              <Select id="productName" name="productName" defaultValue={brain?.products[0]?.name ?? ''}>
                <option value="">Whole brand</option>
                {(brain?.products ?? []).map((product) => (
                  <option key={product.id} value={product.name}>
                    {product.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="durationDays">Length</Label>
              <Select id="durationDays" name="durationDays" defaultValue="30">
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="21">21 days</option>
                <option value="30">30 days</option>
                <option value="60">60 days</option>
              </Select>
            </div>
            <div>
              <Label>Channels</Label>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-2">
                {SOCIAL_CHANNELS.slice(0, 6).map((channel) => (
                  <label key={channel} className="flex items-center gap-1.5 text-[13px] text-ink-soft">
                    <input
                      type="checkbox"
                      name="channels"
                      value={channel}
                      defaultChecked={defaultChannels.includes(channel)}
                    />
                    {channel}
                  </label>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg">
            Generate the plan
          </Button>
          <p className="text-[12px] text-ink-faint">
            You&apos;ll review everything before anything is scheduled or published.
          </p>
        </div>
      </form>
    </div>
  );
}
