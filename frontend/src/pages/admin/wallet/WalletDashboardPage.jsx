import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../../../components/common/AppShell.jsx';
import {
  apiAdminGetAllWallets,
  apiAdminGetAllWithdrawals,
  apiAdminFreezeWallet,
} from '../../../api/walletService.js';
import {
  Wallet,
  Users,
  Clock,
  TrendingUp,
  ArrowDownCircle,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Search,
  Building2,
  Lock,
  Unlock,
} from 'lucide-react';

function fmt(value) {
  const num = parseFloat(value || 0);
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(num);
}

export function WalletDashboardPage() {
  const [wallets, setWallets] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [walletsRes, wdRes] = await Promise.all([
        apiAdminGetAllWallets().catch(() => []),
        apiAdminGetAllWithdrawals().catch(() => []),
      ]);
      setWallets(walletsRes || []);
      setWithdrawals(wdRes || []);
    } catch (err) {
      setError(err?.message || 'Failed to load technician wallet data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleFreeze = async (wallet) => {
    const isCurrentlyActive = wallet.status === 'ACTIVE';
    const nextStatus = isCurrentlyActive ? 'LOCKED' : 'ACTIVE';
    const actionDesc = isCurrentlyActive ? 'Lock (pause payouts & credits)' : 'Unlock (restore normal operations)';
    
    if (!window.confirm(`Are you sure you want to ${actionDesc} for ${wallet.employee_name || 'this technician'}?`)) return;

    try {
      await apiAdminFreezeWallet(wallet.employee_id, nextStatus, `Admin toggle ${nextStatus}`);
      loadData();
    } catch (err) {
      alert(err?.message || 'Failed to update wallet status.');
    }
  };

  const filteredWallets = wallets.filter((w) => {
    const nameMatch = (w.employee_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                      String(w.employee_id).includes(searchTerm);
    const statusMatch = !statusFilter || w.status === statusFilter;
    return nameMatch && statusMatch;
  });

  const totalAvailable = wallets.reduce((acc, w) => acc + parseFloat(w.available_balance || 0), 0);
  const totalPending = wallets.reduce((acc, w) => acc + parseFloat(w.pending_balance || 0), 0);
  const totalWithdrawn = wallets.reduce((acc, w) => acc + parseFloat(w.total_withdrawn || 0), 0);
  const pendingWithdrawalCount = withdrawals.filter((w) => w.status === 'REQUESTED' || w.status === 'PROCESSING').length;

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Wallet className="w-6 h-6 text-blue-600" />
              Technician Wallets & Financial Oversight
            </h1>
            <p className="text-xs md:text-sm text-slate-500 mt-0.5">
              Monitor technician earnings (60% commission share), pending T+7 settlements, and payout disbursements.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
            <Link
              to="/workforce/admin/wallet/withdrawals"
              className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 active:scale-95 flex items-center gap-1.5 shadow-sm"
            >
              <ArrowDownCircle className="w-4 h-4" />
              Manage Payouts ({pendingWithdrawalCount})
            </Link>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800 flex items-center gap-2">
            <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Aggregate KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Technicians with Wallets</span>
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl md:text-3xl font-extrabold text-slate-900">
              {wallets.length}
            </div>
            <p className="text-[11px] text-slate-400">Total active employee wallets</p>
          </div>

          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Available Balances</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl md:text-3xl font-extrabold text-emerald-600 font-mono">
              {fmt(totalAvailable)}
            </div>
            <p className="text-[11px] text-slate-400">Withdrawable technician balances</p>
          </div>

          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Total in T+7 Hold</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl md:text-3xl font-extrabold text-slate-900 font-mono">
              {fmt(totalPending)}
            </div>
            <p className="text-[11px] text-slate-400">Pending settlement release</p>
          </div>

          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Disbursed</span>
              <TrendingUp className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-2xl md:text-3xl font-extrabold text-slate-900 font-mono">
              {fmt(totalWithdrawn)}
            </div>
            <p className="text-[11px] text-slate-400">Lifetime payouts to technicians</p>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-sm">
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search technician name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 focus:bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white text-xs outline-none"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="LOCKED">Locked</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>
        </div>

        {/* Technician Wallets Table */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
              Loading technician wallets...
            </div>
          ) : filteredWallets.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs space-y-2">
              <Users className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-600">No technician wallets found</p>
              <p className="text-[11px] text-slate-400">Wallets are automatically created when jobs are completed or technicians register.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Technician</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Available Balance</th>
                    <th className="py-3 px-4 text-right">Pending (T+7)</th>
                    <th className="py-3 px-4 text-right">Lifetime Earnings</th>
                    <th className="py-3 px-4 text-right">Total Withdrawn</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredWallets.map((w) => {
                    const isLocked = w.status !== 'ACTIVE';
                    return (
                      <tr key={w.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{w.employee_name || `Technician #${w.employee_id}`}</div>
                          <span className="text-[10px] text-slate-400 font-mono">Employee ID: {w.employee_id}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              w.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-red-50 text-red-700 border-red-200'
                            }`}
                          >
                            {w.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 text-sm">
                          {fmt(w.available_balance)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-600">
                          {fmt(w.pending_balance)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-900 font-bold">
                          {fmt(w.lifetime_earnings)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-500">
                          {fmt(w.total_withdrawn)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleToggleFreeze(w)}
                            className={`p-1.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1 transition-colors ${
                              isLocked
                                ? 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                                : 'border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-red-600'
                            }`}
                            title={isLocked ? 'Unlock Wallet' : 'Lock Wallet'}
                          >
                            {isLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                            <span>{isLocked ? 'Unlock' : 'Lock'}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
