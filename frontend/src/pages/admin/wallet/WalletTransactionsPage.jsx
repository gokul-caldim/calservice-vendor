import React, { useEffect, useState, useRef, useCallback } from 'react';
import { AppShell } from '../../../components/common/AppShell.jsx';
import { LoadingState } from '../../../components/enterprise/LoadingState.jsx';
import { apiGetWalletTransactions } from '../../../api/walletService.js';
import { RefreshCw, ChevronLeft, ChevronRight, Search, Filter, X } from 'lucide-react';

function fmt(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', minimumFractionDigits: 2,
  }).format(parseFloat(value || 0));
}

const TXN_TYPES = [
  '', 'SERVICE_EARNING', 'PLATFORM_COMMISSION', 'REFUND', 'RECOVERY_DEBIT',
  'WITHDRAWAL', 'ADJUSTMENT_CREDIT', 'ADJUSTMENT_DEBIT', 'SETTLEMENT_RELEASE',
];
const DIRECTIONS = ['', 'CREDIT', 'DEBIT'];
const STATUSES = ['', 'COMPLETED', 'PENDING_SETTLEMENT', 'REVERSED', 'FAILED'];

function DetailModal({ txn, onClose }) {
  if (!txn) return null;
  const rows = [
    ['ID', txn.id],
    ['Reference Type', txn.reference_type],
    ['Reference ID', txn.reference_id],
    ['Type', txn.transaction_type],
    ['Direction', txn.direction],
    ['Amount', fmt(txn.amount)],
    ['Gross Amount', txn.gross_amount ? fmt(txn.gross_amount) : '—'],
    ['Commission Rate', txn.commission_rate_snapshot ? `${(txn.commission_rate_snapshot * 100).toFixed(2)}%` : '—'],
    ['Commission Amount', txn.commission_amount ? fmt(txn.commission_amount) : '—'],
    ['Balance Before', fmt(txn.balance_before)],
    ['Balance After', fmt(txn.balance_after)],
    ['Balance Type', txn.balance_type],
    ['Status', txn.status],
    ['Settlement Release', txn.settlement_release_at ? new Date(txn.settlement_release_at).toLocaleString('en-IN') : '—'],
    ['Released At', txn.released_at ? new Date(txn.released_at).toLocaleString('en-IN') : '—'],
    ['Service Request ID', txn.service_request_id || '—'],
    ['Payment ID', txn.job_payment_id || '—'],
    ['Description', txn.description || '—'],
    ['Created At', new Date(txn.created_at).toLocaleString('en-IN')],
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800">Transaction Detail — #{txn.id}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-400"><X size={14} /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-4">
          <table className="w-full text-xs">
            <tbody>
              {rows.map(([label, val]) => (
                <tr key={label} className="border-b border-slate-50">
                  <td className="py-1.5 pr-4 font-semibold text-slate-500 w-40 shrink-0">{label}</td>
                  <td className="py-1.5 text-slate-800 break-all">{val}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {txn.metadata && Object.keys(txn.metadata).length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Metadata</p>
              <pre className="text-[10px] bg-slate-50 rounded p-2 overflow-x-auto text-slate-700">
                {JSON.stringify(txn.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function WalletTransactionsPage() {
  const [data, setData] = useState({ results: [], count: 0, page: 1, total_pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState({
    page: 1, page_size: 20,
    type: '', direction: '', status: '',
    date_from: '', date_to: '', search: '',
  });

  const fetchedRef = useRef(false);

  const loadData = useCallback(async (f = filters) => {
    try {
      setLoading(true);
      setError(null);
      const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ''));
      const result = await apiGetWalletTransactions(params);
      setData(result || { results: [], count: 0, page: 1, total_pages: 1 });
    } catch {
      setError('Failed to load transactions.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    loadData();
  }, []);

  const applyFilters = () => {
    const newFilters = { ...filters, page: 1 };
    setFilters(newFilters);
    loadData(newFilters);
  };

  const changePage = (p) => {
    const newFilters = { ...filters, page: p };
    setFilters(newFilters);
    loadData(newFilters);
  };

  const clearFilters = () => {
    const reset = { page: 1, page_size: 20, type: '', direction: '', status: '', date_from: '', date_to: '', search: '' };
    setFilters(reset);
    loadData(reset);
  };

  const hasFilters = filters.type || filters.direction || filters.status || filters.date_from || filters.date_to || filters.search;

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Transaction Ledger</h1>
            <p className="text-xs text-slate-500 mt-0.5">{data.count} total records · immutable audit trail</p>
          </div>
          <button onClick={() => loadData()} className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100">
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Filters */}
        <div className="enterprise-card p-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search description / ref…"
                className="w-full pl-6 pr-2 py-1.5 text-xs rounded border border-slate-200"
                value={filters.search}
                onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
              />
            </div>
            <select
              className="text-xs rounded border border-slate-200 py-1.5 px-2"
              value={filters.type}
              onChange={(e) => setFilters(f => ({ ...f, type: e.target.value }))}
            >
              {TXN_TYPES.map(t => <option key={t} value={t}>{t || 'All Types'}</option>)}
            </select>
            <select
              className="text-xs rounded border border-slate-200 py-1.5 px-2"
              value={filters.direction}
              onChange={(e) => setFilters(f => ({ ...f, direction: e.target.value }))}
            >
              {DIRECTIONS.map(d => <option key={d} value={d}>{d || 'All Directions'}</option>)}
            </select>
            <select
              className="text-xs rounded border border-slate-200 py-1.5 px-2"
              value={filters.status}
              onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}
            >
              {STATUSES.map(s => <option key={s} value={s}>{s?.replace('_', ' ') || 'All Statuses'}</option>)}
            </select>
            <input
              type="date"
              className="text-xs rounded border border-slate-200 py-1.5 px-2"
              value={filters.date_from}
              onChange={(e) => setFilters(f => ({ ...f, date_from: e.target.value }))}
              title="From date"
            />
            <input
              type="date"
              className="text-xs rounded border border-slate-200 py-1.5 px-2"
              value={filters.date_to}
              onChange={(e) => setFilters(f => ({ ...f, date_to: e.target.value }))}
              title="To date"
            />
            <button
              onClick={applyFilters}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              <Filter size={10} /> Apply
            </button>
            {hasFilters && (
              <button onClick={clearFilters} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
                <X size={10} /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="enterprise-card border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>
        )}

        {/* Table */}
        <div className="enterprise-card overflow-hidden">
          {loading ? (
            <div className="p-8"><LoadingState /></div>
          ) : data.results.length === 0 ? (
            <p className="text-xs text-slate-400 p-6 text-center">No transactions found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="table-header">
                    <th className="px-3 py-2 text-left">ID</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-left">Dir</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2 text-right">Balance After</th>
                    <th className="px-3 py-2 text-left">Balance</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((txn) => (
                    <tr key={txn.id} className="table-row cursor-pointer" onClick={() => setSelected(txn)}>
                      <td className="px-3 py-2 text-slate-400 font-mono">#{txn.id}</td>
                      <td className="px-3 py-2 font-medium text-slate-700 max-w-[140px] truncate">
                        {txn.transaction_type?.replace(/_/g, ' ')}
                      </td>
                      <td className="px-3 py-2">
                        {txn.direction === 'CREDIT'
                          ? <span className="text-emerald-600 font-bold">↑</span>
                          : <span className="text-red-500 font-bold">↓</span>}
                      </td>
                      <td className={`px-3 py-2 text-right font-mono font-semibold ${txn.direction === 'CREDIT' ? 'text-emerald-700' : 'text-red-600'}`}>
                        {txn.direction === 'CREDIT' ? '+' : '−'}{fmt(txn.amount)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-700">{fmt(txn.balance_after)}</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                          txn.balance_type === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                        }`}>{txn.balance_type}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                          txn.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                          txn.status === 'PENDING_SETTLEMENT' ? 'bg-amber-100 text-amber-700' :
                          txn.status === 'REVERSED' ? 'bg-red-100 text-red-600' :
                          'bg-slate-100 text-slate-500'
                        }`}>{txn.status?.replace('_', ' ')}</span>
                      </td>
                      <td className="px-3 py-2 text-slate-400">{new Date(txn.created_at).toLocaleDateString('en-IN')}</td>
                      <td className="px-3 py-2 text-blue-500 text-[10px]">Details</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {data.total_pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                Page {data.page} of {data.total_pages} · {data.count} records
              </p>
              <div className="flex gap-1">
                <button
                  disabled={data.page <= 1}
                  onClick={() => changePage(data.page - 1)}
                  className="p-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                >
                  <ChevronLeft size={12} />
                </button>
                <button
                  disabled={data.page >= data.total_pages}
                  onClick={() => changePage(data.page + 1)}
                  className="p-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                >
                  <ChevronRight size={12} />
                </button>
              </div>
            </div>
          )}
        </div>

        {selected && <DetailModal txn={selected} onClose={() => setSelected(null)} />}
      </div>
    </AppShell>
  );
}
