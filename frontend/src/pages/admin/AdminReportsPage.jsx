import React, { useEffect, useState } from 'react';
import { AppShell } from '../../components/common/AppShell.jsx';
import { apiGetReport } from '../../api/workforceService.js';
import { BarChart3, Download, Filter, RefreshCw, FileText } from 'lucide-react';

export function AdminReportsPage() {
  const [reportType, setReportType] = useState('employee');
  const [reportData, setReportData] = useState({ total_records: 0, rows: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    service: '',
    status: '',
  });

  const loadReport = async () => {
    try {
      setIsLoading(true);
      const res = await apiGetReport(reportType, filters);
      setReportData(res || { total_records: 0, rows: [] });
    } catch (_) {
      setReportData({ total_records: 0, rows: [] });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [reportType]);

  const handleExportCSV = () => {
    if (!reportData.rows || reportData.rows.length === 0) return;
    const headers = Object.keys(reportData.rows[0]).join(',');
    const rows = reportData.rows.map((r) => Object.values(r).map((v) => `"${v}"`).join(','));
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `workforce_${reportType}_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AppShell breadcrumbs={[{ label: 'Home', to: '/workforce/admin' }, { label: 'Reports & Analytics' }]}>
      <div className="space-y-4">
        {/* Top Header */}
        <div className="bg-white border border-slate-200 p-4 rounded flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              Workforce Enterprise Reporting Suite
            </h1>
            <p className="text-xs text-slate-500">
              Query real database aggregations with multi-dimensional filtering across workforce operations.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={!reportData.rows || reportData.rows.length === 0}
            className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>

        {/* Report Selector Tabs & Filter Bar */}
        <div className="bg-white border border-slate-200 rounded p-4 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto text-xs">
            {[
              { id: 'employee', label: 'Employee Roster' },
              { id: 'job', label: 'Field Jobs' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setReportType(t.id)}
                className={`px-3 py-1.5 rounded font-bold transition-colors ${
                  reportType === t.id ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Filter Controls */}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1 text-slate-600 font-semibold">
              <Filter className="w-3.5 h-3.5" />
              <span>Filters:</span>
            </div>
            {reportType === 'job' && (
              <input
                type="text"
                placeholder="Service Category Filter..."
                value={filters.service}
                onChange={(e) => setFilters({ ...filters, service: e.target.value })}
                className="px-2.5 py-1 border border-slate-300 rounded text-xs"
              />
            )}
            <input
              type="text"
              placeholder="Status Filter..."
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="px-2.5 py-1 border border-slate-300 rounded text-xs"
            />
            <button
              type="button"
              onClick={loadReport}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded flex items-center gap-1 shadow-sm"
            >
              <RefreshCw className="w-3 h-3" />
              Apply Query
            </button>
          </div>
        </div>

        {/* Dynamic Report Results Table */}
        <div className="bg-white border border-slate-200 rounded overflow-hidden">
          <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-800 uppercase tracking-wider">
              {reportType.toUpperCase()} REPORT RESULTS ({reportData.total_records} RECORDS)
            </span>
            <span className="font-mono text-slate-500">System Report</span>
          </div>

          <table className="w-full text-left text-xs">
            {reportData.rows && reportData.rows.length > 0 ? (
              <>
                <thead className="bg-slate-100 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase">
                  <tr>
                    {Object.keys(reportData.rows[0]).map((col) => (
                      <th key={col} className="px-4 py-2.5">
                        {col.replace('_', ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      {Object.values(row).map((val, cIdx) => (
                        <td key={cIdx} className="px-4 py-3 font-mono text-slate-800">
                          {val === true ? 'Yes' : val === false ? 'No' : String(val ?? '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </>
            ) : (
              <tbody>
                <tr>
                  <td className="px-4 py-12 text-center text-slate-500 text-xs">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    No matching records found for this query filter.
                  </td>
                </tr>
              </tbody>
            )}
          </table>
        </div>
      </div>
    </AppShell>
  );
}

export default AdminReportsPage;
