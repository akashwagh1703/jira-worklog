const ProjectDetail = ({ projectKey, details, loading, error, onRefresh, refreshing }) => {
  if (!projectKey) {
    return <p className="text-gray-400 text-sm">Select a project to view details.</p>;
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-5 bg-gray-200 rounded w-3/4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        <div className="space-y-2 mt-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-4 bg-gray-200 rounded"></div>
          ))}
        </div>
        <div className="h-2 bg-gray-200 rounded-full mt-3"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <p className="text-red-600 text-sm">{error}</p>
        <button
          onClick={onRefresh}
          className="px-3 py-1 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!details || !details.project) {
    return <p className="text-gray-500 text-sm">No details available for {projectKey}.</p>;
  }

  const { project, stats, sprint } = details;
  const jiraProjectUrl = `https://esds.atlassian.net/jira/software/projects/${project.key}/boards`;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">{project.name || projectKey}</h2>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="px-3 py-1 rounded-lg border bg-gray-50 hover:bg-gray-100 text-sm"
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Meta */}
      <div className="space-y-1">
        <p className="text-sm text-gray-600">Key: <span className="font-medium">{project.key}</span></p>
        {project.projectTypeKey && <p className="text-sm text-gray-600">Type: {project.projectTypeKey}</p>}
        {project.description && <p className="text-sm text-gray-500">{project.description}</p>}
        <p className="text-sm text-gray-600">Lead: <span className="font-medium">{project.lead?.displayName || 'N/A'}</span></p>
        <a href={jiraProjectUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-xs text-blue-600 hover:underline">
          Open in Jira ↗
        </a>
      </div>

      {/* Completion bar */}
      <div>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-600 font-medium">Overall Completion</span>
          <span className="font-bold text-blue-700">{stats?.completion ?? 0}%</span>
        </div>
        <div className="h-3 bg-gray-200 rounded-full">
          <div className="h-3 rounded-full bg-blue-600 transition-all duration-500" style={{ width: `${stats?.completion ?? 0}%` }} />
        </div>
      </div>

      {/* Status counts */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-gray-800">{stats?.total ?? 0}</p>
          <p className="text-xs text-gray-500 mt-1">Total</p>
        </div>
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{stats?.done ?? 0}</p>
          <p className="text-xs text-gray-500 mt-1">Done</p>
        </div>
        <div className="bg-yellow-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-yellow-600">{stats?.inProgress ?? 0}</p>
          <p className="text-xs text-gray-500 mt-1">In Progress</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{stats?.todo ?? 0}</p>
          <p className="text-xs text-gray-500 mt-1">To Do</p>
        </div>
      </div>

      {/* Priority breakdown */}
      {stats?.priority && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Priority Breakdown</p>
          <div className="space-y-2">
            {[['High', stats.priority.high, 'bg-red-500'], ['Medium', stats.priority.medium, 'bg-yellow-400'], ['Low', stats.priority.low, 'bg-green-400']].map(([label, count, color]) => (
              <div key={label} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-14">{label}</span>
                <div className="flex-1 h-2 bg-gray-200 rounded-full">
                  <div className={`h-2 rounded-full ${color} transition-all duration-500`}
                    style={{ width: stats.total > 0 ? `${Math.round((count / stats.total) * 100)}%` : '0%' }} />
                </div>
                <span className="text-xs font-medium text-gray-700 w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Issue type breakdown */}
      {stats?.issueTypes && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Issue Types</p>
          <div className="flex gap-2 flex-wrap">
            <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">🐛 Bugs: {stats.issueTypes.bug}</span>
            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">📖 Stories: {stats.issueTypes.story}</span>
            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">✅ Tasks: {stats.issueTypes.task}</span>
          </div>
        </div>
      )}

      {/* Active Sprint — shown only if sprint data exists */}
      {sprint && (
        <div className="border border-blue-200 bg-blue-50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-blue-800">⚡ Active Sprint</p>
            <span className="px-2 py-0.5 bg-blue-200 text-blue-800 rounded text-xs font-medium">{sprint.state}</span>
          </div>
          <p className="text-sm font-medium text-gray-800 mb-1">{sprint.name}</p>
          {sprint.goal && <p className="text-xs text-gray-500 mb-2 italic">"{sprint.goal}"</p>}
          <div className="flex gap-4 text-xs text-gray-600 mb-3">
            {sprint.startDate && <span>Start: {new Date(sprint.startDate).toLocaleDateString()}</span>}
            {sprint.endDate   && <span>End: {new Date(sprint.endDate).toLocaleDateString()}</span>}
          </div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-600">Sprint Progress</span>
            <span className="font-semibold text-blue-700">{sprint.done}/{sprint.total} issues ({sprint.completion}%)</span>
          </div>
          <div className="h-2 bg-blue-200 rounded-full">
            <div
              className="h-2 rounded-full bg-blue-600 transition-all duration-500"
              style={{ width: `${sprint.completion}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetail;
