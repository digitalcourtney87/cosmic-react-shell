import casesRaw from '../challenge-3/cases.json';
import policiesRaw from '../challenge-3/policy-extracts.json';
import workflowRaw from '../challenge-3/workflow-states.json';
import pageIndexRaw from '../challenge-3/page-index.json';

import { Case, PolicyExtract, WorkflowData, WorkflowStateEntry, PageIndexEntry, EnrichedCase } from '../types/case';
import { deriveEvidenceStatus, calculateRiskScore, getRequiredNextActions, daysBetween } from '../lib/derive';
import { REFERENCE_DATE } from '../lib/constants';

export const cases = casesRaw as Case[];
export const policies = policiesRaw as PolicyExtract[];
export const workflowData = workflowRaw as WorkflowData;
export const pageIndex = pageIndexRaw as PageIndexEntry[];

export function getWorkflowState(caseType: string, status: string): WorkflowStateEntry | null {
  return workflowData.case_types[caseType]?.states.find(s => s.state === status) ?? null;
}

export function getPoliciesForCase(caseType: string): PolicyExtract[] {
  return policies.filter(p => p.applicable_case_types.includes(caseType));
}

export function getActionEntry(caseType: string, actionId: string) {
  return pageIndex
    .find(p => p.case_type === caseType)
    ?.actions.find(a => a.action_id === actionId) ?? null;
}

export function enrichCase(c: Case): EnrichedCase {
  const workflowState = getWorkflowState(c.case_type, c.status);
  const casePolicies = getPoliciesForCase(c.case_type);
  const evidenceItems = deriveEvidenceStatus(c, casePolicies, workflowState);
  const riskScore = calculateRiskScore(c, evidenceItems, workflowState);
  const nextActions = getRequiredNextActions(c, evidenceItems, workflowState, pageIndex);
  const ageInDays = daysBetween(new Date(c.created_date), REFERENCE_DATE);
  return { ...c, evidenceItems, riskScore, nextActions, workflowState, ageInDays };
}

export function getAllEnrichedCases(): EnrichedCase[] {
  return cases.map(enrichCase);
}

export function getEnrichedCaseById(caseId: string): EnrichedCase | null {
  const c = cases.find(x => x.case_id === caseId);
  return c ? enrichCase(c) : null;
}
