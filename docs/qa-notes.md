# Stream E — Integration QA Notes

**Run date**: 2026-04-16
**Build**: post-merge of Streams A/B/C/D (commit `fcf0cfb` and later)
**Reference date in derivations**: `2026-04-16`

## Verifications run

| Check | Command | Result |
|-------|---------|--------|
| Tests pass | `bun test` | **5 / 5 pass** (4 derivation + 1 example) |
| Production build | `bun run build` | **OK** — 1628 modules transformed, ~302 kB JS, ~62 kB CSS |
| Dev server boot | `bun dev` | **OK** — ready in 1.4s on port 8080 |
| `/` route serves | `curl localhost:8080/` | 200 |
| `/case/CASE-2026-00042` serves | `curl localhost:8080/case/CASE-2026-00042` | 200 |
| `/case/.../action/issue-reminder` serves | `curl ...` | 200 |
| Top-risk case is CASE-2026-00042 | derivation script | **OK** — score 10/10 critical, 5 overdue evidence items, age 96 days |

## Caveats

These checks are HTTP + module-compile + unit tests. **The browser walkthrough has not been run from this terminal session**; the dev server is up but hasn't been driven through clicks. SC-005 (the demo journey) needs to be walked in a real browser before judging.

## Lint findings (not blocking, inherited from main)

`bun run lint` reports 6 errors + 7 warnings. None are caused by Stream E. Listed for transparency:

| File | Line | Issue |
|------|------|-------|
| `src/components/ui/command.tsx` | 24 | empty interface — shadcn-generated |
| `src/components/ui/textarea.tsx` | 5 | empty interface — shadcn-generated |
| `src/components/ui/badge.tsx`, `button.tsx`, `form.tsx`, `navigation-menu.tsx`, `sidebar.tsx`, `sonner.tsx`, `toggle.tsx` | various | `react-refresh/only-export-components` warnings — shadcn-generated |
| `src/pages/CaseloadOverview.tsx` | 173 | `as any` in `segments.includes(c.status as any)` |
| `src/services/govuk.ts` | 55, 61 | two `any` types in fetch response handling |
| `tailwind.config.ts` | 100 | `require("tailwindcss-animate")` — Vite-generated |

The shadcn warnings are noise from the template scaffold. The two `any`s in `govuk.ts` and the one in `CaseloadOverview.tsx` are real signals worth tightening when the demo clock isn't running, but none affect runtime correctness or the demo path.

## What was NOT tested

- Real-browser click-through of the SC-005 demo journey (caseload → top case → all panels → action stub → back).
- Console-error-free verification on a fresh browser tab.
- Keyboard accessibility (Tab order, Enter activation on rows per FR-007a).
- Yellow focus ring visible on every interactive element (FR-021).
- GOV.UK live-fetch panel behaviour (the panel is wired up but its successful-fetch path is unverified from this session).
- Group-by-segment toggle round-trip and empty-segment rendering (FR-005a).
- Overdue banner appearing and "Show" clearing only obscuring filters (FR-005b).
- Unknown caseId rendering the friendly "Case not found" panel (FR-019).

## Recommendation

Before the 14:45 rehearsal: open `http://localhost:8080`, walk the journey in `docs/demo-script.md`, and update this file with anything that surprises. The fixtures are deterministic against `REFERENCE_DATE = 2026-04-16`, so any visible defect is a real bug, not a flake.

---

# Stream F appendix — AI Strategy Assistant + WorkloadHeatmap

**Run date**: 2026-04-16 (post-Stream F)
**Build**: `fd4dcc9` and later — `Merge branch '002-ai-strategy-assistant' into main`
**Constitution**: bumped to v1.2.0 to permit one scoped LLM call (FR-119)

## Verifications run (post-Stream F)

| Check | Command | Result |
|-------|---------|--------|
| Tests pass (vitest) | `bun run test` | **8 / 8 pass** — 4 services + 3 assistant + 1 example |
| Production build | `bun run build` | **OK** — 1633 modules transformed, ~312 kB JS, ~63 kB CSS |
| Dev server boot | `bun dev` | **OK** — ready in 1.4s on port 8080 |
| `/` route serves | `curl localhost:8080/` | 200 |
| `src/services/ai.ts` compiles via Vite | `curl localhost:8080/src/services/ai.ts` | OK — `import.meta.env` injected |

## Critical pitfall — test runner

`bun test` (Bun's native test runner) reports **3 failures** because it does not implement `vi.unstubAllGlobals` and other vitest-mocking APIs the assistant tests rely on. **Always run `bun run test`** (which invokes vitest via the package.json script). The README has been updated to reflect this.

## What was NOT tested (Stream F-specific)

- Real-browser render of the AI Strategy Assistant sidebar with valid `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` and the edge function returning a valid sentence.
- Real-browser render of the deterministic-fallback path with no Supabase config set.
- Edge function reachability: a `POST` to `${VITE_SUPABASE_URL}/functions/v1/priority-insight` with a sample payload returning HTTP 200 and a `{ text: string }` body.
- Filter-lockstep behaviour: changing a caseload filter and observing the assistant's triage counts + priority insight + heatmap re-render in the same tick (FR-109 / FR-117 / SC-104).
- Collapse / expand control reclaiming horizontal space without layout shift (FR-110 / SC-105).
- Heatmap tile keyboard navigation (Tab walks tiles, Enter follows — FR-116).
- Heatmap tile colour matching the table risk badge for every case (FR-114).
- Visual confirmation that the assistant's selected case matches the deterministic-selection rule across all filter combinations (FR-104).
- Behaviour when `VITE_OPENAI_API_KEY` is set but the OpenAI account has no billing — should fall through `non-2xx` to deterministic fallback (FR-119c).

## Reminders for the demo laptop

- `.env.local` must contain `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` if the LLM-paraphrased sentence is wanted in the demo.
- The OpenAI key lives **server-side** as a Supabase secret named `OPENAI_API_KEY` on the `priority-insight` Edge Function (`supabase/functions/priority-insight/index.ts`). It is never in the browser bundle.
- The Supabase anon key is designed to be public, but should still be in `.env.local` (gitignored) rather than committed.
- Set a hard $5 cap on the OpenAI account dashboard before the demo to bound the blast radius.
- If the edge function is undeployed or the OpenAI secret is unset, the assistant falls through to the deterministic fallback sentence — demo path still works.

## Net status as of this update

- README, demo script, and QA notes are aligned with the post-Stream F codebase.
- All 8 unit tests pass via `bun run test`.
- Production build is clean.
- Browser walkthrough still needed before the 14:45 rehearsal.
