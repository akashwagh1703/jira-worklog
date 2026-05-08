const ActivityHeatmap = ({ worklogs }) => {
  const generateHeatmapData = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const hours = Array.from({ length: 24 }, (_, i) => i);
    
    const activityMap = {};
    days.forEach(day => {
      activityMap[day] = {};
      hours.forEach(hour => {
        activityMap[day][hour] = 0;
      });
    });
    
    worklogs.forEach(log => {
      const date = new Date(log.created);
      const day = days[date.getDay()];
      const hour = date.getHours();
      activityMap[day][hour]++;
    });
    
    const maxActivity = Math.max(...Object.values(activityMap).flatMap(dayData => Object.values(dayData)));
    
    return { activityMap, maxActivity, days, hours };
  };
  
  const { activityMap, maxActivity, days, hours } = generateHeatmapData();
  
  const getColor = (count) => {
    if (count === 0) return 'bg-gray-100';
    const intensity = count / maxActivity;
    if (intensity > 0.75) return 'bg-blue-600';
    if (intensity > 0.5) return 'bg-blue-500';
    if (intensity > 0.25) return 'bg-blue-400';
    return 'bg-blue-300';
  };
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Activity Heatmap</h3>
      
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          <div className="flex gap-1 mb-2">
            <div className="w-12"></div>
            {hours.filter(h => h % 3 === 0).map(hour => (
              <div key={hour} className="w-8 text-xs text-gray-500 text-center">{hour}h</div>
            ))}
          </div>
          
          {days.map(day => (
            <div key={day} className="flex gap-1 mb-1">
              <div className="w-12 text-xs text-gray-600 flex items-center">{day}</div>
              {hours.map(hour => (
                <div
                  key={hour}
                  className={`w-8 h-8 rounded ${getColor(activityMap[day][hour])}`}
                  title={`${day} ${hour}:00 - ${activityMap[day][hour]} activities`}
                ></div>
              ))}
            </div>
          ))}
          
          <div className="flex items-center gap-2 mt-4 text-xs text-gray-600">
            <span>Less</span>
            <div className="w-4 h-4 bg-gray-100 rounded"></div>
            <div className="w-4 h-4 bg-blue-300 rounded"></div>
            <div className="w-4 h-4 bg-blue-400 rounded"></div>
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <div className="w-4 h-4 bg-blue-600 rounded"></div>
            <span>More</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityHeatmap;
