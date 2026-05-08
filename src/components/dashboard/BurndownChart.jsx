import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const BurndownChart = ({ issues, dateRange }) => {
  const generateBurndownData = () => {
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    
    const totalTasks = issues.length;
    const idealBurnRate = totalTasks / days;
    
    const data = [];
    let remainingTasks = totalTasks;
    
    for (let i = 0; i < days; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      const completedOnDay = issues.filter(issue => {
        const resolutionDate = issue.fields?.resolutiondate?.split('T')[0];
        return resolutionDate === dateStr;
      }).length;
      
      remainingTasks -= completedOnDay;
      
      data.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        actual: Math.max(0, remainingTasks),
        ideal: Math.max(0, totalTasks - (idealBurnRate * (i + 1)))
      });
    }
    
    return data;
  };
  
  const data = generateBurndownData();
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Burndown Chart</h3>
      
      {data.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No data available</div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="ideal" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" name="Ideal" />
              <Line type="monotone" dataKey="actual" stroke="#3b82f6" strokeWidth={2} name="Actual" />
            </LineChart>
          </ResponsiveContainer>
          
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{data[data.length - 1].actual}</p>
              <p className="text-xs text-gray-600 mt-1">Remaining</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{issues.filter(i => i.fields?.status?.name === 'Done').length}</p>
              <p className="text-xs text-gray-600 mt-1">Completed</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-600">{issues.length}</p>
              <p className="text-xs text-gray-600 mt-1">Total</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default BurndownChart;
