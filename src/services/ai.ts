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
} from '../types/case';

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

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const TIMEOUT_MS = 5000;

function buildSystemPrompt(): string {
  return [
    'You are a decision-support assistant for a UK government caseworker named Sam.',
    'You will be given the single highest-priority case from her morning caseload,',
    'with its risk factors and the recommended next action. Write a 2-to-3-sentence',
    'briefing that:',
    '  - names the case by its reference,',
    '  - names the applicable policy by its identifier when provided,',
    '  - recommends the named next action as the first thing Sam should do today.',
    'Do not invent case references, policy identifiers, or actions. Do not soften',
    'the recommendation. Be direct. Do not use emoji.',
  ].join('\n');
}

function buildUserPrompt(inputs: PriorityInsightInputs): string {
  const lines = [
    `Priority case: ${inputs.caseRef}`,
    `Applicant: ${inputs.applicantName}`,
    `Risk level: ${inputs.riskLevel}`,
    `Top risk factors: ${inputs.topFactors.join('; ') || 'none recorded'}`,
  ];
  if (inputs.policyId && inputs.policyTitle) {
    lines.push(`Applicable policy: ${inputs.policyId} — ${inputs.policyTitle}`);
  }
  if (inputs.thresholdPhrase) {
    lines.push(`Threshold breached: ${inputs.thresholdPhrase}`);
  }
  lines.push(`Recommended next action: "${inputs.actionLabel}"`);
  return lines.join('\n');
}

function validateResponse(text: string, inputs: PriorityInsightInputs): boolean {
  if (!text.includes(inputs.caseRef)) return false;
  if (!text.includes(inputs.actionLabel)) return false;
  if (inputs.policyId && !text.includes(inputs.policyId)) return false;
  return true;
}

function readApiKey(): string | null {
  const key = import.meta.env.VITE_OPENAI_API_KEY;
  return typeof key === 'string' && key.length > 0 ? key : null;
}

function buildFallback(inputs: PriorityInsightInputs, reason: FallbackReason): PriorityInsightResult {
  return { status: 'fallback', text: composeFallback(inputs), inputs, reason };
}

export async function getPriorityInsight(
  inputs: PriorityInsightInputs,
  signal?: AbortSignal,
): Promise<PriorityInsightResult> {
  const apiKey = readApiKey();
  if (!apiKey) return buildFallback(inputs, 'no-key');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  let response: Response;
  try {
    response = await fetch(OPENAI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 180,
        response_format: { type: 'text' },
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: buildUserPrompt(inputs) },
        ],
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    const reason: FallbackReason =
      err instanceof DOMException && err.name === 'AbortError' ? 'timeout' : 'network-error';
    return buildFallback(inputs, reason);
  }
  clearTimeout(timeout);

  if (!response.ok) return buildFallback(inputs, 'non-2xx');

  let text: string;
  try {
    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    text = body.choices?.[0]?.message?.content?.trim() ?? '';
  } catch {
    return buildFallback(inputs, 'malformed');
  }

  if (!text || !validateResponse(text, inputs)) return buildFallback(inputs, 'malformed');

  return { status: 'llm', text, inputs };
}
