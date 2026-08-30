import type { BrandBrain, CrawlSummaryLike } from './types.js';
import { buildBrandBrain } from '@morrowlane/brand-engine';
import type { AiGateway } from '@morrowlane/content-engine';
import { crawlSite, createHttpFetcher, type Fetcher } from '@morrowlane/crawl-engine';
import type { DataStore } from '@morrowlane/database';
import { createLogger } from '@morrowlane/shared';
import { runGraph, type GraphStep, type StepContext } from './graph.js';

const log = createLogger('agents:onboarding');

export interface OnboardingState {
  brandId: string;
  websiteUrl: string;
  maxPages: number;
  summary: CrawlSummaryLike | null;
  brain: BrandBrain | null;
}

export interface OnboardingDeps {
  store: DataStore;
  gateway: AiGateway;
  fetcher?: Fetcher;
}

/**
 * Milestones 3 and 4 as one pipeline: paste a URL, get a reviewable Brand Brain.
 * Each step writes its result before the next runs, so a failure late in the graph
 * still leaves the user with what was learned.
 */
export function onboardingSteps(deps: OnboardingDeps): Array<GraphStep<OnboardingState>> {
  const fetcher = deps.fetcher ?? createHttpFetcher();

  return [
    {
      name: 'Reading the website',
      async run(state, context) {
        await deps.store.updateBrand(state.brandId, { status: 'crawling', statusDetail: 'Discovering pages' });

        const summary = await crawlSite(state.websiteUrl, fetcher, {
          brandId: state.brandId,
          maxPages: state.maxPages,
          onProgress: ({ fetched, total, url }) => {
            // Crawling is the slow half, so it owns the first 70% of the progress bar.
            void context.progress(0.05 + (fetched / Math.max(1, total)) * 0.65, `Read ${fetched} of ${total}: ${url}`);
          },
        });

        if (summary.pages.length === 0) {
          throw new Error(
            'No readable pages were found at that address. Check the URL, or whether the site blocks crawlers in robots.txt.',
          );
        }

        await deps.store.replacePages(state.brandId, summary.pages);
        log.info('crawl stored', { brandId: state.brandId, pages: summary.pages.length });
        return { summary };
      },
    },
    {
      name: 'Understanding the business',
      when: (state) => state.summary !== null,
      async run(state) {
        await deps.store.updateBrand(state.brandId, {
          status: 'analyzing',
          statusDetail: `Analysing ${state.summary!.pages.length} pages`,
        });

        const previous = await deps.store.getBrain(state.brandId);
        const brain = await buildBrandBrain(deps.gateway, {
          brandId: state.brandId,
          websiteUrl: state.websiteUrl,
          pages: state.summary!.pages,
          siteColors: state.summary!.colors,
          siteSocialLinks: state.summary!.socialLinks,
          previous,
        });

        await deps.store.saveBrain(brain);
        return { brain };
      },
    },
    {
      name: 'Finishing up',
      async run(state) {
        const name = state.brain?.identity.companyName;
        await deps.store.updateBrand(state.brandId, {
          status: 'ready',
          statusDetail: null,
          ...(name ? { name } : {}),
        });
        return {};
      },
    },
  ];
}

export async function runOnboarding(
  deps: OnboardingDeps,
  input: { brandId: string; websiteUrl: string; maxPages?: number },
  context: StepContext,
) {
  const result = await runGraph(
    onboardingSteps(deps),
    {
      brandId: input.brandId,
      websiteUrl: input.websiteUrl,
      maxPages: input.maxPages ?? 60,
      summary: null,
      brain: null,
    },
    context,
  );

  if (result.failed.length > 0) {
    await deps.store.updateBrand(input.brandId, {
      status: 'failed',
      statusDetail: result.failed[0]!.error,
    });
  }

  return result;
}
