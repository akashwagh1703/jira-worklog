import { useState } from 'react';
import { useConfig } from '../context/ConfigContext';
import { useNotification } from '../context/NotificationContext';
import { fetchIssues } from '../services/jiraService';

const CustomReportBuilderPage = () => {
  const { jiraConfig, currentUser } = useConfig();
  const { showSuccess, showError } = useNotification();
  const [reportConfig, setReportConfig] = useState({
    name: '',
    dateRange: { start: '', end: '' },
    fields: [],
    groupBy: '',
    filters: { status: '', priority: '', project: '' }
  });
  const [savedReports, setSavedReports] = useState([]);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  const availableFields = [
    { id: 'issueKey', label: 'Issue Key' },
    { id: 'summary', label: 'Summary' },
    { id: 'status', label: 'Status' },
    { id: 'priority', label: 'Priority' },
    { id: 'assignee', label: 'Assignee' },
    { id: 'project', label: 'Project' },
    { id: 'created', label: 'Created Date' },
    { id: 'updated', label: 'Updated Date' },
    { id: 'timeSpent', label: 'Time Spent' },
    { id: 'dueDate', label: 'Due Date' }
  ];

  const toggleField = (fieldId) => {
    setReportConfig(prev => ({
      ...prev,
      fields: prev.fields.includes(fieldId)
        ? prev.fields.filter(f => f !== fieldId)
        : [...prev.fields, fieldId]
    }));
  };

  const generateReport = async () => {
    if (!reportConfig.dateRange.start || !reportConfig.dateRange.end) {
      showError('Please select date range');
      return;
    }

    setLoading(true);
    const jql = `created >= "${reportConfig.dateRange.start}" AND created <= "${reportConfig.dateRange.end}" ORDER BY created DESC`;
    const result = await fetchIssues(currentUser, jiraConfig, '', jql);

    if (result.success && result.data) {
      let filteredData = result.data;

      if (reportConfig.filters.status) {
        filteredData = filteredData.filter(i => i.fields?.status?.name === reportConfig.filters.status);
      }
      if (reportConfig.filters.priority) {
        filteredData = filteredData.filter(i => i.fields?.priority?.name === reportConfig.filters.priority);
      }
      if (reportConfig.filters.project) {
        filteredData = filteredData.filter(i => i.fields?.project?.name === reportConfig.filters.project);
      }

      const processedData = filteredData.map(issue => {
        const row = {};
        reportConfig.fields.forEach(field => {
          switch(field) {
            case 'issueKey': row[field] = issue.key; break;
            case 'summary': row[field] = issue.fields.summary; break;
            case 'status': row[field] = issue.fields.status?.name; break;
            case 'priority': row[field] = issue.fields.priority?.name; break;
            case 'assignee': row[field] = issue.fields.assignee?.displayName; break;
            case 'project': row[field] = issue.fields.project?.name; break;
            case 'created': row[field] = new Date(issue.fields.created).toLocaleDateString(); break;
            case 'updated': row[field] = new Date(issue.fields.updated).toLocaleDateString(); break;
            case 'dueDate': row[field] = issue.fields.duedate ? new Date(issue.fields.duedate).toLocaleDateString() : 'N/A'; break;
            default: row[field] = 'N/A';
          }
        });
        return row;
      });

      setReportData(processedData);
      showSuccess('Report generated successfully!');
    } else {
      showError('Failed to generate report');
    }
    setLoading(false);
  };

  const saveReport = () => {
    if (!reportConfig.name) {
      showError('Please enter report name');
      return;
    }
    const newReport = { ...reportConfig, id: Date.now() };
    const updated = [...savedReports, newReport];
    setSavedReports(updated);
    localStorage.setItem('customReports', JSON.stringify(updated));
    showSuccess('Report saved successfully!');
  };

  const loadReport = (report) => {
    setReportConfig(report);
    showSuccess('Report loaded');
  };

  const exportToCSV = () => {
    if (!reportData || reportData.length === 0) return;

    const headers = reportConfig.fields.map(f => availableFields.find(af => af.id === f)?.label).join(',');
    const rows = reportData.map(row => reportConfig.fields.map(f => `"${row[f] || ''}"`).join(','));
    const csv = [headers, ...rows].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportConfig.name || 'custom-report'}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Custom Report Builder</h1>
          <p className="text-sm text-gray-500 mt-1">Build and save custom reports</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Report Configuration</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Report Name</label>
                <input
                  type="text"
                  value={reportConfig.name}
                  onChange={(e) => setReportConfig({ ...reportConfig, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="My Custom Report"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={reportConfig.dateRange.start}
                    onChange={(e) => setReportConfig({ ...reportConfig, dateRange: { ...reportConfig.dateRange, start: e.target.value } })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                  <input
                    type="date"
                    value={reportConfig.dateRange.end}
                    onChange={(e) => setReportConfig({ ...reportConfig, dateRange: { ...reportConfig.dateRange, end: e.target.value } })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Fields</label>
                <div className="grid grid-cols-2 gap-2">
                  {availableFields.map(field => (
                    <label key={field.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={reportConfig.fields.includes(field.id)}
                        onChange={() => toggleField(field.id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{field.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status Filter</label>
                  <select
                    value={reportConfig.filters.status}
                    onChange={(e) => setReportConfig({ ...reportConfig, filters: { ...reportConfig.filters, status: e.target.value } })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="">All</option>
                    <option value="Done">Done</option>
                    <option value="In Progress">In Progress</option>
                    <option value="To Do">To Do</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priority Filter</label>
                  <select
                    value={reportConfig.filters.priority}
                    onChange={(e) => setReportConfig({ ...reportConfig, filters: { ...reportConfig.filters, priority: e.target.value } })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="">All</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Group By</label>
                  <select
                    value={reportConfig.groupBy}
                    onChange={(e) => setReportConfig({ ...reportConfig, groupBy: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="">None</option>
                    <option value="status">Status</option>
                    <option value="priority">Priority</option>
                    <option value="project">Project</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={generateReport}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Generating...' : 'Generate Report'}
                </button>
                <button
                  onClick={saveReport}
                  className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700"
                >
                  Save
                </button>
                <button
                  onClick={exportToCSV}
                  disabled={!reportData}
                  className="px-4 py-2 bg-gray-600 text-white rounded-xl hover:bg-gray-700 disabled:opacity-50"
                >
                  Export CSV
                </button>
              </div>
            </div>
          </div>

          {reportData && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Report Results ({reportData.length} items)</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {reportConfig.fields.map(field => (
                        <th key={field} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          {availableFields.find(f => f.id === field)?.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {reportData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        {reportConfig.fields.map(field => (
                          <td key={field} className="px-4 py-3 text-sm text-gray-600">{row[field]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Saved Reports</h3>
          {savedReports.length === 0 ? (
            <p className="text-sm text-gray-500">No saved reports</p>
          ) : (
            <div className="space-y-2">
              {savedReports.map(report => (
                <button
                  key={report.id}
                  onClick={() => loadReport(report)}
                  className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <p className="text-sm font-medium text-gray-800">{report.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{report.fields.length} fields</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomReportBuilderPage;
