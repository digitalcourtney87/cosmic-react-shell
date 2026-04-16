import casesData from "@/challenge-3/cases.json";
import policiesData from "@/challenge-3/policy-extracts.json";
import workflowData from "@/challenge-3/workflow-states.json";
import { REFERENCE_DATE, daysBetween } from "@/lib/date";
import type {
  Action,
  Case,
  CaseType,
  EvidenceItem,
  PolicyExtract,
  RiskLevel,
  RiskScore,
  WorkflowState,
} from "@/types/case";

const CASES: Case[] = casesData as Case[];
const POLICIES: PolicyExtract[] = policiesData as PolicyExtract[];

const WORKFLOW_STATES: WorkflowState[] = (() => {
  const out: WorkflowState[] = [];
  const root = workflowData as {
    case_types: Record<string, { states: Omit<WorkflowState, "case_type">[] }>;
  };
  for (const [caseType, config] of Object.entries(root.case_types)) {
    for (const s of config.states) {
      out.push({ ...s, case_type: caseType as CaseType });
    }
  }
  return out;
})();

export function getAllCases(): Case[] {
  return CASES;
}

export function getCaseById(caseId: string): Case | undefined {
  return CASES.find((c) => c.case_id === caseId);
}

export function getApplicablePolicies(c: Case): PolicyExtract[] {
  return POLICIES.filter((p) => p.applicable_case_types.includes(c.case_type));
}

export function getWorkflowState(c: Case): WorkflowState | undefined {
  return WORKFLOW_STATES.find(
    (s) => s.state === c.status && s.case_type === c.case_type,
  );
}

const REQUIREMENT_PATTERNS: { match: RegExp; label: string }[] = [
  { match: /proof of address/i, label: "Proof of address" },
  { match: /income statement/i, label: "Income statement" },
  { match: /tenancy agreement/i, label: "Tenancy agreement" },
  { match: /medical certificate/i, label: "Medical certificate" },
  { match: /signed declaration/i, label: "Signed declaration" },
  { match: /noise management plan/i, label: "Noise management plan" },
  { match: /site plan/i, label: "Site plan" },
  { match: /public liability insurance/i, label: "Public liability insurance" },
  { match: /crowd management plan/i, label: "Crowd management plan" },
  { match: /trading records/i, label: "Trading records" },
  { match: /staff qualification/i, label: "Staff qualification certificates" },
  { match: /tutor qualification/i, label: "Tutor qualification certificates" },
  { match: /course delivery records/i, label: "Course delivery records" },
  { match: /learner outcomes/i, label: "Learner outcomes data" },
  { match: /health and safety records/i, label: "Health and safety records" },
  { match: /site inspection logs/i, label: "Site inspection logs" },
  { match: /incident reports/i, label: "Incident reports" },
  { match: /p45/i, label: "P45" },
  { match: /new employer details/i, label: "New employer details" },
  { match: /proof of identity/i, label: "Proof of identity" },
  { match: /application form/i, label: "Application form" },
];

function extractRequirementsFromRequest(note: string): string[] {
  const found: string[] = [];
  for (const { match, label } of REQUIREMENT_PATTERNS) {
    if (match.test(note)) found.push(label);
  }
  return found;
}

function extractReceivedRequirements(note: string): { received: string[]; allReceived: boolean } {
  const received: string[] = [];
  for (const { match, label } of REQUIREMENT_PATTERNS) {
    if (match.test(note)) received.push(label);
  }
  const allReceived = /^all\b|all (three|three\s|requested|documents|documentation|the documents)/i.test(
    note,
  ) || /full documentation/i.test(note);
  return { received, allReceived };
}

export function deriveEvidenceStatus(c: Case, policies: PolicyExtract[]): EvidenceItem[] {
  const workflow = getWorkflowState(c);
  const thresholdDays = workflow?.escalation_thresholds?.escalation_days ?? 56;
  const reminderDays = workflow?.escalation_thresholds?.reminder_days ?? 28;

  const requestedEvents = c.timeline.filter((e) => e.event === "evidence_requested");
  const receivedEvents = c.timeline.filter((e) => e.event === "evidence_received");

  if (requestedEvents.length === 0) return [];

  const earliestRequest = requestedEvents.reduce((acc, cur) =>
    cur.date < acc.date ? cur : acc,
  );

  const requirements = extractRequirementsFromRequest(earliestRequest.note);
  const policyId = policies[0]?.policy_id ?? "";

  const items: EvidenceItem[] = requirements.map((req) => {
    let receivedDate: string | undefined;
    for (const ev of receivedEvents) {
      const { received, allReceived } = extractReceivedRequirements(ev.note);
      if (allReceived || received.includes(req)) {
        receivedDate = ev.date;
        break;
      }
    }
    const requestedDate = earliestRequest.date;
    const daysElapsed = daysBetween(requestedDate, REFERENCE_DATE);
    const status = receivedDate
      ? "received"
      : daysElapsed > thresholdDays
        ? "overdue"
        : "outstanding";
    return {
      requirement: req,
      policy_id: policyId,
      status,
      days_elapsed: daysElapsed,
      threshold_days: thresholdDays,
      requested_date: requestedDate,
      received_date: receivedDate,
    } satisfies EvidenceItem;
  });

  void reminderDays;

  return items.sort((a, b) => {
    const order = { overdue: 0, outstanding: 1, received: 2 } as const;
    return order[a.status] - order[b.status];
  });
}

export function calculateRiskScore(
  c: Case,
  evidence: EvidenceItem[],
  workflow: WorkflowState | undefined,
): RiskScore {
  let score = 0;
  const factors: string[] = [];

  const overdueCount = evidence.filter((e) => e.status === "overdue").length;
  if (overdueCount > 0) {
    const pts = 2 * overdueCount;
    score += pts;
    factors.push(`${overdueCount} overdue evidence item${overdueCount === 1 ? "" : "s"} (+${pts})`);
  }

  if (workflow?.escalation_thresholds?.escalation_days !== undefined) {
    const threshold = workflow.escalation_thresholds.escalation_days;
    const ageDays = daysBetween(c.created_date, REFERENCE_DATE);
    if (ageDays > threshold) {
      score += 4;
      factors.push(`Past escalation threshold (${ageDays}d > ${threshold}d) (+4)`);
    } else if (ageDays > Math.floor(threshold * 0.75)) {
      score += 2;
      factors.push(`Approaching escalation threshold (${ageDays}d) (+2)`);
    }
  }

  const sinceUpdate = daysBetween(c.last_updated, REFERENCE_DATE);
  if (sinceUpdate > 28) {
    score += 4;
    factors.push(`No activity for ${sinceUpdate} days (+4)`);
  } else if (sinceUpdate > 14) {
    score += 2;
    factors.push(`No activity for ${sinceUpdate} days (+2)`);
  }

  if (score > 10) score = 10;
  if (score < 0) score = 0;

  const level: RiskLevel = score >= 7 ? "critical" : score >= 4 ? "warning" : "normal";

  return { score, level, factors };
}

export function getRequiredNextActions(
  c: Case,
  workflow: WorkflowState | undefined,
  evidence: EvidenceItem[],
): Action[] {
  const fromWorkflow: Action[] = (workflow?.required_actions ?? []).map((label, i) => ({
    action_id: `wf-${c.case_id}-${i}`,
    label,
    severity: /escalat|reminder|sign-off|notify applicant/i.test(label) ? "warning" : "info",
  }));

  const overdueActions: Action[] = evidence
    .filter((e) => e.status === "overdue")
    .map((e, i) => ({
      action_id: `od-${c.case_id}-${i}`,
      label: `Issue reminder for ${e.requirement}`,
      severity: "critical" as const,
      due_in_days: -(e.days_elapsed - e.threshold_days),
    }));

  const sevOrder = { critical: 0, warning: 1, info: 2 } as const;
  return [...fromWorkflow, ...overdueActions].sort((a, b) => {
    if (sevOrder[a.severity] !== sevOrder[b.severity]) {
      return sevOrder[a.severity] - sevOrder[b.severity];
    }
    return (a.due_in_days ?? Number.POSITIVE_INFINITY) - (b.due_in_days ?? Number.POSITIVE_INFINITY);
  });
}
