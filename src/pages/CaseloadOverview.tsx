import { useMemo, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  calculateRiskScore,
  deriveEvidenceStatus,
  getAllCases,
  getApplicablePolicies,
  getWorkflowState,
} from "@/services/cases";
import { REFERENCE_DATE, daysBetween } from "@/lib/date";
import { SEGMENTS, getSegment, type Segment } from "@/lib/segments";
import SummaryStats from "@/components/caseload/SummaryStats";
import Filters from "@/components/caseload/Filters";
import OverdueBanner from "@/components/caseload/OverdueBanner";
import CaseloadTable from "@/components/caseload/CaseloadTable";
import {
  ALL,
  EMPTY_FILTERS,
  type EnrichedCase,
  type FilterState,
  type SortState,
} from "@/components/caseload/types";

const SOFT_CAP = 50;

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

function matchesFilters(c: EnrichedCase, f: FilterState): boolean {
  if (f.caseType !== ALL && c.case.case_type !== f.caseType) return false;
  if (f.assignedTo !== ALL && c.case.assigned_to !== f.assignedTo) return false;
  if (f.status !== ALL && c.case.status !== f.status) return false;
  return true;
}

function matchesAllExcept(
  c: EnrichedCase,
  f: FilterState,
  except: keyof FilterState,
): boolean {
  if (except !== "caseType" && f.caseType !== ALL && c.case.case_type !== f.caseType) return false;
  if (except !== "assignedTo" && f.assignedTo !== ALL && c.case.assigned_to !== f.assignedTo)
    return false;
  if (except !== "status" && f.status !== ALL && c.case.status !== f.status) return false;
  return true;
}

const CaseloadOverview = () => {
  const enriched: EnrichedCase[] = useMemo(() => {
    return getAllCases().map((c) => {
      const policies = getApplicablePolicies(c);
      const workflow = getWorkflowState(c);
      const evidence = deriveEvidenceStatus(c, policies);
      const risk = calculateRiskScore(c, evidence, workflow);
      const ageDays = daysBetween(c.created_date, REFERENCE_DATE);
      const hasOverdue = evidence.some((e) => e.status === "overdue");
      return { case: c, evidence, risk, ageDays, hasOverdue };
    });
  }, []);

  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortState>({ key: "risk", dir: "desc" });
  const [groupBySegment, setGroupBySegment] = useState(false);

  const filtered = useMemo(
    () => enriched.filter((c) => matchesFilters(c, filters)),
    [enriched, filters],
  );

  const sortedFiltered = useMemo(() => {
    const copy = [...filtered];
    const dir = sort.dir === "asc" ? 1 : -1;
    copy.sort((a, b) => {
      const av = sort.key === "risk" ? a.risk.score : a.ageDays;
      const bv = sort.key === "risk" ? b.risk.score : b.ageDays;
      const diff = av - bv;
      if (diff !== 0) return diff * dir;
      return a.case.case_id.localeCompare(b.case.case_id);
    });
    return copy.slice(0, SOFT_CAP);
  }, [filtered, sort]);

  const overdueAll = useMemo(() => enriched.filter((c) => c.hasOverdue), [enriched]);
  const overdueVisible = useMemo(
    () => overdueAll.filter((c) => matchesFilters(c, filters)),
    [overdueAll, filters],
  );
  const overdueHidden = overdueAll.length - overdueVisible.length;

  const filterOptions = useMemo(() => {
    const caseTypes = Array.from(new Set(enriched.map((c) => c.case.case_type))).sort();
    const assignees = Array.from(new Set(enriched.map((c) => c.case.assigned_to))).sort();
    const statuses = Array.from(new Set(enriched.map((c) => c.case.status))).sort();
    return {
      caseTypes: caseTypes.map((v) => ({ value: v, label: TYPE_LABELS[v] ?? v })),
      assignees: assignees.map((v) => ({ value: v, label: v })),
      statuses: statuses.map((v) => ({ value: v, label: STATUS_LABELS[v] ?? v })),
    };
  }, [enriched]);

  const handleShowOverdue = () => {
    const hiddenOverdue = overdueAll.filter((c) => !matchesFilters(c, filters));
    const next: FilterState = { ...filters };
    (Object.keys(filters) as Array<keyof FilterState>).forEach((dim) => {
      if (filters[dim] === ALL) return;
      const wouldUnhide = hiddenOverdue.some((c) => matchesAllExcept(c, filters, dim));
      if (wouldUnhide) next[dim] = ALL;
    });
    setFilters(next);
  };

  const grouped: { segment: Segment; rows: EnrichedCase[] }[] | null = useMemo(() => {
    if (!groupBySegment) return null;
    const buckets = new Map<Segment, EnrichedCase[]>();
    SEGMENTS.forEach((s) => buckets.set(s, []));
    sortedFiltered.forEach((c) => {
      const seg = getSegment(c.case);
      buckets.get(seg)?.push(c);
    });
    return SEGMENTS.map((segment) => ({ segment, rows: buckets.get(segment) ?? [] }));
  }, [groupBySegment, sortedFiltered]);

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Caseload</h1>
          <p className="mt-1 text-gds-midgrey">
            {filtered.length} of {enriched.length} {enriched.length === 1 ? "case" : "cases"} —
            reference date {REFERENCE_DATE.toISOString().slice(0, 10)}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="group-by-segment"
            checked={groupBySegment}
            onCheckedChange={setGroupBySegment}
          />
          <Label htmlFor="group-by-segment" className="cursor-pointer text-sm font-medium">
            Group by segment
          </Label>
        </div>
      </header>

      <SummaryStats cases={filtered} />

      <Filters
        filters={filters}
        onChange={setFilters}
        caseTypes={filterOptions.caseTypes}
        assignees={filterOptions.assignees}
        statuses={filterOptions.statuses}
      />

      <OverdueBanner hiddenCount={overdueHidden} onShow={handleShowOverdue} />

      {grouped ? (
        <div className="space-y-6">
          {grouped.map(({ segment, rows }) => (
            <div key={segment} className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gds-midgrey">
                {segment} <span className="font-mono opacity-70">({rows.length})</span>
              </h2>
              {rows.length === 0 ? (
                <div className="border border-dashed border-gds-lightgrey rounded p-4 text-sm text-gds-midgrey">
                  No cases in this segment.
                </div>
              ) : (
                <CaseloadTable rows={rows} sort={sort} onSortChange={setSort} />
              )}
            </div>
          ))}
        </div>
      ) : (
        <CaseloadTable rows={sortedFiltered} sort={sort} onSortChange={setSort} />
      )}
    </section>
  );
};

export default CaseloadOverview;
