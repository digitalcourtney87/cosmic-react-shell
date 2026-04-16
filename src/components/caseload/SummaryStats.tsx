import { Card, CardContent } from "@/components/ui/card";
import type { EnrichedCase } from "./types";

interface SummaryStatsProps {
  cases: EnrichedCase[];
}

const Tile = ({ label, value, hint }: { label: string; value: string | number; hint?: string }) => (
  <Card className="border-gds-lightgrey">
    <CardContent className="pt-5 pb-4">
      <div className="text-xs uppercase tracking-wide text-gds-midgrey font-semibold">{label}</div>
      <div className="mt-1 text-3xl font-bold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-gds-midgrey">{hint}</div>}
    </CardContent>
  </Card>
);

const SummaryStats = ({ cases }: SummaryStatsProps) => {
  const total = cases.length;
  const awaitingEvidence = cases.filter((c) => c.case.status === "awaiting_evidence").length;
  const overdue = cases.filter((c) => c.hasOverdue).length;
  const avgAge = total === 0 ? 0 : Math.round(cases.reduce((acc, c) => acc + c.ageDays, 0) / total);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Tile label="Total" value={total} hint="In current view" />
      <Tile label="Awaiting evidence" value={awaitingEvidence} />
      <Tile label="Overdue" value={overdue} hint="≥1 evidence item past escalation" />
      <Tile label="Avg. age" value={`${avgAge}d`} hint="Days since created" />
    </div>
  );
};

export default SummaryStats;
