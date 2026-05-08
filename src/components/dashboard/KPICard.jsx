const KPICard = ({ title, value, subtitle, trend, color, tooltip }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm text-gray-500">{title}</p>
            {tooltip && (
              <span className="text-xs text-gray-400 cursor-help transition-transform hover:scale-125" title={tooltip}>ⓘ</span>
            )}
          </div>
          <p className={`text-3xl font-semibold mt-2 text-${color}-600 transition-all duration-300 hover:scale-110`}>{value}</p>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {trend && (
          <div className={`text-2xl transition-all duration-300 hover:scale-125 ${
            trend === 'up' ? 'text-green-500 animate-bounce' : 'text-red-500'
          }`}>
            {trend === 'up' ? '↑' : '↓'}
          </div>
        )}
      </div>
    </div>
  );
};

export default KPICard;
