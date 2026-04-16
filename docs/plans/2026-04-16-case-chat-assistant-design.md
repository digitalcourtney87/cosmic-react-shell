# Case Chat Assistant — Design Spec

**Feature**: Per-case LLM chat for caseworker synthesis questions
Prepared by Courtney Allen · 2026-04-16

A per-case chat panel rendered above the Timeline on the Case Detail page, carrying the full case record as context so caseworkers can ask synthesising questions without re-reading the page.

**Locked decisions (from brainstorming)**:

- **Scope** — Q&A plus guided reasoning over the case record. No drafting, no workflow recommendations.
- **Persistence** — Per-tab session only (`sessionStorage`), keyed by `case_id`. No `localStorage`, no backend.
- **Context** — Full structured case record (header, notes, timeline, evidence, policies, workflow, next actions). No live GOV.UK results.
- **UI** — Full-width card above the two-column grid, collapsed by default, expands on interaction.
- **Responses** — One-shot (match the existing `priority-insight` pattern). No streaming.
- **Failures** — Inline error bubble with Retry; conversation preserved on failure.
- **Seed prompts** — Four static suggestion chips, identical on every case.

---

## 1. Product Framing

### Problem

The Case Detail page already surfaces every fact a caseworker needs (timeline, notes, evidence, policy, workflow state), but synthesising across those panels — *"is anything overdue and why?"*, *"what does the policy say about evidence X?"*, *"walk me through what's happened on this case"* — still requires the caseworker to read the whole page and join the dots themselves. That's the gap this feature closes: a conversational surface that reasons across the panels Sam is already looking at.

### Primary user story (P1)

Sam opens a case. Above the Timeline she sees a collapsed *"Ask about this case"* card with four suggestion chips. She clicks *What's overdue?*. The card expands into a chat panel, her message appears as a user bubble, a 1–2 second spinner runs, and the assistant replies in 2–5 sentences grounded in the case's evidence table and workflow thresholds. She asks a follow-up; the prior turn is still in context. She collapses the panel to read the Timeline below. On navigating away and returning within the same tab, her conversation is still there. Opening a different case gives her a fresh, empty thread for that case.

### In Scope

- Q&A and guided synthesis over the case record (notes, timeline, evidence, policy, workflow state, next actions).
- Multi-turn conversation within a tab session.
- Four static seed prompts as suggestion chips.
- Inline error bubble with per-message Retry on LLM or network failure.
- Session persistence keyed by `case_id`.

### Out of Scope

- Drafting letters, escalation notices, or any formal correspondence.
- Recommending workflow transitions or case outcomes.
- Citing live GOV.UK search results (they're adjacent on the page; not in prompt context).
- Cross-case questions (*"compare this to CASE-1234"*).
- Persistence beyond the tab session. No `localStorage`, no backend storage.
- Streaming responses. One-shot only in v1.
- Writing any state back to the fixtures or a database.
- A "Clear conversation" button (tab close handles it).

---

## 2. Architecture

### Folder additions

```
src/
  components/
    ai/
      CaseChat.tsx           ← new
  services/
    caseChat.ts              ← new
supabase/
  functions/
    case-chat/
      index.ts               ← new
```

No changes to `src/services/cases.ts`, routing, or existing AI components.

### Edge function: `case-chat`

Mirrors `priority-insight` in shape, CORS, error handling, and deployment:

```
POST /functions/v1/case-chat
Body: {
  caseContext: StructuredCaseContext,
  messages: [{ role: 'user' | 'assistant', content: string }, ...]
}
Response 200: { text: string }
Response 4xx/5xx: { error: string, detail?: string }
```

- Deno runtime. `OPENAI_API_KEY` stays server-side.
- `gpt-4o-mini`, `temperature: 0.2`, `max_tokens: 400`, `response_format: { type: 'text' }`.
- System prompt is a constant in the edge function (see §4).
- On turn 1, the user message content is `"CASE RECORD:\n<json>\n\nQUESTION:\n<user text>"`. On subsequent turns, the case record is not re-sent — the LLM carries it forward from turn 1.

### Client service: `src/services/caseChat.ts`

Two exports:

- `buildCaseContext(enriched: EnrichedCase, policies: PolicyExtract[]): StructuredCaseContext` — pure, synchronous. Reads `REFERENCE_DATE` from `src/lib/constants.ts` (never `new Date()`, per Constitution §II).
- `sendCaseChatMessage(context, messages): Promise<string>` — POSTs to the edge function, returns assistant text, throws on failure (including 200-with-empty-text).

### Frontend component: `CaseChat.tsx`

Rendered in `CaseDetail.tsx` between `<CaseHeader />` and the `grid grid-cols-1 lg:grid-cols-3` block, so it spans full content width above both the Timeline column and the right-column panels.

React state owned by the component:

- `messages: ChatMessage[]`
- `input: string`
- `isLoading: boolean`
- `error: string | null`  (per-turn, cleared on retry)
- `isExpanded: boolean`

Effects:

- Hydrate `messages` from `sessionStorage['case-chat:${caseId}']` on mount.
- Persist `messages` to the same key on change.
- When `caseId` changes (navigation between cases), reset all state and rehydrate for the new case.

---

## 3. Data Contracts

### StructuredCaseContext

```ts
interface StructuredCaseContext {
  caseId: string;
  caseType: string;
  status: string;
  referenceDate: string;          // from REFERENCE_DATE
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
```

### ChatMessage

```ts
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  status?: 'ok' | 'error';        // 'error' marks a failed assistant turn eligible for Retry
}
```

---

## 4. System Prompt

```
You are a decision-support assistant for a UK government caseworker.
You are given one case record as JSON. Answer the caseworker's questions
using only the information in that record. When asked about dates,
compute relative to referenceDate, never today's real date. If a
question cannot be answered from the record, say so plainly: "The case
record doesn't show that." Do not invent case references, policy
identifiers, dates, or evidence items. Do not draft letters, notices,
or formal correspondence. Do not recommend workflow transitions. Keep
answers to 2-5 sentences of plain English. Do not use emoji.
```

Rationale for each clause:

- *"using only the information in that record"* — the primary hallucination guardrail.
- *"compute relative to referenceDate"* — the fixture is frozen at 2026-04-16; without this the LLM would use its real clock.
- *"The case record doesn't show that"* — gives the model an explicit escape hatch so it doesn't fabricate under pressure.
- *"Do not draft... Do not recommend workflow transitions"* — enforces the Q1-B scope boundary against the Q1-C copilot drift.
- *"2-5 sentences"* — bounds answer length for chat-bubble readability and cost.

---

## 5. UI States

All three states render at full content width, above the two-column grid.

### State 1 — Collapsed (default)

- Single rounded card, ~72px tall.
- Left: AI icon + label *"Ask about this case"*.
- Centre: text input, placeholder *"e.g. What evidence is outstanding?"*.
- Below: row of four chips:
  1. *Summarise this case*
  2. *What's overdue?*
  3. *Explain applicable policy*
  4. *What's the next action?*
- Focusing the input expands to State 2 (or 3 if empty). Clicking a chip expands and auto-submits that chip text as the first user message.

### State 2 — Expanded with conversation

- Card grows to `max-h-[480px]` with a scrollable message list.
- User bubbles: right-aligned, white bg, blue border `#1d70b8`.
- Assistant bubbles: left-aligned, grey bg `#f3f2f1`.
- Pending response: pulsing *"Assistant is thinking…"* bubble in the assistant slot; input disabled.
- Error turn: red bg `#fde8e8`, red text `#d4351c`, inline *"Retry"* button that re-sends the triggering user message and replaces the error bubble with a fresh assistant bubble.
- Input row at bottom: text input + Send button. Enter submits, Shift+Enter inserts newline.
- Header of card: *"Ask about this case"* label + *"Collapse"* text button (returns to State 1 *without* clearing messages).

### State 3 — Expanded but empty

- Triggered when the card is opened but `messages` is empty.
- Message area shows the four chips centred as large buttons (same labels as State 1).
- Clicking a chip submits it as the first user message and transitions to State 2.

### Session hydration

On mount, read `sessionStorage['case-chat:${caseId}']`. If the value parses to a non-empty `ChatMessage[]`, mount in State 2. Otherwise mount in State 1.

---

## 6. Failure Handling

Per-turn, conversation preserved. The `messages` array always reflects exactly what's on screen.

| Failure | Behaviour |
|---|---|
| Edge function returns non-200 | Append assistant turn with `status: 'error'`, body *"Couldn't reach the assistant. Retry?"* + inline Retry. |
| Edge function returns 200 with empty `text` | Same as above. |
| Client `fetch` throws (network) | Same as above. |
| OpenAI content-policy refusal (surfaces as edge-function error) | Error bubble shows OpenAI's error text verbatim, unchanged from `priority-insight` behaviour. |
| Turn cap reached (`messages.length >= 20`) | Input disabled; non-error informational bubble *"Conversation limit reached — collapse and reopen to start a new thread."* Reopening doesn't clear messages; the cap only lifts after the session ends or the user navigates to a different case. |

**Retry** re-sends the last user message (the one that triggered the error), replaces the error bubble with a fresh pending bubble, and on success replaces that with the assistant's reply. If retry also fails, a new error bubble appears; the same Retry button is available again.

---

## 7. Accessibility

- Collapsed trigger, chips, Send, Retry, and Collapse are native `<button>` elements.
- Input has a visible or `sr-only` `<label>`.
- Message list: `role="log"` + `aria-live="polite"` so screen readers announce new assistant replies without interrupting.
- Retry button: `aria-label="Retry: <first 40 chars of the user message>"`.
- Card header has `aria-expanded` reflecting `isExpanded`.
- Focus ring uses the site-wide GDS pattern: `focus:outline-none focus:ring-[3px] focus:ring-[#ffdd00]`.
- All interactive elements reachable by Tab in DOM source order.

---

## 8. Tests

Vitest + React Testing Library, under `src/test/` alongside existing tests. Run with `bun run test` (not `bun test` — see CLAUDE.md).

**Unit — `buildCaseContext`:**

- Snapshot test: given a fixture `EnrichedCase`, produced JSON matches the frozen expected shape.
- `referenceDate` equals `REFERENCE_DATE` (not `new Date()`).
- Empty timeline / empty evidence / null workflowState handled without throwing.

**Component — `CaseChat`:**

- Mounts in State 1 when `sessionStorage` is empty.
- Mounts in State 2 when `sessionStorage` has a saved conversation for this `caseId`.
- Clicking a suggestion chip expands the card and submits the chip text as a user bubble.
- `fetch` mocked — POST body shape matches the contract (has `caseContext` + `messages`).
- 200 response with `{ text }` renders the assistant bubble.
- 500 response renders the error bubble with a Retry button; clicking Retry re-POSTs with the same user message.
- Unmount + remount within the same test tab → messages restored.
- Navigating to a different `caseId` resets state to State 1.
- Turn cap: 20 messages in sessionStorage → input disabled, informational bubble rendered.

---

## 9. Build Order

1. `supabase/functions/case-chat/index.ts` — copy `priority-insight`, swap the prompt and request shape, verify with `curl`.
2. `src/services/caseChat.ts` — `buildCaseContext` + `sendCaseChatMessage`. Ship with the `buildCaseContext` snapshot test.
3. `src/components/ai/CaseChat.tsx` — States 1 → 3 → 2 → error, in that order. Component tests alongside.
4. Wire into `CaseDetail.tsx` above the two-column grid. Manual smoke test on three fixture cases (a critical, a warning, a green).
5. Lighthouse pass — verify no regressions to the Case Detail page score.

---

## 10. Governance

Spec-kit artefacts (if generated) would live under `specs/003-case-chat-assistant/`. This design doc is the source of truth until those artefacts exist; if they diverge, this doc wins (per CLAUDE.md governance note).

Conforms to Constitution v1.2.0:

- **§II Derive, don't store** — `buildCaseContext` derives from `EnrichedCase`; no new fixture fields.
- **§IV YAGNI** — No streaming, no `localStorage`, no clear button, no dynamic chips, no write-back. Every feature above earns its line.
- **Frozen reference date** — `referenceDate` injected from `REFERENCE_DATE`; edge function and prompt both respect it.
