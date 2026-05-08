import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const VelocityChart = ({ issues, dateRange }) => {
  const generateVelocityData = () => {
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const weeksCount = Math.ceil(totalDays / 7);
    
    const weeklyData = [];
    
    for (let i = 0; i < weeksCount; i++) {
      const weekStart = new Date(start);
      weekStart.setDate(start.getDate() + (i * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      const weekIssues = issues.filter(issue => {
        const created = new Date(issue.fields.created);
        return created >= weekStart && created <= weekEnd;
      });
      
      const completed = weekIssues.filter(i => i.fields?.status?.name === 'Done').length;
      const inProgress = weekIssues.filter(i => i.fields?.status?.name === 'In Progress').length;
      const planned = weekIssues.length;
      
      weeklyData.push({
        week: `Week ${i + 1}`,
        planned,
        completed,
        inProgress,
        velocity: completed
      });
    }
    
    return weeklyData;
  };
  
  const data = generateVelocityData();
  const avgVelocity = data.length > 0 
    ? (data.reduce((sum, w) => sum + w.velocity, 0) / data.length).toFixed(1)
    : 0;
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Team Velocity</h3>
      
      {data.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No data available</div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="planned" fill="#94a3b8" name="Planned" />
              <Bar dataKey="completed" fill="#10b981" name="Completed" />
              <Bar dataKey="inProgress" fill="#f59e0b" name="In Progress" />
            </BarChart>
          </ResponsiveContainer>
          
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{avgVelocity}</p>
              <p className="text-xs text-gray-600 mt-1">Avg Velocity</p>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{data[data.length - 1]?.velocity || 0}</p>
              <p className="text-xs text-gray-600 mt-1">Current Week</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default VelocityChart;
