import type { CrawledPage } from '@morrowlane/shared';

export type { BrandBrain } from '@morrowlane/shared';

/** The subset of a crawl summary the pipelines depend on. */
export interface CrawlSummaryLike {
  pages: CrawledPage[];
  colors: string[];
  socialLinks: string[];
}
