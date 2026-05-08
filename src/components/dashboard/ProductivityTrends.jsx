import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const ProductivityTrends = ({ worklogs, dateRange }) => {
  const getTrendData = () => {
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    
    const dailyData = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayLogs = worklogs.filter(log => log.created?.split('T')[0] === dateStr);
      const hours = dayLogs.reduce((sum, log) => sum + (log.timeSpentSeconds || 0), 0) / 3600;
      const tasks = dayLogs.length;
      
      dailyData.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        hours: parseFloat(hours.toFixed(1)),
        tasks
      });
    }
    
    return dailyData;
  };
  
  const data = getTrendData();
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Productivity Trends</h3>
      
      {data.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No data available</div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="hours" stroke="#3b82f6" strokeWidth={2} name="Hours" />
            <Line yAxisId="right" type="monotone" dataKey="tasks" stroke="#10b981" strokeWidth={2} name="Tasks" />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default ProductivityTrends;
