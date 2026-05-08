import { useState, useEffect, useMemo, useCallback } from 'react';
import { useConfig } from '../context/ConfigContext';
import { fetchIssuesWithPagination, fetchWorklogs, fetchWorklogsByDateRange } from '../services/jiraService';

const ALLOWED_PROJECTS = [
  'ANE-2.0–VCCO-Advancing North East-2.0',
  'FAMRUT',
  'FMRT',
  'OCAC-FUP',
  'OCACFUP',
  'NERACE_NEDFI',
  'NERACE'
];

const TeamOverviewPage = () => {
  const { jiraConfig, currentUser } = useConfig();
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState({ 
    phase: 'idle', 
    issuesCurrent: 0, 
    issuesTotal: 0,
    worklogsCurrent: 0,
    worklogsTotal: 0
  });
  const [error, setError] = useState(null);
  const [teamData, setTeamData] = useState([]);
  const [allTeamData, setAllTeamData] = useState([]);
  const [dateFilter, setDateFilter] = useState('thisWeek');
  const [customDateRange, setCustomDateRange] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [filters, setFilters] = useState({
    project: '',
    status: '',
    activity: ''
  });
  const [projects, setProjects] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [dailyTarget, setDailyTarget] = useState(7);
  const [minusDays, setMinusDays] = useState(0);
  const [activityThresholds] = useState({ high: 6, medium: 3 });
  const [statusModal, setStatusModal] = useState({ show: false, employee: null, status: '', issues: [] });
  const [employeeModal, setEmployeeModal] = useState({ show: false, employee: null });

  const getDateRange = useCallback(() => {
    if (dateFilter === 'custom') {
      return { start: customDateRange.start, end: customDateRange.end };
    }
    
    const today = new Date();
    let start, end;
    
    switch(dateFilter) {
      case 'today':
        start = end = today.toISOString().split('T')[0];
        break;
      case 'thisWeek':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        start = weekStart.toISOString().split('T')[0];
        end = today.toISOString().split('T')[0];
        break;
      case 'thisMonth':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        start = monthStart.toISOString().split('T')[0];
        end = today.toISOString().split('T')[0];
        break;
      default:
        start = end = today.toISOString().split('T')[0];
    }
    
    console.log('Date range calculated:', { dateFilter, start, end });
    return { start, end };
  }, [dateFilter, customDateRange]);

  const getDayCount = useMemo(() => {
    const { start, end } = getDateRange();
    const startDate = new Date(start);
    const endDate = new Date(end);
    let count = 0;
    
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const day = date.getDay();
      if (day !== 0 && day !== 6) {
        count++;
      }
    }
    
    return Math.max(0, count - minusDays);
  }, [getDateRange, minusDays]);

  const loadTeamData = useCallback(async () => {
    if (!jiraConfig.baseUrl) return;
    
    setLoading(true);
    setError(null);
    setLoadingProgress({ 
      phase: 'issues', 
      issuesCurrent: 0, 
      issuesTotal: 0,
      worklogsCurrent: 0,
      worklogsTotal: 0
    });
    
    try {
      const { start, end } = getDateRange();
      const projectFilter = `project IN ("${ALLOWED_PROJECTS.join('", "')}")`;
      const jql = `${projectFilter} AND worklogDate >= "${start}" AND worklogDate <= "${end}" ORDER BY updated DESC`;
      
      console.log('Fetching issues with JQL:', jql);
      
      const result = await fetchIssuesWithPagination(
        currentUser, 
        jiraConfig, 
        jql,
        (current, total) => setLoadingProgress(prev => ({ 
          ...prev, 
          phase: 'issues',
          issuesCurrent: current, 
          issuesTotal: total 
        }))
      );
      
      if (!result.success) {
        setError(`Failed to fetch issues: ${result.error}`);
        setLoading(false);
        return;
      }
      
      console.log(`Fetched ${result.data.length} issues`);
      
      const employeeMap = {};
      const startDate = new Date(start + 'T00:00:00');
      const endDate = new Date(end + 'T23:59:59');
      
      setLoadingProgress(prev => ({ 
        ...prev, 
        phase: 'worklogs',
        worklogsCurrent: 0,
        worklogsTotal: result.data.length
      }));
      
      const BATCH_SIZE = 50;
      
      for (let i = 0; i < result.data.length; i += BATCH_SIZE) {
        const batch = result.data.slice(i, i + BATCH_SIZE);
        
        const worklogPromises = batch.map(issue => 
          fetchWorklogs(currentUser, jiraConfig, issue.key)
            .then(worklogResult => ({ issue, worklogResult }))
            .catch(() => ({ issue, worklogResult: { success: false, data: [] } }))
        );
        
        const worklogResults = await Promise.all(worklogPromises);
        
        worklogResults.forEach(({ issue, worklogResult }) => {
          if (!worklogResult.success || !worklogResult.data) return;
          
          let hasValidWorklog = false;
          
          worklogResult.data.forEach(log => {
            const logDate = new Date(log.started || log.created);
            if (logDate < startDate || logDate > endDate) return;
            
            hasValidWorklog = true;
            const author = log.author;
            if (!author) return;
            
            const key = author.emailAddress || author.accountId;
            if (!key) return;
            
            if (!employeeMap[key]) {
              employeeMap[key] = {
                name: author.displayName,
                email: author.emailAddress || key,
                accountId: author.accountId,
                avatar: author.avatarUrls?.['48x48'],
                hours: 0,
                tasks: 0,
                statusCounts: {},
                projects: [],
                issues: [],
                issueKeys: new Set()
              };
            }
            
            employeeMap[key].hours += (log.timeSpentSeconds || 0) / 3600;
            
            if (!employeeMap[key].issueKeys.has(issue.key)) {
              employeeMap[key].issueKeys.add(issue.key);
              employeeMap[key].tasks++;
              
              const projectName = issue.fields.project?.name;
              if (projectName && !employeeMap[key].projects.includes(projectName)) {
                employeeMap[key].projects.push(projectName);
              }
              
              employeeMap[key].issues.push({
                key: issue.key,
                fields: issue.fields,
                totalWorklogHours: 0
              });
              
              const status = issue.fields.status?.name;
              if (status) {
                employeeMap[key].statusCounts[status] = (employeeMap[key].statusCounts[status] || 0) + 1;
              }
            }
            
            const issueIndex = employeeMap[key].issues.findIndex(i => i.key === issue.key);
            if (issueIndex !== -1) {
              employeeMap[key].issues[issueIndex].totalWorklogHours += (log.timeSpentSeconds || 0) / 3600;
            }
          });
          
          // Add assignee for issues with valid worklogs but assignee didn't log work
          if (hasValidWorklog) {
            const assignee = issue.fields?.assignee;
            if (assignee) {
              const assigneeKey = assignee.emailAddress || assignee.accountId;
              if (assigneeKey && !employeeMap[assigneeKey]?.issueKeys?.has(issue.key)) {
                if (!employeeMap[assigneeKey]) {
                  employeeMap[assigneeKey] = {
                    name: assignee.displayName,
                    email: assignee.emailAddress || assigneeKey,
                    accountId: assignee.accountId,
                    avatar: assignee.avatarUrls?.['48x48'],
                    hours: 0,
                    tasks: 0,
                    statusCounts: {},
                    projects: [],
                    issues: [],
                    issueKeys: new Set()
                  };
                }
                
                if (!employeeMap[assigneeKey].issueKeys.has(issue.key)) {
                  employeeMap[assigneeKey].issueKeys.add(issue.key);
                  employeeMap[assigneeKey].tasks++;
                  
                  const projectName = issue.fields.project?.name;
                  if (projectName && !employeeMap[assigneeKey].projects.includes(projectName)) {
                    employeeMap[assigneeKey].projects.push(projectName);
                  }
                  
                  employeeMap[assigneeKey].issues.push({
                    key: issue.key,
                    fields: issue.fields,
                    totalWorklogHours: 0
                  });
                  
                  const status = issue.fields.status?.name;
                  if (status) {
                    employeeMap[assigneeKey].statusCounts[status] = (employeeMap[assigneeKey].statusCounts[status] || 0) + 1;
                  }
                }
              }
            }
          }
        });
        
        setLoadingProgress(prev => ({ 
          ...prev,
          worklogsCurrent: Math.min(i + BATCH_SIZE, result.data.length)
        }));
      }
      
      console.log(`Found ${Object.keys(employeeMap).length} employees`);
      Object.values(employeeMap).forEach(emp => {
        console.log(`${emp.name}: ${emp.hours.toFixed(2)}h`);
      });
      
      const uniqueProjects = [...new Set(Object.values(employeeMap).flatMap(e => e.projects))].filter(Boolean);
      setProjects(uniqueProjects.filter(proj => ALLOWED_PROJECTS.includes(proj)));
      
      const allStatuses = [...new Set(Object.values(employeeMap).flatMap(e => Object.keys(e.statusCounts)))];
      setStatuses(allStatuses);
      
      const teamArray = Object.values(employeeMap)
        .filter(emp => emp.projects.some(proj => ALLOWED_PROJECTS.includes(proj)))
        .map(emp => {
          emp.projects = emp.projects.filter(proj => ALLOWED_PROJECTS.includes(proj));
          emp.issues = emp.issues.filter(issue => ALLOWED_PROJECTS.includes(issue.fields?.project?.name));
          delete emp.issueKeys;
          return emp;
        })
        .sort((a, b) => b.hours - a.hours);
      
      setAllTeamData(teamArray);
      setTeamData(teamArray);
    } catch (error) {
      setError(`Error loading team data: ${error.message}`);
      console.error('loadTeamData error:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUser, jiraConfig, getDateRange]);

  const applyFilters = useCallback(() => {
    let filtered = [...allTeamData];

    if (filters.project) {
      filtered = filtered.filter(emp => emp.projects.includes(filters.project));
    }

    if (filters.status) {
      filtered = filtered.filter(emp => emp.statusCounts[filters.status] > 0);
    }

    if (filters.activity) {
      filtered = filtered.filter(emp => {
        const hours = emp.hours;
        let activityLabel = 'None';
        if (hours >= activityThresholds.high) activityLabel = 'High';
        else if (hours >= activityThresholds.medium) activityLabel = 'Medium';
        else if (hours > 0) activityLabel = 'Low';
        return activityLabel === filters.activity;
      });
    }

    setTeamData(filtered);
  }, [allTeamData, filters, activityThresholds]);

  const showEmployeeWithStatus = (employee, status) => {
    setEmployeeModal({ show: true, employee: { ...employee, filterStatus: status } });
  };

  const getActivityLevel = useCallback((hours) => {
    if (hours >= activityThresholds.high) return { label: 'High', color: 'bg-green-100 text-green-800' };
    if (hours >= activityThresholds.medium) return { label: 'Medium', color: 'bg-yellow-100 text-yellow-800' };
    if (hours > 0) return { label: 'Low', color: 'bg-orange-100 text-orange-800' };
    return { label: 'None', color: 'bg-red-100 text-red-800' };
  }, [activityThresholds]);

  useEffect(() => {
    if (currentUser.userType === 'management' && jiraConfig.baseUrl) {
      loadTeamData();
    }
  }, [jiraConfig, currentUser, dateFilter, customDateRange, loadTeamData]);

  useEffect(() => {
    applyFilters();
  }, [filters, allTeamData, applyFilters]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Team Overview</h1>
          <p className="text-sm text-gray-500 mt-1">Real-time team activity and performance</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="today">Today</option>
            <option value="thisWeek">This Week</option>
            <option value="thisMonth">This Month</option>
            <option value="custom">Custom Range</option>
          </select>
          {dateFilter === 'custom' && (
            <>
              <input
                type="date"
                value={customDateRange.start}
                onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })}
                className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <input
                type="date"
                value={customDateRange.end}
                onChange={(e) => setCustomDateRange({ ...customDateRange, end: e.target.value })}
                className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </>
          )}
          <button
            onClick={loadTeamData}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 min-w-[140px]"
          >
            {loading ? (
              loadingProgress.phase === 'issues' 
                ? `Fetching Issues... ${loadingProgress.issuesCurrent}/${loadingProgress.issuesTotal}` 
                : `Fetching Worklogs... ${loadingProgress.worklogsCurrent}/${loadingProgress.worklogsTotal}`
            ) : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-red-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-red-800">Error Loading Data</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-800"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Project</label>
            <select
              value={filters.project}
              onChange={(e) => setFilters({ ...filters, project: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">All Projects</option>
              {projects.map((proj) => (
                <option key={proj} value={proj}>{proj}</option>
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
              {statuses.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Activity Level</label>
            <select
              value={filters.activity}
              onChange={(e) => setFilters({ ...filters, activity: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">All Levels</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
              <option value="None">None</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => setFilters({ project: '', status: '', activity: '' })}
            className="px-4 py-2 text-blue-600 hover:text-blue-800 text-sm"
          >
            Clear Filters
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Total Team Members</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">{teamData.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Total Hours Logged</p>
          <p className="text-3xl font-bold text-green-600 mt-2">
            {teamData.reduce((sum, e) => sum + e.hours, 0).toFixed(1)}h
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Active Members</p>
          <p className="text-3xl font-bold text-purple-600 mt-2">
            {teamData.filter(e => e.hours > 0).length}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Low Activity</p>
          <p className="text-3xl font-bold text-orange-600 mt-2">
            {teamData.filter(e => e.hours < 2 && e.hours > 0).length}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-800">Team Members</h3>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Daily Target (hours):</label>
              <input
                type="text"
                value={dailyTarget}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || /^\d*\.?\d*$/.test(value)) {
                    const numValue = parseFloat(value);
                    if (value === '' || (numValue >= 0.1 && numValue <= 24)) {
                      setDailyTarget(value === '' ? '' : value);
                    }
                  }
                }}
                onBlur={(e) => {
                  const value = e.target.value;
                  if (value === '' || parseFloat(value) < 0.1) {
                    setDailyTarget(7);
                  } else {
                    setDailyTarget(parseFloat(value));
                  }
                }}
                className="w-20 px-3 py-1 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <label className="text-sm font-medium text-gray-700 ml-4">Minus Days:</label>
              <input
                type="text"
                value={minusDays}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || /^\d+$/.test(value)) {
                    setMinusDays(value === '' ? 0 : parseInt(value));
                  }
                }}
                onBlur={(e) => {
                  const value = e.target.value;
                  if (value === '') {
                    setMinusDays(0);
                  }
                }}
                className="w-16 px-3 py-1 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Projects</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target ({dailyTarget}h × {getDayCount}d = {(dailyTarget * getDayCount).toFixed(1)}h)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hours Logged</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tasks</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status Breakdown</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {teamData.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                    {loading ? 'Loading...' : 'No team data found'}
                  </td>
                </tr>
              ) : (
                teamData.map((employee) => {
                  const activity = getActivityLevel(employee.hours);
                  return (
                    <tr key={employee.email} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {employee.avatar && (
                            <img src={employee.avatar} alt="" className="w-8 h-8 rounded-full" />
                          )}
                          <div>
                            <p className="text-sm font-medium text-gray-800">{employee.name}</p>
                            <p className="text-xs text-gray-500">{employee.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          {employee.projects.map((project, i) => {
                            const projectTasks = employee.issues.filter(issue => issue.fields?.project?.name === project).length;
                            return (
                              <div key={`${employee.email}-${project}`} className="text-xs text-gray-700">
                                {i + 1}. {project} <span className="text-blue-600 font-medium">({projectTasks})</span>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <span className="text-sm font-medium text-gray-700">{(dailyTarget * getDayCount).toFixed(1)}h</span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setEmployeeModal({ show: true, employee })}
                          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                        >
                          <span className="text-lg font-bold text-blue-600">{employee.hours.toFixed(1)}h</span>
                          <span className={`text-xs font-medium ${
                            employee.hours >= dailyTarget ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {employee.hours >= dailyTarget * getDayCount ? '✓' : `(${(dailyTarget * getDayCount - employee.hours).toFixed(1)}h short)`}
                          </span>
                        </button>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{employee.tasks}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(employee.statusCounts).map(([status, count]) => (
                            <button
                              key={`${employee.email}-${status}`}
                              onClick={() => showEmployeeWithStatus(employee, status)}
                              className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${
                                status === 'Done' ? 'bg-green-100 text-green-800' :
                                status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' :
                                status === 'To Do' ? 'bg-gray-100 text-gray-800' :
                                status === 'Testing' ? 'bg-blue-100 text-blue-800' :
                                'bg-purple-100 text-purple-800'
                              }`}
                            >
                              {status}: {count}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${activity.color}`}>
                          {activity.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {statusModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-sm w-full max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
              <h2 className="text-2xl font-semibold text-gray-800">
                {statusModal.employee} - {statusModal.status} ({statusModal.issues.length})
              </h2>
              <button
                onClick={() => setStatusModal({ show: false, employee: null, status: '', issues: [] })}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 overflow-auto flex-1">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Key</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase min-w-[200px]">Summary</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Issue Type</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start Date</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {statusModal.issues.map((issue) => (
                      <tr key={issue.key} className="hover:bg-gray-50">
                        <td className="px-3 py-3 text-sm text-gray-500">{statusModal.issues.indexOf(issue) + 1}</td>
                        <td className="px-3 py-3 text-sm font-medium">
                          <a 
                            href={`${(currentUser?.jiraCredentials || jiraConfig).baseUrl}/browse/${issue?.key}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {issue?.key}
                          </a>
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-800">{issue?.fields?.summary || 'No summary'}</td>
                        <td className="px-3 py-3 text-sm text-gray-600">{issue?.fields?.project?.name || 'N/A'}</td>
                        <td className="px-3 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            issue?.fields?.priority?.name === 'High' || issue?.fields?.priority?.name === 'Highest' ? 'bg-red-100 text-red-800' :
                            issue?.fields?.priority?.name === 'Medium' ? 'bg-orange-100 text-orange-800' :
                            issue?.fields?.priority?.name === 'Low' || issue?.fields?.priority?.name === 'Lowest' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {issue?.fields?.priority?.name || 'None'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-600">{issue?.fields?.issuetype?.name || 'N/A'}</td>
                        <td className="px-3 py-3 text-sm text-gray-600">
                          {issue?.fields?.created ? new Date(issue.fields.created).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-600">
                          {issue?.fields?.duedate ? new Date(issue.fields.duedate).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            statusModal.status === 'Done' ? 'bg-green-100 text-green-800' :
                            statusModal.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' :
                            statusModal.status === 'To Do' ? 'bg-gray-100 text-gray-800' :
                            statusModal.status === 'Testing' ? 'bg-blue-100 text-blue-800' :
                            'bg-purple-100 text-purple-800'
                          }`}>
                            {statusModal.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setStatusModal({ show: false, employee: null, status: '', issues: [] })}
                  className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {employeeModal.show && employeeModal.employee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-sm w-full max-w-6xl max-h-[90vh] overflow-y-auto m-4">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-2xl font-semibold text-gray-800">{employeeModal.employee.name} - Performance Analytics</h2>
              <button
                onClick={() => setEmployeeModal({ show: false, employee: null })}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-blue-50 rounded-xl p-4 text-center">
                  <p className="text-sm text-blue-600 font-medium">Total Hours</p>
                  <p className="text-3xl font-bold text-blue-700 mt-2">{employeeModal.employee.hours.toFixed(1)}h</p>
                </div>
                <div className="bg-green-50 rounded-xl p-4 text-center">
                  <p className="text-sm text-green-600 font-medium">Total Tasks</p>
                  <p className="text-3xl font-bold text-green-700 mt-2">{employeeModal.employee.tasks}</p>
                </div>
                <div className="bg-purple-50 rounded-xl p-4 text-center">
                  <p className="text-sm text-purple-600 font-medium">Avg Hours/Task</p>
                  <p className="text-3xl font-bold text-purple-700 mt-2">{employeeModal.employee.tasks > 0 ? (employeeModal.employee.hours / employeeModal.employee.tasks).toFixed(1) : '0.0'}h</p>
                </div>
                <div className="bg-orange-50 rounded-xl p-4 text-center">
                  <p className="text-sm text-orange-600 font-medium">Projects</p>
                  <p className="text-3xl font-bold text-orange-700 mt-2">{employeeModal.employee.projects.length}</p>
                </div>
              </div>

              {/* Bar Chart - Status Distribution */}
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Task Distribution by Status</h3>
                {employeeModal.employee.statusCounts && Object.keys(employeeModal.employee.statusCounts).length > 0 ? (
                  <div className="flex items-end justify-around h-64 gap-4">
                    {Object.entries(employeeModal.employee.statusCounts).map(([status, count]) => {
                      const percentage = (count / employeeModal.employee.tasks) * 100;
                      return (
                        <div key={status} className="flex-1 flex flex-col items-center">
                          <div className="w-full bg-gray-100 rounded-t-lg relative" style={{ height: '100%' }}>
                            <div 
                              className={`w-full rounded-t-lg absolute bottom-0 transition-all duration-700 ${
                                status === 'Done' ? 'bg-green-500 hover:bg-green-600' :
                                status === 'In Progress' ? 'bg-yellow-500 hover:bg-yellow-600' :
                                status === 'To Do' ? 'bg-gray-400 hover:bg-gray-500' :
                                status === 'Testing' ? 'bg-blue-500 hover:bg-blue-600' :
                                'bg-purple-500 hover:bg-purple-600'
                              }`}
                              style={{ height: `${Math.max(percentage, 5)}%` }}
                            ></div>
                          </div>
                          <p className="text-xs font-medium text-gray-700 mt-2 text-center">{status}</p>
                          <p className="text-xl font-bold text-gray-800">{count}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-8">No status data available</p>
                )}
              </div>

              {/* Projects Breakdown */}
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Projects Breakdown</h3>
                <div className="grid grid-cols-2 gap-4">
                  {employeeModal.employee.projects.map((project) => {
                    const projectTasks = employeeModal.employee.issues.filter(i => i.fields?.project?.name === project).length;
                    return (
                      <div key={project} className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm font-medium text-gray-800">{project}</p>
                        <p className="text-2xl font-bold text-blue-600 mt-2">{projectTasks} tasks</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Task List */}
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  {employeeModal.employee.filterStatus 
                    ? `${employeeModal.employee.filterStatus} Tasks (${employeeModal.employee.issues.filter(i => i.fields?.status?.name === employeeModal.employee.filterStatus).length})`
                    : `All Tasks (${employeeModal.employee.issues.length})`
                  }
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {(employeeModal.employee.filterStatus 
                    ? employeeModal.employee.issues.filter(i => i.fields?.status?.name === employeeModal.employee.filterStatus)
                    : employeeModal.employee.issues
                  ).map((issue) => (
                    <div key={issue.key} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">{issue?.fields?.summary || 'No summary'}</p>
                        <div className="flex gap-4 mt-1">
                          <p className="text-xs text-gray-500">Key: {issue?.key}</p>
                          <p className="text-xs text-gray-500">Project: {issue?.fields?.project?.name}</p>
                          <p className="text-xs text-blue-600 font-medium">Worklogs: {issue.totalWorklogHours?.toFixed(1) || '0.0'}h</p>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ml-4 ${
                        issue?.fields?.status?.name === 'Done' ? 'bg-green-100 text-green-800' :
                        issue?.fields?.status?.name === 'In Progress' ? 'bg-yellow-100 text-yellow-800' :
                        issue?.fields?.status?.name === 'To Do' ? 'bg-gray-100 text-gray-800' :
                        issue?.fields?.status?.name === 'Testing' ? 'bg-blue-100 text-blue-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {issue?.fields?.status?.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setEmployeeModal({ show: false, employee: null })}
                  className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamOverviewPage;
