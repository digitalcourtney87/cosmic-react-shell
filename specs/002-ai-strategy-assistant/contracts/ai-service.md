# Contract: AI Service Surface (`src/services/ai.ts`)

**Feature**: 002-ai-strategy-assistant · **Phase**: 1 · **Date**: 2026-04-16

The public surface exposed by Stream F to Stream C (the caseload overview) and to tests. This file is FROZEN at the signatures below; changes require the Stream F owner's agreement. Import paths and argument types are stable.

---

## Exports

```ts
// src/services/ai.ts
import type { EnrichedCase, PriorityInsightInputs, PriorityInsightResult, FallbackReason, TriageCounts, HeatmapTile } from '../types/case';
import type { PolicyExtract } from '../types/case';

export function computeTriageCounts(filtered: EnrichedCase[]): TriageCounts;

export function selectPriorityCase(
  filtered: EnrichedCase[],
  policies: PolicyExtract[],
  pageIndex: PageIndexEntry[],
): PriorityInsightInputs | null;

export function composeFallback(inputs: PriorityInsightInputs): string;

export function buildHeatmapTiles(filtered: EnrichedCase[]): HeatmapTile[];

export async function getPriorityInsight(
  inputs: PriorityInsightInputs,
  signal?: AbortSignal,
): Promise<PriorityInsightResult>;
```

---

## Behaviour contracts

### `computeTriageCounts(filtered)`
- **Input:** an already-filtered `EnrichedCase[]` (zero-length allowed).
- **Output:** `TriageCounts` where every field ≥ 0 and `critical + warning + normal === filtered.length`.
- **Purity:** total and pure.
- **Covered by:** FR-102.

### `selectPriorityCase(filtered, policies, pageIndex)`
- **Input:** filtered enriched caseload + the policies and page-index from `services/cases.ts`.
- **Output:** the deterministic priority-case inputs, or `null` when `filtered.length === 0`.
- **Ordering:** critical → warning → normal; within each bucket, `riskScore.score` desc, then `caseRef` asc.
- **Policy hydration:** when the top risk factor is a policy-threshold breach, the matching `PolicyExtract` (by `applicable_case_types` and factor text) populates `policyId` and `policyTitle`. Otherwise both fields are null.
- **Action hydration:** `nextActions[0]` (the highest-severity action from Stream A) supplies `actionLabel`; `pageIndex` is looked up for `actionId`/`actionHref`. When no page-index entry exists, `actionId` and `actionHref` are null — the CTA renders disabled (FR-107a).
- **Purity:** total and pure.
- **Covered by:** FR-104, FR-105, FR-106, FR-107a, FR-108.

### `composeFallback(inputs)`
- **Input:** `PriorityInsightInputs` (never null — callers check).
- **Output:** a string naming the case reference, policy identifier (when non-null), threshold phrase (when non-null), and action label, shaped to the template in `research.md §5`.
- **Purity:** total and pure. Same input → byte-identical output.
- **Covered by:** FR-119c.

### `buildHeatmapTiles(filtered)`
- **Input:** same filtered caseload.
- **Output:** `HeatmapTile[]`, one per case, ordered critical → warning → normal (and by risk score desc within each bucket).
- **Purity:** total and pure.
- **Covered by:** FR-113–FR-118.

### `getPriorityInsight(inputs, signal?)`
- **Input:** the deterministic `PriorityInsightInputs` (never null — callers check). Optional `AbortSignal` so React can cancel in-flight calls on unmount / selected-case change.
- **Output (promise):** always resolves, never rejects. Resolves to one of:
  - `{ status: 'llm', text, inputs }` — on 2xx response whose body contains `inputs.caseRef` and `inputs.actionLabel` and (when `inputs.policyId` is non-null) `inputs.policyId`.
  - `{ status: 'fallback', text, inputs, reason }` — on any of the five `FallbackReason` values. `text` is `composeFallback(inputs)`.
- **Side effects:** exactly one outbound `fetch` to `https://api.openai.com/v1/chat/completions` (unless `reason === 'no-key'`, in which case zero network calls).
- **Timeout:** 5000 ms via `AbortController` (composed with any caller-supplied `signal`). Exceeding the timeout resolves to `{ status: 'fallback', reason: 'timeout', ... }`.
- **Auth:** reads `import.meta.env.VITE_OPENAI_API_KEY` at call time. Missing key → `{ status: 'fallback', reason: 'no-key', ... }`.
- **Model:** `gpt-4o-mini`, `temperature: 0.2`, `max_tokens: 180`. See `research.md §2`.
- **Prompt:** per `research.md §3`.
- **Purity:** impure (network). All impurity enclosed by the result discriminated union; no thrown exceptions reach the caller.
- **Covered by:** FR-119, FR-119a, FR-119b, FR-119c.

---

## Consumers

| Consumer file | Functions used | How |
|--------------|----------------|-----|
| `components/ai/TriageSummary.tsx` | `computeTriageCounts` | Called once per render with the filtered caseload; output drives three coloured counts. |
| `components/ai/PriorityInsight.tsx` | `selectPriorityCase`, `getPriorityInsight`, `composeFallback` (indirectly via `getPriorityInsight`) | Memoises the selection, fires `getPriorityInsight` in a `useEffect` keyed on `caseRef`, renders skeleton / llm / fallback per `PriorityInsightResult.status`. |
| `components/ai/WorkloadHeatmap.tsx` (stretch) | `buildHeatmapTiles` | Renders one tile per entry. |
| `test/assistant.test.ts` | All five | See `research.md §8` for the three tests. |

---

## Non-contracts (explicitly out of scope)

- **No streaming interface** (`getPriorityInsight` returns a single promise, not an async iterator). SSE/streaming was rejected in `research.md §2`.
- **No retry logic.** One call, one result; caller does not retry. Rejected in `research.md §5`.
- **No prompt caching, no per-session memory.** `getPriorityInsight` has no memoisation layer; identical selection across renders will call the API once per `useEffect` firing. React memoisation (one level up) controls call frequency.
- **No provider abstraction.** The function name is `getPriorityInsight`, not `getCompletion` — it is not a generic LLM facade. Swapping providers is a full rewrite of this file's body, and that's the right trade-off at hackathon scale (`research.md §1`).
