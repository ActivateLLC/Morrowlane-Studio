'use client';

import { useEffect, useState } from 'react';
import { CHANNEL_PROFILES, type Channel } from '@morrowlane/shared';

/**
 * The size of the run, before the run. Users learned they had 39 pieces to review only
 * after waiting for generation; the planner's math is deterministic, so the contract can
 * be stated up front. Mirrors planCampaign(): round(days / 7 * 3 * channels), floored at
 * one post per channel.
 */
export function SizePreview({ formId }: { formId: string }) {
  const [summary, setSummary] = useState<string | null>(null);

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;

    const recompute = () => {
      const data = new FormData(form);
      const days = Number(data.get('durationDays') ?? 30);
      const channels = data.getAll('channels').map(String);
      if (channels.length === 0 || !Number.isFinite(days)) {
        setSummary(null);
        return;
      }
      const posts = Math.max(channels.length, Math.round((days / 7) * 3 * channels.length));
      const names = channels.map((channel) => CHANNEL_PROFILES[channel as Channel]?.label ?? channel);
      const channelText =
        names.length === 1
          ? names[0]
          : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
      setSummary(`About ${posts} posts across ${channelText} over ${days} days — you approve every one first.`);
    };

    recompute();
    form.addEventListener('change', recompute);
    return () => form.removeEventListener('change', recompute);
  }, [formId]);

  if (!summary) return null;
  return (
    <p className="rounded-lg bg-accent-soft px-4 py-3 text-[13px] text-accent-strong" aria-live="polite">
      {summary}
    </p>
  );
}
