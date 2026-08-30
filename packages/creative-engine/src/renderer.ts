import { createLogger } from '@morrowlane/shared';
import type { ImageRenderRequest } from './brief.js';

const log = createLogger('creative-engine:renderer');

/**
 * The rendering ports. Everything above them asks "turn this request into an image
 * and give me a URL" and never learns which backend did it — Hugging Face today,
 * ComfyUI when the service is wired, the SVG composer when nothing is configured.
 */

export interface RenderedImage {
  bytes: Uint8Array;
  contentType: string;
  width: number;
  height: number;
}

export interface ImageRenderer {
  readonly name: 'huggingface' | 'svg' | 'comfyui';
  readonly available: boolean;
  render(request: ImageRenderRequest): Promise<RenderedImage>;
}

export interface MediaStorage {
  readonly name: string;
  /** Persists bytes and returns a URL an <img> tag can load. */
  put(input: { bytes: Uint8Array; contentType: string; keyHint: string }): Promise<{ url: string }>;
}

export class RenderError extends Error {
  readonly retryable: boolean;
  constructor(message: string, retryable = false) {
    super(message);
    this.name = 'RenderError';
    this.retryable = retryable;
  }
}

/* ----------------------------- Hugging Face ------------------------------ */

export interface HuggingFaceRendererOptions {
  token?: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

/**
 * Text-to-image through Hugging Face's hosted inference. FLUX.1-schnell is the
 * default: Apache-licensed, fast, and broadly provider-hosted; override with
 * HF_IMAGE_MODEL for a different look.
 */
export function createHuggingFaceRenderer(options: HuggingFaceRendererOptions = {}): ImageRenderer {
  const token = options.token ?? process.env.HF_TOKEN ?? process.env.HUGGINGFACE_API_KEY;
  const model = options.model ?? process.env.HF_IMAGE_MODEL ?? 'black-forest-labs/FLUX.1-schnell';
  const baseUrl = options.baseUrl ?? process.env.HF_INFERENCE_URL ?? 'https://router.huggingface.co/hf-inference';
  const timeoutMs = options.timeoutMs ?? 120_000;

  return {
    name: 'huggingface',
    available: Boolean(token),
    async render(request) {
      if (!token) throw new RenderError('HF_TOKEN is not set.');

      const response = await fetch(`${baseUrl}/models/${model}`, {
        method: 'POST',
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          accept: 'image/png',
        },
        body: JSON.stringify({
          inputs: request.prompt,
          parameters: {
            width: request.width,
            height: request.height,
            negative_prompt: request.negativePrompt,
          },
        }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        // 503 is HF's "model is loading"; worth another attempt later.
        throw new RenderError(
          `Hugging Face image inference responded ${response.status}: ${detail.slice(0, 300)}`,
          response.status === 503 || response.status === 429 || response.status >= 500,
        );
      }

      const contentType = response.headers.get('content-type') ?? 'image/png';
      if (!contentType.startsWith('image/')) {
        throw new RenderError(`Expected an image, got ${contentType}.`);
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      log.info('rendered image', { model, bytes: bytes.byteLength, width: request.width });
      return { bytes, contentType, width: request.width, height: request.height };
    },
  };
}

/* ------------------------------ Data URL store --------------------------- */

/** Zero-dependency storage: the image *is* the URL. Fine for demo and tests. */
export function createDataUrlStorage(): MediaStorage {
  return {
    name: 'data-url',
    async put({ bytes, contentType }) {
      return { url: `data:${contentType};base64,${Buffer.from(bytes).toString('base64')}` };
    },
  };
}
