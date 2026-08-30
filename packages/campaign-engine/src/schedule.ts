import type { Campaign, Channel, ContentItem, ScheduledPost } from '@morrowlane/shared';
import { addDays, atHour, dayKey, newId, startOfUtcDay } from '@morrowlane/shared';

/**
 * Default posting windows in the brand's local hours. These are starting points that
 * the analytics package overwrites per brand once it has enough data — a guess that
 * gets corrected beats an empty calendar.
 */
export const DEFAULT_SLOT_HOURS: Record<Channel, number[]> = {
  instagram: [11, 19],
  facebook: [9, 15],
  tiktok: [12, 20],
  linkedin: [8, 12],
  x: [9, 13, 17],
  threads: [10, 18],
  youtube: [16],
  pinterest: [20],
  google_business: [10],
  bluesky: [9, 16],
  blog: [7],
  email: [7],
};

export interface ScheduleOptions {
  startDate: string;
  days: number;
  /** Channel-specific hour lists, learned from performance where available. */
  slotHours?: Partial<Record<Channel, number[]>>;
  /** Days of the week to skip, 0 = Sunday. */
  skipWeekdays?: number[];
  /** Never place two posts on the same channel closer than this. */
  minGapHours?: number;
  connectionByChannel?: Partial<Record<Channel, string>>;
}

/**
 * Spreads content across a date range without ever double-booking a channel slot.
 * Items keep their relative order, so a campaign's argument survives scheduling.
 */
export function scheduleContent(items: ContentItem[], options: ScheduleOptions): ScheduledPost[] {
  const start = startOfUtcDay(options.startDate);
  const days = Math.max(1, options.days);
  const minGapHours = options.minGapHours ?? 6;
  const skip = new Set(options.skipWeekdays ?? []);

  const byChannel = new Map<Channel, ContentItem[]>();
  for (const item of items) {
    const bucket = byChannel.get(item.channel);
    if (bucket) bucket.push(item);
    else byChannel.set(item.channel, [item]);
  }

  const posts: ScheduledPost[] = [];

  for (const [channel, channelItems] of byChannel) {
    const hours = options.slotHours?.[channel] ?? DEFAULT_SLOT_HOURS[channel] ?? [12];
    const slots = buildSlots(start, days, hours, skip, minGapHours, channelItems.length);

    channelItems.forEach((item, index) => {
      // Wrapping is better than dropping: an over-full month compresses rather than losing posts.
      const slot = slots[index % slots.length] ?? atHour(addDays(start, index % days), hours[0] ?? 12);
      posts.push({
        id: newId('schedule'),
        brandId: item.brandId,
        contentId: item.id,
        connectionId: options.connectionByChannel?.[channel] ?? null,
        channel,
        scheduledFor: slot,
        status: 'scheduled',
        attempts: 0,
        lastError: null,
        externalPostId: null,
        externalUrl: null,
        publishedAt: null,
      });
    });
  }

  return posts.sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
}

function buildSlots(
  start: string,
  days: number,
  hours: number[],
  skipWeekdays: Set<number>,
  minGapHours: number,
  needed: number,
): string[] {
  const slots: string[] = [];
  const sortedHours = [...hours].sort((a, b) => a - b);

  for (let day = 0; day < days && slots.length < needed; day += 1) {
    const date = addDays(start, day);
    if (skipWeekdays.has(new Date(date).getUTCDay())) continue;

    let lastHour: number | null = null;
    for (const hour of sortedHours) {
      if (lastHour !== null && hour - lastHour < minGapHours) continue;
      slots.push(atHour(date, hour));
      lastHour = hour;
      if (slots.length >= needed) break;
    }
  }

  // A dense request gets a second pass over the same days rather than an empty calendar.
  if (slots.length === 0) slots.push(atHour(start, sortedHours[0] ?? 12));
  return slots;
}

/**
 * Distributes a campaign's content into its phases' day ranges, so a phase's posts
 * land inside that phase rather than being spread evenly across the whole run.
 */
export function scheduleCampaign(
  campaign: Campaign,
  items: ContentItem[],
  options: Omit<ScheduleOptions, 'startDate' | 'days'> = {},
): ScheduledPost[] {
  const posts: ScheduledPost[] = [];

  for (const phase of campaign.phases) {
    const phaseItems = items.filter((item) => item.campaignPhaseId === phase.id);
    if (phaseItems.length === 0) continue;

    posts.push(
      ...scheduleContent(phaseItems, {
        ...options,
        startDate: addDays(campaign.startDate, phase.startDay),
        days: Math.max(1, phase.endDay - phase.startDay + 1),
      }),
    );
  }

  const unphased = items.filter((item) => !item.campaignPhaseId);
  if (unphased.length > 0) {
    posts.push(
      ...scheduleContent(unphased, { ...options, startDate: campaign.startDate, days: campaign.durationDays }),
    );
  }

  return posts.sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
}

/** Calendar view model: posts grouped by day, ready to render. */
export function groupByDay(posts: ScheduledPost[]): Map<string, ScheduledPost[]> {
  const grouped = new Map<string, ScheduledPost[]>();
  for (const post of posts) {
    const key = dayKey(post.scheduledFor);
    const bucket = grouped.get(key);
    if (bucket) bucket.push(post);
    else grouped.set(key, [post]);
  }
  for (const bucket of grouped.values()) bucket.sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
  return grouped;
}
