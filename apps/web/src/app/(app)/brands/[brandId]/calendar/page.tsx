import { groupByDay } from '@morrowlane/campaign-engine';
import { addDays, dayKey, dayRange, nowIso, startOfUtcDay } from '@morrowlane/shared';
import { Badge, Button, Card, CardBody, PageHeader } from '@morrowlane/ui';
import { cancelPost, fillMonthAction, publishNow, reschedulePost } from '@/server/actions';
import { requireBrand } from '@/server/session';
import { STATUS_TONES, statusLabel } from '@/lib/format';
import { PostRow } from './post-row';

/** The unified calendar. "Fill My Month" is the major action, exactly as specced. */
export default async function CalendarPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const { runtime } = await requireBrand(brandId);

  const start = startOfUtcDay(nowIso());
  const posts = await runtime.store.queryScheduledPosts({
    brandId,
    from: addDays(start, -1),
    to: addDays(start, 30),
  });
  const contentIds = [...new Set(posts.map((post) => post.contentId))];
  const items = await Promise.all(contentIds.map((id) => runtime.store.getContent(id)));
  const contentById = new Map(items.filter((i) => i !== null).map((item) => [item!.id, item!]));

  const byDay = groupByDay(posts.filter((post) => post.status !== 'cancelled'));
  const days = dayRange(start, 28);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description="Everything scheduled across every channel, in one place."
        action={
          <form action={fillMonthAction.bind(null, brandId)}>
            <Button type="submit" size="lg">
              Fill my month
            </Button>
          </form>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {days.map((day) => {
          const dayPosts = byDay.get(day) ?? [];
          const isToday = day === dayKey(start);
          return (
            <Card key={day} className={isToday ? 'border-accent' : undefined}>
              <CardBody className="p-3">
                <p className="mb-2 flex items-center justify-between text-[12px] font-semibold text-ink">
                  {new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    timeZone: 'UTC',
                  })}
                  {isToday ? <Badge tone="accent">Today</Badge> : null}
                </p>
                {dayPosts.length === 0 ? (
                  <p className="py-2 text-center text-[12px] text-ink-faint">—</p>
                ) : (
                  <div className="space-y-2">
                    {dayPosts.map((post) => (
                      <PostRow
                        key={post.id}
                        post={post}
                        title={contentById.get(post.contentId)?.title ?? 'Untitled'}
                        reschedule={reschedulePost.bind(null, brandId, post.id)}
                        cancel={cancelPost.bind(null, brandId, post.id)}
                        publish={publishNow.bind(null, brandId, post.id)}
                      />
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 text-[12px] text-ink-faint">
        {(['scheduled', 'published', 'failed'] as const).map((status) => (
          <span key={status} className="flex items-center gap-1.5">
            <Badge tone={STATUS_TONES[status]}>{statusLabel(status)}</Badge>
          </span>
        ))}
      </div>
    </div>
  );
}
