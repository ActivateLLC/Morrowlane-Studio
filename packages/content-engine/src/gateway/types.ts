/**
 * Morrowlane never imports a vendor SDK outside this directory. Everything upstream
 * asks the gateway for a completion and gets back text or a validated object, so
 * swapping or mixing providers is a configuration change.
 */

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionRequest {
  messages: AiMessage[];
  /** Logical model tier. The provider maps it to a concrete model id. */
  tier?: 'fast' | 'balanced' | 'deep';
  maxTokens?: number;
  temperature?: number;
  /** When set, the provider is asked for JSON matching this shape description. */
  jsonSchemaHint?: string;
  /** Free-form label used in logs and cost attribution. */
  purpose?: string;
  /**
   * Structured facts the completion must be grounded in. Remote providers get it
   * serialised into the prompt; the local provider composes directly from it.
   */
  brief?: Record<string, unknown>;
}

export interface CompletionResponse {
  text: string;
  model: string;
  provider: string;
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface AiProvider {
  readonly name: string;
  readonly available: boolean;
  complete(request: CompletionRequest): Promise<CompletionResponse>;
}

export class AiGatewayError extends Error {
  readonly provider: string;
  readonly retryable: boolean;

  constructor(provider: string, message: string, retryable = false) {
    super(message);
    this.name = 'AiGatewayError';
    this.provider = provider;
    this.retryable = retryable;
  }
}
