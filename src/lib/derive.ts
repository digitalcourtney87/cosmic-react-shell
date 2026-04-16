import {
  Case, PolicyExtract, WorkflowStateEntry, PageIndexEntry,
  EvidenceItem, EvidenceStatus, RiskScore, RiskLevel, NextAction, ActionSeverity,
} from '../types/case';
import { REFERENCE_DATE } from './constants';

// ── Helpers ──────────────────────────────────────────────────────────────────

export function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)));
}

function parseNumberedRequirements(body: string): string[] {
  // Split on (1), (2), … patterns, skip the preamble before the first item
  const parts = body.split(/\(\d+\)/);
  if (parts.length <= 1) return [];
  return parts
    .slice(1)
    .map(p => p.replace(/,\s*(?:and\s+)?$/, '').replace(/[.;]\s*.*$/s, '').trim())
    .filter(p => p.length > 0 && p.length < 200);
}

function parseRequestedItems(note: string): string[] {
  const cleaned = note.replace(/^Requested\s+/i, '').replace(/\.$/, '');
  return cleaned
    .split(/,\s*(?:and\s+)?|\s+and\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 2);
}

const STOP_WORDS = new Set([
  'the','a','an','of','for','in','and','or','to','at','by','with','any','all',
  'this','that','if','where','when','which','from','its','as','on','is','are',
  'was','be','been','being','have','has','had','do','does','did','not','no',
  'may','must','should','applicable','required','relevant','within','least','last',
  'covering','prior','change','three','four','five','months','days','weeks',
]);

function keywords(text: string): string[] {
  return text.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !STOP_WORDS.has(w));
}

function isAllReceivedNote(note: string): boolean {
  return /\b(all|full\s+documentation|complete\s+documentation)\b.*(received|verified|provided|present|submitted)/i.test(note);
}

function isItemReceivedInNote(requirement: string, note: string): boolean {
  const kws = keywords(requirement);
  const sentences = note.split(/[.!?]+/).filter(s => s.trim());
  for (const sentence of sentences) {
    const sl = sentence.toLowerCase();
    const hasKeyword = kws.some(kw => sl.includes(kw));
    const hasPositive = /received|verified|provided|submitted|complete|confirmed|present|passed/i.test(sentence);
    const hasNegative = /outstanding|missing|not yet|incomplete|still\s+\w|absent/i.test(sentence);
    if (hasKeyword && hasPositive && !hasNegative) return true;
  }
  return false;
}

// ── Core derivations ─────────────────────────────────────────────────────────

export function deriveEvidenceStatus(
  caseData: Case,
  policies: PolicyExtract[],
  workflowState: WorkflowStateEntry | null,
): EvidenceItem[] {
  const applicablePolicies = policies.filter(p =>
    p.applicable_case_types.includes(caseData.case_type)
  );

  const requestEvent = [...caseData.timeline]
    .reverse()
    .find(e => e.event === 'evidence_requested');
  const requestDate = requestEvent ? new Date(requestEvent.date) : null;

  const receivedNotes = requestDate
    ? caseData.timeline
        .filter(e =>
          (e.event === 'evidence_received' || e.event === 'evidence_verified') &&
          new Date(e.date) >= requestDate
        )
        .map(e => e.note)
    : [];

  const anyAllReceived = receivedNotes.some(isAllReceivedNote);

  // Collect requirements from policy numbered lists
  const requirements: Array<{ requirement: string; policyId: string }> = [];
  for (const policy of applicablePolicies) {
    for (const req of parseNumberedRequirements(policy.body)) {
      requirements.push({ requirement: req, policyId: policy.policy_id });
    }
  }

  // Fallback: parse from the evidence_requested note if no numbered requirements found
  if (requirements.length === 0 && requestEvent) {
    const fallbackPolicyId = applicablePolicies[0]?.policy_id ?? 'unknown';
    for (const item of parseRequestedItems(requestEvent.note)) {
      requirements.push({ requirement: item, policyId: fallbackPolicyId });
    }
  }

  const threshold = workflowState?.escalation_thresholds?.escalation_days ?? null;
  const elapsedDays = requestDate ? daysBetween(requestDate, REFERENCE_DATE) : null;

  const items: EvidenceItem[] = requirements.map(({ requirement, policyId }) => {
    let status: EvidenceStatus;
    if (anyAllReceived) {
      status = 'received';
    } else if (receivedNotes.some(note => isItemReceivedInNote(requirement, note))) {
      status = 'received';
    } else if (requestEvent) {
      status =
        threshold !== null && elapsedDays !== null && elapsedDays > threshold
          ? 'overdue'
          : 'outstanding';
    } else {
      status = 'outstanding';
    }

    return { requirement, status, policyId, elapsedDays, thresholdDays: threshold };
  });

  // Order: overdue → outstanding → received
  const order: Record<EvidenceStatus, number> = { overdue: 0, outstanding: 1, received: 2 };
  return items.sort((a, b) => order[a.status] - order[b.status]);
}

export function calculateRiskScore(
  caseData: Case,
  evidenceItems: EvidenceItem[],
  workflowState: WorkflowStateEntry | null,
): RiskScore {
  let score = 0;
  const factors: string[] = [];

  const overdueCount = evidenceItems.filter(e => e.status === 'overdue').length;
  const outstandingCount = evidenceItems.filter(e => e.status === 'outstanding').length;

  if (overdueCount > 0) {
    score += overdueCount * 3;
    factors.push(`${overdueCount} evidence item${overdueCount > 1 ? 's' : ''} overdue`);
  }
  if (outstandingCount > 0) {
    score += outstandingCount;
    factors.push(`${outstandingCount} evidence item${outstandingCount > 1 ? 's' : ''} outstanding`);
  }

  if (caseData.status === 'escalated') {
    score += 3;
    factors.push('case escalated');
  }

  // Case age vs escalation threshold (only when threshold is defined for this state)
  if (workflowState?.escalation_thresholds) {
    const ageInDays = daysBetween(new Date(caseData.created_date), REFERENCE_DATE);
    const { reminder_days, escalation_days } = workflowState.escalation_thresholds;
    if (ageInDays > escalation_days) {
      score += 2;
      factors.push(`past escalation threshold (${ageInDays} days)`);
    } else if (ageInDays > reminder_days) {
      score += 1;
      factors.push(`approaching escalation threshold (${ageInDays} days)`);
    }
  }

  const ageInDays = daysBetween(new Date(caseData.created_date), REFERENCE_DATE);
  if (ageInDays > 90 && !factors.some(f => f.includes('threshold'))) {
    score += 1;
    factors.push(`case age ${ageInDays} days`);
  }

  const daysSinceUpdate = daysBetween(new Date(caseData.last_updated), REFERENCE_DATE);
  if (daysSinceUpdate > 14 && caseData.status !== 'closed') {
    score += 1;
    factors.push(`no update in ${daysSinceUpdate} days`);
  }

  score = Math.min(10, score);
  if (factors.length === 0) factors.push('no active risk factors');

  const level: RiskLevel = score >= 7 ? 'critical' : score >= 4 ? 'warning' : 'normal';
  return { score, level, factors };
}

export function getRequiredNextActions(
  caseData: Case,
  evidenceItems: EvidenceItem[],
  workflowState: WorkflowStateEntry | null,
  pageIndex: PageIndexEntry[],
): NextAction[] {
  const actions: NextAction[] = [];

  const casePageIndex = pageIndex.find(p => p.case_type === caseData.case_type);
  const stateActions = casePageIndex?.actions.filter(a => a.triggered_at_state === caseData.status) ?? [];

  const requestEvent = [...caseData.timeline]
    .reverse()
    .find(e => e.event === 'evidence_requested');
  const requestDate = requestEvent ? new Date(requestEvent.date) : null;
  const elapsedDays = requestDate ? daysBetween(requestDate, REFERENCE_DATE) : null;
  const threshold = workflowState?.escalation_thresholds;

  // Escalation / reminder actions
  if (elapsedDays !== null && threshold) {
    if (elapsedDays > threshold.escalation_days) {
      const escalateEntry = stateActions.find(a =>
        a.label.toLowerCase().includes('escalat')
      );
      actions.push({
        id: escalateEntry?.action_id ?? `${caseData.case_type.slice(0, 2).toUpperCase()}-ESC`,
        label: `Escalate — evidence outstanding ${elapsedDays} days (threshold: ${threshold.escalation_days})`,
        severity: 'critical',
        dueInDays: -(elapsedDays - threshold.escalation_days),
      });
    } else if (elapsedDays > threshold.reminder_days) {
      const reminderEntry = stateActions.find(a =>
        a.label.toLowerCase().includes('reminder')
      );
      actions.push({
        id: reminderEntry?.action_id ?? `${caseData.case_type.slice(0, 2).toUpperCase()}-REM`,
        label: `Issue reminder — evidence requested ${elapsedDays} days ago (escalation in ${threshold.escalation_days - elapsedDays} days)`,
        severity: 'warning',
        dueInDays: threshold.escalation_days - elapsedDays,
      });
    }
  }

  // Standard workflow state required actions
  if (workflowState) {
    for (let i = 0; i < workflowState.required_actions.length; i++) {
      const actionLabel = workflowState.required_actions[i];
      const ll = actionLabel.toLowerCase();

      // Skip if already covered by escalation/reminder logic above
      const alreadyCovered = actions.some(a =>
        ll.includes('escalat') && a.severity === 'critical' ||
        ll.includes('reminder') && a.severity === 'warning'
      );
      if (alreadyCovered) continue;

      const matchingEntry = stateActions.find(a =>
        keywords(a.label).some(w => ll.includes(w) && w.length > 5)
      );

      const severity: ActionSeverity =
        ll.includes('escalat') ? 'critical' :
        ll.includes('reminder') || ll.includes('overdue') ? 'warning' :
        'info';

      actions.push({
        id: matchingEntry?.action_id ?? `${caseData.status}-${i}`,
        label: actionLabel,
        severity,
        dueInDays: null,
      });
    }
  }

  const severityOrder: Record<ActionSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return actions.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}
