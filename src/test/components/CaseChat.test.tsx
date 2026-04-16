/**
 * CaseChat component tests.
 * Network stubbed with vi.stubGlobal('fetch', ...).
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CaseChat from '../../components/ai/CaseChat';
import { getAllEnrichedCases, getPoliciesForCase } from '../../services/cases';

const enriched = getAllEnrichedCases()[0];
const relevantPolicies = getPoliciesForCase(enriched.case_type);

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe('CaseChat — State 1 (collapsed)', () => {
  it('renders the collapsed trigger with input and four chips', () => {
    render(<CaseChat enriched={enriched} policies={relevantPolicies} />);

    expect(
      screen.getByRole('textbox', { name: /ask about this case/i }),
    ).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /summarise this case/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /what's overdue\?/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /explain applicable policy/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /what's the next action\?/i })).toBeInTheDocument();
  });
});
