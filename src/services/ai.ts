import type {
  EnrichedCase,
  PolicyExtract,
  PageIndexEntry,
  PriorityInsightInputs,
  PriorityInsightResult,
  FallbackReason,
  TriageCounts,
  HeatmapTile,
  RiskLevel,
  EvidenceAdviceInputs,
  EvidenceAdviceResult,
} from '../types/case';
import { composeEvidenceFallback } from '../lib/action';
import { callOpenAI, OpenAIError } from './openai';

const RISK_ORDER: Record<RiskLevel, number> = { critical: 0, warning: 1, normal: 2 };

export function computeTriageCounts(filtered: EnrichedCase[]): TriageCounts {
  const counts: TriageCounts = { critical: 0, warning: 0, normal: 0 };
  for (const c of filtered) counts[c.riskScore.level]++;
  return counts;
}

function extractThresholdPhrase(
  factors: string[],
  workflowState: EnrichedCase['workflowState'],
): string | null {
  const thresholdFactor = factors.find(f =>
    f.includes('escalation threshold') || f.includes('escalation_threshold')
  );
  if (!thresholdFactor) return null;
  const days = workflowState?.escalation_thresholds?.escalation_days;
  return days ? `${days}-day escalation threshold` : 'escalation threshold';
}

function resolvePolicyFromAction(
  actionId: string | null,
  caseType: string,
  pageIndex: PageIndexEntry[],
): string | null {
  if (!actionId) return null;
  const entry = pageIndex.find(p => p.case_type === caseType);
  const action = entry?.actions.find(a => a.action_id === actionId);
  return action?.policy_refs[0] ?? null;
}

function resolvePolicyFromEvidence(evidenceItems: EnrichedCase['evidenceItems']): string | null {
  const overdue = evidenceItems.find(e => e.status === 'overdue');
  if (overdue) return overdue.policyId;
  const outstanding = evidenceItems.find(e => e.status === 'outstanding');
  return outstanding?.policyId ?? null;
}

function buildActionHref(caseId: string, actionId: string | null, pageIndex: PageIndexEntry[], caseType: string): string | null {
  if (!actionId) return null;
  const entry = pageIndex.find(p => p.case_type === caseType);
  const known = entry?.actions.some(a => a.action_id === actionId);
  if (!known) return null;
  return `/case/${caseId}/action/${actionId}`;
}

export function selectPriorityCase(
  filtered: EnrichedCase[],
  policies: PolicyExtract[],
  pageIndex: PageIndexEntry[],
): PriorityInsightInputs | null {
  if (filtered.length === 0) return null;

  const sorted = [...filtered].sort((a, b) => {
    const levelDiff = RISK_ORDER[a.riskScore.level] - RISK_ORDER[b.riskScore.level];
    if (levelDiff !== 0) return levelDiff;
    const scoreDiff = b.riskScore.score - a.riskScore.score;
    if (scoreDiff !== 0) return scoreDiff;
    return a.case_id.localeCompare(b.case_id);
  });

  const chosen = sorted[0];
  const topAction = chosen.nextActions[0];
  const actionId = topAction?.id ?? null;
  const actionLabel = topAction?.label ?? 'Review case';

  const policyId =
    resolvePolicyFromAction(actionId, chosen.case_type, pageIndex) ??
    resolvePolicyFromEvidence(chosen.evidenceItems);
  const policyTitle = policyId
    ? policies.find(p => p.policy_id === policyId)?.title ?? null
    : null;
  const resolvedPolicyId = policyTitle ? policyId : null;

  return {
    caseId: chosen.case_id,
    caseRef: chosen.case_id,
    applicantName: chosen.applicant.name,
    riskLevel: chosen.riskScore.level,
    topFactors: chosen.riskScore.factors.slice(0, 3),
    policyId: resolvedPolicyId,
    policyTitle,
    thresholdPhrase: extractThresholdPhrase(chosen.riskScore.factors, chosen.workflowState),
    actionId,
    actionLabel,
    actionHref: buildActionHref(chosen.case_id, actionId, pageIndex, chosen.case_type),
  };
}

export function composeFallback(inputs: PriorityInsightInputs): string {
  const { caseRef, policyId, thresholdPhrase, actionLabel } = inputs;
  const parenthetical = thresholdPhrase ? ` (${thresholdPhrase})` : '';
  const breached = policyId
    ? `${caseRef} has breached ${policyId}${parenthetical}.`
    : `${caseRef} is the highest-priority case.`;
  return `${breached} Recommended action: ${actionLabel}.`;
}

export function buildHeatmapTiles(filtered: EnrichedCase[]): HeatmapTile[] {
  const tiles: HeatmapTile[] = filtered.map(c => ({
    caseId: c.case_id,
    caseRef: c.case_id,
    applicantName: c.applicant.name,
    riskLevel: c.riskScore.level,
    riskScore: c.riskScore.score,
    href: `/case/${c.case_id}`,
  }));

  return tiles.sort((a, b) => {
    const levelDiff = RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel];
    if (levelDiff !== 0) return levelDiff;
    return b.riskScore - a.riskScore;
  });
}

const TIMEOUT_MS = 5000;

function readSupabaseConfig(): { url: string; anonKey: string } | null {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey =
    import.meta.env.VITE_SUPABASE_ANON_KEY ??
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (typeof url !== 'string' || url.length === 0) return null;
  if (typeof anonKey !== 'string' || anonKey.length === 0) return null;
  return { url: url.replace(/\/+$/, ''), anonKey };
}

function buildFallback(inputs: PriorityInsightInputs, reason: FallbackReason): PriorityInsightResult {
  return { status: 'fallback', text: composeFallback(inputs), inputs, reason };
}

// ── Evidence Advice (feature 003) ─────────────────────────────────────────────

const EVIDENCE_ADVICE_PATH = '/functions/v1/evidence-advice';

export function validateEvidenceResponse(text: string, inputs: EvidenceAdviceInputs): boolean {
  if (!text.includes(inputs.caseRef)) return false;
  if (!text.includes(inputs.actionLabel)) return false;
  const hasGap = inputs.evidence.some(e => e.status !== 'received');
  if (hasGap) {
    const anyRequirementMentioned = inputs.evidence
      .filter(e => e.status !== 'received')
      .some(e => text.includes(e.requirement));
    if (!anyRequirementMentioned) return false;
  }
  return true;
}

function buildEvidenceAdviceFallback(inputs: EvidenceAdviceInputs, reason: FallbackReason): EvidenceAdviceResult {
  return { status: 'fallback', text: composeEvidenceFallback(inputs), inputs, reason };
}

export async function getEvidenceAdvice(
  inputs: EvidenceAdviceInputs,
  signal?: AbortSignal,
): Promise<EvidenceAdviceResult> {
  const config = readSupabaseConfig();
  if (!config) return buildEvidenceAdviceFallback(inputs, 'no-key');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  let response: Response;
  try {
    response = await fetch(`${config.url}${EVIDENCE_ADVICE_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
      },
      body: JSON.stringify({
        caseRef: inputs.caseRef,
        actionId: inputs.actionId,
        actionLabel: inputs.actionLabel,
        scope: inputs.scope,
        policies: inputs.policies,
        evidence: inputs.evidence,
        counts: inputs.counts,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    const reason: FallbackReason =
      err instanceof DOMException && err.name === 'AbortError' ? 'timeout' : 'network-error';
    return buildEvidenceAdviceFallback(inputs, reason);
  }
  clearTimeout(timeout);

  if (!response.ok) return buildEvidenceAdviceFallback(inputs, 'non-2xx');

  let text: string;
  try {
    const body = (await response.json()) as { text?: string };
    text = (body.text ?? '').trim();
  } catch {
    return buildEvidenceAdviceFallback(inputs, 'malformed');
  }

  if (!text || !validateEvidenceResponse(text, inputs)) return buildEvidenceAdviceFallback(inputs, 'malformed');

  return { status: 'llm', text, inputs };
}

// ── Priority Insight (feature 002) ────────────────────────────────────────────

const PRIORITY_SYSTEM_PROMPT = [
  'You are a decision-support assistant for a UK government caseworker.',
  'Given structured priority-case inputs, write ONE short sentence (max 30 words)',
  'identifying the case, the breached policy and threshold (if any), and the',
  'recommended next action. Mention the case reference verbatim. Do not invent',
  'identifiers. Plain English. No emoji.',
].join('\n');

export async function getPriorityInsight(
  inputs: PriorityInsightInputs,
  signal?: AbortSignal,
): Promise<PriorityInsightResult> {
  const userPrompt = JSON.stringify({
    caseRef: inputs.caseRef,
    applicantName: inputs.applicantName,
    riskLevel: inputs.riskLevel,
    topFactors: inputs.topFactors,
    policyId: inputs.policyId,
    policyTitle: inputs.policyTitle,
    thresholdPhrase: inputs.thresholdPhrase,
    actionLabel: inputs.actionLabel,
  }, null, 2);

  try {
    const text = await callOpenAI(
      [
        { role: 'system', content: PRIORITY_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      { timeoutMs: 8000, maxTokens: 120, temperature: 0.2 },
      signal,
    );
    return { status: 'llm', text, inputs };
  } catch (err) {
    const reason: FallbackReason =
      err instanceof OpenAIError ? err.reason : 'network-error';
    return buildFallback(inputs, reason);
  }
}
