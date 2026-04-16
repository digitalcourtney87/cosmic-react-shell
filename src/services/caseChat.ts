/**
 * Case Chat Assistant service.
 * - buildCaseContext: pure derivation of StructuredCaseContext from EnrichedCase.
 * - sendCaseChatMessage: added in Task 4.
 */

import type { EnrichedCase, PolicyExtract, StructuredCaseContext } from '../types/case';
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
