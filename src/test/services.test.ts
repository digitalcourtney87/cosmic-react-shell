/**
 * Stream A — derivation logic tests.
 * Four fixture-driven tests only, per the constitution (Principle VI).
 * All fixtures read from the real cases.json — no synthetic data.
 */

import { describe, it, expect } from 'vitest';
import { cases, policies, getWorkflowState, pageIndex } from '../services/cases';
import { deriveEvidenceStatus, calculateRiskScore, getRequiredNextActions } from '../lib/derive';

// ── Test 1 ────────────────────────────────────────────────────────────────────
// CASE-2026-00133: benefit_review, pending_decision.
// Timeline note reads "All three documents received and verified."
// Every derived evidence item should have status 'received'.

describe('deriveEvidenceStatus', () => {
  it('all evidence received → every item has status "received"', () => {
    const c = cases.find(x => x.case_id === 'CASE-2026-00133')!;
    const casePolicies = policies.filter(p => p.applicable_case_types.includes(c.case_type));
    const ws = getWorkflowState(c.case_type, c.status);
    const items = deriveEvidenceStatus(c, casePolicies, ws ?? null);

    expect(items.length).toBeGreaterThan(0);
    expect(items.every(i => i.status === 'received')).toBe(true);
  });

// ── Test 2 ────────────────────────────────────────────────────────────────────
// CASE-2026-00042: benefit_review, awaiting_evidence.
// Evidence was requested on 2026-01-15; REFERENCE_DATE is 2026-04-16 → 91 days elapsed.
// The awaiting_evidence escalation threshold is 56 days.
// At least one item (income statement) must be 'overdue'.

  it('evidence requested past 56-day threshold → at least one item is "overdue"', () => {
    const c = cases.find(x => x.case_id === 'CASE-2026-00042')!;
    const casePolicies = policies.filter(p => p.applicable_case_types.includes(c.case_type));
    const ws = getWorkflowState(c.case_type, c.status);
    const items = deriveEvidenceStatus(c, casePolicies, ws ?? null);

    expect(items.some(i => i.status === 'overdue')).toBe(true);
  });
});

// ── Test 3 ────────────────────────────────────────────────────────────────────
// CASE-2026-00042 again: 96 days old (> 56-day threshold) + overdue evidence.
// Risk score must compute to level 'critical'.

describe('calculateRiskScore', () => {
  it('past escalation threshold + overdue evidence → level "critical"', () => {
    const c = cases.find(x => x.case_id === 'CASE-2026-00042')!;
    const casePolicies = policies.filter(p => p.applicable_case_types.includes(c.case_type));
    const ws = getWorkflowState(c.case_type, c.status);
    const items = deriveEvidenceStatus(c, casePolicies, ws ?? null);
    const risk = calculateRiskScore(c, items, ws ?? null);

    expect(items.some(i => i.status === 'overdue')).toBe(true);
    expect(risk.level).toBe('critical');
  });
});

// ── Test 4 ────────────────────────────────────────────────────────────────────
// CASE-2026-00042: income statement overdue by 35 days past the 56-day threshold.
// getRequiredNextActions must surface at least one action with severity 'critical'.

describe('getRequiredNextActions', () => {
  it('overdue evidence → at least one action with severity "critical"', () => {
    const c = cases.find(x => x.case_id === 'CASE-2026-00042')!;
    const casePolicies = policies.filter(p => p.applicable_case_types.includes(c.case_type));
    const ws = getWorkflowState(c.case_type, c.status);
    const items = deriveEvidenceStatus(c, casePolicies, ws ?? null);
    const actions = getRequiredNextActions(c, items, ws ?? null, pageIndex);

    expect(actions.some(a => a.severity === 'critical')).toBe(true);
  });
});
