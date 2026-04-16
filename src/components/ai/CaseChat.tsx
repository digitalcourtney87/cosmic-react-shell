/**
 * Case Chat Assistant component.
 * Renders above the Timeline on Case Detail.
 * States:
 *   1. Collapsed trigger (default): input + 4 suggestion chips
 *   2. Expanded with conversation (Task 6+)
 *   3. Expanded but empty (Task 6+)
 */

import { useState } from 'react';
import type { EnrichedCase, PolicyExtract, ChatMessage } from '../../types/case';

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

export default function CaseChat({ enriched, policies }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  // State 1 — Collapsed
  return (
    <div className="bg-white rounded shadow-sm px-5 py-4">
      <label className="block text-sm font-bold text-gray-800 mb-2" htmlFor="case-chat-input">
        Ask about this case
      </label>
      <input
        id="case-chat-input"
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="e.g. What evidence is outstanding?"
        className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-[3px] focus:ring-[#ffdd00]"
      />
      <div className="flex flex-wrap gap-2 mt-3">
        {SEED_CHIPS.map(chip => (
          <button
            key={chip}
            type="button"
            className="text-xs px-3 py-1.5 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-[3px] focus:ring-[#ffdd00]"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}
