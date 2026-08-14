import React from 'react';

export function MetricStrip({ metrics = [], columns = 4, className = '' }) {
  const colClass = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 sm:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-5',
    6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
  }[columns] || 'grid-cols-2 sm:grid-cols-4';

  return (
    <div className={`grid ${colClass} gap-2.5 ${className}`}>
      {metrics.map((item, idx) => {
        const Icon = item.icon;
        return (
          <div
            key={idx}
            className={`bg-white border border-slate-200 rounded p-3 shadow-sm hover:border-slate-300 transition-colors ${
              item.onClick ? 'cursor-pointer hover:bg-slate-50/50' : ''
            }`}
            onClick={item.onClick}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                {item.label}
              </span>
              {Icon && <Icon className={`w-3.5 h-3.5 ${item.iconColor || 'text-slate-400'}`} />}
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-xl font-bold tracking-tight ${item.valueColor || 'text-slate-900'}`}>
                {item.value ?? 0}
              </span>
              {item.change && (
                <span
                  className={`text-[10px] font-semibold ${
                    item.changeType === 'increase'
                      ? 'text-emerald-600'
                      : item.changeType === 'decrease'
                      ? 'text-rose-600'
                      : 'text-slate-500'
                  }`}
                >
                  {item.change}
                </span>
              )}
            </div>
            {item.subtext && (
              <p className="text-[10px] text-slate-400 mt-0.5 truncate">{item.subtext}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default MetricStrip;
