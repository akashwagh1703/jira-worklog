import { Fragment, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchAudit } from '../services/authService';

// Phase 4 audit-log viewer. Admin-only. Tail-style view with filters.
//
// Server stores entries as JSONL; we paginate by `limit` only (server tails the
// file from the end and applies action/user filters before returning).
const KNOWN_ACTIONS = [
  '',                       // any
  'login_sso',
  'logout',
  'issues.fetch',
  'issues.error',
  'worklogs.fetch_single',
  'worklogs.fetch_bulk',
  'worklogs.scope_denied',
  'worklogs.scope_filtered',
  'worklogs.error',
  'users.fetch',
  'users.error',
  'admin.user_upsert',
  'admin.user_update',
  'admin.user_delete',
  'admin.error',
];

const ACTION_BADGE = {
  login_sso:               'bg-emerald-100 text-emerald-800',
  logout:                  'bg-slate-100 text-slate-700',
  'issues.fetch':          'bg-blue-50 text-blue-700',
  'issues.error':          'bg-red-100 text-red-800',
  'worklogs.fetch_single': 'bg-blue-50 text-blue-700',
  'worklogs.fetch_bulk':   'bg-blue-50 text-blue-700',
  'worklogs.scope_denied': 'bg-amber-100 text-amber-800',
  'worklogs.scope_filtered': 'bg-amber-50 text-amber-700',
  'worklogs.error':        'bg-red-100 text-red-800',
  'users.fetch':           'bg-blue-50 text-blue-700',
  'users.error':           'bg-red-100 text-red-800',
  'admin.user_upsert':     'bg-purple-100 text-purple-800',
  'admin.user_update':     'bg-purple-100 text-purple-800',
  'admin.user_delete':     'bg-rose-100 text-rose-800',
  'admin.error':           'bg-red-100 text-red-800',
};

const formatTs = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  } catch {
    return iso;
  }
};

const summarize = (row) => {
  const d = row.details || {};
  switch (row.action) {
    case 'login_sso':              return d.email ? `signed in (${d.role || 'employee'})` : 'signed in';
    case 'logout':                 return 'signed out';
    case 'issues.fetch':           return `${d.rows ?? 0} issues / total ${d.total ?? '?'}${d.scopedJql ? ' [scope-clamped]' : ''}`;
    case 'issues.error':           return `error: ${d.error || 'unknown'}`;
    case 'worklogs.fetch_single':  return `issue ${d.issueKey} → ${d.rows ?? 0} entries`;
    case 'worklogs.fetch_bulk':    return `${d.issueCount ?? 0} issues → ${d.rows ?? 0} worklog entries`;
    case 'worklogs.scope_denied':  return `BLOCKED ${d.issueKey}`;
    case 'worklogs.scope_filtered':return `kept ${d.kept ?? 0}, dropped ${d.dropped ?? 0} out-of-scope`;
    case 'worklogs.error':         return `error: ${d.error || 'unknown'}`;
    case 'users.fetch':            return `${d.count ?? 0} users (days=${d.days ?? '?'})`;
    case 'users.error':            return `error: ${d.error || 'unknown'}`;
    case 'admin.user_upsert':      return `upsert ${d.targetEmail} as ${d.role}`;
    case 'admin.user_update':      return `update ${d.targetEmail} → role=${d.newRole}`;
    case 'admin.user_delete':      return `delete ${d.targetEmail}`;
    case 'admin.error':            return `error: ${d.error || 'unknown'}`;
    default:                       return '';
  }
};

const AdminAuditLogPage = () => {
  const { user: me, loading: meLoading } = useAuth();
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [filters, setFilters] = useState({ action: '', user: '', limit: 200 });
  const [expanded, setExpanded] = useState(() => new Set());

  const loadRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAudit(filters);
      if (res?.success === false) {
        setError(res.message || 'Failed to load audit log');
        setRows([]);
      } else {
        setRows(res?.rows || []);
      }
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to load audit log');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!meLoading && me?.role === 'admin') loadRows();
    // We want a manual refresh model — only refetch when the user clicks Apply.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meLoading, me]);

  const toggle = (idx) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const stats = useMemo(() => {
    const byAction = {};
    rows.forEach((r) => { byAction[r.action] = (byAction[r.action] || 0) + 1; });
    return byAction;
  }, [rows]);

  if (meLoading) return null;

  if (me?.role !== 'admin') {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <p className="text-gray-600">You need admin access to view this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800">Audit Log</h1>
        <p className="text-sm text-gray-500 mt-1">
          Append-only record of every privileged action — sign-ins, data exports, admin changes, and scope violations.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-sm">{error}</div>
      )}

      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Action</label>
            <select
              value={filters.action}
              onChange={(e) => setFilters({ ...filters, action: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
            >
              {KNOWN_ACTIONS.map((a) => (
                <option key={a || 'any'} value={a}>{a || '— any —'}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">User email</label>
            <input
              type="text"
              value={filters.user}
              onChange={(e) => setFilters({ ...filters, user: e.target.value })}
              placeholder="leave blank for all"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Limit</label>
            <input
              type="number"
              min="1"
              max="2000"
              value={filters.limit}
              onChange={(e) => setFilters({ ...filters, limit: Math.max(1, Math.min(2000, parseInt(e.target.value, 10) || 200)) })}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={loadRows}
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-blue-300"
            >
              {loading ? 'Loading…' : 'Apply / Refresh'}
            </button>
          </div>
        </div>

        {Object.keys(stats).length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(stats).map(([action, count]) => (
              <span
                key={action}
                className={`text-xs px-2 py-1 rounded-full ${ACTION_BADGE[action] || 'bg-gray-100 text-gray-700'}`}
              >
                {action} · {count}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Summary</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                    {loading ? 'Loading…' : 'No audit entries match these filters.'}
                  </td>
                </tr>
              ) : rows.map((r, idx) => (
                <Fragment key={`${r.ts}-${idx}`}>
                  <tr
                    onClick={() => toggle(idx)}
                    className="cursor-pointer hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 text-xs font-mono text-gray-700 whitespace-nowrap">{formatTs(r.ts)}</td>
                    <td className="px-4 py-3 text-sm text-gray-800">
                      {r.user || <span className="text-gray-400 italic">anonymous</span>}
                      {r.role && <span className="ml-1 text-xs text-gray-500">({r.role})</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded ${ACTION_BADGE[r.action] || 'bg-gray-100 text-gray-700'}`}>
                        {r.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{summarize(r)}</td>
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono">{r.ip || '—'}</td>
                  </tr>
                  {expanded.has(idx) && (
                    <tr className="bg-gray-50">
                      <td colSpan="5" className="px-4 py-3">
                        <pre className="text-xs text-gray-700 whitespace-pre-wrap break-all bg-white p-3 rounded border border-gray-200">
{JSON.stringify(r, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminAuditLogPage;
