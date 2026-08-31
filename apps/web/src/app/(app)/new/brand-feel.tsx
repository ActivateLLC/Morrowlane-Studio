'use client';

import { useState } from 'react';
import { Input } from '@morrowlane/ui';

const FEELS = ['Professional', 'Bold', 'Warm', 'Luxury', 'Playful', 'Minimal', 'Educational', 'Custom'];

/**
 * Picking "Custom" used to send the AI the literal word "custom" — a dead end wearing a
 * chip. It now reveals the field that makes the choice mean something. Nothing is
 * pre-selected: an invisible default is a choice the user never knowingly made.
 */
export function BrandFeel() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <fieldset>
      <legend className="mb-1 block text-[13px] font-medium text-ink-soft">Choose a general brand feel</legend>
      <div className="flex flex-wrap gap-2 pt-1">
        {FEELS.map((feel) => (
          <label
            key={feel}
            className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-line px-4 text-[13px] text-ink-soft transition hover:border-accent/50 has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent-strong has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-strong"
          >
            {/* The radios name a choice; a separate field carries the value that is
                submitted, so picking "Custom" cannot leave a required radio group
                unsatisfied and silently block the form. */}
            <input
              type="radio"
              name="brandFeelChoice"
              value={feel.toLowerCase()}
              checked={selected === feel}
              onChange={() => setSelected(feel)}
              required
              className="sr-only"
            />
            {feel}
          </label>
        ))}
      </div>
      {selected === 'Custom' ? (
        <div className="mt-3">
          <Input
            name="brandFeel"
            autoFocus
            required
            aria-label="Describe your brand feel"
            placeholder="Calm and unhurried, like a good hardware shop"
          />
        </div>
      ) : (
        <input type="hidden" name="brandFeel" value={selected ? selected.toLowerCase() : ''} />
      )}
    </fieldset>
  );
}
