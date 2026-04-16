# Data Model: AI Strategy Assistant

**Feature**: 002-ai-strategy-assistant · **Phase**: 1 · **Date**: 2026-04-16

This feature introduces **no new persisted data**. It introduces a small set of derived in-memory types that live next to `EnrichedCase` in `src/types/case.ts` and a UI-state type local to the assistant component. Everything here is a pure function of Stream A's existing outputs.

---

## Inputs (unchanged, from 001)

| Type | Source | Provenance |
|------|--------|------------|
| `EnrichedCase[]` | `services/cases.ts :: getAllEnrichedCases()` | Already includes `riskScore`, `evidenceItems`, `nextActions`, `workflowState`, `ageInDays`. |
| `PolicyExtract[]` | `services/cases.ts :: policies` | For policy titles looked up by `policy_id`. |
| Filter state | `CaseloadOverview.tsx` local state | Not shaped by this feature — consumed as `EnrichedCase[]` already-filtered. |

---

## Derived types (new, in `src/types/case.ts`)

### `TriageCounts`

```ts
export interface TriageCounts {
  critical: number;   // count of cases with riskScore.level === 'critical'
  warning: number;    // count of cases with riskScore.level === 'warning'
  normal: number;     // count of cases with riskScore.level === 'normal'
}
```

**Validation rules:**
- Each field ≥ 0.
- `critical + warning + normal === filteredCases.length`.
- Computed by a pure function `computeTriageCounts(filteredCases: EnrichedCase[]): TriageCounts`. Same input always yields same output (FR-102, FR-104).

---

### `PriorityInsightInputs`

The deterministic selection payload — chosen by `selectPriorityCase`, then passed to both the LLM prompt composer and the fallback composer. Names every artefact SC-103 requires the output to reproduce.

```ts
export interface PriorityInsightInputs {
  caseRef: string;              // e.g., "CASE-2026-00042"
  applicantName: string;
  riskLevel: 'critical' | 'warning' | 'normal';
  topFactors: string[];         // from riskScore.factors, top 3
  policyId: string | null;      // e.g., "POL-BR-003" — null when no policy-driven factor
  policyTitle: string | null;   // hydrated from PolicyExtract; null when policyId is null
  thresholdPhrase: string | null; // e.g., "56-day escalation threshold" — null when no threshold factor
  actionId: string | null;      // e.g., "issue-escalation-notice" — null when no page-index entry (FR-107a)
  actionLabel: string;          // always present — fallback can always name an action
  actionHref: string | null;    // /case/:caseId/action/:actionId — null when actionId is null
}
```

**Selection rule (FR-104):**
```text
1. Filter to critical; if non-empty, take highest riskScore.score, ties broken by caseRef ascending.
2. Else filter to warning; same tiebreak.
3. Else filter to normal; same tiebreak.
4. Else (empty filteredCases): return null — panel renders empty state.
```

**Validation rules:**
- `caseRef`, `applicantName`, `actionLabel` MUST be non-empty.
- `policyId` and `policyTitle` MUST both be null or both be non-null.
- `actionId`, `actionHref` MUST both be null or both be non-null.
- `thresholdPhrase` is null when the selection driver was not a policy-threshold breach (e.g., "recency since update > N days").

---

### `PriorityInsightResult`

The final payload rendered in the insight bubble — either the LLM-generated sentence or the fallback.

```ts
export type PriorityInsightResult =
  | { status: 'pending' }
  | { status: 'llm';      text: string; inputs: PriorityInsightInputs }
  | { status: 'fallback'; text: string; inputs: PriorityInsightInputs; reason: FallbackReason };

export type FallbackReason =
  | 'no-key'           // VITE_OPENAI_API_KEY missing (FR-119b)
  | 'network-error'    // fetch threw
  | 'timeout'          // 5s AbortController fired
  | 'non-2xx'          // OpenAI returned 4xx/5xx
  | 'malformed';       // 2xx but body omitted case_ref / policy_id / action_label (FR-119c)
```

**State transitions (per selected case):**
```text
     ┌──────────┐   fetch resolves OK
     │  pending ├──────────────────────► llm
     └────┬─────┘
          │ any failure (abort / network / non-2xx / malformed)
          ▼
      fallback
```
- `inputs` is present on both `llm` and `fallback` so the CTA can always render (FR-107, FR-107a).

---

### `HeatmapTile` (stretch)

```ts
export interface HeatmapTile {
  caseRef: string;
  applicantName: string;
  riskLevel: 'critical' | 'warning' | 'normal';
  href: string;            // /case/:caseId — same target as FR-007
}
```

**Ordering rule (FR-114):** sort by `riskLevel` priority (critical > warning > normal), then by `riskScore.score` descending within each bucket. The sorted array is rendered in reading order by the CSS grid.

---

### `AssistantViewState` (local UI state, not persisted)

```ts
type AssistantViewState = { collapsed: boolean };
```

Default `{ collapsed: false }`. Reset on reload per FR-110 (MVP scope — no localStorage).

---

## Relationships

```text
filteredCases: EnrichedCase[]
    │
    ├──► computeTriageCounts()   ──► TriageCounts          (TriageSummary.tsx)
    │
    └──► selectPriorityCase()    ──► PriorityInsightInputs ──► getPriorityInsight()  ──► PriorityInsightResult  (PriorityInsight.tsx)
                                          │
                                          └──► CTA (FR-106, FR-107, FR-107a)

filteredCases: EnrichedCase[]    ──► buildHeatmapTiles()    ──► HeatmapTile[]        (WorkloadHeatmap.tsx, stretch)
```

All four computations (`computeTriageCounts`, `selectPriorityCase`, `composeFallback`, `buildHeatmapTiles`) are pure. The only impure step is the `fetch` call inside `getPriorityInsight`, and its impurity is fully enclosed by the `PriorityInsightResult` state machine above.

---

## Persistence

None. Every field in every type in this document is recomputed from `EnrichedCase[]` on every render. No localStorage, no IndexedDB, no service worker cache. Consistent with Constitution §II (Derive, Don't Store) and §IV (YAGNI).
