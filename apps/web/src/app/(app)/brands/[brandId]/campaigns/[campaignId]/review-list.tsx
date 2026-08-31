'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { Badge, Button } from '@morrowlane/ui';
import { channelLabel } from '@/lib/format';

export interface ReviewItem {
  id: string;
  title: string;
  body: string;
  format: string;
  channel: string;
  status: string;
  blocked: boolean;
  blockingMessage: string | null;
  phaseId: string | null;
}

export interface ReviewPhase {
  id: string;
  title: string;
  narrative: string;
  dayRange: string;
}

/**
 * The review surface. The plan used to list a title and a format per piece, so the one
 * thing a reviewer needs — the words that will actually be published — was invisible,
 * and the only control was a single button that approved and scheduled everything.
 *
 * This shows the copy, and turns approval into many small reversible decisions: select
 * what you want, approve or remove just those, and expand anything to read it in full.
 */
export function ReviewList({
  brandId,
  phases,
  items,
  approveSelected,
  removeSelected,
  saveBody,
}: {
  brandId: string;
  phases: ReviewPhase[];
  items: ReviewItem[];
  approveSelected: (contentIds: string[]) => Promise<{ approved: number; blocked: number }>;
  removeSelected: (contentIds: string[]) => Promise<void>;
  /** Saves a rewritten piece in place; rules are re-checked, so a fix can unblock it. */
  saveBody: (contentId: string, body: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectable = useMemo(() => items.filter((i) => !i.blocked && i.status !== 'published'), [items]);
  const allSelected = selectable.length > 0 && selectable.every((i) => selected.has(i.id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(selectable.map((i) => i.id)));

  const togglePhase = (phaseId: string | null) => {
    const ids = selectable.filter((i) => i.phaseId === phaseId).map((i) => i.id);
    const everyOn = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) (everyOn ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const run = (fn: () => Promise<void>) =>
    startTransition(async () => {
      setError(null);
      setMessage(null);
      try {
        await fn();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Something went wrong.');
      }
    });

  const ids = [...selected];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-[13px] text-ink-soft">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-5 w-5" />
          Select all {selectable.length} reviewable
        </label>
        <p aria-live="polite" className="text-[12px] text-ink-faint">
          {error ? <span className="text-critical">{error}</span> : message}
        </p>
      </div>

      {phases.map((phase) => {
        const phaseItems = items.filter((i) => i.phaseId === phase.id);
        if (phaseItems.length === 0) return null;
        return (
          <section key={phase.id} className="rounded-xl border border-line bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-ink">{phase.title}</h3>
                <p className="text-[12px] text-ink-faint">
                  {phase.dayRange} · {phaseItems.length} pieces
                </p>
              </div>
              <button
                type="button"
                onClick={() => togglePhase(phase.id)}
                className="min-h-11 rounded-lg px-2 text-[12px] font-medium text-accent-strong hover:underline"
              >
                Select this phase
              </button>
            </div>
            <ul className="divide-y divide-line">
              {phaseItems.map((item) => {
                const isOpen = expanded.has(item.id);
                return (
                  <li key={item.id} className="px-4 py-3">
                    <div className="flex gap-3">
                      <input
                        type="checkbox"
                        checked={selected.has(item.id)}
                        disabled={item.blocked}
                        onChange={() => toggle(item.id)}
                        aria-label={`Select ${item.title}`}
                        className="mt-1 h-5 w-5 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="text-[13px] font-medium text-ink">{item.title}</p>
                          <div className="flex shrink-0 items-center gap-1.5">
                            {item.blocked ? <Badge tone="critical">breaks a rule</Badge> : null}
                            <Badge tone="neutral">{channelLabel(item.channel)}</Badge>
                          </div>
                        </div>
                        {/* The words that will actually be published. */}
                        <p
                          className={`mt-1 whitespace-pre-line text-[13px] text-ink-soft ${isOpen ? '' : 'line-clamp-3'}`}
                        >
                          {item.body}
                        </p>
                        {item.blocked && item.blockingMessage ? (
                          <p className="mt-1.5 rounded bg-critical-soft px-2 py-1 text-[12px] text-critical">
                            {item.blockingMessage}
                          </p>
                        ) : null}
                        <div className="mt-1.5 flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            aria-expanded={isOpen}
                            onClick={() =>
                              setExpanded((prev) => {
                                const next = new Set(prev);
                                next.has(item.id) ? next.delete(item.id) : next.add(item.id);
                                return next;
                              })
                            }
                            className="min-h-11 text-[12px] font-medium text-ink-soft hover:text-ink"
                          >
                            {isOpen ? 'Show less' : 'Read all'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(item.id);
                              setDraft(item.body);
                            }}
                            className="min-h-11 text-[12px] font-medium text-accent-strong hover:underline"
                          >
                            Edit
                          </button>
                          <Link
                            href={`/brands/${brandId}/library/${item.id}`}
                            className="min-h-11 inline-flex items-center text-[12px] font-medium text-ink-soft hover:text-ink"
                          >
                            Open
                          </Link>
                        </div>
                        {editingId === item.id ? (
                          <div className="mt-2">
                            <textarea
                              value={draft}
                              onChange={(event) => setDraft(event.target.value)}
                              rows={8}
                              aria-label={`Edit ${item.title}`}
                              className="w-full rounded-lg border border-line bg-surface p-3 text-[13px] text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                            />
                            <div className="mt-2 flex gap-2">
                              <Button
                                size="sm"
                                disabled={pending}
                                onClick={() =>
                                  run(async () => {
                                    await saveBody(item.id, draft);
                                    setEditingId(null);
                                    setMessage('Saved. Brand rules were re-checked.');
                                  })
                                }
                              >
                                Save
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {/* Bulk bar: approval becomes small reversible steps instead of one commit. */}
      {ids.length > 0 ? (
        <div className="sticky bottom-20 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/40 bg-accent-soft px-4 py-3 shadow-lifted lg:bottom-4">
          <p className="text-[13px] font-medium text-ink">{ids.length} selected</p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const result = await approveSelected(ids);
                  setSelected(new Set());
                  setMessage(
                    `Kept ${result.approved}${result.blocked > 0 ? ` · ${result.blocked} held by a brand rule` : ''} — scroll up to schedule them.`,
                  );
                })
              }
            >
              Keep {ids.length}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  await removeSelected(ids);
                  setSelected(new Set());
                  setMessage('Removed from the plan.');
                })
              }
            >
              Remove
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
