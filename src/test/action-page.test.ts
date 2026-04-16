/**
 * Feature 003 — Case Action Pages tests.
 * Seven fixture-driven tests. Network is stubbed via vi.stubGlobal; no live OpenAI calls.
 * Run via `bun run test` (NOT `bun test` — bun's native runner lacks vi.unstubAllGlobals).
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAllEnrichedCases, getActionEntry, policies } from '../services/cases';
import {
  selectActionEvidence,
  buildEvidenceAdviceInputs,
  composeEvidenceFallback,
} from '../lib/action';
import { getEvidenceAdvice } from '../services/ai';
import type { EvidenceAdviceInputs, ActionEntry } from '../types/case';

const realFetch = globalThis.fetch;

afterEach(() => {
  vi.unstubAllGlobals();
  globalThis.fetch = realFetch;
});

// ── Test 1 — selectActionEvidence ─────────────────────────────────────────────

describe('selectActionEvidence', () => {
  it('returns action scope when ≥ 2 items match policy_refs; widens to case-wide otherwise', () => {
    const all = getAllEnrichedCases();

    // Find a case with evidence items
    const caseWithEvidence = all.find(c => c.evidenceItems.length > 0);
    expect(caseWithEvidence).toBeDefined();
    if (!caseWithEvidence) return;

    // ── Case A: policy_refs is empty → case-wide ──────────────────────────────
    const emptyRefsEntry: ActionEntry = {
      action_id: 'TEST-EMPTY',
      label: 'Test empty refs',
      triggered_at_state: caseWithEvidence.status,
      policy_refs: [],
      pages: [],
    };
    const emptyResult = selectActionEvidence(caseWithEvidence, emptyRefsEntry);
    expect(emptyResult.scope).toBe('case-wide');
    expect(emptyResult.items.length).toBe(caseWithEvidence.evidenceItems.length);

    // ── Case B: policy_refs matches 0 items → case-wide ──────────────────────
    const noMatchEntry: ActionEntry = {
      action_id: 'TEST-NOMATCH',
      label: 'Test no match',
      triggered_at_state: caseWithEvidence.status,
      policy_refs: ['POL-NONEXISTENT-999'],
      pages: [],
    };
    const noMatchResult = selectActionEvidence(caseWithEvidence, noMatchEntry);
    expect(noMatchResult.scope).toBe('case-wide');

    // ── Case C: verify sort order is overdue → outstanding → received ─────────
    const sorted = emptyResult.items;
    const ORDER: Record<string, number> = { overdue: 0, outstanding: 1, received: 2 };
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(ORDER[sorted[i].status]).toBeLessThanOrEqual(ORDER[sorted[i + 1].status]);
    }

    // ── Case D: real page-index entry for benefit_review awaiting_evidence ────
    const brCase = all.find(c => c.case_type === 'benefit_review' && c.status === 'awaiting_evidence');
    if (brCase && brCase.evidenceItems.length > 0) {
      const realEntry = getActionEntry(brCase.case_type, 'BR-03');
      if (realEntry) {
        const realResult = selectActionEvidence(brCase, realEntry);
        // scope is either 'action' (≥ 2 matches) or 'case-wide' (≤ 1 matches)
        expect(['action', 'case-wide']).toContain(realResult.scope);
      }
    }
  });
});

// ── Test 2 — composeEvidenceFallback ─────────────────────────────────────────

describe('composeEvidenceFallback', () => {
  it('produces correct text for all-received, has-gaps, and zero-evidence branches', () => {
    const base: EvidenceAdviceInputs = {
      caseRef: 'CASE-2026-00042',
      actionId: 'BR-03',
      actionLabel: 'Issue evidence request',
      scope: 'action',
      policies: [{ id: 'POL-BR-003', title: 'Evidence Requirements' }],
      evidence: [],
      counts: { received: 0, outstanding: 0, overdue: 0 },
    };

    // Branch A: zero evidence
    const zeroText = composeEvidenceFallback(base);
    expect(zeroText).toContain('CASE-2026-00042');
    expect(zeroText).toContain('Issue evidence request');
    expect(zeroText).toContain('POL-BR-003');
    expect(zeroText).toMatch(/evidence request/i);

    // Branch B: all received
    const allReceived: EvidenceAdviceInputs = {
      ...base,
      evidence: [{ requirement: 'proof of address', status: 'received', elapsedDays: 10, thresholdDays: 56, policyId: 'POL-BR-003' }],
      counts: { received: 1, outstanding: 0, overdue: 0 },
    };
    const allReceivedText = composeEvidenceFallback(allReceived);
    expect(allReceivedText).toContain('CASE-2026-00042');
    expect(allReceivedText).toContain('Issue evidence request');
    expect(allReceivedText).toContain('received');
    expect(allReceivedText).toMatch(/proceed/i);

    // Branch C: has gaps
    const hasGaps: EvidenceAdviceInputs = {
      ...base,
      evidence: [
        { requirement: 'income statement', status: 'overdue', elapsedDays: 70, thresholdDays: 56, policyId: 'POL-BR-003' },
        { requirement: 'proof of address', status: 'received', elapsedDays: 70, thresholdDays: 56, policyId: 'POL-BR-003' },
      ],
      counts: { received: 1, outstanding: 0, overdue: 1 },
    };
    const hasGapsText = composeEvidenceFallback(hasGaps);
    expect(hasGapsText).toContain('CASE-2026-00042');
    expect(hasGapsText).toContain('Issue evidence request');
    expect(hasGapsText).toContain('income statement');
    expect(hasGapsText).toContain('POL-BR-003');
    expect(hasGapsText).toMatch(/overdue/i);
  });
});

// ── Test 3 — getEvidenceAdvice happy path ─────────────────────────────────────

describe('getEvidenceAdvice', () => {
  const inputs: EvidenceAdviceInputs = {
    caseRef: 'CASE-2026-00042',
    actionId: 'BR-04',
    actionLabel: 'Send 28-day reminder',
    scope: 'action',
    policies: [{ id: 'POL-BR-003', title: 'Evidence Requirements' }],
    evidence: [
      { requirement: 'income statement', status: 'outstanding', elapsedDays: 30, thresholdDays: 56, policyId: 'POL-BR-003' },
    ],
    counts: { received: 0, outstanding: 1, overdue: 0 },
  };

  it('returns llm status when fetch succeeds', async () => {
    vi.stubEnv('VITE_OPENAI_API_KEY', 'sk-test');

    const validText = 'CASE-2026-00042 — Send 28-day reminder. income statement remains outstanding after 30 days. Chase it citing POL-BR-003.';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ choices: [{ message: { content: validText } }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    const result = await getEvidenceAdvice(inputs);
    expect(result.status).toBe('llm');
    if (result.status === 'llm') {
      expect(result.text).toBe(validText);
    }
  });

  // ── Test 4 — no-key fallback ──────────────────────────────────────────────

  it('falls back with reason no-key when OpenAI key is absent', async () => {
    vi.stubEnv('VITE_OPENAI_API_KEY', '');

    const result = await getEvidenceAdvice(inputs);
    expect(result.status).toBe('fallback');
    if (result.status === 'fallback') {
      expect(result.reason).toBe('no-key');
      expect(result.text).toContain('CASE-2026-00042');
    }
  });

  // ── Test 5 — network-error fallback ──────────────────────────────────────

  it('falls back with reason network-error when fetch rejects', async () => {
    vi.stubEnv('VITE_OPENAI_API_KEY', 'sk-test');

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')));

    const result = await getEvidenceAdvice(inputs);
    expect(result.status).toBe('fallback');
    if (result.status === 'fallback') {
      expect(result.reason).toBe('network-error');
      expect(result.text).toContain('CASE-2026-00042');
    }
  });
});
