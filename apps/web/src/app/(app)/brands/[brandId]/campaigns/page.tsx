import { SOCIAL_CHANNELS, CHANNEL_PROFILES } from '@morrowlane/shared';
import { Badge, Button, Card, CardBody, CardHeader, Input, Label, PageHeader, Select } from '@morrowlane/ui';
import { createCampaign } from '@/server/actions';
import { requireBrand } from '@/server/session';
import { formatDay } from '@/lib/format';

export default async function CampaignsPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const { runtime } = await requireBrand(brandId);
  const brain = await runtime.store.getBrain(brandId);
  const campaigns = await runtime.store.listCampaigns(brandId);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Campaigns"
        description="Start from a goal. Morrowlane plans the narrative, writes every phase, and fills the calendar."
      />

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-ink">Run a campaign</h2>
        </CardHeader>
        <CardBody>
          <form action={createCampaign.bind(null, brandId)} className="space-y-4">
            <div>
              <Label htmlFor="goal">Goal</Label>
              <Input id="goal" name="goal" placeholder="Generate qualified customers." required />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="productName">Product</Label>
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
                        defaultChecked={['instagram', 'linkedin'].includes(channel)}
                        className="rounded border-line"
                      />
                      {CHANNEL_PROFILES[channel].label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <Button type="submit">Plan and generate the campaign</Button>
          </form>
        </CardBody>
      </Card>

      {campaigns.map((campaign) => (
        <Card key={campaign.id}>
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-ink">{campaign.name}</h3>
              <p className="text-[12px] text-ink-faint">
                {campaign.durationDays} days from {formatDay(campaign.startDate)} · {campaign.channels.join(', ')}
              </p>
            </div>
            <Badge tone={campaign.status === 'active' ? 'positive' : 'neutral'}>{campaign.status}</Badge>
          </CardHeader>
          <CardBody>
            <p className="text-[13px] text-ink-soft">{campaign.narrative}</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {campaign.phases.map((phase) => (
                <div key={phase.id} className="rounded-lg border border-line bg-surface-sunken p-3">
                  <p className="text-[12px] font-semibold text-ink">{phase.title}</p>
                  <p className="mt-0.5 text-[11px] text-ink-faint">
                    Day {phase.startDay + 1}–{phase.endDay + 1} · {phase.postCount} posts
                  </p>
                  <p className="mt-1.5 line-clamp-3 text-[12px] text-ink-soft">{phase.narrative}</p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
