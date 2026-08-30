import type { ContentItem, ScheduledPost } from '@morrowlane/shared';

export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

export function formatNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(Math.round(value));
}

export const STATUS_TONES: Record<ContentItem['status'] | ScheduledPost['status'], 'neutral' | 'accent' | 'positive' | 'caution' | 'critical'> = {
  draft: 'neutral',
  needs_review: 'caution',
  approved: 'accent',
  scheduled: 'accent',
  publishing: 'accent',
  published: 'positive',
  failed: 'critical',
  cancelled: 'neutral',
  archived: 'neutral',
};

export function statusLabel(status: string): string {
  return status.replace(/_/g, ' ');
}
