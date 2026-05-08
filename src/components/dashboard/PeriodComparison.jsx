const PeriodComparison = ({ currentIssues, currentWorklogs, previousIssues, previousWorklogs }) => {
  const calculateMetrics = (issues, worklogs) => {
    const completed = issues.filter(i => i?.fields?.status?.name === 'Done').length;
    const totalHours = worklogs.reduce((sum, log) => sum + (log.timeSpentSeconds || 0), 0) / 3600;
    const avgTimePerTask = issues.length > 0 ? totalHours / issues.length : 0;
    
    return {
      tasks: issues.length,
      completed,
      hours: totalHours.toFixed(1),
      avgTime: avgTimePerTask.toFixed(1),
      completionRate: issues.length > 0 ? ((completed / issues.length) * 100).toFixed(0) : 0
    };
  };
  
  const current = calculateMetrics(currentIssues, currentWorklogs);
  const previous = calculateMetrics(previousIssues, previousWorklogs);
  
  const getChange = (curr, prev) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return (((curr - prev) / prev) * 100).toFixed(0);
  };
  
  const metrics = [
    { label: 'Total Tasks', current: current.tasks, previous: previous.tasks, change: getChange(current.tasks, previous.tasks) },
    { label: 'Completed', current: current.completed, previous: previous.completed, change: getChange(current.completed, previous.completed) },
    { label: 'Total Hours', current: current.hours + 'h', previous: previous.hours + 'h', change: getChange(parseFloat(current.hours), parseFloat(previous.hours)) },
    { label: 'Completion Rate', current: current.completionRate + '%', previous: previous.completionRate + '%', change: getChange(parseFloat(current.completionRate), parseFloat(previous.completionRate)) }
  ];
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Period Comparison</h3>
      
      <div className="grid grid-cols-2 gap-4">
        {metrics.map((metric, idx) => (
          <div key={idx} className="p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-2">{metric.label}</p>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-800">{metric.current}</p>
                <p className="text-xs text-gray-400 mt-1">vs {metric.previous}</p>
              </div>
              <div className={`flex items-center gap-1 text-sm font-medium ${
                parseFloat(metric.change) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {parseFloat(metric.change) >= 0 ? '↑' : '↓'} {Math.abs(metric.change)}%
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PeriodComparison;
