/**
 * Multi-agent debate system.
 *
 * Two Claude instances argue for competing project approaches; a third acts as judge.
 *
 * Usage (ts-node):
 *   ts-node debate.ts
 *
 * Or override config via CLI args:
 *   ts-node debate.ts --rounds 5
 *
 * Requires ANTHROPIC_API_KEY in environment.
 */

import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const config = {
  /** Number of back-and-forth rounds (each round = one A reply + one B reply). */
  rounds: 3,

  /** Context about the project the agents should ground their debate in. */
  projectContext: `
cosmic-react-shell is a UK government caseworker decision-support tool (Case Compass).
It is a React 18 + TypeScript 5.8 hackathon MVP with:
- A caseload overview page (filterable/sortable risk table, 5-tier triage)
- A case detail page (evidence tracker, policy accordion, risk scoring)
- Pure-function derivation pipeline (evidence status, risk score, next actions)
- Static JSON fixtures, no backend, no global state library
The codebase has ~4 fixture-driven tests. The next phase needs broader test coverage
and the team must choose between two testing strategies.
`.trim(),

  /** Agent A's assigned position. */
  approachA: `
Approach A — Integration-first testing:
Expand the existing Vitest fixture tests into full integration tests.
Wire the derivation pipeline to the real React components using React Testing Library.
Write scenario-based tests that cover end-to-end journeys (e.g. "overdue evidence → critical risk → action surfaced").
Avoid mocking internals; test observable behaviour through the UI.
`.trim(),

  /** Agent B's assigned position. */
  approachB: `
Approach B — Unit + contract testing:
Keep derivation-pipeline tests as pure unit tests (already done).
Add dedicated unit tests for every React component in isolation using RTL + MSW for data.
Write a light contract layer (Zod schemas + test assertions) that validates fixture shapes,
so any drift in the JSON data model is caught immediately.
Do not test end-to-end flows; keep tests fast and focused.
`.trim(),
};

// Allow --rounds N CLI override
const roundsArg = process.argv.indexOf("--rounds");
if (roundsArg !== -1 && process.argv[roundsArg + 1]) {
  config.rounds = parseInt(process.argv[roundsArg + 1], 10);
}

// ─── CLIENT ──────────────────────────────────────────────────────────────────

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-4-6";

// ─── TYPES ───────────────────────────────────────────────────────────────────

type Role = "user" | "assistant";
type Message = { role: Role; content: string };

interface RoundEntry {
  round: number;
  agentA: string;
  agentB: string;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

async function callClaude(
  systemPrompt: string,
  messages: Message[],
): Promise<string> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("No text block in response");
  return block.text.trim();
}

function separator(label: string): string {
  const line = "─".repeat(60);
  return `\n${line}\n  ${label}\n${line}`;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function runDebate() {
  console.log(separator("MULTI-AGENT DEBATE"));
  console.log(`\nProject context:\n${config.projectContext}\n`);
  console.log(`Rounds: ${config.rounds}`);
  console.log(`\nApproach A: ${config.approachA.split("\n")[0]}`);
  console.log(`Approach B: ${config.approachB.split("\n")[0]}\n`);

  // System prompts
  const systemA = `You are Agent A, a senior software engineer passionately advocating for the following testing approach in the context of the project described below.

PROJECT CONTEXT:
${config.projectContext}

YOUR APPROACH (defend this):
${config.approachA}

Rules:
- Make your best case for your approach in 3–5 concise sentences.
- Directly rebut the opposing argument when one is provided.
- Stay grounded in the specific project context.
- Do not concede; find the strongest counter-argument available.`;

  const systemB = `You are Agent B, a senior software engineer passionately advocating for the following testing approach in the context of the project described below.

PROJECT CONTEXT:
${config.projectContext}

YOUR APPROACH (defend this):
${config.approachB}

Rules:
- Make your best case for your approach in 3–5 concise sentences.
- Directly rebut the opposing argument when one is provided.
- Stay grounded in the specific project context.
- Do not concede; find the strongest counter-argument available.`;

  const systemJudge = `You are an impartial senior engineering lead evaluating a technical debate.

PROJECT CONTEXT:
${config.projectContext}

Approach A:
${config.approachA}

Approach B:
${config.approachB}

Your job:
1. Briefly summarise the strongest arguments made by each side (2–3 sentences each).
2. Identify any weaknesses or concessions in each position.
3. Give a clear, justified recommendation: which approach (A, B, or a specific hybrid) best fits this project, and why.
Keep your verdict under 200 words.`;

  // Each agent maintains its own message history
  const historyA: Message[] = [];
  const historyB: Message[] = [];
  const transcript: RoundEntry[] = [];

  // Opening statements (no opposing argument yet)
  console.log(separator("OPENING STATEMENTS"));

  const openingPromptA = "Please make your opening argument for your approach.";
  const openingPromptB = "Please make your opening argument for your approach.";

  historyA.push({ role: "user", content: openingPromptA });
  const openingA = await callClaude(systemA, historyA);
  historyA.push({ role: "assistant", content: openingA });

  historyB.push({ role: "user", content: openingPromptB });
  const openingB = await callClaude(systemB, historyB);
  historyB.push({ role: "assistant", content: openingB });

  console.log(`\nAgent A:\n${openingA}\n`);
  console.log(`Agent B:\n${openingB}\n`);

  transcript.push({ round: 0, agentA: openingA, agentB: openingB });

  // Debate rounds
  for (let round = 1; round <= config.rounds; round++) {
    console.log(separator(`ROUND ${round}`));

    // A responds to B's last statement
    const promptForA = `Agent B just argued:\n\n"${historyB[historyB.length - 1].content}"\n\nRebut this and reinforce your position.`;
    historyA.push({ role: "user", content: promptForA });
    const replyA = await callClaude(systemA, historyA);
    historyA.push({ role: "assistant", content: replyA });

    // B responds to A's latest reply
    const promptForB = `Agent A just argued:\n\n"${replyA}"\n\nRebut this and reinforce your position.`;
    historyB.push({ role: "user", content: promptForB });
    const replyB = await callClaude(systemB, historyB);
    historyB.push({ role: "assistant", content: replyB });

    console.log(`\nAgent A:\n${replyA}\n`);
    console.log(`Agent B:\n${replyB}\n`);

    transcript.push({ round, agentA: replyA, agentB: replyB });
  }

  // Build full debate transcript for the judge
  const transcriptText = transcript
    .map((entry) => {
      const label = entry.round === 0 ? "Opening statements" : `Round ${entry.round}`;
      return `${label}\nAgent A: ${entry.agentA}\nAgent B: ${entry.agentB}`;
    })
    .join("\n\n");

  // Judge
  console.log(separator("JUDGE'S VERDICT"));

  const judgeMessages: Message[] = [
    {
      role: "user",
      content: `Here is the full debate transcript:\n\n${transcriptText}\n\nPlease evaluate the debate and deliver your verdict.`,
    },
  ];

  const verdict = await callClaude(systemJudge, judgeMessages);
  console.log(`\n${verdict}\n`);

  // Structured output
  console.log(separator("STRUCTURED TRANSCRIPT"));
  const structured = {
    config: {
      rounds: config.rounds,
      model: MODEL,
    },
    transcript,
    verdict,
  };
  console.log(JSON.stringify(structured, null, 2));
}

runDebate().catch((err) => {
  console.error("Debate failed:", err);
  process.exit(1);
});
