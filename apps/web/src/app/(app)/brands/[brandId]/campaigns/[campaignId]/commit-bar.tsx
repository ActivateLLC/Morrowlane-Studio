'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@morrowlane/ui';

/** Submit that reports its own progress, so a long schedule never looks stalled. */
function ScheduleButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Scheduling…' : 'Yes, schedule them'}
    </Button>
  );
}

/**
 * The commit step. Approving a plan schedules real posts to live accounts, so it states
 * exactly what is about to happen — how many, where, and when the first one goes out —
 * before it happens, instead of firing on one unconfirmed click.
 */
export function CommitBar({
  approvableCount,
  blockedCount,
  channels,
  firstPostAt,
  lastPostAt,
  approve,
}: {
  approvableCount: number;
  blockedCount: number;
  channels: string[];
  firstPostAt: string | null;
  lastPostAt: string | null;
  approve: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button size="lg" disabled={approvableCount === 0} onClick={() => setConfirming(true)}>
        Review &amp; schedule {approvableCount} {approvableCount === 1 ? 'post' : 'posts'}
      </Button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-accent/50 bg-surface p-4">
      <p className="text-sm font-semibold text-ink">Schedule this campaign?</p>
      <ul className="mt-2 space-y-1 text-[13px] text-ink-soft">
        <li>
          <strong className="font-medium text-ink">{approvableCount}</strong> posts across {channels.join(', ')}
        </li>
        {firstPostAt ? (
          <li>
            First goes out <strong className="font-medium text-ink">{firstPostAt}</strong>
            {lastPostAt ? `, last on ${lastPostAt}` : ''}
          </li>
        ) : null}
        {blockedCount > 0 ? (
          <li className="text-caution">
            {blockedCount} {blockedCount === 1 ? 'piece is' : 'pieces are'} held by a brand rule and will not be
            scheduled.
          </li>
        ) : null}
        <li className="text-ink-faint">You can pause the campaign afterwards to cancel anything not yet published.</li>
      </ul>
      {/* A real form submit, so the action's redirect to the completion screen works. */}
      <form action={approve} className="mt-3 flex flex-wrap gap-2">
        <ScheduleButton />
        <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </form>
    </div>
  );
}
