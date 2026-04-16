# Implementation Plan: Case Compass

**Branch**: `001-case-compass` | **Date**: 2026-04-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-case-compass/spec.md`

## Summary

Case Compass is a hackathon decision-support tool for government caseworkers. It synthesises a case's timeline, applicable policy, workflow state, and derived evidence/risk signals into a single actionable view, replacing multi-tab reconstruction work.

The build is split into four parallel streams (A: Data & Services, B: Case Detail, C: Caseload Overview, D: Shell & Routing) plus Stream E (README + integration QA). Streams unblock from a `src/services/mock.ts` shim that mirrors Stream A's signatures, so B/C/D start immediately and swap to the real implementation with a one-line import change. Three routes (`/`, `/case/:caseId`, `/case/:caseId/action/:actionId`) are read-only over static JSON fixtures; all derivations recompute on every page load against a frozen reference date.

## Technical Context

**Language/Version**: TypeScript 5.8 (strict), Node ≥ 18 for tooling
**Primary Dependencies**: React 18.3, React Router DOM 6.30, Vite 5.4, Tailwind 3.4, shadcn-ui (Radix primitives), `lucide-react` icons
**Storage**: Static JSON fixtures imported synchronously at build time (`src/challenge-3/cases.json`, `policy-extracts.json`, `workflow-states.json`). No database, no localStorage, no IndexedDB.
**Testing**: Vitest 3.2 — exactly four fixture-driven unit tests on Stream A's derivation logic per Constitution principle VI. No component tests, no Playwright, no snapshots.
**Target Platform**: Modern desktop browsers (Chrome/Edge/Firefox latest). Single-screen demo on judges' laptops; no mobile breakpoint required.
**Project Type**: Single-project SPA (Vite + React). No backend, no API, no LLM.
**Performance Goals**: Caseload renders ≤ 50 rows synchronously; case detail renders all derivations on mount with no perceptible delay (< 100 ms on the demo laptop). No virtualisation.
**Constraints**: No write operations on any of the three routes. No global state library (no Redux, Zustand, React Query). Frozen reference date used wherever derivations need a "now"; identical between 14:45 rehearsal and 15:30 judging window. README committed by 10:00 BST.
**Scale/Scope**: 10 hand-authored cases (stretch: ~30 synthetic if A8 invoked); 50-row soft cap. Two routes plus one stub route. Six derivations on the Stream A surface.

## Constitution Check

*Gate against `.specify/memory/constitution.md` v1.1.0. Re-evaluated post-Phase-1; result unchanged.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Hybrid-Spec Discipline | PASS | Plan augments — does not supersede — `docs/plans/2026-04-16-case-compass-design.md`. Where they overlap, design doc wins until amended. |
| II. Derive, Don't Store | PASS | All derivations (`EvidenceItem`, `RiskScore`, `Action`) recomputed at read time per FR-020. No persisted derived fields anywhere in `data-model.md`. |
| III. GDS-Flavoured, Not GDS-Compliant | PASS | Tailwind `gds.*` token overrides only; `govuk-frontend` package and GDS Transport font explicitly excluded from Primary Dependencies. |
| IV. YAGNI Over Architecture | PASS | No global state library listed. Fixtures load synchronously at import. No service-layer abstractions beyond what each layer's acceptance criteria require. |
| V. Parallel-Stream Unblocking | PASS | `src/services/mock.ts` is a Stream-A pre-task; B/C/D start against it. The swap is a one-line import change. Documented in `quickstart.md`. |
| VI. Tests Where They Earn Their Keep | PASS | Exactly four vitest tests on Stream A derivations. UI streams: visual inspection + 14:45 rehearsal. Synthetic test fixtures forbidden. |
| VII. Stretch Behind a Fence | PASS | Stretch annex (mocked AI summary, synthetic cases, bottleneck summary, case switcher) is not on the critical path; gated by 14:30 checkpoint. |

**Hackathon Constraints (constitution §Hackathon Constraints):**

- No auth, no real backend, no LLM call: PASS — static fixtures only.
- No write operations: PASS — explicit on FR-026 (action stub renders a placeholder, mutates nothing).
- Three routes (constitution v1.1.0): PASS — `/`, `/case/:caseId`, `/case/:caseId/action/:actionId`. No fourth route added.
- Applicant-facing view: out of scope per constitution; not in this plan.
- Case fixtures: 10 hand-written. Synthetic generation (A8) lives in stretch annex.
- README by 10:00 BST: tracked under Stream E in `quickstart.md`.

**Verdict:** No violations. Complexity Tracking section below intentionally empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-case-compass/
├── plan.md              # This file (/speckit-plan output)
├── spec.md              # Feature spec (/speckit-specify, /speckit-clarify outputs)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── services-api.md  # Phase 1 output — frozen Stream A surface
└── checklists/
    └── requirements.md  # /speckit-checklist output
```

### Source Code (repository root)

```text
src/
├── App.tsx                      # Stream D — Router root
├── main.tsx                     # Stream D — Vite entry
├── index.css                    # Stream D — global focus-ring rule, Tailwind layers
├── challenge-3/                 # Fixtures (already in repo)
│   ├── cases.json
│   ├── policy-extracts.json
│   └── workflow-states.json
├── types/
│   └── case.ts                  # Stream A — FROZEN type contracts
├── services/
│   ├── cases.ts                 # Stream A — real implementation
│   └── mock.ts                  # Stream A pre-task — mirrors cases.ts signatures
├── lib/
│   ├── date.ts                  # Stream A — frozen reference date constant
│   └── segments.ts              # Stream A — status → segment mapping (FR-005a)
├── pages/
│   ├── CaseloadOverview.tsx     # Stream C — route /
│   ├── CaseDetail.tsx           # Stream B — route /case/:caseId
│   └── ActionStub.tsx           # Stream B — route /case/:caseId/action/:actionId (FR-026)
├── components/
│   ├── AppShell.tsx             # Stream D
│   ├── case-detail/             # Stream B — CaseHeader, Timeline, EvidenceTracker, etc.
│   ├── caseload/                # Stream C — SummaryStats, CaseloadTable, Filters, OverdueBanner
│   └── shared/
│       └── RiskBadge.tsx        # Stream A surface, used by B7 and C3
└── test/
    └── services.test.ts         # Stream A — exactly 4 vitest tests
```

**Structure Decision:** Single-project SPA. The four streams own disjoint directories under `src/` (Stream A: `types/`, `services/`, `lib/`, `test/`, plus `components/shared/RiskBadge.tsx`; Stream B: `pages/CaseDetail.tsx`, `pages/ActionStub.tsx`, `components/case-detail/`; Stream C: `pages/CaseloadOverview.tsx`, `components/caseload/`; Stream D: `App.tsx`, `main.tsx`, `index.css`, `components/AppShell.tsx`). The only files multiple streams touch are `App.tsx` (D adds route entries B and C own the components for) and `tailwind.config.ts` (D establishes the `gds.*` tokens; everyone consumes them). Both files are merge-conflict-prone and are owned by Stream D — B/C send PRs/diffs against them, D applies.

## Complexity Tracking

> No constitution violations to justify. Section intentionally empty.
