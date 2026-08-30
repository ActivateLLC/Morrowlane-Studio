import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseStore } from './supabase.js';

/**
 * Regression test for the phantom-job bug seen in production: plpgsql's
 * `return null` from claim_job() arrives through PostgREST as a composite row of
 * all-null fields, not as null, and must be read as "no job".
 */
function fakeClient(rpcData: unknown): SupabaseClient {
  return {
    rpc: async () => ({ data: rpcData, error: null }),
  } as unknown as SupabaseClient;
}

describe('supabase claimJob', () => {
  it('treats the all-null composite row as no job', async () => {
    const store = createSupabaseStore({
      client: fakeClient({ id: null, kind: null, status: null, payload: null }),
    });
    expect(await store.claimJob('w1')).toBeNull();
  });

  it('treats a plain null as no job', async () => {
    const store = createSupabaseStore({ client: fakeClient(null) });
    expect(await store.claimJob('w1')).toBeNull();
  });

  it('returns a real claimed row as a job', async () => {
    const store = createSupabaseStore({
      client: fakeClient({
        id: 'job_abc',
        organization_id: 'org_1',
        brand_id: 'brd_1',
        kind: 'generate_content',
        status: 'running',
        payload: { format: 'instagram_post' },
        attempts: 1,
        progress: 0,
        run_after: '2026-08-30T00:00:00Z',
        created_at: '2026-08-30T00:00:00Z',
      }),
    });
    const job = await store.claimJob('w1');
    expect(job?.id).toBe('job_abc');
    expect(job?.kind).toBe('generate_content');
    expect(job?.status).toBe('running');
  });
});
