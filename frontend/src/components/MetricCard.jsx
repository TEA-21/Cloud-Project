import React from 'react';

export default function MetricCard({ 
  label, 
  value, 
  unit = '', 
  context, 
  status, 
  statusType = 'neutral', // 'success' | 'warning' | 'danger' | 'neutral'
  icon: Icon,
  sparklineData
}) {
  const getStatusBadge = () => {
    switch (statusType) {
      case 'success':
        return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'warning':
        return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'danger':
        return 'text-rose-700 bg-rose-50 border-rose-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getSparklineColor = () => {
    if (statusType === 'danger') return '#EF4444';
    if (statusType === 'warning') return '#F59E0B';
    return '#5B58F5';
  };

  return (
    <div className="bg-white border border-gray-200 shadow-card hover:shadow-card-hover rounded-xl p-4 flex flex-col justify-between transition-all">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        {Icon && (
          <div className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-500">
            <Icon className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      <div className="my-2.5 flex items-baseline justify-between">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold tracking-tight text-gray-900 font-sans tabular-nums">
            {value}
          </span>
          {unit && <span className="text-xs text-gray-500 font-mono font-medium">{unit}</span>}
        </div>

        {status && (
          <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${getStatusBadge()}`}>
            {status}
          </span>
        )}
      </div>

      {/* Sparkline & Context Note */}
      <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
        <span className="truncate">{context}</span>
        {sparklineData && (
          <div className="w-16 h-4 shrink-0 ml-2">
            <svg viewBox="0 0 64 16" className="w-full h-full overflow-visible">
              <polyline
                fill="none"
                stroke={getSparklineColor()}
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={sparklineData.map((val, idx) => {
                  const x = (idx / (sparklineData.length - 1)) * 64;
                  const min = Math.min(...sparklineData);
                  const max = Math.max(...sparklineData) || min + 1;
                  const y = 14 - ((val - min) / (max - min)) * 12;
                  return `${x},${y}`;
                }).join(' ')}
              />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
