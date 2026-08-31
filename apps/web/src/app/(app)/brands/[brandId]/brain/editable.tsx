'use client';

import { useState, useTransition } from 'react';
import { Button, Input, Label, Textarea } from '@morrowlane/ui';

function PencilIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

/** Click to edit; saving locks the field against future re-analysis. */
export function EditableField({
  label,
  value,
  save,
  unlock,
  multiline = false,
  hint,
  locked = false,
}: {
  label: string;
  value: string;
  save: (value: string) => Promise<void>;
  /** Releases the field back to re-analysis. Without it, one edit forfeits enrichment. */
  unlock?: () => Promise<void>;
  multiline?: boolean;
  hint?: string;
  locked?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [pending, startTransition] = useTransition();

  const labelRow = (
    <div className="flex items-center gap-1.5">
      <Label>{label}</Label>
      {locked ? (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent-strong"
          title="You edited this field, so re-analysis won't overwrite it."
        >
          <LockIcon /> Locked
        </span>
      ) : null}
    </div>
  );

  if (!editing) {
    return (
      <div>
        {labelRow}
        <button
          type="button"
          onClick={() => {
            setDraft(value);
            setEditing(true);
          }}
          className="flex w-full items-start justify-between gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-ink hover:bg-surface-sunken"
        >
          {value ? <span className="whitespace-pre-line">{value}</span> : <span className="text-ink-faint">Add…</span>}
          <span className="mt-0.5 shrink-0 text-ink-faint">
            <PencilIcon />
          </span>
        </button>
      </div>
    );
  }

  return (
    <div>
      {labelRow}
      {multiline ? (
        <Textarea rows={Math.min(8, Math.max(2, draft.split('\n').length + 1))} value={draft} onChange={(e) => setDraft(e.target.value)} />
      ) : (
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} />
      )}
      {hint ? <p className="mt-1 text-[11px] text-ink-faint">{hint}</p> : null}
      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await save(draft);
              setEditing(false);
            })
          }
        >
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
        {locked && unlock ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await unlock();
                setEditing(false);
              })
            }
          >
            Unlock
          </Button>
        ) : null}
      </div>
      {/* Said at the moment of commitment, not in a hover tooltip no phone can show. */}
      <p className="mt-1.5 text-[11px] text-ink-faint">
        {locked
          ? 'This field is yours — re-reading your website will not overwrite it. Unlock to let it update again.'
          : 'Saving locks this field, so re-reading your website will not overwrite it.'}
      </p>
    </div>
  );
}
