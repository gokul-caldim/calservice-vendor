import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthProvider.jsx';
import {
  apiGetWorkforceJobs,
  apiTransitionJob,
  apiGetOnboardingProfile,
  apiUploadJobProof,
  apiCollectJobCash,
  apiRequestWorkExtension,
  apiCustomerDecideExtension,
  apiProgressExtension,
  apiRequestPartsPurchase,
  apiTimeTrackingAction,
  apiGetTimeTracking,
  apiApplyLeave,
  apiGetMySchedule,
  apiGetLeaves,
  apiGetMyPayslips,
  apiGetComplianceRecords,
  apiGetMySkills,
  apiAcceptJobOffer,
  apiRejectJobOffer,
  apiVerifyArrival,
  apiVerifyOTP,
  apiUploadPreServicePhoto,
  apiGetPreServiceStatus,
  apiGetCatalog,
  apiRequestService,
  apiRemoveService,
} from '../../api/workforceService.js';
import { ClockInCard } from '../../components/employee/ClockInCard.jsx';
import { AppShell } from '../../components/common/AppShell.jsx';
import { StatusBadge } from '../../components/enterprise/StatusBadge.jsx';
import { Modal } from '../../components/enterprise/Modal.jsx';
import { ErrorState } from '../../components/enterprise/ErrorState.jsx';
import { LoadingState } from '../../components/enterprise/LoadingState.jsx';
import { useLocationTracker } from '../../hooks/useGPSPosition.js';
import { apiUpdateLocationFull } from '../../api/workforceService.js';
import {
  Wrench,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Truck,
  Play,
  DollarSign,
  User,
  Phone,
  ShieldCheck,
  Calendar,
  Camera,
  Upload,
  PlusCircle,
  ShoppingBag,
  Coffee,
  Sun,
  Moon,
  Send,
  CreditCard,
  Award,
  FileText,
  Settings as SettingsIcon,
} from 'lucide-react';

export function EmployeeDashboardPage() {
  const { user, employee, togglePresence } = useAuth();
  const location = useLocation();
  const pathname = location.pathname;
  const hash = location.hash;

  const [jobs, setJobs] = useState([]);
  const [profile, setProfile] = useState(null);
  const [timeTracking, setTimeTracking] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [payslips, setPayslips] = useState([]);
  const [complianceRecords, setComplianceRecords] = useState([]);
  const [skills, setSkills] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Selected job for detailed inspection workspace
  const [selectedJob, setSelectedJob] = useState(null);

  // Phase 2 Pre-Service Verification state
  const [preServiceState, setPreServiceState] = useState({
    geofence_passed: false,
    otp_verified: false,
    presence_photo: false,
    appliance_photo: false,
    work_area_photo: false,
    is_complete: false,
  });
  const [otpInput, setOtpInput] = useState('');

  useEffect(() => {
    if (selectedJob?.id) {
      apiGetPreServiceStatus(selectedJob.id)
        .then((res) => setPreServiceState(res))
        .catch(() => {});
    }
  }, [selectedJob?.id]);

  const handleArriveAtLocation = async () => {
    if (!selectedJob) return;
    if (!navigator.geolocation) {
      setError('Browser Geolocation is not supported by your browser.');
      return;
    }

    setActionLoading(selectedJob.id);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await apiVerifyArrival(selectedJob.id, pos.coords.latitude, pos.coords.longitude);
          setSuccessMsg(res.message || 'Arrival verified!');
          setPreServiceState((prev) => ({ ...prev, geofence_passed: true }));
          await loadDashboard();
          setTimeout(() => setSuccessMsg(''), 4000);
        } catch (err) {
          setError(err.message || 'Arrival geofence verification failed.');
        } finally {
          setActionLoading(null);
        }
      },
      (err) => {
        setError(`GPS error: ${err.message}`);
        setActionLoading(null);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleVerifyOtpSubmit = async () => {
    if (!selectedJob || !otpInput.trim()) return;
    try {
      setActionLoading(selectedJob.id);
      const res = await apiVerifyOTP(selectedJob.id, otpInput.trim());
      setSuccessMsg(res.message || 'Customer OTP verified!');
      setPreServiceState((prev) => ({ ...prev, otp_verified: true, is_complete: res.is_complete }));
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Invalid Customer OTP code.');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePhotoUploadSubmit = async (photoType, file) => {
    if (!selectedJob || !file) return;
    try {
      setActionLoading(selectedJob.id);
      const res = await apiUploadPreServicePhoto(selectedJob.id, photoType, file);
      setSuccessMsg(res.message || 'Photo uploaded!');
      setPreServiceState((prev) => ({
        ...prev,
        [`${photoType}_photo`]: true,
        is_complete: res.is_complete,
      }));
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Photo upload failed.');
    } finally {
      setActionLoading(null);
    }
  };

  // Modals
  const [proofModalJob, setProofModalJob] = useState(null);
  const [beforeFile, setBeforeFile] = useState(null);
  const [afterFile, setAfterFile] = useState(null);
  const [workNotes, setWorkNotes] = useState('');
  const [isUploadingProof, setIsUploadingProof] = useState(false);

  const [cashModalJob, setCashModalJob] = useState(null);
  const [cashAmount, setCashAmount] = useState('');
  const [isCollectingCash, setIsCollectingCash] = useState(false);

  const [extensionModalJob, setExtensionModalJob] = useState(null);
  const [extTitle, setExtTitle] = useState('');
  const [extLaborCost, setExtLaborCost] = useState('');
  const [extMaterialsCost, setExtMaterialsCost] = useState('');
  const [extReason, setExtReason] = useState('');
  const [extIsCritical, setExtIsCritical] = useState(false);
  const [extRequiresSpecialist, setExtRequiresSpecialist] = useState(false);
  const [isSubmittingExt, setIsSubmittingExt] = useState(false);

  const [partsModalJob, setPartsModalJob] = useState(null);
  const [partName, setPartName] = useState('');
  const [partCost, setPartCost] = useState('');
  const [partVendor, setPartVendor] = useState('');
  const [isSubmittingPart, setIsSubmittingPart] = useState(false);

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveType, setLeaveType] = useState('Casual Leave');
  const [leaveStart, setLeaveStart] = useState('');
  const [leaveEnd, setLeaveEnd] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);

  const [catalogCategories, setCatalogCategories] = useState([]);
  const [serviceActionLoading, setServiceActionLoading] = useState(null);

  const loadDashboard = async () => {
    try {
      setIsLoading(true);
      const [jobsData, timeData, profileData] = await Promise.all([
        apiGetWorkforceJobs().catch(() => []),
        apiGetTimeTracking().catch(() => null),
        apiGetOnboardingProfile().catch(() => null),
      ]);
      setJobs(jobsData || []);
      setProfile(profileData || employee);
      setTimeTracking(timeData);
      if (jobsData && jobsData.length > 0 && !selectedJob) {
        setSelectedJob(jobsData[0]);
      }
    } catch (_) {
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  // Fetch module specific data depending on active path
  useEffect(() => {
    if (pathname.includes('/schedule')) {
      apiGetMySchedule().then(setSchedules).catch(() => setSchedules([]));
    } else if (pathname.includes('/earnings')) {
      apiGetMyPayslips().then(setPayslips).catch(() => setPayslips([]));
    } else if (pathname.includes('/documents')) {
      apiGetComplianceRecords().then(setComplianceRecords).catch(() => setComplianceRecords([]));
    } else if (pathname.includes('/services')) {
      apiGetMySkills().then(setSkills).catch(() => setSkills([]));
      apiGetCatalog().then(setCatalogCategories).catch(() => setCatalogCategories([]));
      apiGetOnboardingProfile().then(setProfile).catch(() => {});
    } else if (pathname.includes('/leave') || hash === '#leave') {
      apiGetLeaves().then(setLeaves).catch(() => setLeaves([]));
    }
  }, [pathname, hash]);

  const handleRequestService = async (serviceId, name) => {
    try {
      setServiceActionLoading(serviceId);
      setError('');
      await apiRequestService(serviceId, name);
      setSuccessMsg(`Service authorization request for "${name}" submitted for Admin review.`);
      const updatedProfile = await apiGetOnboardingProfile().catch(() => null);
      if (updatedProfile) setProfile(updatedProfile);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to submit service authorization request.');
    } finally {
      setServiceActionLoading(null);
    }
  };

  const handleRemoveService = async (serviceId, name) => {
    try {
      setServiceActionLoading(serviceId);
      setError('');
      await apiRemoveService(serviceId);
      setSuccessMsg(`Removal request for "${name}" submitted for Admin review.`);
      const updatedProfile = await apiGetOnboardingProfile().catch(() => null);
      if (updatedProfile) setProfile(updatedProfile);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to submit service removal request.');
    } finally {
      setServiceActionLoading(null);
    }
  };

  const isOnline = Boolean(user?.isOnline || employee?.is_online);
  const isClockedIn = Boolean(timeTracking?.is_clocked_in);
  const isBreak = timeTracking?.shift_status === 'on_break';

  // ── Live GPS Tracking ────────────────────────────────────────────────────────
  // Start tracking when employee is ONLINE, stop when OFFLINE.
  // Pushes real browser GPS to /workforce/presence/location/ (User.last_known_location).
  // No mock coordinates. Errors are silent — GPS denial does not block the dashboard.
  const handleGPSPosition = React.useCallback(
    async ({ latitude, longitude, accuracy }) => {
      try {
        await apiUpdateLocationFull(latitude, longitude, accuracy);
      } catch (_) {
        // Silent — GPS update failure should not disrupt the employee dashboard UI
      }
    },
    [],
  );

  useLocationTracker(isOnline, handleGPSPosition);
  // ────────────────────────────────────────────────────────────────────────────

  const handleToggleOnline = async () => {
    try {
      setError('');
      await togglePresence();
      await loadDashboard();
    } catch (err) {
      setError(err.message || 'Failed to toggle availability.');
    }
  };

  const handleJobAction = async (jobId, targetStatus) => {
    try {
      setActionLoading(jobId);
      setError('');
      await apiTransitionJob(jobId, targetStatus);
      await loadDashboard();
    } catch (err) {
      setError(err.message || 'Status transition failed.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleProofSubmit = async (e) => {
    e.preventDefault();
    if (!proofModalJob) return;

    try {
      setIsUploadingProof(true);
      const formData = new FormData();
      if (afterFile) formData.append('after_appliance_photo', afterFile);
      if (beforeFile) formData.append('after_work_area_photo', beforeFile);
      formData.append('notes', workNotes);

      await apiUploadJobProof(proofModalJob.id, formData);
      setProofModalJob(null);
      setBeforeFile(null);
      setAfterFile(null);
      setWorkNotes('');
      setSuccessMsg('After-service proof submitted! Job is COMPLETED.');
      await loadDashboard();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Proof upload failed.');
    } finally {
      setIsUploadingProof(false);
    }
  };

  const handleCashCollectSubmit = async (e) => {
    e.preventDefault();
    if (!cashModalJob) return;

    try {
      setIsCollectingCash(true);
      await apiCollectJobCash(cashModalJob.id, parseFloat(cashAmount) || 0);
      setCashModalJob(null);
      setCashAmount('');
      setSuccessMsg('Cash collection recorded & verified!');
      await loadDashboard();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Cash collection failed.');
    } finally {
      setIsCollectingCash(false);
    }
  };

  const handleAcceptOffer = async (jobId) => {
    try {
      setActionLoading(jobId);
      await apiAcceptJobOffer(jobId);
      setSuccessMsg('Job offer accepted successfully!');
      await loadDashboard();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to accept job offer.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectOffer = async (jobId) => {
    try {
      const reason = prompt('Enter reason for declining job offer:') || 'Technician unavailable';
      setActionLoading(jobId);
      await apiRejectJobOffer(jobId, reason);
      setSuccessMsg('Job offer declined.');
      await loadDashboard();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to decline job offer.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleExtensionSubmit = async (e) => {
    e.preventDefault();
    if (!extensionModalJob) return;

    try {
      setIsSubmittingExt(true);
      await apiRequestWorkExtension(extensionModalJob.id, {
        title: extTitle.trim() || 'Scope Extension',
        estimated_labor_cost: parseFloat(extLaborCost) || 0,
        estimated_materials_cost: parseFloat(extMaterialsCost) || 0,
        reason: extReason.trim(),
        is_critical: extIsCritical,
        requires_specialist: extRequiresSpecialist,
      });
      setExtensionModalJob(null);
      setExtTitle('');
      setExtLaborCost('');
      setExtMaterialsCost('');
      setExtReason('');
      setExtIsCritical(false);
      setExtRequiresSpecialist(false);
      setSuccessMsg('Work extension request submitted to Admin for review!');
      await loadDashboard();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Work extension request failed.');
    } finally {
      setIsSubmittingExt(false);
    }
  };

  const handleCustomerDecideExtensionAction = async (jobId, extId, action) => {
    try {
      setActionLoading(`ext-${extId}`);
      let reason = '';
      if (action === 'DECLINE') {
        reason = prompt('Enter reason for customer decline:') || 'Customer declined additional scope';
      }
      const res = await apiCustomerDecideExtension(jobId, extId, action, reason);
      setSuccessMsg(res.message || 'Customer decision recorded.');
      await loadDashboard();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to record customer decision.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleProgressExtensionAction = async (jobId, extId, action) => {
    try {
      setActionLoading(`ext-${extId}`);
      const res = await apiProgressExtension(jobId, extId, action);
      setSuccessMsg(res.message || 'Extension status updated.');
      await loadDashboard();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to update extension progress.');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePartsSubmit = async (e) => {
    e.preventDefault();
    if (!partsModalJob) return;

    try {
      setIsSubmittingPart(true);
      await apiRequestPartsPurchase(partsModalJob.id, {
        part_name: partName,
        estimated_cost: parseFloat(partCost) || 0,
        vendor_name: partVendor,
      });
      setPartsModalJob(null);
      setPartName('');
      setPartCost('');
      setPartVendor('');
      setSuccessMsg('Parts purchase request submitted!');
      await loadDashboard();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Parts purchase request failed.');
    } finally {
      setIsSubmittingPart(false);
    }
  };

  const handleApplyLeaveSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmittingLeave(true);
      await apiApplyLeave({
        leave_type: leaveType,
        start_date: leaveStart,
        end_date: leaveEnd,
        reason: leaveReason,
      });
      setShowLeaveModal(false);
      setLeaveStart('');
      setLeaveEnd('');
      setLeaveReason('');
      setSuccessMsg('Leave application submitted for Admin approval.');
      const updated = await apiGetLeaves().catch(() => []);
      setLeaves(updated);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to submit leave application.');
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  const allRequestedServices = profile?.all_requested_services || (profile?.bank_details?.onboarding?.services) || [];
  const approvedServices = allRequestedServices.filter((s) => s.status === 'approved');

  return (
    <AppShell breadcrumbs={[{ label: 'Home' }, { label: 'Technician Hub' }]}>
      <div className="space-y-4">
        {/* Availability & Shift Status Bar */}
        <div className="bg-white border border-slate-200 rounded p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-800 text-sm">
              {user?.firstName ? user.firstName[0].toUpperCase() : 'T'}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base font-bold text-slate-900">
                  {user?.firstName ? `${user.firstName} ${user.lastName}` : user?.username}
                </h1>
                <StatusBadge
                  status={isOnline ? 'online' : 'offline'}
                  label={isOnline ? 'AVAILABLE' : 'OFFLINE'}
                />
                {isClockedIn && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    {isBreak ? 'ON BREAK' : 'SHIFT ACTIVE'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                ID: <strong className="text-slate-800">{profile?.employee_id || user?.username}</strong>
                {profile?.city ? ` • Territory: ${profile.city}` : ''}
              </p>
            </div>
          </div>

          {/* Controls: Go Online / Go Offline */}
          <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
            <button
              type="button"
              onClick={handleToggleOnline}
              className={`px-3.5 py-1.5 rounded text-xs font-bold transition-colors shadow-sm ${
                isOnline
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {isOnline ? 'GO OFFLINE' : 'GO ONLINE'}
            </button>

            <button
              type="button"
              onClick={() => setShowLeaveModal(true)}
              className="px-2.5 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors inline-flex items-center gap-1"
            >
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>Apply Leave</span>
            </button>
          </div>
        </div>

        {/* Geofenced Clock-In & Shift Attendance Card: Render ONLY on Main Dashboard */}
        {!pathname.includes('/schedule') &&
          !pathname.includes('/attendance') &&
          !pathname.includes('/leave') &&
          !hash.includes('#attendance') &&
          !hash.includes('#leave') &&
          !pathname.includes('/earnings') &&
          !pathname.includes('/documents') &&
          !pathname.includes('/services') &&
          !pathname.includes('/settings') && (
            <ClockInCard onStatusChange={loadDashboard} />
          )}

        {/* Notifications */}
        {error && <ErrorState message={error} onDismiss={() => setError('')} />}
        {successMsg && (
          <div className="p-3 rounded border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ── ROUTE SPECIFIC VIEWS ── */}

        {/* 1. SCHEDULE TAB */}
        {pathname.includes('/schedule') && (
          <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-sm">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                Work Schedule & Shift Timings
              </h2>
            </div>
            <div className="p-4">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5">Day of Week</th>
                    <th className="px-4 py-2.5">Working Day</th>
                    <th className="px-4 py-2.5">Start Time</th>
                    <th className="px-4 py-2.5">End Time</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, idx) => {
                    const sch = schedules.find((s) => s.day_of_week === idx);
                    const isWorkDay = sch ? sch.is_working_day : idx < 5;
                    return (
                      <tr key={day} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold text-slate-800">{day}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isWorkDay ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                            {isWorkDay ? 'WORK DAY' : 'OFF DAY'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-700">{sch?.start_time || '09:00:00'}</td>
                        <td className="px-4 py-3 font-mono text-slate-700">{sch?.end_time || '18:00:00'}</td>
                        <td className="px-4 py-3 text-slate-500">Active Schedule</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2. ATTENDANCE TAB */}
        {(pathname.includes('/attendance') || hash === '#attendance') && (
          <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-sm">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                Shift Attendance & Action Logs
              </h2>
            </div>
            <div className="p-4">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5">Log ID</th>
                    <th className="px-4 py-2.5">Timestamp</th>
                    <th className="px-4 py-2.5">Action Executed</th>
                    <th className="px-4 py-2.5">Shift Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {timeTracking?.logs && timeTracking.logs.length > 0 ? (
                    timeTracking.logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-slate-500">#{log.id}</td>
                        <td className="px-4 py-3 text-slate-800">{new Date(log.timestamp).toLocaleString()}</td>
                        <td className="px-4 py-3 font-semibold text-blue-700 capitalize">{log.action.replace('_', ' ')}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={log.shift_status} size="xs" />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                        No shift attendance logs recorded for today.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. LEAVE TAB */}
        {(pathname.includes('/leave') || hash === '#leave') && (
          <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-sm">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                My Leaves & Absence Applications ({leaves.length})
              </h2>
              <button
                type="button"
                onClick={() => setShowLeaveModal(true)}
                className="px-3 py-1 bg-blue-600 text-white font-bold rounded text-xs hover:bg-blue-700"
              >
                + New Application
              </button>
            </div>
            <div className="p-4">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5">Leave Type</th>
                    <th className="px-4 py-2.5">Start Date</th>
                    <th className="px-4 py-2.5">End Date</th>
                    <th className="px-4 py-2.5">Reason</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leaves.length > 0 ? (
                    leaves.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold text-slate-800">{l.leave_type}</td>
                        <td className="px-4 py-3 text-slate-700">{l.start_date}</td>
                        <td className="px-4 py-3 text-slate-700">{l.end_date}</td>
                        <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{l.reason}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={l.status} size="xs" />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        No leave applications submitted.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. EARNINGS TAB */}
        {pathname.includes('/earnings') && (
          <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-sm">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                Earnings & Issued Payslips ({payslips.length})
              </h2>
            </div>
            <div className="p-4">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5">Pay Period</th>
                    <th className="px-4 py-2.5">Base Earnings</th>
                    <th className="px-4 py-2.5">Job Share</th>
                    <th className="px-4 py-2.5">Net Pay</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payslips.length > 0 ? (
                    payslips.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold text-slate-800">{p.pay_period_name || `Period #${p.pay_period}`}</td>
                        <td className="px-4 py-3 font-mono text-slate-700">₹{p.base_earnings}</td>
                        <td className="px-4 py-3 font-mono text-slate-700">₹{p.job_earnings}</td>
                        <td className="px-4 py-3 font-mono font-bold text-emerald-700">₹{p.net_pay}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={p.status} size="xs" />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        No issued payslips found for current billing cycle.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. DOCUMENTS TAB */}
        {pathname.includes('/documents') && (
          <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-sm">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                Compliance & Dossier Documents ({complianceRecords.length})
              </h2>
            </div>
            <div className="p-4">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5">Requirement</th>
                    <th className="px-4 py-2.5">Document #</th>
                    <th className="px-4 py-2.5">Expiry Date</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {complianceRecords.length > 0 ? (
                    complianceRecords.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold text-slate-800">{c.requirement_title}</td>
                        <td className="px-4 py-3 font-mono text-slate-700">{c.document_number || '—'}</td>
                        <td className="px-4 py-3 text-slate-700">{c.expiry_date || 'N/A'}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={c.status} size="xs" />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                        No compliance records required.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 6. SERVICES TAB */}
        {pathname.includes('/services') && (
          <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-sm space-y-4 p-4">
            <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-blue-600" />
                  Employee Service Authorizations & Skills
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Select available services from the company catalog to request operational dispatch authorization.
                </p>
              </div>
            </div>

            {/* 1. Authorized Dispatch Services */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-700 uppercase flex items-center justify-between">
                <span>Authorized Services ({approvedServices.length})</span>
                <span className="text-[10px] text-emerald-700 font-semibold">Eligible for Automatic Dispatch</span>
              </h3>
              {approvedServices.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {approvedServices.map((svc) => (
                    <div key={svc.id} className="p-3 bg-emerald-50/60 border border-emerald-200 rounded flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div>
                          <p className="font-bold text-slate-800 text-xs">{svc.name}</p>
                          <span className="text-[10px] text-emerald-700 font-semibold uppercase">Authorized ✓</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveService(svc.id, svc.name)}
                        disabled={serviceActionLoading === svc.id}
                        className="text-[10px] font-bold text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2 py-1 rounded border border-rose-200 transition-colors"
                      >
                        {serviceActionLoading === svc.id ? 'Submitting...' : 'Request Removal'}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded text-slate-500 text-xs">
                  No services approved yet. Browse the catalog below to request service authorization.
                </div>
              )}
            </div>

            {/* 2. Pending Admin Review Requests */}
            {allRequestedServices.filter((s) => s.status === 'pending').length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-amber-800 uppercase flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  Pending Admin Review ({allRequestedServices.filter((s) => s.status === 'pending').length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {allRequestedServices.filter((s) => s.status === 'pending').map((svc) => (
                    <div key={svc.id} className="p-3 bg-amber-50 border border-amber-200 rounded flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-800 text-xs">{svc.name}</p>
                        <p className="text-[10px] text-amber-700 font-semibold">
                          {svc.request_type === 'remove' ? 'REMOVAL PENDING REVIEW' : 'AUTHORIZATION PENDING REVIEW'}
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        PENDING
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Rejected Service Requests */}
            {allRequestedServices.filter((s) => s.status === 'rejected').length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-rose-800 uppercase flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                  Rejected Service Requests ({allRequestedServices.filter((s) => s.status === 'rejected').length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {allRequestedServices.filter((s) => s.status === 'rejected').map((svc) => (
                    <div key={svc.id} className="p-3 bg-rose-50 border border-rose-200 rounded space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-slate-800 text-xs">{svc.name}</p>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                          REJECTED
                        </span>
                      </div>
                      {svc.rejection_reason && (
                        <p className="text-[10px] text-rose-700">
                          <strong>Reason:</strong> {svc.rejection_reason}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRequestService(svc.id, svc.name)}
                        disabled={serviceActionLoading === svc.id}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-0.5 rounded border border-blue-200 transition-colors"
                      >
                        {serviceActionLoading === svc.id ? 'Submitting...' : 'Re-apply for Authorization'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Available Service Catalog */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
                Available Service Catalog
              </h3>
              <div className="space-y-4">
                {catalogCategories.map((cat) => (
                  <div key={cat.id || cat.name} className="border border-slate-200 rounded overflow-hidden">
                    <div className="bg-slate-50 px-3.5 py-2 border-b border-slate-200 font-bold text-xs text-slate-800">
                      {cat.name}
                    </div>
                    <div className="divide-y divide-slate-100">
                      {(cat.services || []).map((s) => {
                        const existing = allRequestedServices.find((req) => String(req.id) === String(s.id));
                        const isApproved = existing?.status === 'approved';
                        const isPending = existing?.status === 'pending';

                        return (
                          <div key={s.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/50">
                            <div>
                              <p className="font-semibold text-slate-900 text-xs">{s.name}</p>
                              <p className="text-[10px] text-slate-500 font-mono">
                                Approx. {s.duration || 60} mins
                              </p>
                            </div>
                            <div>
                              {isApproved ? (
                                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-xs font-bold flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  Authorized
                                </span>
                              ) : isPending ? (
                                <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded text-xs font-bold flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                                  Pending Review
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleRequestService(s.id, s.name)}
                                  disabled={serviceActionLoading === s.id}
                                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded transition-colors shadow-sm disabled:opacity-50"
                                >
                                  {serviceActionLoading === s.id ? 'Submitting...' : 'Request Authorization'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 5. Verified Skill Ratings */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <h3 className="text-xs font-bold text-slate-700 uppercase">Verified Skill Ratings</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {skills.length > 0 ? (
                  skills.map((sk) => (
                    <div key={sk.id} className="p-3 border border-slate-200 rounded bg-slate-50">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-900 text-xs">{sk.skill_name}</h4>
                        <span className="text-[10px] font-bold uppercase text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {sk.proficiency_level}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">No skill certifications assigned yet.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 7. SETTINGS TAB */}
        {pathname.includes('/settings') && (
          <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-sm p-5 space-y-4">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 pb-2">
              <SettingsIcon className="w-4 h-4 text-slate-600" />
              Technician Preferences & Profile Settings
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-500 font-medium mb-1">Technician Name</label>
                <input type="text" readOnly value={`${user?.firstName || ''} ${user?.lastName || ''}`} className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-slate-800 font-semibold" />
              </div>
              <div>
                <label className="block text-slate-500 font-medium mb-1">Registered Phone</label>
                <input type="text" readOnly value={user?.username || ''} className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-slate-800 font-mono" />
              </div>
            </div>
          </div>
        )}

        {/* 8. DEFAULT: ACTIVE JOBS WORKSPACE */}
        {!pathname.includes('/schedule') &&
          !pathname.includes('/attendance') &&
          !pathname.includes('/leave') &&
          !hash.includes('#attendance') &&
          !hash.includes('#leave') &&
          !pathname.includes('/earnings') &&
          !pathname.includes('/documents') &&
          !pathname.includes('/services') &&
          !pathname.includes('/settings') && (
            <>
              {/* Authorized Services Strip */}
              <div className="bg-white border border-slate-200 rounded p-3 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-blue-600" />
                    Your Authorized Dispatch Services ({approvedServices.length})
                  </h2>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {approvedServices.length > 0 ? (
                    approvedServices.map((svc) => (
                      <span
                        key={svc.id}
                        className="px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-[11px] font-medium text-slate-800 inline-flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>{svc.name}</span>
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500">
                      Awaiting Admin service authorizations.
                    </span>
                  )}
                </div>
              </div>

              {/* Task-Oriented Job Workspace */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Left Column: Assigned Jobs List (5 cols) */}
                <div className="lg:col-span-5 border border-slate-200 bg-white rounded overflow-hidden shadow-sm flex flex-col">
                  <div className="bg-slate-50 px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between">
                    <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      Active Jobs Queue ({jobs.length})
                    </h2>
                    <button
                      type="button"
                      onClick={loadDashboard}
                      className="text-[11px] font-semibold text-blue-600 hover:underline"
                    >
                      Refresh
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100 max-h-[550px] overflow-y-auto">
                    {jobs.length > 0 ? (
                      [...jobs].sort((a, b) => (b.id || 0) - (a.id || 0)).map((job) => {
                        const isSelected = selectedJob?.id === job.id;
                        return (
                          <div
                            key={job.id}
                            onClick={() => setSelectedJob(job)}
                            className={`p-3.5 cursor-pointer transition-colors ${
                              isSelected ? 'bg-blue-50/80 border-l-4 border-blue-600' : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[11px] mb-1">
                              <span className="font-mono font-bold text-blue-600">
                                {job.request_id || `SR-${job.id}`}
                              </span>
                              <StatusBadge status={job.status} size="xs" />
                            </div>
                            <h3 className="text-xs font-bold text-slate-900 truncate">
                              {job.service_title || job.service_category}
                            </h3>
                            <p className="text-[11px] text-slate-500 truncate mt-0.5 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{job.address}</span>
                            </p>
                            <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100 text-[10px] text-slate-500">
                              <span>Date: <strong className="text-slate-800">{job.preferred_date || '—'}</strong></span>
                              <span>{job.preferred_time || ''}</span>
                            </div>

                            {(job.active_offer?.status === 'OFFERED' || job.status === 'job_offered') && (
                              <div className="mt-2.5 p-2.5 rounded bg-amber-50 border border-amber-200 text-amber-900 space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-[10px] text-amber-800 uppercase tracking-wider flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-amber-600" />
                                    <span>JOB OFFER</span>
                                  </span>
                                  <span className="text-[10px] font-mono text-amber-700">
                                    {job.preferred_time || '5m Expiry'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 pt-1">
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleAcceptOffer(job.id); }}
                                    disabled={actionLoading === job.id}
                                    className="flex-1 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[10px] shadow-sm transition-colors"
                                  >
                                    {actionLoading === job.id ? 'ACCEPTING...' : 'ACCEPT'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleRejectOffer(job.id); }}
                                    disabled={actionLoading === job.id}
                                    className="flex-1 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded text-[10px] shadow-sm transition-colors"
                                  >
                                    DECLINE
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-12 text-center text-xs text-slate-500">
                        <p className="font-semibold text-slate-700">No assigned jobs in queue.</p>
                        <p className="mt-1">
                          {isOnline ? 'Keep status ONLINE to receive automatic job assignments.' : 'Turn status ONLINE to receive bookings.'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Selected Job Workspace (7 cols) */}
                <div className="lg:col-span-7 border border-slate-200 bg-white rounded overflow-hidden shadow-sm">
                  {selectedJob ? (
                    <div className="p-4 sm:p-5 space-y-4">
                      {/* Job Header */}
                      <div className="flex items-start justify-between border-b border-slate-200 pb-3 gap-2">
                        <div>
                          <span className="font-mono font-bold text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            {selectedJob.request_id || `Job #${selectedJob.id}`}
                          </span>
                          <h2 className="text-sm font-bold text-slate-900 mt-1">
                            {selectedJob.service_title || selectedJob.service_category}
                          </h2>
                        </div>
                        <div className="text-right">
                          <StatusBadge status={selectedJob.status} />
                        </div>
                      </div>

                      {/* Customer & Location Box */}
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-1.5 text-xs">
                        <p className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>Customer: <strong className="text-slate-800">{selectedJob.customer_display_name}</strong></span>
                        </p>
                        {selectedJob.phone && (
                          <p className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span>Phone: <a href={`tel:${selectedJob.phone}`} className="text-blue-600 font-bold hover:underline">{selectedJob.phone}</a></span>
                          </p>
                        )}
                        {selectedJob.email && (
                          <p className="flex items-center gap-2">
                            <Send className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span>Email: <a href={`mailto:${selectedJob.email}`} className="text-blue-600 hover:underline">{selectedJob.email}</a></span>
                          </p>
                        )}
                        <p className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>Address: <strong className="text-slate-800">{selectedJob.address}</strong></span>
                          {selectedJob.latitude != null && selectedJob.longitude != null && (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${selectedJob.latitude},${selectedJob.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              className="ml-auto text-[10px] bg-blue-100 text-blue-700 hover:bg-blue-200 px-1.5 py-0.5 rounded font-semibold"
                            >
                              Open Map ↗
                            </a>
                          )}
                        </p>
                        <p className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>Schedule: <strong className="text-slate-800">
                            {selectedJob.preferred_date
                              ? `${selectedJob.preferred_date}${selectedJob.preferred_time ? ` ${selectedJob.preferred_time}` : ''}`
                              : '—'}
                          </strong></span>
                        </p>
                        <p className="flex items-center gap-2">
                          <CreditCard className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>Payment Mode: <strong className="text-slate-800">{selectedJob.payment_method || 'COD'}</strong> ({selectedJob.payment_status || 'pending'})</span>
                        </p>
                      </div>

                      {/* Selected Cart / Services Breakdown */}
                      {selectedJob.cart_data && selectedJob.cart_data.length > 0 && (
                        <div className="p-3 bg-blue-50/50 border border-blue-100 rounded text-xs space-y-2">
                          <div className="flex items-center justify-between border-b border-blue-200/60 pb-1.5">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5">
                              <ShoppingBag className="w-3.5 h-3.5 text-blue-600" />
                              Booked Services & Cart ({selectedJob.cart_data.length})
                            </span>
                          </div>
                          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                            {selectedJob.cart_data.map((item, idx) => (
                              <div key={idx} className="flex items-start justify-between bg-white p-2 rounded border border-slate-200/80 text-[11px]">
                                <div>
                                  <span className="font-bold text-slate-800">{item.name || item.title || item.service_name || 'Service Item'}</span>
                                  {item.description && <p className="text-[10px] text-slate-500 line-clamp-1">{item.description}</p>}
                                  {item.selectedOption && <p className="text-[10px] text-blue-600 font-semibold">Option: {item.selectedOption}</p>}
                                </div>
                                {item.quantity && (
                                  <div className="text-right shrink-0 ml-2">
                                    <span className="font-mono font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                                      Qty: {item.quantity}
                                    </span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Operational Action Controls */}
                      <div className="border-t border-slate-200 pt-3">
                        <h3 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                          Action Steps
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {selectedJob.status === 'assigned' && (
                            <button
                              type="button"
                              disabled={actionLoading === selectedJob.id}
                              onClick={() => handleJobAction(selectedJob.id, 'accepted')}
                              className="px-3.5 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-colors"
                            >
                              Accept Job
                            </button>
                          )}

                          {(selectedJob.status === 'accepted' || selectedJob.status === 'on_the_way' || selectedJob.status === 'arrived') && (
                            <div className="w-full space-y-3.5 border border-slate-200 rounded-lg p-3.5 bg-slate-50/50 mt-1">
                              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                                  Arrival & Verification Checklist
                                </span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${preServiceState.is_complete ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                  {preServiceState.is_complete ? 'VERIFIED' : 'VERIFICATION REQUIRED'}
                                </span>
                              </div>

                              {/* Step 1: Location Verification */}
                              <div className="p-3 bg-white border border-slate-200 rounded flex items-center justify-between">
                                <div>
                                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5 text-blue-600" />
                                    1. Location Verification
                                  </h4>
                                  <p className="text-[10px] text-slate-500 mt-0.5">
                                    {preServiceState.geofence_passed
                                      ? 'Location verified! You are at the authorized service location.'
                                      : 'Verify your location at the job address.'}
                                  </p>
                                </div>
                                {preServiceState.geofence_passed ? (
                                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-bold rounded text-xs border border-emerald-200 flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    LOCATION VERIFIED
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={handleArriveAtLocation}
                                    disabled={actionLoading === selectedJob.id}
                                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-xs shadow-sm transition-colors"
                                  >
                                    {actionLoading === selectedJob.id ? 'Verifying Location...' : 'ARRIVE AT LOCATION'}
                                  </button>
                                )}
                              </div>

                              {/* Step 2: Verification Requirements */}
                              {preServiceState.geofence_passed && (
                                <div className="p-3 bg-white border border-slate-200 rounded space-y-2.5">
                                  <h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-1.5 flex items-center gap-1">
                                    <Camera className="w-3.5 h-3.5 text-blue-600" />
                                    2. Required Pre-Service Evidence
                                  </h4>

                                  {/* Verification Code */}
                                  <div className="flex items-center justify-between text-xs pt-1">
                                    <div>
                                      <span className="font-semibold text-slate-800">Customer Verification Code</span>
                                      <p className="text-[10px] text-slate-500">Ask customer for the 6-digit verification code received on arrival</p>
                                    </div>
                                    {preServiceState.otp_verified ? (
                                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded text-[10px] border border-emerald-200">
                                        Verified ✓
                                      </span>
                                    ) : (
                                      <div className="flex items-center gap-1">
                                        <input
                                          type="text"
                                          maxLength={6}
                                          placeholder="6-digit OTP"
                                          value={otpInput}
                                          onChange={(e) => setOtpInput(e.target.value)}
                                          className="w-24 px-1.5 py-0.5 border border-slate-300 rounded font-mono text-center text-xs placeholder:text-slate-400"
                                        />
                                        <button
                                          type="button"
                                          onClick={handleVerifyOtpSubmit}
                                          className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-xs"
                                        >
                                          Verify OTP
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  {/* Identity Photo */}
                                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                                    <div>
                                      <span className="font-semibold text-slate-800">Identity/Presence Photo</span>
                                      <p className="text-[10px] text-slate-500">Selfie at job location showing identity</p>
                                    </div>
                                    {preServiceState.presence_photo ? (
                                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded text-[10px] border border-emerald-200">
                                        Uploaded ✓
                                      </span>
                                    ) : (
                                      <label className="cursor-pointer px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded text-xs border border-slate-300">
                                        Upload Selfie
                                        <input
                                          type="file"
                                          accept="image/*"
                                          className="hidden"
                                          onChange={(e) => e.target.files[0] && handlePhotoUploadSubmit('presence', e.target.files[0])}
                                        />
                                      </label>
                                    )}
                                  </div>

                                  {/* Appliance Photo */}
                                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                                    <div>
                                      <span className="font-semibold text-slate-800">Before Appliance Photo</span>
                                      <p className="text-[10px] text-slate-500">Appliance condition before work</p>
                                    </div>
                                    {preServiceState.appliance_photo ? (
                                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded text-[10px] border border-emerald-200">
                                        Uploaded ✓
                                      </span>
                                    ) : (
                                      <label className="cursor-pointer px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded text-xs border border-slate-300">
                                        Upload Photo
                                        <input
                                          type="file"
                                          accept="image/*"
                                          className="hidden"
                                          onChange={(e) => e.target.files[0] && handlePhotoUploadSubmit('appliance', e.target.files[0])}
                                        />
                                      </label>
                                    )}
                                  </div>

                                  {/* Work Area Photo */}
                                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                                    <div>
                                      <span className="font-semibold text-slate-800">Before Work-Area Photo</span>
                                      <p className="text-[10px] text-slate-500">Work area condition before work</p>
                                    </div>
                                    {preServiceState.work_area_photo ? (
                                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded text-[10px] border border-emerald-200">
                                        Uploaded ✓
                                      </span>
                                    ) : (
                                      <label className="cursor-pointer px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded text-xs border border-slate-300">
                                        Upload Photo
                                        <input
                                          type="file"
                                          accept="image/*"
                                          className="hidden"
                                          onChange={(e) => e.target.files[0] && handlePhotoUploadSubmit('work_area', e.target.files[0])}
                                        />
                                      </label>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Service Gate Banner */}
                              {preServiceState.is_complete ? (
                                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-emerald-900 flex items-center justify-between">
                                  <div>
                                    <h4 className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                      Pre-Service Verification Complete!
                                    </h4>
                                    <p className="text-[10px] text-emerald-700 mt-0.5">
                                      Use the top <strong>ClockInCard</strong> to start service shift and record time.
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <div className="p-2 bg-amber-50 border border-amber-200 rounded text-amber-900 text-[11px] font-medium">
                                  Clock-In is locked until all 4 verification items and GPS arrival are completed.
                                </div>
                              )}
                            </div>
                          )}

                          {/* Active Scope Extensions Subsystem */}
                          {selectedJob.extensions && selectedJob.extensions.length > 0 && (
                            <div className="w-full p-3 bg-slate-50 border border-slate-200 rounded space-y-2">
                              <h4 className="text-xs font-bold text-slate-800 flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                  <PlusCircle className="w-3.5 h-3.5 text-indigo-600" />
                                  Scope Extensions ({selectedJob.extensions.length})
                                </span>
                              </h4>
                              <div className="space-y-2">
                                {selectedJob.extensions.map((ext) => (
                                  <div key={ext.id} className="p-2.5 bg-white border border-slate-200 rounded text-xs space-y-1.5 shadow-sm">
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-slate-900">{ext.title}</span>
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                        ext.status === 'REQUESTED' ? 'bg-amber-100 text-amber-800' :
                                        ext.status === 'ADMIN_APPROVED' ? 'bg-blue-100 text-blue-800' :
                                        ext.status === 'ADMIN_REJECTED' ? 'bg-red-100 text-red-800' :
                                        ext.status === 'CUSTOMER_ACCEPTED' ? 'bg-emerald-100 text-emerald-800' :
                                        ext.status === 'CUSTOMER_DECLINED' ? 'bg-rose-100 text-rose-800' :
                                        ext.status === 'IN_PROGRESS' ? 'bg-indigo-100 text-indigo-800' :
                                        'bg-emerald-100 text-emerald-800'
                                      }`}>
                                        {ext.status.replace('_', ' ')}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-slate-600">{ext.reason}</p>
                                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-700 pt-1 border-t border-slate-100">
                                      <span>Estimate: ₹{ext.requested_amount} (Labor: ₹{ext.estimated_labor_cost}, Materials: ₹{ext.estimated_materials_cost})</span>
                                      {ext.approved_amount && <span className="font-bold text-blue-700">Approved: ₹{ext.approved_amount}</span>}
                                    </div>
                                    {ext.is_critical && (
                                      <span className="inline-block text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                        ⚠️ Critical Scope (Job cannot proceed if declined)
                                      </span>
                                    )}

                                    {/* Actions based on extension status */}
                                    {ext.status === 'ADMIN_APPROVED' && (
                                      <div className="flex items-center gap-2 pt-1">
                                        <span className="text-[10px] font-semibold text-slate-500">Customer Decision:</span>
                                        <button
                                          type="button"
                                          onClick={() => handleCustomerDecideExtensionAction(selectedJob.id, ext.id, 'ACCEPT')}
                                          disabled={actionLoading === `ext-${ext.id}`}
                                          className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[10px]"
                                        >
                                          Customer Accepts
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleCustomerDecideExtensionAction(selectedJob.id, ext.id, 'DECLINE')}
                                          disabled={actionLoading === `ext-${ext.id}`}
                                          className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded text-[10px]"
                                        >
                                          Customer Declines
                                        </button>
                                      </div>
                                    )}

                                    {ext.status === 'CUSTOMER_ACCEPTED' && !ext.requires_specialist && (
                                      <div className="pt-1">
                                        <button
                                          type="button"
                                          onClick={() => handleProgressExtensionAction(selectedJob.id, ext.id, 'start')}
                                          disabled={actionLoading === `ext-${ext.id}`}
                                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded text-[10px]"
                                        >
                                          Start Additional Work
                                        </button>
                                      </div>
                                    )}

                                    {ext.status === 'IN_PROGRESS' && (
                                      <div className="pt-1">
                                        <button
                                          type="button"
                                          onClick={() => handleProgressExtensionAction(selectedJob.id, ext.id, 'complete')}
                                          disabled={actionLoading === `ext-${ext.id}`}
                                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[10px]"
                                        >
                                          Mark Additional Work Completed
                                        </button>
                                      </div>
                                    )}

                                    {ext.status === 'COMPLETED' && (
                                      <div className="pt-1">
                                        <button
                                          type="button"
                                          onClick={() => handleProgressExtensionAction(selectedJob.id, ext.id, 'resolve')}
                                          disabled={actionLoading === `ext-${ext.id}`}
                                          className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded text-[10px]"
                                        >
                                          Resolve Extension
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {selectedJob.status === 'unable_to_complete' && (
                            <div className="w-full p-3 bg-rose-50 border border-rose-200 rounded text-rose-900">
                              <h4 className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                                <AlertTriangle className="w-4 h-4 text-rose-600" />
                                Job Status: Unable to Complete
                              </h4>
                              <p className="text-[11px] text-rose-700 mt-1 whitespace-pre-wrap">
                                {selectedJob.description?.includes('[UNABLE_TO_COMPLETE]')
                                  ? selectedJob.description.split('[UNABLE_TO_COMPLETE]:')[1]
                                  : 'A critical scope extension was declined by the customer, and work cannot safely proceed.'}
                              </p>
                            </div>
                          )}

                          {selectedJob.status === 'in_progress' && (
                            <div className="flex flex-wrap items-center gap-2 pt-2">
                              <button
                                type="button"
                                onClick={() => setProofModalJob(selectedJob)}
                                className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-colors inline-flex items-center gap-1.5"
                              >
                                <Camera className="w-3.5 h-3.5" />
                                <span>Complete & Upload Proof</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setExtensionModalJob(selectedJob)}
                                className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-colors inline-flex items-center gap-1.5"
                              >
                                <PlusCircle className="w-3.5 h-3.5" />
                                <span>Request Work Extension</span>
                              </button>
                            </div>
                          )}

                          {selectedJob.status === 'completed' && (
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded border border-emerald-200">
                              Job Successfully Completed
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-16 text-center text-xs text-slate-500">
                      Select a job order from the queue to view task details.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

        {/* Modal: Apply Leave */}
        <Modal
          isOpen={showLeaveModal}
          onClose={() => setShowLeaveModal(false)}
          title="Apply for Absence / Leave"
        >
          <form onSubmit={handleApplyLeaveSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Leave Type</label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800"
              >
                <option value="Casual Leave">Casual Leave</option>
                <option value="Sick Leave">Sick Leave</option>
                <option value="Emergency Leave">Emergency Leave</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Start Date</label>
                <input
                  type="date"
                  required
                  value={leaveStart}
                  onChange={(e) => setLeaveStart(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">End Date</label>
                <input
                  type="date"
                  required
                  value={leaveEnd}
                  onChange={(e) => setLeaveEnd(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800"
                />
              </div>
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Reason</label>
              <textarea
                required
                rows={3}
                value={leaveReason}
                onChange={(e) => setLeaveReason(e.target.value)}
                placeholder="State your reason..."
                className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingLeave}
                className="px-4 py-1.5 rounded bg-blue-600 text-white font-bold hover:bg-blue-700"
              >
                {isSubmittingLeave ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Modal: Proof of Work */}
        <Modal
          isOpen={Boolean(proofModalJob)}
          onClose={() => setProofModalJob(null)}
          title={`Proof of Work Completion — Job #${proofModalJob?.id}`}
        >
          <form onSubmit={handleProofSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Before Photo</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setBeforeFile(e.target.files[0])}
                className="w-full border border-slate-300 rounded px-3 py-1.5"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">After Photo</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setAfterFile(e.target.files[0])}
                className="w-full border border-slate-300 rounded px-3 py-1.5"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Completion Notes</label>
              <textarea
                rows={3}
                value={workNotes}
                onChange={(e) => setWorkNotes(e.target.value)}
                placeholder="Details of service provided..."
                className="w-full border border-slate-300 rounded px-3 py-2"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setProofModalJob(null)}
                className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUploadingProof}
                className="px-4 py-1.5 rounded bg-emerald-600 text-white font-bold hover:bg-emerald-700"
              >
                {isUploadingProof ? 'Uploading...' : 'Complete Job'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Modal: Request Scope / Work Extension */}
        <Modal
          isOpen={Boolean(extensionModalJob)}
          onClose={() => setExtensionModalJob(null)}
          title={`Request Scope Extension — Job #${extensionModalJob?.id}`}
        >
          <form onSubmit={handleExtensionSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Extension Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Additional Wiring / Deep Cleaning"
                value={extTitle}
                onChange={(e) => setExtTitle(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Estimated Labor (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="0.00"
                  value={extLaborCost}
                  onChange={(e) => setExtLaborCost(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Estimated Materials (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={extMaterialsCost}
                  onChange={(e) => setExtMaterialsCost(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800"
                />
              </div>
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Reason / Justification</label>
              <textarea
                required
                rows={3}
                placeholder="Detailed reason for additional scope..."
                value={extReason}
                onChange={(e) => setExtReason(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-slate-800"
              />
            </div>
            <div className="space-y-2 pt-1 border-t border-slate-100">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={extIsCritical}
                  onChange={(e) => setExtIsCritical(e.target.checked)}
                  className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                <span className="text-slate-700 font-medium">
                  <strong>Critical Scope:</strong> Job cannot proceed safely if customer declines this extension.
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={extRequiresSpecialist}
                  onChange={(e) => setExtRequiresSpecialist(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-slate-700 font-medium">
                  <strong>Requires Specialist:</strong> Handover to another specialist technician instead of continuing work yourself.
                </span>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setExtensionModalJob(null)}
                className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingExt}
                className="px-4 py-1.5 rounded bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-sm"
              >
                {isSubmittingExt ? 'Submitting...' : 'Submit Extension Request'}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </AppShell>
  );
}

export default EmployeeDashboardPage;
