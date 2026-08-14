import React, { useEffect, useState } from 'react';
import { AppShell } from '../../components/common/AppShell.jsx';
import { StatusBadge } from '../../components/enterprise/StatusBadge.jsx';
import { apiGetFleetMap } from '../../api/workforceService.js';
import { Clock, RefreshCw, User, Activity } from 'lucide-react';

export function AdminAttendancePage() {
  const [fleet, setFleet] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadAttendance = async () => {
    try {
      setIsLoading(true);
      const data = await apiGetFleetMap();
      setFleet(data || []);
    } catch (_) {
      setFleet([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAttendance();
  }, []);

  return (
    <AppShell breadcrumbs={[{ label: 'Time' }, { label: 'Attendance & Live Shifts' }]}>
      <div className="space-y-4 text-xs">
        <div className="flex items-center justify-between bg-white p-4 border border-slate-200 rounded shadow-sm">
          <div>
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Workforce Attendance & Shift Tracking
            </h1>
            <p className="text-slate-500 text-[11px] mt-0.5">
              Real-time monitoring of technician shift clock-in states, availability, and active job assignments.
            </p>
          </div>
          <button
            type="button"
            onClick={loadAttendance}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded border border-slate-300 inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh Logs
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-sm">
          <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 font-bold text-slate-800 uppercase tracking-wider text-[11px]">
            Technician Shift Summary ({fleet.length})
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Technician</th>
                <th className="px-4 py-3">Employee ID</th>
                <th className="px-4 py-3">Presence</th>
                <th className="px-4 py-3">Availability</th>
                <th className="px-4 py-3">Active Job</th>
                <th className="px-4 py-3">Last Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fleet.length > 0 ? (
                fleet.map((item) => (
                  <tr key={item.employee_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-slate-900 flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{item.name}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600">{item.employee_id}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.is_online ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                        {item.is_online ? 'ONLINE' : 'OFFLINE'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.current_availability} size="xs" />
                    </td>
                    <td className="px-4 py-3 font-mono text-blue-600 font-bold">
                      {item.active_job || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {item.last_activity_at ? new Date(item.last_activity_at).toLocaleTimeString() : 'N/A'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    No active technicians reporting attendance.
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

export default AdminAttendancePage;
