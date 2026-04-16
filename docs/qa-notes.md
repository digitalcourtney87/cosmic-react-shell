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
