<!--
Sync Impact Report
Version change: 1.1.0 → 1.2.0
Bump rationale: MINOR — amends the first Hackathon Constraints bullet to permit exactly one live LLM call, scoped to the AI Strategy Assistant sidebar's human-readable priority-insight sentence (feature 002, FR-119). No core principle removed or redefined; the "no write operations", "no authentication", and "no real backend" rules are retained verbatim. "Static JSON fixtures only" is refined to make the fixtures-as-source-of-truth role explicit and to clarify the LLM call introduces no new data source — it only paraphrases fixture-derived inputs.
Modified sections:
  - Hackathon Constraints — first bullet rewritten to permit one scoped LLM call with deterministic fallback and deterministic selection guarantees; the fixtures-only clause reworded to "fixtures are the only source of truth for case/policy/workflow data".
Templates requiring updates:
  - ✅ specs/002-ai-strategy-assistant/plan.md — Complexity Tracking row updated: the former violation is now explicitly permitted by v1.2.0.
  - ✅ specs/002-ai-strategy-assistant/spec.md — FR-119 / FR-119a / FR-119b / FR-119c already encode the required guarantees; no edit needed.
  - ✅ specs/001-case-compass/ — unaffected by the amendment; no edit needed.
  - ✅ .specify/templates/* — no template references the changed bullet; reviewed, no edits needed.
Deferred TODOs: none.

Sync Impact Report (previous)
Version change: 1.0.0 → 1.1.0
Bump rationale: MINOR — adds a third route (`/case/:caseId/action/:actionId`) to honour plan.txt's per-task page-navigation idea via a read-only stub. No principle removed or redefined; "no write operations" rule is unchanged and explicitly reinforced on the new route.
Modified sections:
  - Hackathon Constraints — "Two routes only" bullet expanded to three routes; the third route is read-only.
Templates requiring updates:
  - ✅ specs/001-case-compass/spec.md — FR-026 added for the stub route; FR-017a added for action links; clarifications-session entry recorded.
  - ✅ .specify/templates/* — no edits needed (route count is not referenced).

Sync Impact Report (previous)
Version change: (initial) → 1.0.0
Bump rationale: First ratification — no prior version to compare against. MAJOR is appropriate for the initial publish.
Modified principles: n/a (initial draft)
Added sections:
  - Core Principles (I–VII)
  - Hackathon Constraints
  - Development Workflow
  - Governance
Removed sections: none
Templates requiring updates:
  - ✅ .specify/templates/plan-template.md — no Constitution Check tokens reference principles by name; reviewed, no edits needed.
  - ✅ .specify/templates/spec-template.md — no constraints contradict the constitution; reviewed, no edits needed.
  - ✅ .specify/templates/tasks-template.md — task categorisation already aligns; reviewed, no edits needed.
  - ⚠ docs/plans/2026-04-16-case-compass-design.md — pre-dates this constitution; locked decisions already encoded inline. No updates required.
  - ⚠ README.md — minimal scaffold README; not yet a runtime guidance doc, so no edits needed today.
Deferred TODOs: none.
-->

# Case Compass Constitution

Case Compass is a hackathon decision-support tool for government caseworkers, built for Challenge 3 at the V1 AI Engineering Lab Hackathon (London, April 2026). This constitution encodes the locked engineering and product decisions that bound the build. Its job is to keep an under-pressure team from wasting time relitigating decisions that were settled during scoping.

## Core Principles

### I. Hybrid-Spec Discipline (NON-NEGOTIABLE)

Product framing and build spec live in a single artifact. Features MUST NOT be split into separate documents unless a stakeholder explicitly needs to consume one without the other. The single source of truth for the build is `docs/plans/2026-04-16-case-compass-design.md`; spec-kit artefacts under `specs/` augment but do not supersede it.

Rationale: a five-person team across four streams cannot afford to keep two specs in sync; conflicts during the hackathon would be fatal.

### II. Derive, Don't Store (NON-NEGOTIABLE)

Evidence status, risk score, and required next actions MUST be derived at read time from the canonical inputs (`cases.json` timeline, `policy-extracts.json` body, `workflow-states.json` state machine). They MUST NOT be persisted as fields on `Case` or written back to fixtures. The derivation pipeline is the engineering differentiator the judges will be shown.

Rationale: the demo line *"the system cross-referenced timeline against policy requirements"* only lands if the cross-reference is real; pre-baking it into fixtures hollows out the pitch.

### III. GDS-Flavoured, Not GDS-Compliant

Visual identity uses Tailwind token overrides (`gds.black #0b0c0c`, `gds.yellow #ffdd00`, `gds.blue #1d70b8`, `gds.green #00703c`, `gds.amber #f47738`, `gds.red #d4351c`, `gds.midgrey #505a5f`, `gds.lightgrey #f3f2f1`), Inter from Google Fonts, and a 3px solid `gds.yellow` focus ring on every interactive element. The `govuk-frontend` npm package and GDS Transport font MUST NOT be added to the project. The 5px GDS spacing grid is NOT ported — Tailwind defaults stand.

Rationale: enough credibility to be recognisably governmental; none of the licence, build-tool, or pixel-perfection cost that would eat the day.

### IV. YAGNI Over Architecture

No global state library (no Redux, Zustand, or React Query). Fixtures load synchronously at import time. No service-layer abstractions, hooks, or contexts beyond what a specific layer's acceptance criteria require. Three similar lines is preferred over a premature abstraction. No backwards-compatibility shims, feature flags, or scaffolding for hypothetical future needs.

Rationale: the code we don't write doesn't have bugs and doesn't slow rehearsal; abstractions added "just in case" become cleanup tax with the demo clock running.

### V. Parallel-Stream Unblocking

A `src/services/mock.ts` file that mirrors the Stream A service signatures — returning hardcoded data for one case — MUST exist before any UI work begins. Streams B and C MUST import from `mock.ts` until Stream A's real implementation lands; the swap MUST be a one-line import change. No stream may block another by virtue of work order.

Rationale: a hackathon is a fixed-time game; serial dependencies between streams convert four developers into one.

### VI. Tests Where They Earn Their Keep

Unit tests (vitest) cover Stream A's derivation logic only — exactly four fixture-driven tests, all sourced from real records in `cases.json`:
1. `deriveEvidenceStatus` — all received → all `'received'`.
2. `deriveEvidenceStatus` — requested 60 days ago, 56-day threshold → `'overdue'`.
3. `calculateRiskScore` — past escalation threshold + ≥1 overdue item → `level: 'critical'`.
4. `getRequiredNextActions` — overdue evidence → `'Issue reminder'` action with `severity: 'critical'`.

UI streams MUST rely on visual inspection plus the 14:45 rehearsal. No component tests, no Playwright, no snapshots. Synthetic test fixtures are forbidden — every test reads from `cases.json`.

Rationale: tests are insurance against the one thing most likely to demo-break (silent derivation drift); paying for them anywhere else is a deficit at hackathon scale.

### VII. Stretch Behind a Fence

All work flagged stretch — Layer 5 mocked AI summary, synthetic-cases generation, the bottleneck summary on the caseload page, and the case switcher — MUST live in the design doc's stretch annex and MUST NOT be started before the 14:30 checkpoint confirms Layers 1–4 are green and demoable. If a teammate is blocked early, they help another stream's must-ship before reaching for the annex.

Rationale: stretch work that crowds out core polish is the most common reason hackathon demos look unfinished; the fence is what protects the deliverable.

## Hackathon Constraints

These constraints are scoped to the April 2026 hackathon and do not bind future iterations:

- No authentication and no real backend. The fixtures (`cases.json`, `policy-extracts.json`, `workflow-states.json`) are the only source of truth for case, policy, and workflow data. Exactly ONE live LLM call is permitted — scoped to the AI Strategy Assistant sidebar's human-readable priority-insight sentence (feature 002, FR-119). The call paraphrases inputs that are already derived from the fixtures; it MUST NOT introduce a new data source, and the model's output MUST NOT be persisted. The selection of which case is the priority and which action the CTA links to remains fully deterministic (FR-119a) — the LLM does not influence navigation targets. When the API key is absent, or the call fails, times out, or returns a malformed response (FR-119b, FR-119c), the panel MUST degrade to a deterministic fallback sentence; the deterministic parts of the UI (triage counts and CTA) never depend on the call succeeding. No other feature, route, or surface may introduce an additional LLM call without a further constitution amendment.
- No write operations: no "mark as reminded", no note editing, no status changes from the UI. The permitted LLM request is read-only and does not relax this rule.
- Three routes: `/` (caseload overview), `/case/:caseId` (case detail), and `/case/:caseId/action/:actionId` (mock action stub — read-only, no state mutation). The "no write operations" rule above applies in full to all three routes; the action stub renders a placeholder, it does not persist or mutate anything.
- Applicant-facing view is named in the value proposition but explicitly out of MVP scope; data model already supports it.
- Case fixtures: 10 hand-written cases. Synthetic generation lives in the stretch annex (A8) and is only invoked if 10 cases look thin in rehearsal.
- README.md MUST be committed by 10:00 BST — it is a scored milestone for judging.

## Development Workflow

- Streams A (Data & Services), B (Case Detail), C (Caseload Overview), and D (Shell & Routing) work in parallel from the 09:45 scaffold checkpoint. Stream E owns README + integration QA.
- Layer milestones: L1 demoable by 11:00, L2 by 12:30, L3 + L4 complete by 14:30, rehearsal at 14:45, judges at 15:30.
- Type contracts in `src/types/case.ts` and the Service API in `src/services/cases.ts` are FROZEN at the values listed in the design doc Section 2; changes require all four stream owners' agreement.
- Risk-register-driven mitigations apply: if evidence derivation proves harder than expected, ship the pragmatic-fallback heuristic (whole-event matching) before refining per-requirement parsing.
- Spec-kit artefacts under `.specify/` and `specs/` augment the brainstorming doc; they MUST NOT contradict it. When they diverge, the brainstorming doc wins until amended through the governance procedure below.

## Governance

This constitution supersedes ad-hoc decisions made during the hackathon. Amendments require:

1. Documenting the change in a Sync Impact Report at the top of this file (HTML comment).
2. Bumping `Version` per semantic versioning:
   - **MAJOR**: removal or backward-incompatible redefinition of a principle.
   - **MINOR**: addition of a principle or materially expanded section.
   - **PATCH**: clarifications, wording, typography fixes.
3. Validation that dependent templates under `.specify/templates/` and the brainstorming doc remain consistent with the change.
4. Sign-off from the team lead (Courtney) before merging.

Reviews occur (a) after each layer milestone if any pivot was discussed, and (b) at the 14:30 checkpoint before stretch work begins. Compliance is verified by reading the design doc against this constitution; any drift is treated as a defect.

**Version**: 1.2.0 | **Ratified**: 2026-04-16 | **Last Amended**: 2026-04-16
