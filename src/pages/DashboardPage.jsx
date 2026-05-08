import { useState, useEffect } from 'react';
import { useConfig } from '../context/ConfigContext';
import { fetchIssues, fetchWorklogs } from '../services/jiraService';
import { calculateDeliveryRate, calculateQualityScore, calculateWorkHours, calculateCompletion } from '../utils/calculations';
import KPICard from '../components/dashboard/KPICard';
import { WorkDistributionChart, MonthlyTrendChart, QualityTrendChart, ProjectCompletionBar } from '../components/dashboard/Charts';
import WeeklySummary from '../components/dashboard/WeeklySummary';
import ProjectTimeDistribution from '../components/dashboard/ProjectTimeDistribution';
import PeriodComparison from '../components/dashboard/PeriodComparison';
import ProductivityTrends from '../components/dashboard/ProductivityTrends';
import BurndownChart from '../components/dashboard/BurndownChart';
import VelocityChart from '../components/dashboard/VelocityChart';
import ActivityHeatmap from '../components/dashboard/ActivityHeatmap';
import { CardSkeleton, ChartSkeleton } from '../components/LoadingSkeleton';

const ALLOWED_PROJECTS = [
  'ANE-2.0–VCCO-Advancing North East-2.0',
  'FAMRUT',
  'FMRT',
  'OCAC-FUP',
  'OCACFUP',
  'NERACE_NEDFI',
  'NERACE'
];

const DashboardPage = () => {
  const { jiraConfig, currentUser } = useConfig();
  const [loading, setLoading] = useState(false);
  const [issues, setIssues] = useState([]);
  const [worklogs, setWorklogs] = useState([]);
  const [availableProjects, setAvailableProjects] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [previousIssues, setPreviousIssues] = useState([]);
  const [previousWorklogs, setPreviousWorklogs] = useState([]);
  const [showComparison, setShowComparison] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [dateRange, setDateRange] = useState(() => {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    return {
      start: weekStart.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0]
    };
  });
  const [selectedProject, setSelectedProject] = useState('');

  useEffect(() => {
    if ((currentUser.userType === 'employee' && currentUser.jiraCredentials) || 
        (currentUser.userType === 'management' && jiraConfig.baseUrl && jiraConfig.email && jiraConfig.apiToken)) {
      loadAllProjects();
      loadData();
    }
  }, [jiraConfig, currentUser, dateRange, selectedProject]);

  const loadAllProjects = async () => {
    if (allProjects.length > 0) return; // Only load once
    
    const projectFilter = `project IN ("${ALLOWED_PROJECTS.join('", "')}")`;
    const jql = `${projectFilter} ORDER BY created DESC`;
    const result = await fetchIssues(currentUser, jiraConfig, '', jql);
    
    if (result.success && result.data) {
      const projectsFromIssues = [...new Set(result.data.map(issue => issue.fields?.project?.name).filter(Boolean))];
      setAllProjects(projectsFromIssues);
    }
  };

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadData();
    }, 300000);
    return () => clearInterval(interval);
  }, [autoRefresh, jiraConfig, currentUser, dateRange]);

  const loadData = async () => {
    setLoading(true);
    
    let jql = '';
    const projectFilter = selectedProject ? `project = "${selectedProject}"` : `project IN ("${ALLOWED_PROJECTS.join('", "')}")`;
    
    if (currentUser.userType === 'management') {
      if (dateRange.start && dateRange.end) {
        jql = `${projectFilter} AND created >= "${dateRange.start}" AND created <= "${dateRange.end}" ORDER BY created DESC`;
      } else {
        jql = `${projectFilter} AND created >= -90d ORDER BY created DESC`;
      }
    } else {
      jql = selectedProject ? `project = "${selectedProject}"` : '';
    }
    
    const result = await fetchIssues(currentUser, jiraConfig, '', jql);
    if (result.success && result.data) {
      setIssues(result.data);
      
      // Fetch worklogs
      const worklogPromises = result.data.slice(0, 100).map(issue => 
        fetchWorklogs(currentUser, jiraConfig, issue.key)
          .then(worklogResult => ({ issue, worklogResult }))
      );
      
      const worklogResults = await Promise.all(worklogPromises);
      const allWorklogs = [];
      worklogResults.forEach(({ issue, worklogResult }) => {
        if (worklogResult.success && worklogResult.data) {
          worklogResult.data.forEach(log => {
            allWorklogs.push({
              ...log,
              issueKey: issue.key,
              project: issue.fields?.project?.name,
              timeSpentSeconds: log.timeSpentSeconds || 0
            });
          });
        }
      });
      setWorklogs(allWorklogs);
      
      // Load previous period data if comparison is enabled
      if (showComparison) {
        await loadPreviousPeriod();
      }
    } else {
      setIssues([]);
      setWorklogs([]);
    }
    setLoading(false);
  };

  const loadPreviousPeriod = async () => {
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    
    const prevEnd = new Date(start);
    prevEnd.setDate(start.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevEnd.getDate() - daysDiff);
    
    const jql = `created >= "${prevStart.toISOString().split('T')[0]}" AND created <= "${prevEnd.toISOString().split('T')[0]}" ORDER BY created DESC`;
    const result = await fetchIssues(currentUser, jiraConfig, '', jql);
    
    if (result.success && result.data) {
      setPreviousIssues(result.data);
      
      // Fetch previous worklogs
      const worklogPromises = result.data.slice(0, 100).map(issue => 
        fetchWorklogs(currentUser, jiraConfig, issue.key)
          .then(worklogResult => ({ issue, worklogResult }))
      );
      
      const worklogResults = await Promise.all(worklogPromises);
      const allWorklogs = [];
      worklogResults.forEach(({ issue, worklogResult }) => {
        if (worklogResult.success && worklogResult.data) {
          worklogResult.data.forEach(log => {
            allWorklogs.push({
              ...log,
              timeSpentSeconds: log.timeSpentSeconds || 0
            });
          });
        }
      });
      setPreviousWorklogs(allWorklogs);
    }
  };

  const workDistributionData = [
    { name: 'Completed', value: issues.filter(i => i?.fields?.status?.name === 'Done').length },
    { name: 'In Progress', value: issues.filter(i => i?.fields?.status?.name === 'In Progress').length },
    { name: 'To Do', value: issues.filter(i => i?.fields?.status?.name === 'To Do').length }
  ];

  const applyDatePreset = (preset) => {
    const today = new Date();
    let start, end;
    
    switch(preset) {
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
    
    setDateRange({ start, end });
  };

  const monthlyTrendData = [
    { month: 'Jan', value: 45 },
    { month: 'Feb', value: 52 },
    { month: 'Mar', value: 48 },
    { month: 'Apr', value: 61 },
    { month: 'May', value: 55 },
    { month: 'Jun', value: 67 }
  ];

  const qualityTrendData = [
    { month: 'Jan', score: 85 },
    { month: 'Feb', score: 88 },
    { month: 'Mar', score: 86 },
    { month: 'Apr', score: 90 },
    { month: 'May', score: 89 },
    { month: 'Jun', score: 92 }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-800">Dashboard</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            Auto-refresh (5min)
          </label>
          <button
            onClick={() => setShowComparison(!showComparison)}
            className={`px-4 py-2 rounded-xl text-sm transition-colors ${
              showComparison ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {showComparison ? 'Hide' : 'Show'} Comparison
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh Data'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
        <div className="mb-3 flex flex-wrap gap-2">
          <button onClick={() => applyDatePreset('today')} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm hover:bg-blue-100">Today</button>
          <button onClick={() => applyDatePreset('thisWeek')} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm hover:bg-blue-100">This Week</button>
          <button onClick={() => applyDatePreset('thisMonth')} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm hover:bg-blue-100">This Month</button>
          <button onClick={() => applyDatePreset('lastMonth')} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm hover:bg-blue-100">Last Month</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Project</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">All Projects</option>
              {allProjects.map(project => (
                <option key={project} value={project}>{project}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {loading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          <>
            <KPICard
          title="Total Work Completed"
          value={issues.filter(i => i?.fields?.status?.name === 'Done').length}
          subtitle="Items finished"
          trend="up"
          color="blue"
          tooltip="Number of work items marked as complete"
        />
        <KPICard
          title="Delivery Rate"
          value={`${calculateDeliveryRate(issues)}%`}
          subtitle="On-time completion"
          trend="up"
          color="green"
          tooltip="Percentage of work delivered on schedule"
        />
        <KPICard
          title="Quality Score"
          value={`${calculateQualityScore(issues)}%`}
          subtitle="Based on defects"
          trend="up"
          color="green"
          tooltip="Quality metric based on defect ratio"
        />
        <KPICard
          title="Work Hours Logged"
          value={Math.round(calculateWorkHours([]))}
          subtitle="Total hours"
          color="blue"
          tooltip="Total hours logged by team"
        />
          </>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WorkDistributionChart data={workDistributionData} />
        {currentUser.userType === 'employee' && <WeeklySummary logs={worklogs} />}
        {currentUser.userType !== 'employee' && <MonthlyTrendChart data={monthlyTrendData} />}
      </div>
      )}

      {showComparison && (
        <PeriodComparison 
          currentIssues={issues} 
          currentWorklogs={worklogs}
          previousIssues={previousIssues}
          previousWorklogs={previousWorklogs}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProjectTimeDistribution worklogs={worklogs} />
        <ProductivityTrends worklogs={worklogs} dateRange={dateRange} />
      </div>

      {currentUser.userType !== 'employee' && (
        <BurndownChart issues={issues} dateRange={dateRange} />
      )}

      {currentUser.userType !== 'employee' && (
        <VelocityChart issues={issues} dateRange={dateRange} />
      )}

      <ActivityHeatmap worklogs={worklogs} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProjectCompletionBar completion={calculateCompletion(issues)} />
        <QualityTrendChart data={qualityTrendData} />
      </div>
    </div>
  );
};

export default DashboardPage;
