import type { Channel } from '@morrowlane/shared';
import { SOCIAL_CHANNELS } from '@morrowlane/shared';
import type { SocialProvider } from './provider.js';
import { createOAuthProvider } from './providers/base.js';
import { createBlueskyProvider } from './providers/bluesky.js';
import {
  facebookDefinition,
  googleBusinessDefinition,
  instagramDefinition,
  linkedinDefinition,
  pinterestDefinition,
  threadsDefinition,
  tiktokDefinition,
  xDefinition,
  youtubeDefinition,
} from './providers/definitions.js';
import { createMockProvider } from './providers/mock.js';

export interface RegistryOptions {
  /**
   * Replaces every network with a mock. Set MORROWLANE_MOCK_SOCIAL=1 to walk the
   * whole publishing flow locally without registering developer apps.
   */
  useMocks?: boolean;
  overrides?: Partial<Record<Channel, SocialProvider>>;
}

export interface SocialRegistry {
  get(channel: Channel): SocialProvider;
  find(channel: Channel): SocialProvider | null;
  list(): SocialProvider[];
  /** Providers with credentials configured — what the connect screen offers. */
  available(): SocialProvider[];
}

export function createSocialRegistry(options: RegistryOptions = {}): SocialRegistry {
  const useMocks = options.useMocks ?? process.env['MORROWLANE_MOCK_SOCIAL'] === '1';

  const providers = new Map<Channel, SocialProvider>();

  if (useMocks) {
    for (const channel of SOCIAL_CHANNELS) providers.set(channel, createMockProvider(channel));
  } else {
    for (const definition of [
      instagramDefinition,
      facebookDefinition,
      tiktokDefinition,
      linkedinDefinition,
      xDefinition,
      threadsDefinition,
      youtubeDefinition,
      pinterestDefinition,
      googleBusinessDefinition,
    ]) {
      providers.set(definition.channel, createOAuthProvider(definition));
    }
    providers.set('bluesky', createBlueskyProvider());
  }

  for (const [channel, provider] of Object.entries(options.overrides ?? {})) {
    if (provider) providers.set(channel as Channel, provider);
  }

  return {
    get(channel) {
      const provider = providers.get(channel);
      if (!provider) throw new Error(`No social provider is registered for "${channel}".`);
      return provider;
    },
    find(channel) {
      return providers.get(channel) ?? null;
    },
    list() {
      return [...providers.values()];
    },
    available() {
      return [...providers.values()].filter((provider) => provider.configured);
    },
  };
}
