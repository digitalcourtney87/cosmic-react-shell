# cosmic-react-shell Development Guidelines

Last updated: 2026-04-16

## Active Technologies

- **Language**: TypeScript 5.8 (strict), Node ≥ 18 for tooling
- **Frontend**: React 18.3, React Router DOM 6.30, Vite 5.4, Tailwind 3.4, shadcn-ui (Radix primitives), `lucide-react` icons
- **Data**: Static JSON fixtures only (`src/challenge-3/*.json`). The assistant reads `EnrichedCase[]` from `services/cases.ts`; it writes nothing.
- **External calls**: GOV.UK Content API (live, read-only) for guidance on the case detail page; Supabase Edge Function `priority-insight` (which proxies one call per render to OpenAI `gpt-4o-mini`) for the AI Strategy Assistant sentence. No OpenAI SDK — the edge function uses `fetch`. The OpenAI key stays server-side.

## Shipped features

- **001-case-compass** — Caseload overview, case detail, action stub. Three routes; frozen reference date `2026-04-16`; GDS-flavoured tokens; derivations pure over fixtures.
- **002-ai-strategy-assistant** — AI Strategy Assistant sidebar + WorkloadHeatmap embedded in `/`. No new routes. Deterministic priority-case selection; LLM paraphrase-only; deterministic fallback on any failure.

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

See `.specify/memory/constitution.md` (current version 1.2.0). Spec-kit artefacts under `specs/001-case-compass/` and `specs/002-ai-strategy-assistant/` augment but do not supersede `docs/plans/2026-04-16-case-compass-design.md`.

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
