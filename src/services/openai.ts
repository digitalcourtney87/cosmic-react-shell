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
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

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
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new OpenAIError('timeout');
    }
    throw new OpenAIError('network-error');
  }
  clearTimeout(timeoutId);

  if (!response.ok) throw new OpenAIError('non-2xx', `OpenAI returned ${response.status}`);

  let body: { choices?: Array<{ message?: { content?: string } }> };
  try {
    body = await response.json();
  } catch {
    throw new OpenAIError('malformed', 'OpenAI returned non-JSON');
  }

  const text = body?.choices?.[0]?.message?.content?.trim() ?? '';
  if (!text) throw new OpenAIError('malformed', 'OpenAI returned empty content');

  return text;
}
