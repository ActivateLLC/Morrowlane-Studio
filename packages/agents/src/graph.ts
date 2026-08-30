import { createLogger } from '@morrowlane/shared';

const log = createLogger('agents:graph');

/**
 * A minimal stateful graph runner. Morrowlane's pipelines are sequences of steps over a
 * shared state object with conditional edges and recorded progress — the same shape
 * LangGraph provides, without pulling a Python runtime into the Node worker. When a
 * pipeline needs real branching search or human-in-the-loop interrupts, it moves to the
 * LangGraph service; this covers the pipelines that ship today.
 */

export interface StepContext {
  /** Reports progress to the job record so the UI can show what is happening. */
  progress(fraction: number, label: string): Promise<void>;
  signal?: AbortSignal;
}

export interface GraphStep<S> {
  name: string;
  run(state: S, context: StepContext): Promise<Partial<S>>;
  /** Skips the step when it returns false. */
  when?(state: S): boolean;
  /** Steps marked optional log and continue on failure instead of aborting the graph. */
  optional?: boolean;
}

export interface GraphResult<S> {
  state: S;
  completed: string[];
  skipped: string[];
  failed: Array<{ step: string; error: string }>;
}

export async function runGraph<S extends object>(
  steps: Array<GraphStep<S>>,
  initial: S,
  context: StepContext,
): Promise<GraphResult<S>> {
  let state = initial;
  const completed: string[] = [];
  const skipped: string[] = [];
  const failed: GraphResult<S>['failed'] = [];

  for (const [index, step] of steps.entries()) {
    if (context.signal?.aborted) break;

    if (step.when && !step.when(state)) {
      skipped.push(step.name);
      continue;
    }

    await context.progress(index / steps.length, step.name);
    log.debug('step start', { step: step.name });

    try {
      const patch = await step.run(state, context);
      state = { ...state, ...patch };
      completed.push(step.name);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failed.push({ step: step.name, error: message });
      log.warn('step failed', { step: step.name, error: message, optional: step.optional ?? false });
      // A required step failing means the rest of the graph would run on bad state.
      if (!step.optional) break;
    }
  }

  await context.progress(1, 'done');
  return { state, completed, skipped, failed };
}
