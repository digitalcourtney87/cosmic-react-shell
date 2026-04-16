# Case Action Pages — Design

**Date:** 2026-04-16
**Feature ID:** 003-case-action-pages
**Route:** `/case/:caseId/action/:actionId` (existing — replaces current `ActionStub`)
**Status:** Design approved, ready for spec-kit + implementation

## Goal

Replace the read-only `ActionStub` page with a richer **navigation aid + intelligence** page that helps a caseworker:
1. See the case context they are acting on without going back
2. Understand the action's procedural steps and the policy that drives it
3. See the evidence currently on file scoped to this action
4. Read a 2–3 sentence AI-generated note that summarises evidence state and recommends one concrete next step

The page remains **read-only** — no state writes, no form submission, no "mark complete" buttons. This is consistent with the constitution (`the assistant reads EnrichedCase[]; it writes nothing`).

## Non-goals

- Persisted state of any kind (no marking actions complete, no draft autosave)
- Sufficiency judgments by the LLM ("you can decide" / "you cannot decide")
- Any reasoning the LLM does that is not validated against deterministic inputs
- A new route, layout shell, or design system

## Architecture

### Data sources (all already loaded)

| Source | Function | Purpose |
|---|---|---|
| `cases.json` | `getEnrichedCaseById(caseId)` | Full `EnrichedCase` (case header, evidence, risk, workflow) |
| `page-index.json` | `getActionEntry(case_type, actionId)` | `ActionEntry` (label, policy_refs, pages, urgency_trigger_days) |
| `policy-extracts.json` | `getPoliciesForCase(case_type)` | `PolicyExtract[]` with full body text |

No new fixtures. No new fetches at the data layer (other than the AI advice edge function call).

### New pure derivations (`src/lib/derive.ts`, or a new `src/lib/action.ts`)

```ts
selectActionEvidence(
  enriched: EnrichedCase,
  action: ActionEntry,
): { items: EvidenceItem[]; scope: 'action' | 'case-wide' }
```

Filter `enriched.evidenceItems` to those whose `policyId` is in `action.policy_refs`. If the result has **≤ 1 items** OR `action.policy_refs` is empty, widen to the full case evidence and return `scope: 'case-wide'`. Items are sorted by `(status priority [overdue → outstanding → received], policyId, requirement)` so the deterministic compose function always cites the same "first non-received" requirement across renders.

```ts
buildEvidenceAdviceInputs(
  enriched: EnrichedCase,
  action: ActionEntry,
  scoped: { items: EvidenceItem[]; scope: 'action' | 'case-wide' },
  policies: PolicyExtract[],
): EvidenceAdviceInputs
```

Assembles the deterministic input bag (see Service contract below).

### New AI service (`src/services/ai.ts`)

```ts
getEvidenceAdvice(
  inputs: EvidenceAdviceInputs,
  signal?: AbortSignal,
): Promise<EvidenceAdviceResult>
```

Mirrors `getPriorityInsight` exactly:
- Reads Supabase config from `import.meta.env`
- 5 second timeout
- POSTs to a new edge function path `/functions/v1/evidence-advice`
- Validates response via `validateEvidenceResponse(text, inputs)`
- Returns `{ status: 'llm' | 'fallback', text, inputs, reason? }`

### New edge function (`supabase/functions/evidence-advice/index.ts`)

Same shape as `priority-insight/index.ts`:
- CORS preflight handler
- POST validates body, reads `OPENAI_API_KEY` from Deno env
- Calls `gpt-4o-mini`, `temperature: 0.2`, `max_tokens: 220`
- Returns `{ text }` on success, `{ error }` on failure

System prompt (one block):

> You are a decision-support assistant for a UK government caseworker named Sam. You will be given an action she needs to take and the evidence currently on file for it. Write a 2-to-3-sentence note that: (1) names the case by its reference and the action by its label; (2) summarises the evidence state by count and names at least one specific outstanding or overdue requirement when any exist; (3) recommends one concrete next step that cites a policy ID when one is provided. Do not invent requirements, policies, or counts. Do not soften the recommendation. Be direct. Do not use emoji.

User prompt is assembled from `EvidenceAdviceInputs` — case ref, action label, scope flag, policy list, evidence rows, counts.

### Page composition

Single-column layout, `max-w-screen-xl`, `space-y-6`, GDS palette. Four stacked sections:

**1. Case context header** *(new component, reuses `CaseHeader` styling from `CaseDetail.tsx`)*
- Breadcrumb: `All cases › {caseId} › {actionLabel}`
- Case type pill, applicant name (h1), reference, assigned_to, status pill, `RiskBadge`
- No action metadata here — that lives in section 2

**2. Action panel** *(retained from existing `ActionStub`)*
- Severity badge + action_id + "Mock action page" pill
- Action label (h1 within card)
- Due-in-days chip
- "Pages to navigate" numbered list
- Policy ref pills

**3. Policy excerpts** *(new — reuses `PolicyPanel` accordion pattern)*
- Radix `Accordion` with one item per policy in `action.policy_refs`
- Trigger: `policy_id` (mono) + title; Content: full `body`
- First policy default-open
- Missing policy → muted "Policy {id} — not extracted in fixture" row
- Action with empty `policy_refs` → omit section entirely

**4. Evidence & AI Advice grid** *(2-col on lg, stacked on mobile)*
- **Left (lg:col-span-2) — Evidence table:** identical styling to existing `EvidenceTracker`. Header reflects scope: "Evidence for this action" (action) or "All case evidence — no items specific to this action" (case-wide). Empty state: "No evidence recorded for this case yet."
- **Right (lg:col-span-1) — `EvidenceAdvice` card:**
  - `pending` → skeleton matching `GovUKGuidance` loader
  - `llm` → paraphrased text + small "AI" pill + footnote "Generated using your case data"
  - `fallback` → deterministic text + muted "AI unavailable — showing deterministic advice"
  - `aria-live="polite"` so SR users hear the result land

## Service contract

### Input bag (added to `src/types/case.ts`)

```ts
export interface EvidenceAdviceInputs {
  caseRef: string;
  actionId: string;
  actionLabel: string;
  scope: 'action' | 'case-wide';
  policies: { id: string; title: string }[];
  evidence: {
    requirement: string;
    status: EvidenceStatus;
    elapsedDays: number | null;
    thresholdDays: number | null;
    policyId: string;
  }[];
  counts: { received: number; outstanding: number; overdue: number };
}

export type EvidenceAdviceResult =
  | { status: 'pending' }
  | { status: 'llm'; text: string; inputs: EvidenceAdviceInputs }
  | { status: 'fallback'; text: string; inputs: EvidenceAdviceInputs; reason: FallbackReason };
```

`FallbackReason` is the existing union — reuse it.

### Validator

```ts
validateEvidenceResponse(text: string, inputs: EvidenceAdviceInputs): boolean
```

Returns `true` only if **all** hold:
1. `text.includes(inputs.caseRef)`
2. `text.includes(inputs.actionLabel)`
3. If `inputs.evidence.some(e => e.status !== 'received')`, `text` includes the `requirement` of at least one non-received item — guards against the LLM citing a fictional gap.

### Deterministic fallback

`composeEvidenceFallback(inputs)` always succeeds. Three branches:

- **All received:** `{caseRef} — all {n} evidence items received for {actionLabel}. You can proceed.`
- **Has gaps:** `{caseRef} — for {actionLabel}: {received}/{total} received, {outstanding} outstanding, {overdue} overdue. Chase {firstNonReceived.requirement} (cite {firstNonReceived.policyId}).`
- **Zero evidence:** `{caseRef} — no evidence recorded for {actionLabel}. Issue an evidence request citing {policies[0].id}.` (or generic if no policies)

## Edge cases

| Case | Behaviour |
|---|---|
| Unknown `caseId` | Existing "Case not found" page (unchanged) |
| `actionId` not in `enriched.nextActions` | Existing "Action not found" page (preserves the invariant: deep-links target currently-required actions only) |
| Action's policies match 0–1 evidence items | Widen scope to case-wide; header reflects this |
| Case has 0 evidence | Render "no evidence recorded" empty state |
| Action has empty `policy_refs` | Skip action-scope step; go straight to case-wide |
| `policy_ref` not in `policy-extracts.json` | Muted "not extracted in fixture" row in policy panel |
| LLM call: missing key / network / timeout / 4xx-5xx / malformed | Deterministic compose with appropriate `FallbackReason` |
| Validator rejects (LLM hallucinated a gap) | Same — fallback with reason `'malformed'` |
| Multiple actions on same case | Each action page renders independently; one LLM call per render; no cache |

## Determinism

- `REFERENCE_DATE` is frozen → `elapsedDays` / `thresholdDays` are stable
- `selectActionEvidence` sort is total → same "first non-received" cited every render
- `temperature: 0.2` is low; the validator + deterministic fallback gate any drift
- Page always renders a usable advice block (LLM or compose)

## Accessibility

- Tab order: header → action panel → policy accordion → evidence table → advice card
- `RiskBadge` HoverCard already keyboard-accessible
- AI advice card uses `aria-live="polite"`
- Focus rings: `focus:outline-none focus:ring-[3px] focus:ring-[#ffdd00]` (existing GDS convention)

## Testing

New file `src/test/action-page.test.ts`. Pattern matches `assistant.test.ts`: vitest, fixture-driven, `vi.stubGlobal` for fetch, no live OpenAI. Run via `bun run test` (not `bun test` — bun's native runner lacks `vi.unstubAllGlobals`).

| # | Subject | What it asserts |
|---|---|---|
| 1 | `selectActionEvidence` | Action-scope when ≥ 2 matches; case-wide widening when 0 or 1 match; case-wide when `policy_refs` empty; `[]` when case has no evidence |
| 2 | `composeEvidenceFallback` | All-received, has-gaps, and zero-evidence branches each cite the right deterministic facts |
| 3 | `validateEvidenceResponse` | Accepts valid response; rejects on missing caseRef, missing actionLabel, missing real requirement |
| 4 | `getEvidenceAdvice` happy path | Stubbed fetch returning a valid paraphrase → status `'llm'` |
| 5 | `getEvidenceAdvice` no-key | Missing env → status `'fallback'`, reason `'no-key'` |
| 6 | `getEvidenceAdvice` network error | Stubbed fetch throws → status `'fallback'`, reason `'network-error'` |
| 7 | `getEvidenceAdvice` malformed | Validator rejects → status `'fallback'`, reason `'malformed'` |

No component-render tests — existing tests test the data layer, which is where the determinism contract lives.

## Files affected

**New:**
- `src/lib/action.ts` — `selectActionEvidence`, `buildEvidenceAdviceInputs`, `composeEvidenceFallback`
- `src/components/action/ActionContextHeader.tsx`
- `src/components/action/PolicyExcerpts.tsx`
- `src/components/action/ActionEvidenceTable.tsx`
- `src/components/action/EvidenceAdvice.tsx`
- `src/test/action-page.test.ts`
- `supabase/functions/evidence-advice/index.ts`

**Modified:**
- `src/pages/ActionStub.tsx` → renamed to `ActionPage.tsx`; composes the four sections
- `src/App.tsx` → swap `ActionStub` import for `ActionPage`
- `src/types/case.ts` → add `EvidenceAdviceInputs`, `EvidenceAdviceResult`
- `src/services/ai.ts` → add `getEvidenceAdvice`, `validateEvidenceResponse`
- `CLAUDE.md` → add 003 to "Shipped features" list once landed

## Out of scope (deferred)

- Component-level render tests
- Persisting "completed" state for actions
- LLM sufficiency judgments
- Side-by-side comparison of the LLM and deterministic outputs (would be useful for tuning but not for the demo path)
- Caching the LLM result across navigations on the same case

## Next steps

1. (Optional) Generate spec-kit artefacts under `specs/003-case-action-pages/` to match how 001 and 002 are documented
2. Implement the four new components and one new pure-derivation module behind a worktree
3. Deploy the new edge function to Supabase
4. Land via existing PR flow
