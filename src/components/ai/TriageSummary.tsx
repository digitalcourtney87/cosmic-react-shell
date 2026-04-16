import type { TriageCounts } from '../../types/case';

const TILES: Array<{
  key: keyof TriageCounts;
  label: string;
  bg: string;
  fg: string;
}> = [
  { key: 'critical', label: 'Critical', bg: '#fde8e8', fg: '#d4351c' },
  { key: 'warning',  label: 'Warning',  bg: '#fef3e2', fg: '#f47738' },
  { key: 'normal',   label: 'On Track', bg: '#e8f5e9', fg: '#00703c' },
];

export default function TriageSummary({ counts }: { counts: TriageCounts }) {
  return (
    <div className="grid grid-cols-3 gap-2" aria-label="Triage summary">
      {TILES.map(tile => (
        <div
          key={tile.key}
          className="rounded px-3 py-2 text-center"
          style={{ backgroundColor: tile.bg, color: tile.fg }}
        >
          <div className="text-2xl font-bold leading-none">{counts[tile.key]}</div>
          <div className="text-[10px] uppercase tracking-wide font-semibold mt-1">
            {tile.label}
          </div>
        </div>
      ))}
    </div>
  );
}
