import { pathSegments } from '@morrowlane/shared';

/**
 * Not every page teaches us the same amount about a business. Pricing, product and
 * about pages define the brand; a paginated tag archive does not. Crawl budget follows
 * this score, so the first 40 pages fetched are the 40 that matter most.
 */
const HIGH_VALUE = /^(pricing|plans?|products?|services?|solutions?|about|faqs?|testimonials?|reviews?|case-stud(y|ies)|features?|how-it-works|why-us)$/i;
const MEDIUM_VALUE = /^(blog|resources?|guides?|learn|insights?|news|articles?|shop|collections?|contact|customers)$/i;
const LOW_VALUE = /^(privacy|terms|legal|cookies?|accessibility|sitemap|search|login|signin|register|cart|checkout|account|author|tag|tags|category|categories|page|feed|archive|wp-|amp)$/i;

export function scorePriority(url: string): number {
  const segments = pathSegments(url);
  if (segments.length === 0) return 100;

  let score = 50;
  const first = segments[0]!;

  if (HIGH_VALUE.test(first)) score += 30;
  else if (MEDIUM_VALUE.test(first)) score += 12;
  if (LOW_VALUE.test(first)) score -= 45;

  for (const segment of segments) {
    if (LOW_VALUE.test(segment)) score -= 20;
    if (/^\d+$/.test(segment)) score -= 8; // pagination and id-only segments
  }

  // Deep pages are usually leaves of an archive rather than positioning pages.
  score -= Math.max(0, segments.length - 2) * 6;

  if (/\.(pdf|zip|jpg|jpeg|png|gif|webp|mp4|mp3|css|js)$/i.test(url)) score -= 60;
  if (url.includes('?')) score -= 10;

  return score;
}
