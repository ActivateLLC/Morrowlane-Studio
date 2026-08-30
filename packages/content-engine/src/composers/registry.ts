import type { LocalComposer } from '../gateway/local.js';
import { composeContent } from './content.js';

/**
 * Every purpose the gateway is asked for needs a local composer, or the product
 * stops working without an API key. New generation purposes register here.
 */
export const LOCAL_COMPOSERS: Record<string, LocalComposer> = {
  generate_content: (brief) => composeContent(brief),
};
