/**
 * Mock service — mirrors the Stream A service signatures.
 * Returns hardcoded data for one case so Streams B and C can build
 * against the real interfaces before Stream A's implementation lands.
 * Swap `import ... from './mock'` → `import ... from './cases'` when ready.
 */

import { Case, PolicyExtract, WorkflowStateEntry, EvidenceItem, RiskScore, NextAction } from '../types/case';

const MOCK_CASE: Case = {
  case_id: 'CASE-2026-00042',
  case_type: 'benefit_review',
  status: 'awaiting_evidence',
  applicant: { name: 'Jordan Smith', reference: 'REF-77291', date_of_birth: '1985-03-14' },
  assigned_to: 'team_b',
  created_date: '2026-01-10',
  last_updated: '2026-03-28',
  timeline: [
    { date: '2026-01-10', event: 'case_created', note: 'Initial application received via online portal.' },
    { date: '2026-01-15', event: 'evidence_requested', note: 'Requested proof of address and income statement.' },
    { date: '2026-02-02', event: 'evidence_received', note: 'Proof of address received. Income statement still outstanding.' },
  ],
  case_notes: 'Applicant relocated from Birmingham to Manchester. Awaiting income statement.',
};

const MOCK_POLICY: PolicyExtract = {
  policy_id: 'POL-BR-003',
  title: 'Evidence requirements for benefit reviews',
  applicable_case_types: ['benefit_review'],
  body: 'The caseworker must obtain: (1) proof of the new address (if applicable), (2) an income statement covering the 3 months prior to the change, and (3) a signed declaration confirming the change. If any evidence is outstanding after 28 days, the caseworker should issue a reminder. If outstanding after 56 days, the case should be escalated to a team leader.',
};

const MOCK_WORKFLOW: WorkflowStateEntry = {
  state: 'awaiting_evidence',
  label: 'Awaiting evidence',
  description: 'Evidence has been requested from the applicant. Waiting for receipt.',
  allowed_transitions: ['under_review', 'escalated'],
  required_actions: [
    'Send evidence request to applicant',
    'Log date of evidence request',
    'Issue reminder if evidence outstanding after 28 days',
    'Escalate to team leader if evidence outstanding after 56 days',
  ],
  escalation_thresholds: { reminder_days: 28, escalation_days: 56 },
};

const MOCK_EVIDENCE: EvidenceItem[] = [
  { requirement: 'income statement covering the 3 months prior to the change', status: 'overdue', policyId: 'POL-BR-003', elapsedDays: 91, thresholdDays: 56 },
  { requirement: 'signed declaration confirming the change', status: 'outstanding', policyId: 'POL-BR-003', elapsedDays: 91, thresholdDays: 56 },
  { requirement: 'proof of the new address (if applicable)', status: 'received', policyId: 'POL-BR-003', elapsedDays: 91, thresholdDays: 56 },
];

const MOCK_RISK: RiskScore = {
  score: 8,
  level: 'critical',
  factors: ['1 evidence item overdue', 'past escalation threshold (96 days)', 'no update in 19 days'],
};

const MOCK_ACTIONS: NextAction[] = [
  { id: 'BR-05', label: 'Escalate — evidence outstanding 91 days (threshold: 56)', severity: 'critical', dueInDays: -35 },
  { id: 'awaiting_evidence-2', label: 'Issue reminder if evidence outstanding after 28 days', severity: 'warning', dueInDays: null },
];

// ── Stub service functions (same signatures as src/services/cases.ts) ─────────

export function getAllCases(): Case[] {
  return [MOCK_CASE];
}

export function getCaseById(id: string): Case | undefined {
  return id === MOCK_CASE.case_id ? MOCK_CASE : undefined;
}

export function getApplicablePolicies(caseType: string): PolicyExtract[] {
  return caseType === 'benefit_review' ? [MOCK_POLICY] : [];
}

export function getWorkflowState(caseType: string, status: string): WorkflowStateEntry | undefined {
  return caseType === 'benefit_review' && status === 'awaiting_evidence' ? MOCK_WORKFLOW : undefined;
}

export function deriveEvidenceStatus(): EvidenceItem[] {
  return MOCK_EVIDENCE;
}

export function calculateRiskScore(): RiskScore {
  return MOCK_RISK;
}

export function getRequiredNextActions(): NextAction[] {
  return MOCK_ACTIONS;
}
