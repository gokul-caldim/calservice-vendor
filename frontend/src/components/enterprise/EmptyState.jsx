import React from 'react';
import { Inbox } from 'lucide-react';

export function EmptyState({
  icon: Icon = Inbox,
  title = 'No records found',
  description = 'There are no records matching your current filter criteria.',
  action = null,
  className = '',
}) {
  return (
    <div className={`bg-white border border-slate-200 rounded p-8 text-center shadow-sm ${className}`}>
      <div className="w-10 h-10 rounded bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto mb-3 text-slate-500">
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      {description && <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export default EmptyState;
