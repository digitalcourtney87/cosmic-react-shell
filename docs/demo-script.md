# Case Compass — Demo Script

**Audience**: Hackathon judges. Walked at 14:45 rehearsal and 15:30 judging.
**Duration**: ~2 minutes spoken, ~5 clicks.
**Pre-flight**: `bun dev` is running on `http://localhost:8080`. Browser is open at `/`. Cookies/localStorage cleared so the user looks like a first-time judge.

---

## Beat 1 — The hook (15 seconds)

> "Every UK government caseworker loses about five seconds reconstructing context every time they open a case. Multiply that across a caseload, a team, a department — that's millions of decisions, billions of seconds, lost to tab-switching. Case Compass closes the gap on a single screen."

Open `/`. Pause for the table to render.

## Beat 2 — Triage (20 seconds)

Point at the four summary tiles (total, awaiting evidence, overdue, average age).

> "Priya, the team leader, opens the dashboard at 9 AM. She sees ten cases sorted risk-descending. Jordan Smith — top of the list, red badge, 10 out of 10."

Hover the risk badge. The HoverCard tooltip should show the contributing factors.

> "She doesn't have to dig — the system tells her *why* it's critical: past escalation threshold, five overdue evidence items, recency since last update."

## Beat 3 — Drill in (30 seconds)

Click the row for `CASE-2026-00042`.

> "She lands on Jordan's case detail. One screen. Top-left: applicant, reference, the case is 96 days old. Top-right: the same risk badge, with the same factor breakdown."

Scan down the timeline column.

> "Timeline on the left — the case was opened on 2026-01-10, evidence requested 2026-01-15, nothing since."

Move to the right column.

> "Workflow state and required next actions on the right. The system surfaces 'Issue reminder' as the critical action, ordered above the warnings — derived from the workflow state machine *and* the overdue evidence count, not hardcoded."

Hover the Evidence Tracker.

> "Five rows in the evidence tracker. Every one says outstanding or overdue. Each shows the source policy ID and the days elapsed against the threshold — 91 days against a 56-day threshold for the income statement."

Scroll to Applicable Policy.

> "And the policy panel below shows the actual policy text the requirements were parsed from. The cross-reference is live, not pre-baked."

## Beat 4 — Take action (15 seconds)

Click the "Issue reminder" action button.

> "Click any next action — land on a stub page with the specific GOV.UK pages a caseworker would need to navigate to actually issue that reminder. Read-only — no state mutation, this is a hackathon prototype, not a write-enabled tool."

Click the back link.

## Beat 5 — Round trip (15 seconds)

Back on case detail. Click the "All cases" breadcrumb in the case header (or the header wordmark).

> "Back to the dashboard. Same data, same sort order, same risk scores — every derivation is a pure function of the fixture inputs against a frozen reference date. The numbers you saw at 14:45 rehearsal will be the numbers you see now. That's why we trust the system enough to act on it."

## Pitch close (15 seconds)

> "One screen, every signal derived from authoritative inputs, no tab-switching, no reconstruction work. The five seconds × millions framing isn't a slogan — it's the calculation that justifies the build."

---

## Failure recovery

| Symptom | Recovery |
|--------|----------|
| Top row is not `CASE-2026-00042` | Click the "Risk" header once — re-sorts risk-descending |
| GOV.UK guidance panel shows error | Acknowledge it as a live API call; it does not block the demo path |
| Browser console shows red errors | Note the case ID + page; complete demo, fix after |
| Action stub link 404s | The action ID may have changed; click any other action — the stub is route-driven, not action-specific |

## Hard rules from the constitution

- No code changes between rehearsal (14:45) and judging (15:30). SC-005.
- No live writes. Anything that looks like persistence is a bug to flag.
- The reference date is `2026-04-16`. Don't override it during the demo.
