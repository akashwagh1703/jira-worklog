import { useState, useEffect } from 'react';
import { useConfig } from '../context/ConfigContext';
import { fetchIssues } from '../services/jiraService';
import { groupByEmployee, calculateQualityScore } from '../utils/calculations';

const ManagementReportPage = () => {
  const { jiraConfig, currentUser } = useConfig();
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [performanceModal, setPerformanceModal] = useState({ show: false, employee: null });
  const [issueModal, setIssueModal] = useState({ show: false, issues: [], title: '' });
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if ((currentUser.userType === 'employee' && currentUser.jiraCredentials) || 
        (currentUser.userType === 'management' && jiraConfig.baseUrl && jiraConfig.email && jiraConfig.apiToken)) {
      loadData();
    }
  }, [jiraConfig, currentUser, dateRange]);

  const loadData = async () => {
    setLoading(true);
    
    // For management, fetch all issues; for employees, fetch only their issues
    const customJql = currentUser.userType === 'management' 
      ? `created >= "${dateRange.start}" AND created <= "${dateRange.end}" ORDER BY created DESC`
      : '';
    
    const result = await fetchIssues(currentUser, jiraConfig, '', customJql);
    
    if (result.success && result.data) {
      // For employees, data is already filtered by assignee
      // For management, we get all issues and need to filter by date only
      let dataToProcess = result.data;
      
      // Additional date filter if not using custom JQL
      if (currentUser.userType === 'employee') {
        dataToProcess = result.data.filter(issue => {
          const created = new Date(issue?.fields?.created);
          const start = new Date(dateRange.start);
          const end = new Date(dateRange.end);
          return created >= start && created <= end;
        });
      }

      const grouped = groupByEmployee(dataToProcess);
      const employeeList = Object.keys(grouped).map(name => {
        const issues = grouped[name];
        const completed = issues.filter(i => i?.fields?.status?.name === 'Done').length;
        const inProgress = issues.filter(i => i?.fields?.status?.name === 'In Progress').length;
        const todo = issues.filter(i => i?.fields?.status?.name === 'To Do').length;
        
        // Get project counts
        const projectCounts = {};
        issues.forEach(issue => {
          const projectName = issue?.fields?.project?.name;
          if (projectName) {
            projectCounts[projectName] = (projectCounts[projectName] || 0) + 1;
          }
        });

        return {
          name,
          projectCounts,
          totalIssues: issues.length,
          completed,
          inProgress,
          todo,
          workHours: issues.length * 8,
          qualityScore: calculateQualityScore(issues),
          completionRate: issues.length > 0 ? Math.round((completed / issues.length) * 100) : 0,
          issues: issues
        };
      });

      setEmployees(employeeList.sort((a, b) => b.totalIssues - a.totalIssues));
    }
    setLoading(false);
  };

  const exportToCSV = () => {
    const headers = ['Employee,Project,Total Issues,Completed,In Progress,To Do,Work Hours,Quality Score,Completion Rate'];
    const rows = employees.map(emp => 
      `${emp.name},${emp.project},${emp.totalIssues},${emp.completed},${emp.inProgress},${emp.todo},${emp.workHours},${emp.qualityScore}%,${emp.completionRate}%`
    );
    const csv = [...headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `employee-report-${dateRange.start}-to-${dateRange.end}.csv`;
    a.click();
  };

  const showIssueDetails = (employee, status) => {
    let filteredIssues = employee.issues;
    let title = `${employee.name} - `;
    
    if (status === 'all') {
      title += 'All Issues';
    } else if (status === 'Done') {
      filteredIssues = employee.issues.filter(i => i?.fields?.status?.name === 'Done');
      title += 'Completed Issues';
    } else if (status === 'In Progress') {
      filteredIssues = employee.issues.filter(i => i?.fields?.status?.name === 'In Progress');
      title += 'In Progress Issues';
    } else if (status === 'To Do') {
      filteredIssues = employee.issues.filter(i => i?.fields?.status?.name === 'To Do');
      title += 'To Do Issues';
    }
    
    setIssueModal({ show: true, issues: filteredIssues, title });
  };

  const printReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Management Report</h1>
          <p className="text-sm text-gray-500 mt-1">Comprehensive employee performance analysis</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-all duration-200 transform hover:scale-105 active:scale-95 hover:shadow-md"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
          <button
            onClick={printReport}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-all duration-200 transform hover:scale-105 active:scale-95 hover:shadow-md"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print Report
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all duration-200 transform hover:scale-105 active:scale-95 hover:shadow-lg"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Date Range Filter</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <p className="text-sm text-gray-500">Total Employees</p>
          <p className="text-3xl font-semibold text-blue-600 mt-2">{employees.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <p className="text-sm text-gray-500">Total Work Items</p>
          <p className="text-3xl font-semibold text-blue-600 mt-2">
            {employees.reduce((sum, emp) => sum + emp.totalIssues, 0)}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <p className="text-sm text-gray-500">Completed Items</p>
          <p className="text-3xl font-semibold text-green-600 mt-2">
            {employees.reduce((sum, emp) => sum + emp.completed, 0)}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <p className="text-sm text-gray-500">Total Hours</p>
          <p className="text-3xl font-semibold text-blue-600 mt-2">
            {employees.reduce((sum, emp) => sum + emp.workHours, 0)}h
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Employee Performance Details</h3>
              <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Click on any number to see detailed task breakdown
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-green-100 border border-green-300 rounded"></span>
                Completed
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-yellow-100 border border-yellow-300 rounded"></span>
                In Progress
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-gray-100 border border-gray-300 rounded"></span>
                To Do
              </span>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 z-10">#</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase sticky left-16 bg-gray-50 z-10">Employee</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Completed</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">In Progress</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">To Do</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hours</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quality</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Performance</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase sticky right-0 bg-gray-50 z-10">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {employees.map((emp, idx) => (
                <tr key={idx} className="hover:bg-gray-50 transition-all duration-200 hover:shadow-sm animate-fade-in" style={{ animationDelay: `${idx * 50}ms` }}>
                  <td className="px-6 py-4 text-sm text-gray-500 font-medium sticky left-0 bg-white z-10">{idx + 1}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-800 sticky left-16 bg-white z-10">{emp.name}</td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      {Object.entries(emp.projectCounts).map(([proj, count], i) => (
                        <div key={i} className="text-sm text-gray-700">
                          {i + 1}. {proj} <span className="text-blue-600 font-medium">({count})</span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-800">
                    <button
                      onClick={() => showIssueDetails(emp, 'all')}
                      className="text-blue-600 hover:text-blue-800 font-medium underline transition-all duration-200 hover:scale-110"
                    >
                      {emp.totalIssues}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-sm text-green-600 font-medium">
                    <button
                      onClick={() => showIssueDetails(emp, 'Done')}
                      className="hover:text-green-800 underline transition-all duration-200 hover:scale-110"
                    >
                      {emp.completed}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-sm text-yellow-600 font-medium">
                    <button
                      onClick={() => showIssueDetails(emp, 'In Progress')}
                      className="hover:text-yellow-800 underline transition-all duration-200 hover:scale-110"
                    >
                      {emp.inProgress}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <button
                      onClick={() => showIssueDetails(emp, 'To Do')}
                      className="hover:text-gray-800 underline transition-all duration-200 hover:scale-110"
                    >
                      {emp.todo}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-800">{emp.workHours}h</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      emp.qualityScore >= 80 ? 'bg-green-100 text-green-800' :
                      emp.qualityScore >= 60 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {emp.qualityScore}%
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="w-full">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600">{emp.completionRate}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${emp.completionRate}%` }}
                        ></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setPerformanceModal({ show: true, employee: emp })}
                      className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-xs font-medium transition-all duration-200 transform hover:scale-105"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      View Chart
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="w-full">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600">{emp.completionRate}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${emp.completionRate}%` }}
                        ></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 sticky right-0 bg-white z-10">
                    <button
                      onClick={() => setSelectedEmployee(emp)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-all duration-200 hover:scale-110 hover:underline"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {performanceModal.show && performanceModal.employee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-xl shadow-sm w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4 animate-slide-up">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-2xl font-semibold text-gray-800">{performanceModal.employee.name} - Performance Analytics</h2>
              <button
                onClick={() => setPerformanceModal({ show: false, employee: null })}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-blue-50 rounded-xl p-4 text-center">
                  <p className="text-sm text-blue-600 font-medium">Total Tasks</p>
                  <p className="text-3xl font-bold text-blue-700 mt-2">{performanceModal.employee.totalIssues}</p>
                </div>
                <div className="bg-green-50 rounded-xl p-4 text-center">
                  <p className="text-sm text-green-600 font-medium">Completed</p>
                  <p className="text-3xl font-bold text-green-700 mt-2">{performanceModal.employee.completed}</p>
                </div>
                <div className="bg-yellow-50 rounded-xl p-4 text-center">
                  <p className="text-sm text-yellow-600 font-medium">In Progress</p>
                  <p className="text-3xl font-bold text-yellow-700 mt-2">{performanceModal.employee.inProgress}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <p className="text-sm text-gray-600 font-medium">To Do</p>
                  <p className="text-3xl font-bold text-gray-700 mt-2">{performanceModal.employee.todo}</p>
                </div>
              </div>

              {/* Bar Chart */}
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Task Distribution</h3>
                <div className="flex items-end justify-around h-64 gap-4">
                  <div className="flex-1 flex flex-col items-center">
                    <div className="w-full bg-gray-100 rounded-t-lg relative" style={{ height: '100%' }}>
                      <div 
                        className="w-full bg-green-500 rounded-t-lg absolute bottom-0 transition-all duration-700 hover:bg-green-600"
                        style={{ height: `${(performanceModal.employee.completed / performanceModal.employee.totalIssues) * 100}%` }}
                      ></div>
                    </div>
                    <p className="text-sm font-medium text-gray-700 mt-2">Completed</p>
                    <p className="text-2xl font-bold text-green-600">{performanceModal.employee.completed}</p>
                  </div>
                  <div className="flex-1 flex flex-col items-center">
                    <div className="w-full bg-gray-100 rounded-t-lg relative" style={{ height: '100%' }}>
                      <div 
                        className="w-full bg-yellow-500 rounded-t-lg absolute bottom-0 transition-all duration-700 hover:bg-yellow-600"
                        style={{ height: `${(performanceModal.employee.inProgress / performanceModal.employee.totalIssues) * 100}%` }}
                      ></div>
                    </div>
                    <p className="text-sm font-medium text-gray-700 mt-2">In Progress</p>
                    <p className="text-2xl font-bold text-yellow-600">{performanceModal.employee.inProgress}</p>
                  </div>
                  <div className="flex-1 flex flex-col items-center">
                    <div className="w-full bg-gray-100 rounded-t-lg relative" style={{ height: '100%' }}>
                      <div 
                        className="w-full bg-gray-400 rounded-t-lg absolute bottom-0 transition-all duration-700 hover:bg-gray-500"
                        style={{ height: `${(performanceModal.employee.todo / performanceModal.employee.totalIssues) * 100}%` }}
                      ></div>
                    </div>
                    <p className="text-sm font-medium text-gray-700 mt-2">To Do</p>
                    <p className="text-2xl font-bold text-gray-600">{performanceModal.employee.todo}</p>
                  </div>
                </div>
              </div>

              {/* Pie Chart */}
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Completion Rate</h3>
                <div className="flex items-center justify-center gap-8">
                  <div className="relative w-48 h-48">
                    <svg className="transform -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="20"/>
                      <circle 
                        cx="50" 
                        cy="50" 
                        r="40" 
                        fill="none" 
                        stroke="#10b981" 
                        strokeWidth="20"
                        strokeDasharray={`${performanceModal.employee.completionRate * 2.51} 251`}
                        className="transition-all duration-1000"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-4xl font-bold text-gray-800">{performanceModal.employee.completionRate}%</p>
                        <p className="text-sm text-gray-500">Complete</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-green-500 rounded"></div>
                      <span className="text-sm text-gray-700">Completed: {performanceModal.employee.completed} tasks</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-gray-300 rounded"></div>
                      <span className="text-sm text-gray-700">Remaining: {performanceModal.employee.inProgress + performanceModal.employee.todo} tasks</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-purple-500 rounded"></div>
                      <span className="text-sm text-gray-700">Quality Score: {performanceModal.employee.qualityScore}%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setPerformanceModal({ show: false, employee: null })}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {issueModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-xl shadow-sm w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4 animate-slide-up">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-2xl font-semibold text-gray-800">{issueModal.title}</h2>
              <button
                onClick={() => setIssueModal({ show: false, issues: [], title: '' })}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-2">
                {issueModal.issues.map((issue, idx) => (
                  <div key={idx} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all duration-200 hover:shadow-md hover:-translate-y-1 animate-fade-in" style={{ animationDelay: `${idx * 30}ms` }}>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{issue?.fields?.summary || 'No summary'}</p>
                      <div className="flex gap-4 mt-2">
                        <p className="text-xs text-gray-500">
                          Project: {issue?.fields?.project?.name || 'N/A'}
                        </p>
                        <p className="text-xs text-gray-500">
                          Created: {new Date(issue?.fields?.created).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ml-4 ${
                      issue?.fields?.status?.name === 'Done' ? 'bg-green-100 text-green-800' :
                      issue?.fields?.status?.name === 'In Progress' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {issue?.fields?.status?.name || 'Unknown'}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setIssueModal({ show: false, issues: [], title: '' })}
                  className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-sm w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-2xl font-semibold text-gray-800">{selectedEmployee.name} - Detailed Report</h2>
              <button
                onClick={() => setSelectedEmployee(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500">Total Issues</p>
                  <p className="text-2xl font-semibold text-gray-800 mt-1">{selectedEmployee.totalIssues}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500">Completed</p>
                  <p className="text-2xl font-semibold text-green-600 mt-1">{selectedEmployee.completed}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500">Work Hours</p>
                  <p className="text-2xl font-semibold text-blue-600 mt-1">{selectedEmployee.workHours}h</p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Issue Breakdown</h3>
                <div className="space-y-2">
                  {selectedEmployee.issues.slice(0, 10).map((issue, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">{issue?.fields?.summary || 'No summary'}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Created: {new Date(issue?.fields?.created).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        issue?.fields?.status?.name === 'Done' ? 'bg-green-100 text-green-800' :
                        issue?.fields?.status?.name === 'In Progress' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {issue?.fields?.status?.name || 'Unknown'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setSelectedEmployee(null)}
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

export default ManagementReportPage;
