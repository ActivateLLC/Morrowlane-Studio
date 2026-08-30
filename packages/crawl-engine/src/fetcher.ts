import { createLogger } from '@morrowlane/shared';

const log = createLogger('crawl-engine:fetcher');

export interface FetchedDocument {
  url: string;
  finalUrl: string;
  status: number;
  contentType: string;
  body: string;
}

export interface Fetcher {
  fetch(url: string): Promise<FetchedDocument | null>;
}

export interface HttpFetcherOptions {
  userAgent?: string;
  timeoutMs?: number;
  maxBytes?: number;
  /** Minimum gap between requests to one host. Politeness, not rate limiting. */
  delayMs?: number;
}

const DEFAULT_USER_AGENT =
  'MorrowlaneBot/0.1 (+https://morrowlane.com/bot; content marketing intelligence)';

/**
 * Plain HTTP fetcher. Sites that need JavaScript execution are handled by the
 * `services/crawler` Crawl4AI service, which implements this same interface.
 */
export function createHttpFetcher(options: HttpFetcherOptions = {}): Fetcher {
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const maxBytes = options.maxBytes ?? 2_000_000;
  const delayMs = options.delayMs ?? 250;
  const lastHitByHost = new Map<string, number>();

  return {
    async fetch(url) {
      let host: string;
      try {
        host = new URL(url).host;
      } catch {
        return null;
      }

      const since = Date.now() - (lastHitByHost.get(host) ?? 0);
      if (since < delayMs) await new Promise((r) => setTimeout(r, delayMs - since));
      lastHitByHost.set(host, Date.now());

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, {
          redirect: 'follow',
          signal: controller.signal,
          headers: { 'user-agent': userAgent, accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
        });
        const contentType = response.headers.get('content-type') ?? '';
        if (!response.ok) {
          log.debug('non-ok response', { url, status: response.status });
          return { url, finalUrl: response.url || url, status: response.status, contentType, body: '' };
        }
        if (!/(text\/html|xml|text\/plain|json)/i.test(contentType)) {
          return { url, finalUrl: response.url || url, status: response.status, contentType, body: '' };
        }
        const body = await readCapped(response, maxBytes);
        return { url, finalUrl: response.url || url, status: response.status, contentType, body };
      } catch (error) {
        log.debug('fetch failed', { url, error: error instanceof Error ? error.message : String(error) });
        return null;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

async function readCapped(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return response.text();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    chunks.push(decoder.decode(value, { stream: true }));
    if (total >= maxBytes) {
      await reader.cancel();
      break;
    }
  }
  chunks.push(decoder.decode());
  return chunks.join('');
}

/** Fetcher backed by a fixed map — used by tests and by the demo brand seed. */
export function createStaticFetcher(pages: Record<string, string>): Fetcher {
  return {
    async fetch(url) {
      const body = pages[url] ?? pages[url.replace(/\/$/, '')];
      if (body === undefined) return null;
      const isXml = url.includes('sitemap') || url.endsWith('.xml');
      return {
        url,
        finalUrl: url,
        status: 200,
        contentType: isXml ? 'application/xml' : 'text/html',
        body,
      };
    },
  };
}
