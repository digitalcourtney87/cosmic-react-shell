/**
 * B7 / C3 — shared RiskBadge component.
 * Coloured pill showing level + score; HoverCard reveals top contributing factors.
 */

import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { RiskScore, RiskLevel } from '../types/case';

const STYLE: Record<RiskLevel, { bg: string; text: string; dot: string }> = {
  critical: { bg: '#fde8e8', text: '#d4351c', dot: '#d4351c' },
  warning:  { bg: '#fef3e2', text: '#f47738', dot: '#f47738' },
  normal:   { bg: '#e8f5e9', text: '#00703c', dot: '#00703c' },
};

interface Props {
  riskScore: RiskScore;
}

export default function RiskBadge({ riskScore }: Props) {
  const { bg, text, dot } = STYLE[riskScore.level];
  const topFactors = riskScore.factors.slice(0, 2);

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold cursor-default select-none focus:outline-none focus:ring-[3px] focus:ring-[#ffdd00]"
          style={{ backgroundColor: bg, color: text }}
          tabIndex={0}
        >
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: dot }}
          />
          {riskScore.level.charAt(0).toUpperCase() + riskScore.level.slice(1)} · {riskScore.score}/10
        </span>
      </HoverCardTrigger>
      <HoverCardContent className="w-72 text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
        <p className="font-bold mb-2" style={{ color: text }}>
          Risk {riskScore.level} — {riskScore.score}/10
        </p>
        <ul className="space-y-1 text-gray-700">
          {topFactors.map((f, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <span style={{ color: dot }}>·</span>
              {f}
            </li>
          ))}
          {riskScore.factors.length > 2 && (
            <li className="text-gray-400 text-xs">
              +{riskScore.factors.length - 2} more factor{riskScore.factors.length - 2 > 1 ? 's' : ''}
            </li>
          )}
        </ul>
      </HoverCardContent>
    </HoverCard>
  );
}
