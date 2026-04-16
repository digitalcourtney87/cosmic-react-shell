# Feature Specification: Case Compass

**Feature Branch**: `001-case-compass`
**Created**: 2026-04-16
**Status**: Draft
**Input**: User description: "A decision-support tool for government caseworkers and their team leaders that synthesises timeline, applicable policy, workflow state, and derived evidence status into a single actionable view, replacing the multi-tab reconstruction work that currently dominates a caseworker's day."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Caseworker opens a case and sees a synthesised view (Priority: P1)

Sam, a benefits caseworker, opens a single case from her caseload. Within two minutes — without switching to another system — she understands what has happened on the case, which policy applies, what evidence is outstanding, how risky the case is right now, and what she needs to do next.

**Why this priority**: This is the headline value proposition. If a caseworker cannot answer "what's happening on this case and what do I do next?" from a single screen, the product fails the only user it has.

**Independent Test**: Load `/case/{any seeded case_id}` and verify that, with no further navigation, a first-time user can name the applicant, the case type, the most recent timeline event, the relevant policy, the most overdue piece of evidence, and the highest-priority next action — within 60 seconds.

**Acceptance Scenarios**:

1. **Given** a benefit-review case where evidence was requested 42 days ago and not yet received, **When** Sam opens the case detail view, **Then** the evidence tracker shows that requirement with status "outstanding", elapsed days "42 / 56", and the workflow panel surfaces an "Issue 28-day reminder" action.
2. **Given** a case whose `case_type` matches no policy in the policy fixture, **When** Sam opens it, **Then** the policy panel renders a visible "No policy matched" state rather than rendering empty.
3. **Given** an unknown `caseId` in the URL, **When** Sam navigates to it, **Then** the page renders a friendly "Case not found" state, not a blank screen or console error.
4. **Given** a case where the timeline contains an `evidence_received` event after an `evidence_requested` event for the same requirement, **When** Sam opens it, **Then** that requirement displays status "received" with a green indicator and is sorted below outstanding/overdue items.

---

### User Story 2 — Team leader triages caseload by risk (Priority: P1)

Priya, a team leader accountable for ~250 cases across her team, opens the caseload overview at the start of the day. She immediately sees which cases are at risk *now* (not after they've breached), filters to the team members and case types relevant to her morning, and clicks through to the highest-risk case to understand why it is flagged.

**Why this priority**: Without this view, leaders only learn about at-risk cases after escalation. The overview turns reactive escalation handling into proactive triage; without it, half the demo's pitch (the "Priya" persona) is unsupported.

**Independent Test**: Load `/`, sort by risk score descending, apply a case-type filter, click the top row, and verify navigation to that case's detail view — all using only mouse interactions, no keyboard shortcuts.

**Acceptance Scenarios**:

1. **Given** the seeded caseload of cases, **When** Priya opens `/`, **Then** the table renders one row per case with reference, applicant name, case type, status, age in days, and a coloured risk badge — defaulting to risk-descending sort.
2. **Given** Priya selects "benefit_review" in the case-type filter and "awaiting_evidence" in the status filter, **When** the filters apply, **Then** the table shows only cases meeting both conditions and the summary tiles update to reflect the filtered set.
3. **Given** the caseload table is sorted by risk descending, **When** Priya clicks the top row, **Then** the application navigates to `/case/{that caseId}` with the same case visible in the detail view.
4. **Given** the caseload contains at least one case past its workflow escalation threshold, **When** Priya scans the page, **Then** that case's risk badge is rendered in the critical (red) variant and appears in the top half of the default-sorted list.

---

### User Story 3 — Caseworker trusts the derivations enough to act on them (Priority: P2)

Sam needs to act on what the system tells her — issue a reminder, escalate, mark a decision — without first cross-checking against the source documents. For her to trust an "overdue" badge, the badge has to be derived from the same inputs she would consult manually: the timeline events, the policy text, and the workflow state machine.

**Why this priority**: Trust in derived data is what makes the product useful day-to-day rather than just demo-able. Without it, Sam will keep opening the original tabs anyway, and the product delivers no time saving.

**Independent Test**: For any case in the fixture, manually trace: (a) the policy body, (b) the timeline events, (c) the workflow state's escalation threshold. Verify that the on-screen evidence status, risk score level, and next actions match what the inputs require — for every case, every time the page loads.

**Acceptance Scenarios**:

1. **Given** a case whose policy body lists three evidence requirements and whose timeline contains one matching `evidence_received` event, **When** the case detail loads, **Then** the evidence tracker shows exactly three rows — one received, two outstanding/overdue — with the source policy ID visible on each.
2. **Given** a case past its workflow escalation threshold and with at least one overdue evidence item, **When** the risk score is computed, **Then** it renders at the "critical" level and the hover tooltip lists the specific factors that contributed (e.g., "past escalation threshold (78 days)", "1 evidence item overdue").
3. **Given** the same case is opened a second time in the same session, **When** the page renders, **Then** the derived values are identical to the first load — derivations are pure functions of the fixture inputs.

---

### Edge Cases

- A case has no timeline events at all (newly created): the timeline section renders an empty-state message instead of an empty list.
- A policy body uses terminology that does not literally match any timeline note (e.g., policy says "earnings statement", timeline says "income statement"): per-requirement matching MAY mark this requirement as outstanding when in fact it has been received. The pragmatic-fallback heuristic from the design doc mitigates this; the spec accepts the trade-off.
- A case's workflow status is not present in `workflow-states.json`: the workflow panel renders the raw status and an "unknown workflow state" message, but the page still loads.
- A case's workflow state exists in `workflow-states.json` but defines no `escalation_threshold` (e.g., a "decided" or "approved" terminal state): the risk score still computes and renders, but its case-age component is omitted; only overdue-evidence and recency-since-update factors contribute.
- A filter combination on the caseload page produces zero rows: the table area renders an empty-state message, not a blank table.
- The fixture contains a case whose `last_updated` is in the future relative to "today": the recency factor in the risk score contributes 0 (treated as "active today") rather than producing a negative value.
- A user follows a stale link to a `caseId` that exists in the URL but not in the fixture: the "Case not found" panel includes a link back to `/`.
- The "Group by segment" toggle is ON and the active filter combination produces zero matching cases: the page still renders all five segment headers with `(0)` counts so the framework remains visible, instead of an empty page.
- The "Group by segment" toggle is ON and a case's `status` does not map to any of the five segments (e.g., a future status added to the fixture): the case renders in an extra "Other" segment appended after the five fixed ones, rather than being silently dropped.

## Requirements *(mandatory)*

### Functional Requirements

**Caseload overview (route `/`):**

- **FR-001**: The system MUST render every case from the canonical case fixture as a row in the caseload table, up to a documented soft cap of 50 rows. The table header MUST stick to the top of the viewport during scroll. Pagination and row virtualisation are explicitly out of scope.
- **FR-002**: The caseload table MUST include columns for case reference, applicant name, case type, status, age in days since creation, and a risk indicator.
- **FR-003**: The caseload page MUST default-sort cases by risk score descending so the riskiest cases appear first.
- **FR-004**: The caseload page MUST allow sorting by case age and by risk score on header click.
- **FR-005**: The caseload page MUST provide independent filters for case type, assigned-to (individual caseworker), and status, applied with AND semantics. The assigned-to filter MUST be labelled "Assigned to" in the UI (not "Team") and its options MUST enumerate the distinct `assigned_to` values present in the loaded caseload.
- **FR-005a**: The caseload page MUST provide a "Group by segment" toggle. When OFF (default), the table renders flat per FR-001–FR-004. When ON, cases are grouped into five segments rendered in fixed order: Escalated → Pending Decision → Under Review → Awaiting Evidence → Case Created. Within each segment, default sort is risk descending. Empty segments MUST render as collapsed `Segment (0)` headers, not be omitted, so the framework remains visible. Segment membership is derived from each case's `status` (combined with `case_type` where status names overlap across types); no fixture change is required.
- **FR-005b**: When the active filter combination would hide one or more cases the system has flagged overdue, a warning banner MUST render above the table reading "X overdue cases hidden by current filter — Show". Activating "Show" MUST clear only the filters whose values are currently obscuring overdue cases (not all filters). The banner uses the `gds.amber` token. When no overdue cases are hidden, the banner MUST NOT render.
- **FR-006**: The caseload page MUST display summary tiles for total cases, cases awaiting evidence, overdue cases, and average case age — values reflecting the currently filtered set.
- **FR-007**: Clicking any row in the caseload table MUST navigate the user to the corresponding case-detail view.
- **FR-007a**: Each caseload row MUST be reachable by Tab navigation in source order; pressing Enter on a focused row MUST navigate to that case's detail view. The table is NOT required to implement the WAI-ARIA grid pattern (no arrow-key navigation, no `role="grid"`, no `aria-sort`).

**Case detail (route `/case/:caseId`):**

- **FR-008**: The case detail view MUST display the applicant's name, case reference, case type, current status, and created date.
- **FR-009**: The case detail view MUST render the case timeline in chronological order, one entry per event.
- **FR-010**: The case detail view MUST display the case notes as readable prose (preserving line breaks), not as raw structured data.
- **FR-011**: The case detail view MUST list every policy whose declared applicable case types include this case's type, with the full policy body visible.
- **FR-012**: When no policy matches the case's type, the policy section MUST render a visible "No policy matched" state.
- **FR-013**: The case detail view MUST render a derived evidence tracker with one row per requirement parsed from the applicable policies.
- **FR-014**: Each evidence row MUST show its status (received / outstanding / overdue), source policy identifier, elapsed days since requested, and the threshold against which it is being measured.
- **FR-015**: Evidence rows MUST be ordered overdue → outstanding → received.
- **FR-016**: The case detail view MUST render the case's current workflow state and a list of required next actions derived from the state machine and any overdue escalations.
- **FR-017**: Next actions MUST carry a severity indication (info / warning / critical) and critical actions MUST appear before lower-severity actions.
- **FR-017a**: Each next-action MUST render as a link navigating to `/case/:caseId/action/:actionId`. The link MUST be reachable by Tab navigation per FR-021.
- **FR-018**: A risk indicator MUST appear in the case header, conveying the numeric score, the level (normal / warning / critical), and the top contributing factors on hover.
- **FR-018a**: When the case's current workflow state has no escalation threshold defined, the risk score MUST omit the case-age contribution entirely and compute from the remaining factors (overdue-evidence count and recency-since-last-update). The factors list MUST NOT include a misleading "past escalation threshold" entry in this case.

**Mock action stub (route `/case/:caseId/action/:actionId`):**

- **FR-026**: The action stub view MUST render a "Mock action page" panel showing the action label, the originating case reference, the action severity, and a back link to `/case/:caseId`. It MUST NOT mutate any state — no fixture writes, no in-memory case updates, no toast acknowledgements that imply persistence. An unknown `actionId` for an existing case MUST render the same not-found pattern as FR-019, scoped to the action.

**Cross-cutting:**

- **FR-019**: Navigating to an unknown `caseId` MUST render a friendly "Case not found" panel with a link back to the caseload page.
- **FR-020**: All derived values (evidence status, risk score, required next actions) MUST be recomputed on every page load from the fixture inputs and MUST NOT be cached or persisted.
- **FR-020a**: All date arithmetic in derivations (elapsed days, threshold comparisons, risk-score age and recency contributions) MUST be computed against a single frozen reference date set at build time, not against the system clock. The reference date MUST be identical at the 14:45 rehearsal and the 15:30 judging window.
- **FR-021**: Every interactive element MUST receive a visible focus indicator when focused via keyboard.
- **FR-022**: The application MUST render without console errors on any seeded case.

**Data semantics:**

- **FR-023**: The system MUST handle a case whose workflow status is absent from the workflow fixture by rendering the raw status and an explanatory message rather than crashing.
- **FR-024**: The system MUST treat any timeline `evidence_received` event referencing a requirement as satisfying that requirement, even if the date precision differs from the request event's date.
- **FR-025**: When per-requirement text matching against policy body and timeline notes is unreliable for a given case, the system MUST fall back to whole-event matching (treat the entire `evidence_requested` event as requesting all open requirements; mark a requirement received if its name appears in any subsequent `evidence_received` note).

### Key Entities *(include if feature involves data)*

- **Case**: A unit of casework. Identified by `case_id`. Has a type (one of: benefit review, licence application, compliance check), a current status (free-form string scoped by case type), an applicant, an assigned caseworker, creation and last-updated dates, an ordered timeline of events, and free-text case notes.
- **Timeline Event**: A dated event on a case. Has a date, an event type label (e.g., created, evidence_requested, evidence_received, decision), and a free-text note. Events are append-only in the source fixture.
- **Policy Extract**: A piece of authoritative guidance. Identified by `policy_id`. Has a title, a list of case types it applies to, and a body containing both prose explanation and the specific evidentiary requirements / escalation thresholds the system parses.
- **Workflow State**: A node in a per-case-type state machine. Has a state name, a list of allowed transitions, a list of required actions for any case currently in this state, and an optional escalation threshold (days + escalation action).
- **Evidence Item (derived)**: One requirement extracted from a policy body, paired with its current status (received / outstanding / overdue), source policy identifier, elapsed days since requested, and the threshold beyond which it counts as overdue.
- **Risk Score (derived)**: A numeric score (0–10), a level (normal / warning / critical), and the human-readable factors that produced it.
- **Action (derived)**: A task the system surfaces as required next work — label, optional due-in days (negative if overdue), and severity.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time user can name the applicant, applicable policy, most overdue evidence item, and highest-priority next action for any seeded case within 60 seconds of opening that case's detail view.
- **SC-002**: A first-time user can identify the highest-risk case in the seeded caseload within 15 seconds of opening the overview.
- **SC-003**: 100% of seeded cases render their timeline, applicable policies, derived evidence status, derived risk score, and derived next actions without any console error or visible empty state caused by missing logic (empty states caused by genuinely missing data are acceptable).
- **SC-004**: For every seeded case, the on-screen derived evidence status, risk level, and next actions match what a manual trace through the timeline, policy body, and workflow state would conclude.
- **SC-005**: The end-to-end demo journey — caseload overview → click riskiest case → see policy + evidence + next actions → return to overview — completes without code changes between the 14:45 rehearsal and the 15:30 judging window.
- **SC-006**: A judge unfamiliar with the project can navigate from the caseload overview to a case detail and back, unaided, after a 30-second introduction.

## Assumptions

- The hackathon organisers will provide `cases.json`, `policy-extracts.json`, and `workflow-states.json` matching the structures sketched in the design doc; if shapes differ, type definitions will adapt before downstream services are written (per the risk register).
- The 10 hand-authored cases in the fixture are sufficient for the demo; synthetic case generation is a stretch task only if rehearsal shows the table looking thin.
- The applicant-facing experience is named in the value proposition for completeness but is not part of MVP scope; the data model already supports adding it later.
- "Government caseworker" workflows are treated as substantively similar across benefits, licensing, and compliance domains for the purposes of this MVP; per-domain UX divergence is out of scope.
- The user accessing either route is implicitly authorised; the MVP has no authentication layer because no real backend exists.
- The `assigned_to` field on each case is the name of an individual caseworker; team-level grouping is not modelled in MVP and is not required for the team-leader persona's primary journey (filtering by individual caseworker within her team is sufficient).
- Tests cover the four derivation scenarios listed in the constitution; UI correctness is verified by visual inspection plus the 14:45 rehearsal, not by automated tests.
- The frozen reference date used by derivations is chosen so that the seeded fixture surfaces a representative mix of received / outstanding / overdue evidence states; if the fixture lands with dates that don't exercise the demo path, the reference date is the lever to adjust (not the fixture).
- Total caseload size for the hackathon will not exceed the 50-row soft cap; the seeded fixture is 10, the stretch synthetic-cases task (A8) targets ~30 if invoked. If a future iteration needs to handle hundreds of rows, pagination or virtualisation are added as a separate re-scoping decision.

## Clarifications

### Session 2026-04-16

- Q: Should derivations compute against `new Date()` (live) or against a frozen "demo date" baked into the build? → A: Frozen — a single reference date constant ("today" for derivation purposes) is set at build time and used everywhere derivations need a "now"; identical between rehearsal and judging.
- Q: How should risk score behave when a workflow state has no `escalation_threshold` (e.g., "approved", "decided", "closed")? → A: Skip the case-age contribution entirely; other factors (overdue evidence, recency-since-update) still contribute as normal. No fallback threshold, no special-case zeroing of the score.
- Q: How should the caseload "team" filter resolve, given `assigned_to` is an individual caseworker name? → A: Relabel the filter "Assigned to" and operate at individual-caseworker level; no fixture change, no derived team grouping. The "team leader" framing in the value proposition stays unchanged because the leader's filter unit is the person.
- Q: What level of keyboard accessibility does the caseload table commit to? → A: Minimum-viable. Rows are link-semantic (Tab walks every row, Enter follows). Filters and sort headers tab in DOM order. No WAI-ARIA grid pattern, no arrow-key list navigation, no aria-sort plumbing.
- Q: How does the caseload table handle volume beyond the seeded 10 rows? → A: Render every row up to a documented soft cap of 50 with a sticky table header and ordinary browser scroll. No pagination, no virtualisation. Any fixture larger than 50 rows is out of scope for MVP and is a re-scoping conversation.
- Q: How should the action-segments idea from `src/challenge-3/plan.txt` integrate with the existing flat risk-sorted caseload? → A: Add a "Group by segment" toggle. Default remains flat risk-descending; toggle ON groups cases into five fixed segments (Escalated → Pending Decision → Under Review → Awaiting Evidence → Case Created) with risk-descending sort within each. Empty segments stay visible as `(0)` headers; statuses not mapping to any segment fall into an appended "Other" segment.
- Q: How should plan.txt's per-task page navigation idea be honoured given the constitution's "two routes only" constraint? → A: Add a third stub route `/case/:caseId/action/:actionId` rendering a "Mock action page" panel (action label, case reference, severity, back link). Read-only, no state mutation. Each next-action on the case detail links to it. The constitution is amended to "three routes" (1.1.0).
- Q: How strictly should the "no caseworker can hide overdue cases" guardrail from plan.txt be enforced? → A: Soft. Filters keep AND-semantics; when active filters would hide overdue cases, an amber banner reads "X overdue cases hidden by current filter — Show". Activating Show clears only the obscuring filters. No pinned-row exception, no hard rule that overdue rows always render.
- Q: Where does the "5 seconds × millions of decisions" framing from plan.txt live? → A: README only. The spec already conveys per-story value; pitch copy goes in the scored README milestone alongside the demo script and does not become a spec-level requirement.
