# Case Compass

> **Five seconds × millions of decisions.** Every UK government caseworker loses that five seconds reconstructing context across tabs. Multiply by a caseload, by a team, by a department, and the cost is enormous. Case Compass closes the gap on one screen.

Decision-support tool for government caseworkers and team leaders. Synthesises a case's timeline, applicable policy, workflow state, and derived evidence + risk signals into a single actionable view — replacing the multi-tab reconstruction that currently dominates a caseworker's day.

Built for Challenge 3 at the V1 AI Engineering Lab Hackathon, April 2026.

## The problem

A caseworker opens a case. To decide what to do next, she clicks between:

- a **case management system** for timeline and status,
- a **policy intranet** for the relevant extract,
- a **workflow tool** for "am I blocked, and by what?", and
- **her own notes** to remember what she already chased.

Nothing tells her how overdue the case is *right now*, whether the evidence on file meets the policy, or which action is next. A team leader has the same problem, multiplied by ~250.

## The solution

One screen per case. Every derived signal comes from the same inputs a caseworker would read manually — timeline events, policy text, workflow state machine — so the derivations are trustworthy, not magical.

- **Caseload overview** (`/`) — sortable, filterable table with summary tiles, risk-coloured rows, and a "Group by segment" toggle that surfaces the five-segment triage frame (Escalated → Pending Decision → Under Review → Awaiting Evidence → Case Created).
- **Case detail** (`/case/:caseId`) — applicant header with risk badge, timeline, policy accordion, evidence tracker (received / outstanding / overdue), workflow state + required next actions, live GOV.UK guidance.
- **Action stub** (`/case/:caseId/action/:actionId`) — read-only "mock action page" with the specific GOV.UK pages a caseworker would need to navigate. No state mutation.

Everything is derived. Nothing is stored. Reload the page, get the same answer.

## Demo journey

This is the path the 14:45 rehearsal and the 15:30 judging walk, unchanged, per SC-005:

1. Open `/` — 10 cases render, sorted risk-descending. `CASE-2026-00042` (Jordan Smith) is at the top with a red "Critical 10/10" badge.
2. Click the top row — land on `/case/CASE-2026-00042`.
3. Read the synthesised view: applicant + case type + status pill, timeline showing the 2026-01-15 evidence request, policy `POL-INC-01` with its 56-day reminder threshold, the Evidence Tracker listing five overdue requirements (payslips, bank statements, tax returns, ID verification, benefit history), the critical "Issue reminder" action at the top of Required Next Actions.
4. Click the "Issue reminder" action — land on `/case/CASE-2026-00042/action/issue-reminder`. The stub names the GOV.UK pages the caseworker would normally navigate to chase this evidence. Nothing is persisted.
5. Click the back link — return to the case detail. Click the breadcrumb — return to `/`.

## Run it

```bash
bun install       # or: npm install
bun dev           # http://localhost:8080
```

The app ships with ten hand-authored cases and no backend. Every derivation runs on page load against a frozen reference date (`2026-04-16`) so the rehearsal and the judging window show the same cases in the same state.

## Tests

```bash
bun test          # vitest — four fixture-driven derivation tests
bun run lint      # eslint
bun run build     # vite production build
```

Tests cover the four derivations most likely to silently drift: evidence status when everything is received, evidence status when a requirement is past the 56-day threshold, critical risk level when case is past escalation + evidence overdue, and "Issue reminder" appearing as a critical next action. UI is verified by visual rehearsal, not by component tests (Constitution, Principle VI).

## How it is built

- **React 18.3 + Vite 5.4 + TypeScript 5.8 (strict)**, Tailwind 3.4 with GDS-flavoured tokens (`gds.black`, `gds.yellow`, `gds.blue`, `gds.green`, `gds.amber`, `gds.red`, `gds.midgrey`, `gds.lightgrey`).
- **shadcn-ui** (Radix primitives) for Accordion, Card, HoverCard, Tooltip.
- **Three routes** via react-router-dom 6.30. No write endpoints.
- **No global state library.** No Redux, no Zustand, no React Query. Fixtures load synchronously at import time.
- **Derive, don't store** — Evidence status, risk score, and next actions are pure functions of (case, policies, workflow state). See `src/lib/derive.ts`.
- **Frozen reference date** — `REFERENCE_DATE = new Date('2026-04-16')` (see `src/lib/constants.ts`). Nothing in `src/lib/` or `src/services/` calls `new Date()` directly for derivations.

## Where to look

| Path | What's there |
|------|-------------|
| `src/challenge-3/*.json` | Canonical fixtures — cases, policy extracts, workflow states, page index |
| `src/services/cases.ts` | Service surface — `getAllEnrichedCases`, `getEnrichedCaseById`, `getPoliciesForCase` |
| `src/lib/derive.ts` | The derivation pipeline — where the pitch lives |
| `src/lib/constants.ts` | `REFERENCE_DATE`, segment ordering, segment labels |
| `src/pages/CaseloadOverview.tsx` | `/` — the triage view |
| `src/pages/CaseDetail.tsx` | `/case/:caseId` — the synthesised case view |
| `src/pages/ActionStub.tsx` | `/case/:caseId/action/:actionId` — the read-only action panel |
| `src/test/services.test.ts` | Four derivation tests |
| `docs/plans/2026-04-16-case-compass-design.md` | The brainstorming doc that is the single source of truth |
| `specs/001-case-compass/` | Spec-kit augmentation — spec, plan, contracts, quickstart |
| `.specify/memory/constitution.md` | Locked decisions; governance |

## Scope boundaries

- No authentication, no real backend. Fixtures are the only source of truth for case, policy, and workflow data.
- Exactly one scoped LLM call — the AI Strategy Assistant sidebar's priority-insight sentence (feature 002, FR-119). Selection of the priority case and the CTA target is fully deterministic; only the human-readable sentence is model-generated. When the key is absent, or the call fails, times out, or returns a malformed response, the panel renders a deterministic fallback sentence so the demo path always works.
- No write operations. The action stub is a placeholder; the OpenAI request is read-only.
- Applicant-facing view is named in the value proposition but out of MVP scope.
- Soft cap of 50 rows on the caseload table. No pagination, no virtualisation.
- Stretch work (synthetic cases, bottleneck summaries, case switcher) lives behind a fence in the stretch annex of the design doc; not started before the 14:30 Layers-1-4 checkpoint.

## AI Strategy Assistant — API key handling (hackathon-only)

The sidebar calls the OpenAI Chat Completions API at render time using `gpt-4o-mini`. Supply your key in `.env.local` (gitignored) at the repo root:

```bash
VITE_OPENAI_API_KEY=sk-proj-...
```

Set a hard $5 usage cap on the OpenAI account dashboard before running the demo.

**Security caveat:** the `VITE_` prefix causes Vite to inline the key into the built bundle at build time. This is appropriate for a single controlled demo laptop only and is **NOT safe for public deployment**. If this code ever leaves the hackathon context, replace the in-browser call with a server-side proxy before shipping. See `specs/002-ai-strategy-assistant/research.md §4` for the full trade-off analysis.

## Credits

Authored 2026-04-16 for Challenge 3, V1 AI Engineering Lab Hackathon. Design and engineering decisions documented in `docs/plans/2026-04-16-case-compass-design.md` and `.specify/memory/constitution.md`.
