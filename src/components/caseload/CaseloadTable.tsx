import { useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import RiskBadge from "@/components/shared/RiskBadge";
import { cn } from "@/lib/utils";
import type { EnrichedCase, SortKey, SortState } from "./types";

interface CaseloadTableProps {
  rows: EnrichedCase[];
  sort: SortState;
  onSortChange: (next: SortState) => void;
}

const TYPE_LABELS: Record<string, string> = {
  benefit_review: "Benefit review",
  licence_application: "Licence application",
  compliance_check: "Compliance check",
};

const STATUS_LABELS: Record<string, string> = {
  awaiting_evidence: "Awaiting evidence",
  under_review: "Under review",
  pending_decision: "Pending decision",
  escalated: "Escalated",
  closed: "Closed",
  case_created: "Case created",
};

const SortHeader = ({
  label,
  sortKey,
  active,
  dir,
  onClick,
  className,
}: {
  label: string;
  sortKey: SortKey;
  active: boolean;
  dir: "asc" | "desc";
  onClick: (k: SortKey) => void;
  className?: string;
}) => {
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead className={cn("bg-gds-lightgrey", className)}>
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        className="inline-flex items-center gap-1 text-xs uppercase tracking-wide font-semibold text-gds-black"
        aria-sort={!active ? "none" : dir === "asc" ? "ascending" : "descending"}
      >
        {label}
        <Icon className="h-3.5 w-3.5 opacity-70" />
      </button>
    </TableHead>
  );
};

const CaseloadTable = ({ rows, sort, onSortChange }: CaseloadTableProps) => {
  const navigate = useNavigate();

  const handleSort = (key: SortKey) => {
    if (sort.key === key) {
      onSortChange({ key, dir: sort.dir === "asc" ? "desc" : "asc" });
    } else {
      onSortChange({ key, dir: "desc" });
    }
  };

  if (rows.length === 0) {
    return (
      <div className="border border-gds-lightgrey rounded p-8 text-center text-gds-midgrey">
        No cases match the current filters.
      </div>
    );
  }

  return (
    <div className="border border-gds-lightgrey rounded overflow-hidden">
      <div className="max-h-[60vh] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10">
            <TableRow className="hover:bg-gds-lightgrey">
              <TableHead className="bg-gds-lightgrey text-xs uppercase tracking-wide font-semibold text-gds-black">
                Case
              </TableHead>
              <TableHead className="bg-gds-lightgrey text-xs uppercase tracking-wide font-semibold text-gds-black">
                Applicant
              </TableHead>
              <TableHead className="bg-gds-lightgrey text-xs uppercase tracking-wide font-semibold text-gds-black">
                Type
              </TableHead>
              <TableHead className="bg-gds-lightgrey text-xs uppercase tracking-wide font-semibold text-gds-black">
                Status
              </TableHead>
              <TableHead className="bg-gds-lightgrey text-xs uppercase tracking-wide font-semibold text-gds-black">
                Assigned
              </TableHead>
              <SortHeader
                label="Age"
                sortKey="age"
                active={sort.key === "age"}
                dir={sort.dir}
                onClick={handleSort}
              />
              <SortHeader
                label="Risk"
                sortKey="risk"
                active={sort.key === "risk"}
                dir={sort.dir}
                onClick={handleSort}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ case: c, ageDays, risk }) => (
              <TableRow
                key={c.case_id}
                onClick={() => navigate(`/case/${c.case_id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(`/case/${c.case_id}`);
                  }
                }}
                tabIndex={0}
                role="link"
                aria-label={`Open case ${c.case_id} for ${c.applicant.name}`}
                className="cursor-pointer hover:bg-gds-yellow/10 focus-visible:bg-gds-yellow/10"
              >
                <TableCell className="font-mono text-sm font-medium text-gds-blue">
                  {c.case_id}
                </TableCell>
                <TableCell className="font-medium">{c.applicant.name}</TableCell>
                <TableCell className="text-sm">{TYPE_LABELS[c.case_type] ?? c.case_type}</TableCell>
                <TableCell className="text-sm">{STATUS_LABELS[c.status] ?? c.status}</TableCell>
                <TableCell className="text-sm">{c.assigned_to}</TableCell>
                <TableCell className="tabular-nums text-sm">{ageDays}d</TableCell>
                <TableCell>
                  <RiskBadge risk={risk} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default CaseloadTable;
