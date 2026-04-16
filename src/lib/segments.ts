import type { Case } from "@/types/case";

export type Segment =
  | "Escalated"
  | "Pending Decision"
  | "Under Review"
  | "Awaiting Evidence"
  | "Case Created"
  | "Other";

export const SEGMENTS: Segment[] = [
  "Escalated",
  "Pending Decision",
  "Under Review",
  "Awaiting Evidence",
  "Case Created",
  "Other",
];

export function getSegment(c: Case): Segment {
  switch (c.status) {
    case "escalated":
      return "Escalated";
    case "pending_decision":
      return "Pending Decision";
    case "under_review":
      return "Under Review";
    case "awaiting_evidence":
      return "Awaiting Evidence";
    case "case_created":
      return "Case Created";
    default:
      return "Other";
  }
}
