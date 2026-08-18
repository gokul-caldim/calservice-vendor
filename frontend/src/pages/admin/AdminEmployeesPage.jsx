import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { apiGetAdminApplications, apiGetFleetMap } from '../../api/workforceService.js';
import { AppShell } from '../../components/common/AppShell.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { Toolbar } from '../../components/enterprise/Toolbar.jsx';
import { DataTable } from '../../components/enterprise/DataTable.jsx';
import { StatusBadge } from '../../components/enterprise/StatusBadge.jsx';
import { Drawer } from '../../components/enterprise/Drawer.jsx';
import { Pagination } from '../../components/enterprise/Pagination.jsx';
import { Users, Phone, Mail, MapPin, Wrench, ShieldCheck, ArrowRight } from 'lucide-react';

export function AdminEmployeesPage() {
  const [technicians, setTechnicians] = useState([]);
  const [fleet, setFleet] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [availabilityFilter, setAvailabilityFilter] = useState('ALL');
  const [selectedTech, setSelectedTech] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(12);
  const [isLoading, setIsLoading] = useState(true);

  const loadEmployees = async () => {
    try {
      setIsLoading(true);
      const techs = await apiGetAdminApplications().catch(() => []);
      setTechnicians(techs || []);
    } catch (_) {
    } finally {
      setIsLoading(false);
    }
  };

  const fetchedRef = React.useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    loadEmployees();
  }, []);

  const filteredData = useMemo(() => {
    return technicians.filter((tech) => {
      const term = searchTerm.toLowerCase().trim();
      const name = `${tech.first_name || ''} ${tech.last_name || ''}`.toLowerCase();
      const empId = (tech.employee_id || '').toLowerCase();
      const phone = (tech.mobile_number || tech.phone || '').toLowerCase();
      const matchesSearch = !term || name.includes(term) || empId.includes(term) || phone.includes(term);

      const reg = (tech.registration_status || '').toLowerCase();
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'approved' && reg === 'approved') ||
        (statusFilter === 'pending' && ['submitted', 'under_review'].includes(reg));

      const isOnline = Boolean(tech.is_online);
      const matchesAvailability =
        availabilityFilter === 'ALL' ||
        (availabilityFilter === 'online' && isOnline) ||
        (availabilityFilter === 'offline' && !isOnline);

      return matchesSearch && matchesStatus && matchesAvailability;
    });
  }, [technicians, searchTerm, statusFilter, availabilityFilter]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const columns = [
    {
      key: 'employee',
      header: 'Employee',
      render: (_, row) => (
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs shrink-0">
            {row.first_name ? row.first_name[0].toUpperCase() : 'T'}
          </div>
          <div>
            <span className="font-bold text-slate-900 block truncate">
              {row.first_name} {row.last_name}
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              {row.employee_id || 'ID Pending'}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'services',
      header: 'Approved Services',
      render: (_, row) => {
        const approved = (row.all_requested_services || []).filter((s) => s.status === 'approved');
        return (
          <div>
            <span className="font-semibold text-slate-800 text-xs">
              {approved.length} Services
            </span>
            <p className="text-[10px] text-slate-500 truncate max-w-[200px]">
              {approved.map((s) => s.name).join(', ') || 'No approved services'}
            </p>
          </div>
        );
      },
    },
    {
      key: 'is_online',
      header: 'Availability',
      render: (val, row) => (
        <StatusBadge
          status={val ? 'online' : 'offline'}
          label={val ? 'Online (Ready)' : 'Offline'}
        />
      ),
    },
    {
      key: 'phone',
      header: 'Contact',
      render: (_, row) => (
        <span className="font-mono text-slate-600 text-xs">{row.mobile_number || row.phone || '—'}</span>
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
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedTech(row);
          }}
          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs transition-colors"
        >
          View Details
        </button>
      ),
    },
  ];

  return (
    <AppShell breadcrumbs={[{ label: 'Home', to: '/workforce/admin' }, { label: 'Employees' }]}>
      <div className="space-y-3">
        {/* Header */}
        <PageHeader
          title="Workforce Employee Roster"
          subtitle="Directory of field technicians, active roster statuses, and dispatch credentials"
        />

        {/* Toolbar */}
        <Toolbar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Search employees by name, ID, phone..."
          filters={[
            {
              key: 'status',
              label: 'Status',
              options: [
                { value: 'ALL', label: 'All Statuses' },
                { value: 'approved', label: 'Approved Only' },
                { value: 'pending', label: 'Pending Only' },
              ],
            },
            {
              key: 'availability',
              label: 'Presence',
              options: [
                { value: 'ALL', label: 'All Presence' },
                { value: 'online', label: 'Online Only' },
                { value: 'offline', label: 'Offline Only' },
              ],
            },
          ]}
          activeFilters={{
            status: statusFilter,
            availability: availabilityFilter,
          }}
          onFilterChange={(key, val) => {
            if (key === 'status') setStatusFilter(val);
            if (key === 'availability') setAvailabilityFilter(val);
            setCurrentPage(1);
          }}
          onRefresh={loadEmployees}
          isRefreshing={isLoading}
        />

        {/* Dense Table */}
        <DataTable
          columns={columns}
          data={paginatedData}
          isLoading={isLoading}
          onRowClick={(row) => setSelectedTech(row)}
          emptyMessage="No technicians match the current filter parameters."
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

        {/* Quick Inspection Drawer */}
        <Drawer
          isOpen={Boolean(selectedTech)}
          onClose={() => setSelectedTech(null)}
          title={`${selectedTech?.first_name || ''} ${selectedTech?.last_name || ''}`}
          subtitle={`Employee ID: ${selectedTech?.employee_id || 'Pending'}`}
          footer={
            <Link
              to={`/workforce/admin/applications/${selectedTech?.id}`}
              className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs inline-flex items-center gap-1"
            >
              <span>Full Dossier</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          }
        >
          {selectedTech && (
            <div className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Registration Status:</span>
                  <StatusBadge status={selectedTech.registration_status} />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Live Presence:</span>
                  <StatusBadge
                    status={selectedTech.is_online ? 'online' : 'offline'}
                    label={selectedTech.is_online ? 'Online' : 'Offline'}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                  Contact Information
                </h4>
                <div className="space-y-1 text-slate-700">
                  <p className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{selectedTech.mobile_number || selectedTech.phone}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{selectedTech.email}</span>
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                  Authorized Services
                </h4>
                <div className="space-y-1">
                  {(selectedTech.all_requested_services || []).map((s) => (
                    <div
                      key={s.id}
                      className="p-2 bg-white border border-slate-200 rounded flex items-center justify-between"
                    >
                      <span className="font-medium text-slate-800">{s.name}</span>
                      <StatusBadge status={s.status} size="xs" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Drawer>
      </div>
    </AppShell>
  );
}

export default AdminEmployeesPage;
