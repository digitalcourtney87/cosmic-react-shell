# Quickstart: AI Strategy Assistant (Stream F)

**Feature**: 002-ai-strategy-assistant · **Phase**: 1 · **Date**: 2026-04-16

This is the run-book for the developer implementing Stream F. If you are not Stream F, skip this file.

---

## Prerequisites

- Feature `001-case-compass` merged to `main`. Stream A's `src/services/cases.ts` exposes `getAllEnrichedCases()`, `policies`, and `pageIndex`. Stream C's `CaseloadOverview.tsx` exists and maintains filter state.
- Node ≥ 18, repo bootstrapped (`npm install` already run).
- An OpenAI API key with billing cap ≤ $5 (per `research.md §4`).

---

## One-time setup

1. Create `.env.local` at the repo root (gitignored; do NOT commit):
   ```bash
   VITE_OPENAI_API_KEY=sk-proj-...   # your key
   ```
2. Confirm `.env.local` is in `.gitignore` before you add the file.
3. Set a hard usage cap on the OpenAI account dashboard: $5/month. Non-negotiable — a single bad loop during dev can burn budget fast.

**Security note:** the `VITE_` prefix causes Vite to inline the key into the built bundle. This is acceptable for a single controlled demo laptop (see `research.md §4`) and is NOT safe for public deployment. If this code ever leaves the hackathon context, replace the in-browser call with a server-side proxy before shipping.

---

## Build order (Stream F, ~3 hours)

All files are new unless noted; the one modified file is `CaseloadOverview.tsx` (Stream C), which gets a one-line mount.

| Step | File | What to build | Expected duration |
|------|------|---------------|-------------------|
| F1 | `src/types/case.ts` | Add `TriageCounts`, `PriorityInsightInputs`, `PriorityInsightResult`, `FallbackReason`, `HeatmapTile` per `data-model.md`. | 15 min |
| F2 | `src/services/ai.ts` | Implement `computeTriageCounts`, `selectPriorityCase`, `composeFallback`, `buildHeatmapTiles`, `getPriorityInsight` per `contracts/ai-service.md`. `fetch`-based, `AbortController`-driven, 5s timeout, substring validation of the response body. | 60 min |
| F3 | `src/test/assistant.test.ts` | Write the three vitest tests per `research.md §8`. Run `npm test` — all three pass, existing four still pass. Tests must stub `fetch`; no live calls. | 30 min |
| F4 | `src/components/ai/TriageSummary.tsx` | Red/Amber/Green counts with `gds.*` tokens. Pure presentational. | 15 min |
| F5 | `src/components/ai/PriorityInsight.tsx` | `useEffect` keyed on `inputs.caseRef` (null-guard when inputs is null). Skeleton → llm / fallback render states. CTA renders from `inputs.actionHref`; disabled when null (FR-107a). | 40 min |
| F6 | `src/components/ai/AIStrategyAssistant.tsx` | Sidebar container: header, collapse button (`aria-expanded`/`aria-controls`), `useMemo(selectPriorityCase)`, mounts `<TriageSummary />` + `<PriorityInsight />`. | 20 min |
| F7 | `src/components/caseload/CaseloadOverview.tsx` (Stream C file) | One-line insertion: `<AIStrategyAssistant filtered={filteredCases} />` in the grid slot Stream C reserved. Coordinate the diff with Stream C owner. | 10 min |
| F8 *(stretch)* | `src/components/ai/WorkloadHeatmap.tsx` + mount in `CaseloadOverview.tsx` | Heatmap grid per `research.md §7`. Only attempt if F1–F7 are green by 13:30. | 30 min |

**14:30 checkpoint (Constitution §VII):** If F1–F7 are not demoable at 14:30, drop F8, freeze the branch, and move to integration QA. No exceptions.

---

## Manual verification (no automated UI tests — Constitution §VI)

Open the app at `http://localhost:5173/`:

1. With a valid `VITE_OPENAI_API_KEY`:
   - Red/Amber/Green counts match the caseload table risk badges.
   - Priority insight references a real case reference and (when applicable) a real policy identifier. Output is 2–3 sentences.
   - CTA label matches the recommended action from Stream A's `nextActions[0]`. Clicking navigates to `/case/:caseId/action/:actionId`.
2. With `VITE_OPENAI_API_KEY` deleted (or set to empty):
   - Triage counts still render.
   - Priority insight renders the deterministic fallback sentence — naming the case, policy (when non-null), and action.
   - CTA still clickable; navigation still works.
3. With network offline (DevTools → Offline):
   - Same as (2), but fallback reason is `network-error` (visible only in dev tools — user sees the same fallback sentence).
4. Change filters (Stream C):
   - Triage counts update in lockstep with the filtered case count (FR-109).
   - If the priority case changes, the insight bubble shows the skeleton briefly, then the new LLM sentence for the new case.
5. Filter to an empty set:
   - Empty-state message renders; no CTA; no outbound API call.
6. Collapse/expand the sidebar:
   - Table reclaims width; no layout shift.

---

## Tests

```bash
npm test
```

Expect 4 (existing Stream A) + 3 (new Stream F) = **7 passing tests**. No component tests. If anything under `src/components/` ends up in a test file, you have left the Constitution §VI lane.

---

## Rollback

Stream F is fully isolated. To cut the feature entirely:

1. Revert the `<AIStrategyAssistant />` and `<WorkloadHeatmap />` mounts from `CaseloadOverview.tsx`.
2. Delete `src/components/ai/`, `src/services/ai.ts`, `src/lib/priority.ts` (if split out), and `src/test/assistant.test.ts`.
3. Remove the `TriageCounts`, `PriorityInsightInputs`, `PriorityInsightResult`, `FallbackReason`, `HeatmapTile` types from `src/types/case.ts`.

No other file is touched by this feature. No fixture changes, no route changes, no router changes.

---

## Constitution amendment (process step, before merge)

This feature requires amending `constitution.md` from v1.1.0 → v1.2.0 (MINOR: expands the Hackathon Constraints bullet on LLM calls). The amendment is logged in `plan.md#Complexity-Tracking`. Stream F drafts; lead (Courtney) signs off per §Governance. Do NOT merge the feature before the amendment lands.
