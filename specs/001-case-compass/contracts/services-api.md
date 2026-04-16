# Contract: Services API

**Feature**: Case Compass | **Date**: 2026-04-16

Defines the surface Stream A exposes to Streams B, C, and D. This contract is FROZEN per constitution §Development Workflow — changes require all four stream owners' agreement.

The same signatures are satisfied by both `src/services/cases.ts` (real) and `src/services/mock.ts` (stream-unblocking stub). The swap is a one-line import change in each consumer.

---

## Module layout

```text
src/
├── types/case.ts            # types only, no runtime
├── services/
│   ├── cases.ts             # real implementation (Stream A)
│   └── mock.ts              # stub (Stream A pre-task, shipped BEFORE cases.ts)
├── lib/
│   ├── date.ts              # export const REFERENCE_DATE: Date
│   └── segments.ts          # getSegment(c: Case): Segment
```

---

## Function signatures (frozen)

```typescript
// src/services/cases.ts (and src/services/mock.ts)

export function getAllCases(): Case[];
export function getCaseById(caseId: string): Case | undefined;

export function getApplicablePolicies(c: Case): PolicyExtract[];
export function getWorkflowState(c: Case): WorkflowState | undefined;

export function deriveEvidenceStatus(c: Case, policies: PolicyExtract[]): EvidenceItem[];
export function calculateRiskScore(c: Case, evidence: EvidenceItem[], workflow: WorkflowState | undefined): RiskScore;
export function getRequiredNextActions(c: Case, workflow: WorkflowState | undefined, evidence: EvidenceItem[]): Action[];
```

---

## Behavioural contract (per function)

### `getAllCases(): Case[]`

- Returns every case from `cases.json` in source order.
- Synchronous. Pure. No filtering, no sorting.
- Empty array is a valid return value (do not throw).

### `getCaseById(caseId: string): Case | undefined`

- Linear scan over `getAllCases()` matching `case_id === caseId`.
- Returns `undefined` for unknown IDs (consumer renders FR-019 "Case not found").

### `getApplicablePolicies(c: Case): PolicyExtract[]`

- Filters `policy-extracts.json` where `applicable_case_types.includes(c.case_type)`.
- Empty array is the expected return for a case whose type matches no policy; consumer renders FR-012 "No policy matched".

### `getWorkflowState(c: Case): WorkflowState | undefined`

- Looks up `workflow-states.json` by `state_name === c.status && case_type === c.case_type`.
- Returns `undefined` when the status is absent from the fixture; consumer renders FR-023 raw-status fallback.
- Does NOT throw; missing state is a valid condition.

### `deriveEvidenceStatus(c: Case, policies: PolicyExtract[]): EvidenceItem[]`

- Returns one `EvidenceItem` per requirement parsed from `policies[*].body`.
- Uses the pragmatic-fallback heuristic per FR-025 as the shipped default (whole-event matching). Per-requirement text matching is a refinement only if L1 is green.
- Elapsed days computed as `daysBetween(requested_date, REFERENCE_DATE)` — never against `new Date()`.
- Ordering: `overdue` → `outstanding` → `received` (FR-015).
- Pure function of `(c, policies, REFERENCE_DATE)`. Identical return value on repeat calls.

### `calculateRiskScore(c, evidence, workflow): RiskScore`

- Factor contributions per `data-model.md §RiskScore derivation rules`.
- **FR-018a**: when `workflow?.escalation_threshold` is undefined, OMIT case-age contribution entirely. The `factors[]` array MUST NOT include a "past escalation threshold" entry in this case.
- `factors[]` is populated with human-readable reasons each rule fires (for FR-018 tooltip).
- `score` clamped to `[0, 10]`.
- `level` thresholds: `>= 7 → 'critical'`, `>= 4 → 'warning'`, else `'normal'`.
- Pure function of `(c, evidence, workflow, REFERENCE_DATE)`.

### `getRequiredNextActions(c, workflow, evidence): Action[]`

- Starts from `workflow?.required_actions ?? []`.
- For each `evidence` item with `status === 'overdue'`, synthesise an `Action` (e.g., `{label: "Issue reminder for <requirement>", severity: 'critical'}`).
- Sorts by severity (critical → warning → info), then by `due_in_days` ascending.
- Pure function of `(c, workflow, evidence, REFERENCE_DATE)`.

---

## Purity contract

Every function in this module MUST be:

1. **Deterministic** — same inputs produce same outputs. Do not read `Date.now()`, `performance.now()`, `Math.random()`, `process.env`, or any browser API.
2. **Read-only** — no mutation of arguments, no mutation of imported fixtures.
3. **Synchronous** — no `Promise`, no `async`. Fixtures are already in memory at module load.
4. **Free of side effects** — no `console.log`, no network calls (there's no network), no DOM access.

Violation of any of these is a bug regardless of whether a test catches it.

---

## `mock.ts` contract

`src/services/mock.ts` MUST:

- Export every signature listed above with identical types.
- Return hardcoded data for exactly one case (whichever case Stream A picks first from the fixture).
- Satisfy every signature well enough that Streams B/C/D can render a page. Unused fields may be empty arrays/strings but MUST NOT be `undefined` where the type says a string/array.
- Be deleted — not kept as a fallback — once `cases.ts` ships. Each consumer's import changes from `from '@/services/mock'` to `from '@/services/cases'` and `mock.ts` leaves the tree.

---

## Supporting exports

### `src/lib/date.ts`

```typescript
export const REFERENCE_DATE: Date;
export function daysBetween(earlier: Date | string, later: Date | string): number;
```

- `REFERENCE_DATE` is a single `Date` literal, picked after the fixture is delivered so that seeded cases surface a representative mix of evidence statuses (per research.md §1).
- `daysBetween` treats a future `earlier` (i.e., `last_updated > REFERENCE_DATE`) as 0 days per spec edge case; does not produce negative values.

### `src/lib/segments.ts`

```typescript
export type Segment = 'Escalated' | 'Pending Decision' | 'Under Review' | 'Awaiting Evidence' | 'Case Created' | 'Other';
export function getSegment(c: Case): Segment;
```

- Pure mapping of `(c.status, c.case_type)` to one of six segments.
- `'Other'` is the explicit bucket for statuses not covered by the five fixed segments (per FR-005a edge case).

---

## Tests bound to this contract

Exactly four (constitution principle VI); all in `src/test/services.test.ts`; all reading real records from `src/challenge-3/cases.json`:

1. `deriveEvidenceStatus` — all received → `every(e => e.status === 'received')`.
2. `deriveEvidenceStatus` — requested 60 days ago, 56-day threshold → at least one item with `status === 'overdue'`.
3. `calculateRiskScore` — past escalation threshold + ≥ 1 overdue → `level === 'critical'`.
4. `getRequiredNextActions` — overdue evidence → contains an action whose `label` matches `/^Issue.*reminder/i` with `severity === 'critical'`.

These tests protect the pitch line *"the system cross-referenced timeline against policy requirements"*; adding a fifth test is a constitution amendment.
