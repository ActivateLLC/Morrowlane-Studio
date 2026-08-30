import { Badge, Button, Card, CardBody, CardHeader, Input, PageHeader, Select } from '@morrowlane/ui';
import { inviteTeammate, removeTeammate } from '@/server/actions';
import { requireSession } from '@/server/session';
import { TopBarPage } from '@/components/topbar';

export default async function SettingsPage() {
  const session = await requireSession();
  const organization = await session.runtime.store.getOrganization(session.organizationId);
  const members = await session.runtime.store.listMemberships(session.organizationId);

  return (
    <TopBarPage email={session.user.email}>
      <div className="space-y-6">
      <PageHeader title="Settings" description={organization?.name ?? 'Workspace'} />

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-ink">Team</h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <form action={inviteTeammate} className="flex flex-wrap gap-2">
            <Input aria-label="Teammate email address" name="email" type="email" placeholder="teammate@company.com" required className="max-w-xs" />
            <Select aria-label="Role for the invited teammate" name="role" defaultValue="editor" className="max-w-[140px]">
              <option value="admin">Admin</option>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </Select>
            <Button type="submit" variant="secondary">
              Invite
            </Button>
          </form>

          <div className="divide-y divide-line">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-[13px] text-ink">{member.email}</p>
                  <p className="text-[12px] text-ink-faint">
                    {member.role}
                    {member.acceptedAt ? '' : ' · invitation pending'}
                  </p>
                </div>
                {member.role !== 'owner' ? (
                  <form action={removeTeammate.bind(null, member.id)}>
                    <Button type="submit" variant="ghost" size="sm">
                      Remove
                    </Button>
                  </form>
                ) : (
                  <Badge tone="neutral">owner</Badge>
                )}
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
      </div>
    </TopBarPage>
  );
}
