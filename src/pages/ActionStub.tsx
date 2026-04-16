import { useParams, Link } from 'react-router-dom';
import Header from '../components/Header';
import { getEnrichedCaseById, getActionEntry } from '../services/cases';
import { ActionSeverity } from '../types/case';

const SEVERITY_STYLE: Record<ActionSeverity, { bg: string; text: string; border: string }> = {
  critical: { bg: '#fde8e8', text: '#d4351c', border: '#d4351c' },
  warning:  { bg: '#fef3e2', text: '#f47738', border: '#f47738' },
  info:     { bg: '#e8f0fe', text: '#1d70b8', border: '#1d70b8' },
};

export default function ActionStub() {
  const { caseId, actionId } = useParams<{ caseId: string; actionId: string }>();

  const enriched = caseId ? getEnrichedCaseById(caseId) : null;

  if (!enriched) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#f3f2f1', fontFamily: 'Inter, sans-serif' }}>
        <Header />
        <main className="mx-auto max-w-screen-xl px-6 py-16 text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Case not found</h1>
          <Link to="/" className="text-sm underline" style={{ color: '#1d70b8' }}>← Back to caseload</Link>
        </main>
      </div>
    );
  }

  const action = enriched.nextActions.find(a => a.id === actionId);
  const pageIndexEntry = getActionEntry(enriched.case_type, actionId ?? '');

  if (!action) {
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

  const s = SEVERITY_STYLE[action.severity];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f3f2f1', fontFamily: 'Inter, sans-serif' }}>
      <Header />

      <main className="mx-auto max-w-screen-xl px-6 py-8 space-y-6">

        <Link
          to={`/case/${caseId}`}
          className="text-sm focus:outline-none focus:ring-[3px] focus:ring-[#ffdd00] rounded px-1"
          style={{ color: '#1d70b8' }}
        >
          ← Back to {caseId}
        </Link>

        {/* Mock action panel */}
        <div
          className="bg-white rounded shadow-sm border-l-8 px-6 py-5"
          style={{ borderColor: s.border }}
        >
          <div className="flex items-center gap-3 mb-4">
            <span
              className="text-xs font-bold uppercase px-2 py-0.5 rounded"
              style={{ backgroundColor: s.bg, color: s.text }}
            >
              {action.severity}
            </span>
            <span className="font-mono text-xs text-gray-500">{actionId}</span>
            <span
              className="text-xs px-2 py-0.5 rounded"
              style={{ backgroundColor: '#fff9e6', color: '#6d4000' }}
            >
              Mock action page
            </span>
          </div>

          <h1 className="text-xl font-bold text-gray-900 mb-1">{action.label}</h1>
          <p className="text-sm text-gray-500 mb-5">
            Case reference: <span className="font-mono font-bold">{caseId}</span>
          </p>

          {action.dueInDays !== null && (
            <div
              className="inline-block text-sm px-3 py-1 rounded mb-5"
              style={{ backgroundColor: s.bg, color: s.text }}
            >
              {action.dueInDays < 0
                ? `${Math.abs(action.dueInDays)} days overdue`
                : `Due in ${action.dueInDays} days`}
            </div>
          )}

          {/* Page navigation steps from page-index */}
          {pageIndexEntry && pageIndexEntry.pages.length > 0 && (
            <div>
              <h2 className="font-bold text-sm uppercase text-gray-600 mb-3 tracking-wide">
                Pages to navigate
              </h2>
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
                        {p.url_pattern.replace('{case_id}', caseId ?? '').replace('{reference}', enriched.applicant.reference)}
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
              <h2 className="font-bold text-sm uppercase text-gray-600 mb-2 tracking-wide">Policy references</h2>
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

          <div
            className="mt-6 px-4 py-3 rounded text-sm"
            style={{ backgroundColor: '#f3f2f1', color: '#505a5f' }}
          >
            This is a read-only mock action page. No state changes will be saved.
          </div>
        </div>

      </main>
    </div>
  );
}
