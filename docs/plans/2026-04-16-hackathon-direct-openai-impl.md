# Hackathon Direct-OpenAI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace three Supabase Edge Function proxies (`priority-insight`, `evidence-advice`, `case-chat`) with direct browser-to-OpenAI calls so the deployed hackathon demo reliably returns LLM output instead of silent fallbacks.

**Architecture:** A new `src/services/openai.ts` helper owns the OpenAI fetch (model, headers, timeout/abort). The three existing service functions (`getPriorityInsight`, `getEvidenceAdvice`, `sendCaseChatMessage`) keep their public signatures, move their system prompts client-side, and call the helper. Validation gates that previously caused silent fallback (`validateResponse`, `validateEvidenceResponse`) are removed. The three `supabase/functions/*` directories are deleted.

**Tech Stack:** TypeScript 5.8 strict, Vite 5.4, vitest, `gpt-4o-mini` via `https://api.openai.com/v1/chat/completions`.

**Design doc:** `docs/plans/2026-04-16-hackathon-direct-openai-design.md`

**Operational note for the engineer:** `.env` is gitignored and already contains `VITE_SUPABASE_*` vars. You must add `VITE_OPENAI_API_KEY` to it locally to run / test. The deployed host (Lovable) must have the same env var set as a build-time variable before pushing — without it, the bundle inlines `undefined` and every LLM call fails.

---

## Task 1 — Add VITE_OPENAI_API_KEY to .env (manual, no commit)

**Files:**
- Modify (gitignored): `.env`

**Step 1:** Add the line to `.env`:

```
VITE_OPENAI_API_KEY="sk-...REPLACE_WITH_HACKATHON_KEY..."
```

with a trailing comment line:

```
# DEMO ONLY — rotate after hackathon
```

**Step 2:** Verify the var is present:

```bash
grep -c VITE_OPENAI_API_KEY .env
```

Expected: `1`

**Step 3:** No commit (`.env` is gitignored). Done.

---

## Task 2 — Create src/services/openai.ts helper

**Files:**
- Create: `src/services/openai.ts`

**Step 1: Write the file.**

```ts
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
```

**Step 2:** Type-check:

```bash
bun run build 2>&1 | tail -20
```

Expected: build succeeds (or the only errors are in files we haven't touched yet).

**Step 3:** Commit:

```bash
git add src/services/openai.ts
git commit -m "feat: add direct OpenAI helper for hackathon mode"
```

---

## Task 3 — Refactor getPriorityInsight + update tests

**Files:**
- Modify: `src/services/ai.ts` (lines 131–292 — the network-call section)
- Modify: `src/test/assistant.test.ts`

**Step 1: Update `src/test/assistant.test.ts` to expect OpenAI shape.**

Replace the env stubs and fetch responses in the `describe('getPriorityInsight', …)` block (lines 94–141). New version:

```ts
describe('getPriorityInsight', () => {
  it('falls back to deterministic text on fetch rejection and on missing OpenAI key', async () => {
    const inputs: PriorityInsightInputs = {
      caseId: 'CASE-2026-00042',
      caseRef: 'CASE-2026-00042',
      applicantName: 'Test Applicant',
      riskLevel: 'critical',
      topFactors: ['1 evidence item overdue'],
      policyId: 'POL-BR-003',
      policyTitle: 'Benefit Review Escalation',
      thresholdPhrase: '56-day escalation threshold',
      actionId: 'issue-escalation-notice',
      actionLabel: 'Draft Escalation Notice',
      actionHref: '/case/CASE-2026-00042/action/issue-escalation-notice',
    };
    const fallbackText = composeFallback(inputs);

    // Case A: missing key → no-key fallback
    vi.stubEnv('VITE_OPENAI_API_KEY', '');
    const noKeyResult = await getPriorityInsight(inputs);
    expect(noKeyResult.status).toBe('fallback');
    if (noKeyResult.status === 'fallback') {
      expect(noKeyResult.reason).toBe('no-key');
      expect(noKeyResult.text).toBe(fallbackText);
    }

    // Case B: network rejects → network-error fallback
    vi.stubEnv('VITE_OPENAI_API_KEY', 'sk-test');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')));
    const networkResult = await getPriorityInsight(inputs);
    expect(networkResult.status).toBe('fallback');
    if (networkResult.status === 'fallback') {
      expect(networkResult.reason).toBe('network-error');
      expect(networkResult.text).toBe(fallbackText);
    }

    // Case C: 200 OK with OpenAI shape → llm
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ choices: [{ message: { content: 'Some LLM text mentioning CASE-2026-00042.' } }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );
    const okResult = await getPriorityInsight(inputs);
    expect(okResult.status).toBe('llm');
    if (okResult.status === 'llm') {
      expect(okResult.text).toBe('Some LLM text mentioning CASE-2026-00042.');
    }
  });
});
```

Note: the old "200 OK but missing caseRef → malformed" case is **deleted** — we removed `validateResponse` because it caused silent fallback for valid LLM rephrasings.

**Step 2: Run the test to verify it fails (the production code still uses Supabase shape).**

```bash
bun run test src/test/assistant.test.ts 2>&1 | tail -20
```

Expected: `getPriorityInsight` test fails.

**Step 3: Refactor `src/services/ai.ts`.**

Inside `src/services/ai.ts`, make the following changes:

a) Replace the imports at the top — add:
```ts
import { callOpenAI, OpenAIError, type OpenAIErrorReason } from './openai';
```

b) Delete `EDGE_FUNCTION_PATH`, `EVIDENCE_ADVICE_PATH`, `validateResponse`, `validateEvidenceResponse`, `readSupabaseConfig`, and `TIMEOUT_MS` (we'll inline a per-call timeout). Also delete the `validateEvidenceResponse` export.

c) Add a small mapper:
```ts
function mapReason(r: OpenAIErrorReason): FallbackReason {
  return r;  // FallbackReason already includes all five values.
}
```

(Verify in `src/types/case.ts` that `FallbackReason` is `'no-key' | 'timeout' | 'network-error' | 'non-2xx' | 'malformed'`. If not, alias accordingly.)

d) Replace `getPriorityInsight` body with:

```ts
const PRIORITY_SYSTEM_PROMPT = [
  'You are a decision-support assistant for a UK government caseworker.',
  'Given structured priority-case inputs, write ONE short sentence (max 30 words)',
  'identifying the case, the breached policy and threshold (if any), and the',
  'recommended next action. Mention the case reference verbatim. Do not invent',
  'identifiers. Plain English. No emoji.',
].join('\n');

export async function getPriorityInsight(
  inputs: PriorityInsightInputs,
  signal?: AbortSignal,
): Promise<PriorityInsightResult> {
  const userPrompt = JSON.stringify({
    caseRef: inputs.caseRef,
    applicantName: inputs.applicantName,
    riskLevel: inputs.riskLevel,
    topFactors: inputs.topFactors,
    policyId: inputs.policyId,
    policyTitle: inputs.policyTitle,
    thresholdPhrase: inputs.thresholdPhrase,
    actionLabel: inputs.actionLabel,
  }, null, 2);

  try {
    const text = await callOpenAI(
      [
        { role: 'system', content: PRIORITY_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      { timeoutMs: 8000, maxTokens: 120, temperature: 0.2 },
      signal,
    );
    return { status: 'llm', text, inputs };
  } catch (err) {
    const reason: FallbackReason =
      err instanceof OpenAIError ? mapReason(err.reason) : 'network-error';
    return buildFallback(inputs, reason);
  }
}
```

**Step 4: Run the test.**

```bash
bun run test src/test/assistant.test.ts 2>&1 | tail -10
```

Expected: all 3 tests in `assistant.test.ts` pass.

**Step 5: Commit.**

```bash
git add src/services/ai.ts src/test/assistant.test.ts
git commit -m "refactor(ai): getPriorityInsight calls OpenAI direct, drop validation gate"
```

---

## Task 4 — Refactor getEvidenceAdvice + update tests

**Files:**
- Modify: `src/services/ai.ts`
- Modify: `src/test/action-page.test.ts`

**Step 1: Update `src/test/action-page.test.ts`.**

a) Remove the import of `validateEvidenceResponse` (line 14) — the function no longer exists.

b) Delete the entire `describe('validateEvidenceResponse', …)` block (Test 3, lines 129–170). It tests behavior we removed.

c) In the `describe('getEvidenceAdvice', …)` block (lines 172–263):

- Replace `vi.stubEnv('VITE_SUPABASE_URL', …)` and `vi.stubEnv('VITE_SUPABASE_ANON_KEY', …)` everywhere with `vi.stubEnv('VITE_OPENAI_API_KEY', 'sk-test')`.
- The "no-key" test should stub `VITE_OPENAI_API_KEY` to `''`.
- Update the happy-path response shape from `{ text: validText }` to `{ choices: [{ message: { content: validText } }] }`.
- The "Test 7 — malformed fallback" case currently tests validator rejection — that path is gone. **Delete this test** (the structural malformed cases — no key, network error, non-2xx — give us coverage we keep).

**Step 2: Run the test to verify it fails.**

```bash
bun run test src/test/action-page.test.ts 2>&1 | tail -10
```

Expected: `getEvidenceAdvice` tests fail.

**Step 3: Refactor `getEvidenceAdvice` in `src/services/ai.ts`.**

```ts
const EVIDENCE_SYSTEM_PROMPT = [
  'You are a decision-support assistant for a UK government caseworker.',
  'Given a case reference, recommended action, scoped evidence list, and policy',
  'extracts, write 2-4 plain-English sentences advising the caseworker. Mention',
  'the case reference verbatim. If any evidence items are outstanding or overdue,',
  'name at least one of those requirements. Cite a policy id when relevant. Do',
  'not invent identifiers. No emoji. No letter drafting.',
].join('\n');

export async function getEvidenceAdvice(
  inputs: EvidenceAdviceInputs,
  signal?: AbortSignal,
): Promise<EvidenceAdviceResult> {
  const userPrompt = JSON.stringify({
    caseRef: inputs.caseRef,
    actionId: inputs.actionId,
    actionLabel: inputs.actionLabel,
    scope: inputs.scope,
    policies: inputs.policies,
    evidence: inputs.evidence,
    counts: inputs.counts,
  }, null, 2);

  try {
    const text = await callOpenAI(
      [
        { role: 'system', content: EVIDENCE_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      { timeoutMs: 10_000, maxTokens: 250, temperature: 0.2 },
      signal,
    );
    return { status: 'llm', text, inputs };
  } catch (err) {
    const reason: FallbackReason =
      err instanceof OpenAIError ? mapReason(err.reason) : 'network-error';
    return buildEvidenceAdviceFallback(inputs, reason);
  }
}
```

**Step 4: Run tests.**

```bash
bun run test src/test/action-page.test.ts 2>&1 | tail -10
```

Expected: all remaining `action-page.test.ts` tests pass.

**Step 5: Commit.**

```bash
git add src/services/ai.ts src/test/action-page.test.ts
git commit -m "refactor(ai): getEvidenceAdvice calls OpenAI direct, drop validation gate"
```

---

## Task 5 — Refactor sendCaseChatMessage + update service tests

**Files:**
- Modify: `src/services/caseChat.ts`
- Modify: `src/test/caseChat.test.ts`

**Step 1: Update `src/test/caseChat.test.ts`.**

In the `describe('sendCaseChatMessage', …)` block (lines 98–201):

a) Replace every `vi.stubEnv('VITE_SUPABASE_URL', …)` and `vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', …)` / `VITE_SUPABASE_ANON_KEY` with `vi.stubEnv('VITE_OPENAI_API_KEY', 'sk-test')`.

b) Replace the happy-path response body `{ text: 'Hello there.' }` with OpenAI shape: `{ choices: [{ message: { content: 'Hello there.' } }] }`.

c) The first test asserts the URL: change `'https://example.supabase.co/functions/v1/case-chat'` → `'https://api.openai.com/v1/chat/completions'`. Change body assertions:

```ts
const body = JSON.parse(init.body as string);
expect(body.model).toBe('gpt-4o-mini');
expect(Array.isArray(body.messages)).toBe(true);
// First message is the system prompt.
expect(body.messages[0].role).toBe('system');
// Last user message embeds the case record + user question.
const last = body.messages[body.messages.length - 1];
expect(last.role).toBe('user');
expect(last.content).toContain('CASE-TEST-001');  // from stubContext.caseId
expect(last.content).toContain('hi');             // from stubMessages
```

d) Update the `Authorization: Bearer …` assertion in the "uses VITE_SUPABASE_ANON_KEY when …" test — that whole test is no longer meaningful (only one key var now). **Delete that test entirely.**

e) Delete the two tests for missing Supabase env vars ("throws when VITE_SUPABASE_URL is missing", "throws when both anon-key env vars are missing"). Replace with one test:

```ts
it('throws when VITE_OPENAI_API_KEY is missing', async () => {
  vi.stubEnv('VITE_OPENAI_API_KEY', '');
  await expect(sendCaseChatMessage(stubContext, stubMessages)).rejects.toThrow();
});
```

f) The 200-with-empty-text test still applies — update its response body to `{ choices: [{ message: { content: '' } }] }`.

g) The non-200 test still applies — no body shape needed for the failure path.

h) The timeout test still applies — keep as-is but replace the env stubs.

**Step 2: Run the test to verify it fails.**

```bash
bun run test src/test/caseChat.test.ts 2>&1 | tail -10
```

**Step 3: Refactor `src/services/caseChat.ts`.**

Replace lines 66–121 (the entire `EDGE_FUNCTION_PATH` block + `readSupabaseConfig` + `sendCaseChatMessage`) with:

```ts
import { callOpenAI, OpenAIError } from './openai';

const CHAT_TIMEOUT_MS = 20_000;

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

export async function sendCaseChatMessage(
  caseContext: StructuredCaseContext,
  messages: ChatMessage[],
): Promise<string> {
  if (messages.length === 0) {
    throw new Error('sendCaseChatMessage: messages must not be empty');
  }

  // Rewrite the first user turn to embed the case record.
  const openaiMessages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    ...messages.map((turn, i) => {
      if (i === 0 && turn.role === 'user') {
        return {
          role: 'user' as const,
          content:
            `CASE RECORD:\n${JSON.stringify(caseContext, null, 2)}\n\nQUESTION:\n${turn.content}`,
        };
      }
      return { role: turn.role, content: turn.content };
    }),
  ];

  try {
    return await callOpenAI(
      openaiMessages,
      { timeoutMs: CHAT_TIMEOUT_MS, maxTokens: 400, temperature: 0.2 },
      undefined,
    );
  } catch (err) {
    if (err instanceof OpenAIError) {
      throw new Error(`Case chat failed: ${err.reason}`);
    }
    throw err;
  }
}
```

**Step 4: Run tests.**

```bash
bun run test src/test/caseChat.test.ts 2>&1 | tail -10
```

Expected: all remaining `caseChat.test.ts` tests pass.

**Step 5: Commit.**

```bash
git add src/services/caseChat.ts src/test/caseChat.test.ts
git commit -m "refactor(caseChat): sendCaseChatMessage calls OpenAI direct"
```

---

## Task 6 — Update CaseChat component tests

**Files:**
- Modify: `src/test/components/CaseChat.test.tsx`

**Step 1: Replace env stubs throughout the file.**

Find every occurrence of:
```ts
vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'anon-key');
```

Replace with:
```ts
vi.stubEnv('VITE_OPENAI_API_KEY', 'sk-test');
```

**Step 2: Replace fetch response shapes.**

Every place that has `new Response(JSON.stringify({ text: '...' }), …)` should become `new Response(JSON.stringify({ choices: [{ message: { content: '...' } }] }), …)`.

**Step 3: Update the body assertions.**

In the "clicking a chip expands…" test (around lines 41–71):

```ts
const body = JSON.parse(init.body as string);
expect(body.model).toBe('gpt-4o-mini');
// Last message is the user question with CASE RECORD prepended.
const last = body.messages[body.messages.length - 1];
expect(last.role).toBe('user');
expect(last.content).toContain("What's overdue?");
expect(last.content).toContain(enriched.case_id);
```

**Step 4: Run the test file.**

```bash
bun run test src/test/components/CaseChat.test.tsx 2>&1 | tail -15
```

Expected: all CaseChat component tests pass.

**Step 5: Commit.**

```bash
git add src/test/components/CaseChat.test.tsx
git commit -m "test: update CaseChat fetch mocks for direct OpenAI calls"
```

---

## Task 7 — Delete edge function directories

**Files:**
- Delete: `supabase/functions/case-chat/`
- Delete: `supabase/functions/evidence-advice/`
- Delete: `supabase/functions/priority-insight/`

**Step 1: Remove directories.**

```bash
rm -rf supabase/functions/case-chat supabase/functions/evidence-advice supabase/functions/priority-insight
```

**Step 2: Verify nothing in `src/` still references them.**

Use Grep tool:
- pattern: `priority-insight|evidence-advice|case-chat`
- path: `src`
- output_mode: `files_with_matches`

Expected: only documentation matches (e.g. plan files), no code references.

**Step 3: Run the full test suite.**

```bash
bun run test 2>&1 | tail -5
```

Expected: all tests pass.

**Step 4: Commit.**

```bash
git add -A supabase/functions
git commit -m "chore: remove edge functions, replaced by direct OpenAI calls"
```

---

## Task 8 — Update CLAUDE.md and README.md

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`

**Step 1: In `CLAUDE.md`, update the "External calls" sentence.**

Find the paragraph beginning "**External calls**: GOV.UK Content API…" and replace the Supabase Edge Function description with:

> three direct OpenAI `gpt-4o-mini` calls from the browser using `VITE_OPENAI_API_KEY` (hackathon mode — rotate key after the event). The calls are wrapped in `src/services/openai.ts` and invoked from `getPriorityInsight` (AI Strategy Assistant on `/`), `getEvidenceAdvice` (action page) and `sendCaseChatMessage` (case chat panel).

**Step 2: In `README.md`, add `VITE_OPENAI_API_KEY` to the env section.**

Find the existing setup / env section. Add a line under it:

```
VITE_OPENAI_API_KEY  # OpenAI API key (hackathon demo only — rotate after)
```

If there's no env section, add a brief one near the install instructions.

**Step 3: Run tests once more for sanity.**

```bash
bun run test 2>&1 | tail -5
```

Expected: all tests pass.

**Step 4: Commit.**

```bash
git add CLAUDE.md README.md
git commit -m "docs: document hackathon direct-OpenAI mode"
```

---

## Task 9 — Final verification + dev server smoke test

**Step 1: Type-check + build.**

```bash
bun run build 2>&1 | tail -10
```

Expected: build succeeds with no errors.

**Step 2: Lint.**

```bash
bun run lint 2>&1 | tail -10
```

Expected: no new lint errors. (If pre-existing errors exist on main, ignore them.)

**Step 3: Full test run.**

```bash
bun run test 2>&1 | tail -10
```

Expected: all tests pass (count should be lower than the 65 baseline because we deleted ~3 tests for removed validators / Supabase config).

**Step 4: Manual smoke test (REQUIRES VITE_OPENAI_API_KEY in `.env`).**

```bash
bun dev
```

In a browser at `http://localhost:8080`:

1. **`/`** — confirm the AI Strategy Assistant card on the right sidebar shows an LLM-generated sentence (not the deterministic fallback). The sentence should mention a case reference and a recommended action.
2. **`/case/:caseId/action/:actionId`** — open any case with an action link. The Evidence Advice card should show LLM advice mentioning the case ref and at least one outstanding evidence requirement (or, if all received, a "proceed" message).
3. **`/case/:caseId`** — find the Case Chat panel above the Timeline. Click "Summarise this case". A user bubble appears, then an assistant bubble with LLM text. Click "What's overdue?" to confirm a second turn works.

If any surface returns the deterministic fallback or an error, check `.env` first, then browser DevTools network tab for the OpenAI request.

**Step 5: No commit needed for this task.**

---

## Done

After Task 9 passes, the branch `005-hackathon-direct-openai` is ready for merge / deploy. Operational steps before deploy (NOT part of this plan, the user owns these):

1. Set `VITE_OPENAI_API_KEY` on the deploy platform (Lovable) as a build-time env var.
2. Push the branch / merge to main.
3. Wait for build, hit each LLM surface on the deployed URL.
4. After hackathon: revoke the OpenAI key on the OpenAI dashboard.
