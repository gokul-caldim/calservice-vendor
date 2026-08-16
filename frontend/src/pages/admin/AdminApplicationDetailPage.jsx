import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  apiGetAdminApplicationDetail,
  apiVerifyDocument,
  apiBulkVerifyDocuments,
  apiDecideService,
  apiBulkDecideServices,
  apiRequestCorrection,
  apiApproveApplication,
  apiRejectApplication,
} from '../../api/workforceService.js';
import { AppShell } from '../../components/common/AppShell.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { Tabs } from '../../components/enterprise/Tabs.jsx';
import { StatusBadge } from '../../components/enterprise/StatusBadge.jsx';
import { Modal } from '../../components/enterprise/Modal.jsx';
import { ConfirmDialog } from '../../components/enterprise/ConfirmDialog.jsx';
import { ErrorState } from '../../components/enterprise/ErrorState.jsx';
import { LoadingState } from '../../components/enterprise/LoadingState.jsx';
import {
  ArrowLeft,
  User,
  MapPin,
  Wrench,
  FileText,
  CreditCard,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  Award,
  Clock,
  History,
  Phone,
  Mail,
  Building,
} from 'lucide-react';

export function AdminApplicationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [application, setApplication] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionNotes, setCorrectionNotes] = useState('');

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const [showApproveConfirm, setShowApproveConfirm] = useState(false);

  const loadDetail = async () => {
    try {
      setIsLoading(true);
      const data = await apiGetAdminApplicationDetail(id);
      setApplication(data);
    } catch (err) {
      setError(err.message || 'Failed to load candidate dossier.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [id]);

  // Auto-dismiss transient notifications
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 4500);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(''), 4500);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  const [selectedDocKeys, setSelectedDocKeys] = useState(new Set());

  const handleToggleSelectDoc = (docKey) => {
    setSelectedDocKeys((prev) => {
      const next = new Set(prev);
      const key = String(docKey);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleToggleSelectAllDocs = (allDocKeysList) => {
    if (selectedDocKeys.size === allDocKeysList.length && allDocKeysList.length > 0) {
      setSelectedDocKeys(new Set());
    } else {
      setSelectedDocKeys(new Set(allDocKeysList));
    }
  };

  const handleBulkDocumentAction = async (action, allPending = false) => {
    const categoriesToDecide = allPending ? [] : Array.from(selectedDocKeys);
    if (!allPending && categoriesToDecide.length === 0) {
      setError('Please select at least one document.');
      return;
    }

    let reason = '';
    if (action === 'reject') {
      reason = prompt('Enter specific reason for rejecting selected document(s):') || '';
      if (!reason.trim()) return;
    }

    try {
      setActionLoading(true);
      setError('');
      const res = await apiBulkVerifyDocuments(id, categoriesToDecide, action, reason, allPending);
      setSuccessMsg(res.message || `Documents ${action}d successfully.`);
      setSelectedDocKeys(new Set());
      await loadDetail();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.message || `Bulk document ${action} failed.`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDocAction = async (docCategory, action) => {
    let reason = '';
    if (action === 'reject') {
      reason = prompt('Enter specific reason for rejecting this document:') || '';
      if (!reason.trim()) return;
    }

    try {
      setActionLoading(true);
      setError('');
      await apiVerifyDocument(id, docCategory, action, reason);
      setSuccessMsg(`Document marked as ${action}d.`);
      setSelectedDocKeys((prev) => {
        const next = new Set(prev);
        next.delete(String(docCategory));
        return next;
      });
      await loadDetail();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.message || 'Document verification failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const [selectedServiceIds, setSelectedServiceIds] = useState(new Set());

  const handleToggleSelectService = (serviceId) => {
    setSelectedServiceIds((prev) => {
      const next = new Set(prev);
      const sid = String(serviceId);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
  };

  const handleToggleSelectAllServices = (allServicesList) => {
    if (selectedServiceIds.size === allServicesList.length && allServicesList.length > 0) {
      setSelectedServiceIds(new Set());
    } else {
      setSelectedServiceIds(new Set(allServicesList.map((s) => String(s.id))));
    }
  };

  const handleBulkServiceAction = async (action, allPending = false) => {
    const idsToDecide = allPending ? [] : Array.from(selectedServiceIds);
    if (!allPending && idsToDecide.length === 0) {
      setError('Please select at least one service.');
      return;
    }

    try {
      setActionLoading(true);
      setError('');
      const res = await apiBulkDecideServices(id, idsToDecide, action, '', allPending);
      setSuccessMsg(res.message || `Services ${action}d successfully.`);
      setSelectedServiceIds(new Set());
      await loadDetail();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.message || `Bulk service ${action} failed.`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleServiceAction = async (serviceId, action) => {
    try {
      setActionLoading(true);
      setError('');
      await apiDecideService(id, serviceId, action);
      setSuccessMsg(`Service ${action}d successfully.`);
      setSelectedServiceIds((prev) => {
        const next = new Set(prev);
        next.delete(String(serviceId));
        return next;
      });
      await loadDetail();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.message || 'Service authorization update failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestCorrectionSubmit = async (e) => {
    e.preventDefault();
    if (!correctionNotes.trim()) return;

    try {
      setActionLoading(true);
      setError('');
      await apiRequestCorrection(id, correctionNotes.trim());
      setShowCorrectionModal(false);
      setSuccessMsg('Correction request dispatched to technician.');
      await loadDetail();
    } catch (err) {
      setError(err.message || 'Failed to request corrections.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveApplication = async () => {
    try {
      setActionLoading(true);
      setError('');
      await apiApproveApplication(id);
      setShowApproveConfirm(false);
      setSuccessMsg('Technician approved! Status is now OFFLINE (ready for field dispatch).');
      await loadDetail();
    } catch (err) {
      setError(err.message || 'Approval failed. Verify at least one service is approved.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectCandidateSubmit = async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      setError('');
      await apiRejectApplication(id, rejectionReason.trim());
      setShowRejectModal(false);
      setSuccessMsg('Candidate application rejected.');
      await loadDetail();
    } catch (err) {
      setError(err.message || 'Rejection failed.');
    } finally {
      setActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <AppShell breadcrumbs={[{ label: 'Home', to: '/workforce/admin' }, { label: 'Applications', to: '/workforce/admin/applications' }, { label: 'Dossier' }]}>
        <LoadingState message="Loading candidate dossier and verification records..." />
      </AppShell>
    );
  }

  const onboarding = application?.onboarding_data || {};
  const draft = onboarding.draft || {};
  const docs = onboarding.documents || {};
  const services = onboarding.services || [];
  const regStatus = (application?.registration_status || 'not_started').toLowerCase();

  const tabs = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'registration', label: 'Registration', icon: FileText },
    { id: 'services', label: 'Services', count: services.length, icon: Wrench },
    { id: 'documents', label: 'Documents', count: Object.keys(docs).length, icon: ShieldCheck },
    { id: 'experience', label: 'Experience & Skills', icon: Award },
    { id: 'bank', label: 'Bank Details', icon: CreditCard },
    { id: 'audit', label: 'Audit History', icon: History },
  ];

  return (
    <AppShell
      breadcrumbs={[
        { label: 'Home', to: '/workforce/admin' },
        { label: 'Applications', to: '/workforce/admin/applications' },
        { label: `${application?.first_name || ''} ${application?.last_name || ''}` },
      ]}
    >
      <div className="space-y-4">
        {/* Top Summary Banner with Actions */}
        <div className="bg-white border border-slate-200 rounded p-4 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                to="/workforce/admin/applications"
                className="p-1.5 rounded border border-slate-300 hover:bg-slate-50 text-slate-600 transition-colors"
                title="Back to Applications"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div className="w-10 h-10 rounded bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-800 text-sm">
                {application?.first_name ? application.first_name[0].toUpperCase() : 'T'}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-base font-bold text-slate-900">
                    {application?.first_name} {application?.last_name}
                  </h1>
                  <StatusBadge status={regStatus} />
                </div>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                  ID: <strong className="text-slate-800">{application?.employee_id || 'PENDING'}</strong> • {application?.email} • {application?.mobile_number || application?.phone}
                </p>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center gap-2 self-end md:self-auto flex-wrap">
              {regStatus !== 'approved' && regStatus !== 'rejected' && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowCorrectionModal(true)}
                    disabled={actionLoading}
                    className="px-3 py-1.5 rounded border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs transition-colors"
                  >
                    Request Correction
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRejectModal(true)}
                    disabled={actionLoading}
                    className="px-3 py-1.5 rounded border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-900 font-bold text-xs transition-colors"
                  >
                    Reject Candidate
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowApproveConfirm(true)}
                    disabled={actionLoading}
                    className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-colors"
                  >
                    Approve Technician
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Notifications */}
        {error && <ErrorState message={error} onDismiss={() => setError('')} />}
        {successMsg && (
          <div className="p-3 rounded border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Dossier Tabs */}
        <div className="bg-white border border-slate-200 rounded shadow-sm overflow-hidden">
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

          <div className="p-4 sm:p-5">
            {/* ── TAB 1: OVERVIEW ── */}
            {activeTab === 'overview' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Candidate Quick Stats */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded space-y-2 text-xs">
                    <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                      Candidate Details
                    </h3>
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between border-b border-slate-200 pb-1">
                        <span className="text-slate-500">Phone:</span>
                        <span className="font-mono font-medium text-slate-800">{application?.mobile_number || application?.phone}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-200 pb-1">
                        <span className="text-slate-500">Email:</span>
                        <span className="text-slate-800">{application?.email}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-200 pb-1">
                        <span className="text-slate-500">City / Territory:</span>
                        <span className="text-slate-800">{draft.address?.city || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Service Radius:</span>
                        <span className="font-bold text-slate-800">{draft.address?.serviceRadius ? `${draft.address.serviceRadius} km` : '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Summary of Services */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded space-y-2 text-xs">
                    <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                      Services Summary
                    </h3>
                    <p className="text-slate-600">
                      Requested: <strong className="text-slate-900">{services.length} services</strong>
                    </p>
                    <p className="text-slate-600">
                      Approved:{' '}
                      <strong className="text-emerald-700">
                        {services.filter((s) => s.status === 'approved').length}
                      </strong>
                    </p>
                    <p className="text-slate-600">
                      Pending:{' '}
                      <strong className="text-amber-700">
                        {services.filter((s) => s.status !== 'approved' && s.status !== 'rejected').length}
                      </strong>
                    </p>
                  </div>

                  {/* Summary of Documents */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded space-y-2 text-xs">
                    <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                      Documents Lodged
                    </h3>
                    <p className="text-slate-600">
                      Total Uploads: <strong className="text-slate-900">{Object.keys(docs).length} files</strong>
                    </p>
                    <p className="text-slate-600">
                      Verified:{' '}
                      <strong className="text-emerald-700">
                        {Object.values(docs).filter((d) => d.status === 'approved').length}
                      </strong>
                    </p>
                    <p className="text-slate-600">
                      Pending Action:{' '}
                      <strong className="text-amber-700">
                        {Object.values(docs).filter((d) => d.status !== 'approved' && d.status !== 'rejected').length}
                      </strong>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 2: REGISTRATION DETAILS ── */}
            {activeTab === 'registration' && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="border border-slate-200 rounded p-4 space-y-2 bg-slate-50/50">
                    <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2">
                      Personal Information
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between border-b border-slate-200 pb-1">
                        <span className="text-slate-500">Date of Birth:</span>
                        <span className="font-medium text-slate-800">{application?.date_of_birth || draft.personal?.dob || 'Not specified'}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-200 pb-1">
                        <span className="text-slate-500">Gender:</span>
                        <span className="font-medium text-slate-800 capitalize">{draft.personal?.gender || 'Male'}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-200 pb-1">
                        <span className="text-slate-500">Emergency Contact:</span>
                        <span className="font-medium text-slate-800">{draft.personal?.emergencyName || 'None'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Emergency Phone:</span>
                        <span className="font-mono text-slate-800">{draft.personal?.emergencyPhone || 'None'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded p-4 space-y-2 bg-slate-50/50">
                    <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2">
                      Address & Dispatch Territory
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between border-b border-slate-200 pb-1">
                        <span className="text-slate-500">Street Address:</span>
                        <span className="font-medium text-slate-800 text-right max-w-xs">{draft.address?.street || 'Not provided'}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-200 pb-1">
                        <span className="text-slate-500">City / State:</span>
                        <span className="font-medium text-slate-800">
                          {[draft.address?.city, draft.address?.state].filter(Boolean).join(', ') || '—'}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-slate-200 pb-1">
                        <span className="text-slate-500">Pincode:</span>
                        <span className="font-mono font-medium text-slate-800">{draft.address?.pincode || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Max Dispatch Radius:</span>
                        <span className="font-bold text-blue-700">{draft.address?.serviceRadius ? `${draft.address.serviceRadius} km` : '—'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 3: SERVICES AUTHORIZATION MATRIX (Rule 1) ── */}
            {activeTab === 'services' && (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Per-Service Authorization Matrix
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Technicians can ONLY be dispatched jobs for services explicitly marked as <strong className="text-slate-800">APPROVED</strong>.
                    </p>
                  </div>

                  {/* Bulk Action Controls Bar */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {selectedServiceIds.size > 0 ? (
                      <>
                        <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded">
                          {selectedServiceIds.size} Selected
                        </span>
                        <button
                          type="button"
                          onClick={() => handleBulkServiceAction('approve')}
                          disabled={actionLoading}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded transition-colors shadow-xs flex items-center gap-1 active:scale-95 disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve Selected ({selectedServiceIds.size})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBulkServiceAction('reject')}
                          disabled={actionLoading}
                          className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded transition-colors shadow-xs flex items-center gap-1 active:scale-95 disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject Selected ({selectedServiceIds.size})</span>
                        </button>
                      </>
                    ) : (
                      <>
                        {services.some((s) => s.status !== 'approved') && (
                          <button
                            type="button"
                            onClick={() => handleBulkServiceAction('approve', true)}
                            disabled={actionLoading}
                            className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs rounded transition-colors shadow-xs flex items-center gap-1 active:scale-95 disabled:opacity-50"
                            title="Approve all non-approved / pending services in 1 click"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Approve All Pending</span>
                          </button>
                        )}
                        {services.some((s) => s.status !== 'rejected') && (
                          <button
                            type="button"
                            onClick={() => handleBulkServiceAction('reject', true)}
                            disabled={actionLoading}
                            className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 font-bold text-xs rounded transition-colors shadow-xs flex items-center gap-1 active:scale-95 disabled:opacity-50"
                            title="Reject all non-approved services in 1 click"
                          >
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Reject All Pending</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase">
                      <tr>
                        <th className="px-3 py-2.5 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={services.length > 0 && selectedServiceIds.size === services.length}
                            onChange={() => handleToggleSelectAllServices(services)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                            title={selectedServiceIds.size === services.length ? 'Deselect All' : 'Select All'}
                          />
                        </th>
                        <th className="px-4 py-2.5">Service Name</th>
                        <th className="px-4 py-2.5">Category ID</th>
                        <th className="px-4 py-2.5">Authorization Status</th>
                        <th className="px-4 py-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {services.length > 0 ? (
                        services.map((svc) => {
                          const isApproved = svc.status === 'approved';
                          const isRejected = svc.status === 'rejected';
                          const isChecked = selectedServiceIds.has(String(svc.id));

                          return (
                            <tr key={svc.id} className={`transition-colors ${isChecked ? 'bg-blue-50/50' : 'hover:bg-slate-50/50'}`}>
                              <td className="px-3 py-2.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleSelectService(svc.id)}
                                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                />
                              </td>
                              <td className="px-4 py-2.5 font-bold text-slate-800">{svc.name}</td>
                              <td className="px-4 py-2.5 font-mono text-slate-500 text-[11px]">{svc.id}</td>
                              <td className="px-4 py-2.5">
                                <StatusBadge status={svc.status} />
                              </td>
                              <td className="px-4 py-2.5 text-right space-x-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleServiceAction(svc.id, 'approve')}
                                  disabled={actionLoading || isApproved}
                                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                                    isApproved
                                      ? 'bg-emerald-100 text-emerald-800 opacity-60 cursor-default'
                                      : 'border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 shadow-2xs active:scale-95'
                                  }`}
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleServiceAction(svc.id, 'reject')}
                                  disabled={actionLoading || isRejected}
                                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                                    isRejected
                                      ? 'bg-rose-100 text-rose-800 opacity-60 cursor-default'
                                      : 'border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-900 shadow-2xs active:scale-95'
                                  }`}
                                >
                                  Reject
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                            No requested services in this application dossier.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── TAB 4: DOCUMENTS VERIFICATION ── */}
            {activeTab === 'documents' && (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Uploaded Identification & Compliance Files
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Verify mandatory government IDs, address proof, and bank credentials.
                    </p>
                  </div>

                  {/* Bulk Action Controls Bar for Documents */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {selectedDocKeys.size > 0 ? (
                      <>
                        <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded">
                          {selectedDocKeys.size} Selected
                        </span>
                        <button
                          type="button"
                          onClick={() => handleBulkDocumentAction('approve')}
                          disabled={actionLoading}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded transition-colors shadow-xs flex items-center gap-1 active:scale-95 disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve Selected ({selectedDocKeys.size})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBulkDocumentAction('reject')}
                          disabled={actionLoading}
                          className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded transition-colors shadow-xs flex items-center gap-1 active:scale-95 disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject Selected ({selectedDocKeys.size})</span>
                        </button>
                      </>
                    ) : (
                      <>
                        {Object.values(docs).some((d) => d.status !== 'approved') && (
                          <button
                            type="button"
                            onClick={() => handleBulkDocumentAction('approve', true)}
                            disabled={actionLoading}
                            className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs rounded transition-colors shadow-xs flex items-center gap-1 active:scale-95 disabled:opacity-50"
                            title="Approve all non-approved / uploaded documents in 1 click"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Approve All Pending</span>
                          </button>
                        )}
                        {Object.values(docs).some((d) => d.status !== 'rejected') && (
                          <button
                            type="button"
                            onClick={() => handleBulkDocumentAction('reject', true)}
                            disabled={actionLoading}
                            className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 font-bold text-xs rounded transition-colors shadow-xs flex items-center gap-1 active:scale-95 disabled:opacity-50"
                            title="Reject all non-approved documents in 1 click"
                          >
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Reject All Pending</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase">
                      <tr>
                        <th className="px-3 py-2.5 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={Object.keys(docs).length > 0 && selectedDocKeys.size === Object.keys(docs).length}
                            onChange={() => handleToggleSelectAllDocs(Object.keys(docs))}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                            title={selectedDocKeys.size === Object.keys(docs).length ? 'Deselect All' : 'Select All'}
                          />
                        </th>
                        <th className="px-4 py-2.5">Document Type</th>
                        <th className="px-4 py-2.5">Status</th>
                        <th className="px-4 py-2.5">Review Flag / Reason</th>
                        <th className="px-4 py-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {Object.entries(docs).length > 0 ? (
                        Object.entries(docs).map(([key, doc]) => {
                          const isApproved = doc.status === 'approved';
                          const isRejected = doc.status === 'rejected';
                          const isChecked = selectedDocKeys.has(String(key));

                          return (
                            <tr key={key} className={`transition-colors ${isChecked ? 'bg-blue-50/50' : 'hover:bg-slate-50/50'}`}>
                              <td className="px-3 py-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleSelectDoc(key)}
                                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                />
                              </td>
                              <td className="px-4 py-3 font-semibold text-slate-900">
                                <div className="flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-slate-500" />
                                  <span>{doc.title || key}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <StatusBadge status={doc.status} />
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                {doc.rejection_reason ? (
                                  <span className="text-rose-600 font-semibold">{doc.rejection_reason}</span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right space-x-1.5">
                                {doc.file_url && (
                                  <a
                                    href={doc.file_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs inline-flex items-center gap-1 transition-colors"
                                  >
                                    <span>View File</span>
                                    <ExternalLink className="w-3 h-3 text-slate-400" />
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleDocAction(key, 'approve')}
                                  disabled={actionLoading || isApproved}
                                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                                    isApproved
                                      ? 'bg-emerald-100 text-emerald-800 opacity-60 cursor-default'
                                      : 'border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 shadow-2xs active:scale-95'
                                  }`}
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDocAction(key, 'reject')}
                                  disabled={actionLoading || isRejected}
                                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                                    isRejected
                                      ? 'bg-rose-100 text-rose-800 opacity-60 cursor-default'
                                      : 'border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-900 shadow-2xs active:scale-95'
                                  }`}
                                >
                                  Reject
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                            No documents uploaded in this application dossier.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── TAB 5: EXPERIENCE & SKILLS ── */}
            {activeTab === 'experience' && (
              <div className="space-y-4 text-xs">
                <div className="border border-slate-200 rounded p-4 bg-slate-50/50 space-y-3">
                  <h3 className="font-bold text-slate-800 uppercase tracking-wider text-xs">
                    Professional Experience & Equipment
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 bg-white border border-slate-200 rounded">
                      <span className="text-slate-500 block">Years Experience:</span>
                      <strong className="text-sm text-slate-900">{draft.skills?.experienceYears || 2} Years</strong>
                    </div>
                    <div className="p-3 bg-white border border-slate-200 rounded">
                      <span className="text-slate-500 block">Vehicle Transport:</span>
                      <strong className="text-sm text-slate-900 capitalize">
                        {(draft.skills?.vehicleType || 'two_wheeler').replace('_', ' ')}
                      </strong>
                    </div>
                    <div className="p-3 bg-white border border-slate-200 rounded">
                      <span className="text-slate-500 block">Driver License:</span>
                      <strong className="text-sm font-mono text-slate-900">{draft.skills?.licenseNumber || 'Not specified'}</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 6: BANK DETAILS ── */}
            {activeTab === 'bank' && (
              <div className="space-y-4 text-xs max-w-md">
                <div className="border border-slate-200 rounded p-4 bg-slate-50/50 space-y-2.5">
                  <h3 className="font-bold text-slate-800 uppercase tracking-wider text-xs mb-2">
                    Direct Deposit & Payout Credentials
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between border-b border-slate-200 pb-1">
                      <span className="text-slate-500">Account Holder:</span>
                      <span className="font-bold text-slate-900">{draft.bank?.accountHolder || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200 pb-1">
                      <span className="text-slate-500">Account Number:</span>
                      <span className="font-mono text-slate-900">
                        {draft.bank?.accountNumber ? `••••${draft.bank.accountNumber.slice(-4)}` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200 pb-1">
                      <span className="text-slate-500">IFSC Code:</span>
                      <span className="font-mono uppercase font-bold text-slate-900">{draft.bank?.ifsc || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">UPI ID:</span>
                      <span className="font-mono text-slate-800">{draft.bank?.upiId || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 7: AUDIT HISTORY ── */}
            {activeTab === 'audit' && (
              <div className="space-y-3 text-xs">
                <h3 className="font-bold text-slate-800 uppercase tracking-wider text-xs">
                  Dossier Audit & Verification Timeline
                </h3>
                <div className="border border-slate-200 rounded p-4 bg-slate-50/40 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      1
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">Application Submitted</p>
                      <p className="text-[11px] text-slate-500">
                        Candidate submitted onboarding form and lodged identification files.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      2
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">Current Status: {regStatus.toUpperCase()}</p>
                      <p className="text-[11px] text-slate-500">
                        Registration status updated in workforce database.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal: Request Correction */}
        <Modal
          isOpen={showCorrectionModal}
          onClose={() => setShowCorrectionModal(false)}
          title="Request Application Corrections"
          icon={AlertTriangle}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleRequestCorrectionSubmit} className="space-y-3 text-xs">
            <p className="text-slate-600">
              Enter specific instructions for the technician. They will be notified to correct flagged documents/fields and resubmit.
            </p>
            <textarea
              rows={4}
              value={correctionNotes}
              onChange={(e) => setCorrectionNotes(e.target.value)}
              placeholder="e.g. Aadhaar card photo is blurry. Please re-upload clear front & back photos."
              className="w-full p-2.5 border border-slate-300 rounded text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600"
              required
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCorrectionModal(false)}
                className="px-3 py-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-4 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold transition-colors"
              >
                Send Request
              </button>
            </div>
          </form>
        </Modal>

        {/* Modal: Reject Candidate */}
        <Modal
          isOpen={showRejectModal}
          onClose={() => setShowRejectModal(false)}
          title="Reject Candidate Application"
          icon={XCircle}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleRejectCandidateSubmit} className="space-y-3 text-xs">
            <p className="text-slate-600">
              Provide formal rationale for declining this applicant.
            </p>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Candidate does not meet trade certification standards."
              className="w-full p-2.5 border border-slate-300 rounded text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600"
              required
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="px-3 py-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-4 py-1.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold transition-colors"
              >
                Confirm Rejection
              </button>
            </div>
          </form>
        </Modal>

        {/* Confirm Approve Dialog */}
        <ConfirmDialog
          isOpen={showApproveConfirm}
          onClose={() => setShowApproveConfirm(false)}
          onConfirm={handleApproveApplication}
          title="Approve Technician for Workforce Operations"
          message={`Are you sure you want to approve ${application?.first_name} ${application?.last_name}? They will be authorized to receive job assignments for all approved services.`}
          confirmText="Approve Technician"
          confirmVariant="primary"
          isLoading={actionLoading}
        />
      </div>
    </AppShell>
  );
}

export default AdminApplicationDetailPage;
