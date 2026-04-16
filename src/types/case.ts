export type CaseType = "benefit_review" | "licence_application" | "compliance_check";

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
  case_type: CaseType;
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

export interface EscalationThreshold {
  reminder_days?: number;
  escalation_days: number;
}

export interface WorkflowState {
  state: string;
  case_type: CaseType;
  label: string;
  description: string;
  allowed_transitions: string[];
  required_actions: string[];
  escalation_thresholds?: EscalationThreshold;
}

export type EvidenceStatus = "received" | "outstanding" | "overdue";

export interface EvidenceItem {
  requirement: string;
  policy_id: string;
  status: EvidenceStatus;
  days_elapsed: number;
  threshold_days: number;
  requested_date?: string;
  received_date?: string;
}

export type RiskLevel = "normal" | "warning" | "critical";

export interface RiskScore {
  score: number;
  level: RiskLevel;
  factors: string[];
}

export type ActionSeverity = "info" | "warning" | "critical";

export interface Action {
  action_id: string;
  label: string;
  severity: ActionSeverity;
  due_in_days?: number;
}
