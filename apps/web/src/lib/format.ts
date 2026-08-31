import { CHANNEL_PROFILES, type Channel, type ContentItem, type ScheduledPost } from '@morrowlane/shared';

/** Channels are stored as ids ("google_business"); people read names ("Google Business"). */
export function channelLabel(channel: string): string {
  return CHANNEL_PROFILES[channel as Channel]?.label ?? statusLabel(channel);
}

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
