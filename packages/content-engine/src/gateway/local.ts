import type { AiProvider, CompletionRequest, CompletionResponse } from './types.js';

/**
 * The local provider is not a language model. It is a deterministic composer that
 * builds grounded output from the structured brief every generation call already
 * carries, so Morrowlane runs end to end with no API key: onboarding, the studio,
 * remix, campaigns and the calendar all work, and the test suite can assert on
 * exact output. Configure a real provider for production copy quality.
 */
export type LocalComposer = (brief: Record<string, unknown>, request: CompletionRequest) => unknown;

export interface LocalProviderOptions {
  composers?: Record<string, LocalComposer>;
}

export function createLocalProvider(options: LocalProviderOptions = {}): AiProvider {
  const composers = { ...options.composers };

  return {
    name: 'local',
    available: true,
    async complete(request: CompletionRequest): Promise<CompletionResponse> {
      const purpose = request.purpose ?? 'unknown';
      const composer = composers[purpose];
      const brief = request.brief ?? {};

      const value = composer
        ? composer(brief, request)
        : { note: `No local composer is registered for "${purpose}".`, brief };

      const text = typeof value === 'string' ? value : JSON.stringify(value);
      return {
        text,
        model: `local:${purpose}`,
        provider: 'local',
        inputTokens: null,
        outputTokens: null,
      };
    },
  };
}
