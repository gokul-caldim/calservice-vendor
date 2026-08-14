import React from 'react';
import { AlertCircle, Clock, FileCheck, Send, ShieldAlert, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export function ActionCenter({
  items = [],
  title = 'Action Center',
  subtitle = 'Items requiring immediate operational attention',
  className = '',
}) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <div className={`bg-white border border-slate-200 rounded shadow-sm overflow-hidden ${className}`}>
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
            {title}
          </h2>
          {subtitle && <p className="text-[10px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
        {items.map((item, idx) => {
          const count = Number(item.count || 0);
          const isUrgent = count > 0;
          const content = (
            <div
              className={`p-3.5 hover:bg-slate-50/80 transition-colors flex items-center justify-between ${
                item.to || item.onClick ? 'cursor-pointer' : ''
              }`}
              onClick={item.onClick}
            >
              <div className="min-w-0 pr-2">
                <p className="text-[11px] font-semibold text-slate-600 truncate">{item.title}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 truncate">{item.description}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-bold ${
                    isUrgent
                      ? item.badgeClass || 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {count}
                </span>
                {(item.to || item.onClick) && <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
              </div>
            </div>
          );

          return item.to ? (
            <Link key={idx} to={item.to} className="block">
              {content}
            </Link>
          ) : (
            <div key={idx}>{content}</div>
          );
        })}
      </div>
    </div>
  );
}

export default ActionCenter;
