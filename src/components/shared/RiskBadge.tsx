import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import type { RiskScore } from "@/types/case";

const LEVEL_STYLES: Record<RiskScore["level"], { bg: string; label: string }> = {
  critical: { bg: "bg-gds-red text-white", label: "Critical" },
  warning: { bg: "bg-gds-amber text-white", label: "Warning" },
  normal: { bg: "bg-gds-green text-white", label: "Normal" },
};

interface RiskBadgeProps {
  risk: RiskScore;
  showScore?: boolean;
  className?: string;
}

const RiskBadge = ({ risk, showScore = true, className }: RiskBadgeProps) => {
  const { bg, label } = LEVEL_STYLES[risk.level];

  return (
    <HoverCard openDelay={150} closeDelay={50}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
            bg,
            className,
          )}
          aria-label={`Risk level ${label}, score ${risk.score} of 10`}
        >
          <span>{label}</span>
          {showScore && <span className="font-mono opacity-90">{risk.score}/10</span>}
        </button>
      </HoverCardTrigger>
      <HoverCardContent side="bottom" align="start" className="w-72">
        <div className="text-sm">
          <div className="font-semibold mb-2">
            Risk score {risk.score}/10 — {label}
          </div>
          {risk.factors.length === 0 ? (
            <p className="text-gds-midgrey">No risk factors triggered.</p>
          ) : (
            <ul className="space-y-1 list-disc list-inside text-gds-black">
              {risk.factors.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};

export default RiskBadge;
