import React, { useEffect, useState } from 'react';
import { AppShell } from '../../components/common/AppShell.jsx';
import { Modal } from '../../components/enterprise/Modal.jsx';
import { apiGetSkills, apiCreateSkill, apiAssignSkill, apiGetEmployees } from '../../api/workforceService.js';
import { Award, PlusCircle, CheckCircle2, AlertCircle, User, ShieldCheck } from 'lucide-react';

export function AdminSkillsPage() {
  const [skills, setSkills] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  // Create Skill Modal
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [skillName, setSkillName] = useState('');
  const [skillCategory, setSkillCategory] = useState('HVAC');
  const [skillDesc, setSkillDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Assign Skill Modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignEmpId, setAssignEmpId] = useState('');
  const [assignSkillId, setAssignSkillId] = useState('');
  const [proficiencyLevel, setProficiencyLevel] = useState('INTERMEDIATE');
  const [isAssigning, setIsAssigning] = useState(false);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [skData, empData] = await Promise.all([
        apiGetSkills().catch(() => []),
        apiGetEmployees().catch(() => []),
      ]);
      setSkills(skData || []);
      setEmployees(empData || []);
      if (empData && empData.length > 0) setAssignEmpId(empData[0].id);
      if (skData && skData.length > 0) setAssignSkillId(skData[0].id);
    } catch (_) {
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateSkill = async (e) => {
    e.preventDefault();
    try {
      setIsCreating(true);
      setStatusMsg({ type: '', text: '' });
      await apiCreateSkill({
        name: skillName,
        category: skillCategory,
        description: skillDesc,
      });
      setShowSkillModal(false);
      setSkillName('');
      setSkillDesc('');
      setStatusMsg({ type: 'success', text: 'Skill created successfully.' });
      await loadData();
      setTimeout(() => setStatusMsg({ type: '', text: '' }), 4000);
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to create skill.' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleAssignSkill = async (e) => {
    e.preventDefault();
    if (!assignEmpId || !assignSkillId) return;
    try {
      setIsAssigning(true);
      setStatusMsg({ type: '', text: '' });
      await apiAssignSkill(assignEmpId, {
        skill_id: assignSkillId,
        proficiency_level: proficiencyLevel,
      });
      setShowAssignModal(false);
      setStatusMsg({ type: 'success', text: 'Skill assigned and verified for technician.' });
      await loadData();
      setTimeout(() => setStatusMsg({ type: '', text: '' }), 4000);
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to assign skill.' });
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <AppShell breadcrumbs={[{ label: 'Workforce' }, { label: 'Skills & Qualifications' }]}>
      <div className="space-y-4 text-xs">
        <div className="flex items-center justify-between bg-white p-4 border border-slate-200 rounded shadow-sm">
          <div>
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-blue-600" />
              Workforce Skills & Verification Matrix
            </h1>
            <p className="text-slate-500 text-[11px] mt-0.5">
              Manage skill certifications and verify technician service proficiency for dispatch qualification.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSkillModal(true)}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow-sm inline-flex items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              New Skill
            </button>
            <button
              type="button"
              onClick={() => setShowAssignModal(true)}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded shadow-sm inline-flex items-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" />
              Assign Skill
            </button>
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
            Master Skill Catalog ({skills.length})
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Skill Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {skills.length > 0 ? (
                skills.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-slate-900">{s.name}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        {s.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{s.description || '—'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-4 py-12 text-center text-slate-500">
                    No skills cataloged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Modal: New Skill */}
        <Modal isOpen={showSkillModal} onClose={() => setShowSkillModal(false)} title="Create New Skill Certification">
          <form onSubmit={handleCreateSkill} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Skill Name</label>
              <input
                type="text"
                required
                value={skillName}
                onChange={(e) => setSkillName(e.target.value)}
                placeholder="e.g. Inverter AC PCB Diagnostics"
                className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Category</label>
              <select
                value={skillCategory}
                onChange={(e) => setSkillCategory(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800"
              >
                <option value="HVAC">HVAC & Air Conditioning</option>
                <option value="Electrical">Electrical & Wiring</option>
                <option value="Plumbing">Plumbing & Sanitation</option>
                <option value="Appliances">Home Appliances</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Description</label>
              <textarea
                rows={3}
                value={skillDesc}
                onChange={(e) => setSkillDesc(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button type="button" onClick={() => setShowSkillModal(false)} className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 font-semibold">
                Cancel
              </button>
              <button type="submit" disabled={isCreating} className="px-4 py-1.5 rounded bg-blue-600 text-white font-bold hover:bg-blue-700">
                {isCreating ? 'Saving...' : 'Create Skill'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Modal: Assign Skill */}
        <Modal isOpen={showAssignModal} onClose={() => setShowAssignModal(false)} title="Assign & Verify Skill to Technician">
          <form onSubmit={handleAssignSkill} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Select Technician</label>
              <select
                value={assignEmpId}
                onChange={(e) => setAssignEmpId(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800"
              >
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name || e.username} ({e.employee_id})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Select Skill</label>
              <select
                value={assignSkillId}
                onChange={(e) => setAssignSkillId(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800"
              >
                {skills.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.category})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Proficiency Level</label>
              <select
                value={proficiencyLevel}
                onChange={(e) => setProficiencyLevel(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800"
              >
                <option value="BEGINNER">BEGINNER</option>
                <option value="INTERMEDIATE">INTERMEDIATE</option>
                <option value="EXPERT">EXPERT</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button type="button" onClick={() => setShowAssignModal(false)} className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 font-semibold">
                Cancel
              </button>
              <button type="submit" disabled={isAssigning} className="px-4 py-1.5 rounded bg-emerald-600 text-white font-bold hover:bg-emerald-700">
                {isAssigning ? 'Assigning...' : 'Assign & Verify'}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </AppShell>
  );
}

export default AdminSkillsPage;
