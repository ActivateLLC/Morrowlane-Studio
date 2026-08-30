import { createRuntime, runWorker } from '@morrowlane/agents';
import { createLogger, type JobKind } from '@morrowlane/shared';

const log = createLogger('worker:main');

/**
 * The background worker: claims jobs (crawls, generation, campaign planning,
 * publishing, metrics collection, insight computation) and promotes due scheduled
 * posts into publish jobs. Run one or many; the claim path is contention-safe.
 *
 *   pnpm dev:worker            # all job kinds
 *   WORKER_KINDS=publish_post,collect_metrics pnpm dev:worker
 */
async function main() {
  const runtime = createRuntime();
  const kinds = process.env['WORKER_KINDS']
    ?.split(',')
    .map((kind) => kind.trim())
    .filter(Boolean) as JobKind[] | undefined;

  const controller = new AbortController();
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      log.info(`received ${signal}, finishing the current job`);
      controller.abort();
    });
  }

  await runWorker(runtime, { kinds, signal: controller.signal });
}

main().catch((error) => {
  log.error('worker crashed', { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
