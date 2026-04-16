import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { PriorityInsightInputs, PriorityInsightResult } from '../../types/case';
import { getPriorityInsight } from '../../services/ai';

type Props = { inputs: PriorityInsightInputs | null };

export default function PriorityInsight({ inputs }: Props) {
  const [result, setResult] = useState<PriorityInsightResult>({ status: 'pending' });

  useEffect(() => {
    if (!inputs) {
      setResult({ status: 'pending' });
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setResult({ status: 'pending' });
    getPriorityInsight(inputs, controller.signal).then(next => {
      if (!cancelled) setResult(next);
    });
    return () => {
      cancelled = true;
      controller.abort();
    };
    // Only re-run when the chosen case changes — not on every inputs object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs?.caseRef]);

  if (!inputs) {
    return (
      <div className="rounded bg-white px-4 py-6 text-center text-sm text-gray-600 border">
        No cases match current filters.
      </div>
    );
  }

  const ctaDisabled = inputs.actionHref === null;

  return (
    <div className="space-y-3">
      <div
        role="status"
        aria-live="polite"
        aria-busy={result.status === 'pending'}
        className="rounded bg-white px-4 py-3 border text-sm leading-relaxed text-gray-800 min-h-[88px]"
      >
        {result.status === 'pending' ? (
          <div className="space-y-2 animate-pulse" aria-label="Loading priority insight">
            <div className="h-3 w-3/4 bg-gray-200 rounded" />
            <div className="h-3 w-full bg-gray-200 rounded" />
            <div className="h-3 w-2/3 bg-gray-200 rounded" />
          </div>
        ) : (
          <p>{result.text}</p>
        )}
      </div>

      {ctaDisabled ? (
        <button
          type="button"
          disabled
          title="No action page available for this case"
          className="w-full inline-flex items-center justify-center gap-1 rounded px-4 py-2 text-sm font-bold bg-gray-200 text-gray-500 cursor-not-allowed"
        >
          {inputs.actionLabel}
        </button>
      ) : (
        <Link
          to={inputs.actionHref!}
          className="w-full inline-flex items-center justify-center gap-1 rounded px-4 py-2 text-sm font-bold text-white focus:outline-none focus:ring-[3px] focus:ring-[#ffdd00]"
          style={{ backgroundColor: '#00703c' }}
        >
          {inputs.actionLabel}
          <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}
