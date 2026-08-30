'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Keeps a page showing live job progress without reloading the document.
 *
 * This replaces `<meta http-equiv="refresh">`, which reloaded the whole page every few
 * seconds and threw away focus, caret position and screen-reader position each time —
 * a WCAG 2.2.1 failure with no way to stop it. `router.refresh()` re-renders the server
 * components in place, so focus survives, and the status line below is announced politely
 * rather than the page vanishing underneath the reader.
 */
export function AutoRefresh({
  intervalMs = 4000,
  label = 'Working…',
}: {
  intervalMs?: number;
  label?: string;
}) {
  const router = useRouter();
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [router, intervalMs, paused]);

  return (
    <div className="mt-3 flex items-center justify-center gap-3">
      <p aria-live="polite" className="text-[12px] text-ink-faint">
        {paused ? 'Live updates paused.' : label}
      </p>
      {/* 2.2.1 requires a way to turn off a moving/updating limit. */}
      <button
        type="button"
        onClick={() => setPaused((value) => !value)}
        className="rounded px-2 py-1 text-[12px] font-medium text-ink-soft underline hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {paused ? 'Resume' : 'Pause'}
      </button>
    </div>
  );
}
