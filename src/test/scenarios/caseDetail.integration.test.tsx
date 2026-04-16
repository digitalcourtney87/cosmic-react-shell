/**
 * Layer 1 — Scenario integration tests.
 * Mounts CaseDetail with real fixtures and asserts observable UI output.
 * Each test covers a full pipeline-to-UI journey: raw case data → derivations → rendered page.
 * Queries by accessible role/label only — not by component structure or prop names.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CaseDetail from '../../pages/CaseDetail';

// Prevent real network calls from the GOV.UK guidance panel
vi.mock('../../services/govuk', () => ({
  fetchGovUKGuidance: vi.fn().mockResolvedValue([]),
}));

function renderCase(caseId: string) {
  return render(
    <MemoryRouter initialEntries={[`/case/${caseId}`]}>
      <Routes>
        <Route path="/case/:caseId" element={<CaseDetail />} />
        <Route path="/" element={<div>Caseload</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CaseDetail — scenario integration tests', () => {

  // ── Not found ────────────────────────────────────────────────────────────────

  it('unknown case id → "Case not found" heading is shown', () => {
    renderCase('CASE-UNKNOWN-99999');
    expect(screen.getByRole('heading', { name: /case not found/i })).toBeInTheDocument();
  });

  // ── CASE-2026-00042: benefit_review / awaiting_evidence / overdue 91 days ───

  it('CASE-2026-00042: critical risk badge is visible in the case header', () => {
    renderCase('CASE-2026-00042');
    // shared/RiskBadge renders: aria-label="Risk level Critical, score X of 10"
    expect(screen.getByRole('button', { name: /risk level critical/i })).toBeInTheDocument();
  });

  it('CASE-2026-00042: evidence tracker shows at least one overdue item', () => {
    renderCase('CASE-2026-00042');
    // rendered as "⚠️ Overdue" — use regex to match
    const overdueLabels = screen.getAllByText(/Overdue/);
    expect(overdueLabels.length).toBeGreaterThan(0);
  });

  it('CASE-2026-00042: required actions panel includes a critical-severity action', () => {
    renderCase('CASE-2026-00042');
    // action.severity is rendered as text inside each action card
    const criticalTags = screen.getAllByText(/critical/i);
    expect(criticalTags.length).toBeGreaterThan(0);
  });

  // ── CASE-2026-00133: benefit_review / pending_decision / all evidence received

  it('CASE-2026-00133: no overdue evidence items are shown', () => {
    renderCase('CASE-2026-00133');
    expect(screen.queryByText(/Overdue/)).not.toBeInTheDocument();
  });

  it('CASE-2026-00133: page renders with a visible applicant heading', () => {
    renderCase('CASE-2026-00133');
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toBeTruthy();
  });

  // ── CASE-2026-00172: licence_application / closed ─────────────────────────

  it('CASE-2026-00172: closed status pill is visible', () => {
    renderCase('CASE-2026-00172');
    // 'Closed' appears in status pill and workflow state label
    expect(screen.getAllByText('Closed').length).toBeGreaterThan(0);
  });

  // ── CASE-2026-00107: compliance_check / escalated ─────────────────────────

  it('CASE-2026-00107: escalated case renders and shows "Escalated" status', () => {
    renderCase('CASE-2026-00107');
    // fmt('escalated') = 'Escalated' — may appear in status pill and workflow panel
    const escalatedLabels = screen.getAllByText('Escalated');
    expect(escalatedLabels.length).toBeGreaterThan(0);
  });

});
