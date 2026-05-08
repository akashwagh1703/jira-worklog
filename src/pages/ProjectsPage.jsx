import { useEffect, useState } from 'react';
import { useConfig } from '../context/ConfigContext';
import { getAllProjects, getProjectDetails, refreshProject } from '../services/jiraService';

const PAGE_SIZE = 10;

const ProjectsPage = () => {
  const { currentUser } = useConfig();
  const [projects, setProjects]               = useState([]);
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState(null);
  const [search, setSearch]                   = useState('');
  const [page, setPage]                       = useState(1);
  const [totalProjects, setTotalProjects]     = useState(0);
  const [selectedProjectKey, setSelectedProjectKey] = useState(null);
  const [details, setDetails]                 = useState(null);
  const [detailLoading, setDetailLoading]     = useState(false);
  const [detailError, setDetailError]         = useState(null);
  const [refreshing, setRefreshing]           = useState(false);

  const isManagement = currentUser?.userType === 'management';

  useEffect(() => {
    if (!isManagement && currentUser?.userType !== 'employee') {
      setError('Only employee and management users can view projects.');
      return;
    }
    loadProjects();
  }, [page, currentUser]);

  const loadProjects = async () => {
    setError(null);
    setLoading(true);
    const result = await getAllProjects((page - 1) * PAGE_SIZE, PAGE_SIZE);
    if (!result.success) {
      setError(result.error || 'Unable to fetch project list');
      setProjects([]);
      setTotalProjects(0);
      setLoading(false);
      return;
    }
    const data   = result.data || {};
    const values = data.values || [];
    if (values.length === 0) {
      setError('No projects found. Verify Jira credentials in jira_config.php.');
      setProjects([]);
      setTotalProjects(0);
      setLoading(false);
      return;
    }
    setTotalProjects(data.total || values.length);
    setProjects(values);
    setLoading(false);
  };

  const selectProject = async (projectKey) => {
    setSelectedProjectKey(projectKey);
    setDetails(null);
    setDetailError(null);
    setDetailLoading(true);
    const result = await getProjectDetails(projectKey);
    if (!result.success) {
      setDetailError(result.error || 'Unable to load project details');
      setDetailLoading(false);
      return;
    }
    setDetails(result.data);
    setDetailLoading(false);
  };

  const onRefresh = async () => {
    if (!selectedProjectKey) return;
    setRefreshing(true);
    setDetailError(null);
    const result = await refreshProject(selectedProjectKey);
    if (!result.success) {
      setDetailError(result.error || 'Unable to refresh project');
    } else {
      setDetails(prev => prev ? {
        ...prev,
        stats:  result.data.stats,
        sprint: result.data.sprint ?? null
      } : prev);
    }
    setRefreshing(false);
  };

  const filteredProjects = projects.filter(p => {
    if (!search) return true;
    const t = search.toLowerCase();
    return (p.name || '').toLowerCase().includes(t) || (p.key || '').toLowerCase().includes(t);
  });

  const totalPages = Math.max(1, Math.ceil(totalProjects / PAGE_SIZE));

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-800">Projects</h1>
        <p className="text-sm text-gray-500 mt-1">View and track Jira project progress.</p>
      </div>

      {!isManagement && currentUser?.userType !== 'employee' ? (
        <div className="p-6 bg-white rounded-xl border border-gray-200">
          <p className="text-red-600 font-medium">Access denied. Management or employee role required.</p>
        </div>
      ) : (
        <>
          {/* Search + list */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Search projects..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <button
                onClick={loadProjects}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
            )}

            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="animate-pulse h-20 bg-gray-100 rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {filteredProjects.map(project => (
                  <button
                    key={project.key}
                    onClick={() => selectProject(project.key)}
                    className={`text-left rounded-xl border p-3 hover:border-blue-500 hover:shadow-sm transition-all ${
                      selectedProjectKey === project.key
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold mb-2 ${
                      selectedProjectKey === project.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {(project.key || '?').substring(0, 2)}
                    </div>
                    <p className="text-sm font-semibold text-gray-800 truncate">{project.name || project.key}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{project.key}</p>
                  </button>
                ))}
              </div>
            )}

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-500">Page {page} of {totalPages} · {totalProjects} projects</p>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1 border rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50">Prev</button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-3 py-1 border rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50">Next</button>
              </div>
            </div>
          </div>

          {/* Project Detail — full width below list */}
          {selectedProjectKey && (
            <ProjectDetailPanel
              projectKey={selectedProjectKey}
              details={details}
              loading={detailLoading}
              error={detailError}
              onRefresh={onRefresh}
              refreshing={refreshing}
            />
          )}
        </>
      )}
    </div>
  );
};

/* ─── Full-width Project Detail Panel ─────────────────────────────────────── */
const ProjectDetailPanel = ({ projectKey, details, loading, error, onRefresh, refreshing }) => {

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="flex justify-between">
            <div className="h-6 bg-gray-200 rounded w-48" />
            <div className="h-8 bg-gray-200 rounded w-24" />
          </div>
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl" />)}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-32 bg-gray-100 rounded-xl" />
            <div className="h-32 bg-gray-100 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6 flex items-center justify-between">
        <p className="text-red-600 text-sm">{error}</p>
        <button onClick={onRefresh} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">
          Retry
        </button>
      </div>
    );
  }

  if (!details?.project) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center text-gray-400 text-sm">
        No details available for {projectKey}.
      </div>
    );
  }

  const { project, stats, sprint } = details;
  const jiraUrl = `https://esds.atlassian.net/jira/software/projects/${project.key}/boards`;

  // Sprint days remaining
  const daysRemaining = sprint?.endDate
    ? Math.max(0, Math.ceil((new Date(sprint.endDate) - new Date()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">

      {/* Header row */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
            {(project.key || '?').substring(0, 2)}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-800">{project.name || projectKey}</h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm text-gray-500">Key: <span className="font-medium text-gray-700">{project.key}</span></span>
              {project.projectTypeKey && (
                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{project.projectTypeKey}</span>
              )}
              <span className="text-sm text-gray-500">Lead: <span className="font-medium text-gray-700">{project.lead?.displayName || 'N/A'}</span></span>
              <a href={jiraUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                Open in Jira ↗
              </a>
            </div>
            {project.description && <p className="text-sm text-gray-500 mt-1">{project.description}</p>}
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="px-4 py-2 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-sm font-medium disabled:opacity-50 flex items-center gap-2"
        >
          <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Overall completion bar */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold text-gray-700">Overall Project Completion</span>
          <span className="text-2xl font-bold text-blue-600">{stats?.completion ?? 0}%</span>
        </div>
        <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-4 rounded-full bg-blue-600 transition-all duration-700"
            style={{ width: `${stats?.completion ?? 0}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{stats?.done ?? 0} completed</span>
          <span>{stats?.total ?? 0} total issues</span>
        </div>
      </div>

      {/* Status cards + Priority + Issue types row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Status count cards */}
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-3">Issue Status</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Total',       value: stats?.total      ?? 0, bg: 'bg-gray-50',   text: 'text-gray-800'   },
              { label: 'Done',        value: stats?.done       ?? 0, bg: 'bg-green-50',  text: 'text-green-600'  },
              { label: 'In Progress', value: stats?.inProgress ?? 0, bg: 'bg-yellow-50', text: 'text-yellow-600' },
              { label: 'To Do',       value: stats?.todo       ?? 0, bg: 'bg-blue-50',   text: 'text-blue-600'   },
            ].map(({ label, value, bg, text }) => (
              <div key={label} className={`${bg} rounded-xl p-4 text-center`}>
                <p className={`text-3xl font-bold ${text}`}>{value}</p>
                <p className="text-xs text-gray-500 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Priority breakdown */}
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-3">Priority Breakdown</p>
          <div className="space-y-3">
            {[
              { label: 'High',   count: stats?.priority?.high   ?? 0, color: 'bg-red-500',    badge: 'bg-red-100 text-red-700'    },
              { label: 'Medium', count: stats?.priority?.medium ?? 0, color: 'bg-yellow-400', badge: 'bg-yellow-100 text-yellow-700' },
              { label: 'Low',    count: stats?.priority?.low    ?? 0, color: 'bg-green-400',  badge: 'bg-green-100 text-green-700'  },
            ].map(({ label, count, color, badge }) => (
              <div key={label}>
                <div className="flex justify-between items-center mb-1">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${badge}`}>{label}</span>
                  <span className="text-sm font-semibold text-gray-700">
                    {count} <span className="text-xs text-gray-400 font-normal">
                      ({stats?.total > 0 ? Math.round((count / stats.total) * 100) : 0}%)
                    </span>
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full">
                  <div className={`h-2 rounded-full ${color} transition-all duration-700`}
                    style={{ width: stats?.total > 0 ? `${Math.round((count / stats.total) * 100)}%` : '0%' }} />
                </div>
              </div>
            ))}
          </div>

          {/* Issue type counts — dynamic from real Jira project types */}
          <p className="text-sm font-semibold text-gray-700 mt-5 mb-3">Issue Types</p>
          {stats?.issueTypes && Object.keys(stats.issueTypes).length > 0 ? (
            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
              {Object.entries(stats.issueTypes)
                .filter(([, count]) => count > 0)
                .sort((a, b) => b[1] - a[1])
                .map(([name, count]) => (
                  <div key={name} className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-gray-50">
                    <span className="text-xs text-gray-600 truncate flex-1">{name}</span>
                    <div className="flex items-center gap-2 ml-2">
                      <div className="w-16 h-1.5 bg-gray-200 rounded-full">
                        <div
                          className="h-1.5 rounded-full bg-blue-400"
                          style={{ width: stats.total > 0 ? `${Math.round((count / stats.total) * 100)}%` : '0%' }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-gray-700 w-6 text-right">{count}</span>
                    </div>
                  </div>
                ))
              }
            </div>
          ) : (
            <p className="text-xs text-gray-400">No issue type data</p>
          )}
        </div>

        {/* Active Sprint */}
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-3">Active Sprint</p>
          {sprint ? (
            <div className="border border-blue-200 bg-blue-50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-blue-800">⚡ {sprint.name}</span>
                <span className="px-2 py-0.5 bg-blue-200 text-blue-800 rounded-full text-xs font-medium capitalize">
                  {sprint.state}
                </span>
              </div>

              {sprint.goal && (
                <p className="text-xs text-gray-600 italic bg-white rounded-lg p-2 border border-blue-100">
                  "{sprint.goal}"
                </p>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs">
                {sprint.startDate && (
                  <div className="bg-white rounded-lg p-2 border border-blue-100">
                    <p className="text-gray-400">Start</p>
                    <p className="font-medium text-gray-700">{new Date(sprint.startDate).toLocaleDateString()}</p>
                  </div>
                )}
                {sprint.endDate && (
                  <div className="bg-white rounded-lg p-2 border border-blue-100">
                    <p className="text-gray-400">End</p>
                    <p className="font-medium text-gray-700">{new Date(sprint.endDate).toLocaleDateString()}</p>
                  </div>
                )}
              </div>

              {daysRemaining !== null && (
                <div className={`text-center py-2 rounded-lg text-sm font-semibold ${
                  daysRemaining <= 2 ? 'bg-red-100 text-red-700' :
                  daysRemaining <= 5 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {daysRemaining === 0 ? 'Ends today!' : `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining`}
                </div>
              )}

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600">Sprint Progress</span>
                  <span className="font-semibold text-blue-700">
                    {sprint.done}/{sprint.total} ({sprint.completion}%)
                  </span>
                </div>
                <div className="h-3 bg-blue-200 rounded-full overflow-hidden">
                  <div
                    className="h-3 rounded-full bg-blue-600 transition-all duration-700"
                    style={{ width: `${sprint.completion}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="border border-gray-200 bg-gray-50 rounded-xl p-6 text-center">
              <p className="text-gray-400 text-sm">No active sprint</p>
              <p className="text-gray-300 text-xs mt-1">This project may use Kanban or has no running sprint</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectsPage;
