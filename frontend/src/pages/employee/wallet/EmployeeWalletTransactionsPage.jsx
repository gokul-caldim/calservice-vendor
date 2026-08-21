import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../../../components/common/AppShell.jsx';
import { apiGetWalletTransactions, apiGetWalletTransactionDetail } from '../../../api/walletService.js';
import {
  ReceiptText,
  Filter,
  RefreshCw,
  AlertCircle,
  Clock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  ArrowLeft,
} from 'lucide-react';

function fmt(value) {
  const num = parseFloat(value || 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(num);
}

export function EmployeeWalletTransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Detail Modal
  const [selectedTxn, setSelectedTxn] = useState(null);

  const loadTransactions = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = { page };
      if (typeFilter) params.type = typeFilter;
      if (statusFilter) params.status = statusFilter;

      const res = await apiGetWalletTransactions(params);
      setTransactions(res.results || res || []);
      setCount(res.count || (res.results ? res.results.length : 0));
      setTotalPages(res.total_pages || 1);
    } catch (err) {
      setError(err?.message || 'Failed to load transaction ledger.');
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter, statusFilter]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const handleViewDetail = async (id) => {
    try {
      const res = await apiGetWalletTransactionDetail(id);
      setSelectedTxn(res);
    } catch (err) {
      setError('Could not load transaction detail.');
    }
  };

  return (
    <AppShell
      breadcrumbs={[
        { label: 'Home', href: '/workforce/employee/dashboard' },
        { label: 'My Wallet', href: '/workforce/employee/wallet' },
        { label: 'Ledger & Transactions' },
      ]}
    >
      <div className="space-y-5 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-lg border border-slate-200 shadow-xs">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link
                to="/workforce/employee/wallet"
                className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Wallet
              </Link>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <ReceiptText className="w-5 h-5 text-blue-600" />
              Financial Ledger & Transactions
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Immutable audit log of all commission earnings, T+7 releases, and withdrawal debits.
            </p>
          </div>

          <button
            onClick={loadTransactions}
            className="self-start sm:self-auto px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-wrap items-center gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-1.5 text-slate-500 font-bold">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter:</span>
          </div>

          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1 border border-slate-200 rounded-md bg-slate-50 focus:bg-white text-xs outline-none"
          >
            <option value="">All Transaction Types</option>
            <option value="SERVICE_EARNING">Service Earnings (60%)</option>
            <option value="SETTLEMENT_RELEASE">Settlement Release (T+7)</option>
            <option value="WITHDRAWAL">Withdrawals</option>
            <option value="WITHDRAWAL_REVERSAL">Withdrawal Reversals</option>
            <option value="ADJUSTMENT_CREDIT">Admin Credits</option>
            <option value="ADJUSTMENT_DEBIT">Admin Debits</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1 border border-slate-200 rounded-md bg-slate-50 focus:bg-white text-xs outline-none"
          >
            <option value="">All Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="PENDING_SETTLEMENT">Pending Settlement</option>
            <option value="REVERSED">Reversed</option>
          </select>

          {(typeFilter || statusFilter) && (
            <button
              onClick={() => {
                setTypeFilter('');
                setStatusFilter('');
                setPage(1);
              }}
              className="text-xs text-blue-600 hover:underline font-semibold ml-auto"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Table */}
        <div className="enterprise-card rounded-lg border border-slate-200 bg-white shadow-xs overflow-hidden">
          {loading ? (
            <div className="py-14 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
              Loading ledger records...
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-14 text-center text-slate-400 text-xs">
              No ledger records found matching your filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-right">Balance After</th>
                    <th className="py-3 px-4 text-center">Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {transactions.map((t) => {
                    const isCredit = t.direction === 'CREDIT';
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                          {new Date(t.created_at).toLocaleString('en-IN', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-slate-900 max-w-xs truncate">
                          {t.description || t.transaction_type}
                        </td>
                        <td className="py-2.5 px-4 text-[11px] text-slate-600 font-mono">
                          {t.transaction_type}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          {t.status === 'PENDING_SETTLEMENT' ? (
                            <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[10px]">
                              <Clock className="w-3 h-3" />
                              Pending (T+7)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded text-[10px]">
                              <CheckCircle2 className="w-3 h-3" />
                              {t.status}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold whitespace-nowrap">
                          <span className={isCredit ? 'text-emerald-600' : 'text-slate-900'}>
                            {isCredit ? '+' : '-'}{fmt(t.amount)}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-slate-500 whitespace-nowrap">
                          {fmt(t.balance_after)}
                          <span className="text-[10px] text-slate-400 ml-1">({t.balance_type})</span>
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <button
                            onClick={() => handleViewDetail(t.id)}
                            className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors"
                            title="View Transaction Audit Detail"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>
                Page {page} of {totalPages} ({count} total records)
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-2.5 py-1 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-2.5 py-1 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Audit Detail Modal */}
        {selectedTxn && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 space-y-3.5 text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ReceiptText className="w-4 h-4 text-blue-600" />
                  Ledger Transaction #{selectedTxn.id}
                </h3>
                <button onClick={() => setSelectedTxn(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 divide-y divide-slate-100">
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Description:</span>
                  <span className="font-bold text-slate-900 text-right">{selectedTxn.description || '—'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Transaction Type:</span>
                  <span className="font-mono font-bold text-slate-800">{selectedTxn.transaction_type}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Amount:</span>
                  <span className="font-mono font-bold text-sm text-slate-900">
                    {selectedTxn.direction === 'CREDIT' ? '+' : '-'}{fmt(selectedTxn.amount)}
                  </span>
                </div>
                {selectedTxn.gross_amount && (
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Gross Job Payment:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {fmt(selectedTxn.gross_amount)}
                    </span>
                  </div>
                )}
                {selectedTxn.earn_rate_snapshot && (
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Earn Rate Applied:</span>
                    <span className="font-mono font-bold text-blue-700">
                      {parseFloat(selectedTxn.earn_rate_snapshot) * 100}%
                    </span>
                  </div>
                )}
                {selectedTxn.platform_deduction_amount && (
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Company & GST Share:</span>
                    <span className="font-mono text-slate-600">
                      {fmt(selectedTxn.platform_deduction_amount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Balance Before → After:</span>
                  <span className="font-mono text-slate-700">
                    {fmt(selectedTxn.balance_before)} → {fmt(selectedTxn.balance_after)} ({selectedTxn.balance_type})
                  </span>
                </div>
                {selectedTxn.settlement_release_at && (
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">T+7 Release Date:</span>
                    <span className="font-semibold text-amber-700">
                      {new Date(selectedTxn.settlement_release_at).toLocaleDateString('en-IN')}
                    </span>
                  </div>
                )}
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Reference:</span>
                  <span className="font-mono text-[10px] text-slate-400">{selectedTxn.reference_type}:{selectedTxn.reference_id}</span>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setSelectedTxn(null)}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
