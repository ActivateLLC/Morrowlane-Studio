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
}

/**
 * Claims and runs queued jobs until stopped. Also promotes scheduled posts whose time
 * has come into publish jobs, which is what makes the calendar actually publish.
 */
export async function runWorker(runtime: Runtime, options: WorkerOptions = {}): Promise<number> {
  const workerId = options.workerId ?? `worker-${process.pid}`;
  const idleDelayMs = options.idleDelayMs ?? 2000;
  let processed = 0;

  log.info('worker started', { workerId, kinds: options.kinds ?? 'all' });

  while (!options.signal?.aborted) {
    if (options.maxJobs !== undefined && processed >= options.maxJobs) break;

    await promoteDuePosts(runtime);

    const job = await runtime.store.claimJob(workerId, options.kinds);
    if (!job) {
      if (options.maxJobs !== undefined) break;
      await sleep(idleDelayMs, options.signal);
      continue;
    }

    log.info('running job', { jobId: job.id, kind: job.kind });
    await runJob(job, runtime);
    processed += 1;
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
