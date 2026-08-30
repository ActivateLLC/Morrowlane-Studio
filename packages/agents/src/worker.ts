import type { JobKind } from '@morrowlane/shared';
import { createLogger } from '@morrowlane/shared';
import { runJob } from './handlers.js';
import type { Runtime } from './runtime.js';

const log = createLogger('agents:worker');

export interface WorkerOptions {
  workerId?: string;
  kinds?: JobKind[];
  /** Pause between empty polls. Kept short so the studio feels responsive. */
  idleDelayMs?: number;
  signal?: AbortSignal;
  /** Stops after this many jobs. Used by tests and one-shot runs. */
  maxJobs?: number;
  /** Base delay after a failed poll; doubles per consecutive failure, capped at 60s. */
  errorBackoffMs?: number;
}

/**
 * Claims and runs queued jobs until stopped. Also promotes scheduled posts whose time
 * has come into publish jobs, which is what makes the calendar actually publish.
 */
export async function runWorker(runtime: Runtime, options: WorkerOptions = {}): Promise<number> {
  const workerId = options.workerId ?? `worker-${process.pid}`;
  const idleDelayMs = options.idleDelayMs ?? 2000;
  const errorBackoffMs = options.errorBackoffMs ?? 5000;
  let processed = 0;
  let consecutiveFailures = 0;

  log.info('worker started', { workerId, kinds: options.kinds ?? 'all' });

  while (!options.signal?.aborted) {
    if (options.maxJobs !== undefined && processed >= options.maxJobs) break;

    // A failed poll — the database unreachable, credentials wrong, a network blip —
    // must not kill the worker. Crashing turns a transient outage into a crash-loop
    // and a page; backing off and retrying turns it into a log line that self-heals.
    try {
      await promoteDuePosts(runtime);

      const job = await runtime.store.claimJob(workerId, options.kinds);
      if (!job) {
        consecutiveFailures = 0;
        if (options.maxJobs !== undefined) break;
        await sleep(idleDelayMs, options.signal);
        continue;
      }

      log.info('running job', { jobId: job.id, kind: job.kind });
      await runJob(job, runtime);
      processed += 1;
      consecutiveFailures = 0;
    } catch (error) {
      consecutiveFailures += 1;
      const delay = Math.min(errorBackoffMs * 2 ** Math.min(consecutiveFailures - 1, 4), 60_000);
      log.error('worker poll failed; retrying', {
        error: error instanceof Error ? error.message : String(error),
        consecutiveFailures,
        retryInMs: delay,
      });
      // One-shot runs (tests, cron-style invocations) surface the failure instead.
      if (options.maxJobs !== undefined) break;
      await sleep(delay, options.signal);
    }
  }

  log.info('worker stopped', { workerId, processed });
  return processed;
}

/** Turns due scheduled posts into publish jobs, exactly once each. */
export async function promoteDuePosts(runtime: Runtime, limit = 25): Promise<number> {
  const due = await runtime.store.claimDuePosts(limit);
  for (const post of due) {
    const brand = await runtime.store.getBrand(post.brandId);
    if (!brand) continue;
    await runtime.store.enqueueJob({
      organizationId: brand.organizationId,
      brandId: post.brandId,
      kind: 'publish_post',
      payload: { scheduledPostId: post.id },
    });
  }
  return due.length;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}
