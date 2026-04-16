/**
 * CaseChat component tests.
 * Network stubbed by mocking supabase.functions.invoke.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CaseChat from '../../components/ai/CaseChat';
import { getAllEnrichedCases, getPoliciesForCase } from '../../services/cases';
import { supabase } from '../../integrations/supabase/client';
import { spyInvoke, invokeOk, invokeNetworkError } from '../helpers/invoke';
import type { ChatMessage } from '../../types/case';

void supabase; // initialise client before spying on FunctionsClient

const enriched = getAllEnrichedCases()[0];
const relevantPolicies = getPoliciesForCase(enriched.case_type);

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

function mockInvokeOk(text: string) {
  return spyInvoke().mockReturnValue(invokeOk(text) as never);
}

function mockInvokeError() {
  return spyInvoke().mockReturnValue(invokeNetworkError('offline') as never);
}

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
  it('clicking a chip expands, renders user bubble, calls ai-proxy, renders assistant bubble', async () => {
    const user = userEvent.setup();
    const invokeSpy = mockInvokeOk('Three items are outstanding.');

    render(<CaseChat enriched={enriched} policies={relevantPolicies} />);

    await user.click(screen.getByRole('button', { name: /what's overdue\?/i }));

    expect(screen.getByText("What's overdue?")).toBeInTheDocument();

    await waitFor(() => expect(invokeSpy).toHaveBeenCalledTimes(1));
    const [name, opts] = invokeSpy.mock.calls[0];
    expect(name).toBe('ai-proxy');
    const body = (opts as { body: { messages: { role: string; content: string }[] } }).body;
    expect(body.messages[0].role).toBe('system');
    const last = body.messages[body.messages.length - 1];
    expect(last.role).toBe('user');
    expect(last.content).toContain("What's overdue?");
    expect(last.content).toContain(enriched.case_id);

    await waitFor(() =>
      expect(screen.getByText('Three items are outstanding.')).toBeInTheDocument(),
    );
  });

  it('typing in the input and pressing Enter submits the message', async () => {
    const user = userEvent.setup();
    mockInvokeOk('OK.');

    render(<CaseChat enriched={enriched} policies={relevantPolicies} />);

    const input = screen.getByRole('textbox', { name: /ask about this case/i });
    await user.type(input, 'what happened in march?{Enter}');

    await waitFor(() =>
      expect(screen.getByText('what happened in march?')).toBeInTheDocument(),
    );
  });
});

describe('CaseChat — error and retry', () => {
  it('renders an error bubble with a Retry button on invoke failure', async () => {
    const user = userEvent.setup();
    mockInvokeError();

    render(<CaseChat enriched={enriched} policies={relevantPolicies} />);
    await user.click(screen.getByRole('button', { name: /what's overdue\?/i }));

    await waitFor(() =>
      expect(screen.getByText(/couldn't reach the assistant/i)).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('clicking Retry re-sends the same user message and replaces the error on success', async () => {
    const user = userEvent.setup();
    const invokeSpy = vi
      .spyOn(supabase.functions, 'invoke')
      .mockResolvedValueOnce({ data: null, error: new Error('offline') } as never)
      .mockResolvedValueOnce({ data: { text: 'Here is the answer.' }, error: null } as never);

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
    expect(invokeSpy).toHaveBeenCalledTimes(2);
  });
});

describe('CaseChat — session persistence', () => {
  it('persists messages to sessionStorage keyed by case_id', async () => {
    const user = userEvent.setup();
    mockInvokeOk('Persisted reply.');

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

describe('CaseChat — turn cap', () => {
  it('disables the input and shows a limit notice at 20 messages', () => {
    const full: ChatMessage[] = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `msg ${i}`,
    }));
    sessionStorage.setItem(`case-chat:${enriched.case_id}`, JSON.stringify(full));

    render(<CaseChat enriched={enriched} policies={relevantPolicies} />);

    const input = screen.getByRole('textbox', { name: /ask about this case/i });
    expect(input).toBeDisabled();
    expect(screen.getByText(/conversation limit reached/i)).toBeInTheDocument();
  });
});

describe('CaseChat — defensive guards', () => {
  it('mounts in collapsed State 1 when sessionStorage is empty (no conversation log)', () => {
    render(<CaseChat enriched={enriched} policies={relevantPolicies} />);
    expect(screen.queryByRole('log')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /summarise this case/i })).toBeInTheDocument();
  });

  it('ignores non-array JSON in sessionStorage and mounts in State 1', () => {
    sessionStorage.setItem(
      `case-chat:${enriched.case_id}`,
      JSON.stringify({ not: 'array' }),
    );

    render(<CaseChat enriched={enriched} policies={relevantPolicies} />);

    expect(screen.queryByRole('log')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /summarise this case/i })).toBeInTheDocument();
  });

  it('ignores corrupted (unparseable) sessionStorage JSON and mounts in State 1', () => {
    sessionStorage.setItem(
      `case-chat:${enriched.case_id}`,
      'this is not valid json{{{',
    );

    render(<CaseChat enriched={enriched} policies={relevantPolicies} />);

    expect(screen.queryByRole('log')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /summarise this case/i })).toBeInTheDocument();
  });

  it('does not submit when the input contains only whitespace', async () => {
    const user = userEvent.setup();
    const invokeSpy = vi.spyOn(supabase.functions, 'invoke');

    render(<CaseChat enriched={enriched} policies={relevantPolicies} />);

    const input = screen.getByRole('textbox', { name: /ask about this case/i });
    await user.type(input, '   {Enter}');

    expect(invokeSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole('log')).not.toBeInTheDocument();
  });

  it('ignores a second submit while a request is in flight', async () => {
    const user = userEvent.setup();
    const invokeSpy = vi
      .spyOn(supabase.functions, 'invoke')
      .mockImplementation(() => new Promise(() => {}) as never);

    render(<CaseChat enriched={enriched} policies={relevantPolicies} />);

    await user.click(screen.getByRole('button', { name: /summarise this case/i }));

    await waitFor(() => expect(invokeSpy).toHaveBeenCalledTimes(1));

    const input = screen.getByRole('textbox', { name: /ask about this case/i });
    await user.type(input, 'second question{Enter}');

    expect(invokeSpy).toHaveBeenCalledTimes(1);
  });

  it('does not render a Retry button when the last assistant message succeeded', () => {
    sessionStorage.setItem(
      `case-chat:${enriched.case_id}`,
      JSON.stringify([
        { role: 'user', content: 'q' },
        { role: 'assistant', content: 'a' },
      ]),
    );

    render(<CaseChat enriched={enriched} policies={relevantPolicies} />);

    expect(screen.getByText('q')).toBeInTheDocument();
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  });

  it('filters out turns with non-string content in stored messages', () => {
    sessionStorage.setItem(
      `case-chat:${enriched.case_id}`,
      JSON.stringify([
        { role: 'user', content: 'valid' },
        { role: 'user', content: { oops: 'object' } },
        { role: 'assistant', content: 'also valid' },
      ]),
    );
    render(<CaseChat enriched={enriched} policies={relevantPolicies} />);
    expect(screen.getByText('valid')).toBeInTheDocument();
    expect(screen.getByText('also valid')).toBeInTheDocument();
    expect(screen.queryByText(/oops/i)).not.toBeInTheDocument();
  });

  it('ignores a second Retry click while the retried request is in flight', async () => {
    const user = userEvent.setup();
    sessionStorage.setItem(
      `case-chat:${enriched.case_id}`,
      JSON.stringify([
        { role: 'user', content: 'q' },
        { role: 'assistant', content: "Couldn't reach the assistant. Retry?", status: 'error' },
      ]),
    );

    const invokeSpy = vi
      .spyOn(supabase.functions, 'invoke')
      .mockImplementation(() => new Promise(() => {}) as never);

    render(<CaseChat enriched={enriched} policies={relevantPolicies} />);

    const retryButton = screen.getByRole('button', { name: /retry/i });
    await user.click(retryButton);

    await waitFor(() => expect(invokeSpy).toHaveBeenCalledTimes(1));

    const stillRetry = screen.queryByRole('button', { name: /retry/i });
    if (stillRetry) {
      await user.click(stillRetry);
    }

    expect(invokeSpy).toHaveBeenCalledTimes(1);
  });
});

describe('CaseChat — collapse', () => {
  it('Collapse button returns to State 1 without clearing messages', async () => {
    const user = userEvent.setup();
    sessionStorage.setItem(
      `case-chat:${enriched.case_id}`,
      JSON.stringify([
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi back' },
      ]),
    );

    render(<CaseChat enriched={enriched} policies={relevantPolicies} />);

    expect(screen.getByText('hello')).toBeInTheDocument();
    const collapseBtn = screen.getByRole('button', { name: /collapse/i });

    await user.click(collapseBtn);

    expect(screen.queryByText('hello')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /summarise this case/i })).toBeInTheDocument();

    const stored = sessionStorage.getItem(`case-chat:${enriched.case_id}`);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored as string).length).toBe(2);
  });

  it('focusing the input re-expands to show the conversation', async () => {
    const user = userEvent.setup();
    sessionStorage.setItem(
      `case-chat:${enriched.case_id}`,
      JSON.stringify([
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi back' },
      ]),
    );
    render(<CaseChat enriched={enriched} policies={relevantPolicies} />);

    await user.click(screen.getByRole('button', { name: /collapse/i }));
    expect(screen.queryByText('hello')).not.toBeInTheDocument();

    const input = screen.getByRole('textbox', { name: /ask about this case/i });
    await user.click(input); // triggers focus
    expect(screen.getByText('hello')).toBeInTheDocument();
  });
});
