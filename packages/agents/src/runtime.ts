import { createGateway, LOCAL_COMPOSERS, type AiGateway } from '@morrowlane/content-engine';
import { createHttpFetcher, createStaticFetcher, ORCA_SITE, type Fetcher } from '@morrowlane/crawl-engine';
import { createMemoryStore, createSupabaseStore, type DataStore } from '@morrowlane/database';
import { createSocialRegistry, type SocialRegistry } from '@morrowlane/social';
import { createLogger } from '@morrowlane/shared';
import { ALL_COMPOSERS, type HandlerDeps } from './handlers.js';

const log = createLogger('agents:runtime');

export interface Runtime extends HandlerDeps {
  store: DataStore;
  gateway: AiGateway;
  social: SocialRegistry;
  fetcher: Fetcher;
  /** True when nothing external is configured and the demo path is active. */
  readonly demoMode: boolean;
}

let cached: Runtime | null = null;

/**
 * Assembles the product from its environment. Every dependency has a working local
 * default, so `pnpm dev` with an empty .env gives a complete, explorable Morrowlane;
 * setting SUPABASE_URL, an AI key and provider credentials moves it to production
 * without a code change.
 */
export function createRuntime(overrides: Partial<Runtime> = {}): Runtime {
  const hasSupabase = Boolean(process.env['SUPABASE_URL'] && process.env['SUPABASE_SERVICE_ROLE_KEY']);
  const hasAi = Boolean(process.env['ANTHROPIC_API_KEY'] ?? process.env['OPENAI_API_KEY']);
  const demoMode = !hasSupabase && !hasAi;

  const store = overrides.store ?? (hasSupabase ? createSupabaseStore() : createMemoryStore());
  const gateway = overrides.gateway ?? createGateway({ composers: { ...LOCAL_COMPOSERS, ...ALL_COMPOSERS } });
  const social = overrides.social ?? createSocialRegistry();
  const fetcher =
    overrides.fetcher ??
    // The demo brand is served from a fixture so onboarding works with no network.
    (process.env['MORROWLANE_DEMO_FIXTURE'] === '1' ? createStaticFetcher(ORCA_SITE) : createHttpFetcher());

  log.info('runtime ready', {
    store: hasSupabase ? 'supabase' : 'memory',
    ai: gateway.providerName,
    social: social.available().length,
    demoMode,
  });

  return { store, gateway, social, fetcher, demoMode };
}

/** Process-wide runtime. Next.js route handlers reuse one instance per server. */
export function getRuntime(): Runtime {
  cached ??= createRuntime();
  return cached;
}

export function setRuntime(runtime: Runtime): void {
  cached = runtime;
}
