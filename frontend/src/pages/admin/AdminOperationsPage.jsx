/**
 * AdminOperationsPage.jsx
 *
 * Workforce Admin: Dispatch, Fleet Map, Location Management, Leave, Extensions, Services.
 *
 * Enhancements over original:
 *  - Fleet Map tab: visual Google Maps with employee pin markers (online=green, offline=grey)
 *                   plus enhanced table with last_update and accuracy columns
 *  - Locations tab: map-based coordinate picker, edit, delete, activate/deactivate, geofence circle preview
 *
 * All APIs reuse existing endpoints. No new geofence engine introduced.
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  apiGetAdminApplications,
  apiGetEligibleTechnicians,
  apiDispatchAssign,
  apiTriggerAutoDispatch,
  apiGetWorkforceJobs,
  apiGetFleetMap,
  apiGetLeaves,
  apiAdminDecideLeave,
  apiGetAdminPendingServices,
  apiDecideService,
  apiGetAdminPendingExtensions,
  apiAdminDecideExtension,
  apiToggleLocationActive,
} from '../../api/workforceService.js';
import { apiGetLocations, apiCreateLocation } from '../../api/clockInApi.js';
import { apiRequest } from '../../api/client.js';
import { AppShell } from '../../components/common/AppShell.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { Tabs } from '../../components/enterprise/Tabs.jsx';
import { MetricStrip } from '../../components/enterprise/MetricStrip.jsx';
import { StatusBadge } from '../../components/enterprise/StatusBadge.jsx';
import { ErrorState } from '../../components/enterprise/ErrorState.jsx';
import { LoadingState } from '../../components/enterprise/LoadingState.jsx';
import { LocationPickerMap } from '../../components/common/LocationPickerMap.jsx';
import { useReverseGeocode } from '../../hooks/useReverseGeocode.js';
import {
  Send,
  Navigation,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Users,
  Briefcase,
  MapPin,
  Sparkles,
  Plus,
  PlusCircle,
  Wrench,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  X,
  Save,
  Loader,
  Radio,
} from 'lucide-react';

// ─── Delete location helper ───────────────────────────────────────────────────
async function apiDeleteAdminLocation(id) {
  return await apiRequest(`/workforce/time-tracking/locations/${id}/`, { method: 'DELETE' });
}

async function apiUpdateAdminLocation(id, payload) {
  return await apiRequest(`/workforce/time-tracking/locations/${id}/`, {
    method: 'PATCH',
    json: payload,
  });
}

// ─── Fleet Map with Google Maps visual ───────────────────────────────────────
function FleetMapVisual({ fleetData }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const infoWindowRef = useRef(null);
  const [apiLoaded, setApiLoaded] = useState(false);
  const [apiError, setApiError] = useState(null);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY;

  // Load API once
  useEffect(() => {
    if (!apiKey) {
      setApiError('VITE_GOOGLE_MAPS_KEY not configured.');
      return;
    }
    if (window.google?.maps) { setApiLoaded(true); return; }
    const existing = document.getElementById('gmap-script');
    if (existing) {
      existing.addEventListener('load', () => setApiLoaded(true));
      return;
    }
    const script = document.createElement('script');
    script.id = 'gmap-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => setApiLoaded(true);
    script.onerror = () => setApiError('Failed to load Google Maps.');
    document.head.appendChild(script);

  }, [apiKey]);

  // Init map once API loaded
  useEffect(() => {
    if (!apiLoaded || !mapContainerRef.current) return;
    if (mapRef.current) return; // already initialized
    const google = window.google;
    mapRef.current = new google.maps.Map(mapContainerRef.current, {
      center: { lat: 20.5937, lng: 78.9629 },
      zoom: 5,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });
    infoWindowRef.current = new google.maps.InfoWindow();
  }, [apiLoaded]);

  // Update markers whenever fleet data changes
  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    const google = window.google;

    // Clear old markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const validUnits = fleetData.filter((u) => u.has_location && u.latitude != null && u.longitude != null);

    if (validUnits.length === 0) return;

    const bounds = new google.maps.LatLngBounds();

    validUnits.forEach((unit) => {
      const pos = { lat: parseFloat(unit.latitude), lng: parseFloat(unit.longitude) };
      bounds.extend(pos);

      const marker = new google.maps.Marker({
        position: pos,
        map: mapRef.current,
        title: unit.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: unit.is_online ? '#10B981' : '#94A3B8',
          fillOpacity: 0.95,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
      });

      marker.addListener('click', () => {
        const accuracy = unit.accuracy ? `${Math.round(unit.accuracy)}m` : 'Unknown';
        const lastUpdate = unit.last_update
          ? new Date(unit.last_update).toLocaleTimeString()
          : 'Unknown';
        infoWindowRef.current.setContent(`
          <div style="font-family:sans-serif;font-size:12px;min-width:160px;line-height:1.6">
            <strong style="font-size:13px">${unit.name}</strong><br/>
            <span style="color:#64748b">${unit.employee_id}</span><br/>
            <span style="color:${unit.is_online ? '#10b981' : '#94a3b8'};font-weight:600">
              ${unit.is_online ? '● Online' : '● Offline'}
            </span><br/>
            GPS: ${parseFloat(unit.latitude).toFixed(5)}, ${parseFloat(unit.longitude).toFixed(5)}<br/>
            Accuracy: ${accuracy}<br/>
            Updated: ${lastUpdate}<br/>
            ${unit.active_job ? `<span style="color:#2563eb;font-weight:600">Job: ${unit.active_job}</span>` : ''}
          </div>
        `);
        infoWindowRef.current.open(mapRef.current, marker);
      });

      markersRef.current.push(marker);
    });

    if (validUnits.length === 1) {
      mapRef.current.setCenter({ lat: parseFloat(validUnits[0].latitude), lng: parseFloat(validUnits[0].longitude) });
      mapRef.current.setZoom(14);
    } else {
      mapRef.current.fitBounds(bounds);
    }
  }, [fleetData, apiLoaded]);

  if (apiError) {
    return (
      <div className="flex items-center justify-center h-48 bg-slate-50 rounded border border-slate-200">
        <div className="text-center">
          <MapPin className="w-6 h-6 text-slate-300 mx-auto mb-1" />
          <p className="text-xs text-slate-500">{apiError}</p>
        </div>
      </div>
    );
  }

  const noLocations = fleetData.every((u) => !u.has_location);

  return (
    <div className="relative rounded border border-slate-200 overflow-hidden" style={{ height: '320px' }}>
      {!apiLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-10">
          <div className="flex flex-col items-center gap-2 text-slate-500">
            <Loader className="w-5 h-5 animate-spin text-blue-500" />
            <span className="text-xs">Loading map…</span>
          </div>
        </div>
      )}
      {apiLoaded && noLocations && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50/80 z-10 pointer-events-none">
          <div className="text-center">
            <Radio className="w-5 h-5 text-slate-300 mx-auto mb-1" />
            <p className="text-xs text-slate-400">No GPS coordinates reported yet.</p>
          </div>
        </div>
      )}
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
}

// ─── Location Form Modal ──────────────────────────────────────────────────────
function LocationFormModal({ editingLocation, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: editingLocation?.name || '',
    address: editingLocation?.address || '',
    lat: editingLocation?.lat?.toString() || '',
    lng: editingLocation?.lng?.toString() || '',
    geofence_radius: editingLocation?.geofence_radius?.toString() || '500',
    geofence_type: editingLocation?.geofence_type || 'circle',
    is_active: editingLocation?.is_active !== false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { resolveAddress, loading: geocoding } = useReverseGeocode();
  const isEditing = Boolean(editingLocation);

  const handlePositionChange = useCallback(async (lat, lng) => {
    setForm((f) => ({ ...f, lat: lat.toString(), lng: lng.toString() }));
    const addr = await resolveAddress(lat, lng);
    if (addr && !form.address) {
      setForm((f) => ({
        ...f,
        lat: lat.toString(),
        lng: lng.toString(),
        address: addr.formatted_address || f.address,
      }));
    }
  }, [resolveAddress, form.address]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.lat || !form.lng) {
      setError('Please select a location on the map.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name,
        address: form.address,
        lat: parseFloat(form.lat),
        lng: parseFloat(form.lng),
        geofence_radius: parseInt(form.geofence_radius, 10),
        geofence_type: form.geofence_type,
        is_active: form.is_active,
      };
      if (isEditing) {
        await apiUpdateAdminLocation(editingLocation.id, payload);
      } else {
        await apiCreateLocation(payload);
      }
      onSaved(`Location "${form.name}" ${isEditing ? 'updated' : 'created'} successfully.`);
    } catch (err) {
      setError(err.message || 'Failed to save location.');
    } finally {
      setSaving(false);
    }
  };

  const formLat = form.lat ? parseFloat(form.lat) : null;
  const formLng = form.lng ? parseFloat(form.lng) : null;
  const geofenceRadius = parseInt(form.geofence_radius, 10) || 500;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-lg my-6 overflow-hidden">
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-blue-600" />
            {isEditing ? 'Edit Authorized Location' : 'Add Authorized Location'}
          </h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-slate-200 text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="px-3 py-2 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700">
              {error}
            </div>
          )}

          {/* Map picker */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
              Map Location <span className="text-rose-500">*</span>
              <span className="font-normal text-slate-400 ml-1">
                (click map, drag pin, or search)
              </span>
            </label>
            <LocationPickerMap
              latitude={formLat}
              longitude={formLng}
              onPositionChange={handlePositionChange}
              geofenceRadius={geofenceRadius}
              showSearch
              height="220px"
            />
            {geocoding && <p className="text-[10px] text-blue-600 mt-1">Resolving address…</p>}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Location Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Headquarters / Central Hub"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Address (optional)</label>
            <input
              type="text"
              placeholder="Auto-filled from map"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Geofence Radius (metres)</label>
              <input
                type="number"
                required
                min="10"
                max="50000"
                value={form.geofence_radius}
                onChange={(e) => setForm({ ...form, geofence_radius: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Geofence Type</label>
              <select
                value={form.geofence_type}
                onChange={(e) => setForm({ ...form, geofence_type: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 bg-white"
              >
                <option value="circle">Circle</option>
                <option value="polygon">Polygon</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="loc-active"
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600"
            />
            <label htmlFor="loc-active" className="text-xs text-slate-700 font-medium cursor-pointer">
              Active (visible to employees for clock-in)
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !form.lat}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-xs font-bold"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving…' : isEditing ? 'Update Location' : 'Save Location'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function AdminOperationsPage() {
  const [technicians, setTechnicians] = useState([]);
  const [eligibleFleet, setEligibleFleet] = useState([]);
  const [fleetMap, setFleetMap] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [pendingServices, setPendingServices] = useState([]);
  const [pendingExtensions, setPendingExtensions] = useState([]);
  const [locations, setLocations] = useState([]);
  const [showLocModal, setShowLocModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null); // null = create, object = edit
  const [deleteConfirmLocId, setDeleteConfirmLocId] = useState(null);

  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [activeTab, setActiveTab] = useState('dispatch');
  const [isLoading, setIsLoading] = useState(true);
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [techs, jobsList, eligible, leavesData, locsData, fleetData, pendingSvcData, pendingExtData] =
        await Promise.all([
          apiGetAdminApplications('approved').catch(() => []),
          apiGetWorkforceJobs().catch(() => []),
          apiGetEligibleTechnicians().catch(() => []),
          apiGetLeaves().catch(() => []),
          apiGetLocations().catch(() => []),
          apiGetFleetMap().catch(() => []),
          apiGetAdminPendingServices().catch(() => []),
          apiGetAdminPendingExtensions().catch(() => []),
        ]);

      const safe = (d) => (Array.isArray(d) ? d : d?.results || []);
      setTechnicians(safe(techs));
      setJobs(safe(jobsList));
      setEligibleFleet(safe(eligible));
      setLeaves(safe(leavesData));
      setLocations(safe(locsData));
      setFleetMap(safe(fleetData));
      setPendingServices(safe(pendingSvcData));
      setPendingExtensions(safe(pendingExtData));

      if (safe(jobsList).length > 0 && !selectedJob) {
        setSelectedJob(safe(jobsList)[0]);
      }
    } catch (_) {
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateLocation = async (e) => {
    e.preventDefault();
    // Legacy fallback — not used when modal is open; modal handles its own submit
  };

  const fetchedRef = React.useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    loadData();
  }, []);

  // ── Fleet Map: auto-refresh every 60s when tab is visible ──────────────────
  useEffect(() => {
    if (activeTab !== 'fleet_map') return;
    const interval = setInterval(async () => {
      try {
        const data = await apiGetFleetMap();
        setFleetMap(Array.isArray(data) ? data : data?.results || []);
      } catch (_) {}
    }, 60_000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const handleDispatch = async (techId) => {
    if (!selectedJob) return;
    try {
      setDispatchLoading(true);
      setStatusMsg({ type: '', text: '' });
      await apiDispatchAssign(selectedJob.id, techId);
      setStatusMsg({ type: 'success', text: `Job #${selectedJob.id} successfully assigned & dispatched!` });
      await loadData();
      setTimeout(() => setStatusMsg({ type: '', text: '' }), 4000);
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Dispatch assignment failed.' });
    } finally {
      setDispatchLoading(false);
    }
  };

  const handleTriggerAutoDispatch = async () => {
    if (!selectedJob) return;
    try {
      setDispatchLoading(true);
      setStatusMsg({ type: '', text: '' });
      const res = await apiTriggerAutoDispatch(selectedJob.id);
      setStatusMsg({ type: res.success ? 'success' : 'error', text: res.message });
      await loadData();
      setTimeout(() => setStatusMsg({ type: '', text: '' }), 4000);
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Auto dispatch failed.' });
    } finally {
      setDispatchLoading(false);
    }
  };

  const handleDecideLeave = async (empId, leaveId, action) => {
    try {
      setStatusMsg({ type: '', text: '' });
      let reason = '';
      if (action === 'reject') {
        reason = prompt('Enter rejection reason:') || 'Administrative decision';
      }
      await apiAdminDecideLeave(empId, leaveId, action, reason);
      setStatusMsg({ type: 'success', text: `Leave application ${action}d successfully.` });
      await loadData();
      setTimeout(() => setStatusMsg({ type: '', text: '' }), 4000);
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Action failed.' });
    }
  };

  const handleDecideServiceRequest = async (empId, serviceId, action) => {
    try {
      setStatusMsg({ type: '', text: '' });
      let reason = '';
      if (action === 'reject') {
        reason = prompt('Enter rejection reason:') || 'Qualifications do not meet minimum threshold';
      }
      await apiDecideService(empId, serviceId, action, reason);
      setStatusMsg({ type: 'success', text: `Service request ${action}d successfully.` });
      await loadData();
      setTimeout(() => setStatusMsg({ type: '', text: '' }), 4000);
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Service decision failed.' });
    }
  };

  const handleDecideExtension = async (jobId, extId, action, requestedAmount) => {
    try {
      setStatusMsg({ type: '', text: '' });
      let reason = '';
      let approvedAmount = null;
      if (action === 'APPROVED') {
        const amtInput = prompt(
          `Enter approved amount in ₹ (leave blank or keep ${requestedAmount} to approve full requested estimate):`,
          requestedAmount,
        );
        if (amtInput !== null && amtInput !== '') {
          approvedAmount = parseFloat(amtInput);
        }
      } else {
        reason = prompt('Enter rejection reason:') || 'Scope expansion not authorized.';
      }
      await apiAdminDecideExtension(jobId, extId, action, reason, approvedAmount);
      setStatusMsg({ type: 'success', text: `Work extension #${extId} marked as ${action}.` });
      await loadData();
      setTimeout(() => setStatusMsg({ type: '', text: '' }), 4000);
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Extension review failed.' });
    }
  };

  // ── Location CRUD handlers ─────────────────────────────────────────────────
  const handleLocModalSaved = async (msg) => {
    setShowLocModal(false);
    setEditingLocation(null);
    setStatusMsg({ type: 'success', text: msg });
    await loadData();
    setTimeout(() => setStatusMsg({ type: '', text: '' }), 4000);
  };

  const handleToggleActive = async (loc) => {
    try {
      await apiToggleLocationActive(loc.id, !loc.is_active);
      await loadData();
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to toggle location.' });
    }
  };

  const handleDeleteLocation = async (id) => {
    try {
      await apiDeleteAdminLocation(id);
      setDeleteConfirmLocId(null);
      setStatusMsg({ type: 'success', text: 'Location deleted.' });
      await loadData();
      setTimeout(() => setStatusMsg({ type: '', text: '' }), 3000);
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to delete location.' });
      setDeleteConfirmLocId(null);
    }
  };

  const onlineCount = (Array.isArray(technicians) ? technicians : []).filter((t) => t.is_online).length;
  const offlineCount = (Array.isArray(technicians) ? technicians.length : 0) - onlineCount;
  const fleetWithLocation = fleetMap.filter((u) => u.has_location).length;

  const tabs = [
    { id: 'dispatch', label: 'Dispatch Matrix', icon: Send },
    {
      id: 'fleet_map',
      label: `Live Fleet Telemetry (${Array.isArray(fleetMap) ? fleetMap.length : 0})`,
      icon: Navigation,
    },
    {
      id: 'extensions',
      label: `Scope Extensions (${Array.isArray(pendingExtensions) ? pendingExtensions.length : 0})`,
      icon: PlusCircle,
    },
    {
      id: 'services',
      label: `Service Requests (${Array.isArray(pendingServices) ? pendingServices.length : 0})`,
      icon: Wrench,
    },
    {
      id: 'locations',
      label: `Work Locations (${Array.isArray(locations) ? locations.length : 0})`,
      icon: MapPin,
    },
    {
      id: 'leaves',
      label: `Leave Schedule (${Array.isArray(leaves) ? leaves.length : 0})`,
      icon: Calendar,
    },
  ];

  return (
    <AppShell breadcrumbs={[{ label: 'Home', to: '/workforce/admin' }, { label: 'Dispatch & Operations' }]}>
      <div className="space-y-4">
        {/* Header */}
        <PageHeader
          title="Dynamic Dispatch & Fleet Operations"
          subtitle="Skill-based technician matching, real-time GPS telemetry radar, and leave management"
          actions={
            <button
              onClick={loadData}
              className="px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-sm transition-colors"
            >
              Refresh Fleet Data
            </button>
          }
        />

        {/* Metric Strip */}
        <MetricStrip
          columns={4}
          metrics={[
            { label: 'Total Fleet', value: technicians.length, icon: Users },
            {
              label: 'Online & Ready',
              value: onlineCount,
              icon: CheckCircle2,
              iconColor: 'text-emerald-600',
              valueColor: 'text-emerald-700',
              subtext: 'Available for work',
            },
            {
              label: 'Offline Fleet',
              value: offlineCount,
              icon: Clock,
              subtext: 'Off duty / break',
            },
            {
              label: 'Active Bookings',
              value: jobs.length,
              icon: Briefcase,
              iconColor: 'text-blue-600',
              valueColor: 'text-blue-700',
              subtext: 'In queue / assigned',
            },
          ]}
        />

        {statusMsg.text && (
          <ErrorState
            type={statusMsg.type === 'success' ? 'success' : 'error'}
            message={statusMsg.text}
            onDismiss={() => setStatusMsg({ type: '', text: '' })}
          />
        )}

        {/* Tabs */}
        <div className="bg-white border border-slate-200 rounded shadow-sm overflow-hidden">
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

          <div className="p-4 sm:p-5">

            {/* ── TAB 1: DISPATCH CONSOLE ── */}
            {activeTab === 'dispatch' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Unassigned Bookings Column (5 cols) */}
                <div className="lg:col-span-5 border border-slate-200 rounded overflow-hidden flex flex-col">
                  <div className="bg-slate-50 px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      1. Select Job to Dispatch ({jobs.length})
                    </h3>
                  </div>

                  <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                    {jobs.length > 0 ? (
                      jobs.map((j) => {
                        const isSelected = selectedJob?.id === j.id;
                        return (
                          <div
                            key={j.id}
                            onClick={() => setSelectedJob(j)}
                            className={`p-3 cursor-pointer transition-colors ${
                              isSelected ? 'bg-blue-50/70 border-l-4 border-blue-600' : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[11px] mb-1">
                              <span className="font-mono font-bold text-blue-600">
                                {j.request_id || `SR-${j.id}`}
                              </span>
                              <StatusBadge status={j.status} size="xs" />
                            </div>
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {j.service_title || j.service_category}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">{j.address}</p>
                            <p className="text-[10px] text-slate-400 font-mono mt-1">
                              Scheduled: {j.preferred_date || 'Today'} {j.preferred_time || ''}
                            </p>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-8 text-center text-xs text-slate-500">
                        No active service bookings in queue.
                      </div>
                    )}
                  </div>
                </div>

                {/* Eligible Technicians Column (7 cols) */}
                <div className="lg:col-span-7 border border-slate-200 rounded overflow-hidden flex flex-col">
                  <div className="bg-slate-50 px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        2. Skill-Matched Eligible Technicians ({eligibleFleet.length})
                      </h3>
                      <span className="text-[11px] text-slate-500">
                        Target Job:{' '}
                        <strong className="text-blue-600">
                          {selectedJob ? selectedJob.request_id || `SR-${selectedJob.id}` : 'None Selected'}
                        </strong>
                      </span>
                    </div>
                    {selectedJob && (
                      <button
                        type="button"
                        onClick={handleTriggerAutoDispatch}
                        disabled={dispatchLoading}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-xs inline-flex items-center gap-1 shadow-sm"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        {dispatchLoading ? 'Dispatching...' : 'Run Auto Dispatch'}
                      </button>
                    )}
                  </div>

                  <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                    {eligibleFleet.length > 0 ? (
                      eligibleFleet.map((tech) => (
                        <div
                          key={tech.id}
                          className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-800 text-xs shrink-0">
                              {tech.name ? tech.name[0].toUpperCase() : 'T'}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-bold text-slate-900">{tech.name}</p>
                                <StatusBadge
                                  status={tech.is_online ? 'online' : 'offline'}
                                  label={tech.is_online ? 'Online' : 'Offline'}
                                  size="xs"
                                />
                              </div>
                              <p className="text-[11px] text-slate-500 font-mono">
                                {tech.employee_id} • {tech.phone || 'No phone'}
                              </p>
                              <p className="text-[10px] text-slate-600 mt-0.5 truncate max-w-sm">
                                Approved Skills: {tech.approved_services?.join(', ') || 'General Service'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center shrink-0">
                            <button
                              type="button"
                              onClick={() => handleDispatch(tech.id)}
                              disabled={dispatchLoading || !selectedJob}
                              className="w-full sm:w-auto px-3.5 py-1.5 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs shadow-sm transition-colors flex items-center justify-center gap-1"
                            >
                              <Send className="w-3 h-3" />
                              <span>Assign & Dispatch</span>
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-12 text-center text-xs text-slate-500">
                        No eligible technicians currently available for this service category.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 2: LIVE FLEET GPS RADAR ── */}
            {activeTab === 'fleet_map' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Real-Time GPS Telemetry Radar
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Live coordinate locations and current dispatch statuses of field personnel.
                      Click a marker for details.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-500">
                      {fleetWithLocation}/{fleetMap.length} reporting GPS
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live Updates
                    </span>
                  </div>
                </div>

                {/* Visual map */}
                <FleetMapVisual fleetData={fleetMap} />

                {/* Legend */}
                <div className="flex items-center gap-4 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                    Online
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" />
                    Offline
                  </span>
                  <span className="text-slate-400">Auto-refreshes every 60 seconds</span>
                </div>

                {/* Enhanced table */}
                <div className="border border-slate-200 rounded overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase">
                      <tr>
                        <th className="px-4 py-2.5">Technician</th>
                        <th className="px-4 py-2.5">Presence</th>
                        <th className="px-4 py-2.5">GPS Coordinates</th>
                        <th className="px-4 py-2.5">Accuracy</th>
                        <th className="px-4 py-2.5">Last Updated</th>
                        <th className="px-4 py-2.5">Active Job</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {fleetMap.length > 0 ? (
                        fleetMap.map((unit) => (
                          <tr key={unit.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 font-bold text-slate-900">
                              {unit.name}
                              <span className="block text-[11px] text-slate-500 font-mono font-normal">
                                {unit.employee_id}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge
                                status={unit.is_online ? 'online' : 'offline'}
                                label={unit.is_online ? 'Online' : 'Offline'}
                                size="xs"
                              />
                            </td>
                            <td className="px-4 py-3">
                              {unit.has_location && unit.latitude != null && unit.longitude != null ? (
                                <span className="font-mono font-bold text-blue-700">
                                  {unit.latitude.toFixed(5)}, {unit.longitude.toFixed(5)}
                                </span>
                              ) : (
                                <span className="text-slate-400 font-mono text-[11px] italic">
                                  Location unavailable
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-600 font-mono text-[11px]">
                              {unit.accuracy != null ? `${Math.round(unit.accuracy)}m` : '—'}
                            </td>
                            <td className="px-4 py-3 text-slate-500 text-[11px]">
                              {unit.last_update
                                ? new Date(unit.last_update).toLocaleTimeString()
                                : '—'}
                            </td>
                            <td className="px-4 py-3">
                              {unit.active_job ? (
                                <span className="font-mono font-bold text-emerald-700">{unit.active_job}</span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                            No fleet units reporting GPS coordinates.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── TAB 3: LEAVE SCHEDULE ── */}
            {activeTab === 'leaves' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Technician Leave & Absence Schedule
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Personnel on approved leave are excluded from dynamic dispatch availability.
                  </p>
                </div>

                <div className="border border-slate-200 rounded overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase">
                      <tr>
                        <th className="px-4 py-2.5">Technician</th>
                        <th className="px-4 py-2.5">Leave Type</th>
                        <th className="px-4 py-2.5">Start Date</th>
                        <th className="px-4 py-2.5">End Date</th>
                        <th className="px-4 py-2.5">Reason</th>
                        <th className="px-4 py-2.5 text-right">Status / Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {leaves.length > 0 ? (
                        leaves.map((l) => (
                          <tr key={`${l.employee_pk || l.employee_id}_${l.id}`} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 font-bold text-slate-900">
                              {l.employee_name || l.employee_id}
                              <span className="block text-[10px] text-slate-500 font-mono font-normal">
                                {l.employee_id}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-800">{l.leave_type}</td>
                            <td className="px-4 py-3 font-mono text-slate-700">{l.start_date}</td>
                            <td className="px-4 py-3 font-mono text-slate-700">{l.end_date}</td>
                            <td className="px-4 py-3 text-slate-600">{l.reason || '—'}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <StatusBadge status={l.status || 'submitted'} size="xs" />
                                {l.status === 'submitted' && l.employee_pk && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleDecideLeave(l.employee_pk, l.id, 'approve')}
                                      className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px]"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDecideLeave(l.employee_pk, l.id, 'reject')}
                                      className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px]"
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                            No planned leaves registered in schedule.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── TAB: WORK EXTENSION & SCOPE APPROVALS ── */}
            {activeTab === 'extensions' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Technician Work Extension & Scope Approvals
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Review and decide additional labor and materials cost expansions submitted from active field jobs.
                  </p>
                </div>

                <div className="border border-slate-200 rounded overflow-hidden bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase">
                      <tr>
                        <th className="px-4 py-2.5">Job / Customer</th>
                        <th className="px-4 py-2.5">Technician</th>
                        <th className="px-4 py-2.5">Extension Title & Reason</th>
                        <th className="px-4 py-2.5">Cost Breakdown</th>
                        <th className="px-4 py-2.5">Flags</th>
                        <th className="px-4 py-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pendingExtensions.length > 0 ? (
                        pendingExtensions.map((ext) => (
                          <tr key={ext.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3">
                              <span className="font-mono font-bold text-blue-600 text-[11px]">
                                {ext.request_id || `Job #${ext.job_id}`}
                              </span>
                              <span className="block text-[10px] text-slate-500 mt-0.5">
                                {ext.customer_name || ext.customer_phone || '—'}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-800">
                              {ext.employee_name || ext.employee_id || '—'}
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-semibold text-slate-900">{ext.title}</p>
                              <p className="text-[10px] text-slate-500 mt-0.5">{ext.reason}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-slate-700">
                                Labor: <strong>₹{ext.additional_labor_cost || 0}</strong>
                              </p>
                              <p className="text-slate-700">
                                Materials: <strong>₹{ext.additional_materials_cost || 0}</strong>
                              </p>
                              <p className="text-emerald-700 font-bold">
                                Total: ₹{(parseFloat(ext.additional_labor_cost || 0) + parseFloat(ext.additional_materials_cost || 0)).toFixed(2)}
                              </p>
                            </td>
                            <td className="px-4 py-3 space-y-0.5">
                              {ext.is_critical && (
                                <span className="block px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                                  CRITICAL
                                </span>
                              )}
                              {ext.requires_specialist && (
                                <span className="block px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                                  SPECIALIST
                                </span>
                              )}
                              {!ext.is_critical && !ext.requires_specialist && (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right space-x-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  handleDecideExtension(
                                    ext.job_id,
                                    ext.id,
                                    'APPROVED',
                                    parseFloat(ext.additional_labor_cost || 0) +
                                      parseFloat(ext.additional_materials_cost || 0),
                                  )
                                }
                                className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleDecideExtension(ext.job_id, ext.id, 'REJECTED', 0)
                                }
                                className="px-2.5 py-1 rounded border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold text-xs"
                              >
                                Reject
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                            No pending work extensions awaiting approval.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── TAB: SERVICE REQUESTS ── */}
            {activeTab === 'services' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Technician Service Authorization Requests
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Review and approve or reject technician skill/service authorization requests.
                  </p>
                </div>

                <div className="border border-slate-200 rounded overflow-hidden bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase">
                      <tr>
                        <th className="px-4 py-2.5">Employee</th>
                        <th className="px-4 py-2.5">Service</th>
                        <th className="px-4 py-2.5">Request Type</th>
                        <th className="px-4 py-2.5">Requested On</th>
                        <th className="px-4 py-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pendingServices.length > 0 ? (
                        pendingServices.map((req) => (
                          <tr key={`${req.employee_id}_${req.service_id}`} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 font-bold text-slate-900">
                              {req.employee_name || req.employee_id}
                              <span className="block text-[10px] text-slate-500 font-mono font-normal">
                                {req.employee_id}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-800">
                              {req.service_name}
                              <span className="block text-[10px] text-slate-500 font-mono font-normal">
                                ID #{req.service_id}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  req.request_type === 'remove'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                                }`}
                              >
                                {req.request_type === 'remove' ? 'REMOVAL REQUEST' : 'NEW AUTHORIZATION'}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-600 text-[11px]">
                              {req.requested_at ? new Date(req.requested_at).toLocaleDateString() : 'Recent'}
                            </td>
                            <td className="px-4 py-3 text-right space-x-1.5">
                              <button
                                type="button"
                                onClick={() => handleDecideServiceRequest(req.employee_id, req.service_id, 'approve')}
                                className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDecideServiceRequest(req.employee_id, req.service_id, 'reject')}
                                className="px-2.5 py-1 rounded border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold text-xs"
                              >
                                Reject
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                            No pending service authorization requests in queue.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── TAB 4: GEOFENCED LOCATIONS MANAGEMENT ── */}
            {activeTab === 'locations' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Company Work & Service Locations
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Configure authorized job sites, hub boundaries, coordinates, and geofence radii
                      for employee shift clock-ins.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setEditingLocation(null); setShowLocModal(true); }}
                    className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-colors inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Authorized Location</span>
                  </button>
                </div>

                <div className="border border-slate-200 rounded overflow-hidden bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase">
                      <tr>
                        <th className="px-4 py-2.5">Location Name</th>
                        <th className="px-4 py-2.5">Address</th>
                        <th className="px-4 py-2.5">Coordinates</th>
                        <th className="px-4 py-2.5">Radius / Type</th>
                        <th className="px-4 py-2.5">Status</th>
                        <th className="px-4 py-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans">
                      {locations && locations.length > 0 ? (
                        locations.map((loc) => (
                          <tr key={loc.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-4 py-3 font-bold text-slate-900">{loc.name}</td>
                            <td className="px-4 py-3 text-slate-600 max-w-[180px] truncate">
                              {loc.address || '—'}
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-700 text-[11px]">
                              {loc.lat != null ? `${parseFloat(loc.lat).toFixed(5)}, ${parseFloat(loc.lng).toFixed(5)}` : '—'}
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-semibold text-slate-800">{loc.geofence_radius}m</span>
                              <span className="ml-1 text-slate-500 capitalize text-[10px]">
                                ({loc.geofence_type || 'circle'})
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge status={loc.is_active ? 'approved' : 'inactive'} size="xs" />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  title={loc.is_active ? 'Deactivate' : 'Activate'}
                                  onClick={() => handleToggleActive(loc)}
                                  className={`p-1.5 rounded transition-colors ${
                                    loc.is_active
                                      ? 'text-emerald-600 hover:bg-emerald-50'
                                      : 'text-slate-400 hover:bg-slate-100'
                                  }`}
                                >
                                  {loc.is_active ? (
                                    <ToggleRight className="w-4 h-4" />
                                  ) : (
                                    <ToggleLeft className="w-4 h-4" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  title="Edit location"
                                  onClick={() => { setEditingLocation(loc); setShowLocModal(true); }}
                                  className="p-1.5 rounded hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  title="Delete location"
                                  onClick={() => setDeleteConfirmLocId(loc.id)}
                                  className="p-1.5 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                            No authorized company locations configured yet. Click "Add Authorized Location" to create one.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Location Create/Edit Modal */}
      {showLocModal && (
        <LocationFormModal
          editingLocation={editingLocation}
          onClose={() => { setShowLocModal(false); setEditingLocation(null); }}
          onSaved={handleLocModalSaved}
        />
      )}

      {/* Delete Location Confirmation */}
      {deleteConfirmLocId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center">
                <Trash2 className="w-4 h-4 text-rose-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete Location?</h3>
                <p className="text-xs text-slate-500">
                  This will remove the authorized location and its geofence. Existing clock-in records
                  referencing this location are not affected.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmLocId(null)}
                className="px-3 py-1.5 border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteLocation(deleteConfirmLocId)}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold"
              >
                Delete Location
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default AdminOperationsPage;
