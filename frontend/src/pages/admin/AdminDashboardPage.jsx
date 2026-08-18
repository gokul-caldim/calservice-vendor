import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  apiGetAdminApplications,
  apiGetWorkforceJobs,
  apiGetFleetMap,
} from '../../api/workforceService.js';
import { AppShell } from '../../components/common/AppShell.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { MetricStrip } from '../../components/enterprise/MetricStrip.jsx';
import { ActionCenter } from '../../components/enterprise/ActionCenter.jsx';
import { DataTable } from '../../components/enterprise/DataTable.jsx';
import { StatusBadge } from '../../components/enterprise/StatusBadge.jsx';
import { LoadingState } from '../../components/enterprise/LoadingState.jsx';
import {
  Users,
  CheckCircle2,
  Clock,
  Briefcase,
  AlertCircle,
  ArrowRight,
  Send,
  Calendar,
  Layers,
  FileCheck,
} from 'lucide-react';

export function AdminDashboardPage() {
  const [applications, setApplications] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [fleet, setFleet] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchedRef = React.useRef(false);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [appsData, jobsData] = await Promise.all([
        apiGetAdminApplications().catch(() => []),
        apiGetWorkforceJobs().catch(() => []),
      ]);
      setApplications(appsData || []);
      setJobs(jobsData || []);
    } catch (_) {
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    loadData();
  }, []);

  // Compute metrics from actual API data (NO mock data)
  const pendingApps = applications.filter((a) =>
    ['submitted', 'under_review'].includes((a.registration_status || '').toLowerCase())
  );
  const approvedTechs = applications.filter(
    (a) => (a.registration_status || '').toLowerCase() === 'approved'
  );
  const correctionApps = applications.filter(
    (a) => (a.registration_status || '').toLowerCase() === 'correction_required'
  );
  const unassignedJobs = jobs.filter((j) => (j.status || '').toLowerCase() === 'assigned' && !j.employee_id);
  const onlineFleet = fleet.filter((f) => f.is_online);
  const busyFleet = fleet.filter((f) => f.is_online && f.active_job);

  // Documents requiring verification count across all applications
  let docsToVerifyCount = 0;
  applications.forEach((app) => {
    const docs = app.documents_status || (app.onboarding_data && app.onboarding_data.documents) || {};
    Object.values(docs).forEach((d) => {
      if (d.status === 'pending' || d.status === 'submitted') docsToVerifyCount++;
    });
  });

  const actionItems = [
    {
      title: 'Pending Applications',
      count: pendingApps.length,
      description: 'Dossiers awaiting verification & service authorization',
      to: '/workforce/admin/applications?status=submitted',
      badgeClass: 'bg-amber-100 text-amber-900',
    },
    {
      title: 'Documents to Verify',
      count: docsToVerifyCount > 0 ? docsToVerifyCount : pendingApps.length,
      description: 'Identification & certification files in queue',
      to: '/workforce/admin/applications',
      badgeClass: 'bg-blue-100 text-blue-900',
    },
    {
      title: 'Jobs Awaiting Assignment',
      count: unassignedJobs.length,
      description: 'Customer bookings requiring technician dispatch',
      to: '/workforce/admin/dispatch',
      badgeClass: 'bg-orange-100 text-orange-900',
    },
    {
      title: 'Corrections Pending Resubmission',
      count: correctionApps.length,
      description: 'Technicians notified to re-upload flagged files',
      to: '/workforce/admin/applications?status=correction_required',
      badgeClass: 'bg-slate-100 text-slate-700',
    },
  ];

  const recentJobsColumns = [
    {
      key: 'request_id',
      header: 'Job ID',
      render: (val, row) => (
        <span className="font-mono font-bold text-blue-600">{val || `SR-${row.id}`}</span>
      ),
    },
    {
      key: 'customer_display_name',
      header: 'Customer',
      render: (val) => <span className="font-medium text-slate-800">{val || '—'}</span>,
    },
    {
      key: 'service_category',
      header: 'Service',
      render: (val, row) => (
        <span className="text-slate-700">{row.service_title || val || '—'}</span>
      ),
    },
    {
      key: 'address',
      header: 'Location',
      render: (val) => <span className="text-slate-500 truncate max-w-xs block">{val || '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (val) => <StatusBadge status={val} />,
    },
    {
      key: 'preferred_date',
      header: 'Scheduled Time',
      render: (val, row) => (
        <span className="text-slate-500 font-mono text-[11px]">
          {val ? `${val}${row.preferred_time ? ` ${row.preferred_time}` : ''}` : '—'}
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      align: 'right',
      render: (_, row) => (
        <Link
          to="/workforce/admin/dispatch"
          className="px-2 py-1 rounded bg-slate-100 hover:bg-blue-50 text-blue-600 font-bold text-[11px] transition-colors inline-flex items-center gap-1"
        >
          <span>Dispatch</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      ),
    },
  ];

  return (
    <AppShell breadcrumbs={[{ label: 'Home' }]}>
      <div className="space-y-4">
        {/* Page Header */}
        <PageHeader
          title="Workforce Operations Center"
          subtitle="Real-time personnel monitoring, dossier verifications, and dynamic dispatch"
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={loadData}
                className="px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-sm transition-colors"
              >
                Refresh Data
              </button>
              <Link
                to="/workforce/admin/dispatch"
                className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors inline-flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Open Dispatch Console</span>
              </Link>
            </div>
          }
        />

        {/* Action Center */}
        <ActionCenter items={actionItems} />

        {/* Workforce Overview Metric Strip */}
        <div>
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-blue-600" />
            Workforce Overview
          </h2>
          <MetricStrip
            columns={5}
            metrics={[
              {
                label: 'Total Registered',
                value: applications.length,
                icon: Users,
                subtext: 'Technicians on roster',
              },
              {
                label: 'Approved & Active',
                value: approvedTechs.length,
                icon: CheckCircle2,
                iconColor: 'text-emerald-600',
                valueColor: 'text-emerald-700',
                subtext: 'Authorized for jobs',
              },
              {
                label: 'Online & Available',
                value: onlineFleet.length,
                icon: CheckCircle2,
                iconColor: 'text-blue-600',
                valueColor: 'text-blue-700',
                subtext: 'Ready for dispatch',
              },
              {
                label: 'On Active Jobs',
                value: busyFleet.length,
                icon: Briefcase,
                iconColor: 'text-amber-600',
                valueColor: 'text-amber-700',
                subtext: 'Currently in field',
              },
              {
                label: 'Pending Review',
                value: pendingApps.length,
                icon: Clock,
                iconColor: 'text-orange-600',
                valueColor: 'text-orange-700',
                subtext: 'Awaiting dossier check',
              },
            ]}
          />
        </div>

        {/* Recent Operations Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-blue-600" />
              Recent Operations & Service Bookings ({jobs.length})
            </h2>
            <Link
              to="/workforce/admin/jobs"
              className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
            >
              <span>View All Jobs</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <DataTable
            columns={recentJobsColumns}
            data={[...jobs].sort((a, b) => (b.id || 0) - (a.id || 0)).slice(0, 8)}
            isLoading={isLoading}
            emptyMessage="No active customer service operations in queue."
          />
        </div>
      </div>
    </AppShell>
  );
}

export default AdminDashboardPage;
