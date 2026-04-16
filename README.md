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

- **Caseload overview** (`/`) — sortable, filterable table with summary tiles, risk-coloured rows, a "Group by segment" toggle that surfaces the five-segment triage frame (Escalated → Pending Decision → Under Review → Awaiting Evidence → Case Created), an above-the-fold **WorkloadHeatmap** showing every visible case as a risk-coloured tile, and an **AI Strategy Assistant** sidebar that names the morning's priority case and links straight to the recommended action.
- **Case detail** (`/case/:caseId`) — applicant header with risk badge, timeline, policy accordion, evidence tracker (received / outstanding / overdue), workflow state + required next actions, live GOV.UK guidance.
- **Action stub** (`/case/:caseId/action/:actionId`) — read-only "mock action page" with the specific GOV.UK pages a caseworker would need to navigate. No state mutation.

Everything is derived. Nothing is stored. Reload the page, get the same answer — and the assistant's selection of a priority case is deterministic; only the human-readable sentence is paraphrased by an LLM (with a deterministic fallback when the key is absent or the call fails).

## Demo journey

This is the path the 14:45 rehearsal and the 15:30 judging walk, unchanged, per SC-005:

1. Open `/` — the WorkloadHeatmap fills the top of the screen, the AI Strategy Assistant sidebar shows Red/Amber/Green triage counts, and the priority insight names `CASE-2026-00042` (Jordan Smith) as the morning's first action — with a CTA that links straight to the "Issue reminder" stub.
2. Below the heatmap, the caseload table renders 10 cases sorted risk-descending. `CASE-2026-00042` is at the top with a red "Critical 10/10" badge.
3. Click the top table row (or the matching heatmap tile) — land on `/case/CASE-2026-00042`.
4. Read the synthesised view: applicant + case type + status pill, timeline showing the 2026-01-15 evidence request, the policy panel with the 56-day reminder threshold, the Evidence Tracker listing the overdue requirements, the critical "Issue reminder" action at the top of Required Next Actions.
5. Click the "Issue reminder" action — land on `/case/CASE-2026-00042/action/issue-reminder`. The stub names the GOV.UK pages the caseworker would normally navigate to chase this evidence. Nothing is persisted.
6. Click the back link — return to the case detail. Click the breadcrumb — return to `/`. The assistant's selection is unchanged because the inputs are unchanged.

## Run it

```bash
bun install       # or: npm install
bun dev           # http://localhost:8080
```

The app ships with ten hand-authored cases and no backend. Every derivation runs on page load against a frozen reference date (`2026-04-16`) so the rehearsal and the judging window show the same cases in the same state.

## Tests

```bash
bun run test      # vitest — 8 tests across services + assistant
bun run lint      # eslint
bun run build     # vite production build
```

Tests cover the derivations most likely to silently drift: evidence status when everything is received, evidence status when a requirement is past the 56-day threshold, critical risk level when case is past escalation + evidence overdue, "Issue reminder" appearing as a critical next action (Stream A), and the AI assistant's deterministic case selection + LLM-fallback behaviour with the network stubbed (Stream F). UI correctness is verified by visual rehearsal, not by component tests (Constitution, Principle VI).

Use `bun run test`, not `bun test`. The latter invokes Bun's native test runner, which lacks `vi.unstubAllGlobals` and other vitest-mocking APIs the assistant tests rely on.

## How it is built

- **React 18.3 + Vite 5.4 + TypeScript 5.8 (strict)**, Tailwind 3.4 with GDS-flavoured tokens (`gds.black`, `gds.yellow`, `gds.blue`, `gds.green`, `gds.amber`, `gds.red`, `gds.midgrey`, `gds.lightgrey`).
- **shadcn-ui** (Radix primitives) for Accordion, Card, HoverCard, Tooltip.
- **Three routes** via react-router-dom 6.30. No write endpoints. The AI Strategy Assistant and WorkloadHeatmap are panels embedded in `/`, not new routes.
- **No global state library.** No Redux, no Zustand, no React Query. Fixtures load synchronously at import time.
- **Derive, don't store** — Evidence status, risk score, and next actions are pure functions of (case, policies, workflow state). See `src/lib/derive.ts`. The assistant's priority-case selection (`src/services/ai.ts`) is also a pure function — only the LLM-paraphrased sentence is non-deterministic.
- **Frozen reference date** — `REFERENCE_DATE = new Date('2026-04-16')` (see `src/lib/constants.ts`). Nothing in `src/lib/` or `src/services/` calls `new Date()` directly for derivations.
- **Exactly one live LLM call**, proxied through a Supabase Edge Function (`supabase/functions/priority-insight`) so the OpenAI key stays server-side. The function calls `gpt-4o-mini` with `temperature: 0.2`, `max_tokens: 180`; the browser enforces a 5-second abort timeout and validates the response for required identifiers — fallback to a deterministic sentence on any failure mode (Constitution v1.2.0).

## Where to look

| Path | What's there |
|------|-------------|
| `src/challenge-3/*.json` | Canonical fixtures — cases, policy extracts, workflow states, page index |
| `src/services/cases.ts` | Service surface — `getAllEnrichedCases`, `getEnrichedCaseById`, `getPoliciesForCase` |
| `src/services/ai.ts` | Triage counts, deterministic priority selection, OpenAI call + fallback (Stream F) |
| `src/services/govuk.ts` | Live fetch of related guidance from `https://www.gov.uk/api/search.json` |
| `src/lib/derive.ts` | The derivation pipeline — where the pitch lives |
| `src/lib/constants.ts` | `REFERENCE_DATE`, segment ordering, segment labels |
| `src/pages/CaseloadOverview.tsx` | `/` — the triage view (heatmap, table, summary tiles, AI sidebar) |
| `src/pages/CaseDetail.tsx` | `/case/:caseId` — the synthesised case view |
| `src/pages/ActionStub.tsx` | `/case/:caseId/action/:actionId` — the read-only action panel |
| `src/components/ai/` | `AIStrategyAssistant`, `TriageSummary`, `PriorityInsight`, `WorkloadHeatmap` |
| `src/test/services.test.ts` | Four Stream A derivation tests |
| `src/test/assistant.test.ts` | Three Stream F tests — selection determinism, triage counts, LLM fallback |
| `docs/demo-script.md` | The 14:45 rehearsal walkthrough |
| `docs/qa-notes.md` | Integration-QA log: what was verified, what still needs a real-browser pass |
| `docs/plans/2026-04-16-case-compass-design.md` | The brainstorming doc that is the single source of truth |
| `specs/001-case-compass/` | Spec-kit augmentation — Case Compass spec, plan, contracts, quickstart |
| `specs/002-ai-strategy-assistant/` | Spec-kit for the AI sidebar + heatmap (FR-101 → FR-121) |
| `.specify/memory/constitution.md` | Locked decisions; governance — current version 1.2.0 |

## Scope boundaries

- No authentication, no real backend. Fixtures are the only source of truth for case, policy, and workflow data.
- Exactly one scoped LLM call — the AI Strategy Assistant sidebar's priority-insight sentence (feature 002, FR-119). Selection of the priority case and the CTA target is fully deterministic; only the human-readable sentence is model-generated. When the key is absent, or the call fails, times out, or returns a malformed response, the panel renders a deterministic fallback sentence so the demo path always works.
- No write operations. The action stub is a placeholder; the OpenAI request is read-only.
- Applicant-facing view is named in the value proposition but out of MVP scope.
- Soft cap of 50 rows on the caseload table. No pagination, no virtualisation.
- Stretch work (synthetic cases, bottleneck summaries, case switcher) lives behind a fence in the stretch annex of the design doc; not started before the 14:30 Layers-1-4 checkpoint.

## AI Strategy Assistant — API key handling

The sidebar's priority-insight sentence is generated by `gpt-4o-mini` via a **Supabase Edge Function** (`supabase/functions/priority-insight/index.ts`). The OpenAI key stays on the server — the browser only talks to the edge function.

### Deployment (Lovable-hosted)

1. In Lovable, **Cloud tab → Secrets**, set `OPENAI_API_KEY` (no `VITE_` prefix — that would inline it into the browser bundle, defeating the whole point).
2. Lovable auto-deploys `supabase/functions/priority-insight/index.ts` as an Edge Function when the file is committed.
3. The frontend reaches the edge function via `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (or `VITE_SUPABASE_PUBLISHABLE_KEY`). Both are public values that Lovable injects automatically when the Supabase integration is wired.

### Local development

Create `.env.local` at the repo root (gitignored):

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

These values are safe to commit only to `.env.local` — the anon key is designed to be public but shouldn't be in git. When either value is missing, or the edge function call fails / times out / returns a malformed response, the sidebar renders a deterministic fallback sentence — the demo path still works without the LLM. Set a $5 usage cap on the OpenAI account dashboard regardless.

## Credits

Authored 2026-04-16 for Challenge 3, V1 AI Engineering Lab Hackathon. Design and engineering decisions documented in `docs/plans/2026-04-16-case-compass-design.md` and `.specify/memory/constitution.md`.
