import { Link } from 'react-router-dom';
import RiskBadge from '@/components/shared/RiskBadge';
import type { EnrichedCase } from '@/types/case';

function fmt(t: string) {
  return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  escalated:         { bg: '#fde8e8', text: '#d4351c' },
  pending_decision:  { bg: '#e8f0fe', text: '#1d70b8' },
  under_review:      { bg: '#fef3e2', text: '#f47738' },
  awaiting_evidence: { bg: '#fff9e6', text: '#6d4000' },
  case_created:      { bg: '#f3f2f1', text: '#505a5f' },
  closed:            { bg: '#e8f5e9', text: '#00703c' },
};

interface ActionContextHeaderProps {
  enriched: EnrichedCase;
  actionLabel: string;
}

export default function ActionContextHeader({ enriched, actionLabel }: ActionContextHeaderProps) {
  const statusStyle = STATUS_STYLE[enriched.status] ?? { bg: '#f3f2f1', text: '#505a5f' };

  return (
    <div className="bg-white rounded shadow-sm px-6 py-5">
      {/* Breadcrumb */}
      <div className="text-xs text-gray-400 mb-3 flex flex-wrap items-center gap-1">
        <Link
          to="/"
          className="hover:underline focus:outline-none focus:ring-[3px] focus:ring-[#ffdd00] rounded"
          style={{ color: '#1d70b8' }}
        >
          All cases
        </Link>
        <span>›</span>
        <Link
          to={`/case/${enriched.case_id}`}
          className="hover:underline focus:outline-none focus:ring-[3px] focus:ring-[#ffdd00] rounded font-mono"
          style={{ color: '#1d70b8' }}
        >
          {enriched.case_id}
        </Link>
        <span>›</span>
        <span className="text-gray-600 truncate max-w-xs">{actionLabel}</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {/* Case type badge + ID */}
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
