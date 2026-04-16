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

// ── Case Chat Assistant ───────────────────────────────────────────────────────

export interface StructuredCaseContext {
  caseId: string;
  caseType: string;
  status: string;
  referenceDate: string;
  applicant: {
    name: string;
    reference: string;
    dateOfBirth?: string;
  };
  assignedTo: string;
  createdDate: string;
  riskScore: {
    level: 'critical' | 'warning' | 'normal';
    score: number;
    factors: string[];
  };
  caseNotes: string;
  timeline: Array<{ date: string; event: string; note: string }>;
  evidenceItems: Array<{
    requirement: string;
    status: 'overdue' | 'outstanding' | 'received';
    policyId: string;
    elapsedDays: number | null;
    thresholdDays: number | null;
  }>;
  workflowState: {
    label: string;
    description: string;
    escalationThresholds?: { reminder_days: number; escalation_days: number };
    allowedTransitions: string[];
  } | null;
  nextActions: Array<{
    id: string;
    label: string;
    severity: 'critical' | 'warning' | 'info';
    dueInDays: number | null;
  }>;
  policies: Array<{ policyId: string; title: string; body: string }>;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  status?: 'error';
}
