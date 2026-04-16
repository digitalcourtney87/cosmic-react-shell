/**
 * GOV.UK Content API integration.
 * Fetches live guidance relevant to a case from the GOV.UK Search API.
 * No API key required — the endpoint is public.
 */

export interface GovUKResult {
  title: string;
  description: string;
  link: string;
  format: string;
  public_timestamp: string;
  organisations: string[];
}

// ── Search term mapping ───────────────────────────────────────────────────────
// Maps case type + optional status to the most useful GOV.UK search query.

const CASE_TYPE_QUERIES: Record<string, string> = {
  benefit_review:      'benefit entitlement review change of circumstances evidence',
  licence_application: 'premises licence application local authority',
  compliance_check:    'regulatory compliance enforcement inspection',
};

const STATUS_REFINEMENTS: Record<string, string> = {
  awaiting_evidence:  'evidence requirements documents',
  under_review:       'assessment decision making',
  pending_decision:   'decision notification appeal rights',
  escalated:          'escalation enforcement action',
  case_created:       'eligibility criteria application',
};

export function buildSearchQuery(caseType: string, status: string): string {
  const base = CASE_TYPE_QUERIES[caseType] ?? caseType.replace(/_/g, ' ');
  const refinement = STATUS_REFINEMENTS[status] ?? '';
  return refinement ? `${base} ${refinement}` : base;
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

const SEARCH_BASE = 'https://www.gov.uk/api/search.json';

export async function fetchGovUKGuidance(
  caseType: string,
  status: string,
  count = 5,
): Promise<GovUKResult[]> {
  const query = buildSearchQuery(caseType, status);
  const url = `${SEARCH_BASE}?q=${encodeURIComponent(query)}&count=${count}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`GOV.UK API returned ${res.status}`);

  const data = await res.json();
  const results: GovUKResult[] = (data.results ?? []).map((r: any) => ({
    title: r.title ?? '',
    description: r.description ?? '',
    link: r.link ?? '',
    format: r.format ?? r.document_type ?? '',
    public_timestamp: r.public_timestamp ?? '',
    organisations: (r.organisations ?? []).map((o: any) => o.title ?? o).filter(Boolean),
  }));

  return results.filter(r => r.title && r.link);
}
