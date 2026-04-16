/**
 * Stream F — AI Strategy Assistant tests.
 * Network is stubbed by mocking supabase.functions.invoke; no live calls.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getAllEnrichedCases,
  policies,
  pageIndex,
} from '../services/cases';
import {
  selectPriorityCase,
  composeFallback,
  getPriorityInsight,
} from '../services/ai';
import { supabase } from '../integrations/supabase/client';
import type { PriorityInsightInputs } from '../types/case';

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Test 1 — selectPriorityCase deterministic ranking ────────────────────────

describe('selectPriorityCase', () => {
  it('prefers critical cases; with only critical cases picks the highest score', () => {
    const all = getAllEnrichedCases();
    const chosen = selectPriorityCase(all, policies, pageIndex);
    expect(chosen).not.toBeNull();

    const criticals = all.filter(c => c.riskScore.level === 'critical');
    if (criticals.length > 0) {
      expect(chosen!.riskLevel).toBe('critical');
      const topScore = Math.max(...criticals.map(c => c.riskScore.score));
      const topCritical = criticals.find(c => c.riskScore.score === topScore)!;
      expect(chosen!.caseRef).toBe(topCritical.case_id);
    }

    expect(selectPriorityCase([], policies, pageIndex)).toBeNull();
  });
});

// ── Test 2 — composeFallback formatting ──────────────────────────────────────

describe('composeFallback', () => {
  it('names case, policy, threshold, and action when all present; drops parenthetical when policy is absent', () => {
    const full: PriorityInsightInputs = {
      caseId: 'CASE-2026-00042',
      caseRef: 'CASE-2026-00042',
      applicantName: 'Test Applicant',
      riskLevel: 'critical',
      topFactors: ['1 evidence item overdue'],
      policyId: 'POL-BR-003',
      policyTitle: 'Benefit Review Escalation',
      thresholdPhrase: '56-day escalation threshold',
      actionId: 'issue-escalation-notice',
      actionLabel: 'Draft Escalation Notice',
      actionHref: '/case/CASE-2026-00042/action/issue-escalation-notice',
    };
    const full_text = composeFallback(full);
    expect(full_text).toContain('CASE-2026-00042');
    expect(full_text).toContain('POL-BR-003');
    expect(full_text).toContain('56-day escalation threshold');
    expect(full_text).toContain('Draft Escalation Notice');

    const noPolicy: PriorityInsightInputs = {
      ...full,
      policyId: null,
      policyTitle: null,
      thresholdPhrase: null,
    };
    const no_policy_text = composeFallback(noPolicy);
    expect(no_policy_text).toContain('CASE-2026-00042');
    expect(no_policy_text).toContain('Draft Escalation Notice');
    expect(no_policy_text).not.toContain('(');
    expect(no_policy_text).not.toContain('POL-BR-003');
  });
});

// ── Test 3 — getPriorityInsight uses ai-proxy edge function ─────────────────

describe('getPriorityInsight', () => {
  it('falls back on no-key, falls back on network error, returns llm on success', async () => {
    const inputs: PriorityInsightInputs = {
      caseId: 'CASE-2026-00042',
      caseRef: 'CASE-2026-00042',
      applicantName: 'Test Applicant',
      riskLevel: 'critical',
      topFactors: ['1 evidence item overdue'],
      policyId: 'POL-BR-003',
      policyTitle: 'Benefit Review Escalation',
      thresholdPhrase: '56-day escalation threshold',
      actionId: 'issue-escalation-notice',
      actionLabel: 'Draft Escalation Notice',
      actionHref: '/case/CASE-2026-00042/action/issue-escalation-notice',
    };
    const fallbackText = composeFallback(inputs);

    // Case A: server reports no-key → fallback
    vi.spyOn(supabase.functions, 'invoke').mockResolvedValueOnce({
      data: { error: 'OPENAI_API_KEY is not configured', reason: 'no-key' },
      error: null,
    } as never);
    const noKeyResult = await getPriorityInsight(inputs);
    expect(noKeyResult.status).toBe('fallback');
    if (noKeyResult.status === 'fallback') {
      expect(noKeyResult.reason).toBe('no-key');
      expect(noKeyResult.text).toBe(fallbackText);
    }

    // Case B: invoke errors → network-error fallback
    vi.spyOn(supabase.functions, 'invoke').mockResolvedValueOnce({
      data: null,
      error: new Error('network down'),
    } as never);
    const networkResult = await getPriorityInsight(inputs);
    expect(networkResult.status).toBe('fallback');
    if (networkResult.status === 'fallback') {
      expect(networkResult.reason).toBe('network-error');
      expect(networkResult.text).toBe(fallbackText);
    }

    // Case C: success → llm
    vi.spyOn(supabase.functions, 'invoke').mockResolvedValueOnce({
      data: { text: 'Some LLM text mentioning CASE-2026-00042.' },
      error: null,
    } as never);
    const okResult = await getPriorityInsight(inputs);
    expect(okResult.status).toBe('llm');
    if (okResult.status === 'llm') {
      expect(okResult.text).toBe('Some LLM text mentioning CASE-2026-00042.');
    }
  });
});
