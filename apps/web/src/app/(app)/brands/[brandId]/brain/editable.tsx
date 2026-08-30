'use client';

import { useState, useTransition } from 'react';
import { Button, Input, Label, Textarea } from '@morrowlane/ui';

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
  multiline = false,
  hint,
  locked = false,
}: {
  label: string;
  value: string;
  save: (value: string) => Promise<void>;
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
          className="w-full rounded-lg px-3 py-2 text-left text-[13px] text-ink hover:bg-surface-sunken"
        >
          {value ? <span className="whitespace-pre-line">{value}</span> : <span className="text-ink-faint">Add…</span>}
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
      </div>
    </div>
  );
}
