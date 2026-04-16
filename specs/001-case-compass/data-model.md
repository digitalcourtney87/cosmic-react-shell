# Phase 1: Data Model

**Feature**: Case Compass | **Date**: 2026-04-16

All types live in `src/types/case.ts` and are FROZEN per constitution §Development Workflow. Changes require all four stream owners' agreement.

---

## Source Entities (read from JSON fixtures)

### Case

The unit of casework. One row per case in `cases.json`.

| Field | Type | Notes |
|-------|------|-------|
| `case_id` | `string` | Stable identifier (e.g., `CASE-2026-00042`). Used in URLs. |
| `case_reference` | `string` | Human-readable display reference. May equal `case_id` or be separate. |
| `case_type` | `'benefit_review' \| 'licence_application' \| 'compliance_check'` | Three values — confirm with fixture once delivered. |
| `status` | `string` | Free-form; scoped by case type. Mapped to a segment via `src/lib/segments.ts`. |
| `applicant_name` | `string` | Display name. |
| `assigned_to` | `string` | Caseworker individual name (per FR-005 clarification). Used for the "Assigned to" filter. |
| `created_date` | `string` (ISO date) | Used for `age in days` column and risk-score case-age contribution. |
| `last_updated` | `string` (ISO date) | Used for risk-score recency contribution. |
| `timeline` | `TimelineEvent[]` | Append-only event log. |
| `case_notes` | `string` | Free-text prose; rendered with `white-space: pre-wrap`. |

**Validation**: every field present on every fixture record. Missing `timeline` renders as empty-state per spec edge case. Missing `case_notes` renders as the empty string.

**State transitions**: `status` transitions belong to the workflow state machine (see `WorkflowState`); the MVP performs no transitions because there are no write operations.

---

### TimelineEvent

A single dated event on a case.

| Field | Type | Notes |
|-------|------|-------|
| `date` | `string` (ISO date) | Used by `deriveEvidenceStatus` to compute elapsed days. |
| `event` | `string` | One of `'created'`, `'evidence_requested'`, `'evidence_received'`, `'decision'`, plus per-fixture extensions. Unknown event types render with a fallback icon (FR per design doc B2). |
| `note` | `string` | Free text. Used by `deriveEvidenceStatus` for matching requirement names against received-event notes. |

**Ordering**: events are rendered in chronological order (FR-009). Source order in fixture is assumed chronological; if not, sort by `date` ascending.

---

### PolicyExtract

A policy document. One per record in `policy-extracts.json`.

| Field | Type | Notes |
|-------|------|-------|
| `policy_id` | `string` | Stable identifier (e.g., `POL-BR-003`). Surfaced on each `EvidenceItem`. |
| `title` | `string` | Display title for the accordion header. |
| `applicable_case_types` | `string[]` | Used by `getApplicablePolicies` to match against `Case.case_type`. |
| `body` | `string` | Free-text policy prose. Contains evidentiary requirements and escalation thresholds parsed by `deriveEvidenceStatus`. |

**Validation**: `applicable_case_types` may be empty (the policy applies to nothing); such policies never surface for any case.

---

### WorkflowState

A node in the per-case-type state machine. One per record in `workflow-states.json`.

| Field | Type | Notes |
|-------|------|-------|
| `state_name` | `string` | Matches `Case.status` for lookup by `getWorkflowState`. |
| `case_type` | `string` | Disambiguates when the same `state_name` appears for multiple case types. |
| `allowed_transitions` | `string[]` | Read-only display in MVP; no write operations consume this. |
| `required_actions` | `Action[]` | Returned by `getRequiredNextActions` and merged with overdue-evidence escalations. |
| `escalation_threshold?` | `{ days: number; action: string }` | Optional. Absent on terminal states (e.g., `decided`, `approved`). When absent, `calculateRiskScore` omits the case-age contribution per FR-018a. |

**Validation**: a `Case.status` not present in the fixture renders the raw status with an "unknown workflow state" message per FR-023; the page does not crash.

---

## Derived Entities (computed at read time, never persisted)

Per constitution principle II (NON-NEGOTIABLE), nothing in this section is written back to fixtures or cached across page loads.

### EvidenceItem

One per requirement parsed from the applicable policies for a case. Returned by `deriveEvidenceStatus`.

| Field | Type | Notes |
|-------|------|-------|
| `requirement` | `string` | Requirement label (e.g., "proof of address"). Sourced from policy body or pragmatic-fallback whole-event matching. |
| `policy_id` | `string` | Source policy identifier (FR-014). |
| `status` | `'received' \| 'outstanding' \| 'overdue'` | Derived per FR-013 / FR-014 / FR-024. |
| `days_elapsed` | `number` | Days between earliest matching `evidence_requested` event and `REFERENCE_DATE`. `0` if not yet requested. |
| `threshold_days` | `number` | Escalation threshold from policy body; pragmatic fallback `56`. |
| `requested_date?` | `string` (ISO date) | Source date used for `days_elapsed`. Omitted if no matching request event found. |
| `received_date?` | `string` (ISO date) | Source date for `'received'` status. |

**Ordering**: `overdue` → `outstanding` → `received` per FR-015.

**Derivation rules** (summary; see `contracts/services-api.md` for the function contract):

- `requested_date` ← earliest `evidence_requested` event whose `note` mentions `requirement` (or any `evidence_requested` event under the pragmatic fallback per FR-025).
- `received_date` ← earliest `evidence_received` event whose `note` mentions `requirement`.
- `status` ← `received_date ? 'received' : days_elapsed > threshold_days ? 'overdue' : 'outstanding'`.

---

### RiskScore

One per case. Returned by `calculateRiskScore`.

| Field | Type | Notes |
|-------|------|-------|
| `score` | `number` (0–10) | Capped at 10. |
| `level` | `'normal' \| 'warning' \| 'critical'` | `score >= 7 → 'critical'`; `score >= 4 → 'warning'`; else `'normal'`. |
| `factors` | `string[]` | Human-readable reasons each rule fired. Surfaced in the header tooltip per FR-018. |

**Derivation rules** (per design doc §Risk Score Formula, with FR-018a applied):

- If `workflow.escalation_threshold` is defined, contribute case-age points: `+4` past threshold, `+2` past 75% of threshold. Otherwise omit case-age contribution entirely (FR-018a) — do not add a "past escalation threshold" factor in this case.
- `+2` per overdue evidence item.
- `+2` if `last_updated` was > 14 days ago; another `+2` if > 28 days ago.
- Treat any `last_updated` after `REFERENCE_DATE` as 0 days ago (recency factor contributes 0; do not produce a negative value) per spec edge case.
- Final `score` clamped to `[0, 10]`.

---

### Action

One per required next action surfaced on the case detail. Returned by `getRequiredNextActions`. Also referenced by `WorkflowState.required_actions`.

| Field | Type | Notes |
|-------|------|-------|
| `action_id` | `string` | Stable per-case identifier (e.g., `act-issue-reminder` or workflow-defined). Used in the action stub URL. |
| `label` | `string` | Display text (e.g., "Issue 28-day reminder"). |
| `severity` | `'info' \| 'warning' \| 'critical'` | Sort key per FR-017 (critical first). |
| `due_in_days?` | `number` | Negative if overdue; absent for actions without a due date. |

**Derivation rules**:

- Start from `workflow.required_actions` for the case's current state.
- Merge in synthesised actions for each `EvidenceItem` whose `status === 'overdue'` (e.g., "Issue reminder for {requirement}", `severity: 'critical'`).
- Sort by severity (critical → warning → info), then by `due_in_days` ascending.

---

## Mapping helpers (Stream A surface)

### Segment

Pure mapping in `src/lib/segments.ts`. Not a persisted field; not on `Case`.

```typescript
type Segment = 'Escalated' | 'Pending Decision' | 'Under Review' | 'Awaiting Evidence' | 'Case Created' | 'Other';

function getSegment(c: Case): Segment;
```

The `'Other'` segment exists per the FR-005a edge case for statuses not covered by the five fixed segments.

---

## Relationships

```
Case 1 ── n  TimelineEvent      (embedded array)
Case n ── n  PolicyExtract      (via Case.case_type ∈ PolicyExtract.applicable_case_types)
Case 1 ── 1  WorkflowState      (via Case.status + Case.case_type → WorkflowState.state_name + .case_type)

Case + PolicyExtract[]                  → EvidenceItem[]   (deriveEvidenceStatus)
Case + WorkflowState + EvidenceItem[]   → RiskScore        (calculateRiskScore)
Case + WorkflowState + EvidenceItem[]   → Action[]         (getRequiredNextActions)
Case                                    → Segment          (getSegment, for caseload grouping)
```

No persisted relationships beyond what the fixtures already encode. No foreign-key constraints because there is no database.
