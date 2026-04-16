/**
 * Thin client for the `ai-proxy` Supabase Edge Function.
 *
 * Server-side mode: the OpenAI key (`OPENAI_API_KEY`) lives only in the edge
 * function. The browser POSTs `{messages, temperature, maxTokens}` and gets
 * back either `{text}` or `{error, reason}`.
 *
 * Public surface (`callOpenAI`, `OpenAIError`, `OpenAIErrorReason`,
 * `OpenAIMessage`, `CallOpenAIOptions`) is unchanged so callers don't move.
 */

import { supabase } from '@/integrations/supabase/client';

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

interface ProxyResponse {
  text?: string;
  error?: string;
  reason?: OpenAIErrorReason;
}

function isReason(v: unknown): v is OpenAIErrorReason {
  return v === 'no-key' || v === 'timeout' || v === 'network-error' || v === 'non-2xx' || v === 'malformed';
}

export async function callOpenAI(
  messages: OpenAIMessage[],
  options: CallOpenAIOptions,
  signal?: AbortSignal,
): Promise<string> {
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
    const { data, error } = await supabase.functions.invoke<ProxyResponse>('ai-proxy', {
      body: {
        messages,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
      },
      // supabase-js doesn't forward AbortSignal, but we still race the timeout
      // by checking controller.signal.aborted immediately after the call.
    });

    if (timedOut) throw new OpenAIError('timeout');
    if (controller.signal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    if (error) {
      // FunctionsHttpError responses include the JSON body in error.context
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') {
        try {
          const parsed = (await ctx.json()) as ProxyResponse;
          if (isReason(parsed.reason)) {
            throw new OpenAIError(parsed.reason, parsed.error ?? parsed.reason);
          }
        } catch (e) {
          if (e instanceof OpenAIError) throw e;
          // fall through to network-error
        }
      }
      throw new OpenAIError('network-error', error.message);
    }

    if (!data) throw new OpenAIError('malformed', 'Empty response from ai-proxy');
    if (data.reason && isReason(data.reason)) {
      throw new OpenAIError(data.reason, data.error ?? data.reason);
    }
    const text = typeof data.text === 'string' ? data.text.trim() : '';
    if (!text) throw new OpenAIError('malformed', 'ai-proxy returned empty text');
    return text;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onAbort);
  }
}
