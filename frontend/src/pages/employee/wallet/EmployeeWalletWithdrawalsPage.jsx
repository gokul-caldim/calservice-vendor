import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../../../components/common/AppShell.jsx';
import {
  apiGetWalletWithdrawals,
  apiGetWalletSummary,
  apiGetPayoutAccounts,
  apiRequestWithdrawal,
  apiCancelWithdrawal,
} from '../../../api/walletService.js';
import { useAuth } from '../../../context/AuthProvider.jsx';
import {
  ArrowDownCircle,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Building2,
  XCircle,
  PlusCircle,
  X,
} from 'lucide-react';

function fmt(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(parseFloat(value || 0));
}

export function EmployeeWalletWithdrawalsPage() {
  const { registrationStatus } = useAuth();

  const [withdrawals, setWithdrawals] = useState([]);
  const [summary, setSummary] = useState(null);
  const [payoutAccounts, setPayoutAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Withdraw Modal
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');

  const isKycApproved = registrationStatus === 'approved';
  const verifiedAccounts = payoutAccounts.filter((a) => a.verification_status === 'VERIFIED');
  const availableNum = parseFloat(summary?.available_balance || '0');
  const canWithdraw = isKycApproved && verifiedAccounts.length > 0 && availableNum >= 5000;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [wRes, sumRes, accRes] = await Promise.all([
        apiGetWalletWithdrawals().catch(() => []),
        apiGetWalletSummary().catch(() => null),
        apiGetPayoutAccounts().catch(() => []),
      ]);
      setWithdrawals(wRes || []);
      setSummary(sumRes);
      setPayoutAccounts(accRes || []);
    } catch (err) {
      setError(err?.message || 'Failed to load withdrawals.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleWithdrawSubmit = async (e) => {
    e.preventDefault();
    setWithdrawError('');
    const amt = parseFloat(withdrawAmount);
    if (!amt || amt < 5000) {
      setWithdrawError('Minimum withdrawal amount is ₹5,000.');
      return;
    }
    if (amt > availableNum) {
      setWithdrawError(`Requested amount ₹${amt} exceeds available balance ₹${availableNum}.`);
      return;
    }

    try {
      setWithdrawSubmitting(true);
      await apiRequestWithdrawal({
        amount: withdrawAmount,
        payout_account_id: selectedAccountId ? parseInt(selectedAccountId, 10) : undefined,
      });
      setShowWithdrawModal(false);
      setWithdrawAmount('');
      setSuccessMsg('Withdrawal request submitted successfully! Administration will disburse payment to your bank.');
      setTimeout(() => setSuccessMsg(''), 4500);
      loadData();
    } catch (err) {
      setWithdrawError(err?.message || 'Withdrawal failed.');
    } finally {
      setWithdrawSubmitting(false);
    }
  };

  const handleCancelWithdrawal = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this withdrawal request? The funds will immediately return to your available balance.')) return;
    try {
      await apiCancelWithdrawal(id);
      setSuccessMsg('Withdrawal request cancelled successfully.');
      setTimeout(() => setSuccessMsg(''), 4000);
      loadData();
    } catch (err) {
      setError(err?.message || 'Failed to cancel withdrawal.');
    }
  };

  const statusConfig = {
    REQUESTED: {
      label: 'Requested',
      color: 'bg-amber-50 text-amber-800 border-amber-200',
      icon: Clock,
      desc: 'Submitted by technician. Queued for bank payout processing.',
    },
    PROCESSING: {
      label: 'Processing',
      color: 'bg-blue-50 text-blue-800 border-blue-200',
      icon: RefreshCw,
      desc: 'Disbursement initiated to bank account.',
    },
    COMPLETED: {
      label: 'Completed',
      color: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      icon: CheckCircle2,
      desc: 'Funds transferred to bank account.',
    },
    FAILED: {
      label: 'Failed',
      color: 'bg-rose-50 text-rose-800 border-rose-200',
      icon: XCircle,
      desc: 'Bank transfer failed. Funds returned to available balance.',
    },
    CANCELLED: {
      label: 'Cancelled',
      color: 'bg-slate-100 text-slate-700 border-slate-200',
      icon: XCircle,
      desc: 'Cancelled by technician. Funds returned to available balance.',
    },
  };

  return (
    <AppShell
      breadcrumbs={[
        { label: 'Home', href: '/workforce/employee/dashboard' },
        { label: 'My Wallet', href: '/workforce/employee/wallet' },
        { label: 'Withdrawals & Payouts' },
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
              <ArrowDownCircle className="w-5 h-5 text-blue-600" />
              Payouts & Withdrawals
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Track payout disbursement status or request a new direct bank withdrawal.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
            <button
              onClick={() => setShowWithdrawModal(true)}
              disabled={!canWithdraw}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-md flex items-center gap-1.5 shadow-xs transition-all ${
                canWithdraw
                  ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
                  : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              New Payout Request
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Balance Card */}
        <div className="enterprise-card p-4 sm:p-5 rounded-lg border border-slate-200 bg-white shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Available for Payout</span>
            <div className="text-2xl font-bold text-slate-900 font-mono mt-0.5">
              {fmt(availableNum)}
            </div>
          </div>
          <div className="text-xs text-slate-500 sm:text-right">
            <p>Minimum payout threshold: <strong className="text-slate-800">₹5,000 INR</strong></p>
            <p className="text-[11px] text-slate-400 mt-0.5">Direct NEFT/IMPS transfer to verified bank accounts</p>
          </div>
        </div>

        {/* Withdrawals List */}
        <div className="space-y-3.5">
          {loading ? (
            <div className="py-14 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
              Loading withdrawal records...
            </div>
          ) : withdrawals.length === 0 ? (
            <div className="enterprise-card rounded-lg border border-slate-200 bg-white p-10 text-center text-slate-400 text-xs space-y-2">
              <ArrowDownCircle className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-600">No withdrawal requests recorded</p>
              <p className="text-[11px] text-slate-400">When your balance reaches ₹5,000, you can request payouts directly here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {withdrawals.map((w) => {
                const cfg = statusConfig[w.status] || {
                  label: w.status,
                  color: 'bg-slate-100 text-slate-700 border-slate-200',
                  icon: Clock,
                  desc: '',
                };
                const StatusIcon = cfg.icon;

                return (
                  <div
                    key={w.id}
                    className="enterprise-card p-4 sm:p-5 rounded-lg border border-slate-200 bg-white shadow-xs space-y-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-mono text-slate-400">Request #{w.id}</span>
                        <div className="text-lg font-bold font-mono text-slate-900">
                          {fmt(w.amount)}
                        </div>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1.5 ${cfg.color}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {cfg.label}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500">{cfg.desc}</p>

                    <div className="p-2.5 rounded-md bg-slate-50 border border-slate-100 space-y-1 text-[11px]">
                      {w.payout_account_display && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Bank Account:</span>
                          <span className="font-semibold text-slate-800">
                            {w.payout_account_display.bank_name} (****{w.payout_account_display.account_number_last4})
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-slate-500">Requested:</span>
                        <span className="text-slate-700">
                          {new Date(w.requested_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                      </div>
                      {w.completed_at && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Completed:</span>
                          <span className="font-semibold text-emerald-700">
                            {new Date(w.completed_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                        </div>
                      )}
                      {w.bank_transaction_id && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Bank UTR / Txn ID:</span>
                          <span className="font-mono font-bold text-slate-900">{w.bank_transaction_id}</span>
                        </div>
                      )}
                      {w.failure_reason && (
                        <div className="text-rose-700 font-semibold pt-1 border-t border-slate-200">
                          Reason: {w.failure_reason}
                        </div>
                      )}
                    </div>

                    {w.status === 'REQUESTED' && (
                      <div className="pt-1 flex justify-end">
                        <button
                          onClick={() => handleCancelWithdrawal(w.id)}
                          className="px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded transition-colors"
                        >
                          Cancel Request
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Withdraw Modal */}
        {showWithdrawModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ArrowDownCircle className="w-4 h-4 text-blue-600" />
                  Request Direct Payout
                </h3>
                <button
                  onClick={() => setShowWithdrawModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {withdrawError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded text-xs">
                  {withdrawError}
                </div>
              )}

              <form onSubmit={handleWithdrawSubmit} className="space-y-3 text-xs">
                <div className="bg-slate-50 p-2.5 rounded border border-slate-200 flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Available Balance:</span>
                  <span className="font-bold text-sm text-slate-900 font-mono">
                    {fmt(availableNum)}
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Withdrawal Amount (₹ INR) *
                  </label>
                  <input
                    type="number"
                    min="5000"
                    step="1"
                    max={availableNum}
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="Min. 5000"
                    required
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Minimum payout is ₹5,000.</p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Destination Bank Account *
                  </label>
                  <select
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {verifiedAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.bank_name} (****{acc.account_number_last4}) — {acc.account_holder_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-2 flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowWithdrawModal(false)}
                    className="px-3.5 py-1.5 border border-slate-300 text-slate-700 font-bold rounded hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={withdrawSubmitting}
                    className="px-4 py-1.5 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {withdrawSubmitting && <RefreshCw className="w-3 h-3 animate-spin" />}
                    Confirm Withdrawal
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
