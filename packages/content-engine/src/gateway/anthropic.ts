import { AiGatewayError, type AiProvider, type CompletionRequest, type CompletionResponse } from './types.js';

// Current model IDs are undated; override per-tier via options.models or upgrade here.
const TIER_MODELS = {
  fast: 'claude-haiku-4-5',
  balanced: 'claude-sonnet-5',
  deep: 'claude-opus-5',
} as const;

export interface AnthropicOptions {
  apiKey?: string;
  baseUrl?: string;
  models?: Partial<Record<keyof typeof TIER_MODELS, string>>;
}

/** Talks to the Messages API over fetch; no SDK dependency to keep the worker small. */
export function createAnthropicProvider(options: AnthropicOptions = {}): AiProvider {
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
  const baseUrl = options.baseUrl ?? process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com';
  const models = { ...TIER_MODELS, ...options.models };

  return {
    name: 'anthropic',
    available: Boolean(apiKey),
    async complete(request: CompletionRequest): Promise<CompletionResponse> {
      if (!apiKey) throw new AiGatewayError('anthropic', 'ANTHROPIC_API_KEY is not set.');

      const model = models[request.tier ?? 'balanced'];
      const system = request.messages
        .filter((m) => m.role === 'system')
        .map((m) => m.content)
        .join('\n\n');
      const messages = request.messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role, content: m.content }));

      const response = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: request.maxTokens ?? 4096,
          temperature: request.temperature ?? 0.7,
          ...(system ? { system } : {}),
          messages: messages.length > 0 ? messages : [{ role: 'user', content: 'Continue.' }],
        }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new AiGatewayError(
          'anthropic',
          `Anthropic responded ${response.status}: ${detail.slice(0, 400)}`,
          response.status === 429 || response.status >= 500,
        );
      }

      const payload = (await response.json()) as {
        content?: Array<{ type: string; text?: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      const text = (payload.content ?? [])
        .filter((block) => block.type === 'text')
        .map((block) => block.text ?? '')
        .join('');

      return {
        text,
        model,
        provider: 'anthropic',
        inputTokens: payload.usage?.input_tokens ?? null,
        outputTokens: payload.usage?.output_tokens ?? null,
      };
    },
  };
}
