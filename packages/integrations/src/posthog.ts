import type { AttributionStage } from '@morrowlane/shared';

/**
 * Maps PostHog webhook payloads onto Morrowlane attribution events, so a deployment
 * that instruments its site with PostHog can pipe funnel outcomes straight into
 * `POST /v1/events` and the learning loop.
 */

export interface PostHogWebhookEvent {
  event?: unknown;
  distinct_id?: unknown;
  properties?: Record<string, unknown>;
  timestamp?: unknown;
}

/** Event-name mapping. Deployments override this to match their own taxonomy. */
export const DEFAULT_EVENT_STAGES: Record<string, AttributionStage> = {
  $pageview: 'visit',
  lead_created: 'lead',
  signup_completed: 'lead',
  customer_created: 'customer',
  purchase_completed: 'revenue',
  subscription_started: 'revenue',
};

export interface MappedEvent {
  stage: AttributionStage;
  contentId: string | null;
  value: number;
  currency: string | null;
  occurredAt: string | undefined;
  metadata: Record<string, unknown>;
}

export function mapPostHogEvent(
  payload: PostHogWebhookEvent,
  stages: Record<string, AttributionStage> = DEFAULT_EVENT_STAGES,
): MappedEvent | null {
  const name = typeof payload.event === 'string' ? payload.event : '';
  const stage = stages[name];
  if (!stage) return null;

  const properties = payload.properties ?? {};
  // Morrowlane links a visit back to its post via the mwl_content UTM parameter the
  // publishers append; PostHog surfaces it as a property.
  const contentId =
    typeof properties['mwl_content'] === 'string'
      ? properties['mwl_content']
      : typeof properties['utm_content'] === 'string' && properties['utm_content'].startsWith('cnt_')
        ? properties['utm_content']
        : null;

  const revenue = properties['revenue'] ?? properties['value'] ?? properties['amount'];

  return {
    stage,
    contentId,
    value: stage === 'revenue' && typeof revenue === 'number' && Number.isFinite(revenue) ? revenue : 1,
    currency: typeof properties['currency'] === 'string' ? properties['currency'] : null,
    occurredAt: typeof payload.timestamp === 'string' ? new Date(payload.timestamp).toISOString() : undefined,
    metadata: { source: 'posthog', event: name, distinctId: payload.distinct_id ?? null },
  };
}
