import { useParams, Link } from 'react-router-dom';
import Header from '../components/Header';
import { getEnrichedCaseById, getPoliciesForCase } from '../services/cases';
import { EvidenceStatus, RiskLevel, ActionSeverity } from '../types/case';

// ── Style helpers ─────────────────────────────────────────────────────────────

const EVIDENCE_STYLE: Record<EvidenceStatus, { icon: string; color: string; label: string }> = {
  overdue:     { icon: '🔴', color: '#d4351c', label: 'Overdue' },
  outstanding: { icon: '⏳', color: '#f47738', label: 'Outstanding' },
  received:    { icon: '✅', color: '#00703c', label: 'Received' },
};

const RISK_STYLE: Record<RiskLevel, { bg: string; text: string; border: string }> = {
  critical: { bg: '#fde8e8', text: '#d4351c', border: '#d4351c' },
  warning:  { bg: '#fef3e2', text: '#f47738', border: '#f47738' },
  normal:   { bg: '#e8f5e9', text: '#00703c', border: '#00703c' },
};

const ACTION_STYLE: Record<ActionSeverity, { bg: string; text: string; border: string }> = {
  critical: { bg: '#fde8e8', text: '#d4351c', border: '#d4351c' },
  warning:  { bg: '#fef3e2', text: '#f47738', border: '#f47738' },
  info:     { bg: '#e8f0fe', text: '#1d70b8', border: '#1d70b8' },
};

function formatCaseType(t: string) {
  return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
function formatStatus(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
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
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Case not found</h1>
          <p className="text-gray-600 mb-6">No case matches the reference <code className="font-mono">{caseId}</code>.</p>
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

  const { riskScore, evidenceItems, nextActions, workflowState } = enriched;
  const riskStyle = RISK_STYLE[riskScore.level];
  const policies = getPoliciesForCase(enriched.case_type);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f3f2f1', fontFamily: 'Inter, sans-serif' }}>
      <Header />

      <main className="mx-auto max-w-screen-xl px-6 py-8 space-y-6">

        {/* Back link */}
        <Link
          to="/"
          className="text-sm focus:outline-none focus:ring-[3px] focus:ring-[#ffdd00] rounded px-1"
          style={{ color: '#1d70b8' }}
        >
          ← Back to caseload
        </Link>

        {/* Case header */}
        <div className="bg-white rounded shadow-sm px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="font-mono text-sm text-gray-500">{enriched.case_id}</span>
                <span
                  className="text-xs px-2 py-0.5 rounded font-medium"
                  style={{ backgroundColor: '#e8f0fe', color: '#1d70b8' }}
                >
                  {formatCaseType(enriched.case_type)}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">{enriched.applicant.name}</h1>
              <div className="text-sm text-gray-500 mt-1 space-x-4">
                <span>Ref: {enriched.applicant.reference}</span>
                {enriched.applicant.date_of_birth && (
                  <span>DOB: {formatDate(enriched.applicant.date_of_birth)}</span>
                )}
                <span>Opened: {formatDate(enriched.created_date)}</span>
                <span>Assigned to: {enriched.assigned_to}</span>
              </div>
            </div>

            {/* Risk indicator */}
            <div
              className="rounded px-4 py-3 text-right min-w-[160px]"
              style={{ backgroundColor: riskStyle.bg, border: `2px solid ${riskStyle.border}` }}
              title={riskScore.factors.join(' · ')}
            >
              <div className="text-xs font-semibold uppercase mb-1" style={{ color: riskStyle.text }}>
                Risk Score
              </div>
              <div className="text-3xl font-bold" style={{ color: riskStyle.text }}>
                {riskScore.score}/10
              </div>
              <div className="text-xs font-bold uppercase mt-0.5" style={{ color: riskStyle.text }}>
                {riskScore.level}
              </div>
              <div className="text-xs mt-2 text-left leading-relaxed" style={{ color: riskStyle.text, opacity: 0.85 }}>
                {riskScore.factors.map((f, i) => <div key={i}>· {f}</div>)}
              </div>
            </div>
          </div>

          {/* Status pill */}
          <div className="mt-3">
            <span
              className="inline-block px-3 py-1 rounded-full text-sm font-semibold"
              style={{ backgroundColor: riskStyle.bg, color: riskStyle.text }}
            >
              {formatStatus(enriched.status)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left column: Timeline + Case notes */}
          <div className="lg:col-span-1 space-y-6">

            {/* Timeline */}
            <div className="bg-white rounded shadow-sm px-5 py-4">
              <h2 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wide">Timeline</h2>
              {enriched.timeline.length === 0 ? (
                <p className="text-sm text-gray-500">No events recorded yet.</p>
              ) : (
                <ol className="space-y-4 relative border-l-2 border-gray-200 ml-2">
                  {enriched.timeline.map((event, i) => (
                    <li key={i} className="pl-5 relative">
                      <div
                        className="absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white"
                        style={{ backgroundColor: '#1d70b8' }}
                      />
                      <div className="text-xs text-gray-400 mb-0.5">{formatDate(event.date)}</div>
                      <div className="text-xs font-bold uppercase text-gray-600 mb-0.5">
                        {event.event.replace(/_/g, ' ')}
                      </div>
                      <div className="text-sm text-gray-700">{event.note}</div>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {/* Case notes */}
            <div className="bg-white rounded shadow-sm px-5 py-4">
              <h2 className="font-bold text-gray-800 mb-3 text-sm uppercase tracking-wide">Case Notes</h2>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{enriched.case_notes}</p>
            </div>
          </div>

          {/* Right column: Evidence, Workflow, Policy */}
          <div className="lg:col-span-2 space-y-6">

            {/* Next actions */}
            <div className="bg-white rounded shadow-sm px-5 py-4">
              <h2 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wide">Required Next Actions</h2>
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
                          <span style={{ color: '#0b0c0c' }}>{action.label}</span>
                        </div>
                        {action.dueInDays !== null && (
                          <span className="text-xs ml-4 whitespace-nowrap" style={{ color: s.text }}>
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

            {/* Evidence tracker */}
            <div className="bg-white rounded shadow-sm px-5 py-4">
              <h2 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wide">Evidence Tracker</h2>
              {evidenceItems.length === 0 ? (
                <p className="text-sm text-gray-500">No evidence requirements identified from applicable policies.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ backgroundColor: '#f3f2f1' }}>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Requirement</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Status</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Policy</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Elapsed / Threshold</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evidenceItems.map((item, i) => {
                      const s = EVIDENCE_STYLE[item.status];
                      return (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2 text-gray-800 capitalize">{item.requirement}</td>
                          <td className="px-3 py-2">
                            <span className="font-medium" style={{ color: s.color }}>
                              {s.icon} {s.label}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-gray-500">{item.policyId}</td>
                          <td className="px-3 py-2 text-xs text-gray-600">
                            {item.elapsedDays !== null
                              ? `${item.elapsedDays}d${item.thresholdDays ? ` / ${item.thresholdDays}d` : ''}`
                              : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Workflow state */}
            <div className="bg-white rounded shadow-sm px-5 py-4">
              <h2 className="font-bold text-gray-800 mb-3 text-sm uppercase tracking-wide">Workflow State</h2>
              {workflowState ? (
                <>
                  <div className="font-semibold text-gray-800 mb-1">{workflowState.label}</div>
                  <p className="text-sm text-gray-600 mb-3">{workflowState.description}</p>
                  {workflowState.escalation_thresholds && (
                    <div
                      className="text-xs px-3 py-2 rounded mb-3"
                      style={{ backgroundColor: '#fff9e6', color: '#6d4000' }}
                    >
                      Reminder at {workflowState.escalation_thresholds.reminder_days} days ·
                      Escalation at {workflowState.escalation_thresholds.escalation_days} days
                    </div>
                  )}
                  {workflowState.allowed_transitions.length > 0 && (
                    <div className="text-xs text-gray-500">
                      Allowed transitions:{' '}
                      {workflowState.allowed_transitions.map(t => formatStatus(t)).join(' → ')}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-gray-500">
                  Unknown workflow state: <code className="font-mono">{enriched.status}</code>
                </div>
              )}
            </div>

            {/* Policy panel */}
            <div className="bg-white rounded shadow-sm px-5 py-4">
              <h2 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wide">Applicable Policy</h2>
              {policies.length === 0 ? (
                <div
                  className="px-4 py-3 rounded text-sm"
                  style={{ backgroundColor: '#fde8e8', color: '#d4351c' }}
                >
                  No policy matched for case type: {formatCaseType(enriched.case_type)}
                </div>
              ) : (
                <div className="space-y-4">
                  {policies.map(policy => (
                    <details key={policy.policy_id} className="border rounded">
                      <summary
                        className="px-4 py-3 cursor-pointer font-semibold text-sm select-none focus:outline-none focus:ring-[3px] focus:ring-[#ffdd00]"
                        style={{ backgroundColor: '#f3f2f1' }}
                      >
                        <span className="font-mono text-xs text-gray-500 mr-2">{policy.policy_id}</span>
                        {policy.title}
                      </summary>
                      <div className="px-4 py-3 text-sm text-gray-700 leading-relaxed">
                        {policy.body}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
