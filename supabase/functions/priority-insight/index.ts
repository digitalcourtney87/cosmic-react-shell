// Supabase Edge Function — AI Strategy Assistant priority-insight proxy.
// Receives deterministic case inputs from the browser, calls OpenAI server-side,
// returns the generated sentence. The OPENAI_API_KEY never leaves the server.
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

type RiskLevel = 'critical' | 'warning' | 'normal';

interface PriorityInsightInputs {
  caseRef: string;
  applicantName: string;
  riskLevel: RiskLevel;
  topFactors: string[];
  policyId: string | null;
  policyTitle: string | null;
  thresholdPhrase: string | null;
  actionLabel: string;
}

const SYSTEM_PROMPT = [
  'You are a decision-support assistant for a UK government caseworker named Sam.',
  'You will be given the single highest-priority case from her morning caseload,',
  'with its risk factors and the recommended next action. Write a 2-to-3-sentence',
  'briefing that:',
  '  - names the case by its reference,',
  '  - names the applicable policy by its identifier when provided,',
  '  - recommends the named next action as the first thing Sam should do today.',
  'Do not invent case references, policy identifiers, or actions. Do not soften',
  'the recommendation. Be direct. Do not use emoji.',
].join('\n');

function buildUserPrompt(inputs: PriorityInsightInputs): string {
  const lines = [
    `Priority case: ${inputs.caseRef}`,
    `Applicant: ${inputs.applicantName}`,
    `Risk level: ${inputs.riskLevel}`,
    `Top risk factors: ${inputs.topFactors.join('; ') || 'none recorded'}`,
  ];
  if (inputs.policyId && inputs.policyTitle) {
    lines.push(`Applicable policy: ${inputs.policyId} — ${inputs.policyTitle}`);
  }
  if (inputs.thresholdPhrase) {
    lines.push(`Threshold breached: ${inputs.thresholdPhrase}`);
  }
  lines.push(`Recommended next action: "${inputs.actionLabel}"`);
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

  let inputs: PriorityInsightInputs;
  try {
    inputs = (await req.json()) as PriorityInsightInputs;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!inputs?.caseRef || !inputs?.actionLabel) {
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
        max_tokens: 180,
        response_format: { type: 'text' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(inputs) },
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

  let body: any;
  try {
    body = await openaiResponse.json();
  } catch {
    return jsonResponse({ error: 'OpenAI returned non-JSON' }, 502);
  }

  const text = body?.choices?.[0]?.message?.content?.trim() ?? '';
  if (!text) {
    return jsonResponse({ error: 'OpenAI returned empty content' }, 502);
  }

  return jsonResponse({ text }, 200);
});
