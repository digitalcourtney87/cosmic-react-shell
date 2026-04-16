// Supabase Edge Function — Case Chat Assistant.
// Receives a structured case record plus a conversation history, forwards to
// OpenAI server-side, and returns the assistant's next message. The
// OPENAI_API_KEY never leaves the server.
//
// Deno runtime. Deployed automatically by Lovable when this file is committed.

// deno-lint-ignore-file no-explicit-any
// @ts-nocheck — this file runs in Deno, not the Vite browser build.

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

interface CaseChatRequest {
  caseContext: unknown;        // forwarded verbatim; shape enforced client-side
  messages: ChatTurn[];
}

const SYSTEM_PROMPT = [
  'You are a decision-support assistant for a UK government caseworker.',
  'You are given one case record as JSON. Answer the caseworker\'s questions',
  'using only the information in that record. When asked about dates, compute',
  'relative to referenceDate, never today\'s real date. If a question cannot',
  'be answered from the record, say so plainly: "The case record doesn\'t',
  'show that." Do not invent case references, policy identifiers, dates, or',
  'evidence items. Do not draft letters, notices, or formal correspondence.',
  'Do not recommend workflow transitions. Keep answers to 2-5 sentences of',
  'plain English. Do not use emoji.',
].join('\n');

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// @ts-ignore — Deno global is provided by the edge runtime.
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  // @ts-ignore — Deno global.
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    return jsonResponse({ error: 'OPENAI_API_KEY not configured' }, 500);
  }

  let body: CaseChatRequest;
  try {
    body = (await req.json()) as CaseChatRequest;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body?.caseContext || !Array.isArray(body?.messages) || body.messages.length === 0) {
    return jsonResponse({ error: 'Missing required inputs (caseContext, messages[])' }, 400);
  }

  if (body.messages.length > 20) {
    return jsonResponse({ error: 'Too many messages (max 20)' }, 400);
  }

  // Validate every turn: only 'user' | 'assistant' roles allowed.
  // Without this a caller could POST role: 'system' and override the server prompt.
  // Defence-in-depth against direct-POST attackers: the client-side TURN_CAP and
  // UI never produce invalid roles, but the edge function must not trust callers.
  for (const turn of body.messages) {
    if (
      !turn ||
      (turn.role !== 'user' && turn.role !== 'assistant') ||
      typeof turn.content !== 'string' ||
      turn.content.length === 0
    ) {
      return jsonResponse({ error: 'Invalid message: each turn must have role user|assistant and non-empty content' }, 400);
    }
  }

  if (body.messages[0].role !== 'user') {
    return jsonResponse({ error: 'First message must be a user turn' }, 400);
  }

  // Rewrite the first user turn to embed the case record as JSON.
  const openaiMessages = body.messages.map((turn, i) => {
    if (i === 0 && turn.role === 'user') {
      return {
        role: 'user',
        content:
          `CASE RECORD:\n${JSON.stringify(body.caseContext, null, 2)}\n\nQUESTION:\n${turn.content}`,
      };
    }
    return turn;
  });

  let openaiResponse: Response;
  try {
    openaiResponse = await fetch(OPENAI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 400,
        response_format: { type: 'text' },
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...openaiMessages],
      }),
    });
  } catch (err) {
    return jsonResponse({ error: `OpenAI request failed: ${String(err)}` }, 502);
  }

  if (!openaiResponse.ok) {
    const errText = await openaiResponse.text().catch(() => '');
    return jsonResponse(
      { error: `OpenAI returned ${openaiResponse.status}`, detail: errText.slice(0, 500) },
      502,
    );
  }

  let openaiBody: any;
  try {
    openaiBody = await openaiResponse.json();
  } catch {
    return jsonResponse({ error: 'OpenAI returned non-JSON' }, 502);
  }

  const text = openaiBody?.choices?.[0]?.message?.content?.trim() ?? '';
  if (!text) {
    return jsonResponse({ error: 'OpenAI returned empty content' }, 502);
  }

  return jsonResponse({ text }, 200);
});
