import { AiGatewayError, type AiProvider, type CompletionRequest, type CompletionResponse } from './types.js';

/**
 * Hugging Face Inference Providers, through the OpenAI-compatible router.
 * One HF_TOKEN unlocks whichever hosted open model the tier maps to, so the
 * gateway can run on open weights without any code change upstream.
 *
 * Defaults were chosen from what is actually live and licensed for commercial
 * use on the Hub (see docs/integrations/stack.md); override per deployment with
 * HF_MODEL_FAST / HF_MODEL_BALANCED / HF_MODEL_DEEP.
 */
const TIER_MODELS = {
  fast: 'zai-org/GLM-5.3-Flash',
  balanced: 'deepseek-ai/DeepSeek-V4-Flash-0731',
  deep: 'zai-org/GLM-5.3',
} as const;

export interface HuggingFaceOptions {
  apiKey?: string;
  baseUrl?: string;
  models?: Partial<Record<keyof typeof TIER_MODELS, string>>;
}

export function createHuggingFaceProvider(options: HuggingFaceOptions = {}): AiProvider {
  const apiKey = options.apiKey ?? process.env.HF_TOKEN ?? process.env.HUGGINGFACE_API_KEY;
  const baseUrl = options.baseUrl ?? process.env.HF_ROUTER_URL ?? 'https://router.huggingface.co/v1';
  const models = {
    fast: process.env.HF_MODEL_FAST ?? TIER_MODELS.fast,
    balanced: process.env.HF_MODEL_BALANCED ?? TIER_MODELS.balanced,
    deep: process.env.HF_MODEL_DEEP ?? TIER_MODELS.deep,
    ...options.models,
  };

  return {
    name: 'huggingface',
    available: Boolean(apiKey),
    async complete(request: CompletionRequest): Promise<CompletionResponse> {
      if (!apiKey) throw new AiGatewayError('huggingface', 'HF_TOKEN is not set.');
      const model = models[request.tier ?? 'balanced'];

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          max_tokens: request.maxTokens ?? 4096,
          temperature: request.temperature ?? 0.7,
          messages: request.messages,
        }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new AiGatewayError(
          'huggingface',
          `Hugging Face responded ${response.status}: ${detail.slice(0, 400)}`,
          response.status === 429 || response.status >= 500 || response.status === 503,
        );
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      return {
        text: payload.choices?.[0]?.message?.content ?? '',
        model,
        provider: 'huggingface',
        inputTokens: payload.usage?.prompt_tokens ?? null,
        outputTokens: payload.usage?.completion_tokens ?? null,
      };
    },
  };
}
