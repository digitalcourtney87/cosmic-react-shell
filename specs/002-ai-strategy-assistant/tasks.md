---
description: "Task list for 002-ai-strategy-assistant — Stream F build (AI Strategy Assistant sidebar + stretch WorkloadHeatmap)"
---

# Tasks: AI Strategy Assistant

**Input**: Design documents from `/specs/002-ai-strategy-assistant/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ai-service.md ✓, quickstart.md ✓

**Tests**: Included — the feature spec explicitly requires them (Assumptions bullet "Tests cover … FR-104, FR-108, FR-109/FR-117, FR-119c") and `research.md §8` locks the count at exactly 3.

**Organization**: Grouped by user story per spec.md. US1 is the MVP demo path; US2 is stretch (gated by 14:30 checkpoint); US3 is trust/control polish.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unmet dependencies)
- **[Story]**: US1 / US2 / US3 — setup/foundational/polish have no story label
- Every task includes an exact file path

## Path Conventions

Single-project SPA (Vite + React). All paths are absolute within the repo. Stream F adds files under `src/components/ai/`, `src/services/ai.ts`, and `src/test/assistant.test.ts`; the only shared edit is `src/components/caseload/CaseloadOverview.tsx` (Stream C file).

---

## Phase 1: Setup (one-time per developer laptop)

**Purpose**: Local environment ready for a live OpenAI call. No code changes.

- [ ] T001 Create `.env.local` at repo root with `VITE_OPENAI_API_KEY=sk-proj-...`; confirm `.env.local` is already listed in `.gitignore` before saving (do NOT commit the file). Reference: `quickstart.md §One-time setup`.
- [ ] T002 Set a hard $5/month usage cap on the OpenAI account dashboard (non-negotiable per `research.md §4`). This is a web-console action, no file path.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Derived types + all five pure functions + their tests. Every user story consumes this surface.

**⚠️ CRITICAL**: No user story work can begin until Phase 2 completes.

- [ ] T003 Add `TriageCounts`, `PriorityInsightInputs`, `PriorityInsightResult`, `FallbackReason`, and `HeatmapTile` exports to `src/types/case.ts` per `data-model.md §Derived types`. Preserve all existing exports; do not rename or move `EnrichedCase` / `PolicyExtract`.
- [ ] T004 [P] Implement `computeTriageCounts(filtered: EnrichedCase[]): TriageCounts` in `src/services/ai.ts` per `contracts/ai-service.md §computeTriageCounts`. Total + pure; invariant `critical + warning + normal === filtered.length`.
- [ ] T005 [P] Implement `selectPriorityCase(filtered, policies, pageIndex): PriorityInsightInputs | null` in `src/services/ai.ts` per `contracts/ai-service.md §selectPriorityCase` and the selection rule in `data-model.md` (critical → warning → normal; riskScore.score desc; caseRef asc tiebreak). Null on empty input. Policy hydration: match `PolicyExtract` by `applicable_case_types` + factor text. Action hydration: `nextActions[0]` + page-index lookup; null `actionId`/`actionHref` when no page-index entry (FR-107a).
- [ ] T006 [P] Implement `composeFallback(inputs: PriorityInsightInputs): string` in `src/services/ai.ts` per `contracts/ai-service.md §composeFallback` using the template in `research.md §5`: `"{caseRef} has breached {policyId} ({thresholdPhrase}). Recommended action: {actionLabel}."` — drop the parenthetical when `policyId` is null; drop the threshold clause when `thresholdPhrase` is null. Total + pure.
- [ ] T007 Implement `getPriorityInsight(inputs, signal?): Promise<PriorityInsightResult>` in `src/services/ai.ts` per `contracts/ai-service.md §getPriorityInsight`. Read `import.meta.env.VITE_OPENAI_API_KEY` at call time; missing key → `{ status: 'fallback', reason: 'no-key', text: composeFallback(inputs), inputs }` with zero network calls. Otherwise `fetch` `https://api.openai.com/v1/chat/completions` with `gpt-4o-mini`, `temperature: 0.2`, `max_tokens: 180`, `response_format: { type: 'text' }`, and the system+user prompt from `research.md §3`. Use `AbortController` with a 5000 ms timeout composed with any caller-supplied `signal`. Always resolve, never reject. Substring-validate the response body against `inputs.caseRef`, `inputs.actionLabel`, and (when non-null) `inputs.policyId`; on miss → `reason: 'malformed'`. Other failure modes: `'network-error'`, `'timeout'`, `'non-2xx'`.
- [ ] T008 Write three vitest tests in `src/test/assistant.test.ts` per `research.md §8`: (1) `selectPriorityCase` picks critical over warning over normal and respects tiebreaks; (2) `composeFallback` names caseRef + policyId + thresholdPhrase + actionLabel when all present, and omits the parenthetical when policyId is null; (3) `getPriorityInsight` with `vi.stubGlobal('fetch', …)` rejecting falls back to `composeFallback`'s output, and with a 200 response whose body omits the expected caseRef also falls back. No live OpenAI calls. Run `npm test` — expect 4 (existing Stream A) + 3 (new) = 7 passing.

**Checkpoint**: Pure surface complete + unit-tested. User stories can now be built on top.

---

## Phase 3: User Story 1 — Morning briefing (Priority: P1) 🎯 MVP

**Goal**: Sam opens `/` and gets triage counts + a priority insight that names a real case, real policy, and real recommended action, with a one-click CTA to the action stub.

**Independent Test**: Load `/`. Sidebar shows Red/Amber/Green counts summing to the filtered-caseload total, an insight sentence referencing a real case reference + policy identifier, and a CTA whose label matches the recommended action. Clicking the CTA navigates to `/case/:caseId/action/:actionId`. With `VITE_OPENAI_API_KEY` deleted, the same panel still renders using the deterministic fallback sentence. A first-time user can answer "what should I do first this morning?" in under 30 seconds without touching the table.

### Implementation for User Story 1

- [ ] T009 [P] [US1] Create `src/components/ai/TriageSummary.tsx` — a pure presentational component taking `counts: TriageCounts`, rendering three coloured counts (critical=`gds.red`, warning=`gds.amber`, normal=`gds.green`) with accessible labels. No hooks, no effects.
- [ ] T010 [US1] Create `src/components/ai/PriorityInsight.tsx` — accepts `inputs: PriorityInsightInputs | null`. When `inputs === null`, render the empty-state message ("No cases match current filters") and no CTA (FR-108). Otherwise run a single `useEffect` keyed on `inputs.caseRef` that invokes `getPriorityInsight(inputs)` and tracks the result in local state (`'pending' | PriorityInsightResult`). While pending, render a skeleton bubble; on `llm` / `fallback`, render `result.text` inside an element with `role="status"` and `aria-live="polite"` per `research.md §9`. CTA renders from `inputs.actionHref`; disabled with tooltip when `actionHref === null` (FR-107a).
- [ ] T011 [US1] Create `src/components/ai/AIStrategyAssistant.tsx` — the sidebar container. Accepts `filtered: EnrichedCase[]` as a prop. Imports `policies` and the page-index from `src/services/cases.ts`. Memoises `selectPriorityCase(filtered, policies, pageIndex)` with `useMemo` keyed on `filtered` identity per `research.md §6`. Memoises `computeTriageCounts(filtered)` the same way. Mounts `<TriageSummary counts={...} />` and `<PriorityInsight inputs={...} />`. Render an always-expanded shell at this task (collapse behaviour is US3 — T016).
- [ ] T012 [US1] In `src/components/caseload/CaseloadOverview.tsx`, add a one-line mount `<AIStrategyAssistant filtered={filteredCases} />` in the grid slot Stream C reserved. Coordinate the diff with Stream C owner if the slot has moved. Do not touch other parts of the file.

**Checkpoint**: US1 is demo-ready. Triage counts + priority insight + CTA work with or without an API key. This is the MVP cutline per `quickstart.md §14:30 checkpoint`.

---

## Phase 4: User Story 2 — Workload heatmap (Priority: P2, stretch)

**Goal**: Priya sees a dense above-the-fold grid of one coloured tile per case, grouped critical-first, with hover tooltip and click-through.

**Independent Test**: Load `/`. A grid above the caseload table shows one tile per filtered case, coloured by risk level, with criticals first. Hover a tile → tooltip shows case ref + applicant + risk level. Click → navigates to `/case/:caseId`. Keyboard Tab reaches each tile; Enter activates navigation. Filters change → tiles re-render in lockstep with the table.

**⚠️ Gate**: Only attempt if US1 (T009–T012) is demoable by 13:30 per `quickstart.md`. Drop on any slip.

### Implementation for User Story 2

- [ ] T013 [P] [US2] Implement `buildHeatmapTiles(filtered: EnrichedCase[]): HeatmapTile[]` in `src/services/ai.ts` per `contracts/ai-service.md §buildHeatmapTiles` and the ordering rule in `data-model.md §HeatmapTile` (critical → warning → normal; riskScore.score desc within bucket). Total + pure.
- [ ] T014 [US2] Create `src/components/ai/WorkloadHeatmap.tsx` — accepts `filtered: EnrichedCase[]`, memoises `buildHeatmapTiles(filtered)`. Renders a CSS grid `display: grid; grid-template-columns: repeat(auto-fill, minmax(48px, 1fr))` per `research.md §7`. Each tile is a `<button>` (or `<a>` via `react-router-dom`'s `Link`) with `aria-label="{caseRef} — {applicantName} — {riskLevel}"`, coloured via `gds.red`/`gds.amber`/`gds.green`, navigating to `/case/:caseId` on click/Enter (FR-115, FR-116).
- [ ] T015 [US2] In `src/components/caseload/CaseloadOverview.tsx`, mount `<WorkloadHeatmap filtered={filteredCases} />` above the summary tiles (FR-113 ordering).

**Checkpoint**: US2 adds density without touching US1 files (aside from the shared overview mount point). Both stories remain independently demo-able.

---

## Phase 5: User Story 3 — Trust & control (Priority: P3)

**Goal**: Sam can collapse the sidebar to reclaim table space; the insight refreshes on filter change rather than staying pinned stale.

**Independent Test**: Click the collapse control → the caseload table reclaims the freed horizontal space with no layout jump. Re-open → insight still reflects the currently-riskiest case among currently-filtered cases. Change filters → insight skeleton briefly flashes, then the new case's sentence appears.

### Implementation for User Story 3

- [ ] T016 [US3] In `src/components/ai/AIStrategyAssistant.tsx`, add a collapse/expand button with `aria-expanded={!collapsed}` and `aria-controls` pointing at the panel body's `id` per `research.md §9`. Local `useState<boolean>(false)` for `collapsed`. When collapsed, render only the header + button; parent grid column reclaims space via a conditional class toggle. In-memory only — no localStorage (FR-110).
- [ ] T017 [US3] Verify filter-lockstep by manual walkthrough of `quickstart.md §Manual verification step 4` — change filters in Stream C's control; confirm triage counts and priority insight update within one render tick (SC-104). No code changes expected; if a stale insight is observed, trace back to the `useEffect` key in `PriorityInsight.tsx` (must be `inputs.caseRef`, not the whole object).

**Checkpoint**: All three user stories independently functional. Panel now behaves as a well-mannered sidebar rather than a competing pane.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final verification, documentation of the hackathon-only security caveat, and green CI.

- [ ] T018 Walk through every row of `quickstart.md §Manual verification` on `http://localhost:5173/`: valid key path, no-key path, offline path, filter-change path, empty-set path, collapse path. Note any deviation; do not ship with unresolved rows.
- [ ] T019 [P] Add the hackathon-only security caveat to `README.md` per `research.md §4` / `quickstart.md §Security note`: "`VITE_OPENAI_API_KEY` is inlined into the built bundle at build time. This is appropriate for a controlled single-demo environment only and is NOT safe for public deployment. Replace with a server-side proxy before shipping outside the hackathon."
- [ ] T020 Run `npm test && npm run lint` from the repo root. Expect exactly 7 passing tests (4 pre-existing + 3 from T008), zero lint errors. If test count differs, a component test has leaked in — remove it (Constitution §VI).
- [ ] T021 [P] Confirm the constitution amendment from v1.1.0 → v1.2.0 has landed on main (file: `.specify/memory/constitution.md`, Sync Impact Report at top). Stream F merge blocks until the amendment is in. Reference: `plan.md §Complexity Tracking` — the historical violation row is now marked resolved; no further action needed if that row reads "Resolution: Constitution amended 2026-04-16 …".

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No code dependencies; T001 is on-disk, T002 is OpenAI-console. Can happen any time before Phase 2 starts executing `getPriorityInsight` live.
- **Foundational (Phase 2)**: Depends on Setup for the live-call path (but code itself compiles without it). **BLOCKS** all user stories.
- **User Story 1 (Phase 3)**: Depends on Phase 2. Independent of US2 and US3.
- **User Story 2 (Phase 4)**: Depends on Phase 2 + T012's grid-slot plumbing in `CaseloadOverview.tsx`. Otherwise independent of US1/US3; will share the overview file edit — coordinate with T012's author.
- **User Story 3 (Phase 5)**: Depends on Phase 2 + T011 (AIStrategyAssistant shell from US1). T016 edits the US1 file so it must run after T011 — not in parallel.
- **Polish (Phase 6)**: Depends on whichever user stories were completed.

### Within a User Story

- Models/types before services (done in Phase 2).
- Services before components (T004–T007 before T009–T011).
- Pure presentational components before containers (T009 before T011).
- Container before mount (T011 before T012).
- Build shell before collapse (T011 before T016).

### Parallel Opportunities

- **Phase 2**: T004, T005, T006 are all in `src/services/ai.ts` — not parallelisable as separate tasks against the same file unless you coordinate concurrent edits. T003 (types file) and T008 (test file) are parallelisable against T004–T007 (service file) but T008 needs the exports to import, so save T008 for last within Phase 2.
- **Phase 3 (US1)**: T009 is parallel with T010 (different files). T011 depends on T009 + T010. T012 depends on T011.
- **Phase 4 (US2)**: T013 and T014 touch different files — parallel. T015 depends on T014.
- **Phase 5 (US3)**: T016 and T017 sequential (T017 manually verifies T016).
- **Phase 6**: T019 and T021 can run in parallel with T018 (different artefacts). T020 runs after code edits are in.

### Cross-Story

- All three user stories share `src/components/caseload/CaseloadOverview.tsx` at their mount points (T012, T015). Serialise the edits; do not parallel-apply.
- All three user stories consume the Phase 2 service — do not start any story task before T003–T008 complete.

---

## Parallel Example: User Story 1 after Phase 2

```bash
# T009 and T010 can start concurrently — different component files, both consume Phase 2:
Task T009: "Create TriageSummary presentational component in src/components/ai/TriageSummary.tsx"
Task T010: "Create PriorityInsight component in src/components/ai/PriorityInsight.tsx"

# Then T011 assembles them:
Task T011: "Create AIStrategyAssistant container in src/components/ai/AIStrategyAssistant.tsx"

# Finally T012 wires into the overview:
Task T012: "Mount <AIStrategyAssistant /> in src/components/caseload/CaseloadOverview.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (Setup): `.env.local` + billing cap.
2. Phase 2 (Foundational): types + five pure functions + three tests. `npm test` goes from 4→7 passing.
3. Phase 3 (US1): TriageSummary → PriorityInsight → AIStrategyAssistant → mount.
4. **STOP & VALIDATE** per `quickstart.md §Manual verification` rows 1, 2, 5.
5. If the 14:30 checkpoint hits before Phase 4 is demo-able, freeze here — this alone is the feature.

### Incremental Delivery

1. MVP (US1) → demo it.
2. US2 (heatmap) as a separate increment — does not modify US1's components.
3. US3 (collapse + filter-lockstep) as polish — only modifies AIStrategyAssistant.tsx, which US1 already owns.
4. Phase 6 polish runs continuously; finalise before merge.

### Single-Developer Strategy (Expected for Stream F)

Stream F is one person (per `plan.md §Summary`). Sequential execution T001 → T021 respecting the dependency table above. Quickstart budgets ~3 hours for F1–F8; these 21 tasks are the same scope broken finer for traceability. T002 can be done in parallel with any code task (it's browser-side). T018/T019/T021 can overlap with a long `npm test` run.

---

## Notes

- [P] tasks = different files, no unmet dependencies at the time they're picked up.
- Every task has a concrete file path; no "work on services" hand-waves.
- Tests exist only as the three deterministic checks in T008 — per Constitution §VI, no component tests, no snapshots, no Playwright. If a file appears under `src/components/` in any test import, you've left the lane.
- `src/lib/priority.ts` (mentioned in `plan.md §Project Structure` and the rollback plan) is intentionally unused here — everything lives in `src/services/ai.ts` per the frozen contract. Rollback doc stays accurate because "delete it (if split out)" covers both outcomes.
- Commit granularity: one commit per phase is the natural cadence; commit per task is also fine. Do not squash Phase 2 into Phase 3 — the foundational phase should land green on its own so you can bisect cleanly.
- Rollback: see `quickstart.md §Rollback` — four deletions revert the entire feature.
