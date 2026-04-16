# Implementation Plan: Test Coverage Expansion

**Branch**: `003-test-coverage` | **Date**: 2026-04-16
**Source**: Multi-agent debate verdict (debate-output.ts)

## Summary

Expand test coverage beyond the existing four derivation unit tests. The verdict from a two-agent debate recommends a hybrid strategy: scenario-based integration tests for the full pipeline-to-UI journeys (the highest-value gap), Zod contract validation for fixture drift, and targeted component unit tests only where non-trivial conditional logic exists outside the pipeline. The existing pure-function unit tests are kept as-is.

## Verdict Summary (from debate)

> Adopt a lightweight hybrid, sequenced as Approach A recommends. Start with 6–8 scenario-based integration tests covering the full pipeline-to-UI journeys for each triage tier, plus key edge cases (boundary scores, missing evidence). Add Zod contract validation for fixture shapes immediately — low-cost and addresses a genuine risk. Keep existing pure-function unit tests. Add targeted component unit tests only where a component has non-trivial conditional logic independent of the pipeline.

## What to Build

### Layer 1 — Scenario integration tests (highest priority)
6–8 RTL tests wired to real fixtures, testing observable UI output end-to-end:

| Scenario | What to assert |
|---|---|
| All evidence received, low score | Risk badge = "Low", no escalation action surfaced |
| One item overdue < 56 days | Badge = "Medium", overdue marker visible |
| One item overdue ≥ 56 days | Badge = "High", overdue item flagged |
| Score past escalation threshold | Badge = "Critical", escalation action in action list |
| All evidence outstanding | Evidence tracker shows all outstanding |
| Missing/unknown workflow state | Graceful fallback, no crash |
| Boundary score (tier edge) | Correct tier label rendered for boundary value |

Each test mounts `<CaseDetail>` (or the relevant page) with a controlled fixture and queries by accessible role/label — not by component structure or prop names.

### Layer 2 — Zod fixture contracts (immediate, low-cost)
Add a Zod schema that mirrors the `Case` / `EnrichedCase` type and validate every fixture at test time. Catches silent drift in `cases.json`, `policy-extracts.json`, and `workflow-states.json` before it corrupts derived outputs.

```
src/test/contracts/
  case.schema.ts       ← Zod schema for Case / EnrichedCase
  fixtures.test.ts     ← import all JSON fixtures, parse against schema
```

### Layer 3 — Targeted component unit tests (selective)
Only where a component owns logic outside the pipeline. Candidates identified in the codebase evaluation:

| Component | Why it qualifies |
|---|---|
| `RiskBadge` | Conditional colour + label logic; resolve duplicate (pick one of the two existing files) |
| Evidence status cell | Overdue/received/outstanding rendering branches |

Do **not** add unit tests to pure display components (e.g. layout wrappers, card shells).

## Technical Approach

- **Framework**: Vitest 3.2 + React Testing Library (already installed)
- **No new dependencies** for Layers 1–2. Layer 3 may need `@testing-library/user-event` if interaction testing is needed.
- **Fixture strategy**: use the existing `src/challenge-3/cases.json` data directly — no synthetic fixtures. Control which case is rendered by passing `caseId` via router context.
- **Query strategy**: `getByRole`, `getByLabelText`, `getByText` — never `getByTestId` unless no semantic alternative exists.
- **No snapshots.**

## File Layout

```
src/test/
  scenarios/
    caseDetail.integration.test.tsx   ← Layer 1 (6–8 tests)
  contracts/
    case.schema.ts
    fixtures.test.ts                  ← Layer 2
  components/
    RiskBadge.test.tsx                ← Layer 3 (if proceeding)
    EvidenceCell.test.tsx             ← Layer 3 (if proceeding)
```

## Pre-work

- [ ] Resolve duplicate `RiskBadge` — `components/RiskBadge.tsx` vs `components/shared/RiskBadge.tsx`. Pick one, delete the other, fix imports.
- [ ] Confirm vitest config has `jsdom` environment set (currently unclear — check `vitest.config.ts`).
- [ ] Confirm RTL is installed (`@testing-library/react`, `@testing-library/jest-dom`).

## Out of Scope

- Playwright / E2E browser tests
- Snapshot tests
- Tests for the AI Strategy Assistant (002) — separate feature
- Component tests for pure display / layout components
- Any test that requires network calls or a real backend

## Success Criteria

- `npm test` passes with ≥ 10 total tests (up from 4)
- Every triage tier has at least one scenario test covering the full pipeline-to-UI path
- Fixture schema validation runs on every `npm test` invocation
- No existing tests broken
