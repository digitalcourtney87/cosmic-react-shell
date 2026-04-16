// Frozen reference date used for all date arithmetic.
// Must be identical between the 14:45 rehearsal and the 15:30 judging window.
export const REFERENCE_DATE = new Date('2026-04-16');

export const SEGMENT_ORDER = [
  'escalated',
  'pending_decision',
  'under_review',
  'awaiting_evidence',
  'case_created',
] as const;

export const SEGMENT_LABELS: Record<string, string> = {
  escalated: 'Escalated',
  pending_decision: 'Pending Decision',
  under_review: 'Under Review',
  awaiting_evidence: 'Awaiting Evidence',
  case_created: 'Case Created',
};
