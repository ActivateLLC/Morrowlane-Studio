import { createGateway, LOCAL_COMPOSERS, type AiGateway } from '@morrowlane/content-engine';
import {
  createDataUrlStorage,
  createHuggingFaceRenderer,
  createSvgRenderer,
  type ImageRenderer,
  type MediaStorage,
} from '@morrowlane/creative-engine';
import { createSupabaseMediaStorage } from '@morrowlane/database';
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
  imageRenderer: ImageRenderer;
  mediaStorage: MediaStorage;
  /** True when nothing external is configured and the demo path is active. */
  readonly demoMode: boolean;
}

// The runtime — and with it the in-memory DataStore — must be a single instance shared
// across every module graph. Under `next dev` each route segment and server-action
// bundle evaluates this module separately, so a plain module-scoped `let` gives each its
// own empty store: the demo seed writes to one, page renders read another, and every
// brand page 404s. Caching on `globalThis` makes all graphs (and HMR reloads) share one.
const RUNTIME_KEY = Symbol.for('morrowlane.runtime');
type RuntimeGlobal = typeof globalThis & { [RUNTIME_KEY]?: Runtime | null };
const runtimeGlobal = globalThis as RuntimeGlobal;

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

  // Real diffusion imagery when a Hugging Face token exists; otherwise the branded
  // SVG composer, so image formats always produce a usable creative.
  const huggingFace = createHuggingFaceRenderer();
  const imageRenderer = overrides.imageRenderer ?? (huggingFace.available ? huggingFace : createSvgRenderer());
  const mediaStorage =
    overrides.mediaStorage ?? (hasSupabase ? createSupabaseMediaStorage() : createDataUrlStorage());

  log.info('runtime ready', {
    store: hasSupabase ? 'supabase' : 'memory',
    ai: gateway.providerName,
    renderer: imageRenderer.name,
    mediaStorage: mediaStorage.name,
    social: social.available().length,
    demoMode,
  });

  return { store, gateway, social, fetcher, imageRenderer, mediaStorage, demoMode };
}

/** Process-wide runtime. Next.js route handlers reuse one instance per server. */
export function getRuntime(): Runtime {
  runtimeGlobal[RUNTIME_KEY] ??= createRuntime();
  return runtimeGlobal[RUNTIME_KEY]!;
}

export function setRuntime(runtime: Runtime): void {
  runtimeGlobal[RUNTIME_KEY] = runtime;
}
