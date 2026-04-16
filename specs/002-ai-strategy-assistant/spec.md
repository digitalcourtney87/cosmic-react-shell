# Feature Specification: AI Strategy Assistant

**Feature Branch**: `002-ai-strategy-assistant`
**Created**: 2026-04-16
**Status**: Draft
**Input**: User description: "AI Strategy Assistant — an LLM-powered sidebar component for Case Compass that performs morning triage of the caseworker's cases (grouping into Red/Amber/Green using existing risk and evidence derivations from Stream A), surfaces a priority insight about the most urgent case (e.g. cases breaching policy thresholds like the 56-day escalation rule in POL-BR-003), and offers inline actions like 'Draft Escalation Notice'. Must integrate with existing data services and live alongside the Stream C Caseload Overview. Stretch: also includes a WorkloadHeatmap component visualising all cases simultaneously at the top of the Caseload Overview."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Caseworker gets a morning briefing without reading every row (Priority: P1)

Sam, a benefits caseworker, opens the caseload overview at the start of her shift. Before she reads a single row, the AI Strategy Assistant panel in the sidebar tells her: "You have N critical, N warning, N on-track cases this morning. Priority: CASE-XXXX has breached the 56-day escalation threshold in POL-BR-003 — you need to act today." A single prominent button offers the next step ("Draft Escalation Notice"). Sam knows where to start before she has scanned the table.

**Why this priority**: This is the LLM stretch-goal's headline value. Without the morning-briefing insight, the sidebar is just decoration over the same data the table already shows. The triage → priority-insight → one-click-action flow is the only reason to add an assistant at all.

**Independent Test**: Load `/`. Verify the sidebar renders with (a) coloured counts for Red/Amber/Green, (b) a named insight that references a real case reference and a real policy identifier from the fixture, and (c) a button whose label matches the insight (e.g., "Draft Escalation Notice" when the insight is about an overdue escalation). A first-time user can answer "what should I do first this morning?" in under 30 seconds without touching the table.

**Acceptance Scenarios**:

1. **Given** the seeded (or stretch-expanded) caseload and the frozen reference date, **When** Sam opens `/`, **Then** the assistant sidebar renders Red/Amber/Green counts that sum to the total case count and match the case counts in each risk level (critical / warning / normal) as computed by the existing risk-score derivation.
2. **Given** at least one case in the caseload has breached its workflow escalation threshold, **When** the assistant renders, **Then** the priority insight names that case by reference, names the applicable policy by identifier, and the primary CTA reflects the recommended action for that case (e.g., "Draft Escalation Notice").
3. **Given** Sam clicks the primary CTA, **When** the click is handled, **Then** she is taken to the corresponding mock action stub (`/case/:caseId/action/:actionId`) for the insight's case and action, using the existing action-stub route.
4. **Given** the caseload filter state on `/` changes (FR-005, FR-005a), **When** the filtered caseload updates, **Then** the assistant's triage counts update in lockstep to reflect the currently filtered set, not the unfiltered total.

---

### User Story 2 — Team leader sees her caseload shape at a glance via the heatmap (Priority: P2)

Priya, a team leader, opens `/`. Above the caseload table sits a workload heatmap — one small tile per case, coloured by risk level, grouped so the criticals cluster together. Without scrolling, she can see the shape of her day: whether it's five reds on top of thirty greens, or a long amber tail. She hovers any tile to see which case it is and clicks through to that case's detail.

**Why this priority**: The heatmap gives the leader persona a dense, above-the-fold picture of the entire caseload. It does not replace the table (FR-001–FR-007) — it complements it by answering "how bad is today?" in one glance. Lower priority than the assistant itself because the table already supports triage; this is about density and visual impact for the demo.

**Independent Test**: Load `/`. Verify a grid of tiles renders above the table with exactly one tile per case in the current filtered caseload, coloured by risk level. Hover any tile shows the case reference and applicant name; click any tile navigates to that case's detail view.

**Acceptance Scenarios**:

1. **Given** the caseload fixture, **When** Priya opens `/`, **Then** the heatmap renders one tile per case with colour matching the case's risk level (critical/warning/normal), arranged so criticals are visually prominent (e.g., grouped or ordered first).
2. **Given** Priya hovers a tile, **When** the tooltip appears, **Then** it shows the case reference, applicant name, and risk level.
3. **Given** Priya clicks a tile, **When** the click is handled, **Then** she is navigated to `/case/:caseId` for that tile's case (same target as FR-007 on the table row).
4. **Given** caseload filters are applied on the overview, **When** filters change, **Then** the heatmap re-renders in lockstep — tiles belonging to filtered-out cases disappear, so the heatmap and table always show the same set.

---

### User Story 3 — Caseworker can trust and dismiss the assistant without it blocking her work (Priority: P3)

Sam does not want the assistant to get in the way. She can collapse or hide the sidebar when she wants more room for the table, and when a priority insight no longer applies (e.g., she has acted on it, so the case is no longer the riskiest), she expects the insight to refresh to the next item on re-render — not stay pinned stale.

**Why this priority**: Trust and control over AI output matter. Without a way to dismiss or collapse, the assistant competes with the table for space; without responsive re-derivation, stale insights erode trust after one or two uses. Lower than P1/P2 because the MVP demo path (User Story 1) does not depend on collapsing behaviour.

**Independent Test**: Load `/`. Click the collapse/hide control; verify the caseload table expands to fill the freed space. Re-open the sidebar; verify the priority insight reflects the current riskiest case given current filters.

**Acceptance Scenarios**:

1. **Given** the assistant sidebar is visible, **When** Sam activates the collapse control, **Then** the sidebar collapses (or hides) and the caseload table reclaims the freed horizontal space without layout shift or scroll position jump.
2. **Given** the assistant has re-rendered after a filter change or navigation return, **When** the priority insight is computed, **Then** it references the currently-highest-priority case among the currently-visible cases, never a case that is no longer in the filtered set.
3. **Given** the caseload contains no critical cases (all green/amber), **When** the assistant renders, **Then** the priority insight shows an on-track state (e.g., "No escalations today — your highest-priority case is X") and the CTA reflects the top amber action rather than fabricating a critical one.

---

### Edge Cases

- **No cases at all** (filtered set empty or fixture empty): assistant renders an empty-state briefing ("No cases match current filters") and the heatmap renders an empty-state tile grid with a short message; neither component throws or renders a stale insight from a previous state.
- **No critical cases**: assistant priority insight falls back to the highest-risk amber case with a recommended amber action (e.g., "Issue 28-day reminder"); it MUST NOT fabricate a fake critical insight to make the UI feel urgent.
- **Multiple cases tied for top priority** (e.g., two both past escalation threshold by the same margin): assistant picks deterministically (e.g., by case reference ascending) so the same fixture always produces the same insight between rehearsal and judging (ties into FR-020a frozen reference date).
- **Insight references an action id not in the page-index fixture**: CTA renders but is disabled with a visible "No action page available" tooltip, rather than linking to a broken stub route.
- **Caseload has cases but none have any workflow escalation threshold defined** (all terminal states): assistant priority insight falls back to the highest-risk case by overdue-evidence count or recency-since-update, consistent with FR-018a, and does not claim a "past escalation threshold" factor.
- **Heatmap has many cases** (approaching the 50-row soft cap per FR-001): tiles resize or wrap so the grid still fits above the fold on a 1440px-wide viewport without requiring horizontal scroll.
- **Keyboard-only user**: the assistant's primary CTA and collapse control are reachable by Tab in source order and activatable by Enter/Space (consistent with FR-021); the heatmap tiles are reachable by Tab and activatable by Enter (same navigation result as click).
- **Assistant response generation fails or times out** (if a real LLM call is used — see Clarifications): the panel falls back to a deterministic scripted insight using the same derivation rules, so the demo path always renders a valid insight.

## Requirements *(mandatory)*

### Functional Requirements

**AI Strategy Assistant sidebar (embedded in route `/`):**

- **FR-101**: The caseload overview page MUST render an AI Strategy Assistant panel as a right-hand sidebar alongside the existing table (and alongside the heatmap, when present), without removing or shrinking any element required by FR-001–FR-007 below the viewport fold on a 1440×900 reference viewport.
- **FR-102**: The assistant panel MUST display, at the top, a triage summary with three coloured counts labelled Critical (red), Warning (amber), and On Track (green). Counts MUST be computed from the currently-visible caseload (after FR-005/FR-005a filters), using the same risk-level levels produced by the existing risk-score derivation.
- **FR-103**: The assistant panel MUST display a single "priority insight" beneath the triage summary, referencing exactly one case from the currently-visible caseload.
- **FR-104**: The priority insight MUST be chosen deterministically from the visible caseload: highest risk level first, then highest numeric risk score, with ties broken by case reference ascending. The same fixture under the same filters MUST produce the same insight every render.
- **FR-105**: The priority insight text MUST name the selected case by its reference (e.g., `CASE-2026-00042`), and — when the underlying risk factor is a policy-threshold breach — MUST name the applicable policy identifier (e.g., `POL-BR-003`) and the threshold (e.g., "56-day escalation").
- **FR-106**: Beneath the priority insight, the panel MUST render a single primary CTA button whose label corresponds to the recommended next action for that case (drawn from the existing required-next-actions derivation per FR-016/FR-017).
- **FR-107**: Clicking the primary CTA MUST navigate to `/case/:caseId/action/:actionId` for the selected case and action, using the same action stub route introduced in FR-017a/FR-026. No state mutation (consistent with FR-026).
- **FR-107a**: If the selected next action has no corresponding entry in the page-index fixture, the CTA MUST render in a disabled state with a visible tooltip explaining no action page is available; it MUST NOT link to a broken route.
- **FR-108**: When the visible caseload contains zero cases, the assistant panel MUST render a short empty-state message ("No cases match current filters") and no CTA; when it contains zero critical cases, the insight MUST fall back to the highest-risk amber case; when it contains zero cases with any risk at all, the insight MUST fall back to an on-track state message.
- **FR-109**: The assistant panel MUST re-render whenever the caseload's filter state changes on the overview page, so that triage counts and priority insight reflect the currently-visible set. Derivations MUST NOT be cached across filter changes, consistent with FR-020.
- **FR-110**: The assistant panel MUST offer a visible collapse/expand control. When collapsed, the caseload table (and heatmap, when present) MUST reclaim the freed horizontal space. The collapse state is in-memory only — it MUST NOT persist across page reloads (MVP scope).
- **FR-111**: All text in the assistant panel MUST be derived from the same frozen reference date used elsewhere in the system (FR-020a). The assistant MUST NOT render language that implies real-time awareness (e.g., no "just now", no "this morning based on your local time").
- **FR-112**: The assistant panel and its controls (CTA, collapse control) MUST meet the same accessibility baseline as the rest of the overview: reachable by Tab in source order, activatable by Enter/Space, with visible focus indicators (FR-021).

**Workload heatmap (embedded in route `/`, stretch scope):**

- **FR-113**: When the heatmap is enabled, the caseload overview page MUST render a heatmap grid above the caseload table and above the summary tiles, with exactly one tile per currently-visible case.
- **FR-114**: Each heatmap tile MUST be coloured by the case's risk level (critical=red, warning=amber, normal=green) using the project's existing GDS colour tokens, and tiles MUST be ordered so that critical tiles appear first (e.g., in reading order, top-left first).
- **FR-115**: Each heatmap tile MUST expose the case reference, applicant name, and risk level via a tooltip/aria-label, and MUST navigate to `/case/:caseId` on click, matching FR-007.
- **FR-116**: Heatmap tiles MUST be reachable by Tab navigation in source order and activatable by Enter, consistent with FR-007a / FR-021.
- **FR-117**: The heatmap MUST re-render in lockstep with the caseload filter state (FR-109), so the heatmap and the table always represent the same set of cases.
- **FR-118**: At the 50-row soft cap defined by FR-001, the heatmap grid MUST fit above the fold on a 1440×900 reference viewport without requiring horizontal scroll; tile size scales as needed.

**Response generation:**

- **FR-119**: The assistant's priority-insight text MUST be generated by a live call to a third-party LLM API at render time. The prompt sent to the model MUST be composed from the deterministic inputs selected per FR-104 (the chosen case's reference, risk level, top contributing risk factors, applicable policy identifier, and recommended next action label). The same fixture + filter state MUST produce model output that a judge reading it would see as substantively identical (same case named, same policy named, same recommended action named) between the 14:45 rehearsal and the 15:30 judging window (SC-005 continues to apply); exact wording MAY vary.
- **FR-119a**: The selection of *which* case is the priority (FR-104) and *which* action the CTA links to (FR-106 / FR-107) MUST remain deterministic (computed from fixtures); only the human-readable insight text is produced by the LLM. This keeps the demo-critical navigation path byte-identical between rehearsal and judging even if the model output varies.
- **FR-119b**: The LLM API key MUST be supplied via environment variable at build time (not committed to source). When no key is configured, the assistant MUST render an empty-state message ("LLM assistant not configured") in place of the priority-insight bubble; the triage counts and CTA MUST still render using the deterministic selection from FR-104 / FR-106, so the overview page remains fully functional without the key.
- **FR-119c**: If the LLM API call fails, times out (>5 seconds), or returns a response that omits the case reference, policy identifier, or action label that were supplied in the prompt, the assistant MUST render a concise deterministic fallback sentence composed from the same inputs (e.g., "`<case_ref>` has breached `<policy_id>` — recommended action: `<action_label>`") rather than leave the bubble empty or block the page.

**Cross-cutting:**

- **FR-120**: The assistant and heatmap MUST render without console errors on the seeded caseload, consistent with FR-022.
- **FR-121**: The assistant and heatmap MUST NOT introduce new routes; they are embedded panels on the existing overview route.

### Key Entities *(include if feature involves data)*

- **Triage Bucket (derived)**: A count of cases at a given risk level (critical / warning / normal) within the currently-visible caseload. Three buckets per render.
- **Priority Insight (derived)**: A single selection from the visible caseload carrying: the chosen case reference, the headline risk factor (e.g., "past 56-day escalation threshold in POL-BR-003"), the applicable policy identifier (when the factor is policy-driven), and the recommended next action (label + action id).
- **Assistant View State**: In-memory UI state for whether the sidebar is collapsed or expanded. Not persisted.
- **Heatmap Tile (derived)**: One tile per currently-visible case, carrying: case reference, applicant name, risk level (for colour), and target route (`/case/:caseId`).

No new persisted data is introduced; all derivations are pure functions of existing fixtures and existing derivation primitives (Stream A).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-101**: A first-time user can answer "what should I do first this morning?" within 30 seconds of opening the caseload overview, using only the assistant sidebar and no table interaction.
- **SC-102**: For every seeded case the assistant might select as priority, the insight names the correct case reference, correct applicable policy identifier (when relevant), and recommended next action as verified by manually tracing risk level → risk score → workflow state → policy body → page-index action.
- **SC-103**: Under the same fixture and the same filter state, the assistant selects the same case, same applicable policy, and same recommended next action on every render (including after navigation to a case and back), and produces insight text that names the same case, same policy, and same action between the 14:45 rehearsal and the 15:30 judging window — consistent with SC-005. Exact wording of the insight sentence MAY differ between renders because the text is produced by a live LLM call (FR-119).
- **SC-104**: When caseload filters change on the overview, the assistant's triage counts and priority insight update within one render tick and the heatmap (if enabled) re-renders its tile set in the same tick — no stale counts visible to the user.
- **SC-105**: The assistant sidebar and heatmap (when enabled) add no visible layout shift, no console errors, and no regressions to the User Story 2 caseload-overview journey from the `001-case-compass` spec (SC-002, SC-005).
- **SC-106**: A judge unfamiliar with the project, given a 30-second introduction, can point at the Red/Amber/Green triage counts and correctly describe what they mean; and can identify the case named in the priority insight in the table below.

## Assumptions

- The existing risk-score derivation, evidence-status derivation, and required-next-actions derivation from Stream A are sufficient inputs; no new derivation primitives need to be added for the assistant or heatmap. The assistant is a presentation layer over existing Stream A outputs.
- The caseload fixture size for the hackathon is whatever Stream A ships — seeded 10, with stretch A8 adding synthetic cases up to the 50-row soft cap per FR-001. The assistant's triage-counts UI is designed for up to 50 cases; beyond that is out of scope, same rescoping trigger as the caseload table itself.
- The assistant renders on the caseload overview (`/`) only. Embedding the assistant on the case detail view (`/case/:caseId`) is an explicit non-goal for MVP; if the Stream B / case detail team wants an assistant variant, it is a separate spec.
- The primary CTA's target route is the existing `/case/:caseId/action/:actionId` stub; the assistant does not introduce any new action stub shape or any action whose label does not already appear in Stream A's required-next-actions output. If the recommended action for a case has no page-index entry, the CTA is disabled (FR-107a) rather than inventing a route.
- "Morning triage" language in the UI is a framing device and does not imply real-time awareness; all derivations use the frozen reference date (FR-020a / FR-111).
- The WorkloadHeatmap (User Story 2 / FR-113–FR-118) is explicitly stretch scope. If rehearsal shows the overview layout is already dense enough, the heatmap is cut and the assistant alone delivers the MVP — User Story 1 is independently testable and independently demonstrable.
- No authentication, no persistence, no server-side state. Consistent with `001-case-compass` Assumptions.
- Tests cover the deterministic-selection rule (FR-104), the empty-state fallbacks (FR-108), the filter-lockstep rule (FR-109 / FR-117), and the LLM fallback rule (FR-119c) — the last one with the network stubbed to fail, since tests cannot depend on a live API. UI correctness verified visually per the `001-case-compass` testing convention.
- The LLM provider, model, and prompt wording are implementation decisions deferred to the plan phase; the spec only requires that the call is live, that deterministic selection drives the navigation target, and that the three failure modes (no key / call fails / malformed response) each render a usable UI.
- The `001-case-compass` spec's route count ("three routes") is NOT changed by this feature; the assistant and heatmap are panels on an existing route, not new routes.

## Clarifications

### Session 2026-04-16

- Q: How is the assistant's priority-insight text generated — deterministic template, live LLM call, or hybrid? → A: Live LLM call at render time. API key supplied later via environment variable. Selection of the priority case and the recommended action stays deterministic (FR-119a); only the human-readable sentence is model-generated. When the key is absent the triage counts and CTA still render (FR-119b); when the call fails or omits the required identifiers a deterministic fallback sentence is used (FR-119c).
