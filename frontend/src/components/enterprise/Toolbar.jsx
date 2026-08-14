import React from 'react';
import { Search, RefreshCw, X } from 'lucide-react';

export function Toolbar({
  searchValue = '',
  onSearchChange = null,
  searchPlaceholder = 'Search records...',
  filters = [],
  activeFilters = {},
  onFilterChange = null,
  onRefresh = null,
  isRefreshing = false,
  actions = null,
  className = '',
}) {
  return (
    <div
      className={`bg-white border border-slate-200 rounded p-2.5 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 ${className}`}
    >
      {/* Left: Search and Filters */}
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {onSearchChange && (
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
            />
            {searchValue && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Filter dropdowns */}
        {filters.map((filter) => (
          <div key={filter.key} className="flex items-center gap-1">
            {filter.label && (
              <span className="text-[11px] font-medium text-slate-500 hidden lg:inline">
                {filter.label}:
              </span>
            )}
            <select
              value={activeFilters[filter.key] ?? ''}
              onChange={(e) => onFilterChange && onFilterChange(filter.key, e.target.value)}
              className="py-1.5 px-2 bg-white border border-slate-300 rounded text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
            >
              {filter.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* Right: Refresh CTA and custom action buttons */}
      <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        )}
        {actions}
      </div>
    </div>
  );
}

export default Toolbar;
