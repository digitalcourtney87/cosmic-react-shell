/**
 * Case Chat Assistant service.
 * - buildCaseContext: pure derivation of StructuredCaseContext from EnrichedCase.
 * - sendCaseChatMessage: added in Task 4.
 */

import type { ChatMessage, EnrichedCase, PolicyExtract, StructuredCaseContext } from '../types/case';
import { REFERENCE_DATE } from '../lib/constants';

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

const EDGE_FUNCTION_PATH = '/functions/v1/case-chat';

function readSupabaseConfig(): { url: string; anonKey: string } {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey =
    import.meta.env.VITE_SUPABASE_ANON_KEY ??
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (typeof url !== 'string' || url.length === 0) {
    throw new Error('VITE_SUPABASE_URL not configured');
  }
  if (typeof anonKey !== 'string' || anonKey.length === 0) {
    throw new Error('VITE_SUPABASE_ANON_KEY / VITE_SUPABASE_PUBLISHABLE_KEY not configured');
  }
  return { url: url.replace(/\/+$/, ''), anonKey };
}

export async function sendCaseChatMessage(
  caseContext: StructuredCaseContext,
  messages: ChatMessage[],
): Promise<string> {
  const config = readSupabaseConfig();

  const response = await fetch(`${config.url}${EDGE_FUNCTION_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
    },
    body: JSON.stringify({
      caseContext,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    }),
  });

  if (!response.ok) {
    throw new Error(`Case chat edge function returned ${response.status}`);
  }

  const body = (await response.json()) as { text?: string };
  const text = (body.text ?? '').trim();
  if (!text) {
    throw new Error('Case chat edge function returned empty text');
  }
  return text;
}
