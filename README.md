# Case Compass

A decision-support tool for UK government caseworkers and team leaders. Synthesises a case's timeline, applicable policy, workflow state, and derived evidence + risk signals into one actionable view — replacing the multi-tab reconstruction work that currently dominates a caseworker's day.

> **Five seconds × millions of decisions.** Every UK government caseworker loses around five seconds reconstructing context every time they open a case. Multiply by a caseload, by a team, by a department, and the cost is enormous. Case Compass closes the gap on a single screen.

Built for Challenge 3 at the V1 AI Engineering Lab Hackathon, London, April 2026.

## Table of contents

- [The problem](#the-problem)
- [The solution](#the-solution)
- [Demo journey](#demo-journey)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [AI Strategy Assistant — setup](#ai-strategy-assistant--setup)
- [Tests and build](#tests-and-build)
- [Project layout](#project-layout)
- [How it works](#how-it-works)
- [Scope boundaries](#scope-boundaries)
- [Documentation](#documentation)
- [Acknowledgements](#acknowledgements)

## The problem

A caseworker opens a case. To decide what to do next, she clicks between:

- a **case management system** for timeline and status,
- a **policy intranet** for the relevant extract,
- a **workflow tool** for "am I blocked, and by what?", and
- **her own notes** to remember what she already chased.

Nothing tells her how overdue the case is *right now*, whether the evidence on file meets the policy, or which action is next. A team leader has the same problem, multiplied by a couple of hundred cases.

## The solution

One screen per case. Every derived signal comes from the same inputs a caseworker would read manually — timeline events, policy text, workflow state machine — so the derivations are trustworthy, not magical.

| Route | What it shows |
|-------|---------------|
| `/` | Caseload overview — sortable, filterable table; summary tiles; a "Group by segment" toggle (Escalated → Pending Decision → Under Review → Awaiting Evidence → Case Created); an above-the-fold **WorkloadHeatmap** with one risk-coloured tile per case; an **AI Strategy Assistant** sidebar that names the morning's priority case and links straight to the recommended action. |
| `/case/:caseId` | Case detail — applicant header with risk badge, timeline, policy accordion, evidence tracker (received / outstanding / overdue), workflow state + required next actions, live GOV.UK guidance from the Content API. A **Case Chat Assistant** panel sits above the timeline so a caseworker can ask natural-language questions grounded in that one case's record. |
| `/case/:caseId/action/:actionId` | Action page — read-only action view with a case context header, action panel, policy excerpts accordion, and an evidence table paired with AI-drafted evidence advice. No state mutation. |

Everything is derived. Nothing is stored. Reload the page, get the same answer. The AI assistant's *selection* of which case is the priority is fully deterministic; only the human-readable sentence is paraphrased by an LLM, with a deterministic fallback when the API is unavailable.

## Demo journey

1. Open `/`. The heatmap fills the top of the screen, the AI Strategy Assistant sidebar shows Red/Amber/Green triage counts, and the priority insight names a specific case (with the seeded fixture, `CASE-2026-00042` — Jordan Smith) along with a CTA that links straight to the recommended action.
2. Below the heatmap, the caseload table renders 10 cases sorted risk-descending.
3. Click the assistant CTA, the matching heatmap tile, or the top table row — all three lead to `/case/CASE-2026-00042`.
4. Read the synthesised view: applicant + status pill, timeline showing the 2026-01-15 evidence request, the policy panel with its 56-day reminder threshold, the Evidence Tracker listing the overdue requirements, the critical "Issue reminder" action at the top of Required Next Actions.
5. Click "Issue reminder" — land on `/case/CASE-2026-00042/action/issue-reminder`. The stub names the GOV.UK pages a caseworker would normally navigate to. Nothing is persisted.
6. Click the back link, then the breadcrumb, to return to `/`.

A scripted walkthrough with spoken beats and failure-recovery is in [`docs/demo-script.md`](docs/demo-script.md).

## Tech stack

- **TypeScript 5.8** (strict mode) on **Node ≥ 18**
- **React 18.3** + **Vite 5.4** + **React Router DOM 6.30**
- **Tailwind CSS 3.4** with GDS-flavoured colour tokens
- **shadcn-ui** (Radix primitives) for Accordion, Card, HoverCard, Tooltip
- **lucide-react** for icons
- **Vitest 3** for unit tests
- **OpenAI `gpt-4o-mini`** called directly from the browser (hackathon mode — `VITE_OPENAI_API_KEY` is inlined at build time and rotated after the event) for the AI Strategy Assistant's priority insight, the action page's evidence advice, and the Case Chat Assistant replies

No global state library. No backend — every LLM call goes browser → OpenAI via the `src/services/openai.ts` helper. Fixtures load synchronously at import time.

## Getting started

### Prerequisites

- Node ≥ 18 (or Bun ≥ 1.0)
- A modern browser

### Install and run

```bash
git clone https://github.com/digitalcourtney87/cosmic-react-shell.git
cd cosmic-react-shell
bun install        # or: npm install
bun dev            # or: npm run dev
```

The dev server starts on `http://localhost:8080`. The app ships with ten hand-authored cases under `src/challenge-3/`. Every derivation runs on page load against a frozen reference date (`2026-04-16`), so the demo is reproducible.

### Environment variables (optional)

The AI Strategy Assistant, action-page evidence advice, and Case Chat Assistant all work without configuration — each falls back to a deterministic response when no key is present. To enable the live LLM-paraphrased outputs:

```bash
# .env.local at the repo root (gitignored)
VITE_OPENAI_API_KEY=sk-...   # OpenAI API key (hackathon demo only — rotate after)
```

This is the only client-side value. **Hackathon mode:** the key is inlined into the browser bundle by Vite at build time, so anyone with the deployed JS can read it. Rotate the key immediately after the event and apply a low usage cap on the OpenAI dashboard.

## AI Strategy Assistant — setup

The sidebar's priority-insight sentence is generated by `gpt-4o-mini` via a direct browser → OpenAI call wrapped by `src/services/openai.ts`. In hackathon mode the OpenAI key is inlined into the browser bundle at build time via `VITE_OPENAI_API_KEY` — convenient for the demo, not safe for production. Rotate the key after the event.

### Deployment (hackathon mode)

1. Set `VITE_OPENAI_API_KEY` in `.env.local` for local dev, or in your hosting provider's environment for production. The same key is reused by all three LLM features (priority insight, evidence advice, case chat).
2. Set a low usage cap on the OpenAI account dashboard.
3. Rotate the key as soon as the demo is over — it is visible to anyone who downloads the deployed JavaScript bundle.

### What happens at render time

1. The frontend computes the priority case deterministically (highest risk level → highest score → lowest case-ID tiebreak) from the visible (filtered) caseload.
2. It POSTs the chosen case's reference, applicant, risk factors, applicable policy, and recommended action label directly to `https://api.openai.com/v1/chat/completions` via the `src/services/openai.ts` helper.
3. The helper calls OpenAI with `temperature: 0.2`, `max_tokens: 120`, and a system prompt that forbids fabricating identifiers.
4. If the call times out (>8s for priority insight, >10s for evidence advice, >20s for case chat), the network rejects, OpenAI returns non-2xx, or the response is empty/malformed, the panel renders a deterministic fallback sentence composed from the same inputs. (Case chat throws instead of falling back; the UI shows an error bubble with a Retry button.)

The CTA target route is computed entirely client-side from the deterministic selection, so the navigation path is identical regardless of LLM availability.

## Tests and build

```bash
bun run test       # vitest — services, assistant, action page, case chat, components
bun run lint       # eslint
bun run build      # vite production build
bun run preview    # serve the production build locally
```

Tests cover the derivations most likely to silently drift and the LLM-call boundaries:

- `deriveEvidenceStatus` — all received → every item is `'received'`
- `deriveEvidenceStatus` — requested past 56-day threshold → at least one item is `'overdue'`
- `calculateRiskScore` — past escalation threshold + overdue evidence → level `'critical'`
- `getRequiredNextActions` — overdue evidence → at least one action with severity `'critical'`
- AI Strategy Assistant — deterministic case selection across filter combinations
- AI Strategy Assistant — triage counts match the visible caseload
- AI Strategy Assistant — deterministic fallback when the network is stubbed to fail
- Action page — scoped evidence selection and evidence-advice fallback with typed failure reasons
- Case Chat — `buildCaseContext` shape + `sendCaseChatMessage` success, error, timeout, and missing-`VITE_OPENAI_API_KEY` fallback paths
- Case Chat component — send flow, chips, persistence to `sessionStorage`, turn cap, inline error retry

UI correctness beyond the component-test surface is verified by visual inspection, by design.

> **Important:** use `bun run test`, not `bun test`. The latter invokes Bun's native test runner, which lacks `vi.unstubAllGlobals` and other vitest-mocking APIs the assistant tests rely on.

## Project layout

```text
cosmic-react-shell/
├── src/
│   ├── challenge-3/                      Canonical fixtures (cases, policies, workflow, page-index)
│   ├── components/
│   │   ├── action/                       Action page panels (context header, evidence table, policy excerpts, AI advice)
│   │   ├── ai/                           AI Strategy Assistant, WorkloadHeatmap, PriorityInsight, TriageSummary, CaseChat
│   │   ├── caseload/                     Caseload table, filters, summary stats, overdue banner
│   │   ├── shared/                       RiskBadge (coloured risk pill with HoverCard)
│   │   ├── ui/                           shadcn-ui primitives
│   │   ├── AppShell.tsx                  Sticky header, layout
│   │   ├── Header.tsx                    GDS-flavoured site header
│   │   └── NavLink.tsx                   Shared nav link component
│   ├── lib/
│   │   ├── action.ts                     Action-page helpers (scoped evidence selection, policy excerpts)
│   │   ├── constants.ts                  REFERENCE_DATE, segment ordering, segment labels
│   │   ├── date.ts                       daysBetween helper
│   │   ├── derive.ts                     The derivation pipeline
│   │   └── segments.ts                   getSegment(case) mapping
│   ├── pages/
│   │   ├── CaseloadOverview.tsx          /
│   │   ├── CaseDetail.tsx                /case/:caseId (hosts CaseChat above timeline)
│   │   ├── ActionPage.tsx                /case/:caseId/action/:actionId
│   │   └── NotFound.tsx                  404
│   ├── services/
│   │   ├── cases.ts                      Service surface over fixtures + enrichment
│   │   ├── ai.ts                         Triage counts, priority selection, getPriorityInsight + getEvidenceAdvice (direct OpenAI calls)
│   │   ├── caseChat.ts                   buildCaseContext + sendCaseChatMessage (direct OpenAI call) + system prompt
│   │   ├── openai.ts                     Shared fetch wrapper for browser → OpenAI chat-completions
│   │   └── govuk.ts                      Live fetch from gov.uk/api/search.json
│   ├── test/
│   │   ├── services.test.ts              Derivation tests
│   │   ├── assistant.test.ts             AI Strategy Assistant selection + fallback tests
│   │   ├── action-page.test.ts           Action-page scoping + evidence-advice tests
│   │   ├── caseChat.test.ts              buildCaseContext + sendCaseChatMessage tests
│   │   └── components/
│   │       ├── CaseChat.test.tsx         CaseChat component tests
│   │       └── RiskBadge.test.tsx
│   └── types/case.ts                     Frozen type contracts (EnrichedCase, StructuredCaseContext, ChatMessage, …)
├── docs/
│   ├── demo-script.md                    Walkthrough with spoken beats
│   ├── qa-notes.md                       Integration QA log
│   └── plans/                            Design docs (case-compass, case actions pages, case chat assistant)
├── specs/
│   ├── 001-case-compass/                 Spec-kit for the core app
│   └── 002-ai-strategy-assistant/        Spec-kit for the AI sidebar + heatmap
├── .specify/
│   └── memory/constitution.md            Locked decisions; current version 1.2.0
└── README.md
```

## How it works

### Derive, don't store

Evidence status, risk score, and required next actions are pure functions of `(case, policies, workflow state)`. They are never persisted. This is enforced by convention and by the test suite — any drift between the inputs a human would consult and the outputs the UI shows is a bug.

The pipeline lives in [`src/lib/derive.ts`](src/lib/derive.ts) and is called from [`src/services/cases.ts`](src/services/cases.ts) via an `enrichCase()` function that produces an `EnrichedCase` for the UI to render.

### Frozen reference date

All date arithmetic uses `REFERENCE_DATE` (a constant in [`src/lib/constants.ts`](src/lib/constants.ts)) instead of `new Date()`. This means evidence-overdue counts, case ages, and risk scores are reproducible across every page load — and identical between rehearsal and judging at a hackathon, or between a developer machine and CI.

### Three routes, no writes

The app exposes three React Router routes only. There is no write endpoint, no persistence, no toast that implies state mutation. The AI Strategy Assistant and WorkloadHeatmap are panels embedded on `/`, the Case Chat Assistant is a panel on `/case/:caseId`, and the action page's AI advice is a panel on `/case/:caseId/action/:actionId` — no new routes for any of them. The chat's conversation history is kept in `sessionStorage` per case and cleared when the tab closes.

### Determinism with one paraphrased sentence

The AI Strategy Assistant separates *selection* from *presentation*. The case to feature, the policy ID to call out, and the action to link to are all computed client-side from deterministic rules. Only the human-readable sentence is sent to the LLM, and the response is validated for the required identifiers before display. If validation fails, a deterministic sentence is composed from the same inputs.

This is the architecture that lets the project meet its consistency requirement (same inputs → same demo output, every time) while still using a live model.

### GDS-flavoured, not GDS-compliant

Visual identity uses Tailwind token overrides for the GDS palette (black, yellow, blue, green, amber, red, midgrey, lightgrey), Inter from Google Fonts, and a 3px solid yellow focus ring on every interactive element. The official `govuk-frontend` package and GDS Transport font are intentionally not used — the goal is recognisable governmental styling without the licence and tooling cost.

## Scope boundaries

This is a hackathon prototype. To keep the boundaries explicit:

- No authentication. Fixtures are the only source of truth for case, policy, and workflow data.
- No write operations. Action pages are read-only; every LLM call is read-only.
- LLM usage is scoped: one call per render of `/` (priority insight), one per render of an action page (evidence advice), and one per user turn in the case chat panel. All three are direct browser → OpenAI calls (hackathon mode) with deterministic fallbacks.
- The applicant-facing view is named in the value proposition but not implemented in MVP.
- Soft cap of 50 rows on the caseload table. No pagination, no virtualisation.

## Documentation

| Document | What's there |
|----------|--------------|
| [`docs/demo-script.md`](docs/demo-script.md) | Spoken-beat walkthrough of the demo journey, with failure-recovery notes |
| [`docs/qa-notes.md`](docs/qa-notes.md) | Integration QA log — what was verified vs what still needs a real-browser pass |
| [`docs/plans/2026-04-16-case-compass-design.md`](docs/plans/2026-04-16-case-compass-design.md) | The brainstorming doc that is the single source of truth |
| [`docs/plans/2026-04-16-case-actions-pages-design.md`](docs/plans/2026-04-16-case-actions-pages-design.md) | Design doc for the action-page feature (003) |
| [`docs/plans/2026-04-16-case-chat-assistant-design.md`](docs/plans/2026-04-16-case-chat-assistant-design.md) | Design doc for the Case Chat Assistant (004) |
| [`docs/plans/2026-04-16-case-chat-assistant-plan.md`](docs/plans/2026-04-16-case-chat-assistant-plan.md) | Implementation plan for the Case Chat Assistant (004) |
| [`specs/001-case-compass/`](specs/001-case-compass/) | Spec-kit for the core app — spec, plan, contracts, quickstart |
| [`specs/002-ai-strategy-assistant/`](specs/002-ai-strategy-assistant/) | Spec-kit for the AI sidebar + heatmap (FR-101 → FR-121) |
| [`.specify/memory/constitution.md`](.specify/memory/constitution.md) | Locked engineering and product decisions; current version 1.2.0 |

## Acknowledgements

Authored 2026-04-16 for Challenge 3, V1 AI Engineering Lab Hackathon. Built using GitHub Spec Kit (`/specify`), Lovable for the initial scaffold, and Claude Code for implementation. Fixtures (cases, policies, workflow states) are hand-authored and intentionally synthetic — they do not represent any real claimant, applicant, or case.
