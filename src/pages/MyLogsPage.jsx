import { useState, useEffect } from 'react';
import { useConfig } from '../context/ConfigContext';
import { fetchIssues, fetchWorklogs } from '../services/jiraService';
import QuickWorklogEntry from '../components/QuickWorklogEntry';
import { ListSkeleton } from '../components/LoadingSkeleton';

const MyLogsPage = () => {
  const { jiraConfig, currentUser } = useConfig();
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [allLogs, setAllLogs] = useState([]);
  const [filters, setFilters] = useState({
    dateRange: { 
      start: new Date().toISOString().split('T')[0], 
      end: new Date().toISOString().split('T')[0] 
    },
    project: '',
    status: '',
    priority: '',
    issueType: ''
  });
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    if ((currentUser.userType === 'employee' && currentUser.jiraCredentials) || 
        (currentUser.userType === 'management' && jiraConfig.baseUrl && jiraConfig.email && jiraConfig.apiToken)) {
      loadLogs();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jiraConfig, currentUser, filters.dateRange]);

  useEffect(() => {
    // Only apply non-date filters (date is handled in API call)
    applyNonDateFilters();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.project, filters.status, filters.priority, filters.issueType]);

  const loadLogs = async () => {
    setLoading(true);
    
    const result = await fetchIssues(currentUser, jiraConfig, '', '');
    
    if (result.success && result.data) {
      console.log('MyLogs - Total issues:', result.data.length);

      // Extract unique projects
      const uniqueProjects = [...new Set(result.data.map(i => i?.fields?.project?.name).filter(Boolean))];
      setProjects(uniqueProjects);

      // Fetch worklogs for all issues in parallel
      const worklogPromises = result.data.map(issue => 
        fetchWorklogs(currentUser, jiraConfig, issue.key)
          .then(worklogResult => ({ issue, worklogResult }))
      );
      
      const worklogResults = await Promise.all(worklogPromises);
      
      // Process worklogs and filter by date
      const logsData = [];
      const startDate = new Date(filters.dateRange.start);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(filters.dateRange.end);
      endDate.setHours(23, 59, 59, 999);
      
      worklogResults.forEach(({ issue, worklogResult }) => {
        if (worklogResult.success && worklogResult.data) {
          worklogResult.data.forEach(log => {
            const logDate = new Date(log.created);
            
            // Filter by worklog creation date
            if (logDate >= startDate && logDate <= endDate) {
              // Handle comment - extract text and media URLs
              let commentText = 'No comment';
              let commentMedia = [];
              if (log.comment) {
                if (typeof log.comment === 'string') {
                  commentText = log.comment;
                } else if (log.comment.content) {
                  const textParts = [];
                  log.comment.content.forEach(block => {
                    if (block.type === 'mediaGroup' && block.content) {
                      block.content.forEach(media => {
                        if (media.type === 'media' && media.attrs?.url) {
                          commentMedia.push(media.attrs.url);
                        }
                      });
                    } else if (block.content) {
                      const text = block.content.map(item => item.text).join(' ');
                      if (text) textParts.push(text);
                    }
                  });
                  commentText = textParts.join(' ') || 'No comment';
                }
              }

              logsData.push({
                issueKey: issue.key,
                issueSummary: issue.fields.summary,
                project: issue.fields.project?.name,
                status: issue.fields.status?.name,
                priority: issue.fields.priority?.name,
                issueType: issue.fields.issuetype?.name,
                author: log.author?.displayName || 'Unknown',
                timeSpent: log.timeSpent,
                timeSpentSeconds: log.timeSpentSeconds,
                created: log.created,
                comment: commentText,
                media: commentMedia
              });
            }
          });
        }
      });
      
      console.log('MyLogs - Total worklogs (filtered by date):', logsData.length);

      const sortedLogs = logsData.sort((a, b) => new Date(b.created) - new Date(a.created));
      setAllLogs(sortedLogs);
      setLogs(sortedLogs);
    }
    setLoading(false);
  };

  const applyNonDateFilters = () => {
    let filtered = [...allLogs];

    // Project filter
    if (filters.project) {
      filtered = filtered.filter(log => log.project === filters.project);
    }

    // Status filter
    if (filters.status) {
      filtered = filtered.filter(log => log.status === filters.status);
    }

    // Priority filter
    if (filters.priority) {
      filtered = filtered.filter(log => log.priority === filters.priority);
    }

    // Issue Type filter
    if (filters.issueType) {
      filtered = filtered.filter(log => log.issueType === filters.issueType);
    }

    console.log('Non-date filters applied:', { project: filters.project, status: filters.status, priority: filters.priority });
    console.log('Filtered logs count:', filtered.length);
    setLogs(filtered);
  };

  const clearFilters = () => {
    const today = new Date().toISOString().split('T')[0];
    setFilters({
      dateRange: { start: today, end: today },
      project: '',
      status: '',
      priority: '',
      issueType: ''
    });
  };

  const applyDatePreset = (preset) => {
    const today = new Date();
    let start, end;
    
    switch(preset) {
      case 'today':
        start = end = today.toISOString().split('T')[0];
        break;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        start = end = yesterday.toISOString().split('T')[0];
        break;
      case 'thisWeek':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        start = weekStart.toISOString().split('T')[0];
        end = today.toISOString().split('T')[0];
        break;
      case 'lastWeek':
        const lastWeekEnd = new Date(today);
        lastWeekEnd.setDate(today.getDate() - today.getDay() - 1);
        const lastWeekStart = new Date(lastWeekEnd);
        lastWeekStart.setDate(lastWeekEnd.getDate() - 6);
        start = lastWeekStart.toISOString().split('T')[0];
        end = lastWeekEnd.toISOString().split('T')[0];
        break;
      case 'thisMonth':
        start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        end = today.toISOString().split('T')[0];
        break;
      case 'lastMonth':
        const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        start = lastMonthStart.toISOString().split('T')[0];
        end = lastMonthEnd.toISOString().split('T')[0];
        break;
      default:
        return;
    }
    
    setFilters({ ...filters, dateRange: { start, end } });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTotalHours = () => {
    return (logs.reduce((sum, log) => sum + log.timeSpentSeconds, 0) / 3600).toFixed(2);
  };

  const getCompletionRate = () => {
    if (logs.length === 0) return 0;
    const uniqueIssues = [...new Set(logs.map(l => l.issueKey))];
    const completedIssues = uniqueIssues.filter(key => {
      const log = logs.find(l => l.issueKey === key);
      return log && log.status === 'Done';
    });
    return ((completedIssues.length / uniqueIssues.length) * 100).toFixed(0);
  };

  const getAvgTimePerTask = () => {
    if (logs.length === 0) return 0;
    const uniqueIssues = [...new Set(logs.map(l => l.issueKey))];
    const totalHours = parseFloat(getTotalHours());
    return (totalHours / uniqueIssues.length).toFixed(1);
  };

  const exportToCSV = () => {
    const totalHours = getTotalHours();
    const dateRange = `${filters.dateRange.start} to ${filters.dateRange.end}`;
    
    const csvContent = [
      `Work Log Report`,
      `Date Range: ${dateRange}`,
      `Total Entries: ${logs.length}`,
      `Total Hours: ${totalHours}h`,
      `Generated: ${new Date().toLocaleString()}`,
      '',
      'Sr No,Date,Issue Key,Summary,Project,Status,Priority,Time Spent,Author,Comment',
      ...logs.map((log, idx) => [
        idx + 1,
        formatDate(log.created),
        log.issueKey,
        log.issueSummary,
        log.project,
        log.status,
        log.priority,
        log.timeSpent,
        log.author,
        log.comment.replace(/"/g, '""')
      ].map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `work-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToExcel = () => {
    const totalHours = getTotalHours();
    const dateRange = `${filters.dateRange.start} to ${filters.dateRange.end}`;
    
    let html = `
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; }
            .header { background: #1e40af; color: white; padding: 20px; margin-bottom: 20px; }
            .header h1 { margin: 0 0 10px 0; font-size: 24px; }
            .header p { margin: 5px 0; font-size: 14px; }
            .summary { background: #f3f4f6; padding: 15px; margin-bottom: 20px; }
            .summary-item { display: inline-block; margin-right: 30px; }
            .summary-label { font-weight: bold; color: #374151; }
            .summary-value { color: #1e40af; font-size: 18px; font-weight: bold; }
            table { border-collapse: collapse; width: 100%; }
            th { background: #1e40af; color: white; padding: 12px; text-align: left; font-weight: bold; }
            td { border: 1px solid #e5e7eb; padding: 10px; }
            tr:nth-child(even) { background: #f9fafb; }
            .footer { margin-top: 20px; padding: 15px; background: #f3f4f6; text-align: center; font-size: 12px; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Work Log Report</h1>
            <p>Employee: ${currentUser.email}</p>
            <p>Date Range: ${dateRange}</p>
            <p>Generated: ${new Date().toLocaleString()}</p>
          </div>
          <div class="summary">
            <div class="summary-item">
              <div class="summary-label">Total Entries</div>
              <div class="summary-value">${logs.length}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Hours</div>
              <div class="summary-value">${totalHours}h</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Sr No</th>
                <th>Date</th>
                <th>Issue Key</th>
                <th>Summary</th>
                <th>Project</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Time Spent</th>
                <th>Author</th>
                <th>Comment</th>
              </tr>
            </thead>
            <tbody>
    `;
    
    logs.forEach((log, idx) => {
      html += `
        <tr>
          <td>${idx + 1}</td>
          <td>${formatDate(log.created)}</td>
          <td>${log.issueKey}</td>
          <td>${log.issueSummary}</td>
          <td>${log.project}</td>
          <td>${log.status}</td>
          <td>${log.priority}</td>
          <td>${log.timeSpent}</td>
          <td>${log.author}</td>
          <td>${log.comment}</td>
        </tr>
      `;
    });
    
    html += `
            </tbody>
          </table>
          <div class="footer">
            <p>This report was generated from Jira Work Logs System</p>
          </div>
        </body>
      </html>
    `;
    
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `work-logs-${new Date().toISOString().split('T')[0]}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    const totalHours = getTotalHours();
    const dateRange = `${filters.dateRange.start} to ${filters.dateRange.end}`;
    
    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow.document.write(`
      <html>
        <head>
          <title>Work Log Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { background: #1e40af; color: white; padding: 20px; margin-bottom: 20px; }
            .header h1 { margin: 0 0 10px 0; }
            .summary { background: #f3f4f6; padding: 15px; margin-bottom: 20px; }
            table { border-collapse: collapse; width: 100%; font-size: 12px; }
            th { background: #1e40af; color: white; padding: 8px; text-align: left; }
            td { border: 1px solid #ddd; padding: 8px; }
            tr:nth-child(even) { background: #f9fafb; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Work Log Report</h1>
            <p>Employee: ${currentUser.email}</p>
            <p>Date Range: ${dateRange}</p>
            <p>Generated: ${new Date().toLocaleString()}</p>
          </div>
          <div class="summary">
            <strong>Total Entries:</strong> ${logs.length} | <strong>Total Hours:</strong> ${totalHours}h
          </div>
          <table>
            <thead>
              <tr>
                <th>Sr</th><th>Date</th><th>Issue</th><th>Summary</th><th>Project</th><th>Status</th><th>Time</th><th>Comment</th>
              </tr>
            </thead>
            <tbody>
    `);
    
    logs.forEach((log, idx) => {
      printWindow.document.write(`
        <tr>
          <td>${idx + 1}</td>
          <td>${formatDate(log.created).split(',')[0]}</td>
          <td>${log.issueKey}</td>
          <td>${log.issueSummary.substring(0, 50)}...</td>
          <td>${log.project}</td>
          <td>${log.status}</td>
          <td>${log.timeSpent}</td>
          <td>${log.comment.substring(0, 30)}...</td>
        </tr>
      `);
    });
    
    printWindow.document.write(`
            </tbody>
          </table>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">My Work Logs</h1>
          <p className="text-sm text-gray-500 mt-1">Track your time spent on tasks</p>
        </div>
        <div className="flex items-center gap-4">
          <QuickWorklogEntry 
            jiraConfig={jiraConfig} 
            currentUser={currentUser} 
            onSuccess={loadLogs}
          />
          <button
            onClick={loadLogs}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Productivity Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Total Hours</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">{getTotalHours()}h</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Tasks Logged</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{[...new Set(logs.map(l => l.issueKey))].length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Completion Rate</p>
          <p className="text-3xl font-bold text-purple-600 mt-2">{getCompletionRate()}%</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Avg Time/Task</p>
          <p className="text-3xl font-bold text-orange-600 mt-2">{getAvgTimePerTask()}h</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-semibold text-gray-800">Filters & Export</h3>
          <div className="flex gap-2">
            <button
              onClick={exportToCSV}
              disabled={logs.length === 0}
              className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
            >
              CSV
            </button>
            <button
              onClick={exportToExcel}
              disabled={logs.length === 0}
              className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
            >
              Excel
            </button>
            <button
              onClick={exportToPDF}
              disabled={logs.length === 0}
              className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm"
            >
              PDF
            </button>
            <button
              onClick={clearFilters}
              className="px-3 py-1 text-blue-600 hover:text-blue-800 text-sm"
            >
              Clear
            </button>
          </div>
        </div>
        
        {/* Date Presets */}
        <div className="mb-4 flex flex-wrap gap-2">
          <button onClick={() => applyDatePreset('today')} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm hover:bg-blue-100">Today</button>
          <button onClick={() => applyDatePreset('yesterday')} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm hover:bg-blue-100">Yesterday</button>
          <button onClick={() => applyDatePreset('thisWeek')} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm hover:bg-blue-100">This Week</button>
          <button onClick={() => applyDatePreset('lastWeek')} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm hover:bg-blue-100">Last Week</button>
          <button onClick={() => applyDatePreset('thisMonth')} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm hover:bg-blue-100">This Month</button>
          <button onClick={() => applyDatePreset('lastMonth')} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm hover:bg-blue-100">Last Month</button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
            <input
              type="date"
              value={filters.dateRange.start}
              onChange={(e) => setFilters({ ...filters, dateRange: { ...filters.dateRange, start: e.target.value } })}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
            <input
              type="date"
              value={filters.dateRange.end}
              onChange={(e) => setFilters({ ...filters, dateRange: { ...filters.dateRange, end: e.target.value } })}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Project</label>
            <select
              value={filters.project}
              onChange={(e) => setFilters({ ...filters, project: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">All Projects</option>
              {projects.map((proj, idx) => (
                <option key={idx} value={proj}>{proj}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">All Status</option>
              <option value="Done">Done</option>
              <option value="In Progress">In Progress</option>
              <option value="To Do">To Do</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
            <select
              value={filters.priority}
              onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">All Priorities</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Work Log History</h3>
          <p className="text-sm text-gray-500 mt-1">{logs.length} entries found</p>
        </div>
        {loading ? (
          <ListSkeleton items={5} />
        ) : (
          <div className="space-y-4">
          {logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {loading ? 'Loading...' : 'No work logs found'}
            </div>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">#{idx + 1}</span>
                    <a 
                      href={`${currentUser.userType === 'employee' ? currentUser.jiraCredentials.baseUrl : jiraConfig.baseUrl}/browse/${log.issueKey}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {log.issueKey}
                    </a>
                    {log.status === 'Done' && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-medium">✓ Done</span>
                    )}
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      log.status === 'Done' ? 'bg-green-100 text-green-800' :
                      log.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {log.status}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      log.priority === 'High' ? 'bg-red-100 text-red-800' :
                      log.priority === 'Medium' ? 'bg-orange-100 text-orange-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {log.priority}
                    </span>
                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                      {log.timeSpent}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">{formatDate(log.created)}</span>
                </div>
                <h4 className="text-base font-semibold text-gray-800 mb-2">{log.issueSummary}</h4>
                <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                  <span>📁 {log.project}</span>
                  <span>👤 {log.author}</span>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{log.comment}</p>
                  {log.media && log.media.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {log.media.map((url, i) => (
                        <img key={i} src={url} alt="attachment" className="max-w-full h-auto rounded border" />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        )}
      </div>
    </div>
  );
};

export default MyLogsPage;
