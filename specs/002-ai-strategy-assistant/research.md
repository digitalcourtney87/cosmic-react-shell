# Research: AI Strategy Assistant

**Feature**: 002-ai-strategy-assistant · **Phase**: 0 · **Date**: 2026-04-16

This document resolves every technology choice and every open question in `plan.md#Technical-Context`. Decisions are recorded so Stream F can start implementation without re-litigating.

---

## 1. OpenAI client: SDK vs direct `fetch`

**Decision:** Use the `fetch` API directly against `https://api.openai.com/v1/chat/completions`. Do NOT install `openai` (the official SDK).

**Rationale:**
- The full call surface needed is one endpoint, one request shape. The SDK adds ~120 KB gzipped, a polyfill tree, and configuration surface we don't need.
- Constitution §IV ("YAGNI Over Architecture") explicitly forbids abstractions added "just in case".
- `fetch` + `AbortController` gives us the 5-second timeout required by FR-119c with zero ceremony.
- Switching providers is a single-file edit (`src/services/ai.ts`) — an SDK would make the switch *harder*, not easier, because its types would spread into callers.

**Alternatives considered:**
- `openai` npm package — rejected on bundle size and YAGNI grounds above.
- A generic LLM wrapper (e.g., `vercel/ai`) — rejected: another dependency, and our needs are narrower than what the wrapper's abstraction exists to serve.

---

## 2. Model choice

**Decision:** `gpt-4o-mini`, `temperature: 0.2`, `max_tokens: 180`, `response_format: { type: "text" }`.

**Rationale:**
- `gpt-4o-mini`: cheapest usable OpenAI model as of 2026-04; p50 latency well under the 5-second timeout; quality is sufficient for a 2-to-3-sentence insight paragraph that paraphrases inputs we already hand it.
- `temperature: 0.2`: low enough to make the model reliably reproduce the case reference, policy identifier, and action label verbatim (SC-103 requires same case / policy / action named between rehearsal and judging); high enough to still sound fluent. Zero was considered but increases the chance of degenerate "stuck" outputs on short prompts.
- `max_tokens: 180`: caps a ~3-sentence response; keeps latency and cost predictable. Triage-summary insight does not need paragraphs.
- `response_format: text`: JSON mode was considered for FR-119c validation but rejected — the validation FR-119c needs (does the output name the expected case_ref, policy_id, action_label?) is a substring check against plain text, and JSON mode constrains a model we already find fluent enough.

**Alternatives considered:**
- `gpt-4o` — rejected: ~10× the cost of `mini` for this task, latency occasionally exceeds our 5s timeout, and the quality delta on a paraphrase-the-inputs prompt is not visible to a judge.
- `gpt-3.5-turbo` — rejected: end-of-life notices make it risky to rely on for the 15:30 judging window.
- Anthropic Claude — rejected per user clarification (OpenAI chosen explicitly).

---

## 3. Prompt structure

**Decision:** Two-message chat: a short `system` message establishing persona and constraints, and a `user` message carrying the deterministic inputs as a structured block.

```text
system:
You are a decision-support assistant for a UK government caseworker named Sam.
You will be given the single highest-priority case from her morning caseload,
with its risk factors and the recommended next action. Write a 2-to-3-sentence
briefing that:
  - names the case by its reference,
  - names the applicable policy by its identifier when provided,
  - recommends the named next action as the first thing Sam should do today.
Do not invent case references, policy identifiers, or actions. Do not soften
the recommendation. Be direct. Do not use emoji.

user:
Priority case: {case_ref}
Applicant: {applicant_name}
Risk level: {risk_level}
Top risk factors: {factors_list}
Applicable policy: {policy_id} — {policy_title}   # omitted when N/A
Threshold breached: {threshold_phrase}            # omitted when N/A
Recommended next action: "{action_label}"
```

**Rationale:**
- Naming every artefact we expect in the output in the prompt dramatically raises the probability the model reproduces them verbatim — which is what FR-119a + SC-103 require for demo reproducibility.
- Forbidding invention blocks the most common failure (hallucinated policy numbers).
- Brevity-first wording keeps output short enough for the sidebar bubble.

**Alternatives considered:**
- Few-shot examples in the system prompt — rejected: adds tokens, and the model is strong enough zero-shot on this task.
- JSON-structured response — see §2.

---

## 4. API key handling in the browser

**Decision:** Supply `VITE_OPENAI_API_KEY` at build time via `.env.local`. The key is inlined into the built bundle by Vite. Document this as a hackathon-only trade-off.

**Rationale:**
- A proxy server to keep the key off the client would require backend infrastructure that the constitution explicitly forbids ("no real backend"). Building one would be a larger violation than the single constraint we're already amending.
- The demo laptop is a controlled environment; the built bundle is never served publicly. Exposure risk during the 14:45–15:30 window is effectively zero.
- Billing cap: set a hard usage limit on the OpenAI account to $5 before the hackathon. Even a degenerate loop can't exceed it.

**Alternatives considered:**
- Lightweight serverless proxy (Cloudflare Worker, Vercel Edge Function) — rejected: adds deploy/setup surface mid-hackathon; the billing cap already mitigates the threat this would defend against.
- Reading the key from `localStorage` after a one-time user prompt — rejected: adds a UI component + two states (unset / set) that expand the review surface for no judge-visible benefit.

**Documentation requirement:** `quickstart.md` and the README MUST note "this approach inlines an API key into the client bundle and is not safe for public deployment; it is appropriate for a controlled single-demo environment only".

---

## 5. Request timeout & fallback strategy

**Decision:** `AbortController` with a 5000 ms timeout. On timeout, network error, non-2xx status, or a successful response whose body omits any of `{case_ref, policy_id (when expected), action_label}`, render the deterministic fallback sentence from `composeFallback()`.

**Rationale:**
- 5 seconds is a generous ceiling for `gpt-4o-mini` (p95 ≈ 2s historically) but short enough that a hung call does not strand the user.
- Substring-check validation catches the only failure mode that would cause SC-103 to fail visibly — a successful response that doesn't name the deterministic case/policy/action.
- The fallback composer is a pure function; its output is byte-identical across renders for the same inputs.

**Fallback sentence template (per FR-119c):**

```text
{case_ref} has breached {policy_id} ({threshold_phrase}). Recommended action: {action_label}.
```

When `policy_id` is absent, the parenthetical is dropped. When `threshold_phrase` is absent, drop the threshold clause. The deterministic-selection CTA remains unaffected.

**Alternatives considered:**
- Retry the OpenAI call once on failure — rejected: doubles the timeout window for a feature that has a fully-usable fallback.
- Show a "retry" button to the user on failure — rejected: demo-unfriendly; the user expects the panel to just render something.

---

## 6. React integration pattern

**Decision:** Inside `<PriorityInsight />`, use a single `useEffect` that fires when the selected case's `case_id` changes (not on every render). While in-flight, render a skeleton bubble. Memoise the selection in `<AIStrategyAssistant />` with `useMemo` keyed on `filteredCases` identity so selection only recomputes when filters change.

**Rationale:**
- The assistant re-renders on every filter tick, but `selectPriorityCase()` is pure and cheap — `useMemo` keeps it from re-walking the list unnecessarily.
- Keying the `useEffect` on `case_id` (not on the whole enriched case object) prevents refetching when unrelated properties change. Triage counts + CTA render synchronously from the memoised selection — the skeleton covers only the LLM sentence.
- No `react-query`, no `swr` — Constitution §IV forbids adding a server-state library for a feature with one outbound call.

**Alternatives considered:**
- Suspense + `use()` hook — rejected: we intentionally do NOT want the panel to suspend and blank out the deterministic parts while the LLM call is pending.
- `react-query` — rejected per §IV.

---

## 7. WorkloadHeatmap (stretch) — rendering approach

**Decision:** A CSS grid (`display: grid`, `grid-template-columns: repeat(auto-fill, minmax(48px, 1fr))`) inside a fixed-height container above the summary tiles on `/`. Each tile is a `<button>` (semantic link alternative) with `aria-label`, coloured by `gds.red` / `gds.amber` / `gds.green` tokens from Tailwind.

**Rationale:**
- Auto-fill grid handles the 10-to-50-case range without bespoke layout math; tiles rewrap to stay above the fold per FR-118.
- `<button>` element gives keyboard activation "for free" (Enter/Space) matching FR-116 without WAI-ARIA plumbing.
- No chart library — `recharts`, `visx`, `d3` all rejected on bundle-size grounds for a single grid of coloured squares.

**Ordering:** Critical tiles first (by risk score descending within the critical bucket), then warning, then on-track — so the top-left of the grid is always the hot zone (FR-114).

**Alternatives considered:**
- Raw `<canvas>` — rejected: loses accessibility and keyboard nav for no visible gain.
- `recharts` HeatMap — rejected: hatchet to crack a nut.

---

## 8. Test strategy

**Decision:** One new test file — `src/test/assistant.test.ts` — with exactly 3 tests:

1. `selectPriorityCase` with a fixture-sourced `EnrichedCase[]` containing at least one `critical` case returns that case; with only `warning` cases returns the highest-scoring warning; with only `normal` returns null (or a sentinel the UI treats as "on track").
2. `composeFallback` with a fully-populated input returns a string containing the case reference, policy identifier, threshold phrase, and action label. With missing `policy_id`, the output omits the parenthetical but still names case and action.
3. `getPriorityInsight` with `fetch` stubbed to reject (simulating no-key / network failure) falls back to `composeFallback`'s output. With `fetch` stubbed to return a 200 whose body omits the expected case reference, also falls back.

**Rationale:**
- Three tests mirror the three deterministic surfaces Stream F adds — no component tests, no snapshots, no Playwright, consistent with Constitution §VI.
- Live OpenAI is NEVER called from tests — `vi.stubGlobal('fetch', …)` covers every code path.

**Alternatives considered:**
- A contract test against the live OpenAI API — rejected: flaky, costs money, not reproducible in CI.
- Testing React component render trees — rejected per §VI.

---

## 9. Accessibility

**Decision:** Reuse the existing `gds.yellow` 3px focus ring (already global per Constitution §III). Sidebar collapse button gets `aria-expanded` + `aria-controls`. Heatmap tiles get `aria-label="{case_ref} — {applicant_name} — {risk_level}"`. Priority insight has `role="status"` + `aria-live="polite"` so a screen-reader user hears the insight when it arrives from OpenAI (replacing any previous skeleton text).

**Rationale:** Matches the "Minimum-viable" a11y posture 001 committed to (Clarifications Session 2026-04-16), extended naturally to the new controls.

**Alternatives considered:** A full WAI-ARIA dialog pattern for the sidebar — rejected: the sidebar is not modal, and 001 explicitly rejected heavyweight ARIA patterns.

---

## 10. Open items post-research

None. All FR-119* decisions are locked. Constitution amendment (v1.1.0 → v1.2.0) is a process step (team-lead sign-off), not a research question.
