import React from 'react';

export function LoadingState({ message = 'Loading workforce data...', className = '' }) {
  return (
    <div className={`bg-white border border-slate-200 rounded p-12 text-center shadow-sm ${className}`}>
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
      <p className="text-xs font-semibold text-slate-600">{message}</p>
    </div>
  );
}

export default LoadingState;
