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

describe('CaseChat — error and retry', () => {
  it('renders an error bubble with a Retry button on fetch failure', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'anon-key');

    render(<CaseChat enriched={enriched} policies={relevantPolicies} />);
    await user.click(screen.getByRole('button', { name: /what's overdue\?/i }));

    await waitFor(() =>
      expect(screen.getByText(/couldn't reach the assistant/i)).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('clicking Retry re-sends the same user message and replaces the error on success', async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ text: 'Here is the answer.' }), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'anon-key');

    render(<CaseChat enriched={enriched} policies={relevantPolicies} />);
    await user.click(screen.getByRole('button', { name: /what's overdue\?/i }));

    await waitFor(() =>
      expect(screen.getByText(/couldn't reach the assistant/i)).toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() =>
      expect(screen.getByText('Here is the answer.')).toBeInTheDocument(),
    );
    expect(screen.queryByText(/couldn't reach the assistant/i)).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('CaseChat — session persistence', () => {
  it('persists messages to sessionStorage keyed by case_id', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ text: 'Persisted reply.' }), { status: 200 }),
      ),
    );
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'anon-key');

    render(<CaseChat enriched={enriched} policies={relevantPolicies} />);
    await user.click(screen.getByRole('button', { name: /summarise this case/i }));
    await waitFor(() =>
      expect(screen.getByText('Persisted reply.')).toBeInTheDocument(),
    );

    const stored = sessionStorage.getItem(`case-chat:${enriched.case_id}`);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored as string);
    expect(parsed.length).toBe(2);
    expect(parsed[0].content).toBe('Summarise this case');
  });

  it('hydrates from sessionStorage on mount', () => {
    sessionStorage.setItem(
      `case-chat:${enriched.case_id}`,
      JSON.stringify([
        { role: 'user', content: 'earlier question' },
        { role: 'assistant', content: 'earlier answer' },
      ]),
    );

    render(<CaseChat enriched={enriched} policies={relevantPolicies} />);
    expect(screen.getByText('earlier question')).toBeInTheDocument();
    expect(screen.getByText('earlier answer')).toBeInTheDocument();
  });

  it('resets to empty on case_id change', () => {
    sessionStorage.setItem(
      `case-chat:${enriched.case_id}`,
      JSON.stringify([{ role: 'user', content: 'A' }, { role: 'assistant', content: 'B' }]),
    );
    const other = getAllEnrichedCases()[1];

    const { rerender } = render(
      <CaseChat enriched={enriched} policies={relevantPolicies} />,
    );
    expect(screen.getByText('A')).toBeInTheDocument();

    rerender(<CaseChat enriched={other} policies={[]} />);
    expect(screen.queryByText('A')).not.toBeInTheDocument();
  });
});
