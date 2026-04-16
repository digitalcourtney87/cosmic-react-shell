import type { EvidenceAdviceResult } from '@/types/case';

interface EvidenceAdviceProps {
  result: EvidenceAdviceResult;
}

export default function EvidenceAdvice({ result }: EvidenceAdviceProps) {
  return (
    <div
      className="bg-white rounded shadow-sm px-5 py-4 h-full"
      aria-live="polite"
      aria-label="AI evidence advice"
    >
      <div className="flex items-center gap-2 mb-3">
        <h2 className="font-bold text-sm uppercase text-gray-600 tracking-wide">
          Evidence advice
        </h2>
      </div>

      {result.status === 'pending' && (
        <div className="space-y-2 animate-pulse" aria-label="Loading evidence advice">
          <div className="h-3 bg-gray-200 rounded w-full" />
          <div className="h-3 bg-gray-200 rounded w-5/6" />
          <div className="h-3 bg-gray-200 rounded w-4/6" />
          <div className="h-3 bg-gray-200 rounded w-full mt-2" />
          <div className="h-3 bg-gray-200 rounded w-3/4" />
        </div>
      )}

      {result.status === 'llm' && (
        <div>
          <p className="text-sm text-gray-800 leading-relaxed">{result.text}</p>
          <div className="mt-3 flex items-center gap-2">
            <span
              className="text-xs font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide"
              style={{ backgroundColor: '#e8f0fe', color: '#1d70b8' }}
            >
              AI
            </span>
            <span className="text-xs text-gray-400">Generated using your case data</span>
          </div>
        </div>
      )}

      {result.status === 'fallback' && (
        <div>
          <p className="text-sm text-gray-800 leading-relaxed">{result.text}</p>
          <p className="mt-3 text-xs text-gray-400 italic">
            AI unavailable — showing deterministic advice
          </p>
        </div>
      )}
    </div>
  );
}
