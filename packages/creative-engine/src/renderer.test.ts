import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ImageRenderRequest } from './brief.js';
import { createDataUrlStorage, createHuggingFaceRenderer, RenderError } from './renderer.js';
import { composeSvgCard, createSvgRenderer } from './svg.js';

const request: ImageRenderRequest = {
  kind: 'image',
  contentId: 'cnt_1',
  workflow: 'branded-image',
  prompt: 'A confident product photograph. Financial technology, clear',
  heading: 'Why people choose Orca',
  message: 'Reports to all three bureaus. No hard credit check to open.',
  negativePrompt: 'watermark',
  width: 1080,
  height: 1350,
  brandColor: '#1b6ef3',
  logoUrl: null,
  slideIndex: 2,
};

describe('svg renderer', () => {
  it('composes a branded card carrying the message and brand colour', async () => {
    const image = await createSvgRenderer().render(request);
    const svg = new TextDecoder().decode(image.bytes);
    expect(image.contentType).toBe('image/svg+xml');
    expect(svg).toContain('#1b6ef3');
    // Cards set the slide's words, not the diffusion prompt.
    expect(svg).toContain('Why people choose');
    expect(svg).toContain('bureaus');
    expect(svg).not.toContain('product photograph');
    // Slide badge shows the 1-based slide number.
    expect(svg).toContain('>3</text>');
  });

  it('escapes markup in the prompt so content cannot inject SVG', () => {
    const hostile = composeSvgCard({ ...request, heading: null, message: 'Save <script>alert(1)</script> & more' });
    const svg = new TextDecoder().decode(hostile.bytes);
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
  });

  it('is deterministic for the same request', async () => {
    const a = await createSvgRenderer().render(request);
    const b = await createSvgRenderer().render(request);
    expect(Buffer.from(a.bytes).equals(Buffer.from(b.bytes))).toBe(true);
  });
});

describe('data url storage', () => {
  it('round-trips bytes into a loadable url', async () => {
    const { url } = await createDataUrlStorage().put({
      bytes: new TextEncoder().encode('<svg/>'),
      contentType: 'image/svg+xml',
      keyHint: 'x',
    });
    expect(url).toBe(`data:image/svg+xml;base64,${Buffer.from('<svg/>').toString('base64')}`);
  });
});

describe('hugging face renderer', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('posts the prompt and returns the image bytes', async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      return new Response(new Uint8Array([137, 80, 78, 71]), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      });
    });

    const renderer = createHuggingFaceRenderer({ token: 'hf_test', model: 'black-forest-labs/FLUX.1-schnell' });
    const image = await renderer.render(request);

    expect(image.contentType).toBe('image/png');
    expect(image.bytes[0]).toBe(137);
    expect(calls[0]!.url).toContain('/models/black-forest-labs/FLUX.1-schnell');
    // Diffusion gets the art direction, not the typeset copy.
    expect((calls[0]!.body as { inputs: string }).inputs).toContain('product photograph');
  });

  it('marks the model-loading 503 as retryable', async () => {
    vi.stubGlobal('fetch', async () => new Response('loading', { status: 503 }));
    const renderer = createHuggingFaceRenderer({ token: 'hf_test' });
    await expect(renderer.render(request)).rejects.toMatchObject({ retryable: true });
  });

  it('is unavailable without a token', () => {
    const previous = process.env.HF_TOKEN;
    delete process.env.HF_TOKEN;
    delete process.env.HUGGINGFACE_API_KEY;
    expect(createHuggingFaceRenderer().available).toBe(false);
    if (previous) process.env.HF_TOKEN = previous;
  });
});
