'use client';

import { useState, useTransition } from 'react';
import { Button, Select } from '@morrowlane/ui';

/**
 * The listening test. Reading a list of voice traits tells you very little about what
 * the writing will sound like, so this writes three openers from the Brain as it stands
 * right now — and nothing is saved, so trying it costs nothing.
 */
export function VoicePreview({
  products,
  preview,
}: {
  products: string[];
  preview: (formData: FormData) => Promise<{ samples: string[]; error: string | null }>;
}) {
  const [samples, setSamples] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <form
        action={(formData) =>
          startTransition(async () => {
            setError(null);
            const result = await preview(formData);
            setSamples(result.samples);
            setError(result.error);
          })
        }
        className="flex flex-wrap items-end gap-2"
      >
        {products.length > 0 ? (
          <Select name="productName" aria-label="What to write about" defaultValue="" className="max-w-56">
            <option value="">Whole brand</option>
            {products.map((product) => (
              <option key={product} value={product}>
                {product}
              </option>
            ))}
          </Select>
        ) : null}
        <Button type="submit" variant="secondary" size="sm" disabled={pending}>
          {pending ? 'Writing…' : samples.length > 0 ? 'Try again' : 'Write 3 samples'}
        </Button>
      </form>

      {error ? <p className="text-[12px] text-critical">{error}</p> : null}

      {samples.length > 0 ? (
        <div aria-live="polite" className="space-y-2">
          {samples.map((sample, index) => (
            <p key={`${sample}-${index}`} className="rounded-lg bg-surface-sunken px-3 py-2 text-[13px] text-ink">
              {sample}
            </p>
          ))}
          <p className="text-[12px] text-ink-faint">
            Sounds wrong? Change the voice below — samples use your edits straight away. Nothing here is saved.
          </p>
        </div>
      ) : null}
    </div>
  );
}
