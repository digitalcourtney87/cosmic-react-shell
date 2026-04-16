# Phase 0: Research

**Feature**: Case Compass | **Date**: 2026-04-16

The spec carries zero `[NEEDS CLARIFICATION]` markers (resolved across two `/speckit-clarify` sessions on 2026-04-16). Research below documents the load-bearing decisions the team must not relitigate during the build.

---

## 1. Frozen reference date for derivations

**Decision**: A single date constant in `src/lib/date.ts` named `REFERENCE_DATE` is the source of "today" for every derivation. Every call site reads from this constant; nothing in `src/services/` or `src/lib/` calls `new Date()`, `Date.now()`, or any equivalent.

**Rationale**: FR-020a and SC-005 both depend on the demo behaving identically at the 14:45 rehearsal and the 15:30 judging window. A live clock would cause evidence statuses, risk levels, and "X days outstanding" copy to drift between rehearsal and judging, which is the single cheapest way to embarrass the team. A frozen reference date also makes the four vitest tests deterministic without faking time.

**Alternatives considered**:

- **`new Date()` everywhere** — rejected. Drift between rehearsal and judging breaks SC-005.
- **Vitest time-mocking + live `new Date()` in production** — rejected. Two truths is one too many; the fixture's evidence dates are tuned to a specific "today" anyway.
- **Build-time injection via Vite `define`** — over-engineered for one constant. Plain export of a `Date` literal is enough.

**Implementation note**: pick the constant *after* the fixture is in hand so the seeded cases produce a representative mix of received / outstanding / overdue. The reference date is the lever; the fixture is not (per spec §Assumptions).

---

## 2. Derive-don't-store discipline

**Decision**: `EvidenceItem`, `RiskScore`, and `Action` are computed at read time inside Stream A's service functions. They are not persisted to fixtures, not cached in module scope, not memoised across page loads. Component-level `useMemo` is acceptable for sort/filter on the caseload table; cross-render caching of derivations is not.

**Rationale**: Constitution principle II (NON-NEGOTIABLE). The pitch line *"the system cross-referenced timeline against policy requirements"* only lands if the cross-reference is real — pre-baking it into fixtures hollows out the demo. Recomputation cost is trivial: 10 cases × 7 derivations is sub-millisecond.

**Alternatives considered**:

- **Pre-compute in fixtures** — rejected, principle II violation.
- **Memoise per case in a module-scope `Map`** — rejected. Adds invalidation surface area for zero perceptible win at this scale.

---

## 3. GDS-flavoured Tailwind, not GDS-compliant

**Decision**: Add `gds.*` colour tokens to `tailwind.config.ts` (`black #0b0c0c`, `yellow #ffdd00`, `blue #1d70b8`, `green #00703c`, `amber #f47738`, `red #d4351c`, `midgrey #505a5f`, `lightgrey #f3f2f1`). Inter from Google Fonts. 3px solid `gds.yellow` focus ring rule in `index.css` applied to every interactive element.

**Rationale**: Constitution principle III. Buys recognisable government visual identity for a half-day budget. The `govuk-frontend` npm package brings its own build pipeline, ships GDS Transport (licence-restricted), and would cost a stream-day to integrate.

**Excluded explicitly**:

- `govuk-frontend` package — do not install.
- GDS Transport font — licence-restricted, would also bloat bundle.
- The 5px GDS spacing grid — Tailwind defaults stand. Don't port the grid.

---

## 4. Four-test discipline

**Decision**: Exactly four vitest tests in `src/test/services.test.ts`, all reading real records from `src/challenge-3/cases.json`:

1. `deriveEvidenceStatus` — fixture case where all evidence is received → all rows `'received'`.
2. `deriveEvidenceStatus` — fixture case requested 60 days ago against 56-day threshold → `'overdue'`.
3. `calculateRiskScore` — fixture case past escalation threshold + ≥ 1 overdue item → `level: 'critical'`.
4. `getRequiredNextActions` — fixture case with overdue evidence → contains `'Issue reminder'` action with `severity: 'critical'`.

**Rationale**: Constitution principle VI. These four tests cover the silent-derivation-drift failure mode, which is the most demo-breaking class of bug. Anything else (component tests, snapshots, Playwright) costs setup time that competes with the rehearsal at 14:45.

**Forbidden**: synthetic test fixtures, component tests, snapshot tests, Playwright/Cypress.

---

## 5. Parallel-stream unblocking via `mock.ts`

**Decision**: Stream A's first deliverable is `src/services/mock.ts` — a file exporting the same function signatures as the eventual `src/services/cases.ts`, returning hardcoded data for one case. Streams B/C/D import from `mock.ts` until A ships `cases.ts`; the swap is a single import-line change in each consumer.

**Rationale**: Constitution principle V. A hackathon is a fixed-time game; serial dependencies between streams would convert four developers into one. A 30-minute pre-task that costs Stream A almost nothing buys Streams B/C/D a 90-minute head start each.

**Alternatives considered**:

- **B/C/D wait for A** — rejected, principle V violation.
- **B/C/D each invent their own stubs** — rejected. Three diverging stubs and three integration moments instead of one.

---

## 6. Pragmatic-fallback evidence matching

**Decision**: Stream A's `deriveEvidenceStatus` ships the *whole-event matching* heuristic first (treat each `evidence_requested` event as requesting all open requirements; mark a requirement received if its name appears in any subsequent `evidence_received` note). Per-requirement text matching is a refinement attempted only if the whole-event version is shipped and L1 is green.

**Rationale**: FR-025 explicitly permits this fallback. Per-requirement text matching against free-text policy bodies and timeline notes is the riskiest derivation in the build (acknowledged in design doc §Risks). Shipping the simpler version first keeps Stream A unblocked for B/C and protects the demo.

---

## 7. Three-route architecture

**Decision**: `react-router-dom` v6 with three routes:

- `/` → `CaseloadOverview.tsx` (Stream C)
- `/case/:caseId` → `CaseDetail.tsx` (Stream B)
- `/case/:caseId/action/:actionId` → `ActionStub.tsx` (Stream B; FR-026; read-only stub)

A 404 catch-all renders the same "not found" pattern as FR-019.

**Rationale**: Constitution v1.1.0 (amended from v1.0.0's "two routes only"). The action stub honours plan.txt's per-task page-navigation idea without breaching the no-writes rule — the page renders a placeholder, mutates nothing.

**Alternatives considered**:

- **Two routes + tooltip on action items** — rejected. Loses the visible deep-link demo cue.
- **Two routes + modal** — rejected. Modals don't honour the "deep link" framing the pitch leans on.

---

## 8. Group-by-segment derivation

**Decision**: A pure mapping in `src/lib/segments.ts`: `(case) => Segment` where `Segment` is one of `'Escalated' | 'Pending Decision' | 'Under Review' | 'Awaiting Evidence' | 'Case Created' | 'Other'`. Mapping keys off the case's `status` (and `case_type` where status names overlap across types). Cases whose status doesn't map fall into `'Other'` per the FR-005a edge case.

**Rationale**: FR-005a. A pure mapping is the smallest derivation that gives Stream C a one-call lookup and keeps the segment-rendering loop simple. No state, no fixture changes, no `case_type`-specific UI branching.

**Alternatives considered**:

- **Hard-code segments per case in the fixture** — rejected, principle II violation.
- **Segment as a derived enum on `Case` itself** — rejected. Inflates Stream A's frozen `Case` type for one consumer (Stream C). Putting the helper in `src/lib/segments.ts` keeps the type contract clean.
