import React, { useEffect, useState } from 'react';
import { AppShell } from '../../components/common/AppShell.jsx';
import { StatusBadge } from '../../components/enterprise/StatusBadge.jsx';
import { apiGetLeaves, apiAdminDecideLeave } from '../../api/workforceService.js';
import { CalendarDays, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

export function AdminLeavePage() {
  const [leaves, setLeaves] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  const loadLeaves = async () => {
    try {
      setIsLoading(true);
      const data = await apiGetLeaves();
      const list = Array.isArray(data) ? data : (data?.results || []);
      const sortedList = [...list].sort((a, b) => new Date(b.applied_at || b.start_date || 0) - new Date(a.applied_at || a.start_date || 0));
      setLeaves(sortedList);
    } catch (_) {
      setLeaves([]);
    } finally {
      setIsLoading(false);
    }
  };


  useEffect(() => {
    loadLeaves();
  }, []);

  const handleDecide = async (empId, leaveId, action) => {
    try {
      setStatusMsg({ type: '', text: '' });
      let reason = '';
      if (action === 'reject') {
        reason = prompt('Enter rejection reason:') || 'Administrative decision';
      }
      await apiAdminDecideLeave(empId, leaveId, action, reason);
      setStatusMsg({ type: 'success', text: `Leave application ${action}d successfully.` });
      await loadLeaves();
      setTimeout(() => setStatusMsg({ type: '', text: '' }), 4000);
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Action failed.' });
    }
  };

  return (
    <AppShell breadcrumbs={[{ label: 'Time' }, { label: 'Leave Management' }]}>
      <div className="space-y-4 text-xs">
        <div className="flex items-center justify-between bg-white p-4 border border-slate-200 rounded shadow-sm">
          <div>
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-blue-600" />
              Technician Leave & Absence Applications
            </h1>
            <p className="text-slate-500 text-[11px] mt-0.5">
              Review and approve technician leave applications. Approved leaves automatically block dynamic dispatch eligibility.
            </p>
          </div>
        </div>

        {statusMsg.text && (
          <div className={`p-3 rounded border font-semibold flex items-center gap-2 ${statusMsg.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
            {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
            <span>{statusMsg.text}</span>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-sm">
          <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 font-bold text-slate-800 uppercase tracking-wider text-[11px]">
            Submitted Applications ({leaves.length})
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Technician</th>
                <th className="px-4 py-3">Leave Type</th>
                <th className="px-4 py-3">Start Date</th>
                <th className="px-4 py-3">End Date</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leaves.length > 0 ? (
                leaves.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-slate-900">{l.employee_name || `Emp #${l.employee_id}`}</td>
                    <td className="px-4 py-3 text-slate-700">{l.leave_type}</td>
                    <td className="px-4 py-3 font-mono text-slate-700">{l.start_date}</td>
                    <td className="px-4 py-3 font-mono text-slate-700">{l.end_date}</td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{l.reason}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={l.status} size="xs" />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {l.status === 'submitted' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDecide(l.emp_db_id || l.employee_id, l.id, 'approve')}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[11px]"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDecide(l.emp_db_id || l.employee_id, l.id, 'reject')}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded text-[11px]"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-mono text-[11px]">—</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    No technician leave applications submitted.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

export default AdminLeavePage;
