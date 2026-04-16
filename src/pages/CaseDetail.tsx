/**
 * Stream B — Case Detail page.
 * B1 CaseHeader · B2 Timeline · B3 CaseNotes · B4 PolicyPanel
 * B5 EvidenceTracker · B6 WorkflowStatusPanel · B7 RiskBadge (shared)
 */

import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Header from '../components/Header';
import RiskBadge from '@/components/shared/RiskBadge';
import CaseChat from '../components/ai/CaseChat';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';
import { getEnrichedCaseById, getPoliciesForCase } from '../services/cases';
import { fetchGovUKGuidance, GovUKResult } from '../services/govuk';
import { EnrichedCase, EvidenceItem, EvidenceStatus, ActionSeverity, WorkflowStateEntry, PolicyExtract } from '../types/case';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(t: string) {
  return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const TIMELINE_ICONS: Record<string, string> = {
  case_created:       '📄',
  evidence_requested: '📨',
  evidence_received:  '📬',
  evidence_verified:  '📬',
  decision:           '⚖️',
  pending_decision:   '⚖️',
  under_review:       '🔍',
  escalated:          '🚨',
  closed:             '✅',
  site_visit:         '🏢',
  consultation_opened:'📢',
  inspection_completed:'🏢',
};

const EVIDENCE_STYLE: Record<EvidenceStatus, { icon: string; dot: string; label: string }> = {
  overdue:     { icon: '⚠️', dot: '#d4351c', label: 'Overdue' },
  outstanding: { icon: '⏳', dot: '#f47738', label: 'Outstanding' },
  received:    { icon: '✓',  dot: '#00703c', label: 'Received' },
};

const ACTION_STYLE: Record<ActionSeverity, { bg: string; text: string; border: string }> = {
  critical: { bg: '#fde8e8', text: '#d4351c', border: '#d4351c' },
  warning:  { bg: '#fef3e2', text: '#f47738', border: '#f47738' },
  info:     { bg: '#e8f0fe', text: '#1d70b8', border: '#1d70b8' },
};

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  escalated:         { bg: '#fde8e8', text: '#d4351c' },
  pending_decision:  { bg: '#e8f0fe', text: '#1d70b8' },
  under_review:      { bg: '#fef3e2', text: '#f47738' },
  awaiting_evidence: { bg: '#fff9e6', text: '#6d4000' },
  case_created:      { bg: '#f3f2f1', text: '#505a5f' },
  closed:            { bg: '#e8f5e9', text: '#00703c' },
};

// ── B1 — Case Header ──────────────────────────────────────────────────────────

function CaseHeader({ enriched }: { enriched: EnrichedCase }) {
  const statusStyle = STATUS_STYLE[enriched.status] ?? { bg: '#f3f2f1', text: '#505a5f' };

  return (
    <div className="bg-white rounded shadow-sm px-6 py-5">
      {/* Breadcrumb */}
      <div className="text-xs text-gray-400 mb-3">
        <Link to="/" className="hover:underline focus:outline-none focus:ring-[3px] focus:ring-[#ffdd00] rounded" style={{ color: '#1d70b8' }}>
          All cases
        </Link>
        {' › '}
        <span className="font-mono">{enriched.case_id}</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {/* Case type badge */}
          <div className="flex items-center gap-2 mb-2">
            <span
              className="text-xs px-2 py-0.5 rounded font-semibold"
              style={{ backgroundColor: '#e8f0fe', color: '#1d70b8' }}
            >
              {fmt(enriched.case_type)}
            </span>
            <span className="font-mono text-xs text-gray-400">{enriched.case_id}</span>
          </div>

          {/* Applicant name */}
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{enriched.applicant.name}</h1>

          {/* Meta */}
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-500">
            <span>Ref: <strong className="text-gray-700">{enriched.applicant.reference}</strong></span>
            {enriched.applicant.date_of_birth && (
              <span>DOB: <strong className="text-gray-700">{fmtDate(enriched.applicant.date_of_birth)}</strong></span>
            )}
            <span>Opened: <strong className="text-gray-700">{fmtDate(enriched.created_date)}</strong></span>
            <span>Assigned to: <strong className="text-gray-700">{enriched.assigned_to}</strong></span>
          </div>
        </div>

        {/* B7 — Risk badge (with HoverCard) */}
        <RiskBadge risk={enriched.riskScore} />
      </div>

      {/* Status pill */}
      <div className="mt-3">
        <span
          className="inline-block px-3 py-1 rounded-full text-sm font-semibold"
          style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}
        >
          {fmt(enriched.status)}
        </span>
      </div>
    </div>
  );
}

// ── B2 — Timeline ─────────────────────────────────────────────────────────────

function Timeline({ enriched }: { enriched: EnrichedCase }) {
  return (
    <div className="bg-white rounded shadow-sm px-5 py-4">
      <h2 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wide">Timeline</h2>
      {enriched.timeline.length === 0 ? (
        <p className="text-sm text-gray-500">No events recorded yet.</p>
      ) : (
        <ol className="relative border-l-2 border-gray-200 ml-3 space-y-5">
          {enriched.timeline.map((event, i) => {
            const icon = TIMELINE_ICONS[event.event] ?? '●';
            return (
              <li key={i} className="pl-5 relative">
                <span className="absolute -left-[13px] top-0 text-base leading-none">{icon}</span>
                <div className="text-xs text-gray-400 mb-0.5">{fmtDate(event.date)}</div>
                <div className="text-xs font-bold uppercase tracking-wide text-gray-600 mb-0.5">
                  {event.event.replace(/_/g, ' ')}
                </div>
                <div className="text-sm text-gray-700">{event.note}</div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

// ── B3 — Case Notes ───────────────────────────────────────────────────────────

function CaseNotes({ enriched }: { enriched: EnrichedCase }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <h2 className="font-bold text-gray-800 mb-3 text-sm uppercase tracking-wide">Case Notes</h2>
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{enriched.case_notes}</p>
      </CardContent>
    </Card>
  );
}

// ── B4 — Policy Panel ─────────────────────────────────────────────────────────

function PolicyPanel({ enriched, policies }: { enriched: EnrichedCase; policies: PolicyExtract[] }) {
  return (
    <div className="bg-white rounded shadow-sm px-5 py-4">
      <h2 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wide">Applicable Policy</h2>
      {policies.length === 0 ? (
        <div
          className="px-4 py-3 rounded text-sm font-medium"
          style={{ backgroundColor: '#fde8e8', color: '#d4351c' }}
        >
          No policy matched for case type: {fmt(enriched.case_type)}
        </div>
      ) : (
        <Accordion type="single" collapsible defaultValue={policies[0].policy_id}>
          {policies.map(policy => (
            <AccordionItem key={policy.policy_id} value={policy.policy_id}>
              <AccordionTrigger className="text-sm focus:outline-none focus:ring-[3px] focus:ring-[#ffdd00] rounded px-1">
                <span className="flex items-center gap-2">
                  <span className="font-mono text-xs text-gray-400">{policy.policy_id}</span>
                  <span className="font-semibold text-gray-800">{policy.title}</span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-gray-700 leading-relaxed px-1">{policy.body}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}

// ── B5 — Evidence Tracker ─────────────────────────────────────────────────────

function EvidenceTracker({ enriched }: { enriched: EnrichedCase }) {
  const { evidenceItems } = enriched;
  return (
    <div className="bg-white rounded shadow-sm px-5 py-4">
      <h2 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wide">Evidence Tracker</h2>
      {evidenceItems.length === 0 ? (
        <p className="text-sm text-gray-500">No evidence requirements identified from applicable policies.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: '#f3f2f1' }}>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500 rounded-tl">Requirement</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Status</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Policy</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500 rounded-tr">Days</th>
            </tr>
          </thead>
          <tbody>
            {evidenceItems.map((item: EvidenceItem, i) => {
              const s = EVIDENCE_STYLE[item.status];
              return (
                <tr key={i} className="border-t">
                  <td className="px-3 py-2.5 text-gray-800 capitalize">{item.requirement}</td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1.5 font-medium" style={{ color: s.dot }}>
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: s.dot }}
                      />
                      {s.icon} {s.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-gray-400">{item.policyId}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-600">
                    {item.elapsedDays !== null
                      ? item.thresholdDays
                        ? `${item.elapsedDays} / ${item.thresholdDays} days`
                        : `${item.elapsedDays} days`
                      : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── B6 — Workflow Status Panel ────────────────────────────────────────────────

function WorkflowStatusPanel({ enriched }: { enriched: EnrichedCase }) {
  const { workflowState, nextActions } = enriched;

  return (
    <div className="bg-white rounded shadow-sm px-5 py-4 space-y-5">

      {/* Workflow state */}
      <div>
        <h2 className="font-bold text-gray-800 mb-3 text-sm uppercase tracking-wide">Workflow State</h2>
        {workflowState ? (
          <>
            <span
              className="inline-block px-3 py-1 rounded-full text-sm font-semibold mb-2"
              style={{ backgroundColor: '#e8f0fe', color: '#1d70b8' }}
            >
              {workflowState.label}
            </span>
            <p className="text-sm text-gray-600 mb-2">{workflowState.description}</p>
            {workflowState.escalation_thresholds && (
              <div
                className="text-xs px-3 py-2 rounded"
                style={{ backgroundColor: '#fff9e6', color: '#6d4000' }}
              >
                Reminder at {workflowState.escalation_thresholds.reminder_days} days ·{' '}
                Escalation at {workflowState.escalation_thresholds.escalation_days} days
              </div>
            )}
            {workflowState.allowed_transitions.length > 0 && (
              <div className="text-xs text-gray-400 mt-2">
                Transitions: {workflowState.allowed_transitions.map(fmt).join(' → ')}
              </div>
            )}
          </>
        ) : (
          <div className="text-sm text-gray-500">
            Unknown workflow state:{' '}
            <code className="font-mono bg-gray-100 px-1 rounded">{enriched.status}</code>
          </div>
        )}
      </div>

      {/* Next actions */}
      <div>
        <h2 className="font-bold text-gray-800 mb-3 text-sm uppercase tracking-wide">Required Next Actions</h2>
        {nextActions.length === 0 ? (
          <p className="text-sm text-gray-500">No actions required at this stage.</p>
        ) : (
          <div className="space-y-2">
            {nextActions.map(action => {
              const s = ACTION_STYLE[action.severity];
              return (
                <Link
                  key={action.id}
                  to={`/case/${enriched.case_id}/action/${action.id}`}
                  className="flex items-start justify-between px-4 py-3 rounded border-l-4 text-sm hover:opacity-90 transition-opacity focus:outline-none focus:ring-[3px] focus:ring-[#ffdd00]"
                  style={{ backgroundColor: s.bg, borderColor: s.border }}
                >
                  <div>
                    <span className="font-bold text-xs uppercase mr-2" style={{ color: s.text }}>
                      {action.severity}
                    </span>
                    <span className="text-gray-800">{action.label}</span>
                  </div>
                  {action.dueInDays !== null && (
                    <span className="text-xs ml-4 whitespace-nowrap font-semibold" style={{ color: s.text }}>
                      {action.dueInDays < 0
                        ? `${Math.abs(action.dueInDays)}d overdue`
                        : `due in ${action.dueInDays}d`}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── GOV.UK Guidance Panel ─────────────────────────────────────────────────────

function GovUKGuidance({ enriched }: { enriched: EnrichedCase }) {
  const [results, setResults] = useState<GovUKResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchGovUKGuidance(enriched.case_type, enriched.status)
      .then(setResults)
      .catch(() => setError('Could not load GOV.UK guidance — check your connection.'))
      .finally(() => setLoading(false));
  }, [enriched.case_type, enriched.status]);

  return (
    <div className="bg-white rounded shadow-sm px-5 py-4">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-bold text-gray-800 text-sm uppercase tracking-wide">
          Related GOV.UK Guidance
        </h2>
        <span
          className="text-xs px-2 py-0.5 rounded font-semibold"
          style={{ backgroundColor: '#e8f0fe', color: '#1d70b8' }}
        >
          Live
        </span>
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse">
              <div className="h-3 bg-gray-200 rounded w-3/4 mb-1.5" />
              <div className="h-2.5 bg-gray-100 rounded w-full" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm" style={{ color: '#f47738' }}>{error}</p>
      )}

      {!loading && !error && results.length === 0 && (
        <p className="text-sm text-gray-500">No matching guidance found on GOV.UK.</p>
      )}

      {!loading && !error && results.length > 0 && (
        <ul className="space-y-4">
          {results.map((r, i) => (
            <li key={i} className="border-b last:border-0 pb-4 last:pb-0">
              <a
                href={`https://www.gov.uk${r.link}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-sm hover:underline focus:outline-none focus:ring-[3px] focus:ring-[#ffdd00] rounded"
                style={{ color: '#1d70b8' }}
              >
                {r.title}
              </a>
              {r.description && (
                <p className="text-xs text-gray-600 mt-1 leading-relaxed line-clamp-2">
                  {r.description}
                </p>
              )}
              <div className="flex items-center gap-3 mt-1.5">
                {r.format && (
                  <span className="text-xs text-gray-400 capitalize">{r.format.replace(/_/g, ' ')}</span>
                )}
                {r.organisations[0] && (
                  <span className="text-xs text-gray-400">{r.organisations[0]}</span>
                )}
                {r.public_timestamp && (
                  <span className="text-xs text-gray-400">
                    {new Date(r.public_timestamp).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-gray-400 mt-4">
        Results fetched live from{' '}
        <a href="https://www.gov.uk" target="_blank" rel="noopener noreferrer" className="underline">
          GOV.UK
        </a>{' '}
        based on case type and current workflow state.
      </p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CaseDetail() {
  const { caseId } = useParams<{ caseId: string }>();
  const enriched = caseId ? getEnrichedCaseById(caseId) : null;

  if (!enriched) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#f3f2f1', fontFamily: 'Inter, sans-serif' }}>
        <Header />
        <main className="mx-auto max-w-screen-xl px-6 py-16 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Case not found</h1>
          <p className="text-gray-500 mb-6">
            No case matches <code className="font-mono bg-gray-100 px-1 rounded">{caseId}</code>.
          </p>
          <Link
            to="/"
            className="inline-block px-5 py-2 rounded text-sm font-bold text-white focus:outline-none focus:ring-[3px] focus:ring-[#ffdd00]"
            style={{ backgroundColor: '#1d70b8' }}
          >
            ← Back to caseload
          </Link>
        </main>
      </div>
    );
  }

  const policies = getPoliciesForCase(enriched.case_type);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f3f2f1', fontFamily: 'Inter, sans-serif' }}>
      <Header />

      <main className="mx-auto max-w-screen-xl px-6 py-8 space-y-6">

        {/* B1 */}
        <CaseHeader enriched={enriched} />

        <CaseChat enriched={enriched} policies={policies} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left column: B2 + B3 */}
          <div className="lg:col-span-1 space-y-6">
            <Timeline enriched={enriched} />
            <CaseNotes enriched={enriched} />
          </div>

          {/* Right column: B6 + B5 + B4 + GOV.UK */}
          <div className="lg:col-span-2 space-y-6">
            <WorkflowStatusPanel enriched={enriched} />
            <EvidenceTracker enriched={enriched} />
            <PolicyPanel enriched={enriched} policies={policies} />
            <GovUKGuidance enriched={enriched} />
          </div>
        </div>

      </main>
    </div>
  );
}
