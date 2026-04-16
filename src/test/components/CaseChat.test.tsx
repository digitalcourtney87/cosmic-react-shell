/**
 * CaseChat component tests.
 * Network stubbed with vi.stubGlobal('fetch', ...).
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

describe('CaseChat — chip submit → assistant reply', () => {
  it('clicking a chip expands, renders user bubble, POSTs to edge function, renders assistant bubble', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ text: 'Three items are outstanding.' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'anon-key');

    render(<CaseChat enriched={enriched} policies={relevantPolicies} />);

    await user.click(screen.getByRole('button', { name: /what's overdue\?/i }));

    // user bubble appears immediately
    expect(screen.getByText("What's overdue?")).toBeInTheDocument();

    // fetch was called once with the expected body
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.messages).toEqual([{ role: 'user', content: "What's overdue?" }]);
    expect(body.caseContext.caseId).toBe(enriched.case_id);

    // assistant bubble arrives after fetch resolves
    await waitFor(() =>
      expect(screen.getByText('Three items are outstanding.')).toBeInTheDocument(),
    );
  });

  it('typing in the input and pressing Enter submits the message', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ text: 'OK.' }), { status: 200 }),
      ),
    );
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'anon-key');

    render(<CaseChat enriched={enriched} policies={relevantPolicies} />);

    const input = screen.getByRole('textbox', { name: /ask about this case/i });
    await user.type(input, 'what happened in march?{Enter}');

    await waitFor(() =>
      expect(screen.getByText('what happened in march?')).toBeInTheDocument(),
    );
  });
});
