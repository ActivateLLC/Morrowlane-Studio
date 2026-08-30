import { createServer } from 'node:http';
import { recordEvent } from '@morrowlane/analytics';
import { createRuntime } from '@morrowlane/agents';
import { ATTRIBUTION_STAGES, createLogger, toHttpError, type AttributionStage } from '@morrowlane/shared';

const log = createLogger('api:main');

/**
 * The ingestion API: the small public surface that exists outside the web app.
 *
 *   POST /v1/events   — attribution events from a site pixel, a PostHog webhook, or a
 *                       CRM integration: visits, leads, customers, revenue. This is how
 *                       the funnel extends past the platforms into business outcomes.
 *   GET  /healthz     — liveness.
 *
 * Authenticated with a per-deployment ingest key. Kept separate from the web app so it
 * can scale and be firewalled independently.
 */
const runtime = createRuntime();
const port = Number(process.env['PORT'] ?? 4000);
const ingestKey = process.env['MORROWLANE_INGEST_KEY'] ?? '';

interface IncomingEvent {
  brandId?: unknown;
  contentId?: unknown;
  scheduledPostId?: unknown;
  stage?: unknown;
  value?: unknown;
  currency?: unknown;
  occurredAt?: unknown;
  metadata?: unknown;
}

const server = createServer(async (request, response) => {
  const reply = (status: number, body: unknown) => {
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body));
  };

  try {
    if (request.method === 'GET' && request.url === '/healthz') {
      return reply(200, { ok: true });
    }

    if (request.method === 'POST' && request.url === '/v1/events') {
      if (!ingestKey) {
        return reply(503, { error: 'Set MORROWLANE_INGEST_KEY to enable event ingestion.' });
      }
      const auth = request.headers.authorization ?? '';
      if (auth !== `Bearer ${ingestKey}`) {
        return reply(401, { error: 'Invalid ingest key.' });
      }

      const raw = await readBody(request);
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return reply(400, { error: 'The request body is not JSON.' });
      }

      const list = (Array.isArray(parsed) ? parsed : [parsed]) as IncomingEvent[];
      if (list.length === 0 || list.length > 500) {
        return reply(400, { error: 'Send between 1 and 500 events per request.' });
      }

      const events = [];
      for (const [index, entry] of list.entries()) {
        const brandId = typeof entry.brandId === 'string' ? entry.brandId : '';
        const stage = typeof entry.stage === 'string' ? entry.stage : '';
        if (!brandId || !(ATTRIBUTION_STAGES as readonly string[]).includes(stage)) {
          return reply(400, { error: `Event ${index} needs a brandId and a valid stage.` });
        }
        const brand = await runtime.store.getBrand(brandId);
        if (!brand) return reply(404, { error: `Event ${index}: brand not found.` });

        events.push(
          recordEvent({
            brandId,
            contentId: typeof entry.contentId === 'string' ? entry.contentId : null,
            scheduledPostId: typeof entry.scheduledPostId === 'string' ? entry.scheduledPostId : null,
            stage: stage as AttributionStage,
            value: typeof entry.value === 'number' && Number.isFinite(entry.value) ? entry.value : 1,
            currency: typeof entry.currency === 'string' ? entry.currency : null,
            occurredAt: typeof entry.occurredAt === 'string' ? entry.occurredAt : undefined,
            metadata:
              entry.metadata !== null && typeof entry.metadata === 'object'
                ? (entry.metadata as Record<string, unknown>)
                : {},
          }),
        );
      }

      await runtime.store.recordEvents(events);
      return reply(202, { accepted: events.length });
    }

    return reply(404, { error: 'Not found.' });
  } catch (error) {
    const mapped = toHttpError(error);
    log.error('request failed', { url: request.url, error: mapped.message });
    return reply(mapped.status, { error: mapped.message });
  }
});

function readBody(request: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > 1_000_000) {
        reject(new Error('The request body is too large.'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

server.listen(port, () => log.info('api listening', { port }));
