/**
 * Case Chat Assistant — service tests.
 * buildCaseContext is a pure derivation over EnrichedCase.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildCaseContext } from '../services/caseChat';
import { getAllEnrichedCases, getPoliciesForCase } from '../services/cases';
import { REFERENCE_DATE } from '../lib/constants';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('buildCaseContext', () => {
  it('produces a StructuredCaseContext from the first fixture case', () => {
    const enriched = getAllEnrichedCases()[0];
    const relevantPolicies = getPoliciesForCase(enriched.case_type);

    const ctx = buildCaseContext(enriched, relevantPolicies);

    expect(ctx.caseId).toBe(enriched.case_id);
    expect(ctx.caseType).toBe(enriched.case_type);
    expect(ctx.status).toBe(enriched.status);
    expect(ctx.applicant.name).toBe(enriched.applicant.name);
    expect(ctx.applicant.reference).toBe(enriched.applicant.reference);
    expect(ctx.assignedTo).toBe(enriched.assigned_to);
    expect(ctx.riskScore.level).toBe(enriched.riskScore.level);
    expect(ctx.riskScore.score).toBe(enriched.riskScore.score);
    expect(ctx.caseNotes).toBe(enriched.case_notes);
    expect(ctx.timeline.length).toBe(enriched.timeline.length);
    expect(ctx.evidenceItems.length).toBe(enriched.evidenceItems.length);
    expect(ctx.nextActions.length).toBe(enriched.nextActions.length);
  });

  it('uses REFERENCE_DATE as referenceDate (never new Date())', () => {
    const enriched = getAllEnrichedCases()[0];
    const ctx = buildCaseContext(enriched, []);
    expect(ctx.referenceDate).toBe(REFERENCE_DATE.toISOString().slice(0, 10));
  });

  it('serialises workflowState as null when absent', () => {
    const enriched = {
      ...getAllEnrichedCases()[0],
      workflowState: null,
    };
    const ctx = buildCaseContext(enriched, []);
    expect(ctx.workflowState).toBeNull();
  });

  it('includes full policy bodies verbatim', () => {
    const enriched = getAllEnrichedCases()[0];
    const relevantPolicies = getPoliciesForCase(enriched.case_type);
    expect(relevantPolicies.length).toBeGreaterThan(0);
    const ctx = buildCaseContext(enriched, relevantPolicies);
    expect(ctx.policies[0].body).toBe(relevantPolicies[0].body);
    expect(ctx.policies[0].policyId).toBe(relevantPolicies[0].policy_id);
    expect(ctx.policies[0].title).toBe(relevantPolicies[0].title);
  });

  it('renames workflowState fields from snake_case to camelCase', () => {
    const enriched = getAllEnrichedCases().find(c => c.workflowState !== null);
    expect(enriched).toBeDefined();
    if (!enriched || !enriched.workflowState) return;
    const ctx = buildCaseContext(enriched, []);
    expect(ctx.workflowState).not.toBeNull();
    expect(ctx.workflowState!.allowedTransitions).toEqual(
      enriched.workflowState.allowed_transitions,
    );
    if (enriched.workflowState.escalation_thresholds) {
      expect(ctx.workflowState!.escalationThresholds).toEqual(
        enriched.workflowState.escalation_thresholds,
      );
    }
  });
});
