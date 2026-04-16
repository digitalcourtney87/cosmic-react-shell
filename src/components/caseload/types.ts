import type { Case, EvidenceItem, RiskScore } from "@/types/case";

export interface EnrichedCase {
  case: Case;
  evidence: EvidenceItem[];
  risk: RiskScore;
  ageDays: number;
  hasOverdue: boolean;
}

export type FilterKey = "caseType" | "assignedTo" | "status";

export interface FilterState {
  caseType: string;
  assignedTo: string;
  status: string;
}

export const ALL = "__all__" as const;

export const EMPTY_FILTERS: FilterState = {
  caseType: ALL,
  assignedTo: ALL,
  status: ALL,
};

export type SortKey = "risk" | "age";
export type SortDir = "asc" | "desc";

export interface SortState {
  key: SortKey;
  dir: SortDir;
}
