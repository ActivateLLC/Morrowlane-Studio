import { AiGatewayError, type AiProvider, type CompletionRequest, type CompletionResponse } from './types.js';

const TIER_MODELS = { fast: 'gpt-4o-mini', balanced: 'gpt-4o', deep: 'gpt-4o' } as const;

export interface OpenAiOptions {
  apiKey?: string;
  baseUrl?: string;
  models?: Partial<Record<keyof typeof TIER_MODELS, string>>;
}

/**
 * Second provider so the gateway abstraction stays honest — anything that only
 * works against one vendor is a leak, and this is where it shows up.
 * Also covers OpenAI-compatible gateways via `baseUrl`.
 */
export function createOpenAiProvider(options: OpenAiOptions = {}): AiProvider {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  const baseUrl = options.baseUrl ?? process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
  const models = { ...TIER_MODELS, ...options.models };

  return {
    name: 'openai',
    available: Boolean(apiKey),
    async complete(request: CompletionRequest): Promise<CompletionResponse> {
      if (!apiKey) throw new AiGatewayError('openai', 'OPENAI_API_KEY is not set.');
      const model = models[request.tier ?? 'balanced'];

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          max_tokens: request.maxTokens ?? 4096,
          temperature: request.temperature ?? 0.7,
          messages: request.messages,
          ...(request.jsonSchemaHint ? { response_format: { type: 'json_object' } } : {}),
        }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new AiGatewayError(
          'openai',
          `OpenAI responded ${response.status}: ${detail.slice(0, 400)}`,
          response.status === 429 || response.status >= 500,
        );
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      return {
        text: payload.choices?.[0]?.message?.content ?? '',
        model,
        provider: 'openai',
        inputTokens: payload.usage?.prompt_tokens ?? null,
        outputTokens: payload.usage?.completion_tokens ?? null,
      };
    },
  };
}
