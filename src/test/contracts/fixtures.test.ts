/**
 * Layer 2 — Fixture contract tests.
 * Validates all JSON fixture files against Zod schemas that mirror the TypeScript types.
 * Any field rename, type change, or structural drift in the JSON files will fail here
 * before it silently corrupts derived risk scores or evidence status.
 */

import { describe, it, expect } from 'vitest';
import casesRaw from '../../challenge-3/cases.json';
import policiesRaw from '../../challenge-3/policy-extracts.json';
import workflowRaw from '../../challenge-3/workflow-states.json';
import pageIndexRaw from '../../challenge-3/page-index.json';
import {
  CaseSchema,
  PolicyExtractSchema,
  WorkflowDataSchema,
  PageIndexEntrySchema,
} from './case.schema';

describe('Fixture contracts', () => {
  it('cases.json — every entry matches the Case schema', () => {
    for (const c of casesRaw) {
      const result = CaseSchema.safeParse(c);
      expect(
        result.success,
        `${(c as { case_id?: string }).case_id}: ${!result.success ? result.error.message : ''}`,
      ).toBe(true);
    }
  });

  it('cases.json — contains at least one entry', () => {
    expect(casesRaw.length).toBeGreaterThan(0);
  });

  it('policy-extracts.json — every entry matches the PolicyExtract schema', () => {
    for (const p of policiesRaw) {
      const result = PolicyExtractSchema.safeParse(p);
      expect(
        result.success,
        `${(p as { policy_id?: string }).policy_id}: ${!result.success ? result.error.message : ''}`,
      ).toBe(true);
    }
  });

  it('workflow-states.json — matches the WorkflowData schema', () => {
    const result = WorkflowDataSchema.safeParse(workflowRaw);
    expect(result.success, !result.success ? result.error.message : '').toBe(true);
  });

  it('page-index.json — every entry matches the PageIndexEntry schema', () => {
    for (const entry of pageIndexRaw) {
      const result = PageIndexEntrySchema.safeParse(entry);
      expect(
        result.success,
        `${(entry as { case_type?: string }).case_type}: ${!result.success ? result.error.message : ''}`,
      ).toBe(true);
    }
  });
});
