/**
 * Case Chat Assistant — service tests.
 * buildCaseContext is a pure derivation; sendCaseChatMessage now goes through
 * the ai-proxy Supabase Edge Function, mocked via supabase.functions.invoke.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildCaseContext, sendCaseChatMessage } from '../services/caseChat';
import { getAllEnrichedCases, getPoliciesForCase } from '../services/cases';
import { REFERENCE_DATE } from '../lib/constants';
import { supabase } from '../integrations/supabase/client';
import type { StructuredCaseContext, ChatMessage } from '../types/case';

afterEach(() => {
  vi.restoreAllMocks();
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

const stubContext: StructuredCaseContext = {
  caseId: 'CASE-TEST-001',
  caseType: 'benefits_review',
  status: 'under_review',
  referenceDate: '2026-04-16',
  applicant: { name: 'Test Person', reference: 'REF-001' },
  assignedTo: 'Test Worker',
  createdDate: '2026-03-01',
  riskScore: { level: 'warning', score: 5, factors: [] },
  caseNotes: '',
  timeline: [],
  evidenceItems: [],
  workflowState: null,
  nextActions: [],
  policies: [],
};

const stubMessages: ChatMessage[] = [{ role: 'user', content: 'hi' }];

describe('sendCaseChatMessage', () => {
  it('calls ai-proxy and returns the assistant text on success', async () => {
    const invokeSpy = vi.spyOn(supabase.functions, 'invoke').mockResolvedValueOnce({
      data: { text: 'Hello there.' },
      error: null,
    } as never);

    const text = await sendCaseChatMessage(stubContext, stubMessages);
    expect(text).toBe('Hello there.');

    expect(invokeSpy).toHaveBeenCalledTimes(1);
    const [name, opts] = invokeSpy.mock.calls[0];
    expect(name).toBe('ai-proxy');
    const body = (opts as { body: { messages: { role: string; content: string }[] } }).body;
    expect(Array.isArray(body.messages)).toBe(true);
    expect(body.messages[0].role).toBe('system');
    const last = body.messages[body.messages.length - 1];
    expect(last.role).toBe('user');
    expect(last.content).toContain('CASE-TEST-001');
    expect(last.content).toContain('hi');
  });

  it('throws when ai-proxy returns an error reason', async () => {
    vi.spyOn(supabase.functions, 'invoke').mockResolvedValueOnce({
      data: { error: 'boom', reason: 'non-2xx' },
      error: null,
    } as never);
    await expect(sendCaseChatMessage(stubContext, stubMessages)).rejects.toThrow();
  });

  it('throws when ai-proxy returns empty text', async () => {
    vi.spyOn(supabase.functions, 'invoke').mockResolvedValueOnce({
      data: { text: '' },
      error: null,
    } as never);
    await expect(sendCaseChatMessage(stubContext, stubMessages)).rejects.toThrow();
  });

  it('throws when invoke errors (network)', async () => {
    vi.spyOn(supabase.functions, 'invoke').mockResolvedValueOnce({
      data: null,
      error: new Error('offline'),
    } as never);
    await expect(sendCaseChatMessage(stubContext, stubMessages)).rejects.toThrow();
  });
});
