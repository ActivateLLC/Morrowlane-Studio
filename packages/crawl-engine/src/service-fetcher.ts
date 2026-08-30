import { createLogger } from '@morrowlane/shared';
import type { FetchedDocument, Fetcher } from './fetcher.js';
import { createHttpFetcher } from './fetcher.js';

const log = createLogger('crawl-engine:service-fetcher');

/**
 * Fetcher backed by the services/crawler Crawl4AI service, for sites that need a real
 * browser. Falls back to the plain HTTP fetcher when the service is down, so a crawl
 * degrades instead of failing.
 */
export function createServiceFetcher(
  baseUrl = process.env['CRAWLER_SERVICE_URL'] ?? '',
  fallback: Fetcher = createHttpFetcher(),
): Fetcher {
  if (!baseUrl) return fallback;
  const endpoint = `${baseUrl.replace(/\/$/, '')}/fetch`;

  return {
    async fetch(url): Promise<FetchedDocument | null> {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url }),
          signal: AbortSignal.timeout(45_000),
        });
        if (!response.ok) throw new Error(`crawler service responded ${response.status}`);
        const payload = (await response.json()) as FetchedDocument;
        if (typeof payload.body !== 'string') throw new Error('crawler service returned no body');
        return payload;
      } catch (error) {
        log.warn('crawler service unavailable, using plain HTTP', {
          url,
          error: error instanceof Error ? error.message : String(error),
        });
        return fallback.fetch(url);
      }
    },
  };
}
