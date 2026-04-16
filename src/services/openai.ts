/**
 * Direct browser → OpenAI helper.
 * Hackathon mode: API key is read from VITE_OPENAI_API_KEY and inlined into
 * the bundle. Rotate the key on the OpenAI dashboard at end of hackathon.
 */

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';

export type OpenAIErrorReason =
  | 'no-key'
  | 'timeout'
  | 'network-error'
  | 'non-2xx'
  | 'malformed';

export class OpenAIError extends Error {
  constructor(public reason: OpenAIErrorReason, message?: string) {
    super(message ?? reason);
    this.name = 'OpenAIError';
  }
}

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CallOpenAIOptions {
  timeoutMs: number;
  maxTokens: number;
  temperature: number;
}

function readKey(): string | null {
  const key = import.meta.env.VITE_OPENAI_API_KEY;
  if (typeof key !== 'string' || key.length === 0) return null;
  return key;
}

export async function callOpenAI(
  messages: OpenAIMessage[],
  options: CallOpenAIOptions,
  signal?: AbortSignal,
): Promise<string> {
  const key = readKey();
  if (!key) throw new OpenAIError('no-key');

  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs);
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onAbort);
  }

  try {
    let response: Response;
    try {
      response = await fetch(OPENAI_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          temperature: options.temperature,
          max_tokens: options.maxTokens,
          response_format: { type: 'text' },
          messages,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        if (timedOut) throw new OpenAIError('timeout');
        throw err;
      }
      throw new OpenAIError('network-error');
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new OpenAIError('non-2xx', `OpenAI returned ${response.status}: ${detail.slice(0, 200)}`);
    }

    let body: { choices?: Array<{ message?: { content?: string } }> };
    try {
      body = await response.json();
    } catch {
      throw new OpenAIError('malformed', 'OpenAI returned non-JSON');
    }

    const content = body?.choices?.[0]?.message?.content;
    const text = typeof content === 'string' ? content.trim() : '';
    if (!text) throw new OpenAIError('malformed', 'OpenAI returned empty content');

    return text;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onAbort);
  }
}
