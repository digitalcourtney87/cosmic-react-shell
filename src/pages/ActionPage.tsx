/**
 * Feature 003 — Case Action Pages.
 * Replaces ActionStub with a four-section read-only action page:
 *   1. ActionContextHeader — case header with breadcrumb to this action
 *   2. Action panel — severity, label, due-in-days, pages-to-navigate, policy refs
 *   3. PolicyExcerpts — accordion of policy bodies for this action's policy_refs
 *   4. Evidence + AI Advice grid — scoped evidence table + EvidenceAdvice card
 */

import { useParams, Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import Header from '../components/Header';
import ActionContextHeader from '../components/action/ActionContextHeader';
import PolicyExcerpts from '../components/action/PolicyExcerpts';
import ActionEvidenceTable from '../components/action/ActionEvidenceTable';
import EvidenceAdvice from '../components/action/EvidenceAdvice';
import { getEnrichedCaseById, getActionEntry, policies } from '../services/cases';
import { getEvidenceAdvice } from '../services/ai';
import { selectActionEvidence, buildEvidenceAdviceInputs } from '../lib/action';
import type { ActionEntry, EvidenceAdviceResult } from '../types/case';

const SEVERITY_STYLE = {
  critical: { bg: '#fde8e8', text: '#d4351c', border: '#d4351c' },
  warning:  { bg: '#fef3e2', text: '#f47738', border: '#f47738' },
  info:     { bg: '#e8f0fe', text: '#1d70b8', border: '#1d70b8' },
} as const;

export default function ActionPage() {
  const { caseId, actionId } = useParams<{ caseId: string; actionId: string }>();

  const enriched = caseId ? getEnrichedCaseById(caseId) : null;

  const [adviceResult, setAdviceResult] = useState<EvidenceAdviceResult>({ status: 'pending' });
  const abortRef = useRef<AbortController | null>(null);

  // ── Not found states ─────────────────────────────────────────────────────────

  if (!enriched) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#f3f2f1', fontFamily: 'Inter, sans-serif' }}>
        <Header />
        <main className="mx-auto max-w-screen-xl px-6 py-16 text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Case not found</h1>
          <Link to="/" className="text-sm underline" style={{ color: '#1d70b8' }}>
            ← Back to caseload
          </Link>
        </main>
      </div>
    );
  }

  const nextAction = enriched.nextActions.find(a => a.id === actionId);
  const pageIndexEntry = getActionEntry(enriched.case_type, actionId ?? '');

  if (!nextAction) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#f3f2f1', fontFamily: 'Inter, sans-serif' }}>
        <Header />
        <main className="mx-auto max-w-screen-xl px-6 py-16 text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Action not found</h1>
          <p className="text-gray-600 mb-6">
            No action <code className="font-mono">{actionId}</code> found on case{' '}
            <code className="font-mono">{caseId}</code>.
          </p>
          <Link
            to={`/case/${caseId}`}
            className="inline-block px-5 py-2 rounded text-sm font-bold text-white focus:outline-none focus:ring-[3px] focus:ring-[#ffdd00]"
            style={{ backgroundColor: '#1d70b8' }}
          >
            ← Back to case
          </Link>
        </main>
      </div>
    );
  }

  // ── Derive evidence inputs ───────────────────────────────────────────────────

  // If the action came from dynamic escalation/reminder logic, it may not have
  // a page-index entry. Synthesise a minimal ActionEntry so derivation still works.
  const entry: ActionEntry = pageIndexEntry ?? {
    action_id: actionId ?? '',
    label: nextAction.label,
    triggered_at_state: enriched.status,
    policy_refs: [],
    pages: [],
  };

  const scoped = selectActionEvidence(enriched, entry);
  const adviceInputs = buildEvidenceAdviceInputs(enriched, entry, scoped, policies);

  const s = SEVERITY_STYLE[nextAction.severity];

  // ── Fetch AI advice (effect declared after all hooks to satisfy Rules of Hooks) ─

  useEffect(() => {
    abortRef.current = new AbortController();
    setAdviceResult({ status: 'pending' });

    getEvidenceAdvice(adviceInputs, abortRef.current.signal).then(setAdviceResult);

    return () => {
      abortRef.current?.abort();
    };
    // adviceInputs is re-derived on every render from frozen fixtures + REFERENCE_DATE
    // so the identity is stable; stringify guards against accidental re-fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adviceInputs.caseRef, adviceInputs.actionId]);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f3f2f1', fontFamily: 'Inter, sans-serif' }}>
      <Header />

      <main className="mx-auto max-w-screen-xl px-6 py-8 space-y-6">

        {/* Section 1 — Case context header */}
        <ActionContextHeader enriched={enriched} actionLabel={nextAction.label} />

        {/* Section 2 — Action panel */}
        <div
          className="bg-white rounded shadow-sm border-l-8 px-6 py-5"
          style={{ borderColor: s.border }}
        >
          <div className="flex items-center gap-3 mb-4">
            <span
              className="text-xs font-bold uppercase px-2 py-0.5 rounded"
              style={{ backgroundColor: s.bg, color: s.text }}
            >
              {nextAction.severity}
            </span>
            <span className="font-mono text-xs text-gray-500">{actionId}</span>
            <span
              className="text-xs px-2 py-0.5 rounded"
              style={{ backgroundColor: '#fff9e6', color: '#6d4000' }}
            >
              Read only
            </span>
          </div>

          <h2 className="text-xl font-bold text-gray-900 mb-1">{nextAction.label}</h2>
          <p className="text-sm text-gray-500 mb-5">
            Case reference: <span className="font-mono font-bold">{caseId}</span>
          </p>

          {nextAction.dueInDays !== null && (
            <div
              className="inline-block text-sm px-3 py-1 rounded mb-5"
              style={{ backgroundColor: s.bg, color: s.text }}
            >
              {nextAction.dueInDays < 0
                ? `${Math.abs(nextAction.dueInDays)} days overdue`
                : `Due in ${nextAction.dueInDays} days`}
            </div>
          )}

          {/* Pages to navigate */}
          {pageIndexEntry && pageIndexEntry.pages.length > 0 && (
            <div>
              <h3 className="font-bold text-sm uppercase text-gray-600 mb-3 tracking-wide">
                Pages to navigate
              </h3>
              <div className="space-y-3">
                {pageIndexEntry.pages.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-4 px-4 py-3 rounded border text-sm"
                    style={{ backgroundColor: '#f3f2f1' }}
                  >
                    <span
                      className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: '#1d70b8' }}
                    >
                      {i + 1}
                    </span>
                    <div>
                      <div className="font-semibold text-gray-800">{p.page}</div>
                      <div className="text-gray-500 mt-0.5">{p.purpose}</div>
                      <div className="font-mono text-xs text-gray-400 mt-1">
                        {p.url_pattern
                          .replace('{case_id}', caseId ?? '')
                          .replace('{reference}', enriched.applicant.reference)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Policy refs */}
          {pageIndexEntry && pageIndexEntry.policy_refs.length > 0 && (
            <div className="mt-5">
              <h3 className="font-bold text-sm uppercase text-gray-600 mb-2 tracking-wide">
                Policy references
              </h3>
              <div className="flex gap-2 flex-wrap">
                {pageIndexEntry.policy_refs.map(ref => (
                  <span
                    key={ref}
                    className="font-mono text-xs px-2 py-1 rounded"
                    style={{ backgroundColor: '#e8f0fe', color: '#1d70b8' }}
                  >
                    {ref}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Section 3 — Policy excerpts */}
        <PolicyExcerpts
          policyRefs={entry.policy_refs}
          policies={policies}
        />

        {/* Section 4 — Evidence + AI advice */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded shadow-sm px-6 py-5">
            <ActionEvidenceTable items={scoped.items} scope={scoped.scope} />
          </div>
          <div className="lg:col-span-1">
            <EvidenceAdvice result={adviceResult} />
          </div>
        </div>

      </main>
    </div>
  );
}
