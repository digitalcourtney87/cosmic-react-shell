import type { EvidenceItem, EvidenceStatus } from '@/types/case';

const EVIDENCE_STYLE: Record<EvidenceStatus, { icon: string; dot: string; label: string }> = {
  overdue:     { icon: '⚠️', dot: '#d4351c', label: 'Overdue' },
  outstanding: { icon: '⏳', dot: '#f47738', label: 'Outstanding' },
  received:    { icon: '✓',  dot: '#00703c', label: 'Received' },
};

interface ActionEvidenceTableProps {
  items: EvidenceItem[];
  scope: 'action' | 'case-wide';
}

export default function ActionEvidenceTable({ items, scope }: ActionEvidenceTableProps) {
  const heading = scope === 'action'
    ? 'Evidence for this action'
    : 'All case evidence — no items specific to this action';

  return (
    <div>
      <h2 className="font-bold text-sm uppercase text-gray-600 mb-3 tracking-wide">
        {heading}
      </h2>

      {items.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No evidence recorded for this case yet.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => {
            const style = EVIDENCE_STYLE[item.status];
            return (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-3 rounded border text-sm"
                style={{ backgroundColor: '#f9f9f9' }}
              >
                {/* Status dot */}
                <span
                  className="flex-shrink-0 w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: style.dot }}
                  aria-hidden="true"
                />
                {/* Icon + label */}
                <span className="w-6 text-center flex-shrink-0" aria-label={style.label}>
                  {style.icon}
                </span>
                {/* Requirement */}
                <span className="flex-1 text-gray-800 capitalize">{item.requirement}</span>
                {/* Policy ID */}
                <span
                  className="font-mono text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                  style={{ backgroundColor: '#e8f0fe', color: '#1d70b8' }}
                >
                  {item.policyId}
                </span>
                {/* Days */}
                {item.elapsedDays !== null && (
                  <span className="text-xs text-gray-500 flex-shrink-0">
                    {item.thresholdDays !== null
                      ? `${item.elapsedDays} / ${item.thresholdDays}d`
                      : `${item.elapsedDays}d`}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
