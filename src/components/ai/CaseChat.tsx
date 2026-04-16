/**
 * Case Chat Assistant component.
 * Renders above the Timeline on Case Detail.
 * States:
 *   1. Collapsed trigger (default): input + 4 suggestion chips
 *   2. Expanded with conversation
 *   3. Expanded but empty (chips remain visible)
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import type { EnrichedCase, PolicyExtract, ChatMessage } from '../../types/case';
import { buildCaseContext, sendCaseChatMessage } from '../../services/caseChat';

interface Props {
  enriched: EnrichedCase;
  policies: PolicyExtract[];
}

const SEED_CHIPS = [
  'Summarise this case',
  "What's overdue?",
  'Explain applicable policy',
  "What's the next action?",
] as const;

const TURN_CAP = 20;

export default function CaseChat({ enriched, policies }: Props) {
  const storageKey = `case-chat:${enriched.case_id}`;

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as ChatMessage[]) : [];
    } catch {
      return [];
    }
  });

  const [input, setInput] = useState('');

  const [isExpanded, setIsExpanded] = useState(() => {
    try {
      const raw = sessionStorage.getItem(`case-chat:${enriched.case_id}`);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) && parsed.length > 0;
    } catch {
      return false;
    }
  });

  const [isLoading, setIsLoading] = useState(false);

  const caseContext = useMemo(
    () => buildCaseContext(enriched, policies),
    [enriched, policies],
  );

  // Reset when caseId changes (e.g. navigating between cases)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      setMessages(Array.isArray(parsed) ? (parsed as ChatMessage[]) : []);
      setIsExpanded(Array.isArray(parsed) && parsed.length > 0);
    } catch {
      setMessages([]);
      setIsExpanded(false);
    }
  }, [storageKey]);

  // Persist on change
  useEffect(() => {
    if (messages.length === 0) {
      sessionStorage.removeItem(storageKey);
    } else {
      sessionStorage.setItem(storageKey, JSON.stringify(messages));
    }
  }, [storageKey, messages]);

  const listEndRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    listEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages.length, isLoading]);

  async function sendAndAppend(history: ChatMessage[]) {
    setIsLoading(true);
    try {
      const reply = await sendCaseChatMessage(caseContext, history);
      setMessages([...history, { role: 'assistant', content: reply }]);
    } catch {
      setMessages([
        ...history,
        {
          role: 'assistant',
          content: "Couldn't reach the assistant. Retry?",
          status: 'error',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  const atCap = messages.length >= TURN_CAP;

  async function submit(content: string) {
    const trimmed = content.trim();
    if (!trimmed || isLoading || atCap) return;
    setIsExpanded(true);
    setInput('');
    const next: ChatMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(next);
    await sendAndAppend(next);
  }

  async function retry() {
    if (isLoading) return;
    // Drop the trailing error bubble; resend with the user turns that remain.
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'assistant' || last.status !== 'error') return;
    const historyWithoutError = messages.slice(0, -1);
    setMessages(historyWithoutError);
    await sendAndAppend(historyWithoutError);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit(input);
    }
  }

  const showConversation = isExpanded && messages.length > 0;

  return (
    <div className="bg-white rounded shadow-sm px-5 py-4">
      <label className="block text-sm font-bold text-gray-800 mb-2" htmlFor="case-chat-input">
        Ask about this case
      </label>

      {showConversation && (
        <div
          role="log"
          aria-live="polite"
          className="mb-3 max-h-[480px] overflow-y-auto space-y-2 border rounded p-3"
        >
          {messages.map((m, i) => (
            <div
              key={i}
              className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
            >
              <div
                className={
                  m.role === 'user'
                    ? 'max-w-[80%] rounded px-3 py-2 text-sm bg-white border border-[#1d70b8] text-gray-900'
                    : m.status === 'error'
                      ? 'max-w-[80%] rounded px-3 py-2 text-sm bg-[#fde8e8] text-[#d4351c]'
                      : 'max-w-[80%] rounded px-3 py-2 text-sm bg-[#f3f2f1] text-gray-800'
                }
              >
                {m.content}
                {m.status === 'error' && (
                  <button
                    type="button"
                    onClick={() => void retry()}
                    className="ml-2 underline font-semibold focus:outline-none focus:ring-[3px] focus:ring-[#ffdd00] rounded"
                    aria-label={`Retry: ${
                      messages[i - 1]?.content?.slice(0, 40) ?? 'previous message'
                    }`}
                  >
                    Retry
                  </button>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded px-3 py-2 text-sm bg-[#f3f2f1] text-gray-500 animate-pulse">
                Assistant is thinking…
              </div>
            </div>
          )}
          <div ref={listEndRef} />
        </div>
      )}

      {atCap && (
        <div className="mb-2 text-xs px-3 py-2 rounded bg-[#fff9e6] text-[#6d4000]">
          Conversation limit reached — collapse and reopen to start a new thread.
        </div>
      )}

      <input
        id="case-chat-input"
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isLoading || atCap}
        placeholder="e.g. What evidence is outstanding?"
        className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-[3px] focus:ring-[#ffdd00] disabled:bg-gray-50"
      />

      {!showConversation && (
        <div className="flex flex-wrap gap-2 mt-3">
          {SEED_CHIPS.map(chip => (
            <button
              key={chip}
              type="button"
              onClick={() => void submit(chip)}
              className="text-xs px-3 py-1.5 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-[3px] focus:ring-[#ffdd00]"
            >
              {chip}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
