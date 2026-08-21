import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../../../components/common/AppShell.jsx';
import {
  apiGetPayoutAccounts,
  apiCreatePayoutAccount,
  apiDeletePayoutAccount,
} from '../../../api/walletService.js';
import {
  CreditCard,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Building2,
  PlusCircle,
  Trash2,
  ShieldCheck,
  X,
} from 'lucide-react';

export function EmployeePayoutAccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Add Account Modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    account_holder_name: '',
    bank_name: '',
    account_number: '',
    ifsc_code: '',
    account_type: 'SAVINGS',
  });
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  const loadAccounts = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiGetPayoutAccounts();
      setAccounts(res || []);
    } catch (err) {
      setError(err?.message || 'Failed to load bank accounts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setModalError('');
    if (!form.account_holder_name.trim() || !form.account_number.trim()) {
      setModalError('Account holder name and account number are required.');
      return;
    }

    try {
      setSubmitting(true);
      await apiCreatePayoutAccount(form);
      setShowModal(false);
      setForm({
        account_holder_name: '',
        bank_name: '',
        account_number: '',
        ifsc_code: '',
        account_type: 'SAVINGS',
      });
      setSuccessMsg('Bank account added successfully. Administration will verify it shortly.');
      setTimeout(() => setSuccessMsg(''), 4500);
      loadAccounts();
    } catch (err) {
      setModalError(err?.message || 'Failed to add bank account.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to remove this bank account?')) return;
    try {
      await apiDeletePayoutAccount(id);
      setSuccessMsg('Bank account removed.');
      setTimeout(() => setSuccessMsg(''), 4000);
      loadAccounts();
    } catch (err) {
      setError(err?.message || 'Failed to remove bank account.');
    }
  };

  return (
    <AppShell
      breadcrumbs={[
        { label: 'Home', href: '/workforce/employee/dashboard' },
        { label: 'My Wallet', href: '/workforce/employee/wallet' },
        { label: 'Bank Accounts' },
      ]}
    >
      <div className="space-y-5 max-w-5xl mx-auto">
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
              <CreditCard className="w-5 h-5 text-blue-600" />
              Payout Bank Accounts
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage your linked bank accounts for direct commission withdrawals.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadAccounts}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-md hover:bg-blue-700 active:scale-95 flex items-center gap-1.5 shadow-xs transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              Add Bank Account
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

        {/* Security Masking Notice */}
        <div className="enterprise-card p-4 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-600 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-slate-800">Secure Account Masking</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Full bank account numbers are submitted via encrypted transport and discarded immediately after extracting the last 4 digits.
            </p>
          </div>
        </div>

        {/* Accounts Grid */}
        <div className="space-y-3.5">
          {loading ? (
            <div className="py-14 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
              Loading bank accounts...
            </div>
          ) : accounts.length === 0 ? (
            <div className="enterprise-card rounded-lg border border-slate-200 bg-white p-10 text-center text-slate-400 text-xs space-y-3">
              <Building2 className="w-8 h-8 text-slate-300 mx-auto" />
              <div>
                <p className="font-bold text-slate-700 text-sm">No Bank Accounts Linked</p>
                <p className="text-slate-400 text-[11px] mt-0.5">Add a verified bank account to enable self-service payouts.</p>
              </div>
              <button
                onClick={() => setShowModal(true)}
                className="px-4 py-1.5 bg-blue-600 text-white font-bold rounded text-xs hover:bg-blue-700"
              >
                Add Bank Account
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {accounts.map((acc) => {
                const isVerified = acc.verification_status === 'VERIFIED';
                return (
                  <div
                    key={acc.id}
                    className="enterprise-card p-4 sm:p-5 rounded-lg border border-slate-200 bg-white shadow-xs space-y-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-blue-600" />
                        <span className="font-bold text-slate-900 text-sm">{acc.bank_name || 'Bank Account'}</span>
                      </div>
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                          isVerified
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        {acc.verification_status}
                      </span>
                    </div>

                    <div className="p-2.5 bg-slate-50 border border-slate-100 rounded space-y-0.5 font-mono">
                      <div className="text-slate-400 text-[10px]">Account Number</div>
                      <div className="font-bold text-slate-800 text-xs tracking-wider">
                        •••• •••• •••• {acc.account_number_last4}
                      </div>
                    </div>

                    <div className="space-y-1 text-[11px] text-slate-500">
                      <div className="flex justify-between">
                        <span>Account Holder:</span>
                        <span className="font-semibold text-slate-800">{acc.account_holder_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>IFSC Code:</span>
                        <span className="font-mono text-slate-700">{acc.ifsc_code || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Account Type:</span>
                        <span className="text-slate-700">{acc.account_type}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex justify-end">
                      <button
                        onClick={() => handleDelete(acc.id)}
                        className="text-rose-600 hover:text-rose-700 font-semibold text-[11px] flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Add Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  Add Bank Account
                </h3>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {modalError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded text-xs">
                  {modalError}
                </div>
              )}

              <form onSubmit={handleCreateSubmit} className="space-y-2.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-0.5">Account Holder Name *</label>
                  <input
                    type="text"
                    value={form.account_holder_name}
                    onChange={(e) => setForm({ ...form, account_holder_name: e.target.value })}
                    placeholder="As per bank passbook / statement"
                    required
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-0.5">Bank Name</label>
                  <input
                    type="text"
                    value={form.bank_name}
                    onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                    placeholder="e.g. State Bank of India, HDFC Bank"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-0.5">Account Number *</label>
                  <input
                    type="password"
                    value={form.account_number}
                    onChange={(e) => setForm({ ...form, account_number: e.target.value })}
                    placeholder="Full account number"
                    required
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-bold text-slate-700 mb-0.5">IFSC Code</label>
                    <input
                      type="text"
                      value={form.ifsc_code}
                      onChange={(e) => setForm({ ...form, ifsc_code: e.target.value.toUpperCase() })}
                      placeholder="e.g. SBIN0001234"
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-0.5">Account Type</label>
                    <select
                      value={form.account_type}
                      onChange={(e) => setForm({ ...form, account_type: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="SAVINGS">Savings</option>
                      <option value="CURRENT">Current</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-3.5 py-1.5 border border-slate-300 text-slate-700 font-bold rounded hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-1.5 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {submitting && <RefreshCw className="w-3 h-3 animate-spin" />}
                    Save Account
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
