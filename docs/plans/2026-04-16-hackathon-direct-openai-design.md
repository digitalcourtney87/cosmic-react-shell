# Hackathon mode: drop edge functions, call OpenAI direct from browser

Date: 2026-04-16
Status: Design
Scope: hackathon demo only — revert plan documented at the end

## Problem

Three Supabase Edge Functions (`priority-insight`, `evidence-advice`, `case-chat`) proxy OpenAI server-side so the API key stays off the client. In practice, on the deployed demo, judges see deterministic fallbacks instead of LLM output. The functions have many failure modes — cold starts, missing `OPENAI_API_KEY` secret, tight 5s timeouts, CORS, deploy drift, and (silently) validation gates that reject perfectly good LLM rephrasings. Each is one more thing standing between the bundled site and a working OpenAI call.

For the duration of the hackathon, the right tradeoff is to expose a hackathon-only OpenAI key in the browser bundle (capped on the OpenAI dashboard, rotated after the event) in exchange for a single, debuggable failure surface.

## Architecture

Frontend calls `https://api.openai.com/v1/chat/completions` directly from the browser using `VITE_OPENAI_API_KEY` from `.env`. Vite inlines the value at build time.

A new helper, `src/services/openai.ts`, owns:
- reading and validating `VITE_OPENAI_API_KEY`
- building the fetch (auth header, `gpt-4o-mini`, JSON body)
- timeout / `AbortController` plumbing (currently duplicated three times)
- returning trimmed assistant text or throwing `OpenAIError` with `reason: 'no-key' | 'timeout' | 'network-error' | 'non-2xx' | 'malformed'`

Existing service functions keep their public signatures so callers do not change:
- `getPriorityInsight(inputs, signal?) → PriorityInsightResult`
- `getEvidenceAdvice(inputs, signal?) → EvidenceAdviceResult`
- `sendCaseChatMessage(caseContext, messages) → string`

System prompts and message-shaping logic that previously lived in edge functions move into the corresponding client service files.

## Per-service changes

### `src/services/ai.ts`

`getPriorityInsight`:
- Drop `EDGE_FUNCTION_PATH`, `readSupabaseConfig`, the bespoke fetch+abort block
- **Drop `validateResponse`** — this is the silent-fallback culprit, rejecting valid LLM rephrasings of `actionLabel`
- Port system + user prompt verbatim from `supabase/functions/priority-insight/index.ts`
- Call `callOpenAI`, return `{ status: 'llm', text, inputs }` on success
- Map `OpenAIError.reason` → existing `FallbackReason` and return `buildFallback(inputs, reason)` on failure

`getEvidenceAdvice`: same pattern. Drop `validateEvidenceResponse`. Keep `composeEvidenceFallback`.

### `src/services/caseChat.ts`

`sendCaseChatMessage`:
- Move `SYSTEM_PROMPT` from edge function into this file
- Move "rewrite first user turn to embed CASE RECORD JSON" logic into this file
- Call `callOpenAI`. On error, throw — `CaseChat.tsx` already handles this
- Keep 20-turn cap and 20s timeout as constants

Components and prop signatures are unchanged.

## Tests

- `src/test/assistant.test.ts` — swap mocked URL from `/functions/v1/priority-insight` to `https://api.openai.com/v1/chat/completions`; swap response body to OpenAI's shape `{ choices: [{ message: { content: "..." } }] }`
- `src/test/action-page.test.ts` — same swap for evidence-advice
- `src/test/caseChat.test.ts` and `src/test/components/CaseChat.test.tsx` — same swap, or no change if they already mock `sendCaseChatMessage` directly
- Stub `VITE_OPENAI_API_KEY` via `vi.stubEnv` in setup
- Delete assertions that test the removed validation gates

## Env & deploy

`.env`:
```
VITE_OPENAI_API_KEY="sk-..."  # DEMO ONLY — rotate after hackathon
```

The deployment host (Lovable / wherever) **must** have `VITE_OPENAI_API_KEY` set as a build-time env var before pushing — otherwise the bundle inlines `undefined` and every LLM call fails. `priority-insight` and `evidence-advice` fall back gracefully (demo shows stubs); `case-chat` shows its error UI.

`VITE_SUPABASE_*` vars stay; Supabase client may be referenced elsewhere.

## Cleanup

Delete:
- `supabase/functions/case-chat/`
- `supabase/functions/evidence-advice/`
- `supabase/functions/priority-insight/`

Update:
- `CLAUDE.md` "External calls" paragraph: replace edge-function description with "Direct browser → OpenAI calls using `VITE_OPENAI_API_KEY` (hackathon mode)."
- `README.md`: add `VITE_OPENAI_API_KEY` to setup

Leave `docs/plans/` historical docs alone — they document past decisions.

## Verification order

1. Code changes + `bun run test` + `bun dev` + eyeball all three LLM features
2. Set `VITE_OPENAI_API_KEY` on deploy platform
3. Push, wait for build, hit each LLM surface on the deployed URL once

## Post-hackathon revert

1. Revoke the demo OpenAI key
2. If keeping these features long-term: restore edge functions from git (`git show faf2cc7:supabase/functions/case-chat/index.ts > ...`) and revert the service-layer changes in this branch
3. If retiring: delete the unused service code

## Non-goals

- Rewriting prompts or changing model
- Touching the GOV.UK Content API path
- Restructuring components, types, or fixtures
- Adding new features
