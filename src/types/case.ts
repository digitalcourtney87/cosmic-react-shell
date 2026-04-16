// ── Fixture types ────────────────────────────────────────────────────────────

export interface Applicant {
  name: string;
  reference: string;
  date_of_birth: string | null;
}

export interface TimelineEvent {
  date: string;
  event: string;
  note: string;
}

export interface Case {
  case_id: string;
  case_type: string;
  status: string;
  applicant: Applicant;
  assigned_to: string;
  created_date: string;
  last_updated: string;
  timeline: TimelineEvent[];
  case_notes: string;
}

export interface PolicyExtract {
  policy_id: string;
  title: string;
  applicable_case_types: string[];
  body: string;
}

export interface EscalationThresholds {
  reminder_days: number;
  escalation_days: number;
}

export interface WorkflowStateEntry {
  state: string;
  label: string;
  description: string;
  allowed_transitions: string[];
  required_actions: string[];
  escalation_thresholds?: EscalationThresholds;
}

export interface WorkflowData {
  case_types: Record<string, { states: WorkflowStateEntry[] }>;
}

// ── Page index types ─────────────────────────────────────────────────────────

export interface PageRef {
  page: string;
  url_pattern: string;
  purpose: string;
}

export interface ActionEntry {
  action_id: string;
  label: string;
  triggered_at_state: string;
  policy_refs: string[];
  pages: PageRef[];
  urgency_trigger_days?: number;
}

export interface PageIndexEntry {
  case_type: string;
  actions: ActionEntry[];
}

// ── Derived types ────────────────────────────────────────────────────────────

export type EvidenceStatus = 'received' | 'outstanding' | 'overdue';

export interface EvidenceItem {
  requirement: string;
  status: EvidenceStatus;
  policyId: string;
  elapsedDays: number | null;
  thresholdDays: number | null;
}

export type RiskLevel = 'normal' | 'warning' | 'critical';

export interface RiskScore {
  score: number;
  level: RiskLevel;
  factors: string[];
}

export type ActionSeverity = 'info' | 'warning' | 'critical';

export interface NextAction {
  id: string;
  label: string;
  severity: ActionSeverity;
  dueInDays: number | null;
}

// ── Enriched case (derived fields attached) ──────────────────────────────────

export interface EnrichedCase extends Case {
  evidenceItems: EvidenceItem[];
  riskScore: RiskScore;
  nextActions: NextAction[];
  workflowState: WorkflowStateEntry | null;
  ageInDays: number;
}

// ── AI Strategy Assistant derived types (feature 002) ────────────────────────

export interface TriageCounts {
  critical: number;
  warning: number;
  normal: number;
}

export interface PriorityInsightInputs {
  caseId: string;
  caseRef: string;
  applicantName: string;
  riskLevel: RiskLevel;
  topFactors: string[];
  policyId: string | null;
  policyTitle: string | null;
  thresholdPhrase: string | null;
  actionId: string | null;
  actionLabel: string;
  actionHref: string | null;
}

export type FallbackReason =
  | 'no-key'
  | 'network-error'
  | 'timeout'
  | 'non-2xx'
  | 'malformed';

export type PriorityInsightResult =
  | { status: 'pending' }
  | { status: 'llm'; text: string; inputs: PriorityInsightInputs }
  | { status: 'fallback'; text: string; inputs: PriorityInsightInputs; reason: FallbackReason };

export interface HeatmapTile {
  caseId: string;
  caseRef: string;
  applicantName: string;
  riskLevel: RiskLevel;
  riskScore: number;
  href: string;
}

// ── Evidence Advice (feature 003) ─────────────────────────────────────────────

export interface EvidenceAdviceInputs {
  caseRef: string;
  actionId: string;
  actionLabel: string;
  scope: 'action' | 'case-wide';
  policies: { id: string; title: string }[];
  evidence: {
    requirement: string;
    status: EvidenceStatus;
    elapsedDays: number | null;
    thresholdDays: number | null;
    policyId: string;
  }[];
  counts: { received: number; outstanding: number; overdue: number };
}

export type EvidenceAdviceResult =
  | { status: 'pending' }
  | { status: 'llm'; text: string; inputs: EvidenceAdviceInputs }
  | { status: 'fallback'; text: string; inputs: EvidenceAdviceInputs; reason: FallbackReason };
