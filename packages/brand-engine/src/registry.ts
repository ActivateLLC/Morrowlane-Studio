import type { LocalComposer } from '@morrowlane/content-engine';
import { composeBrandBrain } from './composer.js';

/** Local composers this package contributes to the gateway. */
export const BRAND_COMPOSERS: Record<string, LocalComposer> = {
  build_brand_brain: (brief) => composeBrandBrain(brief),
  // The Brand Builder brief carries the same `observed` shape, so the crawl-free path
  // composes offline too when no model provider is configured.
  build_brand_profile: (brief) => composeBrandBrain(brief),
};
