import React, { useEffect, useState } from 'react';
import { AppShell } from '../../components/common/AppShell.jsx';
import { apiGetEmployees, apiGetSchedule, apiSetSchedule } from '../../api/workforceService.js';
import { Calendar, Clock, User, CheckCircle2, AlertCircle, Save } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function AdminSchedulingPage() {
  const [employees, setEmployees] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      setIsLoading(true);
      const data = await apiGetEmployees();
      setEmployees(data || []);
      if (data && data.length > 0) {
        selectEmployee(data[0]);
      }
    } catch (_) {
      setEmployees([]);
    } finally {
      setIsLoading(false);
    }
  };

  const selectEmployee = async (emp) => {
    setSelectedEmp(emp);
    setStatusMsg({ type: '', text: '' });
    try {
      const data = await apiGetSchedule(emp.id);
      if (data && data.length > 0) {
        setSchedules(data);
      } else {
        // Initialize default 9am-6pm M-F schedule
        setSchedules(
          DAYS.map((_, idx) => ({
            day_of_week: idx,
            start_time: '09:00:00',
            end_time: '18:00:00',
            is_working_day: idx < 5,
          }))
        );
      }
    } catch (_) {
      setSchedules(
        DAYS.map((_, idx) => ({
          day_of_week: idx,
          start_time: '09:00:00',
          end_time: '18:00:00',
          is_working_day: idx < 5,
        }))
      );
    }
  };

  const handleScheduleChange = (dayIdx, field, val) => {
    setSchedules((prev) =>
      prev.map((s) => (s.day_of_week === dayIdx ? { ...s, [field]: val } : s))
    );
  };

  const handleSave = async () => {
    if (!selectedEmp) return;
    try {
      setIsSaving(true);
      setStatusMsg({ type: '', text: '' });
      await apiSetSchedule(selectedEmp.id, schedules);
      setStatusMsg({ type: 'success', text: `Schedule for ${selectedEmp.full_name || selectedEmp.employee_id} saved successfully.` });
      setTimeout(() => setStatusMsg({ type: '', text: '' }), 4000);
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to save schedule.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell breadcrumbs={[{ label: 'Operations' }, { label: 'Workforce Scheduling' }]}>
      <div className="space-y-4 text-xs">
        <div className="flex items-center justify-between bg-white p-4 border border-slate-200 rounded shadow-sm">
          <div>
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Technician Shift & Working Days Scheduling
            </h1>
            <p className="text-slate-500 text-[11px] mt-0.5">
              Define working days and operating hours per technician. Out-of-schedule personnel are excluded from dynamic dispatch.
            </p>
          </div>
          {selectedEmp && (
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 text-white font-bold rounded shadow-sm hover:bg-blue-700 inline-flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Schedule'}
            </button>
          )}
        </div>

        {statusMsg.text && (
          <div className={`p-3 rounded border font-semibold flex items-center gap-2 ${statusMsg.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
            {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
            <span>{statusMsg.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Employee Roster Sidebar */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded overflow-hidden shadow-sm">
            <div className="bg-slate-50 px-3.5 py-2.5 border-b border-slate-200 font-bold text-slate-800 uppercase tracking-wider text-[11px]">
              Employee Roster ({employees.length})
            </div>
            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
              {employees.map((emp) => {
                const isSelected = selectedEmp?.id === emp.id;
                return (
                  <div
                    key={emp.id}
                    onClick={() => selectEmployee(emp)}
                    className={`p-3 cursor-pointer transition-colors flex items-center justify-between ${isSelected ? 'bg-blue-50 border-l-4 border-blue-600' : 'hover:bg-slate-50'}`}
                  >
                    <div>
                      <h4 className="font-bold text-slate-900">{emp.full_name || emp.username}</h4>
                      <p className="text-[11px] text-slate-500 font-mono">ID: {emp.employee_id}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${emp.is_online ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {emp.is_online ? 'ONLINE' : 'OFFLINE'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Schedule Form Grid */}
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded overflow-hidden shadow-sm p-4">
            {selectedEmp ? (
              <div className="space-y-4">
                <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{selectedEmp.full_name || selectedEmp.username}</h3>
                    <p className="text-slate-500 text-[11px] font-mono">Employee ID: {selectedEmp.employee_id}</p>
                  </div>
                </div>

                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">Day</th>
                      <th className="px-3 py-2">Work Day</th>
                      <th className="px-3 py-2">Shift Start</th>
                      <th className="px-3 py-2">Shift End</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {DAYS.map((dayName, idx) => {
                      const sch = schedules.find((s) => s.day_of_week === idx) || {
                        day_of_week: idx,
                        start_time: '09:00:00',
                        end_time: '18:00:00',
                        is_working_day: idx < 5,
                      };
                      return (
                        <tr key={dayName} className="hover:bg-slate-50">
                          <td className="px-3 py-2.5 font-bold text-slate-800">{dayName}</td>
                          <td className="px-3 py-2.5">
                            <label className="inline-flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={sch.is_working_day}
                                onChange={(e) => handleScheduleChange(idx, 'is_working_day', e.target.checked)}
                                className="rounded text-blue-600"
                              />
                              <span className={sch.is_working_day ? 'font-bold text-emerald-700' : 'text-slate-400'}>
                                {sch.is_working_day ? 'Working' : 'Off'}
                              </span>
                            </label>
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="time"
                              disabled={!sch.is_working_day}
                              value={sch.start_time ? sch.start_time.substring(0, 5) : '09:00'}
                              onChange={(e) => handleScheduleChange(idx, 'start_time', `${e.target.value}:00`)}
                              className="border border-slate-300 rounded px-2 py-1 bg-white text-slate-800 font-mono disabled:bg-slate-100"
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="time"
                              disabled={!sch.is_working_day}
                              value={sch.end_time ? sch.end_time.substring(0, 5) : '18:00'}
                              onChange={(e) => handleScheduleChange(idx, 'end_time', `${e.target.value}:00`)}
                              className="border border-slate-300 rounded px-2 py-1 bg-white text-slate-800 font-mono disabled:bg-slate-100"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-500">Select an employee to manage schedule.</div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default AdminSchedulingPage;
