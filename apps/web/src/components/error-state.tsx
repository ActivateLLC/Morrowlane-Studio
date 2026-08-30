'use client';

import { useEffect } from 'react';
import { Button } from '@morrowlane/ui';

/**
 * Shared recoverable-error view for the route `error.tsx` boundaries. Catches errors
 * thrown while rendering a page or running a plain-form server action (e.g. a
 * ValidationError from a bad URL or duplicate name) so the user sees a friendly,
 * retryable message instead of Next's raw error screen. Next redacts server-action
 * error messages in production, so we fall back to a generic line there.
 */
export function ErrorState({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  const message =
    error.message && !error.message.startsWith('An error occurred in the Server')
      ? error.message
      : 'Something went wrong handling that action. Check your input and try again.';

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-critical-soft text-critical" aria-hidden>
        <span className="text-xl">!</span>
      </div>
      <div className="space-y-1">
        <h1 className="text-base font-semibold text-ink">That didn&apos;t go through</h1>
        <p className="text-[13px] text-ink-faint">{message}</p>
      </div>
      <Button onClick={reset}>Try again</Button>
      {error.digest ? <p className="text-[11px] text-ink-faint/70">Reference: {error.digest}</p> : null}
    </div>
  );
}
