import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const ProjectTimeDistribution = ({ worklogs }) => {
  const getProjectData = () => {
    const projectHours = {};
    
    worklogs.forEach(log => {
      const project = log.project || 'Unknown';
      const hours = (log.timeSpentSeconds || 0) / 3600;
      projectHours[project] = (projectHours[project] || 0) + hours;
    });
    
    return Object.keys(projectHours).map(project => ({
      name: project,
      value: parseFloat(projectHours[project].toFixed(2)),
      hours: projectHours[project].toFixed(1)
    }));
  };
  
  const data = getProjectData();
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Project-wise Time Distribution</h3>
      
      {data.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No data available</div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${value}h`} />
            </PieChart>
          </ResponsiveContainer>
          
          <div className="mt-4 space-y-2">
            {data.map((project, idx) => (
              <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                  <span className="text-sm text-gray-700">{project.name}</span>
                </div>
                <span className="text-sm font-medium text-gray-800">{project.hours}h</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default ProjectTimeDistribution;
