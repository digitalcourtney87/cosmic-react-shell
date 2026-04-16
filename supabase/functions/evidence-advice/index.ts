// Supabase Edge Function — Action page evidence-advice proxy.
// Receives deterministic action + evidence inputs from the browser, calls OpenAI server-side,
// returns a 2-3 sentence advice note. The OPENAI_API_KEY never leaves the server.
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

interface EvidenceRow {
  requirement: string;
  status: 'received' | 'outstanding' | 'overdue';
  elapsedDays: number | null;
  thresholdDays: number | null;
  policyId: string;
}

interface EvidenceAdviceBody {
  caseRef: string;
  actionId: string;
  actionLabel: string;
  scope: 'action' | 'case-wide';
  policies: { id: string; title: string }[];
  evidence: EvidenceRow[];
  counts: { received: number; outstanding: number; overdue: number };
}

const SYSTEM_PROMPT = [
  'You are a decision-support assistant for a UK government caseworker named Sam.',
  'You will be given an action she needs to take and the evidence currently on file for it.',
  'Write a 2-to-3-sentence note that:',
  '  (1) names the case by its reference and the action by its label;',
  '  (2) summarises the evidence state by count and names at least one specific',
  '      outstanding or overdue requirement when any exist;',
  '  (3) recommends one concrete next step that cites a policy ID when one is provided.',
  'Do not invent requirements, policies, or counts.',
  'Do not soften the recommendation. Be direct. Do not use emoji.',
].join('\n');

function buildUserPrompt(body: EvidenceAdviceBody): string {
  const lines = [
    `Case reference: ${body.caseRef}`,
    `Action: ${body.actionLabel} (ID: ${body.actionId})`,
    `Evidence scope: ${body.scope}`,
    `Evidence counts: ${body.counts.received} received, ${body.counts.outstanding} outstanding, ${body.counts.overdue} overdue`,
  ];

  if (body.policies.length > 0) {
    lines.push(
      `Applicable policies: ${body.policies.map(p => `${p.id} — ${p.title}`).join('; ')}`,
    );
  }

  const nonReceived = body.evidence.filter(e => e.status !== 'received');
  if (nonReceived.length > 0) {
    lines.push('Outstanding/overdue items:');
    for (const item of nonReceived) {
      const days = item.elapsedDays !== null
        ? ` (${item.elapsedDays}d elapsed${item.thresholdDays !== null ? `, threshold ${item.thresholdDays}d` : ''})`
        : '';
      lines.push(`  - [${item.status.toUpperCase()}] ${item.requirement}${days} — policy ${item.policyId}`);
    }
  }

  return lines.join('\n');
}

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

  let body: EvidenceAdviceBody;
  try {
    body = (await req.json()) as EvidenceAdviceBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body?.caseRef || !body?.actionLabel) {
    return jsonResponse({ error: 'Missing required inputs (caseRef, actionLabel)' }, 400);
  }

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
        max_tokens: 220,
        response_format: { type: 'text' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(body) },
        ],
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
