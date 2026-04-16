# cosmic-react-shell Development Guidelines

Last updated: 2026-04-16

## Active Technologies

- **Language**: TypeScript 5.8 (strict), Node ≥ 18 for tooling
- **Frontend**: React 18.3, React Router DOM 6.30, Vite 5.4, Tailwind 3.4, shadcn-ui (Radix primitives), `lucide-react` icons
- **Data**: Static JSON fixtures only (`src/challenge-3/*.json`). The assistant reads `EnrichedCase[]` from `services/cases.ts`; it writes nothing.
- **External calls**: GOV.UK Content API (live, read-only) for guidance on the case detail page; three direct OpenAI `gpt-4o-mini` calls from the browser using `VITE_OPENAI_API_KEY` (hackathon mode — rotate the key after the event). The calls are wrapped by `src/services/openai.ts` and invoked from `getPriorityInsight` (AI Strategy Assistant on `/`), `getEvidenceAdvice` (action page) and `sendCaseChatMessage` (case chat panel). No OpenAI SDK — `openai.ts` uses `fetch`.

## Shipped features

- **001-case-compass** — Caseload overview, case detail, action stub. Three routes; frozen reference date `2026-04-16`; GDS-flavoured tokens; derivations pure over fixtures.
- **002-ai-strategy-assistant** — AI Strategy Assistant sidebar + WorkloadHeatmap embedded in `/`. No new routes. Deterministic priority-case selection; LLM paraphrase-only via direct OpenAI call wrapped by `src/services/openai.ts`; deterministic fallback on any failure.
- **003-case-action-pages** — Action pages replacing ActionStub. Route `/case/:caseId/action/:actionId`. Four sections: case context header, action panel, policy excerpts accordion, evidence + AI advice grid. Scoped evidence selection; direct OpenAI call wrapped by `src/services/openai.ts`; deterministic fallback with 5 typed failure reasons.
- **004-case-chat-assistant** — Per-case LLM chat panel rendered above the Timeline on `/case/:caseId`. Structured case context built client-side via `buildCaseContext`; conversation persisted to `sessionStorage` per `case_id`; 20-turn cap; 20s `AbortController` timeout; direct OpenAI `gpt-4o-mini` call wrapped by `src/services/openai.ts`, with the system prompt now living in `src/services/caseChat.ts` (bans invented identifiers, letter drafting, and workflow recommendations).

## Commands

```bash
bun install
bun dev           # http://localhost:8080
bun run test      # vitest (NOT `bun test` — bun's native runner lacks vi.unstubAllGlobals)
bun run lint
bun run build
```

## Code style

TypeScript 5.8 strict. No global state library. YAGNI over architecture (Constitution §IV). Derive, don't store (Constitution §II, NON-NEGOTIABLE). Never call `new Date()` from `src/services/` or `src/lib/` — read `REFERENCE_DATE` from `src/lib/constants.ts`.

## Governance

See `.specify/memory/constitution.md` (current version 1.2.0). Spec-kit artefacts under `specs/001-case-compass/` and `specs/002-ai-strategy-assistant/`, plus plan docs under `docs/plans/` (case-compass design, case actions pages, case chat assistant), augment but do not supersede `docs/plans/2026-04-16-case-compass-design.md`.

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
