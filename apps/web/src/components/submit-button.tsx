'use client';

import { useFormStatus } from 'react-dom';
import { Button, type ButtonProps } from '@morrowlane/ui';

/**
 * A submit button that reports its own progress. Several of these actions run a crawl or
 * a full campaign generation, which with a real model provider takes tens of seconds —
 * long enough that a button which stays live and silent reads as broken, and invites a
 * second click that creates a second campaign.
 */
export function SubmitButton({
  children,
  pendingLabel = 'Working…',
  hint,
  ...props
}: ButtonProps & { pendingLabel?: string; hint?: string }) {
  const { pending } = useFormStatus();
  return (
    <span className="inline-flex flex-col gap-1">
      <Button {...props} type="submit" disabled={pending || props.disabled}>
        {pending ? pendingLabel : children}
      </Button>
      {hint && pending ? (
        <span aria-live="polite" className="text-[11px] text-ink-faint">
          {hint}
        </span>
      ) : null}
    </span>
  );
}
