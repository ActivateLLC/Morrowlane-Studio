'use client';

import { useState, useTransition } from 'react';
import type { ScheduledPost } from '@morrowlane/shared';
import { Badge, Button, cn } from '@morrowlane/ui';
import { STATUS_TONES, statusLabel } from '@/lib/format';

/** One post on the calendar: reschedule, publish now, or cancel, inline. */
export function PostRow({
  post,
  title,
  reschedule,
  cancel,
  publish,
}: {
  post: ScheduledPost;
  title: string;
  reschedule: (scheduledFor: string) => Promise<void>;
  cancel: () => Promise<void>;
  publish: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const time = new Date(post.scheduledFor).toISOString().slice(11, 16);
  const editable = post.status === 'scheduled' || post.status === 'failed';

  return (
    <div
      className={cn(
        'rounded-lg border border-line bg-surface-sunken px-2.5 py-2',
        pending && 'opacity-50',
      )}
    >
      <button type="button" className="w-full text-left"
        aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <p className="truncate text-[12px] font-medium text-ink">{title}</p>
        <p className="mt-0.5 flex items-center justify-between text-[11px] text-ink-faint">
          <span>
            {time} UTC · {post.channel}
          </span>
          <Badge tone={STATUS_TONES[post.status]}>{statusLabel(post.status)}</Badge>
        </p>
      </button>

      {open && editable ? (
        <div className="mt-2 space-y-2 border-t border-line pt-2">
          {post.lastError ? <p className="text-[11px] text-critical">{post.lastError}</p> : null}
          <div className="flex items-center gap-1.5">
            <input
              type="datetime-local"
          aria-label="Reschedule this post"
              defaultValue={post.scheduledFor.slice(0, 16)}
              className="h-7 flex-1 rounded border border-line bg-white px-1.5 text-[11px]"
              onChange={(event) => {
                const value = event.target.value;
                if (!value) return;
                startTransition(() => reschedule(new Date(`${value}:00Z`).toISOString()));
              }}
            />
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => startTransition(() => publish())}>
              Publish now
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => startTransition(() => cancel())}>
              Remove
            </Button>
          </div>
        </div>
      ) : null}
      {open && post.externalUrl ? (
        <p className="mt-2 border-t border-line pt-2 text-[11px]">
          <a href={post.externalUrl} target="_blank" rel="noreferrer" className="text-accent-strong hover:underline">
            View live post
          </a>
        </p>
      ) : null}
    </div>
  );
}
