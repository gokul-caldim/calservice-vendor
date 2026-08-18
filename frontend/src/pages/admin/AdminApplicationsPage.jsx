import React, { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  apiGetAdminApplications,
  apiGetAdminChangeRequests,
  apiAdminDecideChangeRequest,
} from '../../api/workforceService.js';
import { AppShell } from '../../components/common/AppShell.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { Toolbar } from '../../components/enterprise/Toolbar.jsx';
import { DataTable } from '../../components/enterprise/DataTable.jsx';
import { StatusBadge } from '../../components/enterprise/StatusBadge.jsx';
import { Pagination } from '../../components/enterprise/Pagination.jsx';
import { Modal } from '../../components/enterprise/Modal.jsx';
import { ErrorState } from '../../components/enterprise/ErrorState.jsx';
import {
  ClipboardList,
  ArrowRight,
  User,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  FileText,
  Filter,
  Send,
  Check,
  X,
  Lock,
} from 'lucide-react';

export function AdminApplicationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStatus = searchParams.get('status') || '';
  const initialQuery = searchParams.get('q') || '';

  const [activeTab, setActiveTab] = useState('applications'); // 'applications' | 'change_requests'
  const [applications, setApplications] = useState([]);
  const [changeRequests, setChangeRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [serviceFilter, setServiceFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(12);
  const [isLoading, setIsLoading] = useState(true);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Change request modal state
  const [selectedCR, setSelectedCR] = useState(null);
  const [decisionAction, setDecisionAction] = useState('');
  const [decisionNotes, setDecisionNotes] = useState('');
  const [isDecidingCR, setIsDecidingCR] = useState(false);

  const fetchApplications = async () => {
    try {
      setIsLoading(true);
      const [apps, crs] = await Promise.all([
        apiGetAdminApplications(statusFilter).catch(() => []),
        apiGetAdminChangeRequests().catch(() => []),
      ]);
      setApplications(apps || []);
      setChangeRequests(crs || []);
    } catch (_) {
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, [statusFilter]);

  // Extract unique services from data for filter dropdown
  const uniqueServices = useMemo(() => {
    const sSet = new Set();
    applications.forEach((app) => {
      const svcs = app.all_requested_services || [];
      svcs.forEach((s) => s.name && sSet.add(s.name));
    });
    return Array.from(sSet);
  }, [applications]);

  const filteredData = useMemo(() => {
    return applications.filter((app) => {
      // Search
      const term = searchTerm.toLowerCase().trim();
      const name = `${app.first_name || ''} ${app.last_name || ''}`.toLowerCase();
      const empId = (app.employee_id || '').toLowerCase();
      const phone = (app.mobile_number || app.phone || '').toLowerCase();
      const matchesSearch = !term || name.includes(term) || empId.includes(term) || phone.includes(term);

      // Service filter
      let matchesService = true;
      if (serviceFilter !== 'ALL') {
        const svcs = app.all_requested_services || [];
        matchesService = svcs.some((s) => s.name === serviceFilter);
      }

      return matchesSearch && matchesService;
    });
  }, [applications, searchTerm, serviceFilter]);

  // Pagination slice
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const handleDecideCR = async (e) => {
    e.preventDefault();
    if (!selectedCR || !decisionAction) return;

    try {
      setIsDecidingCR(true);
      setActionError('');
      const res = await apiAdminDecideChangeRequest(selectedCR.id, decisionAction, decisionNotes);
      setActionSuccess(res.message || `Change Request ${decisionAction}D.`);
      setSelectedCR(null);
      setDecisionAction('');
      setDecisionNotes('');
      await fetchApplications();
      setTimeout(() => setActionSuccess(''), 4000);
    } catch (err) {
      setActionError(err.message || 'Failed to update Change Request.');
    } finally {
      setIsDecidingCR(false);
    }
  };

  const columns = [
    {
      key: 'employee',
      header: 'Employee / Candidate',
      render: (_, row) => (
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs shrink-0">
            {row.first_name ? row.first_name[0].toUpperCase() : 'T'}
          </div>
          <div className="min-w-0">
            <Link
              to={`/workforce/admin/applications/${row.id}`}
              className="font-bold text-slate-900 hover:text-blue-600 truncate block"
            >
              {row.first_name} {row.last_name}
            </Link>
            <p className="text-[11px] text-slate-500 font-mono truncate">
              {row.employee_id || 'ID Pending'} • {row.mobile_number || row.phone}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'services',
      header: 'Services Requested',
      render: (_, row) => {
        const svcs = row.all_requested_services || [];
        return (
          <div>
            <span className="font-semibold text-slate-800 text-xs">
              {svcs.length} Selected
            </span>
            <p className="text-[10px] text-slate-500 truncate max-w-[200px] mt-0.5">
              {svcs.map((s) => s.name).join(', ') || 'None selected'}
            </p>
          </div>
        );
      },
    },
    {
      key: 'documents',
      header: 'Documents',
      render: (_, row) => {
        const docs = row.documents_status || (row.onboarding_data && row.onboarding_data.documents) || {};
        const count = Object.keys(docs).length;
        return (
          <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span>{count} Uploaded</span>
          </span>
        );
      },
    },
    {
      key: 'created_at',
      header: 'Submitted Date',
      render: (val) => (
        <span className="text-slate-500 font-mono text-[11px]">
          {val ? new Date(val).toLocaleDateString() : 'Recent'}
        </span>
      ),
    },
    {
      key: 'registration_status',
      header: 'Status',
      render: (val) => <StatusBadge status={val} />,
    },
    {
      key: 'actions',
      header: 'Action',
      align: 'right',
      render: (_, row) => (
        <Link
          to={`/workforce/admin/applications/${row.id}`}
          className="px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs border border-blue-200 transition-colors inline-flex items-center gap-1"
        >
          <span>Review Dossier</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      ),
    },
  ];

  return (
    <AppShell breadcrumbs={[{ label: 'Home', to: '/workforce/admin' }, { label: 'Applications' }]}>
      <div className="space-y-3">
        {/* Page Header */}
        <PageHeader
          title="Employee Applications & Verification Queue"
          subtitle="Inspect identity dossiers, audit trade qualifications, and review controlled field change requests"
        />

        {actionError && <ErrorState message={actionError} onDismiss={() => setActionError('')} />}
        {actionSuccess && (
          <div className="p-3 rounded border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Tab Selection */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('applications')}
            className={`px-3 py-1.5 rounded font-bold transition-colors ${
              activeTab === 'applications'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Onboarding Applications ({applications.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('change_requests')}
            className={`px-3 py-1.5 rounded font-bold transition-colors flex items-center gap-1.5 ${
              activeTab === 'change_requests'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Profile Change Requests ({changeRequests.filter(c => c.status === 'PENDING').length} Pending)</span>
          </button>
        </div>

        {activeTab === 'applications' ? (
          <>
            {/* Toolbar with Search and Filters */}
            <Toolbar
              searchValue={searchTerm}
              onSearchChange={setSearchTerm}
              searchPlaceholder="Search by name, ID, phone..."
              filters={[
                {
                  key: 'status',
                  label: 'Status',
                  options: [
                    { value: '', label: 'All Statuses' },
                    { value: 'submitted', label: 'Pending Review' },
                    { value: 'under_review', label: 'Under Review' },
                    { value: 'correction_required', label: 'Correction Requested' },
                    { value: 'approved', label: 'Approved' },
                    { value: 'rejected', label: 'Rejected' },
                  ],
                },
                {
                  key: 'service',
                  label: 'Service',
                  options: [
                    { value: 'ALL', label: 'All Services' },
                    ...uniqueServices.map((s) => ({ value: s, label: s })),
                  ],
                },
              ]}
              activeFilters={{
                status: statusFilter,
                service: serviceFilter,
              }}
              onFilterChange={(key, val) => {
                if (key === 'status') setStatusFilter(val);
                if (key === 'service') setServiceFilter(val);
                setCurrentPage(1);
              }}
              onRefresh={fetchApplications}
              isRefreshing={isLoading}
            />

            {/* Dense Operational Table */}
            <DataTable
              columns={columns}
              data={paginatedData}
              isLoading={isLoading}
              emptyMessage="No employee applications match the selected filter criteria."
            />

            {/* Pagination */}
            {filteredData.length > pageSize && (
              <Pagination
                currentPage={currentPage}
                totalItems={filteredData.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
              />
            )}
          </>
        ) : (
          /* ── Change Requests Review Table ── */
          <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-sm">
            <div className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5">Request</th>
                    <th className="px-4 py-2.5">Technician</th>
                    <th className="px-4 py-2.5">Field</th>
                    <th className="px-4 py-2.5">Current Value</th>
                    <th className="px-4 py-2.5">Requested Value</th>
                    <th className="px-4 py-2.5">Reason</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5 text-right">Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {changeRequests.length > 0 ? (
                    changeRequests.map((cr) => (
                      <tr key={cr.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-slate-500">#{cr.id}</td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900">{cr.employee_name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{cr.employee_id}</p>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{cr.field_label || cr.field_name}</td>
                        <td className="px-4 py-3 text-slate-500 font-mono text-[11px] max-w-[120px] truncate">{cr.old_value || '—'}</td>
                        <td className="px-4 py-3 text-blue-700 font-bold max-w-[120px] truncate">{cr.new_value}</td>
                        <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={cr.reason}>{cr.reason}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={cr.status.toLowerCase()} size="xs" label={cr.status} />
                          {cr.reviewed_by_name && (
                            <p className="text-[10px] text-slate-400 mt-0.5">By: {cr.reviewed_by_name}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {cr.status === 'PENDING' ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedCR(cr);
                                  setDecisionAction('APPROVE');
                                  setDecisionNotes('');
                                }}
                                className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300 font-bold rounded text-[11px] inline-flex items-center gap-1 transition-colors"
                              >
                                <Check className="w-3 h-3" />
                                <span>Approve</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedCR(cr);
                                  setDecisionAction('REJECT');
                                  setDecisionNotes('');
                                }}
                                className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-300 font-bold rounded text-[11px] inline-flex items-center gap-1 transition-colors"
                              >
                                <X className="w-3 h-3" />
                                <span>Reject</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-medium">Decided</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        No employee profile change requests pending review.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Change Request Decision Modal */}
        <Modal
          isOpen={Boolean(selectedCR)}
          onClose={() => setSelectedCR(null)}
          title={`Confirm ${decisionAction} - Change Request #${selectedCR?.id}`}
          icon={decisionAction === 'APPROVE' ? Check : X}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleDecideCR} className="space-y-3 text-xs">
            <div className={`p-3 rounded border ${decisionAction === 'APPROVE' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
              <p className="font-bold">
                {decisionAction === 'APPROVE'
                  ? 'Approving will immediately update PostgreSQL records:'
                  : 'Rejecting will retain the existing profile records:'}
              </p>
              <p className="mt-1">
                <strong>Field:</strong> {selectedCR?.field_label || selectedCR?.field_name} &bull; <strong>Target Value:</strong> {selectedCR?.new_value}
              </p>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Admin Audit Notes / Rationale</label>
              <textarea
                rows={3}
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                placeholder={decisionAction === 'APPROVE' ? 'Verified against employee proof documentation...' : 'Reason for rejecting this change...'}
                className="w-full border border-slate-300 rounded px-3 py-1.5 text-slate-800 text-xs focus:ring-1 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedCR(null)}
                className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isDecidingCR}
                className={`px-4 py-1.5 rounded text-white font-bold shadow-sm disabled:opacity-50 inline-flex items-center gap-1 ${
                  decisionAction === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                <span>{isDecidingCR ? 'Processing...' : `Confirm ${decisionAction}`}</span>
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </AppShell>
  );
}

export default AdminApplicationsPage;
