/**
 * Case Chat Assistant — service tests.
 * buildCaseContext is a pure derivation over EnrichedCase.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildCaseContext, sendCaseChatMessage } from '../services/caseChat';
import { getAllEnrichedCases, getPoliciesForCase } from '../services/cases';
import { REFERENCE_DATE } from '../lib/constants';
import type { StructuredCaseContext, ChatMessage } from '../types/case';

afterEach(() => {
  vi.unstubAllGlobals();
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
  it('POSTs to the edge function and returns the assistant text on 200', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ text: 'Hello there.' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'anon-key');

    const text = await sendCaseChatMessage(stubContext, stubMessages);
    expect(text).toBe('Hello there.');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://example.supabase.co/functions/v1/case-chat');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.caseContext.caseId).toBe('CASE-TEST-001');
    expect(body.messages).toEqual(stubMessages);
  });

  it('throws when the edge function returns non-200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'boom' }), { status: 502 }),
      ),
    );
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'anon-key');

    await expect(sendCaseChatMessage(stubContext, stubMessages)).rejects.toThrow();
  });

  it('throws when the edge function returns 200 with empty text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ text: '' }), { status: 200 }),
      ),
    );
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'anon-key');

    await expect(sendCaseChatMessage(stubContext, stubMessages)).rejects.toThrow();
  });

  it('throws when fetch rejects (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'anon-key');

    await expect(sendCaseChatMessage(stubContext, stubMessages)).rejects.toThrow();
  });

  it('throws when VITE_SUPABASE_URL is missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'anon-key');
    await expect(sendCaseChatMessage(stubContext, stubMessages)).rejects.toThrow();
  });

  it('throws when both anon-key env vars are missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    await expect(sendCaseChatMessage(stubContext, stubMessages)).rejects.toThrow();
  });

  it('uses VITE_SUPABASE_ANON_KEY when VITE_SUPABASE_PUBLISHABLE_KEY is absent', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ text: 'ok' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key-via-fallback');

    await sendCaseChatMessage(stubContext, stubMessages);

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.apikey).toBe('anon-key-via-fallback');
    expect(init.headers.Authorization).toBe('Bearer anon-key-via-fallback');
  });

  it('aborts and throws when the fetch never resolves within timeout', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation((_url, init) => {
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'anon-key');

    const promise = sendCaseChatMessage(stubContext, stubMessages);
    vi.advanceTimersByTime(21_000);
    await expect(promise).rejects.toThrow();
    vi.useRealTimers();
  });
});
