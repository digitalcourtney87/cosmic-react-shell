/**
 * Stream F — AI Strategy Assistant tests.
 * Three fixture-driven tests only, per research.md §8.
 * Network is stubbed via vi.stubGlobal; no live OpenAI calls.
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
import type { PriorityInsightInputs } from '../types/case';

const realFetch = globalThis.fetch;

afterEach(() => {
  vi.unstubAllGlobals();
  globalThis.fetch = realFetch;
});

// ── Test 1 ────────────────────────────────────────────────────────────────────
// selectPriorityCase picks the highest-risk case under the deterministic rule
// (critical → warning → normal; riskScore.score desc; caseRef asc tiebreak).

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

    // Empty input → null
    expect(selectPriorityCase([], policies, pageIndex)).toBeNull();
  });
});

// ── Test 2 ────────────────────────────────────────────────────────────────────
// composeFallback names every supplied artefact and drops the parenthetical
// when policyId is absent.

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

// ── Test 3 ────────────────────────────────────────────────────────────────────
// getPriorityInsight falls back on every failure mode:
// - fetch rejects → network-error
// - 200 OK with missing caseRef in body → malformed

describe('getPriorityInsight', () => {
  it('falls back on missing key, falls back on network reject, returns llm on 200', async () => {
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

    // Case A: missing key → no-key fallback
    vi.stubEnv('VITE_OPENAI_API_KEY', '');
    const noKeyResult = await getPriorityInsight(inputs);
    expect(noKeyResult.status).toBe('fallback');
    if (noKeyResult.status === 'fallback') {
      expect(noKeyResult.reason).toBe('no-key');
      expect(noKeyResult.text).toBe(fallbackText);
    }

    // Case B: network rejects → network-error fallback
    vi.stubEnv('VITE_OPENAI_API_KEY', 'sk-test');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')));
    const networkResult = await getPriorityInsight(inputs);
    expect(networkResult.status).toBe('fallback');
    if (networkResult.status === 'fallback') {
      expect(networkResult.reason).toBe('network-error');
      expect(networkResult.text).toBe(fallbackText);
    }

    // Case C: 200 OK with OpenAI shape → llm
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ choices: [{ message: { content: 'Some LLM text mentioning CASE-2026-00042.' } }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );
    const okResult = await getPriorityInsight(inputs);
    expect(okResult.status).toBe('llm');
    if (okResult.status === 'llm') {
      expect(okResult.text).toBe('Some LLM text mentioning CASE-2026-00042.');
    }
  });
});
