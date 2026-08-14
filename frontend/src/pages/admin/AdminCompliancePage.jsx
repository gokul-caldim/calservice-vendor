import React, { useEffect, useState } from 'react';
import { AppShell } from '../../components/common/AppShell.jsx';
import { StatusBadge } from '../../components/enterprise/StatusBadge.jsx';
import {
  apiGetComplianceRequirements,
  apiCreateComplianceRequirement,
  apiGetComplianceRecords,
} from '../../api/workforceService.js';
import { ShieldCheck, PlusCircle, AlertCircle, CheckCircle } from 'lucide-react';

export function AdminCompliancePage() {
  const [requirements, setRequirements] = useState([]);
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [formData, setFormData] = useState({
    title: '',
    is_mandatory: true,
    validity_days: 365,
    description: '',
  });

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [reqs, recs] = await Promise.all([
        apiGetComplianceRequirements().catch(() => []),
        apiGetComplianceRecords().catch(() => []),
      ]);
      setRequirements(reqs || []);
      setRecords(recs || []);
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to load compliance data.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateRequirement = async (e) => {
    e.preventDefault();
    try {
      setStatusMsg({ type: '', text: '' });
      await apiCreateComplianceRequirement(formData);
      setStatusMsg({ type: 'success', text: `Compliance requirement '${formData.title}' created.` });
      setShowCreateModal(false);
      setFormData({ title: '', is_mandatory: true, validity_days: 365, description: '' });
      await loadData();
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to create requirement.' });
    }
  };

  return (
    <AppShell breadcrumbs={[{ label: 'Home', to: '/workforce/admin' }, { label: 'Compliance & Safety' }]}>
      <div className="space-y-4">
        {/* Top Header */}
        <div className="bg-white border border-slate-200 p-4 rounded flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              Workforce Compliance &amp; Document Expirations
            </h1>
            <p className="text-xs text-slate-500">
              Monitor mandatory document expirations, verification statuses, and compliance requirements.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-colors flex items-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Compliance Requirement</span>
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

        {/* Mandatory Requirements Section */}
        <div className="bg-white border border-slate-200 rounded p-4 space-y-3">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Active Compliance Requirements ({requirements.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {requirements.map((r) => (
              <div key={r.id} className="p-3 border border-slate-200 rounded bg-slate-50 space-y-1 text-xs">
                <div className="font-bold text-slate-900 flex items-center justify-between">
                  <span>{r.title}</span>
                  {r.is_mandatory ? (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-rose-100 text-rose-800">Mandatory</span>
                  ) : (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-200 text-slate-700">Optional</span>
                  )}
                </div>
                <p className="text-slate-500 text-[11px]">Validity: {r.validity_days} days</p>
              </div>
            ))}
          </div>
        </div>

        {/* Employee Compliance Records Table */}
        <div className="bg-white border border-slate-200 rounded overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase">
              <tr>
                <th className="px-4 py-2.5">Technician</th>
                <th className="px-4 py-2.5">Requirement</th>
                <th className="px-4 py-2.5">Document #</th>
                <th className="px-4 py-2.5">Issue Date</th>
                <th className="px-4 py-2.5">Expiry Date</th>
                <th className="px-4 py-2.5 text-right">Compliance Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.length > 0 ? (
                records.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-bold text-slate-900">
                      {rec.employee_name}
                      <span className="block text-[10px] text-slate-500 font-mono font-normal">{rec.employee_id}</span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{rec.requirement_title}</td>
                    <td className="px-4 py-3 font-mono text-slate-700">{rec.document_number || '—'}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">{rec.issue_date || '—'}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">{rec.expiry_date || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <StatusBadge status={rec.status} size="xs" />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No compliance records registered yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Modal: Create Requirement */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="bg-white rounded p-5 max-w-md w-full space-y-4 shadow-xl border border-slate-200">
              <h2 className="text-sm font-bold text-slate-900">Add New Compliance Requirement</h2>
              <form onSubmit={handleCreateRequirement} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Requirement Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Electrical Safety License"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Validity (Days)</label>
                    <input
                      type="number"
                      required
                      value={formData.validity_days}
                      onChange={(e) => setFormData({ ...formData, validity_days: parseInt(e.target.value) })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded"
                    />
                  </div>
                  <div className="flex items-center pt-5">
                    <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={formData.is_mandatory}
                        onChange={(e) => setFormData({ ...formData, is_mandatory: e.target.checked })}
                        className="rounded text-blue-600"
                      />
                      <span>Mandatory Requirement</span>
                    </label>
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
                    Create Requirement
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

export default AdminCompliancePage;
