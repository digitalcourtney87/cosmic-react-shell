# Case Compass — Design Spec

**Challenge 3: Supporting Casework Decisions**
Version 1 AI Engineering Lab Hackathon · London · April 2026
Prepared by Courtney Allen · 2026-04-16

This spec is a hybrid: product framing up top so anyone reading cold knows what we're building and why, followed by a build spec the team works from on the day. Locked decisions captured during brainstorming:

- **Hybrid document** — product framing then build spec in one file.
- **Evidence derivation** — contract + worked example frozen; the matching algorithm is pseudocode until we have the real JSON in hand.
- **Design direction** — GDS-flavoured Tailwind over shadcn (token overrides only; no `govuk-frontend` package).
- **Stretch work** — fenced off in a single annex; never inline with must-ships.
- **Tests** — unit tests cover Stream A's derivation logic only; every other stream leans on visual inspection + rehearsal.

---

## 1. Product Framing

### Problem

Caseworkers across government spend most of their working day *reconstructing* case state — reading fragmented notes, cross-referencing policy documents, and chasing evidence that may already have arrived in a different system — rather than making the decisions only they can make. Applicants, meanwhile, wait weeks without a meaningful update. Team leaders discover at-risk cases only when they escalate.

### Personas

- **Primary — Sam, the caseworker.** Manages 20–40 active cases. Not technical. Opens a case and needs, within two minutes: what's happened, what policy applies, what's overdue, what to do next.
- **Secondary — Priya, the team leader.** Accountable for 200–300 cases across 6–10 caseworkers. Needs to see which cases are at risk *now*, not after they've breached.
- **Implied — the applicant.** Named in the spec, not built. Cited as the obvious next step to demonstrate the data model already supports it.

### Value Proposition

> **For** government caseworkers and their team leaders **who** spend most of their time reconstructing case state rather than making decisions, **Case Compass** is a decision-support tool **that** synthesises timeline, applicable policy, workflow state, and derived evidence status into a single actionable view, **unlike** existing case-management systems that store information across multiple screens without connecting it.

### In Scope (MVP)

- Two views: caseload overview and case detail.
- Policy matching by case type.
- Workflow state + next actions derived from the state-machine JSON.
- **Evidence status derived from timeline × policy text** (the engineering differentiator).
- Risk scoring driven by workflow thresholds.
- GOV.UK-flavoured chrome (credibility, not pixel-perfect GDS).

### Out of Scope (MVP)

- Applicant-facing view.
- Write operations (no "mark as reminded", no note editing).
- Authentication, real backend, real LLM.
- Case generation beyond the 10 provided (moved to annex).
- Every task flagged `[stretch]` in the original brief (moved to annex).

---

## 2. Architecture & Contracts

### Folder Layout

```
src/
  data/          ← raw JSON fixtures (cases, policy-extracts, workflow-states)
  services/      ← Stream A: pure functions over the fixtures
  types/         ← shared TypeScript interfaces
  components/    ← shadcn primitives + Case Compass components
  pages/         ← CaseloadOverview, CaseDetail
  test/          ← vitest specs for services/
  App.tsx        ← router + shell
```

No global state library. Data is synchronously loaded at import time; React Router provides the two routes. React Query / Zustand / Redux are explicitly out — YAGNI for a static fixture read.

### Type Contracts (frozen)

```typescript
// src/types/case.ts
export type CaseType = 'benefit_review' | 'licence_application' | 'compliance_check';

export interface Case {
  case_id: string;
  case_type: CaseType;
  status: string;
  applicant: { name: string; reference: string; date_of_birth: string };
  assigned_to: string;
  created_date: string;
  last_updated: string;
  timeline: TimelineEvent[];
  case_notes: string;
}

export interface TimelineEvent {
  date: string;
  event: string;
  note: string;
}

export interface PolicyExtract {
  policy_id: string;
  title: string;
  applicable_case_types: CaseType[];
  body: string;
}

export interface WorkflowState {
  state: string;
  allowed_transitions: string[];
  required_actions: string[];
  escalation_threshold?: { days: number; action: string };
}

// Derived (our additions)
export interface EvidenceItem {
  requirement: string;        // "proof of address"
  sourcePolicy: string;       // "POL-BR-003"
  status: 'received' | 'outstanding' | 'overdue';
  requestedDate?: string;
  receivedDate?: string;
  daysElapsed?: number;
  thresholdDays?: number;
}

export interface RiskScore {
  score: number;              // 0–10
  level: 'normal' | 'warning' | 'critical';
  factors: string[];
}

export interface Action {
  label: string;              // "Issue 28-day reminder"
  dueIn?: number;             // negative = overdue
  severity: 'info' | 'warning' | 'critical';
}
```

### Service API (frozen)

```typescript
// src/services/cases.ts
getAllCases(): Case[]
getCaseById(id: string): Case | undefined
getApplicablePolicies(caseType: CaseType): PolicyExtract[]
getWorkflowState(caseType: CaseType, status: string): WorkflowState | undefined
deriveEvidenceStatus(timeline: TimelineEvent[], policies: PolicyExtract[]): EvidenceItem[]
calculateRiskScore(c: Case, evidence: EvidenceItem[], workflow?: WorkflowState): RiskScore
getRequiredNextActions(c: Case, workflow: WorkflowState | undefined, evidence: EvidenceItem[]): Action[]
```

### Integration Pattern (unblocks parallel work)

Until Stream A ships, Streams B and C import from `src/services/mock.ts` — a file that exports the same signatures, returning one hardcoded case record and stub derived data. When A's real implementation lands, Streams B and C change one import line. No refactors, no merge conflicts.

---

## 3. Layer Acceptance Criteria

Each layer is independently demoable. A layer is "done" only when all criteria are met *and* a teammate who hasn't seen the build can navigate to the route and see it working.

### Layer 1 — Single Case View (target: 11:00)

- Route `/case/:caseId` renders without console errors for any seeded `case_id`.
- Header shows applicant name, case reference, case-type badge, status, and created date.
- Timeline renders `case.timeline[]` chronologically with date, event label, and note.
- Case notes block renders `case_notes` as readable paragraphs (not JSON).
- Unknown `caseId` shows a friendly "Case not found" state, not a blank page.

**Demo line:** *"This alone is better than opening three tabs."*

### Layer 2 — + Applicable Policies (target: 12:30)

- A "Relevant policy" panel appears on case detail.
- Panel lists every policy whose `applicable_case_types` includes this case's type.
- Each policy shows `title`, `policy_id`, and `body` as wrapped text.
- Zero-match case types render a visible "No policy matched" state (flags data issues rather than hiding them).

### Layer 3 — + Workflow, Evidence, Risk, Next Actions (target: 14:30)

- Evidence tracker renders one row per derived requirement with its status icon (✓ / ⏳ / ⚠️), elapsed days, and threshold.
- Workflow panel shows current `state`, `allowed_transitions`, and a next-actions list derived from `required_actions` + overdue escalations.
- Risk score badge appears in the case header — colour, numeric score, and top 1–2 factors on hover.
- Overdue items surface *before* approaching-threshold items in the UI (ordering is part of the spec, not a nice-to-have).

**Demo line:** *"The system cross-referenced timeline against policy requirements. Income statement: 42 days out, approaching the 56-day escalation threshold. Next action is clear."*

### Layer 4 — Caseload Overview (target: 14:30, parallel with L3)

- Route `/` renders a table of every case from `getAllCases()`.
- Columns: reference, applicant, case type, status, age (days since created), risk badge.
- Header: total-cases counter, open/awaiting/overdue counters, average case age.
- Sortable by age and by risk score (descending by default — riskiest first).
- Filters for case type, team (`assigned_to`), and status. Filters compose (AND).
- Clicking any row navigates to `/case/:caseId`.

**Layer-complete demo:** Overview → click riskiest case → see policy + evidence + next actions → back.

---

## 4. Stream A — Data & Services (+ Tests)

### Task List (order of attack)

| # | Task | Blocks | Est. |
|---|---|---|---|
| A1 | Define interfaces in `src/types/case.ts` (copy-paste from Section 2) | B1, C1 | 10m |
| A2 | Import JSON fixtures; export `getAllCases()`, `getCaseById()` | B1, C1 | 10m |
| A3 | `getApplicablePolicies()` — filter by `applicable_case_types` | B4 | 10m |
| A4 | `getWorkflowState()` — look up state object; adapt types when JSON is seen | B6 | 20m |
| A5 | `deriveEvidenceStatus()` — see worked example below | B5, C3, A6 | 60m |
| A6 | `calculateRiskScore()` — formula from brief, populate `factors[]` | B7, C3 | 30m |
| A7 | `getRequiredNextActions()` — `workflow.required_actions` ∪ overdue escalations | B6 | 30m |

### Evidence Derivation — Worked Example (contract + pseudocode)

Given a benefit-review case whose timeline contains:

- `2026-03-05 evidence_requested — proof of address, income statement, signed declaration`
- `2026-03-20 evidence_received — proof of address`

…and `POL-BR-003` whose body prose says *"requires proof of address, income statement, signed declaration; remind at 28 days, escalate at 56 days"*:

```
For each requirement r parsed from policy body:
  requestedDate ← earliest evidence_requested event mentioning r (or any request, if per-item parsing is unreliable)
  receivedDate  ← earliest evidence_received event mentioning r
  daysElapsed   ← (today - requestedDate)
  thresholdDays ← escalation threshold parsed from policy body (fallback: 56)
  status        ← receivedDate ? 'received'
                 : daysElapsed > thresholdDays ? 'overdue'
                 : 'outstanding'
Return EvidenceItem[] ordered: overdue → outstanding → received
```

**Pragmatic fallback:** if per-requirement text matching against the free-text `note` field proves fragile on the day, start with a simpler heuristic — treat the whole `evidence_requested` event as "all requirements requested on this date", and mark a requirement received only if its name appears in any subsequent `evidence_received` note. Ship that first, refine if time allows.

### Risk Score Formula (driven by workflow state machine)

```typescript
function calculateRiskScore(c, evidence, workflow): RiskScore {
  let score = 0;
  const caseAgeDays = daysBetween(c.created_date, today());
  const daysSinceActivity = daysBetween(c.last_updated, today());

  if (workflow?.escalation_threshold) {
    const t = workflow.escalation_threshold.days;
    if (caseAgeDays > t)           score += 4;
    else if (caseAgeDays > t * 0.75) score += 2;
  }

  const overdueCount = evidence.filter(e => e.status === 'overdue').length;
  score += overdueCount * 2;

  if (daysSinceActivity > 14) score += 2;
  if (daysSinceActivity > 28) score += 2;

  return {
    score: Math.min(score, 10),
    level: score >= 7 ? 'critical' : score >= 4 ? 'warning' : 'normal',
    factors, // populated with human-readable reasons as each rule fires
  };
}
```

### Tests (vitest, in `src/test/services.test.ts`)

Four fixture-driven tests — the only tests in the spec:

1. `deriveEvidenceStatus` — all received → all `'received'`.
2. `deriveEvidenceStatus` — requested 60 days ago with 56-day threshold → `'overdue'`.
3. `calculateRiskScore` — past escalation threshold + 1 overdue item → `level: 'critical'`.
4. `getRequiredNextActions` — overdue evidence produces an `'Issue reminder'` action with `severity: 'critical'`.

Build fixtures from real records in `cases.json` once it's in hand; don't invent synthetic ones.

---

## 5. Streams B, C, D

### Stream B — Case Detail (strongest frontend dev)

Component tree under `src/pages/CaseDetail.tsx`:

```
<CaseDetail>
  <CaseHeader />              ← B1, B7 (risk badge lives here)
  <CaseSummarySection>
    <Timeline />              ← B2
    <CaseNotes />             ← B3
  </CaseSummarySection>
  <PolicyPanel />             ← B4
  <EvidenceTracker />         ← B5
  <WorkflowStatusPanel />     ← B6 (current state + next actions)
</CaseDetail>
```

- **B1 CaseHeader** — applicant name, reference, case-type badge, status pill, created date, risk badge slot.
- **B2 Timeline** — vertical list, one row per event: date (left rail), icon keyed off `event`, label, note. Icons: created (📄), evidence_requested (📨), evidence_received (📬), decision (⚖️). Fallback icon (●) for unknown events.
- **B3 CaseNotes** — `white-space: pre-wrap` on the `case_notes` string inside a shadcn `<Card>`.
- **B4 PolicyPanel** — shadcn `<Accordion>`, one item per policy from `getApplicablePolicies()`. Collapsed by default; first policy open on mount.
- **B5 EvidenceTracker** — one row per `EvidenceItem`. Status column uses ✓ / ⏳ / ⚠️ plus a coloured dot. Show `daysElapsed / thresholdDays` as "42 / 56 days" when status is outstanding/overdue.
- **B6 WorkflowStatusPanel** — current state as a pill; "Next actions" list from `getRequiredNextActions()`, each with severity colour. Critical actions render first.
- **B7 RiskBadge** — slot-in badge for the header. Coloured pill: green/amber/red. Tooltip (shadcn `<HoverCard>`) shows score + top 2 factors.

**Acceptance (B-done):** load any `caseId`, see all six components rendered, no console errors, derived data visibly flows through from services.

### Stream C — Caseload Overview (frontend/data-viz dev)

Single page at `/` in `src/pages/CaseloadOverview.tsx`:

- **C1 SummaryStats** — four shadcn `<Card>` tiles along the top: total, awaiting evidence, overdue, avg age (days).
- **C2 CaseloadTable** — shadcn `<Table>`, columns as per Layer 4 acceptance. Sort via column-header click; default sort = risk score desc. Use `useMemo` for sort/filter.
- **C3 RiskBadge** — same component as B7; import, don't duplicate.
- **C4 Filters** — three shadcn `<Select>` dropdowns above the table (case type, team, status). Each includes an "All" option.
- **C5 Row click** — `onRowClick` → `navigate('/case/' + caseId)`. Row hover: cursor pointer, subtle bg change. No checkboxes, no bulk actions.

**Acceptance (C-done):** 10 cases render in the table; each filter works independently and in combination; clicking a row lands on that case's detail view.

### Stream D — Shell & Routing (any dev, can double up)

- **D1** Vite scaffold is already present; create missing folders (`data/`, `services/`, `types/`, `test/`).
- **D2 AppShell** — sticky dark-navy header (`#0b0c0c`), white wordmark "Case Compass", yellow focus ring (`#ffdd00`) on interactive elements, Inter font stack. Main content in a centred `max-w-7xl` container.
- **D3 Router** — `react-router-dom` with routes `/` and `/case/:caseId`.
- **D4 Navigation** — header link "All cases" → `/`. Case detail shows a breadcrumb: *All cases › CASE-2026-00042*.

**Acceptance (D-done):** both routes reachable from the header; 404 route shows a "not found" panel, not a blank page.

---

## 6. Design Tokens, Milestones, Stretch Annex, Risks

### Design Tokens (GDS-flavoured Tailwind)

Drop into `tailwind.config.ts` under `theme.extend.colors`:

```
gds: {
  black:     '#0b0c0c',   // header, body text
  yellow:    '#ffdd00',   // focus ring only — never fills
  blue:      '#1d70b8',   // links, primary actions
  green:     '#00703c',   // "received", "normal"
  amber:     '#f47738',   // "approaching threshold", "warning"
  red:       '#d4351c',   // "overdue", "critical"
  midgrey:   '#505a5f',   // secondary text
  lightgrey: '#f3f2f1',   // page background
}
```

- Font: Inter from Google Fonts (GDS Transport is licence-restricted — don't ship it).
- Focus ring: 3px solid `gds-yellow` on every interactive element. Global rule in `index.css`.
- Spacing: stick to Tailwind defaults; don't port the GDS 5px grid.
- `<Badge>` variants `normal | warning | critical` map to green/amber/red. Reused by B7 and C3.

### Milestones (scored dashboard alignment)

| Time | Deliverable | Owner |
|---|---|---|
| 09:45 | Repo scaffold + folders + JSON fixtures committed | D + A |
| 10:00 | **README.md committed** (scored milestone) | E |
| 11:00 | **Layer 1 demoable** on `/case/:caseId` | B |
| 12:30 | Layer 2 live; caseload table renders (Layer 4 skeleton) | B + C |
| 14:30 | Layers 3 & 4 complete; full click-through journey works | All |
| 14:45 | Demo rehearsal | All |
| 15:30 | Judges arrive | — |

### Stretch Annex (only after L1–L4 are green)

- **L5 — Mocked AI summary**: add `<AiSummaryCard>` at the top of case detail. Reads from `services/aiSummary.ts`, which returns a hardcoded `Promise<string>` keyed by `caseId`. Interface signature matches what a real LLM call would return so swap is a one-function change. Label as *"AI-generated — demo mock"*.
- **C6 — Bottleneck summary**: one paragraph above the caseload table — e.g., *"3 cases overdue on evidence; 2 approaching 56-day escalation"* — derived from the existing `RiskScore.factors[]`.
- **A8 — Synthetic cases**: use the Hint 3 prompt to generate 20 more into `cases.json`. Only if rendering 10 looks thin in rehearsal.
- **D5 — Case switcher**: dropdown on detail page to jump between cases without returning to overview. Pure QoL; skip unless demo flow calls for it.

### Risk Register

| Risk | Mitigation |
|---|---|
| Evidence derivation harder than expected | Ship the pragmatic fallback (Section 4) first; refine only if the four tests pass. |
| `workflow-states.json` shape differs from assumption | A4 adapts types before A7; worst case, hardcode the state machine from policy prose. |
| Stream A blocked on typing or too slow | `services/mock.ts` unblocks B and C; PM pair-programs A. |
| Scope creep toward L5 | L5 is behind the annex fence; no L5 work until 14:30 checkpoint shows L1–L4 green. |
| Demo regressions after Priya→Sam click-through lands | Integration QA at 13:45 and rehearsal at 14:45 — both on Courtney's list. |
