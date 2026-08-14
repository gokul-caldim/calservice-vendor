import React from 'react';

export function Tabs({ tabs = [], activeTab = '', onChange = () => {}, className = '' }) {
  return (
    <div className={`border-b border-slate-200 bg-white px-2 overflow-x-auto scrollbar-none flex gap-1 ${className}`}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`py-2.5 px-3.5 text-xs font-semibold whitespace-nowrap border-b-2 -mb-px flex items-center gap-1.5 transition-colors ${
              isActive
                ? 'border-blue-600 text-blue-700 font-bold bg-blue-50/30'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            {Icon && <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isActive ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
