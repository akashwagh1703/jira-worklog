import { useState, useEffect } from 'react';
import { useConfig } from '../context/ConfigContext';
import { fetchIssues } from '../services/jiraService';

const ResourceAllocationPage = () => {
  const { jiraConfig, currentUser } = useConfig();
  const [loading, setLoading] = useState(false);
  const [allocations, setAllocations] = useState([]);

  useEffect(() => {
    if (currentUser.userType === 'management' && jiraConfig.baseUrl) {
      loadAllocations();
    }
  }, [jiraConfig, currentUser]);

  const loadAllocations = async () => {
    setLoading(true);
    const jql = 'created >= -90d AND status != Done ORDER BY project ASC';
    const result = await fetchIssues(currentUser, jiraConfig, '', jql);
    
    if (result.success && result.data) {
      const projectMap = {};
      
      result.data.forEach(issue => {
        const project = issue.fields?.project?.name || 'Unknown';
        const assignee = issue.fields?.assignee;
        
        if (!projectMap[project]) {
          projectMap[project] = {
            name: project,
            totalTasks: 0,
            inProgress: 0,
            todo: 0,
            members: {}
          };
        }
        
        projectMap[project].totalTasks++;
        if (issue.fields.status?.name === 'In Progress') projectMap[project].inProgress++;
        if (issue.fields.status?.name === 'To Do') projectMap[project].todo++;
        
        if (assignee) {
          const email = assignee.emailAddress;
          if (!projectMap[project].members[email]) {
            projectMap[project].members[email] = {
              name: assignee.displayName,
              email,
              avatar: assignee.avatarUrls?.['48x48'],
              tasks: 0
            };
          }
          projectMap[project].members[email].tasks++;
        }
      });
      
      const allocationsArray = Object.values(projectMap).map(project => ({
        ...project,
        members: Object.values(project.members).sort((a, b) => b.tasks - a.tasks)
      }));
      
      setAllocations(allocationsArray);
    }
    
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Resource Allocation</h1>
          <p className="text-sm text-gray-500 mt-1">Who's working on what</p>
        </div>
        <button
          onClick={loadAllocations}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {allocations.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-200 text-center">
            <p className="text-gray-500">{loading ? 'Loading...' : 'No active projects found'}</p>
          </div>
        ) : (
          allocations.map((project, idx) => (
            <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">{project.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {project.totalTasks} active tasks • {project.members.length} team members
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                      {project.inProgress} In Progress
                    </span>
                    <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">
                      {project.todo} To Do
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-4">Team Members</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {project.members.map((member, mIdx) => (
                    <div key={mIdx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      {member.avatar && (
                        <img src={member.avatar} alt="" className="w-10 h-10 rounded-full" />
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">{member.name}</p>
                        <p className="text-xs text-gray-500">{member.tasks} tasks assigned</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ResourceAllocationPage;
