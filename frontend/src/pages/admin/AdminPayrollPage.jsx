import React, { useEffect, useState } from 'react';
import { AppShell } from '../../components/common/AppShell.jsx';
import { StatusBadge } from '../../components/enterprise/StatusBadge.jsx';
import {
  apiGetPayPeriods,
  apiCreatePayPeriod,
  apiProcessPayroll,
} from '../../api/workforceService.js';
import { DollarSign, Play, CheckCircle, PlusCircle, AlertCircle } from 'lucide-react';

export function AdminPayrollPage() {
  const [payPeriods, setPayPeriods] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [formData, setFormData] = useState({
    name: '',
    start_date: '',
    end_date: '',
  });

  const loadData = async () => {
    try {
      setIsLoading(true);
      const data = await apiGetPayPeriods();
      setPayPeriods(data || []);
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to load pay periods.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreatePeriod = async (e) => {
    e.preventDefault();
    try {
      setStatusMsg({ type: '', text: '' });
      await apiCreatePayPeriod(formData);
      setStatusMsg({ type: 'success', text: `Pay period '${formData.name}' created.` });
      setShowCreateModal(false);
      setFormData({ name: '', start_date: '', end_date: '' });
      await loadData();
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to create pay period.' });
    }
  };

  const handleProcessPayroll = async (periodId) => {
    try {
      setStatusMsg({ type: '', text: '' });
      await apiProcessPayroll(periodId, 'process');
      setStatusMsg({ type: 'success', text: 'Payroll processing completed.' });
      await loadData();
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Payroll processing failed.' });
    }
  };

  const handleAdvanceStatus = async (periodId, targetStatus) => {
    try {
      setStatusMsg({ type: '', text: '' });
      await apiProcessPayroll(periodId, 'advance_status', targetStatus);
      setStatusMsg({ type: 'success', text: `Pay period status updated to ${targetStatus}.` });
      await loadData();
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Action failed.' });
    }
  };

  return (
    <AppShell breadcrumbs={[{ label: 'Home', to: '/workforce/admin' }, { label: 'Payroll Management' }]}>
      <div className="space-y-4">
        {/* Top Header */}
        <div className="bg-white border border-slate-200 p-4 rounded flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              Workforce Payroll Management
            </h1>
            <p className="text-xs text-slate-500">
              Manage pay cycles, process calculations from shift attendance and job earnings, and publish payslips.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-colors flex items-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Pay Cycle</span>
          </button>
        </div>

        {statusMsg.text && (
          <div
            className={`p-3 rounded text-xs font-semibold flex items-center gap-2 ${
              statusMsg.type === 'error' ? 'bg-rose-50 text-rose-800 border border-rose-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            }`}
          >
            {statusMsg.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Table of Pay Periods */}
        <div className="bg-white border border-slate-200 rounded overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase">
              <tr>
                <th className="px-4 py-2.5">Pay Period</th>
                <th className="px-4 py-2.5">Start Date</th>
                <th className="px-4 py-2.5">End Date</th>
                <th className="px-4 py-2.5">Payslips Count</th>
                <th className="px-4 py-2.5">Total Net Pay</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Lifecycle Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payPeriods.length > 0 ? (
                payPeriods.map((period) => (
                  <tr key={period.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-bold text-slate-900">{period.name}</td>
                    <td className="px-4 py-3 font-mono text-slate-700">{period.start_date}</td>
                    <td className="px-4 py-3 font-mono text-slate-700">{period.end_date}</td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-800">{period.payslip_count}</td>
                    <td className="px-4 py-3 font-mono font-bold text-emerald-700">₹{period.total_net_pay}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={period.status} size="xs" />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {period.status === 'DRAFT' && (
                          <button
                            type="button"
                            onClick={() => handleProcessPayroll(period.id)}
                            className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] flex items-center gap-1"
                          >
                            <Play className="w-3 h-3" />
                            Process Calculations
                          </button>
                        )}

                        {period.status === 'PROCESSING' && (
                          <button
                            type="button"
                            onClick={() => handleAdvanceStatus(period.id, 'REVIEW')}
                            className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px]"
                          >
                            Submit for Review
                          </button>
                        )}

                        {period.status === 'REVIEW' && (
                          <button
                            type="button"
                            onClick={() => handleAdvanceStatus(period.id, 'APPROVED')}
                            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px]"
                          >
                            Approve Cycle
                          </button>
                        )}

                        {period.status === 'APPROVED' && (
                          <button
                            type="button"
                            onClick={() => handleAdvanceStatus(period.id, 'PAID')}
                            className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px]"
                          >
                            Publish &amp; Pay
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No payroll cycles created yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Modal: Create Pay Period */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="bg-white rounded p-5 max-w-md w-full space-y-4 shadow-xl border border-slate-200">
              <h2 className="text-sm font-bold text-slate-900">Create New Pay Cycle</h2>
              <form onSubmit={handleCreatePeriod} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cycle Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. August 2026 Shift Cycle"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      required
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">End Date</label>
                    <input
                      type="date"
                      required
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold">
                    Create Pay Period
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

export default AdminPayrollPage;
