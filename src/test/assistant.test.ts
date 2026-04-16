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
  it('falls back to deterministic text on fetch rejection and on malformed response', async () => {
    // Ensure the Supabase edge-function config is present so we exercise the fetch path, not no-key.
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-test-key');

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

    // Case A: network rejects
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')));
    const networkResult = await getPriorityInsight(inputs);
    expect(networkResult.status).toBe('fallback');
    if (networkResult.status === 'fallback') {
      expect(networkResult.reason).toBe('network-error');
      expect(networkResult.text).toBe(fallbackText);
    }

    // Case B: 200 OK but body omits the case reference → malformed
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ text: 'Nothing useful here.' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );
    const malformedResult = await getPriorityInsight(inputs);
    expect(malformedResult.status).toBe('fallback');
    if (malformedResult.status === 'fallback') {
      expect(malformedResult.reason).toBe('malformed');
      expect(malformedResult.text).toBe(fallbackText);
    }
  });
});
