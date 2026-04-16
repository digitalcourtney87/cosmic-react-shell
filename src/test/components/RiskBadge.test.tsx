/**
 * Layer 3 — RiskBadge unit tests.
 * The shared RiskBadge has non-trivial conditional logic: label, ARIA, and score display
 * all vary by risk level. Tests are isolated from the pipeline.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RiskBadge from '../../components/shared/RiskBadge';
import type { RiskScore } from '../../types/case';

const critical: RiskScore = { score: 9, level: 'critical', factors: ['1 evidence item overdue'] };
const warning: RiskScore = { score: 5, level: 'warning', factors: ['approaching threshold'] };
const normal: RiskScore = { score: 1, level: 'normal', factors: [] };

describe('RiskBadge', () => {
  it('critical — button has correct aria-label including score', () => {
    render(<RiskBadge risk={critical} />);
    expect(
      screen.getByRole('button', { name: /risk level critical, score 9 of 10/i }),
    ).toBeInTheDocument();
  });

  it('warning — button has correct aria-label including score', () => {
    render(<RiskBadge risk={warning} />);
    expect(
      screen.getByRole('button', { name: /risk level warning, score 5 of 10/i }),
    ).toBeInTheDocument();
  });

  it('normal — button has correct aria-label including score', () => {
    render(<RiskBadge risk={normal} />);
    expect(
      screen.getByRole('button', { name: /risk level normal, score 1 of 10/i }),
    ).toBeInTheDocument();
  });

  it('score is visible by default', () => {
    render(<RiskBadge risk={critical} />);
    expect(screen.getByText('9/10')).toBeInTheDocument();
  });

  it('score is hidden when showScore=false', () => {
    render(<RiskBadge risk={critical} showScore={false} />);
    expect(screen.queryByText('9/10')).not.toBeInTheDocument();
  });
});
