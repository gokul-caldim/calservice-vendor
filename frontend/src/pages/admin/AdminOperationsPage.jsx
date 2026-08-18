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
  apiTriggerAutoDispatch,
  apiGetWorkforceJobs,
  apiGetFleetMap,
  apiGetAdminPendingServices,
  apiDecideService,
  apiGetAdminPendingExtensions,
  apiAdminDecideExtension,
  apiToggleLocationActive,
  apiGetJobTimeline,
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
import { loadMapsApi } from '../../utils/loadGoogleMaps.js';
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
  History,
  Eye,
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
    loadMapsApi(apiKey)
      .then(() => setApiLoaded(true))
      .catch((err) => setApiError(err?.message || 'Failed to load Google Maps.'));
  }, [apiKey]);

  // Init map once API loaded
  useEffect(() => {
    if (!apiLoaded || !mapContainerRef.current) return;
    if (mapRef.current) return; // already initialized
    const google = window.google;
    if (!google?.maps?.Map || !google?.maps?.ControlPosition) return;
    try {
      mapRef.current = new google.maps.Map(mapContainerRef.current, {
        center: { lat: 20.5937, lng: 78.9629 },
        zoom: 5,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      infoWindowRef.current = new google.maps.InfoWindow();
    } catch (err) {
      console.error('Error initializing AdminOperationsPage map:', err);
    }
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
  const [timelineJob, setTimelineJob] = useState(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineData, setTimelineData] = useState(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [techs, jobsList, eligible, locsData, fleetData, pendingSvcData, pendingExtData] =
        await Promise.all([
          apiGetAdminApplications('approved').catch(() => []),
          apiGetWorkforceJobs().catch(() => []),
          apiGetEligibleTechnicians().catch(() => []),
          apiGetLocations().catch(() => []),
          apiGetFleetMap().catch(() => []),
          apiGetAdminPendingServices().catch(() => []),
          apiGetAdminPendingExtensions().catch(() => []),
        ]);

      const safe = (d) => (Array.isArray(d) ? d : d?.results || []);
      setTechnicians(safe(techs));
      setJobs(safe(jobsList));
      setEligibleFleet(safe(eligible));
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

  const handleOpenTimeline = async (job) => {
    if (!job) return;
    setTimelineJob(job);
    setTimelineLoading(true);
    setTimelineData(null);
    try {
      const data = await apiGetJobTimeline(job.id);
      setTimelineData(data);
    } catch (err) {
      setTimelineData({ error: err.message || 'Failed to load timeline.' });
    } finally {
      setTimelineLoading(false);
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
    { id: 'dispatch', label: 'Automated Dispatch Monitor', icon: Send },
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
  ];

  return (
    <AppShell breadcrumbs={[{ label: 'Home', to: '/workforce/admin' }, { label: 'Dispatch & Operations' }]}>
      <div className="space-y-4">
        {/* Header */}
        <PageHeader
          title="Dynamic Dispatch & Fleet Operations"
          subtitle="Skill-based technician matching and real-time GPS telemetry radar"
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

            {/* ── TAB 1: AUTOMATED DISPATCH RADAR & MONITOR ── */}
            {activeTab === 'dispatch' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Service Request Queue Column (5 cols) */}
                <div className="lg:col-span-5 border border-slate-200 rounded overflow-hidden flex flex-col">
                  <div className="bg-slate-50 px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      1. Customer Service Requests ({jobs.length})
                    </h3>
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-200/70 px-1.5 py-0.5 rounded">
                      Auto-Dispatched
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto">
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
                              {j.service_title || j.service_category || j.issue_title}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">{j.address || 'Location provided in GPS coordinates'}</p>
                            <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-100 text-[10px] text-slate-500">
                              <span>
                                {j.assigned_employee
                                  ? `Assigned: ${j.assigned_employee.name || j.assigned_employee.employee_id || 'Tech'}`
                                  : j.status === 'assigned'
                                  ? 'Offer Active (Awaiting Acceptance)'
                                  : 'Auto-Dispatch Active'}
                              </span>
                              <span className="font-mono font-bold text-slate-600">
                                {j.preferred_date || 'Today'}
                              </span>
                            </div>
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

                {/* Automated Dispatch Telemetry & Candidate Monitor Column (7 cols) */}
                <div className="lg:col-span-7 border border-slate-200 rounded overflow-hidden flex flex-col">
                  <div className="bg-slate-50 px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        2. Live Automated Geo-Dispatch Engine Monitor
                      </h3>
                      <span className="text-[11px] text-slate-500">
                        Inspecting Job:{' '}
                        <strong className="text-blue-600">
                          {selectedJob ? selectedJob.request_id || `SR-${selectedJob.id}` : 'None Selected'}
                        </strong>
                        {selectedJob?.status && ` (${selectedJob.status.toUpperCase()})`}
                      </span>
                    </div>
                    {selectedJob && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenTimeline(selectedJob)}
                          className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold rounded text-xs inline-flex items-center gap-1.5 shadow-sm transition-colors"
                        >
                          <History className="w-3.5 h-3.5 text-blue-600" />
                          View Timeline
                        </button>
                        <button
                          type="button"
                          onClick={handleTriggerAutoDispatch}
                          disabled={dispatchLoading}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-xs inline-flex items-center gap-1 shadow-sm transition-colors"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          {dispatchLoading ? 'Reconciling...' : 'Re-evaluate Auto-Dispatch'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Operational Protocol Banner */}
                  <div className="p-3 bg-emerald-50/70 border-b border-emerald-200/60 text-[11px] text-emerald-900 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Autonomous Dispatch Active:</span> Jobs are automatically assigned to nearest eligible technicians using the <strong>9-Gate Employee Eligibility Engine</strong> (real-time browser GPS &le; 300s freshness window, Haversine proximity, skill match, and shift clock-in state). Zero manual dispatch required.
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto">
                    {eligibleFleet.length > 0 ? (
                      eligibleFleet.map((tech) => (
                        <div
                          key={tech.id}
                          className={`p-3.5 space-y-2 hover:bg-slate-50 transition-colors ${
                            tech.is_dispatch_ready ? 'bg-white' : 'bg-slate-50/60 opacity-80'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-lg border flex items-center justify-center font-bold text-xs shrink-0 ${
                                tech.is_dispatch_ready
                                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                                  : 'bg-slate-100 border-slate-200 text-slate-500'
                              }`}>
                                {tech.name ? tech.name[0].toUpperCase() : 'T'}
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-xs font-bold text-slate-900">{tech.name}</p>
                                  <StatusBadge
                                    status={tech.is_online ? 'online' : 'offline'}
                                    label={tech.is_online ? 'Online' : 'Offline'}
                                    size="xs"
                                  />
                                  {tech.gps_freshness && (
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                                      tech.gps_freshness === 'LIVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                      tech.gps_freshness === 'UPDATING' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                      tech.gps_freshness === 'DELAYED' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                      'bg-slate-100 text-slate-600 border border-slate-200'
                                    }`}>
                                      GPS: {tech.gps_freshness} {tech.gps_age_seconds != null ? `(${tech.gps_age_seconds}s)` : ''}
                                    </span>
                                  )}
                                  {tech.is_dispatch_ready && tech.score != null && (
                                    <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-900 text-[10px] font-bold">
                                      Match Score: {tech.score}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                                  {tech.employee_id} • {tech.phone || 'No phone'}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-1 text-right shrink-0">
                              {tech.distance_km != null ? (
                                <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                  {tech.distance_km.toFixed(1)} km away
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  Proximity Pending GPS
                                </span>
                              )}
                              <span className={`text-[10px] font-bold ${
                                tech.is_dispatch_ready ? 'text-emerald-700' : 'text-rose-700'
                              }`}>
                                {tech.is_dispatch_ready ? '✓ Qualified Candidate' : tech.ineligibility_reason || 'Ineligible'}
                              </span>
                            </div>
                          </div>

                          {/* 9-Gate Real Evaluation Audit Pills */}
                          {tech.gate_audit && (
                            <div className="pt-1.5 border-t border-slate-100 flex flex-wrap items-center gap-1 text-[10px]">
                              <span className="font-bold text-slate-500 uppercase tracking-wider text-[9px] mr-1">
                                9-Gate Evaluation:
                              </span>
                              {tech.gate_audit.map((g) => (
                                <span
                                  key={g.gate}
                                  title={`${g.gate}: ${g.name} (${g.passed ? 'PASSED' : 'REJECTED'})`}
                                  className={`px-1.5 py-0.5 rounded font-mono font-semibold flex items-center gap-0.5 ${
                                    g.passed
                                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80'
                                      : 'bg-rose-50 text-rose-800 border border-rose-200/80'
                                  }`}
                                >
                                  <span>{g.passed ? '✓' : '✗'}</span>
                                  <span>{g.name}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="p-12 text-center text-xs text-slate-500">
                        No online qualified technicians currently within operational radius for this service request.
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

      {/* ── JOB LIFECYCLE TIMELINE MODAL ── */}
      {timelineJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-600">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    Job Lifecycle Timeline — #{timelineJob.request_id || `SR-${timelineJob.id}`}
                    <StatusBadge status={timelineJob.status} size="xs" />
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {timelineJob.service_title || timelineJob.service_category || timelineJob.issue_title} • Customer: {timelineJob.customer_name || 'Customer'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setTimelineJob(null); setTimelineData(null); }}
                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 max-h-[60vh] overflow-y-auto">
              {timelineLoading ? (
                <div className="p-12 text-center flex flex-col items-center justify-center gap-2 text-slate-500">
                  <Loader className="w-6 h-6 animate-spin text-blue-600" />
                  <span className="text-xs font-semibold">Correlating lifecycle audit events...</span>
                </div>
              ) : timelineData?.error ? (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                  {timelineData.error}
                </div>
              ) : Array.isArray(timelineData?.timeline) && timelineData.timeline.length > 0 ? (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {timelineData.timeline.map((item, idx) => (
                    <div key={idx} className="relative group">
                      <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-white border-2 border-blue-600 flex items-center justify-center text-[9px] font-bold text-blue-600">
                        {idx + 1}
                      </div>
                      <div className="bg-slate-50 hover:bg-blue-50/50 border border-slate-200 rounded-lg p-3 transition-colors">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-bold text-slate-900">{item.title}</span>
                          <span className="text-[10px] font-mono text-slate-500">
                            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>
                        <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-200/60 text-[10px] text-slate-500">
                          <span className="font-medium text-slate-700">Actor: {item.actor}</span>
                          <span className="font-mono text-slate-400">{item.event_type}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-500">
                  No lifecycle events recorded for this job yet.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Total Events: <strong>{timelineData?.event_count || 0}</strong>
              </span>
              <button
                type="button"
                onClick={() => { setTimelineJob(null); setTimelineData(null); }}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg text-xs transition-colors"
              >
                Close Timeline
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default AdminOperationsPage;
