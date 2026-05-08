const WeeklySummary = ({ logs }) => {
  const getWeekData = () => {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      weekDays.push(day.toISOString().split('T')[0]);
    }
    
    const dailyHours = weekDays.map(date => {
      const dayLogs = logs.filter(log => log.created.split('T')[0] === date);
      const hours = dayLogs.reduce((sum, log) => sum + (log.timeSpentSeconds || 0), 0) / 3600;
      return { date, hours: hours.toFixed(1), day: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }) };
    });
    
    const totalHours = dailyHours.reduce((sum, d) => sum + parseFloat(d.hours), 0).toFixed(1);
    const avgHours = (totalHours / 7).toFixed(1);
    const tasksCompleted = logs.filter(log => {
      const logDate = log.created.split('T')[0];
      return weekDays.includes(logDate);
    }).length;
    
    return { dailyHours, totalHours, avgHours, tasksCompleted };
  };
  
  const { dailyHours, totalHours, avgHours, tasksCompleted } = getWeekData();
  const maxHours = Math.max(...dailyHours.map(d => parseFloat(d.hours)), 1);
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">This Week Summary</h3>
      
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <p className="text-2xl font-bold text-blue-600">{totalHours}h</p>
          <p className="text-xs text-gray-600 mt-1">Total Hours</p>
        </div>
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <p className="text-2xl font-bold text-green-600">{avgHours}h</p>
          <p className="text-xs text-gray-600 mt-1">Avg/Day</p>
        </div>
        <div className="text-center p-3 bg-purple-50 rounded-lg">
          <p className="text-2xl font-bold text-purple-600">{tasksCompleted}</p>
          <p className="text-xs text-gray-600 mt-1">Tasks Logged</p>
        </div>
      </div>
      
      <div className="space-y-2">
        {dailyHours.map((d, idx) => (
          <div key={idx} className="flex items-center gap-3">
            <span className="text-xs font-medium text-gray-600 w-8">{d.day}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-6 relative">
              <div 
                className="bg-blue-600 h-6 rounded-full transition-all duration-300 flex items-center justify-end pr-2"
                style={{ width: `${(parseFloat(d.hours) / maxHours) * 100}%` }}
              >
                {parseFloat(d.hours) > 0 && (
                  <span className="text-xs font-medium text-white">{d.hours}h</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WeeklySummary;
