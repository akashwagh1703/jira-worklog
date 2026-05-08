import { useState, useEffect } from 'react';
import { useConfig } from '../context/ConfigContext';
import { fetchIssues } from '../services/jiraService';
import { groupByProject, calculateCompletion } from '../utils/calculations';

const MyProjectsPage = () => {
  const { jiraConfig, currentUser } = useConfig();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if ((currentUser.userType === 'employee' && currentUser.jiraCredentials) || 
        (currentUser.userType === 'management' && jiraConfig.baseUrl && jiraConfig.email && jiraConfig.apiToken)) {
      loadProjects();
    }
  }, [jiraConfig, currentUser]);

  const loadProjects = async () => {
    setLoading(true);
    setError('');
    const result = await fetchIssues(currentUser, jiraConfig, '');

    if (result.success && result.data) {
      const grouped = groupByProject(result.data);
      const projectList = Object.keys(grouped).map(name => {
        const issues = grouped[name];
        const completion = calculateCompletion(issues);
        const completed = issues.filter(i => i?.fields?.status?.name === 'Done').length;
        const inProgress = issues.filter(i => i?.fields?.status?.name === 'In Progress').length;
        const todo = issues.filter(i => i?.fields?.status?.name === 'To Do').length;
        return {
          name,
          completion,
          risk: completion >= 70 ? 'low' : completion >= 40 ? 'medium' : 'high',
          totalTasks: issues.length,
          completed,
          inProgress,
          todo
        };
      });
      setProjects(projectList);
    } else {
      setError(result.error || 'Failed to load projects');
      setProjects([]);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">My Projects</h1>
          <p className="text-sm text-gray-500 mt-1">Projects you are working on</p>
        </div>
        <button
          onClick={loadProjects}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <p className="text-sm text-gray-500">Total Projects</p>
          <p className="text-3xl font-semibold text-blue-600 mt-2">{projects.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <p className="text-sm text-gray-500">Total Tasks</p>
          <p className="text-3xl font-semibold text-blue-600 mt-2">
            {projects.reduce((sum, p) => sum + p.totalTasks, 0)}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <p className="text-sm text-gray-500">Completed Tasks</p>
          <p className="text-3xl font-semibold text-green-600 mt-2">
            {projects.reduce((sum, p) => sum + p.completed, 0)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {projects.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-200 text-center">
            <p className="text-gray-500">{loading ? 'Loading...' : 'No projects found'}</p>
          </div>
        ) : (
          projects.map((project, idx) => (
            <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">{project.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{project.totalTasks} tasks assigned</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    project.risk === 'low' ? 'bg-green-100 text-green-800' :
                    project.risk === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {project.risk} risk
                  </span>
                </div>
              </div>

              <div className="p-6">
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Completion</span>
                    <span className="font-medium text-gray-800">{project.completion}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${project.completion}%` }}
                    ></div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{project.completed}</p>
                    <p className="text-xs text-gray-600 mt-1">Completed</p>
                  </div>
                  <div className="text-center p-3 bg-yellow-50 rounded-lg">
                    <p className="text-2xl font-bold text-yellow-600">{project.inProgress}</p>
                    <p className="text-xs text-gray-600 mt-1">In Progress</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-gray-600">{project.todo}</p>
                    <p className="text-xs text-gray-600 mt-1">To Do</p>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MyProjectsPage;
