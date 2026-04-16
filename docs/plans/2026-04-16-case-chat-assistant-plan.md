# Case Chat Assistant Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship a per-case LLM chat panel above the Timeline on the Case Detail page, carrying the full case record as context, with session-only persistence and one-shot responses.

**Architecture:** A new `case-chat` Supabase Edge Function mirrors the existing `priority-insight` pattern (Deno, CORS, OpenAI `gpt-4o-mini`, server-side key). A client-side service (`src/services/caseChat.ts`) builds a deterministic `StructuredCaseContext` from `EnrichedCase` and POSTs `{context, messages}` to the edge function. A React component (`src/components/ai/CaseChat.tsx`) owns UI state for three states (collapsed / expanded-empty / expanded-with-conversation), persists `messages` to `sessionStorage` keyed by `case_id`, and renders in `CaseDetail.tsx` between the header and the two-column grid.

**Tech Stack:** TypeScript 5.8 strict · React 18.3 · Vite 5.4 · Tailwind 3.4 · Vitest + React Testing Library · Supabase Edge Functions (Deno) · OpenAI `gpt-4o-mini`.

**Reference design:** `docs/plans/2026-04-16-case-chat-assistant-design.md` (committed on `main`).

---

## Ground rules

- TDD: write the failing test first, run it, implement, run again, commit.
- Run tests with `bun run test` (NOT `bun test` — see CLAUDE.md).
- No `new Date()` in `src/services/` or `src/lib/`. Use `REFERENCE_DATE` from `src/lib/constants.ts`.
- Commit after every task passes. Keep commits scoped to one task.
- Follow the existing priority-insight call pattern in `src/services/ai.ts:130-200` for headers, config reading, and error shape.

---

## Task 1: Bootstrap the `case-chat` edge function

**Files:**
- Create: `supabase/functions/case-chat/index.ts`

**Step 1.1: Create the edge function file**

Copy the structure of `supabase/functions/priority-insight/index.ts` and adapt:

```typescript
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
```

**Step 1.2: Verify the file compiles against the existing priority-insight pattern**

The edge function is Deno-only and won't run under Vitest. Visual diff check:

Run: `diff -u supabase/functions/priority-insight/index.ts supabase/functions/case-chat/index.ts | head -80`
Expected: the diff is bounded to the areas that differ (SYSTEM_PROMPT, request interface, message construction, max_tokens).

**Step 1.3: Commit**

```bash
git add supabase/functions/case-chat/index.ts
git commit -m "Add case-chat edge function

Mirrors priority-insight shape. Accepts { caseContext, messages } and
forwards to gpt-4o-mini with a system prompt that bounds the model to
the provided case record."
```

---

## Task 2: Add StructuredCaseContext and ChatMessage types

**Files:**
- Modify: `src/types/case.ts` (append)

**Step 2.1: Append types**

Add to the end of `src/types/case.ts`:

```typescript
// ── Case Chat Assistant ───────────────────────────────────────────────────────

export interface StructuredCaseContext {
  caseId: string;
  caseType: string;
  status: string;
  referenceDate: string;
  applicant: {
    name: string;
    reference: string;
    dateOfBirth?: string;
  };
  assignedTo: string;
  createdDate: string;
  riskScore: {
    level: 'critical' | 'warning' | 'normal';
    score: number;
    factors: string[];
  };
  caseNotes: string;
  timeline: Array<{ date: string; event: string; note: string }>;
  evidenceItems: Array<{
    requirement: string;
    status: 'overdue' | 'outstanding' | 'received';
    policyId: string;
    elapsedDays: number | null;
    thresholdDays: number | null;
  }>;
  workflowState: {
    label: string;
    description: string;
    escalationThresholds?: { reminder_days: number; escalation_days: number };
    allowedTransitions: string[];
  } | null;
  nextActions: Array<{
    id: string;
    label: string;
    severity: 'critical' | 'warning' | 'info';
    dueInDays: number | null;
  }>;
  policies: Array<{ policyId: string; title: string; body: string }>;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  status?: 'ok' | 'error';
}
```

**Step 2.2: Verify types compile**

Run: `bun run lint`
Expected: no new errors.

**Step 2.3: Commit**

```bash
git add src/types/case.ts
git commit -m "Add StructuredCaseContext and ChatMessage types"
```

---

## Task 3: `buildCaseContext` with TDD

**Files:**
- Create: `src/services/caseChat.ts`
- Create: `src/test/caseChat.test.ts`

**Step 3.1: Write the failing test**

`src/test/caseChat.test.ts`:

```typescript
/**
 * Case Chat Assistant — service tests.
 * buildCaseContext is a pure derivation over EnrichedCase.
 * sendCaseChatMessage is tested with stubbed fetch.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildCaseContext } from '../services/caseChat';
import { getAllEnrichedCases, policies as allPolicies } from '../services/cases';
import { REFERENCE_DATE } from '../lib/constants';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('buildCaseContext', () => {
  it('produces a StructuredCaseContext from the first fixture case', () => {
    const enriched = getAllEnrichedCases()[0];
    const relevantPolicies = allPolicies.filter(p => p.case_type === enriched.case_type);

    const ctx = buildCaseContext(enriched, relevantPolicies);

    expect(ctx.caseId).toBe(enriched.case_id);
    expect(ctx.caseType).toBe(enriched.case_type);
    expect(ctx.status).toBe(enriched.status);
    expect(ctx.applicant.name).toBe(enriched.applicant.name);
    expect(ctx.applicant.reference).toBe(enriched.applicant.reference);
    expect(ctx.assignedTo).toBe(enriched.assigned_to);
    expect(ctx.riskScore.level).toBe(enriched.riskScore.level);
    expect(ctx.riskScore.score).toBe(enriched.riskScore.score);
    expect(ctx.caseNotes).toBe(enriched.case_notes);
    expect(ctx.timeline.length).toBe(enriched.timeline.length);
    expect(ctx.evidenceItems.length).toBe(enriched.evidenceItems.length);
    expect(ctx.nextActions.length).toBe(enriched.nextActions.length);
  });

  it('uses REFERENCE_DATE as referenceDate (never new Date())', () => {
    const enriched = getAllEnrichedCases()[0];
    const ctx = buildCaseContext(enriched, []);
    expect(ctx.referenceDate).toBe(REFERENCE_DATE.toISOString().slice(0, 10));
  });

  it('serialises workflowState as null when absent', () => {
    const enriched = {
      ...getAllEnrichedCases()[0],
      workflowState: null,
    };
    const ctx = buildCaseContext(enriched, []);
    expect(ctx.workflowState).toBeNull();
  });

  it('includes full policy bodies verbatim', () => {
    const enriched = getAllEnrichedCases()[0];
    const relevantPolicies = allPolicies.filter(p => p.case_type === enriched.case_type);
    const ctx = buildCaseContext(enriched, relevantPolicies);
    if (relevantPolicies.length > 0) {
      expect(ctx.policies[0].body).toBe(relevantPolicies[0].body);
    }
  });
});
```

**Step 3.2: Run the test — verify it fails**

Run: `bun run test src/test/caseChat.test.ts`
Expected: FAIL — `Cannot find module '../services/caseChat'`.

**Step 3.3: Write minimal `buildCaseContext` implementation**

`src/services/caseChat.ts`:

```typescript
/**
 * Case Chat Assistant service.
 * - buildCaseContext: pure derivation of StructuredCaseContext from EnrichedCase.
 * - sendCaseChatMessage: POST to the case-chat edge function (added in Task 4).
 */

import type { EnrichedCase, PolicyExtract, StructuredCaseContext } from '../types/case';
import { REFERENCE_DATE } from '../lib/constants';

export function buildCaseContext(
  enriched: EnrichedCase,
  policies: PolicyExtract[],
): StructuredCaseContext {
  return {
    caseId: enriched.case_id,
    caseType: enriched.case_type,
    status: enriched.status,
    referenceDate: REFERENCE_DATE.toISOString().slice(0, 10),
    applicant: {
      name: enriched.applicant.name,
      reference: enriched.applicant.reference,
      dateOfBirth: enriched.applicant.date_of_birth,
    },
    assignedTo: enriched.assigned_to,
    createdDate: enriched.created_date,
    riskScore: {
      level: enriched.riskScore.level,
      score: enriched.riskScore.score,
      factors: [...enriched.riskScore.factors],
    },
    caseNotes: enriched.case_notes,
    timeline: enriched.timeline.map(t => ({
      date: t.date,
      event: t.event,
      note: t.note,
    })),
    evidenceItems: enriched.evidenceItems.map(e => ({
      requirement: e.requirement,
      status: e.status,
      policyId: e.policyId,
      elapsedDays: e.elapsedDays,
      thresholdDays: e.thresholdDays,
    })),
    workflowState: enriched.workflowState
      ? {
          label: enriched.workflowState.label,
          description: enriched.workflowState.description,
          escalationThresholds: enriched.workflowState.escalation_thresholds,
          allowedTransitions: [...enriched.workflowState.allowed_transitions],
        }
      : null,
    nextActions: enriched.nextActions.map(a => ({
      id: a.id,
      label: a.label,
      severity: a.severity,
      dueInDays: a.dueInDays,
    })),
    policies: policies.map(p => ({
      policyId: p.policy_id,
      title: p.title,
      body: p.body,
    })),
  };
}
```

**Step 3.4: Run the test — verify it passes**

Run: `bun run test src/test/caseChat.test.ts`
Expected: 4 tests pass.

**Step 3.5: Commit**

```bash
git add src/services/caseChat.ts src/test/caseChat.test.ts
git commit -m "Add buildCaseContext for case chat

Pure derivation of StructuredCaseContext from EnrichedCase, using
REFERENCE_DATE. Handles null workflowState and empty policies."
```

---

## Task 4: `sendCaseChatMessage` with TDD (success + all failure paths)

**Files:**
- Modify: `src/services/caseChat.ts` (add new export)
- Modify: `src/test/caseChat.test.ts` (append)

**Step 4.1: Write the failing tests**

Append to `src/test/caseChat.test.ts`:

```typescript
import { sendCaseChatMessage } from '../services/caseChat';
import type { StructuredCaseContext, ChatMessage } from '../types/case';

const stubContext: StructuredCaseContext = {
  caseId: 'CASE-TEST-001',
  caseType: 'benefits_review',
  status: 'under_review',
  referenceDate: '2026-04-16',
  applicant: { name: 'Test Person', reference: 'REF-001' },
  assignedTo: 'Test Worker',
  createdDate: '2026-03-01',
  riskScore: { level: 'warning', score: 5, factors: [] },
  caseNotes: '',
  timeline: [],
  evidenceItems: [],
  workflowState: null,
  nextActions: [],
  policies: [],
};

const stubMessages: ChatMessage[] = [{ role: 'user', content: 'hi' }];

describe('sendCaseChatMessage', () => {
  it('POSTs to the edge function and returns the assistant text on 200', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ text: 'Hello there.' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'anon-key');

    const text = await sendCaseChatMessage(stubContext, stubMessages);
    expect(text).toBe('Hello there.');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://example.supabase.co/functions/v1/case-chat');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.caseContext.caseId).toBe('CASE-TEST-001');
    expect(body.messages).toEqual(stubMessages);
  });

  it('throws when the edge function returns non-200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'boom' }), { status: 502 }),
      ),
    );
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'anon-key');

    await expect(sendCaseChatMessage(stubContext, stubMessages)).rejects.toThrow();
  });

  it('throws when the edge function returns 200 with empty text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ text: '' }), { status: 200 }),
      ),
    );
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'anon-key');

    await expect(sendCaseChatMessage(stubContext, stubMessages)).rejects.toThrow();
  });

  it('throws when fetch rejects (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'anon-key');

    await expect(sendCaseChatMessage(stubContext, stubMessages)).rejects.toThrow();
  });

  it('throws when VITE_SUPABASE_URL is missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'anon-key');
    await expect(sendCaseChatMessage(stubContext, stubMessages)).rejects.toThrow();
  });
});
```

**Step 4.2: Run — verify tests fail**

Run: `bun run test src/test/caseChat.test.ts`
Expected: new tests FAIL with `sendCaseChatMessage is not a function` (or similar). Existing `buildCaseContext` tests still pass.

**Step 4.3: Add `sendCaseChatMessage`**

Append to `src/services/caseChat.ts`:

```typescript
import type { ChatMessage } from '../types/case';

const EDGE_FUNCTION_PATH = '/functions/v1/case-chat';

function readSupabaseConfig(): { url: string; anonKey: string } {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey =
    import.meta.env.VITE_SUPABASE_ANON_KEY ??
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (typeof url !== 'string' || url.length === 0) {
    throw new Error('VITE_SUPABASE_URL not configured');
  }
  if (typeof anonKey !== 'string' || anonKey.length === 0) {
    throw new Error('VITE_SUPABASE_ANON_KEY / VITE_SUPABASE_PUBLISHABLE_KEY not configured');
  }
  return { url: url.replace(/\/+$/, ''), anonKey };
}

export async function sendCaseChatMessage(
  caseContext: StructuredCaseContext,
  messages: ChatMessage[],
): Promise<string> {
  const config = readSupabaseConfig();

  const response = await fetch(`${config.url}${EDGE_FUNCTION_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
    },
    body: JSON.stringify({
      caseContext,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    }),
  });

  if (!response.ok) {
    throw new Error(`Case chat edge function returned ${response.status}`);
  }

  const body = (await response.json()) as { text?: string };
  const text = (body.text ?? '').trim();
  if (!text) {
    throw new Error('Case chat edge function returned empty text');
  }
  return text;
}
```

Add `import type { StructuredCaseContext }` reference at the top if it's not already there (it is from Task 3's import).

**Step 4.4: Run — verify tests pass**

Run: `bun run test src/test/caseChat.test.ts`
Expected: 9 tests pass (4 from Task 3 + 5 new).

**Step 4.5: Commit**

```bash
git add src/services/caseChat.ts src/test/caseChat.test.ts
git commit -m "Add sendCaseChatMessage client for case-chat edge function

Matches the priority-insight fetch pattern: reads Supabase URL + anon
key from VITE_ env, posts JSON, throws on non-200 / empty text /
missing config. Error-handling discipline pushes the UI contract into
the caller (component gets to decide how to surface failures)."
```

---

## Task 5: `CaseChat` component — State 1 (collapsed)

**Files:**
- Create: `src/components/ai/CaseChat.tsx`
- Create: `src/test/components/CaseChat.test.tsx`

**Step 5.1: Write the failing test**

`src/test/components/CaseChat.test.tsx`:

```typescript
/**
 * CaseChat component tests.
 * Network stubbed with vi.stubGlobal('fetch', ...).
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CaseChat from '../../components/ai/CaseChat';
import { getAllEnrichedCases, policies } from '../../services/cases';

const enriched = getAllEnrichedCases()[0];
const relevantPolicies = policies.filter(p => p.case_type === enriched.case_type);

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe('CaseChat — State 1 (collapsed)', () => {
  it('renders the collapsed trigger with input and four chips', () => {
    render(<CaseChat enriched={enriched} policies={relevantPolicies} />);

    expect(
      screen.getByRole('textbox', { name: /ask about this case/i }),
    ).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /summarise this case/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /what's overdue\?/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /explain applicable policy/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /what's the next action\?/i })).toBeInTheDocument();
  });
});
```

**Step 5.2: Run — verify failure**

Run: `bun run test src/test/components/CaseChat.test.tsx`
Expected: FAIL — `Cannot find module`.

**Step 5.3: Implement CaseChat, State 1 only**

`src/components/ai/CaseChat.tsx`:

```typescript
/**
 * Case Chat Assistant component.
 * Renders above the Timeline on Case Detail.
 * States:
 *   1. Collapsed trigger (default): input + 4 suggestion chips
 *   2. Expanded with conversation (Task 6+)
 *   3. Expanded but empty (Task 6+)
 */

import { useState } from 'react';
import type { EnrichedCase, PolicyExtract, ChatMessage } from '../../types/case';

interface Props {
  enriched: EnrichedCase;
  policies: PolicyExtract[];
}

const SEED_CHIPS = [
  'Summarise this case',
  "What's overdue?",
  'Explain applicable policy',
  "What's the next action?",
] as const;

export default function CaseChat({ enriched, policies }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  // State 1 — Collapsed
  return (
    <div className="bg-white rounded shadow-sm px-5 py-4">
      <label className="block text-sm font-bold text-gray-800 mb-2" htmlFor="case-chat-input">
        Ask about this case
      </label>
      <input
        id="case-chat-input"
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="e.g. What evidence is outstanding?"
        className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-[3px] focus:ring-[#ffdd00]"
      />
      <div className="flex flex-wrap gap-2 mt-3">
        {SEED_CHIPS.map(chip => (
          <button
            key={chip}
            type="button"
            className="text-xs px-3 py-1.5 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-[3px] focus:ring-[#ffdd00]"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}
```

**Step 5.4: Run — verify pass**

Run: `bun run test src/test/components/CaseChat.test.tsx`
Expected: 1 test passes.

**Step 5.5: Commit**

```bash
git add src/components/ai/CaseChat.tsx src/test/components/CaseChat.test.tsx
git commit -m "Add CaseChat component skeleton (State 1 collapsed)

Renders the collapsed trigger with an input and four static suggestion
chips. No send behaviour yet; that arrives in the next task."
```

---

## Task 6: Chip submit → user bubble → assistant reply (happy path)

**Files:**
- Modify: `src/components/ai/CaseChat.tsx`
- Modify: `src/test/components/CaseChat.test.tsx`

**Step 6.1: Write the failing test**

Append to `src/test/components/CaseChat.test.tsx`:

```typescript
import { waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('CaseChat — chip submit → assistant reply', () => {
  it('clicking a chip expands, renders user bubble, POSTs to edge function, renders assistant bubble', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ text: 'Three items are outstanding.' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'anon-key');

    render(<CaseChat enriched={enriched} policies={relevantPolicies} />);

    await user.click(screen.getByRole('button', { name: /what's overdue\?/i }));

    // user bubble appears immediately
    expect(screen.getByText("What's overdue?")).toBeInTheDocument();

    // fetch was called once with the expected body
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.messages).toEqual([{ role: 'user', content: "What's overdue?" }]);
    expect(body.caseContext.caseId).toBe(enriched.case_id);

    // assistant bubble arrives after fetch resolves
    await waitFor(() =>
      expect(screen.getByText('Three items are outstanding.')).toBeInTheDocument(),
    );
  });

  it('typing in the input and pressing Enter submits the message', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ text: 'OK.' }), { status: 200 }),
      ),
    );
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'anon-key');

    render(<CaseChat enriched={enriched} policies={relevantPolicies} />);

    const input = screen.getByRole('textbox', { name: /ask about this case/i });
    await user.type(input, 'what happened in march?{Enter}');

    await waitFor(() =>
      expect(screen.getByText('what happened in march?')).toBeInTheDocument(),
    );
  });
});
```

**Step 6.2: Run — verify failure**

Run: `bun run test src/test/components/CaseChat.test.tsx`
Expected: new tests FAIL (chip click does nothing / no user bubble in DOM).

**Step 6.3: Implement send flow**

Replace the body of `src/components/ai/CaseChat.tsx` with:

```typescript
import { useState, useMemo, useRef, useEffect } from 'react';
import type { EnrichedCase, PolicyExtract, ChatMessage } from '../../types/case';
import { buildCaseContext, sendCaseChatMessage } from '../../services/caseChat';

interface Props {
  enriched: EnrichedCase;
  policies: PolicyExtract[];
}

const SEED_CHIPS = [
  'Summarise this case',
  "What's overdue?",
  'Explain applicable policy',
  "What's the next action?",
] as const;

export default function CaseChat({ enriched, policies }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const caseContext = useMemo(
    () => buildCaseContext(enriched, policies),
    [enriched, policies],
  );

  const listEndRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isLoading]);

  async function submit(content: string) {
    const trimmed = content.trim();
    if (!trimmed || isLoading) return;

    setIsExpanded(true);
    setInput('');
    const next: ChatMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(next);
    setIsLoading(true);

    try {
      const reply = await sendCaseChatMessage(caseContext, next);
      setMessages([...next, { role: 'assistant', content: reply }]);
    } catch {
      setMessages([
        ...next,
        {
          role: 'assistant',
          content: "Couldn't reach the assistant. Retry?",
          status: 'error',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit(input);
    }
  }

  const showConversation = isExpanded && messages.length > 0;

  return (
    <div className="bg-white rounded shadow-sm px-5 py-4">
      <label className="block text-sm font-bold text-gray-800 mb-2" htmlFor="case-chat-input">
        Ask about this case
      </label>

      {showConversation && (
        <div
          role="log"
          aria-live="polite"
          className="mb-3 max-h-[480px] overflow-y-auto space-y-2 border rounded p-3"
        >
          {messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === 'user'
                  ? 'flex justify-end'
                  : m.status === 'error'
                    ? 'flex justify-start'
                    : 'flex justify-start'
              }
            >
              <div
                className={
                  m.role === 'user'
                    ? 'max-w-[80%] rounded px-3 py-2 text-sm bg-white border border-[#1d70b8] text-gray-900'
                    : m.status === 'error'
                      ? 'max-w-[80%] rounded px-3 py-2 text-sm bg-[#fde8e8] text-[#d4351c]'
                      : 'max-w-[80%] rounded px-3 py-2 text-sm bg-[#f3f2f1] text-gray-800'
                }
              >
                {m.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded px-3 py-2 text-sm bg-[#f3f2f1] text-gray-500 animate-pulse">
                Assistant is thinking…
              </div>
            </div>
          )}
          <div ref={listEndRef} />
        </div>
      )}

      <input
        id="case-chat-input"
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isLoading}
        placeholder="e.g. What evidence is outstanding?"
        className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-[3px] focus:ring-[#ffdd00] disabled:bg-gray-50"
      />

      {!showConversation && (
        <div className="flex flex-wrap gap-2 mt-3">
          {SEED_CHIPS.map(chip => (
            <button
              key={chip}
              type="button"
              onClick={() => void submit(chip)}
              className="text-xs px-3 py-1.5 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-[3px] focus:ring-[#ffdd00]"
            >
              {chip}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 6.4: Install `@testing-library/user-event` if missing**

Run: `grep -q '"@testing-library/user-event"' package.json && echo ok || bun add -d @testing-library/user-event`
Expected: either `ok` or `installed`.

**Step 6.5: Run — verify pass**

Run: `bun run test src/test/components/CaseChat.test.tsx`
Expected: 3 tests pass (1 from Task 5 + 2 new).

**Step 6.6: Commit**

```bash
git add src/components/ai/CaseChat.tsx src/test/components/CaseChat.test.tsx package.json bun.lock
git commit -m "Wire CaseChat send flow: chip/Enter → user bubble → assistant reply

Chip click or Enter in the input submits through buildCaseContext +
sendCaseChatMessage, rendering user and assistant bubbles in an
aria-live log. Pending state shows a Thinking… bubble and disables
the input."
```

---

## Task 7: Error + Retry

**Files:**
- Modify: `src/components/ai/CaseChat.tsx`
- Modify: `src/test/components/CaseChat.test.tsx`

**Step 7.1: Write the failing test**

Append to `src/test/components/CaseChat.test.tsx`:

```typescript
describe('CaseChat — error and retry', () => {
  it('renders an error bubble with a Retry button on fetch failure', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'anon-key');

    render(<CaseChat enriched={enriched} policies={relevantPolicies} />);
    await user.click(screen.getByRole('button', { name: /what's overdue\?/i }));

    await waitFor(() =>
      expect(screen.getByText(/couldn't reach the assistant/i)).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('clicking Retry re-sends the same user message and replaces the error on success', async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ text: 'Here is the answer.' }), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'anon-key');

    render(<CaseChat enriched={enriched} policies={relevantPolicies} />);
    await user.click(screen.getByRole('button', { name: /what's overdue\?/i }));

    await waitFor(() =>
      expect(screen.getByText(/couldn't reach the assistant/i)).toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() =>
      expect(screen.getByText('Here is the answer.')).toBeInTheDocument(),
    );
    expect(screen.queryByText(/couldn't reach the assistant/i)).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
```

**Step 7.2: Run — verify failure**

Run: `bun run test src/test/components/CaseChat.test.tsx`
Expected: new tests FAIL (Retry button not rendered, or retry doesn't re-POST).

**Step 7.3: Implement error + retry**

In `src/components/ai/CaseChat.tsx`, update the error branch in `submit`:

- Track the *last user message* so Retry has something to replay. Since error bubbles always immediately follow the user turn, we can compute it from the messages array: when the last assistant message has `status: 'error'`, the second-to-last message (role `user`) is the one to resend.

Extract the core send logic into a helper so Retry can reuse it:

```typescript
  async function sendAndAppend(history: ChatMessage[]) {
    setIsLoading(true);
    try {
      const reply = await sendCaseChatMessage(caseContext, history);
      setMessages([...history, { role: 'assistant', content: reply }]);
    } catch {
      setMessages([
        ...history,
        {
          role: 'assistant',
          content: "Couldn't reach the assistant. Retry?",
          status: 'error',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  async function submit(content: string) {
    const trimmed = content.trim();
    if (!trimmed || isLoading) return;
    setIsExpanded(true);
    setInput('');
    const next: ChatMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(next);
    await sendAndAppend(next);
  }

  async function retry() {
    if (isLoading) return;
    // Drop the trailing error bubble; resend with the user turns that remain.
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'assistant' || last.status !== 'error') return;
    const historyWithoutError = messages.slice(0, -1);
    setMessages(historyWithoutError);
    await sendAndAppend(historyWithoutError);
  }
```

In the JSX, render a Retry button inside the error bubble:

```tsx
              <div className="...">
                {m.content}
                {m.status === 'error' && (
                  <button
                    type="button"
                    onClick={() => void retry()}
                    className="ml-2 underline font-semibold focus:outline-none focus:ring-[3px] focus:ring-[#ffdd00] rounded"
                    aria-label={`Retry: ${
                      messages[i - 1]?.content?.slice(0, 40) ?? 'previous message'
                    }`}
                  >
                    Retry
                  </button>
                )}
              </div>
```

**Step 7.4: Run — verify pass**

Run: `bun run test src/test/components/CaseChat.test.tsx`
Expected: 5 tests pass.

**Step 7.5: Commit**

```bash
git add src/components/ai/CaseChat.tsx src/test/components/CaseChat.test.tsx
git commit -m "Add inline error bubble + Retry to CaseChat

On fetch failure, append a red error bubble with a Retry button.
Retry drops the trailing error turn and re-sends the previous user
message through the same send path."
```

---

## Task 8: Session persistence via `sessionStorage`

**Files:**
- Modify: `src/components/ai/CaseChat.tsx`
- Modify: `src/test/components/CaseChat.test.tsx`

**Step 8.1: Write the failing test**

Append to `src/test/components/CaseChat.test.tsx`:

```typescript
describe('CaseChat — session persistence', () => {
  it('persists messages to sessionStorage keyed by case_id', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ text: 'Persisted reply.' }), { status: 200 }),
      ),
    );
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'anon-key');

    render(<CaseChat enriched={enriched} policies={relevantPolicies} />);
    await user.click(screen.getByRole('button', { name: /summarise this case/i }));
    await waitFor(() =>
      expect(screen.getByText('Persisted reply.')).toBeInTheDocument(),
    );

    const stored = sessionStorage.getItem(`case-chat:${enriched.case_id}`);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored as string);
    expect(parsed.length).toBe(2);
    expect(parsed[0].content).toBe('Summarise this case');
  });

  it('hydrates from sessionStorage on mount', () => {
    sessionStorage.setItem(
      `case-chat:${enriched.case_id}`,
      JSON.stringify([
        { role: 'user', content: 'earlier question' },
        { role: 'assistant', content: 'earlier answer' },
      ]),
    );

    render(<CaseChat enriched={enriched} policies={relevantPolicies} />);
    expect(screen.getByText('earlier question')).toBeInTheDocument();
    expect(screen.getByText('earlier answer')).toBeInTheDocument();
  });

  it('resets to empty on case_id change', () => {
    sessionStorage.setItem(
      `case-chat:${enriched.case_id}`,
      JSON.stringify([{ role: 'user', content: 'A' }, { role: 'assistant', content: 'B' }]),
    );
    const other = getAllEnrichedCases()[1];

    const { rerender } = render(
      <CaseChat enriched={enriched} policies={relevantPolicies} />,
    );
    expect(screen.getByText('A')).toBeInTheDocument();

    rerender(<CaseChat enriched={other} policies={[]} />);
    expect(screen.queryByText('A')).not.toBeInTheDocument();
  });
});
```

**Step 8.2: Run — verify failure**

Run: `bun run test src/test/components/CaseChat.test.tsx`
Expected: new tests FAIL.

**Step 8.3: Implement persistence**

In `src/components/ai/CaseChat.tsx`, replace the `useState<ChatMessage[]>([])` initialiser and add effects keyed on `enriched.case_id`:

```typescript
  const storageKey = `case-chat:${enriched.case_id}`;

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as ChatMessage[]) : [];
    } catch {
      return [];
    }
  });

  // Reset when caseId changes (e.g. navigating between cases)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      setMessages(Array.isArray(parsed) ? (parsed as ChatMessage[]) : []);
      setIsExpanded(Array.isArray(parsed) && parsed.length > 0);
    } catch {
      setMessages([]);
      setIsExpanded(false);
    }
  }, [storageKey]);

  // Persist on change
  useEffect(() => {
    if (messages.length === 0) {
      sessionStorage.removeItem(storageKey);
    } else {
      sessionStorage.setItem(storageKey, JSON.stringify(messages));
    }
  }, [storageKey, messages]);
```

Note: `isExpanded` should also be initialised to `messages.length > 0` so a hydrated conversation opens directly into State 2.

Change:
```typescript
  const [isExpanded, setIsExpanded] = useState(false);
```
to:
```typescript
  const [isExpanded, setIsExpanded] = useState(() => {
    try {
      const raw = sessionStorage.getItem(`case-chat:${enriched.case_id}`);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) && parsed.length > 0;
    } catch {
      return false;
    }
  });
```

**Step 8.4: Run — verify pass**

Run: `bun run test src/test/components/CaseChat.test.tsx`
Expected: 8 tests pass.

**Step 8.5: Commit**

```bash
git add src/components/ai/CaseChat.tsx src/test/components/CaseChat.test.tsx
git commit -m "Persist CaseChat conversation to sessionStorage per case_id

Hydrate on mount, reset on case_id change, write on every message
change. Conversations survive within-tab navigation and clear on
tab close."
```

---

## Task 9: Turn cap

**Files:**
- Modify: `src/components/ai/CaseChat.tsx`
- Modify: `src/test/components/CaseChat.test.tsx`

**Step 9.1: Write the failing test**

Append to `src/test/components/CaseChat.test.tsx`:

```typescript
describe('CaseChat — turn cap', () => {
  it('disables the input and shows a limit notice at 20 messages', () => {
    const full: ChatMessage[] = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `msg ${i}`,
    }));
    sessionStorage.setItem(`case-chat:${enriched.case_id}`, JSON.stringify(full));

    render(<CaseChat enriched={enriched} policies={relevantPolicies} />);

    const input = screen.getByRole('textbox', { name: /ask about this case/i });
    expect(input).toBeDisabled();
    expect(screen.getByText(/conversation limit reached/i)).toBeInTheDocument();
  });
});
```

Import `ChatMessage` type at the top of the test file if not already imported.

**Step 9.2: Run — verify failure**

Run: `bun run test src/test/components/CaseChat.test.tsx`
Expected: new test FAILs.

**Step 9.3: Implement the cap**

In `src/components/ai/CaseChat.tsx`:

```typescript
const TURN_CAP = 20;

// ...inside the component, after `messages` is derived:
const atCap = messages.length >= TURN_CAP;

// modify the submit function to refuse at cap:
  async function submit(content: string) {
    const trimmed = content.trim();
    if (!trimmed || isLoading || atCap) return;
    // ... rest unchanged
  }
```

In JSX, after the log div and before the input, render the cap notice:

```tsx
{atCap && (
  <div className="mb-2 text-xs px-3 py-2 rounded bg-[#fff9e6] text-[#6d4000]">
    Conversation limit reached — collapse and reopen to start a new thread.
  </div>
)}
```

And change the input `disabled={isLoading}` to `disabled={isLoading || atCap}`.

**Step 9.4: Run — verify pass**

Run: `bun run test src/test/components/CaseChat.test.tsx`
Expected: 9 tests pass.

**Step 9.5: Commit**

```bash
git add src/components/ai/CaseChat.tsx src/test/components/CaseChat.test.tsx
git commit -m "Cap CaseChat at 20 messages to bound prompt size

At the cap, the input is disabled and an amber notice is shown.
Protects against runaway prompts and surprise token bills."
```

---

## Task 10: Wire `CaseChat` into `CaseDetail`

**Files:**
- Modify: `src/pages/CaseDetail.tsx`

**Step 10.1: Add import and render**

In `src/pages/CaseDetail.tsx`:

1. Add the import at the top (after the existing AI imports or alongside `RiskBadge`):
   ```typescript
   import CaseChat from '../components/ai/CaseChat';
   ```
2. In the default export's JSX, render `<CaseChat />` between `<CaseHeader enriched={enriched} />` and the `<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">`:
   ```tsx
   <CaseHeader enriched={enriched} />

   <CaseChat enriched={enriched} policies={policies} />

   <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
   ```

**Step 10.2: Run the full test suite**

Run: `bun run test`
Expected: all tests pass. The pre-existing `CaseDetail` integration test (`src/test/scenarios/caseDetail.integration.test.tsx`) will now render `CaseChat`. If it asserts on the exact set of panels, adjust assertions to tolerate the new chat card (it should — the existing tests assert on specific panels by text, and the chat has a unique "Ask about this case" label that doesn't clash).

If a pre-existing test fails because of `CaseChat` mounting without `VITE_SUPABASE_URL` stubbed: the component does not call `fetch` until the user interacts, so a mount-only test should be unaffected. If any test triggers the chat inadvertently, stub `fetch` in that test's setup.

**Step 10.3: Lint**

Run: `bun run lint`
Expected: no new errors.

**Step 10.4: Commit**

```bash
git add src/pages/CaseDetail.tsx
git commit -m "Render CaseChat above the Timeline on Case Detail

Full-width card placed between CaseHeader and the two-column grid.
No changes to routing, services, or other panels."
```

---

## Task 11: Manual QA + dev server smoke

**Step 11.1: Start the dev server**

Run (background): `bun dev`
Expected: server ready on `http://localhost:8080`.

**Step 11.2: Smoke-test three cases**

For each of three fixture cases (one critical, one warning, one normal) — pick from `/` — verify in the browser:

1. Chat card renders above the Timeline, collapsed.
2. Typing in the input works; pressing Enter submits.
3. Clicking each of the four chips submits that chip.
4. The assistant reply arrives (or, if edge function is not yet deployed with OPENAI_API_KEY, you get the inline error bubble with Retry — that's expected until deploy).
5. Navigate to `/` and back to the same case: conversation is still there.
6. Navigate to a *different* case: conversation starts empty.
7. Refresh the page: conversation still there (same tab session).
8. Close the tab and reopen: conversation gone (sessionStorage semantics).

**Step 11.3: Confirm edge-function deploys**

The edge function deploys automatically via Lovable when committed. Confirm it's live by watching the browser Network tab for a 200 response to `POST /functions/v1/case-chat`.

If you're running entirely locally and don't have Lovable wired up, stub the edge function reply locally via `supabase functions serve case-chat` per Supabase docs, or accept that the UI will show the error/retry bubble in local development without OPENAI_API_KEY.

**Step 11.4: No commit** unless a bug surfaces.

---

## Task 12: Finish the branch

Once all tasks pass and manual QA is clean:

1. `git log --oneline main..HEAD` — verify the commit history reads as a clean sequence of TDD steps.
2. Invoke `superpowers:finishing-a-development-branch` to pick the integration path (PR, merge, etc.).

---

## Checklist summary

- [ ] Task 1 — Edge function bootstrapped
- [ ] Task 2 — Types added
- [ ] Task 3 — `buildCaseContext` + tests
- [ ] Task 4 — `sendCaseChatMessage` + tests
- [ ] Task 5 — CaseChat State 1 + tests
- [ ] Task 6 — Chip submit happy path + tests
- [ ] Task 7 — Error + Retry + tests
- [ ] Task 8 — Session persistence + tests
- [ ] Task 9 — Turn cap + tests
- [ ] Task 10 — Wired into CaseDetail
- [ ] Task 11 — Manual QA on three cases
- [ ] Task 12 — Finish branch
