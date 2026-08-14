import React from 'react';
import { ChevronUp, ChevronDown, Inbox } from 'lucide-react';

export function DataTable({
  columns = [],
  data = [],
  keyField = 'id',
  isLoading = false,
  emptyMessage = 'No records found.',
  onRowClick = null,
  sortColumn = null,
  sortDirection = 'asc',
  onSort = null,
  compact = false,
  className = '',
}) {
  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded shadow-sm overflow-hidden">
        <div className="divide-y divide-slate-100">
          {[1, 2, 3, 4, 5].map((idx) => (
            <div key={idx} className="p-3.5 flex items-center justify-between animate-pulse">
              <div className="flex items-center gap-3 w-1/3">
                <div className="w-6 h-6 rounded bg-slate-200" />
                <div className="h-3 w-32 bg-slate-200 rounded" />
              </div>
              <div className="h-3 w-24 bg-slate-100 rounded" />
              <div className="h-3 w-20 bg-slate-100 rounded" />
              <div className="h-5 w-16 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded p-8 text-center shadow-sm">
        <Inbox className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-80" />
        <p className="text-xs font-semibold text-slate-700">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-slate-200 rounded shadow-sm overflow-hidden ${className}`}>
      {/* Desktop & Tablet Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 text-[11px] font-semibold uppercase tracking-wider select-none">
              {columns.map((col) => {
                const isSortable = Boolean(col.sortable && onSort);
                const isCurrentSort = sortColumn === col.key;

                return (
                  <th
                    key={col.key}
                    onClick={() => isSortable && onSort(col.key)}
                    className={`${compact ? 'px-3 py-2' : 'px-4 py-2.5'} ${
                      col.align === 'right'
                        ? 'text-right'
                        : col.align === 'center'
                        ? 'text-center'
                        : 'text-left'
                    } ${isSortable ? 'cursor-pointer hover:bg-slate-100 transition-colors' : ''} ${
                      col.className || ''
                    }`}
                  >
                    <div
                      className={`inline-flex items-center gap-1 ${
                        col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : ''
                      }`}
                    >
                      <span>{col.header}</span>
                      {isSortable && (
                        <span className="text-slate-400 inline-flex flex-col">
                          {isCurrentSort ? (
                            sortDirection === 'asc' ? (
                              <ChevronUp className="w-3 h-3 text-blue-600" />
                            ) : (
                              <ChevronDown className="w-3 h-3 text-blue-600" />
                            )
                          ) : (
                            <ChevronDown className="w-3 h-3 opacity-40" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((row, index) => {
              const rowKey = row[keyField] || index;
              return (
                <tr
                  key={rowKey}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`hover:bg-blue-50/40 transition-colors ${
                    onRowClick ? 'cursor-pointer' : ''
                  }`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`${compact ? 'px-3 py-2' : 'px-4 py-2.5'} ${
                        col.align === 'right'
                          ? 'text-right'
                          : col.align === 'center'
                          ? 'text-center'
                          : 'text-left'
                      } ${col.cellClassName || ''}`}
                    >
                      {col.render ? col.render(row[col.key], row, index) : row[col.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DataTable;
