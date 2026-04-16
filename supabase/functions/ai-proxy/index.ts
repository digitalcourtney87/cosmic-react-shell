// Thin proxy: client posts {messages, temperature, maxTokens} → OpenAI chat
// completions. Returns {text} on success or {error, reason} on failure so the
// browser keeps a single, predictable error surface.

import { corsHeaders } from '../_shared/cors.ts';

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface RequestBody {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

function bad(reason: string, message: string, status = 400) {
  return new Response(JSON.stringify({ error: message, reason }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return bad('non-2xx', 'Method not allowed', 405);
  }

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return bad('no-key', 'OPENAI_API_KEY is not configured', 500);

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return bad('malformed', 'Invalid JSON body');
  }

  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    return bad('malformed', 'messages must be a non-empty array');
  }

  const payload = {
    model: body.model ?? DEFAULT_MODEL,
    temperature: typeof body.temperature === 'number' ? body.temperature : 0.2,
    max_tokens: typeof body.maxTokens === 'number' ? body.maxTokens : 400,
    response_format: { type: 'text' as const },
    messages: body.messages,
  };

  let upstream: Response;
  try {
    upstream = await fetch(OPENAI_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('ai-proxy network error', err);
    return bad('network-error', 'Failed to reach OpenAI', 502);
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    console.error('ai-proxy upstream non-2xx', upstream.status, detail.slice(0, 500));
    return bad('non-2xx', `OpenAI returned ${upstream.status}: ${detail.slice(0, 200)}`, 502);
  }

  let data: { choices?: Array<{ message?: { content?: string } }> };
  try {
    data = await upstream.json();
  } catch {
    return bad('malformed', 'OpenAI returned non-JSON', 502);
  }

  const content = data?.choices?.[0]?.message?.content;
  const text = typeof content === 'string' ? content.trim() : '';
  if (!text) return bad('malformed', 'OpenAI returned empty content', 502);

  return new Response(JSON.stringify({ text }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
