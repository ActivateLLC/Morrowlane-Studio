import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/**/src/**/*.test.ts', 'apps/**/src/**/*.test.ts'],
    passWithNoTests: false,
  },
  resolve: {
    alias: {
      '@morrowlane/shared': new URL('./packages/shared/src/index.ts', import.meta.url).pathname,
      '@morrowlane/database': new URL('./packages/database/src/index.ts', import.meta.url).pathname,
      '@morrowlane/crawl-engine': new URL('./packages/crawl-engine/src/index.ts', import.meta.url).pathname,
      '@morrowlane/brand-engine': new URL('./packages/brand-engine/src/index.ts', import.meta.url).pathname,
      '@morrowlane/content-engine': new URL('./packages/content-engine/src/index.ts', import.meta.url).pathname,
      '@morrowlane/campaign-engine': new URL('./packages/campaign-engine/src/index.ts', import.meta.url).pathname,
      '@morrowlane/creative-engine': new URL('./packages/creative-engine/src/index.ts', import.meta.url).pathname,
      '@morrowlane/social': new URL('./packages/social/src/index.ts', import.meta.url).pathname,
      '@morrowlane/analytics': new URL('./packages/analytics/src/index.ts', import.meta.url).pathname,
      '@morrowlane/agents': new URL('./packages/agents/src/index.ts', import.meta.url).pathname,
      '@morrowlane/integrations': new URL('./packages/integrations/src/index.ts', import.meta.url).pathname,
    },
  },
});
