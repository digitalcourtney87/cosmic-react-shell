import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { EnrichedCase, RiskLevel } from '../../types/case';
import { buildHeatmapTiles } from '../../services/ai';

const TILE_COLORS: Record<RiskLevel, string> = {
  critical: '#d4351c',
  warning: '#f47738',
  normal: '#00703c',
};

type Props = { filtered: EnrichedCase[] };

export default function WorkloadHeatmap({ filtered }: Props) {
  const tiles = useMemo(() => buildHeatmapTiles(filtered), [filtered]);

  if (tiles.length === 0) {
    return (
      <div className="bg-white rounded shadow-sm px-4 py-3 text-sm text-gray-500">
        No cases to display.
      </div>
    );
  }

  return (
    <div className="bg-white rounded shadow-sm px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold text-gray-800">Workload Heatmap</h2>
        <div className="text-xs text-gray-500">{tiles.length} case{tiles.length === 1 ? '' : 's'}</div>
      </div>
      <div
        role="grid"
        aria-label="Caseload workload heatmap"
        className="grid gap-1"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(48px, 1fr))' }}
      >
        {tiles.map(tile => (
          <Link
            key={tile.caseId}
            to={tile.href}
            aria-label={`${tile.caseRef} — ${tile.applicantName} — ${tile.riskLevel}`}
            title={`${tile.caseRef} — ${tile.applicantName}`}
            className="h-10 rounded flex items-center justify-center text-[10px] font-mono font-bold text-white focus:outline-none focus:ring-[3px] focus:ring-[#ffdd00] hover:opacity-80"
            style={{ backgroundColor: TILE_COLORS[tile.riskLevel] }}
          >
            {tile.caseRef.slice(-3)}
          </Link>
        ))}
      </div>
    </div>
  );
}
