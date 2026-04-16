import type {
  EnrichedCase,
  EvidenceItem,
  ActionEntry,
  PolicyExtract,
  EvidenceAdviceInputs,
} from '../types/case';

// ── Evidence selection ────────────────────────────────────────────────────────

function sortEvidence(items: EvidenceItem[]): EvidenceItem[] {
  const order: Record<EvidenceItem['status'], number> = { overdue: 0, outstanding: 1, received: 2 };
  return [...items].sort((a, b) => {
    const statusDiff = order[a.status] - order[b.status];
    if (statusDiff !== 0) return statusDiff;
    const policyDiff = a.policyId.localeCompare(b.policyId);
    if (policyDiff !== 0) return policyDiff;
    return a.requirement.localeCompare(b.requirement);
  });
}

export function selectActionEvidence(
  enriched: EnrichedCase,
  action: ActionEntry,
): { items: EvidenceItem[]; scope: 'action' | 'case-wide' } {
  if (action.policy_refs.length === 0) {
    return { items: sortEvidence(enriched.evidenceItems), scope: 'case-wide' };
  }

  const scoped = enriched.evidenceItems.filter(item =>
    action.policy_refs.includes(item.policyId)
  );

  if (scoped.length <= 1) {
    return { items: sortEvidence(enriched.evidenceItems), scope: 'case-wide' };
  }

  return { items: sortEvidence(scoped), scope: 'action' };
}

// ── Input bag assembly ────────────────────────────────────────────────────────

export function buildEvidenceAdviceInputs(
  enriched: EnrichedCase,
  action: ActionEntry,
  scoped: { items: EvidenceItem[]; scope: 'action' | 'case-wide' },
  policies: PolicyExtract[],
): EvidenceAdviceInputs {
  const relevantPolicies = action.policy_refs
    .map(id => {
      const p = policies.find(pol => pol.policy_id === id);
      return p ? { id: p.policy_id, title: p.title } : null;
    })
    .filter((p): p is { id: string; title: string } => p !== null);

  const counts = {
    received: scoped.items.filter(e => e.status === 'received').length,
    outstanding: scoped.items.filter(e => e.status === 'outstanding').length,
    overdue: scoped.items.filter(e => e.status === 'overdue').length,
  };

  return {
    caseRef: enriched.case_id,
    actionId: action.action_id,
    actionLabel: action.label,
    scope: scoped.scope,
    policies: relevantPolicies,
    evidence: scoped.items.map(e => ({
      requirement: e.requirement,
      status: e.status,
      elapsedDays: e.elapsedDays,
      thresholdDays: e.thresholdDays,
      policyId: e.policyId,
    })),
    counts,
  };
}

// ── Deterministic fallback text ───────────────────────────────────────────────

export function composeEvidenceFallback(inputs: EvidenceAdviceInputs): string {
  const { caseRef, actionLabel, evidence, counts, policies } = inputs;
  const total = counts.received + counts.outstanding + counts.overdue;

  if (total === 0) {
    const policyRef = policies[0]?.id;
    return policyRef
      ? `${caseRef} — no evidence recorded for ${actionLabel}. Issue an evidence request citing ${policyRef}.`
      : `${caseRef} — no evidence recorded for ${actionLabel}. Issue an evidence request.`;
  }

  if (counts.outstanding === 0 && counts.overdue === 0) {
    return `${caseRef} — all ${total} evidence item${total === 1 ? '' : 's'} received for ${actionLabel}. You can proceed.`;
  }

  const firstNonReceived = evidence.find(e => e.status !== 'received');
  const chase = firstNonReceived
    ? `Chase ${firstNonReceived.requirement} (cite ${firstNonReceived.policyId}).`
    : 'Chase outstanding items.';

  return `${caseRef} — for ${actionLabel}: ${counts.received}/${total} received, ${counts.outstanding} outstanding, ${counts.overdue} overdue. ${chase}`;
}
