'use client';

import { useState, useTransition } from 'react';
import { Button, Input, Label, Textarea } from '@morrowlane/ui';

/** Click to edit; saving locks the field against future re-analysis. */
export function EditableField({
  label,
  value,
  save,
  multiline = false,
  hint,
}: {
  label: string;
  value: string;
  save: (value: string) => Promise<void>;
  multiline?: boolean;
  hint?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [pending, startTransition] = useTransition();

  if (!editing) {
    return (
      <div>
        <Label>{label}</Label>
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
      <Label>{label}</Label>
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
