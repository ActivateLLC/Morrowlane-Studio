import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createLogger, newId } from '@morrowlane/shared';

const log = createLogger('database:media-storage');

/** Matches creative-engine's MediaStorage port without importing it (no cycle). */
export interface SupabaseMediaStorage {
  readonly name: string;
  put(input: { bytes: Uint8Array; contentType: string; keyHint: string }): Promise<{ url: string }>;
}

/**
 * Rendered creatives go to a public Supabase Storage bucket. The bucket is created
 * on first use so a fresh project needs no manual step.
 */
export function createSupabaseMediaStorage(
  options: { url?: string; serviceRoleKey?: string; client?: SupabaseClient; bucket?: string } = {},
): SupabaseMediaStorage {
  const bucket = options.bucket ?? 'media';
  const client =
    options.client ??
    createClient(
      options.url ?? requireEnv('SUPABASE_URL'),
      options.serviceRoleKey ?? requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

  let ensured: Promise<void> | null = null;
  const ensureBucket = () =>
    (ensured ??= (async () => {
      const { error } = await client.storage.createBucket(bucket, { public: true });
      // "already exists" is the steady state, not a failure.
      if (error && !/exist/i.test(error.message)) {
        log.warn('could not ensure media bucket', { bucket, error: error.message });
      }
    })());

  return {
    name: 'supabase-storage',
    async put({ bytes, contentType, keyHint }) {
      await ensureBucket();
      const extension = contentType.includes('svg') ? 'svg' : contentType.split('/')[1]?.split('+')[0] ?? 'bin';
      const key = `${keyHint}/${newId('asset')}.${extension}`;

      const { error } = await client.storage.from(bucket).upload(key, bytes, {
        contentType,
        upsert: false,
        cacheControl: '31536000',
      });
      if (error) throw new Error(`Could not store media: ${error.message}`);

      const { data } = client.storage.from(bucket).getPublicUrl(key);
      return { url: data.publicUrl };
    },
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required to use Supabase media storage.`);
  return value;
}
