import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { getAllEnrichedCases } from '../services/cases';
import { EnrichedCase, RiskLevel } from '../types/case';
import { SEGMENT_ORDER, SEGMENT_LABELS } from '../lib/constants';
import AIStrategyAssistant from '../components/ai/AIStrategyAssistant';
import WorkloadHeatmap from '../components/ai/WorkloadHeatmap';

const allCases = getAllEnrichedCases();

const RISK_COLORS: Record<RiskLevel, { bg: string; text: string; label: string }> = {
  critical: { bg: '#fde8e8', text: '#d4351c', label: 'Critical' },
  warning:  { bg: '#fef3e2', text: '#f47738', label: 'Warning' },
  normal:   { bg: '#e8f5e9', text: '#00703c', label: 'Normal' },
};

function RiskBadge({ level, score }: { level: RiskLevel; score: number }) {
  const { bg, text, label } = RISK_COLORS[level];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold"
      style={{ backgroundColor: bg, color: text }}
    >
      {label} {score}/10
    </span>
  );
}

function formatCaseType(t: string) {
  return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
function formatStatus(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  escalated:        { bg: '#fde8e8', text: '#d4351c' },
  pending_decision: { bg: '#e8f0fe', text: '#1d70b8' },
  under_review:     { bg: '#fef3e2', text: '#f47738' },
  awaiting_evidence:{ bg: '#fff9e6', text: '#6d4000' },
  case_created:     { bg: '#f3f2f1', text: '#505a5f' },
  closed:           { bg: '#e8f5e9', text: '#00703c' },
};

type SortKey = 'risk' | 'age';

export default function CaseloadOverview() {
  const navigate = useNavigate();

  const [sortKey, setSortKey] = useState<SortKey>('risk');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterAssigned, setFilterAssigned] = useState('');
  const [groupBySegment, setGroupBySegment] = useState(false);

  const distinctTypes = useMemo(() => [...new Set(allCases.map(c => c.case_type))].sort(), []);
  const distinctStatuses = useMemo(() => [...new Set(allCases.map(c => c.status))].sort(), []);
  const distinctAssigned = useMemo(() => [...new Set(allCases.map(c => c.assigned_to))].sort(), []);

  const filtered = useMemo(() => {
    return allCases.filter(c =>
      (!filterType || c.case_type === filterType) &&
      (!filterStatus || c.status === filterStatus) &&
      (!filterAssigned || c.assigned_to === filterAssigned)
    );
  }, [filterType, filterStatus, filterAssigned]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) =>
      sortKey === 'risk'
        ? b.riskScore.score - a.riskScore.score
        : b.ageInDays - a.ageInDays
    );
  }, [filtered, sortKey]);

  // Overdue cases hidden by current filter
  const overdueCases = allCases.filter(c => c.evidenceItems.some(e => e.status === 'overdue'));
  const hiddenOverdueCases = overdueCases.filter(c => !filtered.includes(c));

  function clearObscuringFilters() {
    const hiddenTypes = new Set(hiddenOverdueCases.map(c => c.case_type));
    const hiddenStatuses = new Set(hiddenOverdueCases.map(c => c.status));
    const hiddenAssigned = new Set(hiddenOverdueCases.map(c => c.assigned_to));
    if (filterType && hiddenTypes.has(filterType)) setFilterType('');
    if (filterStatus && hiddenStatuses.has(filterStatus)) setFilterStatus('');
    if (filterAssigned && hiddenAssigned.has(filterAssigned)) setFilterAssigned('');
  }

  // Summary tiles (based on filtered set)
  const totalCases = filtered.length;
  const awaitingEvidence = filtered.filter(c => c.status === 'awaiting_evidence').length;
  const overdueCasesFiltered = filtered.filter(c => c.evidenceItems.some(e => e.status === 'overdue')).length;
  const avgAge = filtered.length > 0
    ? Math.round(filtered.reduce((sum, c) => sum + c.ageInDays, 0) / filtered.length)
    : 0;

  function handleRowClick(caseId: string) {
    navigate(`/case/${caseId}`);
  }

  function renderTable(rows: EnrichedCase[]) {
    return (
      <table className="w-full text-left text-sm">
        <thead>
          <tr style={{ backgroundColor: '#f3f2f1' }}>
            <th className="px-4 py-3 font-semibold text-xs uppercase text-gray-600 border-b sticky top-0 bg-[#f3f2f1]">Case ID</th>
            <th className="px-4 py-3 font-semibold text-xs uppercase text-gray-600 border-b sticky top-0 bg-[#f3f2f1]">Applicant</th>
            <th className="px-4 py-3 font-semibold text-xs uppercase text-gray-600 border-b sticky top-0 bg-[#f3f2f1]">Type</th>
            <th className="px-4 py-3 font-semibold text-xs uppercase text-gray-600 border-b sticky top-0 bg-[#f3f2f1]">Status</th>
            <th
              className="px-4 py-3 font-semibold text-xs uppercase text-gray-600 border-b sticky top-0 bg-[#f3f2f1] cursor-pointer hover:underline select-none"
              onClick={() => setSortKey('age')}
            >
              Age{sortKey === 'age' ? ' ▼' : ''}
            </th>
            <th
              className="px-4 py-3 font-semibold text-xs uppercase text-gray-600 border-b sticky top-0 bg-[#f3f2f1] cursor-pointer hover:underline select-none"
              onClick={() => setSortKey('risk')}
            >
              Risk{sortKey === 'risk' ? ' ▼' : ''}
            </th>
            <th className="px-4 py-3 border-b sticky top-0 bg-[#f3f2f1]" />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-gray-500">No cases match the current filters.</td>
            </tr>
          )}
          {rows.map(c => {
            const statusStyle = STATUS_BADGE[c.status] ?? { bg: '#f3f2f1', text: '#505a5f' };
            return (
              <tr
                key={c.case_id}
                tabIndex={0}
                onClick={() => handleRowClick(c.case_id)}
                onKeyDown={e => e.key === 'Enter' && handleRowClick(c.case_id)}
                className="hover:bg-gray-50 cursor-pointer border-b focus:outline-none focus:ring-[3px] focus:ring-inset"
                style={{
                  borderLeft: `5px solid ${RISK_COLORS[c.riskScore.level].text}`,
                }}
              >
                <td className="px-4 py-3 font-mono font-bold text-xs">{c.case_id}</td>
                <td className="px-4 py-3">{c.applicant.name}</td>
                <td className="px-4 py-3 italic text-gray-600">{formatCaseType(c.case_type)}</td>
                <td className="px-4 py-3">
                  <span
                    className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                    style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}
                  >
                    {formatStatus(c.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{c.ageInDays}d</td>
                <td className="px-4 py-3"><RiskBadge level={c.riskScore.level} score={c.riskScore.score} /></td>
                <td className="px-4 py-3 text-right" style={{ color: '#1d70b8' }}>View →</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  function renderGrouped() {
    const segments = [...SEGMENT_ORDER];
    const grouped: Record<string, EnrichedCase[]> = {};
    const other: EnrichedCase[] = [];

    for (const s of segments) grouped[s] = [];
    for (const c of sorted) {
      if (segments.includes(c.status as any)) {
        grouped[c.status].push(c);
      } else {
        other.push(c);
      }
    }

    return (
      <>
        {segments.map(seg => (
          <div key={seg} className="mb-4">
            <div
              className="px-4 py-2 text-sm font-bold text-white flex items-center gap-2"
              style={{ backgroundColor: '#505a5f' }}
            >
              {SEGMENT_LABELS[seg]}
              <span className="ml-1 text-xs font-normal opacity-75">({grouped[seg].length})</span>
            </div>
            {renderTable(grouped[seg])}
          </div>
        ))}
        {other.length > 0 && (
          <div className="mb-4">
            <div className="px-4 py-2 text-sm font-bold text-white" style={{ backgroundColor: '#505a5f' }}>
              Other <span className="text-xs font-normal opacity-75">({other.length})</span>
            </div>
            {renderTable(other)}
          </div>
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f3f2f1', fontFamily: 'Inter, sans-serif' }}>
      <Header />

      <main className="mx-auto max-w-screen-xl px-6 py-8 space-y-6">

        {/* Workload heatmap (above summary tiles per FR-113) */}
        <WorkloadHeatmap filtered={filtered} />

        {/* Summary tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Cases', value: totalCases, color: '#0b0c0c' },
            { label: 'Awaiting Evidence', value: awaitingEvidence, color: '#f47738' },
            { label: 'Overdue Cases', value: overdueCasesFiltered, color: '#d4351c' },
            { label: 'Avg Case Age (days)', value: avgAge, color: '#1d70b8' },
          ].map(tile => (
            <div key={tile.label} className="bg-white rounded shadow-sm px-5 py-4">
              <div className="text-3xl font-bold" style={{ color: tile.color }}>{tile.value}</div>
              <div className="text-xs text-gray-500 mt-1 uppercase tracking-wide">{tile.label}</div>
            </div>
          ))}
        </div>

        {/* Overdue hidden warning banner */}
        {hiddenOverdueCases.length > 0 && (
          <div
            className="flex items-center justify-between px-4 py-3 rounded text-sm font-medium"
            style={{ backgroundColor: '#fef3e2', border: '2px solid #f47738', color: '#6d4000' }}
          >
            <span>
              {hiddenOverdueCases.length} overdue case{hiddenOverdueCases.length > 1 ? 's' : ''} hidden by current filter
            </span>
            <button
              onClick={clearObscuringFilters}
              className="underline font-bold focus:outline-none focus:ring-[3px] focus:ring-[#ffdd00] rounded px-1"
              style={{ color: '#f47738' }}
            >
              Show
            </button>
          </div>
        )}

        {/* Main area: filters + table alongside the AI Strategy Assistant sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
          <div className="space-y-6 min-w-0">

        {/* Filters + group toggle */}
        <div className="bg-white rounded shadow-sm px-5 py-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">Case Type</label>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-[3px] focus:ring-[#ffdd00]"
            >
              <option value="">All types</option>
              {distinctTypes.map(t => <option key={t} value={t}>{formatCaseType(t)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-[3px] focus:ring-[#ffdd00]"
            >
              <option value="">All statuses</option>
              {distinctStatuses.map(s => <option key={s} value={s}>{formatStatus(s)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">Assigned to</label>
            <select
              value={filterAssigned}
              onChange={e => setFilterAssigned(e.target.value)}
              className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-[3px] focus:ring-[#ffdd00]"
            >
              <option value="">All caseworkers</option>
              {distinctAssigned.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 cursor-pointer select-none" htmlFor="group-toggle">
              Group by segment
            </label>
            <button
              id="group-toggle"
              role="switch"
              aria-checked={groupBySegment}
              onClick={() => setGroupBySegment(g => !g)}
              className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-[3px] focus:ring-[#ffdd00]"
              style={{ backgroundColor: groupBySegment ? '#1d70b8' : '#ccc' }}
            >
              <span
                className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                style={{ transform: groupBySegment ? 'translateX(22px)' : 'translateX(4px)' }}
              />
            </button>
          </div>
        </div>

        {/* Case table */}
        <div className="bg-white rounded shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b flex items-center justify-between">
            <h2 className="font-bold text-gray-800">Your Caseload</h2>
            <div className="flex gap-2 text-xs">
              <span className="px-2 py-1 rounded font-bold" style={{ backgroundColor: '#fde8e8', color: '#d4351c' }}>
                {allCases.filter(c => c.riskScore.level === 'critical').length} Critical
              </span>
              <span className="px-2 py-1 rounded font-bold" style={{ backgroundColor: '#fef3e2', color: '#f47738' }}>
                {allCases.filter(c => c.riskScore.level === 'warning').length} Warning
              </span>
            </div>
          </div>
          <div className="overflow-auto max-h-[60vh]">
            {groupBySegment ? renderGrouped() : renderTable(sorted)}
          </div>
        </div>

          </div>

          {/* AI Strategy Assistant sidebar (FR-101) */}
          <AIStrategyAssistant filtered={filtered} />
        </div>

      </main>
    </div>
  );
}
