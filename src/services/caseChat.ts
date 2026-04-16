/**
 * Case Chat Assistant service.
 * - buildCaseContext: pure derivation of StructuredCaseContext from EnrichedCase.
 * - sendCaseChatMessage: added in Task 4.
 */

import type { ChatMessage, EnrichedCase, PolicyExtract, StructuredCaseContext } from '../types/case';
import { REFERENCE_DATE } from '../lib/constants';
import { callOpenAI, OpenAIError } from './openai';

export function buildCaseContext(
  enriched: EnrichedCase,
  policies: PolicyExtract[],
): StructuredCaseContext {
  return {
    caseId: enriched.case_id,
    caseType: enriched.case_type,
    status: enriched.status,
    referenceDate: REFERENCE_DATE.toISOString().slice(0, 10),
    applicant: {
      name: enriched.applicant.name,
      reference: enriched.applicant.reference,
      dateOfBirth: enriched.applicant.date_of_birth ?? undefined,
    },
    assignedTo: enriched.assigned_to,
    createdDate: enriched.created_date,
    riskScore: {
      level: enriched.riskScore.level,
      score: enriched.riskScore.score,
      factors: [...enriched.riskScore.factors],
    },
    caseNotes: enriched.case_notes,
    timeline: enriched.timeline.map(t => ({
      date: t.date,
      event: t.event,
      note: t.note,
    })),
    evidenceItems: enriched.evidenceItems.map(e => ({
      requirement: e.requirement,
      status: e.status,
      policyId: e.policyId,
      elapsedDays: e.elapsedDays,
      thresholdDays: e.thresholdDays,
    })),
    workflowState: enriched.workflowState
      ? {
          label: enriched.workflowState.label,
          description: enriched.workflowState.description,
          escalationThresholds: enriched.workflowState.escalation_thresholds,
          allowedTransitions: [...enriched.workflowState.allowed_transitions],
        }
      : null,
    nextActions: enriched.nextActions.map(a => ({
      id: a.id,
      label: a.label,
      severity: a.severity,
      dueInDays: a.dueInDays,
    })),
    policies: policies.map(p => ({
      policyId: p.policy_id,
      title: p.title,
      body: p.body,
    })),
  };
}

const CHAT_TIMEOUT_MS = 20_000;

const SYSTEM_PROMPT = [
  'You are a decision-support assistant for a UK government caseworker.',
  'You are given one case record as JSON. Answer the caseworker\'s questions',
  'using only the information in that record. When asked about dates, compute',
  'relative to referenceDate, never today\'s real date. If a question cannot',
  'be answered from the record, say so plainly: "The case record doesn\'t',
  'show that." Do not invent case references, policy identifiers, dates, or',
  'evidence items. Do not draft letters, notices, or formal correspondence.',
  'Do not recommend workflow transitions. Keep answers to 2-5 sentences of',
  'plain English. Do not use emoji.',
].join('\n');

export async function sendCaseChatMessage(
  caseContext: StructuredCaseContext,
  messages: ChatMessage[],
): Promise<string> {
  if (messages.length === 0) {
    throw new Error('sendCaseChatMessage: messages must not be empty');
  }

  const openaiMessages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    ...messages.map((turn, i) => {
      if (i === 0 && turn.role === 'user') {
        return {
          role: 'user' as const,
          content:
            `CASE RECORD:\n${JSON.stringify(caseContext, null, 2)}\n\nQUESTION:\n${turn.content}`,
        };
      }
      return { role: turn.role, content: turn.content };
    }),
  ];

  try {
    return await callOpenAI(
      openaiMessages,
      { timeoutMs: CHAT_TIMEOUT_MS, maxTokens: 400, temperature: 0.2 },
      undefined,
    );
  } catch (err) {
    if (err instanceof OpenAIError) {
      throw new Error(`Case chat failed: ${err.reason}`);
    }
    throw err;
  }
}
