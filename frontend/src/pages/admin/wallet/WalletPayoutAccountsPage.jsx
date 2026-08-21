import React, { useEffect, useState, useRef } from 'react';
import { AppShell } from '../../../components/common/AppShell.jsx';
import { LoadingState } from '../../../components/enterprise/LoadingState.jsx';
import {
  apiGetPayoutAccounts, apiCreatePayoutAccount, apiDeletePayoutAccount,
} from '../../../api/walletService.js';
import { Plus, Trash2, Star, X, AlertTriangle, CreditCard } from 'lucide-react';

function AddAccountModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({
    account_holder_name: '',
    bank_name: '',
    account_number: '',
    ifsc_code: '',
    account_type: 'SAVINGS',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const update = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const submit = async () => {
    if (!form.account_holder_name.trim()) { setError('Account holder name is required.'); return; }
    if (!form.account_number.trim() || form.account_number.trim().length < 4) {
      setError('Valid account number required (minimum 4 digits).');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      await apiCreatePayoutAccount(form);
      onSuccess();
    } catch (err) {
      setError(err?.data?.error || err?.data?.details
        ? JSON.stringify(err.data.details)
        : 'Failed to add account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800">Add Bank Account</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-400"><X size={14} /></button>
        </div>
        <div className="p-4 space-y-3">
          {error && (
            <div className="enterprise-card border-red-200 bg-red-50 p-2 text-xs text-red-700 flex items-center gap-1">
              <AlertTriangle size={12} className="shrink-0" /> {error}
            </div>
          )}

          <div className="enterprise-card bg-slate-50 p-2">
            <p className="text-[10px] text-slate-500">
              <strong>Security:</strong> Only the last 4 digits of your account number are stored. The full number is never retained.
            </p>
          </div>

          {[
            ['Account Holder Name *', 'account_holder_name', 'text', 'e.g. Rajesh Kumar'],
            ['Bank Name', 'bank_name', 'text', 'e.g. HDFC Bank'],
            ['Account Number *', 'account_number', 'text', 'Full account number (last 4 stored only)'],
            ['IFSC Code', 'ifsc_code', 'text', 'e.g. HDFC0001234'],
          ].map(([label, key, type, placeholder]) => (
            <div key={key}>
              <label className="text-xs font-semibold text-slate-600 block mb-1">{label}</label>
              <input
                type={type}
                placeholder={placeholder}
                className="w-full px-3 py-1.5 text-xs rounded border border-slate-300"
                value={form[key]}
                onChange={update(key)}
              />
            </div>
          ))}

          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Account Type</label>
            <select
              className="w-full px-3 py-1.5 text-xs rounded border border-slate-300"
              value={form.account_type}
              onChange={update('account_type')}
            >
              <option value="SAVINGS">Savings</option>
              <option value="CURRENT">Current</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-slate-100">
          <button onClick={onClose} className="px-3 py-1.5 text-xs rounded border border-slate-200 hover:bg-slate-50">Cancel</button>
          <button
            onClick={submit}
            disabled={loading}
            className="px-4 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? 'Adding…' : 'Add Account'}
          </button>
        </div>
      </div>
    </div>
  );
}

const VERIFICATION_COLORS = {
  PENDING: 'bg-amber-100 text-amber-700',
  VERIFIED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-700',
};

export function WalletPayoutAccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const fetchedRef = useRef(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiGetPayoutAccounts();
      setAccounts(Array.isArray(data) ? data : []);
    } catch {
      setError('Failed to load payout accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    loadData();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Deactivate this bank account? It will no longer be available for withdrawals.')) return;
    try {
      setDeleting(id);
      await apiDeletePayoutAccount(id);
      fetchedRef.current = false;
      loadData();
    } catch (err) {
      alert(err?.data?.error || 'Failed to remove account. It may be referenced by an active withdrawal.');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Bank Accounts</h1>
            <p className="text-xs text-slate-500 mt-0.5">Payout accounts for withdrawal disbursement</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <Plus size={12} /> Add Account
          </button>
        </div>

        {error && (
          <div className="enterprise-card border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>
        )}

        {loading ? (
          <div className="enterprise-card p-8"><LoadingState /></div>
        ) : accounts.length === 0 ? (
          <div className="enterprise-card p-8 text-center">
            <CreditCard size={28} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-600">No bank accounts added</p>
            <p className="text-xs text-slate-400 mt-1">Add a bank account to enable withdrawal disbursement.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.map((acct) => (
              <div key={acct.id} className="enterprise-card p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <CreditCard size={16} className="text-slate-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-800">{acct.bank_name || 'Bank Account'}</p>
                      {acct.is_primary && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                          <Star size={8} /> PRIMARY
                        </span>
                      )}
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${VERIFICATION_COLORS[acct.verification_status] || 'bg-slate-100 text-slate-500'}`}>
                        {acct.verification_status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {acct.account_holder_name} · ****{acct.account_number_last4} · {acct.account_type}
                    </p>
                    {acct.ifsc_code && (
                      <p className="text-[10px] text-slate-400 mt-0.5">IFSC: {acct.ifsc_code}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(acct.id)}
                  disabled={deleting === acct.id}
                  className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                  title="Deactivate account"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="enterprise-card bg-slate-50 p-3">
          <p className="text-xs text-slate-500">
            <strong>Security:</strong> Full account numbers are never stored in our system.
            Only the last 4 digits are displayed for identification.
            Newly added accounts are pending admin verification before they can be used for withdrawals.
          </p>
        </div>

        {showAdd && (
          <AddAccountModal
            onClose={() => setShowAdd(false)}
            onSuccess={() => {
              setShowAdd(false);
              fetchedRef.current = false;
              loadData();
            }}
          />
        )}
      </div>
    </AppShell>
  );
}
