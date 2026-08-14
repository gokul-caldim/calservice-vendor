/**
 * EmployeeLocationPage.jsx
 *
 * Employee personal saved locations management.
 *
 * Separation of concerns:
 *  - EmployeeSavedLocation (this page) = personal locations for the employee
 *  - time_tracking.Location (Admin Operations) = company-authorized geofence
 *  - User.last_known_location = live device GPS, updated automatically when online
 *  - ServiceRequest.latitude/longitude = customer job location, read-only (not touched here)
 *
 * The employee can: create, read, update, delete, and set default for their saved locations.
 * Backend resolves the employee from the authenticated user — no frontend-supplied employee IDs.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppShell } from '../../components/common/AppShell.jsx';
import { LocationPickerMap } from '../../components/common/LocationPickerMap.jsx';
import { StatusBadge } from '../../components/enterprise/StatusBadge.jsx';
import { ErrorState } from '../../components/enterprise/ErrorState.jsx';
import { LoadingState } from '../../components/enterprise/LoadingState.jsx';
import { useReverseGeocode } from '../../hooks/useReverseGeocode.js';
import {
  apiGetSavedLocations,
  apiCreateSavedLocation,
  apiUpdateSavedLocation,
  apiDeleteSavedLocation,
  apiPatchSavedLocation,
} from '../../api/workforceService.js';
import {
  MapPin,
  Plus,
  Trash2,
  Edit2,
  Star,
  Home,
  Briefcase,
  Navigation,
  ChevronLeft,
  Save,
  X,
  CheckCircle2,
} from 'lucide-react';

const LABEL_ICONS = {
  home: Home,
  work: Briefcase,
  other: MapPin,
};

const LABEL_COLORS = {
  home: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  work: 'text-blue-600 bg-blue-50 border-blue-200',
  other: 'text-slate-600 bg-slate-50 border-slate-200',
};

const EMPTY_FORM = {
  label: 'other',
  name: '',
  address: '',
  locality: '',
  city: '',
  state: '',
  pincode: '',
  landmark: '',
  latitude: '',
  longitude: '',
  is_default: false,
};

export function EmployeeLocationPage() {
  const [locations, setLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [view, setView] = useState('list'); // 'list' | 'add' | 'edit'
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const { resolveAddress, loading: geocoding } = useReverseGeocode();
  const fetchedRef = useRef(false);

  const loadLocations = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      const data = await apiGetSavedLocations();
      setLocations(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load saved locations.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    loadLocations();
  }, [loadLocations]);

  const handlePositionChange = useCallback(
    async (lat, lng) => {
      setForm((f) => ({ ...f, latitude: lat.toString(), longitude: lng.toString() }));
      // Reverse geocode and auto-fill address fields
      const addr = await resolveAddress(lat, lng);
      if (addr) {
        setForm((f) => ({
          ...f,
          latitude: lat.toString(),
          longitude: lng.toString(),
          locality: addr.locality || f.locality,
          city: addr.city || f.city,
          state: addr.state || f.state,
          pincode: addr.pincode || f.pincode,
          address: addr.formatted_address || f.address,
        }));
      }
    },
    [resolveAddress],
  );

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setError('');
    setSuccess('');
    setView('add');
  };

  const openEdit = (loc) => {
    setForm({
      label: loc.label || 'other',
      name: loc.name || '',
      address: loc.address || '',
      locality: loc.locality || '',
      city: loc.city || '',
      state: loc.state || '',
      pincode: loc.pincode || '',
      landmark: loc.landmark || '',
      latitude: loc.latitude?.toString() || '',
      longitude: loc.longitude?.toString() || '',
      is_default: loc.is_default || false,
    });
    setEditingId(loc.id);
    setError('');
    setSuccess('');
    setView('edit');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.latitude || !form.longitude) {
      setError('Please select a location on the map before saving.');
      return;
    }
    if (!form.name.trim()) {
      setError('Location name is required.');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      const payload = {
        label: form.label,
        name: form.name.trim(),
        address: form.address,
        locality: form.locality,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
        landmark: form.landmark,
        latitude: parseFloat(parseFloat(form.latitude).toFixed(7)),
        longitude: parseFloat(parseFloat(form.longitude).toFixed(7)),
        is_default: form.is_default,
      };

      if (view === 'edit' && editingId) {
        await apiUpdateSavedLocation(editingId, payload);
        setSuccess('Location updated successfully.');
      } else {
        await apiCreateSavedLocation(payload);
        setSuccess('Location saved successfully.');
      }
      await loadLocations();
      setView('list');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to save location.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetDefault = async (loc) => {
    try {
      await apiPatchSavedLocation(loc.id, { is_default: true });
      await loadLocations();
    } catch (err) {
      setError(err.message || 'Failed to set default location.');
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiDeleteSavedLocation(id);
      setDeleteConfirmId(null);
      await loadLocations();
      setSuccess('Location deleted.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to delete location.');
    }
  };

  const handleCancel = () => {
    setView('list');
    setError('');
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const formLat = form.latitude ? parseFloat(form.latitude) : null;
  const formLng = form.longitude ? parseFloat(form.longitude) : null;

  return (
    <AppShell
      breadcrumbs={[
        { label: 'Home', to: '/workforce/employee/dashboard' },
        { label: 'My Locations' },
      ]}
    >
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            {view !== 'list' && (
              <button
                type="button"
                onClick={handleCancel}
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 mb-1 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Back to list
              </button>
            )}
            <h1 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              {view === 'list'
                ? 'My Saved Locations'
                : view === 'add'
                ? 'Add New Location'
                : 'Edit Location'}
            </h1>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {view === 'list'
                ? 'Manage your personal saved locations for quick access during jobs.'
                : 'Select a position on the map, then fill in the details below.'}
            </p>
          </div>
          {view === 'list' && (
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold shadow-sm transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Location
            </button>
          )}
        </div>

        {/* Alerts */}
        {error && (
          <ErrorState type="error" message={error} onDismiss={() => setError('')} />
        )}
        {success && (
          <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            {success}
          </div>
        )}

        {/* ── LIST VIEW ── */}
        {view === 'list' && (
          <>
            {isLoading ? (
              <LoadingState message="Loading your saved locations…" />
            ) : locations.length === 0 ? (
              <div className="border border-slate-200 rounded bg-white p-10 text-center space-y-2">
                <MapPin className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-sm font-semibold text-slate-600">No saved locations yet</p>
                <p className="text-xs text-slate-400">
                  Click "Add Location" to save your home, work, or any frequently visited place.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {locations.map((loc) => {
                  const LabelIcon = LABEL_ICONS[loc.label] || MapPin;
                  const labelColor = LABEL_COLORS[loc.label] || LABEL_COLORS.other;
                  return (
                    <div
                      key={loc.id}
                      className="bg-white border border-slate-200 rounded p-3.5 flex items-start justify-between gap-3 hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded border flex items-center justify-center shrink-0 ${labelColor}`}
                        >
                          <LabelIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {loc.name}
                            </span>
                            {loc.is_default && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-700">
                                <Star className="w-2.5 h-2.5" />
                                Default
                              </span>
                            )}
                            <span
                              className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold capitalize ${labelColor}`}
                            >
                              {loc.label}
                            </span>
                          </div>
                          {loc.address && (
                            <p className="text-[11px] text-slate-500 mt-0.5 truncate max-w-xs">
                              {loc.address}
                            </p>
                          )}
                          <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                            {parseFloat(loc.latitude).toFixed(5)},{' '}
                            {parseFloat(loc.longitude).toFixed(5)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {!loc.is_default && (
                          <button
                            type="button"
                            title="Set as default"
                            onClick={() => handleSetDefault(loc)}
                            className="p-1.5 rounded hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors"
                          >
                            <Star className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          title="Edit location"
                          onClick={() => openEdit(loc)}
                          className="p-1.5 rounded hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Delete location"
                          onClick={() => setDeleteConfirmId(loc.id)}
                          className="p-1.5 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── ADD / EDIT VIEW ── */}
        {(view === 'add' || view === 'edit') && (
          <form onSubmit={handleSave} className="space-y-4">
            {/* Map */}
            <div className="bg-white border border-slate-200 rounded p-4">
              <h3 className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-blue-500" />
                Select Location on Map
              </h3>
              <LocationPickerMap
                latitude={formLat}
                longitude={formLng}
                onPositionChange={handlePositionChange}
                showSearch
                height="260px"
              />
              {geocoding && (
                <p className="text-[10px] text-blue-600 mt-1">Resolving address…</p>
              )}
            </div>

            {/* Address fields */}
            <div className="bg-white border border-slate-200 rounded p-4 space-y-3">
              <h3 className="text-xs font-bold text-slate-800">Location Details</h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Label
                  </label>
                  <select
                    value={form.label}
                    onChange={(e) => setForm({ ...form, label: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 bg-white"
                  >
                    <option value="home">Home</option>
                    <option value="work">Work</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Location Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. My Home / Office"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Full Address
                </label>
                <textarea
                  rows={2}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 resize-none"
                  placeholder="Auto-filled from map selection (you can edit)"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Area / Locality
                  </label>
                  <input
                    type="text"
                    value={form.locality}
                    onChange={(e) => setForm({ ...form, locality: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Pincode
                  </label>
                  <input
                    type="text"
                    value={form.pincode}
                    onChange={(e) => setForm({ ...form, pincode: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Landmark (optional)
                  </label>
                  <input
                    type="text"
                    value={form.landmark}
                    onChange={(e) => setForm({ ...form, landmark: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="is-default-check"
                  type="checkbox"
                  checked={form.is_default}
                  onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600"
                />
                <label
                  htmlFor="is-default-check"
                  className="text-xs text-slate-700 font-medium cursor-pointer"
                >
                  Set as my default location
                </label>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleCancel}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || !form.latitude}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-xs font-bold transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                {isSaving ? 'Saving…' : view === 'edit' ? 'Update Location' : 'Save Location'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center">
                <Trash2 className="w-4 h-4 text-rose-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete Location?</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-3 py-1.5 border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default EmployeeLocationPage;
