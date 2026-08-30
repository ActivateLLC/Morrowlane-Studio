import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHuggingFaceProvider } from './huggingface.js';

describe('hugging face text provider', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('speaks the OpenAI-compatible router shape and maps tiers to models', async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'Hello from GLM.' } }],
          usage: { prompt_tokens: 12, completion_tokens: 5 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });

    const provider = createHuggingFaceProvider({ apiKey: 'hf_test' });
    const response = await provider.complete({
      tier: 'fast',
      messages: [{ role: 'user', content: 'Say hello.' }],
    });

    expect(provider.name).toBe('huggingface');
    expect(response.text).toBe('Hello from GLM.');
    expect(response.provider).toBe('huggingface');
    expect(response.inputTokens).toBe(12);
    expect(calls[0]!.url).toBe('https://router.huggingface.co/v1/chat/completions');
    expect(calls[0]!.body['model']).toBe('zai-org/GLM-5.3-Flash');
  });

  it('marks rate limits and cold starts retryable', async () => {
    vi.stubGlobal('fetch', async () => new Response('busy', { status: 503 }));
    const provider = createHuggingFaceProvider({ apiKey: 'hf_test' });
    await expect(provider.complete({ messages: [{ role: 'user', content: 'x' }] })).rejects.toMatchObject({
      retryable: true,
    });
  });
});
