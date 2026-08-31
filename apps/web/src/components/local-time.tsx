'use client';

import { useEffect, useState } from 'react';

/**
 * Times are stored in UTC and were rendered in UTC, so a user in Denver read "9:05am"
 * for a post that goes out at 3:05am their time. This renders the server's UTC string
 * first (so SSR and the first paint agree) and swaps to the viewer's own timezone once
 * hydrated, labelling the zone the first time it appears on a screen.
 */
export function LocalTime({
  iso,
  mode = 'datetime',
  showZone = false,
  className,
}: {
  iso: string;
  mode?: 'datetime' | 'day' | 'time';
  showZone?: boolean;
  className?: string;
}) {
  const [local, setLocal] = useState<string | null>(null);

  useEffect(() => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return;
    const options: Intl.DateTimeFormatOptions =
      mode === 'day'
        ? { month: 'short', day: 'numeric' }
        : mode === 'time'
          ? { hour: 'numeric', minute: '2-digit' }
          : { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
    if (showZone && mode !== 'day') options.timeZoneName = 'short';
    setLocal(date.toLocaleString('en-US', options));
  }, [iso, mode, showZone]);

  return (
    <span className={className} suppressHydrationWarning>
      {local ?? serverFallback(iso, mode)}
    </span>
  );
}

/** Matches the previous UTC rendering exactly, so nothing shifts before hydration. */
function serverFallback(iso: string, mode: 'datetime' | 'day' | 'time'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  if (mode === 'day') return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  if (mode === 'time') {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
  }
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}
