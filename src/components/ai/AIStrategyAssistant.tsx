import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import type { EnrichedCase } from '../../types/case';
import { policies, pageIndex } from '../../services/cases';
import { computeTriageCounts, selectPriorityCase } from '../../services/ai';
import TriageSummary from './TriageSummary';
import PriorityInsight from './PriorityInsight';

type Props = { filtered: EnrichedCase[] };

const PANEL_ID = 'ai-strategy-assistant-body';

export default function AIStrategyAssistant({ filtered }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const counts = useMemo(() => computeTriageCounts(filtered), [filtered]);
  const inputs = useMemo(
    () => selectPriorityCase(filtered, policies, pageIndex),
    [filtered],
  );

  if (collapsed) {
    return (
      <aside className="self-start">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-expanded={false}
          aria-controls={PANEL_ID}
          aria-label="Expand AI Strategy Assistant"
          className="flex items-center justify-center rounded bg-white border shadow-sm p-2 hover:bg-gray-50 focus:outline-none focus:ring-[3px] focus:ring-[#ffdd00]"
        >
          <ChevronLeft size={18} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="bg-[#f8f8f6] rounded shadow-sm border p-4 space-y-4 self-start">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold text-gray-800">
          <Sparkles size={16} style={{ color: '#1d70b8' }} />
          AI Strategy Assistant
        </h2>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          aria-expanded={true}
          aria-controls={PANEL_ID}
          aria-label="Collapse AI Strategy Assistant"
          className="rounded p-1 hover:bg-gray-100 focus:outline-none focus:ring-[3px] focus:ring-[#ffdd00]"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div id={PANEL_ID} className="space-y-4">
        <TriageSummary counts={counts} />

        <div>
          <div className="text-[10px] uppercase tracking-wide font-semibold text-gray-500 mb-2">
            Priority this morning
          </div>
          <PriorityInsight inputs={inputs} />
        </div>
      </div>
    </aside>
  );
}
