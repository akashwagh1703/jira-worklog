import { useState, useMemo } from 'react';
import { useConfig } from '../../context/ConfigContext';
import { fetchIssuesWithPagination, fetchWorklogsBulk } from '../../services/jiraService';
import { buildProjectJqlClause } from '../../config/scope';
import * as XLSX from 'xlsx';

const EmployeeReportModal = ({ employee, onClose }) => {
  const { jiraConfig, currentUser } = useConfig();
  const [loading, setLoading] = useState(false);
  const [worklogs, setWorklogs] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [dailyTarget, setDailyTarget] = useState(7);
  const [minusDays, setMinusDays] = useState(0);
  const [dateRange, setDateRange] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  
  if (!employee) return null;

  const fetchWorklogsData = async () => {
    setLoading(true);
    
    const projectFilter = buildProjectJqlClause();
    const authorFilter = `worklogAuthor = "${employee.name}"`;
    const jql = projectFilter
      ? `${projectFilter} AND ${authorFilter} AND worklogDate >= "${dateRange.start}" AND worklogDate <= "${dateRange.end}" ORDER BY updated DESC`
      : `${authorFilter} AND worklogDate >= "${dateRange.start}" AND worklogDate <= "${dateRange.end}" ORDER BY updated DESC`;
    
    const result = await fetchIssuesWithPagination(currentUser, jiraConfig, jql);

    if (result.success && result.data) {
      const issuesByKey = Object.fromEntries(result.data.map((i) => [i.key, i]));
      const issueKeys = result.data.map((i) => i.key).filter(Boolean);

      // Server filters by date range + author for us, returning only the rows we care about.
      const bulk = await fetchWorklogsBulk(currentUser, jiraConfig, issueKeys, {
        startDate: dateRange.start,
        endDate: dateRange.end,
        author: employee.name,
      });

      const totalsByKey = {};
      if (bulk.success) {
        for (const log of bulk.data) {
          const k = log.issueKey;
          if (!k) continue;
          totalsByKey[k] = (totalsByKey[k] || 0) + (log.timeSpentSeconds || 0) / 3600;
        }
      }

      const rows = Object.entries(totalsByKey)
        .filter(([, hrs]) => hrs > 0)
        .map(([k, totalHours]) => {
          const issue = issuesByKey[k];
          return {
            key: k,
            summary: issue?.fields?.summary,
            project: issue?.fields?.project?.name,
            status: issue?.fields?.status?.name,
            created: issue?.fields?.created,
            duedate: issue?.fields?.duedate,
            updated: issue?.fields?.updated,
            totalHours,
          };
        });

      setWorklogs(rows);
    }

    setLoading(false);
  };

  const filteredWorklogs = statusFilter 
    ? worklogs.filter(w => w.status === statusFilter)
    : worklogs;
  
  const totalHours = filteredWorklogs.reduce((sum, w) => sum + w.totalHours, 0);
  const uniqueStatuses = [...new Set(worklogs.map(w => w.status).filter(Boolean))];
  
  const workingDays = useMemo(() => {
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    let count = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) count++;
    }
    return Math.max(0, count - minusDays);
  }, [dateRange, minusDays]);

  const targetHours = dailyTarget * workingDays;

  const minusDaysLabel = (d) => {
    if (d === 0) return null;
    if (d === 0.5) return 'half day';
    const full = Math.floor(d);
    const half = d % 1 !== 0;
    if (full === 0) return 'half day';
    return half ? `${full}½ days` : `${full} day${full !== 1 ? 's' : ''}`;
  };

  const exportToExcel = () => {
    const data = filteredWorklogs.map((w, idx) => ({
      'Sr. No.': idx + 1,
      'Project ID': w.key,
      'Story': w.summary,
      'Project': w.project,
      'Logged Hours': w.totalHours.toFixed(1) + 'h',
      'Start Date': w.created ? new Date(w.created).toLocaleDateString() : '-',
      'Last Updated': w.updated ? new Date(w.updated).toLocaleDateString() : '-',
      'Due Date': w.duedate ? new Date(w.duedate).toLocaleDateString() : '-',
      'Status': w.status
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Worklogs');
    XLSX.writeFile(wb, `${employee.name}_Worklogs_${dateRange.start}_to_${dateRange.end}.xlsx`);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-sm w-full max-w-6xl max-h-[90vh] overflow-y-auto m-4">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-2xl font-semibold text-gray-800">{employee.name} - Worklogs</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div className="mt-7">
                <button
                  onClick={fetchWorklogsData}
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Fetch Data'}
                </button>
              </div>
              {worklogs.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="">All Status</option>
                    {uniqueStatuses.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            {filteredWorklogs.length > 0 && (
              <div className="mt-7">
                <button
                  onClick={exportToExcel}
                  className="px-6 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700"
                >
                  Export to Excel
                </button>
              </div>
            )}
          </div>

          {filteredWorklogs.length > 0 && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-sm text-blue-600 font-medium">Total Work Hours</p>
                  <p className="text-3xl font-bold text-blue-700 mt-1">{totalHours.toFixed(1)}h</p>
                </div>
                
                <div className="bg-green-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-green-600 font-medium">Target Hours</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={dailyTarget}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '' || /^\d*\.?\d*$/.test(value)) {
                            setDailyTarget(value === '' ? '' : value);
                          }
                        }}
                        onBlur={(e) => {
                          const value = parseFloat(e.target.value);
                          if (isNaN(value) || value < 0.1) {
                            setDailyTarget(7);
                          } else if (value > 24) {
                            setDailyTarget(24);
                          } else {
                            setDailyTarget(value);
                          }
                        }}
                        className="w-16 px-2 py-1 text-xs border border-green-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                      />
                      <span className="text-xs text-green-600">h/day</span>
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-green-700">{targetHours.toFixed(1)}h</p>
                  <div className="flex items-center gap-2 mt-2">
                    <p className="text-xs text-green-600">{workingDays} working days</p>
                    <span className="text-xs text-green-400">|</span>
                    <span className="text-xs text-green-600">Minus:</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setMinusDays(d => Math.max(0, parseFloat((d - 0.5).toFixed(1))))}
                        disabled={minusDays === 0}
                        className="w-5 h-5 flex items-center justify-center rounded bg-green-200 text-green-800 text-xs font-bold hover:bg-green-300 disabled:opacity-30"
                      >−</button>
                      <span className="text-xs font-semibold text-green-800 min-w-[24px] text-center">{minusDays}</span>
                      <button
                        onClick={() => setMinusDays(d => parseFloat((d + 0.5).toFixed(1)))}
                        className="w-5 h-5 flex items-center justify-center rounded bg-green-200 text-green-800 text-xs font-bold hover:bg-green-300"
                      >+</button>
                    </div>
                    {minusDaysLabel(minusDays) && (
                      <span className="text-xs text-green-600 italic">({minusDaysLabel(minusDays)})</span>
                    )}
                  </div>
                </div>
                
                <div className={`rounded-xl p-4 ${totalHours >= targetHours ? 'bg-green-50' : 'bg-red-50'}`}>
                  <p className={`text-sm font-medium ${totalHours >= targetHours ? 'text-green-600' : 'text-red-600'}`}>
                    {totalHours >= targetHours ? 'Target Achieved ✓' : 'Short of Target'}
                  </p>
                  <p className={`text-3xl font-bold mt-1 ${totalHours >= targetHours ? 'text-green-700' : 'text-red-700'}`}>
                    {totalHours >= targetHours ? '+' : ''}{(totalHours - targetHours).toFixed(1)}h
                  </p>
                </div>
              </div>
              
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-gray-800 mb-3">Project-wise Hours</p>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(
                    filteredWorklogs.reduce((acc, w) => {
                      acc[w.project] = (acc[w.project] || 0) + w.totalHours;
                      return acc;
                    }, {})
                  ).map(([project, hours]) => (
                    <div key={project} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                      <span className="text-xs text-gray-700">{project}</span>
                      <span className="text-sm font-bold text-blue-600">{hours.toFixed(1)}h</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Worklog Details</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Story</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Logged Hours</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Updated</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredWorklogs.length > 0 ? (
                    filteredWorklogs.map((worklog, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium">
                          <a 
                            href={`${(currentUser?.jiraCredentials || jiraConfig).baseUrl}/browse/${worklog.key}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {worklog.key}
                          </a>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-800">{worklog.summary || 'N/A'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{worklog.project || 'N/A'}</td>
                        <td className="px-4 py-3 text-sm font-medium text-blue-600">{worklog.totalHours.toFixed(1)}h</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {worklog.created ? new Date(worklog.created).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {worklog.updated ? new Date(worklog.updated).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {worklog.duedate ? new Date(worklog.duedate).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            worklog.status === 'Done' ? 'bg-green-100 text-green-800' :
                            worklog.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' :
                            worklog.status === 'To Do' ? 'bg-gray-100 text-gray-800' :
                            worklog.status === 'Testing' ? 'bg-blue-100 text-blue-800' :
                            'bg-purple-100 text-purple-800'
                          }`}>
                            {worklog.status || 'N/A'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                        {loading ? 'Loading...' : 'Click "Fetch Data" to load worklogs'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeReportModal;
