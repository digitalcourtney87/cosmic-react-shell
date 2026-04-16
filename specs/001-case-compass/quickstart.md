# Quickstart: Per-Stream Build Guide

**Feature**: Case Compass | **Date**: 2026-04-16

Four streams build in parallel from the 09:45 scaffold checkpoint. Stream E sits across all four for README + integration QA. This document is the single page each developer reads at start-of-day.

---

## Common prerequisites (all streams, before 09:45)

```bash
git checkout 001-case-compass
git pull
bun install        # or: npm install
bun dev            # confirms scaffold runs
```

Read in this order:

1. `specs/001-case-compass/spec.md` — what we're building.
2. `specs/001-case-compass/plan.md` — directory ownership map.
3. `specs/001-case-compass/contracts/services-api.md` — the frozen Stream A surface.
4. `.specify/memory/constitution.md` — locked decisions (don't relitigate).

The five-segment list, three routes, GDS tokens, frozen reference date, and four-test discipline are all locked. If anything below seems to contradict them, the constitution wins.

---

## Stream A — Data & Services (+ Tests)

**Owner**: data/services-leaning developer.
**Owns**: `src/types/case.ts`, `src/services/`, `src/lib/`, `src/test/`, `src/components/shared/RiskBadge.tsx`.
**Critical pre-task**: `src/services/mock.ts` ships FIRST (before any other A task) to unblock B/C/D.

### Order of attack (08:45–14:00)

| # | Task | Unblocks | Est. |
|---|------|----------|------|
| A0 | `mock.ts` exporting every signature in `contracts/services-api.md` returning hardcoded data for one case | B/C/D — DO THIS FIRST | 30m |
| A1 | `src/types/case.ts` — copy contracts; FREEZE | B1, C1 | 10m |
| A2 | `src/services/cases.ts` — `getAllCases`, `getCaseById` over imported JSON | B1, C1 | 10m |
| A3 | `getApplicablePolicies` — filter by `applicable_case_types` | B4 | 10m |
| A4 | `getWorkflowState` — lookup; return `undefined` on miss (FR-023) | B6 | 20m |
| A5 | `deriveEvidenceStatus` — ship pragmatic fallback (whole-event matching, FR-025) FIRST | B5, C3, A6 | 60m |
| A6 | `calculateRiskScore` — formula per `data-model.md`; honour FR-018a (no escalation threshold → omit case-age) | B7, C3 | 30m |
| A7 | `getRequiredNextActions` — workflow actions ∪ overdue escalations | B6 | 30m |
| A8 | `src/lib/segments.ts` — `getSegment(case)` mapping | C2 (group-by toggle) | 15m |
| A9 | `src/lib/date.ts` — `REFERENCE_DATE` constant + `daysBetween` | A5/A6/A7 (called from these) | 10m — do alongside A5 |
| A10 | Four vitest tests in `src/test/services.test.ts` | demo confidence | 30m |
| A11 | `RiskBadge` shared component (used by B7 and C3) | B7, C3 | 20m |

### Acceptance (Stream A done)

- `bun test` passes all four tests.
- B and C have switched their imports from `mock.ts` to `cases.ts` with no runtime errors.
- `mock.ts` is deleted from the tree.

### Watch out for

- Per-requirement text matching is the riskiest derivation in the build. If A5 takes longer than 60m, stay with the pragmatic fallback and ship.
- Never call `new Date()` from anywhere in `src/services/` or `src/lib/`. Always read `REFERENCE_DATE`.

---

## Stream B — Case Detail (strongest frontend dev)

**Owner**: heaviest-UI developer.
**Owns**: `src/pages/CaseDetail.tsx`, `src/pages/ActionStub.tsx`, `src/components/case-detail/`.
**Imports from**: `@/services/mock` until A ships, then `@/services/cases`.

### Order of attack (09:45–14:00)

| # | Task | Acceptance | Est. |
|---|------|------------|------|
| B0 | Scaffold `pages/CaseDetail.tsx` consuming `getCaseById` from `mock.ts` | renders case_id from URL | 15m |
| B1 | `CaseHeader` — applicant, reference, type badge, status pill, created date | header reads correct values | 25m |
| B2 | `Timeline` — vertical list, icons keyed off `event` (`'created'`/`'evidence_requested'`/`'evidence_received'`/`'decision'` + fallback) | sample case shows events chronologically | 30m |
| B3 | `CaseNotes` — `white-space: pre-wrap` inside shadcn Card | preserved line breaks | 10m |
| B4 | `PolicyPanel` — shadcn Accordion, one item per `getApplicablePolicies` result; first open on mount; FR-012 empty state | "No policy matched" renders for an unmatched case | 30m |
| B5 | `EvidenceTracker` — one row per `EvidenceItem`, status icons ✓/⏳/⚠️, "42/56 days" copy when outstanding/overdue | overdue rows red and on top | 40m |
| B6 | `WorkflowStatusPanel` — current state pill + actions list from `getRequiredNextActions`; critical first; FR-023 fallback | unknown state renders raw + message | 30m |
| B7 | `RiskBadge` slot in `CaseHeader` — import from Stream A; HoverCard tooltip shows score + factors | `factors[]` text visible on hover | 15m |
| B8 | `pages/ActionStub.tsx` for `/case/:caseId/action/:actionId` (FR-026) — render label, case ref, severity, back link; mutate nothing | unknown actionId renders not-found per FR-019 pattern | 25m |
| B9 | `next-action` items in `WorkflowStatusPanel` link to the stub route (FR-017a) | tab order reaches every action; Enter follows | 15m |
| B10 | "Case not found" panel for unknown `:caseId` (FR-019) with link back to `/` | unknown caseId renders panel | 15m |

### Acceptance (Stream B done)

- Open any seeded `caseId` → all six panels render, no console errors.
- Click any next-action → stub route renders correctly; back link returns to case detail.
- Unknown caseId → friendly "Case not found".

### Watch out for

- Don't fork `RiskBadge` — import from Stream A's shared.
- The action stub MUST render no toast/snackbar that implies persistence. Constitution forbids any visible write semantics.

---

## Stream C — Caseload Overview (frontend/data-viz dev)

**Owner**: developer comfortable with sort/filter UI.
**Owns**: `src/pages/CaseloadOverview.tsx`, `src/components/caseload/`.
**Imports from**: `@/services/mock` until A ships, then `@/services/cases`.

### Order of attack (09:45–14:00)

| # | Task | Acceptance | Est. |
|---|------|------------|------|
| C0 | Scaffold `pages/CaseloadOverview.tsx` consuming `getAllCases` from `mock.ts` | flat list of cases renders | 15m |
| C1 | `SummaryStats` — four shadcn Card tiles: total, awaiting evidence, overdue, avg age. Reflects filtered set per FR-006 | tiles update with filters | 25m |
| C2 | `CaseloadTable` — shadcn Table, sticky header, columns per FR-002, default sort risk-desc per FR-003, sortable on age/risk per FR-004; uses `useMemo` | header sticks; click sorts | 50m |
| C3 | `RiskBadge` reuse from Stream A | coloured pill renders per case | 5m |
| C4 | `Filters` — three shadcn Select dropdowns (case type, "Assigned to" per FR-005, status); AND semantics | each filter and combinations work | 35m |
| C5 | Row click → `navigate('/case/' + caseId)` (FR-007); cursor pointer + hover bg | clicking row lands on detail | 15m |
| C6 | Tab/Enter row navigation (FR-007a) — link semantics, no WAI-ARIA grid | Tab walks rows; Enter follows | 20m |
| C7 | `OverdueBanner` (FR-005b) — amber banner above table when active filters hide overdue cases; "Show" clears only obscuring filters | hide-then-show round-trip works | 35m |
| C8 | `Group by segment` toggle (FR-005a) — default OFF; ON groups into 5 fixed segments + "Other" using `getSegment` from `src/lib/segments.ts`; empty segments render as `(0)` | toggle round-trips; empty segments visible | 40m |
| C9 | Soft-cap behaviour (FR-001) — render every row up to 50; no pagination | fixture > 10 still renders inside cap | 5m |

### Acceptance (Stream C done)

- 10 cases render in the flat default view, sorted risk-desc.
- All three filters work independently and combined.
- Group-by toggle ON → five segments visible (with `(0)` headers where empty), correct sort within each.
- Hide-overdue filter combo triggers amber banner; "Show" clears just the obscuring filters.

### Watch out for

- Filter label is "Assigned to", NOT "Team" (FR-005 clarification).
- The "Show" link must clear *only* the filters that are hiding overdue cases. Clearing all filters is a different (worse) UX.

---

## Stream D — Shell & Routing

**Owner**: any developer; can pair with another stream after D-done.
**Owns**: `src/App.tsx`, `src/main.tsx`, `src/index.css`, `src/components/AppShell.tsx`, `tailwind.config.ts`.

### Order of attack (08:45–11:00)

| # | Task | Acceptance | Est. |
|---|------|------------|------|
| D0 | Confirm Vite scaffold runs; ensure `data/`, `services/`, `types/`, `test/`, `lib/` directories exist | `bun dev` shows blank page | 15m |
| D1 | `tailwind.config.ts` — add `gds.*` colour tokens per research.md §3 | classes like `bg-gds-amber` resolve | 15m |
| D2 | `src/index.css` — global 3px solid `gds.yellow` focus ring on every interactive element; Inter from Google Fonts | every focusable element shows ring | 20m |
| D3 | `AppShell` — sticky `gds.black` header, white "Case Compass" wordmark, `max-w-7xl` centred main | header sticks; wordmark visible | 25m |
| D4 | `App.tsx` — react-router-dom routes: `/` (CaseloadOverview), `/case/:caseId` (CaseDetail), `/case/:caseId/action/:actionId` (ActionStub), 404 catch-all | all three routes reachable | 20m |
| D5 | Header link "All cases" → `/`; case-detail breadcrumb `All cases › CASE-2026-00042` | breadcrumb shows current case | 15m |

### Acceptance (Stream D done by 11:00)

- All three routes reachable from the header.
- 404 route renders friendly not-found, not blank page.
- Yellow focus ring visible on every interactive element across the app.

### Watch out for

- Do NOT install `govuk-frontend`. Tokens only (constitution principle III).
- `App.tsx` is the merge-conflict-prone file. B and C send PRs/diffs against it; you apply. Coordinate verbally.

---

## Stream E — README + Integration QA

**Owner**: PM-leaning team member or whoever isn't deep in UI churn at the moment.
**Owns**: `README.md`, integration walkthroughs, demo script.

### Order of attack

| Time | Task |
|------|------|
| 08:45 | Draft README outline (problem, solution, "5 seconds × millions" framing per spec clarification, demo script, screenshot placeholders) |
| 10:00 | **README committed** — scored milestone per constitution §Hackathon Constraints |
| 11:00 | After Layer 1 demo: take a screenshot, paste into README |
| 12:30 | After Layer 2 demo: walk the case-detail page end-to-end on a fresh browser, file any console errors as bugs against the responsible stream |
| 14:30 | Stretch fence checkpoint — confirm L1–L4 are green; only THEN may any teammate touch the stretch annex |
| 14:45 | **Rehearsal** — walk the full demo journey (caseload → riskiest case → policy + evidence + actions → back). Note any rough edges; fix or document. |
| 15:30 | **Judging** — same demo journey, no code changes since rehearsal (SC-005). |

### Acceptance (Stream E done)

- README committed by 10:00 BST and contains the pitch framing.
- 14:45 rehearsal completes without code changes between then and 15:30.
- Demo journey verified on a fresh browser at least once before judging.

---

## Layer milestones (whole team)

| Time | Milestone | Owners |
|------|-----------|--------|
| 09:45 | Repo scaffold + folders + JSON fixtures committed | D + A |
| 10:00 | README committed (scored) | E |
| 11:00 | **Layer 1 demoable** on `/case/:caseId` | B |
| 12:30 | Layer 2 live; caseload table renders | B + C |
| 14:30 | **Stretch fence checkpoint** — Layers 1–4 green and demoable | All |
| 14:45 | Rehearsal | All |
| 15:30 | Judges | All |

---

## How to verify the plan worked

The end-to-end demo journey (per SC-005):

1. Open `/`. See the caseload table sorted risk-desc.
2. Click the top row. Land on `/case/:caseId` for that case.
3. See policy panel, evidence tracker, workflow + next actions, risk badge.
4. Click any next action. Land on `/case/:caseId/action/:actionId` stub.
5. Click back link. Return to case detail. Click breadcrumb. Return to `/`.

If this journey works at 14:45 rehearsal AND at 15:30 judging without a code change in between, the plan succeeded.
