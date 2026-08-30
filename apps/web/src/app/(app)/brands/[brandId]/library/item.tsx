'use client';

import { useState, useTransition } from 'react';
import type { ContentItem } from '@morrowlane/shared';
import { Badge, Button, Card, CardBody, Textarea } from '@morrowlane/ui';
import { STATUS_TONES, statusLabel } from '@/lib/format';

export function LibraryItem({
  item,
  approve,
  remove,
  saveBody,
  schedule,
}: {
  item: ContentItem;
  approve: () => Promise<void>;
  remove: () => Promise<void>;
  saveBody: (body: string) => Promise<void>;
  schedule: (scheduledFor: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(item.body);
  const [when, setWhen] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const blocking = item.violations.filter((violation) => violation.severity === 'error');
  const warnings = item.violations.filter((violation) => violation.severity === 'warning');

  const act = (fn: () => Promise<void>) =>
    startTransition(async () => {
      setError(null);
      try {
        await fn();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Something went wrong.');
      }
    });

  return (
    <Card className={pending ? 'opacity-60' : undefined}>
      <CardBody className="py-4">
        <button type="button" className="w-full text-left" onClick={() => setOpen((value) => !value)}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-ink">{item.title}</p>
            <div className="flex items-center gap-2">
              {blocking.length > 0 ? <Badge tone="critical">rule violation</Badge> : null}
              <Badge tone={STATUS_TONES[item.status]}>{statusLabel(item.status)}</Badge>
            </div>
          </div>
          <p className="mt-1 text-[12px] text-ink-faint">
            {statusLabel(item.format)} · {item.channel}
            {item.lineage.sourceUrl ? ` · from ${item.lineage.sourceUrl}` : ''}
            {item.campaignId ? ' · campaign' : ''}
          </p>
          {!open ? <p className="mt-2 line-clamp-2 whitespace-pre-line text-[13px] text-ink-soft">{item.body}</p> : null}
        </button>

        {open ? (
          <div className="mt-3 space-y-3 border-t border-line pt-3">
            {error ? <p className="text-[12px] text-critical">{error}</p> : null}

            {blocking.map((violation) => (
              <p key={violation.message} className="rounded bg-critical-soft px-3 py-2 text-[12px] text-critical">
                {violation.message}
                {violation.excerpt ? <span className="mt-0.5 block opacity-75">“{violation.excerpt}”</span> : null}
              </p>
            ))}
            {warnings.map((violation) => (
              <p key={violation.message} className="rounded bg-caution-soft px-3 py-2 text-[12px] text-caution">
                {violation.message}
              </p>
            ))}

            {editing ? (
              <div className="space-y-2">
                <Textarea rows={6} value={body} onChange={(event) => setBody(event.target.value)} />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      act(async () => {
                        await saveBody(body);
                        setEditing(false);
                      })
                    }
                  >
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="whitespace-pre-line text-[13px] text-ink-soft">{item.body}</p>
            )}

            {item.segments.length > 0 && !editing ? (
              <ol className="space-y-1.5">
                {item.segments.map((segment) => (
                  <li key={segment.index} className="rounded-lg bg-surface-sunken px-3 py-2 text-[12px] text-ink-soft">
                    {segment.heading ? <span className="font-medium text-ink">{segment.heading}: </span> : null}
                    {segment.body}
                  </li>
                ))}
              </ol>
            ) : null}

            {item.hashtags.length > 0 ? (
              <p className="text-[12px] text-accent">{item.hashtags.join(' ')}</p>
            ) : null}

            {!editing ? (
              <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                {item.status === 'draft' || item.status === 'needs_review' ? (
                  <Button size="sm" disabled={pending || blocking.length > 0} onClick={() => act(approve)}>
                    Approve
                  </Button>
                ) : null}
                {(item.status === 'approved' || item.status === 'draft') && blocking.length === 0 ? (
                  <span className="flex items-center gap-1.5">
                    <input
                      type="datetime-local"
                      value={when}
                      onChange={(event) => setWhen(event.target.value)}
                      className="h-8 rounded border border-line bg-white px-2 text-[12px]"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={pending || !when}
                      onClick={() => act(() => schedule(new Date(`${when}:00Z`).toISOString()))}
                    >
                      Schedule
                    </Button>
                  </span>
                ) : null}
                <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(remove)}>
                  Delete
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
