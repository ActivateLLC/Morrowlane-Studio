import type { LocalComposer } from '@morrowlane/content-engine';
import { composeBrandBrain } from './composer.js';

/** Local composers this package contributes to the gateway. */
export const BRAND_COMPOSERS: Record<string, LocalComposer> = {
  build_brand_brain: (brief) => composeBrandBrain(brief),
};
